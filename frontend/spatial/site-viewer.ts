import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { Hass } from '../ha/client';
import { mpIcon, type MPIconName } from '../icons';
import { LanguageController, tr } from '../i18n';
import type { MessageKey } from '../locales';
import { defineElement } from '../registry';
import './site';
import type { SiteHouse } from './site';
import type { SiteEquipment, SiteEquipmentKind, SpatialSite } from '../../shared/spatial';
import { equipmentActive, equipmentCommand, houseFrame } from '../../shared/site';
import type { SiteLook, SiteProjection, SiteScene, SiteTarget } from './site-scene';

/** A house of the domain as the 3D site plan shows it: placed on the plan, raised by its floors. */
export interface SiteHouse3D extends SiteHouse { floors?: number }
export type SiteCategory = 'overview' | 'lights' | 'irrigation' | 'access';
const CATEGORIES: Record<SiteCategory, { label: MessageKey; icon: MPIconName; kinds: SiteEquipmentKind[] }> = {
  overview: { label: 'Vue d’ensemble', icon: 'site', kinds: ['light', 'irrigation', 'gate', 'camera'] },
  lights: { label: 'Éclairage extérieur', icon: 'bulb', kinds: ['light'] },
  irrigation: { label: 'Arrosage', icon: 'drop', kinds: ['irrigation'] },
  access: { label: 'Accès et caméras', icon: 'gate', kinds: ['gate', 'camera'] },
};
const LEGENDS: Partial<Record<SiteCategory, [string, MessageKey][]>> = {
  lights: [['#ffd35a', 'Allumée'], ['#6d8497', 'Éteinte']],
  irrigation: [['#5ec8ff', 'Arrosage en cours'], ['#6d8497', 'À l’arrêt']],
  access: [['#8ff0c8', 'Ouvert'], ['#6d8497', 'Fermé']],
};
/** Height of a storey of a house on the site plan. */
const STOREY = 3;

/**
 * The site plan of a domain in 3D, in the style of the floor plans: the layers of its drawing, its houses as glass volumes,
 * the equipment of its grounds where it stands. A house chosen is flown to, its garden framed, and its inside opens from
 * there; each category (outdoor lighting, watering, gates and cameras) lights up what it holds, and a tap on a light or a
 * sprinkler turns it the other way, on a gate or a camera opens its window.
 */
