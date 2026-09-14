import { examplePlan } from '../shared/spatial';
import '../frontend/index';
import { home } from '../tests/fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { defaultProject } from '../shared/project';
import type { Hass } from '../frontend/ha/client';
import type { MPGlassLight } from '../frontend/cards/light';
import type { MPGlassView } from '../frontend/view';
const snapshot = home();
const project = defaultProject('Maison de démonstration');
const spatial = new URLSearchParams(location.search).has('spatial');
if(spatial) {
  project.spatial=examplePlan();
  const rooms=project.spatial.floors[0]!.rooms;
  rooms[0]!.areaId='salon';
  rooms[0]!.entityIds=['light.circuit_0','sensor.salon_temperature','sensor.salon_humidity','cover.salon'];
  rooms[2]!.entityIds=['light.circuit_1','light.circuit_2'];
  rooms[3]!.entityIds=['climate.chambre','binary_sensor.chambre_fenetre'];
}
const calls: unknown[] = [];
const cards: MPGlassLight[] = [];
const hass: Hass = { connection:{},states:snapshot.states,language:'fr',user:{id:'demo',is_admin:true},callWS:async<T>()=>[] as T,callService:async(domain,service,data)=>{
  calls.push({domain,service,data});const states={...hass.states};
  for(const entityId of ([] as unknown[]).concat(data.entity_id).map(String)){const old=states[entityId]!;states[entityId]={...old,state:domain==='cover'?(service==='close_cover'?'closed':service==='stop_cover'?old.state:'open'):service==='turn_off'?'off':'on',attributes:{...old.attributes,...(domain==='cover'&&service!=='stop_cover'?{current_position:service==='close_cover'?0:service==='open_cover'?100:Number(data.position)}:{}),...('brightness_pct' in data?{brightness:Number(data.brightness_pct)*255/100}:{})}};}
  hass.states=states;
  for(const card of cards) card.hass={...hass};
  view.hass={...hass};
} };
const dashboard = MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot,project),project);
// Room sensors only exist on the plan demo, after composition, so the dashboard cards stay the same.
if(spatial) hass.states={...hass.states,
  'cover.salon':{entity_id:'cover.salon',state:'open',attributes:{friendly_name:'Salon · Volet baie',device_class:'shutter',current_position:65,supported_features:15}},
  'sensor.salon_temperature':{entity_id:'sensor.salon_temperature',state:'21.5',last_changed:new Date(Date.now()-4*60_000).toISOString(),attributes:{friendly_name:'Salon · Température',device_class:'temperature',unit_of_measurement:'°C'}},
  'sensor.salon_humidity':{entity_id:'sensor.salon_humidity',state:'46',last_changed:new Date(Date.now()-18*60_000).toISOString(),attributes:{friendly_name:'Salon · Humidité',device_class:'humidity',unit_of_measurement:'%'}},
  'climate.chambre':{entity_id:'climate.chambre',state:'heat',attributes:{friendly_name:'Chambre · Radiateur',current_temperature:19.5,temperature:20}},
  'binary_sensor.chambre_fenetre':{entity_id:'binary_sensor.chambre_fenetre',state:'off',attributes:{friendly_name:'Chambre · Fenêtre',device_class:'window'}},
};
for(const config of dashboard.views[0]!.cards) {
  const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config);card.hass={...hass};cards.push(card);
}
const view = document.querySelector('mp-glass-view-v4') as MPGlassView;
view.setConfig(dashboard.views[0]!);
view.cards=cards;
view.hass=hass;
Object.assign(window,{demo:{hass,cards,calls}});
