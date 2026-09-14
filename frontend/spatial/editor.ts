import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { HAArea } from '../../shared/models';
import { examplePlan, parseSpatial, polygonArea, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import type { Hass } from '../ha/client';
import { mpIcon } from '../icons';
import './viewer';

interface Job { id:string; status:'running'|'done'|'error'; plan?:SpatialPlan; error?:string; detail?:string; warnings?:string[] }
const ACCEPTED=['application/pdf','image/png','image/jpeg','image/webp'];
const MAX_UPLOAD=8*1024*1024, MAX_SIDE=3072, MAX_WAIT=6*60_000;
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
  provider_unavailable:'Gemini est momentanément surchargé ou indisponible. Réessayez dans quelques minutes.',
  provider_unreachable:'Home Assistant n’arrive pas à joindre Google Gemini. Vérifiez sa connexion Internet et son DNS.',
  provider_blocked:'Gemini a interrompu l’analyse de ce document. Essayez une autre page ou une image du plan.',
  worker_unavailable:'Add-on inaccessible. Vérifiez son démarrage, son adresse et la clé de liaison.',
  model_unavailable:'Google refuse le modèle Gemini utilisé (retiré ou non ouvert à ce projet). Mettez à jour MP Glass puis redémarrez Home Assistant ; en mode add-on, corrigez l’option « model » du worker. Voir le détail ci-dessous.',
  timeout:'L’analyse a dépassé le délai. Réessayez avec une page plus simple.',
  job_missing:'L’analyse a été interrompue (MP Glass rechargé ou Home Assistant redémarré). Relancez-la.',
};

/** PDF sent as is; images decoded by the browser and reduced when too large or in another format. */
async function prepareUpload(file:File):Promise<Blob>{
  const type=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'');
  if(type==='application/pdf'){if(file.size>MAX_UPLOAD)throw Error('file_too_large');return file.type===type?file:new Blob([file],{type});}
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
    const encode=(format:string,quality?:number)=>new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,format,quality));
    const png=await encode('image/png');
    const blob=png&&png.size<=MAX_UPLOAD?png:await encode('image/jpeg',.9);
    if(!blob||blob.size>MAX_UPLOAD)throw Error('file_too_large');
    return blob;
  }finally{bitmap.close();}
}

