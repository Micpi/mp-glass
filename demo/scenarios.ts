import type { SpatialFloor, SpatialPlan, SpatialRoom } from '../shared/spatial';

type Point = [number, number];
const room = (id: string, name: string, polygon: Point[], entityIds: string[] = [], arcs?: number[]): SpatialRoom => ({
  id, name, polygon, ...(entityIds.length ? { entityIds } : {}), ...(arcs ? { arcs } : {}),
});
const deck = (id: string, name: string, elevation: number, rooms: SpatialRoom[]): SpatialFloor => ({
  id, name, elevation, height: 2.6, rooms,
});

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
  upper[1]!.media = [{ id:'panorama-tv', kind:'tv', name:'Téléviseur du salon panoramique', at:[8,6], entityId:'media_player.demo_saloon' }];

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
  main[1]!.media = [{ id:'main-tv', kind:'tv', name:'Téléviseur du grand salon', at:[8,6], entityId:'media_player.demo_saloon' }];
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
    { id:'washer', kind:'washer', name:'Lave-linge', at:[14.5,6], entityId:'sensor.buanderie_washing_machine_cycle' },
    { id:'dryer', kind:'dryer', name:'Sèche-linge superposé', at:[14.5,6], stackedOn:'washer', entityId:'sensor.demo_dryer_cycle' },
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
