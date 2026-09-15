import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { polygonArea, validPolygon, type Point, type SpatialPlan } from '../../shared/spatial';
import { mpIcon } from '../icons';
import { defineElement } from '../registry';

/**
 * A room as detected on the image, in 0-1000 coordinates (Gemini's convention: box_2d is [ymin, xmin, ymax, xmax], a point [y, x]).
 * `id` links it to its room in the plan; `hue` keeps its colour while rooms are added and removed (both stay in the browser).
 */
export interface DetectionRoom { name:string; box_2d:number[]; polygon?:number[][]; size?:number[]; label?:string; id?:string; hue?:number }
/** Maps the plan (metres) back onto the analysed image: pixel = metre / scale + origin. */
export interface Source { width:number; height:number; scale:number[]; origin:number[] }
/** Centre line of a wall drawn on the image: `at` across it, `from`-`to` along it, in 0-1000. */
export interface WallLine { at:number; from:number; to:number }
export interface Walls { x:WallLine[]; y:WallLine[] }
type Handle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'|'move'|'vertex';
/** Lines a corner is drawn to: the walls of the plan (where they run), the sides and corners of the rooms. */
interface Guides { walls:Walls; xs:number[]; ys:number[] }
/** A room being moved or resized (`box`), or a corner of its outline being moved (`shape`, [x, y] points; `inserted`: just added on a side). */
interface Drag { index:number; handle:Handle; start:[number,number]; origin:number[]; box:number[]; moved:boolean; shape?:number[][]; vertex?:number; inserted?:boolean; guides?:Guides }

/** Distinct colour per room (golden angle), shared by the zones and the list. */
export const roomColor=(index:number)=>`hsl(${Math.round(index*137.5)%360} 78% 62%)`;
const round=(value:number)=>Math.round(value*100)/100;
const colour=(room:DetectionRoom|undefined,index:number)=>roomColor(room?.hue??index);
const MIN=5,MAX_POINTS=40;
/** Outline points: [y, x] as sent to Home Assistant, [x, y] while editing. */
const toXY=(points:number[][])=>points.map(([y,x])=>[x!,y!]);
const toYX=(points:number[][])=>points.map(([x,y])=>[round(y!),round(x!)]);
/** [ymin, xmin, ymax, xmax] around [x, y] points, and back. */
const bounds=(points:number[][])=>{const xs=points.map(p=>p[0]!),ys=points.map(p=>p[1]!);return [Math.min(...ys),Math.min(...xs),Math.max(...ys),Math.max(...xs)].map(round);};
const corners=(box:number[])=>[[box[1]!,box[0]!],[box[3]!,box[0]!],[box[3]!,box[2]!],[box[1]!,box[2]!]];

/** Runs of dark pixels at least 3 px thick and 4 % of the image long, merged across neighbouring rows or columns. Thin lines (furniture, dimensions) are left out. */
function wallLines(dark:Uint8Array,w:number,h:number,vertical:boolean):WallLine[]{
  const across=vertical?w:h,along=vertical?h:w,minRun=Math.max(8,Math.round(along*.04));
  const on=(a:number,b:number)=>(vertical?dark[b*w+a]:dark[a*w+b])===1;
  const bands:{a0:number;a1:number;from:number;to:number}[]=[];
  for(let a=1;a<across-1;a++){
    let start=-1;
    for(let b=0;b<=along;b++){
      const thick=b<along&&on(a,b)&&on(a-1,b)&&on(a+1,b);
      if(thick&&start<0)start=b;
      else if(!thick&&start>=0){
        if(b-start>=minRun){
          const band=bands.find(x=>x.a1>=a-1&&Math.min(x.to,b)-Math.max(x.from,start)>(b-start)/2);
          if(band){band.a1=a;band.from=Math.min(band.from,start);band.to=Math.max(band.to,b);}
          else bands.push({a0:a,a1:a,from:start,to:b});
        }
        start=-1;
      }
    }
  }
  return bands.map(b=>({at:((b.a0+b.a1)/2+.5)/across*1000,from:b.from/along*1000,to:b.to/along*1000}));
}

/**
 * Walls drawn on the plan, found in the browser: dark, thick, long horizontal and vertical strokes. The image is brought to
 * 1200 pixels on its longer side (enlarged up to 3 times): on a small plan, walls 2 px thick then count as thick.
 */
