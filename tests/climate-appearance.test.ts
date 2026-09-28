import { describe, expect, it } from 'vitest';
import type { HAState } from '../shared/models';
import { climateAppearance, roomClimateAppearance } from '../frontend/spatial/climate';
const state=(mode:string,action?:string):HAState=>({entity_id:'climate.room',state:mode,attributes:action===undefined?{}:{hvac_action:action}});
describe('active climate icon appearances',()=>{
 it.each([['heat','flame','#ffb27d'],['cool','snow','#7ce8ff'],['fan_only','fan','#71d7c0'],['dry','drop','#c3a6ff'],['auto','thermo','#ffc574'],['heat_cool','thermo','#ffc574']])('colors enabled %s when the integration supplies no action',(mode,icon,color)=>{
  expect(climateAppearance(state(mode))).toEqual({mode,icon,color});
 });
 it.each(['off','unavailable','unknown'])('leaves %s neutral despite stale heating action',mode=>{
  expect(climateAppearance(state(mode,'heating'))).toBeUndefined();
 });
 it.each(['idle','off','unknown',''])('leaves an enabled thermostat neutral for inactive or unknown action %s',action=>{
  expect(climateAppearance(state('heat',action))).toBeUndefined();
 });
 it('keeps a reported null action neutral',()=>{
  const thermostat=state('heat');thermostat.attributes.hvac_action=null;expect(climateAppearance(thermostat)).toBeUndefined();
 });
 it('uses the actual action when automatic mode is heating or cooling',()=>{
  expect(climateAppearance(state('auto','heating'))?.mode).toBe('heat');
  expect(climateAppearance(state('auto','cooling'))?.mode).toBe('cool');
  expect(climateAppearance(state('auto','drying'))?.mode).toBe('dry');
  expect(climateAppearance(state('auto','fan'))?.mode).toBe('fan_only');
 });
 it('keeps a room active even when its first thermostat is idle',()=>{
  const states={'climate.a':state('heat','idle'),'climate.b':state('cool','cooling')};
  expect(roomClimateAppearance(Object.keys(states),states)?.mode).toBe('cool');
 });
 it('represents several simultaneous modes explicitly instead of choosing the first thermostat',()=>{
  const states={'climate.a':state('heat','heating'),'climate.b':state('cool','cooling'),'sensor.temp':state('heat','heating')};
  expect(roomClimateAppearance(Object.keys(states),states)).toEqual({mode:'mixed',icon:'thermo',color:'#efb7d9'});
  expect(roomClimateAppearance(['sensor.temp'],states)).toBeUndefined();
 });
 it('returns to neutral when all thermostats stop',()=>{
  expect(roomClimateAppearance(['climate.a','climate.b'],{'climate.a':state('heat','idle'),'climate.b':state('off')})).toBeUndefined();
 });
});
