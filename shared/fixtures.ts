import { insideRoom, nearestSide, OPENING_SIZES, type MediaKind, type OpeningKind, type Point, type SpatialPlan, type SpatialRoom } from './spatial';

export type FixtureKind = OpeningKind | MediaKind;
/**
 * A door, a window, a television or a speaker placed on an analysed plan, before it becomes a level: [x, y] in 0-1000 over the
 * image, like the detected rooms, so that it stays where it was drawn whatever the rooms become. An opening runs from `a` to
 * `b` along its wall; a television or a speaker stands at `a`.
 */
export interface DraftFixture { id: string; kind: FixtureKind; a: number[]; b?: number[] }
/** How the analysed image maps onto the plan: its size in pixels, metres per pixel and the pixel of the plan's origin. */
export interface ImageFrame { width: number; height: number; scale: number[]; origin: number[] }
export const isOpening = (kind: FixtureKind): kind is OpeningKind => kind === 'door' || kind === 'window' || kind === 'french_window';
/** How far from a wall of a room the middle of an opening may be, and a television or a speaker from a room, in metres. */
const WALL_REACH = .6, ROOM_REACH = .3;
const centimetres = (value: number) => Math.round(value * 100) / 100;
/** A point over the image, in 0-1000, as a point of the plan in metres. */
export function toMetres(p: number[], frame: ImageFrame): Point {
  const [kx, ky] = frame.scale as [number, number], [ox, oy] = frame.origin as [number, number];
  return [(p[0]! / 1000 * frame.width - ox) * kx, (p[1]! / 1000 * frame.height - oy) * ky];
}
/**
 * The plan with the doors, windows, televisions and speakers placed on its image. An opening goes on the wall of the room nearest
 * to its middle, as wide as drawn (the usual width of its kind when it was only touched); a television or a speaker goes in the
 * room it stands in. `placed` tells the room each one went to, and an opening's width; one too far from every room is left out.
 * Rooms keep the doors, windows and players they already had.
 */
export function attachFixtures(plan: SpatialPlan, fixtures: readonly DraftFixture[], frame: ImageFrame) {
  const copy = structuredClone(plan), rooms = copy.floors[0]?.rooms ?? [], placed = new Map<string, { room: string; width?: number }>();
  for (const fixture of fixtures) {
    const a = toMetres(fixture.a, frame);
    if (isOpening(fixture.kind)) {
      const b = fixture.b ? toMetres(fixture.b, frame) : a, middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let best: { room: SpatialRoom; side: number; t: number; distance: number } | undefined;
      for (const room of rooms) { const near = nearestSide(room, middle); if (!best || near.distance < best.distance) best = { room, ...near }; }
      if (!best || best.distance > WALL_REACH || (best.room.openings?.length ?? 0) >= 24) continue;
      const drawn = Math.hypot(b[0] - a[0], b[1] - a[1]), width = centimetres(drawn >= .3 ? Math.min(12, drawn) : OPENING_SIZES[fixture.kind].width);
      best.room.openings = [...best.room.openings ?? [], { id: fixture.id, kind: fixture.kind, side: best.side, at: Math.round(best.t * 1e4) / 1e4, width }];
      placed.set(fixture.id, { room: best.room.id, width });
    } else {
      const room = rooms.find(r => insideRoom(r, a)) ?? rooms.find(r => nearestSide(r, a).distance <= ROOM_REACH);
      if (!room || (room.media?.length ?? 0) >= 12) continue;
      room.media = [...room.media ?? [], { id: fixture.id, kind: fixture.kind, at: [centimetres(a[0]), centimetres(a[1])] }];
      placed.set(fixture.id, { room: room.id });
    }
  }
  return { plan: copy, placed };
}
