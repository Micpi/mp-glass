import { describe, expect, it } from 'vitest';
import { attachFixtures, toMetres, type DraftFixture } from '../shared/fixtures';
import { parseSpatial, type Point, type SpatialPlan } from '../shared/spatial';

// An image of 1300 x 800 pixels at 100 pixels per metre: 1000 across is 13 m, 1000 down is 8 m.
const frame = { width: 1300, height: 800, scale: [.01, .01], origin: [0, 0] };
const onImage = ([x, y]: Point) => [x / 13 * 1000, y / 8 * 1000];
const rectangle = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const plan = (): SpatialPlan => ({ version: 1, enabled: true, floors: [{ id: 'imported', name: 'Niveau importé', elevation: 0, height: 2.6, rooms: [
  { id: 'room-1', name: 'Séjour', polygon: rectangle(0, 0, 5, 4), openings: [{ id: 'old', kind: 'door', side: 2, at: .5, width: .9 }] },
  { id: 'room-2', name: 'Cuisine', polygon: rectangle(5, 0, 9, 4) },
] }] });

describe('doors, windows, televisions and speakers placed on an analysed plan', () => {
  it('read their points as points of the plan', () => {
    expect(toMetres([500, 500], frame)).toEqual([6.5, 4]);
    expect(toMetres([500, 500], { ...frame, origin: [50, 100] })).toEqual([6, 3]);
  });
  it('go to the wall or the room they were drawn on, as wide as drawn or as usual, and nowhere when far from every room', () => {
    const fixtures: DraftFixture[] = [
      // Along the top wall of the living room, from 1 m to 2.2 m.
      { id: 'window', kind: 'window', a: onImage([1, .03]), b: onImage([2.2, .03]) },
      // Only touched, on the wall between the two rooms.
      { id: 'door', kind: 'door', a: onImage([5.05, 2]) },
      { id: 'tv', kind: 'tv', a: onImage([7, 2.5]) },
      // Beside the house, and in the middle of a room far from its walls.
      { id: 'speaker', kind: 'speaker', a: onImage([12, 2]) },
      { id: 'lost', kind: 'french_window', a: onImage([2.5, 2]), b: onImage([3, 2]) },
    ];
    const source = plan(), { plan: attached, placed } = attachFixtures(source, fixtures, frame);
    const [living, kitchen] = attached.floors[0]!.rooms;
    expect(living!.openings).toEqual([
      { id: 'old', kind: 'door', side: 2, at: .5, width: .9 },
      { id: 'window', kind: 'window', side: 0, at: .32, width: 1.2 },
      { id: 'door', kind: 'door', side: 1, at: .5, width: .9 },
    ]);
    expect(kitchen!.media).toEqual([{ id: 'tv', kind: 'tv', at: [7, 2.5] }]);
    expect([...placed]).toEqual([['window', { room: 'room-1', width: 1.2 }], ['door', { room: 'room-1', width: .9 }], ['tv', { room: 'room-2' }]]);
    // The plan given is left as it was, and the one returned is valid.
    expect(source).toEqual(plan());
    expect(() => parseSpatial(attached)).not.toThrow();
  });
});
