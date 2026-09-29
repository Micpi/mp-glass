/**
 * A plain reader of DXF drawings (the text format AutoCAD, BricsCAD and most CAD programs save), enough for a site plan:
 * the layers, and the lines, curves, hatches and texts of the model space, in drawing units. Block insertions (symbols of
 * equipment, trees…) are counted per layer but not drawn: they are the material of a later import, not of the plan.
 */
export type DxfPoint = [number, number];
/** A line of the drawing as points; `fill`: the outline of a hatch, drawn filled. */
export interface DxfShape { layer: string; points: DxfPoint[]; closed: boolean; fill?: boolean }
export interface DxfText { layer: string; text: string; at: DxfPoint }
/** A layer, turned off or frozen in the drawing when `hidden`; `count`: its entities in the model space, blocks included. */
export interface DxfLayer { name: string; hidden: boolean; count: number }
/** `units`: the unit the drawing declares ($INSUNITS), 0 when it declares none. */
export interface DxfDrawing { units: number; layers: DxfLayer[]; shapes: DxfShape[]; texts: DxfText[] }

/** Pieces of a full circle: curves look smooth on a site plan without weighing on it. */
const CIRCLE_STEPS = 48;
const TAU = Math.PI * 2;

/**
 * The text of a DXF file. Since AutoCAD 2007 (AC1021) DXF files are UTF-8; older ones use the drawing's code page, most
 * often Windows-1252 in western Europe. A binary DXF is refused: it would read as noise.
 */
export function decodeDxf(buffer: ArrayBuffer): string {
  const head = new TextDecoder('latin1').decode(buffer.slice(0, 22));
  if (head.startsWith('AutoCAD Binary DXF')) throw new Error('DXF binaire non pris en charge : enregistrez le dessin en DXF texte (ASCII).');
  const probe = new TextDecoder('latin1').decode(buffer.slice(0, 65536));
  const version = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d{4})/.exec(probe)?.[1];
  return new TextDecoder(version && Number(version) >= 1021 ? 'utf-8' : 'windows-1252').decode(buffer);
}

