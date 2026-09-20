import type { HAState } from '../shared/models';
import { available, brightnessPercent } from '../shared/capabilities';
import { coverPosition, coverStyle, finite, mediaIsTv, nowPlaying, type CoverStyle } from '../shared/spatial-state';
import { locale, tr } from './i18n';
import type { MessageKey } from './locales';
import type { MPIconName } from './icons';

/** What MP Nexus reads in an entity, whatever the integration behind it: the plan, the tiles and the detail window share this vocabulary. */
export type Kind = 'light'|'cover'|'climate'|'media'|'opening'|'motion'|'binary'|'temperature'|'humidity'|'sensor';
export const KIND_ICONS:Record<Kind,MPIconName>={light:'bulb',cover:'shutter',climate:'flame',media:'speaker',opening:'window',motion:'motion',binary:'gauge',temperature:'thermo',humidity:'drop',sensor:'gauge'};
export const MEDIA_STATES:Record<string,MessageKey>={playing:'Lecture',paused:'En pause',idle:'Allumé',on:'Allumé',off:'Éteint',standby:'En veille',buffering:'Chargement…'};
export const HVAC:Record<string,MessageKey>={off:'Arrêt',heat:'Chauffage',cool:'Climatisation',heat_cool:'Automatique',auto:'Automatique',dry:'Déshumidification',fan_only:'Ventilation'};
/** What a thermostat is doing, at a glance: a flame heats, a snowflake cools, a fan airs, a drop dries. */
const HVAC_ICONS:Record<string,MPIconName>={heat:'flame',cool:'snow',fan_only:'fan',dry:'drop',heat_cool:'thermo',auto:'thermo'};
export const hvacIcon=(mode?:string)=>(mode?HVAC_ICONS[mode]:undefined)??KIND_ICONS.climate;
export const COVER_STATES:Record<string,MessageKey>={opening:'Ouverture…',closing:'Fermeture…',closed:'Fermé',open:'Ouvert'};
const LOCK_STATES:Record<string,MessageKey>={locked:'Verrouillé',unlocked:'Déverrouillé',locking:'Verrouillage…',unlocking:'Déverrouillage…',jammed:'Bloqué'};
/** A state Home Assistant gives, named in the interface language when MP Nexus knows it. */
export const stateName=(names:Record<string,MessageKey>,state:string)=>{const key=names[state];return key?tr(key):state;};
/** The mode a thermostat is really in, read from the action it reports: a thermostat on auto and heating reads as heating. */
export const climateActionMode=(state?:HAState)=>{
  const action=String(state?.attributes.hvac_action??'');
  return ({heating:'heat',cooling:'cool',fan:'fan_only',drying:'dry'} as Record<string,string>)[action];
};
/** Domain of an entity id: what names the services it answers to. */
export const domainOf=(id:string)=>id.split('.')[0]??'';
export function kindOf(id:string,state?:HAState):Kind{
  const domain=domainOf(id),deviceClass=String(state?.attributes.device_class??''),unit=String(state?.attributes.unit_of_measurement??'');
  if(domain==='light')return 'light';
  if(domain==='cover')return 'cover';
  if(domain==='climate')return 'climate';
  if(domain==='media_player')return 'media';
  if(domain==='binary_sensor')return ['door','window','opening','garage_door'].includes(deviceClass)?'opening':['motion','occupancy','presence'].includes(deviceClass)?'motion':'binary';
  if(deviceClass==='temperature'||/°[CF]$/.test(unit))return 'temperature';
  if(deviceClass==='humidity')return 'humidity';
  return 'sensor';
}
/** Domains switched on and off through their own `turn_on` and `turn_off`, whatever else they offer. */
export const TOGGLE_DOMAINS=['switch','input_boolean','fan','humidifier','siren','automation','remote'];
/** Domains run once, with nothing to switch off afterwards: the service that runs them. */
export const RUN_SERVICES:Record<string,string>={scene:'turn_on',script:'turn_on',button:'press',input_button:'press'};
/** What the device is, under its name: never a guess at what it does, only the family Home Assistant puts it in. */
const DOMAIN_LABELS:Record<string,MessageKey>={
  light:'Éclairage',switch:'Interrupteur',input_boolean:'Bascule',cover:'Volet',climate:'Thermostat',water_heater:'Chauffe-eau',
  media_player:'Lecteur',lock:'Serrure',fan:'Ventilateur',humidifier:'Humidificateur',siren:'Sirène',vacuum:'Aspirateur',
  scene:'Scène',script:'Script',automation:'Automatisation',button:'Bouton',input_button:'Bouton',number:'Réglage',select:'Sélecteur',
  person:'Personne',device_tracker:'Localisation',weather:'Météo',remote:'Télécommande',
};
const COVER_ICONS:Record<CoverStyle,MPIconName>={outside:'shutter',inside:'shutter',curtain:'curtain'};
const DOMAIN_ICONS:Record<string,MPIconName>={switch:'power',input_boolean:'power',lock:'door',fan:'fan',humidifier:'drop',siren:'speaker',scene:'sparkle',script:'sliders',automation:'tune',button:'power',input_button:'power',number:'sliders',select:'sliders',person:'pin',device_tracker:'pin',weather:'sun',remote:'tune',vacuum:'tune',water_heater:'flame'};
/** The icon of an entity: what it is doing when it says so (a thermostat cooling, a television), else what it is. */
export function entityIcon(id:string,state?:HAState):MPIconName{
  const kind=kindOf(id,state);
  if(kind==='climate')return hvacIcon(climateActionMode(state)??state?.state);
  if(kind==='media')return mediaIsTv(state)?'tv':'speaker';
  if(kind==='cover')return COVER_ICONS[coverStyle(state)];
  return DOMAIN_ICONS[domainOf(id)]??KIND_ICONS[kind];
}
/** What the device is, for the line under its name; a domain MP Nexus does not know stays an unnamed device. */
export function entityLabel(id:string){
  const domain=domainOf(id),known=DOMAIN_LABELS[domain];
  return tr(known??(['sensor','binary_sensor'].includes(domain)?'Capteur':'Équipement'));
}
const format=(value:number,digits=1)=>new Intl.NumberFormat(locale(),{maximumFractionDigits:digits}).format(value);
/**
 * The state of an entity in a word or two, in the interface language: a light on or off, a shutter open, the mode of a
 * thermostat, what a player is doing, a reading with its unit. An unknown domain keeps the state Home Assistant gives.
 */
