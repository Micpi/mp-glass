import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SpatialFloor, WallSegment } from '../../shared/spatial';
import type { RoomAmbient } from '../../shared/spatial-state';

type Projection = Map<string,{x:number;y:number;visible:boolean}>;
/** Where each floor of a stack stands on screen: the middle of the floor, and the left and right ends of its footprint. */
export type LevelProjection = Map<string,{x:number;y:number;left:number;right:number;visible:boolean}>;
/** A camera kept as the user left it, told relative to the house so a redrawn or edited plan keeps the same view. */
export interface CameraView { target:[number,number,number]; offset:[number,number,number]; fov:number }
/** A floor to draw at its elevation, with its walls. Room ids must be unique across the floors drawn together. */
export interface SceneLevel { floor:SpatialFloor; segments:WallSegment[] }
interface RoomParts { floor:string; surface:T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>; glow:T.Mesh<T.ShapeGeometry,T.ShaderMaterial>; anchor:T.Vector3; radius:number }
interface WallParts { floor:string; rooms:string[]; mesh:T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>; lines:T.LineBasicMaterial; exterior:boolean }
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
    this.hover=requestAnimationFrame(()=>{
      this.hover=0;const hit=this.cast(x,y,0,this.solids);
      this.renderer.domElement.style.cursor=hit?'grab':'';
      if(this.levels.size)this.point(String(hit?.userData.floorId??''));
    });
  };
  private leave=()=>{cancelAnimationFrame(this.hover);this.hover=0;if(this.levels.size)this.point('');};
  private key=(e:KeyboardEvent)=>{if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom(e.key==='-'?1.2:.8);}};
  private pointerDown=(e:PointerEvent)=>{this.down={x:e.clientX,y:e.clientY};};
  private pointerUp=(e:PointerEvent)=>{
    if(e.button!==0 || Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;
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
    this.group.clear();this.rooms.clear();this.levels.clear();this.surfaces=[];this.solids=[];this.wallParts=[];this.styled='';
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
    if(!reset)this.render();else if(top)this.top();else this.reset();
  }
  private addLevel({floor,segments}:SceneLevel,stacked:boolean) {
    const group=new T.Group(),walls=this.walls;this.group.add(group);
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
    // the pieces of a wall, and walls meeting at a corner, join without seams. Exterior walls are thicker and brighter, and the
    // corners of the house stand out with a vertical line.
    const ends=new Map<string,{mesh:T.Mesh;x:number;direction:number}[]>();
    for(const {a,b,rooms} of segments){
      const exterior=rooms.length===1,length=Math.hypot(b[0]-a[0],b[1]-a[1]),height=walls?floor.height:.035,direction=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const mesh=new T.Mesh(new T.BoxGeometry(length,height,exterior?.14:.07),new T.MeshBasicMaterial({color:exterior?0x7cc4ff:0x6abaff,transparent:true,opacity:walls?(exterior?.1:.06):(exterior?.35:.2),depthWrite:false}));
      mesh.position.set((a[0]+b[0])/2,floor.elevation+height/2,(a[1]+b[1])/2);mesh.rotation.y=-direction;mesh.userData.floorId=floor.id;
      // In the wall's frame (x from a to b, y up), along its middle.
      const lines=new T.LineBasicMaterial({color:exterior?0xb5e2ff:0x94d5ff,transparent:true,opacity:exterior?.95:.6}),x=length/2,y=height/2;
      mesh.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(walls?[-x,y,0,x,y,0,-x,-y,0,x,-y,0]:[-x,y,0,x,y,0],3)),lines));
      group.add(mesh);this.wallParts.push({floor:floor.id,rooms,mesh,lines,exterior});this.solids.push(mesh);
      if(exterior&&walls)for(const [end,at,away] of [[a,-x,direction],[b,x,direction+Math.PI]] as const){
        const key=`${Math.round(end[0]*1000)},${Math.round(end[1]*1000)}`;
        ends.set(key,[...ends.get(key)??[],{mesh,x:at,direction:away}]);
      }
    }
    for(const meeting of ends.values()){
      const corner=meeting.find(w=>meeting.some(o=>Math.abs(Math.sin(o.direction-w.direction))>.17));
      if(!corner)continue;
      const y=floor.height/2,wall=this.wallParts.find(p=>p.mesh===corner.mesh)!;
      corner.mesh.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([corner.x,-y,0,corner.x,y,0],3)),wall.lines));
    }
    if(!stacked)return;
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
