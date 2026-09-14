import { describe, expect, it } from 'vitest';
import { MPDiscoveryEngine } from '../shared/discovery';
import type { HAState, Snapshot } from '../shared/models';
import { MPDashboardComposer } from '../shared/presentation';
import { defaultProject } from '../shared/project';
import { areaEquipment, matchAreas, planKind, resolvePlan } from '../shared/rooms';
import { examplePlan, type SpatialPlan } from '../shared/spatial';
import { home } from './fixtures';

const state = (entity_id: string, attributes: Record<string, unknown> = {}, value = 'on'): HAState => ({ entity_id, state: value, attributes });
/** Salon with lights (fixture), a shutter, a thermostat, sensors and entities that have no place on a plan. */
function house(): Snapshot {
  const snapshot = home();
  const add = (entity_id: string, attributes: Record<string, unknown> = {}, extra: Partial<Snapshot['entities'][number]> = {}) => {
    snapshot.entities.push({ id: `stable-${entity_id}`, entity_id, device_id: 'device-1', ...extra });
    snapshot.states[entity_id] = state(entity_id, { friendly_name: entity_id, ...attributes });
  };
  add('cover.salon', { device_class: 'shutter' });
  add('climate.salon');
  add('sensor.salon_temperature', { device_class: 'temperature', unit_of_measurement: '°C' });
  add('sensor.salon_humidity', { device_class: 'humidity', unit_of_measurement: '%' });
  add('binary_sensor.salon_fenetre', { device_class: 'window' });
  add('binary_sensor.salon_presence', { device_class: 'occupancy' });
  add('sensor.salon_power', { device_class: 'power', unit_of_measurement: 'W' });
  add('sensor.salon_device_temperature', { device_class: 'temperature', unit_of_measurement: '°C' }, { entity_category: 'diagnostic' });
  add('switch.salon_prise');
  add('sensor.cuisine_temperature', { device_class: 'temperature', unit_of_measurement: '°C' }, { area_id: 'kitchen' });
  return snapshot;
}

describe('equipment of a room',()=>{
  it('keeps what makes sense on a plan and leaves out energy, settings and diagnostics',()=>{
    expect(['light.a','cover.a','climate.a'].map(id=>planKind(id))).toEqual(['light','cover','climate']);
    expect(planKind('sensor.a',state('sensor.a',{device_class:'temperature'}))).toBe('temperature');
    expect(planKind('sensor.a',state('sensor.a',{unit_of_measurement:'°F'}))).toBe('temperature');
    expect(planKind('sensor.a',state('sensor.a',{device_class:'humidity'}))).toBe('humidity');
    expect(planKind('binary_sensor.a',state('binary_sensor.a',{device_class:'door'}))).toBe('opening');
    expect(planKind('binary_sensor.a',state('binary_sensor.a',{device_class:'motion'}))).toBe('motion');
    for(const [id,attributes] of [['sensor.a',{device_class:'power'}],['binary_sensor.a',{device_class:'problem'}],['switch.a',{}],['sensor.a',{}]] as const) expect(planKind(id,state(id,attributes))).toBeUndefined();
    expect(planKind('light.a',undefined,'config')).toBeUndefined();
  });
  it('lists the equipment of an area in the order of the room card',()=>{
    const graph=MPDiscoveryEngine.discover(house(),defaultProject());
    expect(areaEquipment('salon',graph.devices).map(d=>d.entityId)).toEqual(['light.circuit_1','light.circuit_2','light.circuit_0','cover.salon','climate.salon','sensor.salon_temperature','sensor.salon_humidity','binary_sensor.salon_fenetre','binary_sensor.salon_presence']);
  });
  it('fills rooms that follow an area, leaves chosen lists alone and never stores the result',()=>{
    const graph=MPDiscoveryEngine.discover(house(),defaultProject());
    const plan=examplePlan();const [living,dining,kitchen]=plan.floors[0]!.rooms as [SpatialPlan['floors'][0]['rooms'][0],SpatialPlan['floors'][0]['rooms'][0],SpatialPlan['floors'][0]['rooms'][0]];
    living.areaId='salon';dining.areaId='salon';dining.entityIds=['light.circuit_0'];kitchen.areaId='kitchen';
    const before=structuredClone(plan);
    const shown=resolvePlan(plan,graph.devices).floors[0]!.rooms;
    expect(shown[0]!.entityIds).toHaveLength(9);expect(shown[1]!.entityIds).toEqual(['light.circuit_0']);expect(shown[2]!.entityIds).toEqual(['sensor.cuisine_temperature']);
    expect(shown[3]!.entityIds).toBeUndefined();expect(plan).toEqual(before);
  });
  it('shows at most 12 entities, hidden ones excepted',()=>{
    const snapshot=home(15);const project=defaultProject();project.overrides['stable-3']={hidden:true};
    const plan=examplePlan();plan.floors[0]!.rooms[0]!.areaId='salon';
    const ids=resolvePlan(plan,MPDiscoveryEngine.discover(snapshot,project).devices).floors[0]!.rooms[0]!.entityIds!;
    expect(ids).toHaveLength(12);expect(ids).not.toContain('light.circuit_3');
  });
  it('moves an entity on the plan and in the room pages with a single area change',()=>{
    const project=defaultProject();project.spatial=examplePlan();
    project.spatial.floors[0]!.rooms[0]!.areaId='salon';project.spatial.floors[0]!.rooms[2]!.areaId='kitchen';
    project.overrides['stable-0']={areaId:'kitchen'};
    const dashboard=MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(),project),project);
    const rooms=dashboard.views[0]!.mp_spatial!.floors[0]!.rooms;
    expect(rooms[0]!.entityIds).not.toContain('light.circuit_0');expect(rooms[2]!.entityIds).toEqual(['light.circuit_0']);
    expect(dashboard.views.find(v=>v.path==='area-kitchen')!.cards.map(c=>c.entity)).toEqual(['light.circuit_0']);
    expect(project.spatial.floors[0]!.rooms[0]!.entityIds).toBeUndefined();
  });
});

