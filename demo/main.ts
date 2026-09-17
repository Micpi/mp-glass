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
const params = new URLSearchParams(location.search);
const spatial = params.has('spatial');
/** With ?spatial&floors, a house of three floors: a basement below the example floor and an upstairs above it. */
const floors = spatial && params.has('floors');
if(spatial) {
  project.spatial=examplePlan();
  const rooms=project.spatial.floors[0]!.rooms;
  rooms[0]!.areaId='salon';
  rooms[0]!.entityIds=['light.circuit_0','sensor.salon_temperature','sensor.salon_humidity','cover.salon'];
  rooms[2]!.entityIds=['light.circuit_1','light.circuit_2'];
  rooms[3]!.entityIds=['climate.chambre','binary_sensor.chambre_fenetre'];
  if(floors){
    const room=(id:string,name:string,x:number,z:number,w:number,d:number,entityIds?:string[])=>({id,name,polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]] as [number,number][],...(entityIds?{entityIds}:{})});
    project.spatial.floors.unshift({id:'basement',name:'Sous-sol',elevation:-2.4,height:2.2,rooms:[room('garage','Garage',0,0,7,8,['light.garage']),room('cellar','Cave',7,0,6,4),room('laundry','Buanderie',7,4,6,4,['light.buanderie'])]});
    project.spatial.floors.push({id:'upstairs',name:'Étage',elevation:2.6,height:2.5,rooms:[
      room('room-1','Suite parentale',0,0,6,4,['light.suite','sensor.suite_temperature']),room('room-2','Chambre Léo',6,0,4,4,['light.leo','sensor.leo_temperature']),
      room('room-3','Salle d’eau',10,0,3,4),room('room-4','Palier',0,4,6,4,['light.palier']),room('room-5','Bureau',6,4,7,4),
    ]});
  }
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
const light=(id:string,name:string,on=false)=>({entity_id:id,state:on?'on':'off',attributes:{friendly_name:name,supported_color_modes:['brightness'],brightness:200}});
const temperature=(id:string,name:string,value:string)=>({entity_id:id,state:value,attributes:{friendly_name:name,device_class:'temperature',unit_of_measurement:'°C'}});
if(floors) hass.states={...hass.states,
  'light.garage':light('light.garage','Garage · Néon'),'light.buanderie':light('light.buanderie','Buanderie · Plafonnier',true),
  'light.suite':light('light.suite','Suite parentale · Plafonnier',true),'light.leo':light('light.leo','Chambre Léo · Veilleuse'),'light.palier':light('light.palier','Palier · Applique',true),
  'sensor.suite_temperature':temperature('sensor.suite_temperature','Suite parentale · Température','19.2'),'sensor.leo_temperature':temperature('sensor.leo_temperature','Chambre Léo · Température','22.6'),
};
for(const config of dashboard.views[0]!.cards) {
  const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config);card.hass={...hass};cards.push(card);
}
const view = document.querySelector('mp-glass-view-v4') as MPGlassView;
view.setConfig(dashboard.views[0]!);
view.cards=cards;
view.hass=hass;
Object.assign(window,{demo:{hass,cards,calls}});
