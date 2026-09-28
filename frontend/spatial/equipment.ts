import type { HAState } from '../../shared/models';
import { available, brightnessPercent } from '../../shared/capabilities';
import { laundryIsRunning, laundryRemaining } from '../../shared/laundry';
import { coverPosition, finite, nowPlaying } from '../../shared/spatial-state';
import { climateActionMode, HVAC, kindOf, stateLabel, stateName } from '../entities';
import { locale, tr } from '../i18n';
import type { MessageKey } from '../locales';

export interface EquipmentReading { label:string; value:string; entityId?:string }
/** A short, intentional summary: diagnostic entities and arbitrary HA attributes stay in the detail window. */
export function equipmentReadings(ids:string[],states:Record<string,HAState>,laundry=false,temperatureUnit='°C'):EquipmentReading[]{
  if(!ids.length)return [];
  const rows:EquipmentReading[]=[],format=(n:number)=>new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(n);
  const add=(label:MessageKey,value:string|undefined,entityId?:string)=>{if(value)rows.push({label:tr(label),value,entityId});};
  if(laundry){
    const entries=ids.map(id=>states[id]).filter((s):s is HAState=>available(s));
    if(!entries.length){add('État',tr('Indisponible'));return rows;}
    const find=(pattern:RegExp)=>entries.find(s=>pattern.test(s.entity_id+' '+String(s.attributes.friendly_name??'')));
    const status=entries.find(s=>/operation|cycle|status|phase|state|état|etat/i.test(s.entity_id+' '+String(s.attributes.friendly_name??''))&&!/progress/i.test(s.entity_id)),running=laundryIsRunning(states,ids);
    const phases:Record<string,MessageKey>={washing:'Lavage',wash:'Lavage',rinsing:'Rinçage',rinse:'Rinçage',spinning:'Essorage',spin:'Essorage',drying:'Séchage',paused:'En pause',finished:'Terminé',completed:'Terminé',complete:'Terminé',error:'À vérifier',fault:'À vérifier'};
    const phase=String(status?.state??'').toLowerCase().replaceAll('_',' ');
    add('Cycle',phases[phase]?tr(phases[phase]):tr(running?'Machine en cours':'Machine arrêtée'),status?.entity_id);
    const program=find(/program(?:me)?/i),programValue=program?.state??entries.find(s=>s.attributes.program)?.attributes.program;
    if(typeof programValue==='string'&&!['none','unknown','unavailable',''].includes(programValue.toLowerCase()))add('Programme du cycle',programValue,program?.entity_id);
    if(running||phase==='paused'){
      add('Temps restant du cycle',laundryRemaining(states,ids));
      const progress=find(/progress/i),value=finite(progress?.state??entries.find(s=>s.attributes.progress!==undefined)?.attributes.progress);
      if(value!==undefined&&value>=0&&value<=100)add('Progression du cycle',format(value)+' %',progress?.entity_id);
    }
    const door=find(/door|hublot|porte/i);if(door?.entity_id.startsWith('binary_sensor.')&&door.state==='on')add('Porte',tr('Ouverte'),door.entity_id);
    return rows;
  }
  for(const id of [...new Set(ids)]){
    const state=states[id],detected=kindOf(id,state),kind=detected==='binary'&&/door|hublot|porte/i.test(id+' '+String(state?.attributes.friendly_name??''))?'opening':detected;
    if(!['light','climate','temperature','humidity','media','cover','opening'].includes(kind))continue;
    const label:MessageKey=kind==='climate'?'Mode':kind==='temperature'?'Température':kind==='humidity'?'Humidité':'État';
    const name=ids.length>1?String(state?.attributes.friendly_name??tr(label)):tr(label);
    rows.push({label:name,value:kind==='opening'&&available(state)?tr(state!.state==='on'?'Ouverte':'Fermée'):stateLabel(id,state),entityId:id});
    if(!available(state))continue;
    const a=state!.attributes,on=state!.state!=='off';
    if(kind==='light'&&on){const brightness=brightnessPercent(a.brightness);if(brightness!==undefined)add('Luminosité',format(brightness)+' %',id);}
    if(kind==='climate'){
      const current=finite(a.current_temperature),target=finite(a.temperature),low=finite(a.target_temp_low),high=finite(a.target_temp_high);
      if(current!==undefined)add('Température',format(current)+' '+temperatureUnit,id);
      if(on){if(target!==undefined)add('Consigne',format(target)+' '+temperatureUnit,id);else if(low!==undefined&&high!==undefined)add('Consigne',format(low)+'–'+format(high)+' '+temperatureUnit,id);}
      const action=climateActionMode(state);if(on&&action&&action!==state!.state)add('Activité',stateName(HVAC,action),id);
    }
    if(kind==='cover'){const position=coverPosition(state);if(position!==undefined&&position>0&&position<100)add('Ouverture',format(position)+' %',id);}
    if(kind==='media'&&['playing','paused','buffering'].includes(state!.state)){
      add('À l’affiche',nowPlaying(state),id);
      const volume=finite(a.volume_level);if(volume!==undefined)add('Volume',a.is_volume_muted?tr('Son coupé'):format(volume*100)+' %',id);
    }
  }
  return rows;
}
