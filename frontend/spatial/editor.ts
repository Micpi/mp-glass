import { repeat } from 'lit/directives/repeat.js';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { available } from '../../shared/capabilities';
import type { HAArea, HAFloor, LogicalDevice, Override } from '../../shared/models';
import { areaEquipment, followsArea, matchAreas, resolvePlan, ROOM_ENTITY_LIMIT, type PlanKind } from '../../shared/rooms';
import { bent, examplePlan, insideRoom, nearestSide, OPENING_SIZES, outline, parseSpatial, reattachOpenings, roomArea, roomOutline, sideLength, splitSide, wallFrame, type MediaKind, type OpeningKind, type Point, type SpatialMedia, type SpatialOpening, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { roomTemperature } from '../../shared/spatial-state';
import type { Hass } from '../ha/client';
import { mpIcon, type MPIconName } from '../icons';
import { defineElement } from '../registry';
import './viewer';
import { detectWalls, snapBox, snapOutline, type DetectionRoom, type Source, type Walls } from './zones';

/** Exhausted Gemini quota, as read by Home Assistant in Google's answer. */
interface Quota { period:'day'|'minute'|''; unit:'requests'|'tokens'; limit:number|null; model:string; retry:number|null }
interface Job { id:string; status:'running'|'done'|'error'; plan?:SpatialPlan; error?:string; detail?:string; warnings?:string[]; source?:Source; model?:string; detection?:DetectionRoom[]; quota?:Quota }
type Quality='precise'|'fast';
/** Models offered before each analysis (the integration options give the default); the other one is proposed after an overload or a quota. */
const MODELS:Record<string,{label:string;quality:Quality;hint:string}>={'gemini-3.8-flash':{label:'Gemini 3.8 Flash',quality:'precise',hint:'le plus précis'},'gemini-3.5-flash-lite':{label:'Gemini 3.5 Flash-Lite',quality:'fast',hint:'le plus rapide'}};
/** What Home Assistant analyses with: direct Gemini (model of the options, if one of those offered) or the add-on, which picks its own. */
interface ModelInfo { backend:'gemini'|'addon'; configured:boolean; model:string|null; quality:Quality|null }
/** Last model chosen in this browser. */
const QUALITY_KEY='mp-glass.spatial.quality';
/** Eight random hex digits. Not `crypto.randomUUID`: it only exists over HTTPS, and Home Assistant is often opened at http://IP:8123. */
const shortId=()=>Array.from(crypto.getRandomValues(new Uint8Array(4)),byte=>byte.toString(16).padStart(2,'0')).join('');
const KIND_ICONS:Record<PlanKind,MPIconName>={light:'bulb',cover:'shutter',climate:'flame',temperature:'thermo',humidity:'drop',media:'speaker',opening:'window',motion:'motion'};
const OPENING_NAMES:Record<OpeningKind,string>={door:'Porte',window:'Fenêtre',french_window:'Porte-fenêtre'};
const OPENING_ICONS:Record<OpeningKind,MPIconName>={door:'door',window:'window',french_window:'french'};
const MEDIA_NAMES:Record<MediaKind,string>={tv:'Téléviseur',speaker:'Enceinte'};
/** What each kind of cover is called, by its device class; a contact sensor tells whether a door or a window is open. */
const COVER_NAMES:Record<string,string>={shutter:'Volet',blind:'Store',shade:'Store',curtain:'Rideau',awning:'Store banne',garage:'Porte de garage',gate:'Portail',door:'Porte motorisée',window:'Fenêtre motorisée',damper:'Clapet'};
const contact=(deviceClass:unknown)=>['door','window','opening','garage_door'].includes(String(deviceClass??''));
/** Where a wall stands on the plan, seen from above as the plan is drawn: its outside faces that way. */
const DIRECTIONS=['à droite','en bas à droite','en bas','en bas à gauche','à gauche','en haut à gauche','en haut','en haut à droite'];
/** Something being placed from the Studio: the next tap on the plan puts it on a wall (door, window) or on the floor (television, speaker). */
interface Placing { what:'opening'|'media'; id:string; floorId:string; roomId:string; prompt:string }
const plain=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
/** Centimetres are enough for a plan. */
const round=(value:number)=>Math.round(value*100)/100;
const count=(n:number,word:string,suffix='')=>`${n} ${word}${n>1?'s':''}${suffix?` ${suffix}${n>1?'s':''}`:''}`;
const ACCEPTED=['application/pdf','image/png','image/jpeg','image/webp'];
const MAX_UPLOAD=8*1024*1024, MAX_SIDE=3072, MAX_WAIT=6*60_000;
/** Google renews daily quotas at midnight in California: that moment in the viewer's time, "demain à 9 h". */
function quotaReset(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(now);
  const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value??0);
  const reset=new Date(now.getTime()-((part('hour')*60+part('minute'))*60+part('second'))*1000-now.getMilliseconds()+86_400_000);
  const minutes=reset.getMinutes();
  return `${reset.toDateString()===now.toDateString()?'aujourd’hui':'demain'} à ${reset.getHours()} h${minutes?` ${String(minutes).padStart(2,'0')}`:''}`;
}
const MESSAGES:Record<string,string>={
  not_configured:'Ouvrez Configurer Gemini et collez votre clé API dans les options de MP Glass. Aucun add-on nécessaire en mode direct.',
  not_installed:'Service d’import introuvable : mettez à jour l’intégration MP Glass, puis redémarrez Home Assistant.',
  unauthorized:'Seul un administrateur Home Assistant peut importer un plan.',
  network:'Connexion à Home Assistant interrompue pendant l’envoi. Réessayez.',
  quota:'Quota Gemini atteint. Réessayez plus tard ; aucun autre modèle n’a été appelé.',
  busy:'Une analyse est déjà en cours. Attendez sa fin.',
  invalid_file:'Format non pris en charge. Utilisez un PDF non chiffré ou une image PNG, JPEG ou WebP.',
  file_too_large:'Fichier trop volumineux (8 Mo maximum). Pour un PDF, enregistrez seulement la page du plan ; les images sont réduites automatiquement.',
  invalid_geometry:'La réponse de Gemini n’a pas pu être convertie en plan. Réessayez avec une page plus lisible ou dessinez les pièces.',
  no_rooms:'Gemini n’a reconnu aucune pièce. Vérifiez le numéro de page, recadrez le plan ou utilisez une image plus nette.',
  truncated:'La réponse de Gemini a été coupée. Importez un seul niveau à la fois.',
  provider_auth:'Clé API Gemini refusée. Vérifiez-la dans les options de MP Glass et que l’API Gemini est activée pour ce projet Google.',
  provider_region:'Google refuse l’accès à Gemini pour ce projet (région ou facturation). Voir le détail ci-dessous.',
  provider_request:'Gemini a refusé la requête, même simplifiée : le document est sans doute en cause (PDF protégé, corrompu ou atypique). Essayez une capture PNG ou JPEG du plan. Voir le détail ci-dessous.',
  cancelled:'Analyse annulée. Le plan enregistré est conservé.',
  provider_unavailable:'Gemini est momentanément surchargé ou indisponible ; MP Glass a déjà réessayé deux fois. Réessayez dans quelques minutes.',
  provider_unreachable:'Home Assistant n’arrive pas à joindre Google Gemini. Vérifiez sa connexion Internet et son DNS.',
  provider_blocked:'Gemini a interrompu l’analyse de ce document. Essayez une autre page ou une image du plan.',
  worker_unavailable:'Add-on inaccessible. Vérifiez son démarrage, son adresse et la clé de liaison.',
  model_unavailable:'Google refuse le modèle Gemini utilisé (retiré ou non ouvert à ce projet). Mettez à jour MP Glass puis redémarrez Home Assistant ; en mode add-on, corrigez l’option « model » du worker. Voir le détail ci-dessous.',
  timeout:'L’analyse a dépassé le délai. Réessayez avec une page plus simple.',
  job_missing:'L’analyse a été interrompue (MP Glass rechargé ou Home Assistant redémarré). Relancez-la.',
  pdf_protected:'PDF protégé par un mot de passe : exportez la page du plan en image (PNG ou JPEG).',
  pdf_unreadable:'Le navigateur n’a pas pu lire ce PDF : exportez la page du plan en image (PNG ou JPEG).',
};

async function encodeCanvas(canvas:HTMLCanvasElement):Promise<Blob>{
  const encode=(format:string,quality?:number)=>new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,format,quality));
  const png=await encode('image/png');
  const blob=png&&png.size<=MAX_UPLOAD?png:await encode('image/jpeg',.9);
  if(!blob||blob.size>MAX_UPLOAD)throw Error('file_too_large');
  return blob;
}
let pdfWorker:Worker|undefined;
/** Only the chosen page leaves the browser, drawn by PDF.js (loaded on demand) as an image without the file's metadata. */
async function renderPdfPage(file:File,page:number):Promise<Blob>{
  const [pdfjs,{default:PdfWorker}]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?worker')]);
  pdfWorker??=new PdfWorker();
  pdfjs.GlobalWorkerOptions.workerPort=pdfWorker;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
  try{
    const pdf=await task.promise.catch((error:{name?:string})=>{throw Error(error?.name==='PasswordException'?'pdf_protected':'pdf_unreadable');});
    if(page>pdf.numPages)throw Error(`page_missing:${pdf.numPages}`);
    const source=await pdf.getPage(page),base=source.getViewport({scale:1});
    const viewport=source.getViewport({scale:Math.min(4,MAX_SIDE/Math.max(base.width,base.height))});
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
    await source.render({canvas,viewport,background:'#ffffff'}).promise;
    return await encodeCanvas(canvas);
  }finally{await task.destroy();}
}
/** PDF page drawn in the browser; images decoded by the browser and reduced when too large or in another format. */
async function prepareUpload(file:File,page:number):Promise<Blob>{
  const type=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'');
  if(type==='application/pdf')return renderPdfPage(file,page);
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file);}
  catch{if(ACCEPTED.includes(type)&&file.size<=MAX_UPLOAD)return file;throw Error('invalid_file');}
  try{
    const side=Math.max(bitmap.width,bitmap.height);
    if(ACCEPTED.includes(type)&&file.size<=MAX_UPLOAD&&side<=MAX_SIDE)return file;
    const scale=Math.min(1,MAX_SIDE/side),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)throw Error('invalid_file');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await encodeCanvas(canvas);
  }finally{bitmap.close();}
}

