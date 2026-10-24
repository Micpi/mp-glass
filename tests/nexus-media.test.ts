import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { clockTime, elapsed, groupOf, nextRepeat, remoteRoutes } from '../frontend/v2/media';
import type { Hass } from '../frontend/ha/client';

const state = (entity_id: string, attributes: Record<string, unknown> = {}, value = 'playing'): HAState => ({ entity_id, state: value, attributes });
const hass = (states: HAState[], entities: Hass['entities'] = {}): Hass => ({ states: Object.fromEntries(states.map(s => [s.entity_id, s])), entities, connection: {}, callWS: async () => undefined as never, callService: async () => undefined });

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
    expect(remoteRoutes(hass([state('media_player.tv'), state('remote.tv', {}, 'on')]), 'media_player.tv').back?.data).toEqual({ entity_id: 'remote.tv', command: 'back' });
  });
});
