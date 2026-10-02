import { describe, expect, it } from 'vitest';
import { decodeDxf, parseDxf, plainText } from '../shared/dxf';
import { buildSite, equipmentActive, equipmentCommand, guessKind, guessScale, houseFrame, linePoints, outlineAt } from '../shared/site';
import { estate, estateStates } from '../demo/estate';
import { examplePlan, parseSpatial, SITE_POINTS, type SpatialSite } from '../shared/spatial';

/** A DXF file from its group codes and values, written as CAD programs write them: one per line. */
const dxf = (...pairs: (string | number)[]) => pairs.map(String).join('\n');
const section = (name: string, ...pairs: (string | number)[]) => [0, 'SECTION', 2, name, ...pairs, 0, 'ENDSEC'];
const square = (layer: string, x: number, y: number, size: number, extra: (string | number)[] = []) =>
  [0, 'LWPOLYLINE', 8, layer, 90, 4, 70, 1, 10, x, 20, y, 10, x + size, 20, y, 10, x + size, 20, y + size, 10, x, 20, y + size, ...extra];

describe('DXF drawings', () => {
  const text = dxf(
    ...section('HEADER', 9, '$ACADVER', 1, 'AC1032', 9, '$INSUNITS', 70, 4),
    ...section('TABLES', 0, 'TABLE', 2, 'LAYER', 0, 'LAYER', 2, 'Bâti', 70, 0, 62, 7, 0, 'LAYER', 2, 'Caché', 70, 1, 62, 7, 0, 'ENDTAB'),
    ...section('ENTITIES',
      0, 'LINE', 8, 'Allées', 10, 0, 20, 0, 11, 10, 21, 0,
      // A closed polyline whose second side bulges into a half circle.
      0, 'LWPOLYLINE', 8, 'Bâti', 90, 2, 70, 1, 10, 0, 20, 0, 42, 1, 10, 4, 20, 0,
      0, 'CIRCLE', 8, 'Bassin', 10, 5, 20, 5, 40, 1,
      0, 'ARC', 8, 'Bassin', 10, 0, 20, 0, 40, 2, 50, 0, 51, 90,
      0, 'POLYLINE', 8, 'Limite', 66, 1, 70, 1, 0, 'VERTEX', 8, 'Limite', 10, 0, 20, 0, 0, 'VERTEX', 8, 'Limite', 10, 3, 20, 0, 0, 'VERTEX', 8, 'Limite', 10, 3, 20, 3, 0, 'SEQEND',
      0, 'HATCH', 8, 'Piscine', 10, 0, 20, 0, 30, 0, 2, 'SOLID', 70, 1, 71, 0, 91, 2,
      92, 2, 72, 0, 73, 1, 93, 3, 10, 0, 20, 0, 10, 2, 20, 0, 10, 2, 20, 2, 97, 0,
      92, 1, 93, 2, 72, 1, 10, 0, 20, 0, 11, 1, 21, 1, 72, 1, 10, 1, 20, 1, 11, 0, 21, 1, 97, 0,
      75, 0, 76, 1, 98, 1, 10, 1, 20, 1,
      0, 'SPLINE', 8, 'Allées', 70, 0, 71, 1, 72, 4, 73, 2, 40, 0, 40, 0, 40, 1, 40, 1, 10, 0, 20, 0, 10, 6, 20, 8,
      0, 'TEXT', 8, 'Texte', 10, 1, 20, 2, 1, 'SAINT-JAUME 1',
      0, 'MTEXT', 8, 'Texte', 10, 3, 20, 4, 3, '{\\fArial|b1;Pool}\\P', 1, 'house',
      // Drawn in a layout, not in the model: left out.
      0, 'LINE', 8, 'Cartouche', 67, 1, 10, 0, 20, 0, 11, 1, 21, 1,
      // Drawn from below: its x is mirrored.
      0, 'CIRCLE', 8, 'Bassin', 10, 5, 20, 0, 40, 1, 210, 0, 220, 0, 230, -1),
    0, 'EOF');
  const drawing = parseDxf(text);

  it('reads the unit, the layers and every kind of line of the model space', () => {
    expect(drawing.units).toBe(4);
    expect(drawing.layers.find(l => l.name === 'Bâti')).toEqual({ name: 'Bâti', hidden: false, count: 1 });
    expect(drawing.layers.some(l => l.name === 'Caché' || l.name === 'Cartouche')).toBe(false);
    const on = (layer: string) => drawing.shapes.filter(s => s.layer === layer);
    expect(on('Allées')[0]!.points).toEqual([[0, 0], [10, 0]]);
    // The bulge of 1 turns the way back from (4, 0) to (0, 0) into a half circle of radius 2 below the x axis.
    const bulged = on('Bâti')[0]!;
    expect(bulged.closed).toBe(true);
    expect(Math.min(...bulged.points.map(p => p[1]))).toBeCloseTo(-2, 5);
    expect(on('Bassin')).toHaveLength(3);
    expect(on('Bassin')[2]!.points.every(p => p[0] <= -4 + 1e-9)).toBe(true);
    const quarter = on('Bassin')[1]!.points;
    expect(quarter[0]![0]).toBeCloseTo(2); expect(quarter.at(-1)![1]).toBeCloseTo(2);
    expect(on('Limite')[0]!.points).toEqual([[0, 0], [3, 0], [3, 3], [0, 0]]);
    const hatch = on('Piscine');
    expect(hatch.map(s => s.fill)).toEqual([true, true]);
    expect(hatch[0]!.points).toEqual([[0, 0], [2, 0], [2, 2], [0, 0]]);
    expect(hatch[1]!.points).toEqual([[0, 0], [1, 1], [1, 1], [0, 1]]);
    // A spline of degree 1 is the straight line between its two control points.
    const curve = on('Allées')[1]!.points;
    expect(curve[0]).toEqual([0, 0]); expect(curve.at(-1)![0]).toBeCloseTo(6); expect(curve.at(-1)![1]).toBeCloseTo(8);
    expect(drawing.texts).toEqual([{ layer: 'Texte', text: 'SAINT-JAUME 1', at: [1, 2] }, { layer: 'Texte', text: 'Pool house', at: [3, 4] }]);
  });
  it('reads recent drawings as UTF-8, older ones in their code page, and refuses binary DXF', () => {
    const encode = (value: string) => new TextEncoder().encode(value).buffer as ArrayBuffer;
    expect(decodeDxf(encode(dxf(...section('HEADER', 9, '$ACADVER', 1, 'AC1032'), 0, 'Bâti')))).toContain('Bâti');
    const latin = new Uint8Array([...new TextEncoder().encode('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nB'), 0xe2]).buffer;
    expect(decodeDxf(latin).endsWith('Bâ')).toBe(true);
    expect(() => decodeDxf(encode('AutoCAD Binary DXF\r\n\x1a\0'))).toThrow('DXF binaire');
    expect(() => parseDxf('not a drawing\nat all')).toThrow('DXF illisible');
    expect(plainText('\\A1;\\H2.5x;Terrasse\\PRDC %%c30 \\U+00E9')).toBe('Terrasse RDC ø30 é');
  });
});

