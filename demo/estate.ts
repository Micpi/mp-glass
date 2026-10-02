import type { HAState } from '../shared/models';
import type { Point, SiteEquipment, SiteKind, SiteLayer, SpatialBuilding, SpatialFloor, SpatialSite } from '../shared/spatial';

/**
 * A domain of several houses for the demo (?site): its layout follows the site plan of a real estate, read by eye (a bastide
 * and its formal gardens, a house in the woods, three pavilions by a tennis court, a house in its own walled garden, a stream
 * across), with made-up names and entities. Drawn in pixels of that plan, 0.19 m each, from its north-west corner.
 */
const M = .19;
const at = (x: number, y: number): Point => [Math.round(x * M * 100) / 100, Math.round(y * M * 100) / 100];
const ring = (...points: [number, number][]) => points.map(([x, y]) => at(x, y));
const rect = (x0: number, y0: number, x1: number, y1: number) => ring([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
const flatList = (points: Point[]) => points.flat();
/** A band `width` pixels wide along `line`: a stream, a driveway. */
function band(width: number, ...line: [number, number][]): Point[] {
  const side = (sign: number) => line.map(([x, y], i) => {
    const [px, py] = line[Math.max(0, i - 1)]!, [nx, ny] = line[Math.min(line.length - 1, i + 1)]!;
    const dx = nx - px, dy = ny - py, length = Math.hypot(dx, dy) || 1;
    return at(x - dy / length * width / 2 * sign, y + dx / length * width / 2 * sign);
  });
  return [...side(1), ...side(-1).reverse()];
}
const centre = (points: Point[]): Point => [Math.round(points.reduce((s, p) => s + p[0], 0) / points.length * 10) / 10, Math.round(points.reduce((s, p) => s + p[1], 0) / points.length * 10) / 10];
const room = (id: string, name: string, x: number, z: number, w: number, d: number, entityIds?: string[]) => ({ id, name, polygon: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]] as Point[], ...(entityIds ? { entityIds } : {}) });
const storey = (house: string, rooms: ReturnType<typeof room>[], id = 'ground', name = 'Rez-de-chaussée', elevation = 0): SpatialFloor => ({ id: `${house}-${id}`, name, elevation, height: 2.6, buildingId: house, rooms });

