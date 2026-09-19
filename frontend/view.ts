import { LitElement, html, css, nothing } from 'lit';
import type { AppearanceConfig, NavigationConfig, NavigationItem } from '../shared/models';
import { MP_GLASS_BACKGROUND } from './background';
import { mpIcon, type MPIconName } from './icons';
import type { SpatialPlan } from '../shared/spatial';
import { ambianceEntities, coverOpen, coverPosition, finite, mediaIsTv, mediaOn, nowPlaying, roomEntityIds, type PlanMode } from '../shared/spatial-state';
import { available } from '../shared/capabilities';
import type { Hass } from './ha/client';
import { claimHeader, releaseHeader } from './ha/header';
import './spatial/viewer';
import { COVER_STATES, HVAC, MEDIA_STATES, roomIcon, stateName } from './spatial/viewer';
import type { MessageKey } from './locales';
import { chooseLanguage, language, LANGUAGE_NAMES, LANGUAGES, LanguageController, locale, tr, trDefault, trPlan, type Language } from './i18n';
import { flag } from './flags';

interface AreaSummary { id:string; name:string; icon?:string; picture?:string; deviceCount:number; lightCount:number }
interface ViewConfig {
  mp_spatial?: SpatialPlan;
  mp_spatial_origin?: 'project'|'areas'|'example';
  mp_project_name?: string;
  title?: string;
  mp_appearance?: AppearanceConfig;
  mp_navigation?: NavigationConfig;
  mp_view_kind?: 'home'|'lights'|'rooms'|'area'|'inventory';
  mp_view_path?: string;
  mp_view_title?: string;
  mp_areas?: AreaSummary[];
  mp_inventory?: { title:string; count:number };
  /** Entity of each card of the view, in the order of `cards`: the home section groups them by room of the plan. */
  mp_entities?: string[];
}

