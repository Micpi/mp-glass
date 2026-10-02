import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Point, SiteEquipmentKind, SiteKind, SpatialSite } from '../../shared/spatial';

/** A house of the domain on the site plan: its outline raised to `height` metres, glass like the walls of the floor plans. */
export interface SceneHouse { id: string; at: Point; outline?: Point[]; height: number }
export interface SceneEquipment { id: string; kind: SiteEquipmentKind; at: Point; radius?: number }
/** How each piece is shown: `lit` a light on, `wet` a sprinkler watering, `open` a gate open, `muted` outside the category shown. */
export interface SiteLook { selected?: string; muted: ReadonlySet<string>; lit: ReadonlySet<string>; wet: ReadonlySet<string>; open: ReadonlySet<string> }
/** Where each house stands on screen, for its label. */
export type SiteProjection = Map<string, { x: number; y: number; visible: boolean }>;
/** What a tap touched: a house or a piece of equipment, by id; nothing on the ground beside them. */
export type SiteTarget = { type: 'house' | 'equipment'; id: string } | undefined;

/** Colours of each layer of the drawing, seen through the same night glass as the floor plans, and its opacity. */
const LAYERS: Record<SiteKind, [number, number]> = {
  green: [0x4f9a5a, .34], wood: [0x2f6b45, .4], sport: [0x5ba56a, .45], path: [0xb9a27a, .26], water: [0x3d93d8, .55],
  pool: [0x37a8ee, .72], boundary: [0xbcd4e8, .05], wall: [0xaab8c6, .35], building: [0xe7a37c, .14], other: [0x9fb4c8, .16],
};
/** How high above the ground each kind of layer lies, so that overlapping layers never flicker. */
const LIFT: Record<SiteKind, number> = { boundary: .004, green: .01, wood: .012, other: .015, path: .02, water: .025, sport: .03, pool: .035, wall: 0, building: 0 };
/** Heights of the outbuildings and walls the drawing shows. */
const BUILDING = 3.6, WALL = 1.1;
const WET = 0x46c8ff, WARM = 0xffd35a, GLASS = 0x3496d1, EDGE = 0xb5e2ff, OPEN = 0x8ff0c8, IDLE = 0x9fb8cc;
const FOV = 38;
/** Trees drawn over all the woods at most, sparser in a large wood so that the plan stays light to draw. */
const TREES = 1800;

interface HouseParts { bodies: T.MeshBasicMaterial; roof: T.MeshBasicMaterial; lines: T.LineBasicMaterial; anchor: T.Vector3 }
interface EquipmentParts { kind: SiteEquipmentKind; body: T.MeshBasicMaterial; lamp?: T.MeshBasicMaterial; glow?: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>; leaves?: T.Group; spray?: T.Group }

