import type { HAState } from '../../shared/models';
import { available } from '../../shared/capabilities';
import { contactSensor, finite } from '../../shared/spatial-state';
import type { Hass } from '../ha/client';

/** What this screen remembers for itself: a wall tablet and a phone can each choose differently. */
export interface NexusPrefs { people: boolean; comfort: boolean; quietNight: boolean; seen: string[] }
const PREFS_KEY = 'mp-nexus.prefs';
const DEFAULTS: NexusPrefs = { people: true, comfort: false, quietNight: false, seen: [] };
export function readPrefs(): NexusPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<NexusPrefs>;
    return { people: saved.people !== false, comfort: saved.comfort === true, quietNight: saved.quietNight === true, seen: Array.isArray(saved.seen) ? saved.seen.filter((s): s is string => typeof s === 'string').slice(-200) : [] };
  } catch { return { ...DEFAULTS }; }
}
export function writePrefs(prefs: NexusPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* The choice holds for this page only. */ }
}
/** The silent night runs from 23:00 to 7:00: only alarms count then. */
export const QUIET_FROM = 23, QUIET_TO = 7;
export function inQuietHours(now = new Date()) { const h = now.getHours(); return h >= QUIET_FROM || h < QUIET_TO; }

/** A person of the house as Home Assistant tracks them. */
export interface Person { id: string; name: string; home: boolean; picture?: string }
export function people(states: Record<string, HAState>): Person[] {
  return Object.values(states).filter(s => s.entity_id.startsWith('person.') && available(s)).map(s => ({
    id: s.entity_id, name: String(s.attributes.friendly_name ?? s.entity_id.slice(7)), home: s.state === 'home',
    picture: typeof s.attributes.entity_picture === 'string' && s.attributes.entity_picture ? s.attributes.entity_picture : undefined,
  })).sort((a, b) => Number(b.home) - Number(a.home) || a.name.localeCompare(b.name));
}

/** Something in the house that wants a look: grouped by how much it matters. */
export type AlertLevel = 'alarm'|'security'|'house'|'info';
export type AlertKind = 'open'|'unlocked'|'alarm'|'battery'|'heating-open'|'update';
export interface Alert { key: string; level: AlertLevel; kind: AlertKind; entity: string; value?: number; room?: string }
const ALARM_CLASSES = ['smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety', 'tamper'];

/**
 * The alerts of the house, read from its states: alarms that sound, doors and windows left open, locks left open, batteries
 * running low, heating or cooling with a window open in the same room, and updates waiting. Each one carries the moment
 * its state last changed, so an alert marked as read comes back when it happens again.
 */
export function houseAlerts(states: Record<string, HAState>, roomOf: (entityId: string) => string | undefined): Alert[] {
  const alerts: Alert[] = [], key = (s: HAState, kind: string) => `${kind}|${s.entity_id}|${s.last_changed ?? ''}`;
  const openRooms = new Set<string>();
  for (const s of Object.values(states)) {
    if (!available(s)) continue;
    const domain = s.entity_id.split('.')[0], deviceClass = String(s.attributes.device_class ?? '');
    if (domain === 'binary_sensor' && s.state === 'on' && ALARM_CLASSES.includes(deviceClass)) alerts.push({ key: key(s, 'alarm'), level: 'alarm', kind: 'alarm', entity: s.entity_id, room: roomOf(s.entity_id) });
    else if (domain === 'binary_sensor' && s.state === 'on' && contactSensor(s)) {
      const room = roomOf(s.entity_id);
      if (room) openRooms.add(room);
      alerts.push({ key: key(s, 'open'), level: 'security', kind: 'open', entity: s.entity_id, room });
    } else if (domain === 'lock' && ['unlocked', 'open', 'jammed'].includes(s.state)) alerts.push({ key: key(s, 'lock'), level: 'security', kind: 'unlocked', entity: s.entity_id, room: roomOf(s.entity_id) });
    else if (domain === 'sensor' && deviceClass === 'battery') {
      const value = finite(s.state);
      if (value !== undefined && value <= 15) alerts.push({ key: `battery|${s.entity_id}`, level: 'house', kind: 'battery', entity: s.entity_id, value, room: roomOf(s.entity_id) });
    } else if (domain === 'update' && s.state === 'on') alerts.push({ key: key(s, 'update'), level: 'info', kind: 'update', entity: s.entity_id });
  }
  for (const s of Object.values(states)) {
    const room = roomOf(s.entity_id);
    if (s.entity_id.startsWith('climate.') && available(s) && s.state !== 'off' && room && openRooms.has(room)) alerts.push({ key: key(s, 'heating-open'), level: 'house', kind: 'heating-open', entity: s.entity_id, room });
  }
  const order: AlertLevel[] = ['alarm', 'security', 'house', 'info'];
  return alerts.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}
/** The alerts still to be seen: during a silent night only alarms are counted. */
export function unseen(alerts: Alert[], prefs: NexusPrefs, now = new Date()) {
  const quiet = prefs.quietNight && inQuietHours(now);
  return alerts.filter(a => !prefs.seen.includes(a.key) && (!quiet || a.level === 'alarm'));
}

/** Words without accents nor case, to find « cuisine » when « Cuisine » or « cuis » is typed. */
export const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();

/** Asks Home Assistant Assist, and returns what it answers in words. */
export async function askAssist(hass: Hass, text: string, language: string) {
  const answer = await hass.callWS<{ response?: { speech?: { plain?: { speech?: string } }; response_type?: string } }>({ type: 'conversation/process', text, language });
  return answer.response?.speech?.plain?.speech ?? '';
}
