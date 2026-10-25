import type { HAState, ProjectConfig } from '../../shared/models';
import { available } from '../../shared/capabilities';
import { finite } from '../../shared/spatial-state';
import { isImported } from '../wallpapers';

// ——— Routines « Si… alors… » ———
/** What starts a routine, in words a household uses. */
export type RoutineWhen = { kind: 'opens'; sensors: string[] } | { kind: 'sunset'; offsetMinutes: number } | { kind: 'arrives'; people: string[] } | { kind: 'time'; at: string };
/** What it then does. */
export type RoutineThen = { kind: 'climate-off'; entities: string[] } | { kind: 'lights-on'; entities: string[] } | { kind: 'covers-close'; entities: string[] } | { kind: 'notify'; message: string } | { kind: 'scene'; scene: string };
export interface Routine { name: string; when: RoutineWhen; then: RoutineThen }

/** A routine as the Home Assistant automation it becomes: plain triggers and actions anyone can open later in Home Assistant. */
export function automationOf(routine: Routine) {
  const { when, then } = routine;
  const triggers = when.kind === 'opens' ? [{ trigger: 'state', entity_id: when.sensors, to: 'on' }]
    : when.kind === 'sunset' ? [{ trigger: 'sun', event: 'sunset', ...(when.offsetMinutes ? { offset: `${when.offsetMinutes < 0 ? '-' : ''}00:${String(Math.abs(when.offsetMinutes)).padStart(2, '0')}:00` } : {}) }]
      : when.kind === 'arrives' ? [{ trigger: 'state', entity_id: when.people, to: 'home' }]
        : [{ trigger: 'time', at: /^\d{2}:\d{2}$/.test(when.at) ? `${when.at}:00` : when.at }];
  const actions = then.kind === 'climate-off' ? [{ action: 'climate.turn_off', target: { entity_id: then.entities } }]
    : then.kind === 'lights-on' ? [{ action: 'light.turn_on', target: { entity_id: then.entities } }]
      : then.kind === 'covers-close' ? [{ action: 'cover.close_cover', target: { entity_id: then.entities } }]
        : then.kind === 'notify' ? [{ action: 'persistent_notification.create', data: { title: routine.name, message: then.message } }]
          : [{ action: 'scene.turn_on', target: { entity_id: then.scene } }];
  return { alias: routine.name, description: 'Créée avec MP Nexus', triggers, conditions: [], actions, mode: 'single' };
}
/** Whether a routine has what it needs to run. */
export function routineReady(routine: Routine) {
  const { when, then } = routine;
  const whenOk = when.kind === 'opens' ? when.sensors.length > 0 : when.kind === 'arrives' ? when.people.length > 0 : when.kind === 'time' ? /^\d{2}:\d{2}/.test(when.at) : true;
  const thenOk = then.kind === 'notify' ? then.message.trim().length > 0 : then.kind === 'scene' ? then.scene.startsWith('scene.') : then.entities.length > 0;
  return !!routine.name.trim() && whenOk && thenOk;
}
/** An id for a new automation, as Home Assistant's own editor makes them. */
export const automationId = (now = Date.now()) => `mp_nexus_${now}`;

// ——— Energy ———
/** Power drawn now and energy counted, read from the sensors that declare them. */
export function energySummary(states: Record<string, HAState>) {
  const watts = (s: HAState) => { const v = finite(s.state); if (v === undefined) return undefined; const unit = String(s.attributes.unit_of_measurement ?? ''); return unit === 'kW' ? v * 1000 : unit === 'W' ? v : undefined; };
  const kwh = (s: HAState) => { const v = finite(s.state); if (v === undefined) return undefined; const unit = String(s.attributes.unit_of_measurement ?? ''); return unit === 'Wh' ? v / 1000 : unit === 'kWh' ? v : unit === 'MWh' ? v * 1000 : undefined; };
  const sensors = Object.values(states).filter(s => s.entity_id.startsWith('sensor.') && available(s));
  const power = sensors.filter(s => s.attributes.device_class === 'power').map(s => ({ id: s.entity_id, watts: watts(s) })).filter((p): p is { id: string; watts: number } => p.watts !== undefined).sort((a, b) => b.watts - a.watts);
  const energy = sensors.filter(s => s.attributes.device_class === 'energy').map(s => ({ id: s.entity_id, kwh: kwh(s) })).filter((e): e is { id: string; kwh: number } => e.kwh !== undefined).sort((a, b) => b.kwh - a.kwh);
  return { power, energy };
}

// ——— Backup and share ———
/** Keys that tie a project to one installation: its devices, its areas and its photos. */
const PRIVATE_KEYS = new Set(['entityId', 'entityIds', 'areaId', 'deviceId', 'backgroundUrl', 'backdrop', 'backdropId', 'image']);
/**
 * The project as a template another household can start from: the plan, its rooms and the look are kept; the devices,
 * the areas, the photos and the name of this home are left out.
 */
export function projectTemplate(project: ProjectConfig): ProjectConfig {
  const strip = (value: unknown): unknown => Array.isArray(value) ? value.map(strip)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEYS.has(key)).map(([key, inner]) => [key, strip(inner)])) : value;
  const template = strip(project) as ProjectConfig;
  // A wallpaper imported into this home is one of its photos; those of the library travel with the look.
  const appearance = { ...template.appearance, logoMark: 'MP' };
  if (isImported(appearance.wallpaper)) delete appearance.wallpaper;
  if (isImported(appearance.nightWallpaper)) delete appearance.nightWallpaper;
  return { ...template, project: { name: 'MP Nexus' }, appearance, roles: {}, overrides: {} };
}
export const backupName = (date = new Date()) => `mp-nexus-${date.toISOString().slice(0, 10)}.json`;

