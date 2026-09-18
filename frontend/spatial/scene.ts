import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MediaKind, OpeningKind, Point, SpatialFloor, WallSegment } from '../../shared/spatial';
import type { CoverStyle, RoomAmbient } from '../../shared/spatial-state';

/**
 * A wall following `points` on the floor, `thickness` thick and `height` tall, built as one piece so that a curved wall
 * shows no facets: its two faces, its top, its foot and its two ends, each wound outwards as a box's are. Its own frame
 * stands on the floor: y goes from 0 to `height`.
 */
function wallGeometry(points:readonly Point[],thickness:number,height:number){
  const half=thickness/2;
  const sides=points.map((p,i)=>{
    const before=points[i-1]??p,after=points[i+1]??p;
    const dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz)||1;
    return {p,offset:[-dz/length*half,dx/length*half]};
  });
  const position:number[]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>{position.push(...a,...b,...c,...a,...c,...d);};
  const at=(p:number[],y:number)=>[p[0]!,y,p[1]!];
  const face=(p:{p:Point;offset:number[]},sign:number)=>[p.p[0]+sign*p.offset[0]!,p.p[1]+sign*p.offset[1]!];
  for(let i=1;i<sides.length;i++){
    const [outer0,outer1]=[face(sides[i-1]!,1),face(sides[i]!,1)],[inner0,inner1]=[face(sides[i-1]!,-1),face(sides[i]!,-1)];
    quad(at(outer0,0),at(outer1,0),at(outer1,height),at(outer0,height));
    quad(at(inner1,0),at(inner0,0),at(inner0,height),at(inner1,height));
    quad(at(outer0,height),at(outer1,height),at(inner1,height),at(inner0,height));
    quad(at(inner0,0),at(inner1,0),at(outer1,0),at(outer0,0));
  }
  for(const [side,first] of [[sides[0]!,true],[sides.at(-1)!,false]] as const){
    const [outer,inner]=[face(side,1),face(side,-1)];
    if(first)quad(at(inner,0),at(outer,0),at(outer,height),at(inner,height));
    else quad(at(outer,0),at(inner,0),at(inner,height),at(outer,height));
  }
  return new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(position,3));
}

type Projection = Map<string,{x:number;y:number;visible:boolean}>;
/** Where each floor of a stack stands on screen: the middle of the floor, and the left and right ends of its footprint. */
export type LevelProjection = Map<string,{x:number;y:number;left:number;right:number;visible:boolean}>;
/** A camera kept as the user left it, told relative to the house so a redrawn or edited plan keeps the same view. */
export interface CameraView { target:[number,number,number]; offset:[number,number,number]; fov:number }
/**
 * A door or a window as drawn: its middle on its wall, `tangent` along the wall and `inward` into its room, its width and,
 * from the floor, its sill and its height. `covers`: its shutters, blinds and curtains, and how each hangs.
 */
export interface SceneOpening { key:string; room:string; kind:OpeningKind; center:Point; tangent:Point; inward:Point; width:number; height:number; sill:number; covers:{id:string;style:CoverStyle}[] }
/** A television or a speaker standing at `at`, a television turned towards `facing`. */
export interface SceneMedia { key:string; room:string; kind:MediaKind; at:Point; facing:Point }
/** A floor to draw at its elevation, with its walls, doors and windows, televisions and speakers. Room ids must be unique across the floors drawn together. */
export interface SceneLevel { floor:SpatialFloor; segments:WallSegment[]; openings?:SceneOpening[]; media?:SceneMedia[] }
/** A door or window open (its contact sensor says so), and how much of it each cover hides, 0 open to 1 closed, undefined unknown. */
export interface OpeningState { open:boolean; covers:Record<string,number|undefined> }
export interface MediaState { on:boolean; playing:boolean }
interface RoomParts { floor:string; surface:T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>; glow:T.Mesh<T.ShapeGeometry,T.ShaderMaterial>; anchor:T.Vector3; radius:number }
interface WallParts { floor:string; rooms:string[]; mesh:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>; lines:T.LineBasicMaterial; exterior:boolean }
/** Leaves turn about their hinge: `sign` is the way that swings them into the room. */
interface Leaf { pivot:T.Group; sign:number }
interface CoverParts { group:T.Group; style:CoverStyle; fill:T.MeshBasicMaterial; lines:T.LineBasicMaterial }
interface OpeningParts { room:string; opening:SceneOpening; frame:T.LineBasicMaterial; leaves:Leaf[]; covers:Map<string,CoverParts>; bottom:number; top:number; swing:number }
interface MediaParts { room:string; kind:MediaKind; screen:T.MeshBasicMaterial; frame:T.LineBasicMaterial; glow?:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>; rings?:T.Group }
/** Colours of what the walls hold: frames, glass, door leaves, and each kind of cover. */
const FRAME=0xe3f3ff,OPEN_FRAME=0x8ff0c8,GLASS=0xaee2ff,LEAF=0x8fb8d8,SHUTTER=0xd4e6f6,BLIND=0xe8eef4,CURTAIN=0xf3dcc0,PLAYING=0x7fd0ff;
/** How far each kind of leaf turns when its contact sensor says it is open. */
const SWING:Record<OpeningKind,number>={door:Math.PI*.38,french_window:Math.PI*.3,window:Math.PI*.2};
/** Line segments from pairs of points, each [x, y, z]. */
const strokes=(points:number[][],material:T.LineBasicMaterial)=>new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points.flat(),3)),material);
/** A floor of a stack: the middle of its box, its size, and the corners of its footprint halfway up. */
interface LevelParts { center:T.Vector3; radius:number; corners:T.Vector3[] }
/** Extra pixels around the house still counted as "on the plan" for a finger. */
const SLOP=14;
/** Field of view of the house in perspective; from above almost none, so that walls stand straight instead of leaning outwards. */
const FOV=38,TOP_FOV=5;
/** A wheel gesture keeps its first target (plan or page) while its events follow each other. */
const WHEEL_GAP=300;

