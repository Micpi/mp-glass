import type { SpatialPlan, SpatialRoom } from '../shared/spatial';

const room = (id:string,name:string,polygon:[number,number][],entityIds:string[],arcs?:number[]):SpatialRoom => ({id,name,polygon,entityIds,...(arcs?{arcs}:{})});

/** A plausible two-deck motor yacht: the main deck follows the bow and rounded stern of the hull. */
export function yachtDemoPlan():SpatialPlan {
  const main:SpatialRoom[] = [
    room('yacht-bridge','Timonerie',[[10,0],[15,3],[13,6],[7,6],[5,3]],['light.demo_lobby','climate.demo_office','sensor.demo_office_temperature']),
    room('yacht-office','Office',[[5,3],[7,6],[10,6],[10,10],[4,10],[2,8]],['light.demo_galley','climate.demo_galley','sensor.demo_galley_temperature','binary_sensor.demo_galley_hatch','media_player.demo_galley']),
    room('yacht-saloon','Carré',[[15,3],[13,6],[10,6],[10,10],[16,10],[18,8]],['light.demo_saloon','cover.demo_saloon','climate.demo_saloon','sensor.demo_saloon_temperature','sensor.demo_saloon_humidity','media_player.demo_saloon','binary_sensor.demo_saloon_hatch']),
    room('yacht-cockpit','Cockpit',[[4,10],[16,10],[18,11],[17,13],[15,14],[5,14],[3,13],[2,11]],['light.demo_cockpit','cover.demo_cockpit','binary_sensor.demo_cockpit_presence','binary_sensor.demo_cockpit_door'],[0,0,0,0,-.42,0,0,0]),
  ];
  main[0]!.openings=[{id:'bridge-screen',kind:'window',name:'Pare-brise de timonerie',side:0,at:.5,width:1.8}];
  main[1]!.openings=[{id:'office-porthole',kind:'window',name:'Hublot de l’office',side:5,at:.55,width:.65,entityIds:['binary_sensor.demo_galley_hatch']}];
  main[1]!.media=[{id:'office-speaker',kind:'speaker',name:'Enceinte de l’office',at:[8.5,8],entityId:'media_player.demo_galley'}];
  main[2]!.openings=[{id:'saloon-access',kind:'door',name:'Accès au cockpit',side:3,at:.5,width:1,entityIds:['binary_sensor.demo_saloon_hatch']}];
  main[2]!.media=[{id:'saloon-tv',kind:'tv',name:'Téléviseur du carré',at:[13,8],entityId:'media_player.demo_saloon'}];
  main[3]!.openings=[{id:'cockpit-transom',kind:'door',name:'Accès à la plage arrière',side:3,at:.55,width:.9,entityIds:['binary_sensor.demo_cockpit_door']}];

  const lower:SpatialRoom[] = [
    room('yacht-owner','Cabine armateur',[[10,0],[15,3],[13,6],[7,6],[5,3]],['light.demo_owner','climate.demo_owner','sensor.demo_owner_temperature','binary_sensor.demo_owner_hatch']),
    room('yacht-guest-port','Cabine invités bâbord',[[5,3],[7,6],[7,8],[2,8],[.5,6],[1.5,4]],['light.demo_guest','climate.demo_guest','sensor.demo_guest_temperature','binary_sensor.demo_guest_hatch']),
    room('yacht-passage','Coursive centrale',[[7,6],[13,6],[13,8],[7,8]],[]),
    room('yacht-guest-starboard','Cabine invités tribord',[[15,3],[13,6],[13,8],[18,8],[19.5,6],[18.5,4]],['light.demo_guest_starboard','climate.demo_guest_starboard','sensor.demo_guest_starboard_temperature','binary_sensor.demo_guest_starboard_hatch']),
    room('yacht-bath','Salle d’eau',[[2,8],[6,8],[6,11],[3,11],[1.5,10]],[],[0,0,-.08,0,0]),
    room('yacht-engine','Compartiment moteur',[[6,8],[10,8],[10,11],[6,11]],[],[0,0,-.14,0]),
    room('yacht-laundry','Local technique & lingerie',[[10,8],[14,8],[14,11],[10,11]],['light.demo_yacht_laundry','sensor.buanderie_washing_machine_cycle','sensor.demo_dryer_cycle','binary_sensor.demo_laundry_presence'],[0,0,-.14,0]),
    room('yacht-crew','Cabine équipage',[[14,8],[18,8],[19,10],[17,11],[14,11]],[],[0,0,0,-.08,0]),
  ];
  lower[0]!.openings=[{id:'owner-porthole',kind:'window',name:'Hublot de la cabine armateur',side:3,at:.5,width:.8,entityIds:['binary_sensor.demo_owner_hatch']}];
  lower[1]!.openings=[{id:'guest-porthole-port',kind:'window',name:'Hublot bâbord · cabine invités',side:4,at:.5,width:.8,entityIds:['binary_sensor.demo_guest_hatch']}];
  lower[3]!.openings=[{id:'guest-porthole-starboard',kind:'window',name:'Hublot tribord · cabine invités',side:3,at:.5,width:.8,entityIds:['binary_sensor.demo_guest_starboard_hatch']}];
  lower[6]!.laundry=[
    {id:'washer',kind:'washer',name:'Lave-linge',at:[12,9.4],entityId:'sensor.buanderie_washing_machine_cycle'},
    {id:'dryer',kind:'dryer',name:'Sèche-linge superposé',at:[12,9.4],stackedOn:'washer',entityId:'sensor.demo_dryer_cycle'},
  ];
  return {version:1,enabled:true,floors:[
    {id:'yacht-main',name:'Pont principal',elevation:0,height:2.5,rooms:main},
    {id:'yacht-cabins',name:'Pont inférieur',elevation:-2.5,height:2.2,rooms:lower},
  ]};
}
