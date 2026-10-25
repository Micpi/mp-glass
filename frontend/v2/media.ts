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
  const keys = REMOTE_COMMANDS[hass?.entities?.[remote]?.platform ?? platform];
  if (!keys) return {};
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
export type MusicLibraryKind = 'albums'|'artists'|'tracks'|'playlists'|'radio'|'podcasts';
export interface MusicHubItem extends BrowseItem {
  artist?: string; album?: string; favorite?: boolean; queue_item_id?: string; index?: number; duration?: number;
}
export interface MusicBridgeStatus { configured: boolean; connected: boolean; player_count?: number; error?: string }

export const musicStatus = (hass: Hass) => hass.callWS<MusicBridgeStatus>({ type: 'mp_glass/music/status' });
export async function musicLibrary(hass: Hass, kind: MusicLibraryKind, offset = 0) {
  return (await hass.callWS<{ items: MusicHubItem[] }>({ type: 'mp_glass/music/library', kind, offset, limit: 60 })).items;
}
export async function musicBridgeSearch(hass: Hass, query: string) {
  return (await hass.callWS<{ items: MusicHubItem[] }>({ type: 'mp_glass/music/search', query, limit: 20 })).items;
}
export const musicQueue = (hass: Hass, entity_id: string) => hass.callWS<{ queue_id?: string; current_index?: number; items: MusicHubItem[] }>({ type: 'mp_glass/music/queue', entity_id });
export const musicAction = (hass: Hass, action: string, data: Record<string, unknown>) => hass.callWS<{ ok: boolean }>({ type: 'mp_glass/music/action', action, data });

/** A device must expose an explicit integration route before it can receive remote gestures. */
export function trackpadAvailable(routes: Partial<Record<RemoteKey, RemoteRoute>>) {
  return !!(routes.up && routes.down && routes.left && routes.right && routes.select);
}

/** A stable signature for one selected queue item, including the identity fields HA exposes. */
export function queueSignature(player: string, state: HAState | undefined) {
  const a = state?.attributes ?? {};
  return [player, a.media_content_id, a.media_title, a.media_artist, a.media_album_name, a.media_position_updated_at, state?.last_changed].map(v => String(v ?? '')).join('|');
}

/** The Music Assistant integration's add-current-track button, when the registry links it to this player. */
export function musicAssistantFavoriteButton(hass: Hass | undefined, playerId: string) {
  const device = hass?.entities?.[playerId]?.device_id;
  if (!device || !isMusicAssistant(hass?.entities?.[playerId]?.platform)) return undefined;
  return Object.keys(hass?.states ?? {}).find(id => id.startsWith('button.') && hass?.entities?.[id]?.device_id === device && isMusicAssistant(hass?.entities?.[id]?.platform) && hass.states[id]?.state !== 'unavailable');
}
/** Home Assistant registers the Music Assistant integration as `mass`. */
export const isMusicAssistant = (platform: string | undefined) => platform === 'mass' || platform === 'music_assistant';

export interface NexusFavorite {
  key: string; title: string; artist: string; media_content_id: string; media_content_type: string;
  image?: string; source?: string; player: string;
}
/** Per-user, per-dashboard shortcuts stay in this browser and never enter the shared project backup. */
export function readMediaFavorites(storageKey: string, storage: Pick<Storage, 'getItem'> = localStorage): NexusFavorite[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((item): item is NexusFavorite => !!item && typeof item === 'object' && typeof item.key === 'string' && typeof item.title === 'string' && !!safeFavoriteContentId(item.media_content_id) && typeof item.media_content_type === 'string' && typeof item.player === 'string')
      .filter(item => { if (seen.has(item.key)) return false; seen.add(item.key); return true; })
      .map(item => ({ ...item, media_content_id: safeFavoriteContentId(item.media_content_id)!, artist: typeof item.artist === 'string' ? item.artist : '', ...(safeFavoriteImage(item.image) ? { image: safeFavoriteImage(item.image) } : { image: undefined }), ...(typeof item.source === 'string' ? { source: item.source.slice(0, 80) } : {}) })).slice(0, 100);
  } catch { return []; }
}
export function toggleMediaFavorite(items: NexusFavorite[], item: NexusFavorite) {
  return items.some(saved => saved.key === item.key) ? items.filter(saved => saved.key !== item.key) : [item, ...items].slice(0, 100);
}
/** Reject credential-bearing URLs before a content ID is written to persistent browser storage. */
export function safeFavoriteContentId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\r\n]/.test(value)) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || [...url.searchParams.keys()].some(key => /token|auth|secret|signature|credential|api.?key/i.test(key))) return undefined;
    return value;
  } catch { return undefined; }
}
/** Keep remote service artwork URLs out of persistence; only same-origin HA paths are stored. */
export function safeFavoriteImage(value: unknown, origin = ''): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\r\n]/.test(value)) return undefined;
  if (!value.startsWith('/') && !origin) return undefined;
  try {
    const url = new URL(value, origin || 'http://localhost');
    if (url.username || url.password || (origin && url.origin !== origin) || (!origin && !value.startsWith('/')) || value.startsWith('//')) return undefined;
    for (const key of [...url.searchParams.keys()]) {
      if (!/token|auth|secret|signature|credential|api.?key/i.test(key)) continue;
      if (!url.pathname.startsWith('/api/media_player_proxy/')) return undefined;
      url.searchParams.delete(key);
    }
    return `${url.pathname}${url.search}`;
  }
  catch { return undefined; }
}

/** Artwork supplied by HA or MA is displayed only from image-capable URL schemes. It is never persisted here. */
export function displayMediaImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 8192 || /[\r\n]/.test(value)) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml)(?:;[^,]*)?,/i.test(value)) return value;
  return undefined;
}

export function browse(hass: Hass, playerId: string, item?: Pick<BrowseItem, 'media_content_id'|'media_content_type'>) {
  return hass.callWS<BrowseItem>({ type: 'media_player/browse_media', entity_id: playerId, ...(item ? { media_content_id: item.media_content_id, media_content_type: item.media_content_type } : {}) });
}

/** Home Assistant's response-capable `media_player.search_media` action, available on Music Assistant players. */
export async function searchMedia(hass: Hass, playerId: string, query: string) {
  const answer = await hass.callWS<{ response?: Record<string, BrowseItem> }>({
    type: 'call_service', domain: 'media_player', service: 'search_media', target: { entity_id: playerId },
    service_data: { search_query: query }, return_response: true,
  });
  const result = answer.response?.[playerId];
  return Array.isArray(result?.children) ? result.children : [];
}
