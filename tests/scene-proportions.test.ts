import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { SpatialScene, type SceneLevel } from '../frontend/spatial/scene';
import { wallSegments, type SpatialFloor } from '../shared/spatial';

interface OpeningProbe { leaves:{pivot:T.Group}[]; covers:Map<string,{group:T.Group}> }
interface SceneProbe {
  group:T.Group;
  openingParts:Map<string,OpeningProbe>;
  addLevel(level:SceneLevel,stacked:boolean):void;
  drawCover(parts:OpeningProbe,cover:{group:T.Group},closed:number):void;
}
/** Use the real scene geometry without starting WebGL, camera controls or canvas textures. */
function levelScene(elevation:number,height:number,walls=true){
  const scene=Object.assign(Object.create(SpatialScene.prototype),{
    group:new T.Group(),walls,rooms:new Map(),wallParts:[],levels:new Map(),surfaces:[],solids:[],
    openingParts:new Map(),mediaParts:new Map(),laundryParts:new Map(),laundryMode:true,haloTexture:()=>undefined,
  }) as SceneProbe;
  const floor:SpatialFloor={id:'floor',name:'Niveau',elevation,height,rooms:[{id:'room',name:'Pièce',polygon:[[0,0],[5,0],[5,4],[0,4]]}]};
  scene.addLevel({floor,segments:wallSegments(floor.rooms),openings:[
    {key:'window',room:'room',kind:'window',center:[2,0],tangent:[1,0],inward:[0,1],width:1.2,height:1.2,sill:.9,covers:[{id:'shutter',style:'outside'},{id:'blind',style:'inside'},{id:'curtain',style:'curtain'}]},
    {key:'door',room:'room',kind:'door',center:[4,0],tangent:[1,0],inward:[0,1],width:.9,height:2.1,sill:0,covers:[]},
  ],media:[{key:'tv',room:'room',kind:'tv',at:[2,2],facing:[0,1]},{key:'speaker',room:'room',kind:'speaker',at:[3,2],facing:[0,1]}],laundry:[
    {key:'washer',room:'room',kind:'washer',at:[1,2],running:false,rotation:0,elevation:0,width:.6,height:.85,depth:.65},
    {key:'dryer',room:'room',kind:'dryer',at:[1,2],running:false,rotation:0,elevation:.85,width:.6,height:.85,depth:.65},
  ]},false);
  return scene;
}
function meshes(root:T.Object3D){const result:T.Mesh[]=[];root.traverse(object=>{if(object instanceof T.Mesh)result.push(object);});return result;}
function verticalSpan(mesh:T.Mesh,height:number){return mesh.localToWorld(new T.Vector3(0,height/2,0)).distanceTo(mesh.localToWorld(new T.Vector3(0,-height/2,0)));}

describe('world proportions of spatial fixtures',()=>{
  it.each([[0,2.6],[2.6,3.4],[-2.4,2.2]])('keeps dimensions and floor elevation at %s m with %s m walls',(elevation,height)=>{
    const scene=levelScene(elevation,height);
    for(const [key,expected] of [['window',1.2],['door',2.1]] as const){
      const leaf=scene.openingParts.get(key)!.leaves[0]!.pivot;
      const pane=meshes(leaf).find(mesh=>mesh.geometry instanceof T.PlaneGeometry)!;
      expect(verticalSpan(pane,expected)).toBeCloseTo(expected);
      expect(leaf.getWorldPosition(new T.Vector3()).y).toBeCloseTo(elevation+(key==='window'?.9:0));
    }
    const tv=meshes(scene.group).find(mesh=>mesh.geometry instanceof T.PlaneGeometry&&mesh.geometry.parameters.width===1.12)!;
    expect(verticalSpan(tv,.64)).toBeCloseTo(.64);
    expect(tv.getWorldPosition(new T.Vector3()).y).toBeCloseTo(elevation+1.12);
    const speaker=meshes(scene.group).find(mesh=>mesh.geometry instanceof T.CylinderGeometry&&mesh.geometry.parameters.height===.95)!;
    expect(verticalSpan(speaker,.95)).toBeCloseTo(.95);
    expect(speaker.getWorldPosition(new T.Vector3()).y-.95/2).toBeCloseTo(elevation);
    const cabinets=meshes(scene.group).filter(mesh=>mesh.geometry instanceof T.BoxGeometry&&mesh.geometry.parameters.height===.82);
    expect(cabinets).toHaveLength(2);
    expect(cabinets[1]!.getWorldPosition(new T.Vector3()).y-cabinets[0]!.getWorldPosition(new T.Vector3()).y).toBeCloseTo(.85);
    const opening=scene.openingParts.get('window')!;
    for(const [id,expected] of [['shutter',.6],['blind',.6],['curtain',1.43]] as const){
      const cover=opening.covers.get(id)!;scene.drawCover(opening,cover,.5);
      const panel=meshes(cover.group)[0]!;
      expect(verticalSpan(panel,expected)).toBeCloseTo(expected);
    }
  });
  it('keeps audio equipment at full height with lowered walls and shows opening marks on the floor',()=>{
    const scene=levelScene(-2.4,2.2,false);
    expect(scene.openingParts.get('window')!.leaves).toHaveLength(0);
    const mark=meshes(scene.group).find(mesh=>mesh.geometry instanceof T.BoxGeometry&&mesh.geometry.parameters.height===.012)!;
    expect(mark.getWorldPosition(new T.Vector3()).y).toBeCloseTo(-2.4+.045);
    const speaker=meshes(scene.group).find(mesh=>mesh.geometry instanceof T.CylinderGeometry&&mesh.geometry.parameters.height===.95)!;
    expect(verticalSpan(speaker,.95)).toBeCloseTo(.95);
  });
});
