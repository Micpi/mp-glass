import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import type { SpatialRoom } from '../shared/spatial';
import { BAR_MAX, SHORTCUT_MAX, barItems, lampColor, lightLevel, minutesOn, moveTo, ordered, parseDaily, playingGroups, sceneSuggestions, suggestionScene, toggleBar, toggleShortcut } from '../frontend/v2/daily';
import { sceneReady } from '../frontend/v2/scenes';

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}, last_changed?: string): HAState => ({ entity_id, state: value, attributes, last_changed });
const book = (...states: HAState[]) => Object.fromEntries(states.map(s => [s.entity_id, s]));
const room = (id: string, name: string, entityIds: string[]): SpatialRoom => ({ id, name, polygon: [], entityIds } as unknown as SpatialRoom);

describe('what a screen keeps for everyday use', () => {
  it('reads only what it understands and falls back to an empty choice', () => {
    expect(parseDaily(null)).toEqual({ shortcuts: [], order: {}, hiddenScenes: [] });
    const read = parseDaily({ shortcuts: ['light.a', 'light.a', 4, ''], bar: ['climate', 'nope', 'lights', 'rooms', 'media', 'covers'], order: { rooms: ['b', 'a', 7] }, hiddenScenes: ['night'] });
    expect(read.shortcuts).toEqual(['light.a']);
    expect(read.bar).toEqual(['climate', 'lights', 'rooms', 'media']);
    expect(read.order).toEqual({ rooms: ['b', 'a'] });
    expect(read.hiddenScenes).toEqual(['night']);
  });
  it('adds and removes a shortcut, and refuses one more than the row holds', () => {
    expect(toggleShortcut(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleShortcut(['a', 'b'], 'a')).toEqual(['b']);
    const full = Array.from({ length: SHORTCUT_MAX }, (_, i) => `light.${i}`);
    expect(toggleShortcut(full, 'light.more')).toBe(full);
  });
  it('keeps in the bar only what the house offers, the house own tabs when the screen chose none', () => {
    const offered = new Set(['lights', 'rooms', 'media', 'climate'] as const);
    expect(barItems(undefined, ['lights', 'rooms', 'media'], offered)).toEqual(['lights', 'rooms', 'media']);
    expect(barItems(['climate', 'security', 'media'], ['lights'], offered)).toEqual(['climate', 'media']);
    expect(toggleBar(['lights', 'media'], 'climate')).toEqual(['lights', 'media', 'climate']);
    expect(toggleBar(['lights', 'media'], 'lights')).toEqual(['media']);
    const full = ['lights', 'rooms', 'media', 'climate'] as const;
    expect(full).toHaveLength(BAR_MAX);
    expect(toggleBar([...full], 'covers')).toEqual([...full]);
  });
  it('orders tiles as saved and leaves the new ones after them', () => {
    expect(ordered(['a', 'b', 'c', 'd'], ['c', 'a'], v => v)).toEqual(['c', 'a', 'b', 'd']);
    expect(ordered(['a', 'b'], undefined, v => v)).toEqual(['a', 'b']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(moveTo(['a', 'b'], 'a', 'missing')).toEqual(['a', 'b']);
  });
});

describe('what plays at home, said once', () => {
  const tv = state('media_player.tv', 'playing', { device_class: 'tv', media_title: 'Le Grand Bleu' });
  const bar = state('media_player.bar', 'playing', { device_class: 'speaker', source: 'TV' });
  const kitchen = state('media_player.kitchen', 'playing', { media_title: 'So What', group_members: ['media_player.kitchen', 'media_player.office'] });
  const office = state('media_player.office', 'playing', { media_title: 'So What', group_members: ['media_player.kitchen', 'media_player.office'] });
  const rooms: Record<string, string> = { 'media_player.tv': 'Salon', 'media_player.bar': 'Salon', 'media_player.kitchen': 'Cuisine', 'media_player.office': 'Bureau' };
  it('joins a television with its soundbar, grouped speakers together, and never repeats a player', () => {
    const groups = playingGroups(['media_player.tv', 'media_player.bar', 'media_player.tv', 'media_player.office', 'media_player.kitchen'], book(tv, bar, kitchen, office), id => rooms[id]);
    expect(groups.map(g => [g.primary, g.ids, g.title])).toEqual([
      ['media_player.tv', ['media_player.tv', 'media_player.bar'], 'Le Grand Bleu'],
      ['media_player.kitchen', ['media_player.office', 'media_player.kitchen'], 'So What'],
    ]);
  });
  it('keeps apart two rooms that happen to play the same title', () => {
    const a = state('media_player.a', 'playing', { media_title: 'Radio' }), b = state('media_player.b', 'playing', { media_title: 'Radio' });
    expect(playingGroups(['media_player.a', 'media_player.b'], book(a, b), id => id.endsWith('a') ? 'Salon' : 'Cuisine')).toHaveLength(2);
  });
});

describe('scenes offered to a house that has none', () => {
  const states = book(
    state('light.salon', 'on', { supported_color_modes: ['brightness'], brightness: 255 }), state('light.cuisine', 'off', { supported_color_modes: ['onoff'] }),
    state('cover.salon', 'open', { device_class: 'shutter', supported_features: 15 }), state('cover.garage', 'closed', { device_class: 'garage', supported_features: 3 }),
    state('media_player.tv', 'playing', { device_class: 'tv', supported_features: 256 | 128 }), state('light.gone', 'unavailable'),
  );
  const rooms = [room('salon', 'Salon', ['light.salon', 'cover.salon', 'media_player.tv', 'light.gone']), room('cuisine', 'Cuisine', ['light.cuisine']), room('garage', 'Garage', ['cover.garage'])];
  it('builds each one from the devices at hand, never a garage door nor a device that is gone', () => {
    const offered = sceneSuggestions(rooms, states);
    expect(offered.map(s => s.key)).toEqual(['evening', 'cinema', 'night', 'leave']);
    const of = (key: string) => offered.find(s => s.key === key)!.entities;
    expect(of('evening')).toEqual([{ entity_id: 'light.salon', state: 'on', attributes: { brightness: 102 } }]);
    expect(of('cinema')).toEqual([{ entity_id: 'light.salon', state: 'on', attributes: { brightness: 26 } }, { entity_id: 'cover.salon', state: 'closed', attributes: { current_position: 0 } }]);
    expect(of('night').map(e => e.entity_id)).toEqual(['light.salon', 'light.cuisine', 'cover.salon']);
    expect(of('leave').at(-1)).toEqual({ entity_id: 'media_player.tv', state: 'off', attributes: {} });
    for (const s of offered) expect(sceneReady(suggestionScene(s, 'Nom'))).toBe(true);
  });
  it('offers nothing to a house without lights', () => {
    expect(sceneSuggestions([room('a', 'Salon', [])], {})).toEqual([]);
  });
});

describe('a light on its tile', () => {
  it('reads its level, its colour and how long it has been on', () => {
    expect(lightLevel(state('light.a', 'on', { supported_color_modes: ['brightness'], brightness: 128 }))).toBe(50);
    expect(lightLevel(state('light.a', 'off', { supported_color_modes: ['brightness'] }))).toBe(0);
    expect(lightLevel(state('light.a', 'on', { supported_color_modes: ['onoff'] }))).toBeUndefined();
    expect(lampColor(state('light.a', 'on', { rgb_color: [255, 120.4, 0] }))).toBe('rgb(255,120,0)');
    expect(lampColor(state('light.a', 'off', { rgb_color: [255, 120, 0] }))).toBeUndefined();
    expect(minutesOn(state('light.a', 'on', {}, new Date(1_000_000).toISOString()), 1_000_000 + 125 * 60_000)).toBe(125);
    expect(minutesOn(state('light.a', 'on'))).toBeUndefined();
  });
});
