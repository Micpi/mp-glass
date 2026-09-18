import Ajv from 'ajv';
import schema from './spatial.schema.json';
import type { HAArea, HAFloor } from './models';

export type Point = [number, number];
export type OpeningKind = 'door' | 'window' | 'french_window';
/**
 * A door or a window in a wall of its room: on side `side` (from corner `side` to the next one), its middle at `at` along
 * that side (0 at its first corner, 1 at the next, along the curve of a curved wall), `width` metres wide. Without `height`
 * or `sill` (height of its bottom above the floor), those usual for its kind. `entityIds`: its shutters, blinds and curtains
 * (covers) and the contact sensors that tell whether it is open.
 */
export interface SpatialOpening { id: string; kind: OpeningKind; name?: string; side: number; at: number; width: number; height?: number; sill?: number; entityIds?: string[] }
export type MediaKind = 'tv' | 'speaker';
/** A television or a speaker standing at `at`, in metres like the room's corners, and the media player that runs it. */
export interface SpatialMedia { id: string; kind: MediaKind; name?: string; at: Point; entityId?: string }
/**
 * `arcs`, one value per side (side i runs from corner i to corner i + 1): 0 for a straight wall, otherwise how far the wall
 * bends, as the height of its arc over half the side's length, towards (−dy, dx) when positive. ±1 is a half circle.
 */