export class MPSpatialEditor extends LitElement {
  static properties={plan:{attribute:false},fallback:{attribute:false},hass:{attribute:false},areas:{attribute:false},draft:{state:true},usingDefault:{state:true},candidate:{state:true},message:{state:true},detail:{state:true},busy:{state:true},selected:{state:true},floorIndex:{state:true},file:{state:true},page:{state:true},confirmed:{state:true},phase:{state:true},dialogOpen:{state:true},warnings:{state:true},tick:{state:true}};
  static styles=css`
    :host{display:block;color:#eef6ff;font:13px/1.5 system-ui,sans-serif}*{box-sizing:border-box}h2{font:28px Georgia,serif;margin:0 0 8px}p{color:#b7ccdf}.box{border:1px solid #c5e4ff26;border-radius:14px;padding:15px;margin:15px 0;background:#071a2c55}.row{display:flex;flex-wrap:wrap;align-items:end;gap:9px;margin:10px 0}label{display:flex;flex-direction:column;gap:5px;flex:1;min-width:120px}input,select,textarea,button{font:inherit;color:inherit;border:1px solid #b2d7f23b;border-radius:10px;background:#0b253d;padding:10px;min-height:42px;max-width:100%}select option{background:#0b253d;color:#eef6ff}select[multiple] option:checked{background:linear-gradient(#2a648e,#2a648e);color:#fff}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}.primary{background:#2a648e;border-color:#8acbff}textarea{width:100%;font:12px/1.4 monospace;min-height:130px}.check{display:flex;flex-direction:row;align-items:center}.check input{min-height:22px}a{color:#9ad4ff}.points{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin:8px 0}.points input{width:100%;min-width:0}.note{border-left:2px solid #8bceff;padding:9px 12px}.note small{display:block;margin-top:6px;color:#9fb6ca;font:11px/1.4 ui-monospace,monospace;overflow-wrap:anywhere}.default{border-color:#8bceff55;background:#10365555}.default p{margin:6px 0 0}.warning{color:#ffda9a}details{margin:14px 0}fieldset{padding:0;border:0;min-width:0}mp-spatial-viewer{margin:15px -6px}
    dialog.job{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:22px;border:1px solid #9fd2ff40;border-radius:22px;color:#eef6ff;background:linear-gradient(150deg,#12344ff2,#071a2cfa 70%);box-shadow:0 30px 80px #000a,inset 0 1px #ffffff1f}
    dialog.job::backdrop{background:#020a14a6;backdrop-filter:blur(6px)}
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
    @keyframes scan{to{top:36px}}@keyframes spin{to{transform:rotate(1turn)}}@keyframes slide{from{transform:translateX(-100%)}to{transform:translateX(300%)}}
    @media (prefers-reduced-motion:reduce){.job-orb.scan::after,.steps .current .dot,.bar span{animation:none}}
  `;
  plan?:SpatialPlan;fallback?:SpatialPlan;hass?:Hass;areas:HAArea[]=[];
  private draft?:SpatialPlan;private usingDefault=false;private candidate?:SpatialPlan;private message='';private detail='';private busy=false;private selected='';private floorIndex=0;private file?:File;private page=1;private confirmed=false;
  private timer?:ReturnType<typeof setTimeout>;private disposed=false;private generation=0;private startedAt=0;
  /** Analysis window: progress while `busy`, then the draft or the failure. */
  private phase?:'preparing'|'uploading'|'analyzing'|'done'|'error';private dialogOpen=false;private jobId='';private warnings:string[]=[];private elapsed=0;private tick=0;private ticker?:ReturnType<typeof setInterval>;
  connectedCallback(){super.connectedCallback();this.disposed=false;}
  disconnectedCallback(){
    super.disconnectedCallback();this.disposed=true;this.generation++;clearTimeout(this.timer);clearInterval(this.ticker);
    // Leaving the Studio: free the server for the next analysis instead of letting an orphan job run.
    if(this.jobId)void this.stopJob(this.jobId);
    this.busy=false;this.jobId='';this.phase=undefined;this.dialogOpen=false;
  }
  protected updated(){
    const dialog=this.renderRoot.querySelector<HTMLDialogElement>('dialog.job');
    if(dialog&&this.dialogOpen&&!dialog.open)dialog.showModal();else if(dialog&&!this.dialogOpen&&dialog.open)dialog.close();
  }
  protected willUpdate(changed:PropertyValues){
    if(changed.has('plan')&&this.plan!==this.draft){this.draft=this.plan?structuredClone(this.plan):undefined;this.usingDefault=false;this.floorIndex=0;}
    // Without a saved plan, start from the schematic plan of the HA areas (refreshed while untouched).
    if(!this.plan&&this.fallback&&(!this.draft||(this.usingDefault&&changed.has('fallback')))){this.draft=structuredClone(this.fallback);this.usingDefault=true;this.floorIndex=0;}
  }
  private get floor(){return this.draft?.floors[this.floorIndex]??this.draft?.floors[0];}
  private get room(){return this.floor?.rooms.find(r=>r.id===this.selected)??this.floor?.rooms[0];}
  private commit(plan:SpatialPlan){
    try{this.draft=parseSpatial(plan);this.usingDefault=false;this.message='Modifications prêtes. Cliquez sur Enregistrer dans le Studio.';this.detail='';this.dispatchEvent(new CustomEvent('spatial-change',{detail:this.draft,bubbles:true,composed:true}));}
    catch(error){this.message=(error as Error).message;}
  }
  private mutate(edit:(plan:SpatialPlan)=>void){if(!this.draft)return;const copy=structuredClone(this.draft);edit(copy);this.commit(copy);}
  private editRoom(edit:(room:SpatialRoom)=>void){const id=this.room?.id;this.mutate(plan=>{const room=plan.floors[this.floorIndex]?.rooms.find(r=>r.id===id);if(room)edit(room);});}
  private async analyze(){
    if(!this.file||!this.hass?.fetchWithAuth||!this.confirmed||this.busy)return;
    this.busy=true;this.candidate=undefined;this.detail='';this.warnings=[];this.jobId='';this.phase='preparing';this.dialogOpen=true;this.startedAt=Date.now();this.message='Préparation du fichier…';
    clearInterval(this.ticker);this.ticker=setInterval(()=>{this.tick++;},1000);
    const generation=++this.generation;
    try{
      const body=await prepareUpload(this.file);
      if(this.disposed||generation!==this.generation)return;
      this.phase='uploading';this.message='Envoi du plan à Home Assistant…';
      const response=await this.hass.fetchWithAuth(`/api/mp_glass/spatial/analyze?page=${this.page}`,{method:'POST',headers:{'Content-Type':body.type},body});
      if(!response.ok){
        const answer=await response.json().catch(()=>({})) as {error?:string};
        throw Error(answer.error??(response.status===404?'not_installed':response.status===401||response.status===403?'unauthorized':`http_${response.status}`));
      }
      const job=await response.json() as Job;
      // Cancelled while uploading: the job has just started, stop it so the next analysis is not "busy".
      if(this.disposed||generation!==this.generation){void this.stopJob(job.id);return;}
      this.jobId=job.id;this.phase='analyzing';this.message='Analyse du plan par Gemini…';
      await this.poll(job.id,generation);
    }catch(error){if(generation===this.generation)this.fail(error);}
  }
  private finish(phase:'done'|'error'){this.busy=false;this.phase=phase;this.jobId='';this.elapsed=Date.now()-this.startedAt;clearInterval(this.ticker);if(!this.disposed)this.dialogOpen=true;}
  private fail(error:unknown,detail=''){
    const code=error instanceof TypeError?'network':error instanceof Error?error.message:String((error as {code?:string})?.code??error);
    this.message=MESSAGES[code]??`Analyse impossible (${code}). Le plan enregistré est conservé.`;this.detail=detail;this.finish('error');
  }
  private async poll(id:string,generation:number){
    try{
      const job=await this.hass!.callWS<Job>({type:'mp_glass/spatial/job',job_id:id});
      if(this.disposed||generation!==this.generation)return;
      if(job.status==='running'){
        if(Date.now()-this.startedAt>MAX_WAIT)throw Error('timeout');
        this.timer=setTimeout(()=>void this.poll(id,generation),2000);return;
      }
      if(job.status==='error'){this.fail(Error(job.error??'analysis_failed'),job.detail);return;}
      this.candidate=parseSpatial(job.plan);this.warnings=job.warnings??[];
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
    if(!this.candidate)return;
    const incoming=structuredClone(this.candidate.floors[0]!);
    for(const r of incoming.rooms)r.id=`room-${crypto.randomUUID().slice(0,8)}`;
    if(this.floor){incoming.id=this.floor.id;incoming.name=this.floor.name;incoming.elevation=this.floor.elevation;incoming.height=this.floor.height;const used=new Set<string>();for(const r of incoming.rooms){const matches=this.floor.rooms.filter(o=>o.name.trim().toLocaleLowerCase()===r.name.trim().toLocaleLowerCase());const old=matches.length===1?matches[0]:undefined;if(old&&!used.has(old.id)){used.add(old.id);r.id=old.id;r.areaId=old.areaId;r.entityIds=old.entityIds;}}}
    const plan=this.draft?structuredClone(this.draft):{version:1 as const,enabled:true,floors:[]};
    if(plan.floors.length)plan.floors[this.floorIndex]=incoming;else plan.floors.push(incoming);
    this.commit(plan);this.candidate=undefined;this.selected='';this.phase=undefined;this.dialogOpen=false;
  }
  private discard=()=>{this.candidate=undefined;this.phase=undefined;this.dialogOpen=false;this.message='Brouillon ignoré. Le plan enregistré est conservé.';};
  private addRoom(){
    if(!this.draft){this.commit({version:1,enabled:true,floors:[{id:'ground',name:'Rez-de-chaussée',elevation:0,height:2.6,rooms:[{id:'room-1',name:'Nouvelle pièce',polygon:[[0,0],[4,0],[4,4],[0,4]]}]}]});return;}
    this.mutate(p=>{const f=p.floors[this.floorIndex]!;const x=Math.max(...f.rooms.flatMap(r=>r.polygon.map(v=>v[0])))+.3;const id=`room-${crypto.randomUUID().slice(0,8)}`;f.rooms.push({id,name:'Nouvelle pièce',polygon:[[x,0],[x+4,0],[x+4,4],[x,4]]});this.selected=id;});
  }
  /** Modal window: steps and elapsed time during the analysis, then the draft with its 3D preview, or the failure. */
  private renderJob(floorName?:string){
    if(!this.phase)return nothing;
    const seconds=Math.round((this.busy?Date.now()-this.startedAt:this.elapsed)/1000),time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    let body;
    if(this.busy){
      const steps:[string,string][]=[['preparing','Préparation du fichier'],['uploading','Envoi à Home Assistant'],['analyzing','Analyse du plan par Gemini']];
      const current=steps.findIndex(([id])=>id===this.phase),pdf=this.file?.type==='application/pdf'||/\.pdf$/i.test(this.file?.name??'');
      body=html`<header class="job-head"><span class="job-orb scan">${mpIcon('scan',26)}</span><div><small>Plan 3D · Gemini</small><h3 id="job-title">Analyse du plan en cours</h3><p>${this.file?.name??''}${pdf?` · page ${this.page}`:''}</p></div></header>
        <ol class="steps">${steps.map(([id,label],i)=>html`<li class=${i<current?'done':i===current?'current':''}><span class="dot">${i<current?mpIcon('check',12):nothing}</span><span>${label}</span>${id==='analyzing'&&i===current?html`<time>${time}</time>`:nothing}</li>`)}</ol>
        <div class="bar" aria-hidden="true"><span></span></div>
        <p role="status" class="job-status">${this.message}</p>
        <p class="muted">Généralement moins d’une minute, jusqu’à quelques minutes pour un grand plan. Le plan enregistré n’est pas modifié.</p>
        <div class="job-actions"><button @click=${this.cancelAnalysis}>Annuler l’analyse</button></div>`;
    }else if(this.phase==='done'&&this.candidate){
      const rooms=this.candidate.floors[0]!.rooms,area=rooms.reduce((sum,r)=>sum+polygonArea(r.polygon),0),xs=rooms.flatMap(r=>r.polygon.map(p=>p[0])),ys=rooms.flatMap(r=>r.polygon.map(p=>p[1]));
      const metres=(value:number)=>new Intl.NumberFormat('fr',{maximumFractionDigits:1}).format(value),plural=rooms.length>1?'s':'';
      body=html`<header class="job-head"><span class="job-orb ok">${mpIcon('check',26)}</span><div><small>Brouillon IA · non enregistré</small><h3 id="job-title">${rooms.length} pièce${plural} reconnue${plural}</h3><p>${metres(area)} m² · ${metres(Math.max(...xs)-Math.min(...xs))} × ${metres(Math.max(...ys)-Math.min(...ys))} m · analysé en ${time}</p></div></header>
        <mp-spatial-viewer preview .plan=${this.candidate}></mp-spatial-viewer>
        ${this.warnings.length?html`<ul class="warnings">${this.warnings.map(w=>html`<li>${w}</li>`)}</ul>`:nothing}
        <p role="status" class="job-status">Vérifiez les pièces et l’échelle. Le brouillon remplacera la géométrie du niveau ${floorName?`« ${floorName} »`:'sélectionné'} ; les associations des pièces de même nom sont reprises.</p>
        <div class="job-actions"><button @click=${this.discard}>Ignorer</button><button class="primary" ?disabled=${!this.hass?.user?.is_admin} @click=${this.applyCandidate}>Utiliser pour ce niveau</button></div>`;
    }else{
      body=html`<header class="job-head"><span class="job-orb fail">${mpIcon('close',24)}</span><div><small>Plan 3D · Gemini</small><h3 id="job-title">Analyse impossible</h3><p>Le plan enregistré est conservé.</p></div></header>
        <p role="status" class="job-status failure">${this.message}${this.detail?html`<small>Détail technique : ${this.detail}</small>`:nothing}</p>
        <div class="job-actions"><button @click=${()=>{this.dialogOpen=false;}}>Fermer</button>${this.file&&this.confirmed?html`<button class="primary" @click=${this.analyze}>Réessayer</button>`:nothing}</div>`;
    }
    // Escape does not interrupt a running analysis: only "Annuler l’analyse" does.
    return html`<dialog class="job" aria-labelledby="job-title" @cancel=${(e:Event)=>{if(this.busy)e.preventDefault();}} @close=${()=>{this.dialogOpen=false;}}>${body}</dialog>`;
  }
  render(){const floor=this.floor,room=this.room;const admin=!!this.hass?.user?.is_admin;
    return html`<h2>Plan 3D</h2><p>Votre maison en volume, reliée à vos équipements.</p>
    ${this.usingDefault?html`<div class="box default" role="note"><strong>Plan par défaut</strong><p>Créé automatiquement à partir de vos pièces Home Assistant : une pièce par zone, un étage par niveau, lumières déjà associées. Il s’affiche sur le dashboard tant qu’aucun plan n’est enregistré. Modifiez-le, ou importez votre vrai plan ci-dessous, puis cliquez sur Enregistrer.</p></div>`:nothing}
    <fieldset ?disabled=${!admin||this.busy}>
      <div class="box"><strong>Générer depuis un plan · Gemini Flash-Lite</strong><div class="row"><a href="https://my.home-assistant.io/redirect/integration/?domain=mp_glass" target="_blank" rel="noopener noreferrer">Configurer Gemini</a><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Obtenir une clé API</a></div><p>PDF (8 Mo maximum), ou image PNG, JPEG, WebP ; les grandes images sont réduites avant l’envoi.</p><div class="row"><label>Plan à importer<input type="file" accept="application/pdf,image/*" @change=${(e:Event)=>{this.file=(e.target as HTMLInputElement).files?.[0];this.confirmed=false;}}></label><label>Page du PDF<input type="number" min="1" max="100" .value=${String(this.page)} @change=${(e:Event)=>{this.page=Math.max(1,Math.min(100,Number((e.target as HTMLInputElement).value)||1));}}></label></div><label class="check"><input type="checkbox" .checked=${this.confirmed} @change=${(e:Event)=>{this.confirmed=(e.target as HTMLInputElement).checked;}}>Envoyer ce plan à Google pour l’analyser</label><p class="note">En mode direct, une clé API dans MP Glass suffit. Le fichier complet, y compris les autres pages du PDF et ses métadonnées, est envoyé à Google ; le numéro de page guide l’analyse. Pour limiter l’envoi, importez un PDF contenant uniquement la page utile. Utilisez un projet Google sans facturation pour rester sur le palier gratuit, soumis aux quotas. Les données du palier gratuit peuvent servir à améliorer les produits Google. Aucun basculement automatique vers un autre modèle.</p><button class="primary" ?disabled=${!this.file||!this.confirmed||!this.hass?.fetchWithAuth} @click=${this.analyze}>Générer le brouillon 3D</button></div>
      <div class="row"><button @click=${this.addRoom}>Ajouter une pièce</button>${!this.draft?html`<button @click=${()=>this.commit(examplePlan())}>Charger un exemple</button>`:nothing}${this.plan&&this.fallback?html`<button @click=${()=>{this.commit(structuredClone(this.fallback!));this.floorIndex=0;this.selected='';}}>Repartir du plan par défaut</button>`:nothing}</div>
    </fieldset>
    ${this.message&&!this.dialogOpen?html`<p role="status" class="note">${this.message}${this.detail?html`<small>Détail technique : ${this.detail}</small>`:nothing}</p>`:nothing}
    ${this.renderJob(floor?.name)}
    ${this.candidate&&!this.dialogOpen?html`<div class="box"><strong>Brouillon IA · non enregistré</strong><mp-spatial-viewer preview .plan=${this.candidate}></mp-spatial-viewer><button class="primary" ?disabled=${!admin} @click=${this.applyCandidate}>Utiliser pour ce niveau</button><button @click=${()=>{this.candidate=undefined;}}>Ignorer</button><p>Remplace la géométrie du niveau sélectionné. Les associations des pièces de même nom sont reprises ; vérifiez-les.</p></div>`:nothing}
    ${this.draft&&floor?html`<fieldset ?disabled=${!admin||this.busy}><label class="check"><input type="checkbox" .checked=${this.draft.enabled} @change=${(e:Event)=>this.mutate(p=>{p.enabled=(e.target as HTMLInputElement).checked;})}>Afficher le plan sur l’accueil</label><div class="row"><label>Niveau à modifier<select .value=${floor.id} @change=${(e:Event)=>{this.floorIndex=this.draft!.floors.findIndex(f=>f.id===(e.target as HTMLSelectElement).value);this.selected='';}}>${this.draft.floors.map(f=>html`<option value=${f.id} .selected=${f.id===floor.id}>${f.name}</option>`)}</select></label><button ?disabled=${this.draft.floors.length>=8} @click=${()=>this.mutate(p=>{p.floors.push({id:`floor-${crypto.randomUUID().slice(0,8)}`,name:`Niveau ${p.floors.length}`,elevation:floor.elevation+floor.height,height:2.6,rooms:[{id:'room-1',name:'Nouvelle pièce',polygon:[[0,0],[4,0],[4,4],[0,4]]}]});this.floorIndex=p.floors.length-1;})}>Ajouter un niveau</button></div><div class="row"><label>Nom du niveau<input maxlength="80" .value=${floor.name} @change=${(e:Event)=>this.mutate(p=>{p.floors[this.floorIndex]!.name=(e.target as HTMLInputElement).value;})}></label><label>Hauteur des murs (m)<input type="number" min="1" max="8" step="0.1" .value=${String(floor.height)} @change=${(e:Event)=>this.mutate(p=>{p.floors[this.floorIndex]!.height=Number((e.target as HTMLInputElement).value);})}></label></div>
      <div class="row"><label>Multiplier l’échelle du niveau<input id="scale" type="number" min="0.01" max="100" step="0.01" value="1"></label><button @click=${()=>{const factor=Number(this.renderRoot.querySelector<HTMLInputElement>('#scale')!.value);if(factor>0&&Number.isFinite(factor))this.mutate(p=>{for(const r of p.floors[this.floorIndex]!.rooms)r.polygon=r.polygon.map(([x,z])=>[x*factor,z*factor]);});}}>Appliquer l’échelle</button></div>
      ${room?html`<div class="box"><label>Pièce à modifier<select .value=${room.id} @change=${(e:Event)=>{this.selected=(e.target as HTMLSelectElement).value;}}>${floor.rooms.map(r=>html`<option value=${r.id} .selected=${r.id===room.id}>${r.name}</option>`)}</select></label><div class="row"><label>Nom de la pièce<input maxlength="80" .value=${room.name} @change=${(e:Event)=>this.editRoom(r=>{r.name=(e.target as HTMLInputElement).value;})}></label><label>Pièce Home Assistant<select .value=${room.areaId??''} @change=${(e:Event)=>this.editRoom(r=>{const v=(e.target as HTMLSelectElement).value;if(v)r.areaId=v;else delete r.areaId;})}><option value="" .selected=${!room.areaId}>Non associée</option>${this.areas.map(a=>html`<option value=${a.area_id} .selected=${a.area_id===room.areaId}>${a.name}</option>`)}</select></label></div><label>Équipements affichés (12 maximum)<select multiple size="5" @change=${(e:Event)=>this.editRoom(r=>{r.entityIds=Array.from((e.target as HTMLSelectElement).selectedOptions).map(o=>o.value);})}>${Object.values(this.hass?.states??{}).filter(s=>/^(light|sensor|binary_sensor|climate)\./.test(s.entity_id)).map(s=>html`<option value=${s.entity_id} .selected=${!!room.entityIds?.includes(s.entity_id)}>${String(s.attributes.friendly_name??s.entity_id)} · ${s.entity_id}</option>`)}</select></label><details><summary>Corriger les sommets (X / Y en mètres)</summary>${room.polygon.map((p,i)=>html`<div class="points"><input aria-label=${`Sommet ${i+1} X`} type="number" step="0.1" .value=${String(p[0])} @change=${(e:Event)=>this.editRoom(r=>{r.polygon[i]![0]=Number((e.target as HTMLInputElement).value);})}><input aria-label=${`Sommet ${i+1} Y`} type="number" step="0.1" .value=${String(p[1])} @change=${(e:Event)=>this.editRoom(r=>{r.polygon[i]![1]=Number((e.target as HTMLInputElement).value);})}><button aria-label=${`Supprimer sommet ${i+1}`} ?disabled=${room.polygon.length<=3} @click=${()=>this.editRoom(r=>{r.polygon.splice(i,1);})}>×</button></div>`)}<button ?disabled=${room.polygon.length>=40} @click=${()=>this.editRoom(r=>{const a=r.polygon.at(-1)!,b=r.polygon[0]!;r.polygon.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);})}>Ajouter un sommet</button></details><button ?disabled=${floor.rooms.length<=1} @click=${()=>{this.mutate(p=>{p.floors[this.floorIndex]!.rooms=p.floors[this.floorIndex]!.rooms.filter(r=>r.id!==room.id);});this.selected='';}}>Supprimer cette pièce</button></div>`:nothing}</fieldset><mp-spatial-viewer .plan=${this.draft} .hass=${this.hass}></mp-spatial-viewer>`:nothing}`;
  }
}
if(!customElements.get('mp-spatial-editor'))customElements.define('mp-spatial-editor',MPSpatialEditor);
