import { describe, expect, it } from 'vitest';
import { levelMarks, onFrame, openLevel, placeMarks, rebuildLevel, type LevelZone } from '../shared/level';
import { toMetres } from '../shared/fixtures';
import { openingPlacement, parseSpatial, type Point, type SpatialRoom } from '../shared/spatial';

const rectangle = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** A living room (5 x 4 m) linked to its area, with a window, a door and a television, a kitchen, and a hall drawn from another corner. */
const rooms = (): SpatialRoom[] => [
  { id: 'living', name: 'Salon', polygon: rectangle(0, 0, 5, 4), areaId: 'salon', entityIds: ['light.salon'],
    openings: [{ id: 'w1', kind: 'window', side: 0, at: .5, width: 1.2, name: 'Baie', entityIds: ['cover.salon'] }, { id: 'd1', kind: 'door', side: 1, at: .5, width: .9 }],
    media: [{ id: 'tv1', kind: 'tv', at: [1, 2], entityId: 'media_player.tv' }] },
  { id: 'kitchen', name: 'Cuisine', polygon: rectangle(5, 0, 9, 4), openings: [{ id: 'w1', kind: 'window', side: 0, at: .5, width: 1 }] },
  { id: 'hall', name: 'Entrée', polygon: [[5, 7], [5, 4], [9, 4], [9, 7]] },
];
let counter = 0;
const fresh = () => `room-new${++counter}`;
const move = (zone: LevelZone, dx: number, dy: number): LevelZone => ({ ...zone, box_2d: [zone.box_2d[0]! + dy, zone.box_2d[1]! + dx, zone.box_2d[2]! + dy, zone.box_2d[3]! + dx] });

