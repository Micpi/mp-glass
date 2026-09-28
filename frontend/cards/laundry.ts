import { LitElement, css, html, nothing } from 'lit';
import type { HADevice, HAEntity, HAState } from '../../shared/models';
import type { Hass } from '../ha/client';
import { LanguageController, tr } from '../i18n';
import { mpIcon } from '../icons';

interface LaundryConfig { type?: string; name?: string }
interface Machine { key: string; name: string; running: boolean; status: string; remaining?: string; program?: string; progress?: number; power?: string; energy?: string; door?: string }
const washerWord = /\b(washer|washing[ _-]?machine|lave[ _-]?linge|machine[ _-]?a[ _-]?laver|lavadora|lavatrice|waschmaschine|waschautomat)\b/i;
const roleWords = /(?:[ _·-]+)(?:remaining(?:[ _-]?time)?|time[ _-]?(?:remaining|left|to[ _-]?finish)|temps[ _-]?(?:restant|fin)|restzeit|restante|operation[ _-]?(?:state|status)|cycle[ _-]?(?:state|status|progress)|program(?:me)?|progress|duration|power|energy|consumption|door|t[uü]r|status|state|état|etat|marche|fonctionnement|available|availability|spin|rinse|wash|phase|stage|current[ _-]?program|active[ _-]?program)$/i;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fmtDuration = (raw: unknown, unit?: unknown): string | undefined => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const value = String(raw).trim();
  let seconds: number | undefined;
  if (/^P/i.test(value)) {
    const match = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (match) seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  } else if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(value)) {
    const parts = value.split(':').map(Number);
    seconds = parts.length === 3 ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]! : parts[0]! * 60 + parts[1]!;
  } else if (Number.isFinite(Number(value))) {
    const normalizedUnit = String(unit ?? '').toLowerCase();
    seconds = Number(value) * (normalizedUnit.includes('hour') || normalizedUnit === 'h' ? 3600 : normalizedUnit.includes('min') ? 60 : normalizedUnit.includes('sec') || normalizedUnit === 's' ? 1 : 60);
  }
  if (seconds === undefined || seconds < 0) return undefined;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 1) return '< 1 min';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours} h ${String(remainder).padStart(2, '0')}` : `${minutes} min`;
};
const firstText = (...values: unknown[]): string | undefined => values.find(value => typeof value === 'string' && value.trim() && !['unknown', 'unavailable', 'none', 'null'].includes(value.trim().toLowerCase())) as string | undefined;
const pick = (state: HAState, keys: string[]) => {
  for (const key of keys) if (state.attributes[key] !== undefined && state.attributes[key] !== null) return state.attributes[key];
  return undefined;
};
const scoreFor = (id: string, state: HAState) => {
  const text = normalize(`${id} ${String(state.attributes.friendly_name ?? '')} ${String(state.attributes.device_class ?? '')} ${String(state.attributes.entity_id ?? '')}`);
  return washerWord.test(text);
};
function machineBase(id: string, state: HAState) {
  const friendly = String(state.attributes.friendly_name ?? id).replace(/^[^·]+·\s*/, '');
  const raw = friendly.includes('·') ? friendly.split('·')[0]! : friendly.replace(roleWords, '').trim();
  const slug = normalize(raw).replace(/\b(washer|washing machine|lave linge|machine a laver|lavadora|lavatrice|waschmaschine)\b/g, '').trim();
  return slug || id.split('.')[1]!.replace(roleWords, '').replace(/_(?:remaining|operation|cycle|program|progress|duration|power|energy|door|status|state).*$/i, '') || id;
}
function getMachineStatus(states: HAState[]) {
  const statusState = states.find(state => /operation|cycle|wash|status|state|phase|programme|program/i.test(`${state.entity_id} ${state.attributes.friendly_name ?? ''} ${state.attributes.device_class ?? ''}`) && !/progress/i.test(state.entity_id));
  const raw = firstText(pick(statusState ?? states[0]!, ['operation_state','run_state','status','state','wash_state','cycle_state']), statusState?.state, pick(states[0]!, ['operation_state','run_state','status','wash_state','cycle_state']));
  const status = raw ? raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toLocaleUpperCase()) : 'En veille';
  const norm = normalize(raw ?? '');
  const running = /running|washing|rinse|spin|dry|heating|prewash|wash|lavage|rinç|rinc|essorage|séch|sech|marche|operation/.test(norm) && !/not running|idle|off|paused|complete|completed|finished|termin|done|ready|standby|disponible/.test(norm);
  return { status, running };
}
function buildMachines(hass: Hass, entities: HAEntity[], devices: HADevice[], deviceNames: Map<string, string>): Machine[] {
  const registry = new Map(entities.map(entity => [entity.entity_id, entity]));
  const devicesById = new Map(devices.map(device => [device.id, device]));
  const stateEntries = Object.entries(hass.states).filter(([id, state]) => {
    if (!state) return false;
    const deviceId = registry.get(id)?.device_id;
    const device = deviceId ? devicesById.get(deviceId) : undefined;
    return scoreFor(state.entity_id, state) || (!!device && washerWord.test(`${deviceNames.get(device.id) ?? ''} ${device.manufacturer ?? ''} ${device.model ?? ''}`));
  });
  const groups = new Map<string, { name: string; states: HAState[] }>();
  for (const [id, state] of stateEntries) {
    const entity = registry.get(id);
    const device = entity?.device_id ? devices.find(item => item.id === entity.device_id) : undefined;
    const deviceText = device ? deviceNames.get(device.id) ?? '' : '';
    const explicitDeviceMatch = !!device && washerWord.test(`${deviceText} ${device.manufacturer ?? ''} ${device.model ?? ''}`);
    const key = entity?.device_id && explicitDeviceMatch ? `device:${entity.device_id}` : `name:${machineBase(id, state)}`;
    const inferredName = deviceText || machineBase(id, state).replace(/\b\w/g, c => c.toLocaleUpperCase()) || String(state.attributes.friendly_name ?? id);
    const group = groups.get(key) ?? { name: inferredName, states: [] };
    group.states.push(state); if (explicitDeviceMatch) group.name = deviceText;
    groups.set(key, group);
  }
  const asUnit = (states: HAState[], patterns: RegExp[]) => states.find(state => patterns.some(re => re.test(`${state.entity_id} ${state.attributes.friendly_name ?? ''} ${state.attributes.device_class ?? ''}`)));
  const machines = [...groups].map(([key, group]) => {
    const states = [...group.states];
    // Include all other states on a confirmed Home Assistant device so power, energy and cycle sensors need not repeat its name.
    const deviceId = key.startsWith('device:') ? key.slice(7) : undefined;
    if (deviceId) for (const entity of entities) if (entity.device_id === deviceId) { const state = hass.states[entity.entity_id]; if (state && !states.includes(state)) states.push(state); }
    const main = states.find(state => scoreFor(state.entity_id, state)) ?? states[0]!;
    const friendlyName = String(main.attributes.device_name ?? main.attributes.friendly_name ?? group.name ?? tr('Lave-linge')).replace(/\s*[·:-].*$/, '').trim();
    const name = deviceId ? group.name : friendlyName;
    const { status, running } = getMachineStatus(states);
    const remaining = states.map(state => {
      const value = pick(state, ['remaining_time','time_remaining','remaining','time_left','estimated_time','finish_in']);
      const unit = state.attributes.unit_of_measurement;
      return fmtDuration(value, unit) ?? (/(remaining|time left|restant|restzeit|restante)/i.test(`${state.entity_id} ${state.attributes.friendly_name ?? ''}`) ? fmtDuration(state.state, unit) : undefined);
    }).find(Boolean);
    const programState = asUnit(states, [/program(?:me)?/i, /programme|cycle type/i]);
    const progressState = asUnit(states, [/progress/i]);
    const powerState = asUnit(states, [/power|puissance/i]);
    const energyState = asUnit(states, [/energy|consumption|énergie/i]);
    const doorState = asUnit(states, [/door|porte/i]);
    const progressRaw = Number(progressState?.state ?? pick(main, ['progress','progress_percent','percentage','completion'])) ;
    const progress = Number.isFinite(progressRaw) && progressRaw >= 0 && progressRaw <= 100 ? Math.round(progressRaw) : undefined;
    const power = powerState && Number.isFinite(Number(powerState.state)) ? `${Math.round(Number(powerState.state))} ${String(powerState.attributes.unit_of_measurement ?? 'W')}` : undefined;
    const energy = energyState && Number.isFinite(Number(energyState.state)) ? `${Number(energyState.state).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${String(energyState.attributes.unit_of_measurement ?? 'kWh')}` : undefined;
    return { key, name, running, status, remaining, program: firstText(programState?.state, pick(main, ['program','program_name','active_program','current_program'])), progress, power, energy, door: doorState ? (['on','open','opened'].includes(doorState.state.toLowerCase()) ? tr('Hublot ouvert') : tr('Hublot fermé')) : undefined };
  });
  return machines.filter((machine): machine is NonNullable<typeof machine> => !!machine).sort((a,b) => a.name.localeCompare(b.name));
}

export class MPGlassLaundry extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true }, machines: { state: true }, loading: { state: true } };
  static styles = css`
    :host{display:block;color:#f3f6f6;font-family:Inter,system-ui,sans-serif;--washer-accent:#7be0d2;--washer-muted:#9daead}
    *{box-sizing:border-box}.room{position:relative;overflow:hidden;padding:clamp(20px,4vw,38px);border:1px solid rgba(224,243,239,.14);border-radius:26px;background:radial-gradient(ellipse at 13% -5%,rgba(117,180,157,.13),transparent 44%),linear-gradient(150deg,#263537,#182528 58%,#172226);box-shadow:0 24px 60px #030a0d70,inset 0 1px #ffffff12}
    .room:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.22;background:linear-gradient(90deg,transparent 49.8%,#d0ded818 50%,transparent 50.2%),linear-gradient(#d0ded80e 1px,transparent 1px);background-size:100% 100%,100% 34px;mask-image:linear-gradient(180deg,#000,transparent 55%)}
    .intro{position:relative;display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:24px}.eyebrow{color:#adc2bb;font-size:10px;letter-spacing:.25em;text-transform:uppercase}.intro h2{margin:7px 0 0;font:clamp(25px,4vw,34px)/1.05 Georgia,serif;font-weight:400}.count{flex:0 0 auto;padding:8px 11px;border:1px solid #c5e2d126;border-radius:999px;background:#13202380;color:#c7d5cf;font-size:11px}
    .machines{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:14px}.machine{min-width:0;padding:16px;border:1px solid #d9e7e314;border-radius:19px;background:linear-gradient(145deg,#d8ede90e,#121c1f85);backdrop-filter:blur(12px)}.machine-head{display:flex;align-items:center;gap:10px;margin-bottom:15px}.machine-head>div{min-width:0;flex:1}.machine-head h3{overflow:hidden;margin:0;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.machine-head p{margin:5px 0 0;color:var(--washer-muted);font-size:10px}.dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#81908b}.dot.active{background:#69e0b1;box-shadow:0 0 12px #69e0b188;animation:pulse 2s ease-in-out infinite}.remaining{text-align:right}.remaining strong{display:block;color:#f4f6ed;font:24px/1 Georgia,serif;font-weight:400}.remaining small{display:block;margin-top:4px;color:#a6b6af;font-size:9px;letter-spacing:.13em;text-transform:uppercase}
    .appliance{position:relative;display:grid;grid-template-columns:110px 1fr;align-items:center;gap:18px;min-height:166px;padding:15px;border-radius:14px;background:linear-gradient(135deg,#d5e0de,#8fa09e 62%,#768986);box-shadow:inset 0 1px #fff9,0 10px 25px #070f1055;color:#203032}
    .washer{position:relative;height:136px;border:1px solid #ffffff70;border-radius:12px;background:linear-gradient(135deg,#eef4f1,#c6d2cf 72%,#b5c4c0);box-shadow:inset -5px -5px 12px #2534321c,inset 4px 3px 8px #fff9}
    .panel{height:27px;margin:8px 8px 0;padding:0 6px;display:flex;align-items:center;gap:5px;border-radius:5px;background:linear-gradient(180deg,#344647,#1d2a2b);box-shadow:inset 0 1px 3px #080e0f}.screen{min-width:0;flex:1;overflow:hidden;color:#9df0d0;font:7px/1.2 ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 6px #62e2b0}.knob{width:13px;height:13px;flex:0 0 auto;border:2px solid #aebbb7;border-radius:50%;background:linear-gradient(135deg,#e8eeeb,#8d9b97);box-shadow:0 0 0 2px #253538}
    .door{position:absolute;left:50%;top:44px;width:76px;height:76px;transform:translateX(-50%);display:grid;place-items:center;border:5px solid #dbe5e2;border-radius:50%;background:linear-gradient(145deg,#1c2b2e 10%,#071315 70%);box-shadow:inset 0 0 0 2px #607575,0 2px 4px #18232270}
    .glass{position:relative;width:53px;height:53px;overflow:hidden;border:1px solid #a6cec6;border-radius:50%;background:radial-gradient(circle at 35% 28%,#8bcfc044,#477d795c 55%,#102325)}.water{position:absolute;inset:52% -20% -15%;border-radius:45% 55% 0 0;background:linear-gradient(180deg,#4fb5a688,#276e77b8);animation:wave 3s ease-in-out infinite}.linen{position:absolute;left:7px;top:10px;width:26px;height:18px;border-radius:10px 8px 7px 5px;background:#e8e1d1;box-shadow:9px 8px 0 -1px #cbbda9;transform:rotate(-22deg)}.linen:after{content:"";position:absolute;left:8px;top:4px;width:22px;height:17px;border-radius:11px;background:#dce8dc;box-shadow:0 0 8px #c9eee688}.drum{position:absolute;inset:0;animation:spin 3.2s linear infinite}.drum.paused{animation-play-state:paused}.drum:after{content:"";position:absolute;left:23px;top:6px;width:4px;height:4px;border-radius:50%;background:#f4f4e9;box-shadow:18px 37px 0 #ecf3e5b8,1px 40px 0 #e2eee0a0}
    .feet{position:absolute;bottom:-4px;left:14px;right:14px;display:flex;justify-content:space-between}.feet i{width:12px;height:6px;border-radius:0 0 4px 4px;background:#687976}.appliance-copy{min-width:0;display:grid;gap:10px}.metric{display:flex;justify-content:space-between;gap:8px;color:#586866;font-size:10px}.metric strong{overflow:hidden;color:#253536;font-weight:600;text-align:right;text-overflow:ellipsis;white-space:nowrap}.progress{height:4px;overflow:hidden;border-radius:10px;background:#42565328}.progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4fa994,#8bd8b7);box-shadow:0 0 8px #54bc9a66;transition:width .7s ease}.badges{display:flex;flex-wrap:wrap;gap:6px}.badge{padding:5px 7px;border:1px solid #3447441c;border-radius:8px;background:#f0f6f340;color:#3c504c;font-size:9px}.empty{position:relative;display:flex;align-items:center;gap:14px;padding:22px;border:1px dashed #c8dfd02a;border-radius:16px;color:#aebfba}.empty .mp-icon{color:var(--washer-accent)}.empty strong{display:block;color:#e6eeeb;font-size:13px}.empty p{margin:5px 0 0;font-size:11px;line-height:1.5}
    @keyframes spin{to{transform:rotate(360deg)}}@keyframes wave{0%,100%{transform:translateY(4px) rotate(-4deg)}50%{transform:translateY(-3px) rotate(4deg)}}@keyframes pulse{50%{opacity:.5;box-shadow:0 0 3px #69e0b144}}@media(prefers-reduced-motion:reduce){.drum,.water,.dot{animation:none!important}}
    @media(max-width:430px){.room{padding:16px}.intro{align-items:start}.appliance{grid-template-columns:96px 1fr;gap:13px;padding:11px}.washer{height:128px}.door{width:70px;height:70px}.glass{width:48px;height:48px}.linen{transform:scale(.88) rotate(-22deg);transform-origin:top left}.remaining strong{font-size:21px}}
  `;
  protected config?: LaundryConfig;
  protected machines: Machine[] = [];
  protected loading = true;
  private language = new LanguageController(this);
  private registryConnection?: object;
  private registry?: Promise<{ entities: HAEntity[]; devices: HADevice[]; names: Map<string, string> }>;
  private sequence = 0;

  setConfig(config: LaundryConfig) { this.config = { ...config }; }
  static getConfigElement() { return document.createElement('mp-glass-laundry-editor'); }
  set hass(value: Hass | undefined) { const old = this.hass; this._hass = value; if (!old || old.states !== value?.states || old.language !== value?.language || old.locale?.language !== value?.locale?.language) { this.requestUpdate(); if (value && value.connection !== this.registryConnection) void this.loadRegistry(value); else void this.refreshMachines(value); } }
  get hass() { return this._hass; }
  private _hass?: Hass;
  static getStubConfig() { return { type: 'custom:mp-glass-laundry' }; }
  getCardSize() { return Math.max(3, this.machines.length * 5); }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  private async loadRegistry(hass: Hass) {
    this.registryConnection = hass.connection;
    const sequence = ++this.sequence;
    this.loading = true;
    this.registry = Promise.all([
      hass.callWS<HAEntity[]>({ type: 'config/entity_registry/list' }).catch(() => []),
      hass.callWS<HADevice[]>({ type: 'config/device_registry/list' }).catch(() => []),
    ]).then(([entities, devices]) => {
      const names = new Map(devices.map(device => { const item = device as HADevice & { name?: string; name_by_user?: string }; return [device.id, item.name_by_user ?? item.name ?? item.model ?? '']; }));
      return { entities, devices, names };
    });
    await this.refreshMachines(hass, sequence);
  }
  private async refreshMachines(hass = this.hass, sequence = this.sequence) {
    if (!hass) return;
    this.loading = true;
    const meta = await this.registry?.catch(() => ({ entities: [], devices: [], names: new Map<string,string>() }));
    if (sequence !== this.sequence || hass !== this.hass) return;
    this.machines = buildMachines(hass, meta?.entities ?? [], meta?.devices ?? [], meta?.names ?? new Map());
    this.loading = false;
  }

  protected render() {
    if (!this.config) return nothing;
    const running = this.machines.filter(machine => machine.running).length;
    return html`<section class="room" aria-label=${tr('Lave-linge')}>
      <header class="intro"><div><div class="eyebrow">${tr('Buanderie · équipements')}</div><h2>${String(this.config.name ?? tr('Lave-linge'))}</h2></div>${this.machines.length ? html`<span class="count">${this.machines.length} ${tr(this.machines.length === 1 ? 'machine' : 'machines')} · ${running} ${tr('en cours')}</span>` : nothing}</header>
      ${this.machines.length ? html`<div class="machines">${this.machines.map(machine => html`<article class="machine" data-running=${String(machine.running)} aria-label=${`${machine.name} · ${machine.status}`}>
        <div class="machine-head"><i class=${`dot ${machine.running ? 'active' : ''}`} aria-hidden="true"></i><div><h3>${machine.name}</h3><p>${machine.status}</p></div><div class="remaining">${machine.running && machine.remaining ? html`<strong>${machine.remaining}</strong><small>${tr('restant')}</small>` : html`<strong>${machine.running ? '↻' : '✓'}</strong><small>${machine.running ? tr('en cours') : tr('terminé')}</small>`}</div></div>
        <div class="appliance" aria-hidden="true"><div class="washer"><div class="panel"><span class="screen">${machine.running ? (machine.remaining ?? machine.status) : tr('PRÊT')}</span><i class="knob"></i></div><div class="door"><div class="glass"><div class=${`drum ${machine.running ? '' : 'paused'}`}><i class="linen"></i></div><i class="water"></i></div></div><div class="feet"><i></i><i></i></div></div><div class="appliance-copy">
          ${machine.program ? html`<div class="metric"><span>${tr('Programme')}</span><strong>${machine.program}</strong></div>` : nothing}
          ${machine.progress !== undefined ? html`<div class="metric"><span>${tr('Cycle')}</span><strong>${machine.progress} %</strong></div><div class="progress"><i style=${`width:${machine.progress}%`}></i></div>` : nothing}
          ${machine.power ? html`<div class="metric"><span>${tr('Puissance')}</span><strong>${machine.power}</strong></div>` : nothing}
          <div class="badges">${machine.door ? html`<span class="badge">${machine.door}</span>` : nothing}${machine.energy ? html`<span class="badge">${machine.energy}</span>` : nothing}</div>
        </div></div>
      </article>`)}</div>` : html`<div class="empty" role="status">${mpIcon('rooms',25)}<div><strong>${this.loading ? tr('Recherche des lave-linge…') : tr('Aucun lave-linge détecté')}</strong><p>${this.loading ? tr('Lecture des équipements Home Assistant.') : tr('Les appareils et leurs capteurs apparaîtront ici dès que Home Assistant les aura identifiés.')}</p></div></div>`}
    </section>`;
  }
}

export class MPGlassLaundryEditor extends LitElement {
  static properties = { hass: { attribute: false }, config: { state: true } };
  hass?: Hass;
  private config: LaundryConfig = { type: 'custom:mp-glass-laundry' };
  setConfig(config: LaundryConfig) { this.config = { ...config }; }
  private updateName(event: Event) {
    const name = (event.target as HTMLInputElement).value.trim();
    const config = { ...this.config };
    if (name) config.name = name; else delete config.name;
    this.config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config } }));
  }
  render() { return html`<label style="display:grid;gap:7px;padding:14px 0"><span>${tr('Titre (facultatif)')}</span><input .value=${this.config.name ?? ''} placeholder=${tr('Lave-linge')} @change=${this.updateName}></label><p style="color:var(--secondary-text-color);font-size:12px">${tr('Les machines et leurs capteurs sont repérés automatiquement dans Home Assistant.')}</p>`; }
}
