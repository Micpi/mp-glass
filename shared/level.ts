import { attachFixtures, isOpening, toMetres, type DraftFixture, type FixtureKind, type ImageFrame } from './fixtures';
import { bent, openingPlacement, reattachOpenings, roomOutline, validRoom, type Point, type SpatialMedia, type SpatialOpening, type SpatialPlan, type SpatialRoom } from './spatial';

/**
 * A room of a saved level in the plan editor, handled as a room detected on an analysed plan: 0-1000 over the level's frame,
 * `box_2d` [ymin, xmin, ymax, xmax], `polygon` [y, x] corners (none for an upright rectangle, which then gets resize
 * handles), `id` its room.
 */
export interface LevelZone { name: string; box_2d: number[]; polygon?: number[][]; arcs?: number[]; id?: string; hue?: number }
/**
 * A level being edited on its plan: the frame it is drawn in, its rooms in metres (with their doors, windows and players),
 * the same rooms as zones, and their doors, windows and players as marks over the frame.
 */
export interface LevelDraft { frame: ImageFrame; rooms: SpatialRoom[]; zones: LevelZone[]; fixtures: DraftFixture[] }

/** Pixels of the frame per metre; the plan's coordinates stay within ±200 m. */
const PER_METRE = 100, LIMIT = 200;
const millimetres = (value: number) => Math.round(value * 1000) / 1000;
/** A point of the plan, in metres, over the level's frame, in 0-1000. */
export function onFrame(p: Point, frame: ImageFrame): number[] {
  const [kx, ky] = frame.scale as [number, number], [ox, oy] = frame.origin as [number, number];
  return [(p[0] / kx + ox) / frame.width * 1000, (p[1] / ky + oy) / frame.height * 1000];
}
/**
 * What the level is drawn on: its rooms, televisions and speakers with room around them to draw more (a fifth of the house,
 * 2 m at least), at 100 pixels per metre, the same scale across and down so that right angles and curves stay true.
 */
export function levelFrame(rooms: SpatialRoom[]): ImageFrame {
  const points = rooms.flatMap(r => [...roomOutline(r), ...(r.media ?? []).map(m => m.at)]), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const [x0, x1, y0, y1] = points.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 10, 0, 8];
  const margin = Math.max(2, Math.max(x1 - x0, y1 - y0) * .2);
  const left = Math.max(-LIMIT, x0 - margin), right = Math.min(LIMIT, x1 + margin), top = Math.max(-LIMIT, y0 - margin), bottom = Math.min(LIMIT, y1 + margin);
  return { width: Math.round((right - left) * PER_METRE), height: Math.round((bottom - top) * PER_METRE), scale: [1 / PER_METRE, 1 / PER_METRE], origin: [-left * PER_METRE, -top * PER_METRE] };
}
/** A rectangle along the axes, its corners in the order the editor gives a box: it can keep its resize handles. */
function upright(room: SpatialRoom) {
  const [a, b, c, d] = room.polygon, same = (u: number, v: number) => Math.abs(u - v) < 1e-9;
  return room.polygon.length === 4 && !room.arcs?.some(bent) && same(a![1], b![1]) && same(b![0], c![0]) && same(c![1], d![1]) && same(d![0], a![0]) && b![0] > a![0] && c![1] > b![1];
}
function levelZones(rooms: SpatialRoom[], frame: ImageFrame): LevelZone[] {
  return rooms.map((room, hue) => {
    const ring = roomOutline(room).map(p => onFrame(p, frame)), xs = ring.map(p => p[0]!), ys = ring.map(p => p[1]!);
    const zone: LevelZone = { id: room.id, name: room.name, box_2d: [Math.min(...ys), Math.min(...xs), Math.max(...ys), Math.max(...xs)], hue };
    if (upright(room)) return zone;
    zone.polygon = room.polygon.map(p => { const [x, y] = onFrame(p, frame); return [y!, x!]; });
    if (room.arcs?.some(bent)) zone.arcs = [...room.arcs];
    return zone;
  });
}
/**
 * Doors, windows, televisions and speakers of the rooms as marks over the frame: an opening from one end to the other along
 * its wall, a television or a speaker where it stands. `owners` tells the room and the id of each (a mark's id is made unique
 * across the level).
 */
