import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SpatialFloor, WallSegment } from '../../shared/spatial';

type Projection = Map<string,{x:number;y:number;visible:boolean}>;
interface RoomParts { surface:T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>; anchor:T.Vector3; radius:number }
interface WallParts { rooms:string[]; mesh:T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>; edges:T.LineBasicMaterial; exterior:boolean }
/** Extra pixels around the house still counted as "on the plan" for a finger. */
const SLOP=14;
/** A wheel gesture keeps its first target (plan or page) while its events follow each other. */
const WHEEL_GAP=300;

/**
 * Three.js floor renderer. A gesture only drives the camera when it starts on the house (rooms or walls);
 * started beside it, it is left to the page so a phone can scroll past the plan.
 */
export class SpatialScene {
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(38,1,.05,2000);
  private scene = new T.Scene();
  private group = new T.Group();
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private rooms = new Map<string,RoomParts>();
  private surfaces: T.Object3D[] = [];
  private solids: T.Object3D[] = [];
  private wallParts: WallParts[] = [];
  private ray = new T.Raycaster();
  private halo?: T.CanvasTexture;
  private center = new T.Vector3();
  private radius = 10;
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
  constructor(private host: HTMLElement, private select: (id:string)=>void, private project: (positions:Projection)=>void, private engage: ()=>void = ()=>{}) {
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
    this.scene.add(this.group);
    this.observer=new ResizeObserver(()=>{const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.render();});
    this.observer.observe(this.host);
  }
  /** First object hit at (x, y), trying a few neighbouring points when `slop` is set. */
  private cast(x:number,y:number,slop:number,targets:T.Object3D[]) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height||!targets.length)return undefined;
    const offsets:[number,number][]=slop?[[0,0],[slop,0],[-slop,0],[0,slop],[0,-slop]]:[[0,0]];
    for(const [dx,dy] of offsets){
      this.ray.setFromCamera(new T.Vector2((x+dx-rect.left)/rect.width*2-1,-(y+dy-rect.top)/rect.height*2+1),this.camera);
      const hit=this.ray.intersectObjects(targets,false)[0];
      if(hit)return hit.object;
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
    this.hover=requestAnimationFrame(()=>{this.hover=0;this.renderer.domElement.style.cursor=this.onPlan(x,y,0)?'grab':'';});
  };
  private key=(e:KeyboardEvent)=>{if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom(e.key==='-'?1.2:.8);}};
  private pointerDown=(e:PointerEvent)=>{this.down={x:e.clientX,y:e.clientY};};
  private pointerUp=(e:PointerEvent)=>{
    if(e.button!==0 || Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;
    const hit=this.cast(e.clientX,e.clientY,e.pointerType==='mouse'?0:SLOP,this.surfaces);if(hit)this.select(String(hit.userData.roomId));
  };
  private stopTween=()=>{cancelAnimationFrame(this.tween);this.tween=0;};
  /** Moves the orbit target and distance while keeping the current viewing angle. */
  private fly(target:T.Vector3,distance:number) {
    this.stopTween();
    const from=this.controls.target.clone(),offset=this.camera.position.clone().sub(from),start=offset.length(),direction=offset.normalize();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:520,began=performance.now();
    const step=(now:number)=>{
      const t=duration?Math.min(1,(now-began)/duration):1,k=1-(1-t)**3;
      this.controls.target.lerpVectors(from,target,k);
      this.camera.position.copy(this.controls.target).addScaledVector(direction,start+(distance-start)*k);
      this.controls.update();
      this.tween=t<1?requestAnimationFrame(step):0;
    };
    step(began);
  }
  /** Leaves a margin around the house: room for the floating controls and for scrolling the page beside it. */
  private fit(){return this.radius*3/Math.min(this.camera.aspect,1);}
  private clear() {
    this.group.traverse(object=>{if(object instanceof T.Mesh || object instanceof T.LineSegments){object.geometry.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});
    this.group.clear();this.rooms.clear();this.surfaces=[];this.solids=[];this.wallParts=[];this.styled='';
  }
  /** Soft light pool under the house so it does not float over the background. */
  private addHalo(box:T.Box3,elevation:number) {
    if(!this.halo){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const context=canvas.getContext('2d');if(!context)return;
      const gradient=context.createRadialGradient(64,64,0,64,64,64);
      gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.5,'rgba(255,255,255,.34)');gradient.addColorStop(1,'rgba(255,255,255,0)');
      context.fillStyle=gradient;context.fillRect(0,0,128,128);this.halo=new T.CanvasTexture(canvas);
    }
    const size=box.getSize(new T.Vector3());
    const plane=new T.Mesh(new T.PlaneGeometry(size.x*1.9+2,size.z*1.9+2),new T.MeshBasicMaterial({map:this.halo,color:0x2f8fe0,transparent:true,opacity:.3,depthWrite:false}));
    plane.rotation.x=-Math.PI/2;plane.position.set(this.center.x,elevation-.02,this.center.z);plane.renderOrder=-1;this.group.add(plane);
  }
  /** `segments`: the floor's walls, each once (wallSegments), computed by the caller to keep this lazy chunk free of app code. */
  setFloor(floor:SpatialFloor,segments:WallSegment[],walls:boolean,reset=true) {
    this.clear();this.walls=walls;
    for(const room of floor.rooms) {
      const shape=new T.Shape(room.polygon.map(p=>new T.Vector2(p[0],-p[1])));
      const surface=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0x3496d1,transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}));
      surface.rotation.x=-Math.PI/2;surface.position.y=floor.elevation;surface.userData.roomId=room.id;this.group.add(surface);
      const bounds=new T.Box2().setFromPoints(room.polygon.map(p=>new T.Vector2(...p)));
      const center=bounds.getCenter(new T.Vector2());
      this.rooms.set(room.id,{surface,anchor:new T.Vector3(center.x,floor.elevation+.2,center.y),radius:Math.max(bounds.getSize(new T.Vector2()).length()/2,1)});
      this.surfaces.push(surface);this.solids.push(surface);
    }
    // Each wall once: a shared partition is not drawn twice; exterior walls are thicker and brighter.
    for(const {a,b,rooms} of segments){
      const exterior=rooms.length===1,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const geometry=new T.BoxGeometry(length,walls?floor.height:.035,exterior?.14:.07);
      const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:exterior?0x7cc4ff:0x6abaff,transparent:true,opacity:walls?(exterior?.1:.06):(exterior?.35:.2),depthWrite:false}));
      mesh.position.set((a[0]+b[0])/2,floor.elevation+(walls?floor.height/2:.02),(a[1]+b[1])/2);mesh.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      const edges=new T.LineBasicMaterial({color:exterior?0xb5e2ff:0x94d5ff,transparent:true,opacity:exterior?.95:.6});
      mesh.add(new T.LineSegments(new T.EdgesGeometry(geometry),edges));this.group.add(mesh);
      this.wallParts.push({rooms,mesh,edges,exterior});this.solids.push(mesh);
    }
    const box=new T.Box3().setFromObject(this.group);box.getCenter(this.center);this.radius=Math.max(box.getSize(new T.Vector3()).length()/2,2);
    this.addHalo(box,floor.elevation);
    if(reset)this.reset();else this.render();
  }
  /** Selected room in light, rooms with a light on in warm tones, the others muted while a room is selected. */
  highlight(selected:string,lit:ReadonlySet<string>=new Set()) {
    const key=`${selected}|${[...lit].sort().join()}`;
    if(key===this.styled)return false;
    this.styled=key;
    for(const [id,{surface}] of this.rooms){
      const on=lit.has(id),picked=id===selected,muted=!!selected&&!picked;
      surface.material.color.setHex(picked?(on?0xffd98f:0x8fd8ff):on?0xffbf5c:0x3496d1);
      surface.material.opacity=picked?.5:on?.34:muted?.13:.22;
    }
    for(const {rooms,mesh,edges,exterior} of this.wallParts){
      const picked=rooms.includes(selected),muted=!!selected&&!picked;
      mesh.material.opacity=this.walls?(picked?.16:muted?.04:exterior?.1:.06):(picked?.55:muted?.15:exterior?.35:.2);
      edges.color.setHex(picked?0xf1fbff:exterior?0xb5e2ff:0x94d5ff);
      edges.opacity=picked?1:muted?.35:exterior?.95:.6;
    }
    return true;
  }
  /** Brings a room to the centre, closer when the camera is far away. */
  focus(id:string){
    const room=this.rooms.get(id);if(!room)return;
    const current=this.camera.position.distanceTo(this.controls.target);
    this.fly(room.anchor.clone().setY(room.anchor.y+.3),Math.min(current,Math.max(room.radius*3.6/Math.min(this.camera.aspect,1),3)));
  }
  overview(){this.fly(this.center.clone(),this.fit());}
  reset(){this.stopTween();this.controls.target.copy(this.center);this.camera.position.copy(this.center).add(new T.Vector3(.95,1.05,1.3).normalize().multiplyScalar(this.fit()));this.controls.update();this.render();}
  top(){this.stopTween();this.controls.target.copy(this.center);this.camera.position.copy(this.center).add(new T.Vector3(0,this.radius*3.3/Math.min(this.camera.aspect,1),.001));this.controls.update();this.render();}
  zoom(factor:number){this.stopTween();const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(factor).clampLength(this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.render();}
  render=()=>{
    this.renderer.render(this.scene,this.camera);
    const positions:Projection=new Map();const {clientWidth:w,clientHeight:h}=this.host;
    for(const [id,{anchor}] of this.rooms){const p=anchor.clone().project(this.camera);positions.set(id,{x:(p.x+1)*w/2,y:(1-p.y)*h/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.98&&Math.abs(p.y)<.95});}
    this.project(positions);
  };
  dispose(){
    this.stopTween();cancelAnimationFrame(this.hover);this.observer.disconnect();this.controls.dispose();
    const canvas=this.renderer.domElement;
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])this.host.removeEventListener(type,this.gate as EventListener,true);
    this.host.removeEventListener('wheel',this.wheelGate,true);
    window.removeEventListener('pointerup',this.release);window.removeEventListener('pointercancel',this.release);
    for(const type of ['touchstart','touchmove','touchend','touchcancel'] as const)canvas.removeEventListener(type,this.touch);
    canvas.removeEventListener('keydown',this.key);canvas.removeEventListener('pointerdown',this.pointerDown);canvas.removeEventListener('pointerup',this.pointerUp);canvas.removeEventListener('pointermove',this.hoverCursor);
    this.clear();this.halo?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();canvas.remove();
  }
}
