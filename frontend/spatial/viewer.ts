import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { Hass } from '../ha/client';
import type { HAState } from '../../shared/models';
import { available, brightnessPercent, MPCapabilityEngine } from '../../shared/capabilities';
import { alignRooms, polygonArea, stackFloors, wallSegments, type SpatialFloor, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { mpIcon, type MPIconName } from '../icons';
import { defineElement } from '../registry';
import type { CameraView, LevelProjection, SceneLevel, SpatialScene } from './scene';
import { canCover, coverPosition, hasThermometer, roomAmbient, roomTemperature, temperatureColor, temperatureRange, type CoverAction, type PlanMode } from '../../shared/spatial-state';

type Kind = 'light'|'cover'|'climate'|'opening'|'motion'|'binary'|'temperature'|'humidity'|'sensor';
interface Device { id:string; kind:Kind; name:string; ready:boolean; switchable:boolean; on:boolean; detail:string; value?:string; numeric?:number; percent?:number; dimmable:boolean }

const plain=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const ROOM_ICONS:[RegExp,MPIconName][]=[
  [/salon|sejour|living|lounge|salle a manger|dining|piece de vie/,'sofa'],[/cuisine|kitchen/,'kitchen'],[/chambre|bedroom|suite|parental/,'bed'],
  [/salle de bain|salle d.eau|\bsdb\b|bain|douche|bath|shower|\bwc\b|toilet/,'bath'],[/bureau|office|bibliotheque|library|study/,'desk'],
  [/entree|hall|couloir|degagement|corridor|palier|escalier|stair|landing/,'door'],[/garage|atelier|workshop/,'car'],
  [/jardin|terrasse|garden|terrace|balcon|balcony|piscine|pool|exterieur|outdoor|patio|veranda/,'leaf'],
];
const roomIcon=(name:string)=>ROOM_ICONS.find(([pattern])=>pattern.test(plain(name)))?.[1]??'rooms';
const KIND_ICONS:Record<Kind,MPIconName>={light:'bulb',cover:'window',climate:'flame',opening:'window',motion:'motion',binary:'gauge',temperature:'thermo',humidity:'drop',sensor:'gauge'};
const HVAC:Record<string,string>={off:'Arrêt',heat:'Chauffage',cool:'Climatisation',heat_cool:'Automatique',auto:'Automatique',dry:'Déshumidification',fan_only:'Ventilation'};
const motion=():ScrollBehavior=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
/** Width of the fade at each end of the room list, where its arrows sit. */
const EDGE=40;
/** The view Recentrer brings back, per floor, kept in this browser. */
const VIEW_KEY='mp-glass.spatial.views';
/** The saved view of every floor at once: never a floor id, which only has letters, digits, _ and -. */
const HOUSE='*';
/** Gap between a floor and its label beside it, in pixels. */
const LABEL_GAP=12;
/** Below this stage width, floor labels have no room beside the house unless it moves over for them. */
const NARROW=640;
type PlanView=CameraView&{top:boolean};
/** How long Recentrer is held down before it offers to save the view on screen. */
const HOLD=550;
/** A click that follows the window opening is the end of that press, not a request to recentre. */
const AFTER_HOLD=800;
const triple=(value:unknown):value is [number,number,number]=>Array.isArray(value)&&value.length===3&&value.every(n=>typeof n==='number'&&Number.isFinite(n));
/** Saved views come from storage, where anything can be written: keep only cameras that can be framed. */
function parseViews(raw:string|null):Record<string,PlanView>{
  const views:Record<string,PlanView>={};
  let stored:unknown;
  try{stored=raw?JSON.parse(raw):undefined;}catch{return views;}
  if(!stored||typeof stored!=='object')return views;
  for(const [id,value] of Object.entries(stored as Record<string,unknown>)){
    const view=value as Partial<PlanView>|null;
    if(!view||typeof view!=='object'||!triple(view.target)||!triple(view.offset)||Math.hypot(...view.offset)<.01)continue;
    if(typeof view.fov!=='number'||!(view.fov>0&&view.fov<180))continue;
    views[id]={target:view.target,offset:view.offset,fov:view.fov,top:view.top===true};
  }
  return views;
}
const readViews=()=>{try{return parseViews(localStorage.getItem(VIEW_KEY));}catch{return {};}};
const writeViews=(views:Record<string,PlanView>)=>{
  try{if(Object.keys(views).length)localStorage.setItem(VIEW_KEY,JSON.stringify(views));else localStorage.removeItem(VIEW_KEY);}
  catch{/* Storage blocked: the view holds for this page only. */}
};
const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))?Number(value):undefined;
function kindOf(id:string,state?:HAState):Kind{
  const domain=id.split('.')[0],deviceClass=String(state?.attributes.device_class??''),unit=String(state?.attributes.unit_of_measurement??'');
  if(domain==='light')return 'light';
  if(domain==='cover')return 'cover';
  if(domain==='climate')return 'climate';
  if(domain==='binary_sensor')return ['door','window','opening','garage_door'].includes(deviceClass)?'opening':['motion','occupancy','presence'].includes(deviceClass)?'motion':'binary';
  if(deviceClass==='temperature'||/°[CF]$/.test(unit))return 'temperature';
  if(deviceClass==='humidity')return 'humidity';
  return 'sensor';
}
/** "Salon · Suspension" shown as "Suspension" inside the Salon. */
function shorten(name:string,room:string){
  const rest=name.slice(room.length);
  if(!room||!/^[\s·:|/–—-]/.test(rest)||name.slice(0,room.length).localeCompare(room,undefined,{sensitivity:'base'})!==0)return name;
  return rest.replace(/^[\s·:|/–—-]+/,'')||name;
}

