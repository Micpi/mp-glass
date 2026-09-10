import { LitElement, html, css, nothing } from 'lit';
import type { MPHomeGraph, Override, Preset } from '../shared/models';
import { MPDiscoveryEngine } from '../shared/discovery';
import { HARegistryReader, readProject, saveProject, type Hass, type ProjectResponse } from './ha/client';
import { glassStyles } from './styles';
import { t } from './i18n';
export class MPGlassSettings extends LitElement {
  static styles = [glassStyles, css`:host{min-height:100%;background:radial-gradient(at 90% 0%,#243957,transparent 55%),#0c1423;padding:32px;box-sizing:border-box}main{max-width:1040px;margin:auto}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.stats strong{font-size:2rem}.device{padding:16px 0;border-bottom:1px solid var(--mp-glass-border)}.device label{min-width:180px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.overline{letter-spacing:.25em;color:var(--mp-accent);font-size:.75rem;margin-bottom:20px}.success{color:#addeb8}@media(max-width:600px){:host{padding:16px}.stats{grid-template-columns:1fr}.stats .surface{padding:16px}}`];
  static properties = { hass: { attribute: false }, response: { state: true }, graph: { state: true }, busy: { state: true }, failure: { state: true }, saved: { state: true } };
  hass?: Hass;
  private response?: ProjectResponse;
  private graph?: MPHomeGraph;
  private busy = false;
  private failure = false;
  private saved = false;
  private started = false;
  protected updated() { if (this.hass && !this.started) { this.started = true; void this.load(); } }
  private async load() {
    if (!this.hass || this.busy) return;
    this.busy = true; this.failure = false;
    try { this.response = await readProject(this.hass); await this.scanInternal(); }
    catch { this.failure = true; }
    finally { this.busy = false; }
  }
  private async scanInternal() { this.graph = MPDiscoveryEngine.discover(await HARegistryReader.read(this.hass!, true), this.response!.project); }
  private async scan() {
    if (!this.hass || !this.response || this.busy) return;
    this.busy = true; this.failure = false;
    try { await this.scanInternal(); } catch { this.failure = true; } finally { this.busy = false; }
  }
  private override(key: string, patch: Override) {
    if (!this.response) return;
    this.response = { ...this.response, project: { ...this.response.project, overrides: { ...this.response.project.overrides, [key]: { ...this.response.project.overrides[key], ...patch } } } };
    this.saved = false;
  }
  private async save() {
    if (!this.response || !this.hass || this.busy) return;
    this.busy = true; this.failure = false; this.saved = false;
    try { this.response = await saveProject(this.hass, this.response); this.saved = true; await this.scanInternal(); }
    catch { this.failure = true; } finally { this.busy = false; }
  }
  private exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.response?.project, null, 2)], { type:'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'mp-glass-project.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  render() {
    const lang = this.hass?.locale?.language ?? this.hass?.language;
    const project = this.response?.project;
    const devices = this.graph?.devices.filter(d => !d.disabled) ?? [];
    const review = devices.filter(d => d.confidence < .9 || !d.areaId);
    return html`<main aria-busy=${this.busy}><p class="overline">MP GLASS</p><h1>${t(lang,'setup')}</h1><p>${t(lang,'intro')}</p>
      ${this.failure ? html`<p role="alert" class="error">${t(lang,'failed')}</p><button @click=${this.load}>${t(lang,'reload')}</button>` : nothing}
      ${project ? html`<section class="surface"><label>${t(lang,'name')}<input maxlength="100" .value=${project.project.name} @input=${(e:Event)=>{ project.project.name = (e.target as HTMLInputElement).value; this.saved = false; }}></label>
      <label>${t(lang,'preset')}<select .value=${project.appearance.preset} @change=${(e:Event)=>{ project.appearance.preset = (e.target as HTMLSelectElement).value as Preset; this.setAttribute('preset', project.appearance.preset); this.saved = false; }}>${['glass-blue','glass-warm','glass-dark','glass-light','glass-oled','glass-neutral'].map(p=>html`<option value=${p}>${p.replace('glass-', 'Glass ')}</option>`)}</select></label></section>
      <div class="stats"><div class="surface"><strong>${devices.length}</strong><p>${t(lang,'devices')}</p></div><div class="surface"><strong>${devices.filter(d=>d.confidence>=.9).length}</strong><p>${t(lang,'auto')}</p></div><div class="surface"><strong>${review.length}</strong><p>${t(lang,'review')}</p></div></div>
      <nav><button ?disabled=${this.busy} @click=${this.scan}>${t(lang,'scan')}</button><button class="primary" ?disabled=${this.busy || !this.hass?.user?.is_admin} @click=${this.save}>${t(lang,'save')}</button><button @click=${this.exportProject}>${t(lang,'export')}</button></nav>
      ${this.saved ? html`<p role="status" class="success">${t(lang,'saved')}</p>` : nothing}
      <section class="surface"><h2>${t(lang,'review')}</h2>${review.map(d=>html`<div class="device"><strong>${d.name}</strong><p>${d.confidence >= .9 ? t(lang,'noArea') : t(lang,'unsupported')}</p><div class="row"><label>${t(lang,'area')}<select .value=${project.overrides[d.entityKey]?.areaId ?? d.areaId ?? ''} @change=${(e:Event)=>{ const areaId = (e.target as HTMLSelectElement).value; if(areaId) this.override(d.entityKey,{areaId}); }}><option value="">${t(lang,'noArea')}</option>${this.graph?.areas.map(a=>html`<option value=${a.area_id}>${a.name}</option>`)}</select></label><label><span>${t(lang,'hidden')}</span><input type="checkbox" .checked=${project.overrides[d.entityKey]?.hidden ?? d.hidden} @change=${(e:Event)=>this.override(d.entityKey,{hidden:(e.target as HTMLInputElement).checked})}></label></div><details><summary>${t(lang,'why')}</summary><pre>${JSON.stringify({id:d.id,evidence:d.evidence,capabilities:d.capabilities},null,2)}</pre></details></div>`)}</section>
      <nav><a href="/config/lovelace/dashboards">${t(lang,'generate')}</a></nav><p>${t(lang,'generateHelp')}</p>` : this.busy ? html`<p role="status">${t(lang,'pending')}</p>` : nothing}
    </main>`;
  }
}