// ——— Screensaver ———
export type SaverContent = 'photos'|'plan'|'clock';
export type SaverWidget = 'clock'|'weather'|'timer'|'music'|'alerts'|'people';
/** Photos shown one after the other: those imported into this home, the library, or both. */
export type SaverPhotos = 'mine'|'library'|'all';
/** How one photo gives way to the next; 'random' draws one for each photo. */
export type SaverTransition = 'fade'|'slide'|'zoom'|'blur'|'wipe'|'circle'|'random';
export type SaverSpin = 'off'|'slow'|'normal'|'fast';
export interface SaverPrefs {
  enabled: boolean; content: SaverContent; widgets: SaverWidget[]; delayMinutes: number; nightDim: boolean; wakeSensor: string;
  photos: SaverPhotos; transition: SaverTransition; photoSeconds: number;
  spin: SaverSpin; cycleLayers: boolean; layerSeconds: number;
}
const SAVER_KEY = 'mp-nexus.screensaver';
export const SAVER_DEFAULTS: SaverPrefs = {
  enabled: false, content: 'photos', widgets: ['clock', 'weather', 'music', 'alerts'], delayMinutes: 2, nightDim: true, wakeSensor: '',
  photos: 'all', transition: 'random', photoSeconds: 15, spin: 'slow', cycleLayers: true, layerSeconds: 20,
};
export const SAVER_DELAYS = [1, 2, 5, 10, 30];
export const SAVER_PHOTO_SECONDS = [8, 15, 30, 60, 300];
export const SAVER_LAYER_SECONDS = [10, 20, 30, 60];
export const SAVER_TRANSITIONS = ['fade', 'slide', 'zoom', 'blur', 'wipe', 'circle'] as const;
/** Degrees a second the house turns on itself: a full turn in two minutes, one, or half a minute. */
export const SAVER_SPIN: Record<SaverSpin, number> = { off: 0, slow: 3, normal: 6, fast: 12 };
const pick = <T extends string>(values: readonly T[], value: unknown, fallback: T) => values.find(v => v === value) ?? fallback;
export function readSaver(): SaverPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVER_KEY) ?? '{}') as Partial<SaverPrefs>;
    const widgets: SaverWidget[] = ['clock', 'weather', 'timer', 'music', 'alerts', 'people'];
    return {
      enabled: saved.enabled === true, content: pick(['photos', 'plan', 'clock'], saved.content, SAVER_DEFAULTS.content),
      widgets: Array.isArray(saved.widgets) ? widgets.filter(w => saved.widgets!.includes(w)) : SAVER_DEFAULTS.widgets,
      delayMinutes: SAVER_DELAYS.includes(Number(saved.delayMinutes)) ? Number(saved.delayMinutes) : SAVER_DEFAULTS.delayMinutes,
      nightDim: saved.nightDim !== false, wakeSensor: typeof saved.wakeSensor === 'string' ? saved.wakeSensor : '',
      photos: pick(['mine', 'library', 'all'], saved.photos, SAVER_DEFAULTS.photos),
      transition: pick([...SAVER_TRANSITIONS, 'random'], saved.transition, SAVER_DEFAULTS.transition),
      photoSeconds: SAVER_PHOTO_SECONDS.includes(Number(saved.photoSeconds)) ? Number(saved.photoSeconds) : SAVER_DEFAULTS.photoSeconds,
      spin: pick(['off', 'slow', 'normal', 'fast'], saved.spin, SAVER_DEFAULTS.spin), cycleLayers: saved.cycleLayers !== false,
      layerSeconds: SAVER_LAYER_SECONDS.includes(Number(saved.layerSeconds)) ? Number(saved.layerSeconds) : SAVER_DEFAULTS.layerSeconds,
    };
  } catch { return { ...SAVER_DEFAULTS }; }
}
/** The transition that brings in photo `index`: the one chosen, or for 'random' one drawn anew each time, never twice in a row. */
export function slideTransition(transition: SaverTransition, index: number): typeof SAVER_TRANSITIONS[number] {
  if (transition !== 'random') return transition;
  const n = SAVER_TRANSITIONS.length, draw = (i: number) => Math.floor(Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453));
  let current = draw(0) % n;
  for (let i = 1; i <= index; i++) current = (current + 1 + draw(i) % (n - 1)) % n;
  return SAVER_TRANSITIONS[current]!;
}
/** Which step of a cycle is on screen `elapsed` ms after the screensaver started, with a step every `seconds`. */
export const cycleStep = (elapsed: number, seconds: number) => Math.floor(Math.max(0, elapsed) / (seconds * 1000));
export function writeSaver(prefs: SaverPrefs) { try { localStorage.setItem(SAVER_KEY, JSON.stringify(prefs)); } catch { /* For this page only. */ } }
/** Seconds left on a Home Assistant timer that runs. */
export function timerLeft(state: HAState | undefined, now = Date.now()) {
  if (state?.state !== 'active') return undefined;
  const end = Date.parse(String(state.attributes.finishes_at ?? ''));
  return Number.isFinite(end) ? Math.max(0, Math.round((end - now) / 1000)) : undefined;
}
