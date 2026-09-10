import type { Snapshot } from '../shared/models';
export function home(count = 3): Snapshot {
  const snapshot: Snapshot = {
    floors: [{floor_id:'ground',name:'RDC'}], areas:[{area_id:'salon',name:'Salon',floor_id:'ground'},{area_id:'kitchen',name:'Cuisine'}],
    devices:[{id:'device-1',area_id:'salon',via_device_id:'bridge'},{id:'bridge',manufacturer:'Generic'}],
    entities:[], states:{}, warnings:[],
  };
  for(let i=0;i<count;i++) {
    const id = `light.circuit_${i}`;
    snapshot.entities.push({id:`stable-${i}`,entity_id:id,device_id:'device-1'});
    snapshot.states[id] = {entity_id:id,state:'off',attributes:{friendly_name:i===0?'Salon · Suspension':`Circuit ${i}`,supported_color_modes:i===1?['onoff']:['brightness'],brightness:128}};
  }
  return snapshot;
}
