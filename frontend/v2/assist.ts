import type { HAState } from '../../shared/models';
import { available } from '../../shared/capabilities';
import { contactSensor, finite } from '../../shared/spatial-state';
import type { Hass } from '../ha/client';
import type { SpatialRoom } from '../../shared/spatial';
import { roomEntityIds, roomTemperature } from '../../shared/spatial-state';

/** What this screen remembers for itself: a wall tablet and a phone can each choose differently. */
export interface NexusPrefs { people: boolean; comfort: boolean; quietNight: boolean; seen: string[]; screenArea?: string }
const PREFS_KEY = 'mp-nexus.prefs';
const DEFAULTS: NexusPrefs = { people: true, comfort: false, quietNight: false, seen: [] };
export function readPrefs(): NexusPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<NexusPrefs>;
    return { people: saved.people !== false, comfort: saved.comfort === true, quietNight: saved.quietNight === true, seen: Array.isArray(saved.seen) ? saved.seen.filter((s): s is string => typeof s === 'string').slice(-200) : [], screenArea: typeof saved.screenArea === 'string' && /^[a-z0-9_]+$/.test(saved.screenArea) ? saved.screenArea : undefined };
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

/** A deliberately narrow, read-only request to show a named room. An ambiguous name is never guessed. */
export function roomOverviewRequest<T extends { room: SpatialRoom }>(text: string, rooms: T[]): { matches: T[] } | undefined {
  const clean = fold(text).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(?:nexus )?(?:montre moi|affiche)(?: ce qui se passe (?:dans|au|en)| la piece| le plan (?:de|du|de la)| la situation (?:dans|de|du|de la))? (.+?)(?: s il te plait)?$/);
  if (!match) return undefined;
  const name = match[1]!.replace(/^(?:le |la |les |l |du |de la |de l )/, '').trim();
  const matches = rooms.filter(p => fold(p.room.name).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(?:le |la |les |l )/, '') === name);
  return { matches };
}

/** Only report states actually present and available for the room; never infer why a condition occurred. */
export function roomOverview(room: SpatialRoom, states: Record<string, HAState>, unit = '°C') {
  const ids = roomEntityIds(room), known = ids.map(id => states[id]).filter((s): s is HAState => !!s && available(s));
  return {
    temperature: roomTemperature(room, states, unit),
    lights: known.filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length,
    open: known.filter(s => s.entity_id.startsWith('binary_sensor.') && contactSensor(s) && s.state === 'on').length,
    climate: known.filter(s => s.entity_id.startsWith('climate.')).map(s => ({ id: s.entity_id, mode: s.state, action: typeof s.attributes.hvac_action === 'string' ? s.attributes.hvac_action : undefined })),
    unavailable: ids.filter(id => !states[id] || !available(states[id])).length,
    observed: known.length,
  };
}

/** Suggestions require a real window, a sustained opening and an actively heating/cooling thermostat in the same plan room. */
export function comfortSuggestions(rooms: SpatialRoom[], states: Record<string, HAState>, now = Date.now()) {
  return rooms.flatMap(room => {
    const known = roomEntityIds(room).map(id => states[id]).filter((s): s is HAState => !!s && available(s));
    const windows = known.filter(s => s.entity_id.startsWith('binary_sensor.') && s.attributes.device_class === 'window' && s.state === 'on' && !!s.last_changed && Number.isFinite(Date.parse(s.last_changed)) && now - Date.parse(s.last_changed) >= 20 * 60_000);
    const climates = known.filter(s => s.entity_id.startsWith('climate.') && ['heating', 'cooling'].includes(String(s.attributes.hvac_action)));
    return windows.flatMap(window => climates.map(climate => ({ key: `${room.id}|${window.entity_id}|${window.last_changed}|${climate.entity_id}`, room: room.name, window: window.entity_id, climate: climate.entity_id, action: String(climate.attributes.hvac_action) })));
  });
}