export function levelMarks(rooms: SpatialRoom[], frame: ImageFrame) {
  const fixtures: DraftFixture[] = [], owners = new Map<string, { room: string; id: string }>();
  const own = (room: string, id: string) => { let key = id; for (let n = 2; owners.has(key); n++) key = `${id}~${n}`; owners.set(key, { room, id }); return key; };
  for (const room of rooms) {
    for (const opening of room.openings ?? []) {
      const placed = openingPlacement(room, opening);
      if (!placed) continue;
      const { center: c, tangent: u } = placed, half = placed.width / 2;
      fixtures.push({ id: own(room.id, opening.id), kind: opening.kind, a: onFrame([c[0] - u[0] * half, c[1] - u[1] * half], frame), b: onFrame([c[0] + u[0] * half, c[1] + u[1] * half], frame) });
    }
    for (const item of room.media ?? []) fixtures.push({ id: own(room.id, item.id), kind: item.kind, a: onFrame(item.at, frame) });
  }
  return { fixtures, owners };
}
/**
 * What the sides of a room are drawn to on a level that has no drawing under it: the straight sides of the rooms, in 0-1000,
 * along the axes (`x`: upright, at an x; `y`: level, at a y) or at an angle (`slanted`), `room` telling whose they are.
 */
export function levelWalls(rooms: SpatialRoom[], frame: ImageFrame) {
  const walls = { x: [] as { at: number; from: number; to: number; room: string }[], y: [] as { at: number; from: number; to: number; room: string }[], slanted: [] as { a: number[]; b: number[]; room: string }[] };
  for (const room of rooms) room.polygon.forEach((p, i) => {
    if (bent(room.arcs?.[i])) return;
    const a = onFrame(p, frame), b = onFrame(room.polygon[(i + 1) % room.polygon.length]!, frame);
    if (Math.abs(a[0]! - b[0]!) < .01) walls.x.push({ at: (a[0]! + b[0]!) / 2, from: Math.min(a[1]!, b[1]!), to: Math.max(a[1]!, b[1]!), room: room.id });
    else if (Math.abs(a[1]! - b[1]!) < .01) walls.y.push({ at: (a[1]! + b[1]!) / 2, from: Math.min(a[0]!, b[0]!), to: Math.max(a[0]!, b[0]!), room: room.id });
    else walls.slanted.push({ a, b, room: room.id });
  });
  return walls;
}
/** A saved level, ready to be edited on its plan. */
export function openLevel(rooms: SpatialRoom[]): LevelDraft {
  const copy = structuredClone(rooms), frame = levelFrame(copy);
  return { frame, rooms: copy, zones: levelZones(copy, frame), fixtures: levelMarks(copy, frame).fixtures };
}
/** The level's rooms as a plan of their own, for the editor and the 3D preview. */
export const levelPlan = (rooms: SpatialRoom[], name = 'Niveau', height = 2.6): SpatialPlan => ({ version: 1, enabled: true, floors: [{ id: 'level', name, elevation: 0, height, rooms }] });
/** The shape of a zone in metres, to the millimetre. */
function zoneShape(zone: LevelZone, frame: ImageFrame): { polygon: Point[]; arcs?: number[] } {
  const metres = (x: number, y: number): Point => { const [mx, my] = toMetres([x, y], frame); return [millimetres(mx), millimetres(my)]; };
  if (!zone.polygon) { const [y0, x0, y1, x1] = zone.box_2d as [number, number, number, number]; return { polygon: [metres(x0, y0), metres(x1, y0), metres(x1, y1), metres(x0, y1)] }; }
  const polygon = zone.polygon.map(([y, x]) => metres(x!, y!));
  return zone.arcs?.some(bent) ? { polygon, arcs: zone.arcs.map(b => Math.round(Math.max(-1, Math.min(1, b)) * 1e4) / 1e4) } : { polygon };
}
/** Televisions and speakers of a room reshaped or moved: at the same place relative to its extent. */
function follow(before: SpatialRoom, room: SpatialRoom): SpatialMedia[] {
  const extent = (r: SpatialRoom) => { const ring = roomOutline(r), xs = ring.map(p => p[0]), ys = ring.map(p => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) || 1, h: Math.max(...ys) - Math.min(...ys) || 1 }; };
  const [from, to] = [extent(before), extent(room)];
  return (before.media ?? []).map(m => ({ ...m, at: [millimetres(to.x + (m.at[0] - from.x) / from.w * to.w), millimetres(to.y + (m.at[1] - from.y) / from.h * to.h)] as Point }));
}
/**
 * The level after its rooms were edited on the plan. A room keeps its id, its Home Assistant room and its equipment; a room
 * left untouched keeps its exact shape. The doors and windows of a reshaped room stay on their walls, those of a room turned
 * back into its rectangle go to the nearest wall (`lost`: those left too far from every wall), and its televisions and
 * speakers move with it. A shape that is not valid in metres is refused (`refused`), the room staying as it was. New rooms
 * get an id from `fresh`.
 */
