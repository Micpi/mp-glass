import { examplePlan } from '../shared/spatial';
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
import type { MPNexusView } from '../frontend/v2/view';
import { officeDemoPlan, officeShadeFixtures, yachtDemoPlan } from './scenarios';
import officeBackground from './assets/backgrounds/office.webp';
import yachtBackground from './assets/backgrounds/yacht.webp';
const snapshot = home();
// The first light of the fixture also tunes its white and its colour, so the detail window shows what such a light offers.
const suspension = snapshot.states['light.circuit_0']!;
snapshot.states['light.circuit_0'] = { ...suspension, attributes: { ...suspension.attributes, supported_color_modes: ['color_temp', 'hs'], color_temp_kelvin: 2700, min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500, rgb_color: [255, 190, 120] } };
const params = new URLSearchParams(location.search);
const spatial = params.has('spatial');
const scenario = params.get('scenario') ?? 'residential';
const project = defaultProject(scenario === 'office' ? 'Bureau et magasin de démonstration' : scenario === 'yacht' ? 'Yacht de démonstration' : 'Maison de démonstration');
/** With ?v2, the MP Nexus v2 interface. */
if (params.has('v2')) project.interface = { version: 2 };
const laundryDemoEntities=['sensor.buanderie_washing_machine_cycle','sensor.buanderie_washing_machine_remaining_time','sensor.buanderie_washing_machine_program','sensor.buanderie_washing_machine_progress','sensor.buanderie_washing_machine_power','sensor.buanderie_washing_machine_energy','binary_sensor.buanderie_washing_machine_door'];
/** With ?spatial&floors, a house of three floors: a basement below the example floor and an upstairs above it. */
const floors = spatial && params.has('floors');
if(spatial && scenario==='office') project.spatial=officeDemoPlan();
else if(spatial && scenario==='yacht') project.spatial=yachtDemoPlan();
else if(spatial) {
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
    if(service==='shuffle_set')attributes.shuffle=data.shuffle===true;
    if(service==='repeat_set')attributes.repeat=String(data.repeat);
    if(service==='media_play_pause')return {...old,state:old.state==='playing'?'paused':'playing',attributes};
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
  'light.demo_shop':light('light.demo_shop','Boutique · Éclairage',true),'light.demo_lobby':light('light.demo_lobby',scenario==='yacht'?'Timonerie · Éclairage':'Accueil · Éclairage',true),'light.demo_laundry':light('light.demo_laundry','Lingerie · Éclairage'),'light.demo_office':light('light.demo_office','Bureau · Éclairage',true),'light.demo_meeting':light('light.demo_meeting','Réunion · Éclairage'),'light.demo_saloon':light('light.demo_saloon','Carré · Éclairage',true),'light.demo_galley':light('light.demo_galley',scenario==='yacht'?'Office · Éclairage':'Cuisine · Éclairage',true),'light.demo_cockpit':light('light.demo_cockpit','Cockpit · Éclairage'),'light.demo_owner':light('light.demo_owner',scenario==='yacht'?'Cabine armateur · Éclairage':'Cabine propriétaire · Éclairage',true),'light.demo_guest':light('light.demo_guest','Cabine invités bâbord · Éclairage'),'light.demo_yacht_laundry':light('light.demo_yacht_laundry','Local technique · Éclairage'),
  'cover.demo_shop':{entity_id:'cover.demo_shop',state:'open',attributes:{friendly_name:'Boutique · Store de vitrine',device_class:'blind',current_position:68,supported_features:15}},'cover.demo_saloon':{entity_id:'cover.demo_saloon',state:'closed',attributes:{friendly_name:'Carré · Stores',device_class:'curtain',current_position:25,supported_features:15}},'cover.demo_cockpit':{entity_id:'cover.demo_cockpit',state:'open',attributes:{friendly_name:'Cockpit · Taud',device_class:'awning',current_position:78,supported_features:15}},
  'climate.demo_shop':{entity_id:'climate.demo_shop',state:'cool',attributes:{friendly_name:'Boutique · Climatisation',current_temperature:24.7,temperature:22,hvac_action:'cooling',hvac_modes:['off','heat','cool','auto'],fan_modes:['auto','low','medium','high'],fan_mode:'auto',min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_office':{entity_id:'climate.demo_office',state:'heat',attributes:{friendly_name:scenario==='yacht'?'Timonerie · Chauffage':'Bureau · Chauffage',current_temperature:20.1,temperature:21,hvac_action:'heating',hvac_modes:['off','heat','auto'],min_temp:7,max_temp:30,target_temp_step:.5}},'climate.demo_meeting':{entity_id:'climate.demo_meeting',state:'off',attributes:{friendly_name:'Réunion · Climatisation',current_temperature:21.8,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_saloon':{entity_id:'climate.demo_saloon',state:'cool',attributes:{friendly_name:'Carré · Climatisation',current_temperature:27.2,temperature:23,hvac_action:'cooling',hvac_modes:['off','heat','cool','auto'],fan_modes:['auto','low','high'],fan_mode:'low',min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_galley':{entity_id:'climate.demo_galley',state:'heat',attributes:{friendly_name:scenario==='yacht'?'Office · Chauffage':'Cuisine · Chauffage',current_temperature:19.4,temperature:20,hvac_action:'heating',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_owner':{entity_id:'climate.demo_owner',state:'auto',attributes:{friendly_name:scenario==='yacht'?'Cabine armateur · Climatisation':'Cabine propriétaire · Climatisation',current_temperature:22.3,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},'climate.demo_guest':{entity_id:'climate.demo_guest',state:'off',attributes:{friendly_name:'Cabine invités bâbord · Climatisation',current_temperature:21,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},
  'sensor.demo_shop_temperature':temperature('sensor.demo_shop_temperature','Boutique · Température','24.7'),'sensor.demo_shop_humidity':{entity_id:'sensor.demo_shop_humidity',state:'42',attributes:{friendly_name:'Boutique · Humidité',device_class:'humidity',unit_of_measurement:'%'}},'sensor.demo_office_temperature':temperature('sensor.demo_office_temperature',scenario==='yacht'?'Timonerie · Température':'Bureau · Température','20.1'),'sensor.demo_saloon_temperature':temperature('sensor.demo_saloon_temperature','Carré · Température','27.2'),'sensor.demo_saloon_humidity':{entity_id:'sensor.demo_saloon_humidity',state:'63',attributes:{friendly_name:'Carré · Hygrométrie',device_class:'humidity',unit_of_measurement:'%'}},'sensor.demo_galley_temperature':temperature('sensor.demo_galley_temperature',scenario==='yacht'?'Office · Température':'Cuisine · Température','19.4'),'sensor.demo_owner_temperature':temperature('sensor.demo_owner_temperature',scenario==='yacht'?'Cabine armateur · Température':'Cabine propriétaire · Température','22.3'),'sensor.demo_guest_temperature':temperature('sensor.demo_guest_temperature','Cabine invités bâbord · Température','21.0'),
  'binary_sensor.demo_shop_presence':{entity_id:'binary_sensor.demo_shop_presence',state:'on',attributes:{friendly_name:'Boutique · Présence',device_class:'occupancy'}},'binary_sensor.demo_lobby_presence':{entity_id:'binary_sensor.demo_lobby_presence',state:'off',attributes:{friendly_name:'Accueil · Présence',device_class:'motion'}},'binary_sensor.demo_laundry_presence':{entity_id:'binary_sensor.demo_laundry_presence',state:'off',attributes:{friendly_name:'Lingerie · Présence',device_class:'motion'}},'binary_sensor.demo_meeting_presence':{entity_id:'binary_sensor.demo_meeting_presence',state:'on',attributes:{friendly_name:'Réunion · Présence',device_class:'occupancy'}},'binary_sensor.demo_entry_door':{entity_id:'binary_sensor.demo_entry_door',state:'off',attributes:{friendly_name:'Entrée · Porte',device_class:'door'}},'binary_sensor.demo_shop_door':{entity_id:'binary_sensor.demo_shop_door',state:'off',attributes:{friendly_name:'Vitrine · Porte',device_class:'door'}},
  'binary_sensor.demo_saloon_hatch':{entity_id:'binary_sensor.demo_saloon_hatch',state:'off',attributes:{friendly_name:'Carré · Accès au cockpit',device_class:'opening'}},'binary_sensor.demo_galley_hatch':{entity_id:'binary_sensor.demo_galley_hatch',state:'off',attributes:{friendly_name:scenario==='yacht'?'Office · Hublot':'Cuisine · Hublot',device_class:'window'}},'binary_sensor.demo_cockpit_presence':{entity_id:'binary_sensor.demo_cockpit_presence',state:'on',attributes:{friendly_name:'Cockpit · Présence',device_class:'presence'}},'binary_sensor.demo_cockpit_door':{entity_id:'binary_sensor.demo_cockpit_door',state:'off',attributes:{friendly_name:'Cockpit · Accès à la plage arrière',device_class:'door'}},'binary_sensor.demo_owner_hatch':{entity_id:'binary_sensor.demo_owner_hatch',state:'off',attributes:{friendly_name:scenario==='yacht'?'Cabine armateur · Hublot':'Cabine propriétaire · Hublot',device_class:'window'}},'binary_sensor.demo_guest_hatch':{entity_id:'binary_sensor.demo_guest_hatch',state:'off',attributes:{friendly_name:'Cabine invités bâbord · Hublot',device_class:'window'}},
  'media_player.demo_signage':{entity_id:'media_player.demo_signage',state:'playing',attributes:{friendly_name:'Vitrine · Écran',device_class:'tv',media_title:'Bienvenue',volume_level:0,supported_features:1|4|8|16|32}},'media_player.demo_meeting_screen':{entity_id:'media_player.demo_meeting_screen',state:'paused',attributes:{friendly_name:'Réunion · Écran',device_class:'tv',media_title:'Présentation trimestrielle',volume_level:.15,is_volume_muted:false,supported_features:1|4|8|16|32|128}},'media_player.demo_saloon':{entity_id:'media_player.demo_saloon',state:'playing',attributes:{friendly_name:'Carré · Téléviseur',device_class:'tv',media_title:'Documentaire océan',volume_level:.24,is_volume_muted:false,supported_features:1|4|8|16|32|128}},'media_player.demo_galley':{entity_id:'media_player.demo_galley',state:'paused',attributes:{friendly_name:scenario==='yacht'?'Office · Enceinte':'Cuisine · Enceinte',device_class:'speaker',media_title:'Jazz à bord',media_artist:'Miles Davis',volume_level:.18,is_volume_muted:false,supported_features:1|4|8|16|32|128}},
  'sensor.buanderie_washing_machine_cycle':{entity_id:'sensor.buanderie_washing_machine_cycle',state:'rinse',attributes:{friendly_name:`${scenario==='office'?'Réserve et lingerie':'Buanderie'} · Lave-linge · Cycle`}},'sensor.demo_dryer_cycle':{entity_id:'sensor.demo_dryer_cycle',state:'drying',attributes:{friendly_name:`${scenario==='office'?'Réserve et lingerie':'Buanderie'} · Sèche-linge · Cycle`}},
};
if(spatial&&scenario==='office'&&project.spatial){
  const states:Record<string,HAState>={...hass.states};
  const rooms=project.spatial.floors.flatMap(level=>level.rooms),roomNames=new Map(rooms.map(space=>[space.id,space.name]));
  const entityRooms=new Map(rooms.flatMap(space=>(space.entityIds??[]).map(id=>[id,space.name] as const)));
  for(const shade of officeShadeFixtures){
    const state=shade.position===0?'closed':shade.position===100?'open':'open';
    states[shade.id]={entity_id:shade.id,state,attributes:{friendly_name:`${roomNames.get(shade.roomId)} · ${shade.name}`,device_class:shade.deviceClass,current_position:shade.position,supported_features:shade.deviceClass==='blind'?15|128:15,...(shade.tilt===undefined?{}:{current_tilt_position:shade.tilt})}};
  }
  for(const [id,roomName] of entityRooms){
    if(states[id])continue;
    if(id.startsWith('light.'))states[id]=light(id,`${roomName} · Éclairage`,id.endsWith('open_space')||id.endsWith('board'));
    else if(id.startsWith('climate.'))states[id]={entity_id:id,state:'heat',attributes:{friendly_name:`${roomName} · Climatisation`,current_temperature:21.4,temperature:21,hvac_action:'heating',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:.5}};
    else if(id.startsWith('sensor.')&&id.endsWith('_humidity'))states[id]={entity_id:id,state:'46',attributes:{friendly_name:`${roomName} · Humidité`,device_class:'humidity',unit_of_measurement:'%'}};
    else if(id.startsWith('sensor.')&&id.endsWith('_temperature'))states[id]=temperature(id,`${roomName} · Température`,'21.4');
    else if(id.startsWith('media_player.'))states[id]={entity_id:id,state:'paused',attributes:{friendly_name:`${roomName} · Écran`,device_class:'tv',media_title:'Présentation commerciale',volume_level:.12,supported_features:1|4|8|16|32|128}};
  }
  hass.states=states;
}
if(spatial&&scenario==='yacht') hass.states={...hass.states,
  'light.demo_guest_starboard':light('light.demo_guest_starboard','Cabine invités tribord · Éclairage',true),
  'climate.demo_guest_starboard':{entity_id:'climate.demo_guest_starboard',state:'auto',attributes:{friendly_name:'Cabine invités tribord · Climatisation',current_temperature:21.6,temperature:22,hvac_action:'idle',hvac_modes:['off','heat','cool','auto'],min_temp:16,max_temp:30,target_temp_step:1}},
  'sensor.demo_guest_starboard_temperature':temperature('sensor.demo_guest_starboard_temperature','Cabine invités tribord · Température','21.6'),
  'binary_sensor.demo_guest_starboard_hatch':{entity_id:'binary_sensor.demo_guest_starboard_hatch',state:'off',attributes:{friendly_name:'Cabine invités tribord · Hublot',device_class:'window'}},
  'light.demo_sundeck':light('light.demo_sundeck','Pont soleil · Éclairage',true),
  'climate.demo_sundeck':{entity_id:'climate.demo_sundeck',state:'cool',attributes:{friendly_name:'Salon extérieur · Climatisation',current_temperature:25.6,temperature:23,hvac_action:'cooling',hvac_modes:['off','cool','auto'],min_temp:18,max_temp:30,target_temp_step:1}},
  'cover.demo_sundeck':{entity_id:'cover.demo_sundeck',state:'open',attributes:{friendly_name:'Salon extérieur · Bimini',device_class:'awning',current_position:72,supported_features:15}},
  'binary_sensor.demo_sundeck_presence':{entity_id:'binary_sensor.demo_sundeck_presence',state:'on',attributes:{friendly_name:'Pont soleil · Présence',device_class:'occupancy'}},
  'media_player.demo_sundeck':{entity_id:'media_player.demo_sundeck',state:'paused',attributes:{friendly_name:'Salon extérieur · Enceinte',device_class:'speaker',media_title:'Ambiance au mouillage',volume_level:.18,is_volume_muted:false,supported_features:1|4|8|16|32|128}},
  'switch.demo_jacuzzi':{entity_id:'switch.demo_jacuzzi',state:'on',attributes:{friendly_name:'Jacuzzi · Chauffage'}},
  'sensor.demo_jacuzzi_temperature':{entity_id:'sensor.demo_jacuzzi_temperature',state:'37.5',attributes:{friendly_name:'Jacuzzi · Température',device_class:'temperature',unit_of_measurement:'°C'}},
  'light.demo_garage':light('light.demo_garage','Garage à annexe · Éclairage'),
  'cover.demo_garage':{entity_id:'cover.demo_garage',state:'closed',attributes:{friendly_name:'Garage à annexe · Porte',device_class:'garage',current_position:0,supported_features:15}},
  'light.demo_engine_room':light('light.demo_engine_room','Salle des machines · Éclairage',true),
  'sensor.demo_engine_room_temperature':temperature('sensor.demo_engine_room_temperature','Salle des machines · Température','31.4'),
  'binary_sensor.demo_engine_alarm':{entity_id:'binary_sensor.demo_engine_alarm',state:'off',attributes:{friendly_name:'Salle des machines · Alarme',device_class:'problem'}},
};
if(floors) hass.states={...hass.states,
  'light.garage':light('light.garage','Garage · Néon'),'light.buanderie':light('light.buanderie','Buanderie · Plafonnier',true),
  'light.suite':light('light.suite','Suite parentale · Plafonnier',true),'light.leo':light('light.leo','Chambre Léo · Veilleuse'),'light.palier':light('light.palier','Palier · Applique',true),
  'sensor.suite_temperature':temperature('sensor.suite_temperature','Suite parentale · Température','19.2'),'sensor.leo_temperature':temperature('sensor.leo_temperature','Chambre Léo · Température','22.6'),
};
const selectedView = dashboard.views.find(candidate => candidate.path === location.pathname.split('/').filter(Boolean).at(-1)) ?? dashboard.views[0]!;
if(scenario==='yacht'){
  const vocabulary:Record<string,string>={
    'Boutique':'Shop','Timonerie':'Bridge','Accueil':'Lobby','Lingerie':'Laundry','Local technique':'Laundry','Bureau':'Ship’s office','Réunion':'Dining Room','Carré':'Main Salon','Office':'Galley','Cockpit':'Aft Deck','Cabine armateur':'Owner’s Suite','Cabine invités bâbord':'Port Guest Suite','Cabine invités tribord':'Starboard Guest Suite','Pont soleil':'Sun Deck','Salon extérieur':'Sun Lounge','Garage à annexe':'Tender Garage','Salle des machines':'Engine Room','Buanderie':'Laundry','Entrée':'Main Lobby','Vitrine':'Shop',
    'Éclairage':'Lighting','Chauffage':'Heating','Climatisation':'Air conditioning','Température':'Temperature','Hygrométrie':'Humidity','Humidité':'Humidity','Stores':'Shades','Taud':'Awning','Présence':'Occupancy','Porte':'Door','Hublot':'Porthole','Téléviseur':'Television','Enceinte':'Speaker','Écran':'Display','Accès au cockpit':'Aft deck access','Accès à la plage arrière':'Swim platform access','Lave-linge':'Washing machine','Sèche-linge':'Dryer','Cycle':'Cycle','Alarme':'Alarm',
  };
  hass.states=Object.fromEntries(Object.entries(hass.states).map(([id,state])=>[id,{...state,attributes:{...state.attributes,friendly_name:String(state.attributes.friendly_name??id).split(' · ').map(part=>vocabulary[part]??part).join(' · ')}}]));
}
const viewCards: Array<{ type:string; entity?:string; name?:string }> = params.has('laundry')&&!spatial ? [{ type:'custom:mp-glass-laundry', name:'Buanderie' }] : selectedView.cards;
for(const config of viewCards) {
  if (config.type === 'custom:mp-glass-laundry') {
    const card=document.createElement('mp-glass-laundry') as MPGlassLaundry;card.setConfig(config);card.hass={...hass};cards.push(card);
  } else {
    const card=document.createElement(config.type.replace('custom:','')) as MPGlassLight;card.setConfig(config as CardConfig);card.hass={...hass};cards.push(card);
  }
}
let view = document.querySelector('mp-glass-view-v4') as MPGlassView | MPNexusView;
if (params.has('v2')) { const nexus = document.createElement('mp-nexus-view-v2') as MPNexusView; view.replaceWith(nexus); view = nexus; }
// MP Nexus v2 shows what the players of a real house offer: a speaker grouped with the kitchen, a library to browse, the TV's remote.
if (params.has('v2') && spatial) {
  const art=(a:string,b:string)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><circle cx="3" cy="3" r="2.4" fill="#fff" opacity=".18"/></svg>`)}`;
  const all=1|2|4|8|16|32|128|256|512|2048|16384|32768|131072|262144|524288;
  hass.states={...hass.states,
    'media_player.salon_sonos':{entity_id:'media_player.salon_sonos',state:'playing',attributes:{friendly_name:'Salon · Sonos Arc',device_class:'speaker',media_title:'Nuits d’été',media_artist:'Lumen Drift',app_name:'Spotify',source:'Spotify',source_list:['Spotify','Radio France','TV','Ligne'],entity_picture:art('#ffb46b','#c14d7a'),media_duration:214,media_position:64,media_position_updated_at:new Date().toISOString(),shuffle:false,repeat:'all',volume_level:.32,is_volume_muted:false,group_members:['media_player.salon_sonos','media_player.cuisine'],supported_features:all}},
    'media_player.cuisine':{...hass.states['media_player.cuisine']!,state:'playing',attributes:{...hass.states['media_player.cuisine']!.attributes,friendly_name:'Cuisine · Era 100',media_title:'Nuits d’été',media_artist:'Lumen Drift',volume_level:.24,group_members:['media_player.salon_sonos','media_player.cuisine'],supported_features:all}},
    'media_player.terrasse':{entity_id:'media_player.terrasse',state:'idle',attributes:{friendly_name:'Terrasse · Enceinte',device_class:'speaker',volume_level:.4,supported_features:all}},
    'remote.salon_tv':{entity_id:'remote.salon_tv',state:'on',attributes:{friendly_name:'Salon · Téléviseur'}},
  };
  hass.entities={'media_player.salon_tv':{entity_id:'media_player.salon_tv',device_id:'tv',platform:'apple_tv'},'remote.salon_tv':{entity_id:'remote.salon_tv',device_id:'tv',platform:'apple_tv'}};
  const item=(title:string,id:string,colors:[string,string],play=true)=>({title,media_content_id:id,media_content_type:play?'music':'directory',can_play:play,can_expand:!play,thumbnail:art(...colors)});
  const library:Record<string,unknown>={
    '':{title:'Bibliothèque',media_content_id:'',media_content_type:'',can_play:false,can_expand:true,children:[item('Favoris','fav',['#65b5ff','#327ccd'],false),item('Radios','radio',['#ffe481','#ff9f40'],false),item('Golden Hour','p1',['#ff9fb6','#c14d7a']),item('Slow Tide','p2',['#7be0c4','#2c7f8f']),item('Paper Lights','p3',['#b9a4ff','#5a3fb0']),item('Riviera','p4',['#ffd38a','#d9734a'])]},
    fav:{title:'Favoris',media_content_id:'fav',media_content_type:'directory',can_play:false,can_expand:true,children:[item('Jazz du soir','f1',['#3a1c5c','#14284f']),item('Dîner','f2',['#ffb46b','#d4417a']),item('Focus','f3',['#65b5ff','#1d3f73'])]},
    radio:{title:'Radios',media_content_id:'radio',media_content_type:'directory',can_play:false,can_expand:true,children:[item('France Inter','r1',['#ff6b6b','#8a1d3a']),item('FIP','r2',['#ff9fd0','#7a2f8f']),item('TSF Jazz','r3',['#ffe481','#a86a1a'])]},
  };
  const callService=hass.callService;
  hass.callService=async(domain,service,data)=>{
    if(domain!=='media_player'||(service!=='join'&&service!=='unjoin'))return callService(domain,service,data);
    const leader=String(data.entity_id),moved=service==='join'?(data.group_members as string[]):[leader],states={...hass.states};
    const group=(id:string)=>(states[id]?.attributes.group_members as string[]|undefined)??[];
    const next=service==='join'?[...new Set([leader,...group(leader),...moved])]:group(Object.keys(states).find(id=>group(id).includes(leader)&&id!==leader)??leader).filter(id=>id!==leader);
    for(const id of next)states[id]={...states[id]!,attributes:{...states[id]!.attributes,group_members:next}};
    if(service==='unjoin')states[leader]={...states[leader]!,attributes:{...states[leader]!.attributes,group_members:[]}};
    hass.states=states;view.hass={...hass};
  };
  const callWS=hass.callWS;
  hass.callWS=async<T>(message:Record<string,unknown>)=>message.type==='media_player/browse_media'?library[String(message.media_content_id??'')] as T:callWS<T>(message);
  for(const entityId of ['media_player.salon_sonos','media_player.terrasse'])selectedView.mp_media=[...(selectedView.mp_media??[]),entityId];
  const salon=(selectedView.mp_spatial as {floors?:{rooms:{entityIds?:string[];media?:{entityId?:string}[]}[]}[]}|undefined)?.floors?.flatMap(f=>f.rooms).find(r=>r.media?.some(m=>m.entityId==='media_player.salon_tv'));
  if(salon)salon.entityIds=[...(salon.entityIds??[]),'media_player.salon_sonos'];
}
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
  const demoBackground=scenario==='office'?officeBackground:scenario==='yacht'?yachtBackground:undefined;
  view.setConfig((demoBackground?{...selectedView,mp_appearance:{...selectedView.mp_appearance,backgroundUrl:demoBackground}}:selectedView) as Parameters<MPGlassView['setConfig']>[0] & Parameters<MPNexusView['setConfig']>[0]);
  view.cards=cards;
  view.hass=hass;
}
Object.assign(window,{demo:{hass,cards,calls,history:historyCalls}});
