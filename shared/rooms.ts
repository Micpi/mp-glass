import type { HAArea, HAFloor, HAState, LogicalDevice } from './models';
import type { SpatialPlan, SpatialRoom } from './spatial';

/** Equipment worth showing in a room of the plan; energy, diagnostics and settings stay off it. */
export type PlanKind = 'light' | 'cover' | 'climate' | 'temperature' | 'humidity' | 'media' | 'opening' | 'motion';
/** Order of the room card: the first temperature sensor gives the room its temperature. */
const ORDER: PlanKind[] = ['light', 'cover', 'climate', 'temperature', 'humidity', 'media', 'opening', 'motion'];
/** Same limit as a list chosen by hand. */
export const ROOM_ENTITY_LIMIT = 12;

export function planKind(entityId: string, state?: HAState, entityCategory?: string | null): PlanKind | undefined {
  if (entityCategory) return undefined;
  const domain = entityId.split('.')[0], deviceClass = String(state?.attributes.device_class ?? ''), unit = String(state?.attributes.unit_of_measurement ?? '');
  if (domain === 'light' || domain === 'cover' || domain === 'climate') return domain;
  // Televisions, speakers and amplifiers alike: whatever plays sound or pictures in the room.
  if (domain === 'media_player') return 'media';
  if (domain === 'binary_sensor') return ['door', 'window', 'opening', 'garage_door'].includes(deviceClass) ? 'opening' : ['motion', 'occupancy', 'presence'].includes(deviceClass) ? 'motion' : undefined;
  if (domain === 'sensor') return deviceClass === 'temperature' || /^°[CF]$/.test(unit) ? 'temperature' : deviceClass === 'humidity' ? 'humidity' : undefined;
  return undefined;
}

type Equipment = Pick<LogicalDevice, 'entityId' | 'name' | 'areaId' | 'planKind' | 'hidden' | 'disabled'>;
const shown = (d: Equipment) => !!d.planKind && !d.hidden && !d.disabled;
const byKind = (a: Equipment, b: Equipment) => ORDER.indexOf(a.planKind!) - ORDER.indexOf(b.planKind!) || a.name.localeCompare(b.name, undefined, { numeric: true }) || (a.entityId < b.entityId ? -1 : 1);

/** Equipment of an area, in the order of the room card. */
export function areaEquipment<T extends Equipment>(areaId: string, devices: readonly T[]): T[] {
  return devices.filter(d => d.areaId === areaId && shown(d)).sort(byKind);
}
/** A room bound to an area without a list of its own follows the area: its equipment is resolved, never stored. */
export const followsArea = (room: SpatialRoom) => !!room.areaId && !room.entityIds;

/** Plan as displayed: rooms that follow their area receive its current equipment. */
export function resolvePlan(plan: SpatialPlan, devices: readonly Equipment[]): SpatialPlan {
  const areas = new Map<string, Equipment[]>();
  for (const d of devices) if (d.areaId && shown(d)) { const list = areas.get(d.areaId); if (list) list.push(d); else areas.set(d.areaId, [d]); }
  return { ...plan, floors: plan.floors.map(floor => ({ ...floor, rooms: floor.rooms.map(room => {
    if (!followsArea(room)) return room;
    const entityIds = [...areas.get(room.areaId!) ?? []].sort(byKind).slice(0, ROOM_ENTITY_LIMIT).map(d => d.entityId);
    return entityIds.length ? { ...room, entityIds } : room;
  }) })) };
}

