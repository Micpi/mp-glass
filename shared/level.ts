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
/** The corners of the plan kept for a level, in metres. */
const backdropCorners = (image: ImageFrame): Point[] => [toMetres([0, 0], image), toMetres([1000, 1000], image)];
/**
 * What the level is drawn on: its rooms, televisions and speakers with room around them to draw more (a fifth of the house,
 * 2 m at least), and the plan kept under them, at 100 pixels per metre, the same scale across and down so that right angles
 * and curves stay true.
 */
export function levelFrame(rooms: SpatialRoom[], backdrop?: ImageFrame): ImageFrame {
  const points = rooms.flatMap(r => [...roomOutline(r), ...(r.media ?? []).map(m => m.at)]), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const [x0, x1, y0, y1] = points.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 10, 0, 8];
  const margin = Math.max(2, Math.max(x1 - x0, y1 - y0) * .2), [a, b] = backdrop ? backdropCorners(backdrop) : [[x0, y0], [x1, y1]];
  const left = Math.max(-LIMIT, Math.min(x0 - margin, a![0])), right = Math.min(LIMIT, Math.max(x1 + margin, b![0])), top = Math.max(-LIMIT, Math.min(y0 - margin, a![1])), bottom = Math.min(LIMIT, Math.max(y1 + margin, b![1]));
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
export function openLevel(rooms: SpatialRoom[], backdrop?: ImageFrame): LevelDraft {
  return reframeLevel(structuredClone(rooms), backdrop);
}
/** The same rooms drawn on a frame that also holds `backdrop`, the plan now under them. */
export function reframeLevel(rooms: SpatialRoom[], backdrop?: ImageFrame): LevelDraft {
  const frame = levelFrame(rooms, backdrop);
  return { frame, rooms, zones: levelZones(rooms, frame), fixtures: levelMarks(rooms, frame).fixtures };
}
/** Where the plan kept for a level lies over the level's frame, in 0-1000 (past its edges when it is moved out). */
export function backdropRect(image: ImageFrame, frame: ImageFrame) {
  const [a, b] = backdropCorners(image).map(p => onFrame(p, frame)) as [number[], number[]];
  return { x: a[0]!, y: a[1]!, width: b[0]! - a[0]!, height: b[1]! - a[1]! };
}
/** Walls: along the axes at an x (`x`) or a y (`y`), from one end to the other in 0-1000, or at an angle (`slanted`). */
export interface PlanWalls { x: { at: number; from: number; to: number }[]; y: { at: number; from: number; to: number }[]; slanted?: { a: number[]; b: number[] }[] }
/** The walls found on the plan kept for a level, from its image (0-1000 over it) onto the level's frame. */
export function backdropWalls(walls: PlanWalls, image: ImageFrame, frame: ImageFrame): PlanWalls {
  const point = (x: number, y: number) => onFrame(toMetres([x, y], image), frame);
  return {
    x: walls.x.map(line => { const [a, b] = [point(line.at, line.from), point(line.at, line.to)] as [number[], number[]]; return { at: a[0]!, from: a[1]!, to: b[1]! }; }),
    y: walls.y.map(line => { const [a, b] = [point(line.from, line.at), point(line.to, line.at)] as [number[], number[]]; return { at: a[1]!, from: a[0]!, to: b[0]! }; }),
    slanted: (walls.slanted ?? []).map(edge => ({ a: point(edge.a[0]!, edge.a[1]!), b: point(edge.b[0]!, edge.b[1]!) })),
  };
}
/** The plan kept for a level moved by `dx`, `dy` metres. */
export function shiftBackdrop(image: ImageFrame, dx: number, dy: number): ImageFrame {
  const [kx, ky] = image.scale as [number, number], [ox, oy] = image.origin as [number, number];
  return { ...image, origin: [ox - dx / kx, oy - dy / ky] };
}
/** The plan kept for a level `factor` times larger, around its middle. */
export function zoomBackdrop(image: ImageFrame, factor: number): ImageFrame {
  const [kx, ky] = image.scale as [number, number], middle = toMetres([500, 500], image), scale = [kx * factor, ky * factor] as [number, number];
  return { ...image, scale, origin: [image.width / 2 - middle[0] / scale[0], image.height / 2 - middle[1] / scale[1]] };
}
interface Run { at: number; length: number }
/** Lines at the same place (within `merge`) counted together, the longest `keep` kept. */
function runs(lines: Run[], merge: number, keep = Infinity): Run[] {
  const merged: Run[] = [];
  for (const line of [...lines].sort((a, b) => a.at - b.at)) {
    const last = merged.at(-1);
    if (last && line.at - last.at <= merge) { last.at = (last.at * last.length + line.at * line.length) / (last.length + line.length || 1); last.length += line.length; }
    else merged.push({ ...line });
  }
  return merged.sort((a, b) => b.length - a.length).slice(0, keep).sort((a, b) => a.at - b.at);
}
type Axis = 'x' | 'y';
interface Match { r: Run; q: Run }
/**
 * Where a plan drawn as `width` x `height` pixels lies under the rooms of a level, found from the walls seen on it (0-1000 over
 * it): the scale and the place that put the most length of the rooms' straight sides onto walls of the drawing, the same scale
 * across and down. `score` is the part of the rooms' sides that land on a wall; below a half, the plan is only laid over the
 * house, centred, for the user to adjust.
 */
