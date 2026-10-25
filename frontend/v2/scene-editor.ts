import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Hass } from '../ha/client';
import { entityIcon, HVAC, stateLabel, stateName } from '../entities';
import { mpIcon } from '../icons';
import { LanguageController, locale, tr } from '../i18n';
import type { MessageKey } from '../locales';
import { captureScene, deleteScene, listScenes, newScene, newSceneId, previewScene, saveScene, sceneIcon, sceneReady, sceneValue, SCENE_ICONS, targetAttribute, type NexusScene, type SceneList, type SceneTarget, type SceneValue } from './scenes';

type Confirm = { kind: 'leave'|'delete'|'preview'; scene?: NexusScene; close?: boolean };
export class MPSceneEditor extends LitElement {
  static properties = { hass: { attribute: false }, data: { state: true }, draft: { state: true }, step: { state: true }, busy: { state: true }, note: { state: true }, query: { state: true }, area: { state: true }, confirm: { state: true }, selected: { state: true }, baseline: { state: true } };
  static styles = css`
    :host{font:14px/1.45 var(--mp-body-font,Inter,system-ui,sans-serif);color:#f7fbff}*{box-sizing:border-box}
    dialog{width:min(960px,calc(100vw - 28px));max-width:none;max-height:92dvh;margin:auto;padding:0;overflow:hidden;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:var(--mp-radius,22px);background:var(--mp-panel-background,#10293e);color:inherit;box-shadow:0 28px 90px rgba(0,8,18,var(--mp-shadow,.35));backdrop-filter:blur(var(--mp-blur,22px));font:inherit}
    dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:#020810ba;backdrop-filter:blur(8px)}
    header,footer{display:flex;align-items:center;gap:12px;padding:18px 22px;flex-shrink:0}header{border-bottom:1px solid var(--mp-control-border,#d5eaff33)}header>div{flex:1;min-width:0}h1{font:30px/1.15 var(--mp-display-font,Georgia,serif);margin:0}h2{font-size:17px;margin:0 0 12px}h3{margin:0;font-size:15px}p{margin:6px 0 0}small,.muted{color:#b4c6d6}small{display:block;font-size:12px}.body{padding:18px 22px;overflow:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}footer{border-top:1px solid var(--mp-control-border,#d5eaff33);flex-wrap:wrap}footer .spacer{flex:1}.close{margin-left:auto}
    button,input,select{font:inherit}button{cursor:pointer;color:inherit}button:disabled{cursor:default;opacity:.45}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--mp-accent,#69b7ff);outline-offset:3px}
    .btn,.icon{border:1px solid var(--mp-control-border,#d5eaff33);border-radius:calc(var(--mp-radius,22px)*14/22);background:var(--mp-control-background,#12344f77);min-height:44px;padding:9px 14px;display:inline-flex;justify-content:center;align-items:center;gap:8px;flex-shrink:0}.btn:hover:not(:disabled),.icon:hover:not(:disabled){background:var(--mp-control-hover,#ffffff15)}.primary{background:var(--mp-accent,#69b7ff);color:var(--mp-on-accent,#061421);font-weight:700}.primary:hover:not(:disabled){background:var(--mp-accent,#69b7ff);filter:brightness(1.06)}.icon{width:44px;padding:0}.danger{color:#ffb4b4}.acts{display:flex;gap:8px;flex-wrap:wrap}
    .note{padding:12px 14px;margin-bottom:14px;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:12px;color:#c6d7e6;font-size:13px;overflow-wrap:anywhere}.note.error{border-color:#ffb4b477;color:#ffb4b4}.note.success{border-color:#82d8ad66;color:#b5edcf}.empty{padding:26px 10px;text-align:center}.empty .mp-icon{color:var(--mp-accent)}
    .toolbar{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:16px}.toolbar input{flex:1;min-width:0}.list{display:grid;gap:10px}.scene{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;border-radius:var(--mp-radius,22px);border:1px solid var(--mp-control-border,#d5eaff33);background:var(--mp-control-background,#12344f77)}.scene>div{min-width:0}.scene h3{overflow-wrap:anywhere}.scene .acts{justify-content:flex-end}.badge{width:48px;height:48px;display:grid;place-items:center;border-radius:calc(var(--mp-radius,22px)*16/22);background:color-mix(in srgb,var(--mp-accent,#69b7ff) 15%,transparent);color:var(--mp-accent,#69b7ff)}.section{margin:24px 0 12px;font-size:11px;color:var(--mp-accent);letter-spacing:.12em;text-transform:uppercase}
    .steps{display:flex;gap:8px;margin-bottom:22px}.steps button{flex:1;display:flex;justify-content:center;align-items:center;gap:8px;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:14px;padding:10px 8px;min-height:46px;background:transparent;color:#b4c6d6}.steps button[aria-current=step]{background:color-mix(in srgb,var(--mp-accent,#69b7ff) 18%,transparent);border-color:var(--mp-accent);color:#fff}.steps i{font-style:normal;font-weight:700;color:var(--mp-accent)}
    .identity{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:24px}.identity>div{min-width:0}label{display:grid;gap:7px;margin-bottom:16px;font-size:13px}input:not([type=checkbox]):not([type=range]),select{width:100%;min-width:0;min-height:44px;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:12px;background:var(--mp-control-background,#12344f77);padding:8px 11px;color:inherit}select option{background:#10293e;color:#fff}input[type=color]{padding:4px!important}input[type=checkbox]{width:21px;height:21px;accent-color:var(--mp-accent);flex-shrink:0}input[type=range]{width:100%;accent-color:var(--mp-accent)}
    .icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.icons button{min-height:76px;display:flex;flex-direction:column;gap:7px;align-items:center;justify-content:center;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:14px;background:var(--mp-control-background,#12344f77)}.icons small{font-size:10px}.icons [aria-pressed=true]{border-color:var(--mp-accent);background:color-mix(in srgb,var(--mp-accent,#69b7ff) 22%,transparent);color:var(--mp-accent)}.preview{position:sticky;top:0;align-self:start;padding:20px;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:var(--mp-radius,22px)}.preview .btn{width:100%;margin:16px 0 8px;white-space:normal;overflow-wrap:anywhere;pointer-events:none}
    .filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,.5fr);gap:12px}.checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pick{display:flex;align-items:center;gap:12px;margin:0;padding:12px;border:1px solid var(--mp-control-border,#d5eaff33);border-radius:14px;cursor:pointer}.pick:has(:checked){border-color:var(--mp-accent);background:color-mix(in srgb,var(--mp-accent,#69b7ff) 10%,transparent)}.pick>span{min-width:0;overflow-wrap:anywhere}.pick strong{display:block}.count{margin:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.count .btn{min-height:36px;padding:5px 10px;font-size:12px}
    .targets{display:grid;gap:14px}.target{border:1px solid var(--mp-control-border,#d5eaff33);border-radius:var(--mp-radius,22px);padding:16px;background:var(--mp-control-background,#12344f77)}.target-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}.target-head>div{flex:1;min-width:0}.target-head strong{overflow-wrap:anywhere}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px}.fields label{margin-bottom:12px}.checkfield{display:flex;align-items:center;gap:10px;min-height:44px}.target .icon{width:36px;min-height:36px}.wide{grid-column:1/-1}.summary{display:flex;align-items:center;gap:12px;margin-bottom:16px}.summary strong{font-size:19px;overflow-wrap:anywhere}.summary small{margin-top:4px}.transition{max-width:300px;margin-top:20px}
    .confirm{position:absolute;inset:0;background:#020810e8;display:grid;place-items:center;z-index:5;padding:20px}.confirm>div{max-width:460px;padding:24px;border-radius:var(--mp-radius,22px);border:1px solid var(--mp-control-border,#d5eaff33);background:var(--mp-panel-background,#10293e)}.confirm .acts{margin-top:24px}.confirm p{color:#c6d7e6}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    @media(max-width:600px){dialog{width:100vw;height:100dvh;max-height:100dvh;border-radius:0;border:0}header{padding:max(16px,env(safe-area-inset-top)) 16px 14px}h1{font-size:26px}.body{padding:16px;flex:1}footer{padding:12px 16px max(12px,env(safe-area-inset-bottom));gap:8px}.identity{grid-template-columns:1fr}.preview{position:static;grid-row:1}.preview .btn{width:auto;min-width:150px;margin:10px 0}.preview{padding:12px 16px}.preview p{display:none}.checks{grid-template-columns:1fr}.scene{grid-template-columns:auto minmax(0,1fr)}.scene .acts{grid-column:1/-1;justify-content:flex-start}.steps button{font-size:12px;gap:5px}.filters{grid-template-columns:1fr}.fields{gap:0 10px}.target-head{flex-wrap:wrap}.target-head>div{min-width:100px}.toolbar{flex-wrap:wrap}.confirm>div{padding:20px}}
  `;
  hass!: Hass;
  private language = new LanguageController(this);
  private data?: SceneList;
  private draft?: SceneValue;
  private existing?: NexusScene;
  private original = '';
  private step = 0;
  private busy = false;
  private note?: { error?: boolean; conflict?: boolean; text: string };
  private draftId = '';
  private sourceTested = false;
  private colourModes = new Map<string, string>();
  private query = '';
  private area = '';
  private selected: string[] = [];
  private confirm?: Confirm;
  private baseline?: SceneValue;
  private dialog?: HTMLDialogElement;
  private request = 0;
  private beforeUnload = (e: BeforeUnloadEvent) => { if (this.dirty || this.baseline) { e.preventDefault(); e.returnValue = ''; } };

