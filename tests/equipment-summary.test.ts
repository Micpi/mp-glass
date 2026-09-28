import { describe, expect, it } from 'vitest';
import { equipmentReadings } from '../frontend/spatial/equipment';
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
