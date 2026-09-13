import { LitElement, html, nothing } from 'lit';
import { available, brightnessPercent, MPCapabilityEngine } from '../../shared/capabilities';
import type { CardConfig } from '../../shared/models';
import type { Hass } from '../ha/client';
import { t } from '../i18n';
import { glassStyles } from '../styles';
import { mpIcon } from '../icons';
export class MPGlassLight extends LitElement {
  static styles = glassStyles;
  static properties = { config: { state: true }, busy: { state: true }, failure: { state: true } };
  protected config?: CardConfig;
  protected currentHass?: Hass;
  protected busy = false;
  protected failure = false;
  set hass(value: Hass) {
    const old = this.currentHass; this.currentHass = value;
    if (!old || old.states[this.config?.entity ?? ''] !== value.states[this.config?.entity ?? ''] || old.language !== value.language || old.locale?.language !== value.locale?.language) this.requestUpdate();
  }
  get hass() { return this.currentHass!; }
  setConfig(config: CardConfig) {
    if (typeof config.entity !== 'string' || !config.entity.includes('.')) throw new Error('invalid_entity');
    this.config = { ...config }; this.setAttribute('preset', config.preset ?? 'glass-blue');
    const a = config.appearance;
    this.style.setProperty('--mp-accent', a?.accent ?? '#72b9ff');
    this.style.setProperty('--mp-opacity', String(a?.glassOpacity ?? .62));
    this.style.setProperty('--mp-blur', `${a?.glassBlur ?? 22}px`);
    this.style.setProperty('--mp-glass-radius', `${a?.radius ?? 22}px`);
    this.toggleAttribute('motion', a?.motion !== false);
  }
  static getConfigElement() { return document.createElement('mp-glass-card-editor'); }
  static getStubConfig(hass: Hass) { return { entity: Object.keys(hass.states).find(id => id.startsWith('light.')) }; }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 6, min_columns: 6 }; }
  protected moreInfo() { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this.config?.entity }, bubbles: true, composed: true })); }
  protected async act(service: string, data: Record<string, unknown> = {}) {
    const id = this.config?.entity;
    if (!id || !id.startsWith('light.') || this.busy || !available(this.hass?.states[id])) return;
    if ('brightness_pct' in data && !MPCapabilityEngine.detect(id, this.hass.states[id]).some(b => b.capability === 'DIM')) return;
    this.busy = true; this.failure = false;
    try { await this.hass.callService('light', service, { ...data, entity_id: id }); }
    catch { this.failure = true; }
    finally { this.busy = false; }
  }
  protected render() {
    if (!this.config || !this.currentHass) return nothing;
    const lang = this.hass.locale?.language ?? this.hass.language;
    const state = this.hass.states[this.config.entity];
    const enabled = available(state);
    const isOn = state?.state === 'on';
    const capabilities = MPCapabilityEngine.detect(this.config.entity, state);
    const light = !this.config.type.includes('mp-glass-generic') && capabilities.some(b => b.capability === 'POWER');
    const percent = brightnessPercent(state?.attributes.brightness);
    const name = this.config.name ?? state?.attributes.friendly_name ?? this.config.entity;
    return html`<article aria-busy=${this.busy}>
      <div class="row"><span class=${`device-icon ${isOn && light ? 'on' : ''}`}>${mpIcon(light ? 'bulb' : 'tune',28)}</span><h2>${String(name)}</h2><span class=${`status ${isOn && light ? 'active' : ''}`}>${!enabled ? t(lang,'unavailable') : light ? t(lang,isOn ? 'on' : 'off') : state?.state}</span></div>
      <div class="row">${light ? html`<button class="primary" ?disabled=${!enabled || this.busy} @click=${() => this.act(isOn ? 'turn_off' : 'turn_on')}>${t(lang,isOn ? 'turnOff' : 'turnOn')}</button>` : nothing}
      <button @click=${this.moreInfo}>${t(lang,'details')}</button></div>
      ${light && capabilities.some(b => b.capability === 'DIM') ? html`<label>${t(lang,'brightness')} ${percent === undefined ? '' : new Intl.NumberFormat(lang).format(percent) + ' %'}<input aria-label=${t(lang,'brightness')} type="range" min="0" max="100" .value=${String(percent ?? 0)} ?disabled=${!enabled || this.busy} @change=${(event: Event) => this.act('turn_on', { brightness_pct: Number((event.target as HTMLInputElement).value) })}></label>` : nothing}
      ${this.failure ? html`<p class="error" role="alert">${t(lang,'error')}</p>` : nothing}
      ${this.config.debug ? html`<details><summary>${t(lang,'why')}</summary><pre>${JSON.stringify({ entity: this.config.entity, evidence: light ? 'domain:light' : 'fallback', capabilities, presentation: this.config.type }, null, 2)}</pre></details>` : nothing}
    </article>`;
  }
}
export class MPGlassGeneric extends MPGlassLight {}