const plain = (text: string) => ` ${text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
/** Abbreviations written on plans, and English names, spelled as Home Assistant areas usually are. */
const WORDS = ([
  ['s d b|sdb|sde|salle d eau|salle de bains|bathroom', 'salle de bain'], ['ch|chb|chbre|bedroom', 'chambre'], ['sej', 'sejour'],
  ['cuis|kitchen', 'cuisine'], ['dgt|deg|degt', 'degagement'], ['bur|office', 'bureau'], ['w c|toilettes|toilette|toilet', 'wc'],
  ['sam|dining room|dining', 'salle a manger'], ['living room|living', 'salon'], ['buand|laundry', 'buanderie'],
] as const).map(([spellings, word]) => [new RegExp(`(?<= )(?:${spellings})(?= )`, 'g'), word] as const);
/** Rooms of the same kind can match when each is the only one of its kind left on both sides ("Séjour" and "Salon"). */
const KINDS: RegExp[] = [
  / (salon|sejour|lounge|piece de vie|salle a manger) /, / cuisine /, / (chambre|suite|parentale?) /, / (salle de bain|douche) /, / wc /,
  / (bureau|bibliotheque|library|study) /, / (entree|hall|couloir|degagement|corridor|palier|landing) /, / (escalier|stairs?) /,
  / (garage|atelier|workshop) /, / (buanderie|cellier) /, / (dressing|placard|rangement|storage|cave|cellar|grenier|attic) /,
  / (jardin|terrasse|garden|terrace|balcon|balcony|patio|veranda) /,
];
function words(name: string) {
  let text = plain(name);
  for (const [pattern, word] of WORDS) text = text.replace(pattern, word);
  return { text, tokens: new Set(text.trim().split(' ')), kind: KINDS.findIndex(pattern => pattern.test(text)) };
}
type Words = ReturnType<typeof words>;
/** 3 same name, 2 one name contains the other ("Chambre" and "Chambre parentale"), 1 same kind of room, 0 unrelated. */
function score(a: Words, b: Words) {
  if (a.text === b.text) return 3;
  const [small, large] = a.tokens.size <= b.tokens.size ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
  if ([...small].every(token => large.has(token))) return 2;
  const numbers = (tokens: Set<string>) => [...tokens].filter(token => /\d/.test(token)).sort().join();
  return a.kind >= 0 && a.kind === b.kind && (!numbers(a.tokens) || !numbers(b.tokens) || numbers(a.tokens) === numbers(b.tokens)) ? 1 : 0;
}

/**
 * Home Assistant area suggested for each room without one, by name. A room is only linked when it and the area
 * are each other's only candidate: two "Chambre" facing two bedrooms stay for the user to decide.
 * Areas already linked are left out, and a plan level named like an HA floor only looks at that floor's areas.
 */
export function matchAreas(plan: SpatialPlan, areas: readonly HAArea[], floors: readonly HAFloor[] = []): Map<string, string> {
  const used = new Set(plan.floors.flatMap(f => f.rooms.map(r => r.areaId)));
  let free = areas.filter(a => !used.has(a.area_id)).map(area => ({ area, words: words(area.name) }));
  let rooms = plan.floors.flatMap(floor => {
    const level = floors.find(f => plain(f.name) === plain(floor.name) || floor.id === `floor-${f.floor_id}`);
    return floor.rooms.filter(r => !r.areaId).map(room => ({ room, words: words(room.name), level: level?.floor_id }));
  });
  const allowed = (room: (typeof rooms)[number], area: (typeof free)[number]) => !room.level || !area.area.floor_id || area.area.floor_id === room.level;
  const matches = new Map<string, string>();
  for (const level of [3, 2, 1]) {
    for (let changed = true; changed;) {
      changed = false;
      const scores = rooms.map(room => free.map(area => allowed(room, area) ? score(room.words, area.words) : 0));
      rooms.forEach((room, i) => {
        const candidates = free.flatMap((area, j) => scores[i]![j]! >= level ? [j] : []);
        if (candidates.length !== 1) return;
        const j = candidates[0]!;
        if (scores.filter(row => row[j]! >= level).length !== 1 || matches.has(room.room.id) || [...matches.values()].includes(free[j]!.area.area_id)) return;
        matches.set(room.room.id, free[j]!.area.area_id);
        changed = true;
      });
      rooms = rooms.filter(r => !matches.has(r.room.id));
      free = free.filter(a => ![...matches.values()].includes(a.area.area_id));
    }
  }
  return matches;
}