/** Only unqualified, unambiguous lighting commands receive the screen's room. */
export function withScreenArea(text: string, lang: string, areaId: string | undefined, areas: { id: string; name: string }[]) {
  if (!areaId || !lang.toLowerCase().startsWith('fr')) return text;
  const area = areas.find(a => a.id === areaId);
  if (!area || !area.name.trim() || areas.filter(a => fold(a.name.trim()) === fold(area.name.trim())).length !== 1) return text;
  const clean = fold(text.trim()).replace(/[.!?]+$/, '').trim();
  if (!/^(?:allume|allumer|eteins|eteindre) (?:la|les) lumieres?$/.test(clean)) return text;
  return `${text.trim().replace(/[.!?]+$/, '').trim()} dans ${area.name.trim()}`;
}

/** Recognise an explicit request for a brief status, without intercepting unrelated actions. */
export function wantsHouseSummary(text: string) {
  const clean = fold(text).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:nexus )?(?:(?:resume|resumes) (?:moi )?(?:la )?maison|fais (?:moi )?(?:un )?(?:bilan|resume) (?:de |de la |pour la )?maison|(?:quel est |donne moi )?(?:l |le )?(?:etat|bilan|resume) (?:de |de la |du |pour la )?maison)(?: s il te plait)?$/.test(clean);
}

/** Counts only observed values; unknown or unavailable entities are not interpreted as healthy. */
export function houseSummary(states: Record<string, HAState>, alerts: Alert[]) {
  const all = Object.values(states);
  const lights = all.filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length;
  const unavailable = all.filter(s => /^(light|switch|cover|climate|sensor|binary_sensor|lock|media_player)\./.test(s.entity_id) && (s.state === 'unavailable' || s.state === 'unknown')).length;
  return { lights, unavailable, alerts };
}

/** Read-only diagnostic only when the exact friendly name identifies one device unambiguously. */
export function diagnosticTarget(text: string, states: Record<string, HAState>): HAState | undefined {
  const clean = (value: string) => fold(value).replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const query = ` ${clean(text)} `;
  if (!/\bpourquoi\b/.test(query) || !/\b(?:marche|fonctionne|repond|allume|eteint|ouvre|ferme)\b/.test(query)) return undefined;
  const found = Object.values(states).filter(s => {
    const name = clean(String(s.attributes.friendly_name ?? ''));
    return name.length >= 4 && /^(light|switch|cover|climate|media_player|fan|lock)\./.test(s.entity_id) && query.includes(` ${name} `);
  });
  return found.length === 1 ? found[0] : undefined;
}

/** Nexus, the assistant MP Nexus installs as a Home Assistant conversation agent, when this Home Assistant has it. */
export function nexusAgent(hass: Pick<Hass, 'entities'> | undefined) {
  return Object.values(hass?.entities ?? {}).find(e => e.platform === 'mp_glass' && e.entity_id.startsWith('conversation.'))?.entity_id;
}
/** What the assistant answered: its words, the conversation to go on with, and the devices it acted on. */
export interface AssistAnswer { text: string; conversationId?: string; touched: string[]; failed: boolean }
type ConverseReply = { conversation_id?: string; response?: { speech?: { plain?: { speech?: string } }; response_type?: string; data?: { success?: { type?: string; id?: string }[] } } };
/** Asks Nexus when it is installed, Home Assistant Assist otherwise, keeping the thread of the conversation. */
export async function askAssist(hass: Hass, text: string, language: string, conversationId?: string): Promise<AssistAnswer> {
  const agent = nexusAgent(hass);
  const answer = await hass.callWS<ConverseReply>({ type: 'conversation/process', text, language, ...(agent ? { agent_id: agent } : {}), ...(conversationId ? { conversation_id: conversationId } : {}) });
  const touched = [...new Set((answer.response?.data?.success ?? []).filter(t => t.type === 'entity' && typeof t.id === 'string' && t.id.includes('.')).map(t => t.id!))];
  return { text: answer.response?.speech?.plain?.speech ?? '', conversationId: answer.conversation_id, touched, failed: answer.response?.response_type === 'error' };
}