export function fitBackdrop(rooms: SpatialRoom[], walls: PlanWalls, width: number, height: number): { backdrop: ImageFrame; score: number } {
  const sides = { x: [] as Run[], y: [] as Run[] };
  for (const room of rooms) room.polygon.forEach((a, i) => {
    const b = room.polygon[(i + 1) % room.polygon.length]!;
    if (bent(room.arcs?.[i])) return;
    if (Math.abs(a[0] - b[0]) < 1e-6) sides.x.push({ at: a[0], length: Math.abs(b[1] - a[1]) });
    else if (Math.abs(a[1] - b[1]) < 1e-6) sides.y.push({ at: a[1], length: Math.abs(b[0] - a[0]) });
  });
  const metres: Record<Axis, Run[]> = { x: runs(sides.x, .02), y: runs(sides.y, .02) };
  const pixels: Record<Axis, Run[]> = {
    x: runs(walls.x.map(l => ({ at: l.at / 1000 * width, length: Math.abs(l.to - l.from) / 1000 * height })), 2, 60),
    y: runs(walls.y.map(l => ({ at: l.at / 1000 * height, length: Math.abs(l.to - l.from) / 1000 * width })), 2, 60),
  };
  const ring = rooms.flatMap(r => roomOutline(r)), xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const [x0, x1, y0, y1] = ring.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 10, 0, 8];
  const house = { width: Math.max(x1 - x0, .5), height: Math.max(y1 - y0, .5) };
  const frame = (s: number, ox: number, oy: number): ImageFrame => ({ width, height, scale: [1 / s, 1 / s], origin: [ox, oy] });
  // The house fits in its drawing, and takes a sixth of it at least.
  const most = 1.05 * Math.min(width / house.width, height / house.height), least = most / 6;
  const tolerance = Math.max(3, .004 * Math.max(width, height));
  const total = [...metres.x, ...metres.y].reduce((sum, r) => sum + r.length, 0);
  const matches = (s: number, o: number, axis: Axis): Match[] => metres[axis].flatMap(r => {
    let best: Run | undefined, gap = tolerance;
    for (const q of pixels[axis]) { const d = Math.abs(s * r.at + o - q.at); if (d <= gap) { gap = d; best = q; } }
    return best ? [{ r, q: best }] : [];
  });
  const score = (s: number, ox: number, oy: number) => total ? [...matches(s, ox, 'x'), ...matches(s, oy, 'y')].reduce((sum, m) => sum + m.r.length, 0) / total : 0;
  // Scales told by pairs of sides and pairs of walls, 0.4 % apart, the longest counting most.
  const votes = new Map<number, number>();
  const longest = { m: Math.max(1e-9, ...[...metres.x, ...metres.y].map(r => r.length)), p: Math.max(1e-9, ...[...pixels.x, ...pixels.y].map(r => r.length)) };
  for (const axis of ['x', 'y'] as const) {
    const m = metres[axis], p = pixels[axis];
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
      const span = m[j]!.at - m[i]!.at;
      if (span < .8) continue;
      const weight = Math.min(m[i]!.length, m[j]!.length) / longest.m;
      for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) {
        const s = (p[b]!.at - p[a]!.at) / span;
        if (s < least || s > most) continue;
        const bin = Math.round(Math.log(s) / .004);
        votes.set(bin, (votes.get(bin) ?? 0) + weight * Math.min(p[a]!.length, p[b]!.length) / longest.p);
      }
    }
  }
  const smooth = (bin: number) => (votes.get(bin - 1) ?? 0) + (votes.get(bin) ?? 0) + (votes.get(bin + 1) ?? 0);
  /** The offset most walls agree on for a scale, keeping the house on its drawing. */
  const offset = (s: number, axis: Axis, low: number, high: number, size: number) => {
    const bins = new Map<number, number>();
    for (const r of metres[axis]) for (const q of pixels[axis]) {
      const o = q.at - s * r.at;
      if (o + s * low < -tolerance || o + s * high > size + tolerance) continue;
      const bin = Math.round(o / 2);
      bins.set(bin, (bins.get(bin) ?? 0) + Math.min(r.length * s, q.length));
    }
    let best: number | undefined, weight = -1;
    for (const bin of bins.keys()) { const w = (bins.get(bin - 1) ?? 0) + bins.get(bin)! + (bins.get(bin + 1) ?? 0); if (w > weight) { weight = w; best = bin * 2; } }
    return best;
  };
  const mean = (list: Match[], of: (m: Match) => number) => { const w = list.reduce((sum, m) => sum + m.r.length, 0); return w ? list.reduce((sum, m) => sum + of(m) * m.r.length, 0) / w : 0; };
  let best: { s: number; ox: number; oy: number; score: number } | undefined;
  for (const bin of [...votes.keys()].sort((a, b) => smooth(b) - smooth(a)).slice(0, 8)) {
    const s = Math.exp(bin * .004), ox = offset(s, 'x', x0, x1, width), oy = offset(s, 'y', y0, y1, height);
    if (ox === undefined || oy === undefined) continue;
    // Refined on the sides that landed on a wall: one scale, two offsets, least squares weighted by length.
    const pairs = { x: matches(s, ox, 'x'), y: matches(s, oy, 'y') };
    const centre = { x: [mean(pairs.x, m => m.r.at), mean(pairs.x, m => m.q.at)], y: [mean(pairs.y, m => m.r.at), mean(pairs.y, m => m.q.at)] };
    let up = 0, down = 0;
    for (const axis of ['x', 'y'] as const) for (const m of pairs[axis]) { const [cm, cp] = centre[axis] as [number, number]; up += m.r.length * (m.r.at - cm) * (m.q.at - cp); down += m.r.length * (m.r.at - cm) ** 2; }
    const refined = down > 0 ? up / down : s;
    const candidate = Math.abs(refined / s - 1) < .01
      ? { s: refined, ox: pairs.x.length ? centre.x[1]! - refined * centre.x[0]! : ox, oy: pairs.y.length ? centre.y[1]! - refined * centre.y[0]! : oy }
      : { s, ox, oy };
    const value = score(candidate.s, candidate.ox, candidate.oy);
    if (!best || value > best.score) best = { ...candidate, score: value };
  }
  if (best && best.score >= .5) return { backdrop: frame(best.s, best.ox, best.oy), score: best.score };
  // Nothing agrees: the walls seen on the drawing (or the drawing itself) laid over the house, centred.
  const seen = [...walls.x.flatMap(l => [[l.at / 1000 * width, l.from / 1000 * height], [l.at / 1000 * width, l.to / 1000 * height]]),
    ...walls.y.flatMap(l => [[l.from / 1000 * width, l.at / 1000 * height], [l.to / 1000 * width, l.at / 1000 * height]])];
  const [px0, px1, py0, py1] = seen.length > 3 ? [Math.min(...seen.map(p => p[0]!)), Math.max(...seen.map(p => p[0]!)), Math.min(...seen.map(p => p[1]!)), Math.max(...seen.map(p => p[1]!))] : [width * .1, width * .9, height * .1, height * .9];
  const s = Math.min((px1 - px0) / house.width, (py1 - py0) / house.height) || most * .8;
  return { backdrop: frame(s, (px0 + px1) / 2 - s * (x0 + x1) / 2, (py0 + py1) / 2 - s * (y0 + y1) / 2), score: best?.score ?? 0 };
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
