import { LitElement, html, css } from 'lit';
import type { AppearanceConfig } from '../shared/models';
import { MP_GLASS_BACKGROUND } from './background';
import { mpIcon } from './icons';

export class MPGlassView extends LitElement {
  static properties = { cards: { attribute: false }, badges: { attribute: false } };
  static styles = css`
    :host {
      display:block;
      flex:1 1 100%;
      width:100%;
      min-width:0;
      min-height:100vh;
      container-type:inline-size;
      box-sizing:border-box;
      color:#f8fbff;
      font-family:Inter,ui-sans-serif,system-ui,sans-serif;
      position:relative;
      isolation:isolate;
      overflow:hidden;
      background:#061421;
    }
    * { box-sizing:border-box; }
    .backdrop,.shade,.ambient { position:fixed; inset:0; pointer-events:none; }
    .backdrop { z-index:-4; background-size:cover; background-repeat:no-repeat; transform:scale(1.015); }
    .shade { z-index:-3; background:linear-gradient(90deg,rgba(2,13,25,.8),rgba(3,18,31,.17) 58%,rgba(2,10,19,.38)),linear-gradient(0deg,rgba(2,11,21,.95),transparent 72%); }
    .ambient { z-index:-2; background:radial-gradient(circle at 18% 15%,color-mix(in srgb,var(--mp-accent,#69b7ff) 13%,transparent),transparent 34%),radial-gradient(circle at 85% 70%,rgba(246,173,91,.08),transparent 28%); }
    .shell { width:min(100%,1560px); margin:auto; padding:clamp(14px,2.4vw,36px) clamp(14px,3.2vw,50px) 58px; }
    .glass { background:linear-gradient(145deg,rgba(26,57,83,var(--mp-opacity,.66)),rgba(7,27,47,calc(var(--mp-opacity,.66) + .02)) 72%); border:1px solid color-mix(in srgb,var(--mp-accent,#69b7ff) 20%,rgba(224,239,255,.4)); box-shadow:0 22px 55px rgba(0,8,18,.26),inset 0 1px rgba(255,255,255,.13); backdrop-filter:blur(var(--mp-blur,24px)) saturate(145%); }
    header { min-height:82px; padding:12px 18px; border-radius:var(--mp-radius,22px); display:grid; grid-template-columns:minmax(220px,1fr) auto minmax(155px,1fr); align-items:center; gap:18px; }
    .brand { display:flex; align-items:center; gap:14px; min-width:0; }
    .mark { width:47px; height:47px; flex:0 0 auto; display:grid; place-items:center; border-radius:15px; color:#f3d2a8; background:linear-gradient(145deg,rgba(255,227,194,.12),rgba(255,255,255,.025)); border:1px solid rgba(255,225,190,.18); font:36px/1 Georgia,serif; text-shadow:0 0 18px rgba(242,199,147,.32); transform:rotate(-5deg); }
    .brand strong { display:block; font:clamp(21px,2vw,31px)/1 Georgia,serif; font-weight:400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .brand small { display:block; margin-top:7px; letter-spacing:.25em; text-transform:uppercase; color:#aebfd1; font-size:9px; }
    nav { display:flex; gap:4px; padding:4px; border:1px solid rgba(201,225,250,.14); border-radius:18px; background:rgba(3,18,32,.26); }
    nav span { min-height:46px; padding:0 17px; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:9px; color:#d4e1ed; font-size:13px; }
    nav .active { background:linear-gradient(145deg,color-mix(in srgb,var(--mp-accent,#69b7ff) 76%,transparent),rgba(38,94,149,.68)); border:1px solid color-mix(in srgb,var(--mp-accent,#69b7ff) 78%,white); box-shadow:0 7px 24px color-mix(in srgb,var(--mp-accent,#69b7ff) 25%,transparent),inset 0 1px rgba(255,255,255,.25); }
    nav .active .mp-icon { filter:drop-shadow(0 0 8px currentColor); }
    .clock { text-align:right; }
    .clock strong { display:block; font:28px/1 Georgia,serif; font-weight:400; letter-spacing:.02em; }
    .clock small { display:flex; justify-content:flex-end; align-items:center; gap:7px; color:#b7c6d6; margin-top:7px; font-size:11px; }
    .clock i { width:6px; height:6px; border-radius:50%; background:#79e6ae; box-shadow:0 0 11px #56d99a; }
    .hero { min-height:clamp(260px,34vw,455px); display:grid; grid-template-columns:minmax(0,1.35fr) minmax(230px,.65fr); align-items:center; padding:clamp(42px,7vw,94px) 24px clamp(28px,4vw,52px); gap:50px; }
    .hero-copy { max-width:780px; }
    .eyebrow { font-size:10px; letter-spacing:.32em; text-transform:uppercase; margin-bottom:18px; display:flex; align-items:center; gap:11px; font-weight:650; }
    .eyebrow::after { content:''; width:44px; height:1px; background:linear-gradient(90deg,var(--mp-accent,#69b7ff),transparent); }
    .eyebrow .mp-icon { color:var(--mp-accent,#69b7ff); filter:drop-shadow(0 0 9px var(--mp-accent,#69b7ff)); }
    .hero h1 { font:clamp(43px,5.5vw,82px)/.98 Georgia,serif; font-weight:400; letter-spacing:-.035em; margin:0; max-width:860px; text-wrap:balance; text-shadow:0 4px 22px rgba(0,5,15,.6); }
    .hero p { font-size:clamp(15px,1.45vw,21px); color:#d3dfea; margin:18px 0 0; max-width:620px; }
    .hero-meta { display:flex; gap:9px; flex-wrap:wrap; margin-top:20px; }
    .chip { display:inline-flex; align-items:center; gap:8px; min-height:32px; padding:0 11px; border-radius:999px; background:rgba(3,21,37,.38); border:1px solid rgba(211,233,255,.17); color:#dce9f5; font-size:11px; backdrop-filter:blur(12px); }
    .chip .mp-icon { color:#ffd56c; }
    .quote { justify-self:end; max-width:335px; border-left:1px solid rgba(255,255,255,.38); padding:15px 0 15px clamp(24px,3vw,42px); font:italic clamp(18px,1.8vw,27px)/1.45 Georgia,serif; color:#f5eee7; text-shadow:0 2px 13px rgba(0,6,14,.75); }
    .quote::after { content:''; display:block; width:34px; height:2px; margin-top:20px; background:var(--mp-accent,#69b7ff); border-radius:99px; box-shadow:0 0 12px color-mix(in srgb,var(--mp-accent,#69b7ff) 45%,transparent); }
    .overview { padding:0 0 16px; }
    .overview-card { min-height:94px; border-radius:var(--mp-radius,22px); padding:13px 16px; display:grid; grid-template-columns:minmax(190px,1fr) repeat(3,minmax(120px,.58fr)); align-items:stretch; gap:8px; }
    .overview-title { display:flex; align-items:center; gap:12px; padding:5px 8px; min-width:0; }
    .overview-title .seal { display:grid; place-items:center; width:48px; height:48px; flex:0 0 auto; border-radius:16px; color:#6be6a4; background:radial-gradient(circle,rgba(70,220,143,.24),rgba(39,153,103,.07)); border:1px solid rgba(111,237,170,.21); box-shadow:0 0 25px rgba(62,215,135,.13); }
    .overview-title strong { display:block; font:20px/1.1 Georgia,serif; font-weight:400; }
    .overview-title small { color:#7de5ab; font-size:11px; }
    .overview-item { display:flex; align-items:center; gap:10px; padding:9px 13px; border-left:1px solid rgba(215,235,255,.12); color:#d9e6f2; }
    .overview-item .mp-icon { color:#a9c6df; }
    .overview-item strong { display:block; font-size:13px; }
    .overview-item small { display:block; margin-top:3px; color:#9eb1c3; font-size:10px; }
    .badges { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
    .section-head { display:flex; align-items:end; justify-content:space-between; gap:18px; margin:10px 3px 15px; }
    .section-label { display:flex; align-items:center; gap:12px; }
    .section-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:14px; color:#ffe170; background:rgba(255,206,66,.11); border:1px solid rgba(255,221,118,.17); box-shadow:0 0 24px rgba(255,190,40,.08); }
    .section-head h2 { margin:0; font:clamp(23px,2.2vw,31px)/1 Georgia,serif; font-weight:400; }
    .section-head p { margin:5px 0 0; color:#aebfd0; font-size:12px; }
    .section-action { display:flex; align-items:center; gap:8px; color:#c9d9e8; font-size:12px; }
    .section-action i { width:7px; height:7px; border-radius:50%; background:#7be1aa; box-shadow:0 0 12px #56d99a; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .grid>div { min-width:0; }
    footer { display:flex; align-items:center; justify-content:center; gap:14px; padding:42px 0 4px; color:#9fb2c4; letter-spacing:.23em; text-transform:uppercase; font-size:9px; }
    footer::before,footer::after { content:''; height:1px; width:50px; background:linear-gradient(90deg,transparent,rgba(207,228,248,.45)); } footer::after { transform:scaleX(-1); }
    :host([motion]) nav .active { animation:breathe 3.4s ease-in-out infinite; }
    :host([density=compact]) .hero { min-height:245px; padding-top:42px; }
    :host([density=compact]) .grid { gap:9px; }
    @keyframes breathe { 50% { filter:brightness(1.09); box-shadow:0 8px 29px color-mix(in srgb,var(--mp-accent,#69b7ff) 34%,transparent); } }
    @container (max-width:1120px) { .grid{grid-template-columns:repeat(3,minmax(0,1fr))} header{grid-template-columns:minmax(200px,1fr) auto}.clock{display:none}.hero{grid-template-columns:minmax(0,1.4fr) minmax(210px,.6fr)} }
    @container (max-width:820px) {
      .shell{padding:14px 20px 46px} header{grid-template-columns:1fr auto}.brand small{display:none} nav{grid-row:2;grid-column:1/-1;width:100%}nav span{flex:1}.hero{min-height:300px;grid-template-columns:1fr;padding:48px 20px 30px}.quote{display:none}.overview-card{grid-template-columns:1fr repeat(3,minmax(90px,.48fr))}.overview-item{padding:7px 9px}.overview-item small{display:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @container (max-width:540px) {
      .shell{padding:9px 10px 36px}header{padding:10px 11px;gap:9px}.mark{width:40px;height:40px;border-radius:13px;font-size:29px}.brand strong{font-size:21px}.clock{display:block}.clock strong{font-size:21px}.clock small{display:none}nav span{padding:0 9px;font-size:12px}.hero{min-height:285px;padding:44px 10px 26px}.hero h1{font-size:43px}.hero p{font-size:15px}.overview-card{grid-template-columns:1fr 1fr;padding:11px}.overview-title{grid-column:1/-1}.overview-item{border-left:0;border-top:1px solid rgba(215,235,255,.11)}.overview-item:last-child{display:none}.section-action{display:none}.grid{grid-template-columns:1fr;gap:10px}
    }
    @media (prefers-reduced-motion:reduce) { * { animation:none!important; } }
  `;

