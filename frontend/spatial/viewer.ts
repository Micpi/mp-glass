import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { Hass } from '../ha/client';
import type { HAState } from '../../shared/models';
import { available, brightnessPercent, MPCapabilityEngine } from '../../shared/capabilities';
import { alignRooms, nearestSide, openingPlacement, roomArea, roomOutline, roomSize, stackFloors, wallFrame, wallSegments, type OpeningKind, type Point, type SpatialFloor, type SpatialOpening, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { mpIcon, type MPIconName } from '../icons';
import { LanguageController, locale, tr, trText } from '../i18n';
import type { MessageKey } from '../locales';
import { defineElement } from '../registry';
import type { CameraView, LevelProjection, MediaState, OpeningState, SceneLevel, SceneMedia, SceneOpening, SpatialScene } from './scene';
import { canCover, canMedia, coverClosed, coverOpen, coverPosition, coverStyle, coverTilt, groupCover, hasOpenings, hasPlayers, hasThermometer, mediaIsTv, mediaOn, mediaPlaying, mediaVolume, nowPlaying, PLAN_COLORS, roomAmbient, roomEntityIds, roomOpen, roomPlayers, roomTemperature, temperatureColor, temperatureRange, type CoverAction, type CoverStyle, type PlanMode } from '../../shared/spatial-state';

type Kind = 'light'|'cover'|'climate'|'media'|'opening'|'motion'|'binary'|'temperature'|'humidity'|'sensor';
interface Device { id:string; kind:Kind; name:string; ready:boolean; switchable:boolean; on:boolean; detail:string; value?:string; numeric?:number; percent?:number; dimmable:boolean }
/** What a room holds besides its equipment list: doors and windows with their covers and sensors, televisions and speakers. */
const OPENING_NAMES:Record<OpeningKind,MessageKey>={door:'Porte',window:'Fenêtre',french_window:'Porte-fenêtre'};
const OPENING_ICONS:Record<OpeningKind,MPIconName>={door:'door',window:'window',french_window:'french'};
const COVER_ICONS:Record<CoverStyle,MPIconName>={outside:'shutter',inside:'shutter',curtain:'curtain'};
/** The ambiances of the plan, each offered once a room of the floors shown has something to show in it; the lights always. */
const MODES:{mode:PlanMode;label:MessageKey;icon:MPIconName;offered?:(room:SpatialRoom,states:Record<string,HAState>)=>boolean}[]=[
  {mode:'lights',label:'Lumières',icon:'bulb'},{mode:'climate',label:'Climat',icon:'thermo',offered:hasThermometer},
  {mode:'openings',label:'Ouvrants',icon:'window',offered:hasOpenings},{mode:'media',label:'Audio-vidéo',icon:'tv',offered:hasPlayers},
];
/** What the colour of a room says, in each ambiance that colours rooms otherwise than with its lights (shown through `trText`). */
const LEGENDS:Partial<Record<PlanMode,[string,string][]>>={
  climate:[['#69b7ff','< 18 °C'],['#71d7c0','18–21'],['#ffc574','21–24'],['#ff816b','≥ 24 °C']],
  openings:[[PLAN_COLORS.open,'Porte ou fenêtre ouverte'],[PLAN_COLORS.daylight,'Volets ouverts']],
  media:[[PLAN_COLORS.media,'En lecture'],[`${PLAN_COLORS.media}66`,'Allumé']],
};

const plain=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const ROOM_ICONS:[RegExp,MPIconName][]=[
  [/salon|sejour|living|lounge|salle a manger|dining|piece de vie/,'sofa'],[/cuisine|kitchen/,'kitchen'],[/chambre|bedroom|suite|parental/,'bed'],
  [/salle de bain|salle d.eau|\bsdb\b|bain|douche|bath|shower|\bwc\b|toilet/,'bath'],[/bureau|office|bibliotheque|library|study/,'desk'],
  [/entree|hall|couloir|degagement|corridor|palier|escalier|stair|landing/,'door'],[/garage|atelier|workshop/,'car'],
  [/jardin|terrasse|garden|terrace|balcon|balcony|piscine|pool|exterieur|outdoor|patio|veranda/,'leaf'],
];
const roomIcon=(name:string)=>ROOM_ICONS.find(([pattern])=>pattern.test(plain(name)))?.[1]??'rooms';
export { roomIcon };
const KIND_ICONS:Record<Kind,MPIconName>={light:'bulb',cover:'shutter',climate:'flame',media:'speaker',opening:'window',motion:'motion',binary:'gauge',temperature:'thermo',humidity:'drop',sensor:'gauge'};
export const MEDIA_STATES:Record<string,MessageKey>={playing:'Lecture',paused:'En pause',idle:'Allumé',on:'Allumé',off:'Éteint',standby:'En veille',buffering:'Chargement…'};
export const HVAC:Record<string,MessageKey>={off:'Arrêt',heat:'Chauffage',cool:'Climatisation',heat_cool:'Automatique',auto:'Automatique',dry:'Déshumidification',fan_only:'Ventilation'};
export const COVER_STATES:Record<string,MessageKey>={opening:'Ouverture…',closing:'Fermeture…',closed:'Fermé',open:'Ouvert'};
/** A state Home Assistant gives, named in the interface language when MP Nexus knows it. */
export const stateName=(names:Record<string,MessageKey>,state:string)=>{const key=names[state];return key?tr(key):state;};
/** Shutters of a floor, of the whole house or of a room: how the pair of commands names them. */
const COVER_SCOPES={
  floor:['Volets du niveau','Ouvrir tous les volets du niveau','Fermer tous les volets du niveau'],
  house:['Volets de la maison','Ouvrir tous les volets de la maison','Fermer tous les volets de la maison'],
  room:['Volets de la pièce','Ouvrir tous les volets de la pièce','Fermer tous les volets de la pièce'],
} as const satisfies Record<string,readonly [MessageKey,MessageKey,MessageKey]>;
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
  if(domain==='media_player')return 'media';
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
  static properties = { plan:{attribute:false}, hass:{attribute:false}, areaHref:{attribute:false}, preview:{type:Boolean,reflect:true}, floor:{state:true}, selected:{state:true}, error:{state:true}, walls:{state:true}, topView:{state:true}, engaged:{state:true}, busy:{state:true}, mode:{state:true}, views:{state:true}, asking:{state:true}, pointed:{state:true}, opening:{state:true}, placing:{attribute:false} };
  static styles = css`
    :host{display:block;position:relative;container-type:inline-size;min-width:0;color:#eff7ff;font:13px/1.5 var(--mp-body-font,Inter,system-ui,sans-serif);--accent:var(--mp-accent,#69b7ff);--warm:#ffd35a;--line:rgba(214,236,255,.14)}
    *{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}button:disabled{opacity:.45;cursor:default}
    button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #a2d7ff;outline-offset:2px}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .layout{display:grid;gap:12px;align-items:start}.stage-col,.side{display:grid;gap:12px;min-width:0;align-content:start}
    .stage{position:relative;height:var(--mp-stage-height,clamp(300px,min(62cqw,72vh),620px));overflow:hidden;border-radius:var(--mp-radius,22px);background:radial-gradient(ellipse 65% 55% at 50% 60%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 72%),linear-gradient(180deg,rgba(3,16,29,.58),rgba(3,16,29,.82));border:1px solid rgba(214,236,255,.1);box-shadow:inset 0 1px rgba(255,255,255,.07),0 24px 60px rgba(0,8,18,.18)}
    /* Every floor at once needs more height on a phone. */
    :host([stacked]) .stage{height:var(--mp-stage-height,max(clamp(360px,min(62cqw,72vh),620px),min(calc(var(--floors,3) * 60px + 150px),80vh)))}
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
    .readings{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1px 8px;font-size:11.5px;font-weight:600;color:#cce3f2;font-variant-numeric:tabular-nums}
    .reading{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.reading.temp{color:var(--tone)}
    /* On the selected label's blue, every temperature colour keeps a dark ground. */
    .labels button[aria-pressed=true] .reading.temp{margin:0 -2px;padding:0 6px;border-radius:99px;background:rgba(3,16,29,.5)}
    .shutter{display:inline-block;position:relative;width:12px;height:13px;border:1px solid currentColor;border-radius:2px;background:transparent;overflow:hidden;flex:none}
    .shutter::before{content:'';position:absolute;inset:0 0 auto;height:var(--closed,100%);background:repeating-linear-gradient(0deg,currentColor 0 1px,transparent 1px 3px);transition:height .3s}
    .shutter.unknown{opacity:.45}.shutter.unknown::before{background:none}.shutter.unknown::after{content:'?';position:absolute;inset:0;text-align:center;font:9px/11px system-ui}
    .modes{position:absolute;left:12px;bottom:12px;z-index:2;display:flex;gap:3px;padding:3px;border-radius:13px}
    .modes button{display:flex;align-items:center;gap:6px;border:0;border-radius:10px;background:transparent;padding:7px 10px;min-height:34px;color:#bed4e4;font-size:12px}
    .modes button[aria-pressed=true]{background:#74b9eb30;color:#fff}
    /* Three ambiances or more on a phone: the one shown keeps its name, the others their icon. */
    @container (max-width:479px){.modes.many button:not([aria-pressed=true]){padding:7px 9px}.modes.many button:not([aria-pressed=true]) .label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
    .legend{position:absolute;bottom:62px;left:12px;right:62px;color:#cde0eb;font-size:10px;pointer-events:none}
    .legend b{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.legend span{margin-right:8px;white-space:nowrap}
    .cover-controls{grid-column:1/-1;display:flex;gap:6px;align-items:center;padding:4px 8px 8px}.cover-controls button{border:1px solid var(--line);border-radius:9px;background:#14354d;min-width:38px;min-height:36px}
    .cover-controls label{flex:1;min-width:0;display:flex;align-items:center;gap:8px}.cover-controls output{font-size:11px;white-space:nowrap}
    .labels i{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:var(--warm);box-shadow:0 0 10px #ffc53d}
    /* A door or a window open, and what plays in the room. */
    .reading.ajar{color:#8ff0c8}.reading.media,.reading.player{max-width:124px;color:#dccfff}.reading.player{color:#b9c8d8}.reading.media span,.reading.player span{overflow:hidden;text-overflow:ellipsis}
    /* Studio: the next tap on the plan places a door, a window, a television or a speaker. */
    .picking{position:absolute;left:50%;bottom:12px;z-index:3;display:flex;align-items:center;gap:10px;max-width:calc(100% - 24px);padding:5px 5px 5px 14px;transform:translateX(-50%);border-radius:999px;font-size:12px;color:#eef7ff;border-color:color-mix(in srgb,var(--accent) 60%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent),0 10px 28px rgba(0,8,18,.35)}
    .picking span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.picking button{flex:none;min-height:32px;padding:0 13px;border-radius:999px;border:1px solid var(--line);background:rgba(11,37,61,.85)}
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
    .devices{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
    .device{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;padding:4px 6px 4px 4px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(214,236,255,.08);transition:background .25s,border-color .25s}
    .device.on{background:linear-gradient(145deg,rgba(255,205,80,.1),rgba(255,255,255,.03));border-color:rgba(255,220,130,.22)}.device.offline{opacity:.6}
    .main{display:flex;align-items:center;gap:11px;min-width:0;min-height:50px;padding:4px 6px;border:0;border-radius:12px;background:transparent;text-align:left}.main:hover{background:rgba(255,255,255,.045)}
    .dev-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:12px;color:#cfe0f0;background:rgba(197,220,243,.08);border:1px solid rgba(220,237,255,.1);transition:.25s ease}
    /* One column as wide as the card: a long floor name or reading is cut short rather than widening the list past the card. */
    .levels{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
    .level{display:flex;align-items:center;gap:11px;width:100%;min-height:56px;padding:6px 12px 6px 6px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(214,236,255,.08);text-align:left;transition:background .25s,border-color .25s}
    .level:hover,.level.pointed{background:rgba(255,255,255,.07);border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
    .level.on{background:linear-gradient(145deg,rgba(255,205,80,.1),rgba(255,255,255,.03));border-color:rgba(255,220,130,.22)}
    .level .text{flex:1}.level .text small{white-space:normal}.level>.mp-icon{color:#9fb6cb}
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
    .section-title{margin:16px 2px 0;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9fb6cb}.section-title+.devices{margin-top:8px}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    .pair button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:42px;border-radius:14px;border:1px solid rgba(202,228,255,.18);background:rgba(8,29,48,.45);font-weight:600;color:#dae7f3}.pair button:hover:not(:disabled){border-color:color-mix(in srgb,var(--accent) 55%,transparent);background:rgba(20,53,77,.6)}
    /* A door or a window: open in green, its shutters, blinds and curtains below it, each with its commands. */
    .state{flex:none;margin-right:6px;padding:3px 10px;border-radius:99px;border:1px solid rgba(214,236,255,.16);font-size:11.5px;font-weight:600;color:#cfe0ef;white-space:nowrap}
    .state.ajar{color:#8ff0c8;border-color:rgba(143,240,200,.4);background:rgba(143,240,200,.08)}
    .device.opening.ajar{background:linear-gradient(145deg,rgba(143,240,200,.08),rgba(255,255,255,.03));border-color:rgba(143,240,200,.3)}
    .device.opening.ajar .dev-icon{color:#8ff0c8;background:rgba(143,240,200,.1);border-color:rgba(143,240,200,.35);box-shadow:0 0 18px rgba(143,240,200,.18)}
    .cover-line{grid-column:1/-1;display:flex;align-items:center;gap:7px;min-width:0;margin:2px 8px 0 14px;font-size:11.5px;color:#cfe0ef}
    .cover-line span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cover-line small{margin-left:auto;padding-left:6px;color:#a9bdd0;white-space:nowrap}
    /* A television or a speaker: its commands under it while it is on. */
    .device[data-kind=media].on{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 12%,transparent),rgba(255,255,255,.03));border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
    .device[data-kind=media].on .dev-icon{color:#fff;background:color-mix(in srgb,var(--accent) 28%,transparent);border-color:color-mix(in srgb,var(--accent) 50%,transparent);box-shadow:0 0 18px color-mix(in srgb,var(--accent) 28%,transparent)}
    .switch.media.on span{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 70%,white),var(--accent));border-color:color-mix(in srgb,var(--accent) 60%,white);box-shadow:0 0 16px color-mix(in srgb,var(--accent) 45%,transparent)}
    .media-controls{grid-column:1/-1;display:grid;gap:8px;padding:2px 8px 8px 14px}
    .transport{display:flex;align-items:center;gap:6px}.transport button{display:grid;place-items:center;min-width:42px;min-height:38px;padding:0;border-radius:11px;border:1px solid var(--line);background:#14354d}
    .transport button.play{min-width:52px;background:color-mix(in srgb,var(--accent) 38%,#14354d);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
    .volume{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;font-size:11px;color:#dfe9f3}.volume output{min-width:36px;text-align:right}
    .volume button{display:grid;place-items:center;width:36px;height:36px;padding:0;border-radius:10px;border:1px solid var(--line);background:transparent}.volume button[aria-pressed=true]{color:#ffbda9;border-color:#ffbda966}
    .volume input[type=range]::-webkit-slider-runnable-track{background:linear-gradient(90deg,var(--accent),rgba(206,226,246,.2))}.volume input[type=range]::-webkit-slider-thumb{border-color:var(--accent)}
    .volume input[type=range]::-moz-range-progress{background:var(--accent)}.volume input[type=range]::-moz-range-thumb{border-color:var(--accent)}
    .media-controls label.source{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;font-size:11px;color:#a9bdd0}
    .media-controls select{min-width:0;min-height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--line);background:#0e2a42;color:#eef7ff;font:inherit}
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
  /** Studio: while set, the next tap on the plan places a door, a window, a television or a speaker in this room. */
  placing?: {floorId:string;roomId:string;prompt:string};
  /** Room to bring into view once the plan is drawn. */
  private focusAfter = '';
  /** What the scene draws: its floors and their walls (a change frames the house again), and what stands in its walls and rooms. */
  private drawnGeometry = '';
  private drawnContent = '';
  /** Ambiance and floors last told to the page, so the section below the plan follows them. */
  private announced = '';
  private get temperatureUnit(){return this.hass?.config?.unit_system?.temperature??'°C';}
  private temperature(room:SpatialRoom){return roomTemperature(room,this.hass?.states??{},this.temperatureUnit);}
  /** The ambiances the floors shown can offer: no climate without a room that measures its temperature, and so on. */
  private modes(floors:SpatialFloor[]){const states=this.hass?.states??{};return MODES.filter(m=>!m.offered||floors.some(f=>f.rooms.some(r=>m.offered!(r,states))));}
  private planMode(floors:SpatialFloor[]):PlanMode{return this.modes(floors).some(m=>m.mode===this.mode)?this.mode:'lights';}
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
  private language = new LanguageController(this);
  connectedCallback() { super.connectedCallback(); this.resize.observe(this); this.views=readViews(); addEventListener('keydown',this.escape); this.requestUpdate(); }
  disconnectedCallback() { super.disconnectedCallback(); this.resize.disconnect(); removeEventListener('keydown',this.escape); clearTimeout(this.hold); this.asking=false; this.scene?.dispose(); this.scene=undefined; }
  protected willUpdate(changed: PropertyValues) {
    // Placing something in a room: that room, on its own floor, comes into view.
    const placing=this.placing;
    if(changed.has('placing')&&placing&&this.plan?.floors.find(f=>f.id===placing.floorId)?.rooms.some(r=>r.id===placing.roomId)){
      if(this.stacked||this.currentFloor?.id!==placing.floorId){this.flight++;this.floor=placing.floorId;this.opening='';this.pointed='';this.topView=false;}
      this.selected=placing.roomId;this.focusAfter=placing.roomId;this.engaged=true;
    }
    this.toggleAttribute('stacked', this.stacked);
    // Every floor at once needs room for each label beside it, one above the other.
    this.style.setProperty('--floors', String(this.plan?.floors.length ?? 1));
  }
  private escape=(e:KeyboardEvent)=>{ if(e.key==='Escape'&&this.placing){ e.preventDefault(); this.cancelPick(); } };
  /** The point touched while placing, told to the Studio with the room it is for. */
  private picked=(point:Point,room:string)=>{
    const placing=this.placing;
    if(placing) this.dispatchEvent(new CustomEvent('plan-pick',{detail:{floorId:placing.floorId,roomId:placing.roomId,point,room}}));
  };
  private cancelPick=()=>{ this.dispatchEvent(new CustomEvent('plan-pick-cancel')); };
  /** The floors on screen and the outlines of their rooms: when these change, the house is framed again. */
  private geometry() {
    return JSON.stringify([this.stacked?'':this.currentFloor?.id,this.shownFloors.map(f=>[f.id,f.elevation,f.height,f.rooms.map(r=>[r.id,r.polygon,r.arcs])])]);
  }
  /** Doors, windows and players of the floors on screen, and how their covers hang: a change draws them again, the camera staying put. */
  private content() {
    const states=this.hass?.states??{};
    return JSON.stringify(this.shownFloors.map(f=>f.rooms.map(r=>[r.openings,r.media,(r.openings??[]).flatMap(o=>o.entityIds??[]).map(id=>states[id]?.attributes.device_class)])));
  }
  protected async updated(changed: PropertyValues) {
    this.edges();
    const ask=this.renderRoot.querySelector<HTMLDialogElement>('dialog.ask');
    if(ask&&this.asking&&!ask.open)ask.showModal();else if(ask&&!this.asking&&ask.open)ask.close();
    if (!this.plan || !this.currentFloor) return;
    // The ambiance chosen and the floors on screen, told to the page: the section below the plan arranges itself on them.
    if(!this.preview){
      const detail={mode:this.planMode(this.shownFloors),floorIds:this.shownFloors.map(f=>f.id)};
      const key=JSON.stringify([detail.mode,detail.floorIds]);
      if(key!==this.announced){this.announced=key;this.dispatchEvent(new CustomEvent('plan-ambiance',{detail}));}
    }
    if (!this.scene && !this.loading && !this.error) {
      this.loading=true;
      try {
        const {SpatialScene}=await import('./scene');
        const host=this.renderRoot.querySelector<HTMLElement>('.canvas');
        if (!this.isConnected || !host || !this.currentFloor) return;
        this.scene=new SpatialScene(host, (room,floor)=>this.touch(room,floor), (rooms,levels)=>this.place(rooms,levels), ()=>{this.engaged=true;}, floor=>{this.pointed=floor;});
        this.draw();
      } catch { this.error=tr('La 3D nécessite WebGL 2. Les pièces et leurs équipements restent accessibles dans la liste.'); }
      finally { this.loading=false; }
    } else if (this.scene && (changed.has('plan') || changed.has('floor') || changed.has('walls') || this.geometry()!==this.drawnGeometry || this.content()!==this.drawnContent)) {
      // An edit that leaves the outlines as they were (a name, a link, a window placed) keeps the camera where it is.
      this.draw(!changed.has('walls')&&(changed.has('floor')||this.geometry()!==this.drawnGeometry), changed.get('floor') as string|undefined);
    }
    if(this.scene) this.scene.picking=this.placing?this.picked:undefined;
    if(this.scene&&this.focusAfter&&this.currentFloor){ this.scene.focus(this.focusAfter); this.focusAfter=''; }
    if(this.scene&&this.currentFloor){
      const floors=this.shownFloors,mode=this.planMode(floors),states=this.hass?.states??{};
      const rooms=floors.flatMap(f=>f.rooms.map(r=>[this.roomKey(f,r),r] as const));
      const styled=this.scene.highlight(this.room?.id??'',new Map(rooms.map(([key,r])=>[key,roomAmbient(r,states,mode,this.temperatureUnit)])),this.stacked?this.opening||this.pointed:'');
      const fixtures=this.scene.fixtures(...this.fixtureStates(floors));
      // Labels change size when sensor values or the mode changes, even if the camera stays still.
      const previous=changed.get('hass') as Hass|undefined;
      const readings=changed.has('hass')&&rooms.some(([,r])=>r.entityIds?.some(id=>previous?.states[id]!==this.hass?.states[id]));
      if(styled||fixtures||readings||changed.has('mode')||changed.has('plan')||changed.has('floor'))this.scene.render();
    }
  }
  /**
   * The floor as drawn: neighbouring rooms brought onto the wall they share (the saved plan is unchanged). Every floor of the
   * house when none is chosen, apart from each other; coming back from the floor `from`, the camera draws back from it.
   */
  private draw(reset=true, from?: string) {
    // Curved walls are drawn as the walls follow them; the floors and their halos take the same outline, kept short enough for the GPU.
    const level=(floor:SpatialFloor):SceneLevel=>{
      const aligned=alignRooms(floor.rooms),rooms=aligned.map(r=>({...r,id:this.roomKey(floor,r)}));
      const drawn=rooms.map(({arcs:_,...room})=>({...room,polygon:roomOutline(rooms.find(r=>r.id===room.id)!,64)}));
      // Doors and windows are placed on the room as saved, then onto its wall as drawn.
      const openings=floor.rooms.flatMap((room,i)=>this.sceneOpenings(floor,room,roomOutline(aligned[i]!)));
      const media=floor.rooms.flatMap(room=>this.sceneMedia(floor,room));
      return {floor:{...floor,rooms:drawn},segments:wallSegments(rooms),openings,media};
    };
    if(!this.scene||!this.currentFloor) return;
    this.drawnGeometry=this.geometry();this.drawnContent=this.content();
    this.scene.setFloors((this.stacked?stackFloors(this.plan!.floors):[this.currentFloor]).map(level), this.walls, reset, this.topView);
    // The plan opens on the view saved for this floor, the one Recentrer brings back.
    const view=reset&&!this.preview?this.views[this.viewKey]:undefined;
    if(view){this.topView=view.top;this.scene.show(view);}
    else if(reset&&from&&this.stacked)this.scene.rise(from);
  }
  private openingKey(floor: SpatialFloor, room: SpatialRoom, opening: SpatialOpening) { return `${this.roomKey(floor,room)}|opening|${opening.id}`; }
  private mediaKey(floor: SpatialFloor, room: SpatialRoom, id: string) { return `${this.roomKey(floor,room)}|media|${id}`; }
  /** The doors and windows of a room, on the walls of `ring`, its outline as drawn; its covers with the way each one hangs. */
  private sceneOpenings(floor: SpatialFloor, room: SpatialRoom, ring: Point[]): SceneOpening[] {
    const states=this.hass?.states??{};
    return (room.openings??[]).flatMap(opening=>{
      const placed=openingPlacement(room,opening);
      if(!placed) return [];
      const near=nearestSide({polygon:ring},placed.center),a=ring[near.side]!,b=ring[(near.side+1)%ring.length]!;
      const center:Point=near.distance<.35?[a[0]+(b[0]-a[0])*near.t,a[1]+(b[1]-a[1])*near.t]:placed.center;
      const covers=(opening.entityIds??[]).filter(id=>id.startsWith('cover.')).map(id=>({id,style:coverStyle(states[id])}));
      return [{key:this.openingKey(floor,room,opening),room:this.roomKey(floor,room),kind:opening.kind,center,tangent:placed.tangent,inward:placed.inward,width:placed.width,height:placed.height,sill:placed.sill,covers}];
    });
  }
  /** Televisions and speakers of a room; a television faces the room from its nearest wall. */
  private sceneMedia(floor: SpatialFloor, room: SpatialRoom): SceneMedia[] {
    return (room.media??[]).map(item=>{
      const near=nearestSide(room,item.at);
      return {key:this.mediaKey(floor,room,item.id),room:this.roomKey(floor,room),kind:item.kind,at:item.at,facing:wallFrame(room,near.side,near.t).inward};
    });
  }
  /** How the doors, windows and players of `floors` are now: open or closed, covers up or down, players off, on or playing. */
  private fixtureStates(floors: SpatialFloor[]): [Map<string,OpeningState>,Map<string,MediaState>] {
    const states=this.hass?.states??{},openings=new Map<string,OpeningState>(),media=new Map<string,MediaState>();
    for(const floor of floors)for(const room of floor.rooms){
      for(const opening of room.openings??[]){
        const ids=opening.entityIds??[];
        openings.set(this.openingKey(floor,room,opening),{open:this.isOpen(opening),covers:Object.fromEntries(ids.filter(id=>id.startsWith('cover.')).map(id=>[id,coverClosed(states[id])]))});
      }
      for(const item of room.media??[]){
        const state=item.entityId?states[item.entityId]:undefined;
        media.set(this.mediaKey(floor,room,item.id),{on:mediaOn(state),playing:mediaPlaying(state)});
      }
    }
    return [openings,media];
  }
  /** A door or a window is open when one of its contact sensors says so. */
  private isOpen(opening: SpatialOpening) {
    return (opening.entityIds??[]).some(id=>id.startsWith('binary_sensor.')&&this.hass?.states[id]?.state==='on');
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
    // There, the floors stand between the tabs of the floors (and the hint) above and the ambiances below, where their labels can be read.
    const [top,bottom]=aside.length?this.bands(frame):[0,0];
    if(this.scene?.reserve(aside.length?Math.max(...aside)+2*LABEL_GAP:0,aside.length?rail+LABEL_GAP:0,top,bottom)) return;
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
  /** Height the controls take at the top of the stage (tabs of the floors, hint) and at its bottom (ambiances and their legend). */
  private bands(frame: DOMRect): [number,number] {
    const boxes=(selector:string)=>Array.from(this.renderRoot.querySelectorAll<HTMLElement>(selector)).filter(el=>!el.hidden&&el.offsetParent).map(el=>el.getBoundingClientRect());
    const top=Math.max(0,...boxes('.floors,.hint').map(r=>r.bottom-frame.top+LABEL_GAP));
    const bottom=Math.max(0,...boxes('.modes,.legend').map(r=>frame.bottom-r.top+LABEL_GAP));
    return [top,bottom];
  }
  /**
   * A floor's label stands beside the floor, on its left, else on its right. When neither side has room (a phone), it keeps to
   * the edge with more room, over the floor. Labels never cover one another nor the controls above and below the house.
   */
  private placeLevels(levels: LevelProjection, frame: DOMRect, occupied: {left:number;right:number;top:number;bottom:number}[]) {
    type Box=(typeof occupied)[number];
    const overlap=(a:Box,b:Box)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const labels=Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-floor]')).flatMap(label=>{
      const position=levels.get(label.dataset.floor!);
      return position?[{label,position,width:label.offsetWidth,height:label.offsetHeight,x:0,y:position.y}]:[];
    }).sort((a,b)=>a.position.y-b.position.y);
    for(const l of labels){
      const half=l.width/2+3,box=(x:number):Box=>({left:x-half,right:x+half,top:l.y-l.height/2-3,bottom:l.y+l.height/2+3});
      const left=l.position.left-LABEL_GAP-l.width/2,right=l.position.right+LABEL_GAP+l.width/2;
      l.x=[left,right].find(x=>x-half>=0&&x+half<=frame.width&&!occupied.some(o=>overlap(box(x),o)))
        ??Math.min(Math.max(l.position.left>frame.width-l.position.right?left:right,half),frame.width-half);
    }
    // One above the other in the order of the floors, each as near its floor as the others let it, between the controls above and below.
    const [top,bottom]=this.bands(frame),space=6,gap=(a:typeof labels[number],b:typeof labels[number])=>(a.height+b.height)/2+space;
    const down=()=>{for(let i=1;i<labels.length;i++)labels[i]!.y=Math.max(labels[i]!.y,labels[i-1]!.y+gap(labels[i-1]!,labels[i]!));};
    const up=()=>{for(let i=labels.length-2;i>=0;i--)labels[i]!.y=Math.min(labels[i]!.y,labels[i+1]!.y-gap(labels[i]!,labels[i+1]!));};
    const first=labels[0],last=labels.at(-1);
    if(first)first.y=Math.max(first.y,top+first.height/2);
    down();
    if(last&&last.y+last.height/2>frame.height-bottom){last.y=frame.height-bottom-last.height/2;up();}
    // Too many to fit between the controls: the top one stays under those above, the others follow it down.
    if(first&&first.y-first.height/2<top){first.y=top+first.height/2;down();}
    for(const l of labels){
      l.label.style.left=`${l.x}px`;l.label.style.top=`${l.y}px`;
      l.label.style.visibility=l.position.visible&&l.y-l.height/2>=0&&l.y+l.height/2<=frame.height?'visible':'hidden';
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
      <h3 id="ask-title">${tr('Enregistrer cette vue ?')}</h3>
      <p>${this.stacked?tr('La maison telle qu’elle est cadrée en ce moment — angle, zoom, position — devient la vue de tous les niveaux : le plan s’ouvrira dessus et le bouton Recentrer la rappellera.'):tr('La maison telle qu’elle est cadrée en ce moment — angle, zoom, position — devient la vue de ce niveau : le plan s’ouvrira dessus et le bouton Recentrer la rappellera.')}</p>
      <p>${saved?`${tr('Elle remplace la vue déjà enregistrée.')} `:''}${tr('Cette vue n’est gardée que dans ce navigateur.')}</p>
      ${saved?html`<button class="forget" @click=${this.forgetView}>${tr('Oublier la vue enregistrée')}</button>`:nothing}
      <div class="ask-actions">
        <button @click=${()=>{this.asking=false;}}>${tr('Annuler')}</button>
        <button class="primary" autofocus @click=${this.saveView}>${tr('Enregistrer')}</button>
      </div>
    </dialog>`;
  }
  private format(value: number, digits=1) { return new Intl.NumberFormat(locale(),{maximumFractionDigits:digits}).format(value); }
  private device(id: string, room: SpatialRoom): Device {
    const state=this.hass?.states[id],kind=kindOf(id,state),ready=available(state),on=ready&&state!.state==='on';
    const name=shorten(String(state?.attributes.friendly_name??id),room.name),unit=String(state?.attributes.unit_of_measurement??'');
    const base={id,kind,name,ready,switchable:false,on,dimmable:false};
    if(!ready) return {...base,detail:tr('Indisponible')};
    switch(kind){
      case 'light': return {...base,switchable:['on','off'].includes(state!.state),detail:on?tr('Allumée'):tr('Éteinte'),percent:brightnessPercent(state!.attributes.brightness),dimmable:MPCapabilityEngine.detect(id,state).some(b=>b.capability==='DIM')};
      case 'cover': {
        const percent=coverPosition(state),detail=stateName(COVER_STATES,state!.state);
        return {...base,on:false,percent,value:percent===undefined?undefined:tr('{n} %',{n:this.format(percent,0)}),detail:percent===undefined?tr('{state} · position inconnue',{state:detail}):tr('{state} · {n} % ouvert',{state:detail,n:this.format(percent,0)})};
      }
      case 'climate': {
        const current=numeric(state!.attributes.current_temperature),target=numeric(state!.attributes.temperature);
        return {...base,on:state!.state!=='off',numeric:current,value:current===undefined?undefined:`${this.format(current)} °`,detail:target===undefined?stateName(HVAC,state!.state):tr('{mode} · consigne {n} °',{mode:stateName(HVAC,state!.state),n:this.format(target)})};
      }
      case 'media': {
        const label=stateName(MEDIA_STATES,state!.state),playing=nowPlaying(state);
        return {...base,on:mediaOn(state),switchable:canMedia(state,'turn_on')||canMedia(state,'turn_off'),percent:mediaVolume(state),detail:playing&&['playing','paused'].includes(state!.state)?`${label} · ${playing}`:label};
      }
      case 'opening': return {...base,detail:on?tr('Ouvert'):tr('Fermé')};
      case 'motion': return {...base,detail:on?tr('Présence détectée'):tr('Aucune présence')};
      case 'binary': return {...base,detail:on?tr('Actif'):tr('Inactif')};
      default: {
        const value=numeric(state!.state),label=kind==='temperature'?tr('Température'):kind==='humidity'?tr('Humidité'):tr('Capteur');
        return {...base,on:false,numeric:value,value:value===undefined?state!.state:`${this.format(value)}${unit?` ${unit}`:''}`,detail:this.since(state!)??(plain(name).includes(plain(label))?tr('Capteur'):label)};
      }
    }
  }
  private since(state: HAState) {
    const at=Date.parse(state.last_changed??''),minutes=Math.round((Date.now()-at)/60_000);
    if(!Number.isFinite(minutes)||minutes<0) return undefined;
    if(minutes<1) return tr('Mis à jour à l’instant');
    const relative=new Intl.RelativeTimeFormat(locale(),{numeric:'auto'});
    return tr('Mis à jour {when}',{when:minutes<60?relative.format(-minutes,'minute'):minutes<1440?relative.format(-Math.round(minutes/60),'hour'):relative.format(-Math.round(minutes/1440),'day')});
  }
  /** Only lights placed in the rooms given (one room, or every room of a floor) can be switched from the plan. */
  private async lights(rooms: SpatialRoom[], service: 'turn_on'|'turn_off', ids: string[], data: Record<string,unknown> = {}) {
    const allowed=[...new Set(ids)].filter(id=>id.startsWith('light.')&&rooms.some(r=>r.entityIds?.includes(id))&&available(this.hass?.states[id]));
    if(!this.hass || this.busy || !allowed.length) return;
    this.busy=true; this.error='';
    try { await this.hass.callService('light',service,{...data,entity_id:allowed.length===1?allowed[0]:allowed}); }
    catch { this.error=tr('Commande refusée ou équipement indisponible.'); }
    finally { this.busy=false; }
  }
  private toggle(room: SpatialRoom, id: string) {
    const state=this.hass?.states[id]?.state;
    if(state==='on'||state==='off') void this.lights([room],state==='on'?'turn_off':'turn_on',[id]);
  }
  private moreInfo(entityId: string) { this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId},bubbles:true,composed:true})); }
  /** Everything a room lets the plan command: its equipment, what is linked to its doors and windows, its televisions and speakers. */
  private roomEntities(room: SpatialRoom) { return new Set(roomEntityIds(room)); }
  private async cover(room:SpatialRoom,id:string,action:CoverAction,position?:number){
    if(!this.hass||this.busy||!id.startsWith('cover.')||!this.roomEntities(room).has(id)||!canCover(this.hass.states[id],action))return;
    const positioned=action==='set_cover_position'||action==='set_cover_tilt_position';
    if(positioned&&(position===undefined||!Number.isFinite(position)||position<0||position>100))return;
    this.busy=true;this.error='';
    try{await this.hass.callService('cover',action,{entity_id:id,...(action==='set_cover_position'?{position}:action==='set_cover_tilt_position'?{tilt_position:position}:{})});}
    catch{this.error=tr('Commande du volet refusée ou équipement indisponible.');}
    finally{this.busy=false;}
  }
  /** Shutters, blinds and curtains of `rooms`, each once: those that move together, never a garage door or a gate. */
  private groupCovers(rooms: SpatialRoom[]) {
    const states=this.hass?.states??{};
    return [...new Set(rooms.flatMap(r=>[...this.roomEntities(r)].filter(id=>id.startsWith('cover.'))))].filter(id=>!!states[id]&&groupCover(states[id]));
  }
  /** Opens or closes the covers `ids` of `rooms` in one command. */
  private async covers(rooms: SpatialRoom[], action: 'open_cover'|'close_cover', ids: string[]) {
    const allowed=ids.filter(id=>rooms.some(r=>this.roomEntities(r).has(id))&&canCover(this.hass?.states[id],action));
    if(!this.hass||this.busy||!allowed.length) return;
    this.busy=true;this.error='';
    try{await this.hass.callService('cover',action,{entity_id:allowed.length===1?allowed[0]:allowed});}
    catch{this.error=tr('Commande des volets refusée ou équipement indisponible.');}
    finally{this.busy=false;}
  }
  /** Home Assistant feature each media command needs. */
  private static MEDIA_SERVICES:Record<string,Parameters<typeof canMedia>[1]>={turn_on:'turn_on',turn_off:'turn_off',media_play:'play',media_pause:'pause',media_previous_track:'previous_track',media_next_track:'next_track',volume_set:'volume_set',volume_mute:'volume_mute',select_source:'select_source'};
  private async media(room: SpatialRoom, id: string, service: string, data: Record<string,unknown> = {}) {
    const feature=MPSpatialViewer.MEDIA_SERVICES[service];
    if(!this.hass||this.busy||!feature||!id.startsWith('media_player.')||!this.roomEntities(room).has(id)||!canMedia(this.hass.states[id],feature))return;
    this.busy=true;this.error='';
    try{await this.hass.callService('media_player',service,{entity_id:id,...data});}
    catch{this.error=tr('Commande refusée ou lecteur indisponible.');}
    finally{this.busy=false;}
  }
  /**
   * Under a room's name, what its ambiance reads. Climat: its temperature, only when it has a thermometer (— while it is offline).
   * Ouvrants: a door or a window open, and its shutters, those of its doors and windows included. Audio-vidéo: what its television
   * or its speakers play, else whether one is on. Lumières reads nothing: a warm dot beside the name says a light is on.
   */
  private planReadings(room:SpatialRoom,mode:PlanMode){
    const states=this.hass?.states??{};
    if(mode==='climate'){
      const temperature=this.temperature(room);
      if(!temperature&&!hasThermometer(room,states))return nothing;
      return html`<span class="readings"><span class="reading temp" style=${`--tone:${temperature?temperatureColor(temperature.celsius):'#a8bdca'}`} title=${temperature?tr('Température · {id}',{id:temperature.id}):tr('Température indisponible')}>${mpIcon('thermo',12)}${temperature?`${this.format(temperature.value)} ${temperature.unit}`:'—'}</span></span>`;
    }
    if(mode==='openings'){
      const open=roomOpen(room,states),covers=[...this.roomEntities(room)].filter(id=>id.startsWith('cover.'));
      if(!open.length&&!covers.length)return nothing;
      return html`<span class="readings">
        ${open.length?html`<span class="reading ajar" title=${open.map(id=>String(states[id]?.attributes.friendly_name??id)).join(', ')}>${mpIcon('window',12)}<span>${open.length>1?tr('{n} ouvertes',{n:open.length}):tr('Ouverte')}</span></span>`:nothing}
        ${covers.map(id=>{const state=states[id],position=coverPosition(state),name=String(state?.attributes.friendly_name??id);return html`<span class="reading" title=${`${name} · ${!available(state)?tr('Indisponible'):position===undefined?tr('Position inconnue'):tr('{n} % ouvert',{n:this.format(position,0)})}`}><span class="shutter ${position===undefined?'unknown':''}" style=${`--closed:${100-(position??0)}%`} aria-hidden="true"></span><span>${position===undefined?'—':tr('{n} %',{n:this.format(position,0)})}</span></span>`;})}
      </span>`;
    }
    if(mode==='media'){
      const players=roomPlayers(room,states),player=players.find(id=>mediaPlaying(states[id]))??players.find(id=>mediaOn(states[id]));
      if(!player)return nothing;
      const state=states[player]!,playing=mediaPlaying(state),what=nowPlaying(state),text=playing?what??tr('Lecture'):stateName(MEDIA_STATES,state.state);
      return html`<span class="readings"><span class=${`reading ${playing?'media':'player'}`} title=${`${String(state.attributes.friendly_name??player)} · ${playing?text:what?`${text} · ${what}`:text}`}>${mpIcon(mediaIsTv(state)?'tv':'speaker',12)}<span>${text}</span></span></span>`;
    }
    return nothing;
  }
  /** A room on the plan: its name, a warm dot while a light is on, and its readings. */
  private planLabel(room:SpatialRoom,lit:boolean,mode:PlanMode){
    const readings=this.preview?nothing:this.planReadings(room,mode);
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
    if(!range) return floor.rooms.some(r=>hasThermometer(r,this.hass?.states??{}))?html`<span class="temps" title=${tr('Température indisponible')}>${mpIcon('thermo',12)}—</span>`:nothing;
    const {low,high}=range,value=(t:typeof low)=>html`<span style=${`color:${temperatureColor(t.celsius)}`}>${this.format(t.value)}</span>`;
    return html`<span class="temps" title=${tr('Température des pièces du niveau')}>${mpIcon('thermo',12)}<span>${value(low)}${this.format(low.value)===this.format(high.value)&&low.unit===high.unit?nothing:html`–${value(high)}`} ${high.unit}</span></span>`;
  }
  /** Doors and windows of a floor standing open, and how many of its shutters let daylight in; everything closed said once. */
  private levelOpenings(floor: SpatialFloor) {
    const states=this.hass?.states??{},rooms=floor.rooms;
    const open=[...new Set(rooms.flatMap(r=>roomOpen(r,states)))].length,covers=this.groupCovers(rooms),up=covers.filter(id=>coverOpen(states[id])).length;
    if(!rooms.some(r=>hasOpenings(r,states))) return nothing;
    if(!open&&!up) return html`<span class="reading">${tr('Tout est fermé')}</span>`;
    return html`${open?html`<span class="reading ajar">${mpIcon('window',12)}<span>${tr('{n} ouverte|{n} ouvertes',{n:open})}</span></span>`:nothing}${up?html`<span class="reading" title=${tr('Volets ouverts')}>${mpIcon('shutter',12)}<span>${up} / ${covers.length}</span></span>`:nothing}`;
  }
  /** Televisions and speakers of a floor playing, else those on. */
  private levelMedia(floor: SpatialFloor) {
    const states=this.hass?.states??{},players=[...new Set(floor.rooms.flatMap(r=>roomPlayers(r,states)))].map(id=>states[id]);
    if(!players.length) return nothing;
    const playing=players.filter(mediaPlaying).length,on=players.filter(mediaOn).length;
    return html`<span class=${`reading ${playing?'media':''}`}>${playing?html`${mpIcon('play',12)}<span>${tr('{n} en lecture',{n:playing})}</span>`:on?tr('{n} allumé|{n} allumés',{n:on}):tr('Tout est éteint')}</span>`;
  }
  /** A floor of the whole house on the plan: its name, a warm dot while a light is on, and what its ambiance reads. */
  private levelLabel(floor: SpatialFloor, mode: PlanMode) {
    const {all,on}=this.lightsOf(floor.rooms);
    const readings=mode==='climate'?this.temperatures(floor):mode==='openings'?this.levelOpenings(floor):mode==='media'?this.levelMedia(floor)
      :all.length?html`<span class="reading">${on.length?tr('{n} lumière allumée|{n} lumières allumées',{n:on.length}):tr('Tout est éteint')}</span>`:nothing;
    return html`<button class="${readings===nothing?'':'rich'} ${this.pointed===floor.id||this.opening===floor.id?'pointed':''}" style="visibility:hidden" data-floor=${floor.id} title=${tr('Ouvrir ce niveau')}
      @click=${()=>this.openFloor(floor.id)} @pointerenter=${()=>{this.pointed=floor.id;}} @pointerleave=${()=>{if(this.pointed===floor.id)this.pointed='';}}>
      <span class="name">${on.length&&mode==='lights'?html`<i></i>`:nothing}<span>${floor.name}</span></span>${readings===nothing?nothing:html`<span class="readings">${readings}</span>`}</button>`;
  }
  render() {
    const floor=this.currentFloor,room=this.room,plan=this.plan;
    if(!floor||!plan) return html`<div class="empty">${tr('Ajoutez votre plan dans Studio → Plan 3D.')}</div>`;
    const stacked=this.stacked,floors=this.shownFloors,lit=this.litRooms(floor),modes=this.modes(floors),mode=this.planMode(floors),legend=LEGENDS[mode];
    // From above, the floors of the whole house would hide one another.
    const top=stacked?nothing:html`<button aria-label=${tr('Vue de dessus')} title=${tr('Vue de dessus')} aria-pressed=${this.topView} @click=${this.toggleTop}>${mpIcon('plan',18)}</button>`;
    return html`<div class="layout">
      <div class="stage-col">
      <div class="stage">
        <div class="canvas"></div>
        <div class="labels">${stacked?plan.floors.map(f=>this.levelLabel(f,mode)):floor.rooms.map(r=>this.planLabel(r,lit.has(r.id)&&mode==='lights',mode))}</div>
        ${this.preview||modes.length<2?nothing:html`<div class=${`modes glass ${modes.length>2?'many':''}`} role="group" aria-label=${tr('Ambiance du plan')}>${modes.map(m=>html`<button aria-pressed=${m.mode===mode} title=${tr(m.label)} @click=${()=>{this.mode=m.mode;this.engaged=true;}}>${mpIcon(m.icon,14)}<span class="label">${tr(m.label)}</span></button>`)}</div>
          ${legend?html`<div class="legend">${legend.map(([color,text])=>html`<span><b style=${`background:${color}`}></b>${trText(text)}</span>`)}</div>`:nothing}`}
        ${plan.floors.length>1
          ? html`<div class="floors glass" role="group" aria-label=${tr('Niveau affiché')}>${this.preview?nothing:html`<button aria-pressed=${stacked} aria-label=${tr('Tous les niveaux')} title=${tr('Tous les niveaux')} @click=${this.showHouse}>${mpIcon('layers',14)}${tr('Tous')}</button>`}${plan.floors.map(f=>html`<button aria-pressed=${!stacked&&f.id===floor.id} @click=${()=>this.openFloor(f.id)}>${f.name}</button>`)}</div>`
          : html`<div class="floor-tag glass">${mpIcon('rooms',13)}<span>${floor.name}</span></div>`}
        <div class="rail glass" role="toolbar" aria-label=${tr('Commandes du plan')} aria-orientation="vertical">
          <button class="zoom" aria-label=${tr('Zoom avant')} title=${tr('Zoom avant')} @click=${()=>this.scene?.zoom(.8)}>${mpIcon('plus',18)}</button>
          <button class="zoom" aria-label=${tr('Zoom arrière')} title=${tr('Zoom arrière')} @click=${()=>this.scene?.zoom(1.25)}>${mpIcon('minus',18)}</button>
          <span class="sep zoom"></span>
          <button class=${this.savedView?'saved':''} aria-label=${this.savedView?tr('Revenir à la vue enregistrée'):tr('Recentrer')}
            title=${this.savedView?tr('Revenir à la vue enregistrée · appui long pour la remplacer'):tr('Recentrer · appui long pour enregistrer la vue')}
            @click=${this.tapRecenter} @pointerdown=${this.startHold} @pointerup=${this.endHold} @pointerleave=${this.endHold} @pointercancel=${this.endHold}
            @contextmenu=${(e:Event)=>{e.preventDefault();this.ask();}}>${mpIcon('target',18)}</button>
          ${top}
          <button aria-label=${tr('Murs')} title=${tr('Afficher les murs')} aria-pressed=${this.walls} @click=${()=>{this.walls=!this.walls;}}>${mpIcon('walls',18)}</button>
        </div>
        ${this.placing?html`<div class="picking glass" role="status"><span>${this.placing.prompt}</span><button @click=${this.cancelPick}>${tr('Annuler')}</button></div>`:nothing}
        <p class="hint glass" style=${this.preview?'':'top:56px;bottom:auto;max-width:calc(100% - 100px)'} aria-hidden="true" ?hidden=${this.engaged||!!this.error||!!this.placing}><span class="touch">${tr('Touchez la maison pour la manipuler')}</span><span class="fine">${tr('Glissez la maison pour la tourner · molette pour zoomer')}</span></p>
      </div>
      <div class="rooms">
        <button class="more before" tabindex="-1" aria-hidden="true" title=${stacked?tr('Niveaux précédents'):tr('Pièces précédentes')} @click=${()=>this.scrollRooms(-1)}>${mpIcon('arrow',16)}</button>
        ${stacked
          ? html`<nav class="strip" aria-label=${tr('Niveaux de la maison')} @scroll=${this.edges}>${plan.floors.map(f=>html`<button class=${`chip ${this.pointed===f.id?'pointed':''}`} @click=${()=>this.openFloor(f.id)} @pointerenter=${()=>{this.pointed=f.id;}} @pointerleave=${()=>{if(this.pointed===f.id)this.pointed='';}}>${mpIcon('layers',16)}<span>${f.name}</span>${this.lightsOf(f.rooms).on.length?html`<i class="glow"></i><span class="sr">${tr('(lumière allumée)')}</span>`:nothing}</button>`)}</nav>`
          : html`<nav class="strip" aria-label=${tr('Pièces du niveau')} @scroll=${this.edges}>${floor.rooms.map(r=>html`<button class="chip" aria-pressed=${this.selected===r.id} @click=${()=>this.select(r.id)}>${mpIcon(roomIcon(r.name),16)}<span>${r.name}</span>${lit.has(r.id)?html`<i class="glow"></i><span class="sr">${tr('(lumière allumée)')}</span>`:nothing}</button>`)}</nav>`}
        <button class="more after" tabindex="-1" aria-hidden="true" title=${stacked?tr('Niveaux suivants'):tr('Pièces suivantes')} @click=${()=>this.scrollRooms(1)}>${mpIcon('arrow',16)}</button>
      </div>
      </div>
      <p class="sr">${tr('Sur la maison : glisser pour tourner, pincer ou molette pour zoomer, deux doigts ou clic droit pour déplacer. À côté de la maison, la page défile normalement. Clavier : flèches pour déplacer, + et − pour zoomer.')}</p>
      <div class="side">
        ${this.error?html`<p role="alert" class="error">${this.error}</p>`:nothing}
        ${stacked?this.houseCard(plan.floors):room?this.roomCard(room,floor,lit.has(room.id)):this.overviewCard(floor)}
      </div>
      ${this.preview?nothing:this.askDialog()}
    </div>`;
  }
  private lightsStat(total: number, on: number) {
    return html`<div class="stat ${on?'warm':''}"><small>${tr('Lumières')}</small><strong>${on}<em> / ${total}</em></strong><span>${tr('allumée|allumées',{n:on})}</span></div>`;
  }
  /** Shutters, blinds and curtains of `rooms` letting daylight in, out of all of them. */
  private coversStat(rooms: SpatialRoom[]) {
    const ids=this.groupCovers(rooms);
    if(!ids.length) return nothing;
    const open=ids.filter(id=>coverOpen(this.hass?.states[id])).length;
    return html`<div class="stat"><small>${tr('Volets')}</small><strong>${open}<em> / ${ids.length}</em></strong><span>${tr('ouvert|ouverts',{n:open})}</span></div>`;
  }
  /** Opens or closes every shutter, blind and curtain of `rooms` in one command; a single one is commanded on its own row. */
  private coverPair(rooms: SpatialRoom[], scope: keyof typeof COVER_SCOPES, least=1) {
    const states=this.hass?.states??{},ids=this.groupCovers(rooms);
    if(ids.length<least) return nothing;
    const shut=ids.every(id=>coverClosed(states[id])===1),open=ids.every(id=>coverClosed(states[id])===0),[group,openAll,closeAll]=COVER_SCOPES[scope];
    return html`<div class="pair" role="group" aria-label=${tr(group)}>
      <button aria-label=${tr(openAll)} ?disabled=${this.busy||open||!ids.some(id=>canCover(states[id],'open_cover'))} @click=${()=>this.covers(rooms,'open_cover',ids)}>${mpIcon('shutter',16)}<span>${tr('Tout ouvrir')}</span></button>
      <button aria-label=${tr(closeAll)} ?disabled=${this.busy||shut||!ids.some(id=>canCover(states[id],'close_cover'))} @click=${()=>this.covers(rooms,'close_cover',ids)}>${mpIcon('shutter',16)}<span>${tr('Tout fermer')}</span></button>
    </div>`;
  }
  private overviewCard(floor: SpatialFloor) {
    const lights=floor.rooms.flatMap(r=>(r.entityIds??[]).filter(id=>id.startsWith('light.')));
    const lit=lights.filter(id=>this.hass?.states[id]?.state==='on'),on=lit.length;
    return html`<section class="card ${on?'lit':''}" aria-label=${tr('Vue d’ensemble du niveau')}>
      <header><span class="orb">${mpIcon('home',24)}</span><div class="title"><small>${tr('Vue d’ensemble')}</small><h3>${floor.name}</h3></div></header>
      <div class="stats"><div class="stat"><small>${tr('Pièces')}</small><strong>${floor.rooms.length}</strong></div>${lights.length?this.lightsStat(lights.length,on):nothing}${this.coversStat(floor.rooms)}</div>
      ${lights.length?html`<button class="master ${on?'on':''}" ?disabled=${this.busy||!on} @click=${()=>this.lights(floor.rooms,'turn_off',lit)}>${mpIcon('power',16)}<span>${on?tr('Éteindre tout le niveau'):tr('Tout est éteint')}</span></button>`:nothing}
      ${this.coverPair(floor.rooms,'floor')}
      <p class="lead">${tr('Touchez une pièce sur le plan ou dans la liste pour afficher ses équipements.')}</p>
    </section>`;
  }
  /** Every floor at a glance: the house in figures, a command for all its lights, then each floor from the top one down. */
  private houseCard(floors: SpatialFloor[]) {
    const rooms=floors.flatMap(f=>f.rooms),{all,on}=this.lightsOf(rooms);
    const order=floors.map((floor,index)=>({floor,index})).sort((a,b)=>b.floor.elevation-a.floor.elevation||b.index-a.index).map(({floor})=>floor);
    return html`<section class="card ${on.length?'lit':''}" aria-label=${tr('Vue d’ensemble de la maison')}>
      <header><span class="orb">${mpIcon('layers',24)}</span><div class="title"><small>${tr('Vue d’ensemble')}</small><h3>${tr('Toute la maison')}</h3></div></header>
      <div class="stats"><div class="stat"><small>${tr('Niveaux')}</small><strong>${floors.length}</strong></div><div class="stat"><small>${tr('Pièces')}</small><strong>${rooms.length}</strong></div>${all.length?this.lightsStat(all.length,on.length):nothing}${this.coversStat(rooms)}</div>
      ${all.length?html`<button class="master ${on.length?'on':''}" ?disabled=${this.busy||!on.length} @click=${()=>this.lights(rooms,'turn_off',on)}>${mpIcon('power',16)}<span>${on.length?tr('Éteindre toute la maison'):tr('Tout est éteint')}</span></button>`:nothing}
      ${this.coverPair(rooms,'house')}
      <ul class="levels" aria-label=${tr('Niveaux')}>${order.map(f=>this.levelRow(f))}</ul>
      <p class="lead">${tr('Touchez un niveau sur le plan ou dans la liste pour l’ouvrir.')}</p>
    </section>`;
  }
  private levelRow(floor: SpatialFloor) {
    const {all,on}=this.lightsOf(floor.rooms),count=floor.rooms.length;
    const lights=!all.length?'':` · ${on.length?tr('{n} lumière allumée|{n} lumières allumées',{n:on.length}):tr('lumières éteintes')}`;
    return html`<li><button class="level ${on.length?'on':''} ${this.pointed===floor.id?'pointed':''}" title=${tr('Ouvrir ce niveau')} @click=${()=>this.openFloor(floor.id)} @pointerenter=${()=>{this.pointed=floor.id;}} @pointerleave=${()=>{if(this.pointed===floor.id)this.pointed='';}}>
      <span class="dev-icon">${mpIcon(on.length?'bulb':'layers',20)}</span>
      <span class="text"><strong>${floor.name}</strong><small>${tr('{n} pièce|{n} pièces',{n:count})}${lights}</small></span>
      ${this.temperatures(floor)}${mpIcon('arrow',16)}
    </button></li>`;
  }
  private roomCard(room: SpatialRoom, floor: SpatialFloor, lit: boolean) {
    // What a door or a window shows (its covers and sensors) is not listed again; televisions and speakers placed in the room are.
    const linked=new Set((room.openings??[]).flatMap(o=>o.entityIds??[]));
    const devices=[...new Set([...(room.entityIds??[]),...(room.media??[]).flatMap(m=>m.entityId?[m.entityId]:[])])].filter(id=>!linked.has(id)).map(id=>this.device(id,room));
    const openings=room.openings??[];
    const lights=devices.filter(d=>d.kind==='light'),on=lights.filter(d=>d.on);
    // Dimensions along the room's own walls: a room drawn at an angle gives its real width and depth.
    const surface=roomArea(room),{width,depth,rectangle}=roomSize(room);
    const temperature=this.temperature(room);
    const humidity=devices.find(d=>d.kind==='humidity'&&d.numeric!==undefined)?.numeric;
    const href=room.areaId?this.areaHref?.(room.areaId):undefined;
    const group=lights.filter(d=>d.switchable);
    return html`<section class="card ${lit?'lit':''}" aria-labelledby="room-title">
      <header><span class="orb">${mpIcon(roomIcon(room.name),26)}</span><div class="title"><small>${floor.name}</small><h3 id="room-title">${room.name}</h3></div><button class="close" aria-label=${tr('Fermer la pièce')} title=${tr('Fermer')} @click=${this.close}>${mpIcon('close',18)}</button></header>
      <div class="stats">
        <div class="stat"><small>${tr('Surface')}</small><strong>${tr('{n} m²',{n:this.format(surface)})}</strong>${rectangle?html`<span>${tr('{width} × {depth} m',{width:this.format(width),depth:this.format(depth)})}</span>`:nothing}</div>
        ${lights.length?this.lightsStat(lights.length,on.length):nothing}
        ${temperature===undefined?nothing:html`<div class="stat"><small>${tr('Température')}</small><strong title=${temperature.id}>${this.format(temperature.value)}${temperature.unit==='°C'?'°':temperature.unit}</strong></div>`}
        ${humidity===undefined?nothing:html`<div class="stat"><small>${tr('Humidité')}</small><strong>${tr('{n} %',{n:this.format(humidity,0)})}</strong></div>`}
      </div>
      ${group.length>1?html`<button class="master ${on.length?'on':''}" ?disabled=${this.busy} @click=${()=>this.lights([room],on.length?'turn_off':'turn_on',(on.length?on:group).map(d=>d.id))}>${mpIcon('power',16)}<span>${on.length?tr('Tout éteindre'):tr('Tout allumer')}</span></button>`:nothing}
      ${this.coverPair([room],'room',2)}
      ${openings.length?html`<p class="section-title">${tr('Portes et fenêtres')}</p><ul class="devices" aria-label=${tr('Portes et fenêtres')}>${openings.map(o=>this.openingRow(room,o))}</ul>${devices.length?html`<p class="section-title">${tr('Équipements')}</p>`:nothing}`:nothing}
      ${devices.length?html`<ul class="devices" aria-label=${tr('Équipements')}>${devices.map(d=>this.deviceRow(room,d))}</ul>`:openings.length?nothing:html`<p class="lead">${tr('Aucun équipement associé à cette pièce. Choisissez-les dans Studio → Plan 3D.')}</p>`}
      ${href?html`<a class="open" href=${href}><span>${tr('Ouvrir la pièce')}</span>${mpIcon('arrow',16)}</a>`:nothing}
    </section>`;
  }
  /** A door or a window named by its kind, numbered when the room has several of that kind. */
  private openingName(room: SpatialRoom, opening: SpatialOpening) {
    if(opening.name) return opening.name;
    const same=(room.openings??[]).filter(o=>o.kind===opening.kind);
    return same.length>1?`${tr(OPENING_NAMES[opening.kind])} ${same.indexOf(opening)+1}`:tr(OPENING_NAMES[opening.kind]);
  }
  /** A door or a window: open or closed by its contact sensors, its size, then each of its covers with its commands. */
  private openingRow(room: SpatialRoom, opening: SpatialOpening) {
    const states=this.hass?.states??{},ids=opening.entityIds??[],name=this.openingName(room,opening);
    const sensors=ids.filter(id=>id.startsWith('binary_sensor.')),covers=ids.filter(id=>id.startsWith('cover.')).map(id=>this.device(id,room));
    const open=this.isOpen(opening),known=sensors.some(id=>available(states[id]));
    const placed=openingPlacement(room,opening),size=placed?tr('{width} × {depth} m',{width:this.format(placed.width,2),depth:this.format(placed.height,2)}):'';
    const target=sensors[0]??covers[0]?.id,body=html`<span class="dev-icon">${mpIcon(OPENING_ICONS[opening.kind],20)}</span><span class="text"><strong>${name}</strong><small>${size}${sensors.length||covers.length?'':`${size?' · ':''}${tr('sans équipement relié')}`}</small></span>`;
    return html`<li class="device opening ${open?'ajar':''}" data-kind="opening">
      ${target?html`<button class="main" aria-label=${tr('Détails {name}',{name})} @click=${()=>this.moreInfo(target)}>${body}</button>`:html`<div class="main">${body}</div>`}
      ${sensors.length?html`<span class=${`state ${open?'ajar':''}`}>${known?open?tr('Ouverte'):tr('Fermée'):tr('Indisponible')}</span>`:nothing}
      ${covers.map(d=>html`<div class="cover-line">${mpIcon(COVER_ICONS[coverStyle(states[d.id])],14)}<span>${d.name}</span><small>${d.detail}</small></div>${this.coverControls(room,d)}`)}
    </li>`;
  }
  /** Open, stop and close, the position when the cover takes one, and the angle of the slats of a blind that tilts. */
  private coverControls(room: SpatialRoom, d: Device) {
    const state=this.hass?.states[d.id],tilt=coverTilt(state);
    return html`<div class="cover-controls">
        ${([['open_cover','Ouvrir le volet {name}','↑'],['stop_cover','Arrêter le volet {name}','■'],['close_cover','Fermer le volet {name}','↓']] as const).map(([action,label,icon])=>html`<button aria-label=${tr(label,{name:d.name})} ?disabled=${this.busy||!canCover(state,action)} @click=${()=>this.cover(room,d.id,action)}>${icon}</button>`)}
        ${canCover(state,'set_cover_position')?html`<label><input type="range" min="0" max="100" .value=${String(d.percent??50)} aria-label=${tr('Ouverture {name}',{name:d.name})} aria-valuetext=${d.percent===undefined?tr('Position actuelle inconnue'):tr('{n} % ouvert',{n:this.format(d.percent,0)})} ?disabled=${this.busy} @change=${(e:Event)=>this.cover(room,d.id,'set_cover_position',Number((e.target as HTMLInputElement).value))}><output>${d.percent===undefined?'—':tr('{n} %',{n:this.format(d.percent,0)})}</output></label>`:nothing}
      </div>
      ${canCover(state,'set_cover_tilt_position')?html`<div class="cover-controls"><label title=${tr('Inclinaison des lames')}>${mpIcon('sliders',14)}<input type="range" min="0" max="100" .value=${String(tilt??50)} aria-label=${tr('Inclinaison {name}',{name:d.name})} ?disabled=${this.busy} @change=${(e:Event)=>this.cover(room,d.id,'set_cover_tilt_position',Number((e.target as HTMLInputElement).value))}><output>${tilt===undefined?'—':tr('{n} %',{n:this.format(tilt,0)})}</output></label></div>`:nothing}`;
  }
  /** Previous, play or pause and next, the volume and its mute, and the source, each as far as the player offers it. */
  private mediaControls(room: SpatialRoom, d: Device) {
    const state=this.hass?.states[d.id];
    if(!state||!d.on) return nothing;
    const playing=state.state==='playing',muted=state.attributes.is_volume_muted===true,sources=Array.isArray(state.attributes.source_list)?state.attributes.source_list.filter((s):s is string=>typeof s==='string'):[];
    const toggle=playing?canMedia(state,'pause')?'media_pause':undefined:canMedia(state,'play')?'media_play':undefined;
    const transport=canMedia(state,'previous_track')||toggle||canMedia(state,'next_track');
    const volume=canMedia(state,'volume_set'),mute=canMedia(state,'volume_mute'),source=canMedia(state,'select_source')&&sources.length>0;
    if(!transport&&!volume&&!mute&&!source) return nothing;
    return html`<div class="media-controls">
      ${transport?html`<div class="transport">
        ${canMedia(state,'previous_track')?html`<button aria-label=${tr('Piste précédente {name}',{name:d.name})} ?disabled=${this.busy} @click=${()=>this.media(room,d.id,'media_previous_track')}>${mpIcon('previous',16)}</button>`:nothing}
        ${toggle?html`<button class="play" aria-label=${playing?tr('Pause {name}',{name:d.name}):tr('Lecture {name}',{name:d.name})} ?disabled=${this.busy} @click=${()=>this.media(room,d.id,toggle)}>${mpIcon(playing?'pause':'play',17)}</button>`:nothing}
        ${canMedia(state,'next_track')?html`<button aria-label=${tr('Piste suivante {name}',{name:d.name})} ?disabled=${this.busy} @click=${()=>this.media(room,d.id,'media_next_track')}>${mpIcon('next',16)}</button>`:nothing}
      </div>`:nothing}
      ${volume||mute?html`<div class="volume">
        ${mute?html`<button aria-label=${muted?tr('Rétablir le son {name}',{name:d.name}):tr('Couper le son {name}',{name:d.name})} aria-pressed=${muted} ?disabled=${this.busy} @click=${()=>this.media(room,d.id,'volume_mute',{is_volume_muted:!muted})}>${mpIcon(muted?'mute':'volume',16)}</button>`:mpIcon('volume',16)}
        ${volume?html`<input type="range" min="0" max="100" .value=${String(d.percent??0)} aria-label=${tr('Volume {name}',{name:d.name})} ?disabled=${this.busy} @change=${(e:Event)=>this.media(room,d.id,'volume_set',{volume_level:Number((e.target as HTMLInputElement).value)/100})}>`:html`<span></span>`}
        <output>${muted?tr('Muet'):d.percent===undefined?'—':tr('{n} %',{n:d.percent})}</output>
      </div>`:nothing}
      ${source?html`<label class="source">${tr('Source')}<select aria-label=${tr('Source {name}',{name:d.name})} ?disabled=${this.busy} @change=${(e:Event)=>this.media(room,d.id,'select_source',{source:(e.target as HTMLSelectElement).value})}>
        ${state.attributes.source&&sources.includes(String(state.attributes.source))?nothing:html`<option value="" selected disabled>—</option>`}
        ${sources.map(s=>html`<option value=${s} .selected=${s===state.attributes.source}>${s}</option>`)}
      </select></label>`:nothing}
    </div>`;
  }
  private deviceRow(room: SpatialRoom, d: Device) {
    const action=d.on?tr('Éteindre {name}',{name:d.name}):tr('Allumer {name}',{name:d.name});
    const state=this.hass?.states[d.id],icon=d.kind==='media'?mediaIsTv(state)?'tv':'speaker':d.kind==='cover'?COVER_ICONS[coverStyle(state)]:KIND_ICONS[d.kind];
    return html`<li class="device ${d.on?'on':''} ${d.ready?'':'offline'}" data-kind=${d.kind}>
      <button class="main" aria-label=${tr('Détails {name}',{name:d.name})} @click=${()=>this.moreInfo(d.id)}><span class="dev-icon">${mpIcon(icon,20)}</span><span class="text"><strong>${d.name}</strong><small>${d.detail}</small></span></button>
      ${d.kind==='light'
        ? html`<button class="switch ${d.on?'on':''}" aria-label=${d.on?tr('Éteindre'):tr('Allumer')} title=${action} ?disabled=${this.busy||!d.switchable} @click=${()=>this.toggle(room,d.id)}><span></span></button>`
        : d.kind==='media'?d.switchable?html`<button class="switch media ${d.on?'on':''}" aria-label=${action} title=${action} ?disabled=${this.busy||!canMedia(state,d.on?'turn_off':'turn_on')} @click=${()=>this.media(room,d.id,d.on?'turn_off':'turn_on')}><span></span></button>`:nothing
        : d.value?html`<strong class="value">${d.value}</strong>`:nothing}
      ${d.kind==='media'?this.mediaControls(room,d):nothing}
      ${d.on&&d.dimmable?html`<label class="dim">${mpIcon('sun',14)}<input type="range" min="1" max="100" .value=${String(d.percent??1)} aria-label=${tr('Luminosité {name}',{name:d.name})} ?disabled=${this.busy} @change=${(e:Event)=>this.lights([room],'turn_on',[d.id],{brightness_pct:Number((e.target as HTMLInputElement).value)})}><output>${d.percent===undefined?'—':tr('{n} %',{n:d.percent})}</output></label>`:nothing}
      ${d.kind==='cover'?this.coverControls(room,d):nothing}
    </li>`;
  }
}
defineElement('mp-spatial-viewer',MPSpatialViewer);
