import { examplePlan } from '../shared/spatial';
import '../frontend/index';
import { home } from '../tests/fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { defaultProject } from '../shared/project';
import type { Hass } from '../frontend/ha/client';
import type { HAState } from '../shared/models';
import type { MPGlassLight } from '../frontend/cards/light';
import type { MPGlassView } from '../frontend/view';
const snapshot = home();
// The first light of the fixture also tunes its white and its colour, so the detail window shows what such a light offers.
const suspension = snapshot.states['light.circuit_0']!;
snapshot.states['light.circuit_0'] = { ...suspension, attributes: { ...suspension.attributes, supported_color_modes: ['color_temp', 'hs'], color_temp_kelvin: 2700, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, rgb_color: [255, 190, 120] } };
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
  rooms[2]!.entityIds=['light.circuit_1','light.circuit_2','climate.cuisine'];
  rooms[3]!.entityIds=['climate.chambre','binary_sensor.chambre_fenetre'];
  // Doors and windows with their shutters, blinds, curtains and sensors; a television and a speaker.
  rooms[0]!.openings=[{id:'baie',kind:'french_window',name:'Baie vitrée',side:0,at:.5,width:2.4,entityIds:['cover.salon','cover.salon_rideau']}];
  rooms[0]!.media=[{id:'tv',kind:'tv',at:[2.5,3.6],entityId:'media_player.salon_tv'}];
  rooms[2]!.openings=[{id:'fenetre',kind:'window',side:0,at:.5,width:1.2,entityIds:['cover.cuisine_store']}];
  rooms[2]!.media=[{id:'enceinte',kind:'speaker',at:[12.3,3.3],entityId:'media_player.cuisine'}];
  rooms[3]!.openings=[{id:'fenetre',kind:'window',side:2,at:.5,width:1.4,entityIds:['binary_sensor.chambre_fenetre','cover.chambre']}];
  rooms[4]!.openings=[{id:'porte',kind:'door',name:'Porte d’entrée',side:2,at:.5,width:1,entityIds:['binary_sensor.entree_porte']}];
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
/** History requests the window made, so the browser tests can check the period asked for. */
const historyCalls: Record<string, unknown>[] = [];
const cards: MPGlassLight[] = [];
/** What Home Assistant would report once a command is done, roughly: enough for the fixture to follow its own commands. */
function commanded(domain:string,service:string,data:Record<string,unknown>,old:HAState):HAState{
  const attributes={...old.attributes};
  if(domain==='cover'){
    if(service==='set_cover_tilt_position'){attributes.current_tilt_position=Number(data.tilt_position);return {...old,attributes};}
    if(service==='stop_cover')return old;
    attributes.current_position=service==='close_cover'?0:service==='open_cover'?100:Number(data.position);
    return {...old,state:attributes.current_position===0?'closed':'open',attributes};
  }
  if(domain==='media_player'){
    if(service==='volume_set')attributes.volume_level=Number(data.volume_level);
    if(service==='volume_mute')attributes.is_volume_muted=data.is_volume_muted===true;
    if(service==='select_source')attributes.source=String(data.source);
    const state=({turn_off:'off',turn_on:'idle',media_play:'playing',media_pause:'paused'} as Record<string,string>)[service]??old.state;
    return {...old,state,attributes};
  }
  if(domain==='climate'){
    if(service==='set_temperature')attributes.temperature=Number(data.temperature);
    if(service==='set_preset_mode')attributes.preset_mode=String(data.preset_mode);
    if(service==='set_fan_mode')attributes.fan_mode=String(data.fan_mode);
    if(service==='set_hvac_mode')return {...old,state:String(data.hvac_mode),attributes:{...attributes,hvac_action:({heat:'heating',cool:'cooling',dry:'drying',fan_only:'fan'} as Record<string,string>)[String(data.hvac_mode)]??'idle'}};
    return {...old,attributes};
  }
  if('brightness_pct' in data)attributes.brightness=Number(data.brightness_pct)*255/100;
  if('color_temp_kelvin' in data)attributes.color_temp_kelvin=Number(data.color_temp_kelvin);
  if('rgb_color' in data)attributes.rgb_color=data.rgb_color;
  return {...old,state:service==='turn_off'?'off':'on',attributes};
}
/** What a recorder would have kept over the period asked, compressed as Home Assistant compresses it (`s`, `a`, `lu`). */
function history(entityId:string,start:number,end:number){
  const state=hass.states[entityId];
  if(!state)return [];
  const span=Math.max(end-start,1),rows:Record<string,unknown>[]=[];
  const reading=Number(state.state),domain=entityId.split('.')[0];
  if(domain==='climate'){
    const current=Number(state.attributes.current_temperature)||20,target=Number(state.attributes.temperature)||20;
    for(let i=0;i<40;i++)rows.push({s:state.state,lu:(start+span*i/39)/1000,a:{current_temperature:Number((current+Math.sin(i/3)*.9).toFixed(1)),temperature:target}});
    return rows;
  }
  if(Number.isFinite(reading)&&domain==='sensor'){
    for(let i=0;i<48;i++)rows.push({s:(reading+Math.sin(i/4)*1.6+Math.cos(i/9)).toFixed(1),lu:(start+span*i/47)/1000});
    return [...rows,{s:state.state,lu:end/1000}];
  }
  const held=domain==='cover'?['open','closed']:domain==='media_player'?['playing','paused','off']:['on','off'];
  for(let i=0;i<9;i++)rows.push({s:held[i%held.length],lu:(start+span*i/9)/1000});
  return [...rows,{s:state.state,lu:(end-span/12)/1000}];
}
const hass: Hass = { connection:{},states:snapshot.states,language:'fr',user:{id:'demo',is_admin:true},callWS:async<T>(message:Record<string,unknown>)=>{
  if(message.type!=='history/history_during_period')return [] as T;
  historyCalls.push(message);
  const ids=Array.isArray(message.entity_ids)?message.entity_ids.map(entityId=>String(entityId)):[];
  const start=Date.parse(String(message.start_time)),end=Date.parse(String(message.end_time??''))||Date.now();
  return Object.fromEntries(ids.map(id=>[id,history(id,start,end)])) as T;
},callService:async(domain,service,data)=>{
  calls.push({domain,service,data});const states={...hass.states};
  for(const entityId of ([] as unknown[]).concat(data.entity_id).map(String))states[entityId]=commanded(domain,service,data,states[entityId]!);
  hass.states=states;
  for(const card of cards) card.hass={...hass};
  view.hass={...hass};
} };
const dashboard = MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot,project),project, false, undefined, undefined, __MP_GLASS_VERSION__);
// Room sensors only exist on the plan demo, after composition, so the dashboard cards stay the same.
if(spatial) hass.states={...hass.states,
  'cover.salon':{entity_id:'cover.salon',state:'open',attributes:{friendly_name:'Salon · Volet baie',device_class:'shutter',current_position:65,supported_features:15}},
  'sensor.salon_temperature':{entity_id:'sensor.salon_temperature',state:'21.5',last_changed:new Date(Date.now()-4*60_000).toISOString(),attributes:{friendly_name:'Salon · Température',device_class:'temperature',unit_of_measurement:'°C'}},
  'sensor.salon_humidity':{entity_id:'sensor.salon_humidity',state:'46',last_changed:new Date(Date.now()-18*60_000).toISOString(),attributes:{friendly_name:'Salon · Humidité',device_class:'humidity',unit_of_measurement:'%'}},
  'climate.chambre':{entity_id:'climate.chambre',state:'heat',attributes:{friendly_name:'Chambre · Radiateur',current_temperature:19.5,temperature:20,hvac_action:'heating',hvac_modes:['off','heat','auto'],min_temp:7,max_temp:30,target_temp_step:.5,preset_modes:['comfort','eco'],preset_mode:'comfort'}},
  'climate.cuisine':{entity_id:'climate.cuisine',state:'cool',attributes:{friendly_name:'Cuisine · Climatisation',current_temperature:26.8,temperature:24,hvac_action:'cooling',hvac_modes:['off','heat','cool','auto','fan_only'],fan_modes:['auto','low','medium','high'],fan_mode:'medium',preset_modes:['none','eco','schedule'],preset_mode:'none',min_temp:16,max_temp:32,target_temp_step:1}},
  'binary_sensor.chambre_fenetre':{entity_id:'binary_sensor.chambre_fenetre',state:'off',attributes:{friendly_name:'Chambre · Fenêtre',device_class:'window'}},
  'cover.salon_rideau':{entity_id:'cover.salon_rideau',state:'open',attributes:{friendly_name:'Salon · Rideau',device_class:'curtain',current_position:35,supported_features:15}},
  'cover.cuisine_store':{entity_id:'cover.cuisine_store',state:'open',attributes:{friendly_name:'Cuisine · Store',device_class:'blind',current_position:100,current_tilt_position:60,supported_features:15|128}},
  'cover.chambre':{entity_id:'cover.chambre',state:'closed',attributes:{friendly_name:'Chambre · Volet',device_class:'shutter',current_position:0,supported_features:15}},
  'binary_sensor.entree_porte':{entity_id:'binary_sensor.entree_porte',state:'off',attributes:{friendly_name:'Entrée · Porte',device_class:'door'}},
  // Play, pause, volume, mute, previous and next, on and off, source.
  'media_player.salon_tv':{entity_id:'media_player.salon_tv',state:'playing',attributes:{friendly_name:'Salon · Téléviseur',device_class:'tv',media_title:'Le Grand Bleu',app_name:'Netflix',volume_level:.32,is_volume_muted:false,source:'Netflix',source_list:['TV','HDMI 1','Netflix','YouTube'],supported_features:1|4|8|16|32|128|256|2048|16384}},
  'media_player.cuisine':{entity_id:'media_player.cuisine',state:'paused',attributes:{friendly_name:'Cuisine · Enceinte',device_class:'speaker',media_title:'So What',media_artist:'Miles Davis',volume_level:.2,is_volume_muted:false,supported_features:1|4|8|16|32|128|256|16384}},
};
const light=(id:string,name:string,on=false)=>({entity_id:id,state:on?'on':'off',attributes:{friendly_name:name,supported_color_modes:['brightness'],brightness:200}});
const temperature=(id:string,name:string,value:string)=>({entity_id:id,state:value,attributes:{friendly_name:name,device_class:'temperature',unit_of_measurement:'°C'}});
if(floors) hass.states={...hass.states,
  'light.garage':light('light.garage','Garage · Néon'),'light.buanderie':light('light.buanderie','Buanderie · Plafonnier',true),
  'light.suite':light('light.suite','Suite parentale · Plafonnier',true),'light.leo':light('light.leo','Chambre Léo · Veilleuse'),'light.palier':light('light.palier','Palier · Applique',true),
  'sensor.suite_temperature':temperature('sensor.suite_temperature','Suite parentale · Température','19.2'),'sensor.leo_temperature':temperature('sensor.leo_temperature','Chambre Léo · Température','22.6'),
};
const selectedView = dashboard.views.find(candidate => candidate.path === location.pathname.split('/').filter(Boolean).at(-1)) ?? dashboard.views[0]!;
for(const config of selectedView.cards) {
  const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config);card.hass={...hass};cards.push(card);
}
const view = document.querySelector('mp-glass-view-v4') as MPGlassView;
view.setConfig(selectedView);
view.cards=cards;
view.hass=hass;
Object.assign(window,{demo:{hass,cards,calls,history:historyCalls}});