export async function detectWalls(blob:Blob):Promise<Walls>{
  const bitmap=await createImageBitmap(blob);
  try{
    const scale=Math.min(3,1200/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(3,Math.round(bitmap.width*scale)),h=Math.max(3,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return {x:[],y:[]};
    context.fillStyle='#fff';context.fillRect(0,0,w,h);context.drawImage(bitmap,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h).data,dark=new Uint8Array(w*h),histogram=new Uint32Array(256);
    for(let i=0;i<w*h;i++){dark[i]=Math.round(pixels[i*4]!*.3+pixels[i*4+1]!*.59+pixels[i*4+2]!*.11);histogram[dark[i]!]!++;}
    // Bounded Otsu threshold: faded grey scans still have walls; pale paper never becomes a wall.
    let total=0,weight=0,sum=0,best=0,threshold=120;
    for(let i=0;i<256;i++)total+=i*histogram[i]!;
    for(let i=0;i<255;i++){
      weight+=histogram[i]!;sum+=i*histogram[i]!;const rest=w*h-weight;if(!weight||!rest)continue;
      const variance=weight*rest*(sum/weight-(total-sum)/rest)**2;
      if(variance>best){best=variance;const ink=sum/weight,paper=(total-sum)/rest;threshold=ink+(paper-ink)*.25;}
    }
    threshold=Math.min(190,Math.max(120,threshold));
    for(let i=0;i<w*h;i++)dark[i]=dark[i]!<threshold?1:0;
    return {x:wallLines(dark,w,h,true),y:wallLines(dark,w,h,false)};
  }finally{bitmap.close();}
}

/** Nearest wall line within `tolerance` of `value` that runs along at least 40 % of [from, to]. */
function nearest(lines:WallLine[],value:number,from:number,to:number,tolerance:number){
  const along=(line:WallLine)=>Math.max(0,Math.min(line.to,to)-Math.max(line.from,from));
  let best=value,gap=tolerance;
  for(const line of lines){
    const distance=Math.abs(line.at-value);
    if(distance>gap||!along(line))continue;
    // Doors and windows cut a wall into pieces: those on the same line count together.
    const spans=lines.filter(other=>Math.abs(other.at-line.at)<=4).map(other=>[Math.max(from,other.from),Math.min(to,other.to)]).filter(([a,b])=>b!>a!).sort((a,b)=>a[0]!-b[0]!);
    let covered=0,end=from;
    for(const [a,b] of spans){covered+=Math.max(0,b!-Math.max(a!,end));end=Math.max(end,b!);}
    if(covered>=(to-from)*.4){gap=distance;best=line.at;}
  }
  return best;
}
/** Box edges (among `edges`, compass letters) moved onto the nearest drawn wall; tolerances in 0-1000 units along x and y. */
export function snapBox(box:number[],walls:Walls,tx:number,ty:number,edges='nsew'):number[]{
  const [y0,x0,y1,x1]=box as [number,number,number,number];
  const snapped=[edges.includes('n')?nearest(walls.y,y0,x0,x1,ty):y0,edges.includes('w')?nearest(walls.x,x0,y0,y1,tx):x0,
    edges.includes('s')?nearest(walls.y,y1,x0,x1,ty):y1,edges.includes('e')?nearest(walls.x,x1,y0,y1,tx):x1] as [number,number,number,number];
  // Never collapse a room onto a single wall.
  if(snapped[2]-snapped[0]<MIN){snapped[0]=y0;snapped[2]=y1;}
  if(snapped[3]-snapped[1]<MIN){snapped[1]=x0;snapped[3]=x1;}
  return snapped;
}
/** Adjust orthogonal outline edges together, keeping concave corners and diagonal walls intact. */
export function snapOutline(polygon:number[][],walls:Walls,tx:number,ty:number):number[][]{
  const original=toXY(polygon),points=original.map(p=>[...p]);
  original.forEach((a,i)=>{
    const j=(i+1)%original.length,b=original[j]!;
    if(Math.abs(a[0]!-b[0]!)<.01){const x=nearest(walls.x,a[0]!,Math.min(a[1]!,b[1]!),Math.max(a[1]!,b[1]!),tx);points[i]![0]=points[j]![0]=x;}
    if(Math.abs(a[1]!-b[1]!)<.01){const y=nearest(walls.y,a[1]!,Math.min(a[0]!,b[0]!),Math.max(a[0]!,b[0]!),ty);points[i]![1]=points[j]![1]=y;}
  });
  return validPolygon(points as Point[])?toYX(points):polygon;
}
/** Moved box kept on the walls: the smallest correction among its two opposite edges shifts it, without resizing it. */
function snapMove(box:number[],walls:Walls,tx:number,ty:number){
  const [y0,x0,y1,x1]=box as [number,number,number,number];
  const shift=(a:number,b:number,lines:WallLine[],from:number,to:number,tolerance:number)=>{
    const da=nearest(lines,a,from,to,tolerance)-a,db=nearest(lines,b,from,to,tolerance)-b;
    return da&&(!db||Math.abs(da)<=Math.abs(db))?da:db;
  };
  const dy=shift(y0,y1,walls.y,x0,x1,ty),dx=shift(x0,x1,walls.x,y0,y1,tx);
  return [y0+dy,x0+dx,y1+dy,x1+dx];
}

/** A corner drawn or moved: each axis goes onto the nearest guide within the tolerance, so sides stay square and on the walls. */
function snapPoint(point:number[],guides:Guides,tx:number,ty:number):number[]{
  const x=point[0]!,y=point[1]!;
  const pick=(value:number,candidates:number[],tolerance:number)=>{let best=value,gap=tolerance;for(const c of candidates){const d=Math.abs(c-value);if(d<=gap){gap=d;best=c;}}return best;};
  return [pick(x,[...guides.walls.x.filter(l=>l.from-ty<=y&&y<=l.to+ty).map(l=>l.at),...guides.xs],tx),
    pick(y,[...guides.walls.y.filter(l=>l.from-tx<=x&&x<=l.to+tx).map(l=>l.at),...guides.ys],ty)];
}
/** Where a room's name fits: the middle of the widest stretch inside it across its mid-height (the centre of an L-shaped room is outside it). */
function labelSpot(points:number[][]){
  const xs=points.map(p=>p[0]!),ys=points.map(p=>p[1]!),y=(Math.min(...ys)+Math.max(...ys))/2,crossings:number[]=[];
  points.forEach((a,i)=>{const b=points[(i+1)%points.length]!;if((a[1]!>y)!==(b[1]!>y))crossings.push(a[0]!+(y-a[1]!)*(b[0]!-a[0]!)/(b[1]!-a[1]!));});
  crossings.sort((p,q)=>p-q);
  let spot={x:(Math.min(...xs)+Math.max(...xs))/2,width:Math.max(...xs)-Math.min(...xs)},widest=0;
  for(let i=0;i+1<crossings.length;i+=2){const width=crossings[i+1]!-crossings[i]!;if(width>widest){widest=width;spot={x:(crossings[i]!+crossings[i+1]!)/2,width};}}
  return {...spot,y,height:Math.max(...ys)-Math.min(...ys)};
}
const shifted=(points:number[][],drag:Drag)=>{const dx=drag.box[1]!-drag.origin[1]!,dy=drag.box[0]!-drag.origin[0]!;return points.map(([x,y])=>[x!+dx,y!+dy]);};
const pairs=(points:number[][])=>points.map(p=>`${p[0]},${p[1]}`).join(' ');

/**
 * Detected rooms over the analysed plan: select, move and resize them with handles (walls attract the edges), give a room a free
 * outline and edit its corners, draw a new one as a rectangle or corner by corner, delete one. Emits `zones-change` with the edited
 * rooms and `zones-undo`; the Studio rebuilds the plan.
 */
export class MPPlanZones extends LitElement {
  static properties={src:{attribute:false},source:{attribute:false},plan:{attribute:false},detection:{attribute:false},walls:{attribute:false},busy:{type:Boolean},canUndo:{type:Boolean},
    selected:{state:true},vertex:{state:true},mode:{state:true},drag:{state:true},draft:{state:true},trace:{state:true},notice:{state:true},frame:{state:true},zoomLevel:{state:true},panning:{state:true},magnet:{state:true}};
  static styles=css`
    :host{display:block;color:#eef6ff;font:13px/1.4 system-ui,sans-serif}*{box-sizing:border-box}
    button{font:inherit;color:inherit;cursor:pointer;min-height:36px;padding:0 12px;border:1px solid #b2d7f23b;border-radius:10px;background:#0b253d;display:inline-flex;align-items:center;gap:6px}
    button:disabled{opacity:.45;cursor:default}button[aria-pressed=true]{background:#2a648e;border-color:#8acbff}
    .tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 6px}
    .viewport{overflow:auto;overscroll-behavior:contain;margin:8px auto;border-radius:14px;background:#fff;max-width:calc(100% - 16px)}
    .viewport figure{max-width:none;margin:0;border-radius:0;box-shadow:none}.viewport figure.panning,.panning polygon{cursor:grab;touch-action:none}
    .zoom-tools output{min-width:46px;text-align:center;font-variant-numeric:tabular-nums}.zoom-tools{margin-bottom:8px}
    /* Same buttons and room for two lines of help in every mode: the plan does not jump under the pointer. */
    .hint{margin:0;min-height:2.9em;color:#9fb6ca;font-size:12px}@media (max-width:600px){.hint{min-height:4.3em}}
    figure{position:relative;max-width:calc(100% - 16px);margin:8px auto;border-radius:14px;background:#fff;box-shadow:0 10px 30px #0006;touch-action:pan-y;user-select:none;-webkit-user-select:none;outline-offset:3px}
    figure.adding{cursor:crosshair;touch-action:none}figure.busy{opacity:.85}
    img{display:block;width:100%;height:100%;border-radius:inherit;pointer-events:none}svg,.layer{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit}.layer{pointer-events:none}
    /* Rooms and names stay on the plan; the handles of a room along its edge may overflow it. */
    svg,.names{overflow:hidden}
    polygon{fill-opacity:.3;stroke-opacity:.95;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;cursor:move;touch-action:none}
    polygon.selected{fill-opacity:.42;stroke-width:3}.box{fill:none;stroke:#fff;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}
    .draft{fill:#69b7ff33;stroke:#69b7ff;stroke-width:2;vector-effect:non-scaling-stroke;pointer-events:none}.trace{fill:none;stroke:#69b7ff;stroke-width:2;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}
    .label{position:absolute;transform:translate(-50%,-50%);max-width:30%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#fff;font-weight:650;paint-order:stroke;-webkit-text-stroke:3px #061421;text-shadow:0 1px 2px #0009}
    .label.number{min-width:20px;height:20px;padding:0 5px;border-radius:99px;display:grid;place-items:center;font-size:11px;-webkit-text-stroke:0;background:#061421cc;border:2px solid currentColor}
    .handle{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:5px;background:#fff;border:2px solid #2a648e;box-shadow:0 2px 6px #0008;pointer-events:auto;touch-action:none}
    /* A larger target than the square itself, for a finger. */
    .handle::before{content:'';position:absolute;inset:-9px}@media (pointer:coarse){.handle{width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:6px}.handle::before{inset:-12px}}
    .handle[data-handle=n],.handle[data-handle=s]{cursor:ns-resize}.handle[data-handle=e],.handle[data-handle=w]{cursor:ew-resize}.handle[data-handle=nw],.handle[data-handle=se]{cursor:nwse-resize}.handle[data-handle=ne],.handle[data-handle=sw]{cursor:nesw-resize}
    /* Corners of an outline, the one last touched highlighted; a + in the middle of each side adds a corner. */
    .vertex{border-radius:50%;cursor:move}.vertex.active{background:#8acbff;border-color:#fff;box-shadow:0 0 0 3px #8acbff66}
    .mid{width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:#2a648e;border:2px solid #fff;cursor:copy}
    .mid::after{content:'+';position:absolute;inset:-2px;display:grid;place-items:center;color:#fff;font:700 11px/1 system-ui,sans-serif}
    @media (pointer:coarse){.mid{width:17px;height:17px;margin:-8.5px 0 0 -8.5px}}
    .point{width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#69b7ff;border:2px solid #fff;pointer-events:none}.point.first{width:18px;height:18px;margin:-9px 0 0 -9px;background:#fff;border:3px solid #69b7ff}
    ul{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}
    li{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 8px;border-radius:10px;background:#ffffff08;border:1px solid #d6ecff14}li.selected{border-color:#8acbff;background:#69b7ff1a}
    .swatch{display:grid;place-items:center;min-width:22px;height:22px;border-radius:7px;color:#061421;font-size:11px;font-weight:700}
    input{flex:1;min-width:0;min-height:32px;padding:4px 8px;font:inherit;color:inherit;border:1px solid #b2d7f23b;border-radius:8px;background:#0b253d}small{color:#9fb6ca;white-space:nowrap}
    li button{min-height:30px;width:30px;padding:0;justify-content:center;border-color:transparent;background:transparent}li button:hover{background:#ff8a6a22}
  `;
  src='';source?:Source;plan?:SpatialPlan;detection:DetectionRoom[]=[];walls?:Walls;busy=false;canUndo=false;
  /** Selected room and, on its outline, the corner last touched (-1: none). */
  private selected=-1;private vertex=-1;private naming=-1;
  /** Drawing a new room: a rectangle dragged diagonally, or an outline corner by corner ([x, y] points; `cursor`: the next one). */
  private mode:''|'rect'|'trace'='';private draft?:{start:[number,number];box:number[]};private trace?:{points:number[][];cursor?:number[]};private tracing=false;
  private drag?:Drag;private notice='';private frame={width:0,height:0};
  private zoomLevel=1;private panning=false;private magnet=true;
  private pan?:{x:number;y:number;left:number;top:number};
  private pinch?:{distance:number;zoom:number};
  private zoomTo(value:number,x?:number,y?:number){
    const viewport=this.renderRoot.querySelector<HTMLElement>('.viewport');if(!viewport||this.drag||this.draft)return;
    const next=Math.min(8,Math.max(1,value)),ratio=next/this.zoomLevel,rect=viewport.getBoundingClientRect();
    const px=x===undefined?viewport.clientWidth/2:x-rect.left,py=y===undefined?viewport.clientHeight/2:y-rect.top;
    const left=(viewport.scrollLeft+px)*ratio-px,top=(viewport.scrollTop+py)*ratio-py;
    this.zoomLevel=next;void this.updateComplete.then(()=>{viewport.scrollLeft=left;viewport.scrollTop=top;});
  }
  private wheel={handleEvent:(e:WheelEvent)=>{e.preventDefault();this.zoomTo(this.zoomLevel*Math.exp(-e.deltaY*.002),e.clientX,e.clientY);},passive:false};
  /** Double click or double tap, told apart here (the browser gives it to the plan, not to the corner): corner last tapped, corner last placed. */
  private lastTap?:{vertex:number;time:number};private placedAt=0;
  private observer=new ResizeObserver(([entry])=>{if(entry)this.frame={width:entry.contentRect.width,height:entry.contentRect.height};});
  protected firstUpdated(){const figure=this.renderRoot.querySelector('figure');if(figure)this.observer.observe(figure);}
  disconnectedCallback(){super.disconnectedCallback();this.observer.disconnect();}
  protected willUpdate(changed:PropertyValues){
    if(!changed.has('detection'))return;
    if(this.selected>=this.detection.length)this.selected=-1;
    if(this.vertex>=(this.detection[this.selected]?.polygon?.length??0))this.vertex=-1;
  }
  protected updated(changed:PropertyValues){
    if(!changed.has('detection')||this.naming<0)return;
    const input=this.renderRoot.querySelector<HTMLInputElement>(`input[data-index="${this.naming}"]`);
    if(input){this.naming=-1;input.focus();input.select();}
  }
  /** Pointer position in 0-1000 over the image. */
  private point(e:PointerEvent):[number,number]{
    const rect=(this.renderRoot.querySelector('figure') as HTMLElement).getBoundingClientRect();
    return [Math.min(1000,Math.max(0,(e.clientX-rect.left)/rect.width*1000)),Math.min(1000,Math.max(0,(e.clientY-rect.top)/rect.height*1000))];
  }
  /** Attraction of the walls: about 10 screen pixels, in 0-1000 units along each axis. */
  private get screenTolerance():[number,number]{return [10/Math.max(1,this.frame.width)*1000,10/Math.max(1,this.frame.height)*1000];}
  private get tolerance():[number,number]{return this.magnet?this.screenTolerance:[0,0];}
  /** Guides for a corner: the walls, the sides and corners of the rooms other than `except`, and the `own` points of its outline. */
  private guides(except:number,own:number[][]=[]):Guides{
    const xs:number[]=[],ys:number[]=[];
    this.detection.forEach((room,i)=>{
      if(i===except)return;
      xs.push(room.box_2d[1]!,room.box_2d[3]!);ys.push(room.box_2d[0]!,room.box_2d[2]!);
      for(const [y,x] of room.polygon??[]){xs.push(x!);ys.push(y!);}
    });
    for(const [x,y] of own){xs.push(x!);ys.push(y!);}
    return {walls:this.walls??{x:[],y:[]},xs,ys};
  }
  /** A room's outline in the plan, back on the image ([x, y] in 0-1000): what is shown, carved by smaller rooms. */
  private outline(room:DetectionRoom){
    const source=this.source,plan=room.id?this.plan?.floors[0]?.rooms.find(r=>r.id===room.id):undefined;
    if(!source||!plan)return undefined;
    const [kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    return plan.polygon.map(([x,y])=>[(x/kx+ox)/source.width*1000,(y/ky+oy)/source.height*1000]);
  }
  private emit(detection:DetectionRoom[]){this.notice='';this.dispatchEvent(new CustomEvent('zones-change',{detail:detection}));}
  private drop(index:number){if(index<0||this.busy)return;this.selected=-1;this.vertex=-1;this.emit(this.detection.filter((_,i)=>i!==index));}
  private rename(index:number,name:string){const clean=name.trim().slice(0,80);if(!clean||clean===this.detection[index]?.name)return;this.emit(this.detection.map((room,i)=>i===index?{...room,name:clean}:room));}
  /** New outline of a room; refused when it crosses itself or is too small (the room stays as it was). */
  private reshape(index:number,shape:number[][]){
    const box=bounds(shape);
    if(shape.length<3||box[2]!-box[0]!<MIN||box[3]!-box[1]!<MIN||!validPolygon(shape as Point[])){this.notice='Contour impossible : il se croise ou il est trop petit. La pièce reste comme avant.';return;}
    this.emit(this.detection.map((room,i)=>i===index?{...room,polygon:toYX(shape),box_2d:box}:room));
  }
  /** « Forme libre » : the outline as shown (a room carved by a smaller one keeps its notch), with a handle on each corner. */
  private freeShape(){
    const room=this.detection[this.selected];
    if(!room||this.busy)return;
    const outline=this.outline(room);
    this.reshape(this.selected,outline&&outline.length>=3?outline:corners(room.box_2d));
  }
  /** Back to the rectangle around the outline. */
  private rectangle(){
    if(!this.detection[this.selected]?.polygon||this.busy)return;
    this.vertex=-1;
    this.emit(this.detection.map((room,i)=>{if(i!==this.selected)return room;const copy={...room};delete copy.polygon;return copy;}));
  }
  private removeVertex(){
    const room=this.detection[this.selected];
    if(!room?.polygon||this.vertex<0||this.busy)return;
    if(room.polygon.length<=3){this.notice='Un contour garde au moins trois points.';return;}
    const shape=toXY(room.polygon).filter((_,k)=>k!==this.vertex);
    this.vertex=-1;this.reshape(this.selected,shape);
  }
  private startMode(mode:'rect'|'trace'){this.panning=false;this.mode=this.mode===mode?'':mode;this.draft=undefined;this.trace=undefined;this.selected=-1;this.vertex=-1;this.notice='';}
  /** Next corner of the outline being drawn (true when placed); back on the first corner, the outline is closed. */
  private tracePoint(p:number[]){
    const [tx,ty]=this.tolerance,points=this.trace?.points??[],first=points[0],last=points.at(-1);
    const [sx,sy]=this.screenTolerance;
    const near=(a:number[],b:number[],radius:number)=>Math.hypot((a[0]!-b[0]!)/sx,(a[1]!-b[1]!)/sy)<radius;
    if(first&&points.length>=3&&near(p,first,1.2)){this.finishTrace();return false;}
    // On the last corner again: a double click or tap closes the outline.
    if(last&&near(p,last,.8)){if(points.length>=3&&performance.now()-this.placedAt<450)this.finishTrace();return false;}
    if(points.length>=MAX_POINTS)return false;
    this.trace={points:[...points,snapPoint(p,this.guides(-1,points),tx,ty)]};this.placedAt=performance.now();
    return true;
  }
  private finishTrace(){
    const points=this.trace?.points??[];
    if(points.length<3)return;
    const box=bounds(points);
    if(box[2]!-box[0]!<MIN||box[3]!-box[1]!<MIN||!validPolygon(points as Point[])){this.notice='Contour impossible : il se croise ou il est trop petit. Retirez le dernier point (Retour arrière) ou recommencez.';return;}
    this.trace=undefined;this.mode='';
    this.add({box_2d:box,polygon:toYX(points)});
  }
  /** A room drawn on the plan, numbered after the others; its name is then selected, ready to be typed. */
  private add(shape:{box_2d:number[];polygon?:number[][]}){
    this.selected=this.naming=this.detection.length;this.vertex=-1;
    const hue=Math.max(this.detection.length-1,...this.detection.map(r=>r.hue??0))+1;
    this.emit([...this.detection,{name:`Pièce ${this.detection.length+1}`,...shape,hue}]);
  }
  /** What the pointer took: a corner or a side's + of the selected outline, a handle of the selected rectangle, or a room. */
  private grab(target:Element,p:[number,number]){
    const element=target.closest<HTMLElement>('[data-vertex],[data-mid],[data-handle],[data-zone]'),room=this.detection[this.selected];
    if(!element)return false;
    const {vertex,mid,handle,zone}=element.dataset;
    if(room?.polygon&&(vertex!==undefined||mid!==undefined)){
      // A corner tapped twice goes away.
      if(vertex!==undefined&&this.lastTap?.vertex===Number(vertex)&&performance.now()-this.lastTap.time<450){this.lastTap=undefined;this.vertex=Number(vertex);this.removeVertex();return true;}
      const shape=toXY(room.polygon);
      let index=Number(vertex);
      if(mid!==undefined){index=Number(mid)+1;const a=shape[index-1]!,b=shape[index%shape.length]!;shape.splice(index,0,[(a[0]!+b[0]!)/2,(a[1]!+b[1]!)/2]);}
      this.vertex=index;
      this.drag={index:this.selected,handle:'vertex',start:p,origin:[...room.box_2d],box:[...room.box_2d],moved:false,shape,vertex:index,inserted:mid!==undefined,
        guides:this.guides(this.selected,shape.filter((_,k)=>k!==index))};
      return true;
    }
    if(handle&&room){this.drag={index:this.selected,handle:handle as Handle,start:p,origin:[...room.box_2d],box:[...room.box_2d],moved:false};return true;}
    if(zone===undefined)return false;
    const index=Number(zone),box=[...this.detection[index]!.box_2d];
    this.selected=index;this.vertex=-1;
    this.drag={index,handle:'move',start:p,origin:box,box,moved:false};
    return true;
  }
  private down=(e:PointerEvent)=>{
    if(this.busy||e.button>0)return;
    if(this.pinch)return;
    if(this.panning){const v=this.renderRoot.querySelector<HTMLElement>('.viewport')!;this.pan={x:e.clientX,y:e.clientY,left:v.scrollLeft,top:v.scrollTop};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);e.preventDefault();return;}
    const figure=e.currentTarget as HTMLElement,p=this.point(e);
    this.notice='';
    if(this.mode==='trace')this.tracing=this.tracePoint(p);
    else if(this.mode==='rect')this.draft={start:p,box:[p[1],p[0],p[1],p[0]]};
    else if(!this.grab(e.target as Element,p)){this.selected=-1;this.vertex=-1;return;}
    figure.setPointerCapture(e.pointerId);
    // No text selection nor page drag; keep the keyboard on the plan for Delete and Escape.
    e.preventDefault();figure.focus({preventScroll:true});
  };
  private move=(e:PointerEvent)=>{
    if(this.pinch)return;
    if(this.pan){const v=this.renderRoot.querySelector<HTMLElement>('.viewport')!;v.scrollLeft=this.pan.left+this.pan.x-e.clientX;v.scrollTop=this.pan.top+this.pan.y-e.clientY;return;}
    const [tx,ty]=this.tolerance;
    if(this.mode==='trace'){
      const points=this.trace?.points;
      if(!points?.length)return;
      const p=this.point(e),placed=points.slice(0,-1);
      // Held down, the corner just placed follows the finger; otherwise the next side follows the pointer.
      if(this.tracing)this.trace={points:[...placed,snapPoint(p,this.guides(-1,placed),tx,ty)]};
      else this.trace={points,cursor:snapPoint(p,this.guides(-1,points),tx,ty)};
      return;
    }
    if(!this.draft&&!this.drag)return;
    const p=this.point(e);
    if(this.draft){
      const [sx,sy]=this.draft.start;
      this.draft={...this.draft,box:snapBox([Math.min(sy,p[1]),Math.min(sx,p[0]),Math.max(sy,p[1]),Math.max(sx,p[0])],this.walls??{x:[],y:[]},tx,ty)};
      return;
    }
    const drag=this.drag;if(!drag)return;
    const dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
    if(!drag.moved&&!drag.inserted&&Math.hypot(dx/this.screenTolerance[0],dy/this.screenTolerance[1])<.4)return;  // a click is not a move
    if(drag.handle==='vertex'){
      const shape=drag.shape!.map(q=>[...q]);
      shape[drag.vertex!]=snapPoint(p,drag.guides!,tx,ty);
      this.drag={...drag,shape,moved:true};
      return;
    }
    let [y0,x0,y1,x1]=drag.origin as [number,number,number,number];
    const walls=this.walls??{x:[],y:[]};
    if(drag.handle==='move'){
      const sx=Math.min(Math.max(dx,-x0),1000-x1),sy=Math.min(Math.max(dy,-y0),1000-y1);
      this.drag={...drag,box:snapMove([y0+sy,x0+sx,y1+sy,x1+sx],walls,tx,ty),moved:true};
      return;
    }
    if(drag.handle.includes('n'))y0=Math.min(y0+dy,y1-MIN);
    if(drag.handle.includes('s'))y1=Math.max(y1+dy,y0+MIN);
    if(drag.handle.includes('w'))x0=Math.min(x0+dx,x1-MIN);
    if(drag.handle.includes('e'))x1=Math.max(x1+dx,x0+MIN);
    this.drag={...drag,box:snapBox([y0,x0,y1,x1],walls,tx,ty,drag.handle),moved:true};
  };
  private up=()=>{
    if(this.pan){this.pan=undefined;return;}
    if(this.pinch)return;
    if(this.mode==='trace'){this.tracing=false;return;}
    if(this.draft){
      const box=this.draft.box;this.draft=undefined;this.mode='';
      if(box[2]!-box[0]!>=MIN&&box[3]!-box[1]!>=MIN)this.add({box_2d:box.map(round)});
      return;
    }
    const drag=this.drag;this.drag=undefined;
    if(!drag?.moved){
      if(drag?.inserted)this.vertex=-1;
      else if(drag?.handle==='vertex')this.lastTap={vertex:drag.vertex!,time:performance.now()};
      return;
    }
    if(drag.handle==='vertex'){
      const [tx,ty]=this.screenTolerance,v=drag.vertex!,count=drag.shape!.length;
      let shape=drag.shape!;
      // Dropped onto a neighbouring corner: this corner goes away.
      const onto=(k:number)=>Math.hypot((shape[v]![0]!-shape[k]![0]!)/tx,(shape[v]![1]!-shape[k]![1]!)/ty)<.8;
      if(count>3&&(onto((v+1)%count)||onto((v+count-1)%count))){shape=shape.filter((_,k)=>k!==v);this.vertex=-1;}
      this.reshape(drag.index,shape);
      return;
    }
    const [dy,dx]=[drag.box[0]!-drag.origin[0]!,drag.box[1]!-drag.origin[1]!];
    this.emit(this.detection.map((room,i)=>{
      if(i!==drag.index)return room;
      const {polygon,...rest}=room,box_2d=drag.box.map(round);
      // A moved outline follows its box; a rectangle takes the new box.
      return drag.handle==='move'&&polygon?{...rest,box_2d,polygon:polygon.map(([y,x])=>[round(y!+dy),round(x!+dx)])}:{...rest,box_2d};
    }));
  };
  private key=(e:KeyboardEvent)=>{
    if(['+','=','-','0'].includes(e.key)){e.preventDefault();this.zoomTo(e.key==='0'?1:this.zoomLevel*(e.key==='-'?.8:1.25));return;}
    if(this.mode==='trace'&&this.trace){
      if(e.key==='Enter'){e.preventDefault();this.finishTrace();return;}
      if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();const points=this.trace.points.slice(0,-1);this.trace=points.length?{points}:undefined;return;}
    }
    if((e.key==='Delete'||e.key==='Backspace')&&this.selected>=0){e.preventDefault();if(this.vertex>=0)this.removeVertex();else this.drop(this.selected);}
    else if(e.key==='Escape'){this.mode='';this.draft=undefined;this.trace=undefined;this.selected=-1;this.vertex=-1;}
  };
  /** On a phone, a finger on a room, a handle or in drawing mode edits the plan instead of scrolling the window. */
  private touch={handleEvent:(e:TouchEvent)=>{
    if(e.touches.length>=2){
      e.preventDefault();const a=e.touches[0]!,b=e.touches[1]!,distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      if(!this.pinch){this.pinch={distance:Math.max(1,distance),zoom:this.zoomLevel};this.drag=undefined;this.draft=undefined;this.pan=undefined;this.tracing=false;}
      else this.zoomTo(this.pinch.zoom*distance/this.pinch.distance,(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
    }else if(this.pinch){if(!e.touches.length)this.pinch=undefined;else e.preventDefault();}
    else if(this.mode||this.panning||(e.target as Element).closest('[data-handle],[data-zone],[data-vertex],[data-mid]'))e.preventDefault();
  },passive:false};
  private label(index:number,room:DetectionRoom,points:number[][]){
    const spot=labelSpot(points),name=room.name;
    const size=Math.min(15,spot.width/1000*this.frame.width/Math.max(4,name.length*.6),spot.height/1000*this.frame.height*.4);
    const style=`left:${spot.x/10}%;top:${spot.y/10}%`;
    // Too small for its name: its number, as in the list.
    return size<9?html`<span class="label number" style=${`${style};color:${colour(room,index)}`} title=${name}>${index+1}</span>`:html`<span class="label" style=${`${style};font-size:${size}px`}>${name}</span>`;
  }
  private get hint(){
    const room=this.detection[this.selected],count=this.trace?.points.length??0;
    if(this.mode==='rect')return 'Glissez en diagonale sur le plan pour tracer un rectangle.';
    if(this.mode==='trace')return count<3?'Touchez les angles de la pièce l’un après l’autre ; les murs et les autres pièces attirent les points.'
      :'Touchez l’angle suivant ; pour fermer, touchez le premier point ou deux fois le dernier. Retour arrière retire le dernier point.';
    if(room?.polygon)return 'Glissez un point pour le déplacer, un + pour en ajouter un ; touchez deux fois un point, ou déposez-le sur son voisin, pour le retirer.';
    if(room)return 'Glissez la pièce ou ses poignées. « Forme libre » pour suivre un contour qui n’est pas rectangulaire.';
    return 'Touchez une pièce pour l’ajuster, ou ajoutez-en une.';
  }
  render(){
    const source=this.source;
    if(!source)return nothing;
    const rooms=new Map((this.plan?.floors[0]?.rooms??[]).map(r=>[r.id,r])),[kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    const normalised=([x,y]:number[])=>`${((x!/kx+ox)/source.width*1000).toFixed(1)},${((y!/ky+oy)/source.height*1000).toFixed(1)}`;
    const room=this.detection[this.selected],dragging=this.drag?.index===this.selected?this.drag:undefined;
    // The selected room as it is being edited: its outline, or its rectangle.
    const shape=room?.polygon?dragging?.shape??(dragging?shifted(toXY(room.polygon),dragging):toXY(room.polygon)):undefined;
    const box=room&&!room.polygon?dragging?.box??room.box_2d:undefined;
    const handles:[Handle,number,number][]=box?[['nw',box[1]!,box[0]!],['n',(box[1]!+box[3]!)/2,box[0]!],['ne',box[3]!,box[0]!],['e',box[3]!,(box[0]!+box[2]!)/2],
      ['se',box[3]!,box[2]!],['s',(box[1]!+box[3]!)/2,box[2]!],['sw',box[1]!,box[2]!],['w',box[1]!,(box[0]!+box[2]!)/2]]:[];
    const at=(x:number,y:number)=>`left:${x/10}%;top:${y/10}%`;
    const rect=(b:number[],cls:string)=>svg`<rect class=${cls} x=${b[1]!} y=${b[0]!} width=${b[3]!-b[1]!} height=${b[2]!-b[0]!}></rect>`;
    const trace=this.trace,path=trace?[...trace.points,...(trace.cursor?[trace.cursor]:[])]:[];
    const spot=(r:DetectionRoom,i:number)=>{
      const editing=i===this.drag?.index?this.drag:undefined;
      if(editing)return editing.shape??(r.polygon?shifted(toXY(r.polygon),editing):corners(editing.box));
      return this.outline(r)??corners(r.box_2d);
    };
    return html`
      <div class="tools">
        <button aria-pressed=${this.mode==='rect'} ?disabled=${this.busy} @click=${()=>this.startMode('rect')}>${mpIcon('plus',16)} Ajouter une pièce</button>
        <button aria-pressed=${this.mode==='trace'} ?disabled=${this.busy} @click=${()=>this.startMode('trace')}>${mpIcon('walls',16)} Tracer un contour</button>
        ${this.mode==='trace'?html`<button ?disabled=${(trace?.points.length??0)<3} @click=${()=>this.finishTrace()}>${mpIcon('check',16)} Terminer le contour</button>`
          :html`<button ?disabled=${!room||!!this.mode||this.busy} @click=${()=>room?.polygon?this.rectangle():this.freeShape()}>${room?.polygon?'Rectangle':'Forme libre'}</button>`}
        <button ?disabled=${!room?.polygon||this.vertex<0||this.busy} @click=${()=>this.removeVertex()}>Supprimer le point</button>
        <button ?disabled=${this.selected<0||this.busy} @click=${()=>this.drop(this.selected)}>${mpIcon('close',16)} Supprimer la pièce</button>
        <button ?disabled=${!this.canUndo||this.busy} @click=${()=>this.dispatchEvent(new CustomEvent('zones-undo'))}>Annuler</button>
      </div>
      <p class="hint" aria-live="polite">${this.busy?'Mise à jour du plan…':this.notice||this.hint}</p>
      <div class="tools zoom-tools" role="toolbar" aria-label="Précision du plan">
        <button aria-label="Zoom arrière du plan" ?disabled=${this.zoomLevel<=1} @click=${()=>this.zoomTo(this.zoomLevel/1.5)}>−</button><output aria-label="Zoom du plan">${Math.round(this.zoomLevel*100)} %</output><button aria-label="Zoom avant du plan" ?disabled=${this.zoomLevel>=8} @click=${()=>this.zoomTo(this.zoomLevel*1.5)}>+</button>
        <button @click=${()=>this.zoomTo(1)}>Ajuster à l’écran</button>
        <button aria-pressed=${this.panning} @click=${()=>{this.panning=!this.panning;this.mode='';this.trace=undefined;}}>Déplacer le plan</button>
        <button aria-pressed=${this.magnet} @click=${()=>{this.magnet=!this.magnet;}}>Aimantation</button>
      </div>
      <div class="viewport" style=${`aspect-ratio:${source.width}/${source.height};width:min(100% - 16px,calc(52vh * ${source.width/source.height}))`} @wheel=${this.wheel}>
      <figure class=${`${this.mode?'adding':''} ${this.busy?'busy':''} ${this.panning?'panning':''}`} tabindex="0" aria-label="Pièces détectées sur le plan" style=${`aspect-ratio:${source.width}/${source.height};width:${this.zoomLevel*100}%`}
        @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${()=>{this.drag=undefined;this.draft=undefined;this.pan=undefined;this.tracing=false;}} @keydown=${this.key} @touchstart=${this.touch} @touchmove=${this.touch} @touchend=${this.touch} @touchcancel=${this.touch}>
        <img src=${this.src} alt="Plan analysé par Gemini" draggable="false">
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
          ${this.detection.map((r,i)=>{
            const plan=r.id?rooms.get(r.id):undefined;
            return plan?svg`<polygon data-zone=${i} class=${i===this.selected?'selected':''} points=${plan.polygon.map(normalised).join(' ')} style=${`fill:${colour(r,i)};stroke:${colour(r,i)}`}></polygon>`:nothing;
          })}
          ${shape?svg`<polygon class="box" points=${pairs(shape)}></polygon>`:box?rect(box,'box'):nothing}
          ${this.draft?rect(this.draft.box,'draft'):nothing}
          ${trace&&trace.points.length>=3?svg`<polygon class="draft" points=${pairs(trace.points)}></polygon>`:nothing}
          ${path.length>=2?svg`<polyline class="trace" points=${pairs(path)}></polyline>`:nothing}
        </svg>
        <div class="layer names">${this.detection.map((r,i)=>r.id&&rooms.has(r.id)?this.label(i,r,spot(r,i)):nothing)}</div>
        <div class="layer">
          ${handles.map(([name,x,y])=>html`<span class="handle" data-handle=${name} style=${at(x,y)}></span>`)}
          ${shape&&!this.drag&&shape.length<MAX_POINTS?shape.map((p,i)=>{
            // A + only on a side long enough to keep clear of its corners, drawn under them.
            const q=shape[(i+1)%shape.length]!,length=Math.hypot((q[0]!-p[0]!)*this.frame.width,(q[1]!-p[1]!)*this.frame.height)/1000;
            return length<44?nothing:html`<span class="handle mid" data-mid=${i} title="Ajouter un point" style=${at((p[0]!+q[0]!)/2,(p[1]!+q[1]!)/2)}></span>`;
          }):nothing}
          ${shape?shape.map((p,i)=>html`<span class=${`handle vertex${i===this.vertex?' active':''}`} data-vertex=${i} style=${at(p[0]!,p[1]!)}></span>`):nothing}
          ${trace?trace.points.map((p,i)=>html`<span class=${`handle point${i===0?' first':''}`} style=${at(p[0]!,p[1]!)}></span>`):nothing}
        </div>
      </figure>
      </div>
      <ul aria-label="Pièces du brouillon">${this.detection.map((r,i)=>{
        const plan=r.id?rooms.get(r.id):undefined;
        return html`<li class=${i===this.selected?'selected':''} @click=${()=>{if(!this.mode&&i!==this.selected){this.selected=i;this.vertex=-1;}}}>
          <span class="swatch" style=${`background:${colour(r,i)}`}>${i+1}</span>
          <input data-index=${i} maxlength="80" .value=${r.name} aria-label=${`Nom de la pièce ${i+1}`} ?disabled=${this.busy} @change=${(e:Event)=>this.rename(i,(e.target as HTMLInputElement).value)}>
          <small>${plan?`${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(polygonArea(plan.polygon))} m²`:'écartée'}</small>
          <button aria-label=${`Supprimer ${r.name}`} title="Supprimer" ?disabled=${this.busy} @click=${(e:Event)=>{e.stopPropagation();this.drop(i);}}>${mpIcon('close',14)}</button>
        </li>`;
      })}</ul>`;
  }
}
defineElement('mp-plan-zones',MPPlanZones);
