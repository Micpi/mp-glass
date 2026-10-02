import type { OpeningKind, SpatialFloor, SpatialPlan, SpatialRoom } from '../shared/spatial';

type Point = [number, number];
const room = (id: string, name: string, polygon: Point[], entityIds: string[] = [], arcs?: number[]): SpatialRoom => ({
  id, name, polygon, ...(entityIds.length ? { entityIds } : {}), ...(arcs ? { arcs } : {}),
});
const deck = (id: string, name: string, elevation: number, rooms: SpatialRoom[]): SpatialFloor => ({
  id, name, elevation, height: 2.6, rooms,
});

export interface OfficeShadeFixture {
  id:string; roomId:string; name:string; deviceClass:'blind'|'shutter'|'garage'; side:number; at:number; width:number; position:number; tilt?:number;
}

/** A dense but plausible mix of motorized blinds and roller shutters, each attached to an actual opening. */
export const officeShadeFixtures:OfficeShadeFixture[] = [
  {id:'cover.demo_shop',roomId:'office_shop',name:'Store de vitrine',deviceClass:'blind',side:0,at:.34,width:2.8,position:68,tilt:55},
  {id:'cover.office_shop_shutter',roomId:'office_shop',name:'Volet roulant façade',deviceClass:'shutter',side:0,at:.68,width:2.8,position:28},
  {id:'cover.office_lobby_shutter',roomId:'office_lobby',name:'Volet roulant accueil',deviceClass:'shutter',side:1,at:.5,width:2.2,position:100},
  {id:'cover.office_reserve_blind',roomId:'office_laundry',name:'Store de réserve',deviceClass:'blind',side:0,at:.35,width:1.6,position:44,tilt:35},
  {id:'cover.office_reserve_shutter',roomId:'office_laundry',name:'Volet roulant réserve',deviceClass:'shutter',side:0,at:.72,width:1.6,position:0},
  {id:'cover.office_lounge_blind',roomId:'office_lounge',name:'Store de l’espace détente',deviceClass:'blind',side:2,at:.5,width:2.2,position:72,tilt:75},
  {id:'cover.office_service_shutter',roomId:'office_service',name:'Volet roulant du local',deviceClass:'shutter',side:2,at:.5,width:1.8,position:18},
  {id:'cover.office_delivery_door',roomId:'office_delivery',name:'Rideau métallique de livraison',deviceClass:'garage',side:2,at:.5,width:3.2,position:82},
  {id:'cover.office_direction_blind',roomId:'office_room',name:'Store bureau de direction',deviceClass:'blind',side:0,at:.3,width:2.8,position:32,tilt:45},
  {id:'cover.office_direction_shutter',roomId:'office_room',name:'Volet roulant direction',deviceClass:'shutter',side:0,at:.72,width:2.8,position:0},
  {id:'cover.office_meeting_blind',roomId:'office_meeting',name:'Store salle de réunion',deviceClass:'blind',side:0,at:.32,width:2.8,position:56,tilt:20},
  {id:'cover.office_meeting_shutter',roomId:'office_meeting',name:'Volet roulant réunion',deviceClass:'shutter',side:0,at:.72,width:2.8,position:0},
  {id:'cover.office_board_blind',roomId:'office_board',name:'Store salle du conseil',deviceClass:'blind',side:0,at:.34,width:2.8,position:38,tilt:45},
  {id:'cover.office_board_shutter',roomId:'office_board',name:'Volet roulant salle du conseil',deviceClass:'shutter',side:0,at:.72,width:2.8,position:0},
  {id:'cover.office_open_blind_1',roomId:'office_open_space',name:'Store open space · travée 1',deviceClass:'blind',side:0,at:.28,width:2.8,position:42,tilt:35},
  {id:'cover.office_open_blind_2',roomId:'office_open_space',name:'Store open space · travée 2',deviceClass:'blind',side:0,at:.72,width:2.8,position:42,tilt:35},
  {id:'cover.office_open_shutter_1',roomId:'office_open_space',name:'Volet roulant open space · 1',deviceClass:'shutter',side:2,at:.3,width:2.8,position:0},
  {id:'cover.office_open_shutter_2',roomId:'office_open_space',name:'Volet roulant open space · 2',deviceClass:'shutter',side:2,at:.7,width:2.8,position:0},
  {id:'cover.office_sales_blind',roomId:'office_sales',name:'Store bureau commercial',deviceClass:'blind',side:0,at:.34,width:2.4,position:65,tilt:60},
  {id:'cover.office_sales_shutter',roomId:'office_sales',name:'Volet roulant commercial',deviceClass:'shutter',side:0,at:.72,width:2.4,position:0},
  {id:'cover.office_hr_blind',roomId:'office_hr',name:'Store ressources humaines',deviceClass:'blind',side:0,at:.32,width:2.4,position:35,tilt:30},
  {id:'cover.office_hr_shutter',roomId:'office_hr',name:'Volet roulant ressources humaines',deviceClass:'shutter',side:0,at:.72,width:2.4,position:0},
  {id:'cover.office_project_blind',roomId:'office_project',name:'Store espace projet',deviceClass:'blind',side:0,at:.34,width:2.4,position:48,tilt:50},
  {id:'cover.office_project_shutter',roomId:'office_project',name:'Volet roulant espace projet',deviceClass:'shutter',side:0,at:.72,width:2.4,position:0},
  {id:'cover.office_training_blind',roomId:'office_training',name:'Store salle de formation',deviceClass:'blind',side:2,at:.32,width:2.4,position:24,tilt:20},
  {id:'cover.office_training_shutter',roomId:'office_training',name:'Volet roulant formation',deviceClass:'shutter',side:2,at:.72,width:2.4,position:0},
  {id:'cover.office_break_blind',roomId:'office_break',name:'Store espace de pause',deviceClass:'blind',side:2,at:.5,width:2.6,position:75,tilt:70},
  {id:'cover.office_archive_shutter',roomId:'office_archive',name:'Volet roulant archives',deviceClass:'shutter',side:2,at:.5,width:1.8,position:0},
  {id:'cover.office_it_shutter',roomId:'office_it',name:'Volet roulant salle informatique',deviceClass:'shutter',side:2,at:.5,width:1.8,position:0},
];