describe('site plan of a domain', () => {
  it('tells the layers of a site plan from plants, measures and equipment', () => {
    expect(['batiment', 'SC - PoolHouse', 'ST JAUME 5', 'Hachure Piscines', 'Tennis Court', 'Rivière', 'LIMITE', 'ALLEES', 'Hachure Grass', 'Murs'].map(guessKind))
      .toEqual(['building', 'building', 'building', 'pool', 'sport', 'water', 'boundary', 'path', 'green', 'wall']);
    for (const name of ['DR_PLANT_Rosa', 'TREE - Olivier', 'TOPOJIS', 'Caché', 'ECLAIRAGE', 'MP_LIGHTINGS_type1', 'ICM - Ext Speakers', 'Cameras', 'Reseaux Eaux', 'SJ2 - Meuble Terrasse', 'MESURE 4', 'COURBES'])
      expect(guessKind(name), name).toBeUndefined();
  });
  // Two buildings and a boundary, in metres far from the origin as a projected map gives them, and a stray symbol.
  const text = dxf(...section('HEADER', 9, '$INSUNITS', 70, 4), ...section('ENTITIES',
    ...square('batiment', 1000, 5000, 20), ...square('batiment', 1005, 5005, 5), ...square('batiment', 1100, 5100, 10),
    0, 'LWPOLYLINE', 8, 'LIMITE', 90, 3, 70, 0, 10, 990, 20, 4990, 10, 1150, 20, 4990, 10, 1150, 20, 5150,
    0, 'CIRCLE', 8, 'Hachure Piscines', 10, 1050, 20, 5050, 40, 4, 0, 'CIRCLE', 8, 'Hachure Piscines', 10, 1060, 20, 5050, 40, 4,
    0, 'CIRCLE', 8, 'Hachure Piscines', 10, 1070, 20, 5050, 40, 4, 0, 'CIRCLE', 8, 'Hachure Piscines', 10, 1080, 20, 5050, 40, 4,
    0, 'CIRCLE', 8, 'Hachure Piscines', 10, 900000, 20, 5050, 40, 1,
    0, 'TEXT', 8, 'Texte', 10, 1010, 20, 5010, 1, 'SAINT-JAUME 1', 0, 'TEXT', 8, 'Texte', 10, 1011, 20, 5011, 1, '25.40',
    0, 'TEXT', 8, 'Texte', 10, 1012, 20, 5012, 1, 'Proposed planting to enclose the guest house garden with rosemary'), 0, 'EOF');
  const drawing = parseDxf(text), layers = new Map([['batiment', 'building'], ['LIMITE', 'boundary'], ['Hachure Piscines', 'pool']] as const);
  const { site, strays, points } = buildSite(drawing, { layers: new Map(layers), scale: guessScale(drawing, layers.keys()) });

  it('draws the chosen layers in metres from the north-west corner, north up, strays left out', () => {
    // Declared in millimetres, drawn in metres: 160 m wide is a plausible domain, 0.16 m is not.
    expect(guessScale(drawing, layers.keys())).toBe(1);
    expect(strays).toBe(1);
    expect([site.width, site.height]).toEqual([160, 160]);
    expect(site.layers.map(l => [l.name, l.kind])).toEqual([['batiment', 'building'], ['LIMITE', 'boundary'], ['Hachure Piscines', 'pool']]);
    // y grows towards the south: the corner at the northern edge of the limit (y 5150) is at 0.
    expect(linePoints(site.layers[1]!.paths![0]!)).toEqual([[0, 160], [160, 160], [160, 0]]);
    expect(site.labels).toEqual([{ text: 'SAINT-JAUME 1', at: [20, 140] }]);
    expect(points).toBeLessThanOrEqual(SITE_POINTS);
    expect(parseSpatial({ ...examplePlan(), site }).site).toEqual(site);
  });
  it('simplifies the plan until it fits, and refuses a unit that makes it absurd', () => {
    const small = buildSite(drawing, { layers: new Map(layers), scale: 1 }, 40);
    expect(small.points).toBeLessThanOrEqual(40);
    expect(() => buildSite(drawing, { layers: new Map(layers), scale: 1000 })).toThrow('trop grand');
    expect(() => buildSite(drawing, { layers: new Map(), scale: 1 })).toThrow('Aucun calque');
  });
  it('finds the outer walls of the building under a point, not one of its rooms', () => {
    const inner = outlineAt(site, [25, 145])!;
    expect(inner).toHaveLength(4);
    expect(Math.max(...inner.map(p => p[0])) - Math.min(...inner.map(p => p[0]))).toBe(20);
    expect(outlineAt(site, [80, 80])).toBeUndefined();
  });
  it('refuses a site plan with more points than a dashboard can carry', () => {
    const heavy: SpatialSite = { width: 100, height: 100, layers: Array.from({ length: 6 }, (_, i) => ({ name: `l${i}`, kind: 'other' as const, paths: [Array.from({ length: 8000 }, (_, k) => k % 100)] })) };
    expect(() => parseSpatial({ ...examplePlan(), site: { ...heavy, layers: heavy.layers.slice(0, 5) } })).not.toThrow();
    expect(() => parseSpatial({ ...examplePlan(), site: { ...heavy, layers: [...heavy.layers, ...heavy.layers.map(l => ({ ...l, name: `${l.name}b` }))] } })).toThrow('trop détaillé');
    expect(() => parseSpatial({ ...examplePlan(), site: { width: 10, height: 10, layers: [{ name: 'odd', kind: 'path', paths: [[1, 2, 3, 4, 5]] }] } })).toThrow();
  });
});

