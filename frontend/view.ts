import { LitElement, html, css } from 'lit';
export class MPGlassView extends LitElement {
  static properties = { cards: { attribute: false }, badges: { attribute: false } };
  static styles = css`
    :host{display:block;flex:1 1 100%;width:100%;min-width:0;container-type:inline-size;padding:16px;box-sizing:border-box;max-width:1800px;margin:auto}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}.grid>div{min-width:0}.badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
    @container(max-width:600px){.grid{grid-template-columns:1fr}}
    @media(orientation:landscape) and (max-height:500px){:host{padding:8px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
  `;
  cards: HTMLElement[] = [];
  badges: HTMLElement[] = [];
  setConfig(_config: unknown) { /* HA owns the card lifecycle. */ }
  render() { return html`<div class="badges">${this.badges}</div><div class="grid">${this.cards.map(card => html`<div>${card}</div>`)}</div>`; }
}
