import { LitElement, css, html, nothing, svg } from 'lit';
import type { Point, SiteEquipment, SiteEquipmentKind, SiteKind, SpatialSite } from '../../shared/spatial';
import { mpIcon, type MPIconName } from '../icons';
import { LanguageController, tr } from '../i18n';
import { defineElement } from '../registry';

/** A house on the site plan: where it stands, its outline when known, and its lights on. */
export interface SiteHouse { id: string; name: string; at: Point; outline?: Point[]; lights?: number }
interface View { x: number; y: number; w: number; h: number }
const EQUIPMENT_ICONS: Record<SiteEquipmentKind, MPIconName> = { light: 'bulb', irrigation: 'drop', gate: 'gate', camera: 'camera' };
/** Layers drawn from the ground up: lawns and courts first, buildings on top. */
const ORDER: SiteKind[] = ['green', 'wood', 'sport', 'water', 'pool', 'path', 'boundary', 'wall', 'other', 'building'];
const line = (data: number[], close: boolean) => {
  let d = '';
  for (let i = 0; i + 1 < data.length; i += 2) d += `${i ? 'L' : 'M'}${data[i]} ${data[i + 1]}`;
  return close ? `${d}Z` : d;
};
/** The outlines of each layer as SVG paths, worked out once per site plan. */
const drawn = new WeakMap<SpatialSite, { kind: SiteKind; name: string; strokes: string; fills: string }[]>();
function layersOf(site: SpatialSite) {
  let layers = drawn.get(site);
  if (!layers) {
    layers = [...site.layers].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
      .map(l => ({ kind: l.kind, name: l.name, strokes: (l.paths ?? []).map(p => line(p, false)).join(''), fills: (l.fills ?? []).map(p => line(p, true)).join('') }));
    drawn.set(site, layers);
  }
  return layers;
}

/**
 * The site plan of a domain seen from above, north up: its layers, and its houses as tabs on their spot. Drag to move,
 * wheel (once the plan is touched, or with Ctrl) or pinch to zoom. `picking`: the next tap chooses a point (`site-pick`).
 */
