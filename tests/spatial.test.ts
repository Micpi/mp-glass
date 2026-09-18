import { describe, expect, it } from 'vitest';
import { alignRooms, defaultSpatialPlan, examplePlan, insideRoom, nearestSide, OPENING_SIZES, openingPlacement, parseSpatial, reattachOpenings, roomArea, roomOutline, roomSize, splitSide, stackFloors, validPolygon, validRoom, wallSegments, type Point, type SpatialFloor, type SpatialRoom } from '../shared/spatial';
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
  it('bends a wall into an arc, counts its surface exactly and refuses impossible bends',()=>{
    // A 4 x 3 m room whose right wall bulges out as a quarter circle.
    const quarter=Math.tan(Math.PI/8),room={polygon:[[0,0],[4,0],[4,3],[0,3]] as Point[],arcs:[0,-quarter,0,0]};
    const radius=1.5*Math.SQRT2;
    expect(roomArea(room)).toBeCloseTo(12+radius**2/2*(Math.PI/2-1),4);
    const ring=roomOutline(room);
    expect(ring.length).toBeGreaterThan(10);
    expect(Math.max(...ring.map(p=>p[0]))).toBeCloseTo(4+quarter*1.5,3);
    expect(Math.max(...roomOutline(room,8).map(p=>p[0]))).toBeCloseTo(4+quarter*1.5,2);  // fewer pieces, same curve
    expect(roomOutline(room,8).length).toBeLessThanOrEqual(ring.length);
    expect(validRoom(room)).toBe(true);
    expect(validRoom({...room,arcs:[0,-quarter,0]})).toBe(false);  // one bend per side
    expect(validRoom({...room,arcs:[0,2,0,0]})).toBe(false);  // beyond a half circle
    expect(validRoom({polygon:[[0,0],[4,0],[4,4],[0,4]],arcs:[1,0,1,0]})).toBe(false);  // two half circles meeting inside
    // A straight-sided room is untouched by the bends it does not have.
    expect(roomOutline({polygon:[[0,0],[4,0],[4,3],[0,3]]})).toHaveLength(4);
    // A corner added halfway along a half circle leaves two quarter circles.
    const split=splitSide([[0,0],[4,0],[4,3],[0,3]],[0,1,0,0],1);
    expect(split.polygon).toHaveLength(5);
    expect(split.arcs!.map(b=>Math.round(b*1e4)/1e4)).toEqual([0,.4142,.4142,0,0]);
  });
  it('measures a room along its own walls, drawn at an angle as well as upright',()=>{
    const angle=Math.PI/9,turn=([x,y]:Point):Point=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
    const upright=roomSize({polygon:[[0,0],[5,0],[5,3],[0,3]]});
    expect([upright.width,upright.depth,upright.rectangle]).toEqual([5,3,true]);
    const tilted=roomSize({polygon:([[0,0],[5,0],[5,3],[0,3]] as Point[]).map(turn)});
    expect(tilted.width).toBeCloseTo(5,9);expect(tilted.depth).toBeCloseTo(3,9);expect(tilted.rectangle).toBe(true);
    expect(tilted.angle).toBeCloseTo(angle,9);
    expect(roomSize({polygon:[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]]}).rectangle).toBe(false);
  });
  it('draws a curved wall shared by two rooms once, following its curve',()=>{
    const bulge=.5;
    const left={id:'A',name:'A',polygon:[[0,0],[4,0],[4,3],[0,3]] as Point[],arcs:[0,bulge,0,0]};
    // The same wall walked the other way bends the other way round.
    const right={id:'B',name:'B',polygon:[[4,0],[8,0],[8,3],[4,3]] as Point[],arcs:[0,0,0,-bulge]};
    const walls=wallSegments([left,right]),shared=walls.filter(w=>w.rooms.length===2);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.rooms.sort()).toEqual(['A','B']);
    expect(shared[0]!.path!.length).toBeGreaterThan(4);
    // Its middle bulges towards the first room by the height of the arc.
    const middle=shared[0]!.path![Math.floor(shared[0]!.path!.length/2)]!;
    expect(middle[0]).toBeCloseTo(4-bulge*1.5,2);
    expect(walls.filter(w=>w.rooms.length===1).every(w=>!w.path)).toBe(true);
  });
  it('brings the walls of a wing drawn at an angle together, and keeps its right angles',()=>{
    const angle=Math.PI/18,turn=([x,y]:Point):Point=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
    const room=(id:string,x0:number,y0:number,x1:number,y1:number)=>({id,name:id,polygon:([[x0,y0],[x1,y0],[x1,y1],[x0,y1]] as Point[]).map(turn)});
    // Two rooms of a wing turned by 10°, 20 cm of wall apart.
    const rooms=[room('A',0,0,4,3),room('B',4.2,0,8,3)],saved=structuredClone(rooms);
    const drawn=alignRooms(rooms);
    expect(rooms).toEqual(saved);
    // Their shared wall is drawn once, in the middle of its thickness, and their corners meet exactly.
    expect(drawn[0]!.polygon[1]).toEqual(drawn[1]!.polygon[0]);
    expect(drawn[0]!.polygon[2]).toEqual(drawn[1]!.polygon[3]);
    expect(wallSegments(drawn).filter(w=>w.rooms.length===2).map(w=>w.rooms.join('|'))).toEqual(['A|B']);
    const sides=drawn[0]!.polygon.map((a,i)=>{const b=drawn[0]!.polygon[(i+1)%4]!;return Math.atan2(b[1]-a[1],b[0]-a[0]);});
    const offAxis=(value:number)=>{const rest=Math.abs(value)%(Math.PI/2);return Math.min(rest,Math.PI/2-rest);};
    for(const side of sides)expect(offAxis(side-angle)).toBeCloseTo(0,9);
    expect(Math.hypot(drawn[0]!.polygon[1]![0]-drawn[0]!.polygon[0]![0],drawn[0]!.polygon[1]![1]-drawn[0]!.polygon[0]![1])).toBeCloseTo(4.1,9);
    // A room with a curved wall keeps its bend, and its straight walls still meet its neighbour's.
    const curved=alignRooms([{...room('C',0,0,4,3),arcs:[.5,0,0,0]},room('D',4.2,0,8,3)]);
    expect(curved[0]!.arcs).toEqual([.5,0,0,0]);
    expect(curved[0]!.polygon[1]![0]).toBeCloseTo(curved[1]!.polygon[0]![0],9);
    expect(curved[0]!.polygon[1]![1]).toBeCloseTo(curved[1]!.polygon[0]![1],9);
    expect(wallSegments(curved).filter(w=>w.rooms.length===2)).toHaveLength(1);
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
  it('brings every floor over the middle of the house, whatever its size and where it was drawn',()=>{
    const box=(id:string,x:number,y:number,w:number,d:number)=>({id,name:id,polygon:[[x,y],[x+w,y],[x+w,y+d],[x,y+d]] as Point[]});
    // A wide ground floor, and a small first floor drawn well off to the side of it.
    const floors:SpatialFloor[]=[{id:'ground',name:'ground',elevation:0,height:2.6,rooms:[box('a',0,0,12,9)]},
      {id:'up',name:'up',elevation:2.7,height:2.5,rooms:[box('b',20,4,6,4),box('c',26,4,2,4)]}];
    const saved=structuredClone(floors),stack=stackFloors(floors);
    expect(floors).toEqual(saved);
    const middle=(f:SpatialFloor)=>{const p=f.rooms.flatMap(r=>r.polygon);
      return [(Math.min(...p.map(q=>q[0]))+Math.max(...p.map(q=>q[0])))/2,(Math.min(...p.map(q=>q[1]))+Math.max(...p.map(q=>q[1])))/2];};
    // Both floors about one centre, that of the house as drawn.
    expect(middle(stack[0]!)).toEqual(middle(stack[1]!));
    expect(middle(stack[0]!)[0]).toBeCloseTo(14,9);expect(middle(stack[0]!)[1]).toBeCloseTo(4.5,9);
    // Each floor is only moved: its rooms keep their shape and their places relative to one another.
    expect(stack[1]!.rooms.map(r=>roomArea(r))).toEqual([24,8]);
    expect(stack[1]!.rooms[1]!.polygon[0]![0]-stack[1]!.rooms[0]!.polygon[0]![0]).toBeCloseTo(6,9);
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

describe('doors, windows, televisions and speakers',()=>{
  const rectangle=(x0:number,y0:number,x1:number,y1:number):Point[]=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const plan=(room:Partial<SpatialRoom>)=>({version:1 as const,enabled:true,floors:[{id:'ground',name:'RDC',elevation:0,height:2.6,rooms:[{id:'living',name:'Salon',polygon:rectangle(0,0,5,4),...room}]}]});
  it('stand on their wall, face into their room and keep within the wall',()=>{
    const room:SpatialRoom={id:'living',name:'Salon',polygon:rectangle(0,0,5,4)};
    // The top wall, from (0, 0) to (5, 0): the room lies below it, whichever way its corners turn.
    const placed=openingPlacement(room,{id:'w',kind:'window',side:0,at:.5,width:1.2})!;
    expect(placed.center).toEqual([2.5,0]);expect(placed.tangent).toEqual([1,0]);expect(placed.inward[1]).toBeCloseTo(1);
    expect({height:placed.height,sill:placed.sill}).toEqual({height:OPENING_SIZES.window.height,sill:OPENING_SIZES.window.sill});
    const reversed={...room,polygon:[...room.polygon].reverse()};
    expect(openingPlacement(reversed,{id:'w',kind:'door',side:2,at:.5,width:.9})!.inward[1]).toBeCloseTo(1);
    // Near a corner or wider than the wall: it stays within the wall.
    const corner=openingPlacement(room,{id:'d',kind:'door',side:1,at:0,width:.9,height:2.2})!;
    expect(corner.center[1]).toBeCloseTo(.45);expect(corner.height).toBe(2.2);
    expect(openingPlacement(room,{id:'b',kind:'french_window',side:1,at:.5,width:9})!.width).toBeCloseTo(3.9);
    expect(openingPlacement(room,{id:'x',kind:'door',side:4,at:.5,width:.9})).toBeUndefined();
    // On a curved wall, on the curve, along it.
    const bay={...room,arcs:[0,-Math.tan(Math.PI/8),0,0]};
    const curved=openingPlacement(bay,{id:'c',kind:'window',side:1,at:.5,width:1})!;
    expect(curved.center[0]).toBeCloseTo(5+2*Math.tan(Math.PI/8),3);expect(curved.tangent[1]).toBeCloseTo(1);expect(curved.inward[0]).toBeCloseTo(-1);
  });
  it('find the wall nearest to a point touched on the plan, straight or curved, and tell inside from outside',()=>{
    const room={polygon:rectangle(0,0,5,4)};
    expect(nearestSide(room,[5.05,1])).toMatchObject({side:1,t:.25});
    expect(nearestSide(room,[2,-.1]).side).toBe(0);
    const bay={polygon:rectangle(0,0,5,4),arcs:[0,-Math.tan(Math.PI/8),0,0]};
    const near=nearestSide(bay,[5+2*Math.tan(Math.PI/8),2]);
    expect(near.side).toBe(1);expect(near.t).toBeCloseTo(.5);expect(near.distance).toBeLessThan(1e-6);
    expect(insideRoom(room,[2,2])).toBe(true);expect(insideRoom(room,[6,2])).toBe(false);
    expect(insideRoom(bay,[5.5,2])).toBe(true);
  });
  it('follow a change of corners: kept on their wall, moved to the nearest one, or dropped far from every wall',()=>{
    const before:SpatialRoom={id:'r',name:'R',polygon:rectangle(0,0,5,4),openings:[{id:'a',kind:'window',side:1,at:.25,width:1},{id:'b',kind:'door',side:0,at:.5,width:.9}]};
    // Same count of corners: nothing moves.
    expect(reattachOpenings(before,{...before,polygon:rectangle(0,0,6,4)})).toEqual(before.openings);
    // A corner added in the middle of the top wall: the door lands on either half, the window keeps its place on the right wall.
    const split=reattachOpenings(before,{...before,polygon:[[0,0],[2.5,0],[5,0],[5,4],[0,4]]});
    expect(split.find(o=>o.id==='a')).toMatchObject({side:2,at:.25});
    expect([0,1]).toContain(split.find(o=>o.id==='b')!.side);
    // The top right corner removed: the right wall becomes a diagonal far from the window, which goes.
    expect(reattachOpenings(before,{...before,polygon:[[0,0],[5,4],[0,4]]}).map(o=>o.id)).toEqual([]);
  });
  it('are part of the saved plan, checked like its geometry',()=>{
    const openings=[{id:'baie',kind:'french_window' as const,side:0,at:.5,width:2.4,entityIds:['cover.salon','binary_sensor.baie']}];
    const media=[{id:'tv',kind:'tv' as const,at:[2.5,3.6] as Point,entityId:'media_player.salon'}];
    expect(parseSpatial(plan({openings,media})).floors[0]!.rooms[0]).toMatchObject({openings,media});
    const refused=[
      {openings:[{...openings[0]!,side:4}]},{openings:[openings[0]!,{...openings[0]!}]},{media:[media[0]!,{...media[0]!}]},
      {openings:[{...openings[0]!,entityIds:['light.salon']}]},{openings:[{...openings[0]!,width:.1}]},{openings:[{...openings[0]!,kind:'garage'}]},
      {media:[{...media[0]!,entityId:'light.salon'}]},{media:[{...media[0]!,kind:'radio'}]},{openings:[{...openings[0]!,at:1.2}]},
    ];
    for(const room of refused)expect(()=>parseSpatial(plan(room as Partial<SpatialRoom>))).toThrow();
    const project=parseProject({...defaultProject(),spatial:plan({openings,media})});
    expect(project.spatial!.floors[0]!.rooms[0]!.openings).toEqual(openings);
  });
  it('move with their room when the floors of the house are stacked',()=>{
    const floors:SpatialFloor[]=[
      {id:'a',name:'A',elevation:0,height:2.5,rooms:[{id:'r',name:'R',polygon:rectangle(0,0,10,6)}]},
      {id:'b',name:'B',elevation:2.5,height:2.5,rooms:[{id:'r',name:'R',polygon:rectangle(0,0,4,2),media:[{id:'s',kind:'speaker',at:[1,1]}],openings:[{id:'w',kind:'window',side:0,at:.5,width:1}]}]},
    ];
    const upstairs=stackFloors(floors)[1]!.rooms[0]!;
    expect(upstairs.polygon[0]).toEqual([3,2]);expect(upstairs.media![0]!.at).toEqual([4,3]);
    expect(upstairs.openings).toEqual(floors[1]!.rooms[0]!.openings);
    expect(floors[1]!.rooms[0]!.media![0]!.at).toEqual([1,1]);
  });
});