export interface SpatialRoom { id: string; name: string; polygon: Point[]; arcs?: number[]; areaId?: string; entityIds?: string[]; openings?: SpatialOpening[]; media?: SpatialMedia[] }
export interface SpatialFloor { id: string; name: string; elevation: number; height: number; rooms: SpatialRoom[] }
export interface SpatialPlan { version: 1; enabled: boolean; floors: SpatialFloor[] }
const validate = new Ajv({ strict: true }).compile<SpatialPlan>(schema);
/** Positive when the corners turn from x towards y: the inside of the ring is then on the left of each side. */
function signedArea(points: Point[]): number {
  return points.reduce((area, p, i) => { const q = points[(i + 1) % points.length]!; return area + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
}
export function polygonArea(points: Point[]): number {
  return Math.abs(signedArea(points));
}
const cross = (a: Point, b: Point, c: Point) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment = (a: Point, b: Point, c: Point) => Math.abs(cross(a,b,c)) < 1e-8 && c[0] >= Math.min(a[0],b[0])-1e-8 && c[0] <= Math.max(a[0],b[0])+1e-8 && c[1] >= Math.min(a[1],b[1])-1e-8 && c[1] <= Math.max(a[1],b[1])+1e-8;
function intersects(a: Point,b: Point,c: Point,d: Point) {
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}
export function validPolygon(points: Point[]): boolean {
  if (polygonArea(points) < .05) return false;
  for (let i=0;i<points.length;i++) {
    const a=points[i]!, b=points[(i+1)%points.length]!;
    if (Math.hypot(a[0]-b[0],a[1]-b[1]) < .01) return false;
    for(let j=i+1;j<points.length;j++) {
      if(j===i+1 || (i===0 && j===points.length-1)) continue;
      if(intersects(a,b,points[j]!,points[(j+1)%points.length]!)) return false;
    }
  }
  return true;
}
/** A side bent enough to be drawn as an arc; below, it is a straight wall. */
export const bent = (bulge: number | undefined) => Math.abs(bulge ?? 0) >= 1e-3;
/** Largest turn between two points of a curved wall as drawn: a half circle takes 24 pieces, and walls look smooth. */
export const ARC_STEP = Math.PI / 24;
/** Circle of the side from `a` to `b` bent by `bulge`: centre, radius, angle of `a` and signed sweep to `b`. Undefined for a straight side. */
export function arcCircle(a: Point, b: Point, bulge: number | undefined) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  if (!bent(bulge) || length < 1e-9) return undefined;
  const half = length / 2, sagitta = bulge! * half, radius = (half * half + sagitta * sagitta) / (2 * Math.abs(sagitta));
  const shift = sagitta - Math.sign(sagitta) * radius, center: Point = [(a[0] + b[0]) / 2 - dy / length * shift, (a[1] + b[1]) / 2 + dx / length * shift];
  return { center, radius, start: Math.atan2(a[1] - center[1], a[0] - center[0]), sweep: -4 * Math.atan(bulge!) };
}
/** Points of a curved side strictly between its ends, at most `step` apart in angle and about `minLength` apart at least (same count in Home Assistant). */
export function arcPoints(a: Point, b: Point, bulge: number | undefined, step = ARC_STEP, minLength = .02): Point[] {
  const arc = arcCircle(a, b, bulge);
  if (!arc) return [];
  const turn = Math.abs(arc.sweep), count = Math.max(2, Math.min(Math.ceil(turn / step - 1e-9), Math.floor(arc.radius * turn / minLength)));
  return Array.from({ length: count - 1 }, (_, k) => {
    const angle = arc.start + arc.sweep * (k + 1) / count;
    return [arc.center[0] + arc.radius * Math.cos(angle), arc.center[1] + arc.radius * Math.sin(angle)];
  });
}
/** Point at `t` (0 at `a`, 1 at `b`) along a side, straight or curved. */
export function sidePoint(a: Point, b: Point, bulge: number | undefined, t: number): Point {
  const arc = arcCircle(a, b, bulge);
  if (!arc) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const angle = arc.start + arc.sweep * t;
  return [arc.center[0] + arc.radius * Math.cos(angle), arc.center[1] + arc.radius * Math.sin(angle)];
}
/** The outline as drawn, curved sides included; beyond `maxPoints`, curves are drawn with fewer pieces. */
export function outline(polygon: Point[], arcs?: number[], maxPoints = Infinity, minLength = .02): Point[] {
  if (!arcs?.some(bent)) return polygon;
  const ring = (step: number) => polygon.flatMap((a, i) => [a, ...arcPoints(a, polygon[(i + 1) % polygon.length]!, arcs[i], step, minLength)]);
  let step = ARC_STEP, points = ring(step);
  while (points.length > maxPoints && step < Math.PI / 2) points = ring(step *= 1.5);
  return points;
}
type Shape = Pick<SpatialRoom, 'polygon' | 'arcs'>;
export const roomOutline = (room: Shape, maxPoints?: number) => outline(room.polygon, room.arcs, maxPoints);
/** Surface of a room, curved walls counted exactly. */
export function roomArea(room: Shape): number {
  const { polygon, arcs } = room;
  let signed = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  polygon.forEach((a, i) => {
    const arc = arcCircle(a, polygon[(i + 1) % polygon.length]!, arcs?.[i]);
    if (arc) { const turn = Math.abs(arc.sweep); signed -= Math.sign(arcs![i]!) * arc.radius ** 2 / 2 * (turn - Math.sin(turn)); }
  });
  return Math.abs(signed);
}
/** Consistent bends (one per side, up to a half circle) and an outline that neither crosses itself nor collapses. */
export function validRoom(room: Shape): boolean {
  const { polygon, arcs } = room;
  if (arcs && (arcs.length !== polygon.length || arcs.some(b => !Number.isFinite(b) || Math.abs(b) > 1))) return false;
  return validPolygon(roomOutline(room));
}
/** Width and depth along the room's own walls (a room drawn at an angle too), and whether it is a rectangle of that size. */
export function roomSize(room: Shape) {
  const { polygon, arcs } = room;
  let angle = 0, longest = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!bent(arcs?.[i]) && length > longest) { longest = length; angle = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  });
  // Turned by quarter turns to lie within 45° of x: an upright room keeps its width along x.
  angle -= Math.round(angle / (Math.PI / 2)) * Math.PI / 2;
  const points = roomOutline(room), cos = Math.cos(angle), sin = Math.sin(angle);
  const along = points.map(p => p[0] * cos + p[1] * sin), across = points.map(p => p[1] * cos - p[0] * sin);
  const width = Math.max(...along) - Math.min(...along), depth = Math.max(...across) - Math.min(...across), area = roomArea(room);
  return { width, depth, angle, rectangle: Math.abs(width * depth - area) < area * .03 };
}
/** A corner added at `t` along side `index`, on its curve when it is curved: both halves keep bending the same way. */
export function splitSide(polygon: Point[], arcs: number[] | undefined, index: number, t = .5): { polygon: Point[]; arcs?: number[] } {
  const a = polygon[index]!, b = polygon[(index + 1) % polygon.length]!, bulge = arcs?.[index], arc = arcCircle(a, b, bulge);
  const points = [...polygon];
  points.splice(index + 1, 0, sidePoint(a, b, bulge, t));
  if (!arcs) return { polygon: points };
  const bends = [...arcs];
  bends.splice(index, 1, ...(arc ? [Math.tan(-arc.sweep * t / 4), Math.tan(-arc.sweep * (1 - t) / 4)] : [0, 0]));
  return { polygon: points, arcs: bends };
}
/** Usual size of each kind of opening, in metres: its width, its height and the height of its bottom above the floor. */
export const OPENING_SIZES: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: .9, height: 2.1, sill: 0 }, window: { width: 1.2, height: 1.25, sill: .9 }, french_window: { width: 1.4, height: 2.15, sill: 0 },
};
/** Length of side `index`, along its curve when it is curved. */
export function sideLength(room: Shape, index: number): number {
  const a = room.polygon[index]!, b = room.polygon[(index + 1) % room.polygon.length]!, arc = arcCircle(a, b, room.arcs?.[index]);
  return arc ? arc.radius * Math.abs(arc.sweep) : Math.hypot(b[0] - a[0], b[1] - a[1]);
}
/** Direction of travel along a side at `t`, from `a` towards `b`, following its curve. */
function sideTangent(a: Point, b: Point, bulge: number | undefined, t: number): Point {
  const arc = arcCircle(a, b, bulge);
  if (arc) { const angle = arc.start + arc.sweep * t, sign = Math.sign(arc.sweep); return [-Math.sin(angle) * sign, Math.cos(angle) * sign]; }
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}
/** The point at `t` along side `side` of a room, the direction of the wall there (`tangent`) and the normal pointing into the room (`inward`). */
export function wallFrame(room: Shape, side: number, t: number) {
  const a = room.polygon[side]!, b = room.polygon[(side + 1) % room.polygon.length]!, bulge = room.arcs?.[side];
  const tangent = sideTangent(a, b, bulge, t);
  const inward: Point = signedArea(roomOutline(room)) > 0 ? [-tangent[1], tangent[0]] : [tangent[1], -tangent[0]];
  return { point: sidePoint(a, b, bulge, t), tangent, inward };
}
/**
 * Where an opening stands: its middle on its wall, the direction of the wall there (`tangent`), the normal pointing into the
 * room (`inward`), and its size, kept within its wall (a door wider than its wall is drawn as wide as the wall allows).
 * Undefined when its side no longer exists. Computed on the room as saved, never on `alignRooms`, whose corners can differ.
 */
