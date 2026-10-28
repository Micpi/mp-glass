import type { AppearanceConfig, HAState } from '../shared/models';
import type { Hass } from './ha/client';
import { PLAN_COLOR_KEYS } from '../shared/spatial-state';
import { MP_GLASS_BACKGROUND } from './background';
import loft from '../demo/assets/backgrounds/office.webp';
import yacht from '../demo/assets/backgrounds/yacht.webp';
import aurore from './wallpapers/aurore.webp';
import crepuscule from './wallpapers/crepuscule.webp';
import ocean from './wallpapers/ocean.webp';
import foret from './wallpapers/foret.webp';
import dunes from './wallpapers/dunes.webp';
import nuit from './wallpapers/nuit.webp';
import brume from './wallpapers/brume.webp';
import lagon from './wallpapers/lagon.webp';
import graphite from './wallpapers/graphite.webp';
import ambre from './wallpapers/ambre.webp';
import villaThumb from './wallpapers/thumbs/villa.webp';
import loftThumb from './wallpapers/thumbs/loft.webp';
import yachtThumb from './wallpapers/thumbs/yacht.webp';
import auroreThumb from './wallpapers/thumbs/aurore.webp';
import crepusculeThumb from './wallpapers/thumbs/crepuscule.webp';
import oceanThumb from './wallpapers/thumbs/ocean.webp';
import foretThumb from './wallpapers/thumbs/foret.webp';
import dunesThumb from './wallpapers/thumbs/dunes.webp';
import nuitThumb from './wallpapers/thumbs/nuit.webp';
import brumeThumb from './wallpapers/thumbs/brume.webp';
import lagonThumb from './wallpapers/thumbs/lagon.webp';
import graphiteThumb from './wallpapers/thumbs/graphite.webp';
import ambreThumb from './wallpapers/thumbs/ambre.webp';

/**
 * Wallpapers: a library shipped with MP Nexus, and photos an administrator imports, kept privately in Home Assistant.
 * `appearance.wallpaper` names one by its library name or by the identifier of an import; `nightWallpaper` takes over
 * once the sun has set. A path typed in the Studio (`backgroundUrl`) is used when neither is chosen.
 */
export type WallpaperName = 'Villa au crépuscule'|'Loft'|'Yacht'|'Aurore boréale'|'Crépuscule'|'Océan'|'Forêt'|'Dunes'|'Nuit étoilée'|'Brume'|'Lagon'|'Graphite'|'Ambre';
export interface Wallpaper { id: string; name: WallpaperName; url: string; thumb: string; accent: string; tint: string; position: NonNullable<AppearanceConfig['backgroundPosition']> }
export const WALLPAPERS: readonly Wallpaper[] = [
  { id: 'villa', name: 'Villa au crépuscule', url: MP_GLASS_BACKGROUND, thumb: villaThumb, accent: '#69b7ff', tint: '#12344f', position: 'right' },
  { id: 'loft', name: 'Loft', url: loft, thumb: loftThumb, accent: '#f2b66d', tint: '#2a2420', position: 'center' },
  { id: 'yacht', name: 'Yacht', url: yacht, thumb: yachtThumb, accent: '#5fc4ff', tint: '#1a3346', position: 'center' },
  { id: 'aurore', name: 'Aurore boréale', url: aurore, thumb: auroreThumb, accent: '#3ee6b0', tint: '#0c3a3a', position: 'center' },
  { id: 'crepuscule', name: 'Crépuscule', url: crepuscule, thumb: crepusculeThumb, accent: '#ff9f6e', tint: '#3a2140', position: 'right' },
  { id: 'ocean', name: 'Océan', url: ocean, thumb: oceanThumb, accent: '#5fd0ff', tint: '#0b3049', position: 'center' },
  { id: 'foret', name: 'Forêt', url: foret, thumb: foretThumb, accent: '#8fd694', tint: '#16332a', position: 'right' },
  { id: 'dunes', name: 'Dunes', url: dunes, thumb: dunesThumb, accent: '#f2b66d', tint: '#3b2420', position: 'left' },
  { id: 'nuit', name: 'Nuit étoilée', url: nuit, thumb: nuitThumb, accent: '#a78bfa', tint: '#1a1f45', position: 'center' },
  { id: 'brume', name: 'Brume', url: brume, thumb: brumeThumb, accent: '#8ea8ff', tint: '#1d2550', position: 'center' },
  { id: 'lagon', name: 'Lagon', url: lagon, thumb: lagonThumb, accent: '#4fd1c5', tint: '#0b3b43', position: 'center' },
  { id: 'graphite', name: 'Graphite', url: graphite, thumb: graphiteThumb, accent: '#e5e7eb', tint: '#111317', position: 'center' },
  { id: 'ambre', name: 'Ambre', url: ambre, thumb: ambreThumb, accent: '#ffb35a', tint: '#2b1a0e', position: 'center' },
];
export const DEFAULT_WALLPAPER = 'villa';
const IMPORTED = /^[a-f0-9]{32}$/;
export const isImported = (ref: string | undefined): ref is string => !!ref && IMPORTED.test(ref);
export const libraryWallpaper = (ref: string | undefined) => WALLPAPERS.find(w => w.id === ref);
export const importedPath = (id: string) => `/api/mp_glass/wallpaper/${id}`;

