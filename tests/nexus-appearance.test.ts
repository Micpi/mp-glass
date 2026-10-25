import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppearanceConfig, HAState } from '../shared/models';
import { defaultProject, parseProject } from '../shared/project';
import { MP_GLASS_BACKGROUND } from '../frontend/background';
import { projectTemplate } from '../frontend/v2/plus';
import { nexusStyles } from '../frontend/v2/styles';
import { accentFromPixels, activeWallpaper, AMBIANCES, ambianceOf, cleanLook, hslHex, isNight, libraryWallpaper, readScreenLook, WALLPAPERS, wallpaperSource, writeScreenLook } from '../frontend/wallpapers';

const PHOTO = '0123456789abcdef0123456789abcdef';
const sun = (state: string): Record<string, HAState> => ({ 'sun.sun': { entity_id: 'sun.sun', state, attributes: {} } });
const look = (change: Partial<AppearanceConfig>): AppearanceConfig => ({ preset: 'glass-blue', ...change });

describe('MP Nexus appearance', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); }, removeItem: (key: string) => { store.delete(key); } });
  });

  it('ships a library whose every wallpaper and mood the project accepts', () => {
    expect(new Set(WALLPAPERS.map(w => w.id)).size).toBe(WALLPAPERS.length);
    for (const w of WALLPAPERS) expect(w.accent).toMatch(/^#[0-9a-f]{6}$/);
    for (const { look: mood } of AMBIANCES) {
      expect(libraryWallpaper(mood.wallpaper)).toBeDefined();
      const project = defaultProject();
      expect(() => parseProject({ ...project, appearance: { ...project.appearance, ...mood } })).not.toThrow();
    }
    const project = defaultProject();
    expect(() => parseProject({ ...project, appearance: { ...project.appearance, wallpaper: PHOTO, nightWallpaper: 'nuit' } })).not.toThrow();
    expect(() => parseProject({ ...project, appearance: { ...project.appearance, wallpaper: 'https://example.com/a.jpg' } })).toThrow();
  });

  it('shows the library wallpaper, the night one after sunset, a Studio path, or the villa', () => {
    const night = look({ wallpaper: 'aurore', nightWallpaper: 'nuit' });
    expect(isNight(sun('below_horizon'))).toBe(true);
    expect(isNight(sun('above_horizon'), new Date(2026, 0, 1, 23))).toBe(false);
    expect(isNight({}, new Date(2026, 0, 1, 23))).toBe(true);
    expect(activeWallpaper(night, false)).toBe('aurore');
    expect(activeWallpaper(night, true)).toBe('nuit');
    expect(activeWallpaper(look({ wallpaper: 'aurore' }), true)).toBe('aurore');
    expect(wallpaperSource(night, undefined, true, () => undefined)).toBe(libraryWallpaper('nuit')!.url);
    expect(wallpaperSource(look({ backgroundUrl: '/local/maison.webp' }), undefined, false, () => undefined)).toBe('/local/maison.webp');
    expect(wallpaperSource(look({}), undefined, false, () => undefined)).toBe(MP_GLASS_BACKGROUND);
  });

  it('fetches an imported photo with the session, and falls back once it is gone', async () => {
    const ready = vi.fn();
    const fetchWithAuth = vi.fn(async () => new Response('', { status: 404 }));
    const hass = { fetchWithAuth } as never;
    expect(wallpaperSource(look({ wallpaper: PHOTO }), hass, false, ready)).toBe('');
    expect(fetchWithAuth).toHaveBeenCalledWith(`/api/mp_glass/wallpaper/${PHOTO}`);
    await vi.waitFor(() => expect(ready).toHaveBeenCalled());
    expect(wallpaperSource(look({ wallpaper: PHOTO, backgroundUrl: '/local/a.webp' }), hass, false, ready)).toBe('/local/a.webp');
  });

  it('recognises a mood by its wallpaper and accent', () => {
    expect(ambianceOf(look({ accent: '#69b7ff' }))?.name).toBe('Nuit bleue');
    expect(ambianceOf(look(AMBIANCES[1]!.look))?.name).toBe('Aurore');
    expect(ambianceOf(look({ wallpaper: 'aurore', accent: '#ff0000' }))).toBeUndefined();
    expect(ambianceOf(look({ backgroundUrl: '/local/a.webp', accent: '#69b7ff' }))).toBeUndefined();
  });

  it('keeps for one screen only sound values of known keys', () => {
    expect(cleanLook({ wallpaper: 'aurore', accent: '#FF9F6E', glassOpacity: 2, radius: 20, backgroundPosition: 'top', fontStyle: 'soft', motion: false, preset: 'glass-oled', nightWallpaper: '../x' }))
      .toEqual({ wallpaper: 'aurore', accent: '#FF9F6E', radius: 20, fontStyle: 'soft', motion: false });
    expect(cleanLook('nonsense')).toEqual({});
    writeScreenLook({ wallpaper: PHOTO, accent: '#4fd1c5' });
    expect(readScreenLook()).toEqual({ wallpaper: PHOTO, accent: '#4fd1c5' });
    writeScreenLook({});
    expect(readScreenLook()).toEqual({});
  });

  it('draws an accent from the most present vivid colour, and a soft white from a grey picture', () => {
    const pixels = (...colours: [number, number, number, number][]) => colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat());
    const green = accentFromPixels(pixels([20, 200, 120, 60], [230, 120, 40, 20], [10, 10, 10, 120]));
    const [r, g, b] = [1, 3, 5].map(i => parseInt(green.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(b!);
    expect(accentFromPixels(pixels([128, 128, 128, 100]))).toBe('#e5e7eb');
    expect(hslHex(0, 1, .5)).toBe('#ff0000');
  });

  it('shares a template with the library wallpapers but without the photos of the home', () => {
    const project = defaultProject('Villa Ana');
    const template = projectTemplate({ ...project, appearance: { ...project.appearance, wallpaper: PHOTO, nightWallpaper: 'nuit' } });
    expect(template.appearance.wallpaper).toBeUndefined();
    expect(template.appearance.nightWallpaper).toBe('nuit');
  });

  it('never gives one class two meanings, so a new control cannot restyle the screensaver', () => {
    const rules = new Map<string, Set<string>>();
    for (const [, selectors, body] of nexusStyles.cssText.replace(/@[^{]+\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const props = body!.split(';').map(p => p.split(':')[0]!.trim()).filter(Boolean);
      for (const selector of selectors!.split(',').map(s => s.trim()).filter(s => /^\.[\w-]+$/.test(s))) {
        const seen = rules.get(selector) ?? new Set<string>();
        for (const prop of props) expect(seen.has(prop), `${selector} sets ${prop} twice`).toBe(false);
        props.forEach(prop => seen.add(prop));
        rules.set(selector, seen);
      }
    }
    expect(rules.get('.sw')?.has('width')).toBe(false);
  });
});
