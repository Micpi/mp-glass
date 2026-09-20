import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { available, brightnessPercent, MPCapabilityEngine } from '../shared/capabilities';
import type { HAState } from '../shared/models';
import { canCover, canMedia, coverPosition, coverTilt, finite, mediaOn, mediaVolume, type CoverAction } from '../shared/spatial-state';
import { attributeRows, domainOf, entityIcon, entityLabel, HVAC, hvacIcon, kindOf, RUN_SERVICES, since, stateDetail, stateLabel, stateName, TOGGLE_DOMAINS } from './entities';
import type { Hass } from './ha/client';
import { LanguageController, locale, tr } from './i18n';
import { mpIcon } from './icons';
import type { MessageKey } from './locales';
import { defineElement } from './registry';

/** Fired when the window closes, so the page that opened it forgets the device it was showing. */
export const DETAIL_CLOSE = 'mp-glass-detail-close';
/** Colours a light takes in one touch; anything else through the colour picker beside them. */
const COLORS: [key: 'Blanc chaud'|'Blanc froid'|'Ambre'|'Rouge'|'Vert'|'Bleu'|'Violet', rgb: [number, number, number]][] = [
  ['Blanc chaud',[255,190,120]],['Blanc froid',[233,244,255]],['Ambre',[255,170,40]],['Rouge',[255,72,72]],['Vert',[86,226,140]],['Bleu',[80,150,255]],['Violet',[176,120,255]],
];
const hex = ([r,g,b]:[number,number,number]) => `#${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`;
const fromHex = (value:string):[number,number,number]|undefined => {
  const match=/^#?([0-9a-f]{6})$/i.exec(value.trim());
  if(!match)return undefined;
  const number=Number.parseInt(match[1]!,16);
  return [(number>>16)&255,(number>>8)&255,number&255];
};
const triple = (value:unknown):[number,number,number]|undefined => Array.isArray(value)&&value.length===3&&value.every(n=>typeof n==='number'&&Number.isFinite(n))?[value[0] as number,value[1] as number,value[2] as number]:undefined;

/**
 * The MP Nexus window of one device, in the place Home Assistant would open its own: the same glass, the same language,
 * and only the commands the device really offers. Home Assistant stays one touch away, for its history and its settings.
 * It commands nothing but the entity it shows, in that entity's own domain, through the user's session.
 */