describe('matching plan rooms with Home Assistant areas',()=>{
  const plan=(...floors:[string,string[]][]):SpatialPlan=>({version:1,enabled:true,floors:floors.map(([name,rooms],f)=>({id:`f${f}`,name,elevation:f*2.8,height:2.6,rooms:rooms.map((room,i)=>({id:`r${f}-${i}`,name:room,polygon:[[i*4,0],[i*4+4,0],[i*4+4,4],[i*4,4]]}))}))});
  const area=(area_id:string,name:string,floor_id?:string)=>({area_id,name,...(floor_id?{floor_id}:{})});
  const names=(result:Map<string,string>,source:SpatialPlan)=>Object.fromEntries([...result].map(([room,areaId])=>[source.floors.flatMap(f=>f.rooms).find(r=>r.id===room)!.name,areaId]));
  it('reads plan abbreviations, accents and synonyms',()=>{
    const source=plan(['RDC',['SEJOUR','CUIS.','S.D.B','W.C.','Dgt','CH. 2','Terrasse']]);
    const result=matchAreas(source,[area('salon','Salon'),area('cuisine','Cuisine'),area('sdb','Salle d’eau'),area('wc','Toilettes'),area('couloir','Couloir'),area('ch2','Chambre 2'),area('garage','Garage')]);
    expect(names(result,source)).toEqual({'SEJOUR':'salon','CUIS.':'cuisine','S.D.B':'sdb','W.C.':'wc','Dgt':'couloir','CH. 2':'ch2'});
  });
  it('leaves ambiguous rooms to the user',()=>{
    const source=plan(['Étage',['Chambre 1','Chambre 2','Bureau']]);
    expect(names(matchAreas(source,[area('leo','Chambre Léo'),area('parents','Chambre parents'),area('bureau','Bureau')]),source)).toEqual({Bureau:'bureau'});
    const numbered=plan(['Étage',['Chambre 1','Chambre 2']]);
    expect(names(matchAreas(numbered,[area('c1','Chambre 1'),area('c2','Chambre 2')]),numbered)).toEqual({'Chambre 1':'c1','Chambre 2':'c2'});
  });
  it('keeps existing links and uses a floor named like the plan level',()=>{
    const source=plan(['Rez-de-chaussée',['Salle de bain','Salon']],['Étage',['Salle de bain']]);
    source.floors[0]!.rooms[1]!.areaId='salon';
    const result=matchAreas(source,[area('salon','Salon'),area('sdb-bas','Salle de bain','rdc'),area('sdb-haut','Salle de bain','etage')],[{floor_id:'rdc',name:'Rez-de-chaussée'},{floor_id:'etage',name:'Etage'}]);
    expect([...result]).toEqual([['r0-0','sdb-bas'],['r1-0','sdb-haut']]);
  });
});
