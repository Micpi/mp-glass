import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { defaultProject, parseProject } from '../shared/project';
import { withoutHidden, type SpatialPlan } from '../shared/spatial';
import { accentPalette, DEFAULT_PALETTE, PLAN_COLOR_KEYS, PLAN_PALETTES, planPalette, roomAmbient, temperatureColor } from '../shared/spatial-state';
import { cleanLook } from '../frontend/wallpapers';

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}): HAState => ({ entity_id, state: value, attributes });
const plan: SpatialPlan = { version: 1, enabled: true, floors: [{ id: 'f', name: 'RDC', elevation: 0, height: 2.6, rooms: [{
  id: 'salon', name: 'Salon', polygon: [[0, 0], [4, 0], [4, 4], [0, 4]], entityIds: ['light.salon', 'media_player.tv', 'media_player.sonos'],
  media: [{ id: 'm1', kind: 'tv', at: [1, 1], entityId: 'media_player.tv' }, { id: 'm2', kind: 'speaker', at: [2, 2], entityId: 'media_player.sonos' }],
}] }] } as SpatialPlan;

describe('Personnaliser: colours of the plan', () => {
  it('keeps the colours of MP Nexus unless one is chosen, and bounds the intensity', () => {
    expect(planPalette()).toEqual(DEFAULT_PALETTE);
    const palette = planPalette({ lights: '#ff0000', media: 'red' as string }, 9);
    expect([palette.lights, palette.media, palette.glow]).toEqual(['#ff0000', DEFAULT_PALETTE.media, 1.8]);
    expect(planPalette(undefined, .1).glow).toBe(.3);
  });
  it('draws the halos and the temperature scale in the colours chosen', () => {
    const room = plan.floors[0]!.rooms[0]!, states = { 'light.salon': state('light.salon', 'on', { brightness: 255 }), 'media_player.tv': state('media_player.tv', 'playing') };
    const palette = planPalette({ lights: '#112233', media: '#445566' }, 1.5);
    expect(roomAmbient(room, states, 'lights', '°C', undefined, palette)).toEqual({ color: '#112233', strength: expect.closeTo(1.2, 5) });
    expect(roomAmbient(room, states, 'media', '°C', undefined, palette).color).toBe('#445566');
    expect(roomAmbient(room, states, 'lights')).toEqual({ color: DEFAULT_PALETTE.lights, strength: expect.closeTo(.8, 5) });
    expect([17, 19, 22, 25].map(t => temperatureColor(t, planPalette({ cold: '#000001', hot: '#000004' })))).toEqual(['#000001', DEFAULT_PALETTE.cool, DEFAULT_PALETTE.mild, '#000004']);
  });
  it('offers ready-made palettes with sound colours, and one in the accent colour', () => {
    for (const p of PLAN_PALETTES) for (const value of Object.values(p.colors)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    expect(PLAN_PALETTES.find(p => p.name === 'Néon')!.colors).toHaveProperty(PLAN_COLOR_KEYS[0]!);
    expect(accentPalette('#FF0000')).toEqual({ selected: '#ff8c8c', room: '#ff0000', house: '#ff0000' });
    expect(accentPalette('nope')).toEqual({});
  });
});

describe('Personnaliser: what is set aside', () => {
  it('takes hidden players out of the plan, and gives the same plan back for the same choice', () => {
    const hidden = new Set(['media_player.sonos']), shown = withoutHidden(plan, hidden);
    const room = shown.floors[0]!.rooms[0]!;
    expect(room.entityIds).toEqual(['light.salon', 'media_player.tv']);
    expect(room.media?.map(m => m.id)).toEqual(['m1']);
    expect(withoutHidden(plan, new Set(['media_player.sonos']))).toBe(shown);
    expect(withoutHidden(plan, new Set())).toBe(plan);
    expect(plan.floors[0]!.rooms[0]!.entityIds).toHaveLength(3);
  });
  it('saves the new choices for the house and keeps only sound ones for a screen', () => {
    const project = defaultProject();
    const appearance = { ...project.appearance, planColors: { lights: '#ffaa00', hot: '#ff0000' }, planGlow: 1.4, hiddenLayers: ['laundry' as const], hiddenEntities: ['media_player.cuisine'], showStats: false, showScenes: false };
    expect(() => parseProject({ ...project, appearance })).not.toThrow();
    expect(() => parseProject({ ...project, appearance: { ...appearance, planColors: { lights: 'orange' } } })).toThrow();
    expect(() => parseProject({ ...project, appearance: { ...appearance, hiddenLayers: ['lights'] } })).toThrow();
    expect(cleanLook({ planColors: { lights: '#ffaa00', media: 'red', other: '#000000' }, planGlow: 5, hiddenLayers: ['media', 'lights', 'media'], hiddenEntities: ['media_player.a', 'bad id', 3], showClock: false, showStats: 'no' }))
      .toEqual({ planColors: { lights: '#ffaa00' }, hiddenLayers: ['media'], hiddenEntities: ['media_player.a'], showClock: false });
    expect(cleanLook({ hiddenEntities: [], planColors: {} })).toEqual({});
  });
});
