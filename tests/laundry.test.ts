import { describe, expect, it } from 'vitest';
import { discoverLaundryUnits, laundryIsRunning, laundryRemaining } from '../shared/laundry';
import type { HAState } from '../shared/models';

const state=(entity_id:string,value:string,attributes:Record<string,unknown>={}):HAState=>({entity_id,state:value,attributes});

describe('washing machine detection on the spatial plan',()=>{
  it('groups related entity sensors under their registered washer and area',()=>{
    const states={
      'sensor.laundry_washer_cycle':state('sensor.laundry_washer_cycle','rinse'),
      'sensor.laundry_washer_remaining_time':state('sensor.laundry_washer_remaining_time','00:38:00'),
      'sensor.kitchen_temperature':state('sensor.kitchen_temperature','21',{device_class:'temperature'}),
    };
    const entities=[{entity_id:'sensor.laundry_washer_cycle',device_id:'washer'},{entity_id:'sensor.laundry_washer_remaining_time',device_id:'washer'}];
    const devices=[{id:'washer',area_id:'utility',name_by_user:'Laundry washer'}];
    const units=discoverLaundryUnits(states,entities,devices);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({areaId:'utility',name:'Laundry washer'});
    expect(units[0]!.entityIds).toHaveLength(2);
    expect(laundryIsRunning(states,units[0]!.entityIds)).toBe(true);
    expect(laundryRemaining(states,units[0]!.entityIds)).toBe('38 min');
  });
  it('detects a washer from an entity name without a device registry record',()=>{
    const states={'sensor.washer_cycle':state('sensor.washer_cycle','idle',{friendly_name:'Laundry washer cycle'})};
    expect(discoverLaundryUnits(states)).toHaveLength(1);
    expect(laundryIsRunning(states,['sensor.washer_cycle'])).toBe(false);
  });
});