/** Accent colours offered as swatches; any other stays one tap away in the colour picker. */
export type AccentName = 'Bleu'|'Turquoise'|'Vert'|'Or'|'Orange'|'Corail'|'Rose'|'Violet'|'Ardoise'|'Blanc';
export const ACCENTS: readonly [string, AccentName][] = [['#69b7ff', 'Bleu'], ['#4fd1c5', 'Turquoise'], ['#7ee08a', 'Vert'], ['#ffd166', 'Or'], ['#ff9f5a', 'Orange'], ['#ff6b81', 'Corail'], ['#f472b6', 'Rose'], ['#a78bfa', 'Violet'], ['#94a3b8', 'Ardoise'], ['#f5f5f4', 'Blanc']];

/** A whole look in one tap: wallpaper, accent, glass and type that belong together. */
export type AmbianceName = 'Nuit bleue'|'Aurore'|'Coucher de soleil'|'Forêt'|'Désert'|'Minuit'|'Lagon'|'Loft'|'OLED';
export const AMBIANCES: readonly { name: AmbianceName; look: Partial<AppearanceConfig> }[] = [
  { name: 'Nuit bleue', look: { wallpaper: 'villa', accent: '#69b7ff', glassTint: '#12344f', glassOpacity: .62, glassBlur: 22, backgroundDim: .44, backgroundPosition: 'right', fontStyle: 'elegant' } },
  { name: 'Aurore', look: { wallpaper: 'aurore', accent: '#3ee6b0', glassTint: '#0c3a3a', glassOpacity: .58, glassBlur: 24, backgroundDim: .3, backgroundPosition: 'center', fontStyle: 'modern' } },
  { name: 'Coucher de soleil', look: { wallpaper: 'crepuscule', accent: '#ff9f6e', glassTint: '#3a2140', glassOpacity: .6, glassBlur: 22, backgroundDim: .32, backgroundPosition: 'right', fontStyle: 'elegant' } },
  { name: 'Forêt', look: { wallpaper: 'foret', accent: '#8fd694', glassTint: '#16332a', glassOpacity: .62, glassBlur: 20, backgroundDim: .36, backgroundPosition: 'right', fontStyle: 'soft' } },
  { name: 'Désert', look: { wallpaper: 'dunes', accent: '#f2b66d', glassTint: '#3b2420', glassOpacity: .6, glassBlur: 22, backgroundDim: .34, backgroundPosition: 'left', fontStyle: 'elegant' } },
  { name: 'Minuit', look: { wallpaper: 'nuit', accent: '#a78bfa', glassTint: '#1a1f45', glassOpacity: .58, glassBlur: 26, backgroundDim: .24, backgroundPosition: 'center', fontStyle: 'modern' } },
  { name: 'Lagon', look: { wallpaper: 'lagon', accent: '#4fd1c5', glassTint: '#0b3b43', glassOpacity: .55, glassBlur: 24, backgroundDim: .3, backgroundPosition: 'center', fontStyle: 'soft' } },
  { name: 'Loft', look: { wallpaper: 'loft', accent: '#f2b66d', glassTint: '#2a2420', glassOpacity: .66, glassBlur: 22, backgroundDim: .5, backgroundPosition: 'center', fontStyle: 'elegant' } },
  { name: 'OLED', look: { wallpaper: 'graphite', accent: '#e5e7eb', glassTint: '#111317', glassOpacity: .82, glassBlur: 12, backgroundDim: .7, backgroundPosition: 'center', fontStyle: 'modern' } },
];
/** The ambiance a look matches, if any: same wallpaper and accent. */
export const ambianceOf = (a: AppearanceConfig) => AMBIANCES.find(x => x.look.wallpaper === (a.wallpaper ?? (a.backgroundUrl ? undefined : DEFAULT_WALLPAPER)) && x.look.accent === (a.accent ?? '#69b7ff'));

