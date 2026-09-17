import { describe, expect, it } from 'vitest';
import { alignRooms, defaultSpatialPlan, examplePlan, parseSpatial, stackFloors, validPolygon, wallSegments } from '../shared/spatial';
import { defaultProject, parseProject } from '../shared/project';
import { MPDashboardComposer } from '../shared/presentation';
import { MPDiscoveryEngine } from '../shared/discovery';
import { resolvePlan } from '../shared/rooms';
import { home } from './fixtures';

describe('spatial geometry and project persistence',()=>{
  it('draws each wall once and tells exterior walls from partitions',()=>{
    // A bedroom on the left, two rooms on the right: the bedroom's right wall is split where they meet.
    const room=(id:string,x0:number,y0:number,x1:number,y1:number)=>({id,name:id,polygon:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]] as [number,number][]});
    const walls=wallSegments([room('A',0,0,4,4),room('B',4,0,8,2),room('C',4,2,8,4)]);
    expect(walls).toHaveLength(10);
    const partitions=walls.filter(w=>w.rooms.length===2).map(w=>w.rooms.sort().join('|')).sort();
    expect(partitions).toEqual(['A|B','A|C','B|C']);
    expect(walls.filter(w=>w.rooms.length===1)).toHaveLength(7);
  });
  it('draws the wall between rooms read from a drawing once, in the middle of its thickness',()=>{
    const room=(id:string,x0:number,y0:number,x1:number,y1:number)=>({id,name:id,polygon:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]] as [number,number][]});
    // 20 cm of wall between A and B, a 5 cm step between their tops; C keeps a 60 cm corridor away from them.
    const rooms=[room('A',0,0,4,4),room('B',4.2,.05,8,4),room('C',0,4.6,8,7)],saved=structuredClone(rooms);
    const drawn=alignRooms(rooms);
    expect(rooms).toEqual(saved);
    expect(drawn[0]!.polygon).toEqual([[0,.025],[4.1,.025],[4.1,4],[0,4]]);
    expect(drawn[1]!.polygon).toEqual([[4.1,.025],[8,.025],[8,4],[4.1,4]]);
    expect(drawn[2]!.polygon).toEqual(saved[2]!.polygon);
    const walls=wallSegments(drawn);
    expect(walls.filter(w=>w.rooms.length===2).map(w=>w.rooms.join('|'))).toEqual(['A|B']);
    expect(wallSegments(rooms).every(w=>w.rooms.length===1)).toBe(true);
    // A notch narrower than a wall closes; a room narrower than a wall keeps its shape.
    const notched={id:'N',name:'N',polygon:[[0,0],[3,0],[3,2],[2.9,2],[2.9,3],[0,3]] as [number,number][]};
    expect(alignRooms([notched])[0]!.polygon).toEqual([[0,0],[2.95,0],[2.95,3],[0,3]]);
    const closet=room('D',5,0,5.25,1);
    expect(alignRooms([closet])[0]).toEqual(closet);
  });
  it('stacks the floors of the house lowest first, far enough apart to see into each one, without changing the plan',()=>{
    const room=(w:number,d:number)=>({id:'r',name:'r',polygon:[[0,0],[w,0],[w,d],[0,d]] as [number,number][]});
    const floor=(id:string,elevation:number,height:number,w=12,d=9)=>({id,name:id,elevation,height,rooms:[room(w,d)]});
    // Saved out of order, the attic at the same elevation as the first floor, a basement right under the ground floor.
    const floors=[floor('ground',0,2.6),floor('up',2.7,2.5),floor('attic',2.7,2.2),floor('basement',-.5,2.8)],saved=structuredClone(floors);
    const stack=stackFloors(floors);
    expect(floors).toEqual(saved);
    expect(stack.map(f=>f.id)).toEqual(['basement','ground','up','attic']);
    const gap=stack[1]!.elevation-stack[0]!.elevation;
    expect(stack.map(f=>f.elevation)).toEqual([0,gap,2*gap,3*gap]);
    // Clear space over the tallest floor, more for a wider house.
    expect(gap).toBeGreaterThanOrEqual(2.8+1.5);
    expect(stackFloors([floor('a',0,2.6,40,30),floor('b',3,2.6,40,30)])[1]!.elevation).toBeGreaterThan(stackFloors([floor('a',0,2.6),floor('b',3,2.6)])[1]!.elevation);
  });
  it('accepts concave rooms and rejects crossings, touching edges, duplicate points and zero area',()=>{
    expect(validPolygon([[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]])).toBe(true);
    for(const points of [ [[0,0],[3,3],[0,3],[3,0]], [[0,0],[4,0],[4,4],[2,0],[0,4]], [[0,0],[0,0],[4,4]], [[0,0],[1,1],[2,2]] ]) expect(validPolygon(points as [number,number][])).toBe(false);
  });
  it('rejects repeated ids, unbounded coordinates, arbitrary AI instructions and non-finite numbers',()=>{
    const plan=examplePlan();
    plan.floors.push(structuredClone(plan.floors[0]!));expect(()=>parseSpatial(plan)).toThrow();
    for(const point of [NaN,Infinity,201]){const p=examplePlan();p.floors[0]!.rooms[0]!.polygon[0]![0]=point;expect(()=>parseSpatial(p)).toThrow();}
    expect(()=>parseSpatial({...examplePlan(),instructions:'call a service'})).toThrow();
  });
  it('keeps plans and associations through regeneration and returns detached data',()=>{
    const project=defaultProject();project.spatial=examplePlan();project.spatial.floors[0]!.rooms[0]!.entityIds=['light.circuit_0'];
    const parsed=parseProject(project);
    const dashboard=MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(),parsed),parsed);
    expect(dashboard.views[0]!.mp_spatial).toEqual(project.spatial);
    parsed.spatial!.floors[0]!.rooms[0]!.name='Changed';expect(project.spatial.floors[0]!.rooms[0]!.name).toBe('Salon');
    expect(parseProject(defaultProject()).spatial).toBeUndefined();
  });
});