describe('a saved level edited on its plan', () => {
  it('is drawn at one scale across and down, with room around the house, rectangles with their handles', () => {
    const level = openLevel(rooms()), { frame } = level;
    expect(frame.scale).toEqual([.01, .01]);
    // 9 x 7 m, 2 m around it.
    expect([frame.width, frame.height]).toEqual([1300, 1100]);
    expect(toMetres(onFrame([5, 4], frame), frame).map(v => Math.round(v * 1e6) / 1e6)).toEqual([5, 4]);
    expect(level.zones.map(z => [z.id, !!z.polygon])).toEqual([['living', false], ['kitchen', false], ['hall', true]]);
    expect(level.zones[0]!.box_2d.map(v => Math.round(v))).toEqual([Math.round(200 / 1100 * 1000), Math.round(200 / 1300 * 1000), Math.round(600 / 1100 * 1000), Math.round(700 / 1300 * 1000)]);
    // Its doors, windows and players as marks, each with its own id across the level.
    expect(level.fixtures.map(f => [f.id, f.kind])).toEqual([['w1', 'window'], ['d1', 'door'], ['tv1', 'tv'], ['w1~2', 'window']]);
    const window = level.fixtures[0]!;
    expect(toMetres(window.a, frame).map(v => Math.round(v * 100) / 100)).toEqual([1.9, 0]);
    expect(toMetres(window.b!, frame).map(v => Math.round(v * 100) / 100)).toEqual([3.1, 0]);
    expect(levelMarks(level.rooms, frame).owners.get('w1~2')).toEqual({ room: 'kitchen', id: 'w1' });
  });
  it('keeps untouched rooms exactly, and a renamed one keeps its shape and its links', () => {
    const level = openLevel(rooms());
    const renamed = level.zones.map(z => z.id === 'living' ? { ...z, name: 'Séjour' } : z);
    const { level: next, lost, refused } = rebuildLevel(level, renamed, fresh);
    expect([lost, refused]).toEqual([0, 0]);
    expect(next.rooms[0]).toEqual({ ...rooms()[0], name: 'Séjour' });
    expect(next.rooms.slice(1)).toEqual(rooms().slice(1));
  });
  it('moves a room with its doors, windows and players, and keeps what it is linked to', () => {
    const level = openLevel(rooms()), { frame } = level, step = 100 / frame.width * 1000;  // 1 m across
    const { level: next } = rebuildLevel(level, level.zones.map(z => z.id === 'living' ? move(z, -step, 0) : z), fresh);
    const living = next.rooms[0]!;
    expect(living.polygon).toEqual(rectangle(-1, 0, 4, 4));
    expect(living).toMatchObject({ areaId: 'salon', entityIds: ['light.salon'], openings: rooms()[0]!.openings });
    expect(living.media).toEqual([{ id: 'tv1', kind: 'tv', at: [0, 2], entityId: 'media_player.tv' }]);
    // The marks follow.
    expect(toMetres(next.fixtures[2]!.a, frame).map(v => Math.round(v * 100) / 100)).toEqual([0, 2]);
    expect(() => parseSpatial({ version: 1, enabled: true, floors: [{ id: 'f', name: 'F', elevation: 0, height: 2.6, rooms: next.rooms }] })).not.toThrow();
  });
  it('adds and removes rooms; an outline back to its rectangle finds its walls again by position', () => {
    const level = openLevel(rooms()), frame = level.frame;
    const drawn: LevelZone = { name: 'Cellier', box_2d: [onFrame([0, 4], frame)[1]!, onFrame([0, 4], frame)[0]!, onFrame([0, 6], frame)[1]!, onFrame([3, 6], frame)[0]!] };
    // The hall, drawn from its bottom left corner going up, becomes the rectangle around it: corners in another order.
    const hall = level.zones[2]!, square: LevelZone = { name: hall.name, id: hall.id, box_2d: hall.box_2d, hue: hall.hue };
    const withDoor = { ...level, rooms: level.rooms.map(r => r.id === 'hall' ? { ...r, openings: [{ id: 'd2', kind: 'door' as const, side: 1, at: .5, width: .9 }] } : r) };
    const { level: next } = rebuildLevel(withDoor, [level.zones[0]!, square, drawn], fresh);
    expect(next.rooms.map(r => r.id)).toEqual(['living', 'hall', `room-new${counter}`]);
    expect(next.zones[2]!.id).toBe(next.rooms[2]!.id);
    expect(next.rooms[2]).toEqual({ id: next.rooms[2]!.id, name: 'Cellier', polygon: rectangle(0, 4, 3, 6) });
    // The door was on the top wall (side 1 from (5,4) to (9,4)): it is on the top wall of the rectangle, now side 0.
    const hallRoom = next.rooms[1]!;
    expect(hallRoom.polygon).toEqual(rectangle(5, 4, 9, 7));
    expect(hallRoom.openings).toEqual([{ id: 'd2', kind: 'door', side: 0, at: .5, width: .9 }]);
    expect(openingPlacement(hallRoom, hallRoom.openings![0]!)!.center).toEqual([7, 4]);
  });
  it('refuses a shape too small in metres, the room staying as it was', () => {
    const level = openLevel(rooms()), tiny = { ...level.zones[1]!, box_2d: [300, 700, 300.05, 700.05] };
    const { level: next, refused } = rebuildLevel(level, [level.zones[0]!, tiny, level.zones[2]!], fresh);
    expect(refused).toBe(1);
    expect(next.rooms[1]).toBe(level.rooms[1]);
    expect(next.zones[1]).toBe(level.zones[1]);
  });
  it('moves, removes and adds doors, windows and players, keeping their names and links', () => {
    const level = openLevel(rooms()), { frame } = level, at = (p: Point) => onFrame(p, frame);
    const [window, door, tv, kitchenWindow] = level.fixtures as [typeof level.fixtures[0], typeof level.fixtures[0], typeof level.fixtures[0], typeof level.fixtures[0]];
    const marks = [
      // The window of the living room dragged onto its left wall, as wide as it was.
      { ...window, a: at([.02, 1]), b: at([.02, 2.2]) },
      tv,
      kitchenWindow,
      // A new speaker in the kitchen, and a new door far from every wall.
      { id: 'media-new', kind: 'speaker' as const, a: at([7, 2]) },
      { id: 'opening-far', kind: 'door' as const, a: at([-1.8, -1.8]), b: at([-1, -1.8]) },
    ];
    void door;  // removed
    const { level: next, refused } = placeMarks(level, marks);
    expect(refused).toBe(1);
    const [living, kitchen] = next.rooms as [SpatialRoom, SpatialRoom];
    expect(living.openings).toEqual([{ id: 'w1', kind: 'window', side: 3, at: .6, width: 1.2, name: 'Baie', entityIds: ['cover.salon'] }]);
    expect(living.media).toEqual(rooms()[0]!.media);
    expect(kitchen.openings).toEqual(rooms()[1]!.openings);
    expect(kitchen.media).toEqual([{ id: 'media-new', kind: 'speaker', at: [7, 2] }]);
    expect(next.fixtures.map(f => f.id)).toEqual(['w1', 'tv1', 'w1~2', 'media-new']);
    // A mark moved nowhere goes back where it was.
    const again = placeMarks(next, next.fixtures.map(f => f.id === 'tv1' ? { ...f, a: at([-1.9, -1.9]) } : f));
    expect(again.refused).toBe(1);
    expect(again.level.rooms[0]!.media).toEqual(rooms()[0]!.media);
  });
  it('keeps each id once in its room when a door moves next door', () => {
    const level = openLevel(rooms()), { frame } = level, at = (p: Point) => onFrame(p, frame);
    // The living room's window w1 moved onto the kitchen's right wall, where a w1 already is.
    const marks = level.fixtures.map(f => f.id === 'w1' ? { ...f, a: at([8.98, 1]), b: at([8.98, 2.2]) } : f);
    const kitchen = placeMarks(level, marks).level.rooms[1]!;
    expect(kitchen.openings!.map(o => [o.id, o.side, o.name])).toEqual([['w1', 0, undefined], ['w1-2', 1, 'Baie']]);
  });
});
