import { describe,expect,it } from 'vitest';
import { canCover,coverPosition,hasThermometer,roomAmbient,roomTemperature } from '../shared/spatial-state';
import type { HAState } from '../shared/models';
import type { SpatialRoom } from '../shared/spatial';

const state=(id:string,value:string,attributes:Record<string,unknown>={}):HAState=>({entity_id:id,state:value,attributes});
const room=(entityIds:string[]):SpatialRoom=>({id:'test',name:'Test',polygon:[[0,0],[3,0],[3,3],[0,3]],entityIds});
describe('room runtime information',()=>{
  it('only lights associated with this room affect its halo and brightness',()=>{
    const r=room(['light.a']),states={'light.a':state('light.a','off'),'light.other':state('light.other','on')};
    expect(roomAmbient(r,states,'lights').strength).toBe(0);
    states['light.a']=state('light.a','on',{brightness:30});const dim=roomAmbient(r,states,'lights').strength;
    states['light.a']=state('light.a','on',{brightness:255});expect(roomAmbient(r,states,'lights').strength).toBeGreaterThan(dim);
    states['light.a']=state('light.a','unavailable');expect(roomAmbient(r,states,'lights').strength).toBe(0);
  });
  it('uses a valid sensor before a thermostat and compares Fahrenheit in Celsius',()=>{
    const r=room(['climate.a','sensor.a','sensor.b']);
    const states={'sensor.a':state('sensor.a','unknown',{device_class:'temperature'}),'sensor.b':state('sensor.b','68',{device_class:'temperature',unit_of_measurement:'°F'}),'climate.a':state('climate.a','heat',{current_temperature:25})};
    expect(roomTemperature(r,states)).toMatchObject({id:'sensor.b',value:68,unit:'°F',celsius:20});
    expect(roomAmbient(r,states,'climate').color).toBe('#71d7c0');
    states['sensor.b']=state('sensor.b','NaN',{device_class:'temperature'});
    expect(roomTemperature(r,states)?.id).toBe('climate.a');
    states['climate.a']=state('climate.a','unavailable',{current_temperature:25});
    expect(roomAmbient(r,states,'climate').strength).toBe(0);
  });
  it('knows which rooms measure their temperature, even while offline',()=>{
    const states={'light.a':state('light.a','on'),'sensor.power':state('sensor.power','12',{device_class:'power',unit_of_measurement:'W'}),
      'sensor.t':state('sensor.t','unavailable',{device_class:'temperature'}),'sensor.f':state('sensor.f','70',{unit_of_measurement:'°F'}),
      'climate.silent':state('climate.silent','heat',{temperature:20}),'climate.off':state('climate.off','unavailable')};
    expect(hasThermometer(room(['light.a','sensor.power','sensor.missing']),states)).toBe(false);
    expect(hasThermometer(room([]),states)).toBe(false);
    // A thermostat that never reports the room temperature is no thermometer; an offline one may be.
    expect(hasThermometer(room(['climate.silent']),states)).toBe(false);
    expect(hasThermometer(room(['climate.off']),states)).toBe(true);
    expect(hasThermometer(room(['sensor.t']),states)).toBe(true);
    expect(roomTemperature(room(['sensor.t']),states)).toBeUndefined();
    expect(hasThermometer(room(['sensor.f']),states)).toBe(true);
  });
  it('keeps unknown cover positions unknown and obeys supported features',()=>{
    expect(coverPosition(state('cover.a','open'))).toBeUndefined();
    expect(coverPosition(state('cover.a','closed'))).toBe(0);
    expect(coverPosition(state('cover.a','opening',{current_position:45}))).toBe(45);
    expect(coverPosition(state('cover.a','unavailable',{current_position:45}))).toBeUndefined();
    expect(coverPosition(state('cover.a','open',{current_position:101}))).toBeUndefined();
    const simple=state('cover.a','open',{supported_features:3});
    expect(canCover(simple,'close_cover')).toBe(true);expect(canCover(simple,'set_cover_position')).toBe(false);expect(canCover(simple,'stop_cover')).toBe(false);
    expect(canCover(undefined,'open_cover')).toBe(false);
  });
});