export function openingPlacement(room: Shape, opening: SpatialOpening) {
  if (!Number.isInteger(opening.side) || opening.side < 0 || opening.side >= room.polygon.length) return undefined;
  const length = sideLength(room, opening.side);
  if (length < .05) return undefined;
  const width = Math.min(opening.width, Math.max(length * .8, length - .1)), half = width / 2 / length;
  const t = Math.min(1 - half, Math.max(half, opening.at)), { point, tangent, inward } = wallFrame(room, opening.side, t);
  const size = OPENING_SIZES[opening.kind];
  return { center: point, tangent, inward, width, t, height: opening.height ?? size.height, sill: opening.sill ?? size.sill };
}
export type OpeningPlacement = NonNullable<ReturnType<typeof openingPlacement>>;
/** The side of a room nearest to `p`: its index, where along it (0 to 1, along the curve of a curved side) and how far `p` is. */
export function nearestSide(room: Shape, p: Point): { side: number; t: number; distance: number } {
  let best = { side: 0, t: .5, distance: Infinity };
  room.polygon.forEach((a, i) => {
    const b = room.polygon[(i + 1) % room.polygon.length]!, bulge = room.arcs?.[i], arc = arcCircle(a, b, bulge);
    let t: number;
    if (!arc) {
      const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
      t = squared ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / squared)) : 0;
    } else {
      // Around the centre, from the first end in the direction of the curve; beyond the arc, its nearer end.
      const turn = Math.abs(arc.sweep), around = (((Math.atan2(p[1] - arc.center[1], p[0] - arc.center[0]) - arc.start) * Math.sign(arc.sweep)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      t = around <= turn ? around / turn : around - turn < 2 * Math.PI - around ? 1 : 0;
    }
    const q = sidePoint(a, b, bulge, t), distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (distance < best.distance) best = { side: i, t, distance };
  });
  return best;
}
/**
 * Openings of `room` once its outline changed from `before`. With as many sides as before, each keeps its side and its place
 * along it; otherwise (a corner added or removed) each goes to the side now nearest to where it stood on `before`, and one
 * left more than `reach` metres from every wall is dropped.
 */
