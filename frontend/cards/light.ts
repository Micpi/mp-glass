import { LitElement, html, nothing } from 'lit';
import { available, brightnessPercent, MPCapabilityEngine } from '../../shared/capabilities';
import type { CardConfig } from '../../shared/models';
import type { Hass } from '../ha/client';
import { LanguageController, locale, tr } from '../i18n';
import { glassStyles } from '../styles';
import { mpIcon } from '../icons';
export class MPGlassLight extends LitElement {
  static styles = glassStyles;
  static properties = { config: { state: true }, busy: { state: true }, failure: { state: true } };
  protected config?: CardConfig;
  protected currentHass?: Hass;
  protected busy = false;
  protected failure = false;
  private language = new LanguageController(this);
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
    this.style.setProperty('--mp-secondary', a?.secondaryAccent ?? '#efbd8b');
    this.style.setProperty('--mp-tint', a?.glassTint ?? '#12344f');
    this.style.setProperty('--mp-opacity', String(a?.glassOpacity ?? .62));
    this.style.setProperty('--mp-blur', `${a?.glassBlur ?? 22}px`);
    this.style.setProperty('--mp-glass-radius', `${a?.radius ?? 22}px`);
    this.style.setProperty('--mp-border-strength', String(a?.borderStrength ?? .2));
    this.style.setProperty('--mp-shadow-strength', String(a?.shadowStrength ?? .35));
    this.toggleAttribute('motion', a?.motion !== false);
    this.setAttribute('card-style', a?.cardStyle ?? 'standard');
    this.setAttribute('icon-style', a?.iconStyle ?? 'tile');
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
    const state = this.hass.states[this.config.entity];
    const enabled = available(state);
    const isOn = state?.state === 'on';
    const capabilities = MPCapabilityEngine.detect(this.config.entity, state);
    const light = !this.config.type.includes('mp-glass-generic') && capabilities.some(b => b.capability === 'POWER');
    const percent = brightnessPercent(state?.attributes.brightness);
    const name = this.config.name ?? state?.attributes.friendly_name ?? this.config.entity;
    const dimmable = light && capabilities.some(b => b.capability === 'DIM');
    const showDetails = this.config.appearance?.showCardDetails !== false;
    const showBrightness = this.config.appearance?.showBrightness !== false;
    const stateLabel = !enabled ? tr('Indisponible') : light ? (isOn ? tr('Allumée') : tr('Éteinte')) : String(state?.state ?? '—');
    return html`<article class="device-card" data-on=${String(isOn && light)} data-available=${String(enabled)} aria-busy=${this.busy}>
      <div class="card-head">
        <span class=${`device-icon ${isOn && light ? 'on' : ''}`}>${mpIcon(light ? 'bulb' : 'tune',23)}</span>
        <div class="identity"><h2>${String(name)}</h2><p>${light ? (dimmable ? tr('Éclairage variable') : tr('Éclairage')) : tr('Équipement')}</p></div>
        ${showDetails ? html`<button class="icon-button" title=${tr('Détails')} aria-label=${tr('Détails')} @click=${this.moreInfo}>${mpIcon('arrow',18)}</button>` : nothing}
      </div>
      <div class="control-row">
        <div class="state-copy"><strong>${stateLabel}</strong><small>${dimmable && enabled ? tr('{n} %',{n:percent ?? 0}) : enabled ? tr('Prêt') : tr('Hors ligne')}</small></div>
        ${light ? html`<button class=${`power-button ${isOn ? 'on' : ''}`} ?disabled=${!enabled || this.busy} @click=${() => this.act(isOn ? 'turn_off' : 'turn_on')}>${mpIcon('power',17)} ${isOn ? tr('Éteindre') : tr('Allumer')}</button>` : nothing}
      </div>
      ${dimmable && showBrightness ? html`<label class="dimmer"><span>${tr('Luminosité')} ${percent === undefined ? '—' : tr('{n} %',{n:new Intl.NumberFormat(locale()).format(percent)})}</span><input aria-label=${tr('Luminosité')} type="range" min="0" max="100" .value=${String(percent ?? 0)} ?disabled=${!enabled || this.busy} @change=${(event: Event) => this.act('turn_on', { brightness_pct: Number((event.target as HTMLInputElement).value) })}></label>` : html`<div class="no-dimmer" aria-hidden="true"></div>`}
      ${this.failure ? html`<p class="error" role="alert">${tr('Action impossible. Vérifiez la connexion et vos droits.')}</p>` : nothing}
      ${this.config.debug ? html`<details><summary>${tr('Pourquoi cette carte ?')}</summary><pre>${JSON.stringify({ entity: this.config.entity, evidence: light ? 'domain:light' : 'fallback', capabilities, presentation: this.config.type }, null, 2)}</pre></details>` : nothing}
    </article>`;
  }
}
export class MPGlassGeneric extends MPGlassLight {}
