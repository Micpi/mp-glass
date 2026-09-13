import { LitElement, html } from 'lit';
import type { CardConfig } from '../../shared/models';
import type { Hass } from '../ha/client';
import { glassStyles } from '../styles';
import { t } from '../i18n';
export class MPGlassCardEditor extends LitElement {
  static styles = glassStyles;
  static properties = { hass: { attribute: false }, config: { state: true } };
  hass?: Hass;
  private config?: CardConfig;
  setConfig(config: CardConfig) { this.config = config; }
  private change(entity: string) {
    this.config = { ...this.config!, entity };
    this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: this.config } }));
  }
  render() {
    const lang = this.hass?.language;
    const light = this.config?.type.includes('mp-glass-light');
    // Native selector is optional: do not import private HA bundles to obtain it.
    return customElements.get('ha-selector') ? html`<ha-selector .hass=${this.hass} .selector=${{entity: light ? {domain:'light'} : {}}} .value=${this.config?.entity} .label=${t(lang,'entity')} @value-changed=${(e: CustomEvent<{value:string}>) => this.change(e.detail.value)}></ha-selector>` : html`<label>${t(lang,'entity')}<select .value=${this.config?.entity ?? ''} @change=${(e:Event)=>this.change((e.target as HTMLSelectElement).value)}><option value=""></option>${Object.keys(this.hass?.states ?? {}).filter(id => !light || id.startsWith('light.')).sort().map(id => html`<option .value=${id}>${String(this.hass?.states[id]?.attributes.friendly_name ?? id)}</option>`)}</select></label>`;
  }
}