/** Houses, their walls on the site plan. */
const HOUSES: { id: string; name: string; outline: Point[] }[] = [
  { id: 'bastide', name: 'Bastide', outline: ring([712, 503], [778, 522], [770, 582], [748, 590], [746, 640], [694, 642]) },
  { id: 'bois', name: 'Maison du bois', outline: ring([305, 700], [345, 700], [345, 780], [390, 785], [388, 855], [358, 855], [357, 805], [303, 800]) },
  { id: 'clos', name: 'Maison du Clos', outline: ring([1552, 628], [1582, 616], [1644, 712], [1612, 728]) },
  { id: 'pavillon-1', name: 'Pavillon 1', outline: ring([1270, 1125], [1350, 1110], [1362, 1195], [1282, 1210]) },
  { id: 'pavillon-2', name: 'Pavillon 2', outline: ring([1400, 930], [1460, 915], [1515, 1075], [1455, 1095]) },
  { id: 'pavillon-3', name: 'Pavillon 3', outline: ring([1590, 945], [1635, 940], [1655, 1055], [1610, 1060]) },
];
/** Layers of the drawing, by what they show. */
const LAYERS: [string, SiteKind, Point[][], Point[][]?][] = [
  ['Bois', 'wood', [
    ring([20, 400], [260, 370], [290, 690], [250, 860], [90, 870]),
    ring([110, 965], [600, 995], [1000, 990], [1240, 1090], [1250, 1250], [170, 1260]),
    ring([440, 400], [600, 390], [560, 900], [440, 900]),
  ]],
  ['Vigne', 'green', [ring([850, 410], [990, 420], [1090, 540], [1085, 640], [935, 650], [850, 600])]],
  ['Pelouses', 'green', [
    rect(565, 515, 690, 755), ring([948, 730], [1060, 690], [1072, 740], [965, 775]),
    ring([1610, 505], [1720, 490], [1800, 500], [1840, 580], [1820, 690], [1740, 740], [1690, 700], [1700, 600], [1640, 560]),
    ring([1380, 1110], [1480, 1110], [1500, 1180], [1400, 1200]), ring([1598, 1175], [1650, 1160], [1682, 1260], [1628, 1275]),
  ]],
  ['Ruisseau', 'water', [band(12, [90, 882], [245, 875], [320, 915], [440, 950], [590, 962], [640, 900], [830, 870], [1000, 830], [1130, 790], [1210, 745], [1280, 700], [1360, 588]), rect(655, 540, 682, 612)]],
  ['Piscines', 'pool', [ring([690, 760], [780, 758], [778, 815], [692, 817]), ring([1505, 965], [1545, 960], [1555, 1030], [1515, 1035])]],
  ['Allées', 'path', [
    band(22, [925, 210], [912, 290], [850, 345], [805, 400], [760, 425], [700, 430]),
    band(24, [600, 985], [900, 905], [1150, 830], [1400, 770], [1590, 848]), rect(1495, 860, 1545, 892),
  ]],
  ['Tennis', 'sport', [ring([1630, 1090], [1705, 1065], [1765, 1225], [1690, 1250])]],
  ['Bâtiments annexes', 'building', [rect(598, 447, 683, 500), rect(798, 758, 840, 818), rect(1525, 585, 1545, 605), ring([1575, 760], [1600, 748], [1612, 772], [1587, 784])]],
  ['Murs du Clos', 'wall', [], [ring([1400, 470], [1930, 470], [1930, 830], [1400, 830], [1400, 470])]],
  ['Limite de propriété', 'boundary', [], [ring([10, 200], [1960, 200], [1960, 1300], [10, 1300], [10, 200])]],
];
const light = (id: string, name: string, x: number, y: number, buildingId?: string): SiteEquipment => ({ id, kind: 'light', name, at: at(x, y), entityId: `light.${id.replace(/-/g, '_')}`, ...(buildingId ? { buildingId } : {}) });
const sprinkler = (id: string, name: string, x: number, y: number, radius: number, buildingId?: string): SiteEquipment => ({ id, kind: 'irrigation', name, at: at(x, y), radius, entityId: `valve.${id.replace(/-/g, '_')}`, ...(buildingId ? { buildingId } : {}) });
const EQUIPMENT: SiteEquipment[] = [
  { id: 'portail-nord', kind: 'gate', name: 'Portail nord', at: at(925, 215), entityId: 'cover.portail_nord' },
  { id: 'portail-est', kind: 'gate', name: 'Portail est', at: at(1590, 852), entityId: 'cover.portail_est' },
  { id: 'camera-nord', kind: 'camera', name: 'Caméra portail nord', at: at(950, 232), entityId: 'camera.portail_nord' },
  { id: 'camera-est', kind: 'camera', name: 'Caméra portail est', at: at(1572, 830), entityId: 'camera.portail_est' },
  { id: 'camera-cour', kind: 'camera', name: 'Caméra cour', at: at(700, 445), buildingId: 'bastide', entityId: 'camera.cour' },
  ...([[935, 270], [900, 305], [860, 335], [830, 370], [800, 405], [760, 420]] as [number, number][]).map(([x, y], i) => light(`borne-nord-${i + 1}`, `Borne de l’allée ${i + 1}`, x, y)),
  ...([[760, 925], [1000, 860], [1250, 800], [1480, 790]] as [number, number][]).map(([x, y], i) => light(`borne-sud-${i + 1}`, `Borne de l’allée du bas ${i + 1}`, x, y)),
  light('cour-bastide', 'Cour', 700, 500, 'bastide'), light('terrasse-bastide', 'Terrasse', 790, 600, 'bastide'), light('pool-house', 'Pool house', 820, 750, 'bastide'),
  light('entree-bois', 'Entrée', 330, 690, 'bois'), light('entree-clos', 'Entrée', 1600, 745, 'clos'), light('allee-clos', 'Allée du jardin', 1680, 720, 'clos'),
  light('entree-pavillon-1', 'Entrée', 1300, 1105, 'pavillon-1'), light('entree-pavillon-2', 'Entrée', 1420, 905, 'pavillon-2'), light('entree-pavillon-3', 'Entrée', 1600, 935, 'pavillon-3'),
  light('tennis', 'Tennis', 1700, 1160, 'pavillon-3'),
  sprinkler('jardins-nord', 'Jardins à la française nord', 600, 560, 6, 'bastide'), sprinkler('jardins-sud', 'Jardins à la française sud', 625, 700, 7, 'bastide'),
  sprinkler('grande-pelouse', 'Grande pelouse', 1010, 730, 9, 'bastide'), sprinkler('jardin-clos', 'Jardin du Clos', 1760, 600, 11, 'clos'),
  sprinkler('pelouse-pavillons', 'Pelouse des pavillons', 1440, 1155, 8, 'pavillon-1'), sprinkler('pelouse-tennis', 'Pelouse du tennis', 1640, 1215, 5, 'pavillon-3'),
];