export class MPGlassDetail extends LitElement {
  static properties = { hass:{attribute:false}, entity:{attribute:false}, busy:{state:true}, error:{state:true} };
  static styles = css`
    :host{display:contents;--accent:var(--mp-accent,#69b7ff);--line:rgba(206,230,255,.18);--warm:#ffc540}
    *{box-sizing:border-box}
    dialog{width:min(560px,calc(100vw - 16px));max-height:calc(100dvh - 20px);padding:0;overflow:hidden auto;color:#eef6ff;font-family:var(--mp-body-font,Inter,ui-sans-serif,system-ui,sans-serif);border:1px solid color-mix(in srgb,var(--accent) calc(var(--mp-border,.2)*100%),rgba(224,239,255,.42));border-radius:calc(var(--mp-radius,var(--mp-glass-radius,22px)) + 4px);background:linear-gradient(150deg,color-mix(in srgb,var(--mp-tint,#12344f) 94%,transparent),rgba(5,21,37,.98) 72%);box-shadow:0 40px 90px rgba(0,4,12,.62),inset 0 1px rgba(255,255,255,.14);animation:rise .22s ease}
    dialog::backdrop{background:rgba(2,10,20,.62);backdrop-filter:blur(7px)}
    .sheet{display:grid;gap:14px;padding:18px}
    header{display:flex;align-items:center;gap:13px;min-width:0}
    .orb{display:grid;place-items:center;width:52px;height:52px;flex:0 0 auto;border-radius:var(--mp-icon-radius,17px);color:#dbeafe;background:color-mix(in srgb,var(--accent) 16%,rgba(255,255,255,.05));border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)}
    .orb.on{color:#fff;background:radial-gradient(circle,color-mix(in srgb,var(--warm) 34%,transparent),color-mix(in srgb,var(--warm) 8%,transparent));border-color:color-mix(in srgb,var(--warm) 45%,transparent);box-shadow:0 0 28px color-mix(in srgb,var(--warm) 26%,transparent)}
    .title{min-width:0;margin-right:auto}
    .title small{display:block;color:#a9bdd0;font-size:10px;letter-spacing:.2em;text-transform:uppercase}
    .title h2{margin:6px 0 0;font:24px/1.1 var(--mp-display-font,Georgia,serif);font-weight:400;overflow-wrap:anywhere}
    button{font:inherit;color:inherit;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease}
    button:hover:not(:disabled){transform:translateY(-1px)}
    button:disabled,input:disabled,select:disabled{opacity:.45;cursor:default;transform:none}
    button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    .close{display:grid;place-items:center;width:40px;height:40px;flex:0 0 auto;padding:0;border-radius:13px;border:1px solid var(--line);background:rgba(4,20,35,.5);color:#c7d8e8}
    .close:hover{background:color-mix(in srgb,var(--accent) 22%,transparent);color:#fff}
    .hero{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.045)}
    .hero strong{font:31px/1 var(--mp-display-font,Georgia,serif);font-weight:400}
    .hero small{color:#a9bdd0;font-size:12px}
    .hero .when{margin-left:auto;color:#8fa5b9;font-size:11px}
    .group{display:grid;gap:10px}
    .group>p{margin:0;padding:8px 2px 0;border-top:1px solid rgba(157,205,240,.24);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#d7eaff}
    .power{display:flex;align-items:center;justify-content:center;gap:9px;min-height:52px;padding:0 18px;border-radius:16px;border:1px solid rgba(202,228,255,.18);background:rgba(8,29,48,.45);color:#dae7f3;font-weight:650}
    .power.on{color:#0a2338;background:linear-gradient(135deg,#ffe481,var(--warm));border-color:#ffea9d;box-shadow:0 8px 24px color-mix(in srgb,var(--warm) 24%,transparent),inset 0 1px rgba(255,255,255,.5)}
    .power.cool.on{color:#052033;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 65%,white),var(--accent));border-color:color-mix(in srgb,var(--accent) 60%,white);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 30%,transparent)}
    .pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
    .pair button,.modes button,.stepper button,.transport button,.volume button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 12px;border-radius:14px;border:1px solid var(--line);background:rgba(8,29,48,.45);font-weight:600}
    .pair button:hover:not(:disabled),.modes button:hover:not(:disabled){border-color:color-mix(in srgb,var(--accent) 55%,transparent);background:rgba(20,53,77,.62)}
    .modes{display:flex;flex-wrap:wrap;gap:8px}
    .modes button[aria-pressed=true]{color:#fff;background:color-mix(in srgb,var(--accent) 34%,transparent);border-color:color-mix(in srgb,var(--accent) 58%,white)}
    .modes button[aria-pressed=true][data-mode=heat]{background:color-mix(in srgb,#ff9a5c 34%,transparent);border-color:#ffb98c}
    .modes button[aria-pressed=true][data-mode=cool]{background:color-mix(in srgb,#5cd8ff 30%,transparent);border-color:#9be8ff}
    .stepper{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;gap:10px}
    .stepper button{min-width:52px}
    .stepper .target{text-align:center;font:34px/1 var(--mp-display-font,Georgia,serif);font-weight:400}
    .stepper .target small{display:block;margin-top:6px;font-size:11px;font-family:inherit;color:#a9bdd0}
    label.slider{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;font-size:11.5px;color:#cfe0ef}
    label.slider output{min-width:46px;text-align:right;color:#eef6ff;font-weight:600}
    input[type=range]{appearance:none;width:100%;height:20px;margin:0;background:transparent;cursor:pointer}
    input[type=range]::-webkit-slider-runnable-track{height:5px;border-radius:99px;background:linear-gradient(90deg,var(--accent),rgba(206,226,246,.22))}
    input[type=range]::-webkit-slider-thumb{appearance:none;width:17px;height:17px;margin-top:-6px;border-radius:50%;background:#fff;border:3px solid var(--accent);box-shadow:0 2px 9px rgba(0,8,18,.5)}
    input[type=range]::-moz-range-track{height:5px;border-radius:99px;background:rgba(206,226,246,.22)}
    input[type=range]::-moz-range-progress{height:5px;border-radius:99px;background:var(--accent)}
    input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid var(--accent)}
    label.slider.warm input[type=range]::-webkit-slider-runnable-track{background:linear-gradient(90deg,#ffb347,#fff6e3)}
    label.slider.warm input[type=range]::-webkit-slider-thumb{border-color:var(--warm)}
    label.slider.warm input[type=range]::-moz-range-progress{background:var(--warm)}
    label.slider.warm input[type=range]::-moz-range-thumb{border-color:var(--warm)}
    .colors{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
    .colors button{width:38px;height:38px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.35);box-shadow:inset 0 1px rgba(255,255,255,.4)}
    .colors button[aria-pressed=true]{outline:2px solid #fff;outline-offset:2px}
    .colors input[type=color]{width:38px;height:38px;padding:0;border:1px dashed rgba(206,230,255,.45);border-radius:50%;background:transparent;cursor:pointer;overflow:hidden}
    .colors input[type=color]::-webkit-color-swatch-wrapper{padding:2px}
    .colors input[type=color]::-webkit-color-swatch{border:0;border-radius:50%}
    .transport{display:flex;align-items:center;gap:8px}
    .transport button{min-width:52px}
    .transport button.play{min-width:64px;background:color-mix(in srgb,var(--accent) 36%,rgba(8,29,48,.45));border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
    .volume{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;font-size:11.5px;color:#dfe9f3}
    .volume button{min-width:44px}
    .volume button[aria-pressed=true]{color:#ffbda9;border-color:rgba(255,189,169,.4)}
    .volume output{min-width:44px;text-align:right;font-weight:600}
    label.pick{display:grid;gap:7px;font-size:11px;color:#a9bdd0}
    select{min-height:44px;width:100%;padding:0 12px;border-radius:14px;border:1px solid var(--line);background:rgba(8,29,48,.6);color:#eef7ff;font:inherit}
    select option{background:#0b2237;color:#fff}
    .error{margin:0;padding:11px 14px;border-radius:14px;color:#ffc3ad;background:rgba(80,20,10,.35);border:1px solid rgba(255,170,140,.25);font-size:12.5px}
    details{border-top:1px solid rgba(157,205,240,.24);padding-top:10px}
    summary{min-height:38px;display:flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#bed4e8;cursor:pointer}
    dl{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr);gap:6px 14px;margin:6px 0 0;font-size:12px}
    dt{color:#9db1c4;overflow-wrap:anywhere}
    dd{margin:0;text-align:right;overflow-wrap:anywhere}
    footer{display:flex}
    .native{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:44px;padding:0 14px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);font-size:12.5px}
    .native:hover{background:color-mix(in srgb,var(--accent) 22%,transparent)}
    @keyframes rise{from{opacity:0;transform:translateY(10px) scale(.985)}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  hass?: Hass;
  /** The entity shown; the window opens on the entity it is given and commands no other. */
  entity = '';
  private busy = false;
  private error = '';
  /** Closed by the person: the window stays closed until it is opened again, on another device or on the same one. */
  private dismissed = false;
  private language = new LanguageController(this);
  private get state() { return this.hass?.states[this.entity]; }
  private get dialog() { return this.renderRoot.querySelector('dialog') ?? undefined; }
  /** Open while this element carries a device, whether the page gives it one for the first time or reuses it for another. */
  private showing = false;
  /**
   * The window follows `entity`. A window closed by the browser — Escape, a back gesture — is reported here too, on the
   * update that follows, so the page forgets the device even where the `close` event of the dialog arrives late.
   */
  protected updated(changed:PropertyValues) {
    if(changed.has('entity')) this.dismissed=false;
    const dialog=this.dialog;
    if(!dialog) return;
    if(this.showing&&!dialog.open) { this.showing=false; this.close(); }
    else if(this.entity&&!dialog.open&&!this.dismissed) { dialog.showModal(); this.showing=true; }
  }
  /**
   * Closing tells the page to forget the device: reopening it draws the window again, on the state of the moment.
   * The window is marked closed at once, and never on the `close` event alone, which a browser may report late.
   */
  private close = () => {
    this.dismissed=true; this.showing=false;
    this.dialog?.close();
    this.dispatchEvent(new CustomEvent(DETAIL_CLOSE,{bubbles:true,composed:true}));
  };
  /** Closed by Escape, or by the browser: the page hears of it exactly as it hears of the close button. */
  private closed = () => { if(!this.dismissed) this.close(); };
  /** A touch outside the sheet closes the window, as Home Assistant's own does. */
  private backdrop = (event:MouseEvent) => { if(event.target===this.dialog) this.close(); };
  /** Home Assistant's own window, for the history, the logbook and the settings of the entity: never intercepted again. */
  private native = () => {
    this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:this.entity,mpNative:true},bubbles:true,composed:true}));
    this.close();
  };
  /** Commands the entity shown, in its own domain, and only while Home Assistant reports it available. */
  private async call(service:string, data:Record<string,unknown> = {}) {
    const domain=domainOf(this.entity);
    if(!this.hass||this.busy||!domain||!available(this.state)) return;
    this.busy=true; this.error='';
    try { await this.hass.callService(domain,service,{...data,entity_id:this.entity}); }
    catch { this.error=tr('Commande refusée ou équipement indisponible.'); }
    finally { this.busy=false; }
  }
  private format(value:number, digits=1) { return new Intl.NumberFormat(locale(),{maximumFractionDigits:digits}).format(value); }
  private number(value:unknown) { return finite(value); }

  /** Power, brightness, colour temperature and colour, each offered only where the light declares it. */
  private lightControls(state:HAState) {
    const on=state.state==='on',percent=brightnessPercent(state.attributes.brightness);
    // The same evidence as the card: what the light declares, never what its domain suggests.
    const capabilities=MPCapabilityEngine.detect(this.entity,state).map(binding=>binding.capability);
    const dimmable=capabilities.includes('DIM');
    const kelvin=this.number(state.attributes.color_temp_kelvin);
    const minK=this.number(state.attributes.min_color_temp_kelvin)??2000,maxK=this.number(state.attributes.max_color_temp_kelvin)??6500;
    const tunable=capabilities.includes('COLOR_TEMP')&&maxK>minK;
    const colored=capabilities.some(capability=>['RGB','RGBW','RGBWW'].includes(capability));
    const rgb=triple(state.attributes.rgb_color);
    return html`
      <button class=${`power ${on?'on':''}`} ?disabled=${this.busy} @click=${()=>this.call(on?'turn_off':'turn_on')}>${mpIcon('power',18)}${on?tr('Éteindre'):tr('Allumer')}</button>
      ${dimmable?html`<label class="slider warm"><span>${mpIcon('sun',16)}</span><input type="range" min="1" max="100" .value=${String(percent??1)} aria-label=${tr('Luminosité')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('turn_on',{brightness_pct:Number((e.target as HTMLInputElement).value)})}><output>${percent===undefined?'—':tr('{n} %',{n:this.format(percent,0)})}</output></label>`:nothing}
      ${tunable?html`<label class="slider warm"><span>${mpIcon('thermo',16)}</span><input type="range" min=${String(Math.round(minK))} max=${String(Math.round(maxK))} step="50" .value=${String(Math.round(kelvin??(minK+maxK)/2))} aria-label=${tr('Température de couleur')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('turn_on',{color_temp_kelvin:Number((e.target as HTMLInputElement).value)})}><output>${kelvin===undefined?'—':tr('{n} K',{n:this.format(kelvin,0)})}</output></label>`:nothing}
      ${colored?html`<div class="colors" role="group" aria-label=${tr('Couleur')}>
        ${COLORS.map(([name,value])=>html`<button style=${`background:${hex(value)}`} title=${tr(name)} aria-label=${tr(name)} aria-pressed=${String(!!rgb&&hex(rgb)===hex(value))} ?disabled=${this.busy} @click=${()=>this.call('turn_on',{rgb_color:value})}></button>`)}
        <input type="color" .value=${rgb?hex(rgb):'#ffffff'} aria-label=${tr('Autre couleur')} title=${tr('Autre couleur')} ?disabled=${this.busy} @change=${(e:Event)=>{const value=fromHex((e.target as HTMLInputElement).value);if(value)void this.call('turn_on',{rgb_color:value});}}>
      </div>`:nothing}`;
  }

  /** Open, stop and close, the position when the cover takes one, and the angle of the slats of a blind that tilts. */
  private coverControls(state:HAState) {
    const percent=coverPosition(state),tilt=coverTilt(state);
    const commands=[['open_cover','Ouvrir le volet','Ouvrir','↑'],['stop_cover','Arrêter le volet','Arrêter','■'],['close_cover','Fermer le volet','Fermer#cover','↓']] as const satisfies readonly (readonly [CoverAction,MessageKey,MessageKey,string])[];
    return html`
      <div class="pair">${commands.map(([action,label,short,glyph])=>html`<button aria-label=${tr(label)} ?disabled=${this.busy||!canCover(state,action)} @click=${()=>this.call(action)}><span aria-hidden="true">${glyph}</span>${tr(short)}</button>`)}</div>
      ${canCover(state,'set_cover_position')?html`<label class="slider"><span>${mpIcon('shutter',16)}</span><input type="range" min="0" max="100" .value=${String(percent??50)} aria-label=${tr('Ouverture')} aria-valuetext=${percent===undefined?tr('Position actuelle inconnue'):tr('{n} % ouvert',{n:this.format(percent,0)})} ?disabled=${this.busy} @change=${(e:Event)=>this.call('set_cover_position',{position:Number((e.target as HTMLInputElement).value)})}><output>${percent===undefined?'—':tr('{n} %',{n:this.format(percent,0)})}</output></label>`:nothing}
      ${canCover(state,'set_cover_tilt_position')?html`<label class="slider" title=${tr('Inclinaison des lames')}><span>${mpIcon('sliders',16)}</span><input type="range" min="0" max="100" .value=${String(tilt??50)} aria-label=${tr('Inclinaison des lames')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('set_cover_tilt_position',{tilt_position:Number((e.target as HTMLInputElement).value)})}><output>${tilt===undefined?'—':tr('{n} %',{n:this.format(tilt,0)})}</output></label>`:nothing}`;
  }

  /** The setpoint, the modes the thermostat declares, and its comfort presets. */
  private climateControls(state:HAState) {
    const target=this.number(state.attributes.temperature),step=this.number(state.attributes.target_temp_step)??.5;
    const min=this.number(state.attributes.min_temp)??7,max=this.number(state.attributes.max_temp)??35;
    const modes=Array.isArray(state.attributes.hvac_modes)?state.attributes.hvac_modes.map(String):[];
    const presets=Array.isArray(state.attributes.preset_modes)?state.attributes.preset_modes.filter((p):p is string=>typeof p==='string'):[];
    const preset=String(state.attributes.preset_mode??'');
    const set=(next:number)=>this.call('set_temperature',{temperature:Math.round(Math.min(max,Math.max(min,next))/step)*step});
    return html`
      ${target===undefined?nothing:html`<div class="stepper">
        <button aria-label=${tr('Baisser la consigne')} ?disabled=${this.busy||target<=min} @click=${()=>set(target-step)}>${mpIcon('minus',18)}</button>
        <div class="target">${tr('{n} °',{n:this.format(target)})}<small>${tr('Consigne')}</small></div>
        <button aria-label=${tr('Monter la consigne')} ?disabled=${this.busy||target>=max} @click=${()=>set(target+step)}>${mpIcon('plus',18)}</button>
      </div>`}
      ${modes.length?html`<div class="modes" role="group" aria-label=${tr('Mode')}>${modes.map(mode=>html`<button data-mode=${mode} aria-pressed=${String(mode===state.state)} ?disabled=${this.busy} @click=${()=>this.call('set_hvac_mode',{hvac_mode:mode})}>${mpIcon(mode==='off'?'power':hvacIcon(mode),16)}${stateName(HVAC,mode)}</button>`)}</div>`:nothing}
      ${presets.length?html`<label class="pick">${tr('Préréglage')}<select aria-label=${tr('Préréglage')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('set_preset_mode',{preset_mode:(e.target as HTMLSelectElement).value})}>
        ${presets.includes(preset)?nothing:html`<option value="" selected disabled>—</option>`}
        ${presets.map(value=>html`<option value=${value} .selected=${value===preset}>${value}</option>`)}
      </select></label>`:nothing}`;
  }

  /** Previous, play or pause and next, the volume and its mute, and the source, each as far as the player offers it. */
  private mediaControls(state:HAState) {
    const on=mediaOn(state),playing=state.state==='playing',muted=state.attributes.is_volume_muted===true;
    const volume=mediaVolume(state),sources=Array.isArray(state.attributes.source_list)?state.attributes.source_list.filter((s):s is string=>typeof s==='string'):[];
    const toggle=playing?canMedia(state,'pause')?'media_pause':undefined:canMedia(state,'play')?'media_play':undefined;
    const power=canMedia(state,on?'turn_off':'turn_on');
    return html`
      ${power?html`<button class=${`power cool ${on?'on':''}`} ?disabled=${this.busy} @click=${()=>this.call(on?'turn_off':'turn_on')}>${mpIcon('power',18)}${on?tr('Éteindre'):tr('Allumer')}</button>`:nothing}
      ${canMedia(state,'previous_track')||toggle||canMedia(state,'next_track')?html`<div class="transport" role="group" aria-label=${tr('Lecture')}>
        ${canMedia(state,'previous_track')?html`<button aria-label=${tr('Piste précédente')} ?disabled=${this.busy} @click=${()=>this.call('media_previous_track')}>${mpIcon('previous',17)}</button>`:nothing}
        ${toggle?html`<button class="play" aria-label=${playing?tr('Pause'):tr('Lecture')} ?disabled=${this.busy} @click=${()=>this.call(toggle)}>${mpIcon(playing?'pause':'play',18)}</button>`:nothing}
        ${canMedia(state,'next_track')?html`<button aria-label=${tr('Piste suivante')} ?disabled=${this.busy} @click=${()=>this.call('media_next_track')}>${mpIcon('next',17)}</button>`:nothing}
      </div>`:nothing}
      ${canMedia(state,'volume_set')||canMedia(state,'volume_mute')?html`<div class="volume">
        ${canMedia(state,'volume_mute')?html`<button aria-label=${muted?tr('Rétablir le son'):tr('Couper le son')} aria-pressed=${String(muted)} ?disabled=${this.busy} @click=${()=>this.call('volume_mute',{is_volume_muted:!muted})}>${mpIcon(muted?'mute':'volume',17)}</button>`:html`<span>${mpIcon('volume',17)}</span>`}
        ${canMedia(state,'volume_set')?html`<input type="range" min="0" max="100" .value=${String(volume??0)} aria-label=${tr('Volume')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('volume_set',{volume_level:Number((e.target as HTMLInputElement).value)/100})}>`:html`<span></span>`}
        <output>${muted?tr('Muet'):volume===undefined?'—':tr('{n} %',{n:volume})}</output>
      </div>`:nothing}
      ${canMedia(state,'select_source')&&sources.length?html`<label class="pick">${tr('Source')}<select aria-label=${tr('Source')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('select_source',{source:(e.target as HTMLSelectElement).value})}>
        ${state.attributes.source&&sources.includes(String(state.attributes.source))?nothing:html`<option value="" selected disabled>—</option>`}
        ${sources.map(value=>html`<option value=${value} .selected=${value===String(state.attributes.source??'')}>${value}</option>`)}
      </select></label>`:nothing}`;
  }

  /** A switch, a fan or a siren: on and off, with the speed of a fan that declares one. A lock: locked or unlocked. */
  private plainControls(state:HAState) {
    const domain=domainOf(this.entity),on=state.state==='on';
    if(domain==='lock'){
      const locked=state.state==='locked';
      return html`<div class="pair">
        <button ?disabled=${this.busy||locked} @click=${()=>this.call('lock')}>${mpIcon('shield',17)}${tr('Verrouiller')}</button>
        <button ?disabled=${this.busy||state.state==='unlocked'} @click=${()=>this.call('unlock')}>${mpIcon('door',17)}${tr('Déverrouiller')}</button>
      </div>`;
    }
    const run=RUN_SERVICES[domain];
    if(run&&!TOGGLE_DOMAINS.includes(domain)) return html`<button class="power cool" ?disabled=${this.busy} @click=${()=>this.call(run)}>${mpIcon('play',17)}${tr('Activer')}</button>`;
    if(!TOGGLE_DOMAINS.includes(domain)) return nothing;
    const speed=domain==='fan'?this.number(state.attributes.percentage):undefined;
    return html`
      <button class=${`power cool ${on?'on':''}`} ?disabled=${this.busy} @click=${()=>this.call(on?'turn_off':'turn_on')}>${mpIcon('power',18)}${on?tr('Éteindre'):tr('Allumer')}</button>
      ${speed===undefined?nothing:html`<label class="slider"><span>${mpIcon('fan',16)}</span><input type="range" min="0" max="100" step="1" .value=${String(speed)} aria-label=${tr('Vitesse')} ?disabled=${this.busy} @change=${(e:Event)=>this.call('set_percentage',{percentage:Number((e.target as HTMLInputElement).value)})}><output>${tr('{n} %',{n:this.format(speed,0)})}</output></label>`}`;
  }

  /** The commands of the device, by what it is: nothing at all for a sensor, which is only read. */
  private controls(state:HAState) {
    switch(kindOf(this.entity,state)){
      case 'light': return domainOf(this.entity)==='light'?this.lightControls(state):this.plainControls(state);
      case 'cover': return this.coverControls(state);
      case 'climate': return this.climateControls(state);
      case 'media': return this.mediaControls(state);
      default: return this.plainControls(state);
    }
  }

  protected render() {
    const id=this.entity,state=this.state,ready=available(state);
    if(!id) return nothing;
    const name=String(state?.attributes.friendly_name??id);
    const kind=kindOf(id,state),on=ready&&state!.state==='on';
    const controls=ready?this.controls(state!):nothing;
    const rows=attributeRows(state),when=since(state);
    const detail=stateDetail(id,state);
    return html`<dialog aria-labelledby="mp-detail-title" @close=${this.closed} @cancel=${this.closed} @click=${this.backdrop}>
      <div class="sheet">
        <header>
          <span class=${`orb ${on&&['light','media','climate'].includes(kind)?'on':''}`}>${mpIcon(entityIcon(id,state),26)}</span>
          <div class="title"><small>${entityLabel(id)}</small><h2 id="mp-detail-title">${name}</h2></div>
          <button class="close" autofocus aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.close}>${mpIcon('close',18)}</button>
        </header>
        <div class="hero">
          <strong>${stateLabel(id,state)}</strong>
          ${detail?html`<small>${detail}</small>`:nothing}
          ${when?html`<span class="when">${when}</span>`:nothing}
        </div>
        ${ready?html`<div class="group">${controls}</div>`:html`<p class="error" role="status">${tr('Cet équipement ne répond pas pour le moment. Home Assistant le signale indisponible.')}</p>`}
        ${this.error?html`<p class="error" role="alert">${this.error}</p>`:nothing}
        <details>
          <summary>${tr('Détails techniques')}</summary>
          <dl>
            <dt>entity_id</dt><dd>${id}</dd>
            ${rows.map(row=>html`<dt>${row.name}</dt><dd>${row.value}</dd>`)}
          </dl>
        </details>
        <footer><button class="native" @click=${this.native}>${tr('Historique et réglages Home Assistant')}${mpIcon('arrow',16)}</button></footer>
      </div>
    </dialog>`;
  }
}
defineElement('mp-glass-detail',MPGlassDetail);