export function stateLabel(id:string,state?:HAState):string{
  if(!available(state))return tr('Indisponible');
  const domain=domainOf(id),kind=kindOf(id,state),on=state!.state==='on';
  if(kind==='light')return on?tr('Allumée'):tr('Éteinte');
  if(kind==='cover')return stateName(COVER_STATES,state!.state);
  if(kind==='climate')return stateName(HVAC,state!.state);
  if(kind==='media')return stateName(MEDIA_STATES,state!.state);
  if(kind==='opening')return on?tr('Ouverte'):tr('Fermée');
  if(kind==='motion')return on?tr('Présence détectée'):tr('Aucune présence');
  if(domain==='lock')return stateName(LOCK_STATES,state!.state);
  const reading=finite(state!.state),unit=String(state!.attributes.unit_of_measurement??'');
  if(reading!==undefined&&['temperature','humidity','sensor'].includes(kind))return `${format(reading)}${unit?` ${unit}`:''}`;
  if(['on','off'].includes(state!.state))return on?tr('Allumé'):tr('Éteint');
  return state!.state;
}
/** The line under the state: what a player plays, the setpoint of a thermostat, how far a shutter is open. */
export function stateDetail(id:string,state?:HAState):string{
  if(!available(state))return '';
  const kind=kindOf(id,state);
  if(kind==='climate'){
    const current=finite(state!.attributes.current_temperature),target=finite(state!.attributes.temperature);
    return [current===undefined?'':tr('mesurée {n} °',{n:format(current)}),target===undefined?'':tr('consigne {n} °',{n:format(target)})].filter(Boolean).join(' · ');
  }
  if(kind==='media'){const playing=nowPlaying(state);return playing&&['playing','paused'].includes(state!.state)?playing:'';}
  if(kind==='cover'){const percent=coverPosition(state);return percent===undefined?'':tr('{n} % ouvert',{n:format(percent,0)});}
  if(kind==='light'&&state!.state==='on'){const percent=brightnessPercent(state!.attributes.brightness);return percent===undefined?'':tr('{n} %',{n:format(percent,0)});}
  return '';
}
/** When Home Assistant last saw the state change, in words; nothing when it does not say. */
export function since(state?:HAState){
  const at=Date.parse(state?.last_changed??''),minutes=Math.round((Date.now()-at)/60_000);
  if(!Number.isFinite(minutes)||minutes<0)return undefined;
  if(minutes<1)return tr('Mis à jour à l’instant');
  const relative=new Intl.RelativeTimeFormat(locale(),{numeric:'auto'});
  return tr('Mis à jour {when}',{when:minutes<60?relative.format(-minutes,'minute'):minutes<1440?relative.format(-Math.round(minutes/60),'hour'):relative.format(-Math.round(minutes/1440),'day')});
}
/** Attributes the detail window shows itself, and those of no use to the person reading it. */
const SILENT=new Set(['friendly_name','icon','entity_picture','supported_features','supported_color_modes','color_mode','hvac_modes','preset_modes','fan_modes','swing_modes','source_list','sound_mode_list','editable','id','media_content_id','media_content_type','media_position_updated_at','entity_id']);
/** Every other attribute of the entity, in a form a person can read: what the window lists under its technical details. */
export function attributeRows(state?:HAState):{name:string;value:string}[]{
  if(!state)return [];
  return Object.entries(state.attributes)
    .filter(([name,value])=>!SILENT.has(name)&&value!==null&&value!==undefined&&value!=='')
    .map(([name,value])=>({name,value:attributeValue(value)}))
    .sort((a,b)=>a.name.localeCompare(b.name));
}
function attributeValue(value:unknown):string{
  if(typeof value==='boolean')return value?tr('Oui'):tr('Non');
  if(typeof value==='number')return format(value,3);
  if(Array.isArray(value))return value.map(item=>attributeValue(item)).join(', ');
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}