/** The domain of the demo: its houses with their floors, and its site plan. */
export function estate(bastide: SpatialFloor[]): { site: SpatialSite; buildings: SpatialBuilding[]; floors: SpatialFloor[] } {
  const layers: SiteLayer[] = LAYERS.map(([name, kind, fills, paths]) => ({ name, kind, ...(fills.length ? { fills: fills.map(flatList) } : {}), ...(paths ? { paths: paths.map(flatList) } : {}) }));
  const site: SpatialSite = { width: 375, height: 250, layers, labels: [{ text: 'Ruisseau', at: at(240, 890) }, { text: 'Vigne', at: at(970, 540) }, { text: 'Chênaie', at: at(700, 1150) }], equipment: EQUIPMENT };
  const buildings: SpatialBuilding[] = HOUSES.map(h => ({ id: h.id, name: h.name, site: { at: centre(h.outline), outline: h.outline } }));
  const floors: SpatialFloor[] = [
    ...bastide.map(f => ({ ...f, buildingId: 'bastide' })),
    storey('bastide', [room('suite', 'Suite parentale', 0, 0, 6, 4), room('chambre-2', 'Chambre bleue', 6, 0, 4, 4), room('chambre-3', 'Chambre verte', 9, 0, 4, 4), room('palier', 'Palier', 0, 4, 13, 4)], 'etage', 'Étage', 2.6),
    storey('bois', [room('sejour', 'Séjour', 0, 0, 7, 8, ['light.bois_sejour']), room('chambre', 'Chambre', 7, 0, 5, 8)]),
    storey('clos', [room('sejour', 'Séjour', 0, 0, 8, 6, ['light.clos_sejour']), room('chambre', 'Chambre', 8, 0, 5, 6)]),
    storey('clos', [room('chambres', 'Chambres', 0, 0, 13, 6)], 'etage', 'Étage', 2.6),
    storey('pavillon-1', [room('sejour', 'Pièce de vie', 0, 0, 9, 8, ['light.pavillon_1_sejour']), room('chambre', 'Chambre', 9, 0, 6, 8)]),
    storey('pavillon-2', [room('sejour', 'Séjour', 0, 0, 10, 8, ['light.pavillon_2_sejour']), room('chambre', 'Chambre', 10, 0, 6, 8), room('cuisine', 'Cuisine', 0, 8, 10, 6)]),
    storey('pavillon-3', [room('sejour', 'Séjour', 0, 0, 8, 7, ['light.pavillon_3_sejour']), room('chambre', 'Chambre', 8, 0, 5, 7)]),
  ];
  return { site, buildings, floors };
}
/** States of the equipment of the domain and of the lights of its houses: most lights on, some zones watering, gates shut. */
export function estateStates(site: SpatialSite): Record<string, HAState> {
  const states: Record<string, HAState> = {};
  (site.equipment ?? []).forEach((item, i) => {
    if (!item.entityId) return;
    const state = item.kind === 'light' ? (i % 3 === 1 ? 'off' : 'on') : item.kind === 'irrigation' ? (i % 2 ? 'open' : 'closed') : item.kind === 'gate' ? 'closed' : 'idle';
    states[item.entityId] = { entity_id: item.entityId, state, attributes: { friendly_name: item.name ?? item.entityId, ...(item.kind === 'gate' ? { current_position: 0, device_class: 'gate' } : {}) } };
  });
  for (const id of ['bois_sejour', 'clos_sejour', 'pavillon_1_sejour', 'pavillon_2_sejour', 'pavillon_3_sejour']) states[`light.${id}`] = { entity_id: `light.${id}`, state: id.startsWith('pavillon_1') ? 'off' : 'on', attributes: { friendly_name: id.replace(/_/g, ' ') } };
  return states;
}
