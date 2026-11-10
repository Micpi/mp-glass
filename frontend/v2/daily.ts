import type { HAState } from '../../shared/models';
import { mediaIsTv, mediaTvInput, nowPlaying, roomEntityIds } from '../../shared/spatial-state';
import type { SpatialRoom } from '../../shared/spatial';
import { available } from '../../shared/capabilities';
import type { SceneIcon, SceneTarget, SceneValue } from './scenes';

/** What a screen keeps for everyday use: its shortcuts, the tabs of its bar, the order of its tiles. */
export type BarItem = 'lights'|'rooms'|'media'|'climate'|'covers'|'security';
export const BAR_ITEMS: readonly BarItem[] = ['lights', 'rooms', 'media', 'climate', 'covers', 'security'];
export const BAR_MAX = 4;
export const SHORTCUT_MAX = 12;
export interface DailyPrefs { shortcuts: string[]; bar?: BarItem[]; order: Record<string, string[]>; hiddenScenes: string[] }
const KEY = 'mp-nexus.daily';
const strings = (value: unknown, max: number) => Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255))].slice(0, max) : [];
export function parseDaily(raw: unknown): DailyPrefs {
  const saved = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const bar = Array.isArray(saved.bar) ? strings(saved.bar, BAR_ITEMS.length).filter((v): v is BarItem => (BAR_ITEMS as readonly string[]).includes(v)).slice(0, BAR_MAX) : undefined;
  const order: Record<string, string[]> = {};
  if (saved.order && typeof saved.order === 'object') for (const [key, value] of Object.entries(saved.order as Record<string, unknown>).slice(0, 200)) order[key] = strings(value, 200);
  return { shortcuts: strings(saved.shortcuts, SHORTCUT_MAX), ...(bar ? { bar } : {}), order, hiddenScenes: strings(saved.hiddenScenes, 20) };
}
export function readDaily(): DailyPrefs {
  try { return parseDaily(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return parseDaily({}); }
}
export function writeDaily(prefs: DailyPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* The choice holds for this page only. */ }
}

/** A shortcut added at the end, or removed; a full bar refuses one more. */
export function toggleShortcut(list: string[], id: string): string[] {
  if (list.includes(id)) return list.filter(v => v !== id);
  return list.length >= SHORTCUT_MAX ? list : [...list, id];
}
/** The tabs of the bar between Accueil and Plus: those the screen chose among those the house offers, else the house's own. */
export function barItems(chosen: BarItem[] | undefined, fallback: BarItem[], offered: ReadonlySet<BarItem>): BarItem[] {
  return (chosen ?? fallback).filter(item => offered.has(item)).slice(0, BAR_MAX);
}
export function toggleBar(current: BarItem[], item: BarItem): BarItem[] {
  if (current.includes(item)) return current.filter(v => v !== item);
  if (current.length >= BAR_MAX) return current;
  // Kept in the order of the list, whatever the order of the touches.
  return BAR_ITEMS.filter(v => v === item || current.includes(v));
}

/** Ids in the order the screen saved; those it never placed keep their place after them. */
export function ordered<T>(items: T[], saved: string[] | undefined, id: (item: T) => string): T[] {
  if (!saved?.length) return items;
  const rank = new Map(saved.map((v, i) => [v, i]));
  return items.map((item, i) => ({ item, i })).sort((a, b) => (rank.get(id(a.item)) ?? saved.length + a.i) - (rank.get(id(b.item)) ?? saved.length + b.i)).map(x => x.item);
}
/** `id` takes the place of `target`: before it when it came from after, after it when it came from before. */
export function moveTo(ids: string[], id: string, target: string): string[] {
  const from = ids.indexOf(id), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.filter(v => v !== id);
  next.splice(to, 0, id);
  return next;
}

/** What plays at home, once per room and title: a television and its soundbar are one thing going on. */
export interface PlayingGroup { key: string; ids: string[]; primary: string; title: string }
export function playingGroups(players: string[], states: Record<string, HAState>, roomOf: (id: string) => string | undefined): PlayingGroup[] {
  const groups = new Map<string, PlayingGroup>(), all = [...new Set(players)];
  for (const id of all) {
    const state = states[id], room = roomOf(id);
    const title = nowPlaying(state) ?? '';
    // Speakers grouped together play one thing, wherever they stand.
    const members = Array.isArray(state?.attributes.group_members) ? state!.attributes.group_members.filter((m): m is string => typeof m === 'string') : [];
    const grouped = members.length > 1 && members.some(m => m !== id && all.includes(m)) ? members[0] : undefined;
    // A soundbar on its TV input plays what the television of its room plays.
    const follows = mediaTvInput(state) && room ? all.find(p => p !== id && roomOf(p) === room && mediaIsTv(states[p])) : undefined;
    const sameTitle = follows ? nowPlaying(states[follows]) ?? '' : title;
    const key = follows && sameTitle ? `${room}|${sameTitle}` : grouped ? `g|${grouped}` : room && sameTitle ? `${room}|${sameTitle}` : `|${id}`;
    const group = groups.get(key);
    if (!group) groups.set(key, { key, ids: [id], primary: id, title: sameTitle || title });
    else {
      group.ids.push(id);
      // The television leads: its transport is the one that pauses the film. Among speakers, the one that leads the group.
      if (mediaTvInput(states[group.primary]) && !mediaTvInput(state) || mediaIsTv(state) && !mediaIsTv(states[group.primary]) || key.startsWith('g|') && grouped === id) group.primary = id;
      if (!group.title) group.title = sameTitle || title;
    }
  }
  return [...groups.values()];
}