describe('equipment of the grounds of a domain', () => {
  const site = (equipment: SpatialSite['equipment']): SpatialSite => ({ width: 100, height: 80, layers: [], equipment });
  const plan = (equipment: SpatialSite['equipment']) => ({ ...examplePlan(), site: site(equipment), buildings: [{ id: 'main', name: 'Maison' }] });
  it('keeps lights, sprinklers, gates and cameras placed on the site plan, each in a garden the domain has', () => {
    const lamp = { id: 'lamp', kind: 'light' as const, at: [10, 12] as [number, number], entityId: 'light.borne', buildingId: 'main' };
    expect(parseSpatial(plan([lamp, { id: 'lawn', kind: 'irrigation', at: [40, 40], entityId: 'valve.pelouse', radius: 8 }])).site?.equipment).toHaveLength(2);
    expect(() => parseSpatial(plan([lamp, { ...lamp }]))).toThrow('Équipement du domaine invalide.');
    expect(() => parseSpatial(plan([{ ...lamp, buildingId: 'guest' }]))).toThrow('Équipement du domaine invalide.');
    expect(() => parseSpatial(plan([{ ...lamp, radius: 0 }]))).toThrow();
  });
  it('turns each kind of equipment on and off with the service of its domain, never a camera', () => {
    const on = { state: 'on' }, closed = { state: 'closed' };
    expect(equipmentActive({ kind: 'light' }, on)).toBe(true);
    expect(equipmentActive({ kind: 'irrigation' }, { state: 'open' })).toBe(true);
    expect(equipmentActive({ kind: 'gate' }, closed)).toBe(false);
    expect(equipmentActive({ kind: 'camera' }, { state: 'streaming' })).toBe(false);
    expect(equipmentCommand({ kind: 'light', entityId: 'light.borne' }, on, false)).toEqual({ domain: 'light', service: 'turn_off' });
    expect(equipmentCommand({ kind: 'irrigation', entityId: 'valve.pelouse' }, closed, true)).toEqual({ domain: 'valve', service: 'open_valve' });
    expect(equipmentCommand({ kind: 'irrigation', entityId: 'switch.arrosage' }, { state: 'off' }, true)).toEqual({ domain: 'switch', service: 'turn_on' });
    expect(equipmentCommand({ kind: 'gate', entityId: 'cover.portail' }, { state: 'open' }, false)).toEqual({ domain: 'cover', service: 'close_cover' });
    expect(equipmentCommand({ kind: 'gate', entityId: 'lock.portail' }, { state: 'locked' }, true)).toEqual({ domain: 'lock', service: 'unlock' });
    expect(equipmentCommand({ kind: 'camera', entityId: 'camera.cour' }, { state: 'idle' }, true)).toBeUndefined();
    expect(equipmentCommand({ kind: 'light', entityId: 'cover.portail' }, closed, true)).toBeUndefined();
    expect(equipmentCommand({ kind: 'light', entityId: 'light.borne' }, { state: 'unavailable' }, true)).toBeUndefined();
  });
  it('frames a house with its garden around it, from its walls or from its spot alone', () => {
    expect(houseFrame({ at: [50, 50], outline: [[40, 40], [60, 40], [60, 55], [40, 55]] }, 10)).toEqual([30, 30, 40, 35]);
    expect(houseFrame({ at: [50, 50] }, 20)).toEqual([30, 30, 40, 40]);
  });
  it('tells woods, orchards and vineyards from lawns', () => {
    expect(['Bois', 'Oliveraie', 'Vignes', 'Forêt', 'Pelouse'].map(guessKind)).toEqual(['wood', 'wood', 'wood', 'wood', 'green']);
  });
  it('gives the demo a valid domain of six houses with the equipment of its grounds', () => {
    const domain = estate(examplePlan().floors), parsed = parseSpatial({ ...examplePlan(), ...domain });
    expect(parsed.buildings?.map(b => b.id)).toEqual(['bastide', 'bois', 'clos', 'pavillon-1', 'pavillon-2', 'pavillon-3']);
    expect(parsed.buildings?.every(b => b.site?.outline)).toBe(true);
    const kinds = new Set(parsed.site?.equipment?.map(e => e.kind));
    expect([...kinds].sort()).toEqual(['camera', 'gate', 'irrigation', 'light']);
    const states = estateStates(parsed.site!);
    expect(parsed.site!.equipment!.every(e => !e.entityId || states[e.entityId])).toBe(true);
  });
});