/** Two-storey office and retail sample, with a much larger upper floor and motorized sun protection throughout. */
export function officeDemoPlan():SpatialPlan{
  const spaces=[
    room('office_shop','Boutique',[[0,0],[12,0],[12,8],[0,8]],['light.demo_shop','climate.demo_shop','sensor.demo_shop_temperature','sensor.demo_shop_humidity','binary_sensor.demo_shop_presence','binary_sensor.demo_shop_door','media_player.demo_signage']),
    room('office_lobby','Accueil principal',[[12,0],[17,0],[17,8],[12,8]],['light.demo_lobby','binary_sensor.demo_entry_door','binary_sensor.demo_lobby_presence']),
    room('office_laundry','Réserve & lingerie',[[17,0],[23,0],[23,5],[17,5]],['light.demo_laundry','sensor.buanderie_washing_machine_cycle','sensor.demo_dryer_cycle','binary_sensor.demo_laundry_presence']),
    room('office_lounge','Espace de détente',[[0,8],[7,8],[7,14],[0,14]],['light.office_lounge']),
    room('office_restrooms','Sanitaires',[[7,8],[12,8],[12,14],[7,14]],['light.office_restrooms']),
    room('office_service','Local de service',[[12,8],[17,8],[17,14],[12,14]],['light.office_service']),
    room('office_delivery','Quai de livraison',[[17,5],[23,5],[23,14],[17,14]],['light.office_delivery']),
    room('office_room','Bureau de direction',[[0,0],[12,0],[12,8],[0,8]],['light.demo_office','climate.demo_office','sensor.demo_office_temperature']),
    room('office_meeting','Salle de réunion',[[12,0],[24,0],[24,8],[12,8]],['light.demo_meeting','climate.demo_meeting','media_player.demo_meeting_screen','binary_sensor.demo_meeting_presence']),
    room('office_board','Salle du conseil',[[24,0],[36,0],[36,8],[24,8]],['light.office_board','climate.office_board','sensor.office_board_temperature']),
    room('office_open_space','Grand open space',[[0,8],[18,8],[18,18],[0,18]],['light.office_open_space','climate.office_open_space','sensor.office_open_temperature','sensor.office_open_humidity']),
    room('office_sales','Bureau commercial',[[18,8],[27,8],[27,18],[18,18]],['light.office_sales','climate.office_sales','sensor.office_sales_temperature']),
    room('office_hr','Ressources humaines',[[27,8],[36,8],[36,18],[27,18]],['light.office_hr','climate.office_hr','sensor.office_hr_temperature']),
    room('office_project','Salle projet',[[0,18],[12,18],[12,25],[0,25]],['light.office_project','media_player.office_project_screen']),
    room('office_training','Salle de formation',[[12,18],[22,18],[22,25],[12,25]],['light.office_training','climate.office_training','sensor.office_training_temperature','media_player.office_training_screen']),
    room('office_break','Espace de pause',[[22,18],[29,18],[29,25],[22,25]],['light.office_break']),
    room('office_archive','Archives',[[29,18],[33,18],[33,25],[29,25]],['light.office_archive']),
    room('office_it','Salle informatique',[[33,18],[36,18],[36,25],[33,25]],['light.office_it','climate.office_it','sensor.office_it_temperature']),
  ];
  for(const shade of officeShadeFixtures){
    const target=spaces.find(candidate=>candidate.id===shade.roomId)!;
    const kind:OpeningKind=shade.deviceClass==='garage'?'door':'window';
    target.openings=[...(target.openings??[]),{id:`${shade.id.split('.').at(-1)}-opening`,kind,name:shade.name,side:shade.side,at:shade.at,width:shade.width,entityIds:[shade.id]}];
  }
  spaces.find(candidate=>candidate.id==='office_shop')!.media=[{id:'signage',kind:'tv',name:'Écran vitrine',at:[6,7.82],entityId:'media_player.demo_signage'}];
  spaces.find(candidate=>candidate.id==='office_meeting')!.media=[{id:'meeting-screen',kind:'tv',name:'Écran de réunion',at:[18,7.82],entityId:'media_player.demo_meeting_screen'}];
  spaces.find(candidate=>candidate.id==='office_training')!.media=[{id:'training-screen',kind:'tv',name:'Écran de formation',at:[17,24.82],entityId:'media_player.office_training_screen'}];
  spaces.find(candidate=>candidate.id==='office_laundry')!.laundry=[
    {id:'washer',kind:'washer',name:'Lave-linge',at:[17.33,1.8],rotation:Math.PI/2,entityId:'sensor.buanderie_washing_machine_cycle'},
    {id:'dryer',kind:'dryer',name:'Sèche-linge',at:[17.33,3.2],rotation:Math.PI/2,entityId:'sensor.demo_dryer_cycle'},
  ];
  return {version:1,enabled:true,floors:[
    {id:'professional-main',name:'Espace commercial',elevation:0,height:3.2,rooms:spaces.slice(0,7)},
    {id:'professional-office',name:'Bureaux · étage 1',elevation:3.2,height:3.0,rooms:spaces.slice(7)},
  ]};
}