describe('default plan',()=>{
  it('lays out the HA areas per floor, without overlaps, following their equipment',()=>{
    const snapshot=home();
    snapshot.floors=[{floor_id:'etage',name:'Étage',level:1},{floor_id:'ground',name:'Rez-de-chaussée',level:0}];
    snapshot.areas=[{area_id:'salon',name:'Salon',floor_id:'ground'},{area_id:'kitchen',name:'Cuisine',floor_id:'ground'},{area_id:'wc',name:'WC'},{area_id:'chambre',name:'Chambre parentale',floor_id:'etage'},{area_id:'bureau é',name:'Bureau',floor_id:'etage'}];
    const graph=MPDiscoveryEngine.discover(snapshot,defaultProject());
    const plan=defaultSpatialPlan(graph)!;
    expect(parseSpatial(plan)).toEqual(plan);
    expect(plan.floors.map(f=>[f.id,f.name,f.elevation])).toEqual([['floor-ground','Rez-de-chaussée',0],['floor-etage','Étage',2.8]]);
    expect(plan.floors[0]!.rooms.map(r=>r.name)).toEqual(['Salon','Cuisine','WC']);
    // No stored list: the rooms show whatever their area holds when the dashboard is generated.
    expect(plan.floors.flatMap(f=>f.rooms).every(r=>r.areaId&&!r.entityIds)).toBe(true);
    expect(plan.floors[0]!.rooms[0]).toMatchObject({id:'area-salon',areaId:'salon'});
    const shown=resolvePlan(plan,graph.devices).floors[0]!.rooms;
    expect(shown[0]!.entityIds).toEqual(['light.circuit_1','light.circuit_2','light.circuit_0']);
    expect(shown[1]!.entityIds).toBeUndefined();
    expect(plan.floors[1]!.rooms.map(r=>r.id)).toEqual(['area-chambre','area-bureau__']);
    for(const floor of plan.floors){
      const boxes=floor.rooms.map(r=>({x0:Math.min(...r.polygon.map(p=>p[0])),x1:Math.max(...r.polygon.map(p=>p[0])),y0:Math.min(...r.polygon.map(p=>p[1])),y1:Math.max(...r.polygon.map(p=>p[1]))}));
      boxes.forEach((a,i)=>boxes.slice(i+1).forEach(b=>expect(Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0))).toBe(0)));
    }
  });
  it('stays valid for many areas and needs at least one area',()=>{
    const snapshot=home();snapshot.floors=[];
    snapshot.areas=Array.from({length:75},(_,i)=>({area_id:`zone_${i}`,name:`Zone ${i} ${'x'.repeat(i)}`}));
    const plan=defaultSpatialPlan(MPDiscoveryEngine.discover(snapshot,defaultProject()))!;
    expect(plan.floors).toHaveLength(1);expect(plan.floors[0]!.name).toBe('Niveau principal');expect(plan.floors[0]!.rooms).toHaveLength(60);
    snapshot.areas=[];expect(defaultSpatialPlan(MPDiscoveryEngine.discover(snapshot,defaultProject()))).toBeUndefined();
  });
  it('is shown on the home view until a plan is saved',()=>{
    const project=defaultProject();
    const views=MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(),project),project).views;
    expect(views[0]).toMatchObject({mp_spatial_origin:'areas'});expect(views[0]!.mp_spatial!.floors[0]!.rooms.map(r=>r.areaId)).toEqual(['salon','kitchen']);
    expect(views.slice(1).every(v=>!('mp_spatial' in v))).toBe(true);
    const empty={...home(),areas:[]};
    expect(MPDashboardComposer.compose(MPDiscoveryEngine.discover(empty,project),project).views[0]).toMatchObject({mp_spatial_origin:'example',mp_spatial:examplePlan()});
    project.spatial={...examplePlan(),enabled:false};
    expect(MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(),project),project).views[0]).toMatchObject({mp_spatial_origin:'project',mp_spatial:project.spatial});
  });
});