  connectedCallback() { super.connectedCallback(); addEventListener('beforeunload', this.beforeUnload); }
  disconnectedCallback() { this.request++; removeEventListener('beforeunload', this.beforeUnload); super.disconnectedCallback(); }
  protected firstUpdated() { this.dialog = this.renderRoot.querySelector('dialog')!; this.dialog.showModal(); void this.load(); }
  protected updated(changed: PropertyValues) { if (changed.has('confirm') && this.confirm) (this.renderRoot.querySelector('.confirm button') as HTMLButtonElement | null)?.focus(); }
  private get dirty() { return !!this.draft && (JSON.stringify(sceneValue(this.draft)) !== this.original || JSON.stringify([...this.selected].sort()) !== JSON.stringify(this.draft.entities.map(e => e.entity_id).sort())); }
  private name(id: string) { return String(this.hass.states[id]?.attributes.friendly_name ?? id.split('.').at(-1)?.replaceAll('_', ' ') ?? tr('Équipement')); }
  private room(id: string) { return this.data?.areas?.[id] ?? tr('Autres équipements'); }
  private set(change: Partial<SceneValue>) { this.draft = { ...this.draft!, ...change }; this.note = undefined; }
  private error(error: unknown) {
    const code = (error as { code?: string; message?: string })?.code ?? (error as Error)?.message;
    const key: MessageKey = code === 'conflict' ? 'Cette scène a changé sur un autre écran. Votre brouillon est conservé. Rechargez la version enregistrée avant de réessayer.'
      : code === 'forbidden' || code === 'unauthorized' ? 'Votre compte ne peut pas modifier ou commander ces équipements.'
      : code === 'unavailable' ? 'Un équipement ne répond plus. Retirez-le de la scène ou attendez son retour.'
      : code === 'unsupported_setting' ? 'Un réglage n’est plus proposé par un équipement. Vérifiez les valeurs de la scène.'
      : code === 'too_many' ? 'La maison contient déjà 100 scènes MP Nexus. Supprimez-en une pour continuer.'
      : 'L’opération n’a pas abouti. Votre brouillon est conservé. Vérifiez la connexion et réessayez.';
    this.note = { error: true, conflict: code === 'conflict', text: tr(key) };
  }
  private async load() {
    const token = ++this.request;
    try { const data = await listScenes(this.hass); if (token === this.request && this.isConnected) { this.data = data; this.note = undefined; } }
    catch { if (token === this.request) this.note = { error: true, text: tr('Les scènes ne répondent pas. Réessayez ou mettez MP Nexus à jour puis redémarrez Home Assistant.') }; }
  }
  private begin(scene?: NexusScene, duplicate = false) {
    this.existing = duplicate ? undefined : scene;
    this.draftId = newSceneId(); this.sourceTested = false;
    this.colourModes.clear();
    this.draft = scene ? { ...sceneValue(scene), ...(duplicate ? { name: tr('Copie de {name}', { name: scene.name }).slice(0, 80) } : {}) } : newScene();
    this.original = JSON.stringify(sceneValue(this.draft));
    if (duplicate) this.original = '';
    this.selected = this.draft.entities.map(e => e.entity_id); this.step = 0; this.note = undefined; this.baseline = undefined; this.query = ''; this.area = '';
    void this.updateComplete.then(() => (this.renderRoot.querySelector('input[name=scene-name]') as HTMLInputElement | null)?.focus());
  }
  private personalize(id: string) {
    this.begin(); this.set({ name: this.name(id).slice(0, 80), icon: sceneIcon(this.hass.states[id]), source: id });
  }
  private leave(close = false) {
    if (this.busy) return;
    if (this.dirty || this.baseline) { this.confirm = { kind: 'leave', close }; return; }
    this.finishLeave(close);
  }
  private finishLeave(close: boolean) {
    this.draft = undefined; this.existing = undefined; this.baseline = undefined; this.confirm = undefined; this.note = undefined; this.query = ''; this.area = '';
    if (close) this.dialog?.close(); else void this.load();
  }
  private async confirmed() {
    const action = this.confirm!; this.confirm = undefined;
    if (action.kind === 'preview') { await this.tryScene(); return; }
    this.busy = true;
    try {
      if (action.kind === 'delete') { await deleteScene(this.hass, action.scene!); await this.load(); this.note = { text: tr('Scène supprimée.') }; }
      else { if (this.baseline) await previewScene(this.hass, this.baseline); this.finishLeave(!!action.close); }
    } catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private toggle(id: string) { if (this.selected.includes(id)) this.selected = this.selected.filter(e => e !== id); else if (this.selected.length < 80) this.selected = [...this.selected, id]; }
  private async next() {
    if (!this.draft?.name.trim()) return;
    if (this.step === 1 && !this.draft.source) {
      this.busy = true;
      try {
        const missing = this.selected.filter(id => !this.draft!.entities.some(e => e.entity_id === id));
        const added = missing.length ? (await captureScene(this.hass, missing)).entities : [];
        this.set({ entities: [...this.draft.entities.filter(e => this.selected.includes(e.entity_id)), ...added] }); this.step = 2;
      } catch (error) { this.error(error); }
      finally { this.busy = false; }
    } else this.step = Math.min(2, this.step + 1);
  }
  private validInputs() { for (const input of this.renderRoot.querySelectorAll<HTMLInputElement>('input')) if (!input.reportValidity()) return false; return true; }
  private async save() {
    if (this.busy || !this.draft || !sceneReady(this.draft) || !this.validInputs()) return;
    this.busy = true;
    try { await saveScene(this.hass, this.draft, this.existing, this.draftId); this.finishLeave(false); await this.load(); this.note = { text: tr('Scène enregistrée pour toute la maison.') }; this.dispatchEvent(new CustomEvent('mp-scenes-changed', { bubbles: true, composed: true })); }
    catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private async tryScene() {
    if (!this.draft || !sceneReady(this.draft) || !this.validInputs()) return;
    this.busy = true;
    try {
      const missing = this.draft.entities.filter(e => !this.baseline?.entities.some(t => t.entity_id === e.entity_id)).map(e => e.entity_id);
      if (missing.length) this.baseline = { name: 'Avant essai', icon: 'sparkle', transition: 0, entities: [...(this.baseline?.entities ?? []), ...(await captureScene(this.hass, missing)).entities] };
      if (this.draft.source) this.sourceTested = true;
      await previewScene(this.hass, this.draft); this.note = { text: tr('Essai envoyé aux équipements. La scène n’est pas encore enregistrée.') };
    } catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private async restore() {
    if (!this.baseline) return; this.busy = true;
    try { await previewScene(this.hass, this.baseline); this.baseline = undefined; this.note = { text: tr('Les réglages d’avant l’essai ont été renvoyés aux équipements.') }; }
    catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private async capture(ids: string[]) {
    if (!ids.length || this.busy) return; this.busy = true;
    try { const captured = (await captureScene(this.hass, ids)).entities; for (const id of ids) this.colourModes.delete(id); this.set({ entities: this.draft!.entities.map(t => captured.find(e => e.entity_id === t.entity_id) ?? t) }); this.note = { text: tr('États actuels repris dans le brouillon. Aucun appareil n’a été commandé.') }; }
    catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private async run(id: string) {
    if (this.busy) return; this.busy = true;
    try { await this.hass.callService('scene', 'turn_on', { entity_id: id }); this.note = { text: tr('Commande de scène envoyée.') }; }
    catch (error) { this.error(error); }
    finally { this.busy = false; }
  }
  private entityFor(scene: NexusScene) { return scene.entity_id ?? Object.values(this.hass.states).find(s => s.attributes.mp_nexus_scene === scene.id)?.entity_id; }
  private button(label: MessageKey, click: () => void, primary = false, disabled = false) { return html`<button type="button" class=${`btn ${primary ? 'primary' : ''}`} ?disabled=${this.busy || disabled} @click=${click}>${tr(label)}</button>`; }
  private catalog() {
    const data = this.data;
    if (!data) return html`<div class="empty">${this.note ? this.button('Réessayer', () => void this.load()) : tr('Chargement…')}</div>`;
    const q = this.query.trim().toLocaleLowerCase(locale()), includes = (name: string) => name.toLocaleLowerCase(locale()).includes(q);
    const wrapped = new Set(data.scenes.map(s => s.source).filter(Boolean));
    const scenes = data.scenes.filter(s => includes(s.name));
    const native = data.native.filter(id => !wrapped.has(id) && includes(this.name(id)));
    return html`<div class="toolbar"><input type="search" aria-label=${tr('Rechercher une scène')} placeholder=${tr('Rechercher une scène')} .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; }}>${data.can_create ? this.button('Créer une scène', () => this.begin(), true) : nothing}</div>
      ${!data.can_create ? html`<p class="note">${tr('Votre compte peut consulter les scènes. Un compte autorisé à commander les équipements peut les créer et les modifier.')}</p>` : nothing}
      ${!scenes.length && !native.length ? html`<div class="empty">${mpIcon('sparkle', 36)}<h2>${q ? tr('Aucune scène trouvée.') : tr('Votre première ambiance, en quelques gestes.')}</h2><p class="muted">${tr('Une scène règle plusieurs appareils d’un seul toucher : cinéma, réveil, départ ou soirée.')}</p></div>` : nothing}
      <div class="list">${repeat(scenes, s => s.id, s => html`<article class="scene"><span class="badge">${mpIcon(s.icon, 24)}</span><div><h3>${s.name}</h3><small>${s.source ? tr('Bouton personnalisé') : tr('{n} équipement|{n} équipements', { n: s.entities.length })}</small></div><div class="acts">
        <button class="btn" ?disabled=${this.busy || !this.entityFor(s) || !s.editable || this.hass.states[this.entityFor(s)!]?.state === 'unavailable'} aria-label=${tr('Lancer {name}', { name: s.name })} @click=${() => void this.run(this.entityFor(s)!)}>${mpIcon('play', 15)}${tr('Lancer')}</button>
        ${s.editable ? html`<button class="btn" ?disabled=${this.busy} aria-label=${tr('Modifier {name}', { name: s.name })} @click=${() => this.begin(s)}>${tr('Modifier')}</button><button class="icon" ?disabled=${this.busy} aria-label=${tr('Dupliquer {name}', { name: s.name })} title=${tr('Dupliquer')} @click=${() => this.begin(s, true)}>${mpIcon('copy', 17)}</button><button class="icon danger" ?disabled=${this.busy} aria-label=${tr('Supprimer {name}', { name: s.name })} title=${tr('Supprimer')} @click=${() => { this.confirm = { kind: 'delete', scene: s }; }}>${mpIcon('close', 17)}</button>` : nothing}
      </div></article>`)}</div>
      ${native.length ? html`<h2 class="section">${tr('Autres scènes de la maison')}</h2><div class="list">${native.map(id => html`<article class="scene"><span class="badge">${mpIcon(sceneIcon(this.hass.states[id]), 24)}</span><div><h3>${this.name(id)}</h3><small>${tr('Conservez son fonctionnement et personnalisez son bouton dans MP Nexus.')}</small></div><div class="acts"><button class="btn" ?disabled=${this.busy || this.hass.states[id]?.state === 'unavailable'} aria-label=${tr('Lancer {name}', { name: this.name(id) })} @click=${() => void this.run(id)}>${mpIcon('play', 15)}${tr('Lancer')}</button><button class="btn" ?disabled=${this.busy} aria-label=${tr('Personnaliser {name}', { name: this.name(id) })} @click=${() => this.personalize(id)}>${tr('Personnaliser')}</button></div></article>`)}</div>` : nothing}`;
  }
  private identity() {
    const d = this.draft!;
    return html`<div class="identity"><div><label>${tr('Nom de la scène')}<input name="scene-name" type="text" required maxlength="80" autocomplete="off" placeholder=${tr('Par exemple : Soirée cinéma')} .value=${d.name} @input=${(e: Event) => this.set({ name: (e.target as HTMLInputElement).value })}></label><h2>${tr('Icône du bouton')}</h2><div class="icons" role="group" aria-label=${tr('Icône du bouton')}>${SCENE_ICONS.map(([icon, label]) => html`<button type="button" aria-label=${tr(label)} aria-pressed=${d.icon === icon} @click=${() => this.set({ icon })}>${mpIcon(icon, 24)}<small>${tr(label)}</small></button>`)}</div></div><aside class="preview"><small>${tr('Aperçu du bouton')}</small><span class="btn primary">${mpIcon(d.icon, 19)}${d.name.trim() || tr('Ma scène')}</span><p class="muted">${tr('Ce bouton apparaîtra sur l’accueil, pour toute la maison.')}</p></aside></div>`;
  }
  private sourceInfo() { return html`<div class="note"><strong>${this.name(this.draft!.source!)}</strong><p>${tr('La scène d’origine reste intacte. Son bouton MP Nexus utilise le nom et l’icône que vous choisissez.')}</p></div>`; }
  private equipment() {
    if (this.draft!.source) return html`${this.sourceInfo()}<p class="note">${tr('Pour changer aussi les appareils et leurs réglages, créez votre propre ambiance à partir de leurs états actuels.')}</p>${this.button('Définir mes propres réglages', () => {
      const members = this.hass.states[this.draft!.source!]?.attributes.entity_id;
      this.selected = (Array.isArray(members) ? members : []).filter((id): id is string => typeof id === 'string' && !!this.data?.candidates.includes(id)).slice(0, 80);
      const draft = { ...this.draft! }; delete draft.source; this.draft = draft;
    })}`;
    const ids = [...new Set([...(this.data?.candidates ?? []), ...this.draft!.entities.map(e => e.entity_id)])];
    const q = this.query.trim().toLocaleLowerCase(locale());
    const filtered = ids.filter(id => (!this.area || this.room(id) === this.area) && `${this.name(id)} ${this.room(id)}`.toLocaleLowerCase(locale()).includes(q)).sort((a, b) => this.room(a).localeCompare(this.room(b), locale()) || this.name(a).localeCompare(this.name(b), locale()));
    const all = filtered.length > 0 && filtered.every(id => this.selected.includes(id));
    return html`<p class="note">${tr('Choisissez uniquement les appareils à inclure. Leurs états actuels seront repris comme point de départ, sans rien commander.')}</p><div class="filters"><label>${tr('Rechercher un équipement')}<input type="search" .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; }}></label><label>${tr('Pièce')}<select .value=${this.area} @change=${(e: Event) => { this.area = (e.target as HTMLSelectElement).value; }}><option value="">${tr('Toutes les pièces')}</option>${[...new Set(ids.map(id => this.room(id)))].sort().map(area => html`<option .value=${area}>${area}</option>`)}</select></label></div>
      <div class="count"><strong>${tr('{n} sélectionné|{n} sélectionnés', { n: this.selected.length })} / 80</strong><button class="btn" ?disabled=${!filtered.length} @click=${() => { this.selected = all ? this.selected.filter(id => !filtered.includes(id)) : [...new Set([...this.selected, ...filtered])].slice(0, 80); }}>${all ? tr('Désélectionner la liste') : tr('Sélectionner la liste')}</button></div>
      ${!filtered.length ? html`<p class="empty">${tr('Aucun équipement disponible ne correspond à cette recherche.')}</p>` : html`<div class="checks">${repeat(filtered, id => id, id => html`<label class="pick"><input type="checkbox" .checked=${this.selected.includes(id)} ?disabled=${!this.selected.includes(id) && this.selected.length >= 80} @change=${() => this.toggle(id)}>${mpIcon(entityIcon(id, this.hass.states[id]), 20)}<span><strong>${this.name(id)}</strong><small>${this.room(id)} · ${stateLabel(id, this.hass.states[id])}</small></span></label>`)}</div>`}`;
  }
  private updateTarget(target: SceneTarget) { this.set({ entities: this.draft!.entities.map(e => e.entity_id === target.entity_id ? target : e) }); }
  private targetFields(t: SceneTarget) {
    const current = this.hass.states[t.entity_id], domain = t.entity_id.split('.')[0]!, caps = current?.attributes ?? {}, attrs = t.attributes;
    const set = (key: string, value: unknown) => {
      const updated = targetAttribute(t, key, value);
      if (key === 'current_position' && value !== undefined) updated.state = Number(value) === 0 ? 'closed' : 'open';
      if (key === 'percentage' && value !== undefined) updated.state = Number(value) === 0 ? 'off' : 'on';
      this.updateTarget(updated);
    };
    const state = (value: string) => {
      let updated = { ...t, state: value };
      if (['cover', 'valve'].includes(domain) && t.attributes.current_position !== undefined) updated = targetAttribute(updated, 'current_position', value === 'closed' ? 0 : Number(t.attributes.current_position) || 100);
      if (domain === 'fan' && t.attributes.percentage !== undefined) updated = targetAttribute(updated, 'percentage', value === 'off' ? 0 : Number(t.attributes.percentage) || 100);
      this.updateTarget(updated);
    };
    const select = (label: MessageKey, value: string, options: string[], change: (value: string) => void, optional = true, labels?: (v: string) => string) => html`<label>${tr(label)}<select .value=${value} @change=${(e: Event) => change((e.target as HTMLSelectElement).value)}>${optional ? html`<option value="">${tr('Ne pas modifier')}</option>` : nothing}${[...new Set([...options, ...(value ? [value] : [])])].map(v => html`<option .value=${v}>${labels?.(v) ?? v}</option>`)}</select></label>`;
    const numeric = (label: MessageKey, key: string, min: number, max: number, step = 1, multiplier = 1) => {
      const shown = attrs[key] === undefined ? '' : String(Math.round((Math.round((Number(attrs[key]) * multiplier - min) / step) * step + min) * 1000) / 1000);
      const change = (e: Event) => { const value = (e.target as HTMLInputElement).value; set(key, value === '' ? undefined : key === 'brightness' ? Math.round(Number(value) / multiplier) : Number(value) / multiplier); };
      return html`<label>${tr(label)}<input type="number" ?required=${key === 'color_temp_kelvin'} min=${min} max=${max} step=${step} .value=${shown} placeholder=${tr('Ne pas modifier')} @input=${change}>${['brightness', 'current_position', 'current_tilt_position', 'volume_level', 'percentage', 'humidity', 'color_temp_kelvin'].includes(key) ? html`<input type="range" aria-label=${tr(label)} min=${min} max=${max} step=${step} .value=${shown || String(min)} @input=${change}>` : nothing}</label>`;
    };
    const options = (key: string) => Array.isArray(caps[key]) ? (caps[key] as unknown[]).filter((v): v is string => typeof v === 'string') : [];
    const setting = (label: MessageKey, key: string, list: string) => options(list).length || attrs[key] !== undefined ? select(label, String(attrs[key] ?? ''), options(list), v => set(key, v || undefined)) : nothing;
    const toggle = (label: MessageKey, key: string) => select(label, attrs[key] === undefined ? '' : String(attrs[key]), ['true', 'false'], v => set(key, v ? v === 'true' : undefined), true, v => tr(v === 'true' ? 'Oui' : 'Non'));
    const mediaStates = [['off', 256], ['on', 128], ['playing', 16384], ['paused', 1]] as const;
    const states = domain === 'climate' ? options('hvac_modes') : domain === 'media_player' ? mediaStates.filter(([, flag]) => Number(caps.supported_features ?? 0) & flag).map(([value]) => value) : ['cover', 'valve'].includes(domain) ? ['closed', 'open'] : ['select', 'input_select'].includes(domain) ? options('options') : ['on', 'off'];
    const mode = ['number', 'input_number'].includes(domain) ? html`<label>${tr('Valeur souhaitée')}<input type="number" required min=${Number(caps.min ?? -1e9)} max=${Number(caps.max ?? 1e9)} step=${Number(caps.step ?? 1)} .value=${t.state} @input=${(e: Event) => state((e.target as HTMLInputElement).value)}></label>` : select('État souhaité', t.state, states, state, false, value => domain === 'climate' ? stateName(HVAC, value) : stateLabel(t.entity_id, { entity_id: t.entity_id, state: value, attributes: caps }));
    const features = Number(caps.supported_features ?? 0);
    const lightModes = options('supported_color_modes');
    const colours = ['rgb_color', 'hs_color', 'xy_color', 'rgbw_color', 'rgbww_color'];
    const colourMode = this.colourModes.get(t.entity_id) ?? (attrs.color_temp_kelvin !== undefined ? 'white' : colours.some(key => attrs[key] !== undefined) ? 'colour' : 'keep');
    const colourChoices = ['keep', ...(lightModes.includes('color_temp') ? ['white'] : []), ...(lightModes.some(mode => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode)) ? ['colour'] : [])];
    const colour = colourChoices.length > 1 ? html`${select('Teinte de la lumière', colourMode, colourChoices, value => {
      this.colourModes.set(t.entity_id, value);
      if (value === 'white') set('color_temp_kelvin', Math.max(Number(caps.min_color_temp_kelvin ?? 2000), Math.min(Number(caps.max_color_temp_kelvin ?? 6500), Number(attrs.color_temp_kelvin ?? caps.color_temp_kelvin ?? 2700))));
      else if (value === 'colour') set('rgb_color', Array.isArray(caps.rgb_color) ? caps.rgb_color : [255, 255, 255]);
      else this.updateTarget({ ...t, attributes: Object.fromEntries(Object.entries(attrs).filter(([key]) => ![...colours, 'color_temp_kelvin'].includes(key))) });
    }, false, value => tr(value === 'white' ? 'Blanc' : value === 'colour' ? 'Couleur' : 'Conserver la couleur'))}
      ${colourMode === 'white' ? numeric('Blanc (kelvins)', 'color_temp_kelvin', Number(caps.min_color_temp_kelvin ?? 2000), Number(caps.max_color_temp_kelvin ?? 6500), 100) : colourMode === 'colour' ? html`<label>${tr('Couleur de la lumière')}<input type="color" .value=${this.rgbHex(attrs.rgb_color ?? current?.attributes.rgb_color)} @input=${(e: Event) => { const hex = (e.target as HTMLInputElement).value; set('rgb_color', [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))); }}></label>` : nothing}` : nothing;
    return html`${mode}
      ${domain === 'light' && t.state !== 'off' ? html`${lightModes.some(mode => !['onoff', 'unknown'].includes(mode)) || attrs.brightness !== undefined ? numeric('Luminosité (%)', 'brightness', 1, 100, 1, 100 / 255) : nothing}
        ${colour}${setting('Effet lumineux', 'effect', 'effect_list')}` : nothing}
      ${['cover', 'valve'].includes(domain) ? html`${features & 4 || attrs.current_position !== undefined ? numeric('Ouverture (%)', 'current_position', 0, 100) : nothing}${features & 128 || attrs.current_tilt_position !== undefined ? numeric('Inclinaison (%)', 'current_tilt_position', 0, 100) : nothing}` : nothing}
      ${domain === 'climate' && t.state !== 'off' ? html`${features & 1 || attrs.temperature !== undefined ? numeric('Température souhaitée', 'temperature', Number(caps.min_temp ?? 5), Number(caps.max_temp ?? 35), Number(caps.target_temp_step ?? .5)) : nothing}${features & 2 || attrs.target_temp_low !== undefined ? html`${numeric('Température minimale', 'target_temp_low', Number(caps.min_temp ?? 5), Number(caps.max_temp ?? 35), Number(caps.target_temp_step ?? .5))}${numeric('Température maximale', 'target_temp_high', Number(caps.min_temp ?? 5), Number(caps.max_temp ?? 35), Number(caps.target_temp_step ?? .5))}` : nothing}${setting('Préréglage', 'preset_mode', 'preset_modes')}${setting('Ventilation', 'fan_mode', 'fan_modes')}${setting('Oscillation', 'swing_mode', 'swing_modes')}` : nothing}
      ${domain === 'media_player' && t.state !== 'off' ? html`${features & 4 || attrs.volume_level !== undefined ? numeric('Volume (%)', 'volume_level', 0, 100, 1, 100) : nothing}${features & 8 || attrs.is_volume_muted !== undefined ? toggle('Couper le son', 'is_volume_muted') : nothing}${setting('Source', 'source', 'source_list')}${setting('Mode sonore', 'sound_mode', 'sound_mode_list')}` : nothing}
      ${domain === 'fan' && t.state !== 'off' ? html`${features & 1 || attrs.percentage !== undefined ? numeric('Vitesse (%)', 'percentage', 0, 100, Number(caps.percentage_step ?? 1)) : nothing}${setting('Préréglage', 'preset_mode', 'preset_modes')}${features & 2 || attrs.oscillating !== undefined ? toggle('Oscillation', 'oscillating') : nothing}${attrs.direction !== undefined || features & 4 ? select('Sens de rotation', String(attrs.direction ?? ''), ['forward', 'reverse'], v => set('direction', v || undefined), true, v => tr(v === 'forward' ? 'Normal' : 'Inversé')) : nothing}` : nothing}
      ${domain === 'humidifier' && t.state !== 'off' ? html`${numeric('Humidité souhaitée (%)', 'humidity', Number(caps.min_humidity ?? 0), Number(caps.max_humidity ?? 100))}${setting('Mode', 'mode', 'available_modes')}` : nothing}`;
  }
  private rgbHex(value: unknown) { return Array.isArray(value) && value.length >= 3 ? `#${value.slice(0, 3).map(c => Math.max(0, Math.min(255, Number(c))).toString(16).padStart(2, '0')).join('')}` : '#ffffff'; }
  private settings() {
    const d = this.draft!;
    return html`<div class="summary"><span class="badge">${mpIcon(d.icon, 27)}</span><div><strong>${d.name}</strong><small>${d.source ? tr('Bouton personnalisé') : tr('{n} équipement|{n} équipements', { n: d.entities.length })}</small></div></div>
      <p class="note">${tr('Réglez l’état à retrouver au lancement. Les appareils ne changent que si vous utilisez « Essayer » ou lancez la scène enregistrée.')}</p>
      ${d.source ? this.sourceInfo() : html`<div class="toolbar"><h2>${tr('Réglages des équipements')}</h2>${this.button('Reprendre les états actuels', () => void this.capture(d.entities.map(e => e.entity_id)))}</div><div class="targets">${repeat(d.entities, t => t.entity_id, t => html`<article class="target"><div class="target-head">${mpIcon(entityIcon(t.entity_id, this.hass.states[t.entity_id]), 23)}<div><strong>${this.name(t.entity_id)}</strong><small>${this.room(t.entity_id)}${['unknown', 'unavailable'].includes(this.hass.states[t.entity_id]?.state ?? 'unavailable') ? ` · ${tr('Indisponible')}` : ''}</small></div><button class="icon" ?disabled=${this.busy} aria-label=${tr('Reprendre l’état actuel de {name}', { name: this.name(t.entity_id) })} title=${tr('Reprendre l’état actuel')} @click=${() => void this.capture([t.entity_id])}>${mpIcon('scan', 17)}</button><button class="icon danger" ?disabled=${this.busy} aria-label=${tr('Retirer {name}', { name: this.name(t.entity_id) })} title=${tr('Retirer')} @click=${() => { this.set({ entities: d.entities.filter(e => e.entity_id !== t.entity_id) }); this.selected = this.selected.filter(id => id !== t.entity_id); }}>${mpIcon('close', 17)}</button></div><div class="fields">${this.targetFields(t)}</div></article>`)}</div>`}
      <label class="transition">${tr('Transition douce (secondes)')}<input type="number" min="0" max="300" step=".5" required .value=${String(d.transition)} @input=${(e: Event) => this.set({ transition: Number((e.target as HTMLInputElement).value) })}><small>${tr('Appliquée aux appareils qui la prennent en charge, notamment les lumières.')}</small></label>`;
  }
  private confirmation() {
    const c = this.confirm!;
    const title = c.kind === 'delete' ? tr('Supprimer la scène « {name} » ?', { name: c.scene!.name }) : c.kind === 'preview' ? tr('Essayer sur les vrais équipements ?') : tr('Quitter ce brouillon ?');
    const message = c.kind === 'delete' ? tr('Son bouton disparaîtra de MP Nexus. Les appareils gardent leur état et la scène d’origine, si elle existe, reste intacte.') : c.kind === 'preview' ? this.draft?.source ? tr('La scène d’origine va être lancée. Les appareils garderont ce nouvel état après l’essai.') : tr('Les appareils vont changer. Vous pourrez revenir aux réglages d’avant avec le bouton de restauration.') : this.baseline ? tr('Les modifications seront abandonnées et les réglages d’avant l’essai seront rétablis.') : this.sourceTested ? tr('Les modifications seront abandonnées. Les appareils conservent l’état de la scène essayée.') : tr('Les modifications non enregistrées seront abandonnées. Aucun appareil ne sera commandé.');
    return html`<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="scene-confirm-title" aria-describedby="scene-confirm-message"><div><h2 id="scene-confirm-title">${title}</h2><p id="scene-confirm-message">${message}</p><div class="acts">${this.button('Continuer', () => { this.confirm = undefined; })}<button class=${`btn ${c.kind === 'preview' ? 'primary' : 'danger'}`} ?disabled=${this.busy} @click=${() => void this.confirmed()}>${tr(c.kind === 'delete' ? 'Supprimer' : c.kind === 'preview' ? 'Essayer maintenant' : this.baseline ? 'Abandonner et rétablir' : 'Abandonner')}</button></div></div></div>`;
  }
  render() {
    const d = this.draft;
    const steps: MessageKey[] = ['Nom et icône', 'Équipements', 'Réglages'];
    return html`<dialog aria-labelledby="scenes-title" aria-busy=${this.busy} @cancel=${(e: Event) => { e.preventDefault(); if (this.confirm) this.confirm = undefined; else this.leave(true); }} @close=${() => this.dispatchEvent(new CustomEvent('mp-scenes-close', { bubbles: true, composed: true }))}>
      <header ?inert=${!!this.confirm}>${d ? html`<button class="icon" ?disabled=${this.busy} aria-label=${tr('Retour aux scènes')} @click=${() => this.leave()}>${mpIcon('back', 19)}</button>` : html`<span class="badge">${mpIcon('sparkle', 24)}</span>`}<div><h1 id="scenes-title">${d ? this.existing ? tr('Modifier la scène') : tr('Créer une scène') : tr('Scènes')}</h1><small>${d ? this.dirty ? tr('Brouillon non enregistré') : tr('Personnalisez votre ambiance') : tr('Vos ambiances, entièrement dans MP Nexus')}</small></div><button class="icon close" ?disabled=${this.busy} aria-label=${tr('Fermer')} @click=${() => this.leave(true)}>${mpIcon('close', 19)}</button></header>
      <div class="body" ?inert=${!!this.confirm || this.busy}>${this.note ? html`<div class=${`note ${this.note.error ? 'error' : 'success'}`} role=${this.note.error ? 'alert' : 'status'}>${this.note.text}${this.note.conflict && this.draft ? html`<p><button class="btn" @click=${() => { this.existing = undefined; this.draftId = newSceneId(); this.set({ name: tr('Copie de {name}', { name: this.draft!.name }).slice(0,80) }); }}>${tr('Garder une copie de mon brouillon')}</button></p>` : nothing}</div>` : nothing}
        ${d ? html`<nav class="steps" aria-label=${tr('Création de scène')}>${steps.map((label, i) => html`<button aria-current=${this.step === i ? 'step' : 'false'} ?disabled=${this.busy || i > this.step} @click=${() => { this.step = i; }}><i>${i + 1}</i>${tr(label)}</button>`)}</nav>${this.step === 0 ? this.identity() : this.step === 1 ? this.equipment() : this.settings()}` : this.catalog()}
      </div>
      ${d ? html`<footer ?inert=${!!this.confirm}>${this.busy ? html`<span role="status">${tr('En cours…')}</span>` : nothing}${this.step > 0 ? this.button('Précédent', () => { this.step--; }) : nothing}<span class="spacer"></span>${this.baseline ? this.button('Revenir aux réglages d’avant', () => void this.restore()) : nothing}
        ${this.step < 2 ? this.button('Suivant', () => void this.next(), true, !d.name.trim() || this.step === 1 && !d.source && !this.selected.length) : html`${this.button('Essayer', () => { if (this.validInputs()) this.confirm = { kind: 'preview' }; }, false, !sceneReady(d))}${this.button('Enregistrer', () => void this.save(), true, !sceneReady(d))}`}</footer>` : nothing}
      ${this.confirm ? this.confirmation() : nothing}
    </dialog>`;
  }
}
if (!customElements.get('mp-nexus-scenes')) customElements.define('mp-nexus-scenes', MPSceneEditor);
