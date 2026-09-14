import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { polygonArea, type SpatialPlan } from '../../shared/spatial';
import { mpIcon } from '../icons';

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
type Handle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'|'move';
interface Drag { index:number; handle:Handle; start:[number,number]; origin:number[]; box:number[]; moved:boolean }

/** Distinct colour per room (golden angle), shared by the zones and the list. */
export const roomColor=(index:number)=>`hsl(${Math.round(index*137.5)%360} 78% 62%)`;
const round=(value:number)=>Math.round(value*100)/100;
const colour=(room:DetectionRoom|undefined,index:number)=>roomColor(room?.hue??index);
const MIN=5;

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

/** Walls drawn on the plan, found in the browser: dark, thick, long horizontal and vertical strokes. */
export async function detectWalls(blob:Blob):Promise<Walls>{
  const bitmap=await createImageBitmap(blob);
  try{
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(3,Math.round(bitmap.width*scale)),h=Math.max(3,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return {x:[],y:[]};
    context.fillStyle='#fff';context.fillRect(0,0,w,h);context.drawImage(bitmap,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h).data,dark=new Uint8Array(w*h);
    for(let i=0;i<w*h;i++)dark[i]=pixels[i*4]!*.3+pixels[i*4+1]!*.59+pixels[i*4+2]!*.11<120?1:0;
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
    if(lines.reduce((sum,other)=>Math.abs(other.at-line.at)<=4?sum+along(other):sum,0)>=(to-from)*.4){gap=distance;best=line.at;}
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

/**
 * Detected rooms over the analysed plan: select, move and resize them with handles (walls attract the edges),
 * draw a new one, delete one. Emits `zones-change` with the edited rooms and `zones-undo`; the Studio rebuilds the plan.
 */
export class MPPlanZones extends LitElement {
  static properties={src:{attribute:false},source:{attribute:false},plan:{attribute:false},detection:{attribute:false},walls:{attribute:false},busy:{type:Boolean},canUndo:{type:Boolean},selected:{state:true},adding:{state:true},drag:{state:true},draft:{state:true},frame:{state:true}};
  static styles=css`
    :host{display:block;color:#eef6ff;font:13px/1.4 system-ui,sans-serif}*{box-sizing:border-box}
    button{font:inherit;color:inherit;cursor:pointer;min-height:36px;padding:0 12px;border:1px solid #b2d7f23b;border-radius:10px;background:#0b253d;display:inline-flex;align-items:center;gap:6px}
    button:disabled{opacity:.45;cursor:default}button[aria-pressed=true]{background:#2a648e;border-color:#8acbff}
    .tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:12px 0 8px}.hint{flex:1 1 220px;color:#9fb6ca;font-size:12px}
    figure{position:relative;max-width:calc(100% - 16px);margin:8px auto;border-radius:14px;background:#fff;box-shadow:0 10px 30px #0006;touch-action:pan-y;user-select:none;-webkit-user-select:none;outline-offset:3px}
    figure.adding{cursor:crosshair;touch-action:none}figure.busy{opacity:.85}
    img{display:block;width:100%;height:100%;border-radius:inherit;pointer-events:none}svg,.layer{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit}.layer{pointer-events:none}
    /* Rooms and names stay on the plan; the handles of a room along its edge may overflow it. */
    svg,.names{overflow:hidden}
    polygon{fill-opacity:.3;stroke-opacity:.95;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;cursor:move;touch-action:none}
    polygon.selected{fill-opacity:.42;stroke-width:3}.box{fill:none;stroke:#fff;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}
    .draft{fill:#69b7ff33;stroke:#69b7ff;stroke-width:2;vector-effect:non-scaling-stroke}
    .label{position:absolute;transform:translate(-50%,-50%);max-width:30%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#fff;font-weight:650;paint-order:stroke;-webkit-text-stroke:3px #061421;text-shadow:0 1px 2px #0009}
    .label.number{min-width:20px;height:20px;padding:0 5px;border-radius:99px;display:grid;place-items:center;font-size:11px;-webkit-text-stroke:0;background:#061421cc;border:2px solid currentColor}
    .handle{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:5px;background:#fff;border:2px solid #2a648e;box-shadow:0 2px 6px #0008;pointer-events:auto;touch-action:none}
    /* A larger target than the square itself, for a finger. */
    .handle::before{content:'';position:absolute;inset:-9px}@media (pointer:coarse){.handle{width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:6px}.handle::before{inset:-12px}}
    .handle[data-handle=n],.handle[data-handle=s]{cursor:ns-resize}.handle[data-handle=e],.handle[data-handle=w]{cursor:ew-resize}.handle[data-handle=nw],.handle[data-handle=se]{cursor:nwse-resize}.handle[data-handle=ne],.handle[data-handle=sw]{cursor:nesw-resize}
    ul{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}
    li{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 8px;border-radius:10px;background:#ffffff08;border:1px solid #d6ecff14}li.selected{border-color:#8acbff;background:#69b7ff1a}
    .swatch{display:grid;place-items:center;min-width:22px;height:22px;border-radius:7px;color:#061421;font-size:11px;font-weight:700}
    input{flex:1;min-width:0;min-height:32px;padding:4px 8px;font:inherit;color:inherit;border:1px solid #b2d7f23b;border-radius:8px;background:#0b253d}small{color:#9fb6ca;white-space:nowrap}
    li button{min-height:30px;width:30px;padding:0;justify-content:center;border-color:transparent;background:transparent}li button:hover{background:#ff8a6a22}
  `;
  src='';source?:Source;plan?:SpatialPlan;detection:DetectionRoom[]=[];walls?:Walls;busy=false;canUndo=false;
  private selected=-1;private naming=-1;private adding=false;private drag?:Drag;private draft?:{start:[number,number];box:number[]};private frame={width:0,height:0};
  private observer=new ResizeObserver(([entry])=>{if(entry)this.frame={width:entry.contentRect.width,height:entry.contentRect.height};});
  protected firstUpdated(){const figure=this.renderRoot.querySelector('figure');if(figure)this.observer.observe(figure);}
  disconnectedCallback(){super.disconnectedCallback();this.observer.disconnect();}
  protected willUpdate(changed:PropertyValues){if(changed.has('detection')&&this.selected>=this.detection.length)this.selected=-1;}
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
  private get tolerance():[number,number]{return [10/Math.max(1,this.frame.width)*1000,10/Math.max(1,this.frame.height)*1000];}
  private emit(detection:DetectionRoom[]){this.dispatchEvent(new CustomEvent('zones-change',{detail:detection}));}
  private drop(index:number){if(index<0||this.busy)return;this.selected=-1;this.emit(this.detection.filter((_,i)=>i!==index));}
  private rename(index:number,name:string){const clean=name.trim().slice(0,80);if(!clean||clean===this.detection[index]?.name)return;this.emit(this.detection.map((room,i)=>i===index?{...room,name:clean}:room));}
  private down=(e:PointerEvent)=>{
    if(this.busy||e.button>0)return;
    const target=e.target as Element,p=this.point(e);
    const handle=(target.closest('[data-handle]') as HTMLElement|null)?.dataset.handle as Handle|undefined;
    const zone=Number(target.closest('[data-zone]')?.getAttribute('data-zone')??-1);
    if(this.adding)this.draft={start:p,box:[p[1],p[0],p[1],p[0]]};
    else if(handle&&this.selected>=0){const box=[...this.detection[this.selected]!.box_2d];this.drag={index:this.selected,handle,start:p,origin:box,box,moved:false};}
    else if(zone>=0){this.selected=zone;const box=[...this.detection[zone]!.box_2d];this.drag={index:zone,handle:'move',start:p,origin:box,box,moved:false};}
    else{this.selected=-1;return;}
    const figure=e.currentTarget as HTMLElement;
    figure.setPointerCapture(e.pointerId);
    // No text selection nor page drag; keep the keyboard on the plan for Delete and Escape.
    e.preventDefault();figure.focus({preventScroll:true});
  };
  private move=(e:PointerEvent)=>{
    if(!this.draft&&!this.drag)return;
    const p=this.point(e),[tx,ty]=this.tolerance;
    if(this.draft){
      const [sx,sy]=this.draft.start;
      this.draft={...this.draft,box:snapBox([Math.min(sy,p[1]),Math.min(sx,p[0]),Math.max(sy,p[1]),Math.max(sx,p[0])],this.walls??{x:[],y:[]},tx,ty)};
      return;
    }
    const drag=this.drag;if(!drag)return;
    const dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
    if(!drag.moved&&Math.hypot(dx/tx,dy/ty)<.4)return;  // a click is not a move
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
    if(this.draft){
      const box=this.draft.box;this.draft=undefined;this.adding=false;
      if(box[2]!-box[0]!>=MIN&&box[3]!-box[1]!>=MIN){
        this.selected=this.naming=this.detection.length;
        const hue=Math.max(this.detection.length-1,...this.detection.map(r=>r.hue??0))+1;
        this.emit([...this.detection,{name:`Pièce ${this.detection.length+1}`,box_2d:box.map(round),hue}]);
      }
      return;
    }
    const drag=this.drag;this.drag=undefined;
    if(!drag?.moved)return;
    const [dy,dx]=[drag.box[0]!-drag.origin[0]!,drag.box[1]!-drag.origin[1]!];
    this.emit(this.detection.map((room,i)=>{
      if(i!==drag.index)return room;
      const {polygon,...rest}=room,box_2d=drag.box.map(round);
      // A moved outline follows; a resized one becomes the new rectangle.
      return drag.handle==='move'&&polygon?{...rest,box_2d,polygon:polygon.map(([y,x])=>[round(y!+dy),round(x!+dx)])}:{...rest,box_2d};
    }));
  };
  private key=(e:KeyboardEvent)=>{
    if((e.key==='Delete'||e.key==='Backspace')&&this.selected>=0){e.preventDefault();this.drop(this.selected);}
    else if(e.key==='Escape'){this.adding=false;this.draft=undefined;this.selected=-1;}
  };
  /** On a phone, a finger on a room, a handle or in drawing mode edits the plan instead of scrolling the window. */
  private touch={handleEvent:(e:TouchEvent)=>{if(this.adding||(e.target as Element).closest('[data-handle],[data-zone]'))e.preventDefault();},passive:false};
  private label(index:number,room:DetectionRoom,box:number[]){
    const name=room.name;
    const width=(box[3]!-box[1]!)/1000*this.frame.width,height=(box[2]!-box[0]!)/1000*this.frame.height;
    const size=Math.min(15,width/Math.max(4,name.length*.6),height*.4);
    const style=`left:${(box[1]!+box[3]!)/20}%;top:${(box[0]!+box[2]!)/20}%`;
    // Too small for its name: its number, as in the list.
    return size<9?html`<span class="label number" style=${`${style};color:${colour(room,index)}`} title=${name}>${index+1}</span>`:html`<span class="label" style=${`${style};font-size:${size}px`}>${name}</span>`;
  }
  render(){
    const source=this.source;
    if(!source)return nothing;
    const rooms=new Map((this.plan?.floors[0]?.rooms??[]).map(r=>[r.id,r])),[kx,ky]=source.scale as [number,number],[ox,oy]=source.origin as [number,number];
    const normalised=([x,y]:number[])=>`${((x!/kx+ox)/source.width*1000).toFixed(1)},${((y!/ky+oy)/source.height*1000).toFixed(1)}`;
    const chosen=this.selected>=0?(this.drag?.index===this.selected?this.drag.box:this.detection[this.selected]?.box_2d):undefined;
    const handles:[Handle,number,number][]=chosen?[['nw',chosen[1]!,chosen[0]!],['n',(chosen[1]!+chosen[3]!)/2,chosen[0]!],['ne',chosen[3]!,chosen[0]!],['e',chosen[3]!,(chosen[0]!+chosen[2]!)/2],
      ['se',chosen[3]!,chosen[2]!],['s',(chosen[1]!+chosen[3]!)/2,chosen[2]!],['sw',chosen[1]!,chosen[2]!],['w',chosen[1]!,(chosen[0]!+chosen[2]!)/2]]:[];
    const rect=(box:number[],cls:string)=>svg`<rect class=${cls} x=${box[1]!} y=${box[0]!} width=${box[3]!-box[1]!} height=${box[2]!-box[0]!}></rect>`;
    const hint=this.adding?'Tracez la nouvelle pièce sur le plan.':this.selected>=0?'Glissez la pièce ou ses poignées ; les murs du plan attirent les bords.':'Touchez une pièce pour l’ajuster, ou ajoutez-en une.';
    return html`
      <div class="tools">
        <button aria-pressed=${this.adding} ?disabled=${this.busy} @click=${()=>{this.adding=!this.adding;this.selected=-1;}}>${mpIcon('plus',16)} Ajouter une pièce</button>
        <button ?disabled=${this.selected<0||this.busy} @click=${()=>this.drop(this.selected)}>${mpIcon('close',16)} Supprimer</button>
        <button ?disabled=${!this.canUndo||this.busy} @click=${()=>this.dispatchEvent(new CustomEvent('zones-undo'))}>Annuler</button>
        <span class="hint" aria-live="polite">${this.busy?'Mise à jour du plan…':hint}</span>
      </div>
      <figure class=${`${this.adding?'adding':''} ${this.busy?'busy':''}`} tabindex="0" aria-label="Pièces détectées sur le plan" style=${`aspect-ratio:${source.width}/${source.height};width:min(100% - 16px,calc(52vh * ${source.width/source.height}))`}
        @pointerdown=${this.down} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up} @keydown=${this.key} @touchstart=${this.touch}>
        <img src=${this.src} alt="Plan analysé par Gemini" draggable="false">
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
          ${this.detection.map((room,i)=>{
            const plan=room.id?rooms.get(room.id):undefined;
            return plan?svg`<polygon data-zone=${i} class=${i===this.selected?'selected':''} points=${plan.polygon.map(normalised).join(' ')} style=${`fill:${colour(room,i)};stroke:${colour(room,i)}`}></polygon>`:nothing;
          })}
          ${chosen?rect(chosen,'box'):nothing}${this.draft?rect(this.draft.box,'draft'):nothing}
        </svg>
        <div class="layer names">${this.detection.map((room,i)=>room.id&&rooms.has(room.id)?this.label(i,room,i===this.drag?.index?this.drag.box:room.box_2d):nothing)}</div>
        <div class="layer">
          ${handles.map(([name,x,y])=>html`<span class="handle" data-handle=${name} style=${`left:${x/10}%;top:${y/10}%`}></span>`)}
        </div>
      </figure>
      <ul aria-label="Pièces du brouillon">${this.detection.map((room,i)=>{
        const plan=room.id?rooms.get(room.id):undefined;
        return html`<li class=${i===this.selected?'selected':''} @click=${()=>{if(!this.adding)this.selected=i;}}>
          <span class="swatch" style=${`background:${colour(room,i)}`}>${i+1}</span>
          <input data-index=${i} maxlength="80" .value=${room.name} aria-label=${`Nom de la pièce ${i+1}`} ?disabled=${this.busy} @change=${(e:Event)=>this.rename(i,(e.target as HTMLInputElement).value)}>
          <small>${plan?`${new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(polygonArea(plan.polygon))} m²`:'écartée'}</small>
          <button aria-label=${`Supprimer ${room.name}`} title="Supprimer" ?disabled=${this.busy} @click=${(e:Event)=>{e.stopPropagation();this.drop(i);}}>${mpIcon('close',14)}</button>
        </li>`;
      })}</ul>`;
  }
}
if(!customElements.get('mp-plan-zones'))customElements.define('mp-plan-zones',MPPlanZones);