export class MPSpatialViewer extends LitElement {
  static properties = { plan:{attribute:false}, hass:{attribute:false}, areaHref:{attribute:false}, preview:{type:Boolean,reflect:true}, floor:{state:true}, selected:{state:true}, error:{state:true}, walls:{state:true}, topView:{state:true}, engaged:{state:true}, busy:{state:true}, mode:{state:true}, views:{state:true}, asking:{state:true}, pointed:{state:true}, opening:{state:true} };
  static styles = css`
    :host{display:block;position:relative;container-type:inline-size;min-width:0;color:#eff7ff;font:13px/1.5 var(--mp-body-font,Inter,system-ui,sans-serif);--accent:var(--mp-accent,#69b7ff);--warm:#ffd35a;--line:rgba(214,236,255,.14)}
    *{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}button:disabled{opacity:.45;cursor:default}
    button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #a2d7ff;outline-offset:2px}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .layout{display:grid;gap:12px;align-items:start}.stage-col,.side{display:grid;gap:12px;min-width:0;align-content:start}
    .stage{position:relative;height:var(--mp-stage-height,clamp(300px,min(62cqw,72vh),620px));overflow:hidden;border-radius:var(--mp-radius,22px);background:radial-gradient(ellipse 65% 55% at 50% 60%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 72%),linear-gradient(180deg,rgba(3,16,29,.14),rgba(3,16,29,.44));border:1px solid rgba(214,236,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.07),0 24px 60px rgba(0,8,18,.18)}
    /* Every floor at once needs more height on a phone. */
    :host([stacked]) .stage{height:var(--mp-stage-height,clamp(360px,min(62cqw,72vh),620px))}
    .canvas{position:absolute;inset:0}.canvas canvas{display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px}
    .glass{background:rgba(5,20,34,.58);border:1px solid var(--line);backdrop-filter:blur(16px) saturate(140%);box-shadow:0 10px 28px rgba(0,8,18,.28)}
    .floor-tag{position:absolute;top:12px;left:12px;z-index:2;display:inline-flex;align-items:center;gap:7px;max-width:calc(100% - 84px);min-height:32px;padding:0 12px;border-radius:999px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#cfe0ef;pointer-events:none;white-space:nowrap;overflow:hidden}
    .floors{position:absolute;top:12px;left:12px;z-index:2;display:flex;gap:2px;max-width:calc(100% - 84px);padding:3px;border-radius:14px;overflow-x:auto;scrollbar-width:none}.floors::-webkit-scrollbar{display:none}
    .floors button{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border:0;border-radius:11px;background:transparent;font-size:12px;white-space:nowrap;color:#cfe0ef}
    .floors button[aria-pressed=true]{color:#fff;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 75%,transparent),rgba(38,94,149,.7));box-shadow:inset 0 1px rgba(255,255,255,.2)}
    .rail{position:absolute;top:12px;right:12px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border-radius:16px}
    .rail button{position:relative;display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid transparent;border-radius:12px;background:transparent;color:#d6e6f5;touch-action:manipulation;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;transition:background .15s,color .15s}
    .rail button:hover{background:rgba(255,255,255,.09);color:#fff}
    /* A saved view of its own: the dot says Recentrer brings that one back. */
    .rail button.saved::after{content:'';position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent)}
    .rail button[aria-pressed=true]{color:#fff;background:color-mix(in srgb,var(--accent) 30%,transparent);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
    .rail .sep{width:18px;height:1px;margin:3px 0;background:var(--line)}
    .hint{position:absolute;left:50%;bottom:12px;z-index:1;max-width:calc(100% - 24px);margin:0;padding:6px 13px;transform:translateX(-50%);border-radius:999px;font-size:11px;color:#cbdced;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
    .hint[hidden]{display:none}.hint .touch{display:none}
    .labels{position:absolute;inset:0;z-index:1;pointer-events:none}
    /* A room's name on the plan: a one-line capsule, its readings on a second line when it has some. Its own width, even near the edge of the plan. */
    .labels button{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:max-content;max-width:160px;min-height:26px;padding:3px 12px;border-radius:999px;border:1px solid rgba(206,230,255,.2);background:rgba(6,22,38,.62);box-shadow:inset 0 1px rgba(255,255,255,.08),0 6px 18px rgba(0,8,18,.36);backdrop-filter:blur(12px) saturate(140%);font-size:12px;font-weight:600;line-height:1.3;letter-spacing:.01em;color:#f2f8ff;text-shadow:0 1px 2px rgba(0,8,18,.45);transition:background .2s,border-color .2s,box-shadow .2s}
    .labels button.rich{padding:4px 12px 5px;border-radius:14px}
    .labels .name{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%}.labels .name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .readings{display:flex;align-items:center;justify-content:center;gap:8px;font-size:11.5px;font-weight:600;color:#cce3f2;font-variant-numeric:tabular-nums}
    .reading{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.reading.temp{color:var(--tone)}
    /* On the selected label's blue, every temperature colour keeps a dark ground. */
    .labels button[aria-pressed=true] .reading.temp{margin:0 -2px;padding:0 6px;border-radius:99px;background:rgba(3,16,29,.5)}
    .shutter{display:inline-block;position:relative;width:12px;height:13px;border:1px solid currentColor;border-radius:2px;background:transparent;overflow:hidden;flex:none}
    .shutter::before{content:'';position:absolute;inset:0 0 auto;height:var(--closed,100%);background:repeating-linear-gradient(0deg,currentColor 0 1px,transparent 1px 3px);transition:height .3s}
    .shutter.unknown{opacity:.45}.shutter.unknown::before{background:none}.shutter.unknown::after{content:'?';position:absolute;inset:0;text-align:center;font:9px/11px system-ui}
    .modes{position:absolute;left:12px;bottom:12px;z-index:2;display:flex;gap:3px;padding:3px;border-radius:13px}
    .modes button{display:flex;align-items:center;gap:6px;border:0;border-radius:10px;background:transparent;padding:7px 10px;min-height:34px;color:#bed4e4;font-size:12px}
    .modes button[aria-pressed=true]{background:#74b9eb30;color:#fff}.legend{position:absolute;bottom:62px;left:12px;right:62px;color:#cde0eb;font-size:10px;pointer-events:none}
    .legend b{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.legend span{margin-right:8px;white-space:nowrap}
    .cover-controls{grid-column:1/-1;display:flex;gap:6px;align-items:center;padding:4px 8px 8px}.cover-controls button{border:1px solid var(--line);border-radius:9px;background:#14354d;min-width:38px;min-height:36px}
    .cover-controls label{flex:1;min-width:0;display:flex;align-items:center;gap:8px}.cover-controls output{font-size:11px;white-space:nowrap}
    .labels i{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--warm);box-shadow:0 0 10px #ffc53d}
    /* A floor of the whole house, labelled beside it with its state: pointing at the label or at the floor lights that floor up. */
    .labels button[data-floor]{min-height:30px;padding:4px 14px;font-size:13px}.labels button[data-floor].rich{padding:5px 14px 6px}
    .labels button[data-floor]:hover,.labels button[data-floor].pointed{z-index:1;border-color:color-mix(in srgb,var(--accent) 75%,white);background:rgba(12,44,72,.82);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 20%,transparent),0 8px 22px rgba(0,8,18,.4)}
    .labels button[aria-pressed=true]{z-index:1;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 80%,transparent),rgba(38,94,149,.78));border-color:color-mix(in srgb,var(--accent) 70%,white);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent),0 10px 24px rgba(0,8,18,.45)}
    .rooms{position:relative;min-width:0}
    .strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:none;scroll-snap-type:x proximity;scroll-padding-inline:40px}.strip::-webkit-scrollbar{display:none}
    .rooms[data-after] .strip{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 40px),transparent)}
    .rooms[data-before] .strip{-webkit-mask-image:linear-gradient(90deg,transparent,#000 40px);mask-image:linear-gradient(90deg,transparent,#000 40px)}
    .rooms[data-before][data-after] .strip{-webkit-mask-image:linear-gradient(90deg,transparent,#000 40px,#000 calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,transparent,#000 40px,#000 calc(100% - 40px),transparent)}
    .more{position:absolute;top:6px;z-index:1;display:none;place-items:center;width:32px;height:32px;padding:0;border-radius:50%;border:1px solid rgba(206,230,255,.22);background:rgba(6,22,38,.82);backdrop-filter:blur(10px);box-shadow:0 4px 14px rgba(0,8,18,.4);color:#eef7ff}
    .more:hover{border-color:color-mix(in srgb,var(--accent) 60%,transparent)}.more.before{left:0}.more.before .mp-icon{transform:scaleX(-1)}.more.after{right:0}
    .rooms[data-before] .more.before,.rooms[data-after] .more.after{display:grid}
    .chip{flex:0 0 auto;scroll-snap-align:start;display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px 0 11px;border-radius:999px;border:1px solid rgba(206,230,255,.16);background:rgba(6,24,40,.5);backdrop-filter:blur(14px);font-size:12.5px;color:#dce9f5;transition:background .2s,border-color .2s}
    .chip:hover,.chip.pointed{border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
    .chip[aria-pressed=true]{color:#fff;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 72%,transparent),rgba(38,94,149,.66));border-color:color-mix(in srgb,var(--accent) 78%,white);box-shadow:0 6px 20px color-mix(in srgb,var(--accent) 22%,transparent)}
    .chip .glow{width:7px;height:7px;border-radius:50%;background:var(--warm);box-shadow:0 0 10px #ffc53d}
    .card{position:relative;overflow:hidden;padding:18px;border-radius:var(--mp-radius,22px);background:linear-gradient(150deg,color-mix(in srgb,var(--mp-tint,#12344f) 74%,transparent),rgba(6,22,38,.82) 70%);border:1px solid color-mix(in srgb,var(--accent) 22%,rgba(224,239,255,.22));box-shadow:0 22px 50px rgba(0,8,18,.34),inset 0 1px rgba(255,255,255,.1);backdrop-filter:blur(var(--mp-blur,24px)) saturate(140%);animation:rise .32s ease both}
    .card::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 0 0,color-mix(in srgb,var(--accent) 16%,transparent),transparent 46%)}
    .card.lit::before{background:radial-gradient(circle at 0 0,rgba(255,200,80,.2),transparent 48%)}.card>*{position:relative}
    .card header{display:flex;align-items:center;gap:13px}
    .orb{display:grid;place-items:center;width:50px;height:50px;flex:0 0 auto;border-radius:var(--mp-icon-radius,16px);color:#e3f2ff;background:radial-gradient(circle at 30% 25%,color-mix(in srgb,var(--accent) 42%,transparent),color-mix(in srgb,var(--accent) 8%,transparent));border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);box-shadow:0 0 28px color-mix(in srgb,var(--accent) 20%,transparent),inset 0 1px rgba(255,255,255,.16)}
    .card.lit .orb{color:#ffe7a0;background:radial-gradient(circle at 30% 25%,rgba(255,214,102,.42),rgba(255,180,40,.08));border-color:rgba(255,225,140,.34);box-shadow:0 0 30px rgba(255,192,45,.24),inset 0 1px rgba(255,255,255,.18)}
    .title{flex:1;min-width:0}.title small{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#a9c0d6}
    .title h3{margin:3px 0 0;font:26px/1.05 var(--mp-display-font,Georgia,serif);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .close{display:grid;place-items:center;width:40px;height:40px;flex:0 0 auto;padding:0;border-radius:13px;border:1px solid var(--line);background:rgba(5,23,39,.35);color:#c7d8e8}.close:hover{background:rgba(81,132,179,.25);color:#fff}
    .stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:16px}.stat:last-child:nth-child(odd){grid-column:1/-1}
    .stat{min-width:0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(214,236,255,.09)}
    .stat small{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#9fb6cb}
    .stat strong{display:block;margin-top:5px;font:21px/1 var(--mp-display-font,Georgia,serif);font-weight:400;white-space:nowrap}.stat strong em{font-style:normal;font-size:14px;color:#a9bdd0}
    .stat span{display:block;margin-top:4px;font-size:11px;color:#a9bdd0}
    .stat.warm{border-color:rgba(255,214,110,.26);background:linear-gradient(145deg,rgba(255,205,80,.12),rgba(255,255,255,.03))}.stat.warm strong{color:#ffe08a}
    .master{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:12px;border-radius:14px;border:1px solid rgba(202,228,255,.18);background:rgba(8,29,48,.45);font-weight:650;color:#dae7f3}
    .master.on{color:#0a2338;background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d;box-shadow:0 8px 22px rgba(255,192,45,.2),inset 0 1px rgba(255,255,255,.55)}
    .devices{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}
    .device{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;padding:4px 6px 4px 4px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(214,236,255,.08);transition:background .25s,border-color .25s}
    .device.on{background:linear-gradient(145deg,rgba(255,205,80,.1),rgba(255,255,255,.03));border-color:rgba(255,220,130,.22)}.device.offline{opacity:.6}
    .main{display:flex;align-items:center;gap:11px;min-width:0;min-height:50px;padding:4px 6px;border:0;border-radius:12px;background:transparent;text-align:left}.main:hover{background:rgba(255,255,255,.045)}
    .dev-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px;color:#cfe0f0;background:rgba(197,220,243,.08);border:1px solid rgba(220,237,255,.1);transition:.25s ease}
    .levels{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px}
    .level{display:flex;align-items:center;gap:11px;width:100%;min-height:56px;padding:6px 12px 6px 6px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(214,236,255,.08);text-align:left;transition:background .25s,border-color .25s}
    .level:hover,.level.pointed{background:rgba(255,255,255,.07);border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
    .level.on{background:linear-gradient(145deg,rgba(255,205,80,.1),rgba(255,255,255,.03));border-color:rgba(255,220,130,.22)}
    .level .text{flex:1}.level>.mp-icon{color:#9fb6cb}
    .temps{display:inline-flex;align-items:center;gap:3px;font-size:13px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;color:#cce3f2}.readings .temps{font-size:inherit}
    .device.on .dev-icon,.level.on .dev-icon{color:#ffe175;background:radial-gradient(circle,rgba(255,216,89,.3),rgba(255,180,29,.08));border-color:rgba(255,225,138,.3);box-shadow:0 0 22px rgba(255,192,45,.26)}
    .device[data-kind=temperature] .dev-icon,.device[data-kind=climate] .dev-icon{color:#ffbf96}.device[data-kind=humidity] .dev-icon{color:#8fd3ff}
    .device[data-kind=opening].on .dev-icon,.device[data-kind=motion].on .dev-icon{color:#fff;background:color-mix(in srgb,var(--accent) 30%,transparent);border-color:color-mix(in srgb,var(--accent) 50%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--accent) 30%,transparent)}
    .text{min-width:0}.text strong{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .text small{display:block;margin-top:1px;font-size:11.5px;color:#a9bdd0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .value{padding-right:8px;font:20px/1 var(--mp-display-font,Georgia,serif);font-weight:400;white-space:nowrap}
    .switch{display:grid;place-items:center;width:58px;height:46px;padding:0;border:0;background:transparent}
    .switch span{position:relative;width:46px;height:26px;border-radius:99px;background:rgba(8,29,48,.6);border:1px solid rgba(202,228,255,.22);transition:background .2s,border-color .2s,box-shadow .2s}
    .switch span::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#d7e5f2;box-shadow:0 2px 6px rgba(0,8,18,.4);transition:transform .22s cubic-bezier(.3,.7,.4,1)}
    .switch.on span{background:linear-gradient(135deg,#ffe481,#ffc540);border-color:#ffea9d;box-shadow:0 0 16px rgba(255,192,45,.35)}.switch.on span::after{transform:translateX(20px);background:#fff}
    .dim{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin:0 8px 8px 14px;color:#ffe08a;font-size:11px}.dim output{min-width:38px;text-align:right;color:#dfe9f3}
    input[type=range]{appearance:none;width:100%;height:22px;margin:0;background:transparent;cursor:pointer}
    input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,var(--warm),rgba(206,226,246,.2))}
    input[type=range]::-webkit-slider-thumb{appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:#fff;border:3px solid #ffc540;box-shadow:0 2px 8px rgba(0,8,18,.5)}
    input[type=range]::-moz-range-track{height:4px;border-radius:99px;background:rgba(206,226,246,.25)}input[type=range]::-moz-range-progress{height:4px;border-radius:99px;background:var(--warm)}
    input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #ffc540}
    .lead{margin:14px 0 0;color:#aec3d6;font-size:12.5px}
    .open{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;margin-top:14px;padding:0 14px;border-radius:14px;color:#eef7ff;text-decoration:none;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent)}.open:hover{background:color-mix(in srgb,var(--accent) 22%,transparent)}
    .error{margin:0;padding:10px 14px;border-radius:14px;color:#ffc3ad;background:rgba(80,20,10,.35);border:1px solid rgba(255,170,140,.25)}.empty{padding:60px 24px;text-align:center}
    @container (min-width:560px) and (max-width:899px){.stats{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.stat:last-child:nth-child(odd){grid-column:auto}}
    @container (min-width:900px){.layout{grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:16px}}
    :host([preview]) .side,:host([preview]) .rooms{display:none}:host([preview]) .layout{grid-template-columns:1fr}
    @media (pointer:coarse){.rail .zoom{display:none}.rail button{width:40px;height:40px}.hint .touch{display:inline}.hint .fine{display:none}.more{display:none!important}}
    dialog.ask{width:min(380px,calc(100vw - 32px));padding:20px;border:1px solid rgba(159,210,255,.25);border-radius:20px;color:#eef6ff;background:linear-gradient(150deg,rgba(18,52,79,.96),rgba(7,26,44,.98) 70%);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px rgba(255,255,255,.12)}
    dialog.ask::backdrop{background:rgba(2,10,20,.6);backdrop-filter:blur(6px)}
    dialog.ask h3{margin:0;font:22px/1.15 var(--mp-display-font,Georgia,serif);font-weight:400}
    dialog.ask p{margin:10px 0 0;font-size:12.5px;color:#b7ccdf}
    .ask-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:18px}
    .ask-actions button{min-height:42px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:rgba(11,37,61,.8);color:#dbe9f5}
    .ask-actions .primary{background:#2a648e;border-color:#8acbff;color:#fff}
    dialog.ask .forget{margin-top:12px;min-height:38px;padding:0;border:0;background:transparent;color:#ffbda9;text-decoration:underline;text-underline-offset:3px}
    @keyframes rise{from{opacity:0;transform:translateY(8px)}}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  plan?: SpatialPlan;
  hass?: Hass;
  /** Dashboard view of a Home Assistant area, when one exists. */
  areaHref?: (areaId: string) => string | undefined;
  /** Plan only, without the room list and card (import draft). */
  preview = false;
  /** The floor shown; '' shows every floor of a house that has several, one above the other. */
  private floor = '';
  /** Floor of the stack under the pointer, and the one the camera is flying into. */
  private pointed = '';
  private opening = '';
  private flight = 0;
  private selected = '';
  private error = '';
  private walls = true;
  private topView = false;
  private engaged = false;
  private busy = false;
  private mode:PlanMode='lights';
  /** View saved by the user for each floor, and the window that asks before replacing it. */
  private views:Record<string,PlanView>={};
  private asking = false;
  private hold = 0;
  private asked = 0;
  private get temperatureUnit(){return this.hass?.config?.unit_system?.temperature??'°C';}
  private temperature(room:SpatialRoom){return roomTemperature(room,this.hass?.states??{},this.temperatureUnit);}
  /** Whether a room of the floors shown measures its temperature: without one, the plan has no climate mode to offer. */
  private thermometers(floors:SpatialFloor[]){const states=this.hass?.states??{};return floors.some(f=>f.rooms.some(r=>hasThermometer(r,states)));}
  private planMode(floors:SpatialFloor[]):PlanMode{return this.mode==='climate'&&this.thermometers(floors)?'climate':'lights';}
  private scene?: SpatialScene;
  private loading = false;
  private resize = new ResizeObserver(()=>this.edges());
  /** Every floor at once, until one is chosen: the state of the whole house at a glance. */
  private get stacked() { return !this.preview && !this.floor && (this.plan?.floors.length ?? 0) > 1; }
  private get shownFloors() { return this.stacked ? this.plan!.floors : this.currentFloor ? [this.currentFloor] : []; }
  /** Rooms of the stack are told apart by their floor: two floors can each have a "room-1". */
  private roomKey(floor: SpatialFloor, room: SpatialRoom) { return this.stacked ? `${floor.id}/${room.id}` : room.id; }
  private get currentFloor() { return this.plan?.floors.find(f=>f.id===this.floor) ?? this.plan?.floors[0]; }
  private get room() { return this.currentFloor?.rooms.find(r=>r.id===this.selected); }
  private get locale() { return this.hass?.locale?.language ?? this.hass?.language ?? 'fr'; }
  connectedCallback() { super.connectedCallback(); this.resize.observe(this); this.views=readViews(); this.requestUpdate(); }
  disconnectedCallback() { super.disconnectedCallback(); this.resize.disconnect(); clearTimeout(this.hold); this.asking=false; this.scene?.dispose(); this.scene=undefined; }
  protected willUpdate() { this.toggleAttribute('stacked', this.stacked); }
  protected async updated(changed: PropertyValues) {
    this.edges();
    const ask=this.renderRoot.querySelector<HTMLDialogElement>('dialog.ask');
    if(ask&&this.asking&&!ask.open)ask.showModal();else if(ask&&!this.asking&&ask.open)ask.close();
    if (!this.plan || !this.currentFloor) return;
    if (!this.scene && !this.loading && !this.error) {
      this.loading=true;
      try {
        const {SpatialScene}=await import('./scene');
        const host=this.renderRoot.querySelector<HTMLElement>('.canvas');
        if (!this.isConnected || !host || !this.currentFloor) return;
        this.scene=new SpatialScene(host, (room,floor)=>this.touch(room,floor), (rooms,levels)=>this.place(rooms,levels), ()=>{this.engaged=true;}, floor=>{this.pointed=floor;});
        this.draw();
      } catch { this.error='La 3D nécessite WebGL 2. Les pièces et leurs équipements restent accessibles dans la liste.'; }
      finally { this.loading=false; }
    } else if (this.scene && (changed.has('plan') || changed.has('floor') || changed.has('walls'))) {
      this.draw(!changed.has('walls'), changed.get('floor') as string|undefined);
    }
    if(this.scene&&this.currentFloor){
      const floors=this.shownFloors,mode=this.planMode(floors),states=this.hass?.states??{};
      const rooms=floors.flatMap(f=>f.rooms.map(r=>[this.roomKey(f,r),r] as const));
      const styled=this.scene.highlight(this.room?.id??'',new Map(rooms.map(([key,r])=>[key,roomAmbient(r,states,mode,this.temperatureUnit)])),this.stacked?this.opening||this.pointed:'');
      // Labels change size when sensor values or the mode changes, even if the camera stays still.
      const previous=changed.get('hass') as Hass|undefined;
      const readings=changed.has('hass')&&rooms.some(([,r])=>r.entityIds?.some(id=>previous?.states[id]!==this.hass?.states[id]));
      if(styled||readings||changed.has('mode')||changed.has('plan')||changed.has('floor'))this.scene.render();
    }
  }
  /**
   * The floor as drawn: neighbouring rooms brought onto the wall they share (the saved plan is unchanged). Every floor of the
   * house when none is chosen, apart from each other; coming back from the floor `from`, the camera draws back from it.
   */
  private draw(reset=true, from?: string) {
    const level=(floor:SpatialFloor):SceneLevel=>{const rooms=alignRooms(floor.rooms).map(r=>({...r,id:this.roomKey(floor,r)}));return {floor:{...floor,rooms},segments:wallSegments(rooms)};};
    if(!this.scene||!this.currentFloor) return;
    this.scene.setFloors((this.stacked?stackFloors(this.plan!.floors):[this.currentFloor]).map(level), this.walls, reset, this.topView);
    // The plan opens on the view saved for this floor, the one Recentrer brings back.
    const view=reset&&!this.preview?this.views[this.viewKey]:undefined;
    if(view){this.topView=view.top;this.scene.show(view);}
    else if(reset&&from&&this.stacked)this.scene.rise(from);
  }
  /** Touching the plan selects a room, or on the whole house opens the floor touched. */
  private touch(room: string, floor: string) {
    if(this.stacked) void this.openFloor(floor); else this.select(room);
  }
  /** Boxes the floating controls take up on the stage, which labels keep clear of. */
  private occupied(frame: DOMRect) {
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.rail,.floor-tag,.floors,.modes,.legend,.hint:not([hidden])')).map(el=>{
      const r=el.getBoundingClientRect();return {left:r.left-frame.left-3,right:r.right-frame.left+3,top:r.top-frame.top-3,bottom:r.bottom-frame.top+3};
    });
  }
  /** Room labels follow the camera; the selected one first, overlapping ones hidden. On the whole house, floor labels instead. */
  private place(positions: Map<string,{x:number;y:number;visible:boolean}>, levels: LevelProjection) {
    const stage=this.renderRoot.querySelector<HTMLElement>('.stage')!,frame=stage.getBoundingClientRect(),occupied=this.occupied(frame);
    // On a narrow stage the floors of the house stand between their labels and the controls; the plan then comes back here, drawn again.
    const aside=this.stacked&&frame.width<NARROW?Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-floor]'),l=>l.offsetWidth):[];
    const rail=this.renderRoot.querySelector<HTMLElement>('.rail')?.offsetWidth??0;
    if(this.scene?.reserve(aside.length?Math.max(...aside)+2*LABEL_GAP:0,aside.length?rail+LABEL_GAP:0)) return;
    if(this.stacked){this.placeLevels(levels,frame,occupied);return;}
    const labels=new Map(Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-room]')).map(el=>[el.dataset.room!,el]));
    const ordered=[...positions].sort(([a],[b])=>a===this.selected?-1:b===this.selected?1:0);
    for (const [id, position] of ordered) {
      const label=labels.get(id);
      if(!label) continue;
      const box={left:position.x-label.offsetWidth/2-3,right:position.x+label.offsetWidth/2+3,top:position.y-label.offsetHeight/2-3,bottom:position.y+label.offsetHeight/2+3};
      const visible=position.visible&&box.left>=0&&box.right<=frame.width&&box.top>=0&&box.bottom<=frame.height&&!occupied.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top);
      if(visible)occupied.push(box);
      label.style.left=`${position.x}px`;label.style.top=`${position.y}px`;label.style.visibility=visible?'visible':'hidden';
    }
  }
  /**
   * A floor's label stands beside the floor, on its left, else on its right. When neither side has room (a phone), it keeps to
   * the edge with more room, over the floor, moved up or down off the controls and labels it would hide or cover.
   */
  private placeLevels(levels: LevelProjection, frame: DOMRect, occupied: {left:number;right:number;top:number;bottom:number}[]) {
    type Box=(typeof occupied)[number];
    const overlap=(a:Box,b:Box)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    for (const label of this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-floor]')) {
      const position=levels.get(label.dataset.floor!);
      if(!position) continue;
      const width=label.offsetWidth,height=label.offsetHeight,half=width/2+3;
      const box=(x:number,y:number):Box=>({left:x-half,right:x+half,top:y-height/2-3,bottom:y+height/2+3});
      const left=position.left-LABEL_GAP-width/2,right=position.right+LABEL_GAP+width/2;
      let y=position.y,x=[left,right].find(x=>x-half>=0&&x+half<=frame.width&&!occupied.some(o=>overlap(box(x,y),o)));
      if(x===undefined){
        x=Math.min(Math.max(position.left>frame.width-position.right?left:right,half),frame.width-half);
        let down:boolean|undefined;
        for(let blocker=occupied.find(o=>overlap(box(x!,y),o));blocker;blocker=occupied.find(o=>overlap(box(x!,y),o))){
          down??=y>=(blocker.top+blocker.bottom)/2;
          y=down?blocker.bottom+height/2+4:blocker.top-height/2-4;
        }
      }
      occupied.push(box(x,y));
      label.style.left=`${x}px`;label.style.top=`${y}px`;label.style.visibility=position.visible&&y>=0&&y<=frame.height?'visible':'hidden';
    }
  }
  private litRooms(floor: SpatialFloor) {
    return new Set(floor.rooms.filter(r=>r.entityIds?.some(id=>id.startsWith('light.')&&this.hass?.states[id]?.state==='on')).map(r=>r.id));
  }
  private select(id: string) {
    if(!this.currentFloor?.rooms.some(r=>r.id===id)) return;
    this.selected=id; this.error=''; this.engaged=true;
    this.scene?.focus(id);
    // The Studio edits the room touched on the plan.
    this.dispatchEvent(new CustomEvent('room-select',{detail:{floorId:this.currentFloor.id,roomId:id}}));
    void this.updateComplete.then(()=>this.reveal());
  }
  /** The room list scrolls sideways under the plan, and on a phone the room card sits below it: show both for the selected room. */
  private reveal() {
    const behavior=motion();
    const strip=this.renderRoot.querySelector<HTMLElement>('.strip'),chip=strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if(strip && chip && strip.scrollWidth>strip.clientWidth){const s=strip.getBoundingClientRect(),c=chip.getBoundingClientRect();if(c.left<s.left+EDGE||c.right>s.right-EDGE)strip.scrollBy({left:c.left-s.left-(s.width-c.width)/2,behavior});}
    const card=this.renderRoot.querySelector<HTMLElement>('.card');
    if(card && card.getBoundingClientRect().top>innerHeight-96) card.scrollIntoView({behavior,block:'nearest'});
  }
  /** The room list stays on one line: fade and arrows mark the ends that hide more rooms. */
  private edges=()=>{
    const rooms=this.renderRoot.querySelector<HTMLElement>('.rooms'),strip=rooms?.querySelector<HTMLElement>('.strip');
    if(!rooms||!strip) return;
    rooms.toggleAttribute('data-before',strip.scrollLeft>1);
    rooms.toggleAttribute('data-after',strip.scrollLeft+strip.clientWidth<strip.scrollWidth-1);
  };
  private scrollRooms(direction: 1|-1) {
    const strip=this.renderRoot.querySelector<HTMLElement>('.strip');
    strip?.scrollBy({left:direction*(strip.clientWidth-2*EDGE),behavior:motion()});
  }
  private close=()=>{ this.selected=''; this.scene?.overview(); };
  private showFloor(id: string) {
    this.flight++; this.floor=id; this.selected=''; this.topView=false; this.pointed=''; this.opening='';
    // The Studio edits the floor opened on the plan.
    if(id) this.dispatchEvent(new CustomEvent('floor-select',{detail:{floorId:id}}));
  }
  private showHouse=()=>{
    // Already on the whole house, flying into a floor: the flight is called off.
    if(this.stacked&&this.opening) this.recenter();
    this.showFloor(''); this.engaged=true;
  };
  /** Opens a floor; from the whole house, the camera first flies into it. */
  private async openFloor(id: string) {
    if(!this.plan?.floors.some(f=>f.id===id)) return;
    this.engaged=true;
    if(this.stacked&&this.scene){
      const flight=++this.flight;
      this.opening=id;
      await this.scene.dive(id);
      if(flight!==this.flight) return;
    }
    this.showFloor(id);
  }
  /** Standard framing of the floor, the one a level without a saved view opens on. */
  private frame() { if(this.topView) this.scene?.top(); else this.scene?.reset(); }
  /** Each floor keeps its own saved view, and the whole house its own. */
  private get viewKey() { return this.stacked ? HOUSE : this.currentFloor?.id ?? ''; }
  private get savedView() { return this.preview||!this.currentFloor?undefined:this.views[this.viewKey]; }
  private recenter=()=>{
    const view=this.savedView;
    if(!view||!this.scene) { this.frame(); return; }
    this.topView=view.top; this.scene.show(view);
  };
  private toggleTop=()=>{ this.topView=!this.topView; this.frame(); };
  /** Hold Recentrer down (or right-click it) to make the view on screen the one it brings back. */
  private startHold=(e:PointerEvent)=>{
    if(e.button) return;
    clearTimeout(this.hold);
    this.hold=setTimeout(()=>{ this.hold=0; this.ask(); },HOLD) as unknown as number;
  };
  private endHold=()=>{ clearTimeout(this.hold); this.hold=0; };
  private ask=()=>{
    if(this.preview||!this.currentFloor||!this.scene) return;
    this.asked=performance.now(); this.asking=true;
  };
  /** The press that opened the window ends in a click: it must not recentre on its way out. */
  private tapRecenter=()=>{ if(performance.now()-this.asked>AFTER_HOLD) this.recenter(); };
  private saveView=()=>{
    const key=this.viewKey,view=this.scene?.view();
    if(key&&view){ this.views={...this.views,[key]:{...view,top:this.topView}}; writeViews(this.views); }
    this.asking=false;
  };
  private forgetView=()=>{
    const key=this.viewKey;
    if(key){ const rest={...this.views}; delete rest[key]; this.views=rest; writeViews(rest); }
    this.asking=false;
  };
  /** Asks before the view on screen becomes the one this floor, or the whole house, opens on. */
  private askDialog() {
    const saved=!!this.savedView;
    return html`<dialog class="ask" aria-labelledby="ask-title" @close=${()=>{this.asking=false;}}>
      <h3 id="ask-title">Enregistrer cette vue ?</h3>
      <p>La maison telle qu’elle est cadrée en ce moment — angle, zoom, position — devient la vue ${this.stacked?'de tous les niveaux':'de ce niveau'} : le plan s’ouvrira dessus et le bouton Recentrer la rappellera.</p>
      <p>${saved?'Elle remplace la vue déjà enregistrée. ':''}Cette vue n’est gardée que dans ce navigateur.</p>
      ${saved?html`<button class="forget" @click=${this.forgetView}>Oublier la vue enregistrée</button>`:nothing}
      <div class="ask-actions">
        <button @click=${()=>{this.asking=false;}}>Annuler</button>
        <button class="primary" autofocus @click=${this.saveView}>Enregistrer</button>
      </div>
    </dialog>`;
  }
  private format(value: number, digits=1) { return new Intl.NumberFormat(this.locale,{maximumFractionDigits:digits}).format(value); }
  private device(id: string, room: SpatialRoom): Device {
    const state=this.hass?.states[id],kind=kindOf(id,state),ready=available(state),on=ready&&state!.state==='on';
    const name=shorten(String(state?.attributes.friendly_name??id),room.name),unit=String(state?.attributes.unit_of_measurement??'');
    const base={id,kind,name,ready,switchable:false,on,dimmable:false};
    if(!ready) return {...base,detail:'Indisponible'};
    switch(kind){
      case 'light': return {...base,switchable:['on','off'].includes(state!.state),detail:on?'Allumée':'Éteinte',percent:brightnessPercent(state!.attributes.brightness),dimmable:MPCapabilityEngine.detect(id,state).some(b=>b.capability==='DIM')};
      case 'cover': {
        const percent=coverPosition(state),detail=({opening:'Ouverture…',closing:'Fermeture…',closed:'Fermé',open:'Ouvert'} as Record<string,string>)[state!.state]??state!.state;
        return {...base,on:false,percent,value:percent===undefined?undefined:`${this.format(percent,0)} %`,detail:percent===undefined?`${detail} · position inconnue`:`${detail} · ${this.format(percent,0)} % ouvert`};
      }
      case 'climate': {
        const current=numeric(state!.attributes.current_temperature),target=numeric(state!.attributes.temperature);
        return {...base,on:state!.state!=='off',numeric:current,value:current===undefined?undefined:`${this.format(current)} °`,detail:`${HVAC[state!.state]??state!.state}${target===undefined?'':` · consigne ${this.format(target)} °`}`};
      }
      case 'opening': return {...base,detail:on?'Ouvert':'Fermé'};
      case 'motion': return {...base,detail:on?'Présence détectée':'Aucune présence'};
      case 'binary': return {...base,detail:on?'Actif':'Inactif'};
      default: {
        const value=numeric(state!.state),label=kind==='temperature'?'Température':kind==='humidity'?'Humidité':'Capteur';
        return {...base,on:false,numeric:value,value:value===undefined?state!.state:`${this.format(value)}${unit?` ${unit}`:''}`,detail:this.since(state!)??(plain(name).includes(plain(label))?'Capteur':label)};
      }
    }
  }
  private since(state: HAState) {
    const at=Date.parse(state.last_changed??''),minutes=Math.round((Date.now()-at)/60_000);
    if(!Number.isFinite(minutes)||minutes<0) return undefined;
    const relative=new Intl.RelativeTimeFormat(this.locale,{numeric:'auto'});
    return `Mis à jour ${minutes<1?'à l’instant':minutes<60?relative.format(-minutes,'minute'):minutes<1440?relative.format(-Math.round(minutes/60),'hour'):relative.format(-Math.round(minutes/1440),'day')}`;
  }
  /** Only lights placed in the rooms given (one room, or every room of a floor) can be switched from the plan. */
  private async lights(rooms: SpatialRoom[], service: 'turn_on'|'turn_off', ids: string[], data: Record<string,unknown> = {}) {
    const allowed=[...new Set(ids)].filter(id=>id.startsWith('light.')&&rooms.some(r=>r.entityIds?.includes(id))&&available(this.hass?.states[id]));
    if(!this.hass || this.busy || !allowed.length) return;
    this.busy=true; this.error='';
    try { await this.hass.callService('light',service,{...data,entity_id:allowed.length===1?allowed[0]:allowed}); }
    catch { this.error='Commande refusée ou équipement indisponible.'; }
    finally { this.busy=false; }
  }
  private toggle(room: SpatialRoom, id: string) {
    const state=this.hass?.states[id]?.state;
    if(state==='on'||state==='off') void this.lights([room],state==='on'?'turn_off':'turn_on',[id]);
  }
  private moreInfo(entityId: string) { this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId},bubbles:true,composed:true})); }
  private async cover(room:SpatialRoom,id:string,action:CoverAction,position?:number){
    if(!this.hass||this.busy||!id.startsWith('cover.')||!room.entityIds?.includes(id)||!canCover(this.hass.states[id],action))return;
    if(action==='set_cover_position'&&(position===undefined||!Number.isFinite(position)||position<0||position>100))return;
    this.busy=true;this.error='';
    try{await this.hass.callService('cover',action,{entity_id:id,...(action==='set_cover_position'?{position}: {})});}
    catch{this.error='Commande du volet refusée ou équipement indisponible.';}
    finally{this.busy=false;}
  }
  /** Under a room's name: in climate mode its temperature, only when it has a thermometer (— while it is offline); its shutters. */
  private planReadings(room:SpatialRoom,climate:boolean){
    const temperature=climate?this.temperature(room):undefined,covers=(room.entityIds??[]).filter(id=>id.startsWith('cover.'));
    const thermometer=climate&&(!!temperature||hasThermometer(room,this.hass?.states??{}));
    if(!covers.length&&!thermometer)return nothing;
    return html`<span class="readings">
      ${thermometer?html`<span class="reading temp" style=${`--tone:${temperature?temperatureColor(temperature.celsius):'#a8bdca'}`} title=${temperature?`Température · ${temperature.id}`:'Température indisponible'}>${mpIcon('thermo',12)}${temperature?`${this.format(temperature.value)} ${temperature.unit}`:'—'}</span>`:nothing}
      ${covers.map(id=>{const state=this.hass?.states[id],position=coverPosition(state),name=String(state?.attributes.friendly_name??id);return html`<span class="reading" title=${`${name} · ${!available(state)?'Indisponible':position===undefined?'Position inconnue':`${this.format(position,0)} % ouvert`}`}><span class="shutter ${position===undefined?'unknown':''}" style=${`--closed:${100-(position??0)}%`} aria-hidden="true"></span><span>${position===undefined?'—':`${this.format(position,0)} %`}</span></span>`;})}
    </span>`;
  }
  /** A room on the plan: its name, a warm dot while a light is on, and its readings. */
  private planLabel(room:SpatialRoom,lit:boolean,climate:boolean){
    const readings=this.preview?nothing:this.planReadings(room,climate);
    return html`<button class=${readings===nothing?'':'rich'} style="visibility:hidden" data-room=${room.id} aria-pressed=${this.selected===room.id} @click=${()=>this.select(room.id)}><span class="name">${lit?html`<i></i>`:nothing}<span title=${room.name}>${room.name}</span></span>${readings}</button>`;
  }
  /** The lights of `rooms` (a floor, or the whole house), each once, and those on. */
  private lightsOf(rooms: SpatialRoom[]) {
    const all=[...new Set(rooms.flatMap(r=>(r.entityIds??[]).filter(id=>id.startsWith('light.'))))];
    return {all,on:all.filter(id=>this.hass?.states[id]?.state==='on')};
  }
  /** The coldest and warmest rooms of a floor, each value in its colour on the scale; one value when they agree. */
  private temperatures(floor: SpatialFloor) {
    const range=temperatureRange(floor.rooms,this.hass?.states??{},this.temperatureUnit);
    if(!range) return floor.rooms.some(r=>hasThermometer(r,this.hass?.states??{}))?html`<span class="temps" title="Température indisponible">${mpIcon('thermo',12)}—</span>`:nothing;
    const {low,high}=range,value=(t:typeof low)=>html`<span style=${`color:${temperatureColor(t.celsius)}`}>${this.format(t.value)}</span>`;
    return html`<span class="temps" title="Température des pièces du niveau">${mpIcon('thermo',12)}<span>${value(low)}${this.format(low.value)===this.format(high.value)&&low.unit===high.unit?nothing:html`–${value(high)}`} ${high.unit}</span></span>`;
  }
  /** A floor of the whole house on the plan: its name, a warm dot while a light is on, and how many are on, or its temperatures. */
  private levelLabel(floor: SpatialFloor, climate: boolean) {
    const {all,on}=this.lightsOf(floor.rooms);
    const readings=climate?this.temperatures(floor):all.length?html`<span class="reading">${on.length?`${on.length} ${on.length>1?'lumières allumées':'lumière allumée'}`:'Tout est éteint'}</span>`:nothing;
    return html`<button class="${readings===nothing?'':'rich'} ${this.pointed===floor.id||this.opening===floor.id?'pointed':''}" style="visibility:hidden" data-floor=${floor.id} title="Ouvrir ce niveau"
      @click=${()=>this.openFloor(floor.id)} @pointerenter=${()=>{this.pointed=floor.id;}} @pointerleave=${()=>{if(this.pointed===floor.id)this.pointed='';}}>
      <span class="name">${on.length&&!climate?html`<i></i>`:nothing}<span>${floor.name}</span></span>${readings===nothing?nothing:html`<span class="readings">${readings}</span>`}</button>`;
  }
  render() {
    const floor=this.currentFloor,room=this.room,plan=this.plan;
    if(!floor||!plan) return html`<div class="empty">Ajoutez votre plan dans Studio → Plan 3D.</div>`;
    const stacked=this.stacked,floors=this.shownFloors,lit=this.litRooms(floor),climate=this.planMode(floors)==='climate';
    // From above, the floors of the whole house would hide one another.
    const top=stacked?nothing:html`<button aria-label="Vue de dessus" title="Vue de dessus" aria-pressed=${this.topView} @click=${this.toggleTop}>${mpIcon('plan',18)}</button>`;
    return html`<div class="layout">
      <div class="stage-col">
      <div class="stage">
        <div class="canvas"></div>
        <div class="labels">${stacked?plan.floors.map(f=>this.levelLabel(f,climate)):floor.rooms.map(r=>this.planLabel(r,lit.has(r.id)&&!climate,climate))}</div>
        ${this.preview||!this.thermometers(floors)?nothing:html`<div class="modes glass" role="group" aria-label="Ambiance du plan"><button aria-pressed=${!climate} @click=${()=>{this.mode='lights';this.engaged=true;}}>${mpIcon('bulb',14)} Lumières</button><button aria-pressed=${climate} @click=${()=>{this.mode='climate';this.engaged=true;}}>${mpIcon('thermo',14)} Climat</button></div>
          ${climate?html`<div class="legend"><span><b style="background:#69b7ff"></b>&lt; 18 °C</span><span><b style="background:#71d7c0"></b>18–21</span><span><b style="background:#ffc574"></b>21–24</span><span><b style="background:#ff816b"></b>≥ 24 °C</span></div>`:nothing}`}
        ${plan.floors.length>1
          ? html`<div class="floors glass" role="group" aria-label="Niveau affiché">${this.preview?nothing:html`<button aria-pressed=${stacked} aria-label="Tous les niveaux" title="Tous les niveaux" @click=${this.showHouse}>${mpIcon('layers',14)}Tous</button>`}${plan.floors.map(f=>html`<button aria-pressed=${!stacked&&f.id===floor.id} @click=${()=>this.openFloor(f.id)}>${f.name}</button>`)}</div>`
          : html`<div class="floor-tag glass">${mpIcon('rooms',13)}<span>${floor.name}</span></div>`}
        <div class="rail glass" role="toolbar" aria-label="Commandes du plan" aria-orientation="vertical">
          <button class="zoom" aria-label="Zoom avant" title="Zoom avant" @click=${()=>this.scene?.zoom(.8)}>${mpIcon('plus',18)}</button>
          <button class="zoom" aria-label="Zoom arrière" title="Zoom arrière" @click=${()=>this.scene?.zoom(1.25)}>${mpIcon('minus',18)}</button>
          <span class="sep zoom"></span>
          <button class=${this.savedView?'saved':''} aria-label=${this.savedView?'Revenir à la vue enregistrée':'Recentrer'}
            title=${this.savedView?'Revenir à la vue enregistrée · appui long pour la remplacer':'Recentrer · appui long pour enregistrer la vue'}
            @click=${this.tapRecenter} @pointerdown=${this.startHold} @pointerup=${this.endHold} @pointerleave=${this.endHold} @pointercancel=${this.endHold}
            @contextmenu=${(e:Event)=>{e.preventDefault();this.ask();}}>${mpIcon('target',18)}</button>
          ${top}
          <button aria-label="Murs" title="Afficher les murs" aria-pressed=${this.walls} @click=${()=>{this.walls=!this.walls;}}>${mpIcon('walls',18)}</button>
        </div>
        <p class="hint glass" style=${this.preview?'':'top:56px;bottom:auto;max-width:calc(100% - 100px)'} aria-hidden="true" ?hidden=${this.engaged||!!this.error}><span class="touch">Touchez la maison pour la manipuler</span><span class="fine">Glissez la maison pour la tourner · molette pour zoomer</span></p>
      </div>
      <div class="rooms">
        <button class="more before" tabindex="-1" aria-hidden="true" title=${stacked?'Niveaux précédents':'Pièces précédentes'} @click=${()=>this.scrollRooms(-1)}>${mpIcon('arrow',16)}</button>
        ${stacked
          ? html`<nav class="strip" aria-label="Niveaux de la maison" @scroll=${this.edges}>${plan.floors.map(f=>html`<button class=${`chip ${this.pointed===f.id?'pointed':''}`} @click=${()=>this.openFloor(f.id)} @pointerenter=${()=>{this.pointed=f.id;}} @pointerleave=${()=>{if(this.pointed===f.id)this.pointed='';}}>${mpIcon('layers',16)}<span>${f.name}</span>${this.lightsOf(f.rooms).on.length?html`<i class="glow"></i><span class="sr">(lumière allumée)</span>`:nothing}</button>`)}</nav>`
          : html`<nav class="strip" aria-label="Pièces du niveau" @scroll=${this.edges}>${floor.rooms.map(r=>html`<button class="chip" aria-pressed=${this.selected===r.id} @click=${()=>this.select(r.id)}>${mpIcon(roomIcon(r.name),16)}<span>${r.name}</span>${lit.has(r.id)?html`<i class="glow"></i><span class="sr">(lumière allumée)</span>`:nothing}</button>`)}</nav>`}
        <button class="more after" tabindex="-1" aria-hidden="true" title=${stacked?'Niveaux suivants':'Pièces suivantes'} @click=${()=>this.scrollRooms(1)}>${mpIcon('arrow',16)}</button>
      </div>
      </div>
      <p class="sr">Sur la maison : glisser pour tourner, pincer ou molette pour zoomer, deux doigts ou clic droit pour déplacer. À côté de la maison, la page défile normalement. Clavier : flèches pour déplacer, + et − pour zoomer.</p>
      <div class="side">
        ${this.error?html`<p role="alert" class="error">${this.error}</p>`:nothing}
        ${stacked?this.houseCard(plan.floors):room?this.roomCard(room,floor,lit.has(room.id)):this.overviewCard(floor)}
      </div>
      ${this.preview?nothing:this.askDialog()}
    </div>`;
  }
  private lightsStat(total: number, on: number) {
    return html`<div class="stat ${on?'warm':''}"><small>Lumières</small><strong>${on}<em> / ${total}</em></strong><span>${on>1?'allumées':'allumée'}</span></div>`;
  }
  private overviewCard(floor: SpatialFloor) {
    const area=floor.rooms.reduce((sum,r)=>sum+polygonArea(r.polygon),0);
    const lights=floor.rooms.flatMap(r=>(r.entityIds??[]).filter(id=>id.startsWith('light.')));
    const lit=lights.filter(id=>this.hass?.states[id]?.state==='on'),on=lit.length;
    return html`<section class="card ${on?'lit':''}" aria-label="Vue d’ensemble du niveau">
      <header><span class="orb">${mpIcon('home',24)}</span><div class="title"><small>Vue d’ensemble</small><h3>${floor.name}</h3></div></header>
      <div class="stats"><div class="stat"><small>Pièces</small><strong>${floor.rooms.length}</strong></div><div class="stat"><small>Surface</small><strong>${this.format(area,0)} m²</strong></div>${lights.length?this.lightsStat(lights.length,on):nothing}</div>
      ${lights.length?html`<button class="master ${on?'on':''}" ?disabled=${this.busy||!on} @click=${()=>this.lights(floor.rooms,'turn_off',lit)}>${mpIcon('power',16)}<span>${on?'Éteindre tout le niveau':'Tout est éteint'}</span></button>`:nothing}
      <p class="lead">Touchez une pièce sur le plan ou dans la liste pour afficher ses équipements.</p>
    </section>`;
  }
  /** Every floor at a glance: the house in figures, a command for all its lights, then each floor from the top one down. */
  private houseCard(floors: SpatialFloor[]) {
    const rooms=floors.flatMap(f=>f.rooms),area=rooms.reduce((sum,r)=>sum+polygonArea(r.polygon),0),{all,on}=this.lightsOf(rooms);
    const order=floors.map((floor,index)=>({floor,index})).sort((a,b)=>b.floor.elevation-a.floor.elevation||b.index-a.index).map(({floor})=>floor);
    return html`<section class="card ${on.length?'lit':''}" aria-label="Vue d’ensemble de la maison">
      <header><span class="orb">${mpIcon('layers',24)}</span><div class="title"><small>Vue d’ensemble</small><h3>Toute la maison</h3></div></header>
      <div class="stats"><div class="stat"><small>Niveaux</small><strong>${floors.length}</strong></div><div class="stat"><small>Pièces</small><strong>${rooms.length}</strong></div><div class="stat"><small>Surface</small><strong>${this.format(area,0)} m²</strong></div>${all.length?this.lightsStat(all.length,on.length):nothing}</div>
      ${all.length?html`<button class="master ${on.length?'on':''}" ?disabled=${this.busy||!on.length} @click=${()=>this.lights(rooms,'turn_off',on)}>${mpIcon('power',16)}<span>${on.length?'Éteindre toute la maison':'Tout est éteint'}</span></button>`:nothing}
      <ul class="levels" aria-label="Niveaux">${order.map(f=>this.levelRow(f))}</ul>
      <p class="lead">Touchez un niveau sur le plan ou dans la liste pour l’ouvrir.</p>
    </section>`;
  }
  private levelRow(floor: SpatialFloor) {
    const {all,on}=this.lightsOf(floor.rooms),count=floor.rooms.length;
    const lights=!all.length?'':on.length?` · ${on.length} ${on.length>1?'lumières allumées':'lumière allumée'}`:' · lumières éteintes';
    return html`<li><button class="level ${on.length?'on':''} ${this.pointed===floor.id?'pointed':''}" title="Ouvrir ce niveau" @click=${()=>this.openFloor(floor.id)} @pointerenter=${()=>{this.pointed=floor.id;}} @pointerleave=${()=>{if(this.pointed===floor.id)this.pointed='';}}>
      <span class="dev-icon">${mpIcon(on.length?'bulb':'layers',20)}</span>
      <span class="text"><strong>${floor.name}</strong><small>${count} ${count>1?'pièces':'pièce'}${lights}</small></span>
      ${this.temperatures(floor)}${mpIcon('arrow',16)}
    </button></li>`;
  }
  private roomCard(room: SpatialRoom, floor: SpatialFloor, lit: boolean) {
    const devices=(room.entityIds??[]).map(id=>this.device(id,room));
    const lights=devices.filter(d=>d.kind==='light'),on=lights.filter(d=>d.on);
    const surface=polygonArea(room.polygon),xs=room.polygon.map(p=>p[0]),ys=room.polygon.map(p=>p[1]);
    const width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys),rectangle=Math.abs(width*depth-surface)<surface*.03;
    const temperature=this.temperature(room);
    const humidity=devices.find(d=>d.kind==='humidity'&&d.numeric!==undefined)?.numeric;
    const href=room.areaId?this.areaHref?.(room.areaId):undefined;
    const group=lights.filter(d=>d.switchable);
    return html`<section class="card ${lit?'lit':''}" aria-labelledby="room-title">
      <header><span class="orb">${mpIcon(roomIcon(room.name),26)}</span><div class="title"><small>${floor.name}</small><h3 id="room-title">${room.name}</h3></div><button class="close" aria-label="Fermer la pièce" title="Fermer" @click=${this.close}>${mpIcon('close',18)}</button></header>
      <div class="stats">
        <div class="stat"><small>Surface</small><strong>${this.format(surface)} m²</strong>${rectangle?html`<span>${this.format(width)} × ${this.format(depth)} m</span>`:nothing}</div>
        ${lights.length?this.lightsStat(lights.length,on.length):nothing}
        ${temperature===undefined?nothing:html`<div class="stat"><small>Température</small><strong title=${temperature.id}>${this.format(temperature.value)}${temperature.unit==='°C'?'°':temperature.unit}</strong></div>`}
        ${humidity===undefined?nothing:html`<div class="stat"><small>Humidité</small><strong>${this.format(humidity,0)} %</strong></div>`}
      </div>
      ${group.length>1?html`<button class="master ${on.length?'on':''}" ?disabled=${this.busy} @click=${()=>this.lights([room],on.length?'turn_off':'turn_on',(on.length?on:group).map(d=>d.id))}>${mpIcon('power',16)}<span>${on.length?'Tout éteindre':'Tout allumer'}</span></button>`:nothing}
      ${devices.length?html`<ul class="devices">${devices.map(d=>this.deviceRow(room,d))}</ul>`:html`<p class="lead">Aucun équipement associé à cette pièce. Choisissez-les dans Studio → Plan 3D.</p>`}
      ${href?html`<a class="open" href=${href}><span>Ouvrir la pièce</span>${mpIcon('arrow',16)}</a>`:nothing}
    </section>`;
  }
  private deviceRow(room: SpatialRoom, d: Device) {
    const action=d.on?'Éteindre':'Allumer';
    return html`<li class="device ${d.on?'on':''} ${d.ready?'':'offline'}" data-kind=${d.kind}>
      <button class="main" aria-label=${`Détails ${d.name}`} @click=${()=>this.moreInfo(d.id)}><span class="dev-icon">${mpIcon(KIND_ICONS[d.kind],20)}</span><span class="text"><strong>${d.name}</strong><small>${d.detail}</small></span></button>
      ${d.kind==='light'
        ? html`<button class="switch ${d.on?'on':''}" aria-label=${action} title=${`${action} ${d.name}`} ?disabled=${this.busy||!d.switchable} @click=${()=>this.toggle(room,d.id)}><span></span></button>`
        : d.value?html`<strong class="value">${d.value}</strong>`:nothing}
      ${d.on&&d.dimmable?html`<label class="dim">${mpIcon('sun',14)}<input type="range" min="1" max="100" .value=${String(d.percent??1)} aria-label=${`Luminosité ${d.name}`} ?disabled=${this.busy} @change=${(e:Event)=>this.lights([room],'turn_on',[d.id],{brightness_pct:Number((e.target as HTMLInputElement).value)})}><output>${d.percent===undefined?'—':`${d.percent} %`}</output></label>`:nothing}
      ${d.kind==='cover'?html`<div class="cover-controls">
        ${([['open_cover','Ouvrir le volet','↑'],['stop_cover','Arrêter le volet','■'],['close_cover','Fermer le volet','↓']] as const).map(([action,label,icon])=>html`<button aria-label=${`${label} ${d.name}`} ?disabled=${this.busy||!canCover(this.hass?.states[d.id],action)} @click=${()=>this.cover(room,d.id,action)}>${icon}</button>`)}
        ${canCover(this.hass?.states[d.id],'set_cover_position')?html`<label><input type="range" min="0" max="100" .value=${String(d.percent??50)} aria-label=${`Ouverture ${d.name}`} aria-valuetext=${d.percent===undefined?'Position actuelle inconnue':`${this.format(d.percent,0)} % ouvert`} ?disabled=${this.busy} @change=${(e:Event)=>this.cover(room,d.id,'set_cover_position',Number((e.target as HTMLInputElement).value))}><output>${d.percent===undefined?'—':`${this.format(d.percent,0)} %`}</output></label>`:nothing}
      </div>`:nothing}
    </li>`;
  }
}
defineElement('mp-spatial-viewer',MPSpatialViewer);
