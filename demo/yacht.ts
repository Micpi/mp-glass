import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import type { Hass } from '../frontend/ha/client';
import { mpIcon, type MPIconName } from '../frontend/icons';
import { MPSpatialViewer } from '../frontend/spatial/viewer';
import { openingPlacement, roomOutline, type SpatialPlan, type SpatialRoom } from '../shared/spatial';
import { roomEntityIds } from '../shared/spatial-state';
import type { HAState } from '../shared/models';

type Mode = 'all'|'lights'|'climate'|'openings'|'media'|'laundry'|'security';
const categories: {id:Mode;name:string;icon:MPIconName}[] = [
  {id:'all',name:'All systems',icon:'layers'},{id:'lights',name:'Lighting',icon:'bulb'},
  {id:'climate',name:'Climate',icon:'thermo'},{id:'openings',name:'Access & shades',icon:'window'},
  {id:'media',name:'Entertainment',icon:'tv'},{id:'laundry',name:'Laundry',icon:'washer'},
  {id:'security',name:'Safety',icon:'shield'},
];
const deckNotes:Record<string,string>={
  'yacht-main':'Life on board · dining, guest suites and the main salon',
  'yacht-upper':'Private retreat · panoramic lounge and navigation bridge',
  'yacht-sun':'Open-air living · jacuzzi, sunpads and shaded lounge',
  'yacht-lower':'Behind the scenes · guest cabins, crew and technical spaces',
};
const outdoor=(id:string)=>/terrace|platform|foredeck|sun-beds|sun-lounge|sun-jacuzzi/.test(id);
const category=(s:HAState):Mode=>s.entity_id.startsWith('light.')?'lights':s.entity_id.startsWith('climate.')||s.attributes.device_class==='temperature'||s.attributes.device_class==='humidity'?'climate':s.entity_id.startsWith('cover.')?'openings':s.entity_id.startsWith('media_player.')?'media':/washing|dryer/.test(s.entity_id)?'laundry':s.entity_id.startsWith('binary_sensor.')?'security':'all';
function bounds(room:SpatialRoom){
  const xs=room.polygon.map(p=>p[0]),ys=room.polygon.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
/** The demo's surrounding layout already supplies the room list and system card. */
class YachtSpatialViewer extends MPSpatialViewer {
  private framed='';
  static styles=css`${MPSpatialViewer.styles}
    .layout{display:block}.side,.rooms,.hint,.floor-tag{display:none}
    .stage{height:460px;border-radius:10px;box-shadow:none}
    @media(max-width:650px){.stage{height:380px}}
  `;
  protected async updated(changed:PropertyValues){
    await super.updated(changed);
    const id=this.plan?.floors[0]?.id;
    if(id&&id!==this.framed&&this.renderRoot.querySelector('canvas')){
      this.framed=id;
      // The generic house framing leaves a long, slender hull small on screen. Use its own camera controls once.
      if(!this.renderRoot.querySelector('.rail .saved')){
        const zoom=this.renderRoot.querySelector<HTMLButtonElement>('.rail .zoom');
        for(let i=0;i<3;i++)zoom?.click();
      }
    }
  }
}
customElements.define('mp-yacht-spatial-viewer',YachtSpatialViewer);
/** Original GA-style furnishings, kept in the demo rather than in Home Assistant's plan schema. */
function furniture(id:string){
  const bed=svg`<rect x=".2" y=".18" width=".58" height=".68" rx=".04"/><rect x=".25" y=".23" width=".2" height=".14" rx=".025"/><rect x=".51" y=".23" width=".2" height=".14" rx=".025"/><path d="M.2 .41H.78M.2 .76H.78"/><rect x=".08" y=".21" width=".09" height=".14" rx=".02"/><rect x=".81" y=".21" width=".09" height=".14" rx=".02"/>`;
  const lounge=svg`<rect x=".16" y=".2" width=".68" height=".18" rx=".045"/><path d="M.38 .2V.38M.62 .2V.38"/><rect x=".16" y=".45" width=".17" height=".32" rx=".045"/><rect x=".67" y=".45" width=".17" height=".32" rx=".045"/><rect class="timber" x=".39" y=".47" width=".22" height=".25" rx=".04"/><circle cx=".5" cy=".59" r=".045"/>`;
  const dining=svg`<rect class="timber" x=".29" y=".25" width=".42" height=".5" rx=".14"/>${[.3,.48,.66].map(y=>svg`<rect x=".13" y=${y} width=".13" height=".13" rx=".035"/><rect x=".74" y=${y} width=".13" height=".13" rx=".035"/>`)}<rect x=".42" y=".09" width=".16" height=".13" rx=".035"/><rect x=".42" y=".79" width=".16" height=".13" rx=".035"/>`;
  if(id==='lower-owner-suite')return dining;
  if(id==='main-helm'||id==='sun-helm')return lounge;
  if(/vip|guest-port|guest-starboard|owner-suite|crew-port|crew-starboard/.test(id))return bed;
  if(/engine/.test(id))return svg`${[.15,.57].map(y=>svg`<rect class="engine" x=".2" y=${y} width=".63" height=".23" rx=".025"/><path d=${`M.3 ${y}V${y+.23}M.43 ${y}V${y+.23}M.57 ${y}V${y+.23}M.7 ${y}V${y+.23}`}/><rect x=".09" y=${y+.065} width=".1" height=".1"/><circle cx=".85" cy=${y+.115} r=".06"/>`)}`;
  if(/tender/.test(id))return svg`<path class="water" d="M.18 .28Q.5 .05 .85 .5Q.5 .95 .18 .72Z"/><path d="M.28 .36Q.54 .23 .71 .5Q.54 .77 .28 .64Z"/><rect x=".31" y=".42" width=".2" height=".16" rx=".025"/><rect x=".1" y=".45" width=".1" height=".1"/>`;
  if(/jacuzzi/.test(id))return svg`<rect x=".13" y=".2" width=".74" height=".59" rx=".1"/><rect class="water" x=".2" y=".27" width=".6" height=".45" rx=".085"/><path d="M.27 .4Q.38 .33 .5 .4T.73 .4M.27 .56Q.38 .49 .5 .56T.73 .56"/><circle cx=".3" cy=".65" r=".025"/><circle cx=".71" cy=".65" r=".025"/>`;
  if(/sun-beds|foredeck/.test(id))return svg`${[.23,.57].map(x=>svg`<rect x=${x} y=".21" width=".2" height=".59" rx=".045"/><path d=${`M${x} .4H${x+.2}M${x} .68H${x+.2}`}/>`)}`;
  if(/helm|observation/.test(id))return svg`<path class="timber" d="M.2 .18L.82 .27V.48L.2 .4Z"/>${[.3,.52,.72].map(x=>svg`<rect class="screen" x=${x} y=".27" width=".1" height=".07" rx=".012"/><rect x=${x-.02} y=".6" width=".15" height=".15" rx=".05"/>`)}<path d="M.24 .44L.82 .51"/>`;
  if(/dining|mess/.test(id))return dining;
  if(/galley/.test(id))return svg`<path class="timber" d="M.12 .15H.85V.32H.29V.85H.12Z"/><rect x=".5" y=".49" width=".26" height=".3" rx=".025"/><rect x=".36" y=".19" width=".18" height=".08" rx=".02"/>${[.65,.75].map(x=>svg`<circle cx=${x} cy=".21" r=".025"/><circle cx=${x} cy=".27" r=".025"/>`)}`;
  if(/heads/.test(id))return svg`<rect class="water" x=".14" y=".16" width=".45" height=".38" rx=".025"/><circle cx=".72" cy=".31" r=".11"/><rect x=".23" y=".64" width=".26" height=".2" rx=".09"/>`;
  if(/laundry/.test(id))return svg`<rect x=".19" y=".23" width=".6" height=".51" rx=".04"/><circle cx=".49" cy=".51" r=".15"/><path d="M.19 .34H.79M.26 .29H.37"/>`;
  if(/platform|terrace/.test(id))return svg`<rect x=".18" y=".18" width=".63" height=".16" rx=".04"/><rect x=".18" y=".66" width=".63" height=".16" rx=".04"/><circle class="timber" cx=".5" cy=".5" r=".09"/>`;
  if(/lounge|saloon|private/.test(id))return lounge;
  return nothing;
}

export class MPYachtDemo extends LitElement {
  static properties={plan:{attribute:false},hass:{attribute:false},deckId:{state:true},selected:{state:true},mode:{state:true},view:{state:true},message:{state:true},pending:{state:true}};
  plan!:SpatialPlan;hass!:Hass;
  private deckId='yacht-main';private selected='';private mode:Mode='all';private view='plan';private message='';private pending='';
  static styles=css`
    :host{display:block;min-height:100vh;background:radial-gradient(ellipse at 75% -10%,#1c3c4a 0,transparent 55%),#0b171f;color:#eaf0ef;font-family:Inter,system-ui,sans-serif;--gold:#d6b67e;--muted:#94a9b5;--line:#c7dde51c}
    *{box-sizing:border-box}button,a{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,[role=button]:focus-visible{outline:2px solid var(--gold);outline-offset:4px}button:disabled{opacity:.5;cursor:wait}.mp-icon{vertical-align:middle}
    .shell{max-width:1660px;margin:auto;padding:34px 38px 32px}.center,.deck-nav,.details,.panel{min-width:0}.brand{display:flex;align-items:center;gap:11px;font-size:12px;letter-spacing:.15em}.brand-mark{border:1px solid #d6b67e66;color:var(--gold);border-radius:10px;padding:9px;font:23px Georgia}.brand small{display:block;font-size:9px;letter-spacing:.11em;color:var(--muted);margin-top:4px}.top{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:1px solid var(--line)}.back{color:var(--muted);font-size:12px;text-decoration:none;margin-right:190px}.back:hover{color:white}
    .hero{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:27px 0 26px}.eyebrow{text-transform:uppercase;font-size:10px;letter-spacing:.22em;color:var(--gold)}h1{font:46px/1.1 Georgia,serif;margin:8px 0 10px;font-weight:400;letter-spacing:-.02em}h1 em{font-style:normal;color:#b5c4ca}.hero p{color:var(--muted);font-size:13px;margin:0}.vessel{width:330px;height:110px;flex-shrink:0}.specs{display:flex;gap:20px;margin-top:17px;font-size:11px;color:var(--muted)}.specs strong{color:#e7eeee;font-weight:500;margin-right:5px}.status{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#a3cfc0}.status i,.dot{width:6px;height:6px;border-radius:50%;background:#8dcab4;display:inline-block}.specs .badge{color:var(--gold)}
    .workspace{display:grid;grid-template-columns:170px minmax(0,1fr) 280px;gap:18px;align-items:start}.deck-nav{padding:20px 0}.deck-nav .eyebrow{color:var(--muted);margin:0 0 16px 12px}.deck-button{width:100%;text-align:left;display:flex;align-items:center;gap:13px;border:1px solid transparent;border-radius:10px;color:#97abb7;background:transparent;padding:16px 12px;min-height:63px;margin-bottom:6px}.deck-button b{font-size:11px;letter-spacing:.07em;font-weight:400;color:#728f9e}.deck-button span{font-size:12px;font-weight:500}.deck-button small{display:block;font-size:9px;color:#78919e;margin-top:4px}.deck-button[aria-pressed=true]{color:#e9f0ed;background:#203540;border-color:#d6b67e38}.deck-button[aria-pressed=true] b{color:var(--gold)}.deck-key{margin:25px 12px 0;padding-top:20px;border-top:1px solid var(--line);font-size:10px;color:var(--muted);line-height:1.8}.deck-key div{display:flex;gap:8px;align-items:center}.deck-key .gold{background:var(--gold)}
    .panel{background:linear-gradient(140deg,#192b35,#11212b);border:1px solid #a8c6d22a;border-radius:16px;overflow:hidden}.plan-head{display:flex;justify-content:space-between;gap:10px;align-items:start;padding:22px 24px 18px;border-bottom:1px solid var(--line)}h2{font:26px Georgia,serif;margin:0 0 7px}.sub{font-size:11px;line-height:1.6;color:var(--muted)}.view-tabs{display:flex;gap:4px;padding:4px;background:#07151a88;border:1px solid var(--line);border-radius:8px}.view-tabs button{border:0;border-radius:5px;padding:9px 10px;background:transparent;color:var(--muted);font-size:10px;white-space:nowrap}.view-tabs button[aria-pressed=true]{background:#30454f;color:#fff}.drawing-wrap{overflow:auto;scrollbar-width:thin;scrollbar-color:#58727f transparent}.drawing{display:block;width:100%;min-width:660px;height:370px}.drawing .room{cursor:pointer}.room .surface{fill:#e2e4dd;stroke:#71868b;stroke-width:.038}.room .exterior{fill:url(#teak)}.room:hover .surface{fill:#bcd4d1}.room.selected .surface{fill:#bad7cf;stroke:#76beac;stroke-width:.08}.drawing .furnishing{fill:#eff0e7;stroke:#71868b;stroke-width:1;pointer-events:none;opacity:.94}.drawing .furnishing *{vector-effect:non-scaling-stroke}.drawing .timber{fill:#bcb2a0}.drawing .water{fill:#90bfc5}.drawing .screen{fill:#3d626d}.drawing .engine{fill:#a9b2b3}.drawing text{font-family:Inter,system-ui,sans-serif;pointer-events:none}.room-name{fill:#263d47;font-size:.38px;font-weight:600}.room-small{font-size:.32px}.direction{fill:#9cb4bf;font-size:.3px;letter-spacing:.09px}.plan-footer{display:flex;gap:12px;justify-content:space-between;padding:14px 24px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}.plan-footer span{display:flex;align-items:center;gap:6px}.systems{padding:16px 19px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--line)}.systems button{display:flex;align-items:center;gap:6px;border:1px solid transparent;border-radius:8px;padding:9px 10px;color:var(--muted);background:transparent;font-size:10px}.systems button[aria-pressed=true]{background:#d6b67e18;color:var(--gold);border-color:#d6b67e30}
    .spaces{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px}.space{border:1px solid var(--line);border-radius:10px;background:#132630;display:flex;align-items:center;gap:9px;padding:13px 11px;color:#b9c9cc;font-size:11px;text-align:left;min-height:49px}.space .mp-icon{color:#98afba}.space[aria-pressed=true]{border-color:#bca17388;background:#263d45}.space[aria-pressed=true] .mp-icon{color:var(--gold)}.space .dot{margin-left:auto;background:var(--gold)}
    .details{padding:22px}.details h3{font:24px/1.18 Georgia;margin:13px 0 11px}.details hr{border:0;border-top:1px solid var(--line);margin:21px 0}.metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:23px 0}.metric{border:1px solid var(--line);border-radius:10px;padding:14px 11px;background:#0a19214d}.metric span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.09em}.metric strong{display:block;font:23px Georgia;margin:7px 0}.metric small{color:#a2b5bb;font-size:10px}.tip{font-size:12px;color:#a6bac2;line-height:1.8}.room-list{display:flex;flex-direction:column;gap:12px;margin-top:18px}.device{border-top:1px solid var(--line);padding-top:13px}.device-head{display:flex;gap:9px;align-items:center}.device-head .mp-icon{color:var(--gold)}.device-head strong{display:block;font-size:11px;font-weight:500}.device-head small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.device button{border:1px solid #afc6c42a;background:#29404b;border-radius:6px;color:#e0e9e9;font-size:10px;padding:7px 9px;margin-top:9px}.controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.controls button{min-width:35px}.controls span{font-size:11px;margin-top:9px}.details-close{background:none;border:0;color:var(--muted);float:right;padding:3px}.message{color:var(--gold);font-size:11px;line-height:1.6}.bottom{display:flex;justify-content:space-between;color:#6d8b9a;font-size:10px;letter-spacing:.08em;padding:23px 0 0}.three{padding:16px;--mp-accent:#d6b67e}.three mp-spatial-viewer{display:block}.fallback{color:var(--muted);font-size:12px;padding:15px}
    @media(min-width:1700px){.drawing{height:450px}}@media(max-width:1200px){.workspace{grid-template-columns:130px minmax(0,1fr) 250px;gap:12px}.shell{padding:27px 24px}.plan-head{flex-wrap:wrap}.spaces{grid-template-columns:repeat(2,minmax(0,1fr))}.vessel{width:250px}.deck-button{padding:14px 9px}.drawing{height:330px}}
    @media(max-width:900px){.workspace{grid-template-columns:minmax(0,1fr) 260px}.deck-nav{grid-column:1/-1;display:flex;padding:0;gap:8px;overflow:auto}.deck-nav>.eyebrow,.deck-key{display:none}.deck-button{flex:0 0 145px;min-height:53px;margin:0}.vessel{display:none}.back{margin-right:165px}.hero{padding:23px 0}.shell{padding:25px 20px}.drawing{height:310px}.plan-head{padding:18px}}
    @media(max-width:650px){.workspace{grid-template-columns:1fr}.shell{padding:24px 14px}.brand{font-size:10px}.back{margin-right:0;margin-top:35px;font-size:10px}.top{align-items:start;padding-bottom:17px}h1{font-size:36px}.specs{gap:14px}.hero p{line-height:1.6}.details{padding:20px}.metric-grid{margin:18px 0}.drawing{height:285px}.plan-footer{padding:12px;flex-wrap:wrap}.spaces{grid-template-columns:repeat(2,minmax(0,1fr))}.systems{padding:12px;gap:3px}.systems button{padding:9px 6px}.bottom{font-size:8px}.details{scroll-margin-top:15px}}
  `;
  private get floor(){return this.plan.floors.find(f=>f.id===this.deckId)??this.plan.floors[1]!;}
  private get space(){return this.floor.rooms.find(r=>r.id===this.selected);}
  private devices(room:SpatialRoom){return roomEntityIds(room).map(id=>this.hass.states[id]).filter((s):s is HAState=>!!s);}
  private lit(room:SpatialRoom){return this.devices(room).some(s=>s.entity_id.startsWith('light.')&&s.state==='on');}
  private chooseDeck(id:string){this.deckId=id;this.selected='';this.message='';}
  private chooseRoom(id:string){this.selected=id;this.message='';if(innerWidth<650)void this.updateComplete.then(()=>this.shadowRoot?.querySelector('.details')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  private async command(id:string,service:string,data:Record<string,unknown>={}){
    this.pending=id;this.message='';
    try{await this.hass.callService(id.split('.')[0]!,service,{entity_id:id,...data});this.requestUpdate();}
    catch{this.message='This command could not be completed. Please try again.';}
    finally{this.pending='';}
  }
  private roomDrawing(room:SpatialRoom){
    const b=bounds(room),ring=roomOutline(room),selected=room.id===this.selected;
    const x=b.x+b.w/2,y=b.y+b.h/2;
    const small=b.w<3.5||b.h<3;const words=room.name.split(' '),split=words.length>1?Math.ceil(words.length/2):0;
    const lines=split?[words.slice(0,split).join(' '),words.slice(split).join(' ')]:[room.name];
    const furnishing=furniture(room.id);
    const bow=room.polygon.length===3;
    const furnishingBox=bow?{x:b.x+b.w*.05,y:b.y+b.h*.24,w:b.w*.43,h:b.h*.42}:{x:b.x+.18,y:b.y+.1,w:Math.max(.2,b.w-.36),h:Math.max(.2,b.h-.8)};
    const labelX=bow?b.x+b.w*.28:x,labelY=bow?b.y+b.h*.72:furnishing===nothing?y-.07:b.y+b.h-(lines.length>1?.65:.27);
    return svg`<g class=${`room ${selected?'selected':''}`} role="button" tabindex="0" aria-label=${`Open ${room.name}`} aria-pressed=${selected} @click=${()=>this.chooseRoom(room.id)} @keydown=${(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.chooseRoom(room.id);}}}>
      <defs><clipPath id=${`clip-${room.id}`}><polygon points=${ring.map(p=>p.join(',')).join(' ')}/></clipPath></defs>
      <polygon class=${`surface ${outdoor(room.id)?'exterior':''}`} points=${ring.map(p=>p.join(',')).join(' ')}/>
      ${furnishing===nothing?nothing:svg`<g clip-path=${`url(#clip-${room.id})`}><g class="furnishing" transform=${`translate(${furnishingBox.x} ${furnishingBox.y}) scale(${furnishingBox.w} ${furnishingBox.h})`}>${furnishing}</g></g>`}
      <text class=${`room-name ${small?'room-small':''}`} text-anchor="middle" x=${labelX} y=${labelY}>${lines.map((line,i)=>svg`<tspan x=${labelX} dy=${i===0?0:.38}>${line}</tspan>`)}</text>
      ${(room.openings??[]).map(opening=>{
        const p=openingPlacement(room,opening);if(!p)return nothing;
        const a=[p.center[0]-p.tangent[0]*p.width/2,p.center[1]-p.tangent[1]*p.width/2];
        const end=[a[0]!+p.tangent[0]*p.width,a[1]!+p.tangent[1]*p.width];
        return svg`<path d=${`M${a.join(' ')}L${end.join(' ')}`} stroke="#65a8b6" stroke-width=".12"/><path d=${`M${a.join(' ')}L${end.join(' ')}`} stroke="#e1f2f0" stroke-width=".035"/>`;
      })}
      ${this.lit(room)?svg`<circle cx=${b.x+.23} cy=${b.y+.26} r=".08" fill="#b69555"/>`:nothing}
    </g>`;
  }
  private drawing(){return svg`<svg class="drawing" viewBox="-1.7 -2.8 41 13.5" role="group" aria-label=${`${this.floor.name} furnished yacht plan`}>
    <defs><pattern id="teak" width=".22" height=".22" patternUnits="userSpaceOnUse"><rect width=".22" height=".22" fill="#c9b891"/><path d="M0 .22H.22" stroke="#ad9b77" stroke-width=".014"/></pattern><filter id="deck-shadow" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy=".25" stdDeviation=".3" flood-color="#000" flood-opacity=".28"/></filter></defs>
    <path d="M-.35 4.05H38" stroke="#607985" stroke-width=".015" stroke-dasharray=".2 .22"/>
    <g filter="url(#deck-shadow)">${this.floor.rooms.map(r=>this.roomDrawing(r))}</g>
    <path d="M4.17 -.17H27.08L31.25 1.18L37.72 4.05L31.25 6.92L27.08 8.27H4.17L.92 7.9L-.2 6.85V1.25L.92 .2Z" fill="none" stroke="#c9d6d5" stroke-width=".075" stroke-linejoin="round"/>
    <path d="M1.25 -.8H36.7M1.25 -.98V-.62M36.7 -.98V-.62" stroke="#728d9b" stroke-width=".027"/><text class="direction" text-anchor="middle" x="19" y="-1.1">37.5 M · EXPLORER YACHT</text>
    <text class="direction" x=".1" y="9.15">AFT</text><text class="direction" text-anchor="end" x="37.5" y="9.15">BOW →</text><text class="direction" text-anchor="middle" x="19" y="-.38">PORT</text><text class="direction" text-anchor="middle" x="19" y="9.15">STARBOARD</text>
  </svg>`;}
  private reading(s:HAState){
    const a=s.attributes;
    if(s.entity_id.startsWith('climate.'))return `${a.current_temperature??'—'} °C · ${s.state==='off'?'Standby':a.hvac_action==='heating'?'Heating':a.hvac_action==='cooling'?'Cooling':'Comfort mode'}`;
    if(s.entity_id.startsWith('cover.'))return `${a.current_position??(s.state==='closed'?0:100)}% open`;
    if(s.entity_id.startsWith('media_player.'))return `${s.state==='playing'?'Playing':s.state==='paused'?'Paused':'Standby'}${a.media_title?' · '+a.media_title:''}`;
    if(s.entity_id.startsWith('binary_sensor.'))return a.device_class==='problem'?(s.state==='on'?'Attention required':'Normal'):['door','window','opening'].includes(String(a.device_class))?(s.state==='on'?'Open':'Closed'):(s.state==='on'?'Occupied':'Clear');
    const display:Record<string,string>={on:'On',off:'Off',rinse:'Rinsing',drying:'Drying',idle:'Ready'};
    return `${display[s.state]??s.state}${a.unit_of_measurement?' '+a.unit_of_measurement:''}`;
  }
  private device(s:HAState){
    const id=s.entity_id,domain=id.split('.')[0],busy=this.pending===id,cat=categories.find(c=>c.id===category(s))!;
    const name=String(s.attributes.friendly_name??'Equipment').split(' · ').slice(1).join(' · ')||String(s.attributes.friendly_name??'Equipment');
    return html`<div class="device"><div class="device-head">${mpIcon(cat.icon,17)}<div><strong>${name}</strong><small>${this.reading(s)}</small></div></div>
      ${domain==='light'||domain==='switch'?html`<button ?disabled=${busy} @click=${()=>this.command(id,s.state==='on'?'turn_off':'turn_on')}>${s.state==='on'?'Turn off':'Turn on'}</button>`:nothing}
      ${domain==='cover'?html`<div class="controls"><button ?disabled=${busy} @click=${()=>this.command(id,'open_cover')}>Open</button><button ?disabled=${busy} @click=${()=>this.command(id,'close_cover')}>Close</button></div>`:nothing}
      ${domain==='climate'?html`<div class="controls"><button aria-label=${`Lower ${name} temperature`} ?disabled=${busy} @click=${()=>this.command(id,'set_temperature',{temperature:Math.max(Number(s.attributes.min_temp??16),Number(s.attributes.temperature??22)-1)})}>−</button><span>Set to ${s.attributes.temperature??22} °C</span><button aria-label=${`Raise ${name} temperature`} ?disabled=${busy} @click=${()=>this.command(id,'set_temperature',{temperature:Math.min(Number(s.attributes.max_temp??30),Number(s.attributes.temperature??22)+1)})}>+</button></div>`:nothing}
      ${domain==='media_player'?html`<button ?disabled=${busy} @click=${()=>this.command(id,s.state==='playing'?'media_pause':'media_play')}>${s.state==='playing'?'Pause':'Play'}</button>`:nothing}
    </div>`;
  }
  private details(){
    const room=this.space,devices=room?this.devices(room):this.floor.rooms.flatMap(r=>this.devices(r));
    const unique=[...new Map(devices.map(s=>[s.entity_id,s])).values()];
    const lights=unique.filter(s=>s.entity_id.startsWith('light.')),temps=unique.filter(s=>s.attributes.device_class==='temperature').map(s=>Number(s.state)).filter(Number.isFinite);
    const shown=unique.filter(s=>this.mode==='all'||category(s)===this.mode);
    return html`<aside class="panel details" aria-label=${room?`${room.name} systems`:'Deck overview'}>${room?html`<button class="details-close" aria-label="Close room" @click=${()=>{this.selected='';}}>${mpIcon('close',17)}</button>`:nothing}<div class="eyebrow">${room?'Selected space':'On this deck'}</div><h3>${room?.name??this.floor.name}</h3><div class="sub">${room?'Comfort, ambience & equipment':'Your yacht, connected room by room.'}</div>
      ${room?html`<div class="room-list">${shown.length?shown.map(s=>this.device(s)):html`<p class="tip">${unique.length?'No equipment in this category.':'A quiet space on board. Select another room to explore its connected systems.'}</p>`}</div>`:html`<div class="metric-grid"><div class="metric"><span>Spaces</span><strong>${this.floor.rooms.length}</strong><small>on this deck</small></div><div class="metric"><span>Lighting</span><strong>${lights.filter(s=>s.state==='on').length}<small> / ${lights.length}</small></strong><small>circuits on</small></div><div class="metric"><span>Comfort</span><strong>${temps.length?(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1):'—'}<small> °C</small></strong><small>average reading</small></div><div class="metric"><span>Systems</span><strong>${unique.length}</strong><small>connected equipment</small></div></div><div class="status"><i></i> Systems connected</div><hr/><p class="tip">Select a room on the deck plan to explore its lighting, climate, shades and entertainment.</p><p class="sub">Switch to the 3D view to rotate the yacht and explore its equipment in space.</p>`}
      ${this.message?html`<p class="message" role="alert">${this.message}</p>`:nothing}
    </aside>`;
  }
  render(){if(!this.plan||!this.hass)return nothing;return html`<main class="shell"><header class="top"><div class="brand"><span class="brand-mark">N</span><div>MP NEXUS<small>THE CONNECTED YACHT EXPERIENCE</small></div></div><a class="back" href="/__mpnexus/">← Choose another demo</a></header>
    <section class="hero"><div><div class="eyebrow">Yachting collection · Live demonstration</div><h1>Explorer <em>37</em></h1><p>A calmer way to manage life on board.</p><div class="specs"><span><strong>37.5 m</strong> Length</span><span><strong>4</strong> Decks</span><span class="badge">Private motor yacht</span></div></div><svg class="vessel" viewBox="0 0 430 130" aria-hidden="true"><path d="M20 100H396L410 60L300 65L230 70H70L50 81H25Z" fill="#385865" stroke="#a9bec5" stroke-width="1.2"/><path d="M70 70L93 49H300L339 64M126 49L148 29H271L299 49M179 29L197 14H248M210 14V2M190 12H266" fill="none" stroke="#a9bec5" stroke-width="1.2"/><path d="M107 53H285M155 34H275M81 81H311M330 82H375" stroke="#d6b67e" stroke-width="3"/><path d="M10 107Q78 104 150 107T420 107" stroke="#426574" fill="none"/><circle cx="342" cy="73" r="2" fill="#c4d6d6"/></svg></section>
    <section class="workspace"><nav class="deck-nav" aria-label="Yacht decks"><div class="eyebrow">Explore the yacht</div>${[...this.plan.floors].reverse().map((f,i)=>html`<button class="deck-button" aria-pressed=${this.deckId===f.id} @click=${()=>this.chooseDeck(f.id)}><b>0${4-i}</b><span>${f.name}<small>${f.id==='yacht-sun'?'Open-air living':f.id==='yacht-upper'?'Lounge & navigation':f.id==='yacht-main'?'Living & hospitality':'Guest & technical'}</small></span></button>`)}<div class="deck-key"><div><i class="dot gold"></i> Lighting active</div><div><i class="dot"></i> Connected systems</div><p>Designed for life at sea.</p></div></nav>
      <div class="center"><section class="panel"><header class="plan-head"><div><h2>${this.floor.name}</h2><div class="sub">${deckNotes[this.floor.id]}</div></div><div class="view-tabs" role="group" aria-label="Plan view"><button aria-pressed=${this.view==='plan'} @click=${()=>{this.view='plan';}}>Deck plan</button><button aria-pressed=${this.view==='3d'} @click=${()=>{this.view='3d';}}>3D view</button></div></header>
        ${this.view==='plan'?html`<div class="drawing-wrap">${this.drawing()}</div><div class="plan-footer"><span>${mpIcon('plan',13)} General arrangement · ${this.floor.name}</span><span>${mpIcon('info',13)} Select a space to explore</span></div>`:html`<div class="three"><mp-yacht-spatial-viewer .plan=${{...this.plan,floors:[this.floor]}} .hass=${this.hass} @room-select=${(e:CustomEvent<{roomId:string}>)=>this.chooseRoom(e.detail.roomId)}></mp-yacht-spatial-viewer></div>`}
        <nav class="systems" aria-label="Equipment categories">${categories.map(c=>html`<button aria-pressed=${this.mode===c.id} @click=${()=>{this.mode=c.id;}}>${mpIcon(c.icon,14)}${c.name}</button>`)}</nav>
      </section><nav class="spaces" aria-label="Spaces on this deck">${this.floor.rooms.map(r=>html`<button class="space" aria-pressed=${this.selected===r.id} @click=${()=>this.chooseRoom(r.id)}>${mpIcon(/suite|cabin/.test(r.id)?'bed':/galley/.test(r.id)?'kitchen':/laundry/.test(r.id)?'washer':outdoor(r.id)?'sun':'rooms',16)}<span>${r.name}</span>${this.lit(r)?html`<i class="dot"></i>`:nothing}</button>`)}</nav></div>${this.details()}
    </section><footer class="bottom"><span>MP NEXUS · YACHTING</span><span>Interactive demonstration · ${__MP_GLASS_VERSION__}</span></footer></main>`;}
}
customElements.define('mp-yacht-demo',MPYachtDemo);
