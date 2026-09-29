import type { DxfDrawing, DxfPoint, DxfShape } from './dxf';
import { SITE_POINTS, type Point, type SiteKind, type SiteLabel, type SiteLayer, type SpatialSite } from './spatial';

/**
 * The site plan of a domain, drawn from a CAD drawing: the layers chosen (limits, driveways, buildings, pools, lawns…)
 * brought into metres from the north-west corner of the site, simplified to the points a dashboard can carry.
 */

/** Metres in a unit of $INSUNITS, the unit a drawing declares. */
const UNIT_METRES: Record<number, number> = { 1: .0254, 2: .3048, 4: .001, 5: .01, 6: 1, 7: 1000, 10: .9144, 14: .1 };
/** Units offered when the drawing's own is wrong: metres, centimetres, millimetres, feet and inches, in metres. */
export const SITE_UNITS = [1, .01, .001, .3048, .0254] as const;

/** Layers left out of the plan by default: plants and trees, survey points, measures and notes, equipment and networks. */
const NOISE = /meuble|furniture|mobilier|^dr_|\bpots?\b|plant|tree|arbre|v[ée]g[ée]t|topo|cach[ée]|m[ée]tr[ée]|mesure|\bcotes?\b|courbe|legende|annot|\btextes?\b|mod[eè]le|symbole|^\d*-?mus|hachure ma|eclairage|[ée]clairage|luminaire|light|speaker|enceinte|subwoofer|cam[ée]ra|electri|fib(er|re)|r[ée]seau|drain|regard|robinet|station|grille|draw|tbc|confirmer/i;
/** What a layer shows, told by its name; the first rule that matches wins. */
const KINDS: [RegExp, SiteKind][] = [
  [/pool ?house|b[aâ]ti|building|toit|roof|maison|house|jaume|villa|garage|abri/i, 'building'],
  [/piscine|pool|bassin|spa\b/i, 'pool'],
  [/tennis|pad(d)?el|golf|h[ée]liport|terrain|court|sport/i, 'sport'],
  [/rivi[eè]re|ruisseau|foss[ée]|river|stream|canal|\blac\b|[ée]tang|pond/i, 'water'],
  [/limite|parcelle|cadastr|boundary|cl[oô]ture|fence|portail/i, 'boundary'],
  [/all[ée]e|route|chemin|enrob|trottoir|pav(ing|ement|[ée])|pathway|parking|voirie|road|drive|terrasse|deck|dallage/i, 'path'],
  [/grass|pelouse|gazon|lawn/i, 'green'],
  [/^murs?$|\bmurs?\b|muret|wall|sout[eè]n/i, 'wall'],
];
/** The kind of a layer for its name, undefined for a layer left out of the plan by default. */
export function guessKind(name: string): SiteKind | undefined {
  if (NOISE.test(name) && !/hachure (piscine|tennis|grass|paddle)/i.test(name)) return undefined;
  return KINDS.find(([pattern]) => pattern.test(name))?.[1];
}

/** Shapes far from the others (a symbol dropped kilometres away, a stray point) left out: the site keeps its size. */
function withoutStrays(shapes: DxfShape[]): DxfShape[] {
  if (shapes.length < 8) return shapes;
  // The middle half of the shapes, along x and along y, gives the size of the domain whatever the detail of one of its
  // parts (a house drawn in detail gathers most shapes); two hundred times that size around it keeps the whole domain,
  // never a symbol left at the origin of a map projection, hundreds of kilometres away.
  const quartiles = (values: number[]) => { values.sort((a, b) => a - b); return [values[values.length >> 2]!, values[(values.length * 3) >> 2]!] as const; };
  const [x1, x3] = quartiles(shapes.map(s => s.points[0]![0])), [y1, y3] = quartiles(shapes.map(s => s.points[0]![1]));
  const reach = Math.max(x3 - x1, y3 - y1, 1e-6) * 200;
  return shapes.filter(s => s.points.every(p => p[0] >= x1 - reach && p[0] <= x3 + reach && p[1] >= y1 - reach && p[1] <= y3 + reach));
}
function bounds(points: Iterable<DxfPoint>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
}
function* allPoints(shapes: DxfShape[]) { for (const s of shapes) yield* s.points; }

/**
 * Metres in a unit of the drawing: the unit it declares when that gives a domain of a plausible size (20 m to 3 km),
 * else the first usual unit that does, else metres. Many drawings declare millimetres and are drawn in metres.
 */
export function guessScale(drawing: DxfDrawing, layers: Iterable<string>): number {
  const chosen = new Set(layers), shapes = withoutStrays(drawing.shapes.filter(s => chosen.has(s.layer)));
  if (!shapes.length) return UNIT_METRES[drawing.units] ?? 1;
  const b = bounds(allPoints(shapes)), extent = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const plausible = (k: number) => extent * k >= 20 && extent * k <= 3000;
  const declared = UNIT_METRES[drawing.units];
  if (declared && plausible(declared)) return declared;
  return SITE_UNITS.find(plausible) ?? 1;
}

/** Douglas–Peucker: the points of a line that keep it within `tolerance` of itself. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!, a = points[from]!, b = points[to]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    let worst = -1, distance = tolerance;
    for (let i = from + 1; i < to; i++) {
      const p = points[i]!;
      const d = length < 1e-12 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
      if (d > distance) { distance = d; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([from, worst], [worst, to]); }
  }
  return points.filter((_, i) => keep[i]);
}
const round = (v: number) => Math.round(v * 10) / 10;
/** A line as the plan stores it: points to a tenth of a metre, repeated points dropped, split under 4000 points. */
function flat(points: Point[]): number[][] {
  const out: number[] = [];
  for (const [x, y] of points) {
    const rx = round(x), ry = round(y), n = out.length;
    if (n && out[n - 2] === rx && out[n - 1] === ry) continue;
    out.push(rx, ry);
  }
  if (out.length < 4) return [];
  const pieces: number[][] = [];
  // Pieces overlap by one point so that the line stays whole.
  for (let start = 0; start < out.length - 2; start += 7998) pieces.push(out.slice(start, start + 8000));
  return pieces;
}

