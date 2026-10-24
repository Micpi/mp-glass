import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import type { AppearanceConfig, HAState, NavigationConfig } from '../../shared/models';
import { MP_GLASS_BACKGROUND } from '../background';
import { mpIcon, type MPIconName } from '../icons';
import { buildingPlan, planBuildings, type SpatialFloor, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { canMedia, contactSensor, coverOpen, coverPosition, finite, mediaIsTv, mediaOn, mediaPlaying, mediaVolume, nowPlaying, roomEntityIds, roomTemperature, type PlanMode } from '../../shared/spatial-state';
import { available } from '../../shared/capabilities';
import type { Hass } from '../ha/client';
import { claimHeader, releaseHeader } from '../ha/header';
import '../spatial/viewer';
import { PLAN_LAYERS, roomIcon } from '../spatial/viewer';
import { domainOf, entityIcon, kindOf, RUN_SERVICES, stateDetail, stateLabel, TOGGLE_DOMAINS } from '../entities';
import '../detail';
import { chooseLanguage, language, LANGUAGE_NAMES, LANGUAGES, LanguageController, locale, tr, trPlan, type Language } from '../i18n';
import { flag } from '../flags';
import { projectLogoMark } from '../../shared/project';
import { nexusStyles } from './styles';

type ViewKind = 'home'|'lights'|'rooms'|'area'|'inventory'|'info'|'media'|'plus';
/** The four ways MP Nexus v2 lays itself out: phone, tablet held upright, tablet held sideways, computer. */
type Layout = 'phone'|'portrait'|'rail'|'desk';
type Tab = 'home'|'lights'|'rooms'|'media'|'plus';
interface AreaSummary { id:string; name:string; icon?:string; picture?:string; deviceCount:number; lightCount:number }
interface ViewConfig {
  title?: string;
  mp_project_name?: string;
  mp_spatial?: SpatialPlan;
  mp_spatial_origin?: 'project'|'areas'|'example';
  mp_appearance?: AppearanceConfig;
  mp_navigation?: NavigationConfig;
  mp_view_kind?: ViewKind;
  mp_view_path?: string;
  mp_view_title?: string;
  mp_areas?: AreaSummary[];
  mp_inventory?: { title:string; count:number };
  mp_info?: { version?: string; deviceCount: number; lightCount: number; areaCount: number };
  mp_entities?: string[];
  mp_media?: string[];
}
interface PlacedRoom { room: SpatialRoom; floor: SpatialFloor }

/** Kept in this browser, shared with the v1 view: the house of the domain the plan shows. */
const BUILDING_KEY = 'mp-glass.building';
function readBuilding(): string { try { return localStorage.getItem(BUILDING_KEY) ?? ''; } catch { return ''; } }
/** The layer chosen on the plan, kept from one page to the next while the dashboard stays open. */
let chosenLayer: PlanMode = 'lights';
/** Each page opens its plan on the layer that speaks of it; the others keep the layer last chosen. */
const PAGE_LAYERS: Partial<Record<ViewKind, PlanMode>> = { lights: 'lights', media: 'media' };
const TABS: Record<Tab, { label: 'Accueil'|'Lumières'|'Pièces'|'Multimédia'|'Plus'; icon: MPIconName }> = {
  home: { label: 'Accueil', icon: 'home' }, lights: { label: 'Lumières', icon: 'bulb' }, rooms: { label: 'Pièces', icon: 'rooms' },
  media: { label: 'Multimédia', icon: 'music' }, plus: { label: 'Plus', icon: 'dots' },
};
/** Domains a touch switches; the others open their window. */
const SWITCHED = ['light', 'cover', ...TOGGLE_DOMAINS];
const HOLD_MS = 520;
/** The translated plan of the areas or of the example, made once per plan and language: the 3D plan redraws only when it changes. */
const translated = new WeakMap<SpatialPlan, Map<string, SpatialPlan>>();

export class MPNexusView extends LitElement {
  static properties = { cards:{attribute:false}, badges:{attribute:false}, hass:{attribute:false}, layout:{state:true}, room:{state:true}, full:{state:true}, layer:{state:true}, shownLayer:{state:true}, layers:{state:true}, detail:{state:true}, languageOpen:{state:true}, floorFilter:{state:true}, player:{state:true}, online:{state:true} };
  static styles = nexusStyles;

  cards: HTMLElement[] = [];
  badges: HTMLElement[] = [];
  hass?: Hass;
  private language = new LanguageController(this);
  private projectName = '';
  private spatial?: SpatialPlan;
  private spatialOrigin: ViewConfig['mp_spatial_origin'] = 'project';
  private appearance: AppearanceConfig = { preset: 'glass-blue' };
  private navigation: NavigationConfig = { items: ['home', 'lights', 'rooms'], showLabels: true };
  private kind: ViewKind = 'home';
  private path = 'home';
  private viewTitle = '';
  private areas: AreaSummary[] = [];
  private inventory?: ViewConfig['mp_inventory'];
  private info?: ViewConfig['mp_info'];
  private entities: string[] = [];
  private media: string[] = [];
  private building = readBuilding();
  private layout: Layout = 'desk';
  /** The room opened from the plan: its card beside the plan, in a sheet on a phone. */
  private room = '';
  private full = false;
  private layer: PlanMode = chosenLayer;
  /** What the plan shows: the layer asked for when the floors shown offer it, else its lights. */
  private shownLayer: PlanMode = 'lights';
  private layers: PlanMode[] = ['lights'];
  private detail = '';
  private languageOpen = false;
  private floorFilter = '';
  private player = '';
  private online = true;
  private header?: Element;
  private clock?: number;
  private hold?: number;
  private held = false;
  private resize = new ResizeObserver(() => this.measure());
  private connectionWatched?: object;

  setConfig(config: ViewConfig) {
    this.projectName = config?.mp_project_name ?? config?.title ?? '';
    this.spatial = config?.mp_spatial;
    this.spatialOrigin = config?.mp_spatial_origin ?? 'project';
    this.appearance = config?.mp_appearance ?? { preset: 'glass-blue' };
    this.navigation = config?.mp_navigation ?? { items: ['home', 'lights', 'rooms'], showLabels: true };
    this.kind = config?.mp_view_kind ?? 'home';
    this.path = config?.mp_view_path ?? 'home';
    this.viewTitle = config?.mp_view_title ?? '';
    this.areas = config?.mp_areas ?? [];
    this.inventory = config?.mp_inventory;
    this.info = config?.mp_info;
    this.entities = config?.mp_entities ?? [];
    this.media = config?.mp_media ?? [];
    this.layer = PAGE_LAYERS[this.kind] ?? chosenLayer;
    this.toggleAttribute('motion', this.appearance.motion !== false);
    const a = this.appearance;
    const vars: Record<string, string> = { accent: a.accent ?? '#69b7ff', tint: a.glassTint ?? '#12344f', opacity: String(a.glassOpacity ?? .62), blur: `${a.glassBlur ?? 22}px`, shadow: String(a.shadowStrength ?? .35), radius: `${a.radius ?? 24}px`, 'max-width': `${Math.max(1200, a.maxWidth ?? 1560)}px`, 'bg-blur': `${a.backgroundBlur ?? 0}px`, 'bg-saturation': String(a.backgroundSaturation ?? 1),
      'display-font': a.fontStyle === 'modern' ? 'Inter,system-ui,sans-serif' : a.fontStyle === 'soft' ? 'ui-rounded,system-ui,sans-serif' : 'Georgia,serif' };
    for (const [name, value] of Object.entries(vars)) this.style.setProperty(`--mp-${name}`, value);
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    this.header = claimHeader(this);
    this.addEventListener('hass-more-info', this.interceptMoreInfo);
    addEventListener('resize', this.measure);
    addEventListener('keydown', this.escape);
    addEventListener('pointerdown', this.outside);
    this.resize.observe(this);
    this.clock = window.setInterval(() => this.requestUpdate(), 30_000);
    this.measure();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.header) releaseHeader(this.header, this);
    this.header = undefined;
    this.removeEventListener('hass-more-info', this.interceptMoreInfo);
    removeEventListener('resize', this.measure);
    removeEventListener('keydown', this.escape);
    removeEventListener('pointerdown', this.outside);
    this.resize.disconnect();
    clearInterval(this.clock);
  }
  protected updated() { this.watchConnection(); }

  /** The app fills the screen below Home Assistant's bar; its layout follows the width and the way the screen is held. */
  private measure = () => {
    const top = Math.max(0, this.getBoundingClientRect().top), height = Math.max(380, innerHeight - top), width = this.clientWidth || innerWidth;
    this.style.setProperty('--mp-app-height', `${height}px`);
    const layout: Layout = width < 700 || (height < 520 && width < 1000) ? 'phone' : width >= 1200 ? 'desk' : height > width ? 'portrait' : 'rail';
    if (layout !== this.layout || this.getAttribute('layout') !== layout) { this.layout = layout; this.setAttribute('layout', layout); }
  };
  private watchConnection() {
    const conn = this.hass?.connection as unknown as { connected?: boolean; addEventListener?: (type: string, listener: () => void) => void } | undefined;
    if (!conn?.addEventListener || this.connectionWatched === conn) return;
    this.connectionWatched = conn;
    const update = () => { this.online = conn.connected !== false; };
    for (const type of ['ready', 'reconnected', 'disconnected']) conn.addEventListener(type, update);
    update();
  }
  private escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || this.detail) return;
    if (this.languageOpen) this.languageOpen = false;
    else if (this.full) this.full = false;
    else if (this.room && this.layout === 'phone') this.room = '';
  };
  private outside = (e: Event) => {
    if (this.languageOpen && !e.composedPath().some(node => node instanceof HTMLElement && node.classList.contains('language'))) this.languageOpen = false;
  };
  /** Every more-info asked on this page opens the MP Nexus window instead, as on the v1 pages. */
  private interceptMoreInfo = (event: Event) => {
    const detail = (event as CustomEvent<{ entityId?: unknown; mpNative?: unknown } | undefined>).detail;
    if (detail?.mpNative === true) return;
    const entityId = typeof detail?.entityId === 'string' ? detail.entityId : '';
    if (!entityId.includes('.')) return;
    event.stopPropagation();
    this.detail = entityId;
  };

  // ——— Places ———
  private route(path: string) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return `/${[...parts.slice(0, -1), path].join('/')}`;
  }
  /** Goes to another page the way a link would, so Home Assistant keeps its own navigation. */
  private go(path: string) {
    const link = document.createElement('a');
    link.href = path.startsWith('/') ? path : this.route(path);
    this.renderRoot.appendChild(link);
    link.click();
    link.remove();
  }
  private areaPath(areaId?: string) { return areaId && this.areas.some(a => a.id === areaId) ? `area-${areaId}` : undefined; }
  private areaHref = (areaId: string) => { const path = this.areaPath(areaId); return path ? this.route(path) : undefined; };
  private get tab(): Tab { return this.kind === 'area' || this.kind === 'inventory' ? (this.kind === 'area' ? 'rooms' : 'plus') : this.kind === 'info' ? 'plus' : this.kind; }
  private get tabs(): Tab[] { return [...this.navigation.items, 'media', 'plus']; }

  // ——— The plan ———
  /** The plan of the house shown, its names in the interface language when MP Nexus drew it. */
  private get plan(): SpatialPlan | undefined {
    const spatial = this.spatial;
    if (!spatial?.enabled || !spatial.floors.length) return undefined;
    let named = spatial;
    if (this.spatialOrigin !== 'project') {
      const cache = translated.get(spatial) ?? new Map<string, SpatialPlan>(), key = language();
      named = cache.get(key) ?? trPlan(spatial, this.spatialOrigin === 'example');
      translated.set(spatial, cache.set(key, named));
    }
    return buildingPlan(named, this.building);
  }
  private get placed(): PlacedRoom[] { return this.plan?.floors.flatMap(floor => floor.rooms.map(room => ({ room, floor }))) ?? []; }
  private find(roomId: string) { return this.placed.find(p => p.room.id === roomId); }
  private get houses() { return this.spatial?.enabled ? planBuildings(this.spatial).filter(h => h.floors.length) : []; }
  private chooseHouse(id: string) {
    this.building = id; this.room = '';
    try { localStorage.setItem(BUILDING_KEY, id); } catch { /* The choice holds for this page only. */ }
  }
  private planAmbiance = (e: CustomEvent<{ mode: PlanMode; floorIds: string[]; modes?: PlanMode[] }>) => {
    this.shownLayer = e.detail.mode;
    if (e.detail.modes?.length) this.layers = e.detail.modes;
  };
  private chooseLayer(mode: PlanMode) { this.layer = mode; this.shownLayer = mode; chosenLayer = mode; }
  /** A room touched on the plan: its card on the home page, its group of lights, its own page from the rooms. */
  private planRoom = (e: CustomEvent<{ roomId: string }>) => {
    const roomId = e.detail.roomId, placed = this.find(roomId);
    if (!placed) return;
    if (!this.full && (this.kind === 'rooms' || this.kind === 'area')) {
      const path = this.areaPath(placed.room.areaId);
      if (path && path !== this.path) { this.go(path); return; }
    }
    this.room = roomId;
    if (this.kind === 'lights') this.renderRoot.querySelector(`[data-room="${CSS.escape(roomId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  private planDeselect = () => { if (this.kind !== 'area') this.room = ''; };
  private viewer(opts: { focus?: string; expandable?: boolean; quiet?: boolean; key: string }) {
    const plan = this.plan;
    if (!plan) return nothing;
    return keyed(`${opts.key}|${this.building}`, html`<mp-spatial-viewer bare ?quiet=${opts.quiet ?? false} ?expandable=${opts.expandable ?? false} .plan=${plan} .scope=${this.building} .hass=${this.hass} .areaHref=${this.areaHref}
      .layer=${this.layer} .focusRoom=${opts.focus ?? this.room} @plan-ambiance=${this.planAmbiance} @room-select=${this.planRoom} @room-deselect=${this.planDeselect}
      @plan-expand=${() => { this.full = true; }}></mp-spatial-viewer>`);
  }
  /** The plan as a banner on a phone, a button to open it on the whole screen. */
  private banner(height: number, viewer: unknown) {
    return html`<div class="plan3d banner" style=${`--banner:${height}px`}>${viewer}<button class="ib fsb" aria-label=${tr('Plan en plein écran')} title=${tr('Plan en plein écran')} @click=${() => { this.full = true; }}>${mpIcon('expand', 16)}</button></div>`;
  }
  private layerButtons() {
    const offered = this.layers.length ? this.layers : ['lights' as PlanMode];
    if (offered.length < 2) return nothing;
    return html`<div class="layers" role="group" aria-label=${tr('Ambiance du plan')}>${offered.map(mode => html`<button aria-pressed=${mode === this.shownLayer} @click=${() => this.chooseLayer(mode)}>${mpIcon(PLAN_LAYERS[mode].icon, 15)}<span>${mode === 'media' ? tr('Médias') : tr(PLAN_LAYERS[mode].label)}</span></button>`)}</div>`;
  }
  private houseButtons() {
    const houses = this.houses;
    if (houses.length < 2) return nothing;
    const current = buildingPlan(this.spatial!, this.building).floors[0];
    return html`<div class="houses" role="group" aria-label=${tr('Maisons du domaine')}>${houses.map(({ building, floors }) => html`<button class="pill" aria-pressed=${floors[0] === current} @click=${() => this.chooseHouse(building.id)}>${mpIcon('home', 13)}${building.name || tr('Maison')}</button>`)}</div>`;
  }

  // ——— Devices ———
  private state(id: string): HAState | undefined { return this.hass?.states[id]; }
  private on(id: string) {
    const state = this.state(id), domain = domainOf(id);
    if (!available(state)) return false;
    if (domain === 'cover') return coverOpen(state) === true;
    if (domain === 'media_player') return mediaOn(state);
    if (domain === 'climate') return state!.state !== 'off';
    return state!.state === 'on';
  }
  private name(id: string, room = '') {
    const name = String(this.state(id)?.attributes.friendly_name ?? id), rest = name.slice(room.length);
    if (!room || !/^[\s·:|/–—-]/.test(rest) || name.slice(0, room.length).localeCompare(room, undefined, { sensitivity: 'base' }) !== 0) return name;
    return rest.replace(/^[\s·:|/–—-]+/, '') || name;
  }
  private call(domain: string, service: string, data: Record<string, unknown>) { void this.hass?.callService(domain, service, data); }
  /** A touch: a light, a shutter or a switch changes; a scene runs; a player pauses or plays; the rest opens its window. */
  private act(id: string) {
    if (this.held) { this.held = false; return; }
    const domain = domainOf(id), state = this.state(id);
    if (!available(state)) { this.detail = id; return; }
    if (SWITCHED.includes(domain)) this.call(domain, 'toggle', { entity_id: id });
    else if (RUN_SERVICES[domain]) this.call(domain, RUN_SERVICES[domain]!, { entity_id: id });
    else if (domain === 'media_player' && mediaOn(state) && canMedia(state, 'pause')) this.call('media_player', 'media_play_pause', { entity_id: id });
    else this.detail = id;
  }
  private press(id: string) { clearTimeout(this.hold); this.held = false; this.hold = window.setTimeout(() => { this.held = true; this.detail = id; }, HOLD_MS); }
  private release = () => clearTimeout(this.hold);
  /** A device in a tile: a touch for its main action, a long press or its corner button for everything else. */
  private tile(id: string, room = '') {
    const state = this.state(id), on = this.on(id), domain = domainOf(id), name = this.name(id, room);
    const detail = stateDetail(id, state), label = stateLabel(id, state);
    const tone = !available(state) ? 'off' : on ? (domain === 'light' ? 'on' : 'blue') : '';
    return html`<div class=${`tl ${tone}`}>
      <button class="tap" title=${name} @click=${() => this.act(id)} @pointerdown=${() => this.press(id)} @pointerup=${this.release} @pointerleave=${this.release} @pointercancel=${this.release} @contextmenu=${(e: Event) => { e.preventDefault(); this.release(); this.detail = id; }}>
        <span class="ti">${mpIcon(entityIcon(id, state), 18)}</span><b>${name}</b><small>${detail && on ? `${label} · ${detail}` : label}</small>
      </button>
      <button class="more" aria-label=${tr('Détails de {name}', { name })} title=${tr('Détails')} @click=${() => { this.detail = id; }}>${mpIcon('dots', 16)}</button>
    </div>`;
  }
  private format(value: number, digits = 1) { return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value); }
  private temperature(room: SpatialRoom) { return roomTemperature(room, this.hass?.states ?? {}, this.hass?.config?.unit_system?.temperature ?? '°C'); }
  private humidity(room: SpatialRoom) {
    const id = roomEntityIds(room).find(e => this.state(e)?.attributes.device_class === 'humidity');
    const value = id ? finite(this.state(id)?.state) : undefined;
    return value === undefined ? undefined : `${this.format(value, 0)} %`;
  }
  private lightsIn(ids: string[]) { return ids.filter(id => id.startsWith('light.') && !!this.state(id)); }
  private allOff(ids: string[]) {
    const lights = this.lightsIn(ids).filter(id => this.on(id));
    if (lights.length) this.call('light', 'turn_off', { entity_id: lights });
  }

  // ——— Pieces of the pages ———
  private head(title: string, sub = '', right: TemplateResult | typeof nothing = nothing, back?: string) {
    return html`<div class="hd">${back ? html`<a class="ib" href=${this.route(back)} aria-label=${tr('Retour')} title=${tr('Retour')}>${mpIcon('back', 18)}</a>` : nothing}
      <div>${sub ? html`<div class="lbl">${sub}</div>` : nothing}<div class="title serif">${title}</div></div>${right === nothing ? nothing : html`<div class="rgt">${right}</div>`}</div>`;
  }
  private greeting() {
    const hour = new Date().getHours(), hello = hour < 12 ? tr('Bonjour') : hour < 18 ? tr('Bon après-midi') : tr('Bonsoir');
    const first = this.hass?.user?.name?.trim().split(/\s+/)[0];
    return first ? `${hello} ${first}` : hello;
  }
  private navLink(tab: Tab, compact = false) {
    const meta = TABS[tab], current = this.tab === tab;
    return html`<a href=${this.route(tab)} aria-current=${current ? 'page' : nothing} title=${tr(meta.label)}>${mpIcon(meta.icon, compact ? 20 : 18)}<span>${tr(meta.label)}</span></a>`;
  }
  private languageMenu(placement: 'button'|'row') {
    const current = language(), label = tr('Langue : {language}', { language: LANGUAGE_NAMES[current] });
    const toggle = () => { this.languageOpen = !this.languageOpen; };
    const trigger = placement === 'row'
      ? html`<button class="rw" aria-haspopup="menu" aria-expanded=${this.languageOpen} @click=${toggle}><span class="ib">${flag(current)}</span><div><b>${tr('Langue de l’interface')}</b><small>${LANGUAGE_NAMES[current]}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`
      : html`<button class="ib" aria-haspopup="menu" aria-expanded=${this.languageOpen} aria-label=${label} title=${label} @click=${toggle}>${flag(current)}</button>`;
    return html`<div class="language">${trigger}${this.languageOpen ? html`<div class="menu" role="menu" aria-label=${tr('Langue de l’interface')}>${LANGUAGES.map(value => html`<button role="menuitemradio" aria-checked=${value === current} lang=${value} @click=${() => { this.languageOpen = false; chooseLanguage(value as Language, this.hass); }}>${flag(value)}<span>${LANGUAGE_NAMES[value]}</span></button>`)}</div>` : nothing}</div>`;
  }
  private clockFace() {
    const now = new Date();
    return html`<div class="clock"><b>${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(now)}</b><small title=${this.online ? tr('Connecté à Home Assistant') : tr('Connexion interrompue, reconnexion…')}><i class=${this.online ? '' : 'off'}></i>${new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(now)}</small></div>`;
  }
  private get mark() { return this.appearance.logoMark?.trim() || projectLogoMark(this.projectName || tr('Maison')); }
  private navigationBar() {
    if (this.layout === 'desk') return html`<header class="dhead glass"><span class="logo" aria-hidden="true">${this.mark}</span><div class="brand"><b>${this.projectName || tr('Maison')}</b><div class="lbl">${tr('{n} pièce|{n} pièces', { n: this.placed.length || this.areas.length })}</div></div>
      <nav aria-label=${tr('Navigation')}>${this.tabs.map(tab => this.navLink(tab))}</nav>${this.appearance.showClock === false ? html`<span style="margin-left:auto"></span>` : this.clockFace()}${this.languageMenu('button')}</header>`;
    if (this.layout === 'rail') return html`<nav class="rail" aria-label=${tr('Navigation')}><span class="logo" aria-hidden="true">${this.mark}</span>${this.tabs.map(tab => this.navLink(tab, true))}</nav>`;
    return html`<nav class="tabbar glass" aria-label=${tr('Navigation')}>${this.tabs.map(tab => this.navLink(tab, true))}</nav>`;
  }

  /** The room opened from the plan: its state, its main devices, and its page. */
  private roomCard(placed: PlacedRoom, where: 'side'|'sheet'|'float') {
    const { room, floor } = placed, ids = roomEntityIds(room).filter(id => this.state(id));
    const quick = ids.filter(id => ['light', 'cover', 'media_player', 'climate', ...TOGGLE_DOMAINS].includes(domainOf(id)));
    const temperature = this.temperature(room), humidity = this.humidity(room), path = this.areaPath(room.areaId);
    const reading = [temperature ? `${this.format(temperature.value)}°` : '', humidity ?? ''].filter(Boolean).join(' · ');
    const close = html`<button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${() => { this.room = ''; }}>${mpIcon('close', 16)}</button>`;
    return html`${where === 'sheet' ? html`<div class="grab"></div>` : nothing}
      ${this.head(room.name, (this.plan?.floors.length ?? 0) > 1 ? floor.name : tr('Pièce'), html`${reading ? html`<span class="pill">${mpIcon('thermo', 13)}${reading}</span>` : nothing}${close}`)}
      <div class="body">
        ${quick.length ? html`<div class="tgrid">${quick.map(id => this.tile(id, room.name))}</div>` : html`<p class="empty">${tr('Aucun équipement à piloter dans cette pièce.')}</p>`}
        <div class="acts">
          ${this.lightsIn(ids).length ? html`<button class="btn" ?disabled=${!this.lightsIn(ids).some(id => this.on(id))} @click=${() => this.allOff(ids)}>${mpIcon('power', 16)}${tr('Tout éteindre')}</button>` : nothing}
          ${path ? html`<a class="btn primary" href=${this.route(path)}>${tr('Ouvrir la pièce')}</a>` : nothing}
        </div>
      </div>`;
  }
  /** The plan beside the page on a big screen, on the layer of the page. */
  private planPanel() {
    const placed = this.room ? this.find(this.room) : undefined;
    return html`<section class="side panel card glass">
      ${this.head(tr('Plan 3D'), tr('Calque · {layer}', { layer: this.shownLayer === 'media' ? tr('Médias') : tr(PLAN_LAYERS[this.shownLayer].label) }), html`<span class="pill">${placed ? placed.room.name : tr('Toute la maison')}</span>`)}
      <div class="body">${this.houseButtons()}<div class="plan3d">${this.viewer({ key: 'side', expandable: true, focus: this.kind === 'area' ? this.areaRoom?.room.id ?? '' : this.room })}</div>${this.layerButtons()}</div>
    </section>`;
  }

  // ——— Home ———
  private stats() {
    const states = this.hass?.states ?? {}, placed = this.placed;
    // The lights of the dashboard and those of the plan: a light linked to a room only is still a light of the house.
    const lights = this.lightsIn([...new Set([...this.entities, ...placed.flatMap(p => roomEntityIds(p.room))])]), lit = lights.filter(id => this.on(id)).length;
    const warm = placed.map(p => ({ p, t: this.temperature(p.room) })).find(x => x.t);
    const covers = [...new Set(placed.flatMap(p => roomEntityIds(p.room)).filter(id => id.startsWith('cover.') && states[id]))];
    const contacts = [...new Set(placed.flatMap(p => roomEntityIds(p.room)).filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on'))];
    const playing = this.media.filter(id => mediaPlaying(states[id])).length;
    const pill = (mode: PlanMode, icon: MPIconName, value: string, text: string, warn = false) => html`<button class=${`pill ${warn ? 'warn' : ''}`} @click=${() => this.chooseLayer(mode)}>${mpIcon(icon, 14)}<b>${value}</b>${text}</button>`;
    return html`<div class="stat">
      ${lights.length ? pill('lights', 'bulb', String(lit), lit ? tr('allumée|allumées', { n: lit }) : tr('allumée|allumées', { n: 0 })) : nothing}
      ${warm?.t ? pill('climate', 'thermo', `${this.format(warm.t.value)}°`, warm.p.room.name.toLocaleLowerCase(locale())) : nothing}
      ${covers.length ? pill('openings', 'shutter', `${covers.filter(id => coverOpen(states[id])).length}/${covers.length}`, tr('ouverts')) : nothing}
      ${contacts.length ? pill('openings', 'window', String(contacts.length), tr('ouverture|ouvertures', { n: contacts.length }), true) : nothing}
      ${playing ? pill('media', 'music', String(playing), tr('en lecture')) : nothing}
    </div>`;
  }
  private scenes() {
    const scenes = Object.values(this.hass?.states ?? {}).filter(s => s.entity_id.startsWith('scene.') && available(s));
    if (!scenes.length) return nothing;
    const last = scenes.reduce((a, b) => Date.parse(b.state) > Date.parse(a.state) ? b : a);
    return html`<div class="sec"><b>${tr('Scènes')}</b>${this.hass?.user?.is_admin ? html`<a href="/config/scene/dashboard">${tr('Modifier')}</a>` : nothing}</div>
      <div class="houses">${scenes.map(s => html`<button class=${`btn ${s === last && Number.isFinite(Date.parse(s.state)) ? 'gold' : ''}`} @click=${() => this.call('scene', 'turn_on', { entity_id: s.entity_id })}>${mpIcon('sparkle', 16)}${String(s.attributes.friendly_name ?? s.entity_id)}</button>`)}</div>`;
  }
  private homeMain() {
    return html`<section class="main panel card glass">
      ${this.head(this.projectName || tr('Ma maison'), this.greeting(), this.layout === 'phone' || this.layout === 'portrait' ? this.languageMenu('button') : nothing)}
      <div class="body">
        ${this.stats()}${this.houseButtons()}
        ${this.plan ? html`<div class="plan3d">${this.viewer({ key: 'home', expandable: true })}</div>${this.layerButtons()}` : this.noPlan()}
        ${this.scenes()}
      </div>
    </section>`;
  }
  private noPlan() {
    return html`<p class="empty">${tr('Ajoutez votre plan dans Studio → Plan 3D.')}${this.hass?.user?.is_admin ? html` <a style="color:var(--accent)" href="/mp-glass-settings">${tr('Ouvrir le Studio')}</a>` : nothing}</p>`;
  }
  /** What is going on at home right now: what plays, what heats or cools, what stands open, the weather. */
  private now() {
    const states = this.hass?.states ?? {};
    const playing = this.media.filter(id => mediaPlaying(states[id]));
    const running = Object.values(states).filter(s => s.entity_id.startsWith('climate.') && ['heating', 'cooling', 'drying', 'fan'].includes(String(s.attributes.hvac_action ?? '')));
    const open = [...new Set(this.placed.flatMap(p => roomEntityIds(p.room)))].filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on');
    const weather = Object.values(states).find(s => s.entity_id.startsWith('weather.') && available(s));
    const quiet = !playing.length && !running.length && !open.length;
    return html`<section class="side panel card glass">
      ${this.head(tr('En ce moment'), new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}
      <div class="body">
        ${playing.map(id => this.nowPlayingRow(id))}
        ${running.map(s => html`<button class="live glass" @click=${() => { this.detail = s.entity_id; }}><span class="ib">${mpIcon(entityIcon(s.entity_id, s), 18)}</span><div><b>${this.name(s.entity_id)}</b><small>${stateLabel(s.entity_id, s)} · ${stateDetail(s.entity_id, s)}</small></div></button>`)}
        ${open.length ? html`<div class="rlab">${tr('À surveiller')}</div><div class="sg">${open.map(id => html`<button class="rw" @click=${() => { this.detail = id; }}><span class="ib" style="color:#ffb4b4">${mpIcon('window', 16)}</span><div><b>${this.name(id)}</b><small>${stateLabel(id, states[id])}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`)}</div>` : nothing}
        ${weather ? html`<div class="rlab">${tr('Météo')}</div><button class="live glass" @click=${() => { this.detail = weather.entity_id; }}><span class="ib">${mpIcon('sun', 18)}</span><div><b>${finite(weather.attributes.temperature) === undefined ? weather.state : `${this.format(finite(weather.attributes.temperature)!)} ${String(weather.attributes.temperature_unit ?? '°')}`}</b><small>${String(weather.attributes.friendly_name ?? '')} · ${weather.state}</small></div></button>` : nothing}
        ${quiet ? html`<p class="empty">${tr('Tout est calme à la maison.')}</p>` : nothing}
      </div>
    </section>`;
  }
  private artwork(state?: HAState) {
    const picture = String(state?.attributes.entity_picture ?? '');
    return picture ? `background-image:url("${picture.replace(/"/g, '%22')}")` : '';
  }
  private nowPlayingRow(id: string) {
    const state = this.state(id);
    return html`<div class="live glass"><a class="art" href=${this.route('media')} style=${this.artwork(state)} aria-label=${tr('Multimédia')}></a><div><b>${nowPlaying(state) ?? this.name(id)}</b><small>${this.name(id)}</small></div>
      <span class="rgt" style="margin-left:auto;display:flex;gap:4px">${canMedia(state, 'pause') ? html`<button class="ib" aria-label=${tr('Pause')} @click=${() => this.call('media_player', 'media_play_pause', { entity_id: id })}>${mpIcon('pause', 16)}</button>` : nothing}${canMedia(state, 'next_track') ? html`<button class="ib" aria-label=${tr('Suivant')} @click=${() => this.call('media_player', 'media_next_track', { entity_id: id })}>${mpIcon('next', 16)}</button>` : nothing}</span></div>`;
  }

  // ——— Lights ———
  private lightsMain() {
    const lights = this.lightsIn([...new Set([...this.entities, ...this.placedAll.flatMap(p => roomEntityIds(p.room))])]), lit = lights.filter(id => this.on(id));
    const placedIds = new Set<string>();
    const groups = this.placedAll.map(p => {
      const ids = lights.filter(id => roomEntityIds(p.room).includes(id) && !placedIds.has(id));
      ids.forEach(id => placedIds.add(id));
      return { ...p, ids };
    }).filter(g => g.ids.length);
    const rest = lights.filter(id => !placedIds.has(id)), several = (this.spatial?.floors.length ?? 0) > 1;
    const group = (key: string, title: string, sub: string, ids: string[], room = '') => {
      const on = ids.some(id => this.on(id));
      return html`<div class="rh" data-room=${key}><b>${title}</b><small>${sub}</small><button class="end" role="switch" aria-checked=${on} aria-label=${title} @click=${() => this.call('light', on ? 'turn_off' : 'turn_on', { entity_id: ids })}><span class=${`tgl ${on ? '' : 'off'}`}></span></button></div>
        <div class="tgrid">${ids.map(id => this.tile(id, room))}</div>`;
    };
    return html`<section class="main panel card glass">
      ${this.head(tr('Lumières'), tr('{n} allumée sur {total}|{n} allumées sur {total}', { n: lit.length, total: lights.length }), html`<button class="pill" ?disabled=${!lit.length} @click=${() => this.allOff(lights)}>${mpIcon('power', 14)}${tr('Tout éteindre')}</button>`)}
      <div class="body">
        ${lights.length ? nothing : html`<p class="empty">${tr('Aucune lumière détectée pour le moment.')}</p>`}
        ${groups.map(g => group(g.room.id, g.room.name, several ? g.floor.name : tr('Pièce'), g.ids, g.room.name))}
        ${rest.length ? group('outside-plan', tr('Hors du plan'), '', rest) : nothing}
      </div>
    </section>`;
  }
  /** Every room of the plan, all houses together: a light belongs to its room whatever house the plan shows. */
  private get placedAll(): PlacedRoom[] {
    const spatial = this.spatial;
    if (!spatial) return [];
    const plan = this.spatialOrigin === 'project' ? spatial : trPlan(spatial, this.spatialOrigin === 'example');
    return plan.floors.flatMap(floor => floor.rooms.map(room => ({ room, floor })));
  }

  // ——— Rooms ———
  private roomBadges(room: SpatialRoom) {
    const ids = roomEntityIds(room), states = this.hass?.states ?? {};
    const lit = this.lightsIn(ids).filter(id => this.on(id)).length, temperature = this.temperature(room);
    const open = ids.filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on').length;
    const playing = ids.filter(id => id.startsWith('media_player.') && mediaOn(states[id]));
    return { lit, html: html`${lit ? html`<span class="w">${tr('{n} lumière|{n} lumières', { n: lit })}</span>` : nothing}${temperature ? html`<span>${this.format(temperature.value)}°</span>` : nothing}${open ? html`<span class="a">${tr('{n} ouverture|{n} ouvertures', { n: open })}</span>` : nothing}${playing.length ? html`<span>${playing.some(id => mediaIsTv(states[id])) ? tr('TV') : tr('Musique')}</span>` : nothing}` };
  }
  private roomsMain() {
    const plan = this.plan, floors = plan?.floors ?? [];
    const placed = this.placed.filter(p => !this.floorFilter || p.floor.id === this.floorFilter);
    const onPlan = new Set(this.placedAll.map(p => p.room.areaId).filter(Boolean));
    const others = this.areas.filter(a => !onPlan.has(a.id));
    const open = (p: PlacedRoom) => { const path = this.areaPath(p.room.areaId); if (path) this.go(path); else this.room = p.room.id; };
    return html`<section class="main panel card glass">
      ${this.head(tr('Pièces'), [tr('{n} pièce|{n} pièces', { n: this.placed.length + others.length }), floors.length > 1 ? tr('{n} niveau|{n} niveaux', { n: floors.length }) : ''].filter(Boolean).join(' · '))}
      <div class="body">
        ${this.layout === 'phone' && plan ? this.banner(210, this.viewer({ key: 'rooms', quiet: true })) : nothing}
        ${this.houseButtons()}
        ${floors.length > 1 ? html`<div class="houses" role="group" aria-label=${tr('Niveau affiché')}><button class="pill" aria-pressed=${!this.floorFilter} @click=${() => { this.floorFilter = ''; }}>${tr('Tous')}</button>${floors.map(f => html`<button class="pill" aria-pressed=${this.floorFilter === f.id} @click=${() => { this.floorFilter = f.id; }}>${f.name}</button>`)}</div>` : nothing}
        ${placed.length || others.length ? nothing : html`<p class="empty">${tr('Aucune pièce détectée. Créez des zones dans Home Assistant, puis ouvrez le Studio pour analyser votre installation.')}</p>`}
        <div class="rgrid">
          ${placed.map(p => { const badges = this.roomBadges(p.room); return html`<button class=${`rm ${badges.lit ? 'lit' : ''}`} @click=${() => open(p)}><span style="display:flex;align-items:center;gap:8px;min-width:0">${mpIcon(roomIcon(p.room.name), 18)}<b>${p.room.name}</b></span><div class="bd">${badges.html}</div></button>`; })}
          ${this.floorFilter ? nothing : others.map(a => html`<a class="rm" href=${this.route(`area-${a.id}`)}><b>${a.name}</b><div class="bd"><span>${tr('{n} équipement|{n} équipements', { n: a.deviceCount })}</span></div></a>`)}
          ${this.inventory && !this.floorFilter ? html`<a class="rm" href=${this.route('inventory')}><span style="display:flex;align-items:center;gap:8px">${mpIcon('scan', 18)}<b>${this.inventory.title}</b></span><div class="bd"><span>${tr('{n} équipement|{n} équipements', { n: this.inventory.count })}</span></div></a>` : nothing}
        </div>
      </div>
    </section>`;
  }

  // ——— One room ———
  private get area() { return this.areas.find(a => `area-${a.id}` === this.path); }
  private get areaRoom() { const id = this.area?.id; return id ? this.placed.find(p => p.room.areaId === id) ?? this.placedAll.find(p => p.room.areaId === id) : undefined; }
  private areaMain() {
    const area = this.area, placed = this.areaRoom, room = placed?.room;
    const ids = [...new Set([...this.entities, ...(room ? roomEntityIds(room) : [])])].filter(id => this.state(id));
    const of = (test: (id: string) => boolean) => ids.filter(test);
    const lights = of(id => domainOf(id) === 'light'), covers = of(id => domainOf(id) === 'cover');
    const openings = of(id => kindOf(id, this.state(id)) === 'opening'), climate = of(id => domainOf(id) === 'climate'), media = of(id => domainOf(id) === 'media_player');
    const shown = new Set([...lights, ...covers, ...openings, ...climate, ...media]);
    const readings = of(id => ['temperature', 'humidity', 'motion'].includes(kindOf(id, this.state(id))));
    const others = ids.filter(id => !shown.has(id) && !readings.includes(id));
    const name = room?.name ?? area?.name ?? this.viewTitle, lit = lights.filter(id => this.on(id)).length;
    const pills = html`<div class="stat">${readings.map(id => html`<button class="pill" @click=${() => { this.detail = id; }}>${mpIcon(entityIcon(id, this.state(id)), 13)}${stateLabel(id, this.state(id))}</button>`)}</div>`;
    const section = (icon: MPIconName, title: string, sub: string, list: string[], extra: TemplateResult | typeof nothing = nothing) => list.length ? html`<div class="secg">${mpIcon(icon, 17)}<b>${title}</b><small>${sub}</small></div>${extra}<div class="tgrid">${list.map(id => this.tile(id, name))}</div>` : nothing;
    const positions = covers.filter(id => coverPosition(this.state(id)) !== undefined).map(id => coverPosition(this.state(id))!);
    const coverActions = covers.length ? html`<div class="acts"><button class="btn" @click=${() => this.call('cover', 'open_cover', { entity_id: covers })}>${tr('Ouvrir')}</button><button class="btn" @click=${() => this.call('cover', 'set_cover_position', { entity_id: covers, position: 50 })}>${tr('Mi-ombre')}</button><button class="btn" @click=${() => this.call('cover', 'close_cover', { entity_id: covers })}>${tr('Fermer')}</button></div>` : nothing;
    const busy = lit > 0 || media.some(id => mediaPlaying(this.state(id)));
    return html`<section class="main panel card glass">
      ${this.head(name, placed && (this.plan?.floors.length ?? 0) > 1 ? placed.floor.name : tr('Pièce'), nothing, 'rooms')}
      <div class="body">
        ${this.layout === 'phone' && room && this.plan ? this.banner(200, this.viewer({ key: 'area', focus: room.id, quiet: true })) : nothing}
        ${readings.length ? pills : nothing}
        ${section('bulb', tr('Lumières'), tr('{n} sur {total}', { n: lit, total: lights.length }), lights)}
        ${section('shutter', tr('Ouvrants'), positions.length ? tr('{n} % ouvert', { n: this.format(positions.reduce((a, b) => a + b, 0) / positions.length, 0) }) : '', [...covers, ...openings], coverActions)}
        ${section('thermo', tr('Climat'), '', climate)}
        ${section('music', tr('Multimédia'), '', media)}
        ${section('dots', tr('Autres équipements'), '', others)}
        ${ids.length ? nothing : html`<p class="empty">${tr('Aucun équipement dans cette pièce pour le moment.')}</p>`}
        ${busy ? html`<button class="btn gold" @click=${() => { this.allOff(ids); const on = media.filter(id => mediaPlaying(this.state(id)) && canMedia(this.state(id), 'pause')); if (on.length) this.call('media_player', 'media_pause', { entity_id: on }); }}>${mpIcon('power', 16)}${tr('Quitter la pièce')}</button>` : nothing}
      </div>
    </section>`;
  }

  // ——— Multimédia ———
  private get players() { return this.media.filter(id => this.state(id)); }
  private get currentPlayer() {
    const players = this.players, states = this.hass?.states ?? {};
    return players.find(id => id === this.player) ?? players.find(id => mediaPlaying(states[id])) ?? players.find(id => mediaOn(states[id])) ?? players[0];
  }
  private mediaMain() {
    const id = this.currentPlayer, state = id ? this.state(id) : undefined, players = this.players;
    if (!id) return html`<section class="main panel card glass">${this.head(tr('Multimédia'))}<div class="body"><p class="empty">${tr('Aucun lecteur multimédia détecté pour le moment.')}</p></div></section>`;
    const position = finite(state?.attributes.media_position), duration = finite(state?.attributes.media_duration);
    const updated = Date.parse(String(state?.attributes.media_position_updated_at ?? ''));
    const elapsed = position === undefined ? undefined : position + (mediaPlaying(state) && Number.isFinite(updated) ? (Date.now() - updated) / 1000 : 0);
    const progress = elapsed !== undefined && duration ? Math.min(100, elapsed / duration * 100) : undefined;
    const volume = mediaVolume(state), sources = Array.isArray(state?.attributes.source_list) ? (state!.attributes.source_list as unknown[]).map(String) : [];
    const artist = [state?.attributes.media_artist, state?.attributes.app_name ?? state?.attributes.source].filter(Boolean).map(String).join(' · ');
    const media = (service: string, data: Record<string, unknown> = {}) => this.call('media_player', service, { entity_id: id, ...data });
    return html`<section class="main panel card glass">
      ${this.head(this.name(id), tr('Multimédia'), html`${mediaOn(state) && canMedia(state, 'turn_off') ? html`<button class="ib" aria-label=${tr('Éteindre')} title=${tr('Éteindre')} @click=${() => media('turn_off')}>${mpIcon('power', 16)}</button>` : !mediaOn(state) && canMedia(state, 'turn_on') ? html`<button class="ib" aria-label=${tr('Allumer')} title=${tr('Allumer')} @click=${() => media('turn_on')}>${mpIcon('power', 16)}</button>` : nothing}<button class="ib" aria-label=${tr('Détails')} title=${tr('Détails')} @click=${() => { this.detail = id; }}>${mpIcon('dots', 16)}</button>`)}
      <div class="body player">
        <div class="cover" style=${this.artwork(state)}></div>
        <div><div class="serif" style="font-size:26px;line-height:1.15">${nowPlaying(state) ?? stateLabel(id, state)}</div><div class="muted" style="margin-top:4px">${artist || stateLabel(id, state)}</div></div>
        ${progress === undefined ? nothing : html`<div class="bar" role="progressbar" aria-valuenow=${Math.round(progress)} aria-valuemin="0" aria-valuemax="100"><i style=${`width:${progress}%`}></i></div>`}
        <div class="ctl">
          <button aria-label=${tr('Précédent')} ?disabled=${!canMedia(state, 'previous_track')} @click=${() => media('media_previous_track')}>${mpIcon('previous', 22)}</button>
          <button class="play" aria-label=${mediaPlaying(state) ? tr('Pause') : tr('Lecture')} ?disabled=${!canMedia(state, 'pause') && !canMedia(state, 'play')} @click=${() => media('media_play_pause')}>${mpIcon(mediaPlaying(state) ? 'pause' : 'play', 26)}</button>
          <button aria-label=${tr('Suivant')} ?disabled=${!canMedia(state, 'next_track')} @click=${() => media('media_next_track')}>${mpIcon('next', 22)}</button>
        </div>
        ${volume !== undefined && canMedia(state, 'volume_set') ? html`<label class="vol">${mpIcon('volume', 18)}<input type="range" min="0" max="100" .value=${String(Math.round(volume))} aria-label=${tr('Volume')} @change=${(e: Event) => media('volume_set', { volume_level: Number((e.target as HTMLInputElement).value) / 100 })}><span class="muted" style="font-size:12px;min-width:34px;text-align:right">${Math.round(volume)} %</span></label>` : nothing}
        ${sources.length && canMedia(state, 'select_source') ? html`<label class="vol">${mpIcon('tv', 18)}<select aria-label=${tr('Source')} @change=${(e: Event) => media('select_source', { source: (e.target as HTMLSelectElement).value })}>${sources.map(s => html`<option .selected=${s === state?.attributes.source} value=${s}>${s}</option>`)}</select><span></span></label>` : nothing}
        ${players.length > 1 ? html`<div class="rlab">${tr('Lecteurs')}</div><div class="sg">${players.map(p => { const s = this.state(p); return html`<button class="rw" aria-pressed=${p === id} @click=${() => { this.player = p; }}><span class="ib" style=${p === id ? 'color:var(--accent)' : ''}>${mpIcon(entityIcon(p, s), 16)}</span><div><b>${this.name(p)}</b><small>${[stateLabel(p, s), mediaOn(s) ? nowPlaying(s) : ''].filter(Boolean).join(' · ')}</small></div><span class="end">${p === id ? mpIcon('check', 16) : nothing}</span></button>`; })}</div>` : nothing}
      </div>
    </section>`;
  }

  // ——— Plus, info and the other devices ———
  private plusMain() {
    const admin = !!this.hass?.user?.is_admin;
    const row = (href: string, icon: MPIconName, title: string, sub: string) => html`<a class="rw" href=${href}><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${sub}</small></div><span class="end">${mpIcon('arrow', 16)}</span></a>`;
    return html`<section class="main panel card glass">
      ${this.head(tr('Plus'), tr('Toute la maison'))}
      <div class="body">
        <div class="sg">
          ${this.inventory ? row(this.route('inventory'), 'scan', this.inventory.title, tr('{n} équipement|{n} équipements', { n: this.inventory.count })) : nothing}
          ${row(this.route('info'), 'info', tr('Info'), tr('Versions et installation'))}
        </div>
        <div class="sg">
          ${this.languageMenu('row')}
          ${admin ? row('/mp-glass-settings', 'tune', 'MP Nexus Studio', tr('Apparence, plan 3D et équipements')) : nothing}
          ${admin ? row('/mp-glass-settings', 'sparkle', tr('Interface MP Nexus v2 (aperçu)'), tr('Revenir à la v1 depuis le Studio')) : nothing}
        </div>
      </div>
    </section>`;
  }
  private infoMain() {
    const info = this.info, unknown = tr('Indisponible');
    const row = (label: string, value: string | number) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`;
    return html`<section class="main panel card glass">
      ${this.head(tr('Info'), tr('Plus'), nothing, 'plus')}
      <div class="body">
        ${info?.version && info.version !== __MP_GLASS_VERSION__ ? html`<div class="note" role="alert">${tr('MP Nexus {installed} est installé, mais cette page affiche encore la version {shown}. Rechargez-la pour utiliser la nouvelle interface.', { installed: info.version, shown: __MP_GLASS_VERSION__ })}<button class="btn" @click=${() => location.reload()}>${tr('Recharger la page')}</button></div>` : nothing}
        <div class="rlab">${tr('Versions')}</div>
        <dl class="sg">${row(tr('Version de l’intégration MP Nexus'), info?.version ?? unknown)}${row(tr('Version du bundle chargé'), __MP_GLASS_VERSION__)}${row('Home Assistant', this.hass?.config?.version ?? unknown)}</dl>
        <div class="rlab">${tr('Votre installation')}</div>
        <dl class="sg">${row(tr('Maison'), this.projectName || tr('Maison'))}${row(tr('Pièces'), info?.areaCount ?? this.areas.length)}${row(tr('Équipements du dashboard'), info?.deviceCount ?? unknown)}${row(tr('Lumières'), info?.lightCount ?? unknown)}${row(tr('Langue de l’interface'), LANGUAGE_NAMES[language()])}</dl>
      </div>
    </section>`;
  }
  private inventoryMain() {
    return html`<section class="main panel card glass">
      ${this.head(this.inventory?.title ?? this.viewTitle, tr('Plus'), nothing, 'plus')}
      <div class="body">${this.cards.length ? html`<div class="cards">${this.cards.map(card => html`<div>${card}</div>`)}</div>` : html`<p class="empty">${tr('Aucun équipement à afficher pour le moment.')}</p>`}</div>
    </section>`;
  }

  // ——— The plan on the whole screen ———
  private fullPlan(background: string) {
    const placed = this.room ? this.find(this.room) : undefined, floors = this.plan?.floors.length ?? 0;
    return html`<div class="full" role="dialog" aria-modal="true" aria-label=${tr('Plan 3D')}>
      <div class="backdrop" style=${background}></div>
      <div class="fplan">${this.viewer({ key: 'full' })}</div>
      <div class="ftop"><div><div class="lbl">${[this.projectName, floors > 1 ? tr('{n} niveau|{n} niveaux', { n: floors }) : ''].filter(Boolean).join(' · ')}</div><div class="serif" style="font-size:24px">${tr('Plan 3D')}</div></div>${this.houseButtons()}
        <button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${() => { this.full = false; }}>${mpIcon('close', 18)}</button></div>
      ${placed ? html`<section class="fcard panel glass">${this.roomCard(placed, 'float')}</section>` : nothing}
      <div class="fbot">${this.layerButtons()}</div>
    </div>`;
  }

  render() {
    const a = this.appearance;
    const background = `background-image:url(${a.backgroundUrl || MP_GLASS_BACKGROUND});background-position:${a.backgroundPosition ?? 'right'} center`;
    const big = this.layout !== 'phone', placed = this.room ? this.find(this.room) : undefined;
    const main = this.kind === 'home' ? this.homeMain() : this.kind === 'lights' ? this.lightsMain() : this.kind === 'rooms' ? this.roomsMain()
      : this.kind === 'area' ? this.areaMain() : this.kind === 'media' ? this.mediaMain() : this.kind === 'plus' ? this.plusMain()
        : this.kind === 'info' ? this.infoMain() : this.inventoryMain();
    // On a big screen the home page keeps its plan in the middle: beside it, the room opened or what is going on.
    const side = !big ? nothing : this.kind === 'home' ? (placed ? html`<section class="side panel card glass">${this.roomCard(placed, 'side')}</section>` : this.now()) : this.plan ? this.planPanel() : nothing;
    return html`
      <div class="backdrop" style=${background}></div><div class="shade" style=${`opacity:${Math.min(1, (a.backgroundDim ?? .44) + .4)}`}></div>
      <div class="app">${this.layout === 'desk' ? this.navigationBar() : nothing}${main}${side}${this.layout !== 'desk' ? this.navigationBar() : nothing}</div>
      ${!big && placed && !this.full && (this.kind === 'home' || this.kind === 'rooms') ? html`<div class="scrim" @click=${() => { this.room = ''; }}></div><section class="sheet panel">${this.roomCard(placed, 'sheet')}</section>` : nothing}
      ${this.full && this.plan ? this.fullPlan(background) : nothing}
      ${this.detail && this.hass ? html`<mp-glass-detail .hass=${this.hass} .entity=${this.detail} @mp-glass-detail-close=${() => { this.detail = ''; }}></mp-glass-detail>` : nothing}`;
  }
}
