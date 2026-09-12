import { LitElement, html, css } from 'lit';
import { MP_GLASS_BACKGROUND } from './background';
export class MPGlassView extends LitElement {
  static properties = { cards: { attribute: false }, badges: { attribute: false } };
  static styles = css`
    :host{display:block;flex:1 1 100%;width:100%;min-width:0;min-height:100vh;container-type:inline-size;box-sizing:border-box;color:#f8fbff;font-family:Inter,ui-sans-serif,system-ui,sans-serif;position:relative;isolation:isolate;overflow:hidden;background:#071728}
    .backdrop{position:fixed;inset:0;z-index:-3;background-position:64% center;background-size:cover;background-repeat:no-repeat}
    :host:after{content:"";position:fixed;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(3,15,28,.72),rgba(4,20,35,.3) 50%,rgba(2,11,21,.35)),linear-gradient(0deg,rgba(2,12,23,.88),transparent 64%)}
    *{box-sizing:border-box}.shell{max-width:1500px;margin:auto;padding:18px clamp(16px,3vw,44px) 56px}.glass{background:linear-gradient(135deg,rgba(17,48,75,.68),rgba(7,28,48,.54));border:1px solid rgba(201,226,255,.32);box-shadow:0 18px 46px rgba(0,8,18,.32),inset 0 1px rgba(255,255,255,.1);backdrop-filter:blur(22px) saturate(135%)}
    header{min-height:82px;border-radius:24px;padding:13px 22px;display:grid;grid-template-columns:minmax(220px,1fr) auto minmax(180px,1fr);align-items:center;gap:20px}.brand{display:flex;gap:15px;align-items:center}.waves{font:42px/1 Georgia,serif;color:#f5d7b2;transform:rotate(-5deg)}.brand strong{display:block;font:clamp(22px,2.4vw,35px)/1.05 Georgia,serif;font-weight:400}.brand small{display:block;margin-top:7px;letter-spacing:.26em;text-transform:uppercase;color:#b9cce0;font-size:10px}
    nav{display:flex;gap:5px;padding:5px;border:1px solid rgba(194,222,252,.18);border-radius:20px;background:rgba(6,25,44,.3)}nav span{min-height:48px;padding:0 20px;border-radius:15px;display:flex;align-items:center;gap:9px;color:#dbe8f6}nav .active{background:linear-gradient(135deg,rgba(54,144,241,.76),rgba(32,92,158,.56));border:1px solid #73baff;box-shadow:0 0 24px rgba(57,151,255,.34)}.clock{text-align:right}.clock strong{font:30px/1 Georgia,serif;font-weight:400}.clock small{display:block;color:#c2d1e1;margin-top:6px}
    .hero{min-height:310px;display:flex;align-items:center;justify-content:space-between;padding:clamp(42px,8vw,96px) 22px 28px;gap:38px}.eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin-bottom:20px}.hero h1{font:clamp(45px,6vw,80px)/.98 Georgia,serif;font-weight:400;margin:0;text-shadow:0 3px 18px #001}.hero p{font-size:clamp(17px,1.7vw,24px);color:#d5e1ed;margin:16px 0 0}.quote{max-width:310px;border-left:1px solid rgba(255,255,255,.5);padding:14px 0 14px 38px;font:italic clamp(18px,2vw,27px)/1.35 Georgia,serif;color:#f4eee8}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.grid>div{min-width:0}.grid>div:nth-child(1),.grid>div:nth-child(4){grid-column:span 1}
    @container(max-width:850px){header{grid-template-columns:1fr auto}nav{grid-row:2;grid-column:1/-1;justify-self:stretch;overflow:auto}nav span{flex:1;justify-content:center}.hero{min-height:270px}.quote{display:none}}
    @container(max-width:600px){.shell{padding:10px 10px 40px}header{border-radius:18px;padding:12px 14px}.brand strong{font-size:24px}.brand small{display:none}.waves{font-size:32px}.clock strong{font-size:24px}nav span{padding:0 13px;font-size:14px}.hero{min-height:250px;padding:46px 12px 24px}.hero h1{font-size:46px}.grid{grid-template-columns:1fr;gap:10px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  `;
  cards: HTMLElement[] = [];
  badges: HTMLElement[] = [];
  private projectName = 'Maison';
  setConfig(config: { mp_project_name?: string; title?: string }) { this.projectName = config?.mp_project_name ?? config?.title ?? 'Maison'; }
  private greeting() { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; }
  render() {
    const now = new Date();
    return html`<div class="backdrop" style=${`background-image:url(${MP_GLASS_BACKGROUND})`}></div><div class="shell"><header class="glass"><div class="brand"><span class="waves">≈</span><div><strong>${this.projectName}</strong><small>Home Assistant · MP Glass</small></div></div><nav aria-label="Navigation"><span class="active">⌂ Accueil</span><span>◉ Lumières</span><span>⌘ Pièces</span></nav><div class="clock"><strong>${new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now)}</strong><small>${new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(now)}</small></div></header><section class="hero"><div><div class="eyebrow">Une maison plus simple à vivre</div><h1>${this.greeting()},<br>la maison est avec vous.</h1><p>Vos éclairages sont prêts, pièce par pièce.</p></div><div class="quote">« Les plus beaux moments commencent à la maison. »</div></section><div class="badges">${this.badges}</div><main class="grid">${this.cards.map(card => html`<div>${card}</div>`)}</main></div>`;
  }
}
