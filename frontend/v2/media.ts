import type { HAState } from '../../shared/models';
import { finite, mediaPlaying } from '../../shared/spatial-state';
import type { Hass } from '../ha/client';

/** The keys of a television remote MP Nexus draws: arrows, OK, back, home and menu. */
export type RemoteKey = 'up'|'down'|'left'|'right'|'select'|'back'|'home'|'menu';
/** How one integration is told a key: a command for its remote entity, or a service of its own on the player. */
export interface RemoteRoute { domain: string; service: string; data: Record<string, unknown> }

/** Each integration names its keys its own way; the ones it does not know are left out of the remote. */
const REMOTE_COMMANDS: Record<string, Partial<Record<RemoteKey, string>>> = {
  apple_tv: { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', back: 'menu', home: 'home', menu: 'top_menu' },
  androidtv_remote: { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', select: 'DPAD_CENTER', back: 'BACK', home: 'HOME', menu: 'MENU' },
  roku: { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', back: 'back', home: 'home', menu: 'info' },
  samsungtv: { up: 'KEY_UP', down: 'KEY_DOWN', left: 'KEY_LEFT', right: 'KEY_RIGHT', select: 'KEY_ENTER', back: 'KEY_RETURN', home: 'KEY_HOME', menu: 'KEY_MENU' },
  philips_js: { up: 'CursorUp', down: 'CursorDown', left: 'CursorLeft', right: 'CursorRight', select: 'Confirm', back: 'Back', home: 'Home', menu: 'Options' },
  braviatv: { up: 'Up', down: 'Down', left: 'Left', right: 'Right', select: 'Confirm', back: 'Return', home: 'Home', menu: 'Options' },
};
const GENERIC: Partial<Record<RemoteKey, string>> = { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', back: 'back', home: 'home', menu: 'menu' };
/** Players that take their keys on themselves, without a remote entity. */
const PLAYER_BUTTONS: Record<string, { domain: string; service: string; field: string; keys: Partial<Record<RemoteKey, string>> }> = {
  webostv: { domain: 'webostv', service: 'button', field: 'button', keys: { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', select: 'ENTER', back: 'BACK', home: 'HOME', menu: 'MENU' } },
  androidtv: { domain: 'androidtv', service: 'adb_command', field: 'command', keys: { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', select: 'CENTER', back: 'BACK', home: 'HOME', menu: 'MENU' } },
};

/** The remote entity of a player: the one on the same device, else the one that bears its name. */
export function remoteOf(hass: Hass | undefined, playerId: string) {
  if (!hass) return undefined;
  const device = hass.entities?.[playerId]?.device_id, object = playerId.split('.')[1] ?? '';
  const remotes = Object.keys(hass.states).filter(id => id.startsWith('remote.'));
  return (device ? remotes.find(id => hass.entities?.[id]?.device_id === device) : undefined) ?? remotes.find(id => id === `remote.${object}`);
}
/** How each key reaches the television behind a player; empty when MP Nexus has no way to send keys to it. */
export function remoteRoutes(hass: Hass | undefined, playerId: string): Partial<Record<RemoteKey, RemoteRoute>> {
  const platform = hass?.entities?.[playerId]?.platform ?? '', own = PLAYER_BUTTONS[platform];
  if (own) return Object.fromEntries(Object.entries(own.keys).map(([key, value]) => [key, { domain: own.domain, service: own.service, data: { entity_id: playerId, [own.field]: value } }]));
  const remote = remoteOf(hass, playerId);
  if (!remote) return {};
  const keys = REMOTE_COMMANDS[hass?.entities?.[remote]?.platform ?? platform] ?? GENERIC;
  return Object.fromEntries(Object.entries(keys).map(([key, value]) => [key, { domain: 'remote', service: 'send_command', data: { entity_id: remote, command: value } }]));
}

/** The players playing together with this one, itself first, as Home Assistant reports its group. */
export function groupOf(states: Record<string, HAState>, playerId: string): string[] {
  const members = states[playerId]?.attributes.group_members;
  const list = Array.isArray(members) ? members.map(String).filter(id => states[id]) : [];
  return list.includes(playerId) ? [playerId, ...list.filter(id => id !== playerId)] : [playerId, ...list];
}

/** Where a track stands now: the position Home Assistant last reported, moved on by the time it has played since. */
export function elapsed(state: HAState | undefined, now = Date.now()) {
  const position = finite(state?.attributes.media_position);
  if (position === undefined) return undefined;
  const updated = Date.parse(String(state?.attributes.media_position_updated_at ?? ''));
  const duration = finite(state?.attributes.media_duration);
  const value = position + (mediaPlaying(state) && Number.isFinite(updated) ? Math.max(0, now - updated) / 1000 : 0);
  return duration ? Math.min(duration, value) : value;
}
/** A length of time as players show it: 3:07, or 1:02:45 past an hour. */
export function clockTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
/** The next repeat mode, the way music apps cycle it. */
export function nextRepeat(mode: unknown) { return mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'; }

/** One level of a player's library, as `media_player/browse_media` answers it. */
export interface BrowseItem {
  title: string; media_class?: string; media_content_id: string; media_content_type: string;
  can_play: boolean; can_expand: boolean; thumbnail?: string | null; children?: BrowseItem[];
}
export function browse(hass: Hass, playerId: string, item?: Pick<BrowseItem, 'media_content_id'|'media_content_type'>) {
  return hass.callWS<BrowseItem>({ type: 'media_player/browse_media', entity_id: playerId, ...(item ? { media_content_id: item.media_content_id, media_content_type: item.media_content_type } : {}) });
}