  cards: HTMLElement[] = [];
  badges: HTMLElement[] = [];
  private projectName = 'Maison';
  private appearance: AppearanceConfig = { preset: 'glass-blue' };

  setConfig(config: { mp_project_name?: string; title?: string; mp_appearance?: AppearanceConfig }) {
    this.projectName = config?.mp_project_name ?? config?.title ?? 'Maison';
    this.appearance = config?.mp_appearance ?? { preset: 'glass-blue' };
    this.toggleAttribute('motion', this.appearance.motion !== false);
    this.setAttribute('density', this.appearance.density ?? 'comfortable');
  }

  private greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  }

  render() {
    const now = new Date();
    const a = this.appearance;
    const bg = a.backgroundUrl || MP_GLASS_BACKGROUND;
    const style = `--mp-accent:${a.accent ?? '#69b7ff'};--mp-opacity:${a.glassOpacity ?? .66};--mp-blur:${a.glassBlur ?? 24}px;--mp-radius:${a.radius ?? 22}px`;
    const total = this.cards.length;
    return html`
      <div class="backdrop" style=${`background-image:url(${bg});background-position:${a.backgroundPosition ?? 'right'} center`}></div>
      <div class="shade" style=${`opacity:${a.backgroundDim ?? .44}`}></div><div class="ambient"></div>
      <div class="shell" style=${style}>
        <header class="glass">
          <div class="brand"><span class="mark">≋</span><div><strong>${this.projectName}</strong><small>Home Assistant · MP Glass</small></div></div>
          <nav aria-label="Navigation"><span class="active">${mpIcon('home',20)} Accueil</span><span>${mpIcon('bulb',19)} Lumières</span><span>${mpIcon('rooms',19)} Pièces</span></nav>
          <div class="clock"><strong>${new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now)}</strong><small><i></i>${new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(now)}</small></div>
        </header>
        ${a.showHero === false ? '' : html`<section class="hero"><div class="hero-copy"><div class="eyebrow">${mpIcon('sparkle',16)} ${a.eyebrow ?? 'Une maison plus simple à vivre'}</div><h1>${this.greeting()},<br>la maison est avec vous.</h1><p>${a.subtitle ?? 'Vos équipements sont prêts, pièce par pièce.'}</p><div class="hero-meta"><span class="chip">${mpIcon('bulb',14)} ${total} éclairages</span><span class="chip">${mpIcon('shield',14)} Interface locale</span></div></div><div class="quote">« ${a.quote ?? 'Les plus beaux moments commencent à la maison.'} »</div></section>`}
        <section class="overview"><div class="overview-card glass"><div class="overview-title"><span class="seal">${mpIcon('shield',25)}</span><div><strong>La maison</strong><small>Tout est prêt</small></div></div><div class="overview-item">${mpIcon('bulb',21)}<div><strong>${total} éclairages</strong><small>Détectés</small></div></div><div class="overview-item">${mpIcon('rooms',21)}<div><strong>Pièces</strong><small>Organisation automatique</small></div></div><div class="overview-item">${mpIcon('sliders',21)}<div><strong>Contrôles</strong><small>Disponibles en direct</small></div></div></div></section>
        <div class="badges">${this.badges}</div>
        <div class="section-head"><div class="section-label"><span class="section-icon">${mpIcon('bulb',23)}</span><div><h2>Lumières</h2><p>Contrôle rapide de tous les éclairages détectés</p></div></div><span class="section-action"><i></i> Synchronisé avec Home Assistant</span></div>
        <main class="grid">${this.cards.map(card => html`<div>${card}</div>`)}</main>
        <footer><span>≋</span> MP Glass · Votre maison, simplement</footer>
      </div>`;
  }
}
