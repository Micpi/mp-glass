import { describe, expect, it } from 'vitest';
import { ambientEquipmentIds, equipmentReadings, filterEquipmentIds, mergeEquipmentEntries } from '../frontend/spatial/equipment';
import type { HAState } from '../shared/models';
const state=(entity_id:string,value:string,attributes:Record<string,unknown>={}):HAState=>({entity_id,state:value,attributes});
const values=(states:Record<string,HAState>,laundry=false)=>equipmentReadings(Object.keys(states),states,laundry).map(row=>row.value);
describe('end user equipment summaries',()=>{
 it('shows light state and brightness only while lit',()=>{
  expect(values({'light.lamp':state('light.lamp','on',{brightness:128,voltage:230,ip_address:'192.0.2.1'})})).toEqual(['Allumée','50 %']);
  expect(values({'light.lamp':state('light.lamp','off',{brightness:128})})).toEqual(['Éteinte']);
 });
 it('shows current temperature and active setpoint without diagnostic attributes',()=>{
  expect(values({'climate.room':state('climate.room','heat',{current_temperature:19,temperature:21,battery_level:99,source:'internal'})})).toEqual(['Chauffage','19 °C','21 °C']);
  expect(values({'climate.room':state('climate.room','off',{current_temperature:19,temperature:21})})).toEqual(['Arrêt','19 °C']);
 });
 it('summarizes a laundry cycle and ignores power, energy, firmware and closed doors',()=>{
  const states={
   'sensor.washer_cycle':state('sensor.washer_cycle','rinse'),
   'sensor.washer_program':state('sensor.washer_program','Coton'),
   'sensor.washer_remaining':state('sensor.washer_remaining','00:38:00'),
   'sensor.washer_progress':state('sensor.washer_progress','62'),
   'sensor.washer_power':state('sensor.washer_power','438',{unit_of_measurement:'W'}),
   'sensor.washer_firmware':state('sensor.washer_firmware','1.2.3'),
   'binary_sensor.washer_door':state('binary_sensor.washer_door','off'),
  };
  expect(values(states,true)).toEqual(['Rinçage','Coton','38 min','62 %']);
  states['binary_sensor.washer_door'].state='on';expect(values(states,true).at(-1)).toBe('Ouverte');
 });
 it('does not show stale remaining time or progress for a finished cycle',()=>{
  expect(values({'sensor.washer_cycle':state('sensor.washer_cycle','completed'),'sensor.washer_remaining':state('sensor.washer_remaining','38'),'sensor.washer_progress':state('sensor.washer_progress','100')},true)).toEqual(['Terminé']);
 });
 it('keeps unavailable devices explicit and excludes arbitrary sensors',()=>{
  expect(values({'climate.room':state('climate.room','unavailable',{temperature:21})})).toEqual(['Indisponible']);
  expect(values({'sensor.voltage':state('sensor.voltage','230')})).toEqual([]);
 });
 it('shows playback once, with volume but no source or duplicate title',()=>{
  expect(values({'media_player.tv':state('media_player.tv','playing',{media_title:'Le Grand Bleu',volume_level:.32,source:'Netflix',ip_address:'192.0.2.1'})})).toEqual(['Lecture','Le Grand Bleu','32 %']);
 });
});

describe('room equipment collections',()=>{
 it('keeps all thirty lights in one collection and removes duplicates',()=>{
  const ids=Array.from({length:30},(_,i)=>'light.spot_'+i);
  expect(ambientEquipmentIds([...ids,ids[0]!, 'climate.room'],{},'lights')).toEqual(ids);
 });
 it('groups thermostats, temperatures and humidity without unrelated equipment',()=>{
  const states={'sensor.temp':state('sensor.temp','21',{device_class:'temperature'}),'sensor.humidity':state('sensor.humidity','45',{device_class:'humidity'})};
  expect(ambientEquipmentIds(['climate.room','sensor.temp','sensor.humidity','light.spot','sensor.power'],states,'climate')).toEqual(['climate.room','sensor.temp','sensor.humidity']);
 });
 it('searches visible names without depending on accents or case',()=>{
  const names:Record<string,string>={a:'Éclairage canapé',b:'Spot fenêtre',c:'Lampe de bureau'};
  expect(filterEquipmentIds(Object.keys(names),'  ECLAIRAGE  ',id=>names[id]!)).toEqual(['a']);
  expect(filterEquipmentIds(Object.keys(names),'absent',id=>names[id]!)).toEqual([]);
  expect(filterEquipmentIds(Object.keys(names),'',id=>names[id]!)).toEqual(['a','b','c']);
 });
});

describe('other room categories',()=>{
 it('reads a named window contact even when its integration omits the device class',()=>{
  expect(values({'binary_sensor.window_contact':state('binary_sensor.window_contact','off')})).toEqual(['Fermée']);
 });
 it('collects media players, including unavailable equipment',()=>{
  expect(ambientEquipmentIds(['media_player.tv','media_player.speaker','light.spot','sensor.energy'],{},'media')).toEqual(['media_player.tv','media_player.speaker']);
 });
 it('collects covers and door contacts while excluding motion and power sensors',()=>{
  const states={'binary_sensor.contact':state('binary_sensor.contact','off',{device_class:'window'}),'binary_sensor.motion':state('binary_sensor.motion','on',{device_class:'motion'})};
  expect(ambientEquipmentIds(['cover.shutter','binary_sensor.contact','binary_sensor.front_door','binary_sensor.motion','sensor.power'],states,'openings')).toEqual(['cover.shutter','binary_sensor.contact','binary_sensor.front_door']);
 });
 it('keeps a placed opening as one row, retains unlinked models and includes standalone covers',()=>{
  const placed=[{key:'window',name:'Baie vitrée',icon:'window' as const,entityIds:['cover.shutter','binary_sensor.contact']},{key:'door',name:'Porte',icon:'door' as const,entityIds:[]}];
  const entities=[{key:'shutter',name:'Volet',icon:'shutter' as const,entityIds:['cover.shutter']},{key:'other',name:'Store bureau',icon:'shutter' as const,entityIds:['cover.office']}];
  expect(mergeEquipmentEntries(placed,entities).map(item=>item.key)).toEqual(['window','door','other']);
 });
 it('keeps both stacked machines individually while grouping each machine sensors',()=>{
  const machines=[{key:'washer',name:'Lave-linge',icon:'washer' as const,entityIds:['sensor.washer_cycle','sensor.washer_remaining'],laundry:true},{key:'dryer',name:'Sèche-linge',icon:'washer' as const,entityIds:['sensor.dryer_cycle','sensor.dryer_remaining'],laundry:true}];
  expect(mergeEquipmentEntries(machines,[])).toHaveLength(2);
  expect(mergeEquipmentEntries([machines[0]!,machines[0]!],[])).toHaveLength(1);
 });
});
