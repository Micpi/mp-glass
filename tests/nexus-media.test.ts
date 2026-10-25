import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HAState } from '../shared/models';
import { clockTime, displayMediaImage, elapsed, groupOf, musicAction, musicAssistantFavoriteButton, musicBridgeSearch, musicLibrary, musicQueue, musicStatus, nextRepeat, queueSignature, readMediaFavorites, remoteRoutes, safeFavoriteContentId, safeFavoriteImage, searchMedia, toggleMediaFavorite, trackpadAvailable } from '../frontend/v2/media';
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
