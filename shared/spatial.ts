import Ajv from 'ajv';
import schema from './spatial.schema.json';
import type { HAArea, HAFloor, LogicalDevice } from './models';

export type Point = [number, number];
export interface SpatialRoom { id: string; name: string; polygon: Point[]; areaId?: string; entityIds?: string[] }
export interface SpatialFloor { id: string; name: string; elevation: number; height: number; rooms: SpatialRoom[] }
export interface SpatialPlan { version: 1; enabled: boolean; floors: SpatialFloor[] }
const validate = new Ajv({ strict: true }).compile<SpatialPlan>(schema);
export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((area, p, i) => { const q = points[(i + 1) % points.length]!; return area + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
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
export interface WallSegment { a: Point; b: Point; rooms: string[] }
/**
 * Walls of a floor, each drawn once: room edges are split where another room's corner lies on them,
 * then identical pieces are merged. `rooms` lists the rooms on its sides; a single one is an exterior wall.
 */
export function wallSegments(rooms: SpatialRoom[]): WallSegment[] {
  const corners = rooms.flatMap(r => r.polygon);
  const key = (p: Point) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const pieces = new Map<string, WallSegment>();
  for (const room of rooms) room.polygon.forEach((a, i) => {
    const b = room.polygon[(i + 1) % room.polygon.length]!, dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-3) return;
    const cuts = [0, 1];
    for (const c of corners) {
      const t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (length * length);
      if (t > 1e-6 && t < 1 - 1e-6 && Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / length < .005) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 1; k < cuts.length; k++) {
      if (cuts[k]! - cuts[k - 1]! < 1e-6) continue;
      const p: Point = [a[0] + dx * cuts[k - 1]!, a[1] + dy * cuts[k - 1]!], q: Point = [a[0] + dx * cuts[k]!, a[1] + dy * cuts[k]!];
      const id = [key(p), key(q)].sort().join('|'), piece = pieces.get(id);
      if (!piece) pieces.set(id, { a: p, b: q, rooms: [room.id] });
      else if (!piece.rooms.includes(room.id)) piece.rooms.push(room.id);
    }
  });
  return [...pieces.values()];
}
export function parseSpatial(value: unknown): SpatialPlan {
  if (!validate(value)) throw new Error('Plan invalide : vérifiez les pièces et les coordonnées.');
  const ids = new Set<string>();
  for (const floor of value.floors) {
    if (ids.has(floor.id)) throw new Error('Identifiants de niveaux dupliqués.');
    ids.add(floor.id);
    const rooms = new Set<string>();
    for (const room of floor.rooms) {
      if (rooms.has(room.id) || !validPolygon(room.polygon)) throw new Error(`Géométrie invalide : ${room.name}`);
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

interface HomeLayout { areas: HAArea[]; floors: HAFloor[]; devices: Pick<LogicalDevice,'entityId'|'areaId'|'category'|'hidden'|'disabled'>[] }
/** Typical surface in m², only used to give the schematic rooms plausible proportions. */
const ROOM_SIZES: [RegExp, number][] = [
  [/salon|sejour|living|lounge|salle a manger|dining|piece de vie/, 26], [/garage|atelier|workshop/, 22],
  [/jardin|terrasse|garden|terrace|balcon|balcony|piscine|pool|exterieur|outdoor|patio|veranda/, 18], [/cuisine|kitchen/, 14],
  [/chambre|bedroom|suite|parental/, 12], [/bureau|office|bibliotheque|library|study/, 10],
  [/entree|hall|couloir|degagement|corridor|palier|escalier|stair|landing/, 7], [/salle de bain|salle d.eau|\bsdb\b|bain|douche|bath|shower/, 6],
  [/buanderie|cellier|laundry|cave|cellar|dressing|placard|storage|grenier|attic/, 5], [/\bwc\b|toilet/, 3],
];
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const roomSize = (name: string) => ROOM_SIZES.find(([pattern]) => pattern.test(plain(name)))?.[1] ?? 11;
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
 * bound to the area and its lights. It is a starting point, not a survey of the home.
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
      .map(area => ({ area, size: roomSize(area.name) }))
      .sort((a, b) => b.size - a.size || a.area.name.localeCompare(b.area.name))
      .slice(0, 60);
    const polygons = tile(areas.map(a => a.size));
    const roomIds = new Set<string>();
    return {
      id: floor ? uniqueId('floor', floor.floor_id, floorIds) : 'ground',
      name: floor?.name.trim().slice(0, 80) || 'Niveau principal',
      elevation: Math.min(100, Math.max(-20, (byLevel ? floor!.level! : index) * 2.8)),
      height: 2.6,
      rooms: areas.map(({ area }, i) => {
        const entityIds = home.devices
          .filter(d => d.areaId === area.area_id && !d.hidden && !d.disabled && /^(light|cover|climate)\.[a-z0-9_]+$/.test(d.entityId))
          .sort((a, b) => Number(b.category === 'light') - Number(a.category === 'light') || a.entityId.localeCompare(b.entityId))
          .slice(0, 12).map(d => d.entityId);
        return { id: uniqueId('area', area.area_id, roomIds), name: area.name.trim().slice(0, 80) || 'Pièce', areaId: area.area_id.slice(0, 255), polygon: polygons[i]!, ...(entityIds.length ? { entityIds } : {}) };
      }),
    };
  }) };
  try { return parseSpatial(plan); } catch { return undefined; }
}
