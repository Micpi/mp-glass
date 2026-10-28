import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HAState } from '../shared/models';
import { clockTime, displayMediaImage, elapsed, groupOf, musicAction, musicAssistantFavoriteButton, musicBridgeSearch, musicLibrary, musicQueue, musicStatus, nextRepeat, queueSignature, readMediaFavorites, remoteKeyboard, remoteProfile, remoteRoutes, safeFavoriteContentId, safeFavoriteImage, searchMedia, toggleMediaFavorite, trackpadAvailable } from '../frontend/v2/media';
import { serviceBrand } from '../frontend/v2/brands';
import type { Hass } from '../frontend/ha/client';

const state = (entity_id: string, attributes: Record<string, unknown> = {}, value = 'playing'): HAState => ({ entity_id, state: value, attributes });
const hass = (states: HAState[], entities: Hass['entities'] = {}): Hass => ({ states: Object.fromEntries(states.map(s => [s.entity_id, s])), entities, connection: {}, callWS: async () => undefined as never, callService: async () => undefined });
beforeEach(() => vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined }));
afterEach(() => vi.unstubAllGlobals());

describe('MP Nexus v2 media', () => {
  it('lists a group with the chosen player first and only players that exist', () => {
    const states = Object.fromEntries([state('media_player.a', { group_members: ['media_player.b', 'media_player.a', 'media_player.gone'] }), state('media_player.b')].map(s => [s.entity_id, s]));
    expect(groupOf(states, 'media_player.a')).toEqual(['media_player.a', 'media_player.b']);
    expect(groupOf(states, 'media_player.b')).toEqual(['media_player.b']);
  });
  it('moves the position on while a track plays, never past its end', () => {
    const at = '2026-10-24T20:00:00Z', now = Date.parse(at) + 30_000;
    expect(elapsed(state('media_player.a', { media_position: 60, media_duration: 200, media_position_updated_at: at }), now)).toBe(90);
    expect(elapsed(state('media_player.a', { media_position: 60, media_duration: 200, media_position_updated_at: at }, 'paused'), now)).toBe(60);
    expect(elapsed(state('media_player.a', { media_position: 190, media_duration: 200, media_position_updated_at: at }), now)).toBe(200);
    expect(elapsed(state('media_player.a'))).toBeUndefined();
  });
  it('writes times and cycles repeat as music apps do', () => {
    expect(clockTime(187)).toBe('3:07');
    expect(clockTime(3765)).toBe('1:02:45');
    expect([nextRepeat('off'), nextRepeat('all'), nextRepeat('one')]).toEqual(['all', 'one', 'off']);
  });
  it('sends remote keys the way each integration names them', () => {
    const apple = hass([state('media_player.tv'), state('remote.living', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', device_id: 'd', platform: 'apple_tv' }, 'remote.living': { entity_id: 'remote.living', device_id: 'd', platform: 'apple_tv' } });
    expect(remoteRoutes(apple, 'media_player.tv').select).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.living', command: 'select' } });
    const lg = hass([state('media_player.lg')], { 'media_player.lg': { entity_id: 'media_player.lg', platform: 'webostv' } });
    expect(remoteRoutes(lg, 'media_player.lg').up).toEqual({ domain: 'webostv', service: 'button', data: { entity_id: 'media_player.lg', button: 'UP' } });
    expect(remoteRoutes(hass([state('media_player.sonos')]), 'media_player.sonos')).toEqual({});
    expect(remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'remote.tv': { entity_id: 'remote.tv', platform: 'apple_tv' } }), 'media_player.tv').back?.data).toEqual({ entity_id: 'remote.tv', command: 'menu' });
    expect(remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')]), 'media_player.tv')).toEqual({});
  });
  it('gives each brand the keys its integration really has', () => {
    const samsung = remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', device_id: 'd', platform: 'samsungtv' }, 'remote.tv': { entity_id: 'remote.tv', device_id: 'd', platform: 'samsungtv' } }), 'media_player.tv');
    expect(samsung.input?.data).toEqual({ entity_id: 'remote.tv', command: 'KEY_SOURCE' });
    expect(samsung.blue?.data.command).toBe('KEY_CYAN');
    expect(samsung['7']?.data.command).toBe('KEY_7');
    expect(samsung.forward?.data.command).toBe('KEY_FF');
    const viera = remoteRoutes(hass([state('media_player.viera'), state('remote.viera', {}, 'on')], { 'media_player.viera': { entity_id: 'media_player.viera', device_id: 'p', platform: 'panasonic_viera' }, 'remote.viera': { entity_id: 'remote.viera', device_id: 'p', platform: 'panasonic_viera' } }), 'media_player.viera');
    expect(viera.select?.data.command).toBe('enter');
    expect(viera.netflix?.data.command).toBe('NRC_NETFLIX-ONOFF');
    const google = remoteRoutes(hass([state('media_player.tcl'), state('remote.tcl', {}, 'on')], { 'media_player.tcl': { entity_id: 'media_player.tcl', device_id: 't', platform: 'androidtv_remote' }, 'remote.tcl': { entity_id: 'remote.tcl', device_id: 't', platform: 'androidtv_remote' } }), 'media_player.tcl');
    expect(google.settings?.data.command).toBe('SETTINGS');
    expect(google.rewind?.data.command).toBe('MEDIA_REWIND');
    expect(google.youtube).toEqual({ domain: 'media_player', service: 'play_media', data: { entity_id: 'media_player.tcl', media_content_type: 'url', media_content_id: 'https://www.youtube.com' } });
    const apple = remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'remote.tv': { entity_id: 'remote.tv', platform: 'apple_tv' } }), 'media_player.tv');
    expect(apple.red).toBeUndefined();
    expect(apple.control?.data.command).toBe('control_center');
    const kodi = remoteRoutes(hass([state('media_player.kodi')], { 'media_player.kodi': { entity_id: 'media_player.kodi', platform: 'kodi' } }), 'media_player.kodi');
    expect(kodi.select).toEqual({ domain: 'kodi', service: 'call_method', data: { entity_id: 'media_player.kodi', method: 'Input.Select' } });
  });
  it('names the maker from the device registry and the system from the integration', () => {
    const tv = (platform: string, manufacturer?: string) => {
      const h = hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', device_id: 'd', platform }, 'remote.tv': { entity_id: 'remote.tv', device_id: 'd', platform } });
      return remoteProfile({ ...h, devices: { d: { id: 'd', manufacturer } } }, 'media_player.tv');
    };
    expect(tv('androidtv_remote', 'TCL')).toEqual({ brand: 'TCL', system: 'Google TV', tone: 'tcl' });
    expect(tv('androidtv_remote', 'Sony')).toMatchObject({ brand: 'Sony', system: 'Google TV' });
    expect(tv('webostv', 'LG Electronics')).toMatchObject({ brand: 'LG', system: 'webOS' });
    expect(tv('samsungtv')).toMatchObject({ brand: 'Samsung', system: 'Tizen' });
    expect(tv('androidtv', 'Amazon')).toMatchObject({ brand: 'Amazon', system: 'Fire TV' });
    expect(tv('cast')).toBeUndefined();
  });
  it('types on the televisions whose integration takes text, and only those', () => {
    const tv = (platform: string, devices?: Hass['devices']) => ({ ...hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', device_id: 'd', platform }, 'remote.tv': { entity_id: 'remote.tv', device_id: 'd', platform } }), devices });
    expect(remoteKeyboard(tv('androidtv_remote'), 'media_player.tv')?.send('Dune')).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.tv', command: 'text:Dune' } });
    expect(remoteKeyboard(tv('webostv'), 'media_player.tv')?.send('Dune').data).toEqual({ entity_id: 'media_player.tv', command: 'com.webos.service.ime/insertText', payload: { text: 'Dune', replace: 0 } });
    expect(remoteKeyboard(tv('androidtv'), 'media_player.tv')?.send("l'été 2")?.data.command).toBe(`input text 'l'\\''été%s2'`);
    expect(remoteKeyboard(tv('roku'), 'media_player.tv')).toMatchObject({ mode: 'search' });
    expect(remoteKeyboard(tv('apple_tv'), 'media_player.tv')).toBeUndefined();
    expect(remoteKeyboard(tv('apple_tv', { d: { id: 'd', primary_config_entry: 'entry1' } }), 'media_player.tv')?.send('Dune')).toEqual({ domain: 'apple_tv', service: 'append_keyboard_text', data: { config_entry_id: 'entry1', text: 'Dune' } });
    expect(remoteKeyboard(tv('samsungtv'), 'media_player.tv')).toBeUndefined();
    const focused = hass([state('media_player.tv'), state('remote.tv', {}, 'on'), state('binary_sensor.tv_keyboard_focused', {}, 'on'), state('binary_sensor.other_keyboard', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', device_id: 'd', platform: 'apple_tv' }, 'remote.tv': { entity_id: 'remote.tv', device_id: 'd', platform: 'apple_tv' }, 'binary_sensor.tv_keyboard_focused': { entity_id: 'binary_sensor.tv_keyboard_focused', device_id: 'd', platform: 'apple_tv' }, 'binary_sensor.other_keyboard': { entity_id: 'binary_sensor.other_keyboard', device_id: 'x', platform: 'apple_tv' } });
    expect(remoteKeyboard({ ...focused, devices: { d: { id: 'd', primary_config_entry: 'entry1' } } }, 'media_player.tv')?.focus).toBe('binary_sensor.tv_keyboard_focused');
    expect(remoteKeyboard(tv('webostv'), 'media_player.tv')?.focus).toBeUndefined();
    expect(remoteKeyboard(tv('braviatv'), 'media_player.tv')).toBeUndefined();
  });
  it('enables the trackpad only when all four directions and select have a known route', () => {
    const routes = remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')], { 'media_player.tv': { entity_id: 'media_player.tv', platform: 'androidtv_remote' }, 'remote.tv': { entity_id: 'remote.tv', platform: 'androidtv_remote' } }), 'media_player.tv');
    expect(trackpadAvailable(routes)).toBe(true);
    expect(trackpadAvailable({ up: routes.up, down: routes.down, left: routes.left, select: routes.select })).toBe(false);
  });
  it('finds only a Music Assistant favorite button attached to this player device', () => {
    const h = hass([state('media_player.ma'), state('button.ma_favorite', {}, 'unknown')], { 'media_player.ma': { entity_id: 'media_player.ma', device_id: 'ma-device', platform: 'mass' }, 'button.ma_favorite': { entity_id: 'button.ma_favorite', device_id: 'ma-device', platform: 'mass' } });
    expect(musicAssistantFavoriteButton(h, 'media_player.ma')).toBe('button.ma_favorite');
    expect(musicAssistantFavoriteButton(h, 'media_player.ma2')).toBeUndefined();
  });
  it('signs queue requests with track identity so same-titled items remain distinct', () => {
    expect(queueSignature('media_player.a', state('media_player.a', { media_title: 'Same', media_content_id: 'radio://one' })))
      .not.toBe(queueSignature('media_player.a', state('media_player.a', { media_title: 'Same', media_content_id: 'radio://two' })));
  });
  it('keeps media favorites local, bounded, de-duplicated, and free of credential URLs', () => {
    const fav = { key: 'a', title: 'Track', artist: '', media_content_id: 'library://track/1', media_content_type: 'music', player: 'media_player.a' };
    expect(toggleMediaFavorite([], fav)).toEqual([fav]);
    expect(toggleMediaFavorite([fav], fav)).toEqual([]);
    expect(safeFavoriteContentId('https://provider.example/song?token=secret')).toBeUndefined();
    expect(safeFavoriteContentId('spotify://track/123')).toBe('spotify://track/123');
    expect(safeFavoriteImage('/local/cover.jpg?token=secret')).toBeUndefined();
    expect(safeFavoriteImage('/local/cover.jpg')).toBe('/local/cover.jpg');
    expect(safeFavoriteImage('/api/media_player_proxy/media_player.a?token=secret&size=large')).toBe('/api/media_player_proxy/media_player.a?size=large');
    expect(displayMediaImage('/api/media_player_proxy/media_player.a?token=secret')).toContain('media_player.a');
    expect(displayMediaImage('javascript:alert(1)')).toBeUndefined();
    expect(serviceBrand('Spotify Connect')?.image).toBeTruthy();
    expect(serviceBrand('Radio France')?.image).toBeTruthy();
    expect(serviceBrand('unknown source')).toBeUndefined();
    const storage = { getItem: () => JSON.stringify([fav, { ...fav, key: 'bad', media_content_id: 'https://x.test/?auth_token=secret' }]) };
    expect(readMediaFavorites('f', storage)).toEqual([fav]);
  });
  it('uses Home Assistant media search and returns the actual result tree children', async () => {
    const calls: Record<string, unknown>[] = [];
    const h = hass([state('media_player.ma')]);
    h.callWS = async <T>(message: Record<string, unknown>) => {
      calls.push(message);
      return { response: { 'media_player.ma': { title: 'Results', children: [{ title: 'Moon Song', media_content_id: 'library://track/42', media_content_type: 'music', can_play: true, can_expand: false }] } } } as T;
    };
    await expect(searchMedia(h, 'media_player.ma', 'Moon Song')).resolves.toMatchObject([{ title: 'Moon Song' }]);
    expect(calls[0]).toMatchObject({ type: 'call_service', domain: 'media_player', service: 'search_media', target: { entity_id: 'media_player.ma' }, service_data: { search_query: 'Moon Song' }, return_response: true });
  });
  it('keeps the Music Assistant token server-side and uses only the authenticated MP Nexus websocket bridge', async () => {
    const calls: Record<string, unknown>[] = [];
    const h = hass([state('media_player.ma')]);
    h.callWS = async <T>(message: Record<string, unknown>) => {
      calls.push(message);
      if (message.type === 'mp_glass/music/status') return { configured: true, connected: true } as T;
      if (message.type === 'mp_glass/music/queue') return { queue_id: 'living', items: [] } as T;
      return { items: [{ title: 'Moon Song', media_content_id: 'library://track/42', media_content_type: 'track', can_play: true, can_expand: false }], ok: true } as T;
    };
    await musicStatus(h); await musicLibrary(h, 'albums'); await musicBridgeSearch(h, 'Moon Song'); await musicQueue(h, 'media_player.living'); await musicAction(h, 'play_next', { queue_id: 'living', media: 'library://track/42' });
    expect(calls.map(call => call.type)).toEqual(['mp_glass/music/status', 'mp_glass/music/library', 'mp_glass/music/search', 'mp_glass/music/queue', 'mp_glass/music/action']);
    expect(calls[3]).toMatchObject({ entity_id: 'media_player.living' });
    expect(JSON.stringify(calls)).not.toMatch(/token|8095|authorization/i);
  });
});