export class MPSiteViewer extends LitElement {
  static properties = { site: { attribute: false }, houses: { attribute: false }, hass: { attribute: false }, category: { state: true }, selected: { state: true }, failed: { state: true }, labels: { state: true }, told: { state: true } };
  static styles = css`
    :host{display:block;color:#eff7ff;font:13px/1.5 var(--mp-body-font,Inter,system-ui,sans-serif);--accent:var(--mp-accent,#69b7ff);--line:rgba(214,236,255,.14);container-type:inline-size}
    *{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}
    button:focus-visible{outline:2px solid #a2d7ff;outline-offset:2px}
    .layout{display:grid;gap:12px;grid-template-columns:minmax(0,1fr) 300px;align-items:start}
    @container (max-width:820px){.layout{grid-template-columns:1fr}}
    .stage{position:relative;height:var(--mp-stage-height,clamp(380px,min(56cqw,70vh),620px));overflow:hidden;border-radius:var(--mp-radius,22px);background:radial-gradient(ellipse 65% 55% at 50% 60%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 72%),linear-gradient(180deg,rgba(3,16,29,.58),rgba(3,16,29,.82));border:1px solid rgba(214,236,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.07),0 24px 60px rgba(0,8,18,.18)}
    .canvas{position:absolute;inset:0}.canvas canvas{display:block;width:100%;height:100%;outline-offset:-4px;cursor:grab}
    .glass{background:rgba(5,20,34,.58);border:1px solid var(--line);backdrop-filter:blur(16px) saturate(140%);box-shadow:0 10px 28px rgba(0,8,18,.28)}
    .rail{position:absolute;top:12px;right:12px;z-index:2;display:flex;flex-direction:column;gap:2px;padding:4px;border-radius:16px}
    .rail button{display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:12px;background:transparent;color:#d6e6f5}.rail button:hover{background:rgba(255,255,255,.09)}
    .modes{position:absolute;left:12px;bottom:12px;z-index:2;display:flex;gap:3px;padding:3px;border-radius:13px;max-width:calc(100% - 24px);overflow-x:auto;scrollbar-width:none}
    .modes button{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 10px;border:0;border-radius:10px;background:transparent;font-size:12px;white-space:nowrap;color:#bed4e4}
    .modes button[aria-pressed=true]{background:#74b9eb30;color:#fff}
    @container (max-width:560px){.modes button:not([aria-pressed=true]) .label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}}
    .legend{position:absolute;bottom:62px;left:12px;z-index:1;color:#cde0eb;font-size:10px;pointer-events:none}
    .legend b{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.legend span{margin-right:8px;white-space:nowrap}
    /* A house's name above its roof, like a room's name on the floor plans. */
    .labels{position:absolute;inset:0;z-index:1;pointer-events:none}
    .labels button{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;display:flex;align-items:center;gap:6px;width:max-content;max-width:190px;min-height:28px;padding:3px 12px;border-radius:999px;border:1px solid rgba(206,230,255,.2);background:rgba(6,22,38,.66);box-shadow:inset 0 1px rgba(255,255,255,.08),0 6px 18px rgba(0,8,18,.36);backdrop-filter:blur(12px) saturate(140%);font-size:12px;font-weight:600;color:#f2f8ff;white-space:nowrap}
    .labels button span{overflow:hidden;text-overflow:ellipsis}.labels button small{font-weight:600;color:#ffd35a;font-size:11px}
    .labels button[aria-pressed=true]{z-index:1;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 80%,transparent),rgba(38,94,149,.78));border-color:color-mix(in srgb,var(--accent) 70%,white)}
    .toast{position:absolute;left:50%;top:14px;z-index:2;transform:translateX(-50%);max-width:calc(100% - 120px);overflow:hidden;text-overflow:ellipsis;padding:6px 13px;border-radius:999px;font-size:11.5px;color:#e6f2fb;pointer-events:none;white-space:nowrap}
    .card{position:relative;overflow:hidden;padding:18px;border-radius:var(--mp-radius,22px);background:linear-gradient(150deg,color-mix(in srgb,var(--mp-tint,#12344f) 74%,transparent),rgba(6,22,38,.82) 70%);border:1px solid color-mix(in srgb,var(--accent) 22%,rgba(224,239,255,.22));box-shadow:0 22px 50px rgba(0,8,18,.34),inset 0 1px rgba(255,255,255,.1);backdrop-filter:blur(var(--mp-blur,24px)) saturate(140%)}
    .card header{display:flex;align-items:center;gap:13px}
    .orb{display:grid;place-items:center;width:46px;height:46px;flex:0 0 auto;border-radius:var(--mp-icon-radius,16px);color:#e3f2ff;background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--accent) 42%,transparent),color-mix(in srgb,var(--accent) 8%,transparent));border:1px solid color-mix(in srgb,var(--accent) 34%,transparent)}
    .title{flex:1;min-width:0}.title small{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#a9c0d6}
    .title h3{margin:3px 0 0;font:21px/1.15 var(--mp-display-font,Georgia,serif);font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .stats{display:grid;gap:8px;margin-top:16px}
    .stat{display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 12px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(214,236,255,.09)}
    .stat>span:nth-child(2){flex:1}.stat strong{font-variant-numeric:tabular-nums}.stat.active{border-color:color-mix(in srgb,var(--tone) 50%,transparent);color:var(--tone)}
    .stat button{white-space:nowrap;min-height:30px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:rgba(11,37,61,.8);font-size:11px;color:#dce9f5}
    .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .actions button{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent);color:#eef7ff}
    .actions button.quiet{border-color:var(--line);background:rgba(5,23,39,.35)}
    .muted{margin:14px 0 0;color:#a9c0d6;font-size:12px}
  `;
  site?: SpatialSite;
  houses: SiteHouse3D[] = [];
  hass?: Hass;
  category: SiteCategory = 'overview';
  /** The house flown to, its garden framed; none for the whole domain. */
  selected?: string;
  /** WebGL is missing: the site plan is drawn flat instead. */
  failed = false;
  labels: SiteProjection = new Map();
  /** What the last tap turned, told for a moment over the plan. */
  told?: string;
  private toldTimer = 0;
  private scene?: SiteScene;
  private loading = false;
  private drawn?: { site: SpatialSite; houses: SiteHouse3D[] };
  private language = new LanguageController(this);

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('houses') && this.selected && !this.houses.some(h => h.id === this.selected)) this.selected = undefined;
    if (changed.has('site') && !this.categories().includes(this.category)) this.category = 'overview';
  }
  disconnectedCallback() { this.scene?.dispose(); this.scene = undefined; this.drawn = undefined; clearTimeout(this.toldTimer); super.disconnectedCallback(); }

  protected async updated(changed: PropertyValues<this>) {
    if (!this.site || this.failed) return;
    if (!this.scene && !this.loading) {
      this.loading = true;
      try {
        const { SiteScene } = await import('./site-scene');
        const host = this.renderRoot.querySelector<HTMLElement>('.canvas');
        if (!this.isConnected || !host) return;
        this.scene = new SiteScene(host, target => this.touched(target), labels => { this.labels = labels; }, tr('Plan de masse 3D du domaine'));
      } catch { this.failed = true; return; }
      finally { this.loading = false; }
    }
    if (!this.scene) return;
    const houses = this.houses;
    if (this.drawn?.site !== this.site || !sameHouses(this.drawn.houses, houses)) {
      const reset = !this.drawn;
      this.drawn = { site: this.site, houses };
      this.scene.setSite(this.site, houses.map(h => ({ id: h.id, at: h.at, ...(h.outline ? { outline: h.outline } : {}), height: Math.max(1, h.floors ?? 1) * STOREY + .4 })), this.equipment(), reset);
      if (reset && this.selected) this.frame(this.selected);
    }
    if (changed.has('hass') || changed.has('category') || changed.has('selected') || changed.has('site') || changed.has('houses')) this.scene.style(this.look());
  }
  private equipment(): SiteEquipment[] { return this.site?.equipment ?? []; }
  /** The categories this domain has equipment for, the overview first. */
  private categories(): SiteCategory[] {
    const kinds = new Set(this.equipment().map(e => e.kind));
    return (Object.keys(CATEGORIES) as SiteCategory[]).filter(c => c === 'overview' || CATEGORIES[c].kinds.some(k => kinds.has(k)));
  }
  private active(item: SiteEquipment) { return !!item.entityId && equipmentActive(item, this.hass?.states[item.entityId]); }
  /** Each piece of equipment in its state, and whether the category shown holds it. */
  private look(): SiteLook {
    const kinds = CATEGORIES[this.category].kinds, look = { selected: this.selected, muted: new Set<string>(), lit: new Set<string>(), wet: new Set<string>(), open: new Set<string>() };
    for (const item of this.equipment()) {
      if (!kinds.includes(item.kind)) look.muted.add(item.id);
      if (this.active(item)) (item.kind === 'light' ? look.lit : item.kind === 'irrigation' ? look.wet : look.open).add(item.id);
    }
    return look;
  }
  private frame(id?: string) {
    const house = id ? this.houses.find(h => h.id === id) : undefined;
    if (house) this.scene?.frame(houseFrame(house)); else this.scene?.overview();
  }
  /** Flies to a house and its garden, or back over the whole domain. */
  select(id?: string) { this.selected = id; this.frame(id); }
  /** The inside of a house, in the 3D plan of its floors. */
  private enter(id: string) { this.dispatchEvent(new CustomEvent<{ id: string }>('house-select', { detail: { id }, bubbles: true, composed: true })); }
  /** A tap on the plan: a house is chosen; a light or a sprinkler turned the other way; a gate or a camera shows its window. */
  private touched(target: SiteTarget) {
    if (!target) return;
    if (target.type === 'house') { this.select(this.selected === target.id ? undefined : target.id); return; }
    const item = this.equipment().find(e => e.id === target.id);
    if (!item?.entityId) return;
    const command = item.kind === 'light' || item.kind === 'irrigation' ? equipmentCommand(item, this.hass?.states[item.entityId], !this.active(item)) : undefined;
    if (command) { void this.run([item], !this.active(item)); return; }
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: item.entityId }, bubbles: true, composed: true }));
  }
  private tell(text: string) {
    this.told = text; clearTimeout(this.toldTimer);
    this.toldTimer = window.setTimeout(() => { this.told = undefined; }, 2400);
  }
  private name(item: SiteEquipment) { return item.name ?? String(this.hass?.states[item.entityId ?? '']?.attributes.friendly_name ?? item.entityId ?? ''); }
  /** Turns `items` on or off, those already so left alone. */
  private async run(items: SiteEquipment[], on: boolean) {
    const hass = this.hass;
    if (!hass) return;
    const changing = items.filter(item => item.entityId && this.active(item) !== on);
    if (changing.length === 1) {
      const item = changing[0]!;
      this.tell(`${this.name(item)} · ${tr(item.kind === 'light' ? (on ? 'Allumée' : 'Éteinte') : item.kind === 'irrigation' ? (on ? 'Arrosage en cours' : 'À l’arrêt') : on ? 'Ouvert' : 'Fermé')}`);
    }
    for (const item of changing) {
      const command = equipmentCommand(item, hass.states[item.entityId!], on);
      if (command) {
        try { await hass.callService(command.domain, command.service, { entity_id: item.entityId }); }
        catch { this.tell(tr('Commande refusée par Home Assistant.')); }
      }
    }
  }

  private card() {
    const house = this.houses.find(h => h.id === this.selected);
    // The equipment of the house's garden, or of the whole domain.
    const scope = this.equipment().filter(e => !house || e.buildingId === house.id);
    const stat = (icon: MPIconName, label: MessageKey, kinds: SiteEquipmentKind[], tone: string, off: MessageKey) => {
      const items = scope.filter(e => kinds.includes(e.kind) && e.entityId), on = items.filter(e => this.active(e));
      if (!items.length) return nothing;
      return html`<div class=${on.length ? 'stat active' : 'stat'} style=${`--tone:${tone}`}>${mpIcon(icon, 18)}<span>${tr(label)}</span><strong>${on.length}/${items.length}</strong>
        ${on.length ? html`<button @click=${() => void this.run(on, false)}>${tr(off)}</button>` : nothing}</div>`;
    };
    const stats = [
      stat('bulb', 'Éclairage extérieur', ['light'], '#ffd35a', 'Tout éteindre'),
      stat('drop', 'Zones en arrosage', ['irrigation'], '#5ec8ff', 'Tout arrêter'),
      stat('gate', 'Accès ouverts', ['gate'], '#8ff0c8', 'Tout fermer'),
    ].filter(s => s !== nothing);
    const body = stats.length ? html`<div class="stats">${stats}</div>` : html`<p class="muted">${tr(house ? 'Aucun équipement extérieur placé dans ce jardin.' : 'Placez l’éclairage, l’arrosage, les portails et les caméras du domaine dans le Studio.')}</p>`;
    if (house) return html`<article class="card" aria-live="polite">
      <header><span class="orb">${mpIcon('home', 24)}</span><div class="title"><small>${tr('Maison')}</small><h3>${house.name}</h3></div></header>
      ${body}
      <div class="actions"><button @click=${() => this.enter(house.id)}>${mpIcon('plan', 17)} ${tr('Voir l’intérieur')}</button>
      <button class="quiet" @click=${() => this.select(undefined)}>${mpIcon('site', 17)} ${tr('Voir tout le domaine')}</button></div></article>`;
    return html`<article class="card">
      <header><span class="orb">${mpIcon('site', 24)}</span><div class="title"><small>${tr('Domaine')}</small><h3>${tr('Vue d’ensemble')}</h3></div></header>
      ${body}</article>`;
  }

  /** The labels of the houses on screen, each lifted above those it would cover, the one chosen left in place. */
  private placed() {
    const shown = this.houses.flatMap(h => { const at = this.labels.get(h.id); return at?.visible ? [{ id: h.id, x: at.x, y: at.y, w: h.name.length * 7.4 + (h.lights ? 64 : 44) }] : []; });
    shown.sort((a, b) => Number(b.id === this.selected) - Number(a.id === this.selected) || b.y - a.y);
    const kept: typeof shown = [];
    for (const label of shown) {
      for (let tries = 0; tries < 8 && kept.some(k => Math.abs(k.x - label.x) < (k.w + label.w) / 2 + 4 && Math.abs(k.y - label.y) < 32); tries++) label.y -= 16;
      kept.push(label);
    }
    return new Map(kept.map(k => [k.id, { x: k.x, y: k.y }]));
  }
  render() {
    if (!this.site) return nothing;
    if (this.failed) return html`<mp-site-plan .site=${this.site} .houses=${this.houses}></mp-site-plan>`;
    const categories = this.categories(), legend = LEGENDS[this.category];
    return html`<div class="layout">
      <div class="stage">
        <div class="canvas"></div>
        <div class="labels">${this.houses.map(h => {
          const at = this.placed().get(h.id);
          if (!at) return nothing;
          return html`<button data-house=${h.id} aria-pressed=${this.selected === h.id} style=${`left:${at.x}px;top:${at.y}px`} title=${tr('Ouvrir {name}', { name: h.name })} @click=${() => this.select(this.selected === h.id ? undefined : h.id)} @dblclick=${() => this.enter(h.id)}>${mpIcon('home', 14)}<span>${h.name}</span>${h.lights ? html`<small>${h.lights}</small>` : nothing}</button>`;
        })}</div>
        ${this.told ? html`<div class="toast glass" role="status">${this.told}</div>` : nothing}
        <div class="rail glass">
          <button aria-label=${tr('Zoomer')} title=${tr('Zoomer')} @click=${() => this.scene?.zoom(.75)}>${mpIcon('plus', 18)}</button>
          <button aria-label=${tr('Dézoomer')} title=${tr('Dézoomer')} @click=${() => this.scene?.zoom(1 / .75)}>${mpIcon('minus', 18)}</button>
          <button aria-label=${tr('Recentrer')} title=${tr('Recentrer')} @click=${() => this.frame(this.selected)}>${mpIcon('target', 18)}</button>
        </div>
        ${legend ? html`<div class="legend">${legend.map(([color, text]) => html`<span><b style=${`background:${color}`}></b>${tr(text)}</span>`)}</div>` : nothing}
        ${categories.length > 1 ? html`<div class="modes glass" role="group" aria-label=${tr('Catégories')}>${categories.map(c => html`<button aria-pressed=${this.category === c} data-category=${c} @click=${() => { this.category = c; }}>${mpIcon(CATEGORIES[c].icon, 16)}<span class="label">${tr(CATEGORIES[c].label)}</span></button>`)}</div>` : nothing}
      </div>
      <aside>${this.card()}</aside>
    </div>`;
  }
}
/** The same houses, standing at the same places with as many floors: the scene need not be drawn again. */
function sameHouses(a: SiteHouse3D[], b: SiteHouse3D[]) {
  return a.length === b.length && a.every((h, i) => { const o = b[i]!; return h.id === o.id && h.at === o.at && h.outline === o.outline && h.floors === o.floors; });
}
defineElement('mp-site-viewer', MPSiteViewer);
