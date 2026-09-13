import { LitElement, html, css, nothing } from 'lit';
import type { AppearanceConfig, MPHomeGraph, Override, Preset } from '../shared/models';
import { MPDiscoveryEngine } from '../shared/discovery';
import { HARegistryReader, readProject, saveProject, type Hass, type ProjectResponse } from './ha/client';
import { glassStyles } from './styles';
import { t } from './i18n';
import { MP_GLASS_BACKGROUND } from './background';
import { mpIcon } from './icons';
import { defaultProject } from '../shared/project';
export class MPGlassSettings extends LitElement {
  static styles = [glassStyles, css`
    :host{min-height:100%;background:radial-gradient(at 90% 0%,#243957,transparent 55%),#091321;padding:28px;box-sizing:border-box}main{max-width:1380px;margin:auto}.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}.page-head h1{font:42px/1 Georgia,serif;font-weight:400}.overline{letter-spacing:.25em;color:var(--mp-accent);font-size:.75rem;margin-bottom:12px}.editor{display:grid;grid-template-columns:minmax(320px,.82fr) minmax(430px,1.18fr);gap:18px;align-items:start}.panel-title{display:flex;align-items:center;gap:10px;margin-bottom:14px}.panel-title svg{color:var(--mp-accent)}.preset-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0 18px}.preset-choice{min-height:54px!important;padding:8px 10px!important;display:flex;align-items:center;gap:9px;text-align:left}.preset-choice.selected{border-color:var(--mp-accent)!important;background:color-mix(in srgb,var(--mp-accent) 18%,rgba(8,28,48,.4))!important;box-shadow:0 0 20px color-mix(in srgb,var(--mp-accent) 16%,transparent)}.preset-dot{width:22px;height:22px;flex:0 0 auto;border-radius:8px;border:1px solid #fff5;box-shadow:inset 0 1px #fff5}.preset-choice span:last-child{font-size:11px}.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.controls label{margin:0}.wide{grid-column:1/-1}.control-caption{display:flex;align-items:center;gap:10px;margin:8px 0 1px;color:#dce9f5;font-weight:650;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.control-caption:after{content:'';height:1px;flex:1;background:linear-gradient(90deg,var(--mp-glass-border),transparent)}.switch{display:flex;align-items:center;justify-content:space-between;min-height:50px;padding:0 12px;border:1px solid var(--mp-glass-border);border-radius:12px}.switch input{margin:0}.range-head{display:flex;justify-content:space-between;color:var(--mp-text-secondary);font-size:13px}.preview{position:sticky;top:18px;min-height:480px;padding:18px;background-size:cover;background-position:center;color:white}.preview:before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(1,13,25,.7),rgba(2,17,30,.16)),rgba(2,12,23,var(--preview-dim,.44));pointer-events:none}.preview>*{position:relative}.preview-bar,.preview-card{background:linear-gradient(135deg,rgba(17,48,75,var(--preview-opacity,.62)),rgba(7,28,48,calc(var(--preview-opacity,.62) - .08)));border:1px solid color-mix(in srgb,var(--mp-accent) 28%,rgba(225,239,255,.35));box-shadow:0 16px 36px #0018,inset 0 1px #fff2;backdrop-filter:blur(var(--preview-blur,22px));border-radius:var(--preview-radius,22px)}.preview-bar{padding:14px 18px;display:flex;align-items:center;justify-content:space-between}.preview-brand{font:25px Georgia,serif}.preview-hero{padding:65px 18px 38px}.preview-hero small{letter-spacing:.22em;text-transform:uppercase}.preview-hero h2{font:42px/1 Georgia,serif;margin:13px 0}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview-card{padding:17px;min-height:116px}.preview-card svg{color:#ffd969;filter:drop-shadow(0 0 10px #ffc83f)}.preview-card strong{display:block;margin-top:10px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.stats strong{font-size:2rem}.device{padding:16px 0;border-bottom:1px solid var(--mp-glass-border)}.device label{min-width:180px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.success{color:#addeb8}.section{margin-top:18px}
    @media(max-width:900px){.editor{grid-template-columns:1fr}.preview{position:relative;top:0}}@media(max-width:600px){:host{padding:14px}.controls,.preview-grid,.stats{grid-template-columns:1fr}.wide{grid-column:auto}.surface{padding:16px}.page-head{display:block}.page-head nav{margin-bottom:0}}
  `];
  static properties = { hass: { attribute: false }, response: { state: true }, graph: { state: true }, busy: { state: true }, failure: { state: true }, saved: { state: true }, inventoryOpen: {state:true}, inventoryPage: {state:true}, query: {state:true} };
  hass?: Hass;
  private response?: ProjectResponse;
  private graph?: MPHomeGraph;
  private busy = false;
  private failure = false;
  private saved = false;
  private started = false;
  private inventoryOpen = false;
  private inventoryPage = 0;
  private query = '';
  protected updated() { if (this.hass && !this.started) { this.started = true; void this.load(); } }
  private async load() {
    if (!this.hass || this.busy) return;
    this.busy = true; this.failure = false;
    try {
      const response = await readProject(this.hass); const defaults = defaultProject(response.project.project.name);
      this.response = { ...response, project: { ...response.project, appearance: { ...defaults.appearance, ...response.project.appearance } } };
      await this.scanInternal();
    }
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
  private appearance<K extends keyof AppearanceConfig>(key: K, value: AppearanceConfig[K]) {
    if (!this.response) return;
    this.response = { ...this.response, project: { ...this.response.project, appearance: { ...this.response.project.appearance, [key]: value } } };
    this.setAttribute('preset', this.response.project.appearance.preset); this.saved = false;
  }
  private projectName(value: string) {
    if (!this.response) return;
    this.response = { ...this.response, project: { ...this.response.project, project: { ...this.response.project.project, name: value } } };
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
    const review = devices.filter(d => d.category !== 'generic' && !d.hidden && (d.confidence < .9 || !d.areaId || !this.graph?.areas.some(a => a.area_id === d.areaId)));
    const inventory = devices.filter(d => d.category === 'generic' && `${d.name} ${d.entityId}`.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()));
    const page = Math.min(this.inventoryPage, Math.max(0, Math.ceil(inventory.length / 25) - 1));
    const a = project?.appearance;
    const previewStyle = a ? `--mp-accent:${a.accent ?? '#69b7ff'};--preview-opacity:${a.glassOpacity ?? .62};--preview-blur:${a.glassBlur ?? 22}px;--preview-radius:${a.radius ?? 22}px;--preview-dim:${a.backgroundDim ?? .44};background-image:url(${a.backgroundUrl || MP_GLASS_BACKGROUND});background-position:${a.backgroundPosition ?? 'right'} center` : '';
    return html`<main aria-busy=${this.busy}><div class="page-head"><div><p class="overline">MP GLASS · INTEGRATOR STUDIO</p><h1>${t(lang,'setup')}</h1><p>${t(lang,'intro')}</p></div>${project ? html`<nav><button ?disabled=${this.busy} @click=${this.scan}>${mpIcon('scan',18)} ${t(lang,'scan')}</button><button class="primary" ?disabled=${this.busy || !this.hass?.user?.is_admin} @click=${this.save}>${mpIcon('check',18)} ${t(lang,'save')}</button></nav>` : nothing}</div>
      ${this.failure ? html`<p role="alert" class="error">${t(lang,'failed')}</p><button @click=${this.load}>${t(lang,'reload')}</button>` : nothing}
      ${project ? html`<div class="editor"><section class="surface"><div class="panel-title">${mpIcon('palette',24)}<h2>Identité et apparence</h2></div><div class="preset-strip">${([
        ['glass-blue','Glass Blue','#68b8ff'],['glass-warm','Glass Warm','#eab98d'],['glass-dark','Glass Dark','#8da1b7'],['glass-light','Glass Light','#e8f0fa'],['glass-oled','Glass OLED','#07090d'],['glass-neutral','Glass Neutral','#80868e'],
      ] as [Preset,string,string][]).map(([value,label,color])=>html`<button class=${`preset-choice ${a!.preset===value?'selected':''}`} @click=${()=>this.appearance('preset',value)}><span class="preset-dot" style=${`background:${color}`}></span><span>${label}</span></button>`)}</div><div class="controls">
        <label class="wide">${t(lang,'name')}<input maxlength="100" .value=${project.project.name} @input=${(e:Event)=>this.projectName((e.target as HTMLInputElement).value)}></label>
        <div class="control-caption wide">Matière et profondeur</div>
        <label>Couleur d’accent<input type="color" .value=${a!.accent ?? '#69b7ff'} @input=${(e:Event)=>this.appearance('accent',(e.target as HTMLInputElement).value)}></label>
        <label class="wide"><span class="range-head"><span>Transparence du verre</span><strong>${Math.round((a!.glassOpacity ?? .62)*100)} %</strong></span><input type="range" min="25" max="90" .value=${String((a!.glassOpacity ?? .62)*100)} @input=${(e:Event)=>this.appearance('glassOpacity',Number((e.target as HTMLInputElement).value)/100)}></label>
        <label><span class="range-head"><span>Flou</span><strong>${a!.glassBlur ?? 22}px</strong></span><input type="range" min="0" max="40" .value=${String(a!.glassBlur ?? 22)} @input=${(e:Event)=>this.appearance('glassBlur',Number((e.target as HTMLInputElement).value))}></label>
        <label><span class="range-head"><span>Arrondis</span><strong>${a!.radius ?? 22}px</strong></span><input type="range" min="10" max="38" .value=${String(a!.radius ?? 22)} @input=${(e:Event)=>this.appearance('radius',Number((e.target as HTMLInputElement).value))}></label>
        <div class="control-caption wide">Arrière-plan</div><label class="wide"><span class="range-head"><span>Assombrissement du fond</span><strong>${Math.round((a!.backgroundDim ?? .44)*100)} %</strong></span><input type="range" min="0" max="80" .value=${String((a!.backgroundDim ?? .44)*100)} @input=${(e:Event)=>this.appearance('backgroundDim',Number((e.target as HTMLInputElement).value)/100)}></label>
        <label>Position du fond<select .value=${a!.backgroundPosition ?? 'right'} @change=${(e:Event)=>this.appearance('backgroundPosition',(e.target as HTMLSelectElement).value as AppearanceConfig['backgroundPosition'])}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
        <label>Densité<select .value=${a!.density ?? 'comfortable'} @change=${(e:Event)=>this.appearance('density',(e.target as HTMLSelectElement).value as AppearanceConfig['density'])}><option value="comfortable">Confortable</option><option value="compact">Compacte</option></select></label>
        <label class="wide">Image personnalisée Home Assistant<input placeholder="/local/mon-fond.webp" .value=${a!.backgroundUrl ?? ''} @input=${(e:Event)=>this.appearance('backgroundUrl',(e.target as HTMLInputElement).value || undefined)}></label>
        <div class="control-caption wide">Contenu de l’accueil</div><label class="wide">Accroche<input maxlength="100" .value=${a!.eyebrow ?? ''} @input=${(e:Event)=>this.appearance('eyebrow',(e.target as HTMLInputElement).value)}></label>
        <label class="wide">Sous-titre<input maxlength="160" .value=${a!.subtitle ?? ''} @input=${(e:Event)=>this.appearance('subtitle',(e.target as HTMLInputElement).value)}></label>
        <label class="wide">Citation<input maxlength="180" .value=${a!.quote ?? ''} @input=${(e:Event)=>this.appearance('quote',(e.target as HTMLInputElement).value)}></label>
        <label class="switch"><span>Afficher l’accueil</span><input type="checkbox" .checked=${a!.showHero !== false} @change=${(e:Event)=>this.appearance('showHero',(e.target as HTMLInputElement).checked)}></label>
        <label class="switch"><span>Effets animés</span><input type="checkbox" .checked=${a!.motion !== false} @change=${(e:Event)=>this.appearance('motion',(e.target as HTMLInputElement).checked)}></label>
      </div></section><section class="preview" style=${previewStyle}><div class="preview-bar"><span class="preview-brand">≈ ${project.project.name}</span><span>${mpIcon('home',18)} Accueil</span></div>${a!.showHero === false ? '' : html`<div class="preview-hero"><small>${a!.eyebrow}</small><h2>Bonsoir,<br>la maison est avec vous.</h2><span>${a!.subtitle}</span></div>`}<div class="preview-grid"><div class="preview-card">${mpIcon('bulb',26)}<strong>Lumières</strong><small>Prêtes à contrôler</small></div><div class="preview-card">${mpIcon('rooms',26)}<strong>Pièces</strong><small>Organisation automatique</small></div></div></section></div>
      <div class="stats"><div class="surface"><strong>${devices.length}</strong><p>${t(lang,'entities')}</p></div><div class="surface"><strong>${devices.filter(d=>d.category==='light').length}</strong><p>${t(lang,'lightsDetected')}</p></div><div class="surface"><strong>${review.length}</strong><p>${t(lang,'review')}</p></div></div>
      <nav><button @click=${this.exportProject}>${t(lang,'export')}</button></nav>
      ${this.saved ? html`<p role="status" class="success">${t(lang,'saved')}</p>` : nothing}
      <section class="surface section"><div class="panel-title">${mpIcon('tune',24)}<h2>${t(lang,'review')}</h2></div>${review.map(d=>html`<div class="device"><strong>${d.name}</strong><p>${d.confidence >= .9 ? t(lang,'noArea') : t(lang,'unsupported')}</p><div class="row"><label>${t(lang,'area')}<select .value=${project.overrides[d.entityKey]?.areaId ?? d.areaId ?? ''} @change=${(e:Event)=>{ const areaId = (e.target as HTMLSelectElement).value; if(areaId) this.override(d.entityKey,{areaId}); }}><option value="">${t(lang,'noArea')}</option>${this.graph?.areas.map(a=>html`<option value=${a.area_id}>${a.name}</option>`)}</select></label><label><span>${t(lang,'hidden')}</span><input type="checkbox" .checked=${project.overrides[d.entityKey]?.hidden ?? d.hidden} @change=${(e:Event)=>this.override(d.entityKey,{hidden:(e.target as HTMLInputElement).checked})}></label></div><details><summary>${t(lang,'why')}</summary><pre>${JSON.stringify({id:d.id,evidence:d.evidence,capabilities:d.capabilities},null,2)}</pre></details></div>`)}</section>
      ${!review.length ? html`<p>${t(lang,'noReview')}</p>` : nothing}
      <nav><a href="/config/lovelace/dashboards">${t(lang,'generate')}</a></nav><p>${t(lang,'generateHelp')}</p>
      <details @toggle=${(event:Event)=>{this.inventoryOpen=(event.target as HTMLDetailsElement).open;}}><summary>${t(lang,'inventory')} · ${devices.filter(d=>d.category==='generic').length}</summary>
      ${this.inventoryOpen ? html`<p>${t(lang,'inventoryHelp')}</p><label>${t(lang,'search')}<input type="search" .value=${this.query} @input=${(event:Event)=>{this.query=(event.target as HTMLInputElement).value;this.inventoryPage=0;}}></label>
      ${inventory.slice(page*25,page*25+25).map(d=>html`<div class="device"><strong>${d.name}</strong><p>${d.entityId}</p><button @click=${()=>this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:d.entityId},bubbles:true,composed:true}))}>${t(lang,'details')}</button></div>`)}
      <nav><button ?disabled=${page===0} @click=${()=>{this.inventoryPage=page-1;}}>${t(lang,'previous')}</button><span>${page+1} / ${Math.max(1,Math.ceil(inventory.length/25))}</span><button ?disabled=${(page+1)*25>=inventory.length} @click=${()=>{this.inventoryPage=page+1;}}>${t(lang,'next')}</button></nav>` : nothing}</details>` : this.busy ? html`<p role="status">${t(lang,'pending')}</p>` : nothing}
    </main>`;
  }
}
