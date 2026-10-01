import { examplePlan, type SpatialRoom } from '../shared/spatial';
import '../frontend/index';
import { home } from '../tests/fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { defaultProject } from '../shared/project';
import type { Hass } from '../frontend/ha/client';
import type { CardConfig, HAState } from '../shared/models';
import type { MPGlassLight } from '../frontend/cards/light';
import type { MPSpatialEditor } from '../frontend/spatial/editor';
import type { MPGlassLaundry } from '../frontend/cards/laundry';
import type { MPGlassView } from '../frontend/view';
const snapshot = home();
// The first light of the fixture also tunes its white and its colour, so the detail window shows what such a light offers.
const suspension = snapshot.states['light.circuit_0']!;
snapshot.states['light.circuit_0'] = { ...suspension, attributes: { ...suspension.attributes, supported_color_modes: ['color_temp', 'hs'], color_temp_kelvin: 2700, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, rgb_color: [255, 190, 120] } };
const params = new URLSearchParams(location.search);
const spatial = params.has('spatial');
const scenario = params.get('scenario') ?? 'residential';
const project = defaultProject(scenario === 'office' ? 'Bureau et magasin de démonstration' : scenario === 'yacht' ? 'Yacht de démonstration' : 'Maison de démonstration');
const laundryDemoEntities=['sensor.buanderie_washing_machine_cycle','sensor.buanderie_washing_machine_remaining_time','sensor.buanderie_washing_machine_program','sensor.buanderie_washing_machine_progress','sensor.buanderie_washing_machine_power','sensor.buanderie_washing_machine_energy','binary_sensor.buanderie_washing_machine_door'];
/** With ?spatial&floors, a house of three floors: a basement below the example floor and an upstairs above it. */
const floors = spatial && params.has('floors');
if(spatial && (scenario === 'office' || scenario === 'yacht')) {
  const room=(id:string,name:string,x:number,z:number,w:number,d:number,entityIds:string[]):SpatialRoom=>({id,name,polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]],entityIds});
  const office=scenario==='office';
  const names=office
    ? ['Boutique','Accueil','Réserve et lingerie','Bureau','Salle de réunion']
    : ['Carré','Cuisine','Cockpit','Cabine propriétaire','Cabine invités','Buanderie'];
  const ids=office
    ? ['office_shop','office_lobby','office_laundry','office_room','office_meeting']
    : ['yacht_saloon','yacht_galley','yacht_cockpit','yacht_owner','yacht_guest','yacht_laundry'];
  const first=office
    ? [room(ids[0]!,names[0]!,0,0,12,8,['light.demo_shop','cover.demo_shop','climate.demo_shop','sensor.demo_shop_temperature','sensor.demo_shop_humidity','binary_sensor.demo_shop_presence','binary_sensor.demo_shop_door','media_player.demo_signage']),room(ids[1]!,names[1]!,12,0,5,8,['light.demo_lobby','binary_sensor.demo_entry_door','binary_sensor.demo_lobby_presence']),room(ids[2]!,names[2]!,17,0,6,5,['light.demo_laundry','sensor.buanderie_washing_machine_cycle','sensor.demo_dryer_cycle','binary_sensor.demo_laundry_presence']),room(ids[3]!,names[3]!,17,5,6,5,['light.demo_office','climate.demo_office','sensor.demo_office_temperature']),room(ids[4]!,names[4]!,0,8,9,6,['light.demo_meeting','climate.demo_meeting','media_player.demo_meeting_screen','binary_sensor.demo_meeting_presence'])]
    : [room(ids[0]!,names[0]!,0,0,10,7,['light.demo_saloon','cover.demo_saloon','climate.demo_saloon','sensor.demo_saloon_temperature','sensor.demo_saloon_humidity','media_player.demo_saloon','binary_sensor.demo_saloon_hatch']),room(ids[1]!,names[1]!,10,0,6,7,['light.demo_galley','climate.demo_galley','sensor.demo_galley_temperature','binary_sensor.demo_galley_hatch','media_player.demo_galley']),room(ids[2]!,names[2]!,0,7,10,5,['light.demo_cockpit','cover.demo_cockpit','binary_sensor.demo_cockpit_presence','binary_sensor.demo_cockpit_door']),room(ids[3]!,names[3]!,0,0,7,5,['light.demo_owner','climate.demo_owner','sensor.demo_owner_temperature','binary_sensor.demo_owner_hatch']),room(ids[4]!,names[4]!,7,0,6,5,['light.demo_guest','climate.demo_guest','sensor.demo_guest_temperature','binary_sensor.demo_guest_hatch']),room(ids[5]!,names[5]!,13,0,5,5,['light.demo_yacht_laundry','sensor.buanderie_washing_machine_cycle','sensor.demo_dryer_cycle','binary_sensor.demo_laundry_presence'])];
  if(office){
    first[0]!.openings=[{id:'shop-front',kind:'french_window',name:'Vitrine et entrée',side:0,at:.5,width:3.2,entityIds:['cover.demo_shop','binary_sensor.demo_shop_door']}];
    first[0]!.media=[{id:'signage',kind:'tv',name:'Écran vitrine',at:[6,7.2],entityId:'media_player.demo_signage'}];
    first[2]!.laundry=[{id:'washer',kind:'washer',name:'Lave-linge',at:[18.5,3.5],entityId:'sensor.buanderie_washing_machine_cycle'},{id:'dryer',kind:'dryer',name:'Sèche-linge',at:[20,3.5],entityId:'sensor.demo_dryer_cycle'}];
    first[4]!.media=[{id:'meeting-screen',kind:'tv',name:'Écran de réunion',at:[4.5,13],entityId:'media_player.demo_meeting_screen'}];
    project.spatial={version:1,enabled:true,floors:[{id:'professional-main',name:'Espace commercial',elevation:0,height:3.1,rooms:first.slice(0,3)},{id:'professional-office',name:'Bureaux',elevation:3.1,height:2.8,rooms:first.slice(3)}]};
  } else {
    first[0]!.openings=[{id:'saloon-porthole',kind:'french_window',name:'Porte-fenêtre du carré',side:0,at:.5,width:2.2,entityIds:['cover.demo_saloon','binary_sensor.demo_saloon_hatch']}];
    first[0]!.media=[{id:'saloon-tv',kind:'tv',name:'Téléviseur du carré',at:[5,6.2],entityId:'media_player.demo_saloon'}];
    first[1]!.openings=[{id:'galley-porthole',kind:'window',name:'Hublot cuisine',side:0,at:.5,width:1,entityIds:['binary_sensor.demo_galley_hatch']}];
    first[1]!.media=[{id:'galley-speaker',kind:'speaker',name:'Enceinte',at:[14,6],entityId:'media_player.demo_galley'}];
    first[2]!.openings=[{id:'cockpit-door',kind:'door',name:'Accès intérieur',side:2,at:.5,width:.9,entityIds:['binary_sensor.demo_cockpit_door']}];
    first[5]!.laundry=[{id:'washer',kind:'washer',name:'Lave-linge',at:[14.5,3.5],entityId:'sensor.buanderie_washing_machine_cycle'},{id:'dryer',kind:'dryer',name:'Sèche-linge superposé',at:[14.5,3.5],stackedOn:'washer',entityId:'sensor.demo_dryer_cycle'}];
    project.spatial={version:1,enabled:true,floors:[{id:'yacht-main',name:'Pont principal',elevation:0,height:2.5,rooms:first.slice(0,3)},{id:'yacht-cabins',name:'Pont inférieur',elevation:-2.5,height:2.2,rooms:first.slice(3)}]};
  }
} else if(spatial) {
  project.spatial=examplePlan();
  const rooms=project.spatial.floors[0]!.rooms;
  rooms[0]!.areaId='salon';
  rooms[0]!.entityIds=['light.circuit_0','sensor.salon_temperature','sensor.salon_humidity','cover.salon','binary_sensor.salon_presence'];
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
    project.spatial.floors.unshift({id:'basement',name:'Sous-sol',elevation:-2.4,height:2.2,rooms:[room('garage','Garage',0,0,7,8,['light.garage']),room('cellar','Cave',7,0,6,4),room('laundry','Buanderie',7,4,6,4,['light.buanderie',...(params.has('laundry')?laundryDemoEntities:[])])]});
    if(params.has('laundry'))project.spatial.floors[0]!.rooms[2]!.laundry=[
      {id:'washer',kind:'washer',name:'Lave-linge',at:[8.2,6.3],entityId:'sensor.buanderie_washing_machine_cycle'},
      {id:'dryer',kind:'dryer',name:'Sèche-linge',at:[8.2,6.3],stackedOn:'washer',entityId:'sensor.buanderie_dryer_cycle'},
    ];
    project.spatial.floors.push({id:'upstairs',name:'Étage',elevation:2.6,height:2.5,rooms:[
      room('room-1','Suite parentale',0,0,6,4,['light.suite','sensor.suite_temperature']),room('room-2','Chambre Léo',6,0,4,4,['light.leo','sensor.leo_temperature']),
      room('room-3','Salle d’eau',10,0,3,4),room('room-4','Palier',0,4,6,4,['light.palier']),room('room-5','Bureau',6,4,7,4),
    ]});
  }
  // With ?spatial&houses, a domain: the house above becomes the main house, beside a guest house of one floor.
  if(params.has('houses')){
    const room=(id:string,name:string,x:number,z:number,w:number,d:number)=>({id,name,polygon:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]] as [number,number][]});
    project.spatial.buildings=[{id:'main',name:'Maison principale'},{id:'guest',name:'Maison d’amis'}];
    for(const floor of project.spatial.floors)floor.buildingId='main';
    project.spatial.floors.push({id:'guest-ground',name:'Rez-de-chaussée',elevation:0,height:2.5,buildingId:'guest',rooms:[room('guest-living','Séjour',0,0,6,5),room('guest-room','Chambre',6,0,4,5),room('guest-bath','Salle d’eau',6,5,4,2.5)]});
  }
}
const calls: unknown[] = [];
/** History requests the window made, so the browser tests can check the period asked for. */
const historyCalls: Record<string, unknown>[] = [];
const cards: Array<MPGlassLight | MPGlassLaundry> = [];
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
if (params.has('laundry')) hass.states = { ...hass.states,
  'sensor.buanderie_dryer_cycle':{entity_id:'sensor.buanderie_dryer_cycle',state:'idle',attributes:{friendly_name:'Buanderie · Sèche-linge · Cycle'}},
  'sensor.buanderie_washing_machine_cycle':{entity_id:'sensor.buanderie_washing_machine_cycle',state:'rinse',attributes:{friendly_name:'Buanderie · Lave-linge · Cycle'}},
  'sensor.buanderie_washing_machine_remaining_time':{entity_id:'sensor.buanderie_washing_machine_remaining_time',state:'00:38:00',attributes:{friendly_name:'Buanderie · Lave-linge · Temps restant',device_class:'duration',unit_of_measurement:'s'}},
  'sensor.buanderie_washing_machine_program':{entity_id:'sensor.buanderie_washing_machine_program',state:'Coton · couleurs',attributes:{friendly_name:'Buanderie · Lave-linge · Programme'}},
  'sensor.buanderie_washing_machine_progress':{entity_id:'sensor.buanderie_washing_machine_progress',state:'62',attributes:{friendly_name:'Buanderie · Lave-linge · Progression',unit_of_measurement:'%'}},
  'sensor.buanderie_washing_machine_power':{entity_id:'sensor.buanderie_washing_machine_power',state:'438',attributes:{friendly_name:'Buanderie · Lave-linge · Puissance',device_class:'power',unit_of_measurement:'W'}},
  'sensor.buanderie_washing_machine_energy':{entity_id:'sensor.buanderie_washing_machine_energy',state:'0.74',attributes:{friendly_name:'Buanderie · Lave-linge · Énergie',device_class:'energy',unit_of_measurement:'kWh'}},
  'binary_sensor.buanderie_washing_machine_door':{entity_id:'binary_sensor.buanderie_washing_machine_door',state:'off',attributes:{friendly_name:'Buanderie · Lave-linge · Hublot'}},
  'sensor.cellier_washing_machine_cycle':{entity_id:'sensor.cellier_washing_machine_cycle',state:'idle',attributes:{friendly_name:'Cellier · Lave-linge · Cycle'}},
  'sensor.cellier_washing_machine_program':{entity_id:'sensor.cellier_washing_machine_program',state:'Délicat',attributes:{friendly_name:'Cellier · Lave-linge · Programme'}},
};
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
  'binary_sensor.salon_presence':{entity_id:'binary_sensor.salon_presence',state:'on',attributes:{friendly_name:'Salon · Présence',device_class:'occupancy'}},
  // Play, pause, volume, mute, previous and next, on and off, source.
  'media_player.salon_tv':{entity_id:'media_player.salon_tv',state:'playing',attributes:{friendly_name:'Salon · Téléviseur',device_class:'tv',media_title:'Le Grand Bleu',app_name:'Netflix',volume_level:.32,is_volume_muted:false,source:'Netflix',source_list:['TV','HDMI 1','Netflix','YouTube'],supported_features:1|4|8|16|32|128|256|2048|16384}},
  'media_player.cuisine':{entity_id:'media_player.cuisine',state:'paused',attributes:{friendly_name:'Cuisine · Enceinte',device_class:'speaker',media_title:'So What',media_artist:'Miles Davis',volume_level:.2,is_volume_muted:false,supported_features:1|4|8|16|32|128|256|16384}},
};
const light=(id:string,name:string,on=false)=>({entity_id:id,state:on?'on':'off',attributes:{friendly_name:name,supported_color_modes:['brightness'],brightness:200}});
const temperature=(id:string,name:string,value:string)=>({entity_id:id,state:value,attributes:{friendly_name:name,device_class:'temperature',unit_of_measurement:'°C'}});
if(spatial&&(scenario==='office'||scenario==='yacht')) hass.states={...hass.states,
  'light.demo_shop':light('light.demo_shop','Boutique · Éclairage',true),'light.demo_lobby':light('light.demo_lobby','Accueil · Éclairage',true),'light.demo_laundry':light('light.demo_laundry','Lingerie · Éclairage'),'light.demo_office':light('light.demo_office','Bureau · Éclairage',true),'light.demo_meeting':light('light.demo_meeting','Réunion · Éclairage'),'light.demo_saloon':light('light.demo_saloon','Carré · Éclairage',true),'light.demo_galley':light('light.demo_galley','Cuisine · Éclairage',true),'light.demo_cockpit':light('light.demo_cockpit','Cockpit · Éclairage'),'light.demo_owner':light('light.demo_owner','Cabine propriétaire · Éclairage',true),'light.demo_guest':light('light.demo_guest','Cabine invités · Éclairage'),'light.demo_yacht_laundry':light('light.demo_yacht_laundry','Buanderie · Éclairage'),
  'cover.demo_shop':{entity_id:'cover.demo_shop',state:'open',attributes:{friendly_name:'Boutique · Store de vitrine',device_class:'blind',current_position:68,supported_features:15}},'cover.demo_saloon':{entity_id:'cover.demo_saloon',state:'closed',attributes:{friendly_name:'Carré · Stores',device_class:'curtain',current_position:25,supported_features:15}},'cover.demo_cockpit':{entity_id:'cover.demo_cockpit',state:'open',attributes:{friendly_name:'Cockpit · Taud',device_class:'awning',current_position:78,supported_features:15}},
  'climate.demo_shop':{entity_id:'climate.demo_shop',state:'cool',attributes:{friendly_name:'Boutique · Climatisation',current_temperature:24.7,temperature:22,hvac_action:'cooling',hvac_modes:['off','heat','cool','auto'],fan_modes:['auto','low','medium','high'],fan_mode:'auto',min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_office':{entity_id:'climate.demo_office',state:'heat',attributes:{friendly_name:'Bureau · Chauffage',current_temperature:20.1,temperature:21,hvac_action:'heating',hvac_modes:['off','heat','auto'],min_temp:7,max_temp:30,target_temp_step:.5}},'climate.demo_meeting':{entity_id:'climate.demo_meeting',state:'off',attributes:{friendly_name:'Réunion · Climatisation',current_temperature:21.8,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_saloon':{entity_id:'climate.demo_saloon',state:'cool',attributes:{friendly_name:'Carré · Climatisation',current_temperature:27.2,temperature:23,hvac_action:'cooling',hvac_modes:['off','heat','cool','auto'],fan_modes:['auto','low','high'],fan_mode:'low',min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_galley':{entity_id:'climate.demo_galley',state:'heat',attributes:{friendly_name:'Cuisine · Chauffage',current_temperature:19.4,temperature:20,hvac_action:'heating',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_owner':{entity_id:'climate.demo_owner',state:'auto',attributes:{friendly_name:'Cabine propriétaire · Climatisation',current_temperature:22.3,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_guest':{entity_id:'climate.demo_guest',state:'off',attributes:{friendly_name:'Cabine invités · Climatisation',current_temperature:21,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},
  'sensor.demo_shop_temperature':temperature('sensor.demo_shop_temperature','Boutique · Température','24.7'),'sensor.demo_shop_humidity':{entity_id:'sensor.demo_shop_humidity',state:'42',attributes:{friendly_name:'Boutique · Humidité',device_class:'humidity',unit_of_measurement:'%'}},'sensor.demo_office_temperature':temperature('sensor.demo_office_temperature','Bureau · Température','20.1'),'sensor.demo_saloon_temperature':temperature('sensor.demo_saloon_temperature','Carré · Température','27.2'),'sensor.demo_saloon_humidity':{entity_id:'sensor.demo_saloon_humidity',state:'63',attributes:{friendly_name:'Carré · Humidité',device_class:'humidity',unit_of_measurement:'%'}},'sensor.demo_galley_temperature':temperature('sensor.demo_galley_temperature','Cuisine · Température','19.4'),'sensor.demo_owner_temperature':temperature('sensor.demo_owner_temperature','Cabine propriétaire · Température','22.3'),'sensor.demo_guest_temperature':temperature('sensor.demo_guest_temperature','Cabine invités · Température','21.0'),
  'binary_sensor.demo_shop_presence':{entity_id:'binary_sensor.demo_shop_presence',state:'on',attributes:{friendly_name:'Boutique · Présence',device_class:'occupancy'}},'binary_sensor.demo_lobby_presence':{entity_id:'binary_sensor.demo_lobby_presence',state:'off',attributes:{friendly_name:'Accueil · Présence',device_class:'motion'}},'binary_sensor.demo_laundry_presence':{entity_id:'binary_sensor.demo_laundry_presence',state:'off',attributes:{friendly_name:'Lingerie · Présence',device_class:'motion'}},'binary_sensor.demo_meeting_presence':{entity_id:'binary_sensor.demo_meeting_presence',state:'on',attributes:{friendly_name:'Réunion · Présence',device_class:'occupancy'}},'binary_sensor.demo_entry_door':{entity_id:'binary_sensor.demo_entry_door',state:'off',attributes:{friendly_name:'Entrée · Porte',device_class:'door'}},'binary_sensor.demo_shop_door':{entity_id:'binary_sensor.demo_shop_door',state:'off',attributes:{friendly_name:'Vitrine · Porte',device_class:'door'}},
  'binary_sensor.demo_saloon_hatch':{entity_id:'binary_sensor.demo_saloon_hatch',state:'off',attributes:{friendly_name:'Carré · Porte-fenêtre',device_class:'opening'}},'binary_sensor.demo_galley_hatch':{entity_id:'binary_sensor.demo_galley_hatch',state:'off',attributes:{friendly_name:'Cuisine · Hublot',device_class:'window'}},'binary_sensor.demo_cockpit_presence':{entity_id:'binary_sensor.demo_cockpit_presence',state:'on',attributes:{friendly_name:'Cockpit · Présence',device_class:'presence'}},'binary_sensor.demo_cockpit_door':{entity_id:'binary_sensor.demo_cockpit_door',state:'off',attributes:{friendly_name:'Cockpit · Accès',device_class:'door'}},'binary_sensor.demo_owner_hatch':{entity_id:'binary_sensor.demo_owner_hatch',state:'off',attributes:{friendly_name:'Cabine propriétaire · Hublot',device_class:'window'}},'binary_sensor.demo_guest_hatch':{entity_id:'binary_sensor.demo_guest_hatch',state:'off',attributes:{friendly_name:'Cabine invités · Hublot',device_class:'window'}},
  'media_player.demo_signage':{entity_id:'media_player.demo_signage',state:'playing',attributes:{friendly_name:'Vitrine · Écran',device_class:'tv',media_title:'Bienvenue',volume_level:0,supported_features:1|4|8|16|32}},'media_player.demo_meeting_screen':{entity_id:'media_player.demo_meeting_screen',state:'paused',attributes:{friendly_name:'Réunion · Écran',device_class:'tv',media_title:'Présentation trimestrielle',volume_level:.15,is_volume_muted:false,supported_features:1|4|8|16|32|128}},'media_player.demo_saloon':{entity_id:'media_player.demo_saloon',state:'playing',attributes:{friendly_name:'Carré · Téléviseur',device_class:'tv',media_title:'Documentaire océan',volume_level:.24,is_volume_muted:false,supported_features:1|4|8|16|32|128}},'media_player.demo_galley':{entity_id:'media_player.demo_galley',state:'paused',attributes:{friendly_name:'Cuisine · Enceinte',device_class:'speaker',media_title:'Jazz à bord',media_artist:'Miles Davis',volume_level:.18,is_volume_muted:false,supported_features:1|4|8|16|32|128}},
  'sensor.buanderie_washing_machine_cycle':{entity_id:'sensor.buanderie_washing_machine_cycle',state:'rinse',attributes:{friendly_name:`${scenario==='office'?'Réserve et lingerie':'Buanderie'} · Lave-linge · Cycle`}},'sensor.demo_dryer_cycle':{entity_id:'sensor.demo_dryer_cycle',state:'drying',attributes:{friendly_name:`${scenario==='office'?'Réserve et lingerie':'Buanderie'} · Sèche-linge · Cycle`}},
};
if(floors) hass.states={...hass.states,
  'light.garage':light('light.garage','Garage · Néon'),'light.buanderie':light('light.buanderie','Buanderie · Plafonnier',true),
  'light.suite':light('light.suite','Suite parentale · Plafonnier',true),'light.leo':light('light.leo','Chambre Léo · Veilleuse'),'light.palier':light('light.palier','Palier · Applique',true),
  'sensor.suite_temperature':temperature('sensor.suite_temperature','Suite parentale · Température','19.2'),'sensor.leo_temperature':temperature('sensor.leo_temperature','Chambre Léo · Température','22.6'),
};
const selectedView = dashboard.views.find(candidate => candidate.path === location.pathname.split('/').filter(Boolean).at(-1)) ?? dashboard.views[0]!;
const viewCards: Array<{ type:string; entity?:string; name?:string }> = params.has('laundry')&&!spatial ? [{ type:'custom:mp-glass-laundry', name:'Buanderie' }] : selectedView.cards;
for(const config of viewCards) {
  if (config.type === 'custom:mp-glass-laundry') {
    const card=document.createElement('mp-glass-laundry') as MPGlassLaundry;card.setConfig(config);card.hass={...hass};cards.push(card);
  } else {
    const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config as CardConfig);card.hass={...hass};cards.push(card);
  }
}
const view = document.querySelector('mp-glass-view-v4') as MPGlassView;
if(spatial&&params.has('studio')){
  const editor=document.createElement('mp-spatial-editor') as MPSpatialEditor;
  editor.plan=project.spatial;editor.hass=hass;editor.areas=snapshot.areas;editor.floors=snapshot.floors;
  editor.devices=MPDiscoveryEngine.discover({...snapshot,states:hass.states},project).devices;
  editor.style.cssText='display:block;max-width:1500px;margin:auto;padding:24px';
  document.body.replaceChildren(editor);
} else if (params.has('laundry')&&!spatial) {
  const shell=document.createElement('main');
  shell.style.cssText='min-height:100vh;padding:clamp(20px,5vw,64px);display:grid;align-content:center;justify-items:center;gap:22px;background:radial-gradient(ellipse at 15% 10%,#29483f88,transparent 48%),radial-gradient(ellipse at 88% 80%,#28526966,transparent 44%),#10191b;color:#f2f5f1;font-family:Inter,system-ui,sans-serif';
  const heading=document.createElement('header');heading.style.cssText='width:min(100%,1100px);display:flex;align-items:end;justify-content:space-between;gap:20px';
  const title=document.createElement('div');title.innerHTML='<div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#a9c0b6">MP NEXUS · DÉMONSTRATION</div><h1 style="margin:9px 0 0;font:clamp(32px,5vw,52px)/1 Georgia,serif;font-weight:400">Buanderie</h1><p style="margin:10px 0 0;color:#b7c5c0;font-size:14px">Deux machines fictives · un cycle en cours · détection automatique</p>';
  heading.append(title);for(const card of cards) card.style.width='min(100%,1100px)';shell.append(heading,...cards);document.body.replaceChildren(shell);
} else {
  view.setConfig(selectedView);
  view.cards=cards;
  view.hass=hass;
}
Object.assign(window,{demo:{hass,cards,calls,history:historyCalls}});