/**
 * Three.js floor renderer. A gesture only drives the camera when it starts on the house (rooms or walls);
 * started beside it, it is left to the page so a phone can scroll past the plan.
 */
export class SpatialScene {
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(FOV,1,.05,2000);
  private scene = new T.Scene();
  private group = new T.Group();
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private rooms = new Map<string,RoomParts>();
  private surfaces: T.Object3D[] = [];
  private solids: T.Object3D[] = [];
  private wallParts: WallParts[] = [];
  private openingParts = new Map<string,OpeningParts>();
  private mediaParts = new Map<string,MediaParts>();
  /** States last drawn on doors, windows and players, kept to draw them again on a plan drawn anew. */
  private openingStates: ReadonlyMap<string,OpeningState> = new Map();
  private mediaStates: ReadonlyMap<string,MediaState> = new Map();
  private fixtureKey = '';
  /** While set, the next tap on the house gives the point touched on the plan, and the room under it, instead of selecting a room. */
  picking?: (point:Point,room:string)=>void;
  private levels = new Map<string,LevelParts>();
  private ray = new T.Raycaster();
  private halo?: T.CanvasTexture;
  private center = new T.Vector3();
  private radius = 10;
  /** Farther back for a stack of floors, as tall on screen as it is wide, where one floor lies flat. */
  private depth = 1;
  private walls = true;
  private styled = '';
  private down = {x:0,y:0};
  private mode?: 'plan'|'page';
  private pointers = new Map<number,boolean>();
  private touches = 0;
  private wheelMode?: 'plan'|'page';
  private wheelAt = 0;
  private hover = 0;
  private tween = 0;
  /** Pixels kept free on the left of the stage for labels beside the house, less those the controls take on its right. */
  private margin = 0;
  /** Called once the camera flight ends, or when a gesture cuts it short. */
  private landing?: ()=>void;
  /**
   * `select` receives the room touched and its floor; `project` the rooms on screen, or the floors when several are drawn;
   * `point` the floor under the mouse when several are drawn ('' beside them).
   */
  constructor(private host: HTMLElement, private select: (room:string,floor:string)=>void, private project: (rooms:Projection,levels:LevelProjection)=>void, private engage: ()=>void = ()=>{}, private point: (floor:string)=>void = ()=>{}) {
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setClearColor(0x000000,0);
    this.host.append(this.renderer.domElement);
    const canvas=this.renderer.domElement;
    canvas.tabIndex=0; canvas.setAttribute('aria-label','Plan 3D interactif');canvas.setAttribute('role','img');
    this.controls=new OrbitControls(this.camera,canvas);
    this.controls.enableDamping=false;this.controls.minDistance=1;this.controls.maxDistance=1000;this.controls.maxPolarAngle=Math.PI*.49;
    // OrbitControls blocks every touch scroll; vertical scrolling stays native and is cancelled only for gestures on the house.
    canvas.style.touchAction='pan-y';
    this.controls.addEventListener('change',this.render);
    this.controls.addEventListener('start',this.stopTween);
    this.controls.listenToKeyEvents(canvas);
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])host.addEventListener(type,this.gate as EventListener,true);
    host.addEventListener('wheel',this.wheelGate,{capture:true,passive:true});
    window.addEventListener('pointerup',this.release);window.addEventListener('pointercancel',this.release);
    canvas.addEventListener('touchstart',this.touch,{passive:false});canvas.addEventListener('touchmove',this.touch,{passive:false});
    canvas.addEventListener('touchend',this.touch);canvas.addEventListener('touchcancel',this.touch);
    canvas.addEventListener('keydown',this.key);
    canvas.addEventListener('pointerdown',this.pointerDown);
    canvas.addEventListener('pointerup',this.pointerUp);
    canvas.addEventListener('pointermove',this.hoverCursor);
    canvas.addEventListener('pointerleave',this.leave);
    this.scene.add(this.group);
    this.observer=new ResizeObserver(()=>{const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.shift();this.render();});
    this.observer.observe(this.host);
  }
  /** Moves the picture, not the camera, so that the house stands in the middle of the room left to it; rays and projections follow. */
  private shift(){
    const {clientWidth:w,clientHeight:h}=this.host;
    if(this.margin&&w&&h)this.camera.setViewOffset(w,h,-this.margin/2,0,w,h);else this.camera.clearViewOffset();
  }
  /** Keeps `left` pixels free on the left of the stage and `right` on its right; whether that changed anything (the plan is then drawn again). */
  reserve(left:number,right=0){
    if(Math.abs(left-right-this.margin)<2)return false;
    this.margin=left-right;this.shift();this.render();
    return true;
  }
  /** First object hit at (x, y), trying a few neighbouring points when `slop` is set. */
  private cast(x:number,y:number,slop:number,targets:T.Object3D[]) {return this.hit(x,y,slop,targets)?.object;}
  private hit(x:number,y:number,slop:number,targets:T.Object3D[]) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height||!targets.length)return undefined;
    const offsets:[number,number][]=slop?[[0,0],[slop,0],[-slop,0],[0,slop],[0,-slop]]:[[0,0]];
    for(const [dx,dy] of offsets){
      this.ray.setFromCamera(new T.Vector2((x+dx-rect.left)/rect.width*2-1,-(y+dy-rect.top)/rect.height*2+1),this.camera);
      const hit=this.ray.intersectObjects(targets,false)[0];
      if(hit)return hit;
    }
    return undefined;
  }
  private onPlan(x:number,y:number,slop:number){return !!this.cast(x,y,slop,this.solids);}
  private decide(x:number,y:number,slop:number){this.mode??=this.onPlan(x,y,slop)?'plan':'page';return this.mode;}
  private settle(){if(!this.pointers.size&&!this.touches)this.mode=undefined;}
  /** Capture phase, before OrbitControls: pointers of a gesture started beside the house never reach it. */
  private gate=(e:PointerEvent)=>{
    if(e.type==='pointerdown'){
      if(!this.pointers.size&&!this.touches)this.mode=undefined;
      const plan=this.decide(e.clientX,e.clientY,e.pointerType==='mouse'?0:SLOP)==='plan';
      this.pointers.set(e.pointerId,plan);
      if(!plan){e.stopImmediatePropagation();return;}
      if(e.pointerType==='mouse')this.renderer.domElement.style.cursor='grabbing';
      this.engage();
      return;
    }
    const forwarded=this.pointers.get(e.pointerId);
    if(forwarded===false)e.stopImmediatePropagation();
    if(e.type==='pointerup'||e.type==='pointercancel')this.release(e);
  };
  /** Pointers can be released outside the canvas (mouse); forget them wherever they end. */
  private release=(e:PointerEvent)=>{
    if(!this.pointers.delete(e.pointerId))return;
    if(e.pointerType==='mouse')this.renderer.domElement.style.cursor=this.onPlan(e.clientX,e.clientY,0)?'grab':'';
    this.settle();
  };
  private touch=(e:TouchEvent)=>{
    if(e.type==='touchstart'){
      if(!this.pointers.size&&!this.touches)this.mode=undefined;
      const first=e.changedTouches[0];if(first)this.decide(first.clientX,first.clientY,SLOP);
    }
    this.touches=e.targetTouches.length;
    if((e.type==='touchstart'||e.type==='touchmove')&&this.mode==='plan'&&e.cancelable)e.preventDefault();
    if(e.type==='touchend'||e.type==='touchcancel')this.settle();
  };
  private wheelGate=(e:WheelEvent)=>{
    const now=performance.now();
    if(!this.wheelMode||now-this.wheelAt>WHEEL_GAP)this.wheelMode=this.onPlan(e.clientX,e.clientY,0)?'plan':'page';
    this.wheelAt=now;
    if(this.wheelMode==='page')e.stopImmediatePropagation();else this.engage();
  };
  private hoverCursor=(e:PointerEvent)=>{
    if(e.pointerType!=='mouse'||e.buttons||this.hover)return;
    const {clientX:x,clientY:y}=e;
    this.hover=requestAnimationFrame(()=>{
      this.hover=0;const hit=this.cast(x,y,0,this.solids);
      this.renderer.domElement.style.cursor=hit?this.picking?'crosshair':'grab':'';
      if(this.levels.size)this.point(String(hit?.userData.floorId??''));
    });
  };
  private leave=()=>{cancelAnimationFrame(this.hover);this.hover=0;if(this.levels.size)this.point('');};
  private key=(e:KeyboardEvent)=>{if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom(e.key==='-'?1.2:.8);}};
  private pointerDown=(e:PointerEvent)=>{this.down={x:e.clientX,y:e.clientY};};
  private pointerUp=(e:PointerEvent)=>{
    if(e.button!==0 || Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;
    if(this.picking){
      // A wall or a floor: the point touched, as a point of the plan; the room is known on its floor only.
      const hit=this.hit(e.clientX,e.clientY,e.pointerType==='mouse'?0:SLOP,this.solids);
      if(hit)this.picking([hit.point.x,hit.point.z],String(hit.object.userData.roomId??''));
      return;
    }
    const hit=this.cast(e.clientX,e.clientY,e.pointerType==='mouse'?0:SLOP,this.surfaces);if(hit)this.select(String(hit.userData.roomId),String(hit.userData.floorId));
  };
  private stopTween=()=>{cancelAnimationFrame(this.tween);this.tween=0;const land=this.landing;this.landing=undefined;land?.();};
  /** Moves the orbit target and distance while keeping the current viewing angle; `done` once there, or once interrupted. */
  private fly(target:T.Vector3,distance:number,done?:()=>void) {
    this.stopTween();this.landing=done;
    const from=this.controls.target.clone(),offset=this.camera.position.clone().sub(from),start=offset.length(),direction=offset.normalize();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:520,began=performance.now();
    const step=(now:number)=>{
      const t=duration?Math.min(1,(now-began)/duration):1,k=1-(1-t)**3;
      this.controls.target.lerpVectors(from,target,k);
      this.camera.position.copy(this.controls.target).addScaledVector(direction,start+(distance-start)*k);
      this.controls.update();
      if(t<1){this.tween=requestAnimationFrame(step);return;}
      this.tween=0;const land=this.landing;this.landing=undefined;land?.();
    };
    step(began);
  }
  /** How much farther the camera stands than with the perspective lens, to frame the same. */
  private get reach(){return Math.tan(T.MathUtils.degToRad(FOV/2))/Math.tan(T.MathUtils.degToRad(this.camera.fov/2));}
  /** Another field of view, framing the same: the camera moves back as the lens narrows, and its limits with it. */
  private lens(fov:number){
    if(this.camera.fov===fov)return;
    const ratio=Math.tan(T.MathUtils.degToRad(this.camera.fov/2))/Math.tan(T.MathUtils.degToRad(fov/2));
    this.camera.position.sub(this.controls.target).multiplyScalar(ratio).add(this.controls.target);
    this.camera.fov=fov;
    const reach=this.reach;
    this.camera.near=.05*reach;this.camera.far=2000*reach;this.camera.updateProjectionMatrix();
    this.controls.minDistance=reach;this.controls.maxDistance=1000*reach;
  }
  /** Leaves a margin around what is `radius` wide: room for the floating controls and for scrolling the page beside it. */
  private span(radius:number){return radius*3/Math.min(this.camera.aspect,1)*this.reach;}
  private fit(){return this.span(this.radius)*this.depth;}
  private clear() {
    this.group.traverse(object=>{if(object instanceof T.Mesh || object instanceof T.LineSegments){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
    this.group.clear();this.rooms.clear();this.levels.clear();this.openingParts.clear();this.mediaParts.clear();this.surfaces=[];this.solids=[];this.wallParts=[];this.styled='';this.fixtureKey='';
  }
  /** Soft light pool under the house so it does not float over the background. */
  /** A white spot fading to nothing, tinted by each material that uses it. */
  private haloTexture() {
    if(!this.halo){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const context=canvas.getContext('2d');if(!context)return undefined;
      const gradient=context.createRadialGradient(64,64,0,64,64,64);
      gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.5,'rgba(255,255,255,.34)');gradient.addColorStop(1,'rgba(255,255,255,0)');
      context.fillStyle=gradient;context.fillRect(0,0,128,128);this.halo=new T.CanvasTexture(canvas);
    }
    return this.halo;
  }
  private addHalo(box:T.Box3,elevation:number) {
    const halo=this.haloTexture();if(!halo)return;
    const size=box.getSize(new T.Vector3());
    const plane=new T.Mesh(new T.PlaneGeometry(size.x*1.9+2,size.z*1.9+2),new T.MeshBasicMaterial({map:halo,color:0x2f8fe0,transparent:true,opacity:.3,depthWrite:false}));
    plane.rotation.x=-Math.PI/2;plane.position.set(this.center.x,elevation-.02,this.center.z);plane.renderOrder=-1;this.group.add(plane);
  }
  /**
   * `levels`: the floors to draw at their elevations, one for a floor on its own, several for the whole house (each with its walls
   * once, from wallSegments, computed by the caller to keep this lazy chunk free of app code).
   * `reset` frames the house again, from above when `top` is set.
   */
  setFloors(levels:SceneLevel[],walls:boolean,reset=true,top=false) {
    this.clear();this.walls=walls;this.depth=levels.length>1?1.25:1;
    for(const level of levels)this.addLevel(level,levels.length>1);
    const box=new T.Box3().setFromObject(this.group);box.getCenter(this.center);this.radius=Math.max(box.getSize(new T.Vector3()).length()/2,2);
    this.addHalo(box,Math.min(...levels.map(l=>l.floor.elevation)));
    this.applyFixtures();
    if(!reset)this.render();else if(top)this.top();else this.reset();
  }
  /** A soft pool of light on the floor, reusing the halo under the house. */
  private pool(width:number,depth:number,color:number,opacity:number){
    const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({map:this.haloTexture()??null,color,transparent:true,opacity,depthWrite:false}));
    mesh.rotation.x=-Math.PI/2;return mesh;
  }
  /**
   * A door or a window in its wall: its frame, its leaves (glass, or a panel for a door) turning about their hinges when it is
   * open, and each of its covers, drawn at their positions by `applyFixtures`. With the walls lowered, a mark on the floor
   * instead, and for a door the arc its leaf sweeps.
   */
  private addOpening(group:T.Group,floor:SpatialFloor,opening:SceneOpening){
    const {center,tangent,inward,width,kind}=opening,half=width/2;
    const holder=new T.Group();holder.position.set(center[0],floor.elevation,center[1]);holder.rotation.y=-Math.atan2(tangent[1],tangent[0]);
    // The holder's z axis points to the left of the wall's direction: `into` is +1 when that is the inside of the room.
    const into=inward[0]*-tangent[1]+inward[1]*tangent[0]>=0?1:-1;
    group.add(holder);
    const frame=new T.LineBasicMaterial({color:FRAME,transparent:true,opacity:.95});
    const parts:OpeningParts={room:opening.room,opening,frame,leaves:[],covers:new Map(),bottom:0,top:0,swing:SWING[kind]};
    this.openingParts.set(opening.key,parts);
    // A door has one leaf, a window or a French window two when it is wide enough.
    const hinges=kind==='door'||width<.75?[-half]:[-half,half],leafWidth=width/hinges.length;
    if(!this.walls){
      // Lowered walls: a bright mark across the wall, and the quarter circle each leaf of a door or a French window sweeps.
      const y=.045,mark=new T.Mesh(new T.BoxGeometry(width,.012,.16),new T.MeshBasicMaterial({color:kind==='door'?LEAF:GLASS,transparent:true,opacity:.75,depthWrite:false}));
      mark.position.y=y;holder.add(mark);
      if(kind!=='window')for(const hinge of hinges){
        const toward=hinge<0?1:-1,swing:number[][]=[[hinge,y,0],[hinge,y,into*leafWidth]];
        for(let k=0;k<12;k++)for(const angle of [k,k+1].map(n=>n/12*Math.PI/2))swing.push([hinge+toward*leafWidth*Math.cos(angle),y,into*leafWidth*Math.sin(angle)]);
        holder.add(strokes(swing,frame));
      }
      return;
    }
    const top=Math.max(.3,Math.min(opening.sill+opening.height,floor.height-.04)),bottom=Math.min(opening.sill,top-.25),height=top-bottom;
    parts.top=top;parts.bottom=bottom;
    holder.add(strokes(kind==='window'
      ?[[-half,bottom,0],[half,bottom,0],[half,bottom,0],[half,top,0],[half,top,0],[-half,top,0],[-half,top,0],[-half,bottom,0]]
      :[[-half,0,0],[-half,top,0],[-half,top,0],[half,top,0],[half,top,0],[half,0,0]],frame));
    for(const hinge of hinges){
      const toward=hinge<0?1:-1,pivot=new T.Group();
      pivot.position.set(hinge,bottom,0);holder.add(pivot);
      const pane=new T.Mesh(new T.PlaneGeometry(leafWidth,height),new T.MeshBasicMaterial({color:kind==='door'?LEAF:GLASS,transparent:true,opacity:kind==='door'?.24:.15,side:T.DoubleSide,depthWrite:false}));
      pane.position.set(toward*leafWidth/2,height/2,0);pivot.add(pane);
      const x=toward*leafWidth;
      pivot.add(strokes([[0,0,0],[x,0,0],[x,0,0],[x,height,0],[x,height,0],[0,height,0],[0,height,0],[0,0,0]],new T.LineBasicMaterial({color:FRAME,transparent:true,opacity:.45})));
      // Turning by `sign` times its swing brings the leaf into the room, whichever side its hinge is on.
      parts.leaves.push({pivot,sign:-into*toward});
    }
    for(const {id,style} of opening.covers){
      const group=new T.Group();group.position.z=style==='outside'?-into*.1:style==='curtain'?into*.14:into*.1;holder.add(group);
      const color=style==='curtain'?CURTAIN:style==='inside'?BLIND:SHUTTER;
      parts.covers.set(id,{group,style,fill:new T.MeshBasicMaterial({color,transparent:true,opacity:style==='curtain'?.42:.4,side:T.DoubleSide,depthWrite:false}),lines:new T.LineBasicMaterial({color:style==='curtain'?0xfff1e0:0xf1f8ff,transparent:true,opacity:.55})});
    }
  }
  /** Redraws a cover hiding `closed` of its opening: a shutter or a blind comes down from the top, curtains close in from both sides. */
  private drawCover(parts:OpeningParts,cover:CoverParts,closed:number|undefined){
    for(const child of [...cover.group.children]){if(child instanceof T.Mesh||child instanceof T.LineSegments)child.geometry.dispose();cover.group.remove(child);}
    if(closed===undefined||!this.walls)return;
    const {width}=parts.opening,{top,bottom}=parts;
    if(cover.style==='curtain'){
      // Gathered at the sides when open, meeting in the middle when closed; from above the opening to near the floor.
      const high=top+.08,low=Math.max(0,bottom-.15),each=.12+(width/2-.04)*closed,x0=width/2+.08;
      for(const side of [-1,1]){
        const panel=new T.Mesh(new T.PlaneGeometry(each,high-low),cover.fill);
        panel.position.set(side*(x0-each/2),(high+low)/2,0);cover.group.add(panel);
        const folds:number[][]=[];for(let x=.06;x<each;x+=.12)folds.push([side*(x0-x),low,0],[side*(x0-x),high,0]);
        if(folds.length)cover.group.add(strokes(folds,cover.lines));
      }
      cover.group.add(strokes([[-x0-.04,high+.02,0],[x0+.04,high+.02,0]],cover.lines));
      return;
    }
    // A box at the top, then the apron coming down, its slats every 9 cm, and its bottom bar.
    const x=width/2+.03,drop=(top-bottom)*closed,low=top-drop;
    cover.group.add(strokes([[-x,top+.07,0],[x,top+.07,0],[-x,top+.07,0],[-x,top,0],[x,top+.07,0],[x,top,0]],cover.lines));
    if(drop<.01)return;
    const apron=new T.Mesh(new T.PlaneGeometry(2*x,drop),cover.fill);apron.position.set(0,top-drop/2,0);cover.group.add(apron);
    const slats:number[][]=[];for(let y=top-.09;y>low+.02;y-=.09)slats.push([-x,y,0],[x,y,0]);
    slats.push([-x,low,0],[x,low,0],[-x,low,0],[-x,top,0],[x,low,0],[x,top,0]);
    cover.group.add(strokes(slats,cover.lines));
  }
  /** A television on its foot, turned towards the room, or a speaker standing on the floor; lit while on, glowing while playing. */
  private addMedia(group:T.Group,floor:SpatialFloor,media:SceneMedia){
    const holder=new T.Group();holder.position.set(media.at[0],floor.elevation,media.at[1]);holder.rotation.y=Math.atan2(media.facing[0],media.facing[1]);group.add(holder);
    const screen=new T.MeshBasicMaterial({color:0x08131f,transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false});
    const frame=new T.LineBasicMaterial({color:FRAME,transparent:true,opacity:.7});
    const parts:MediaParts={room:media.room,kind:media.kind,screen,frame};
    const body=(mesh:T.Mesh)=>{mesh.userData.roomId=media.room;mesh.userData.floorId=floor.id;this.surfaces.push(mesh);this.solids.push(mesh);return mesh;};
    if(media.kind==='tv'){
      const [w,h,y]=[1.12,.64,1.12];
      const panel=body(new T.Mesh(new T.PlaneGeometry(w,h),screen));panel.position.set(0,y,0);holder.add(panel);
      holder.add(strokes([[-w/2,y-h/2,0],[w/2,y-h/2,0],[w/2,y-h/2,0],[w/2,y+h/2,0],[w/2,y+h/2,0],[-w/2,y+h/2,0],[-w/2,y+h/2,0],[-w/2,y-h/2,0],[0,0,-.05],[0,y-h/2,-.05],[-.22,0,-.05],[.22,0,-.05]],frame));
      const glow=this.pool(1.9,1.5,PLAYING,0);glow.position.set(0,.012,.75);holder.add(glow);parts.glow=glow;
    }else{
      const speaker=body(new T.Mesh(new T.CylinderGeometry(.12,.14,.95,24),screen));speaker.position.y=.475;holder.add(speaker);
      const rim:number[][]=[];for(let k=0;k<24;k++){const [a,b]=[k/24*2*Math.PI,(k+1)/24*2*Math.PI];rim.push([.12*Math.cos(a),.95,.12*Math.sin(a)],[.12*Math.cos(b),.95,.12*Math.sin(b)]);}
      holder.add(strokes(rim,frame));
      const rings=new T.Group();rings.position.y=.012;rings.visible=false;holder.add(rings);
      for(const [inner,opacity] of [[.3,.5],[.55,.28]] as const){const ring=new T.Mesh(new T.RingGeometry(inner,inner+.035,40),new T.MeshBasicMaterial({color:PLAYING,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;rings.add(ring);}
      parts.rings=rings;
    }
    this.mediaParts.set(media.key,parts);
  }
  /**
   * Doors and windows opened or closed and their covers drawn at their positions, players off, on or playing; whether that
   * changed anything (the plan is then drawn again).
   */
  fixtures(openings:ReadonlyMap<string,OpeningState>,media:ReadonlyMap<string,MediaState>){
    this.openingStates=openings;this.mediaStates=media;
    const key=JSON.stringify([[...openings],[...media]]);
    if(key===this.fixtureKey)return false;
    this.applyFixtures();
    return true;
  }
  private applyFixtures(){
    this.fixtureKey=JSON.stringify([[...this.openingStates],[...this.mediaStates]]);
    for(const [key,parts] of this.openingParts){
      const state=this.openingStates.get(key),open=!!state?.open;
      parts.frame.color.setHex(open?OPEN_FRAME:FRAME);
      for(const {pivot,sign} of parts.leaves)pivot.rotation.y=open?sign*parts.swing:0;
      for(const [id,cover] of parts.covers)this.drawCover(parts,cover,state?.covers[id]);
    }
    for(const [key,parts] of this.mediaParts){
      const state=this.mediaStates.get(key),playing=!!state?.playing,on=!!state?.on;
      parts.screen.color.setHex(playing?PLAYING:on?(parts.kind==='tv'?0x2f6d9c:0x1d4a6e):parts.kind==='tv'?0x08131f:0x10263a);
      parts.screen.opacity=playing?.92:on?.85:.88;
      parts.frame.color.setHex(playing?0xf1fbff:FRAME);parts.frame.opacity=on?.95:.55;
      if(parts.glow)parts.glow.material.opacity=playing?.4:0;
      if(parts.rings)parts.rings.visible=playing;
    }
  }
  private addLevel({floor,segments:walls,openings=[],media=[]}:SceneLevel,stacked:boolean) {
    const group=new T.Group();this.group.add(group);
    this.addWalls(group,floor,walls);
    for(const opening of openings)this.addOpening(group,floor,opening);
    for(const item of media)this.addMedia(group,floor,item);
    if(stacked)this.addStack(group,floor);
  }
  private addWalls(group:T.Group,floor:SpatialFloor,segments:WallSegment[]) {
    const walls=this.walls;
    for(const room of floor.rooms) {
      const shape=new T.Shape(room.polygon.map(p=>new T.Vector2(p[0],-p[1])));
      const surface=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0x3496d1,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}));
      surface.rotation.x=-Math.PI/2;surface.position.y=floor.elevation;surface.userData.roomId=room.id;surface.userData.floorId=floor.id;group.add(surface);
      const bounds=new T.Box2().setFromPoints(room.polygon.map(p=>new T.Vector2(...p)));
      const center=bounds.getCenter(new T.Vector2());
      const size=bounds.getSize(new T.Vector2());
      // Keep the label and light source inside concave rooms, on the widest centre slice.
      const crossings:number[]=[];const y=center.y;
      room.polygon.forEach((a,i)=>{const b=room.polygon[(i+1)%room.polygon.length]!;if((a[1]>y)!==(b[1]>y))crossings.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));});
      crossings.sort((a,b)=>a-b);let widest=0;
      for(let i=0;i+1<crossings.length;i+=2){const width=crossings[i+1]!-crossings[i]!;if(width>widest){widest=width;center.x=(crossings[i]!+crossings[i+1]!)/2;}}
      // Fade at every wall, including concave corners, within the exact floor polygon.
      const glow=new T.Mesh(surface.geometry.clone(),new T.ShaderMaterial({
        transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
        defines:{POINT_COUNT:room.polygon.length},
        uniforms:{tint:{value:new T.Color('#ffd080')},strength:{value:0},center:{value:new T.Vector2(center.x,-center.y)},extent:{value:new T.Vector2(Math.max(size.x,.01),Math.max(size.y,.01))},boundary:{value:room.polygon.map(p=>new T.Vector2(p[0],-p[1]))},feather:{value:Math.max(.01,Math.min(size.x,size.y)*.16)}},
        vertexShader:'varying vec2 spot; void main(){spot=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`
          varying vec2 spot;
          uniform vec3 tint;
          uniform float strength;
          uniform vec2 center;
          uniform vec2 extent;
          uniform vec2 boundary[POINT_COUNT];
          uniform float feather;
          void main(){
            float wallDistance=1000.;
            for(int i=0;i<POINT_COUNT;i++){
              vec2 a=boundary[i];
              vec2 b=boundary[(i+1)%POINT_COUNT];
              vec2 edge=b-a;
              float t=clamp(dot(spot-a,edge)/max(dot(edge,edge),.000001),0.,1.);
              wallDistance=min(wallDistance,length(spot-a-t*edge));
            }
            vec2 offset=(spot-center)/extent;
            float radius2=dot(offset,offset);
            float diffusion=exp(-5.*radius2);
            float core=exp(-22.*radius2);
            float edgeFade=smoothstep(0.,feather,wallDistance);
            float alpha=(.58*diffusion+.36*core)*edgeFade*strength;
            vec3 lightColor=mix(tint,vec3(1.),.08*core);
            gl_FragColor=vec4(lightColor,alpha);
          }
        `,
      }));
      glow.rotation.x=-Math.PI/2;glow.position.y=floor.elevation+.008;glow.renderOrder=1;group.add(glow);
      this.rooms.set(room.id,{floor:floor.id,surface,glow,anchor:new T.Vector3(center.x,floor.elevation+.2,center.y),radius:Math.max(size.length()/2,1)});
      this.surfaces.push(surface);this.solids.push(surface);
    }
    // Each wall once (a shared partition is not drawn twice), a pane of glass lit along its top and at its foot. No box outline:
    // the pieces of a wall, and walls meeting at a corner, join without seams. A curved wall is one piece following its curve,
    // so it has no facets either. Exterior walls are thicker and brighter, and the corners of the house stand out with a vertical line.
    const ends=new Map<string,{lines:T.LineBasicMaterial;at:[number,number];direction:number}[]>();
    for(const {a,b,rooms,path} of segments){
      const exterior=rooms.length===1,height=walls?floor.height:.035,thickness=exterior?.14:.07;
      const points=[a,...path??[],b],curved=points.length>2;
      const material=new T.MeshBasicMaterial({color:exterior?0x7cc4ff:0x6abaff,transparent:true,opacity:walls?(exterior?.1:.06):(exterior?.35:.2),depthWrite:false});
      const lines=new T.LineBasicMaterial({color:exterior?0xb5e2ff:0x94d5ff,transparent:true,opacity:exterior?.95:.6});
      let mesh:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
      if(curved){
        mesh=new T.Mesh(wallGeometry(points,thickness,height),material);
        mesh.position.y=floor.elevation;
        // Along the middle of the wall, at its top and at its foot: the curve is drawn, not its chord.
        const rail=(y:number)=>points.flatMap((p,i)=>i?[points[i-1]![0],y,points[i-1]![1],p[0],y,p[1]]:[]);
        mesh.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(walls?[...rail(height),...rail(0)]:rail(height),3)),lines));
      }else{
        const length=Math.hypot(b[0]-a[0],b[1]-a[1]),direction=Math.atan2(b[1]-a[1],b[0]-a[0]),x=length/2,y=height/2;
        mesh=new T.Mesh(new T.BoxGeometry(length,height,thickness),material);
        mesh.position.set((a[0]+b[0])/2,floor.elevation+height/2,(a[1]+b[1])/2);mesh.rotation.y=-direction;
        // In the wall's frame (x from a to b, y up), along its middle.
        mesh.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(walls?[-x,y,0,x,y,0,-x,-y,0,x,-y,0]:[-x,y,0,x,y,0],3)),lines));
      }
      mesh.userData.floorId=floor.id;
      group.add(mesh);this.wallParts.push({floor:floor.id,rooms,mesh,lines,exterior});this.solids.push(mesh);
      if(exterior&&walls)for(const [end,near] of [[a,points[1]!],[b,points.at(-2)!]] as const){
        const key=`${Math.round(end[0]*1000)},${Math.round(end[1]*1000)}`;
        // Where the wall leaves this end, so that a smooth join between two pieces gets no line.
        ends.set(key,[...ends.get(key)??[],{lines,at:[end[0],end[1]],direction:Math.atan2(near[1]-end[1],near[0]-end[0])}]);
      }
    }
    for(const meeting of ends.values()){
      const corner=meeting.find(w=>meeting.some(o=>Math.abs(Math.sin(o.direction-w.direction))>.17));
      if(!corner)continue;
      const [x,z]=corner.at,y=floor.elevation;
      group.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([x,y,z,x,y+floor.height,z],3)),corner.lines));
    }
  }
  /** A floor of a stack: where it stands, to fly into it and to label it. */
  private addStack(group:T.Group,floor:SpatialFloor) {
    const box=new T.Box3().setFromObject(group),center=box.getCenter(new T.Vector3()),points=floor.rooms.flatMap(r=>r.polygon);
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),[x0,x1,z0,z1]=[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];
    this.levels.set(floor.id,{center,radius:Math.max(box.getSize(new T.Vector3()).length()/2,2),corners:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>new T.Vector3(x,center.y,z))});
  }
  /** Selected room in light, rooms with a light on in warm tones, the others muted while a room is selected or while `level`, a floor of a stack, is pointed at. */
  highlight(selected:string,ambient:ReadonlyMap<string,RoomAmbient>=new Map(),level='') {
    const key=JSON.stringify([selected,level,[...ambient]]);
    if(key===this.styled)return false;
    this.styled=key;
    for(const [id,{floor,surface,glow}] of this.rooms){
      const state=ambient.get(id),on=!!state?.strength,picked=id===selected,muted=!!selected&&!picked||!!level&&floor!==level;
      surface.material.color.set(on?state!.color:picked?'#8fd8ff':'#3496d1');
      surface.material.opacity=on?(picked?.16:muted?.07:.1):picked?.3:muted?.1:.18;
      glow.material.uniforms.tint!.value.set(state?.color??'#ffd080');
      glow.material.uniforms.strength!.value=(state?.strength??0)*(muted?.65:1);
    }
    for(const {floor,rooms,mesh,lines,exterior} of this.wallParts){
      const picked=rooms.includes(selected),muted=!!selected&&!picked||!!level&&floor!==level;
      mesh.material.opacity=this.walls?(picked?.16:muted?.04:exterior?.1:.06):(picked?.55:muted?.15:exterior?.35:.2);
      lines.color.setHex(picked?0xf1fbff:exterior?0xb5e2ff:0x94d5ff);
      lines.opacity=picked?1:muted?.35:exterior?.95:.6;
    }
    for(const {room,frame} of this.openingParts.values()){
      const floor=this.rooms.get(room)?.floor,muted=!!selected&&room!==selected||!!level&&floor!==level;
      frame.opacity=muted?.4:.95;
    }
    return true;
  }
  /** Brings a room to the centre, closer when the camera is far away. */
  focus(id:string){
    const room=this.rooms.get(id);if(!room)return;
    const current=this.camera.position.distanceTo(this.controls.target);
    this.fly(room.anchor.clone().setY(room.anchor.y+.3),Math.min(current,Math.max(room.radius*3.6/Math.min(this.camera.aspect,1),3)*this.reach));
  }
  overview(){this.fly(this.center.clone(),this.fit());}
  /** Flies onto one floor of a stack, framed as that floor alone is: the way into it. Resolves once there, or when a gesture cuts the flight short. */
  dive(id:string){
    return new Promise<void>(resolve=>{const level=this.levels.get(id);if(level)this.fly(level.center.clone(),this.span(level.radius),resolve);else resolve();});
  }
  /** Starts on one floor of a stack, framed as that floor alone is, and draws back to the view already set: the way out of it. */
  rise(id:string){
    const level=this.levels.get(id);if(!level)return;
    const target=this.controls.target.clone(),offset=this.camera.position.clone().sub(target);
    this.controls.target.copy(level.center);this.camera.position.copy(level.center).addScaledVector(offset.clone().normalize(),this.span(level.radius));this.controls.update();
    this.fly(target,offset.length());
  }
  reset(){this.stopTween();this.lens(FOV);this.controls.target.copy(this.center);this.camera.position.copy(this.center).add(new T.Vector3(.95,1.05,1.3).normalize().multiplyScalar(this.fit()));this.controls.update();this.render();}
  /** Seen from above, as a plan: the narrow lens keeps each wall over its own footprint. */
  top(){this.stopTween();this.lens(TOP_FOV);this.controls.target.copy(this.center);this.camera.position.copy(this.center).add(new T.Vector3(0,this.radius*3.3/Math.min(this.camera.aspect,1)*this.reach,.001));this.controls.update();this.render();}
  zoom(factor:number){this.stopTween();const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(factor).clampLength(this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.render();}
  /** The camera as it stands, to be saved and framed again later. */
  view():CameraView{
    const target=this.controls.target.clone().sub(this.center).divideScalar(this.radius);
    const offset=this.camera.position.clone().sub(this.controls.target).divideScalar(this.radius);
    return {target:[target.x,target.y,target.z],offset:[offset.x,offset.y,offset.z],fov:this.camera.fov};
  }
  /** Frames the house as `view` framed it, whatever its centre and size are now. */
  show(view:CameraView){
    this.stopTween();this.lens(view.fov);
    this.controls.target.copy(this.center).add(new T.Vector3(...view.target).multiplyScalar(this.radius));
    this.camera.position.copy(this.controls.target).add(new T.Vector3(...view.offset).multiplyScalar(this.radius).clampLength(this.controls.minDistance,this.controls.maxDistance));
    this.controls.update();this.render();
  }
  render=()=>{
    this.renderer.render(this.scene,this.camera);
    const positions:Projection=new Map(),levels:LevelProjection=new Map();const {clientWidth:w,clientHeight:h}=this.host;
    if(this.levels.size)for(const [id,{center,corners}] of this.levels){
      const p=center.clone().project(this.camera),xs=corners.map(c=>(c.clone().project(this.camera).x+1)*w/2);
      levels.set(id,{x:(p.x+1)*w/2,y:(1-p.y)*h/2,left:Math.min(...xs),right:Math.max(...xs),visible:p.z>=-1&&p.z<=1});
    }
    else for(const [id,{anchor}] of this.rooms){const p=anchor.clone().project(this.camera);positions.set(id,{x:(p.x+1)*w/2,y:(1-p.y)*h/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.95});}
    this.project(positions,levels);
  };
  dispose(){
    this.stopTween();cancelAnimationFrame(this.hover);this.observer.disconnect();this.controls.dispose();
    const canvas=this.renderer.domElement;
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])this.host.removeEventListener(type,this.gate as EventListener,true);
    this.host.removeEventListener('wheel',this.wheelGate,true);
    window.removeEventListener('pointerup',this.release);window.removeEventListener('pointercancel',this.release);
    for(const type of ['touchstart','touchmove','touchend','touchcancel'] as const)canvas.removeEventListener(type,this.touch);
    canvas.removeEventListener('keydown',this.key);canvas.removeEventListener('pointerdown',this.pointerDown);canvas.removeEventListener('pointerup',this.pointerUp);canvas.removeEventListener('pointermove',this.hoverCursor);canvas.removeEventListener('pointerleave',this.leave);
    this.clear();this.halo?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();canvas.remove();
  }
}