const ring = (flatList: number[]): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i + 1 < flatList.length; i += 2) points.push([flatList[i]!, flatList[i + 1]!]);
  const first = points[0], last = points[points.length - 1];
  if (first && last && points.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) points.pop();
  return points;
};
const shape = (points: Point[]) => new T.Shape(points.map(p => new T.Vector2(p[0], -p[1])));
const flat = (geometry: T.BufferGeometry, y: number) => { geometry.rotateX(-Math.PI / 2); geometry.translate(0, y, 0); return geometry; };
const inside = (polygon: Point[], x: number, y: number) => {
  let hit = false;
  polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length]!; if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) hit = !hit; });
  return hit;
};
const area = (polygon: Point[]) => Math.abs(polygon.reduce((s, p, i) => { const q = polygon[(i + 1) % polygon.length]!; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/** Merged into one geometry, so that a drawing of thousands of shapes is a handful of draws; undefined when there is none. */
const merged = (geometries: T.BufferGeometry[]) => {
  if (!geometries.length) return undefined;
  const one = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries.map(g => g.index ? g.toNonIndexed() : g), false);
  if (geometries.length > 1) for (const g of geometries) g.dispose();
  return one ?? undefined;
};
const lines = (segments: number[]) => new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(segments, 3));

/**
 * The site plan of a domain in 3D: the layers of its drawing on the ground (lawns, woods, driveways, pools, courts), its
 * outbuildings and walls raised, its houses as glass volumes, and the lights, sprinklers, gates and cameras of its grounds
 * standing where they are. A tap tells what it touched; a chosen house is flown to, its garden framed.
 */
export class SiteScene {
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(FOV, 1, .5, 12000);
  private scene = new T.Scene();
  private group = new T.Group();
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private houses = new Map<string, HouseParts>();
  private equipment = new Map<string, EquipmentParts>();
  private targets: T.Object3D[] = [];
  private ray = new T.Raycaster();
  private halo?: T.CanvasTexture;
  private center = new T.Vector3();
  private radius = 20;
  private down = { x: 0, y: 0 };
  private tween = 0;
  private spray = 0;
  private sprayAt = 0;

  constructor(private host: HTMLElement, private touch: (target: SiteTarget) => void, private project: (houses: SiteProjection) => void, label: string) {
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    host.append(this.renderer.domElement);
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', label);
    canvas.style.touchAction = 'pan-y';
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false; this.controls.maxPolarAngle = Math.PI * .47; this.controls.minDistance = 6; this.controls.maxDistance = 6000;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener('change', this.render);
    this.controls.addEventListener('start', this.stop);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointermove', this.hover);
    this.scene.add(this.group);
    this.observer = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.render();
    });
    this.observer.observe(host);
  }

  private haloTexture() {
    if (!this.halo) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const context = canvas.getContext('2d'); if (!context) return undefined;
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.5, 'rgba(255,255,255,.34)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient; context.fillRect(0, 0, 128, 128); this.halo = new T.CanvasTexture(canvas);
    }
    return this.halo;
  }
  private glowOf(size: number, color: number, opacity: number) {
    const mesh = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshBasicMaterial({ map: this.haloTexture() ?? null, color, transparent: true, opacity, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; return mesh;
  }
  private target<O extends T.Object3D>(object: O, type: 'house' | 'equipment', id: string) {
    Object.assign(object.userData, { type, id }); this.targets.push(object); return object;
  }
  private clear() {
    cancelAnimationFrame(this.spray); this.spray = 0;
    const materials = new Set<T.Material>();
    this.group.traverse(object => {
      if (object instanceof T.Mesh || object instanceof T.LineSegments || object instanceof T.InstancedMesh) {
        object.geometry.dispose();
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
      }
    });
    for (const m of materials) m.dispose();
    this.group.clear(); this.houses.clear(); this.equipment.clear(); this.targets = [];
  }

  /** Draws the domain anew; `reset` frames it whole. */
  setSite(site: SpatialSite, houses: SceneHouse[], equipment: SceneEquipment[], reset = true) {
    this.clear();
    const { width: w, height: h } = site;
    // The ground of the domain: a dark glass plate, its edge drawn, a soft light under it.
    this.group.add(new T.Mesh(flat(new T.PlaneGeometry(w, h), 0).translate(w / 2, 0, h / 2), new T.MeshBasicMaterial({ color: 0x0e2a33, transparent: true, opacity: .55, depthWrite: false })));
    this.group.add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w, 0, h)).translate(w / 2, .002, h / 2), new T.LineBasicMaterial({ color: EDGE, transparent: true, opacity: .3 })));
    const glow = this.glowOf(Math.max(w, h) * 1.8, 0x2f8fe0, .28); glow.position.set(w / 2, -.05, h / 2); glow.renderOrder = -1; this.group.add(glow);
    // The outbuildings of the drawing under a house drawn on the plan give way to it.
    const outlined = houses.filter(house => house.outline);
    const woods: Point[][] = [];
    for (const layer of site.layers) {
      const [color, opacity] = LAYERS[layer.kind], lift = LIFT[layer.kind];
      const raised = layer.kind === 'building' ? BUILDING : layer.kind === 'wall' ? WALL : 0;
      const fills = (layer.fills ?? []).map(ring).filter(p => p.length >= 3)
        .filter(p => layer.kind !== 'building' || !outlined.some(house => inside(p, house.at[0], house.at[1])));
      if (layer.kind === 'wood') woods.push(...fills);
      const surface = merged(fills.map(p => raised
        ? new T.ExtrudeGeometry(shape(p), { depth: raised, bevelEnabled: false }).rotateX(-Math.PI / 2)
        : flat(new T.ShapeGeometry(shape(p)), lift)));
      if (surface) {
        const mesh = new T.Mesh(surface, new T.MeshBasicMaterial({ color, transparent: true, opacity, side: T.DoubleSide, depthWrite: false }));
        mesh.renderOrder = raised ? 2 : 0; this.group.add(mesh);
        if (raised) this.group.add(new T.LineSegments(new T.EdgesGeometry(surface, 25), new T.LineBasicMaterial({ color: layer.kind === 'building' ? 0xf4c7a6 : 0xd5e1ec, transparent: true, opacity: .55 })));
      }
      // Lines of the drawing on the ground; those of a building or a wall drawn again at its top.
      const segments: number[] = [];
      for (const path of [...layer.paths ?? [], ...raised ? [] : layer.fills ?? []]) {
        for (let i = 0; i + 3 < path.length; i += 2) {
          segments.push(path[i]!, lift + .006, path[i + 1]!, path[i + 2]!, lift + .006, path[i + 3]!);
          if (raised) segments.push(path[i]!, raised, path[i + 1]!, path[i + 2]!, raised, path[i + 3]!);
        }
      }
      if (segments.length) {
        const edge = layer.kind === 'pool' || layer.kind === 'water' ? 0xaee2ff : layer.kind === 'building' ? 0xf4c7a6 : layer.kind === 'boundary' ? 0xd7e7f5 : new T.Color(color).lerp(new T.Color(0xffffff), .35).getHex();
        this.group.add(new T.LineSegments(lines(segments), new T.LineBasicMaterial({ color: edge, transparent: true, opacity: layer.kind === 'boundary' ? .45 : .5 })));
      }
      // A pool gets a rim of light stone.
      if (layer.kind === 'pool') {
        const rim = merged(fills.map(p => new T.ExtrudeGeometry(shape(p), { depth: .15, bevelEnabled: false }).rotateX(-Math.PI / 2)));
        if (rim) this.group.add(new T.Mesh(rim, new T.MeshBasicMaterial({ color: 0xd8ecf5, transparent: true, opacity: .1, depthWrite: false })));
      }
    }
    this.addTrees(woods);
    for (const house of houses) this.addHouse(house);
    for (const item of equipment) this.addEquipment(item);
    this.center.set(w / 2, 0, h / 2); this.radius = Math.max(Math.hypot(w, h) / 2, 8);
    this.controls.maxDistance = Math.max(200, this.radius * 6);
    if (reset) this.overview(false); else this.render();
  }
  /** Round crowns on short trunks, spread over the woods: one draw for all the crowns, one for all the trunks. */
  private addTrees(woods: Point[][]) {
    const total = woods.reduce((sum, p) => sum + area(p), 0);
    if (!total) return;
    const step = Math.max(3.2, Math.sqrt(total / TREES)), spots: [number, number, number][] = [];
    let n = 0;
    for (const polygon of woods) {
      const xs = polygon.map(p => p[0]), ys = polygon.map(p => p[1]);
      for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
        const jx = x + ((n * 37) % 10 - 5) / 10 * step * .5, jy = y + ((n * 53) % 10 - 5) / 10 * step * .5;
        if (inside(polygon, jx, jy) && spots.length < TREES) spots.push([jx, jy, Math.min(step * .48, 1.2 + (n % 3) * .45) * Math.max(1, step / 6)]);
        n++;
      }
    }
    if (!spots.length) return;
    const crowns = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0x4f9a63, transparent: true, opacity: .55 }), spots.length);
    const trunks = new T.InstancedMesh(new T.CylinderGeometry(.12, .16, 1, 6), new T.MeshBasicMaterial({ color: 0x6b5238, transparent: true, opacity: .7 }), spots.length);
    const m = new T.Matrix4();
    spots.forEach(([x, y, r], i) => {
      const trunk = 1.2 + r * .5;
      trunks.setMatrixAt(i, m.compose(new T.Vector3(x, trunk / 2, y), new T.Quaternion(), new T.Vector3(1 + r * .15, trunk, 1 + r * .15)));
      crowns.setMatrixAt(i, m.compose(new T.Vector3(x, trunk + r * .75, y), new T.Quaternion(), new T.Vector3(r, r * .9, r)));
    });
    this.group.add(trunks, crowns);
  }
  private addHouse(house: SceneHouse) {
    const bodies = new T.MeshBasicMaterial({ color: GLASS, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false });
    const roof = new T.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: .12, side: T.DoubleSide, depthWrite: false });
    const lines = new T.LineBasicMaterial({ color: EDGE, transparent: true, opacity: .9 });
    let anchor: T.Vector3;
    if (house.outline && house.outline.length >= 3) {
      const geometry = new T.ExtrudeGeometry(shape(house.outline), { depth: house.height, bevelEnabled: false }).rotateX(-Math.PI / 2);
      const body = new T.Mesh(geometry, bodies); body.renderOrder = 3;
      this.group.add(this.target(body, 'house', house.id));
      this.group.add(new T.LineSegments(new T.EdgesGeometry(geometry, 20), lines));
      this.group.add(new T.Mesh(flat(new T.ShapeGeometry(shape(house.outline)), house.height + .01), roof));
      this.group.add(new T.Mesh(flat(new T.ShapeGeometry(shape(house.outline)), .06), new T.MeshBasicMaterial({ color: GLASS, transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false })));
      anchor = new T.Box3().setFromObject(body).getCenter(new T.Vector3());
    } else {
      // A house placed without its walls drawn: a glass beacon where it stands.
      const geometry = new T.CylinderGeometry(4, 4, house.height, 6).translate(house.at[0], house.height / 2, house.at[1]);
      const body = new T.Mesh(geometry, bodies); body.renderOrder = 3;
      this.group.add(this.target(body, 'house', house.id));
      this.group.add(new T.LineSegments(new T.EdgesGeometry(geometry, 20), lines));
      anchor = new T.Vector3(house.at[0], 0, house.at[1]);
    }
    this.houses.set(house.id, { bodies, roof, lines, anchor: anchor.setY(house.height + 2) });
  }
  private addEquipment(item: SceneEquipment) {
    const group = new T.Group(); group.position.set(item.at[0], 0, item.at[1]); this.group.add(group);
    const body = new T.MeshBasicMaterial({ color: IDLE, transparent: true, opacity: .85 });
    const parts: EquipmentParts = { kind: item.kind, body };
    // Equipment is small beside a domain: its pieces are drawn larger than life so that a tap finds them.
    const hit = (mesh: T.Mesh) => { group.add(this.target(mesh, 'equipment', item.id)); return mesh; };
    if (item.kind === 'light') {
      // A garden bollard: a post and its lamp, a pool of warm light on the ground while it is on.
      hit(new T.Mesh(new T.CylinderGeometry(.14, .18, 1.2, 10), body)).position.y = .6;
      parts.lamp = new T.MeshBasicMaterial({ color: 0x4b5a66 });
      hit(new T.Mesh(new T.SphereGeometry(.42, 16, 12), parts.lamp)).position.y = 1.4;
      parts.glow = this.glowOf(10, WARM, 0); parts.glow.position.y = .08; group.add(parts.glow);
    } else if (item.kind === 'gate') {
      for (const z of [-2.1, 2.1]) hit(new T.Mesh(new T.BoxGeometry(.35, 2, .35), body)).position.set(0, 1, z);
      // Two leaves on their hinges, swung open while the gate is open.
      const leaves = new T.Group();
      for (const side of [-1, 1]) {
        const hinge = new T.Group(); hinge.position.set(0, 0, side * 2); hinge.userData.side = side; leaves.add(hinge);
        const panel = new T.Mesh(new T.BoxGeometry(.1, 1.5, 1.95), new T.MeshBasicMaterial({ color: 0xcfe3f2, transparent: true, opacity: .5 }));
        panel.position.set(0, .85, -side * 1); hinge.add(panel); this.target(panel, 'equipment', item.id);
      }
      group.add(leaves); parts.leaves = leaves;
    } else if (item.kind === 'camera') {
      hit(new T.Mesh(new T.CylinderGeometry(.1, .1, 2.8, 8), body)).position.y = 1.4;
      hit(new T.Mesh(new T.BoxGeometry(.8, .4, .4), body)).position.set(.3, 2.9, 0);
    } else {
      // A sprinkler: its head on the lawn, and the reach of its zone in rings that grow while it waters.
      hit(new T.Mesh(new T.CylinderGeometry(.3, .36, .5, 12), body)).position.y = .25;
      const spray = new T.Group(), reach = item.radius ?? 6; spray.visible = false; spray.userData.reach = reach; group.add(spray);
      const zone = new T.Mesh(flat(new T.CircleGeometry(reach, 40), .05), new T.MeshBasicMaterial({ color: WET, transparent: true, opacity: .26, depthWrite: false }));
      spray.add(zone);
      for (let i = 0; i < 3; i++) {
        const r = new T.Mesh(flat(new T.RingGeometry(.92, 1, 48), .06), new T.MeshBasicMaterial({ color: WET, transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false }));
        r.userData.phase = i / 3; spray.add(r);
      }
      parts.spray = spray;
    }
    this.equipment.set(item.id, parts);
  }

  /** Draws each piece in its state; the loop that turns the sprinklers' rings runs only while one waters. */
  style(look: SiteLook) {
    for (const [id, part] of this.houses) {
      const picked = look.selected === id, muted = !!look.selected && !picked;
      part.bodies.opacity = picked ? .3 : muted ? .08 : .17;
      part.roof.opacity = picked ? .24 : muted ? .05 : .12;
      part.lines.color.setHex(picked ? 0xf1fbff : EDGE); part.lines.opacity = picked ? 1 : muted ? .4 : .85;
    }
    for (const [id, part] of this.equipment) {
      const muted = look.muted.has(id), lit = look.lit.has(id), wet = look.wet.has(id), open = look.open.has(id);
      part.body.opacity = muted ? .25 : .9;
      part.body.color.setHex(wet ? WET : open ? OPEN : IDLE);
      if (part.lamp) { part.lamp.color.setHex(lit ? WARM : 0x4b5a66); part.lamp.transparent = muted; part.lamp.opacity = muted ? .3 : 1; }
      if (part.glow) part.glow.material.opacity = lit ? (muted ? .2 : .8) : 0;
      if (part.leaves) for (const hinge of part.leaves.children) hinge.rotation.y = (open ? 1.25 : 0) * Number(hinge.userData.side);
      if (part.spray) part.spray.visible = wet && !muted;
    }
    const watering = [...this.equipment.values()].some(e => e.spray?.visible);
    if (watering && !this.spray && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.spray = requestAnimationFrame(this.turn);
    if (!watering && this.spray) { cancelAnimationFrame(this.spray); this.spray = 0; }
    this.render();
  }
  /** The sprinklers' rings grow to the reach of their zone and fade, one after the other. */
  private turn = (time: number) => {
    this.spray = 0;
    const t = time / 1000;
    for (const item of this.equipment.values()) if (item.spray?.visible) {
      const reach = Number(item.spray.userData.reach);
      for (const ring of item.spray.children) {
        if (ring.userData.phase === undefined) continue;
        const k = (t * .5 + Number(ring.userData.phase)) % 1, mesh = ring as T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
        mesh.scale.set(reach * (.15 + k * .85), 1, reach * (.15 + k * .85)); mesh.material.opacity = .7 * (1 - k);
      }
    }
    if (time - this.sprayAt > 30) { this.sprayAt = time; this.render(); }
    this.spray = requestAnimationFrame(this.turn);
  };

  private stop = () => { cancelAnimationFrame(this.tween); this.tween = 0; };
  /** Flies the camera to look at `target` from `distance`, keeping its angle. */
  private fly(target: T.Vector3, distance: number, animate = true) {
    this.stop();
    const from = this.controls.target.clone(), offset = this.camera.position.clone().sub(from);
    const direction = offset.lengthSq() > 1e-6 ? offset.normalize() : new T.Vector3(.35, 1.05, 1.1).normalize(), start = offset.length() || distance;
    const duration = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 0, began = performance.now();
    const step = (now: number) => {
      const t = duration ? Math.min(1, (now - began) / duration) : 1, k = 1 - (1 - t) ** 3;
      this.controls.target.lerpVectors(from, target, k);
      this.camera.position.copy(this.controls.target).addScaledVector(direction, start + (distance - start) * k);
      this.controls.update();
      if (t < 1) this.tween = requestAnimationFrame(step); else this.tween = 0;
    };
    step(began);
  }
  private distance(radius: number) { return radius * 2.3 / Math.min(this.camera.aspect || 1, 1.25); }
  /** The whole domain, seen from above at an angle. */
  overview(animate = true) {
    if (!animate) {
      this.controls.target.copy(this.center);
      this.camera.position.copy(this.center).add(new T.Vector3(.35, 1.05, 1.1).normalize().multiplyScalar(this.distance(this.radius)));
      this.controls.update(); this.render(); return;
    }
    this.fly(this.center.clone(), this.distance(this.radius));
  }
  /** A part of the site, `[x, y, width, height]` in metres: a house and its garden. */
  frame([x, y, w, h]: [number, number, number, number]) {
    this.fly(new T.Vector3(x + w / 2, 0, y + h / 2), this.distance(Math.max(Math.hypot(w, h) / 2, 10)));
  }
  zoom(factor: number) {
    this.stop();
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor).clampLength(this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset); this.controls.update(); this.render();
  }

  private pointerDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; };
  private cast(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width) return undefined;
    this.ray.setFromCamera(new T.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.camera);
    // A piece of equipment before the house it stands by.
    const hits = this.ray.intersectObjects(this.targets, false), rank = { equipment: 0, house: 1 } as const;
    return hits.sort((a, b) => rank[a.object.userData.type as keyof typeof rank] - rank[b.object.userData.type as keyof typeof rank] || a.distance - b.distance)[0]?.object;
  }
  private pointerUp = (e: PointerEvent) => {
    if (e.button !== 0 || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return;
    const hit = this.cast(e.clientX, e.clientY);
    this.touch(hit ? { type: hit.userData.type as 'house' | 'equipment', id: String(hit.userData.id) } : undefined);
  };
  private hover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    this.renderer.domElement.style.cursor = this.cast(e.clientX, e.clientY) ? 'pointer' : 'grab';
  };
  render = () => {
    this.renderer.render(this.scene, this.camera);
    const { clientWidth: w, clientHeight: h } = this.host, positions: SiteProjection = new Map();
    for (const [id, { anchor }] of this.houses) {
      const p = anchor.clone().project(this.camera);
      positions.set(id, { x: (p.x + 1) * w / 2, y: (1 - p.y) * h / 2, visible: p.z >= -1 && p.z <= 1 && Math.abs(p.x) < .98 && Math.abs(p.y) < .95 });
    }
    this.project(positions);
  };
  dispose() {
    this.stop(); this.observer.disconnect(); this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('pointermove', this.hover);
    this.clear(); this.halo?.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
  }
}
