import { describe,expect,it } from 'vitest';
import { canCover,canMedia,coverClosed,coverOpen,coverPosition,coverStyle,coverTilt,groupCover,hasOpenings,hasPlayers,hasThermometer,mediaIsTv,mediaOn,mediaPlaying,mediaVolume,nowPlaying,PLAN_COLORS,roomAmbient,roomEntityIds,roomOpen,roomTemperature,temperatureRange } from '../shared/spatial-state';
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
  it('gives the coldest and warmest rooms of a floor, compared in Celsius',()=>{
    const states={'sensor.a':state('sensor.a','21.5',{device_class:'temperature',unit_of_measurement:'°C'}),'sensor.b':state('sensor.b','64.4',{unit_of_measurement:'°F'}),
      'climate.c':state('climate.c','heat',{current_temperature:23}),'sensor.off':state('sensor.off','unavailable',{device_class:'temperature'})};
    const rooms=[room(['sensor.a']),room(['sensor.b']),room(['climate.c']),room(['sensor.off']),room([])];
    // 64.4 °F is 18 °C: the coldest, though its number is the largest.
    expect(temperatureRange(rooms,states)).toMatchObject({low:{id:'sensor.b',value:64.4,unit:'°F'},high:{id:'climate.c',value:23}});
    expect(temperatureRange([room(['sensor.a'])],states)).toMatchObject({low:{id:'sensor.a'},high:{id:'sensor.a'}});
    expect(temperatureRange([room(['sensor.off']),room([])],states)).toBeUndefined();
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

describe('shutters, blinds, curtains and players',()=>{
  it('tell how much of their opening covers hide and how they hang',()=>{
    expect(coverClosed(state('cover.a','open',{current_position:65}))).toBeCloseTo(.35);
    expect(coverClosed(state('cover.a','closed'))).toBe(1);
    expect(coverClosed(state('cover.a','open'))).toBe(0);
    expect(coverClosed(state('cover.a','opening'))).toBeUndefined();
    expect(coverClosed(state('cover.a','unavailable',{current_position:20}))).toBeUndefined();
    expect(coverOpen(state('cover.a','open',{current_position:1}))).toBe(true);expect(coverOpen(state('cover.a','closed'))).toBe(false);
    expect(['curtain','blind','shade','shutter','awning',undefined].map(c=>coverStyle(state('cover.a','open',{device_class:c})))).toEqual(['curtain','inside','inside','outside','outside','outside']);
    expect(coverTilt(state('cover.a','open',{current_tilt_position:40}))).toBe(40);expect(coverTilt(state('cover.a','open'))).toBeUndefined();
    expect(canCover(state('cover.a','open',{supported_features:128}),'set_cover_tilt_position')).toBe(true);
  });
  it('never move garage doors, gates, doors or dampers with the shutters',()=>{
    expect(['shutter','blind','curtain',undefined].every(c=>groupCover(state('cover.a','open',{device_class:c})))).toBe(true);
    expect(['garage','gate','door','damper'].some(c=>groupCover(state('cover.a','open',{device_class:c})))).toBe(false);
  });
  it('read what a player does and what it offers',()=>{
    const tv=state('media_player.tv','playing',{device_class:'tv',media_title:'Le Grand Bleu',media_artist:'  ',app_name:'Netflix',volume_level:.325,supported_features:1|4|16384});
    expect(mediaOn(tv)).toBe(true);expect(mediaPlaying(tv)).toBe(true);expect(mediaIsTv(tv)).toBe(true);expect(mediaVolume(tv)).toBe(33);
    expect(nowPlaying(tv)).toBe('Le Grand Bleu');
    expect(nowPlaying(state('media_player.a','paused',{media_title:'So What',media_artist:'Miles Davis'}))).toBe('So What · Miles Davis');
    expect(nowPlaying(state('media_player.a','idle',{app_name:'Spotify'}))).toBe('Spotify');
    expect(nowPlaying(state('media_player.a','off',{media_title:'Old'}))).toBeUndefined();
    expect(['off','standby','unavailable','unknown'].some(s=>mediaOn(state('media_player.a',s)))).toBe(false);
    expect(canMedia(tv,'pause')).toBe(true);expect(canMedia(tv,'next_track')).toBe(false);expect(canMedia(state('media_player.a','unavailable',{supported_features:1}),'pause')).toBe(false);
    expect(mediaVolume(state('media_player.a','on',{volume_level:2}))).toBeUndefined();
  });
});

describe('openings and players on the plan',()=>{
  const bay={id:'bay',kind:'window' as const,side:0,at:.5,width:1.2,entityIds:['binary_sensor.bay','cover.bay']};
  const withOpening=(entityIds:string[],media:string[]=[]):SpatialRoom=>({...room(entityIds),openings:[bay],media:media.map((entityId,i)=>({id:`m${i}`,kind:'tv' as const,at:[1,1] as [number,number],entityId}))});
  it('gather what a room holds once, from its equipment, its doors and windows and its players',()=>{
    expect(roomEntityIds(withOpening(['light.a','cover.bay'],['media_player.tv']))).toEqual(['light.a','cover.bay','binary_sensor.bay','media_player.tv']);
  });
  it('offer an openings mode to a room with a contact sensor or a cover, and a media mode to a room with a player',()=>{
    const states={'binary_sensor.bay':state('binary_sensor.bay','off'),'binary_sensor.motion':state('binary_sensor.motion','on',{device_class:'motion'}),
      'binary_sensor.door':state('binary_sensor.door','off',{device_class:'door'}),'cover.a':state('cover.a','closed'),'media_player.tv':state('media_player.tv','off')};
    // A sensor linked to a window counts whatever its class; a motion sensor never does.
    expect(hasOpenings(withOpening([]),states)).toBe(true);
    expect(hasOpenings(room(['binary_sensor.motion','light.a']),states)).toBe(false);
    expect(hasOpenings(room(['binary_sensor.door']),states)).toBe(true);
    expect(hasOpenings(room(['cover.a']),states)).toBe(true);
    expect(hasOpenings(room(['cover.missing']),states)).toBe(false);
    expect(hasPlayers(withOpening([],['media_player.tv']),states)).toBe(true);
    expect(hasPlayers(room(['media_player.missing']),states)).toBe(false);
  });
  it('light a room in green while a door or a window is open, else by the daylight its shutters let in',()=>{
    const states={'binary_sensor.bay':state('binary_sensor.bay','off'),'cover.bay':state('cover.bay','closed'),'cover.b':state('cover.b','open',{current_position:100}),
      'cover.garage':state('cover.garage','closed',{device_class:'garage'})};
    const r=withOpening(['cover.b','cover.garage']);
    const half=roomAmbient(r,states,'openings');
    expect(half.color).toBe(PLAN_COLORS.daylight);expect(half.strength).toBeGreaterThan(0);
    states['cover.b']=state('cover.b','closed');
    expect(roomAmbient(r,states,'openings').strength).toBe(0);
    // A garage door up is an opening, not daylight.
    states['cover.garage']=state('cover.garage','open',{device_class:'garage',current_position:100});
    expect(roomOpen(r,states)).toEqual(['cover.garage']);
    expect(roomAmbient(r,states,'openings')).toEqual({color:PLAN_COLORS.open,strength:.6});
    states['binary_sensor.bay']=state('binary_sensor.bay','on');
    expect(roomOpen(r,states)).toEqual(['binary_sensor.bay','cover.garage']);
    states['cover.b']=state('cover.b','open',{current_position:100});
    expect(roomAmbient(r,states,'openings').color).toBe(PLAN_COLORS.open);
  });
  it('light a room brighter while a player plays than while it is only on',()=>{
    const states:Record<string,HAState>={'media_player.tv':state('media_player.tv','off')},r=withOpening([],['media_player.tv']);
    expect(roomAmbient(r,states,'media').strength).toBe(0);
    states['media_player.tv']=state('media_player.tv','paused');const on=roomAmbient(r,states,'media').strength;
    states['media_player.tv']=state('media_player.tv','playing');
    expect(on).toBeGreaterThan(0);expect(roomAmbient(r,states,'media')).toEqual({color:PLAN_COLORS.media,strength:.6});
  });
});