export class MPGlassView extends LitElement {
  static properties = { cards:{attribute:false}, badges:{attribute:false}, hass:{attribute:false}, languageOpen:{state:true}, planMode:{state:true}, planFloors:{state:true} };
  static styles = css`
    :host{display:block;flex:1 1 100%;width:100%;min-width:0;min-height:100vh;container-type:inline-size;box-sizing:border-box;color:#f8fbff;font-family:var(--mp-body-font,Inter,ui-sans-serif,system-ui,sans-serif);position:relative;isolation:isolate;overflow:hidden;background:#061421}
    *{box-sizing:border-box}.backdrop,.shade,.ambient{position:fixed;inset:0;pointer-events:none}.backdrop{z-index:-4;background-size:cover;background-repeat:no-repeat;transform:scale(1.035);filter:blur(var(--mp-bg-blur,0)) saturate(var(--mp-bg-saturation,1))}.shade{z-index:-3;background:linear-gradient(90deg,rgba(2,13,25,.8),rgba(3,18,31,.17) 58%,rgba(2,10,19,.38)),linear-gradient(0deg,rgba(2,11,21,.95),transparent 72%)}.ambient{z-index:-2;background:radial-gradient(circle at 18% 15%,color-mix(in srgb,var(--mp-accent,#69b7ff) 14%,transparent),transparent 34%),radial-gradient(circle at 85% 70%,color-mix(in srgb,var(--mp-secondary,#efbd8b) 10%,transparent),transparent 28%)}
    .shell{width:min(100%,var(--mp-max-width,1560px));margin:auto;padding:clamp(14px,2.4vw,36px) clamp(14px,3.2vw,50px) 58px}.glass{background:linear-gradient(145deg,color-mix(in srgb,var(--mp-tint,#12344f) calc(var(--mp-opacity,.66)*100%),transparent),rgba(7,27,47,calc(var(--mp-opacity,.66) + .02)) 72%);border:1px solid color-mix(in srgb,var(--mp-accent,#69b7ff) calc(var(--mp-border,.2)*100%),rgba(224,239,255,.4));box-shadow:0 22px 55px rgba(0,8,18,var(--mp-shadow,.35)),inset 0 1px rgba(255,255,255,.13);backdrop-filter:blur(var(--mp-blur,24px)) saturate(145%)}
    /* Above the plan and the cards, for the language menu to open over them. */
    header{position:relative;z-index:3;min-height:82px;padding:12px 14px 12px 18px;border-radius:var(--mp-radius,22px);display:grid;grid-template-columns:minmax(220px,1fr) auto minmax(185px,1fr);align-items:center;gap:14px}.brand{display:flex;align-items:center;gap:14px;min-width:0}.brand>div{min-width:0}.mark{width:47px;height:47px;flex:0 0 auto;display:grid;place-items:center;border-radius:15px;color:var(--mp-secondary,#efbd8b);background:linear-gradient(145deg,rgba(255,227,194,.12),rgba(255,255,255,.025));border:1px solid rgba(255,225,190,.18);font:36px/1 Georgia,serif;text-shadow:0 0 18px rgba(242,199,147,.32);transform:rotate(-5deg)}.brand strong{display:block;font:clamp(21px,2vw,31px)/1 var(--mp-display-font,Georgia,serif);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand small{display:block;margin-top:7px;letter-spacing:.25em;text-transform:uppercase;color:#aebfd1;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    nav{display:flex;gap:4px;padding:4px;border:1px solid rgba(201,225,250,.14);border-radius:18px;background:rgba(3,18,32,.26)}nav a{min-height:46px;padding:0 16px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:9px;color:#d4e1ed;font-size:13px;text-decoration:none;border:1px solid transparent;transition:background .18s ease,border-color .18s ease,transform .18s ease}nav a:hover{background:rgba(255,255,255,.07);transform:translateY(-1px)}nav a.active{background:linear-gradient(145deg,color-mix(in srgb,var(--mp-accent,#69b7ff) 76%,transparent),rgba(38,94,149,.68));border-color:color-mix(in srgb,var(--mp-accent,#69b7ff) 78%,white);box-shadow:0 7px 24px color-mix(in srgb,var(--mp-accent,#69b7ff) 25%,transparent),inset 0 1px rgba(255,255,255,.25)}nav a.active .mp-icon{filter:drop-shadow(0 0 8px currentColor)}nav.hide-labels a span:last-child{display:none}
    /* The flag stands beside the clock on a wide screen, at the end of the navigation where the clock is hidden, and on the row of the name
       on a phone, where the navigation has no room left. */
    .language{position:relative;display:flex;flex:none}nav .language,.brand .language{display:none}.brand .language{margin:0 -4px 0 auto}.brand .language>button{padding:0 7px}.language>button{min-height:46px;padding:0 12px;border-radius:14px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background .18s ease}.language>button:hover,.language>button[aria-expanded=true]{background:rgba(255,255,255,.07)}
    .flag{display:inline-block;width:22px;height:15px;flex:0 0 auto;border-radius:3px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.3),0 2px 6px rgba(0,8,18,.35)}.flag svg{display:block;width:100%;height:100%}
    .language-menu{position:absolute;z-index:1;top:calc(100% + 8px);right:0;display:grid;gap:2px;min-width:160px;padding:5px;border-radius:14px;background:rgba(6,22,38,.95);border:1px solid rgba(206,230,255,.2);box-shadow:0 18px 40px rgba(0,8,18,.5)}.language-menu button{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:#e3eef8;font:inherit;font-size:13px;text-align:left;cursor:pointer}.language-menu button:hover{background:rgba(255,255,255,.08)}.language-menu button[aria-checked=true]{background:color-mix(in srgb,var(--mp-accent,#69b7ff) 24%,transparent);color:#fff}
    .header-tools{display:flex;align-items:center;justify-content:flex-end;gap:10px}.clock{text-align:right}.clock strong{display:block;font:28px/1 var(--mp-display-font,Georgia,serif);font-weight:400}.clock small{display:flex;justify-content:flex-end;align-items:center;gap:7px;color:#b7c6d6;margin-top:7px;font-size:11px}.clock i{width:6px;height:6px;border-radius:50%;background:#79e6ae;box-shadow:0 0 11px #56d99a}.settings-link{min-height:44px;padding:0 13px;border-radius:14px;display:flex;align-items:center;gap:8px;color:#eef7ff;text-decoration:none;border:1px solid rgba(212,232,250,.2);background:rgba(255,255,255,.055);font-size:11px}.settings-link:hover{border-color:var(--mp-accent);background:color-mix(in srgb,var(--mp-accent) 15%,transparent)}
    .hero{min-height:var(--mp-hero-height,455px);display:grid;grid-template-columns:minmax(0,1.35fr) minmax(230px,.65fr);align-items:center;padding:clamp(42px,7vw,94px) 24px clamp(28px,4vw,52px);gap:50px}.hero-copy{max-width:780px}.eyebrow{font-size:10px;letter-spacing:.32em;text-transform:uppercase;margin-bottom:18px;display:flex;align-items:center;gap:11px;font-weight:650}.eyebrow::after{content:'';width:44px;height:1px;background:linear-gradient(90deg,var(--mp-accent),transparent)}.eyebrow .mp-icon{color:var(--mp-accent);filter:drop-shadow(0 0 9px var(--mp-accent))}.hero h1{font:clamp(43px,5.5vw,82px)/.98 var(--mp-display-font,Georgia,serif);font-weight:400;letter-spacing:-.035em;margin:0;max-width:860px;text-wrap:balance;text-shadow:0 4px 22px rgba(0,5,15,.6)}.hero p{font-size:clamp(15px,1.45vw,21px);color:#d3dfea;margin:18px 0 0;max-width:620px}.hero-meta{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.chip{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 11px;border-radius:999px;background:rgba(3,21,37,.38);border:1px solid rgba(211,233,255,.17);color:#dce9f5;font-size:11px;backdrop-filter:blur(12px)}.chip .mp-icon{color:#ffd56c}.quote{justify-self:end;max-width:335px;border-left:1px solid rgba(255,255,255,.38);padding:15px 0 15px clamp(24px,3vw,42px);font:italic clamp(18px,1.8vw,27px)/1.45 var(--mp-display-font,Georgia,serif);color:#f5eee7;text-shadow:0 2px 13px rgba(0,6,14,.75)}.quote::after{content:'';display:block;width:34px;height:2px;margin-top:20px;background:var(--mp-accent);border-radius:99px;box-shadow:0 0 12px color-mix(in srgb,var(--mp-accent) 45%,transparent)}
    .page-intro{padding:clamp(46px,7vw,90px) 10px clamp(28px,4vw,48px)}.page-intro .eyebrow{margin-bottom:13px}.page-intro h1{font:clamp(42px,5vw,72px)/1 var(--mp-display-font,Georgia,serif);font-weight:400;margin:0}.page-intro p{color:#b9cad9;font-size:16px;margin:13px 0 0}
    .overview{padding:0 0 16px}.overview-card{min-height:94px;border-radius:var(--mp-radius);padding:13px 16px;display:grid;grid-template-columns:minmax(190px,1fr) repeat(3,minmax(120px,.58fr));align-items:stretch;gap:8px}.overview-title{display:flex;align-items:center;gap:12px;padding:5px 8px;min-width:0}.seal{display:grid;place-items:center;width:48px;height:48px;flex:0 0 auto;border-radius:16px;color:#6be6a4;background:radial-gradient(circle,rgba(70,220,143,.24),rgba(39,153,103,.07));border:1px solid rgba(111,237,170,.21);box-shadow:0 0 25px rgba(62,215,135,.13)}.overview-title strong{display:block;font:20px/1.1 var(--mp-display-font,Georgia,serif);font-weight:400}.overview-title small{color:#7de5ab;font-size:11px}.overview-item{display:flex;align-items:center;gap:10px;padding:9px 13px;border-left:1px solid rgba(215,235,255,.12);color:#d9e6f2}.overview-item .mp-icon{color:#a9c6df}.overview-item strong{display:block;font-size:13px}.overview-item small{display:block;margin-top:3px;color:#9eb1c3;font-size:10px}
    mp-spatial-viewer{margin:clamp(14px,2vw,24px) 0 16px}
    .spatial-note{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:-2px 2px 20px;color:#b9cad9;font-size:12px}.spatial-note .mp-icon{color:var(--mp-accent)}.spatial-note a{margin-left:auto;min-height:36px;display:inline-flex;align-items:center;padding:0 13px;border-radius:999px;color:#eef7ff;text-decoration:none;border:1px solid color-mix(in srgb,var(--mp-accent) 45%,transparent);background:color-mix(in srgb,var(--mp-accent) 13%,transparent)}.spatial-note a:hover{background:color-mix(in srgb,var(--mp-accent) 24%,transparent)}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:10px 3px 15px}.section-label{display:flex;align-items:center;gap:12px}.section-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:var(--mp-icon-radius,14px);color:#ffe170;background:rgba(255,206,66,.11);border:1px solid rgba(255,221,118,.17);box-shadow:0 0 24px rgba(255,190,40,.08)}.section-head h2{margin:0;font:clamp(23px,2.2vw,31px)/1 var(--mp-display-font,Georgia,serif);font-weight:400}.section-head p{margin:5px 0 0;color:#aebfd0;font-size:12px}.section-action{display:flex;align-items:center;gap:8px;color:#c9d9e8;font-size:12px}.section-action i{width:7px;height:7px;border-radius:50%;background:#7be1aa;box-shadow:0 0 12px #56d99a}
    .grid{display:grid;grid-template-columns:repeat(var(--mp-columns,4),minmax(0,1fr));gap:var(--mp-gap,12px)}.grid>div{min-width:0}.rooms-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--mp-gap,12px)}.room{min-height:180px;padding:22px;border-radius:var(--mp-radius);color:white;text-decoration:none;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}.room::before{content:'';position:absolute;inset:0;background:linear-gradient(145deg,color-mix(in srgb,var(--mp-tint) 84%,transparent),rgba(4,20,35,.78));z-index:-1}.room:hover{border-color:color-mix(in srgb,var(--mp-accent) 65%,white);transform:translateY(-2px)}.room-icon{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:color-mix(in srgb,var(--mp-accent) 16%,transparent);color:#dff0ff}.room h3{font:26px/1 var(--mp-display-font,Georgia,serif);font-weight:400;margin:0}.room p{margin:7px 0 0;color:#b7c8d8;font-size:12px}.room-arrow{position:absolute;right:20px;top:22px}
    footer{display:flex;align-items:center;justify-content:center;gap:14px;padding:42px 0 4px;color:#9fb2c4;letter-spacing:.23em;text-transform:uppercase;font-size:9px}footer::before,footer::after{content:'';height:1px;width:50px;background:linear-gradient(90deg,transparent,rgba(207,228,248,.45))}footer::after{transform:scaleX(-1)}
    :host([motion]) nav .active{animation:breathe 3.4s ease-in-out infinite}:host([motion]) .room{transition:transform .2s ease,border-color .2s ease}:host([card-style=compact]) .grid{--mp-gap:8px}:host([card-style=spacious]) .grid{--mp-gap:20px}:host([icon-style=orb]){--mp-icon-radius:50%}:host([icon-style=minimal]){--mp-icon-radius:5px}:host([density=compact]) .hero{min-height:245px;padding-top:42px}@keyframes breathe{50%{filter:brightness(1.09);box-shadow:0 8px 29px color-mix(in srgb,var(--mp-accent) 34%,transparent)}}
    @container (max-width:1180px){nav .language{display:flex}.grid{grid-template-columns:repeat(min(3,var(--mp-columns)),minmax(0,1fr))}.rooms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{grid-template-columns:minmax(200px,1fr) auto}.header-tools{display:none}.hero{grid-template-columns:minmax(0,1.4fr) minmax(210px,.6fr)}}
    @container (max-width:960px){.settings-nav span{display:none}}
    @container (max-width:820px){nav .language{display:none}.brand .language{display:flex}.shell{padding:14px 20px 46px}header{grid-template-columns:1fr}.brand{justify-content:center}.brand small{display:none}nav{width:100%;min-width:0}nav a{flex:1 1 auto;min-width:0}nav a span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hero{min-height:300px;grid-template-columns:1fr;padding:48px 20px 30px}.quote{display:none}.overview-card{grid-template-columns:1fr repeat(3,minmax(90px,.48fr))}.overview-item{padding:7px 9px}.overview-item small{display:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @container (max-width:540px){.shell{padding:9px 10px 36px}header{padding:10px;gap:9px}.brand{justify-content:flex-start}.mark{width:40px;height:40px;border-radius:13px;font-size:29px}.brand strong{font-size:21px}nav a{padding:0 8px;font-size:12px}nav.hide-labels a span:last-child{display:none}.hero{min-height:285px;padding:44px 10px 26px}.hero h1{font-size:43px}.overview-card{grid-template-columns:1fr 1fr;padding:11px}.overview-title{grid-column:1/-1}.overview-item{border-left:0;border-top:1px solid rgba(215,235,255,.11)}.overview-item:last-child{display:none}.section-action{display:none}.grid,.rooms-grid{grid-template-columns:1fr;gap:10px}.page-intro{padding:42px 5px 27px}.room{min-height:150px}}
    /* Names too long for a narrow phone (a language, the fonts of the phone): the page shown keeps its name, the others their icon. */
    nav.compact a:not(.active) span:last-child{display:none}
    /* The home section follows the ambiance of the plan: its devices arranged room by room, easier to read. */
    .room-group{margin:4px 0 26px}
    .room-group>h3{display:flex;align-items:baseline;gap:10px;margin:0 3px 12px;font:20px/1 var(--mp-display-font,Georgia,serif);font-weight:400}
    .room-group>h3 .mp-icon{align-self:center;color:var(--mp-accent)}
    .room-group>h3 small{color:#93a8bb;font-size:10px;letter-spacing:.18em;text-transform:uppercase}
    .tile{width:100%;min-height:96px;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:var(--mp-radius);color:inherit;font:inherit;text-align:left;cursor:pointer}
    .tile:hover{border-color:color-mix(in srgb,var(--mp-accent) 65%,white)}
    .tile-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 auto;border-radius:var(--mp-icon-radius,14px);color:#bcd7ec;background:rgba(255,255,255,.06);border:1px solid rgba(212,232,250,.16)}
    .tile.on .tile-icon{color:#fff;background:color-mix(in srgb,var(--mp-accent) 26%,transparent);border-color:color-mix(in srgb,var(--mp-accent) 50%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--mp-accent) 25%,transparent)}
    .tile-text{min-width:0;display:grid;gap:5px}
    .tile-text strong{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tile-text small{color:#a9bdd0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tile-value{margin-left:auto;flex:0 0 auto;font:18px/1 var(--mp-display-font,Georgia,serif);color:#eaf4ff}
    .empty-ambiance{margin:6px 3px 22px;color:#9fb6ca;font-size:13px}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;

  cards: HTMLElement[] = [];
  hass?: Hass;
  private language = new LanguageController(this);
  private spatial?: SpatialPlan;
  private spatialOrigin: ViewConfig['mp_spatial_origin'] = 'project';
  badges: HTMLElement[] = [];
  private projectName = '';
  private appearance: AppearanceConfig = { preset:'glass-blue' };
  private navigation: NavigationConfig = { items:['home','lights','rooms'], showLabels:true };
  private viewKind: ViewConfig['mp_view_kind'] = 'home';
  private viewPath = 'home';
  private viewTitle = '';
  private areas: AreaSummary[] = [];
  private inventory?: ViewConfig['mp_inventory'];
  /** Entity of each card of `cards`, in the same order. */
  private entities: string[] = [];
  /** The ambiance the plan shows and the floors it shows: the home section follows them. */
  private planMode: PlanMode = 'lights';
  private planFloors: string[] = [];
  /** hui-root whose bar this view made transparent. */
  private header?: Element;
  /** The menu of languages under the flag, open or not. */
  private languageOpen = false;
  private resize = new ResizeObserver(() => this.fitNavigation());

  connectedCallback() {
    super.connectedCallback();
    this.header = claimHeader(this);
    addEventListener('pointerdown', this.outside);
    addEventListener('keydown', this.escape);
    this.resize.observe(this);
    void document.fonts?.ready.then(() => this.fitNavigation());
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.header) releaseHeader(this.header, this);
    this.header = undefined;
    removeEventListener('pointerdown', this.outside);
    removeEventListener('keydown', this.escape);
    this.resize.disconnect();
  }
  protected updated() { this.fitNavigation(); }
  /** Names of the navigation cut short on a narrow phone: only the page shown keeps its own. Measured, as it depends on the language and the fonts. */
  private fitNavigation() {
    const nav = this.renderRoot.querySelector('nav');
    if (!nav) return;
    nav.classList.remove('compact');
    nav.classList.toggle('compact', Array.from(nav.querySelectorAll('a span:last-child')).some(name => name.scrollWidth > name.clientWidth + 1));
  }
  /** The flag on screen: beside the clock, at the end of the navigation, or on the row of the name. */
  private get flagButton() { return [...this.renderRoot.querySelectorAll<HTMLElement>('.language > button')].find(button => button.offsetParent); }
  private outside = (e: Event) => {
    const path = e.composedPath();
    if (this.languageOpen && ![...this.renderRoot.querySelectorAll('.language')].some(menu => path.includes(menu))) this.languageOpen = false;
  };
  private escape = (e: KeyboardEvent) => {
    if (!this.languageOpen || e.key !== 'Escape') return;
    this.languageOpen = false;
    this.flagButton?.focus();
  };
  private toggleLanguage = () => {
    this.languageOpen = !this.languageOpen;
    if (this.languageOpen) void this.updateComplete.then(() => [...this.renderRoot.querySelectorAll<HTMLElement>('.language-menu [aria-checked="true"]')].find(item => item.offsetParent)?.focus());
  };
  /** Each user chooses their language here: Home Assistant keeps it for them, on all their devices. */
  private chooseLanguage(value: Language) {
    this.languageOpen = false;
    chooseLanguage(value, this.hass);
    this.flagButton?.focus();
  }
  /** A small flag: the language shown, and the others on a click. */
  private languageMenu() {
    const current = language(), label = tr('Langue : {language}', { language: LANGUAGE_NAMES[current] });
    return html`<div class="language"><button type="button" aria-haspopup="menu" aria-expanded=${this.languageOpen} aria-label=${label} title=${label} @click=${this.toggleLanguage}>${flag(current)}</button>
      ${this.languageOpen ? html`<div class="language-menu" role="menu" aria-label=${tr('Langue de l’interface')}>${LANGUAGES.map(value => html`<button type="button" role="menuitemradio" aria-checked=${value === current} lang=${value} @click=${() => this.chooseLanguage(value)}>${flag(value)}<span>${LANGUAGE_NAMES[value]}</span></button>`)}</div>` : nothing}</div>`;
  }

  setConfig(config: ViewConfig) {
    this.spatial = config?.mp_spatial;
    this.spatialOrigin = config?.mp_spatial_origin ?? 'project';
    this.requestUpdate();
    this.projectName = config?.mp_project_name ?? config?.title ?? '';
    this.appearance = config?.mp_appearance ?? { preset:'glass-blue' };
    this.navigation = config?.mp_navigation ?? { items:['home','lights','rooms'], showLabels:true };
    this.viewKind = config?.mp_view_kind ?? 'home';
    this.viewPath = config?.mp_view_path ?? 'home';
    this.viewTitle = config?.mp_view_title ?? this.projectName;
    this.areas = config?.mp_areas ?? [];
    this.inventory = config?.mp_inventory;
    this.entities = config?.mp_entities ?? [];
    this.toggleAttribute('motion', this.appearance.motion !== false);
    this.setAttribute('density', this.appearance.density ?? 'comfortable');
    this.setAttribute('card-style', this.appearance.cardStyle ?? 'standard');
    this.setAttribute('icon-style', this.appearance.iconStyle ?? 'tile');
  }

  private greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? tr('Bonjour') : hour < 18 ? tr('Bon après-midi') : tr('Bonsoir');
  }
  private route(path: string) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return `/${[...parts.slice(0,-1),path].join('/')}`;
  }
  private areaHref = (areaId: string) => this.areas.some(area=>area.id===areaId) ? this.route(`area-${areaId}`) : undefined;
  private navItem(item: NavigationItem) {
    const meta = {
      home:{label:tr('Accueil'),icon:'home' as const},
      lights:{label:tr('Lumières'),icon:'bulb' as const},
      rooms:{label:tr('Pièces'),icon:'rooms' as const},
    }[item];
    const active = this.viewKind === item || (item === 'rooms' && this.viewKind === 'area');
    return html`<a class=${active?'active':''} href=${this.route(item)} aria-current=${active?'page':nothing}>${mpIcon(meta.icon,item==='home'?20:19)}<span>${meta.label}</span></a>`;
  }
  private section(title: string, subtitle: string, icon?: MPIconName) {
    return html`<div class="section-head"><div class="section-label"><span class="section-icon">${mpIcon(icon ?? (this.viewKind==='rooms'?'rooms':'bulb'),23)}</span><div><h2>${title}</h2><p>${subtitle}</p></div></div><span class="section-action"><i></i> ${tr('Synchronisé avec Home Assistant')}</span></div>`;
  }

  /** Title, subtitle and icon of the home section for each ambiance of the plan. */
  private static AMBIANCES: Record<PlanMode,{title:MessageKey;subtitle:MessageKey;icon:MPIconName}> = {
    lights:{title:'Lumières',subtitle:'Contrôle rapide de tous les éclairages détectés',icon:'bulb'},
    climate:{title:'Climat',subtitle:'Températures et chauffage, pièce par pièce',icon:'thermo'},
    openings:{title:'Ouvrants',subtitle:'Portes, fenêtres et volets, pièce par pièce',icon:'window'},
    media:{title:'Audio-vidéo',subtitle:'Téléviseurs et enceintes, pièce par pièce',icon:'tv'},
  };
  private planAmbiance = (e: CustomEvent<{mode:PlanMode;floorIds:string[]}>) => {
    this.planMode = e.detail.mode;
    this.planFloors = e.detail.floorIds;
  };
  private moreInfo(entityId: string) { this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId},bubbles:true,composed:true})); }
  private format(value: number, digits = 1) { return new Intl.NumberFormat(locale(),{maximumFractionDigits:digits}).format(value); }
  /** "Salon · Téléviseur" shown as "Téléviseur" inside its Salon group. */
  private static shorten(name: string, room: string) {
    const rest=name.slice(room.length);
    if(!room||!/^[\s·:|/–—-]/.test(rest)||name.slice(0,room.length).localeCompare(room,undefined,{sensitivity:'base'})!==0)return name;
    return rest.replace(/^[\s·:|/–—-]+/,'')||name;
  }
  /** A device the ambiance reads without a card of its own: its state at a glance, details on a touch. */
  private tile(id: string, room: string) {
    const state=this.hass?.states[id],ready=available(state);
    const name=MPGlassView.shorten(String(state?.attributes.friendly_name??id),room);
    const domain=id.split('.')[0],deviceClass=String(state?.attributes.device_class??'');
    let icon:MPIconName='gauge',detail=ready?String(state!.state):tr('Indisponible'),value='',on=false;
    if(domain==='climate'){
      icon='flame';
      if(ready){
        on=state!.state!=='off';
        const current=finite(state!.attributes.current_temperature),target=finite(state!.attributes.temperature);
        value=current===undefined?'':`${this.format(current)} °`;
        detail=target===undefined?stateName(HVAC,state!.state):tr('{mode} · consigne {n} °',{mode:stateName(HVAC,state!.state),n:this.format(target)});
      }
    } else if(domain==='media_player'){
      icon=mediaIsTv(state)?'tv':'speaker';
      if(ready){
        on=mediaOn(state);
        const playing=nowPlaying(state),label=stateName(MEDIA_STATES,state!.state);
        detail=playing&&['playing','paused'].includes(state!.state)?`${label} · ${playing}`:label;
      }
    } else if(domain==='cover'){
      icon=deviceClass==='curtain'?'curtain':'shutter';
      if(ready){
        on=coverOpen(state)===true;
        const percent=coverPosition(state);
        value=percent===undefined?'':tr('{n} %',{n:this.format(percent,0)});
        detail=percent===undefined?tr('{state} · position inconnue',{state:stateName(COVER_STATES,state!.state)}):tr('{state} · {n} % ouvert',{state:stateName(COVER_STATES,state!.state),n:this.format(percent,0)});
      }
    } else if(domain==='binary_sensor'){
      icon='window';
      if(ready){on=state!.state==='on';detail=on?tr('Ouverte'):tr('Fermée');}
    } else if(domain==='sensor'){
      const humidity=deviceClass==='humidity';
      icon=humidity?'drop':'thermo';
      if(ready){
        const reading=finite(state!.state),unit=String(state!.attributes.unit_of_measurement??'');
        value=reading===undefined?String(state!.state):`${this.format(reading)}${unit?` ${unit}`:''}`;
        detail=humidity?tr('Humidité'):tr('Température');
      }
    } else if(domain==='light'){
      icon='bulb';
      if(ready){on=state!.state==='on';detail=on?tr('Allumée'):tr('Éteinte');}
    }
    return html`<button class=${`tile glass ${on?'on':''}`} title=${tr('Détails')} @click=${()=>this.moreInfo(id)}>
      <span class="tile-icon">${mpIcon(icon,20)}</span>
      <span class="tile-text"><strong>${name}</strong><small>${detail}</small></span>
      ${value?html`<span class="tile-value">${value}</span>`:nothing}
    </button>`;
  }
  /** Below the plan, the devices of its ambiance on the floors it shows, arranged room by room. */
  private ambianceSection(spatial: SpatialPlan) {
    const a=this.appearance,mode=this.planMode,states=this.hass?.states??{},meta=MPGlassView.AMBIANCES[mode];
    const floors=spatial.floors.filter(f=>!this.planFloors.length||this.planFloors.includes(f.id));
    const several=floors.length>1;
    const cardOf=new Map(this.entities.map((id,i)=>[id,this.cards[i]] as const));
    const groups=floors.flatMap(f=>f.rooms.map(room=>({floor:f,room,ids:ambianceEntities(room,states,mode)}))).filter(g=>g.ids.length);
    // Lights of the dashboard placed in no room of the plan stay reachable, in a group of their own.
    const placed=new Set(spatial.floors.flatMap(f=>f.rooms.flatMap(r=>roomEntityIds(r))));
    const leftover=mode==='lights'?this.entities.filter(id=>id&&!placed.has(id)):[];
    const title=mode==='lights'?trDefault(a.sectionTitle,'Lumières'):tr(meta.title);
    const subtitle=mode==='lights'?trDefault(a.sectionSubtitle,'Contrôle rapide de tous les éclairages détectés'):tr(meta.subtitle);
    return html`${this.section(title,subtitle,meta.icon)}
      <main>
        ${groups.length||leftover.length?nothing:html`<p class="empty-ambiance">${tr('Aucun équipement de cette ambiance sur ce niveau.')}</p>`}
        ${groups.map(g=>html`<section class="room-group">
          <h3>${mpIcon(roomIcon(g.room.name),17)}<span>${g.room.name}</span>${several?html`<small>${g.floor.name}</small>`:nothing}</h3>
          <div class="grid">${g.ids.map(id=>html`<div>${cardOf.get(id)??this.tile(id,g.room.name)}</div>`)}</div>
        </section>`)}
        ${leftover.length?html`<section class="room-group">
          <h3>${mpIcon('bulb',17)}<span>${tr('Hors du plan')}</span></h3>
          <div class="grid">${leftover.map(id=>html`<div>${cardOf.get(id)??this.tile(id,'')}</div>`)}</div>
        </section>`:nothing}
      </main>`;
  }

  render() {
    const now = new Date();
    const a = this.appearance;
    const bg = a.backgroundUrl || MP_GLASS_BACKGROUND;
    const fonts = a.fontStyle === 'modern' ? '--mp-display-font:Inter,system-ui,sans-serif' : a.fontStyle === 'soft' ? '--mp-display-font:ui-rounded,system-ui,sans-serif' : '--mp-display-font:Georgia,serif';
    const style = `--mp-accent:${a.accent ?? '#69b7ff'};--mp-secondary:${a.secondaryAccent ?? '#efbd8b'};--mp-tint:${a.glassTint ?? '#12344f'};--mp-opacity:${a.glassOpacity ?? .66};--mp-blur:${a.glassBlur ?? 24}px;--mp-border:${a.borderStrength ?? .2};--mp-shadow:${a.shadowStrength ?? .35};--mp-radius:${a.radius ?? 22}px;--mp-columns:${a.cardColumns ?? 4};--mp-gap:${a.cardGap ?? 12}px;--mp-max-width:${a.maxWidth ?? 1560}px;--mp-hero-height:${a.heroHeight ?? 455}px;--mp-bg-blur:${a.backgroundBlur ?? 0}px;--mp-bg-saturation:${a.backgroundSaturation ?? 1};${fonts}`;
    const total = this.cards.length;
    const projectName = this.projectName || tr('Maison'), viewTitle = this.viewTitle || projectName;
    const title = this.viewKind === 'lights' ? tr('Toutes les lumières') : this.viewKind === 'rooms' ? tr('Vos pièces') : viewTitle;
    const subtitle = this.viewKind === 'lights' ? tr('{n} éclairage détecté et contrôlable|{n} éclairages détectés et contrôlables',{n:total}) : this.viewKind === 'rooms' ? tr('{n} espace organisé automatiquement|{n} espaces organisés automatiquement',{n:this.areas.length}) : tr('Les équipements de {name}',{name:viewTitle});
    // A plan MP Glass drew itself (from the areas, or its example) names its own rooms and floors in the interface language.
    const spatial = this.spatial && this.spatialOrigin !== 'project' ? trPlan(this.spatial, this.spatialOrigin === 'example') : this.spatial;
    return html`
      <div class="backdrop" style=${`background-image:url(${bg});background-position:${a.backgroundPosition ?? 'right'} center`}></div>
      <div class="shade" style=${`opacity:${a.backgroundDim ?? .44}`}></div><div class="ambient"></div>
      <div class="shell" style=${style}>
        <header class="glass">
          <div class="brand"><span class="mark">≋</span><div><strong>${projectName}</strong><small>Home Assistant · MP Glass</small></div>${this.languageMenu()}</div>
          <nav class=${this.navigation.showLabels?'':'hide-labels'} aria-label=${tr('Navigation')}>${this.navigation.items.map(item=>this.navItem(item))}${a.showSettingsShortcut === false ? nothing : html`<a class="settings-nav" href="/mp-glass-settings" title=${tr('Personnaliser MP Glass')}>${mpIcon('tune',18)}<span>${tr('Personnaliser')}</span></a>`}${this.languageMenu()}</nav>
          <div class="header-tools">
            ${this.languageMenu()}
            ${a.showClock === false ? nothing : html`<div class="clock"><strong>${new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit'}).format(now)}</strong><small><i></i>${new Intl.DateTimeFormat(locale(),{weekday:'short',day:'numeric',month:'short'}).format(now)}</small></div>`}
          </div>
        </header>
        ${this.viewKind === 'home' && spatial?.enabled ? html`<mp-spatial-viewer .plan=${spatial} .hass=${this.hass} .areaHref=${this.areaHref} @plan-ambiance=${this.planAmbiance}></mp-spatial-viewer>${this.spatialOrigin === 'project' ? nothing : html`<p class="spatial-note">${mpIcon('rooms',15)}<span>${this.spatialOrigin === 'areas' ? tr('Plan schématique créé à partir de vos pièces Home Assistant.') : tr('Plan d’exemple : créez vos pièces dans Home Assistant ou importez votre plan.')}</span>${this.hass?.user?.is_admin ? html`<a href="/mp-glass-settings?section=spatial">${tr('Importer ou dessiner mon plan')}</a>` : nothing}</p>`}` :this.viewKind === 'home' && a.showHero !== false ? html`<section class="hero"><div class="hero-copy"><div class="eyebrow">${mpIcon('sparkle',16)} ${trDefault(a.eyebrow,'Une maison plus simple à vivre')}</div><h1>${this.greeting()},<br>${tr('la maison est avec vous.')}</h1><p>${trDefault(a.subtitle,'Vos équipements sont prêts, pièce par pièce.')}</p><div class="hero-meta"><span class="chip">${mpIcon('bulb',14)} ${tr('{n} équipement|{n} équipements',{n:total})}</span><span class="chip">${mpIcon('shield',14)} ${tr('Interface locale')}</span></div></div><div class="quote">${tr('« {text} »',{text:trDefault(a.quote,'Les plus beaux moments commencent à la maison.')})}</div></section>` : this.viewKind !== 'home' ? html`<section class="page-intro"><div class="eyebrow">${mpIcon(this.viewKind==='rooms'?'rooms':'sparkle',16)} MP Glass</div><h1>${title}</h1><p>${subtitle}</p></section>` : nothing}
        ${this.viewKind === 'home' && a.showOverview !== false ? html`<section class="overview"><div class="overview-card glass"><div class="overview-title"><span class="seal">${mpIcon('shield',25)}</span><div><strong>${tr('La maison')}</strong><small>${tr('Tout est prêt')}</small></div></div><div class="overview-item">${mpIcon('bulb',21)}<div><strong>${tr('{n} équipement|{n} équipements',{n:total})}</strong><small>${tr('Détectés')}</small></div></div><div class="overview-item">${mpIcon('rooms',21)}<div><strong>${tr('{n} pièce|{n} pièces',{n:this.areas.length})}</strong><small>${tr('Organisation automatique')}</small></div></div><div class="overview-item">${mpIcon('sliders',21)}<div><strong>${tr('Contrôles')}</strong><small>${tr('Disponibles en direct')}</small></div></div></div></section>` : nothing}
        <div class="badges">${this.badges}</div>
        ${this.viewKind === 'rooms' ? html`
          ${this.section(tr('Pièces'),tr('Ouvrez une pièce pour retrouver uniquement ses équipements'))}
          <main class="rooms-grid">${this.areas.map(area=>html`<a class="room glass" href=${this.route(`area-${area.id}`)}><span class="room-icon">${mpIcon('rooms',25)}</span><span class="room-arrow">${mpIcon('arrow',20)}</span><div><h3>${area.name}</h3><p>${tr('{n} équipement|{n} équipements',{n:area.deviceCount})} · ${tr('{n} lumière|{n} lumières',{n:area.lightCount})}</p></div></a>`)}${this.inventory ? html`<a class="room glass" href=${this.route('inventory')}><span class="room-icon">${mpIcon('scan',25)}</span><span class="room-arrow">${mpIcon('arrow',20)}</span><div><h3>${this.inventory.title}</h3><p>${tr('{n} entité sans carte dédiée|{n} entités sans carte dédiée',{n:this.inventory.count})}</p></div></a>` : nothing}</main>
        ` : this.viewKind === 'home' && spatial?.enabled ? this.ambianceSection(spatial) : html`
          ${this.section(this.viewKind === 'home' ? trDefault(a.sectionTitle,'Lumières') : title,this.viewKind === 'home' ? trDefault(a.sectionSubtitle,'Contrôle rapide de tous les éclairages détectés') : subtitle)}
          <main class="grid">${this.cards.map(card=>html`<div>${card}</div>`)}</main>
        `}
        ${a.showFooter === false ? nothing : html`<footer><span>≋</span> MP Glass · ${tr('Votre maison, simplement')}</footer>`}
      </div>`;
  }
}
