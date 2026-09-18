import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { arcPoints, bent, insideRoom, OPENING_SIZES, outline, roomArea, roomOutline, sidePoint, splitSide, validRoom, type OpeningKind, type Point, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { attachFixtures, isOpening, type DraftFixture, type FixtureKind } from '../../shared/fixtures';
import { mpIcon, type MPIconName } from '../icons';
import { defineElement } from '../registry';

/**
 * A room as detected on the image, in 0-1000 coordinates (Gemini's convention: box_2d is [ymin, xmin, ymax, xmax], a point [y, x]).
 * `arcs` bends its sides (one per side of `polygon`), told in the image's pixel geometry so a curve stays a circle whatever
 * the image's proportions. `id` links it to its room in the plan; `hue` keeps its colour while rooms are added and removed
 * (both stay in the browser).
 */
export interface DetectionRoom { name:string; box_2d:number[]; polygon?:number[][]; arcs?:number[]; size?:number[]; label?:string; id?:string; hue?:number }
/** Maps the plan (metres) back onto the analysed image: pixel = metre / scale + origin. */
export interface Source { width:number; height:number; scale:number[]; origin:number[] }
/** Centre line of a wall drawn on the image: `at` across it, `from`-`to` along it, in 0-1000; `room`: the room whose side it is, on a saved level. */
export interface WallLine { at:number; from:number; to:number; room?:string }
/** A wall of the plan that runs along neither axis, as a segment in 0-1000 coordinates. */
export interface WallEdge { a:number[]; b:number[]; room?:string }
/** `slanted`: walls at an angle; `angles`: the directions they run in, in the image's pixels (a quarter turn, radians). */
export interface Walls { x:WallLine[]; y:WallLine[]; slanted?:WallEdge[]; angles?:number[] }
type Handle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'|'move'|'vertex'|'side'|'bend'|'rotate';
/**
 * A line the pointer is drawn to, in the plan's pixels: through `p` along the unit vector `u`, between `from` and `to` along
 * it. `axis` marks a line along one axis and keeps its exact 0-1000 coordinate, so corners drawn onto it share it exactly.
 */
interface Line { p:Point; u:Point; from?:number; to?:number; axis?:{coordinate:0|1;value:number} }
/**
 * Lines a corner is drawn to: the walls of the plan (where they run), the sides and corners of the other rooms, and the
 * directions the plan is drawn in. `sx`/`sy` turn 0-1000 coordinates into the plan's pixels; `tolerance` is in pixels, 0 with
 * the magnet off.
 */
interface Guides { lines:Line[]; sx:number; sy:number; tolerance:number }
/**
 * A room being moved or resized (`box`), or its outline being reshaped (`shape`, [x, y] points, with `arcs`): a corner moved
 * (`vertex`; `inserted`: just added on a side), a side moved or bent (`side`), or the room turned (`rotate`, `angle` in radians).
 */
interface Drag { index:number; handle:Handle; start:[number,number]; origin:number[]; box:number[]; moved:boolean; shape?:number[][]; from?:number[][]; arcs?:number[]; vertex?:number; side?:number; inserted?:boolean; guides?:Guides; angle?:number }

/** Doors, windows, televisions and speakers placed on the draft: their names, marks and colours, apart from the rooms'. */
const FIXTURES:Record<FixtureKind,{name:string;article:string;icon:MPIconName;color:string}>={
  door:{name:'Porte',article:'la porte',icon:'door',color:'#ffb35c'},window:{name:'Fenêtre',article:'la fenêtre',icon:'window',color:'#3fc6ff'},
  french_window:{name:'Porte-fenêtre',article:'la porte-fenêtre',icon:'french',color:'#a58cff'},tv:{name:'Téléviseur',article:'le téléviseur',icon:'tv',color:'#ff6fae'},
  speaker:{name:'Enceinte',article:'l’enceinte',icon:'speaker',color:'#5fe0a0'},
};
const FIXTURE_KINDS=Object.keys(FIXTURES) as FixtureKind[];
/** Eight random hex digits (not `crypto.randomUUID`, missing over plain HTTP). */
const shortId=()=>Array.from(crypto.getRandomValues(new Uint8Array(4)),byte=>byte.toString(16).padStart(2,'0')).join('');
/** Nearest point to `p` on the segment from `a` to `b`. */
const closest=(a:Point,b:Point,p:Point):Point=>{const dx=b[0]-a[0],dy=b[1]-a[1],squared=dx*dx+dy*dy,t=squared?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/squared)):0;return [a[0]+dx*t,a[1]+dy*t];};
/** Distinct colour per room (golden angle), shared by the zones and the list. */
export const roomColor=(index:number)=>`hsl(${Math.round(index*137.5)%360} 78% 62%)`;
const round=(value:number)=>Math.round(value*100)/100;
const colour=(room:DetectionRoom|undefined,index:number)=>roomColor(room?.hue??index);
const MIN=5,MAX_POINTS=40;
/** Outline points: [y, x] as sent to Home Assistant, [x, y] while editing. */
const toXY=(points:number[][])=>points.map(([y,x])=>[x!,y!]);
const toYX=(points:number[][])=>points.map(([x,y])=>[round(y!),round(x!)]);
const tidyArcs=(arcs:number[]|undefined)=>arcs?.some(bent)?arcs.map(b=>Math.round(Math.max(-1,Math.min(1,b))*1e4)/1e4):undefined;
/** [ymin, xmin, ymax, xmax] around [x, y] points, and back. */
const bounds=(points:number[][])=>{const xs=points.map(p=>p[0]!),ys=points.map(p=>p[1]!);return [Math.min(...ys),Math.min(...xs),Math.max(...ys),Math.max(...xs)].map(round);};
const corners=(box:number[])=>[[box[1]!,box[0]!],[box[3]!,box[0]!],[box[3]!,box[2]!],[box[1]!,box[2]!]];
/** 0-1000 coordinates, stretched with the image, as the plan's own pixels, where a right angle is a right angle. */
const toPixel=(p:number[],sx:number,sy:number):Point=>[p[0]!*sx,p[1]!*sy];
const fromPixel=(p:Point,sx:number,sy:number):number[]=>[p[0]/sx,p[1]/sy];
const direction=(a:Point,b:Point):Point=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/length,(b[1]-a[1])/length];};
/** Bend of the side `index` of a shape, in the plan's pixels. */
const bendOf=(arcs:number[]|undefined,index:number)=>arcs?.[index]??0;

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

const greyOf=(pixels:Uint8ClampedArray,count:number)=>{
  const grey=new Uint8Array(count);
  for(let i=0;i<count;i++)grey[i]=Math.round(pixels[i*4]!*.3+pixels[i*4+1]!*.59+pixels[i*4+2]!*.11);
  return grey;
};
/** Bounded Otsu threshold: faded grey scans still have walls; pale paper never becomes a wall. */
function inkThreshold(grey:Uint8Array){
  const histogram=new Uint32Array(256);
  for(const value of grey)histogram[value]!++;
  let total=0,weight=0,sum=0,best=0,threshold=120;
  for(let i=0;i<256;i++)total+=i*histogram[i]!;
  for(let i=0;i<255;i++){
    weight+=histogram[i]!;sum+=i*histogram[i]!;const rest=grey.length-weight;if(!weight||!rest)continue;
    const variance=weight*rest*(sum/weight-(total-sum)/rest)**2;
    if(variance>best){best=variance;const ink=sum/weight,paper=(total-sum)/rest;threshold=ink+(paper-ink)*.25;}
  }
  return Math.min(190,Math.max(120,threshold));
}
const inkOf=(grey:Uint8Array,threshold:number)=>{
  const dark=new Uint8Array(grey.length);
  for(let i=0;i<grey.length;i++)dark[i]=grey[i]!<threshold?1:0;
  return dark;
};
/**
 * Directions the plan's walls run in besides the image's own axes, strongest first, two at most (radians within a quarter
 * turn: a wall and its square corner count together). A wing of the house drawn at an angle stands out in the strokes'
 * directions, whatever the walls' own length.
 */
function dominantAngles(grey:Uint8Array,w:number,h:number):number[]{
  const bins=180,step=Math.PI/2/bins,histogram=new Float64Array(bins);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,gx=grey[i+1]!-grey[i-1]!,gy=grey[i+w]!-grey[i-w]!,strength=Math.hypot(gx,gy);
    if(strength<50)continue;
    // A stroke runs across its gradient.
    const angle=Math.atan2(gy,gx)+Math.PI/2;
    histogram[((Math.floor(angle/step)%bins)+bins)%bins]!+=strength;
  }
  const smooth=Array.from(histogram,(_,i)=>[-2,-1,0,1,2].reduce((sum,k)=>sum+histogram[(i+k+bins)%bins]!,0));
  const strongest=Math.max(...smooth),gapTo=(a:number,b:number)=>{const gap=Math.abs(a-b)%bins;return Math.min(gap,bins-gap);};
  const peaks:number[]=[];
  for(let bin=0;bin<bins;bin++){
    // At least 3° from the axes, a tenth of the strongest direction, and stronger than its neighbours.
    if(gapTo(bin,0)<6||smooth[bin]!<strongest*.1)continue;
    if(smooth[bin]!<smooth[(bin+1)%bins]!||smooth[bin]!<smooth[(bin+bins-1)%bins]!)continue;
    peaks.push(bin);
  }
  const chosen:number[]=[];
  for(const bin of peaks.sort((a,b)=>smooth[b]!-smooth[a]!)){
    if(chosen.some(other=>gapTo(bin,other)<16))continue;
    chosen.push(bin);
    if(chosen.length===2)break;
  }
  return chosen.map(bin=>{
    // Sharpened between its neighbours, to a fraction of a degree.
    const [before,at,after]=[smooth[(bin+bins-1)%bins]!,smooth[bin]!,smooth[(bin+1)%bins]!],curve=before-2*at+after;
    return (bin+.5+(curve?Math.max(-.5,Math.min(.5,(before-after)/(2*curve))):0))*step;
  });
}
/**
 * Walls drawn on the plan, found in the browser: dark, thick, long strokes. The image is brought to 1200 pixels on its
 * longer side (enlarged up to 3 times): on a small plan, walls 2 px thick then count as thick. Walls along the image's
 * axes are found first; the plan is then turned by each of its own wall directions, so that a wing drawn at an angle
 * gives its walls too.
 */
