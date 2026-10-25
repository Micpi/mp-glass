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
export interface SaverPrefs { enabled: boolean; content: SaverContent; widgets: SaverWidget[]; delayMinutes: number; nightDim: boolean; wakeSensor: string }
const SAVER_KEY = 'mp-nexus.screensaver';
export const SAVER_DEFAULTS: SaverPrefs = { enabled: false, content: 'photos', widgets: ['clock', 'weather', 'music', 'alerts'], delayMinutes: 2, nightDim: true, wakeSensor: '' };
export const SAVER_DELAYS = [1, 2, 5, 10, 30];
export function readSaver(): SaverPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVER_KEY) ?? '{}') as Partial<SaverPrefs>;
    const widgets: SaverWidget[] = ['clock', 'weather', 'timer', 'music', 'alerts', 'people'];
    return {
      enabled: saved.enabled === true, content: (['photos', 'plan', 'clock'] as const).find(c => c === saved.content) ?? SAVER_DEFAULTS.content,
      widgets: Array.isArray(saved.widgets) ? widgets.filter(w => saved.widgets!.includes(w)) : SAVER_DEFAULTS.widgets,
      delayMinutes: SAVER_DELAYS.includes(Number(saved.delayMinutes)) ? Number(saved.delayMinutes) : SAVER_DEFAULTS.delayMinutes,
      nightDim: saved.nightDim !== false, wakeSensor: typeof saved.wakeSensor === 'string' ? saved.wakeSensor : '',
    };
  } catch { return { ...SAVER_DEFAULTS }; }
}
export function writeSaver(prefs: SaverPrefs) { try { localStorage.setItem(SAVER_KEY, JSON.stringify(prefs)); } catch { /* For this page only. */ } }
/** Seconds left on a Home Assistant timer that runs. */
export function timerLeft(state: HAState | undefined, now = Date.now()) {
  if (state?.state !== 'active') return undefined;
  const end = Date.parse(String(state.attributes.finishes_at ?? ''));
  return Number.isFinite(end) ? Math.max(0, Math.round((end - now) / 1000)) : undefined;
}