/** Night for the wallpaper: the sun below the horizon, or else 21:00 to 7:00. */
export function isNight(states: Record<string, HAState> | undefined, now = new Date()) {
  const sun = states?.['sun.sun']?.state;
  if (sun === 'below_horizon' || sun === 'above_horizon') return sun === 'below_horizon';
  return now.getHours() >= 21 || now.getHours() < 7;
}
export const activeWallpaper = (a: AppearanceConfig, night: boolean) => (night && a.nightWallpaper) || a.wallpaper;

// ——— Images behind the session token, which a CSS background cannot send ———
const loaded = new Map<string, string>(), failed = new Set<string>(), loading = new Set<string>();
/** The object URL of an imported image once fetched; meanwhile undefined, and `ready` runs when it arrives. */
export function importedSource(hass: Hass | undefined, id: string, ready: () => void): string | undefined {
  const path = importedPath(id), known = loaded.get(path);
  if (known || failed.has(path) || loading.has(path) || !hass?.fetchWithAuth) return known;
  loading.add(path);
  void hass.fetchWithAuth(path).then(async response => {
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('wallpaper');
    loaded.set(path, URL.createObjectURL(await response.blob()));
  }).catch(() => { failed.add(path); }).finally(() => { loading.delete(path); ready(); });
  return undefined;
}
/** True once an imported image could not be fetched (removed, or no longer readable). */
export const importedMissing = (id: string) => failed.has(importedPath(id));

/** The image behind the dashboard: '' while an imported one is still on its way. */
export function wallpaperSource(a: AppearanceConfig, hass: Hass | undefined, night: boolean, ready: () => void): string {
  const ref = activeWallpaper(a, night);
  if (isImported(ref)) return importedMissing(ref) ? a.backgroundUrl || MP_GLASS_BACKGROUND : importedSource(hass, ref, ready) ?? '';
  return libraryWallpaper(ref)?.url ?? (a.backgroundUrl || MP_GLASS_BACKGROUND);
}
export const cssImage = (url: string) => url ? `url("${url.replace(/"/g, '%22')}")` : 'none';

// ——— Imports, kept by Home Assistant ———
export interface ImportedWallpaper { id: string; size: number; modified: number }
export async function listWallpapers(hass: Hass) {
  return (await hass.callWS<{ wallpapers: ImportedWallpaper[]; max: number }>({ type: 'mp_glass/wallpaper/list' }));
}
export async function deleteWallpaper(hass: Hass, id: string) {
  await hass.callWS({ type: 'mp_glass/wallpaper/delete', wallpaper_id: id });
  const path = importedPath(id), url = loaded.get(path);
  if (url) URL.revokeObjectURL(url);
  loaded.delete(path);
}
/** A photo reduced in the browser to 2560 px on its longest side, so a phone picture weighs a few hundred kilobytes. */
export async function prepareWallpaper(file: Blob, longest = 2560): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  // Safari draws WebP but writes PNG when asked for it: JPEG is far lighter for a photo.
  const webp = await encode('image/webp', .86);
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg', .88);
  if (!blob) throw new Error('encode');
  return blob;
}
export type UploadError = 'too_many'|'file_too_large'|'invalid_file'|'failed';
export async function uploadWallpaper(hass: Hass, blob: Blob): Promise<string> {
  if (!hass.fetchWithAuth) throw new Error('failed');
  const response = await hass.fetchWithAuth('/api/mp_glass/wallpaper', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
  const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
  if (!response.ok || !body.id || !IMPORTED.test(body.id)) throw new Error((['too_many', 'file_too_large', 'invalid_file'] as const).find(e => e === body.error) ?? 'failed');
  return body.id;
}

// ——— A colour drawn from the picture ———
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
export function hslHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex(f(0) * 255, f(8) * 255, f(4) * 255);
}
/**
 * The most present vivid hue of the pixels (RGBA), lifted to a colour that reads on dark glass; a grey picture gives
 * a soft white. Pure, for the tests: `accentOf` feeds it a small drawing of the image.
 */