/** Original four-deck explorer-yacht sample: full-length hull, pointed bow, transom and distinct general-arrangement decks. */
export function yachtDemoPlan(): SpatialPlan {
  const aftPlatform = (id: string, name: string, equipment: string[] = []) => room(id, name,
    [[0,2],[0,10],[1,11.5],[4,12],[4,0],[1,.5]], equipment, [.12,0,0,0,0,0]);
  const foredeck = (id: string, name: string, equipment: string[] = []) => room(id, name, [[30,2],[36,6],[30,10]], equipment);
  const narrowingDeck = (id: string, name: string, equipment: string[] = []) => room(id, name,
    [[26,0],[30,2],[30,10],[26,12]], equipment);

  const sun = [
    aftPlatform('sun-swim-platform', 'Plateforme de bain', ['light.demo_cockpit','cover.demo_cockpit','binary_sensor.demo_cockpit_presence']),
    room('sun-jacuzzi', 'Jacuzzi & solarium', [[4,0],[9,0],[9,12],[4,12]], ['switch.demo_jacuzzi','sensor.demo_jacuzzi_temperature','light.demo_sundeck']),
    room('sun-lounge', 'Salon extérieur', [[9,0],[19,0],[19,12],[9,12]], ['light.demo_sundeck','cover.demo_sundeck','binary_sensor.demo_sundeck_presence','media_player.demo_sundeck']),
    room('sun-beds', 'Bains de soleil', [[19,0],[26,0],[26,12],[19,12]], ['light.demo_sundeck','binary_sensor.demo_sundeck_presence']),
    narrowingDeck('sun-helm', 'Timonerie haute', ['light.demo_lobby','climate.demo_office','sensor.demo_office_temperature']),
    foredeck('sun-foredeck', 'Pont avant'),
  ];
  sun[0]!.openings = [{ id:'swim-platform-gate', kind:'door', name:'Passage vers la plateforme', side:3, at:.5, width:1 }];
  sun[4]!.openings = [{ id:'upper-windscreen', kind:'french_window', name:'Pare-brise de timonerie', side:1, at:.5, width:2.2 }];

  const upper = [
    aftPlatform('upper-terrace', 'Terrasse arrière', ['light.demo_cockpit','cover.demo_cockpit']),
    room('upper-saloon', 'Salon panoramique', [[4,0],[12,0],[12,12],[4,12]], ['light.demo_saloon','climate.demo_saloon','sensor.demo_saloon_temperature','sensor.demo_saloon_humidity','media_player.demo_saloon']),
    room('upper-dining', 'Salle à manger', [[12,0],[18,0],[18,12],[12,12]], ['light.demo_meeting','media_player.demo_meeting_screen']),
    room('upper-owner-suite', 'Suite armateur', [[18,0],[23,0],[23,6],[18,6]], ['light.demo_owner','climate.demo_owner','sensor.demo_owner_temperature','binary_sensor.demo_owner_hatch']),
    room('upper-private-lounge', 'Salon privé', [[18,6],[23,6],[23,12],[18,12]]),
    room('upper-gallery', 'Coursive supérieure', [[23,0],[26,0],[26,12],[23,12]], []),
    narrowingDeck('upper-observation', 'Salon d’observation', ['light.demo_lobby','climate.demo_office','sensor.demo_office_temperature','binary_sensor.demo_entry_door']),
    foredeck('upper-foredeck', 'Pont avant'),
  ];
  upper[1]!.openings = [{ id:'panorama-port', kind:'window', name:'Baies panoramiques bâbord', side:0, at:.5, width:3 }];
  upper[3]!.openings = [{ id:'owner-upper-porthole', kind:'window', name:'Hublot de la suite armateur', side:0, at:.5, width:.9, entityIds:['binary_sensor.demo_owner_hatch'] }];
  upper[1]!.media = [{ id:'panorama-tv', kind:'tv', name:'Téléviseur du salon panoramique', at:[11.85,6], entityId:'media_player.demo_saloon' }];

  const main = [
    aftPlatform('main-swim-platform', 'Plage arrière', ['light.demo_cockpit','cover.demo_cockpit','binary_sensor.demo_cockpit_presence']),
    room('main-lounge', 'Grand salon', [[4,0],[11,0],[11,12],[4,12]], ['light.demo_saloon','cover.demo_saloon','climate.demo_saloon','sensor.demo_saloon_temperature','sensor.demo_saloon_humidity','media_player.demo_saloon']),
    room('main-dining', 'Salle à manger', [[11,0],[16,0],[16,12],[11,12]], ['light.demo_meeting','media_player.demo_meeting_screen']),
    room('main-galley', 'Office principal', [[16,0],[20,0],[20,12],[16,12]], ['light.demo_galley','climate.demo_galley','sensor.demo_galley_temperature','binary_sensor.demo_galley_hatch','media_player.demo_galley']),
    room('main-vip-port', 'Cabine VIP bâbord', [[20,0],[23,0],[23,6],[20,6]], ['light.demo_guest','climate.demo_guest','sensor.demo_guest_temperature','binary_sensor.demo_guest_hatch']),
    room('main-vip-starboard', 'Cabine VIP tribord', [[20,6],[23,6],[23,12],[20,12]], ['light.demo_guest_starboard','climate.demo_guest_starboard','sensor.demo_guest_starboard_temperature','binary_sensor.demo_guest_starboard_hatch']),
    room('main-passage', 'Hall & coursive', [[23,0],[26,0],[26,12],[23,12]], ['binary_sensor.demo_entry_door']),
    narrowingDeck('main-helm', 'Timonerie', ['light.demo_lobby','climate.demo_office','sensor.demo_office_temperature','binary_sensor.demo_entry_door']),
    foredeck('main-foredeck', 'Pont avant'),
  ];
  main[1]!.openings = [{ id:'saloon-cockpit-door', kind:'french_window', name:'Accès à la plage arrière', side:3, at:.5, width:1.6, entityIds:['binary_sensor.demo_saloon_hatch'] }];
  main[1]!.media = [{ id:'main-tv', kind:'tv', name:'Téléviseur du grand salon', at:[10.85,6], entityId:'media_player.demo_saloon' }];
  main[3]!.openings = [{ id:'galley-porthole', kind:'window', name:'Hublot de l’office', side:0, at:.5, width:.8, entityIds:['binary_sensor.demo_galley_hatch'] }];
  main[7]!.openings = [{ id:'helm-windscreen', kind:'window', name:'Pare-brise de timonerie', side:1, at:.5, width:2.2 }];

  const lower = [
    aftPlatform('lower-garage-platform', 'Plateforme de mise à l’eau'),
    room('lower-tender-garage', 'Garage à annexe', [[4,0],[9,0],[9,12],[4,12]], ['light.demo_garage','cover.demo_garage']),
    room('lower-engine-room', 'Salle des machines', [[9,0],[13,0],[13,12],[9,12]], ['light.demo_engine_room','sensor.demo_engine_room_temperature','binary_sensor.demo_engine_alarm']),
    room('lower-laundry', 'Buanderie', [[13,0],[16,0],[16,12],[13,12]], ['light.demo_yacht_laundry','sensor.buanderie_washing_machine_cycle','sensor.demo_dryer_cycle','binary_sensor.demo_laundry_presence']),
    room('lower-corridor', 'Coursive centrale', [[16,5.2],[30,5.2],[30,6.8],[16,6.8]], []),
    room('lower-guest-port', 'Cabine invités bâbord', [[16,0],[23,0],[23,5.2],[16,5.2]], ['light.demo_guest','climate.demo_guest','sensor.demo_guest_temperature','binary_sensor.demo_guest_hatch']),
    room('lower-guest-starboard', 'Cabine invités tribord', [[16,6.8],[23,6.8],[23,12],[16,12]], ['light.demo_guest_starboard','climate.demo_guest_starboard','sensor.demo_guest_starboard_temperature','binary_sensor.demo_guest_starboard_hatch']),
    room('lower-heads', 'Salle d’eau', [[23,0],[26,0],[26,5.2],[23,5.2]], []),
    room('lower-owner-suite', 'Cabine armateur', [[23,6.8],[26,6.8],[26,12],[23,12]]),
    room('lower-crew-port', 'Cabine équipage bâbord', [[26,0],[30,2],[30,5.2],[26,5.2]], []),
    room('lower-crew-starboard', 'Cabine équipage tribord', [[26,6.8],[30,6.8],[30,10],[26,12]], []),
    foredeck('lower-foredeck', 'Pique avant'),
  ];
  lower[8]!.openings = [{ id:'crew-mess-porthole', kind:'window', name:'Hublot', side:2, at:.5, width:.9 }];
  lower[5]!.openings = [{ id:'guest-porthole-port', kind:'window', name:'Hublot bâbord · cabine invités', side:0, at:.5, width:.8, entityIds:['binary_sensor.demo_guest_hatch'] }];
  lower[6]!.openings = [{ id:'guest-porthole-starboard', kind:'window', name:'Hublot tribord · cabine invités', side:2, at:.5, width:.8, entityIds:['binary_sensor.demo_guest_starboard_hatch'] }];
  lower[3]!.laundry = [
    { id:'washer', kind:'washer', name:'Lave-linge', at:[13.31,6], rotation:Math.PI/2, entityId:'sensor.buanderie_washing_machine_cycle' },
    { id:'dryer', kind:'dryer', name:'Sèche-linge superposé', at:[13.31,6], rotation:Math.PI/2, stackedOn:'washer', entityId:'sensor.demo_dryer_cycle' },
  ];

  const names: Record<string,string> = {
    'sun-swim-platform':'Aft Terrace','sun-jacuzzi':'Jacuzzi','sun-lounge':'Sun Lounge','sun-beds':'Sunpads','sun-helm':'Observation Lounge','sun-foredeck':'Foredeck',
    'upper-terrace':'Aft Deck','upper-saloon':'Skylounge','upper-dining':'Dining Salon','upper-owner-suite':"Owner’s Suite",'upper-private-lounge':'Private Lounge','upper-gallery':'Upper Lobby','upper-observation':'Bridge','upper-foredeck':'Foredeck',
    'main-swim-platform':'Aft Deck','main-lounge':'Main Salon','main-dining':'Dining Room','main-galley':'Galley','main-vip-port':'Port VIP Suite','main-vip-starboard':'Starboard VIP Suite','main-passage':'Main Lobby','main-helm':'Forward Lounge','main-foredeck':'Foredeck',
    'lower-garage-platform':'Swim Platform','lower-tender-garage':'Tender Garage','lower-engine-room':'Engine Room','lower-laundry':'Laundry','lower-corridor':'Guest Corridor','lower-guest-port':'Port Guest Suite','lower-guest-starboard':'Starboard Guest Suite','lower-heads':'Guest Bathroom','lower-owner-suite':'Crew Mess','lower-crew-port':'Port Crew Cabin','lower-crew-starboard':'Starboard Crew Cabin','lower-foredeck':'Forepeak',
  };
  const point = ([x,z]:Point):Point => [x*37.5/36,z*8.1/12];
  const plan: SpatialPlan = { version:1, enabled:true, floors:[
    deck('yacht-lower','Lower Deck',-8.1,lower),deck('yacht-main','Main Deck',-5.4,main),
    deck('yacht-upper','Upper Deck',-2.7,upper),deck('yacht-sun','Sun Deck',0,sun),
  ] };
  for(const floor of plan.floors)for(const space of floor.rooms){
    space.name=names[space.id]!;space.polygon=space.polygon.map(point);
    for(const unit of space.laundry??[]){unit.at=point(unit.at);unit.name=unit.kind==='washer'?'Washing machine':'Stacked dryer';}
    for(const unit of space.media??[]){unit.at=point(unit.at);unit.name=unit.kind==='tv'?`${space.name} · Television`:`${space.name} · Speaker`;}
    for(const opening of space.openings??[])opening.name=`${space.name} · ${opening.kind==='door'?'Access door':opening.width>1.5?'Panoramic glazing':'Porthole'}`;
  }
  return plan;
}