export function reattachOpenings(before: Shape, room: SpatialRoom, reach = .6): SpatialOpening[] {
  const openings = room.openings ?? [];
  if (before.polygon.length === room.polygon.length) return openings;
  return openings.flatMap(opening => {
    const placed = openingPlacement(before, opening);
    if (!placed) return [];
    const { side, t, distance } = nearestSide(room, placed.center);
    return distance <= reach ? [{ ...opening, side, at: Math.round(t * 1e4) / 1e4 }] : [];
  });
}
/** Whether `p` lies inside the room, curved walls included. */
export function insideRoom(room: Shape, p: Point): boolean {
  const ring = roomOutline(room);
  let inside = false;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside;
  });
  return inside;
}
/** Openings on sides that exist, and ids used once in their room: the checks JSON Schema cannot make. */
function validFixtures(room: SpatialRoom): boolean {
  const openings = new Set<string>(), media = new Set<string>();
  for (const opening of room.openings ?? []) {
    if (opening.side >= room.polygon.length || openings.has(opening.id)) return false;
    openings.add(opening.id);
  }
  for (const item of room.media ?? []) {
    if (media.has(item.id)) return false;
    media.add(item.id);
  }
  return true;
}
/**
 * Repeated corners, and those on the line of their straight neighbours (the fold of a notch closed by `alignRooms` included),
 * removed; a corner that ends a curve stays.
 */