export class MPSpatialEditor extends LitElement {
  static properties={plan:{attribute:false},fallback:{attribute:false},hass:{attribute:false},areas:{attribute:false},floors:{attribute:false},devices:{attribute:false},draft:{state:true},usingDefault:{state:true},candidate:{state:true},message:{state:true},detail:{state:true},busy:{state:true},selected:{state:true},floorIndex:{state:true},file:{state:true},page:{state:true},confirmed:{state:true},phase:{state:true},dialogOpen:{state:true},warnings:{state:true},tick:{state:true},model:{state:true},quality:{state:true},info:{state:true},errorCode:{state:true},source:{state:true},sourceUrl:{state:true},view:{state:true},detection:{state:true},history:{state:true},walls:{state:true},recomputing:{state:true},entitySearch:{state:true},asking:{state:true},placing:{state:true}};
  static styles=css`
    :host{display:block;color:#eef6ff;font:13px/1.5 system-ui,sans-serif}*{box-sizing:border-box}h2{font:28px Georgia,serif;margin:0 0 8px}p{color:#b7ccdf}.box{border:1px solid #c5e4ff26;border-radius:14px;padding:15px;margin:15px 0;background:#071a2c55}.row{display:flex;flex-wrap:wrap;align-items:end;gap:9px;margin:10px 0}label{display:flex;flex-direction:column;gap:5px;flex:1;min-width:120px}input,select,textarea,button{font:inherit;color:inherit;border:1px solid #b2d7f23b;border-radius:10px;background:#0b253d;padding:10px;min-height:42px;max-width:100%}select option{background:#0b253d;color:#eef6ff}select[multiple] option:checked{background:linear-gradient(#2a648e,#2a648e);color:#fff}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.primary{background:#2a648e;border-color:#8acbff}textarea{width:100%;font:12px/1.4 monospace;min-height:130px}.check{display:flex;flex-direction:row;align-items:center}.check input{min-height:22px}a{color:#9ad4ff}.points{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:6px;margin:8px 0}.points input{width:100%;min-width:0}.note{border-left:2px solid #8bceff;padding:9px 12px}.note small{display:block;margin-top:6px;color:#9fb6ca;font:11px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.default{border-color:#8bceff55;background:#10365555}.default p{margin:6px 0 0}.warning{color:#ffda9a}details{margin:14px 0}fieldset{padding:0;border:0;min-width:0}mp-spatial-viewer{margin:15px -6px}
    .equipment-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 12px;margin-top:14px}.links .equipment-head{margin-top:0}.links p{margin:8px 0 0}.suggest{margin:4px 0 8px}
    .equipment{list-style:none;display:grid;grid-template-columns:minmax(0,1fr);gap:5px;margin:8px 0;padding:0}.equipment li{display:flex;align-items:center;gap:10px;min-height:48px;padding:5px 6px 5px 10px;border:1px solid #b2d7f21f;border-radius:10px;background:#ffffff05}.equipment .mp-icon{color:#9ad4ff}.equipment li>span:not(.mp-icon){flex:1;min-width:0}.equipment small{display:block;color:#9fb6ca;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.equipment select{flex:0 1 auto;width:11em;min-width:0;min-height:38px;padding:6px 8px}.equipment button{flex:none;min-height:38px;padding:0 12px}
    .fixtures{margin-top:16px;padding-top:12px;border-top:1px solid #c5e4ff1f}.fixtures>p{margin:6px 0 0}
    .adders{display:flex;flex-wrap:wrap;gap:6px}.adders button{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 12px}
    .fixture{margin:10px 0 0;padding:10px 12px;border:1px solid #b2d7f224;border-radius:12px;background:#ffffff06}.fixture.placing{border-color:#8acbff;box-shadow:0 0 0 3px #69b7ff26}
    .fixture-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.fixture-head>.mp-icon{color:#9ad4ff}.fixture-head select{flex:0 1 auto;width:auto}.fixture-head input{flex:1 1 150px;min-width:0}
    .fixture .row{margin:8px 0 0}.fixture input[type=range]{padding:0;min-height:34px;accent-color:#69b7ff}.fixture .entity-list{max-height:196px;margin-bottom:0}.fixture details{margin:8px 0 0}
    .entity-list{display:grid;gap:5px;max-height:250px;overflow:auto;margin:8px 0;padding:3px}.entity-list label{display:flex;flex-direction:row;align-items:center;gap:10px;min-height:48px;padding:6px 10px;border:1px solid #b2d7f21f;border-radius:10px;background:#ffffff05}.entity-list input{flex:none;min-height:20px;width:18px;height:18px;accent-color:#69b7ff}.entity-list span{min-width:0;overflow:hidden;text-overflow:ellipsis}.entity-list small{display:block;color:#9fb6ca;overflow:hidden;text-overflow:ellipsis}.entity-list label:has(:checked){background:#69b7ff15;border-color:#69b7ff55}
    dialog.job{width:min(920px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:22px;border:1px solid #9fd2ff40;border-radius:22px;color:#eef6ff;background:linear-gradient(150deg,#12344ff2,#071a2cfa 70%);box-shadow:0 30px 80px #000a,inset 0 1px #ffffff1f}
    dialog.job.wide{width:min(1800px,calc(100vw - 24px));padding:18px 20px}dialog.job.wide mp-spatial-viewer{--mp-stage-height:max(42vh,min(100dvh - 330px,760px))}
    dialog.job::backdrop{background:#020a14a6;backdrop-filter:blur(6px)}
    button.danger{border-color:#ffbda94d;color:#ffbda9}button.danger:disabled{color:#eef6ff}
    dialog.ask{width:min(400px,calc(100vw - 24px));padding:20px;border:1px solid #9fd2ff40;border-radius:20px;color:#eef6ff;background:linear-gradient(150deg,#12344ff2,#071a2cfa 70%);box-shadow:0 30px 80px #000a,inset 0 1px #ffffff1f}
    dialog.ask::backdrop{background:#020a14a6;backdrop-filter:blur(6px)}
    dialog.ask h3{margin:0;font:22px/1.15 Georgia,serif;font-weight:400}dialog.ask p{margin:10px 0 0;font-size:12.5px;color:#b7ccdf}
    .ask-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:9px;margin-top:18px}
    .job-head{display:flex;align-items:center;gap:14px}.job-head small{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#a9c0d6}.job-head h3{margin:3px 0 0;font:26px/1.1 Georgia,serif;font-weight:400}.job-head p{margin:5px 0 0;font-size:12px;overflow-wrap:anywhere}
    .job-orb{position:relative;display:grid;place-items:center;width:52px;height:52px;flex:0 0 auto;overflow:hidden;border-radius:16px;color:#dff0ff;background:radial-gradient(circle at 30% 25%,#69b7ff66,#69b7ff14);border:1px solid #69b7ff55;box-shadow:0 0 28px #69b7ff33}
    .job-orb.scan::after{content:'';position:absolute;left:9px;right:9px;top:12px;height:2px;border-radius:2px;background:#a6e3ff;box-shadow:0 0 10px #a6e3ff;animation:scan 1.5s ease-in-out infinite alternate}
    .job-orb.ok{color:#caffe2;background:radial-gradient(circle at 30% 25%,#5fe0a066,#5fe0a014);border-color:#6fe3aa66;box-shadow:0 0 28px #4fd18b33}.job-orb.fail{color:#ffd0c2;background:radial-gradient(circle at 30% 25%,#ff8a6a55,#ff8a6a12);border-color:#ff9f8566;box-shadow:0 0 28px #ff8a6a26}
    .steps{list-style:none;margin:20px 0 14px;padding:0;display:grid;gap:8px}.steps li{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:12px;background:#ffffff08;border:1px solid #d6ecff14;color:#8fa6ba}
    .steps li.current{color:#fff;border-color:#69b7ff55;background:#69b7ff14}.steps li.done{color:#bfe9d2}.steps time{margin-left:auto;font-variant-numeric:tabular-nums;color:#cfe6ff}
    .steps .dot{display:grid;place-items:center;width:18px;height:18px;flex:0 0 auto;border-radius:50%;border:2px solid #8fa6ba66}.steps .current .dot{border-color:#69b7ff;border-top-color:transparent;animation:spin 1s linear infinite}.steps .done .dot{border-color:#4fd18b;background:#4fd18b;color:#062a18}
    .bar{height:4px;overflow:hidden;border-radius:99px;background:#ffffff14}.bar span{display:block;width:35%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,#69b7ff,transparent);animation:slide 1.4s ease-in-out infinite}
    .job-status{margin:14px 0 0;color:#dbe9f5}.job-status.failure{color:#ffd9cf}.job-status small{display:block;margin-top:8px;color:#9fb6ca;font:11px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.muted{margin:8px 0 0;font-size:12px;color:#9fb6ca}
    .warnings{margin:12px 0 0;padding:10px 14px 10px 30px;border-radius:12px;background:#ffd36a12;border:1px solid #ffd36a33;color:#ffe3a3;font-size:12px}
    .job-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:18px}.job mp-spatial-viewer{--mp-stage-height:min(42vh,360px);margin:16px 0 0}
    .tabs{display:inline-flex;gap:2px;margin:16px 0 0;padding:3px;border-radius:12px;background:#ffffff0d;border:1px solid #d6ecff1f}.tabs button{min-height:34px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:#b9cfe2}.tabs button[aria-selected=true]{background:#2a648e;color:#fff}
    @keyframes scan{to{top:36px}}@keyframes spin{to{transform:rotate(1turn)}}@keyframes slide{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
    @media (prefers-reduced-motion:reduce){.job-orb.scan::after,.steps .current .dot,.bar span{animation:none}}
  `;
  plan?:SpatialPlan;fallback?:SpatialPlan;hass?:Hass;areas:HAArea[]=[];floors:HAFloor[]=[];
  /** Entities as discovered, with the room chosen in MP Glass: rooms that follow an area show its equipment. */
  devices:LogicalDevice[]=[];
  private entitySearch='';
  private resolved?:{draft:SpatialPlan;devices:LogicalDevice[];plan:SpatialPlan};
  /** Draft as the dashboard will show it. */
  private get shown(){if(!this.draft)return undefined;if(this.resolved?.draft!==this.draft||this.resolved.devices!==this.devices)this.resolved={draft:this.draft,devices:this.devices,plan:resolvePlan(this.draft,this.devices)};return this.resolved.plan;}
  private draft?:SpatialPlan;private usingDefault=false;private candidate?:SpatialPlan;private message='';private detail='';private busy=false;private selected='';private floorIndex=0;private file?:File;private page=1;private confirmed=false;
  /** Door, window, television or speaker waiting for a tap on the plan. */
  private placing?:Placing;
  /** What the confirmation window is about to remove, nothing while it is closed. */
  private asking:''|'plan'|'floor'='';
  private timer?:ReturnType<typeof setTimeout>;private disposed=false;private generation=0;private startedAt=0;
  /** Analysis window: progress while `busy`, then the draft or the failure. */
  private phase?:'preparing'|'uploading'|'analyzing'|'done'|'error';private dialogOpen=false;private jobId='';private warnings:string[]=[];private elapsed=0;private tick=0;private ticker?:ReturnType<typeof setInterval>;
  /** Model of the running or last analysis, as reported by Home Assistant (direct mode only). */
  private model='';private errorCode='';
  /** Model chosen before the analysis; none: the one in the integration options. */
  private quality?:Quality;private info?:ModelInfo;private infoLoading=false;
  /** Quota refused by Google, and when a per-minute limit lets "Réessayer" through again. */
  private quotaInfo?:Quota;private retryAt=0;
  private get modelLabel(){return MODELS[this.model]?.label??'Gemini';}
  private get alternative(){const current=MODELS[this.model];return current?Object.values(MODELS).find(m=>m.quality!==current.quality):undefined;}
  /** Image sent to Gemini and the mapping of the draft onto it, for the rooms drawn over the plan. */
  private source?:Source;private sourceUrl='';private sourceBlob?:Blob;private view:'overlay'|'3d'='overlay';
  /** Rooms as detected (0-1000 over the image), edited in the result window; undo keeps the previous states. */
  private detection?:DetectionRoom[];private history:DetectionRoom[][]=[];private walls?:Walls;private recomputing=false;
  connectedCallback(){super.connectedCallback();this.disposed=false;}
  disconnectedCallback(){
    super.disconnectedCallback();this.disposed=true;this.generation++;clearTimeout(this.timer);clearInterval(this.ticker);
    // Leaving the Studio: free the server for the next analysis instead of letting an orphan job run.
    if(this.jobId)void this.stopJob(this.jobId);
    this.busy=false;this.jobId='';this.phase=undefined;this.dialogOpen=false;this.setSource();
  }
  protected updated(){
    const dialog=this.renderRoot.querySelector<HTMLDialogElement>('dialog.job');
    if(dialog&&this.dialogOpen&&!dialog.open)dialog.showModal();else if(dialog&&!this.dialogOpen&&dialog.open)dialog.close();
    // Closing the confirmation takes its window off the page, so it only ever has to be opened.
    const ask=this.renderRoot.querySelector<HTMLDialogElement>('dialog.ask');
    if(ask&&!ask.open)ask.showModal();
  }
  protected willUpdate(changed:PropertyValues){
    if(changed.has('plan')&&this.plan!==this.draft){this.draft=this.plan?structuredClone(this.plan):undefined;this.usingDefault=false;this.floorIndex=0;}
    // Without a saved plan, start from the schematic plan of the HA areas (refreshed while untouched).
    if(!this.plan&&this.fallback&&(!this.draft||(this.usingDefault&&changed.has('fallback')))){this.draft=structuredClone(this.fallback);this.usingDefault=true;this.floorIndex=0;}
    if(changed.has('hass')&&this.hass&&!this.infoLoading){this.infoLoading=true;void this.loadInfo();}
  }
  /** Models offered before the analysis: the last one chosen in this browser, else the one in the options. */
  private async loadInfo(){
    try{
      const info=await this.hass!.callWS<ModelInfo>({type:'mp_glass/spatial/info'});
      let stored:string|null=null;
      try{stored=localStorage.getItem(QUALITY_KEY);}catch{/* Storage blocked: the options decide. */}
      this.info=info;
      if(info.backend==='gemini')this.quality=stored==='precise'||stored==='fast'?stored:info.quality??undefined;
    }catch{/* Older integration or not an administrator: the options decide. */}
  }
  private choose(quality?:Quality){
    this.quality=quality;
    try{if(quality)localStorage.setItem(QUALITY_KEY,quality);else localStorage.removeItem(QUALITY_KEY);}catch{/* Kept for this page only. */}
  }
  private get floor(){return this.draft?.floors[this.floorIndex]??this.draft?.floors[0];}
  private get room(){return this.floor?.rooms.find(r=>r.id===this.selected)??this.floor?.rooms[0];}
  private commit(plan:SpatialPlan){
    try{this.draft=parseSpatial(plan);this.usingDefault=false;this.message='Modifications prêtes. Cliquez sur Enregistrer dans le Studio.';this.detail='';this.dispatchEvent(new CustomEvent('spatial-change',{detail:this.draft,bubbles:true,composed:true}));}
    catch(error){this.message=(error as Error).message;}
  }
  private mutate(edit:(plan:SpatialPlan)=>void){if(!this.draft)return;const copy=structuredClone(this.draft);edit(copy);this.commit(copy);}
  /** Edits the room shown; doors and windows follow a change of its corners (see `reattachOpenings`), those left far from every wall go. */
  private editRoom(edit:(room:SpatialRoom)=>void){
    const id=this.room?.id;let lost=0;
    const before=this.draft;
    this.mutate(plan=>{
      const room=plan.floors[this.floorIndex]?.rooms.find(r=>r.id===id);
      if(!room)return;
      const previous=structuredClone(room);edit(room);
      if(!room.openings?.length)return;
      const openings=reattachOpenings(previous,room);lost=room.openings.length-openings.length;
      if(openings.length)room.openings=openings;else delete room.openings;
    });
    if(lost&&this.draft!==before)this.message=`Modifications prêtes. ${lost>1?`${lost} portes ou fenêtres, trop loin des murs modifiés, ont été retirées`:'Une porte ou une fenêtre, trop loin des murs modifiés, a été retirée'} : replacez-la${lost>1?'s':''} si besoin, puis cliquez sur Enregistrer dans le Studio.`;
  }
  /** Bend of the side leaving a corner: 0 straightens it, ±1 is a half circle. A room with nothing curved keeps no bends at all. */
  private editBend(index:number,value:number){
    this.editRoom(room=>{
      const bend=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));
      const arcs=room.polygon.map((_,i)=>i===index?bend:room.arcs?.[i]??0);
      if(arcs.some(bent))room.arcs=arcs;else delete room.arcs;
    });
  }
  private dropVertex(index:number){
    this.editRoom(room=>{
      room.polygon.splice(index,1);
      room.arcs?.splice(index,1);
      if(!room.arcs?.some(bent))delete room.arcs;
    });
  }
  /** A corner added in the middle of the last side, on its curve when it is curved. */
  private addVertex(){
    this.editRoom(room=>{
      const shape=splitSide(room.polygon,room.arcs,room.polygon.length-1);
      room.polygon=shape.polygon;
      if(shape.arcs)room.arcs=shape.arcs;
    });
  }
  private setSource(blob?:Blob){if(this.sourceUrl)URL.revokeObjectURL(this.sourceUrl);this.sourceUrl=blob?URL.createObjectURL(blob):'';this.sourceBlob=blob;}
  /** With the model chosen in the Studio; none chosen: the one in the integration options. */
  private async analyze(){
    if(!this.file||!this.hass?.fetchWithAuth||!this.confirmed||this.busy)return;
    const quality=this.quality;this.model='';this.errorCode='';this.quotaInfo=undefined;this.retryAt=0;
    this.busy=true;this.candidate=undefined;this.source=undefined;this.setSource();this.detail='';this.warnings=[];this.jobId='';this.phase='preparing';this.dialogOpen=true;this.startedAt=Date.now();this.message='Préparation du fichier…';
    clearInterval(this.ticker);this.ticker=setInterval(()=>{this.tick++;},1000);
    const generation=++this.generation;
    try{
      const body=await prepareUpload(this.file,this.page);
      if(this.disposed||generation!==this.generation)return;
      this.setSource(body);
      this.phase='uploading';this.message='Envoi du plan à Home Assistant…';
      const response=await this.hass.fetchWithAuth(`/api/mp_glass/spatial/analyze?page=${this.page}${quality?`&quality=${quality}`:''}`,{method:'POST',headers:{'Content-Type':body.type},body});
      if(!response.ok){
        const answer=await response.json().catch(()=>({})) as {error?:string};
        throw Error(answer.error??(response.status===404?'not_installed':response.status===401||response.status===403?'unauthorized':`http_${response.status}`));
      }
      const job=await response.json() as Job;
      // Cancelled while uploading: the job has just started, stop it so the next analysis is not "busy".
      if(this.disposed||generation!==this.generation){void this.stopJob(job.id);return;}
      this.jobId=job.id;this.model=job.model??'';this.phase='analyzing';this.message=`Analyse du plan par ${this.modelLabel}…`;
      await this.poll(job.id,generation);
    }catch(error){if(generation===this.generation)this.fail(error);}
  }
  private finish(phase:'done'|'error'){this.busy=false;this.phase=phase;this.jobId='';this.elapsed=Date.now()-this.startedAt;clearInterval(this.ticker);if(!this.disposed)this.dialogOpen=true;}
  private fail(error:unknown,detail='',quota?:Quota){
    const code=error instanceof TypeError?'network':error instanceof Error?error.message:String((error as {code?:string})?.code??error);
    const pages=Number(/^page_missing:(\d+)$/.exec(code)?.[1]);
    this.errorCode=code;this.quotaInfo=code==='quota'?quota:undefined;
    const overloaded=code==='provider_unavailable'&&this.alternative?`${this.modelLabel} est momentanément surchargé ; MP Glass a déjà réessayé deux fois. Réessayez dans quelques minutes, ou tout de suite avec ${this.alternative.label}.`:'';
    this.message=pages?`La page ${this.page} n’existe pas : ce PDF compte ${pages} page${pages>1?'s':''}.`:overloaded||this.quotaMessage()||MESSAGES[code]||`Analyse impossible (${code}). Le plan enregistré est conservé.`;this.detail=detail;this.finish('error');
    // A per-minute limit: "Réessayer" counts down the delay advised by Google.
    this.retryAt=this.quotaInfo?.period==='minute'?Date.now()+(this.quotaInfo.retry??60)*1000:0;
    if(this.retryAt)this.ticker=setInterval(()=>{this.tick++;if(Date.now()>=this.retryAt)clearInterval(this.ticker);},1000);
  }
  /** Which quota is exhausted, when it comes back, and that the other model has its own. */
  private quotaMessage(){
    const quota=this.quotaInfo;
    if(!quota)return '';
    const label=MODELS[quota.model]?.label??(quota.model||this.modelLabel),unit=quota.unit==='tokens'?'jetons':'requêtes';
    const other=this.alternative?` ${this.alternative.label} a son propre quota : vous pouvez l’essayer tout de suite.`:'';
    if(quota.limit===0)return `${label} n’a pas de quota gratuit dans ce projet Google (limite 0).${other}`;
    if(quota.period==='day')return `Quota gratuit du jour épuisé pour ${label}${quota.limit?` (${quota.limit} ${unit} par jour)`:''}. Google le renouvelle à minuit, heure de Californie, soit ${quotaReset()}.${other}`;
    if(quota.period==='minute')return `Limite par minute de ${label} atteinte${quota.limit?` (${quota.limit} ${unit} par minute)`:''} : réessayez dans ${quota.retry??60} secondes.`;
    return '';
  }
  private async poll(id:string,generation:number){
    try{
      const job=await this.hass!.callWS<Job>({type:'mp_glass/spatial/job',job_id:id});
      if(this.disposed||generation!==this.generation)return;
      if(job.status==='running'){
        if(Date.now()-this.startedAt>MAX_WAIT)throw Error('timeout');
        this.timer=setTimeout(()=>void this.poll(id,generation),2000);return;
      }
      if(job.status==='error'){this.fail(Error(job.error??'analysis_failed'),job.detail,job.quota);return;}
      this.candidate=parseSpatial(job.plan);this.warnings=job.warnings??[];
      const source=job.source,numbers=source?[source.width,source.height,...source.scale,...source.origin]:[];
      this.source=numbers.length===6&&numbers.every(Number.isFinite)?source:undefined;
      this.detection=this.source&&Array.isArray(job.detection)?job.detection.map((room,hue)=>({...room,hue})):undefined;this.history=[];this.walls=undefined;
      this.view=this.detection&&this.sourceUrl?'overlay':'3d';
      if(this.detection&&this.sourceBlob)void this.fitToWalls(generation);
      this.message=`Brouillon reçu : ${this.candidate.floors[0]!.rooms.length} pièce(s). Vérifiez l’échelle et les pièces avant de l’utiliser. ${this.warnings.join(' ')}`;
      this.finish('done');
    }catch(error){if(!this.disposed&&generation===this.generation)this.fail(error);}
  }
  private stopJob(id:string){return this.hass?.callWS({type:'mp_glass/spatial/cancel',job_id:id}).catch(()=>undefined);}
  private cancelAnalysis=()=>{
    const id=this.jobId;this.generation++;clearTimeout(this.timer);clearInterval(this.ticker);
    this.busy=false;this.phase=undefined;this.dialogOpen=false;this.jobId='';this.message='Analyse annulée. Le plan enregistré est conservé.';this.detail='';
    if(id)void this.stopJob(id);
  };
  private applyCandidate(){
    if(!this.candidate||this.recomputing)return;
    const incoming=structuredClone(this.candidate.floors[0]!);
    if(!incoming.rooms.length)return;
    for(const r of incoming.rooms)r.id=`room-${shortId()}`;
    let lost=0;
    if(this.floor){incoming.id=this.floor.id;incoming.name=this.floor.name;incoming.elevation=this.floor.elevation;incoming.height=this.floor.height;const used=new Set<string>();for(const r of incoming.rooms){const matches=this.floor.rooms.filter(o=>o.name.trim().toLocaleLowerCase()===r.name.trim().toLocaleLowerCase());const old=matches.length===1?matches[0]:undefined;if(old&&!used.has(old.id)){used.add(old.id);r.id=old.id;r.areaId=old.areaId;r.entityIds=old.entityIds;lost+=this.carryFixtures(old,r);}}}
    const plan=this.draft?structuredClone(this.draft):{version:1 as const,enabled:true,floors:[]};
    if(plan.floors.length)plan.floors[this.floorIndex]=incoming;else plan.floors.push(incoming);
    // The other imported rooms are linked by their name ("SDB" to "Salle de bain") when that is unambiguous: they then follow their area.
    const matches=matchAreas(plan,this.areas,this.floors);let linked=0;
    for(const r of incoming.rooms){const areaId=matches.get(r.id);if(areaId){r.areaId=areaId;linked++;}}
    const before=this.draft;this.commit(plan);
    if(linked&&this.draft!==before)this.message=`Niveau importé · ${count(linked,'pièce','reliée')} à Home Assistant par ${linked>1?'leur':'son'} nom : vérifiez, puis cliquez sur Enregistrer dans le Studio.`;
    if(lost&&this.draft!==before)this.message=`${this.message} ${lost>1?`${lost} portes ou fenêtres ne tombent plus sur un mur de leur pièce : replacez-les.`:'Une porte ou une fenêtre ne tombe plus sur un mur de sa pièce : replacez-la.'}`;
    this.candidate=undefined;this.selected='';this.phase=undefined;this.dialogOpen=false;this.setSource();
  }
  /**
   * What a room of the saved level keeps when its geometry is imported again: doors and windows on the same walls when it has as
   * many sides (the analysis numbers them the same way), televisions and speakers at the same place relative to its extent.
   * Returns how many doors and windows were left behind.
   */
  private carryFixtures(old:SpatialRoom,room:SpatialRoom){
    const extent=(r:SpatialRoom)=>{const ring=roomOutline(r),xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)||1,h:Math.max(...ys)-Math.min(...ys)||1};};
    const [from,to]=[extent(old),extent(room)];
    if(old.media?.length)room.media=old.media.map(m=>({...m,at:[round(to.x+(m.at[0]-from.x)/from.w*to.w),round(to.y+(m.at[1]-from.y)/from.h*to.h)] as Point}));
    const kept=old.polygon.length===room.polygon.length?old.openings??[]:[];
    if(kept.length)room.openings=kept;
    return (old.openings?.length??0)-kept.length;
  }
  /** Room of an entity for the whole of MP Glass (dashboard pages and plan), stored with the project like the Équipements section does. */
  private assign(device:LogicalDevice,patch:Override){this.dispatchEvent(new CustomEvent('override-change',{detail:{entityKey:device.entityKey,patch},bubbles:true,composed:true}));}
  /** Linking a room makes it follow the area, unless equipment was already chosen for it. */
  private linkRoom(areaId:string){this.editRoom(r=>{if(areaId)r.areaId=areaId;else delete r.areaId;if(areaId&&!r.entityIds?.length)delete r.entityIds;});}
  /** A list chosen by hand can follow its area without losing anything when all of it is in the area. */
  private withinArea(room:SpatialRoom){const own=new Set(areaEquipment(room.areaId!,this.devices).slice(0,ROOM_ENTITY_LIMIT).map(d=>d.entityId));return (room.entityIds??[]).every(id=>own.has(id));}
  /** Links rooms by name and lets hand-made lists follow their area when nothing would disappear from them. */
  private linkAll(suggestions:Map<string,string>){
    let linked=0,automatic=0,kept=0;const pending:string[]=[];
    const before=this.draft;
    this.mutate(plan=>{for(const room of plan.floors.flatMap(f=>f.rooms)){
      const areaId=room.areaId??suggestions.get(room.id);
      if(!areaId){pending.push(room.name);continue;}
      if(!room.areaId){room.areaId=areaId;linked++;}
      if(room.entityIds&&this.withinArea(room)){delete room.entityIds;automatic++;}
      else if(room.entityIds)kept++;
    }});
    if(this.draft===before)return;
    const done=[linked?`${count(linked,'pièce','reliée')} par ${linked>1?'leur':'son'} nom`:'',automatic?`${count(automatic,'pièce','passée')} en automatique`:'',kept?`${count(kept,'pièce')} ${kept>1?'gardent leur':'garde sa'} liste à la main (équipements d’autres pièces)`:''].filter(Boolean).join(' · ');
    this.message=`${done||'Aucune nouvelle association'}${pending.length?`. À relier à la main : ${pending.join(', ')}`:''}. Vérifiez, puis cliquez sur Enregistrer dans le Studio.`;
  }
  private roomSelected=(e:CustomEvent<{floorId:string;roomId:string}>)=>{
    const index=this.draft?.floors.findIndex(f=>f.id===e.detail.floorId)??-1;
    if(index<0)return;
    if(this.placing&&this.placing.roomId!==e.detail.roomId)this.placing=undefined;
    if(this.selected!==e.detail.roomId)this.entitySearch='';
    this.floorIndex=index;this.selected=e.detail.roomId;
  };
  /** A floor opened on the plan becomes the one edited. */
  private floorSelected=(e:CustomEvent<{floorId:string}>)=>{
    const index=this.draft?.floors.findIndex(f=>f.id===e.detail.floorId)??-1;
    if(index<0||index===this.floorIndex)return;
    this.placing=undefined;
    this.floorIndex=index;this.selected='';this.entitySearch='';
  };
  private discard=()=>{this.candidate=undefined;this.phase=undefined;this.dialogOpen=false;this.setSource();this.message='Brouillon ignoré. Le plan enregistré est conservé.';};
  /** The saved plan goes away: the schematic plan of the Home Assistant areas takes over until the Studio is saved. */
  private removePlan=()=>{
    this.asking='';
    if(!this.plan)return;
    // `draft` is left to `willUpdate`, which swaps in the schematic plan once the Studio drops the saved one.
    this.selected='';this.entitySearch='';
    this.message='Plan supprimé. Cliquez sur Enregistrer dans le Studio pour le retirer pour de bon ; sans plan enregistré, MP Glass repart de vos pièces Home Assistant.';this.detail='';
    this.dispatchEvent(new CustomEvent<SpatialPlan|undefined>('spatial-change',{detail:undefined,bubbles:true,composed:true}));
  };
  /** The level on screen goes away, never the last one: a plan always keeps a level. */
  private removeFloor=()=>{
    this.asking='';
    if((this.draft?.floors.length??0)<=1)return;
    const name=this.floor?.name??'';
    this.mutate(p=>{p.floors.splice(this.floorIndex,1);});
    this.floorIndex=Math.min(this.floorIndex,(this.draft?.floors.length??1)-1);this.selected='';this.entitySearch='';
    this.message=`Niveau « ${name} » supprimé. Cliquez sur Enregistrer dans le Studio.`;
  };
  /** Asks before a level or the whole saved plan goes away; both come back by leaving the Studio without saving. */
  private askDialog(){
    if(!this.asking)return nothing;
    const plan=this.asking==='plan';
    return html`<dialog class="ask" aria-labelledby="ask-title" @close=${()=>{this.asking='';}}>
      <h3 id="ask-title">${plan?'Supprimer le plan enregistré ?':`Supprimer le niveau « ${this.floor?.name??''} » ?`}</h3>
      <p>${plan
        ?'Ses niveaux, ses pièces et leurs associations aux pièces de Home Assistant sont perdus. Le dashboard repart alors du plan déduit de vos pièces Home Assistant.'
        :'Ses pièces et leurs associations sont perdues. Les autres niveaux ne changent pas.'}</p>
      <p>Rien n’est retiré tant que vous n’avez pas cliqué sur Enregistrer dans le Studio.</p>
      <div class="ask-actions"><button autofocus @click=${()=>{this.asking='';}}>Annuler</button><button class="danger" @click=${plan?this.removePlan:this.removeFloor}>Supprimer</button></div>
    </dialog>`;
  }
  /** Can the draft still be corrected? Only with the analysed image and its rooms at hand. */
  private get editable(){return !!(this.detection&&this.source&&this.sourceUrl);}
  /** The result window closed on a kept draft: it reopens where the rooms are corrected, without a new analysis. */
  private reopen=()=>{if(!this.candidate)return;if(this.editable)this.view='overlay';this.phase='done';this.dialogOpen=true;};
  /** Right after the analysis, the edges of Gemini's boxes are moved onto the walls drawn on the plan (undoable). */
  private async fitToWalls(generation:number){
    const original=this.detection;
    try{
      const walls=await detectWalls(this.sourceBlob!);
      if(generation!==this.generation||!this.detection)return;
      this.walls=walls;
      if(this.detection!==original||this.recomputing)return;
      let moved=0;
      const fitted=this.detection.map(room=>{
        if(room.polygon){
          // Straight sides along the axes are put on the walls; a curved or slanted side is left as it was drawn.
          const polygon=snapOutline(room.polygon,walls,20,20,room.arcs);
          moved+=polygon.filter((p,i)=>p.some((v,k)=>Math.abs(v-room.polygon![i]![k]!)>.01)).length;
          const drawn=outline(polygon.map(([y,x])=>[x!,y!] as [number,number]),room.arcs);
          const xs=drawn.map(p=>p[0]),ys=drawn.map(p=>p[1]);
          return {...room,polygon,box_2d:[Math.min(...ys),Math.min(...xs),Math.max(...ys),Math.max(...xs)]};
        }
        const box=snapBox(room.box_2d,walls,20,20).map(v=>Math.round(v*100)/100);
        moved+=box.filter((v,i)=>Math.abs(v-room.box_2d[i]!)>.01).length;
        return {...room,box_2d:box};
      });
      if(moved)await this.recompute(fitted,this.detection,`${moved} bord${moved>1?'s':''} de pièce ajusté${moved>1?'s':''} aux murs du plan.`);
    }catch{/* Walls unknown: the rooms stay as detected. */}
  }
  /** Plan rebuilt by Home Assistant from edited rooms: same geometry as the analysis, no Gemini call. `previous` goes to the undo history. */
  private async recompute(detection:DetectionRoom[],previous:DetectionRoom[]|null=this.detection??null,note=''){
    if(!this.hass||!this.source||this.recomputing)return;
    this.recomputing=true;const generation=this.generation;
    try{
      // Browser-only keys stay here; the colours come back with the rooms, in the same order.
      const rooms=detection.map(room=>{const copy={...room};delete copy.id;delete copy.hue;return copy;});
      const result=await this.hass.callWS<{plan:SpatialPlan;warnings:string[];source:Source;detection:DetectionRoom[]}>({type:'mp_glass/spatial/normalize',rooms,width:this.source.width,height:this.source.height,scale:this.source.scale});
      if(!this.candidate||generation!==this.generation)return;  // Discarded or replaced in the meantime.
      this.candidate=parseSpatial(result.plan);this.source=result.source;
      this.detection=result.detection.length===detection.length?result.detection.map((room,i)=>({...room,hue:detection[i]!.hue??i})):result.detection;
      this.warnings=note?[note,...result.warnings]:result.warnings;
      if(previous)this.history=[...this.history,previous].slice(-30);
    }catch(error){this.warnings=[`Modification impossible : ${(error as {message?:string})?.message??String(error)}`,...this.warnings];}
    finally{this.recomputing=false;}
  }
  private zonesChanged=(e:CustomEvent<DetectionRoom[]>)=>{void this.recompute(e.detail);};
  private zonesUndo=()=>{const previous=this.history.at(-1);if(!previous)return;this.history=this.history.slice(0,-1);void this.recompute(previous,null);};
  private addRoom(){
    if(!this.draft){this.commit({version:1,enabled:true,floors:[{id:'ground',name:'Rez-de-chaussée',elevation:0,height:2.6,rooms:[{id:'room-1',name:'Nouvelle pièce',polygon:[[0,0],[4,0],[4,4],[0,4]]}]}]});return;}
    this.mutate(p=>{const f=p.floors[this.floorIndex]!;const x=Math.max(...f.rooms.flatMap(r=>r.polygon.map(v=>v[0])))+.3;const id=`room-${shortId()}`;f.rooms.push({id,name:'Nouvelle pièce',polygon:[[x,0],[x+4,0],[x+4,4],[x,4]]});this.selected=id;});
  }
  /** Modal window: steps and elapsed time during the analysis, then the draft with its 3D preview, or the failure. */
  private renderJob(floorName?:string){
    if(!this.phase)return nothing;
    const seconds=Math.round((this.busy?Date.now()-this.startedAt:this.elapsed)/1000),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    let body;
    if(this.busy){
      const steps:[string,string][]=[['preparing','Préparation du fichier'],['uploading','Envoi à Home Assistant'],['analyzing',`Analyse du plan par ${this.modelLabel}`]];
      const current=steps.findIndex(([id])=>id===this.phase),pdf=this.file?.type==='application/pdf'||/\.pdf$/i.test(this.file?.name??'');
      body=html`<header class="job-head"><span class="job-orb scan">${mpIcon('scan',26)}</span><div><small>Plan 3D · Gemini</small><h3 id="job-title">Analyse du plan en cours</h3><p>${this.file?.name??''}${pdf?` · page ${this.page}`:''}</p></div></header>
        <ol class="steps">${steps.map(([id,label],i)=>html`<li class=${i<current?'done':i===current?'current':''}><span class="dot">${i<current?mpIcon('check',12):nothing}</span><span>${label}</span>${id==='analyzing'&&i===current?html`<time>${time}</time>`:nothing}</li>`)}</ol>
        <div class="bar" aria-hidden="true"><span></span></div>
        <p role="status" class="job-status">${this.message}</p>
        <p class="muted">Généralement moins d’une minute, jusqu’à quelques minutes pour un grand plan. Le plan enregistré n’est pas modifié.</p>
        <div class="job-actions"><button @click=${this.cancelAnalysis}>Annuler l’analyse</button></div>`;
    }else if(this.phase==='done'&&this.candidate){
      const rooms=this.candidate.floors[0]!.rooms,area=rooms.reduce((sum,r)=>sum+roomArea(r),0);
      const drawn=rooms.flatMap(r=>roomOutline(r)),xs=drawn.map(p=>p[0]),ys=drawn.map(p=>p[1]);
      const metres=(value:number)=>new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(value),plural=rooms.length>1?'s':'';
      body=html`<header class="job-head"><span class="job-orb ok">${mpIcon('check',26)}</span><div><small>Brouillon IA · non enregistré</small><h3 id="job-title">${rooms.length} pièce${plural} reconnue${plural}</h3><p>${metres(area)} m² · ${metres(Math.max(...xs)-Math.min(...xs))} × ${metres(Math.max(...ys)-Math.min(...ys))} m · analysé en ${time}</p></div></header>
        ${this.detection&&this.source&&this.sourceUrl?html`<div class="tabs" role="tablist" aria-label="Affichage du brouillon"><button role="tab" aria-selected=${this.view==='overlay'} @click=${()=>{this.view='overlay';}}>Sur le plan d’origine</button><button role="tab" aria-selected=${this.view==='3d'} @click=${()=>{this.view='3d';}}>En 3D</button></div>`:nothing}
        ${this.view==='overlay'&&this.detection&&this.source&&this.sourceUrl?html`<mp-plan-zones .src=${this.sourceUrl} .source=${this.source} .plan=${this.candidate} .detection=${this.detection} .walls=${this.walls} ?busy=${this.recomputing} ?canUndo=${this.history.length>0} @zones-change=${this.zonesChanged} @zones-undo=${this.zonesUndo}></mp-plan-zones>`:html`<mp-spatial-viewer preview .plan=${this.candidate}></mp-spatial-viewer>`}
        ${this.warnings.length?html`<ul class="warnings">${this.warnings.map(w=>html`<li>${w}</li>`)}</ul>`:nothing}
        <p role="status" class="job-status">Vérifiez les pièces et l’échelle. Le brouillon remplacera la géométrie du niveau ${floorName?`« ${floorName} »`:'sélectionné'} ; les associations des pièces de même nom sont reprises.</p>
        <div class="job-actions"><button @click=${this.discard}>Ignorer</button><button class="primary" ?disabled=${!this.hass?.user?.is_admin||this.recomputing||!rooms.length} @click=${this.applyCandidate}>Utiliser pour ce niveau</button></div>`;
    }else{
      const quota=this.errorCode==='quota',daily=quota&&(this.quotaInfo?.period==='day'||this.quotaInfo?.limit===0);
      // The other model on a click, never on its own: after an overload, or a quota that is not a matter of seconds (each model has its own).
      const other=this.file&&this.confirmed&&(this.errorCode==='provider_unavailable'||(quota&&this.quotaInfo?.period!=='minute'))?this.alternative:undefined;
      const wait=Math.ceil((this.retryAt-Date.now())/1000);
      body=html`<header class="job-head"><span class="job-orb fail">${mpIcon('close',24)}</span><div><small>Plan 3D · Gemini</small><h3 id="job-title">Analyse impossible</h3><p>Le plan enregistré est conservé.</p></div></header>
        <p role="status" class="job-status failure">${this.message}${this.detail?html`<small>Détail technique : ${this.detail}</small>`:nothing}</p>
        ${quota?html`<p class="muted"><a href="https://ai.dev/rate-limit" target="_blank" rel="noopener noreferrer">Voir vos quotas Gemini</a> · MP Glass ne relance jamais de lui-même une analyse refusée pour quota.</p>`:nothing}
        <div class="job-actions"><button @click=${()=>{this.dialogOpen=false;}}>Fermer</button>${other?html`<button class=${daily?'primary':''} @click=${()=>{this.choose(other.quality);void this.analyze();}}>Réessayer avec ${other.label}</button>`:nothing}${this.file&&this.confirmed?html`<button class=${daily?'':'primary'} ?disabled=${wait>0} @click=${()=>this.analyze()}>${wait>0?`Réessayer dans ${wait} s`:'Réessayer'}</button>`:nothing}</div>`;
    }
    // Escape does not interrupt a running analysis: only "Annuler l’analyse" does.
    // A draft to correct on its plan takes the whole screen: the larger the plan, the easier its rooms are to adjust.
    return html`<dialog class=${`job${this.phase==='done'&&this.candidate&&this.editable?' wide':''}`} aria-labelledby="job-title" @cancel=${(e:Event)=>{if(this.busy)e.preventDefault();}} @close=${()=>{this.dialogOpen=false;}}>${body}</dialog>`;
  }
  /** Model for the next analysis, in direct mode: the default one (integration options) is marked. */
  private renderModelChoice(){
    const info=this.info;
    if(info?.backend!=='gemini')return nothing;
    return html`<label>Modèle d’analyse<select @change=${(e:Event)=>this.choose(((e.target as HTMLSelectElement).value||undefined) as Quality|undefined)}>
      ${info.quality||!info.model?nothing:html`<option value="" .selected=${!this.quality}>Modèle des options (${info.model})</option>`}
      ${Object.entries(MODELS).map(([id,m])=>html`<option value=${m.quality} .selected=${this.quality===m.quality}>${m.label} — ${m.hint}${info.model===id?' · réglage par défaut':''}</option>`)}
    </select></label>`;
  }
  private entityPicker(room:SpatialRoom){
    const ids=room.entityIds??[],states=this.hass?.states??{},query=this.entitySearch.trim().toLocaleLowerCase();
    const candidates=[...new Set([...ids,...Object.keys(states).filter(id=>/^(light|cover|sensor|binary_sensor|climate|media_player)\./.test(id))])]
      .filter(id=>`${id} ${states[id]?.attributes.friendly_name??''}`.toLocaleLowerCase().includes(query))
      .sort((a,b)=>Number(ids.includes(b))-Number(ids.includes(a))||String(states[a]?.attributes.friendly_name??a).localeCompare(String(states[b]?.attributes.friendly_name??b)));
    const temperatures=ids.filter(id=>id.startsWith('sensor.')&&roomTemperature({...room,entityIds:[id]},states));
    return html`<div class="equipment-head"><strong>Équipements choisis à la main · ${ids.length} / 12</strong>${room.areaId?html`<button @click=${()=>this.editRoom(r=>{delete r.entityIds;})}>Suivre la pièce Home Assistant</button>`:nothing}</div><p class="muted">${room.areaId?'Cette pièce garde sa propre liste : un équipement ajouté à sa pièce Home Assistant ne s’y ajoute pas.':'Reliez cette pièce à une pièce Home Assistant : ses lumières, volets, thermostats, capteurs, téléviseurs et enceintes s’afficheront d’eux-mêmes. Sinon, cochez-les ici.'}</p>
      <label>Rechercher un équipement<input type="search" .value=${this.entitySearch} @input=${(e:Event)=>{this.entitySearch=(e.target as HTMLInputElement).value;}}></label>
      <div class="entity-list" role="group" aria-label="Équipements de la pièce">${repeat(candidates,id=>id,id=>html`<label><input type="checkbox" .checked=${ids.includes(id)} ?disabled=${!ids.includes(id)&&ids.length>=12} @change=${(e:Event)=>{const checked=(e.target as HTMLInputElement).checked;if(checked&&ids.length>=12)return;this.editRoom(r=>{r.entityIds=checked?[...(r.entityIds??[]),id]:(r.entityIds??[]).filter(v=>v!==id);});}}><span>${String(states[id]?.attributes.friendly_name??id)}<small>${id}${!states[id]||['unknown','unavailable'].includes(states[id]!.state)?' · indisponible':''}</small></span></label>`)}</div>
      ${!candidates.length?html`<p class="muted">Aucun équipement correspondant.</p>`:nothing}
      ${temperatures.length>1?html`<label>Température principale<select .value=${temperatures[0]!} @change=${(e:Event)=>{const id=(e.target as HTMLSelectElement).value;this.editRoom(r=>{r.entityIds=[id,...(r.entityIds??[]).filter(v=>v!==id)];});}}>${temperatures.map(id=>html`<option value=${id}>${String(states[id]?.attributes.friendly_name??id)}</option>`)}</select></label>`:nothing}`;
  }
  /** Equipment of the linked area, kept up to date; moving or hiding one changes it for the dashboard too. */
  private automatic(room:SpatialRoom){
    const areaId=room.areaId!,areaName=this.areas.find(a=>a.area_id===areaId)?.name??areaId,states=this.hass?.states??{};
    const all=areaEquipment(areaId,this.devices),list=all.slice(0,ROOM_ENTITY_LIMIT);
    return html`<div class="equipment-head"><strong>Équipements automatiques · ${list.length}</strong><button ?disabled=${!list.length} @click=${()=>this.editRoom(r=>{r.entityIds=list.map(d=>d.entityId);})}>Choisir à la main</button></div>
      <p class="muted">Ceux de la pièce Home Assistant « ${areaName} », tenus à jour : un équipement placé dans cette pièce apparaît ici, sur le plan comme sur le dashboard.${all.length>list.length?` ${list.length} affichés sur ${all.length}.`:''}</p>
      ${list.length?html`<ul class="equipment" aria-label="Équipements de la pièce">${repeat(list,d=>d.entityId,d=>html`<li>${mpIcon(KIND_ICONS[d.planKind!],18)}<span>${d.name}<small>${d.entityId}${available(states[d.entityId])?'':' · indisponible'}</small></span><select aria-label=${`Pièce de ${d.name}`} title="Changer de pièce ou masquer" @change=${(e:Event)=>{const value=(e.target as HTMLSelectElement).value;this.assign(d,value==='hide'?{hidden:true}:{areaId:value});}}><option value=${areaId} selected>${areaName}</option>${this.areas.filter(a=>a.area_id!==areaId).map(a=>html`<option value=${a.area_id}>Déplacer vers ${a.name}</option>`)}<option value="hide">Masquer (plan et dashboard)</option></select></li>`)}</ul>`:html`<p class="muted">Aucune lumière, aucun volet, thermostat, capteur ou lecteur dans « ${areaName} » pour l’instant.</p>`}
      ${this.addEquipment(room)}`;
  }
  /** A wall of the room for the list of walls: its number, where it faces on the plan seen from above, and its length. */
  private sideLabel(room:SpatialRoom,index:number){
    const {inward}=wallFrame(room,index,.5),angle=Math.atan2(-inward[1],-inward[0]);
    const facing=DIRECTIONS[((Math.round(angle/(Math.PI/4))%8)+8)%8]!,length=new Intl.NumberFormat('fr',{maximumFractionDigits:2}).format(sideLength(room,index));
    return `Mur ${index+1} · ${facing} · ${length} m${bent(room.arcs?.[index])?' · courbe':''}`;
  }
  private openingName(room:SpatialRoom,opening:SpatialOpening){
    if(opening.name)return opening.name;
    const same=(room.openings??[]).filter(o=>o.kind===opening.kind);
    return same.length>1?`${OPENING_NAMES[opening.kind]} ${same.indexOf(opening)+1}`:OPENING_NAMES[opening.kind];
  }
  private mediaName(room:SpatialRoom,item:SpatialMedia){
    if(item.name)return item.name;
    const same=(room.media??[]).filter(m=>m.kind===item.kind);
    return same.length>1?`${MEDIA_NAMES[item.kind]} ${same.indexOf(item)+1}`:MEDIA_NAMES[item.kind];
  }
  private editOpening(id:string,edit:(opening:SpatialOpening)=>void){this.editRoom(r=>{const opening=r.openings?.find(o=>o.id===id);if(opening)edit(opening);});}
  private editMedia(id:string,edit:(item:SpatialMedia)=>void){this.editRoom(r=>{const item=r.media?.find(m=>m.id===id);if(item)edit(item);});}
  /** The next tap on the plan places this door, window, television or speaker; the plan comes into view to be touched. */
  private startPlacing(what:Placing['what'],id:string,name:string){
    const room=this.room,floor=this.floor;
    if(!room||!floor)return;
    this.placing={what,id,floorId:floor.id,roomId:room.id,prompt:what==='opening'?`Touchez sur le plan le mur de « ${room.name} » qui reçoit « ${name} »`:`Touchez sur le plan l’endroit de « ${room.name} » où placer « ${name} »`};
    const viewer=this.renderRoot.querySelector('mp-spatial-viewer');
    viewer?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }
  private stopPlacing=()=>{this.placing=undefined;};
  /** A tap while placing: a door or a window goes on the wall nearest to it, a television or a speaker where the floor was touched. */
  private picked=(e:CustomEvent<{floorId:string;roomId:string;point:Point}>)=>{
    const placing=this.placing,floor=this.draft?.floors.find(f=>f.id===placing?.floorId),room=floor?.rooms.find(r=>r.id===placing?.roomId);
    if(!placing||!room||e.detail.roomId!==placing.roomId)return;
    const point=e.detail.point,near=nearestSide(room,point);
    if(placing.what==='opening'){
      if(near.distance>1){this.message=`Touchez un mur de « ${room.name} » pour y placer l’ouverture, ou Annuler.`;return;}
      this.editOpening(placing.id,o=>{o.side=near.side;o.at=Math.round(near.t*1e4)/1e4;});
    }else{
      if(!insideRoom(room,point)&&near.distance>.3){this.message=`Touchez le sol de « ${room.name} », ou Annuler.`;return;}
      this.editMedia(placing.id,m=>{m.at=[round(point[0]),round(point[1])];});
    }
    this.placing=undefined;
  };
  /** A door or a window on the longest wall of the room, in its middle, then placed with a tap on the plan. */
  private addOpening(kind:OpeningKind){
    const room=this.room;
    if(!room||(room.openings?.length??0)>=24)return;
    const side=room.polygon.map((_,i)=>i).reduce((best,i)=>sideLength(room,i)>sideLength(room,best)?i:best,0),id=`opening-${shortId()}`;
    const opening:SpatialOpening={id,kind,side,at:.5,width:Math.max(.3,round(Math.min(OPENING_SIZES[kind].width,sideLength(room,side)*.8)))};
    this.editRoom(r=>{r.openings=[...(r.openings??[]),opening];});
    const added=this.room?.openings?.find(o=>o.id===id);
    if(added)this.startPlacing('opening',id,this.openingName(this.room!,added));
  }
  /**
   * A television or a speaker in the middle of the room, linked to the first player of the room of its kind not placed yet
   * (a television to a TV, a speaker to anything else), then placed with a tap on the plan.
   */
  private addMedia(kind:MediaKind){
    const room=this.room;
    if(!room||(room.media?.length??0)>=12)return;
    const states=this.hass?.states??{},placed=new Set((this.draft?.floors??[]).flatMap(f=>f.rooms.flatMap(r=>(r.media??[]).flatMap(m=>m.entityId?[m.entityId]:[]))));
    const own=[...(this.shownRoom(room)?.entityIds??[])].filter(id=>id.startsWith('media_player.')&&!placed.has(id)&&(states[id]?.attributes.device_class==='tv')===(kind==='tv'));
    const ring=roomOutline(room),xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),middle:Point=[round((Math.min(...xs)+Math.max(...xs))/2),round((Math.min(...ys)+Math.max(...ys))/2)];
    const id=`media-${shortId()}`,item:SpatialMedia={id,kind,at:insideRoom(room,middle)?middle:[round(ring[0]![0]),round(ring[0]![1])],...(own[0]?{entityId:own[0]}:{})};
    this.editRoom(r=>{r.media=[...(r.media??[]),item];});
    const added=this.room?.media?.find(m=>m.id===id);
    if(added)this.startPlacing('media',id,this.mediaName(this.room!,added));
  }
  /** The room as the dashboard shows it: a room that follows its area lists its equipment. */
  private shownRoom(room:SpatialRoom){return this.shown?.floors.flatMap(f=>f.rooms).find(r=>r.id===room.id);}
  /** Where else on the plan each entity is linked to a door or a window, to tell before linking it twice. */
  private openingLinks(){
    const links=new Map<string,string>();
    for(const floor of this.draft?.floors??[])for(const room of floor.rooms)for(const opening of room.openings??[])for(const id of opening.entityIds??[])links.set(id,`${room.name} · ${this.openingName(room,opening)}`);
    return links;
  }
  /** Doors and windows of the room: their kind and name, their wall and place on it, their size, and their covers and sensors. */
  private openingsEditor(room:SpatialRoom){
    const openings=room.openings??[];
    return html`<section class="fixtures" aria-label="Portes et fenêtres de la pièce"><div class="equipment-head"><strong>Portes et fenêtres · ${openings.length}</strong><div class="adders">${(['door','window','french_window'] as const).map(kind=>html`<button ?disabled=${openings.length>=24} @click=${()=>this.addOpening(kind)}>${mpIcon(OPENING_ICONS[kind],16)}${OPENING_NAMES[kind]}</button>`)}</div></div>
      <p class="muted">Placez-les sur les murs de la pièce puis reliez-y leurs volets roulants, stores, rideaux et capteurs d’ouverture : le plan les montre ouverts ou fermés et les commande.</p>
      ${repeat(openings,o=>o.id,o=>this.openingEditor(room,o))}</section>`;
  }
  private openingEditor(room:SpatialRoom,opening:SpatialOpening){
    const name=this.openingName(room,opening),size=OPENING_SIZES[opening.kind],placing=this.placing?.id===opening.id;
    const states=this.hass?.states??{},linked=opening.entityIds??[],links=this.openingLinks(),own=new Set(this.shownRoom(room)?.entityIds??[]);
    const area=room.areaId?new Set(this.devices.filter(d=>d.areaId===room.areaId).map(d=>d.entityId)):new Set<string>();
    const label=(id:string)=>String(states[id]?.attributes.friendly_name??id);
    const kind=(id:string)=>id.startsWith('cover.')?COVER_NAMES[String(states[id]?.attributes.device_class??'')]??'Volet':'Capteur d’ouverture';
    const candidates=[...new Set([...linked,...Object.keys(states).filter(id=>id.startsWith('cover.')||(id.startsWith('binary_sensor.')&&contact(states[id]?.attributes.device_class)))])]
      .sort((a,b)=>Number(linked.includes(b))-Number(linked.includes(a))||Number(own.has(b)||area.has(b))-Number(own.has(a)||area.has(a))||label(a).localeCompare(label(b)));
    return html`<div class=${`fixture${placing?' placing':''}`} role="group" aria-label=${name}>
      <div class="fixture-head">${mpIcon(OPENING_ICONS[opening.kind],18)}
        <select aria-label=${`Type de ${name}`} @change=${(e:Event)=>{const next=(e.target as HTMLSelectElement).value as OpeningKind;this.editOpening(opening.id,o=>{if(o.width===size.width)o.width=OPENING_SIZES[next].width;o.kind=next;delete o.height;delete o.sill;});}}>${(['door','window','french_window'] as const).map(k=>html`<option value=${k} .selected=${k===opening.kind}>${OPENING_NAMES[k]}</option>`)}</select>
        <input aria-label=${`Nom de ${name}`} maxlength="80" placeholder=${name} .value=${opening.name??''} @change=${(e:Event)=>{const value=(e.target as HTMLInputElement).value.trim();this.editOpening(opening.id,o=>{if(value)o.name=value;else delete o.name;});}}>
        <button aria-pressed=${placing} @click=${()=>placing?this.stopPlacing():this.startPlacing('opening',opening.id,name)}>${mpIcon('pin',15)}${placing?'Touchez le plan…':'Placer sur le plan'}</button>
        <button class="danger" aria-label=${`Supprimer ${name}`} title="Supprimer" @click=${()=>{if(placing)this.stopPlacing();this.editRoom(r=>{r.openings=r.openings?.filter(o=>o.id!==opening.id);if(!r.openings?.length)delete r.openings;});}}>×</button></div>
      <div class="row"><label>Mur<select aria-label=${`Mur de ${name}`} @change=${(e:Event)=>{const side=Number((e.target as HTMLSelectElement).value);this.editOpening(opening.id,o=>{o.side=side;});}}>${room.polygon.map((_,i)=>html`<option value=${i} .selected=${i===opening.side}>${this.sideLabel(room,i)}</option>`)}</select></label>
        <label>Position le long du mur · ${Math.round(opening.at*100)} %<input type="range" min="0" max="100" step="1" aria-label=${`Position de ${name} le long du mur`} .value=${String(Math.round(opening.at*100))} @change=${(e:Event)=>{const at=Number((e.target as HTMLInputElement).value)/100;this.editOpening(opening.id,o=>{o.at=at;});}}></label></div>
      <div class="row"><label>Largeur (m)<input type="number" min="0.3" max="12" step="0.05" aria-label=${`Largeur de ${name}`} .value=${String(opening.width)} @change=${(e:Event)=>{const value=Number((e.target as HTMLInputElement).value);if(value>=.3&&value<=12)this.editOpening(opening.id,o=>{o.width=round(value);});}}></label>
        <label>Hauteur (m)<input type="number" min="0.3" max="8" step="0.05" aria-label=${`Hauteur de ${name}`} .value=${String(opening.height??size.height)} @change=${(e:Event)=>{const value=Number((e.target as HTMLInputElement).value);if(value>=.3&&value<=8)this.editOpening(opening.id,o=>{o.height=round(value);});}}></label>
        ${opening.kind==='window'?html`<label>Allège (m)<input type="number" min="0" max="6" step="0.05" aria-label=${`Allège de ${name}`} .value=${String(opening.sill??size.sill)} @change=${(e:Event)=>{const value=Number((e.target as HTMLInputElement).value);if(value>=0&&value<=6)this.editOpening(opening.id,o=>{o.sill=round(value);});}}></label>`:nothing}</div>
      <div class="equipment-head"><strong>Volets, stores, rideaux et capteurs · ${linked.length} / 4</strong></div>
      ${candidates.length?html`<div class="entity-list" role="group" aria-label=${`Équipements de ${name}`}>${repeat(candidates,id=>id,id=>{const elsewhere=links.get(id),here=linked.includes(id);return html`<label><input type="checkbox" .checked=${here} ?disabled=${!here&&linked.length>=4} @change=${(e:Event)=>{const checked=(e.target as HTMLInputElement).checked;this.editOpening(opening.id,o=>{const ids=(o.entityIds??[]).filter(v=>v!==id);if(checked&&ids.length<4)ids.push(id);if(ids.length)o.entityIds=ids;else delete o.entityIds;});}}><span>${label(id)}<small>${kind(id)} · ${id}${!here&&elsewhere?` · déjà sur ${elsewhere}`:''}${!states[id]||['unknown','unavailable'].includes(states[id]!.state)?' · indisponible':''}</small></span></label>`;})}</div>`:html`<p class="muted">Aucun volet, store, rideau ou capteur d’ouverture dans Home Assistant.</p>`}
    </div>`;
  }
  /** Televisions and speakers of the room: their kind and name, their player, and where they stand. */
  private mediaEditor(room:SpatialRoom){
    const media=room.media??[],states=this.hass?.states??{},own=new Set(this.shownRoom(room)?.entityIds??[]);
    const players=Object.keys(states).filter(id=>id.startsWith('media_player.')).sort((a,b)=>Number(own.has(b))-Number(own.has(a))||String(states[a]?.attributes.friendly_name??a).localeCompare(String(states[b]?.attributes.friendly_name??b)));
    return html`<section class="fixtures" aria-label="Audio et vidéo de la pièce"><div class="equipment-head"><strong>Audio et vidéo · ${media.length}</strong><div class="adders">${(['tv','speaker'] as const).map(kind=>html`<button ?disabled=${media.length>=12} @click=${()=>this.addMedia(kind)}>${mpIcon(kind,16)}${MEDIA_NAMES[kind]}</button>`)}</div></div>
      <p class="muted">Placez téléviseurs et enceintes dans la pièce et reliez-les à leur lecteur Home Assistant : le plan les montre allumés ou en lecture, et la fiche de la pièce les commande.</p>
      ${repeat(media,m=>m.id,item=>{
        const name=this.mediaName(room,item),placing=this.placing?.id===item.id;
        return html`<div class=${`fixture${placing?' placing':''}`} role="group" aria-label=${name}>
          <div class="fixture-head">${mpIcon(item.kind,18)}
            <select aria-label=${`Type de ${name}`} @change=${(e:Event)=>{const kind=(e.target as HTMLSelectElement).value as MediaKind;this.editMedia(item.id,m=>{m.kind=kind;});}}>${(['tv','speaker'] as const).map(k=>html`<option value=${k} .selected=${k===item.kind}>${MEDIA_NAMES[k]}</option>`)}</select>
            <input aria-label=${`Nom de ${name}`} maxlength="80" placeholder=${name} .value=${item.name??''} @change=${(e:Event)=>{const value=(e.target as HTMLInputElement).value.trim();this.editMedia(item.id,m=>{if(value)m.name=value;else delete m.name;});}}>
            <button aria-pressed=${placing} @click=${()=>placing?this.stopPlacing():this.startPlacing('media',item.id,name)}>${mpIcon('pin',15)}${placing?'Touchez le plan…':'Placer sur le plan'}</button>
            <button class="danger" aria-label=${`Supprimer ${name}`} title="Supprimer" @click=${()=>{if(placing)this.stopPlacing();this.editRoom(r=>{r.media=r.media?.filter(m=>m.id!==item.id);if(!r.media?.length)delete r.media;});}}>×</button></div>
          <div class="row"><label>Lecteur Home Assistant<select aria-label=${`Lecteur de ${name}`} @change=${(e:Event)=>{const id=(e.target as HTMLSelectElement).value;this.editMedia(item.id,m=>{if(id)m.entityId=id;else delete m.entityId;});}}><option value="" .selected=${!item.entityId}>Aucun</option>${[...new Set([...(item.entityId?[item.entityId]:[]),...players])].map(id=>html`<option value=${id} .selected=${id===item.entityId}>${String(states[id]?.attributes.friendly_name??id)}${states[id]?'':' · indisponible'}</option>`)}</select></label></div>
          <details><summary>Position (X / Y en mètres)</summary><div class="row">${([0,1] as const).map(axis=>html`<label>${axis?'Y':'X'}<input type="number" step="0.05" min="-200" max="200" aria-label=${`${axis?'Y':'X'} de ${name}`} .value=${String(item.at[axis])} @change=${(e:Event)=>{const value=Number((e.target as HTMLInputElement).value);if(Number.isFinite(value))this.editMedia(item.id,m=>{const at=[...m.at] as Point;at[axis]=round(value);m.at=at;});}}></label>`)}</div></details>
        </div>`;})}</section>`;
  }
  /** Without a search: equipment that has no room yet, and the hidden equipment of this one. */
  private addEquipment(room:SpatialRoom){
    const areaId=room.areaId!,query=plain(this.entitySearch.trim()),known=new Map(this.areas.map(a=>[a.area_id,a.name]));
    const homeless=(d:LogicalDevice)=>!d.areaId||!known.has(d.areaId);
    const candidates=this.devices.filter(d=>d.planKind&&!d.disabled&&(d.hidden||d.areaId!==areaId)&&(query?plain(`${d.name} ${d.entityId}`).includes(query):homeless(d)||d.areaId===areaId))
      .sort((a,b)=>Number(homeless(b))-Number(homeless(a))||a.name.localeCompare(b.name,undefined,{numeric:true}));
    const where=(d:LogicalDevice)=>d.hidden?'masqué':homeless(d)?'sans pièce':`dans ${known.get(d.areaId!)}`;
    return html`<label>Ajouter un équipement<input type="search" placeholder="Nom ou identifiant" .value=${this.entitySearch} @input=${(e:Event)=>{this.entitySearch=(e.target as HTMLInputElement).value;}}></label>
      ${candidates.length?html`${query?nothing:html`<p class="muted">Sans pièce ou masqués : ${candidates.length}</p>`}<ul class="equipment" aria-label="Équipements à ajouter">${repeat(candidates.slice(0,8),d=>d.entityId,d=>html`<li>${mpIcon(KIND_ICONS[d.planKind!],18)}<span>${d.name}<small>${d.entityId} · ${where(d)}</small></span><button aria-label=${`Ajouter ${d.name}`} @click=${()=>this.assign(d,{areaId,hidden:false})}>Ajouter</button></li>`)}</ul>${candidates.length>8?html`<p class="muted">Et ${candidates.length-8} autres : précisez la recherche.</p>`:nothing}`:query?html`<p class="muted">Aucun équipement correspondant.</p>`:nothing}`;
  }
  /** Plan-wide state of the links, with the one-click association. */
  private renderLinks(suggestions:Map<string,string>){
    const rooms=this.draft!.floors.flatMap(f=>f.rooms),linked=rooms.filter(r=>r.areaId).length,manual=rooms.filter(r=>r.areaId&&r.entityIds&&this.withinArea(r)).length;
    const proposal=[suggestions.size?`${count(suggestions.size,'pièce')} à relier par ${suggestions.size>1?'leur':'son'} nom`:'',manual?`${count(manual,'liste')} à passer en automatique`:''].filter(Boolean).join(', ');
    return html`<div class="box links"><div class="equipment-head"><strong>Pièces Home Assistant · ${linked} / ${rooms.length} reliées</strong>${proposal?html`<button class="primary" @click=${()=>this.linkAll(suggestions)}>Associer automatiquement</button>`:nothing}</div>
      <p class="muted">Une pièce reliée affiche d’elle-même les lumières, volets, thermostats, capteurs, téléviseurs et enceintes de sa pièce Home Assistant, sur le plan comme sur le dashboard.${proposal?` Proposition : ${proposal}.`:linked<rooms.length?' Reliez les pièces restantes avec le menu « Pièce Home Assistant ».':''}</p></div>`;
  }
  render(){const floor=this.floor,room=this.room;const admin=!!this.hass?.user?.is_admin;
    const suggestions=this.draft?matchAreas(this.draft,this.areas,this.floors):new Map<string,string>(),suggested=room&&!room.areaId?this.areas.find(a=>a.area_id===suggestions.get(room.id)):undefined;
    return html`<h2>Plan 3D</h2><p>Votre maison en volume, reliée à vos équipements.</p>
    ${this.usingDefault?html`<div class="box default" role="note"><strong>Plan par défaut</strong><p>Créé automatiquement à partir de vos pièces Home Assistant : une pièce par zone, un étage par niveau ; chaque pièce affiche d’elle-même les équipements de sa zone. Il s’affiche sur le dashboard tant qu’aucun plan n’est enregistré. Modifiez-le, ou importez votre vrai plan ci-dessous, puis cliquez sur Enregistrer.</p></div>`:nothing}
    <fieldset ?disabled=${!admin||this.busy}>
      <div class="box"><strong>Générer depuis un plan · Gemini</strong><div class="row"><a href="https://my.home-assistant.io/redirect/integration/?domain=mp_glass" target="_blank" rel="noopener noreferrer">Configurer Gemini</a><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Obtenir une clé API</a></div><p>PDF (8 Mo maximum), ou image PNG, JPEG, WebP ; les grandes images sont réduites avant l’envoi.</p><div class="row"><label>Plan à importer<input type="file" accept="application/pdf,image/*" @change=${(e:Event)=>{this.file=(e.target as HTMLInputElement).files?.[0];this.confirmed=false;}}></label><label>Page du PDF<input type="number" min="1" max="100" .value=${String(this.page)} @change=${(e:Event)=>{this.page=Math.max(1,Math.min(100,Number((e.target as HTMLInputElement).value)||1));}}></label>${this.renderModelChoice()}</div>${this.info?.backend==='addon'?html`<p class="muted">Mode add-on : le modèle est celui de l’option « model » de l’add-on.</p>`:nothing}<label class="check"><input type="checkbox" .checked=${this.confirmed} @change=${(e:Event)=>{this.confirmed=(e.target as HTMLInputElement).checked;}}>Envoyer ce plan à Google pour l’analyser</label><p class="note">En mode direct, une clé API dans MP Glass suffit. Seule la page choisie est envoyée à Google, en image, sans les métadonnées du fichier : un PDF est dessiné dans votre navigateur. Utilisez un projet Google sans facturation pour rester sur le palier gratuit, soumis aux quotas ; chaque modèle a son propre quota : si l’un est épuisé, choisissez l’autre. Les données du palier gratuit peuvent servir à améliorer les produits Google. Aucun basculement automatique vers un autre modèle.</p><button class="primary" ?disabled=${!this.file||!this.confirmed||!this.hass?.fetchWithAuth} @click=${()=>this.analyze()}>Générer le brouillon 3D</button></div>
      <div class="row"><button @click=${this.addRoom}>Ajouter une pièce</button>${!this.draft?html`<button @click=${()=>this.commit(examplePlan())}>Charger un exemple</button>`:nothing}${this.plan&&this.fallback?html`<button @click=${()=>{this.commit(structuredClone(this.fallback!));this.floorIndex=0;this.selected='';}}>Repartir du plan par défaut</button>`:nothing}${this.plan?html`<button class="danger" @click=${()=>{this.asking='plan';}}>Supprimer le plan</button>`:nothing}</div>
    </fieldset>
    ${this.message&&!this.dialogOpen?html`<p role="status" class="note">${this.message}${this.detail?html`<small>Détail technique : ${this.detail}</small>`:nothing}</p>`:nothing}
    ${this.renderJob(floor?.name)}
    ${this.askDialog()}
    ${this.candidate&&!this.dialogOpen?html`<div class="box"><strong>Brouillon IA · non enregistré</strong><mp-spatial-viewer preview .plan=${this.candidate}></mp-spatial-viewer><button ?disabled=${!admin} @click=${this.reopen}>${this.editable?'Modifier le brouillon':'Revoir le brouillon'}</button><button class="primary" ?disabled=${!admin} @click=${this.applyCandidate}>Utiliser pour ce niveau</button><button @click=${this.discard}>Ignorer</button><p>${this.editable?'Modifier le brouillon rouvre la fenêtre de résultat, sur le plan d’origine, pour corriger les pièces sans relancer d’analyse. ':''}Remplace la géométrie du niveau sélectionné. Les associations des pièces de même nom sont reprises, les autres pièces sont reliées par leur nom quand c’est sans ambiguïté ; vérifiez-les.</p></div>`:nothing}
    ${this.draft&&floor?html`<fieldset ?disabled=${!admin||this.busy}><label class="check"><input type="checkbox" .checked=${this.draft.enabled} @change=${(e:Event)=>this.mutate(p=>{p.enabled=(e.target as HTMLInputElement).checked;})}>Afficher le plan sur l’accueil</label><div class="row"><label>Niveau à modifier<select .value=${floor.id} @change=${(e:Event)=>{this.floorIndex=this.draft!.floors.findIndex(f=>f.id===(e.target as HTMLSelectElement).value);this.selected='';}}>${this.draft.floors.map(f=>html`<option value=${f.id} .selected=${f.id===floor.id}>${f.name}</option>`)}</select></label><button ?disabled=${this.draft.floors.length>=8} @click=${()=>this.mutate(p=>{p.floors.push({id:`floor-${shortId()}`,name:`Niveau ${p.floors.length}`,elevation:floor.elevation+floor.height,height:2.6,rooms:[{id:'room-1',name:'Nouvelle pièce',polygon:[[0,0],[4,0],[4,4],[0,4]]}]});this.floorIndex=p.floors.length-1;})}>Ajouter un niveau</button><button class="danger" ?disabled=${this.draft.floors.length<=1} @click=${()=>{this.asking='floor';}}>Supprimer ce niveau</button></div><div class="row"><label>Nom du niveau<input maxlength="80" .value=${floor.name} @change=${(e:Event)=>this.mutate(p=>{p.floors[this.floorIndex]!.name=(e.target as HTMLInputElement).value;})}></label><label>Hauteur des murs (m)<input type="number" min="1" max="8" step="0.1" .value=${String(floor.height)} @change=${(e:Event)=>this.mutate(p=>{p.floors[this.floorIndex]!.height=Number((e.target as HTMLInputElement).value);})}></label></div>
      <div class="row"><label>Multiplier l’échelle du niveau<input id="scale" type="number" min="0.01" max="100" step="0.01" value="1"></label><button @click=${()=>{const factor=Number(this.renderRoot.querySelector<HTMLInputElement>('#scale')!.value);if(factor>0&&Number.isFinite(factor))this.mutate(p=>{for(const r of p.floors[this.floorIndex]!.rooms){r.polygon=r.polygon.map(([x,z])=>[x*factor,z*factor]);if(r.media)r.media=r.media.map(m=>({...m,at:[round(m.at[0]*factor),round(m.at[1]*factor)]}));}});}}>Appliquer l’échelle</button></div>
      ${this.renderLinks(suggestions)}</fieldset>
      <mp-spatial-viewer .plan=${this.shown} .hass=${this.hass} .placing=${this.placing} @room-select=${this.roomSelected} @floor-select=${this.floorSelected} @plan-pick=${this.picked} @plan-pick-cancel=${this.stopPlacing}></mp-spatial-viewer>
      ${room?html`<fieldset ?disabled=${!admin||this.busy}><div class="box"><label>Pièce à modifier<select .value=${room.id} @change=${(e:Event)=>{this.selected=(e.target as HTMLSelectElement).value;this.entitySearch='';}}>${floor.rooms.map(r=>html`<option value=${r.id} .selected=${r.id===room.id}>${r.name}</option>`)}</select></label><p class="muted">Ou touchez-la sur le plan.</p><div class="row"><label>Nom de la pièce<input maxlength="80" .value=${room.name} @change=${(e:Event)=>this.editRoom(r=>{r.name=(e.target as HTMLInputElement).value;})}></label><label>Pièce Home Assistant<select .value=${room.areaId??''} @change=${(e:Event)=>this.linkRoom((e.target as HTMLSelectElement).value)}><option value="" .selected=${!room.areaId}>Non associée</option>${this.areas.map(a=>html`<option value=${a.area_id} .selected=${a.area_id===room.areaId}>${a.name}</option>`)}</select></label></div>${suggested?html`<button class="suggest" @click=${()=>this.linkRoom(suggested.area_id)}>Relier à « ${suggested.name} »</button>`:nothing}${followsArea(room)?this.automatic(room):this.entityPicker(room)}${this.openingsEditor(room)}${this.mediaEditor(room)}<details><summary>Corriger les sommets (X / Y en mètres) et les courbes</summary><p class="muted">Courbure du côté qui part du sommet : 0 pour un mur droit, 1 pour un demi-cercle, négatif pour courber de l’autre côté.</p>${room.polygon.map((p,i)=>html`<div class="points"><input aria-label=${`Sommet ${i+1} X`} type="number" step="0.01" .value=${String(p[0])} @change=${(e:Event)=>this.editRoom(r=>{r.polygon[i]![0]=Number((e.target as HTMLInputElement).value);})}><input aria-label=${`Sommet ${i+1} Y`} type="number" step="0.01" .value=${String(p[1])} @change=${(e:Event)=>this.editRoom(r=>{r.polygon[i]![1]=Number((e.target as HTMLInputElement).value);})}><input aria-label=${`Courbure du côté ${i+1}`} type="number" min="-1" max="1" step="0.05" .value=${String(room.arcs?.[i]??0)} @change=${(e:Event)=>this.editBend(i,Number((e.target as HTMLInputElement).value))}><button aria-label=${`Supprimer sommet ${i+1}`} ?disabled=${room.polygon.length<=3} @click=${()=>this.dropVertex(i)}>×</button></div>`)}<button ?disabled=${room.polygon.length>=40} @click=${()=>this.addVertex()}>Ajouter un sommet</button></details><button ?disabled=${floor.rooms.length<=1} @click=${()=>{this.mutate(p=>{p.floors[this.floorIndex]!.rooms=p.floors[this.floorIndex]!.rooms.filter(r=>r.id!==room.id);});this.selected='';}}>Supprimer cette pièce</button></div></fieldset>`:nothing}`:nothing}`;
  }
}
defineElement('mp-spatial-editor',MPSpatialEditor);
