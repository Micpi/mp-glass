import { describe, expect, it } from 'vitest';
import { home } from './fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { MPCapabilityEngine, brightnessPercent } from '../shared/capabilities';
import { defaultProject, migrateProject, parseProject } from '../shared/project';
import { MPCardRegistry, MPDashboardComposer } from '../shared/presentation';
import { HARegistryReader, type Hass } from '../frontend/ha/client';

describe('discovery and presentation contract',()=>{
  it('discovers Salon lights and produces the corresponding card without brand signals',()=>{
    const graph=MPDiscoveryEngine.discover(home(),defaultProject());
    expect(graph.devices[0]).toMatchObject({id:'logical:stable-0',areaId:'salon',floorId:'ground',category:'light',confidence:.99});
    expect(MPDashboardComposer.compose(graph,defaultProject()).views[1]?.cards[0]).toMatchObject({type:'custom:mp-glass-light-v3',entity:'light.circuit_0'});
  });
  it('keeps independent circuits on one device and parent relationships',()=>{
    const graph=MPDiscoveryEngine.discover(home(),defaultProject());
    expect(graph.devices).toHaveLength(3);
    expect(graph.sourceDevices.find(d=>d.id==='device-1')?.via_device_id).toBe('bridge');
  });
  it('entity area wins over device, then project override wins and survives rescans',()=>{
    const snapshot=home(); snapshot.entities[0]!.area_id='kitchen';
    expect(MPDiscoveryEngine.discover(snapshot,defaultProject()).devices[0]?.areaId).toBe('kitchen');
    const project=defaultProject();project.overrides['stable-0']={areaId:'salon',name:'Override',hidden:true};
    const original=JSON.stringify(project);
    const graph=MPDiscoveryEngine.discover(snapshot,project);
    expect(graph.devices[0]).toMatchObject({areaId:'salon',name:'Override',hidden:true});
    MPDiscoveryEngine.discover(snapshot,project);
    expect(JSON.stringify(project)).toBe(original);
    expect(MPDashboardComposer.compose(graph,project).views[0]?.cards).toHaveLength(2);
  });
  it('survives renamed entity IDs with stable registry overrides',()=>{
    const snapshot=home();snapshot.entities[0]!.entity_id='light.renamed'; delete snapshot.states['light.circuit_0'];
    const project=defaultProject();project.overrides['stable-0']={name:'My stable override'};
    expect(MPDiscoveryEngine.discover(snapshot,project).devices[0]?.name).toBe('My stable override');
  });
  it('is independent of registry order',()=>{
    const a=home(); const b=structuredClone(a); b.entities.reverse();b.devices.reverse();b.areas.reverse();
    expect(MPDashboardComposer.compose(MPDiscoveryEngine.discover(a,defaultProject()),defaultProject())).toEqual(MPDashboardComposer.compose(MPDiscoveryEngine.discover(b,defaultProject()),defaultProject()));
  });
  it('falls back for unknown domains, refusing incompatible presentation overrides',()=>{
    const snapshot=home(0);snapshot.entities=[{id:'odd',entity_id:'future.thing'}];snapshot.states['future.thing']={entity_id:'future.thing',state:'unavailable',attributes:{}};
    const project=defaultProject();project.overrides.odd={presentation:'light'};
    const graph=MPDiscoveryEngine.discover(snapshot,project);
    expect(graph.warnings).toContain('incompatible_override:odd');
    const dashboard=MPDashboardComposer.compose(graph,project);
    expect(dashboard.views[0]?.cards).toEqual([]);
    expect(dashboard.views.find(v=>v.path==='inventory')?.cards[0]?.type).toBe('custom:mp-glass-generic-v3');
  });
  it('does not expose hidden or disabled entities by default',()=>{
    const snapshot=home();snapshot.entities[0]!.hidden_by='user';snapshot.entities[1]!.disabled_by='integration';
    const graph=MPDiscoveryEngine.discover(snapshot,defaultProject());
    expect(graph.devices).toHaveLength(3);
    expect(MPDashboardComposer.compose(graph,defaultProject()).views[0]?.cards).toHaveLength(1);
  });
  it('keeps a large technical inventory out of the home and room views',()=>{
    const snapshot=home(1);
    for(let i=0;i<600;i++) snapshot.entities.push({id:`technical-${i}`,entity_id:`sensor.technical_${i}`,area_id:'salon'});
    const dashboard=MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot,defaultProject()),defaultProject());
    expect(dashboard.views[0]?.cards).toHaveLength(1);
    expect(dashboard.views.find(v=>v.path==='area-salon')?.cards).toHaveLength(1);
    expect(dashboard.views.find(v=>v.path==='inventory')?.cards).toHaveLength(600);
  });
});
describe('capabilities',()=>{
  it('does not infer dimming from current brightness',()=>{
    const snapshot=home();
    expect(MPCapabilityEngine.detect('light.circuit_1',snapshot.states['light.circuit_1']).map(c=>c.capability)).toEqual(['POWER']);
  });
  it('keeps RGBW separate and detects effects',()=>{
    expect(MPCapabilityEngine.detect('light.a',{entity_id:'light.a',state:'on',attributes:{supported_color_modes:['rgbw'],supported_features:4}}).map(c=>c.capability)).toEqual(['POWER','DIM','RGBW','EFFECT']);
  });
  it('handles missing and non-finite values',()=>{
    expect(brightnessPercent(undefined)).toBeUndefined();expect(brightnessPercent(NaN)).toBeUndefined();expect(brightnessPercent(255)).toBe(100);expect(brightnessPercent(-1)).toBe(0);
  });
});
describe('project contract',()=>{
  it('exports, imports and migrates v1 without mutating input',()=>{
    const project=defaultProject();project.roles.primary_light='logical:stable-0';
    expect(migrateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    const copy=parseProject(project);copy.project.name='Different';expect(project.project.name).toBe('MP Glass');
  });
  it.each([{...defaultProject(),schema_version:2},{...defaultProject(),token:'secret'},{...defaultProject(),appearance:{preset:'invalid'}},{...defaultProject(),overrides:{x:{pin:'1234'}}}])('rejects unsupported or secret-bearing data',value=>expect(()=>parseProject(value)).toThrow('invalid_project'));
  it('requires a fallback and rejects duplicate card registrations',()=>{
    const registry=new MPCardRegistry();const graph=MPDiscoveryEngine.discover(home(),defaultProject());
    expect(()=>registry.resolve(graph.devices[0]!)).toThrow('missing_fallback');
    const card={type:'custom:a',categories:['light' as const],requires:[],priority:1,variants:[]};registry.register(card);expect(()=>registry.register(card)).toThrow('duplicate_card');
  });
});
describe('registry boundary',()=>{
  it('caches structure without freezing live states and permits explicit rescan',async()=>{
    let calls=0; const hass={connection:{},states:home().states,callWS:async()=>{calls++;return [];}} as unknown as Hass;
    await HARegistryReader.read(hass);await HARegistryReader.read({...hass,states:{}});expect(calls).toBe(4);
    expect((await HARegistryReader.read({...hass,states:{}})).states).toEqual({});
    await HARegistryReader.read(hass,true);expect(calls).toBe(8);
  });
  it('does not turn denied registry access into an empty successful scan',async()=>{
    const hass={connection:{},states:{},callWS:async()=>{throw {code:'unauthorized'};}} as unknown as Hass;
    await expect(HARegistryReader.read(hass)).rejects.toEqual({code:'unauthorized'});
  });
});
describe('structural performance budget',()=>{
  it.each([20,100,500,1000])('composes %i lights within 500ms',count=>{
    const snapshot=home(count);const start=performance.now();const graph=MPDiscoveryEngine.discover(snapshot,defaultProject());const dashboard=MPDashboardComposer.compose(graph,defaultProject());
    const duration=performance.now()-start;expect(dashboard.views[0]?.cards).toHaveLength(count);expect(duration).toBeLessThan(500);
    console.info(`MP Glass ${count} entities: ${duration.toFixed(2)} ms`);
  });
});