/** Scenes worth offering a house that has none: each built from the devices it really has. */
export type SuggestionKey = 'evening'|'cinema'|'night'|'leave';
export interface SceneSuggestion { key: SuggestionKey; icon: SceneIcon; entities: SceneTarget[]; room?: string }
const dimmable = (state?: HAState) => Array.isArray(state?.attributes.supported_color_modes) ? state!.attributes.supported_color_modes.some(mode => !['onoff', 'unknown'].includes(String(mode))) : typeof state?.attributes.brightness === 'number';
const lightAt = (id: string, state: HAState | undefined, percent: number): SceneTarget => percent <= 0 ? { entity_id: id, state: 'off', attributes: {} }
  : { entity_id: id, state: 'on', attributes: dimmable(state) ? { brightness: Math.round(percent * 2.55) } : {} };
const SHADES = ['shutter', 'blind', 'curtain', 'shade', 'awning', 'window', ''];
const shade = (state?: HAState) => SHADES.includes(String(state?.attributes.device_class ?? ''));
const closed = (id: string, state?: HAState): SceneTarget => ({ entity_id: id, state: 'closed', attributes: typeof state?.attributes.supported_features === 'number' && (state.attributes.supported_features & 4) ? { current_position: 0 } : {} });
const LIVING = /salon|s[ée]jour|living|lounge|wohnzimmer|soggiorno|гостин/i;
export function sceneSuggestions(rooms: SpatialRoom[], states: Record<string, HAState>, extra: string[] = []): SceneSuggestion[] {
  const ok = (id: string) => available(states[id]);
  const inRoom = (room: SpatialRoom, domain: string) => roomEntityIds(room).filter(id => id.startsWith(`${domain}.`) && ok(id));
  const all = (domain: string) => [...new Set([...rooms.flatMap(room => inRoom(room, domain)), ...extra.filter(id => id.startsWith(`${domain}.`) && ok(id))])];
  const lights = all('light'), covers = all('cover').filter(id => shade(states[id]));
  const out: SceneSuggestion[] = [];
  const living = rooms.filter(room => LIVING.test(room.name)).flatMap(room => inRoom(room, 'light'));
  if (living.length) out.push({ key: 'evening', icon: 'sofa', entities: [...new Set(living)].map(id => lightAt(id, states[id], 40)) });
  const cinema = rooms.find(room => inRoom(room, 'media_player').some(id => mediaIsTv(states[id])) && (inRoom(room, 'light').length || inRoom(room, 'cover').length));
  if (cinema) out.push({ key: 'cinema', icon: 'tv', room: cinema.name, entities: [...inRoom(cinema, 'light').map(id => lightAt(id, states[id], dimmable(states[id]) ? 10 : 0)), ...inRoom(cinema, 'cover').filter(id => shade(states[id])).map(id => closed(id, states[id]))] });
  if (lights.length + covers.length > 1) out.push({ key: 'night', icon: 'moon', entities: [...lights.map(id => lightAt(id, states[id], 0)), ...covers.map(id => closed(id, states[id]))] });
  const players = all('media_player').filter(id => typeof states[id]?.attributes.supported_features === 'number' && (Number(states[id]!.attributes.supported_features) & 256));
  if (lights.length && players.length) out.push({ key: 'leave', icon: 'door', entities: [...lights.map(id => lightAt(id, states[id], 0)), ...players.map(id => ({ entity_id: id, state: 'off', attributes: {} }))] });
  return out.map(s => ({ ...s, entities: s.entities.slice(0, 80) })).filter(s => s.entities.length);
}
export const suggestionScene = (suggestion: SceneSuggestion, name: string): SceneValue => ({ name, icon: suggestion.icon, transition: 1, entities: suggestion.entities });

/** How long a light has been on, in whole minutes; nothing when Home Assistant does not say. */
export function minutesOn(state: HAState | undefined, now = Date.now()): number | undefined {
  const at = Date.parse(state?.last_changed ?? ''), minutes = Math.floor((now - at) / 60_000);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : undefined;
}
/** The brightness of a light in percent, when it can be dimmed; `undefined` for an on/off light. */
export function lightLevel(state?: HAState): number | undefined {
  if (!state || !dimmable(state)) return undefined;
  const value = Number(state.attributes.brightness);
  return state.state === 'on' && Number.isFinite(value) ? Math.max(1, Math.round(value / 2.55)) : 0;
}
/** The colour a lamp shines, as a CSS colour; nothing when it only says white. */
export function lampColor(state?: HAState): string | undefined {
  const rgb = state?.attributes.rgb_color;
  if (state?.state !== 'on' || !Array.isArray(rgb) || rgb.length < 3 || !rgb.slice(0, 3).every(v => typeof v === 'number' && v >= 0 && v <= 255)) return undefined;
  return `rgb(${rgb.slice(0, 3).map(v => Math.round(v as number)).join(',')})`;
}