export async function detectWalls(blob:Blob):Promise<Walls>{
  const bitmap=await createImageBitmap(blob);
  try{
    const scale=Math.min(3,1200/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(3,Math.round(bitmap.width*scale)),h=Math.max(3,Math.round(bitmap.height*scale));
    /** The plan drawn turned by `-angle` around its middle, on a canvas large enough to hold it whole. */
    const turned=(angle:number)=>{
      const cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
      const width=Math.ceil(w*cos+h*sin),height=Math.ceil(w*sin+h*cos);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      if(!context)return undefined;
      context.fillStyle='#fff';context.fillRect(0,0,width,height);
      context.translate(width/2,height/2);context.rotate(-angle);
      context.drawImage(bitmap,-w/2,-h/2,w,h);
      return {grey:greyOf(context.getImageData(0,0,width,height).data,width*height),width,height};
    };
    const upright=turned(0);
    if(!upright)return {x:[],y:[]};
    const threshold=inkThreshold(upright.grey),dark=inkOf(upright.grey,threshold);
    const walls:Walls={x:wallLines(dark,w,h,true),y:wallLines(dark,w,h,false),slanted:[],angles:[]};
    for(const angle of dominantAngles(upright.grey,w,h)){
      const aside=turned(angle);
      if(!aside)continue;
      const {grey,width,height}=aside,mask=inkOf(grey,threshold);
      /** A point of the turned canvas, back in the plan's 0-1000 coordinates. */
      const back=(x:number,y:number)=>{
        const dx=x-width/2,dy=y-height/2,cos=Math.cos(angle),sin=Math.sin(angle);
        return [(dx*cos-dy*sin+w/2)/w*1000,(dx*sin+dy*cos+h/2)/h*1000];
      };
      walls.angles!.push(angle);
      walls.slanted!.push(
        ...wallLines(mask,width,height,true).map(line=>({a:back(line.at/1000*width,line.from/1000*height),b:back(line.at/1000*width,line.to/1000*height)})),
        ...wallLines(mask,width,height,false).map(line=>({a:back(line.from/1000*width,line.at/1000*height),b:back(line.to/1000*width,line.at/1000*height)})),
      );
      if(walls.slanted!.length>400)break;
    }
    return walls;
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
/** Adjust orthogonal outline edges together, keeping concave corners, curved sides and diagonal walls intact. */
export function snapOutline(polygon:number[][],walls:Walls,tx:number,ty:number,arcs?:number[]):number[][]{
  const original=toXY(polygon),points=original.map(p=>[...p]);
  original.forEach((a,i)=>{
    const j=(i+1)%original.length,b=original[j]!;
    if(bent(arcs?.[i]))return;
    if(Math.abs(a[0]!-b[0]!)<.01){const x=nearest(walls.x,a[0]!,Math.min(a[1]!,b[1]!),Math.max(a[1]!,b[1]!),tx);points[i]![0]=points[j]![0]=x;}
    if(Math.abs(a[1]!-b[1]!)<.01){const y=nearest(walls.y,a[1]!,Math.min(a[0]!,b[0]!),Math.max(a[0]!,b[0]!),ty);points[i]![1]=points[j]![1]=y;}
  });
  return validRoom({polygon:points as Point[],arcs})?toYX(points):polygon;
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

/** Distance from a point to a line, across it, in the plan's pixels; Infinity past its ends. */
function lineGap(line:Line,p:Point,tolerance:number){
  const along=(p[0]-line.p[0])*line.u[0]+(p[1]-line.p[1])*line.u[1];
  if((line.from!==undefined&&along<line.from-tolerance)||(line.to!==undefined&&along>line.to+tolerance))return Infinity;
  return Math.abs((p[0]-line.p[0])*line.u[1]-(p[1]-line.p[1])*line.u[0]);
}
function project(line:Line,p:Point):Point{
  const along=(p[0]-line.p[0])*line.u[0]+(p[1]-line.p[1])*line.u[1];
  return [line.p[0]+line.u[0]*along,line.p[1]+line.u[1]*along];
}
/** Where two lines cross; nothing when they run within 5° of each other. */
function meet(a:Line,b:Line):Point|undefined{
  const det=a.u[0]*b.u[1]-a.u[1]*b.u[0];
  if(Math.abs(det)<.09)return undefined;
  const t=((b.p[0]-a.p[0])*b.u[1]-(b.p[1]-a.p[1])*b.u[0])/det;
  return [a.p[0]+a.u[0]*t,a.p[1]+a.u[1]*t];
}
/** A line along one axis, at an exact 0-1000 coordinate, so that corners drawn onto it share it to the last digit. */
const axisLine=(coordinate:0|1,value:number,sx:number,sy:number,from?:number,to?:number):Line=>({
  p:coordinate===0?[value*sx,0]:[0,value*sy],
  u:coordinate===0?[0,1]:[1,0],
  ...(from===undefined?{}:{from:from*(coordinate===0?sy:sx)}),...(to===undefined?{}:{to:to*(coordinate===0?sy:sx)}),
  axis:{coordinate,value},
});
/** A line through two points of the plan, in pixels, kept between them. */
const edgeLine=(a:Point,b:Point):Line=>({p:a,u:direction(a,b),from:0,to:Math.hypot(b[0]-a[0],b[1]-a[1])});
/** A line through a point of the plan, in pixels, running in `angle` for ever. */
const angleLine=(p:Point,angle:number):Line=>({p,u:[Math.cos(angle),Math.sin(angle)]});
/** Back in 0-1000 coordinates, keeping the exact value of every axis guide used. */
function exactly(p:Point,guides:Guides,lines:Line[]):number[]{
  const point=fromPixel(p,guides.sx,guides.sy);
  for(const line of lines)if(line.axis)point[line.axis.coordinate]=line.axis.value;
  return point;
}
/**
 * A corner drawn or moved: it lands on the crossing of the two nearest guides, or slides onto the nearest one, so that sides
 * stay square, follow the walls drawn on the plan and line up with the other rooms — walls at an angle included.
 */
function snapPoint(point:number[],guides:Guides):number[]{
  const p=toPixel(point,guides.sx,guides.sy),tolerance=guides.tolerance;
  if(tolerance<=0)return [point[0]!,point[1]!];
  const close=guides.lines.map(line=>({line,gap:lineGap(line,p,tolerance)})).filter(c=>c.gap<=tolerance).sort((a,b)=>a.gap-b.gap);
  const best=close[0];
  if(!best)return [point[0]!,point[1]!];
  for(const {line} of close.slice(1)){
    const crossing=meet(best.line,line);
    if(crossing&&Math.hypot(crossing[0]-p[0],crossing[1]-p[1])<=tolerance*2)return exactly(crossing,guides,[best.line,line]);
  }
  return exactly(project(best.line,p),guides,[best.line]);
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
  static properties={src:{attribute:false},level:{type:Boolean},initial:{attribute:false},source:{attribute:false},plan:{attribute:false},detection:{attribute:false},walls:{attribute:false},fixtures:{attribute:false},busy:{type:Boolean},canUndo:{type:Boolean},fixture:{state:true},placing:{state:true},moving:{state:true},
    selected:{state:true},vertex:{state:true},side:{state:true},pending:{state:true},mode:{state:true},drag:{state:true},draft:{state:true},trace:{state:true},notice:{state:true},frame:{state:true},zoomLevel:{state:true},panning:{state:true},magnet:{state:true}};
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
    img{display:block;width:100%;height:100%;border-radius:inherit;pointer-events:none}
    /* A saved level has no drawing under it: a grid of metres, every fifth line stronger. */
    svg.grid{pointer-events:none}.grid line{stroke:#dde6ee;stroke-width:1;vector-effect:non-scaling-stroke}.grid line.major{stroke:#b3c6d6}svg,.layer{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit}.layer{pointer-events:none}
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
    /* Sides of the selected outline: wide enough for a finger to catch, highlighted once touched. */
    .side{fill:none;stroke:#ffffff01;stroke-width:16;vector-effect:non-scaling-stroke;cursor:move;touch-action:none}
    .side.active{stroke:#8acbff66}
    /* Waiting for the side to curve or the corner to round: those that can be touched stand out. */
    .picking-curve .side{stroke:#8acbff38;cursor:pointer}.picking-curve .side:hover{stroke:#8acbffaa}
    .picking-round .vertex{background:#8acbff;border-color:#fff;box-shadow:0 0 0 4px #8acbff55;cursor:pointer}
    /* The middle of the side last touched bends it; the mark above the room turns it. Neither is a resize handle. */
    .bend,.rotate{position:absolute;pointer-events:auto;touch-action:none;box-shadow:0 2px 6px #0008;cursor:grab}
    .bend::before,.rotate::before{content:'';position:absolute;inset:-9px}
    .bend{width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:#8acbff;border:2px solid #fff}
    .bend::after{content:'';position:absolute;inset:3px;border-radius:50%;background:#0b253d}
    .rotate{width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#0b253d;border:2px solid #8acbff}
    .rotate::after{content:'⟳';position:absolute;inset:-1px;display:grid;place-items:center;color:#8acbff;font:700 12px/1 system-ui,sans-serif}
    @media (pointer:coarse){.bend{width:19px;height:19px;margin:-9.5px 0 0 -9.5px}.rotate{width:22px;height:22px;margin:-11px 0 0 -11px}.bend::before,.rotate::before{inset:-12px}}
    .point{width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#69b7ff;border:2px solid #fff;pointer-events:none}.point.first{width:18px;height:18px;margin:-9px 0 0 -9px;background:#fff;border:3px solid #69b7ff}
    ul{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}
    li{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 8px;border-radius:10px;background:#ffffff08;border:1px solid #d6ecff14}li.selected{border-color:#8acbff;background:#69b7ff1a}
    .swatch{display:grid;place-items:center;min-width:22px;height:22px;border-radius:7px;color:#061421;font-size:11px;font-weight:700}
    input{flex:1;min-width:0;min-height:32px;padding:4px 8px;font:inherit;color:inherit;border:1px solid #b2d7f23b;border-radius:8px;background:#0b253d}small{color:#9fb6ca;white-space:nowrap}
    li button{min-height:30px;width:30px;padding:0;justify-content:center;border-color:transparent;background:transparent}li button:hover{background:#ff8a6a22}
    /* Doors, windows, televisions and speakers: a thick stroke along the wall, a round mark to move them, apart from the rooms. */
    .place{margin-top:2px}.place>span{color:#9fb6ca;font-size:12px}
    .place button[aria-pressed=true]{background:color-mix(in srgb,var(--tone) 32%,#0b253d);border-color:var(--tone)}.place button .mp-icon{color:var(--tone)}
    line.under{stroke:#fff;stroke-width:9;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none}
    line.opening{stroke:var(--tone);stroke-width:5;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none}
    line.opening.lost{stroke-dasharray:6 5}line.opening.preview{stroke-opacity:.8}
    .mark{position:absolute;display:grid;place-items:center;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:var(--tone);color:#061421;border:2px solid #fff;box-shadow:0 2px 8px #0009;pointer-events:auto;touch-action:none;cursor:move}
    .mark::before{content:'';position:absolute;inset:-8px}.mark.selected{box-shadow:0 0 0 4px #fff8,0 2px 8px #0009}.mark.lost{border-color:#ff8a6a;border-style:dashed}
    @media (pointer:coarse){.mark{width:28px;height:28px;margin:-14px 0 0 -14px}}
    ul.fixtures .swatch{color:#061421}ul.fixtures li span.what{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}ul.fixtures small.lost{color:#ffb4a0}
  `;
  src='';source?:Source;plan?:SpatialPlan;detection:DetectionRoom[]=[];walls?:Walls;busy=false;canUndo=false;
  /** A saved level rather than an analysed plan: no image under the rooms; `initial`, the room selected when it opens. */
  level=false;initial='';
  /** Doors, windows, televisions and speakers placed on the draft; `fixture`: the one selected. */
  fixtures:DraftFixture[]=[];private fixture='';
  /** An opening being drawn along `wall` (plan pixels) from `a` to `b`, or a television or a speaker being put down. */
  private placing?:{kind:FixtureKind;a:number[];b:number[];wall?:[Point,Point]};
  /** A placed one being dragged by its mark. */
  private moving?:{id:string;start:number[];delta:number[]};
  /** Selected room and, on its outline, the corner and the side last touched (-1: none). */
  private selected=-1;private vertex=-1;private side=-1;private naming=-1;
  /** « Courber le côté » or « Arrondir l’angle » chosen before its side or its corner: the next one touched gets it. */
  private pending:''|'curve'|'round'='';
  /** Drawing a new room: a rectangle dragged diagonally, or an outline corner by corner ([x, y] points; `cursor`: the next one). */
  private mode:''|'rect'|'trace'|FixtureKind='';private draft?:{start:[number,number];box:number[]};private trace?:{points:number[][];cursor?:number[]};private tracing=false;
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
    if(changed.has('initial')&&this.initial){const index=this.detection.findIndex(r=>r.id===this.initial);if(index>=0){this.selected=index;this.vertex=-1;this.side=-1;}}
    if(changed.has('fixtures')&&!this.fixtures.some(f=>f.id===this.fixture))this.fixture='';
    if(!changed.has('detection'))return;
    if(this.selected>=this.detection.length)this.selected=-1;
    if(this.selected<0)this.pending='';
    const count=this.detection[this.selected]?.polygon?.length??0;
    if(this.vertex>=count)this.vertex=-1;
    if(this.side>=count)this.side=-1;
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
  /** 0-1000 coordinates are stretched with the image; the plan's own pixels keep right angles square and curves circular. */
  private get unit(){const source=this.source;return {sx:(source?.width??1000)/1000,sy:(source?.height??1000)/1000};}
  /** The same attraction, in the plan's pixels; 0 with the magnet off. */
  private get pixelTolerance(){return this.magnet?10/Math.max(1,this.frame.width)*(this.source?.width??1000):0;}
  private pixels(points:number[][]):Point[]{const {sx,sy}=this.unit;return points.map(p=>toPixel(p,sx,sy));}
  /**
   * Directions the plan is drawn in, each with its square angle: those found in the image's strokes and those of the rooms'
   * slanted sides. The axes are left out, the corners and sides of the rooms already standing for them.
   */
  private get planAngles(){
    const found:number[]=[];
    const add=(angle:number)=>{
      const turned=((angle%(Math.PI/2))+Math.PI/2)%(Math.PI/2);
      if(turned>.03&&turned<Math.PI/2-.03&&!found.some(a=>Math.abs(a-turned)<.02)&&found.length<6)found.push(turned);
    };
    for(const angle of this.walls?.angles??[])add(angle);
    for(const room of this.detection)if(room.polygon){
      const shape=this.pixels(toXY(room.polygon));
      shape.forEach((a,i)=>{const b=shape[(i+1)%shape.length]!;if(Math.hypot(b[0]-a[0],b[1]-a[1])>8)add(Math.atan2(b[1]-a[1],b[0]-a[0]));});
    }
    return found.flatMap(angle=>[angle,angle+Math.PI/2]);
  }
  /**
   * Guides for a corner: the walls of the plan, the sides and corners of the rooms other than `except`, the `own` corners of
   * the outline being edited, and lines through `through` along the plan's own directions, which keep a room drawn at an angle square.
   */
  private guides(except:number,own:number[][]=[],through:number[][]=[]):Guides{
    const {sx,sy}=this.unit,walls=this.wallsBut(except),lines:Line[]=[];
    for(const line of walls.x)lines.push(axisLine(0,line.at,sx,sy,line.from,line.to));
    for(const line of walls.y)lines.push(axisLine(1,line.at,sx,sy,line.from,line.to));
    for(const edge of walls.slanted??[])lines.push(edgeLine(toPixel(edge.a,sx,sy),toPixel(edge.b,sx,sy)));
    const corner=(x:number,y:number)=>{lines.push(axisLine(0,x,sx,sy),axisLine(1,y,sx,sy));};
    this.detection.forEach((room,i)=>{
      if(i===except)return;
      corner(room.box_2d[1]!,room.box_2d[0]!);corner(room.box_2d[3]!,room.box_2d[2]!);
      for(const [y,x] of room.polygon??[])corner(x!,y!);
    });
    for(const [x,y] of own)corner(x!,y!);
    if(through.length)for(const angle of this.planAngles)for(const [x,y] of through)lines.push(angleLine(toPixel([x!,y!],sx,sy),angle));
    return {lines,sx,sy,tolerance:this.pixelTolerance};
  }
  /** The walls, but those of the room `except`: on a saved level, the walls are its rooms' sides, and a room is not held by its own. */
  private wallsBut(except:number):Walls{
    const walls=this.walls??{x:[],y:[]},id=this.detection[except]?.id;
    if(!id)return walls;
    const other=(line:{room?:string})=>line.room!==id;
    return {...walls,x:walls.x.filter(other),y:walls.y.filter(other),...(walls.slanted?{slanted:walls.slanted.filter(other)}:{})};
  }
  /** A room's shape in the plan, back on the image ([x, y] in 0-1000, with its bends): what is shown, carved by smaller rooms. */
  private planShape(room:DetectionRoom){
    const source=this.source,plan=room.id?this.plan?.floors[0]?.rooms.find(r=>r.id===room.id):undefined;
    if(!source||!plan)return undefined;
    const [kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    const points=plan.polygon.map(([x,y])=>[(x/kx+ox)/source.width*1000,(y/ky+oy)/source.height*1000]);
    return {points,arcs:tidyArcs(plan.arcs)};
  }
  /** A shape as drawn, curved sides followed, in 0-1000 coordinates. */
  private drawnPoints(points:number[][],arcs?:number[]){
    if(!arcs?.some(bent))return points;
    const {sx,sy}=this.unit;
    return outline(this.pixels(points),arcs).map(p=>fromPixel(p,sx,sy));
  }
  /** A room's outline in the plan, back on the image and as drawn. */
  private planOutline(room:DetectionRoom){
    const shape=this.planShape(room);
    return shape&&this.drawnPoints(shape.points,shape.arcs);
  }
  /** What the rooms belong to, in the messages. */
  private get where(){return this.level?'du niveau':'du brouillon';}
  private emit(detection:DetectionRoom[]){this.notice='';this.dispatchEvent(new CustomEvent('zones-change',{detail:detection}));}
  private drop(index:number){if(index<0||this.busy)return;this.selected=-1;this.vertex=-1;this.side=-1;this.emit(this.detection.filter((_,i)=>i!==index));}
  private rename(index:number,name:string){const clean=name.trim().slice(0,80);if(!clean||clean===this.detection[index]?.name)return;this.emit(this.detection.map((room,i)=>i===index?{...room,name:clean}:room));}
  /** Valid in the plan's own pixels, where a curved side is a circle: that is where its shape is checked. */
  private validShape(shape:number[][],arcs?:number[]){return validRoom({polygon:this.pixels(shape),arcs} as SpatialRoom);}
  /** New shape of a room, with the bends of its sides; refused when it crosses itself or is too small (the room stays as it was). */
  private reshape(index:number,shape:number[][],arcs?:number[]){
    const bends=tidyArcs(arcs),box=bounds(this.drawnPoints(shape,bends));
    if(shape.length<3||box[2]!-box[0]!<MIN||box[3]!-box[1]!<MIN||!this.validShape(shape,bends)){this.notice='Contour impossible : il se croise ou il est trop petit. La pièce reste comme avant.';return;}
    this.emit(this.detection.map((room,i)=>{
      if(i!==index)return room;
      const next={...room,polygon:toYX(shape),box_2d:box,...(bends?{arcs:bends}:{})};
      if(!bends)delete next.arcs;
      return next;
    }));
  }
  /** « Forme libre » : the outline as shown (a room carved by a smaller one keeps its notch), with a handle on each corner. */
  private freeShape(){
    const room=this.detection[this.selected];
    if(!room||this.busy)return;
    const shape=this.planShape(room);
    this.reshape(this.selected,shape&&shape.points.length>=3?shape.points:corners(room.box_2d),shape?.arcs);
  }
  /** Back to the rectangle around the outline, curves dropped. */
  private rectangle(){
    if(!this.detection[this.selected]?.polygon||this.busy)return;
    this.vertex=-1;this.side=-1;
    this.emit(this.detection.map((room,i)=>{if(i!==this.selected)return room;const copy={...room};delete copy.polygon;delete copy.arcs;return copy;}));
  }
  private removeVertex(){
    const room=this.detection[this.selected];
    if(!room?.polygon||this.vertex<0||this.busy)return;
    if(room.polygon.length<=3){this.notice='Un contour garde au moins trois points.';return;}
    const shape=toXY(room.polygon).filter((_,k)=>k!==this.vertex);
    const arcs=room.arcs?.filter((_,k)=>k!==this.vertex);
    this.vertex=-1;this.side=-1;this.reshape(this.selected,shape,arcs);
  }
  /**
   * The bends that leave side `index` tangent to the straight side next to it: exactly a rounded corner between two walls,
   * or a rounded end across a corridor.
   */
  private tangentBends(shape:number[][],index:number,arcs?:number[]){
    const count=shape.length,points=this.pixels(shape),at=(i:number)=>points[((i%count)+count)%count]!;
    const wrap=(angle:number)=>((angle+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    const a=at(index),b=at(index+1),chord=Math.atan2(b[1]-a[1],b[0]-a[0]),bends:number[]=[];
    if(!bent(arcs?.[(index+count-1)%count]))bends.push(Math.tan(wrap(Math.atan2(a[1]-at(index-1)[1],a[0]-at(index-1)[0])-chord)/2));
    if(!bent(arcs?.[(index+1)%count]))bends.push(Math.tan(wrap(chord-Math.atan2(at(index+2)[1]-b[1],at(index+2)[0]-b[0]))/2));
    return bends.filter(bulge=>bent(bulge)&&Math.abs(bulge)<=1);
  }
  /** Which way is out of the room: a bend of that sign pushes a wall outwards. */
  private outward(shape:number[][]){
    const signed=shape.reduce((sum,p,i)=>{const q=shape[(i+1)%shape.length]!;return sum+p[0]!*q[1]!-q[0]!*p[1]!;},0);
    return signed>0?-1:1;
  }
  /** « Courber le côté » : the side last touched bows out as a quarter circle; « Redresser le côté » puts it back straight. */
  private curveSide(){
    const room=this.detection[this.selected];
    if(!room?.polygon||this.side<0||this.busy)return;
    const shape=toXY(room.polygon),arcs=shape.map((_,i)=>bendOf(room.arcs,i));
    arcs[this.side]=bent(arcs[this.side])?0:.4142*this.outward(shape);
    this.reshape(this.selected,shape,arcs);
  }
  /**
   * « Arrondir l’angle » : the corner last touched gives way to an arc tangent to its two walls, starting a third of the
   * shorter one away from it. The new curved side is then the one touched: its round handle sets the radius.
   */
  private roundCorner(){
    const room=this.detection[this.selected];
    if(!room?.polygon||this.vertex<0||this.busy)return;
    const shape=toXY(room.polygon),count=shape.length,v=this.vertex,before=(v+count-1)%count,arcs=shape.map((_,i)=>bendOf(room.arcs,i));
    if(bent(arcs[before])||bent(arcs[v])){this.notice='Cet angle touche un côté courbe : redressez-le d’abord pour arrondir l’angle.';return;}
    if(count>=MAX_POINTS){this.notice=`Un contour compte au plus ${MAX_POINTS} points : supprimez-en un pour arrondir cet angle.`;return;}
    const {sx,sy}=this.unit,points=this.pixels(shape),corner=points[v]!,previous=points[before]!,next=points[(v+1)%count]!;
    const reach=Math.min(Math.hypot(previous[0]-corner[0],previous[1]-corner[1]),Math.hypot(next[0]-corner[0],next[1]-corner[1]))/3;
    const toward=(p:Point)=>{const u=direction(corner,p);return fromPixel([corner[0]+u[0]*reach,corner[1]+u[1]*reach],sx,sy);};
    const rounded=[...shape];rounded.splice(v,1,toward(previous),toward(next));
    const bends=[...arcs];bends.splice(v,0,0);
    const tangent=this.tangentBends(rounded,v,bends)[0];
    if(tangent===undefined){this.notice='Cet angle est plat : il n’y a rien à arrondir.';return;}
    bends[v]=tangent;
    this.vertex=-1;this.side=v;this.reshape(this.selected,rounded,bends);
  }
  /**
   * The toolbar's « Courber le côté » and « Arrondir l’angle »: applied at once to the side or the corner last touched,
   * otherwise waiting for the next one touched. A rectangle takes its outline first, so that its sides and corners can be touched.
   */
  private useTool(tool:'curve'|'round'){
    const room=this.detection[this.selected];
    if(!room||this.mode||this.busy)return;
    if(room.polygon&&(tool==='curve'?this.side:this.vertex)>=0){this.pending='';if(tool==='curve')this.curveSide();else this.roundCorner();return;}
    if(this.pending===tool){this.pending='';return;}
    this.pending=tool;this.vertex=-1;this.side=-1;this.notice='';
    if(!room.polygon){this.freeShape();if(this.notice)this.pending='';}
  }
  /** A side moved sideways without turning: each of its corners follows the side next to it, which keeps its own direction. */
  private slideSide(drag:Drag,p:number[]){
    const {sx,sy}=this.unit,from=drag.from!,index=drag.side!,count=from.length;
    const points=this.pixels(from),a=points[index]!,b=points[(index+1)%count]!;
    const u=direction(a,b),n:Point=[-u[1],u[0]];
    const pointer=toPixel(p,sx,sy),start=toPixel(drag.start,sx,sy);
    const offset=this.snapOffset(a,b,n,(pointer[0]-start[0])*n[0]+(pointer[1]-start[1])*n[1],drag.index);
    const shifted=(q:Point):Point=>[q[0]+n[0]*offset,q[1]+n[1]*offset];
    const line:Line={p:shifted(a),u},moved=[...points];
    for(const [corner,neighbour,side] of [[index,(index+count-1)%count,(index+count-1)%count],[(index+1)%count,(index+2)%count,(index+1)%count]] as const){
      const own=points[corner]!,other=points[neighbour]!;
      const crossing=bent(drag.arcs?.[side])?undefined:meet(line,{p:other,u:direction(other,own)});
      moved[corner]=crossing??shifted(own);
    }
    return moved.map(q=>fromPixel(q,sx,sy));
  }
  /** The moved side drawn onto a wall of the plan, or onto a side of another room running the same way. */
  private snapOffset(a:Point,b:Point,n:Point,offset:number,except:number){
    const tolerance=this.pixelTolerance;
    if(tolerance<=0)return offset;
    const u=direction(a,b),middle:Point=[(a[0]+b[0])/2+n[0]*offset,(a[1]+b[1])/2+n[1]*offset];
    let best=offset,gap=tolerance;
    for(const line of this.guides(except).lines){
      if(Math.abs(line.u[0]*u[1]-line.u[1]*u[0])>.03)continue;  // not running the same way: another wall
      const along=(middle[0]-line.p[0])*line.u[0]+(middle[1]-line.p[1])*line.u[1];
      if((line.from!==undefined&&along<line.from-tolerance)||(line.to!==undefined&&along>line.to+tolerance))continue;
      const across=(line.p[0]-middle[0])*n[0]+(line.p[1]-middle[1])*n[1];
      if(Math.abs(across)<=gap){gap=Math.abs(across);best=offset+across;}
    }
    return best;
  }
  /** The bend of the side being pulled; within a few pixels it settles on straight, a quarter or a half circle, or a tangent join. */
  private bendSide(drag:Drag,p:number[]){
    const {sx,sy}=this.unit,shape=drag.from!,index=drag.side!,count=shape.length;
    const points=this.pixels(shape),a=points[index]!,b=points[(index+1)%count]!;
    const u=direction(a,b),n:Point=[-u[1],u[0]],half=Math.hypot(b[0]-a[0],b[1]-a[1])/2;
    const pointer=toPixel(p,sx,sy);
    const sagitta=(pointer[0]-(a[0]+b[0])/2)*n[0]+(pointer[1]-(a[1]+b[1])/2)*n[1];
    const pulled=half>1e-6?Math.max(-1,Math.min(1,sagitta/half)):0;
    const arcs=[...drag.arcs??shape.map(()=>0)];
    let gap=this.pixelTolerance,settled:number|undefined;
    for(const candidate of [0,.4142,-.4142,1,-1,...this.tangentBends(shape,index,arcs)]){
      const distance=Math.abs((candidate-pulled)*half);
      if(distance<=gap){gap=distance;settled=candidate;}
    }
    arcs[index]=Math.round((settled??pulled)*1e4)/1e4;
    return arcs;
  }
  /** The room turned around its middle; nothing when it would leave the plan. */
  private turnShape(drag:Drag,p:number[]){
    const {sx,sy}=this.unit,points=this.pixels(drag.from!);
    const xs=points.map(q=>q[0]),ys=points.map(q=>q[1]);
    const centre:Point=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
    const from=toPixel(drag.start,sx,sy),to=toPixel(p,sx,sy);
    const pulled=Math.atan2(to[1]-centre[1],to[0]-centre[0])-Math.atan2(from[1]-centre[1],from[0]-centre[0]);
    const angle=this.snapRotation(points,pulled),cos=Math.cos(angle),sin=Math.sin(angle);
    const turned=points.map(q=>{
      const dx=q[0]-centre[0],dy=q[1]-centre[1];
      return [centre[0]+dx*cos-dy*sin,centre[1]+dx*sin+dy*cos] as Point;
    });
    // A room along the edge of the plan slides back in as it turns; one too big to fit at that angle keeps its own.
    const width=this.source?.width??1000,height=this.source?.height??1000;
    const left=Math.min(...turned.map(q=>q[0])),right=Math.max(...turned.map(q=>q[0]));
    const top=Math.min(...turned.map(q=>q[1])),bottom=Math.max(...turned.map(q=>q[1]));
    const dx=left<0?-left:right>width?width-right:0,dy=top<0?-top:bottom>height?height-bottom:0;
    const moved=turned.map(q=>[q[0]+dx,q[1]+dy] as Point);
    if(moved.some(q=>q[0]<-.5||q[1]<-.5||q[0]>width+.5||q[1]>height+.5))return undefined;
    return {shape:moved.map(q=>fromPixel(q,sx,sy)),angle};
  }
  /** Turning settles when the room's longest wall lines up with an axis or with a direction the plan is drawn in, within 2°. */
  private snapRotation(points:Point[],pulled:number){
    const tolerance=this.magnet?Math.PI/90:0;
    if(!tolerance)return pulled;
    let reference=0,longest=0;
    points.forEach((a,i)=>{
      const b=points[(i+1)%points.length]!,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length>longest){longest=length;reference=Math.atan2(b[1]-a[1],b[0]-a[0]);}
    });
    const quarter=(angle:number)=>((angle%(Math.PI/2))+Math.PI/2)%(Math.PI/2),current=quarter(reference+pulled);
    let best=pulled,gap=tolerance;
    for(const target of [0,Math.PI/2,...this.planAngles.map(quarter)]){
      const difference=target-current;
      if(Math.abs(difference)<=gap){gap=Math.abs(difference);best=pulled+difference;}
    }
    return best;
  }
  private startMode(mode:'rect'|'trace'|FixtureKind){this.panning=false;this.mode=this.mode===mode?'':mode;this.draft=undefined;this.trace=undefined;this.placing=undefined;this.selected=-1;this.vertex=-1;this.side=-1;this.pending='';this.fixture='';this.notice='';}
  private get fixtureMode(){return this.mode!==''&&this.mode!=='rect'&&this.mode!=='trace'?this.mode:undefined;}
  private emitFixtures(fixtures:DraftFixture[]){this.notice='';this.dispatchEvent(new CustomEvent('fixtures-change',{detail:fixtures}));}
  /** The sides of the rooms as drawn on the image, in the plan's pixels: where a door or a window can go. */
  private wallPieces(){
    const pieces:[Point,Point][]=[];
    for(const room of this.detection){const ring=this.planOutline(room);if(!ring)continue;const points=this.pixels(ring);points.forEach((p,i)=>pieces.push([p,points[(i+1)%points.length]!]));}
    return pieces;
  }
  /** The wall nearest to `p` (plan pixels), when it is within about 40 screen pixels. */
  private nearestWall(p:Point):[Point,Point]|undefined{
    let best:{wall:[Point,Point];distance:number}|undefined;
    for(const wall of this.wallPieces()){const q=closest(wall[0],wall[1],p),distance=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!best||distance<best.distance)best={wall,distance};}
    const reach=40/Math.max(1,this.frame.width)*(this.source?.width??1000);
    return best&&best.distance<=reach?best.wall:undefined;
  }
  /**
   * An opening drawn from `a` to `b` (0-1000), laid on the line of `wall`; barely drawn, as wide as usual for its kind
   * around `a`. Its two ends, in 0-1000.
   */
  private onWall(wall:[Point,Point],a:number[],b:number[],kind:OpeningKind):[number[],number[]]{
    const {sx,sy}=this.unit,u=direction(wall[0],wall[1]),along=(q:number[])=>{const p=toPixel(q,sx,sy);return (p[0]-wall[0][0])*u[0]+(p[1]-wall[0][1])*u[1];};
    let [t0,t1]=[along(a),along(b)];
    if(Math.abs(t1-t0)/(this.source?.width??1000)*this.frame.width<8){const half=OPENING_SIZES[kind].width/(this.source?.scale[0]??.01)/2;[t0,t1]=[t0-half,t0+half];}
    const at=(t:number)=>fromPixel([wall[0][0]+u[0]*t,wall[0][1]+u[1]*t],sx,sy).map(round);
    return [at(Math.min(t0,t1)),at(Math.max(t0,t1))];
  }
  /** Whether `p` (0-1000) is in a room of the draft. */
  private inRoom(p:number[]){const {sx,sy}=this.unit;return this.detection.some(room=>{const ring=this.planOutline(room);return !!ring&&insideRoom({polygon:this.pixels(ring)},toPixel(p,sx,sy));});}
  /** A placed one as shown: dragged by its mark, its ends moved together. */
  private shown(fixture:DraftFixture){
    const d=this.moving?.id===fixture.id?this.moving.delta:[0,0],move=(p:number[])=>[p[0]!+d[0]!,p[1]!+d[1]!];
    return {a:move(fixture.a),b:fixture.b&&move(fixture.b)};
  }
  /** Down in a placing mode: an opening starts on the wall touched; a television or a speaker waits for the pointer to lift. */
  private startPlacing(kind:FixtureKind,p:[number,number]){
    if(!isOpening(kind)){this.placing={kind,a:p,b:p};return true;}
    const {sx,sy}=this.unit,wall=this.nearestWall(toPixel(p,sx,sy));
    if(!wall){this.notice=`Touchez un mur d’une pièce ${this.where} : ${FIXTURES[kind].article} s’y pose.`;return false;}
    this.placing={kind,a:p,b:p,wall};
    return true;
  }
  /** Up in a placing mode: the opening along its wall, or the television or speaker in its room. The mode stays on for the next one. */
  private finishPlacing(){
    const placing=this.placing;this.placing=undefined;
    if(!placing)return;
    const id=`${isOpening(placing.kind)?'opening':'media'}-${shortId()}`;
    let fixture:DraftFixture;
    if(isOpening(placing.kind)&&placing.wall){const [a,b]=this.onWall(placing.wall,placing.a,placing.b,placing.kind);fixture={id,kind:placing.kind,a,b};}
    else{
      if(!this.inRoom(placing.a)){this.notice=`Touchez l’intérieur d’une pièce ${this.where}, là où se trouve ${FIXTURES[placing.kind].article}.`;return;}
      fixture={id,kind:placing.kind,a:placing.a.map(round)};
    }
    this.fixture=id;
    this.emitFixtures([...this.fixtures,fixture]);
  }
  /** A mark dropped: moved as dragged, an opening laid again on the wall nearest to its middle. */
  private finishMoving(){
    const moving=this.moving,fixture=this.fixtures.find(f=>f.id===moving?.id),shown=fixture&&this.shown(fixture);
    this.moving=undefined;
    if(!moving||!fixture||!shown||Math.hypot(moving.delta[0]!/this.screenTolerance[0],moving.delta[1]!/this.screenTolerance[1])<.4)return;
    let a=shown.a.map(round),b=shown.b?.map(round);
    if(isOpening(fixture.kind)&&b){
      const {sx,sy}=this.unit,middle=toPixel([(a[0]!+b[0]!)/2,(a[1]!+b[1]!)/2],sx,sy),wall=this.nearestWall(middle);
      if(wall){
        // Laid along the wall now nearest, its length kept, its middle brought onto the wall.
        const half=Math.hypot((b[0]!-a[0]!)*sx,(b[1]!-a[1]!)*sy)/2,u=direction(wall[0],wall[1]),c=closest(wall[0],wall[1],middle);
        [a,b]=[fromPixel([c[0]-u[0]*half,c[1]-u[1]*half],sx,sy).map(round),fromPixel([c[0]+u[0]*half,c[1]+u[1]*half],sx,sy).map(round)];
      }
    }
    this.emitFixtures(this.fixtures.map(f=>f.id===fixture.id?{...f,a,...(b?{b}:{})}:f));
  }
  private dropFixture(id:string){if(!id||this.busy)return;this.fixture='';this.emitFixtures(this.fixtures.filter(f=>f.id!==id));}
  /** Next corner of the outline being drawn (true when placed); back on the first corner, the outline is closed. */
  private tracePoint(p:number[]){
    const points=this.trace?.points??[],first=points[0],last=points.at(-1);
    const [sx,sy]=this.screenTolerance;
    const near=(a:number[],b:number[],radius:number)=>Math.hypot((a[0]!-b[0]!)/sx,(a[1]!-b[1]!)/sy)<radius;
    if(first&&points.length>=3&&near(p,first,1.2)){this.finishTrace();return false;}
    // On the last corner again: a double click or tap closes the outline.
    if(last&&near(p,last,.8)){if(points.length>=3&&performance.now()-this.placedAt<450)this.finishTrace();return false;}
    if(points.length>=MAX_POINTS)return false;
    this.trace={points:[...points,snapPoint(p,this.traceGuides(points))]};this.placedAt=performance.now();
    return true;
  }
  /**
   * Guides while tracing: the walls and the other rooms, plus, from the corners already placed, the directions the plan is
   * drawn in — so the sides of a room drawn at an angle stay parallel and square.
   */
  private traceGuides(points:number[][]){
    const placed=points.length?[points.at(-1)!,points[0]!]:[];
    return this.guides(-1,points,placed);
  }
  private finishTrace(){
    const points=this.trace?.points??[];
    if(points.length<3)return;
    const box=bounds(points);
    if(box[2]!-box[0]!<MIN||box[3]!-box[1]!<MIN||!this.validShape(points)){this.notice='Contour impossible : il se croise ou il est trop petit. Retirez le dernier point (Retour arrière) ou recommencez.';return;}
    this.trace=undefined;this.mode='';
    this.add({box_2d:box,polygon:toYX(points)});
  }
  /** A room drawn on the plan, numbered after the others; its name is then selected, ready to be typed. */
  private add(shape:{box_2d:number[];polygon?:number[][]}){
    this.selected=this.naming=this.detection.length;this.vertex=-1;this.side=-1;
    const hue=Math.max(this.detection.length-1,...this.detection.map(r=>r.hue??0))+1;
    this.emit([...this.detection,{name:`Pièce ${this.detection.length+1}`,...shape,hue}]);
  }
  /**
   * What the pointer took: a corner, a side's + or a side of the selected outline, its bend or rotation handle, a handle of
   * the selected rectangle, or a room.
   */
  private grab(target:Element,p:[number,number]){
    // The mark of a door, a window, a television or a speaker: selected, and dragged to move it.
    const mark=target.closest<HTMLElement>('[data-fixture]');
    if(mark){this.fixture=mark.dataset.fixture!;this.selected=-1;this.vertex=-1;this.side=-1;this.pending='';this.moving={id:this.fixture,start:p,delta:[0,0]};return true;}
    const element=target.closest<HTMLElement>('[data-vertex],[data-mid],[data-side],[data-bend],[data-rotate],[data-handle],[data-zone]');
    const room=this.detection[this.selected];
    if(!element)return false;
    const {vertex,mid,side,bend,rotate,handle,zone}=element.dataset;
    // The side or the corner that « Courber le côté » or « Arrondir l’angle » was waiting for.
    const picked=this.pending==='curve'?side??bend??mid:this.pending==='round'?vertex:undefined;
    if(room?.polygon&&picked!==undefined){
      const tool=this.pending;this.pending='';
      if(tool==='curve'){this.vertex=-1;this.side=Number(picked);this.curveSide();}
      else{this.side=-1;this.vertex=Number(picked);this.roundCorner();}
      return true;
    }
    const start=(handle:Handle,shape:number[][]|undefined,arcs:number[]|undefined,extra:Partial<Drag>={})=>{
      this.drag={index:this.selected,handle,start:p,origin:[...room!.box_2d],box:[...room!.box_2d],moved:false,...(shape?{shape,from:shape}:{}),...(arcs?{arcs}:{}),...extra};
      return true;
    };
    if(room?.polygon&&(vertex!==undefined||mid!==undefined)){
      // A corner tapped twice goes away.
      if(vertex!==undefined&&this.lastTap?.vertex===Number(vertex)&&performance.now()-this.lastTap.time<450){this.lastTap=undefined;this.vertex=Number(vertex);this.removeVertex();return true;}
      let shape=toXY(room.polygon),arcs=room.arcs?.map(b=>b);
      let index=Number(vertex);
      if(mid!==undefined){
        // A corner added in the middle of the side, on its curve when it is curved; both halves keep bending the same way.
        index=Number(mid)+1;
        const split=splitSide(this.pixels(shape),arcs,Number(mid));
        shape=split.polygon.map(q=>fromPixel(q,this.unit.sx,this.unit.sy));arcs=split.arcs;
      }
      this.vertex=index;this.side=-1;
      return start('vertex',shape,arcs,{vertex:index,inserted:mid!==undefined,guides:this.guides(this.selected,shape.filter((_,k)=>k!==index),[shape[(index+shape.length-1)%shape.length]!,shape[(index+1)%shape.length]!])});
    }
    if(room?.polygon&&(side!==undefined||bend!==undefined)){
      const index=Number(side??bend),shape=toXY(room.polygon),arcs=shape.map((_,i)=>bendOf(room.arcs,i));
      if(bend===undefined){this.vertex=-1;this.side=index;}
      return start(bend===undefined?'side':'bend',shape,arcs,{side:index});
    }
    if(room&&rotate!==undefined){
      const shape=room.polygon?toXY(room.polygon):corners(room.box_2d);
      this.vertex=-1;this.side=-1;
      return start('rotate',shape,room.polygon?room.polygon.map((_,i)=>bendOf(room.arcs,i)):undefined,{angle:0});
    }
    if(handle&&room)return start(handle as Handle,undefined,undefined);
    if(zone===undefined)return false;
    const index=Number(zone),box=[...this.detection[index]!.box_2d];
    if(index!==this.selected)this.pending='';
    this.fixture='';
    this.selected=index;this.vertex=-1;this.side=-1;
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
    else if(this.fixtureMode){if(!this.startPlacing(this.fixtureMode,p))return;}
    else if(!this.grab(e.target as Element,p)){this.selected=-1;this.vertex=-1;this.pending='';this.fixture='';return;}
    figure.setPointerCapture(e.pointerId);
    // No text selection nor page drag; keep the keyboard on the plan for Delete and Escape.
    e.preventDefault();figure.focus({preventScroll:true});
  };
  private move=(e:PointerEvent)=>{
    if(this.pinch)return;
    if(this.pan){const v=this.renderRoot.querySelector<HTMLElement>('.viewport')!;v.scrollLeft=this.pan.left+this.pan.x-e.clientX;v.scrollTop=this.pan.top+this.pan.y-e.clientY;return;}
    // An opening drawn along its wall, a television or a speaker following the pointer, a mark being dragged.
    if(this.placing){const p=this.point(e);this.placing={...this.placing,b:p,...(isOpening(this.placing.kind)?{}:{a:p})};return;}
    if(this.moving){const p=this.point(e);this.moving={...this.moving,delta:[p[0]-this.moving.start[0]!,p[1]-this.moving.start[1]!]};return;}
    const [tx,ty]=this.tolerance;
    if(this.mode==='trace'){
      const points=this.trace?.points;
      if(!points?.length)return;
      const p=this.point(e),placed=points.slice(0,-1);
      // Held down, the corner just placed follows the finger; otherwise the next side follows the pointer.
      if(this.tracing)this.trace={points:[...placed,snapPoint(p,this.traceGuides(placed))]};
      else this.trace={points,cursor:snapPoint(p,this.traceGuides(points))};
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
      shape[drag.vertex!]=snapPoint(p,drag.guides!);
      this.drag={...drag,shape,moved:true};
      return;
    }
    if(drag.handle==='side'){this.drag={...drag,shape:this.slideSide(drag,p),moved:true};return;}
    if(drag.handle==='bend'){this.drag={...drag,arcs:this.bendSide(drag,p),moved:true};return;}
    if(drag.handle==='rotate'){
      const turned=this.turnShape(drag,p);
      if(turned)this.drag={...drag,shape:turned.shape,angle:turned.angle,moved:true};
      return;
    }
    let [y0,x0,y1,x1]=drag.origin as [number,number,number,number];
    const walls=this.wallsBut(drag.index);
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
    if(this.placing){this.finishPlacing();return;}
    if(this.moving){this.finishMoving();return;}
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
      let shape=drag.shape!,arcs=drag.arcs;
      // Dropped onto a neighbouring corner: this corner goes away.
      const onto=(k:number)=>Math.hypot((shape[v]![0]!-shape[k]![0]!)/tx,(shape[v]![1]!-shape[k]![1]!)/ty)<.8;
      if(count>3&&(onto((v+1)%count)||onto((v+count-1)%count))){shape=shape.filter((_,k)=>k!==v);arcs=arcs?.filter((_,k)=>k!==v);this.vertex=-1;}
      this.reshape(drag.index,shape,arcs);
      return;
    }
    if(drag.handle==='side'||drag.handle==='bend'||drag.handle==='rotate'){this.reshape(drag.index,drag.shape!,drag.arcs);return;}
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
    if((e.key==='Delete'||e.key==='Backspace')&&this.fixture){e.preventDefault();this.dropFixture(this.fixture);}
    else if((e.key==='Delete'||e.key==='Backspace')&&this.selected>=0){e.preventDefault();if(this.vertex>=0)this.removeVertex();else this.drop(this.selected);}
    else if(e.key==='Escape'&&this.pending){e.preventDefault();this.pending='';}
    // Placing doors, windows and players, or one of them selected: Escape ends that, the window stays open.
    else if(e.key==='Escape'&&(this.fixtureMode||this.fixture)){e.preventDefault();this.mode='';this.placing=undefined;this.fixture='';}
    else if(e.key==='Escape'){this.mode='';this.draft=undefined;this.trace=undefined;this.placing=undefined;this.selected=-1;this.vertex=-1;this.side=-1;this.fixture='';}
  };
  /** On a phone, a finger on a room, a handle or in drawing mode edits the plan instead of scrolling the window. */
  private touch={handleEvent:(e:TouchEvent)=>{
    if(e.touches.length>=2){
      e.preventDefault();const a=e.touches[0]!,b=e.touches[1]!,distance=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      if(!this.pinch){this.pinch={distance:Math.max(1,distance),zoom:this.zoomLevel};this.drag=undefined;this.draft=undefined;this.pan=undefined;this.tracing=false;}
      else this.zoomTo(this.pinch.zoom*distance/this.pinch.distance,(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
    }else if(this.pinch){if(!e.touches.length)this.pinch=undefined;else e.preventDefault();}
    else if(this.mode||this.panning||(e.target as Element).closest('[data-handle],[data-zone],[data-vertex],[data-mid],[data-side],[data-bend],[data-rotate],[data-fixture]'))e.preventDefault();
  },passive:false};
  private label(index:number,room:DetectionRoom,points:number[][]){
    const spot=labelSpot(points),name=room.name;
    const size=Math.min(15,spot.width/1000*this.frame.width/Math.max(4,name.length*.6),spot.height/1000*this.frame.height*.4);
    const style=`left:${spot.x/10}%;top:${spot.y/10}%`;
    // Too small for its name: its number, as in the list.
    return size<9?html`<span class="label number" style=${`${style};color:${colour(room,index)}`} title=${name}>${index+1}</span>`:html`<span class="label" style=${`${style};font-size:${size}px`}>${name}</span>`;
  }
  private get hint(){
    const room=this.detection[this.selected],count=this.trace?.points.length??0,kind=this.fixtureMode;
    if(kind&&isOpening(kind))return `Glissez le long d’un mur, d’un bord à l’autre de ${FIXTURES[kind].article}, ou touchez le mur pour la poser à sa largeur usuelle (${new Intl.NumberFormat('fr',{minimumFractionDigits:2}).format(OPENING_SIZES[kind].width)} m). Échap pour terminer.`;
    if(kind)return `Touchez l’endroit de la pièce où se trouve ${FIXTURES[kind].article}. Échap pour terminer.`;
    if(this.fixture)return this.level?'Glissez sa marque pour le déplacer : ses volets, capteurs ou son lecteur le suivent. Suppr ou « Retirer » l’enlève.'
      :'Glissez sa marque pour le déplacer ; Suppr ou « Retirer » l’enlève. Volets, capteurs et lecteurs se relient ensuite, dans le Studio, sous le plan 3D.';
    if(this.mode==='rect')return 'Glissez en diagonale sur le plan pour tracer un rectangle.';
    if(this.mode==='trace')return count<3?'Touchez les angles de la pièce l’un après l’autre ; les murs et les autres pièces attirent les points.'
      :'Touchez l’angle suivant ; pour fermer, touchez le premier point ou deux fois le dernier. Les côtés restent parallèles et d’équerre au premier, même en biais.';
    const turning=this.drag?.handle==='rotate'&&this.drag.angle!==undefined;
    if(turning)return `Rotation : ${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(this.drag!.angle!*180/Math.PI)}° — relâchez pour valider.`;
    if(room&&this.pending==='curve')return 'Touchez le côté à courber : il se bombe vers l’extérieur en quart de cercle, puis son rond du milieu règle la courbure. Échap pour annuler.';
    if(room&&this.pending==='round')return 'Touchez l’angle à arrondir : un arc le remplace, raccordé aux deux murs, puis son rond du milieu règle le rayon. Échap pour annuler.';
    if(room?.polygon&&this.side>=0)return `Glissez le côté pour le déplacer sans le tourner, son rond du milieu pour le courber${bent(room.arcs?.[this.side])?' ou le redresser':''} ; ⟳ tourne la pièce.`;
    if(room?.polygon&&this.vertex>=0)return 'Glissez le point, ou « Arrondir l’angle » pour le remplacer par un arc ; deux touches rapides le suppriment.';
    if(room?.polygon)return 'Glissez un point, un côté (il reste parallèle) ou ⟳ pour tourner la pièce ; un + ajoute un point. « Courber le côté » ou « Arrondir l’angle » pour une pièce arrondie.';
    if(room)return 'Glissez la pièce ou ses poignées, ⟳ pour la tourner. « Courber le côté » ou « Arrondir l’angle » pour une pièce arrondie, « Forme libre » pour un autre contour.';
    return 'Touchez une pièce pour l’ajuster, ou ajoutez-en une. « Placer » pose portes, fenêtres, téléviseurs et enceintes sur le plan.';
  }
  /** The metres of the plan, where there is no drawing to follow. */
  private grid(source:Source){
    const lines=(size:number,k:number,o:number)=>{
      const out:{at:number;major:boolean}[]=[];
      for(let m=Math.ceil(-o*k);m<=Math.floor((size-o)*k)&&out.length<400;m++)out.push({at:(m/k+o)/size*1000,major:m%5===0});
      return out;
    };
    const [kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    return html`<svg class="grid" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${lines(source.width,kx,ox).map(l=>svg`<line class=${l.major?'major':''} x1=${l.at} y1="0" x2=${l.at} y2="1000"></line>`)}${lines(source.height,ky,oy).map(l=>svg`<line class=${l.major?'major':''} x1="0" y1=${l.at} x2="1000" y2=${l.at}></line>`)}</svg>`;
  }
  render(){
    const source=this.source;
    if(!source)return nothing;
    const rooms=new Map((this.plan?.floors[0]?.rooms??[]).map(r=>[r.id,r])),[kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    const normalised=([x,y]:number[])=>`${((x!/kx+ox)/source.width*1000).toFixed(1)},${((y!/ky+oy)/source.height*1000).toFixed(1)}`;
    const room=this.detection[this.selected],dragging=this.drag?.index===this.selected?this.drag:undefined;
    // Where each door, window, television or speaker goes on the plan, as the level will get it.
    const placed=this.plan?attachFixtures(this.plan,this.fixtures,source).placed:new Map<string,{room:string;width?:number}>();
    const roomNames=new Map((this.plan?.floors[0]?.rooms??[]).map(r=>[r.id,r.name])),metres=new Intl.NumberFormat('fr',{minimumFractionDigits:2,maximumFractionDigits:2});
    const preview=this.placing?.wall&&isOpening(this.placing.kind)?this.onWall(this.placing.wall,this.placing.a,this.placing.b,this.placing.kind):undefined;
    // The selected room as it is being edited: its outline (with its bends), or its rectangle. Turning a rectangle gives it one.
    const shape=dragging?.handle==='rotate'?dragging.shape:room?.polygon?dragging?.shape??(dragging?shifted(toXY(room.polygon),dragging):toXY(room.polygon)):undefined;
    const bends=shape?dragging?.arcs??(room?.polygon?room.arcs:undefined):undefined;
    const drawn=shape?this.drawnPoints(shape,bends):undefined;
    const box=room&&!room.polygon&&!shape?dragging?.box??room.box_2d:undefined;
    // The mark that turns the room stands beyond one of its corners, on the diagonal: well clear of its own handles, even
    // under a finger, and on the corner that keeps it on the plan.
    const frame=shape??(box?corners(box):undefined);
    const turner=frame?(()=>{
      const xs=frame.map(p=>p[0]!),ys=frame.map(p=>p[1]!);
      const [x0,x1,y0,y1]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
      const dx=34/Math.max(1,this.frame.width)*1000,dy=34/Math.max(1,this.frame.height)*1000;
      const spots=[[x1+dx,y0-dy],[x0-dx,y0-dy],[x1+dx,y1+dy],[x0-dx,y1+dy]];
      const [x,y]=spots.find(([x,y])=>x!>=2&&x!<=998&&y!>=2&&y!<=998)??spots[0]!;
      return {x:x!,y:y!};
    })():undefined;
    const handles:[Handle,number,number][]=box?[['nw',box[1]!,box[0]!],['n',(box[1]!+box[3]!)/2,box[0]!],['ne',box[3]!,box[0]!],['e',box[3]!,(box[0]!+box[2]!)/2],
      ['se',box[3]!,box[2]!],['s',(box[1]!+box[3]!)/2,box[2]!],['sw',box[1]!,box[2]!],['w',box[1]!,(box[0]!+box[2]!)/2]]:[];
    const at=(x:number,y:number)=>`left:${x/10}%;top:${y/10}%`;
    const rect=(b:number[],cls:string)=>svg`<rect class=${cls} x=${b[1]!} y=${b[0]!} width=${b[3]!-b[1]!} height=${b[2]!-b[0]!}></rect>`;
    const trace=this.trace,path=trace?[...trace.points,...(trace.cursor?[trace.cursor]:[])]:[];
    const spot=(r:DetectionRoom,i:number)=>{
      const editing=i===this.drag?.index?this.drag:undefined;
      if(editing?.shape)return this.drawnPoints(editing.shape,editing.arcs);
      if(editing)return r.polygon?this.drawnPoints(shifted(toXY(r.polygon),editing),r.arcs):corners(editing.box);
      return this.planOutline(r)??corners(r.box_2d);
    };
    /** The side `i` of the outline being edited, as drawn: its curve, or its chord. */
    const sidePath=(points:number[][],i:number)=>{
      const a=points[i]!,b=points[(i+1)%points.length]!,bulge=bendOf(bends,i);
      if(!bent(bulge))return [a,b];
      const {sx,sy}=this.unit;
      return [a,...arcPoints(toPixel(a,sx,sy),toPixel(b,sx,sy),bulge).map(q=>fromPixel(q,sx,sy)),b];
    };
    /** Where the handle in the middle of side `i` sits: on its curve when it is curved. */
    const middleOf=(points:number[][],i:number)=>{
      const a=points[i]!,b=points[(i+1)%points.length]!,bulge=bendOf(bends,i),{sx,sy}=this.unit;
      return bent(bulge)?fromPixel(sidePoint(toPixel(a,sx,sy),toPixel(b,sx,sy),bulge,.5),sx,sy):[(a[0]!+b[0]!)/2,(a[1]!+b[1]!)/2];
    };
    return html`
      <div class="tools">
        <button aria-pressed=${this.mode==='rect'} ?disabled=${this.busy} @click=${()=>this.startMode('rect')}>${mpIcon('plus',16)} Ajouter une pièce</button>
        <button aria-pressed=${this.mode==='trace'} ?disabled=${this.busy} @click=${()=>this.startMode('trace')}>${mpIcon('walls',16)} Tracer un contour</button>
        ${this.mode==='trace'?html`<button ?disabled=${(trace?.points.length??0)<3} @click=${()=>this.finishTrace()}>${mpIcon('check',16)} Terminer le contour</button>`
          :html`<button ?disabled=${!room||!!this.mode||this.busy} @click=${()=>room?.polygon?this.rectangle():this.freeShape()}>${room?.polygon?'Rectangle':'Forme libre'}</button>`}
        <button ?disabled=${!room?.polygon||this.vertex<0||this.busy} @click=${()=>this.removeVertex()}>Supprimer le point</button>
        <button aria-pressed=${this.pending==='curve'} ?disabled=${!room||!!this.mode||this.busy} @click=${()=>this.useTool('curve')}>${room?.polygon&&bent(room.arcs?.[this.side])?'Redresser le côté':'Courber le côté'}</button>
        <button aria-pressed=${this.pending==='round'} ?disabled=${!room||!!this.mode||this.busy} @click=${()=>this.useTool('round')}>Arrondir l’angle</button>
        <button ?disabled=${this.selected<0||this.busy} @click=${()=>this.drop(this.selected)}>${mpIcon('close',16)} Supprimer la pièce</button>
        <button ?disabled=${!this.canUndo||this.busy} @click=${()=>this.dispatchEvent(new CustomEvent('zones-undo'))}>Annuler</button>
      </div>
      <div class="tools place" role="toolbar" aria-label="Placer sur le plan"><span>Placer :</span>
        ${FIXTURE_KINDS.map(kind=>html`<button style=${`--tone:${FIXTURES[kind].color}`} aria-pressed=${this.mode===kind} ?disabled=${this.busy} @click=${()=>this.startMode(kind)}>${mpIcon(FIXTURES[kind].icon,16)}${FIXTURES[kind].name}</button>`)}
        <button ?disabled=${!this.fixture||this.busy} @click=${()=>this.dropFixture(this.fixture)}>${mpIcon('close',16)} Retirer</button>
      </div>
      <p class="hint" aria-live="polite">${this.busy?'Mise à jour du plan…':this.notice||this.hint}</p>
      <div class="tools zoom-tools" role="toolbar" aria-label="Précision du plan">
        <button aria-label="Zoom arrière du plan" ?disabled=${this.zoomLevel<=1} @click=${()=>this.zoomTo(this.zoomLevel/1.5)}>−</button><output aria-label="Zoom du plan">${Math.round(this.zoomLevel*100)} %</output><button aria-label="Zoom avant du plan" ?disabled=${this.zoomLevel>=8} @click=${()=>this.zoomTo(this.zoomLevel*1.5)}>+</button>
        <button @click=${()=>this.zoomTo(1)}>Ajuster à l’écran</button>
        <button aria-pressed=${this.panning} @click=${()=>{this.panning=!this.panning;this.mode='';this.trace=undefined;}}>Déplacer le plan</button>
        <button aria-pressed=${this.magnet} @click=${()=>{this.magnet=!this.magnet;}}>Aimantation</button>
      </div>
      <div class="viewport" style=${`aspect-ratio:${source.width}/${source.height};width:min(100% - 16px,calc(max(52vh,100dvh - 330px) * ${source.width/source.height}))`} @wheel=${this.wheel}>
      <figure class=${`${this.mode?'adding':''} ${this.busy?'busy':''} ${this.panning?'panning':''} ${this.pending&&room?.polygon?`picking-${this.pending}`:''}`} tabindex="0" aria-label=${this.level?'Pièces du niveau sur le plan':'Pièces détectées sur le plan'} style=${`aspect-ratio:${source.width}/${source.height};width:${this.zoomLevel*100}%`}
        @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${()=>{this.drag=undefined;this.draft=undefined;this.pan=undefined;this.tracing=false;this.placing=undefined;this.moving=undefined;}} @keydown=${this.key} @touchstart=${this.touch} @touchmove=${this.touch} @touchend=${this.touch} @touchcancel=${this.touch}>
        ${this.src?html`<img src=${this.src} alt="Plan analysé par Gemini" draggable="false">`:this.grid(source)}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
          ${this.detection.map((r,i)=>{
            const plan=r.id?rooms.get(r.id):undefined;
            return plan?svg`<polygon data-zone=${i} class=${i===this.selected?'selected':''} points=${roomOutline(plan).map(normalised).join(' ')} style=${`fill:${colour(r,i)};stroke:${colour(r,i)}`}></polygon>`:nothing;
          })}
          ${drawn?svg`<polygon class="box" points=${pairs(drawn)}></polygon>`:box?rect(box,'box'):nothing}
          ${shape&&!this.drag?shape.map((_,i)=>svg`<polyline class=${`side${i===this.side?' active':''}`} data-side=${i} points=${pairs(sidePath(shape,i))}></polyline>`):nothing}
          ${this.draft?rect(this.draft.box,'draft'):nothing}
          ${trace&&trace.points.length>=3?svg`<polygon class="draft" points=${pairs(trace.points)}></polygon>`:nothing}
          ${path.length>=2?svg`<polyline class="trace" points=${pairs(path)}></polyline>`:nothing}
          ${this.fixtures.map(f=>{
            if(!isOpening(f.kind)||!f.b)return nothing;
            const {a,b}=this.shown(f),ends=[a[0],a[1],b![0],b![1]];
            return svg`<line class="under" x1=${ends[0]} y1=${ends[1]} x2=${ends[2]} y2=${ends[3]}></line><line class=${`opening${placed.has(f.id)?'':' lost'}`} style=${`--tone:${FIXTURES[f.kind].color}`} x1=${ends[0]} y1=${ends[1]} x2=${ends[2]} y2=${ends[3]}></line>`;
          })}
          ${preview?svg`<line class="under" x1=${preview[0][0]} y1=${preview[0][1]} x2=${preview[1][0]} y2=${preview[1][1]}></line><line class="opening preview" style=${`--tone:${FIXTURES[this.placing!.kind].color}`} x1=${preview[0][0]} y1=${preview[0][1]} x2=${preview[1][0]} y2=${preview[1][1]}></line>`:nothing}
        </svg>
        <div class="layer names">${this.detection.map((r,i)=>r.id&&rooms.has(r.id)?this.label(i,r,spot(r,i)):nothing)}</div>
        <div class="layer">
          ${handles.map(([name,x,y])=>html`<span class="handle" data-handle=${name} style=${at(x,y)}></span>`)}
          ${shape&&!this.drag?shape.map((p,i)=>{
            // In the middle of a side long enough to keep clear of its corners: a + to add a corner, or, on the side last
            // touched, the round handle that bends it.
            const q=shape[(i+1)%shape.length]!,length=Math.hypot((q[0]!-p[0]!)*this.frame.width,(q[1]!-p[1]!)*this.frame.height)/1000;
            const [x,y]=middleOf(shape,i) as [number,number];
            if(i===this.side)return html`<span class="bend" data-bend=${i} title="Courber ce côté" style=${at(x,y)}></span>`;
            return length<44||shape.length>=MAX_POINTS||this.pending?nothing:html`<span class="handle mid" data-mid=${i} title="Ajouter un point" style=${at(x,y)}></span>`;
          }):nothing}
          ${shape?shape.map((p,i)=>html`<span class=${`handle vertex${i===this.vertex?' active':''}`} data-vertex=${i} style=${at(p[0]!,p[1]!)}></span>`):nothing}
          ${turner&&!this.mode&&(!this.drag||this.drag.handle==='rotate')?html`<span class="rotate" data-rotate="1" title="Tourner la pièce" style=${at(turner.x,turner.y)}></span>`:nothing}
          ${trace?trace.points.map((p,i)=>html`<span class=${`handle point${i===0?' first':''}`} style=${at(p[0]!,p[1]!)}></span>`):nothing}
          ${this.fixtures.map(f=>{
            const {a,b}=this.shown(f),[x,y]=b?[(a[0]!+b[0]!)/2,(a[1]!+b[1]!)/2]:a,info=FIXTURES[f.kind],where=placed.get(f.id);
            return html`<span class=${`mark${f.id===this.fixture?' selected':''}${where?'':' lost'}`} data-fixture=${f.id} title=${`${info.name} · ${where?roomNames.get(where.room)??'':'hors des pièces : à replacer'}`} style=${`${at(x!,y!)};--tone:${info.color}`}>${mpIcon(info.icon,13)}</span>`;
          })}
          ${this.placing&&!isOpening(this.placing.kind)?html`<span class="mark" style=${`${at(this.placing.a[0]!,this.placing.a[1]!)};--tone:${FIXTURES[this.placing.kind].color}`}>${mpIcon(FIXTURES[this.placing.kind].icon,13)}</span>`:nothing}
        </div>
      </figure>
      </div>
      <ul aria-label=${`Pièces ${this.where}`}>${this.detection.map((r,i)=>{
        const plan=r.id?rooms.get(r.id):undefined;
        return html`<li class=${i===this.selected?'selected':''} @click=${()=>{if(!this.mode&&i!==this.selected){this.selected=i;this.vertex=-1;this.side=-1;this.pending='';}}}>
          <span class="swatch" style=${`background:${colour(r,i)}`}>${i+1}</span>
          <input data-index=${i} maxlength="80" .value=${r.name} aria-label=${`Nom de la pièce ${i+1}`} ?disabled=${this.busy} @change=${(e:Event)=>this.rename(i,(e.target as HTMLInputElement).value)}>
          <small>${plan?`${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(roomArea(plan))} m²`:'écartée'}</small>
          <button aria-label=${`Supprimer ${r.name}`} title="Supprimer" ?disabled=${this.busy} @click=${(e:Event)=>{e.stopPropagation();this.drop(i);}}>${mpIcon('close',14)}</button>
        </li>`;
      })}</ul>
      ${this.fixtures.length?html`<ul class="fixtures" aria-label=${`Portes, fenêtres et appareils ${this.where}`}>${this.fixtures.map((f,i)=>{
        const info=FIXTURES[f.kind],where=placed.get(f.id);
        return html`<li class=${f.id===this.fixture?'selected':''} @click=${()=>{if(!this.mode){this.fixture=f.id;this.selected=-1;this.vertex=-1;this.side=-1;this.pending='';}}}>
          <span class="swatch" style=${`background:${info.color}`}>${mpIcon(info.icon,13)}</span>
          <span class="what">${info.name} · ${where?roomNames.get(where.room)??'':'hors des pièces'}</span>
          <small class=${where?'':'lost'}>${where?.width?`${metres.format(where.width)} m`:where?'':'à replacer'}</small>
          <button aria-label=${`Retirer ${info.name} ${i+1}`} title="Retirer" ?disabled=${this.busy} @click=${(e:Event)=>{e.stopPropagation();this.dropFixture(f.id);}}>${mpIcon('close',14)}</button>
        </li>`;
      })}</ul>`:nothing}`;
  }
}
defineElement('mp-plan-zones',MPPlanZones);