export function accentFromPixels(data: ArrayLike<number>) {
  const bins = new Array<number>(36).fill(0);
  let colourful = 0, pixels = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]! / 255, g = data[i + 1]! / 255, b = data[i + 2]! / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
    pixels++;
    if (chroma < .12 || max < .12) continue;
    const h = max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    // Bright, saturated pixels say more about a picture than its dark corners.
    bins[Math.floor(h * 6) % 36]! += chroma * (.4 + max);
    colourful++;
  }
  if (!pixels || colourful / pixels < .04) return '#e5e7eb';
  let best = 0;
  bins.forEach((weight, i) => { const around = weight + .5 * (bins[(i + 35) % 36]! + bins[(i + 1) % 36]!); const top = bins[best]! + .5 * (bins[(best + 35) % 36]! + bins[(best + 1) % 36]!); if (around > top) best = i; });
  return hslHex(best * 10 + 5, .78, .66);
}
export async function accentOf(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try { await image.decode(); } catch { return undefined; }
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 36;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(image, 0, 0, 64, 36);
  return accentFromPixels(context.getImageData(0, 0, 64, 36).data);
}

// ——— A look of its own for one screen ———
/** What a screen may set for itself, over the look of the house. */
export const SCREEN_KEYS = ['wallpaper', 'nightWallpaper', 'accent', 'glassTint', 'glassOpacity', 'glassBlur', 'radius', 'backgroundDim', 'backgroundBlur', 'backgroundPosition', 'fontStyle', 'motion',
  'planColors', 'planGlow', 'hiddenLayers', 'hiddenEntities', 'showClock', 'showStats', 'showScenes'] as const;
export type ScreenLook = Partial<Pick<AppearanceConfig, typeof SCREEN_KEYS[number]>>;
export const SCREEN_LOOK_KEY = 'mp-nexus.appearance';
const colour = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
const within = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
const ref = (v: unknown) => typeof v === 'string' && (libraryWallpaper(v) || IMPORTED.test(v)) ? v : undefined;
const flag = (v: unknown) => typeof v === 'boolean' ? v : undefined;
/** The sound entries of a list, each once; an empty or unreadable one is no choice at all. */
function list<T>(v: unknown, item: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const kept = [...new Set(v.map(item).filter((x): x is T => x !== undefined))];
  return kept.length ? kept : undefined;
}
function planColors(v: unknown): ScreenLook['planColors'] {
  if (!v || typeof v !== 'object') return undefined;
  const kept = Object.fromEntries(PLAN_COLOR_KEYS.map(key => [key, colour((v as Record<string, unknown>)[key])]).filter(([, x]) => x));
  return Object.keys(kept).length ? kept : undefined;
}
/** Only the known keys with sound values: a hand-edited or older entry never breaks the page. */
export function cleanLook(value: unknown): ScreenLook {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const look: ScreenLook = {
    wallpaper: ref(v.wallpaper), nightWallpaper: ref(v.nightWallpaper), accent: colour(v.accent), glassTint: colour(v.glassTint),
    glassOpacity: within(v.glassOpacity, .25, .9), glassBlur: within(v.glassBlur, 0, 40), radius: within(v.radius, 10, 38),
    backgroundDim: within(v.backgroundDim, 0, .8), backgroundBlur: within(v.backgroundBlur, 0, 20),
    backgroundPosition: (['left', 'center', 'right'] as const).find(p => p === v.backgroundPosition), fontStyle: (['elegant', 'modern', 'soft'] as const).find(f => f === v.fontStyle),
    motion: typeof v.motion === 'boolean' ? v.motion : undefined,
    planColors: planColors(v.planColors), planGlow: within(v.planGlow, .3, 1.8),
    hiddenLayers: list(v.hiddenLayers, x => (['climate', 'openings', 'media', 'laundry'] as const).find(m => m === x)),
    hiddenEntities: list(v.hiddenEntities, x => typeof x === 'string' && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(x) ? x : undefined),
    showClock: flag(v.showClock), showStats: flag(v.showStats), showScenes: flag(v.showScenes),
  };
  return Object.fromEntries(Object.entries(look).filter(([, x]) => x !== undefined)) as ScreenLook;
}
export function readScreenLook(): ScreenLook {
  try { return cleanLook(JSON.parse(localStorage.getItem(SCREEN_LOOK_KEY) ?? '{}')); } catch { return {}; }
}
export function writeScreenLook(look: ScreenLook) {
  try {
    if (Object.keys(look).length) localStorage.setItem(SCREEN_LOOK_KEY, JSON.stringify(look));
    else localStorage.removeItem(SCREEN_LOOK_KEY);
  } catch { /* For this page only. */ }
}