function tidyRing(points: Point[], arcs?: number[]): Shape {
  const ring = [...points], bends = arcs && [...arcs];
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < ring.length && ring.length > 3; i++) {
      const previous = (i + ring.length - 1) % ring.length, a = ring[previous]!, b = ring[i]!, c = ring[(i + 1) % ring.length]!;
      const repeated = Math.hypot(b[0] - a[0], b[1] - a[1]) < .02;
      if (!repeated && (bent(bends?.[previous]) || bent(bends?.[i]) || Math.abs(cross(a, b, c)) >= 1e-6)) continue;
      // The side that went from a repeated corner now starts at the one before it.
      if (repeated && bends) bends[previous] = bends[i]!;
      ring.splice(i, 1); bends?.splice(i, 1); i--; changed = true;
    }
  }
  return bends?.some(bent) ? { polygon: ring, arcs: bends } : { polygon: ring };
}
/** Two lines of a floor at a time, n·p = d with n a unit normal; an axis line knows its axis, so its points stay exact. */
interface Line { n: Point; d: number; axis?: 0 | 1; group: number }
/** Where two lines of different directions cross; lines taken in a fixed order, so that neighbours get the very same corner. */
function crossing(l: Line, m: Line): Point {
  if (l.group > m.group || (l.group === m.group && l.d > m.d)) [l, m] = [m, l];
  if (l.axis !== undefined && m.axis !== undefined) return l.axis === 0 ? [l.d, m.d] : [m.d, l.d];
  const det = l.n[0] * m.n[1] - l.n[1] * m.n[0];
  return [(l.d * m.n[1] - m.d * l.n[1]) / det, (l.n[0] * m.d - m.n[0] * l.d) / det];
}
function onto(line: Line, p: Point): Point {
  if (line.axis === 0) return [line.d, p[1]];
  if (line.axis === 1) return [p[0], line.d];
  const shift = line.d - (line.n[0] * p[0] + line.n[1] * p[1]);
  return [p[0] + line.n[0] * shift, p[1] + line.n[1] * shift];
}
/**
 * Rooms as the 3D plan draws them. Read from a drawing, two neighbouring rooms keep the thickness of the wall between them:
 * parallel straight walls closer than `gap` metres, whatever their direction (a wing drawn at an angle too), are brought
 * together halfway, so that neighbours share one wall instead of each having its own. Corners follow their walls; curved walls
 * keep their bend. Only the drawing changes, never the saved plan; a room that would lose its shape keeps it.
 */