export interface SiteChoice { /** Kind of each layer drawn, by name. */ layers: Map<string, SiteKind>; /** Metres per drawing unit. */ scale: number }
export interface SiteDraft { site: SpatialSite; points: number; /** Shapes left out, far from the rest of the drawing. */ strays: number }
/** Names worth keeping on the plan even from a layer left out: houses and places. */
const PLACES = /jaume|maison|villa|house|piscine|pool|parking|tennis|pool ?house|garage/i;

/** The site plan of the layers chosen, in metres, simplified until it holds under `budget` points. */
export function buildSite(drawing: DxfDrawing, choice: SiteChoice, budget = SITE_POINTS): SiteDraft {
  const chosen = drawing.shapes.filter(s => choice.layers.has(s.layer));
  if (!chosen.length) throw new Error('Aucun calque choisi pour le plan de masse.');
  const kept = withoutStrays(chosen), b = bounds(allPoints(kept)), k = choice.scale;
  const width = (b.maxX - b.minX) * k, height = (b.maxY - b.minY) * k;
  if (width > 5000 || height > 5000) throw new Error('Plan de masse trop grand : vérifiez l’unité du dessin.');
  if (Math.max(width, height) < 1) throw new Error('Plan de masse trop petit : vérifiez l’unité du dessin.');
  const metres = ([x, y]: DxfPoint): Point => [(x - b.minX) * k, (b.maxY - y) * k];
  const shapes = kept.map(s => ({ layer: s.layer, fill: !!s.fill, points: s.points.map(metres) }));
  let tolerance = .05, lines: { layer: string; fill: boolean; data: number[][] }[] = [], points = Infinity;
  for (let round = 0; round < 16 && points > budget; round++, tolerance *= 1.6) {
    lines = [];
    points = 0;
    for (const shape of shapes) {
      const box = bounds(shape.points);
      // Details smaller than the tolerance would only be dots.
      if (Math.hypot(box.maxX - box.minX, box.maxY - box.minY) < tolerance * 2) continue;
      const data = flat(simplify(shape.points, tolerance));
      if (!data.length) continue;
      lines.push({ layer: shape.layer, fill: shape.fill, data });
      for (const piece of data) points += piece.length / 2;
    }
  }
  if (points > budget) throw new Error('Plan de masse trop détaillé.');
  const layers: SiteLayer[] = [];
  for (const [name, kind] of choice.layers) {
    const own = lines.filter(l => l.layer === name), paths = own.filter(l => !l.fill).flatMap(l => l.data), fills = own.filter(l => l.fill).flatMap(l => l.data);
    if (paths.length || fills.length) layers.push({ name: name.slice(0, 120) || '0', kind, ...(paths.length ? { paths } : {}), ...(fills.length ? { fills } : {}) });
  }
  if (layers.length > 64) throw new Error('Trop de calques pour le plan de masse : 64 au plus.');
  const size: Point = [round(width), round(height)];
  const labels: SiteLabel[] = [];
  for (const t of drawing.texts) {
    const text = t.text.trim().slice(0, 80), at = metres(t.at);
    if (!text || /^[\d\s.,%+-]+$/.test(text) || !(choice.layers.has(t.layer) || (PLACES.test(text) && text.length <= 32))) continue;
    if (at[0] < 0 || at[1] < 0 || at[0] > width || at[1] > height || labels.length >= 300) continue;
    labels.push({ text, at: [round(at[0]), round(at[1])] });
  }
  return { site: { width: Math.max(size[0], .1), height: Math.max(size[1], .1), layers, ...(labels.length ? { labels } : {}) }, points, strays: chosen.length - kept.length };
}

/** Points of a flat line x0, y0, x1, y1… */
export function linePoints(data: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) points.push([data[i]!, data[i + 1]!]);
  return points;
}
function inside(ring: Point[], [x, y]: Point): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if ((yi > y) !== (yj > y) && x < xi + (y - yi) * (xj - xi) / (yj - yi)) hit = !hit;
  }
  return hit;
}
const ringArea = (ring: Point[]) => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/**
 * The outline of the building drawn under `at`: the largest closed shape of a building layer around that point (its outer
 * walls rather than one of its rooms), under 400 corners. Undefined when no building outline surrounds it (a house drawn
 * as loose lines).
 */
export function outlineAt(site: SpatialSite, at: Point): Point[] | undefined {
  let best: Point[] | undefined, area = 0;
  for (const layer of site.layers) {
    if (layer.kind !== 'building') continue;
    for (const data of [...layer.fills ?? [], ...layer.paths ?? []]) {
      let ring = linePoints(data);
      const first = ring[0]!, last = ring.at(-1)!;
      if (ring.length < 4 || Math.hypot(first[0] - last[0], first[1] - last[1]) > .15) continue;
      ring = ring.slice(0, -1);
      const size = ringArea(ring);
      if (size > area && size <= 5000 && inside(ring, at)) { best = ring; area = size; }
    }
  }
  if (!best) return undefined;
  let outline = best;
  for (let tolerance = .05; outline.length > 400; tolerance *= 1.6) outline = simplify([...best, best[0]!], tolerance).slice(0, -1);
  return outline.map(([x, y]) => [round(x), round(y)]);
}