/** Points of an arc around (cx, cy), counter-clockwise from `start` to `end` (radians); both ends included. */
function arc(cx: number, cy: number, r: number, start: number, end: number): DxfPoint[] {
  let sweep = end - start;
  while (sweep <= 1e-9) sweep += TAU;
  const steps = Math.max(2, Math.ceil(sweep / TAU * CIRCLE_STEPS));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const a = start + sweep * k / steps;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
/** Points strictly between `p` and `q` along a polyline segment bent by `bulge` (tan of a quarter of its sweep, counter-clockwise when positive). */
function bulgePoints(p: DxfPoint, q: DxfPoint, bulge: number): DxfPoint[] {
  const chord = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (Math.abs(bulge) < 1e-6 || chord < 1e-9) return [];
  const sweep = 4 * Math.atan(bulge), radius = chord / (2 * Math.sin(sweep / 2)), toward = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2 - sweep / 2;
  const cx = p[0] + radius * Math.cos(toward), cy = p[1] + radius * Math.sin(toward), start = Math.atan2(p[1] - cy, p[0] - cx);
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / TAU * CIRCLE_STEPS)), r = Math.abs(radius);
  return Array.from({ length: steps - 1 }, (_, k) => {
    const a = start + sweep * (k + 1) / steps;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
/** A polyline through `points`, each segment bent by the bulge of its first point, closed back to the first point when `closed`. */
function bulged(points: DxfPoint[], bulges: number[], closed: boolean): DxfPoint[] {
  const out: DxfPoint[] = [];
  const last = closed ? points.length : points.length - 1;
  points.forEach((p, i) => {
    out.push(p);
    if (i < last) out.push(...bulgePoints(p, points[(i + 1) % points.length]!, bulges[i] ?? 0));
  });
  if (closed && points.length) out.push(points[0]!);
  return out;
}
/** A B-spline (rational when `weights` are given) sampled with de Boor's algorithm; its control points when its knots do not fit. */
function spline(degree: number, knots: number[], control: DxfPoint[], weights: number[], closed: boolean): DxfPoint[] {
  const n = control.length;
  if (n < 2 || degree < 1 || knots.length !== n + degree + 1) return closed && n ? [...control, control[0]!] : control;
  const w = (i: number) => weights.length === n ? weights[i]! : 1;
  const t0 = knots[degree]!, t1 = knots[n]!, samples = Math.min(400, Math.max(12, n * 8));
  const out: DxfPoint[] = [];
  for (let s = 0; s <= samples; s++) {
    const t = Math.min(t0 + (t1 - t0) * s / samples, t1 - 1e-12 * Math.max(1, Math.abs(t1)));
    let k = degree;
    while (k < n - 1 && knots[k + 1]! <= t) k++;
    const d = Array.from({ length: degree + 1 }, (_, j) => { const c = control[k - degree + j]!, wj = w(k - degree + j); return [c[0] * wj, c[1] * wj, wj]; });
    for (let r = 1; r <= degree; r++) for (let j = degree; j >= r; j--) {
      const i = k - degree + j, span = knots[i + degree - r + 1]! - knots[i]!, a = span ? (t - knots[i]!) / span : 0;
      d[j] = [0, 1, 2].map(m => (1 - a) * d[j - 1]![m]! + a * d[j]![m]!);
    }
    const [x, y, h] = d[degree]!;
    if (h) out.push([x! / h, y! / h]);
  }
  return out;
}
/** Points of an ellipse around `c` with major axis `major` (from the centre), from `start` to `end` in parameter (radians). */
function ellipse(c: DxfPoint, major: DxfPoint, ratio: number, start: number, end: number): DxfPoint[] {
  let sweep = end - start;
  while (sweep <= 1e-9) sweep += TAU;
  const steps = Math.max(4, Math.ceil(sweep / TAU * CIRCLE_STEPS)), minor: DxfPoint = [-major[1] * ratio, major[0] * ratio];
  return Array.from({ length: steps + 1 }, (_, k) => {
    const a = start + sweep * k / steps, cos = Math.cos(a), sin = Math.sin(a);
    return [c[0] + major[0] * cos + minor[0] * sin, c[1] + major[1] * cos + minor[1] * sin];
  });
}
/** MTEXT without its formatting: paragraphs as spaces, fonts, heights and colours dropped, braces removed. */
export function plainText(value: string): string {
  return value
    .replace(/\\U\+([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\[Pp]/g, ' ').replace(/\\~/g, ' ')
    .replace(/\\[ACFHQTWfhqtwacp][^;\\]*;/g, '').replace(/\\S([^;]*);/g, (_, s: string) => s.replace(/[#^]/, '/'))
    .replace(/\\[LlOoKkNn]/g, '').replace(/\\([\\{}])/g, '$1').replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/\s+/g, ' ').trim();
}

/** One entity: its group codes and values, in the order of the file. */
class Entity {
  constructor(readonly type: string, private readonly codes: number[], private readonly values: string[], private readonly from: number, private readonly to: number) {}
  get length() { return this.to - this.from; }
  code(i: number) { return this.codes[this.from + i]!; }
  value(i: number) { return this.values[this.from + i]!; }
  number(i: number) { return Number(this.values[this.from + i]); }
  /** The first value of `code`, or `fallback`. */
  get(code: number, fallback = ''): string {
    for (let i = this.from; i < this.to; i++) if (this.codes[i] === code) return this.values[i]!;
    return fallback;
  }
  num(code: number, fallback = 0): number { const v = Number(this.get(code, String(fallback))); return Number.isFinite(v) ? v : fallback; }
  get layer() { return this.get(8, '0'); }
  /** Drawn in a layout (paper space) rather than in the model. */
  get paper() { return this.get(67) === '1'; }
  /** Drawn from below: an extrusion towards −z mirrors x (AutoCAD's arbitrary axis for (0, 0, −1)). */
  get mirrored() { return this.num(230, 1) < 0; }
}
const mirror = (points: DxfPoint[]): DxfPoint[] => points.map(([x, y]) => [-x, y]);

/** The outline of each boundary of a hatch, from its polyline paths and from its lines, arcs, ellipses and splines. */
function hatchPaths(e: Entity): DxfPoint[][] {
  let i = 0;
  while (i < e.length && e.code(i) !== 91) i++;
  const count = i < e.length ? e.number(i) : 0, paths: DxfPoint[][] = [];
  i++;
  const at = (code: number) => { while (i < e.length && e.code(i) !== code) i++; return i < e.length; };
  const take = (code: number) => at(code) ? e.number(i++) : 0;
  for (let p = 0; p < count && at(92); p++) {
    const flags = e.number(i++);
    const points: DxfPoint[] = [];
    if (flags & 2) {
      // The boundary of a hatch is always closed, whatever its flag says.
      const hasBulge = take(72) !== 0; take(73);
      const n = take(93), vertices: DxfPoint[] = [], bulges: number[] = [];
      for (let v = 0; v < n; v++) {
        const x = take(10), y = take(20);
        vertices.push([x, y]);
        bulges.push(hasBulge && i < e.length && e.code(i) === 42 ? e.number(i++) : 0);
      }
      points.push(...bulged(vertices, bulges, true));
    } else {
      const edges = take(93);
      for (let k = 0; k < edges; k++) {
        const type = take(72);
        if (type === 1) { const a: DxfPoint = [take(10), take(20)], b: DxfPoint = [take(11), take(21)]; points.push(a, b); }
        else if (type === 2 || type === 3) {
          const c: DxfPoint = [take(10), take(20)], m: DxfPoint = type === 3 ? [take(11), take(21)] : [0, 0], r = type === 2 ? take(40) : 0, ratio = type === 3 ? take(40) : 1;
          const s = take(50) * Math.PI / 180, f = take(51) * Math.PI / 180, ccw = take(73) !== 0;
          // A clockwise edge stores its angles as their complements (360° − angle): the counter-clockwise arc from
          // −end to −start, walked backwards.
          const [from, to] = ccw ? [s, f] : [-f, -s];
          const param = (a: number) => Math.atan2(Math.sin(a) / (ratio || 1), Math.cos(a));
          const shape = type === 2 ? arc(c[0], c[1], r, from, to) : ellipse(c, m, ratio, param(from), param(to));
          points.push(...(ccw ? shape : shape.reverse()));
        } else if (type === 4) {
          const degree = take(94); take(73); take(74);
          const nk = take(95), nc = take(96), knots: number[] = [], control: DxfPoint[] = [], weights: number[] = [];
          for (let q = 0; q < nk; q++) knots.push(take(40));
          for (let q = 0; q < nc; q++) {
            control.push([take(10), take(20)]);
            if (i < e.length && e.code(i) === 42) weights.push(e.number(i++));
          }
          // Fit points follow in recent files; the control points already give the curve.
          if (i < e.length && e.code(i) === 97) { const fits = e.number(i++); for (let q = 0; q < fits; q++) { take(11); take(21); } }
          while (i < e.length && [12, 22, 13, 23].includes(e.code(i))) i++;
          points.push(...spline(degree, knots, control, weights, false));
        }
      }
    }
    if (points.length > 2) paths.push(points);
    // The objects the boundary was picked from.
    const sources = at(97) ? e.number(i++) : 0;
    for (let s = 0; s < sources && i < e.length && e.code(i) === 330; s++) i++;
  }
  return paths;
}

/** Shapes of a single entity, in drawing units. */
function shapesOf(e: Entity): DxfPoint[][] {
  switch (e.type) {
    case 'LINE': return [[[e.num(10), e.num(20)], [e.num(11), e.num(21)]]];
    case 'LWPOLYLINE': {
      const points: DxfPoint[] = [], bulges: number[] = [];
      let x: number | undefined;
      for (let i = 0; i < e.length; i++) {
        const code = e.code(i);
        if (code === 10) x = e.number(i);
        else if (code === 20 && x !== undefined) { points.push([x, e.number(i)]); bulges.push(0); x = undefined; }
        else if (code === 42 && bulges.length) bulges[bulges.length - 1] = e.number(i);
      }
      return points.length > 1 ? [bulged(points, bulges, (e.num(70) & 1) === 1)] : [];
    }
    case 'CIRCLE': return [arc(e.num(10), e.num(20), e.num(40), 0, TAU)];
    case 'ARC': return [arc(e.num(10), e.num(20), e.num(40), e.num(50) * Math.PI / 180, e.num(51) * Math.PI / 180)];
    case 'ELLIPSE': return [ellipse([e.num(10), e.num(20)], [e.num(11), e.num(21)], e.num(40, 1), e.num(41), e.num(42, TAU))];
    case 'SPLINE': {
      const knots: number[] = [], weights: number[] = [], control: DxfPoint[] = [], fit: DxfPoint[] = [];
      let x: number | undefined, fx: number | undefined;
      for (let i = 0; i < e.length; i++) {
        const code = e.code(i);
        if (code === 40) knots.push(e.number(i)); else if (code === 41) weights.push(e.number(i));
        else if (code === 10) x = e.number(i); else if (code === 20 && x !== undefined) { control.push([x, e.number(i)]); x = undefined; }
        else if (code === 11) fx = e.number(i); else if (code === 21 && fx !== undefined) { fit.push([fx, e.number(i)]); fx = undefined; }
      }
      const closed = (e.num(70) & 1) === 1;
      return [control.length ? spline(e.num(71, 3), knots, control, weights, closed) : closed && fit.length ? [...fit, fit[0]!] : fit];
    }
    default: return [];
  }
}

/** Reads a DXF drawing: its declared unit, its layers, and the lines, curves, hatches and texts of its model space. */
export function parseDxf(text: string): DxfDrawing {
  const lines = text.split(/\r\n|\n|\r/), codes: number[] = [], values: string[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]!.trim());
    if (!Number.isInteger(code)) throw new Error('Fichier DXF illisible : vérifiez qu’il s’agit bien d’un DXF texte.');
    codes.push(code); values.push(lines[i + 1]!.trim());
  }
  if (!codes.length || !values.includes('SECTION')) throw new Error('Fichier DXF illisible : vérifiez qu’il s’agit bien d’un DXF texte.');
  let units = 0, section = '';
  const layers = new Map<string, DxfLayer>(), shapes: DxfShape[] = [], texts: DxfText[] = [];
  const layer = (name: string) => { let l = layers.get(name); if (!l) layers.set(name, l = { name, hidden: false, count: 0 }); return l; };
  let polyline: { layer: string; closed: boolean; mirrored: boolean; skip: boolean; points: DxfPoint[]; bulges: number[] } | undefined;
  const add = (e: Entity, points: DxfPoint[], closed: boolean, fill = false) => {
    if (points.length < 2 || points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return;
    shapes.push({ layer: e.layer, points: e.mirrored ? mirror(points) : points, closed, ...(fill ? { fill } : {}) });
  };
  for (let i = 0; i < codes.length;) {
    if (codes[i] !== 0) { i++; continue; }
    const type = values[i]!;
    let end = i + 1;
    while (end < codes.length && codes[end] !== 0) end++;
    const e = new Entity(type, codes, values, i + 1, end);
    i = end;
    if (type === 'SECTION') {
      section = e.get(2);
      // The header is a list of variables inside the section itself, each named by a group 9.
      if (section === 'HEADER') for (let k = 0; k + 1 < e.length; k++) if (e.code(k) === 9 && e.value(k) === '$INSUNITS') units = Number(e.value(k + 1)) || 0;
      continue;
    }
    if (type === 'ENDSEC') { section = ''; continue; }
    if (section === 'TABLES' && type === 'LAYER') {
      const l = layer(e.get(2));
      l.hidden = (e.num(70) & 1) === 1 || e.num(62, 7) < 0;
      continue;
    }
    if (section !== 'ENTITIES') continue;
    if (type === 'VERTEX') {
      if (polyline && !polyline.skip && !(e.num(70) & 128)) { polyline.points.push([e.num(10), e.num(20)]); polyline.bulges.push(e.num(42)); }
      continue;
    }
    if (type === 'SEQEND') {
      if (polyline && !polyline.skip && polyline.points.length > 1) {
        const points = bulged(polyline.points, polyline.bulges, polyline.closed);
        shapes.push({ layer: polyline.layer, points: polyline.mirrored ? mirror(points) : points, closed: polyline.closed });
      }
      polyline = undefined;
      continue;
    }
    if (e.paper) continue;
    layer(e.layer).count++;
    if (type === 'POLYLINE') {
      // Meshes and polyface solids are surfaces, not lines of a plan.
      const flags = e.num(70);
      polyline = { layer: e.layer, closed: (flags & 1) === 1, mirrored: e.mirrored, skip: (flags & (16 | 64)) !== 0, points: [], bulges: [] };
    } else if (type === 'HATCH') {
      for (const path of hatchPaths(e)) add(e, path, true, true);
    } else if (type === 'TEXT' || type === 'MTEXT') {
      let raw = e.get(1);
      if (type === 'MTEXT') { raw = ''; for (let k = 0; k < e.length; k++) if (e.code(k) === 3 || e.code(k) === 1) raw += e.value(k); }
      const value = plainText(raw), aligned = type === 'TEXT' && (e.num(72) !== 0 || e.num(73) !== 0) && e.get(11) !== '';
      const at: DxfPoint = aligned ? [e.num(11), e.num(21)] : [e.num(10), e.num(20)];
      if (value && Number.isFinite(at[0]) && Number.isFinite(at[1])) texts.push({ layer: e.layer, text: value, at: e.mirrored ? [-at[0], at[1]] : at });
    } else {
      for (const points of shapesOf(e)) add(e, points, e.type === 'CIRCLE' || (e.type === 'LWPOLYLINE' && (e.num(70) & 1) === 1) || (e.type === 'SPLINE' && (e.num(70) & 1) === 1));
    }
  }
  return { units, layers: [...layers.values()].filter(l => l.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), shapes, texts };
}
