import { LitElement, html, css } from 'lit';
import type { AppearanceConfig } from '../shared/models';
import { MP_GLASS_BACKGROUND } from './background';
import { mpIcon } from './icons';

export class MPGlassView extends LitElement {
  static properties = { cards: { attribute: false }, badges: { attribute: false } };
  static styles = css`
    :host{display:block;flex:1 1 100%;width:100%;min-width:0;min-height:100vh;container-type:inline-size;box-sizing:border-box;color:#f8fbff;font-family:Inter,ui-sans-serif,system-ui,sans-serif;position:relative;isolation:isolate;overflow:hidden;background:#071728}
    .backdrop,.shade{position:fixed;inset:0;pointer-events:none}.backdrop{z-index:-3;background-size:cover;background-repeat:no-repeat}.shade{z-index:-2;background:linear-gradient(90deg,rgba(3,15,28,.78),rgba(4,20,35,.22) 54%,rgba(2,11,21,.38)),linear-gradient(0deg,rgba(2,12,23,.94),transparent 64%)}
    *{box-sizing:border-box}.shell{max-width:1500px;margin:auto;padding:18px clamp(16px,3vw,44px) 56px}.glass{background:linear-gradient(135deg,rgba(17,48,75,var(--mp-opacity,.62)),rgba(7,28,48,calc(var(--mp-opacity,.62) - .08)));border:1px solid color-mix(in srgb,var(--mp-accent,#69b7ff) 25%,rgba(225,239,255,.3));border-radius:var(--mp-radius,22px);box-shadow:0 18px 46px rgba(0,8,18,.32),inset 0 1px rgba(255,255,255,.11);backdrop-filter:blur(var(--mp-blur,22px)) saturate(140%)}
    header{min-height:82px;padding:13px 22px;display:grid;grid-template-columns:minmax(220px,1fr) auto minmax(180px,1fr);align-items:center;gap:20px}.brand{display:flex;gap:15px;align-items:center}.waves{font:42px/1 Georgia,serif;color:#f5d7b2;transform:rotate(-5deg)}.brand strong{display:block;font:clamp(22px,2.4vw,35px)/1.05 Georgia,serif;font-weight:400}.brand small{display:block;margin-top:7px;letter-spacing:.26em;text-transform:uppercase;color:#b9cce0;font-size:10px}
    nav{display:flex;gap:5px;padding:5px;border:1px solid rgba(194,222,252,.18);border-radius:20px;background:rgba(6,25,44,.3)}nav span{min-height:48px;padding:0 20px;border-radius:15px;display:flex;align-items:center;gap:9px;color:#dbe8f6}nav svg{filter:drop-shadow(0 0 8px currentColor)}nav .active{background:linear-gradient(135deg,color-mix(in srgb,var(--mp-accent,#69b7ff) 72%,transparent),rgba(25,76,132,.65));border:1px solid color-mix(in srgb,var(--mp-accent,#69b7ff) 85%,white);box-shadow:0 0 28px color-mix(in srgb,var(--mp-accent,#69b7ff) 35%,transparent)}.clock{text-align:right}.clock strong{font:30px/1 Georgia,serif;font-weight:400}.clock small{display:block;color:#c2d1e1;margin-top:6px}
    .hero{min-height:310px;display:flex;align-items:center;justify-content:space-between;padding:clamp(42px,8vw,96px) 22px 28px;gap:38px}.eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;gap:12px}.eyebrow svg{color:var(--mp-accent,#69b7ff);filter:drop-shadow(0 0 9px var(--mp-accent,#69b7ff))}.hero h1{font:clamp(45px,6vw,80px)/.98 Georgia,serif;font-weight:400;margin:0;text-shadow:0 3px 18px #001}.hero p{font-size:clamp(17px,1.7vw,24px);color:#d5e1ed;margin:16px 0 0}.quote{max-width:310px;border-left:1px solid rgba(255,255,255,.5);padding:14px 0 14px 38px;font:italic clamp(18px,2vw,27px)/1.35 Georgia,serif;color:#f4eee8}.count{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:8px 12px;border-radius:999px;background:rgba(4,23,40,.42);border:1px solid rgba(213,234,255,.2);color:#d9e9f7;font-size:13px}.count svg{color:#ffd66f}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.grid>div{min-width:0}
    :host([motion]) nav .active{animation:breathe 3s ease-in-out infinite}:host([density=compact]) .hero{min-height:230px;padding-top:44px}:host([density=compact]) .grid{gap:10px}@keyframes breathe{50%{filter:brightness(1.15);box-shadow:0 0 34px color-mix(in srgb,var(--mp-accent,#69b7ff) 45%,transparent)}}
    @container(max-width:850px){header{grid-template-columns:1fr auto}nav{grid-row:2;grid-column:1/-1;justify-self:stretch;overflow:auto}nav span{flex:1;justify-content:center}.hero{min-height:270px}.quote{display:none}}
    @container(max-width:600px){.shell{padding:10px 10px 40px}header{padding:12px 14px}.brand strong{font-size:24px}.brand small{display:none}.waves{font-size:32px}.clock strong{font-size:24px}nav span{padding:0 13px;font-size:14px}.hero{min-height:250px;padding:46px 12px 24px}.hero h1{font-size:46px}.grid{grid-template-columns:1fr;gap:10px}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important}}
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
  private greeting() { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; }
  render() {
    const now = new Date(); const a = this.appearance; const bg = a.backgroundUrl || MP_GLASS_BACKGROUND;
    const style = `--mp-accent:${a.accent ?? '#69b7ff'};--mp-opacity:${a.glassOpacity ?? .62};--mp-blur:${a.glassBlur ?? 22}px;--mp-radius:${a.radius ?? 22}px`;
    return html`<div class="backdrop" style=${`background-image:url(${bg});background-position:${a.backgroundPosition ?? 'right'} center`}></div><div class="shade" style=${`opacity:${a.backgroundDim ?? .44}`}></div><div class="shell" style=${style}><header class="glass"><div class="brand"><span class="waves">≈</span><div><strong>${this.projectName}</strong><small>Home Assistant · MP Glass</small></div></div><nav aria-label="Navigation"><span class="active">${mpIcon('home',20)} Accueil</span><span>${mpIcon('bulb',20)} Lumières</span><span>${mpIcon('rooms',20)} Pièces</span></nav><div class="clock"><strong>${new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now)}</strong><small>${new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(now)}</small></div></header>${a.showHero === false ? '' : html`<section class="hero"><div><div class="eyebrow">${mpIcon('sparkle',18)} ${a.eyebrow ?? 'Une maison plus simple à vivre'}</div><h1>${this.greeting()},<br>la maison est avec vous.</h1><p>${a.subtitle ?? 'Vos équipements sont prêts, pièce par pièce.'}</p><span class="count">${mpIcon('bulb',16)} ${this.cards.length} éclairages disponibles</span></div><div class="quote">« ${a.quote ?? 'Les plus beaux moments commencent à la maison.'} »</div></section>`}<div class="badges">${this.badges}</div><main class="grid">${this.cards.map(card => html`<div>${card}</div>`)}</main></div>`;
  }
}