export function alignRooms(rooms: SpatialRoom[], gap = .3): SpatialRoom[] {
  const TOLERANCE = Math.PI / 180;
  interface Side { room: number; index: number; angle: number; length: number; middle: Point }
  const sides: Side[] = [];
  rooms.forEach((room, r) => room.polygon.forEach((a, index) => {
    const b = room.polygon[(index + 1) % room.polygon.length]!, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-9 || bent(room.arcs?.[index])) return;
    // Direction within a half turn, those just under a half turn next to 0.
    let angle = ((Math.atan2(b[1] - a[1], b[0] - a[0]) % Math.PI) + Math.PI) % Math.PI;
    if (Math.PI - angle <= TOLERANCE) angle -= Math.PI;
    sides.push({ room: r, index, angle, length, middle: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
  }));
  // Walls of the same direction, within a degree; a direction within a degree of an axis is that axis.
  const directions: Side[][] = [];
  for (const side of [...sides].sort((a, b) => a.angle - b.angle)) {
    const group = directions.at(-1);
    if (group && side.angle - group[0]!.angle <= TOLERANCE) group.push(side); else directions.push([side]);
  }
  const lines = new Map<string, Line>();
  directions.forEach((group, index) => {
    const mean = group.reduce((sum, s) => sum + s.angle * s.length, 0) / group.reduce((sum, s) => sum + s.length, 0);
    const axis = Math.abs(mean) <= TOLERANCE ? 1 : Math.abs(mean - Math.PI / 2) <= TOLERANCE ? 0 : undefined;
    let n: Point = axis === 1 ? [0, 1] : axis === 0 ? [1, 0] : [-Math.sin(mean), Math.cos(mean)];
    if (Math.abs(n[0]) > Math.abs(n[1]) ? n[0] < 0 : n[1] < 0) n = [-n[0], -n[1]];
    const offset = (s: Side) => axis === 0 ? s.middle[0] : axis === 1 ? s.middle[1] : n[0] * s.middle[0] + n[1] * s.middle[1];
    // Offsets within `gap` of the first of their group meet halfway between the first and the last.
    const mapping = new Map<number, number>();
    let run: number[] = [];
    const settle = () => { const middle = (run[0]! + run.at(-1)!) / 2; for (const value of run) mapping.set(value, middle); };
    for (const value of [...new Set(group.map(offset))].sort((a, b) => a - b)) {
      if (run.length && value - run[0]! > gap) { settle(); run = []; }
      run.push(value);
    }
    if (run.length) settle();
    for (const side of group) lines.set(`${side.room}:${side.index}`, { n, d: mapping.get(offset(side))!, axis, group: index });
  });
  return rooms.map((room, r) => {
    const count = room.polygon.length;
    const moved = room.polygon.map((p, i) => {
      const before = lines.get(`${r}:${(i + count - 1) % count}`), after = lines.get(`${r}:${i}`);
      if (before && after && before.group !== after.group) {
        const corner = crossing(before, after);
        // Walls almost in line meet far away: the corner then only slides onto the longer one.
        if (Math.hypot(corner[0] - p[0], corner[1] - p[1]) <= 2 * gap) return corner;
      }
      const line = before && after ? (Math.abs(before.d - (before.n[0] * p[0] + before.n[1] * p[1])) >= Math.abs(after.d - (after.n[0] * p[0] + after.n[1] * p[1])) ? before : after) : before ?? after;
      return line ? onto(line, p) : p;
    });
    const shape = tidyRing(moved, room.arcs);
    if (!validRoom(shape)) return room;
    const drawn = { ...room, ...shape };
    if (!shape.arcs) delete drawn.arcs;
    return drawn;
  });
}
/** `path`: the points of a curved wall between `a` and `b`, as drawn. */
export interface WallSegment { a: Point; b: Point; rooms: string[]; path?: Point[] }
/**
 * Walls of a floor, each drawn once: room sides, straight or curved, are split where another room's corner lies on them,
 * then identical pieces are merged. `rooms` lists the rooms on its sides; a single one is an exterior wall.
 */
export function wallSegments(rooms: SpatialRoom[]): WallSegment[] {
  const corners = rooms.flatMap(r => r.polygon);
  const key = (p: Point) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const pieces = new Map<string, WallSegment>();
  const add = (room: string, p: Point, q: Point, bulge = 0) => {
    const [kp, kq] = [key(p), key(q)], forward = kp <= kq;
    // A curve shared by two rooms is walked both ways: its bend is told in the direction of its sorted ends.
    const id = `${forward ? `${kp}|${kq}` : `${kq}|${kp}`}${bent(bulge) ? `|${Math.round((forward ? bulge : -bulge) * 1000)}` : ''}`, piece = pieces.get(id);
    if (!piece) pieces.set(id, { a: p, b: q, rooms: [room], ...(bent(bulge) ? { path: arcPoints(p, q, bulge) } : {}) });
    else if (!piece.rooms.includes(room)) piece.rooms.push(room);
  };
  for (const room of rooms) room.polygon.forEach((a, i) => {
    const b = room.polygon[(i + 1) % room.polygon.length]!, dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-3) return;
    const arc = arcCircle(a, b, room.arcs?.[i]), cuts = [0, 1];
    for (const c of corners) {
      let t: number;
      if (!arc) {
        t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (length * length);
        if (Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / length >= .005) continue;
      } else {
        if (Math.abs(Math.hypot(c[0] - arc.center[0], c[1] - arc.center[1]) - arc.radius) >= .005) continue;
        const turn = (Math.atan2(c[1] - arc.center[1], c[0] - arc.center[0]) - arc.start) * Math.sign(arc.sweep);
        t = (((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / Math.abs(arc.sweep);
      }
      if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 1; k < cuts.length; k++) {
      const [from, to] = [cuts[k - 1]!, cuts[k]!];
      if (to - from < 1e-6) continue;
      const p = from === 0 ? a : sidePoint(a, b, room.arcs?.[i], from), q = to === 1 ? b : sidePoint(a, b, room.arcs?.[i], to);
      add(room.id, p, q, arc ? Math.tan(-arc.sweep * (to - from) / 4) : 0);
    }
  });
  return [...pieces.values()];
}
/** Middle of the footprint of `rooms`, curved walls included; undefined without a room. */
function footprintCenter(rooms: SpatialRoom[]): Point | undefined {
  const points = rooms.flatMap(r => roomOutline(r));
  if (!points.length) return undefined;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
/**
 * The floors of the house one above the other, lowest first, as the overview of every floor draws them: each floor brought
 * over the middle of the house, so that floors of different sizes stack about one centre instead of drifting apart, and
 * apart enough to see into each one, whatever their saved elevations (a wide house needs more room between its floors).
 * Only the drawing uses these positions, never the saved plan.
 */
export function stackFloors(floors: SpatialFloor[]): SpatialFloor[] {
  const house = footprintCenter(floors.flatMap(f => f.rooms)) ?? [0, 0];
  const centred = floors.map(floor => {
    const middle = footprintCenter(floor.rooms);
    if (!middle) return floor;
    const dx = house[0] - middle[0], dy = house[1] - middle[1];
    if (!dx && !dy) return floor;
    // Televisions and speakers move with their room.
    const move = ([x, y]: Point): Point => [x + dx, y + dy];
    return { ...floor, rooms: floor.rooms.map(room => ({ ...room, polygon: room.polygon.map(move), ...(room.media ? { media: room.media.map(item => ({ ...item, at: move(item.at) })) } : {}) })) };
  });
  // The house as it now stands, floors centred: what the stack takes up on screen, and so how far apart its floors sit.
  const points = centred.flatMap(f => f.rooms.flatMap(r => roomOutline(r))), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const span = points.length ? Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) : 0;
  const spacing = Math.max(0, ...floors.map(f => f.height)) + Math.max(1.5, span * .3);
  return centred.map((floor, index) => ({ floor, index }))
    .sort((a, b) => a.floor.elevation - b.floor.elevation || a.index - b.index)
    .map(({ floor }, level) => ({ ...floor, elevation: level * spacing }));
}
export function parseSpatial(value: unknown): SpatialPlan {
  if (!validate(value)) throw new Error('Plan invalide : vérifiez les pièces et les coordonnées.');
  const ids = new Set<string>();
  for (const floor of value.floors) {
    if (ids.has(floor.id)) throw new Error('Identifiants de niveaux dupliqués.');
    ids.add(floor.id);
    const rooms = new Set<string>();
    for (const room of floor.rooms) {
      if (rooms.has(room.id) || !validRoom(room) || !validFixtures(room)) throw new Error(`Géométrie invalide : ${room.name}`);
      rooms.add(room.id);
    }
  }
  return structuredClone(value);
}

/** Explicit sample, never an inferred representation of the user's home. */
export function examplePlan(): SpatialPlan {
  const room = (id: string, name: string, x: number, z: number, w: number, d: number): SpatialRoom => ({ id, name, polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]] });
  return { version:1, enabled:true, floors:[{ id:'ground', name:'Rez-de-chaussée', elevation:0, height:2.6, rooms:[
    room('living','Salon',0,0,5,4), room('dining','Séjour',5,0,4,4), room('kitchen','Cuisine',9,0,4,4),
    room('bedroom','Chambre',0,4,4,4), room('hall','Entrée',4,4,3,4), room('office','Bureau',7,4,3,4), room('bath','Salle de bain',10,4,3,4),
  ]}] };
}

interface HomeLayout { areas: HAArea[]; floors: HAFloor[] }
/** Typical surface in m², only used to give the schematic rooms plausible proportions. */
const ROOM_SIZES: [RegExp, number][] = [
  [/salon|sejour|living|lounge|salle a manger|dining|piece de vie/, 26], [/garage|atelier|workshop/, 22],
  [/jardin|terrasse|garden|terrace|balcon|balcony|piscine|pool|exterieur|outdoor|patio|veranda/, 18], [/cuisine|kitchen/, 14],
  [/chambre|bedroom|suite|parental/, 12], [/bureau|office|bibliotheque|library|study/, 10],
  [/entree|hall|couloir|degagement|corridor|palier|escalier|stair|landing/, 7], [/salle de bain|salle d.eau|\bsdb\b|bain|douche|bath|shower/, 6],
  [/buanderie|cellier|laundry|cave|cellar|dressing|placard|storage|grenier|attic/, 5], [/\bwc\b|toilet/, 3],
];
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const typicalArea = (name: string) => ROOM_SIZES.find(([pattern]) => pattern.test(plain(name)))?.[1] ?? 11;
const metres = (value: number) => Math.round(value * 100) / 100;
function uniqueId(prefix: string, value: string, used: Set<string>) {
  const base = `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 58);
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}
/** Rows of rectangles sharing their walls, inside a footprint of about 3:2. */
function tile(sizes: number[]): Point[][] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const rows = Math.ceil(sizes.length / (sizes.length > 16 ? 6 : 4)), perRow = Math.ceil(sizes.length / rows);
  const width = Math.sqrt(total * 1.5);
  const polygons: Point[][] = [];
  for (let start = 0, y = 0; start < sizes.length; start += perRow) {
    const row = sizes.slice(start, start + perRow), rowTotal = row.reduce((sum, size) => sum + size, 0);
    const depth = Math.min(6.5, Math.max(2.4, rowTotal / width));
    let x = 0;
    for (const size of row) {
      const next = x + size / rowTotal * width;
      polygons.push([[metres(x), metres(y)], [metres(next), metres(y)], [metres(next), metres(y + depth)], [metres(x), metres(y + depth)]]);
      x = next;
    }
    y += depth;
  }
  return polygons;
}

/**
 * Schematic plan built from the Home Assistant areas: one level per HA floor, one rectangle per area,
 * bound to the area, whose equipment it follows. It is a starting point, not a survey of the home.
 */
export function defaultSpatialPlan(home: HomeLayout): SpatialPlan | undefined {
  if (!home.areas.length) return undefined;
  const floors = [...home.floors].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name));
  const known = new Set(floors.map(f => f.floor_id));
  const ground = floors.reduce<HAFloor | undefined>((best, f) => !best || Math.abs(f.level ?? 0) < Math.abs(best.level ?? 0) ? f : best, undefined);
  const groups = new Map<string, HAArea[]>();
  for (const area of home.areas) {
    const key = area.floor_id && known.has(area.floor_id) ? area.floor_id : ground?.floor_id ?? '';
    groups.set(key, [...groups.get(key) ?? [], area]);
  }
  const levels = floors.length ? floors.filter(f => groups.has(f.floor_id)).slice(0, 8) : [undefined];
  const byLevel = levels.every(f => typeof f?.level === 'number');
  const floorIds = new Set<string>();
  const plan: SpatialPlan = { version: 1, enabled: true, floors: levels.map((floor, index) => {
    const areas = (groups.get(floor?.floor_id ?? '') ?? [])
      .map(area => ({ area, size: typicalArea(area.name) }))
      .sort((a, b) => b.size - a.size || a.area.name.localeCompare(b.area.name))
      .slice(0, 60);
    const polygons = tile(areas.map(a => a.size));
    const roomIds = new Set<string>();
    return {
      id: floor ? uniqueId('floor', floor.floor_id, floorIds) : 'ground',
      name: floor?.name.trim().slice(0, 80) || 'Niveau principal',
      elevation: Math.min(100, Math.max(-20, (byLevel ? floor!.level! : index) * 2.8)),
      height: 2.6,
      rooms: areas.map(({ area }, i) => ({ id: uniqueId('area', area.area_id, roomIds), name: area.name.trim().slice(0, 80) || 'Pièce', areaId: area.area_id.slice(0, 255), polygon: polygons[i]! })),
    };
  }) };
  try { return parseSpatial(plan); } catch { return undefined; }
}