export class MPSitePlan extends LitElement {
  static properties = { site: { attribute: false }, houses: { attribute: false }, equipment: { attribute: false }, chosen: {}, hint: {}, selected: {}, picking: { type: Boolean, reflect: true }, pending: { attribute: false }, view: { state: true }, engaged: { state: true }, size: { state: true } };
  static styles = css`
    :host{display:block;position:relative;container-type:inline-size;min-width:0;color:#eff7ff;font:13px/1.5 var(--mp-body-font,Inter,system-ui,sans-serif);--accent:var(--mp-accent,#69b7ff)}
    *{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid #a2d7ff;outline-offset:2px}
    .stage{position:relative;height:var(--mp-stage-height,clamp(300px,min(62cqw,72vh),620px));overflow:hidden;border-radius:var(--mp-radius,22px);background:radial-gradient(ellipse 65% 55% at 50% 55%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 72%),linear-gradient(180deg,rgba(3,16,29,.58),rgba(3,16,29,.82));border:1px solid rgba(214,236,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.07),0 24px 60px rgba(0,8,18,.18);touch-action:none;cursor:grab;user-select:none}
    .stage:active{cursor:grabbing}:host([picking]) .stage{cursor:crosshair}
    svg{position:absolute;inset:0;width:100%;height:100%;display:block}
    path{vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
    .s{fill:none;stroke-width:1}.f{stroke:none;fill-rule:evenodd}
    .k-green.f{fill:rgba(96,170,86,.26)}.k-green.s{stroke:rgba(120,190,100,.45)}
    .k-wood.f{fill:rgba(62,130,80,.34)}.k-wood.s{stroke:rgba(110,175,110,.5)}
    .k-sport.f{fill:rgba(92,165,92,.3)}.k-sport.s{stroke:rgba(150,215,140,.7)}
    .k-water.f{fill:rgba(70,150,230,.35)}.k-water.s{stroke:rgba(120,190,255,.8);stroke-width:1.4}
    .k-pool.f{fill:rgba(64,172,238,.62)}.k-pool.s{stroke:rgba(150,215,255,.9)}
    .k-path.f{fill:rgba(210,190,150,.16)}.k-path.s{stroke:rgba(215,196,152,.55)}
    .k-boundary.s{stroke:rgba(190,212,232,.5);stroke-dasharray:5 4}.k-boundary.f{fill:rgba(190,212,232,.05)}
    .k-wall.s{stroke:rgba(172,188,204,.6)}.k-wall.f{fill:rgba(172,188,204,.3)}
    .k-other.s{stroke:rgba(160,182,204,.45)}.k-other.f{fill:rgba(160,182,204,.15)}
    .k-building.f{fill:rgba(232,152,112,.3)}.k-building.s{stroke:rgba(244,176,136,.85);stroke-width:1.2}
    .outline{fill:color-mix(in srgb,var(--accent) 18%,transparent);stroke:color-mix(in srgb,var(--accent) 70%,white);stroke-width:1.6;vector-effect:non-scaling-stroke}
    .outline.on{fill:color-mix(in srgb,var(--accent) 34%,transparent);stroke:#fff;stroke-width:2.2}
    .label{fill:#cfe0ef;opacity:.7;paint-order:stroke;stroke:rgba(3,16,29,.8);stroke-width:3px;stroke-linejoin:round;text-anchor:middle}
    .pending{fill:var(--accent);stroke:#fff;stroke-width:2;vector-effect:non-scaling-stroke}
    .glass{background:rgba(5,20,34,.62);border:1px solid rgba(214,236,255,.16);backdrop-filter:blur(14px) saturate(140%);box-shadow:0 8px 22px rgba(0,8,18,.3)}
    .house{position:absolute;z-index:1;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:6px;min-height:32px;max-width:220px;padding:0 12px 0 9px;border-radius:999px;font-size:12px;white-space:nowrap}
    .house span{overflow:hidden;text-overflow:ellipsis}.house .mp-icon{flex:none;color:var(--accent)}
    .house:hover,.house[aria-pressed=true]{border-color:color-mix(in srgb,var(--accent) 80%,white);background:color-mix(in srgb,var(--accent) 34%,rgba(5,20,34,.8))}
    .house small{display:inline-flex;align-items:center;gap:2px;padding:1px 6px;border-radius:999px;background:rgba(255,213,108,.16);color:#ffe39a;font-size:10.5px}
    :host([picking]) .house,:host([picking]) .item{pointer-events:none;opacity:.55}
    /* Equipment of the grounds placed in the Studio: a small round button each, the one edited lit. */
    .item{position:absolute;z-index:1;transform:translate(-50%,-50%);display:grid;place-items:center;width:24px;height:24px;padding:0;border-radius:50%;color:#dceaf6}
    .item.k-light{color:#ffd35a}.item.k-irrigation{color:#5ec8ff}.item.k-gate{color:#8ff0c8}.item.k-camera{color:#d9c2ff}
    .item[aria-pressed=true]{width:30px;height:30px;border-color:#fff;background:color-mix(in srgb,var(--accent) 50%,rgba(5,20,34,.8))}
    .rail{position:absolute;z-index:2;top:12px;right:12px;display:grid;gap:4px;padding:4px;border-radius:14px}
    .rail button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:10px;background:transparent}.rail button:hover{background:rgba(255,255,255,.1)}
    .north{position:absolute;z-index:1;left:14px;bottom:12px;font-size:11px;letter-spacing:.14em;color:#b7c9da;pointer-events:none}
    /* Beside the zoom buttons, on two lines on a phone rather than under them. */
    .hint{position:absolute;z-index:1;left:12px;top:12px;max-width:calc(100% - 84px);padding:6px 12px;border-radius:16px;font-size:11.5px;line-height:1.35;color:#cfe0ef;pointer-events:none}
  `;
  site?: SpatialSite;
  houses: SiteHouse[] = [];
  /** Equipment of the grounds shown on the plan, in the Studio; `chosen` the one edited. */
  equipment: SiteEquipment[] = [];
  chosen = '';
  /** What a tap chooses while `picking`, told over the plan; the spot of a house by default. */
  hint = '';
  selected = '';
  picking = false;
  /** The point chosen in the Studio, shown before it is kept. */
  pending?: Point;
  private view?: View;
  private engaged = false;
  private size = { w: 0, h: 0 };
  private language = new LanguageController(this);
  private pointers = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private pinch?: { distance: number; view: View; mid: { x: number; y: number } };
  private resize = new ResizeObserver(entries => {
    const box = entries[0]?.contentRect;
    if (!box || (box.width === this.size.w && box.height === this.size.h)) return;
    const before = this.size;
    this.size = { w: box.width, h: box.height };
    // The view keeps its centre and its scale across the width; its height follows the stage.
    if (this.view && before.w) { const k = this.view.w / before.w, cx = this.view.x + this.view.w / 2, cy = this.view.y + this.view.h / 2; this.view = { x: cx - box.width * k / 2, y: cy - box.height * k / 2, w: box.width * k, h: box.height * k }; }
    else this.fit();
  });
  disconnectedCallback() { super.disconnectedCallback(); this.resize.disconnect(); }
  protected firstUpdated() { const stage = this.renderRoot.querySelector('.stage'); if (stage) this.resize.observe(stage); }
  protected willUpdate(changed: Map<string, unknown>) { if (changed.has('site')) this.fit(); }
  /** The whole site in view, with a margin. */
  fit = () => {
    const site = this.site, { w, h } = this.size;
    if (!site || !w || !h) { this.view = undefined; return; }
    const margin = 1.08, k = Math.max(site.width * margin / w, site.height * margin / h);
    this.view = { x: site.width / 2 - w * k / 2, y: site.height / 2 - h * k / 2, w: w * k, h: h * k };
  };
  /** Zoom by `factor` about the point of the stage at (px, py), within 5 m and three times the site. */
  private zoom(factor: number, px = this.size.w / 2, py = this.size.h / 2) {
    const v = this.view, site = this.site;
    if (!v || !site || !this.size.w) return;
    const w = Math.min(Math.max(v.w * factor, 5), Math.max(site.width, site.height) * 3), f = w / v.w;
    const ax = v.x + px / this.size.w * v.w, ay = v.y + py / this.size.h * v.h;
    this.view = { x: ax - (ax - v.x) * f, y: ay - (ay - v.y) * f, w, h: v.h * f };
  }
  private local(e: { clientX: number; clientY: number }) {
    const box = this.renderRoot.querySelector('.stage')!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }
  private toSite(p: { x: number; y: number }): Point {
    const v = this.view!;
    return [Math.round((v.x + p.x / this.size.w * v.w) * 10) / 10, Math.round((v.y + p.y / this.size.h * v.h) * 10) / 10];
  }
  private down = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    this.engaged = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.local(e));
    if (this.pointers.size === 1) this.moved = 0;
    if (this.pointers.size === 2 && this.view) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), view: this.view, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      this.moved = Infinity;
    }
  };
  private move = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId);
    if (!last || !this.view) return;
    const now = this.local(e);
    this.pointers.set(e.pointerId, now);
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > 1) { this.view = this.pinch.view; this.zoom(this.pinch.distance / distance, this.pinch.mid.x, this.pinch.mid.y); }
      return;
    }
    const dx = now.x - last.x, dy = now.y - last.y, k = this.view.w / this.size.w;
    this.moved += Math.abs(dx) + Math.abs(dy);
    this.view = { ...this.view, x: this.view.x - dx * k, y: this.view.y - dy * k };
  };
  private up = (e: PointerEvent) => {
    const at = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = undefined;
    // A tap, not a drag: in the Studio it chooses a point of the site.
    if (at && this.moved < 6 && this.picking && this.view) this.dispatchEvent(new CustomEvent<{ at: Point }>('site-pick', { detail: { at: this.toSite(at) }, bubbles: true, composed: true }));
  };
  private wheel = (e: WheelEvent) => {
    // The page scrolls past the plan until the plan is touched; Ctrl zooms at once, as on a map.
    if (!this.engaged && !e.ctrlKey) return;
    e.preventDefault();
    const p = this.local(e);
    this.zoom(Math.exp(e.deltaY * (e.deltaMode ? .05 : .0015)), p.x, p.y);
  };
  private choose(id: string) { this.dispatchEvent(new CustomEvent<{ id: string }>('house-select', { detail: { id }, bubbles: true, composed: true })); }
  render() {
    const site = this.site, v = this.view;
    const k = v && this.size.w ? v.w / this.size.w : 1, near = site && v ? v.w < Math.max(site.width, site.height) * .7 : false;
    const at = (p: Point) => v ? `left:${(p[0] - v.x) / k}px;top:${(p[1] - v.y) / k}px` : 'display:none';
    return html`<div class="stage" @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up} @wheel=${this.wheel}>
      ${site && v ? svg`<svg viewBox=${`${v.x} ${v.y} ${v.w} ${v.h}`} preserveAspectRatio="none" role="img" aria-label=${tr('Plan de masse du domaine')}>
        ${layersOf(site).map(l => svg`${l.fills ? svg`<path class=${`f k-${l.kind}`} d=${l.fills}></path>` : nothing}${l.strokes ? svg`<path class=${`s k-${l.kind}`} d=${l.strokes}></path>` : nothing}`)}
        ${this.houses.filter(h => h.outline).map(h => svg`<path class=${h.id === this.selected ? 'outline on' : 'outline'} d=${`M${h.outline!.map(p => p.join(' ')).join('L')}Z`}></path>`)}
        ${near ? (site.labels ?? []).map(l => svg`<text class="label" x=${l.at[0]} y=${l.at[1]} font-size=${11 * k}>${l.text}</text>`) : nothing}
        ${this.pending ? svg`<circle class="pending" cx=${this.pending[0]} cy=${this.pending[1]} r=${6 * k}></circle>` : nothing}
      </svg>` : nothing}
      ${this.equipment.map(e => html`<button class=${`item glass k-${e.kind}`} style=${at(e.at)} aria-pressed=${e.id === this.chosen} title=${e.name ?? e.entityId ?? ''} aria-label=${e.name ?? e.entityId ?? e.kind} @click=${() => this.dispatchEvent(new CustomEvent<{ id: string }>('equipment-select', { detail: { id: e.id }, bubbles: true, composed: true }))}>${mpIcon(EQUIPMENT_ICONS[e.kind], 13)}</button>`)}
      ${this.houses.map(h => html`<button class="house glass" style=${at(h.at)} aria-pressed=${h.id === this.selected} title=${tr('Ouvrir {name}', { name: h.name })} @click=${() => this.choose(h.id)}>${mpIcon('home', 15)}<span>${h.name}</span>${h.lights ? html`<small title=${tr('{n} lumière allumée|{n} lumières allumées', { n: h.lights })}>${mpIcon('bulb', 11)}${h.lights}</small>` : nothing}</button>`)}
      <div class="rail glass">
        <button aria-label=${tr('Zoomer')} title=${tr('Zoomer')} @click=${() => this.zoom(1 / 1.5)}>${mpIcon('plus', 17)}</button>
        <button aria-label=${tr('Dézoomer')} title=${tr('Dézoomer')} @click=${() => this.zoom(1.5)}>${mpIcon('minus', 17)}</button>
        <button aria-label=${tr('Voir tout le domaine')} title=${tr('Voir tout le domaine')} @click=${this.fit}>${mpIcon('target', 17)}</button>
      </div>
      <span class="north" aria-hidden="true">N ↑</span>
      ${this.picking ? html`<span class="hint glass">${this.hint || tr('Touchez l’emplacement de la maison sur le plan de masse')}</span>` : !this.engaged ? html`<span class="hint glass">${tr('Glissez pour déplacer · pincez ou Ctrl + molette pour zoomer')}</span>` : nothing}
    </div>`;
  }
}
defineElement('mp-site-plan', MPSitePlan);