export function rebuildLevel(draft: LevelDraft, zones: readonly LevelZone[], fresh: () => string) {
  const { frame } = draft, rooms = new Map(draft.rooms.map(r => [r.id, r])), shown = new Map(draft.zones.map(z => [z.id, z]));
  const next: { zone: LevelZone; room: SpatialRoom }[] = [];
  let lost = 0, refused = 0;
  for (const incoming of zones) {
    const zone = incoming.id && rooms.has(incoming.id) ? incoming : { ...incoming, id: fresh() };
    const before = rooms.get(zone.id!), old = shown.get(zone.id!);
    if (before && old && old.box_2d === zone.box_2d && old.polygon === zone.polygon && old.arcs === zone.arcs) {
      next.push({ zone, room: zone.name === before.name ? before : { ...before, name: zone.name } });
      continue;
    }
    const shape = zoneShape(zone, frame);
    if (!validRoom(shape)) { refused++; if (before && old) next.push({ zone: old, room: before }); continue; }
    const room: SpatialRoom = { id: zone.id!, name: zone.name, ...shape };
    if (before?.areaId) room.areaId = before.areaId;
    if (before?.entityIds) room.entityIds = before.entityIds;
    if (before?.openings?.length) {
      // An outline turned back into its rectangle gets its corners in another order: its walls are found again by position.
      const openings = reattachOpenings(before, { ...room, openings: before.openings }, .6, !!old?.polygon && !zone.polygon);
      lost += before.openings.length - openings.length;
      if (openings.length) room.openings = openings;
    }
    if (before?.media?.length) room.media = follow(before, room);
    next.push({ zone, room });
  }
  const result = next.map(n => n.room);
  return { level: { frame, rooms: result, zones: next.map(n => n.zone), fixtures: levelMarks(result, frame).fixtures }, lost, refused };
}
type Item = SpatialOpening | SpatialMedia;
function take(room: SpatialRoom, kind: FixtureKind, id: string): Item | undefined {
  if (isOpening(kind)) {
    const item = room.openings?.find(o => o.id === id);
    room.openings = room.openings?.filter(o => o !== item);
    if (!room.openings?.length) delete room.openings;
    return item;
  }
  const item = room.media?.find(m => m.id === id);
  room.media = room.media?.filter(m => m !== item);
  if (!room.media?.length) delete room.media;
  return item;
}
/**
 * The level after its doors, windows, televisions and speakers were placed, moved or removed on the plan. One moved keeps its
 * name, its size and its links, on the wall (or in the room) now nearest; one that lands nowhere stays where it was, and a new
 * one is left out (`refused`).
 */
export function placeMarks(draft: LevelDraft, marks: readonly DraftFixture[]) {
  const { frame } = draft, before = new Map(draft.fixtures.map(f => [f.id, f])), { owners } = levelMarks(draft.rooms, frame);
  let rooms = structuredClone(draft.rooms), refused = 0;
  const lifted = new Map<string, { room: string; item: Item }>();
  for (const [key, fixture] of before) {
    const now = marks.find(f => f.id === key), owner = owners.get(key), room = owner && rooms.find(r => r.id === owner.room);
    if (now === fixture || !owner || !room) continue;
    const item = take(room, fixture.kind, owner.id);
    if (item && now) lifted.set(key, { room: room.id, item });
  }
  for (const mark of marks.filter(f => before.get(f.id) !== f)) {
    const old = lifted.get(mark.id), id = old?.item.id ?? mark.id;
    const { plan, placed } = attachFixtures(levelPlan(rooms), [{ ...mark, id }], frame), where = placed.get(id);
    if (!where) {
      refused++;
      // Moved nowhere: back where it was.
      const room = old && rooms.find(r => r.id === old.room);
      if (room && old) { if (isOpening(mark.kind)) room.openings = [...room.openings ?? [], old.item as SpatialOpening]; else room.media = [...room.media ?? [], old.item as SpatialMedia]; }
      continue;
    }
    rooms = plan.floors[0]!.rooms;
    const room = rooms.find(r => r.id === where.room)!, list: Item[] = (isOpening(mark.kind) ? room.openings : room.media) ?? [], item = list.at(-1)!;
    // An id already used in its new room is made unique there.
    for (let n = 2; list.some(other => other !== item && other.id === item.id); n++) item.id = `${id.slice(0, 60)}-${n}`;
    const from = old?.item as Record<string, unknown> | undefined;
    for (const key of isOpening(mark.kind) ? ['name', 'height', 'sill', 'entityIds'] : ['name', 'entityId']) if (from?.[key] !== undefined) (item as unknown as Record<string, unknown>)[key] = from[key];
  }
  return { level: { frame, rooms, zones: draft.zones, fixtures: levelMarks(rooms, frame).fixtures }, refused };
}
