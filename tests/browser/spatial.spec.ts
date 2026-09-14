import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

interface MountOptions { jobError?:{error:string;detail?:string}; uploadStatus?:number; saved?:boolean; fallback?:boolean; pending?:boolean }
async function mountEditor(page:Page, isAdmin=true, jobError=false, options:MountOptions={}) {
  await page.goto('/?spatial');
  await page.evaluate(async({isAdmin,jobError,options})=>{
    const module='/shared/spatial.ts';const {examplePlan}=await import(module);
    const plan=examplePlan();
    const demo=(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo;
    const changed:unknown[]=[];const uploads:{url:string;method?:string;type?:string;side?:number}[]=[];const messages:Record<string,unknown>[]=[];
    const editor=document.createElement('mp-spatial-editor') as HTMLElement&{hass:import('../../frontend/ha/client').Hass;plan?:typeof plan;fallback?:typeof plan;areas:unknown[]};
    if(options.saved!==false)editor.plan=plan;
    if(options.fallback){const fallback=examplePlan();fallback.floors[0].name='RDC';fallback.floors[0].rooms[0].areaId='salon';editor.fallback=fallback;}
    editor.areas=[{area_id:'salon',name:'Salon'}];
    editor.hass={...demo.hass,user:{id:'test',is_admin:isAdmin},fetchWithAuth:async(url,init)=>{
      const body=init?.body as Blob;const bitmap=await createImageBitmap(body).catch(()=>undefined);
      uploads.push({url,method:init?.method,type:(init?.headers as Record<string,string>)['Content-Type'],side:bitmap&&Math.max(bitmap.width,bitmap.height)});
      if(options.uploadStatus)return new Response('404: Not Found',{status:options.uploadStatus});
      return new Response(JSON.stringify({id:'job-test',status:'running'}),{status:202});
    },callWS:async<T>(message:Record<string,unknown>)=>{
      messages.push(message);
      if(message.type==='mp_glass/spatial/cancel'&&message.job_id==='job-test')return {cancelled:true} as T;
      if(message.type!=='mp_glass/spatial/job'||message.job_id!=='job-test')throw Error('unexpected_command');
      if(options.pending)return {id:'job-test',status:'running'} as T;
      const incoming=examplePlan();incoming.floors[0].rooms[0].name='Pièce importée';
      const failure=options.jobError??(jobError?{error:'quota'}:undefined);
      return (failure?{id:'job-test',status:'error',...failure}:{id:'job-test',status:'done',plan:incoming,warnings:['Échelle estimée']}) as T;
    }};
    editor.addEventListener('spatial-change',e=>changed.push((e as CustomEvent).detail));
    document.body.replaceChildren(editor);Object.assign(window,{spatialTest:{changed,uploads,messages}});
  },{isAdmin,jobError,options});
}
const consentAndGenerate=async(page:Page)=>{await page.getByRole('checkbox',{name:'Envoyer ce plan à Google pour l’analyser'}).check();await page.getByRole('button',{name:'Générer le brouillon 3D'}).click();};
const demoCalls=(page:Page)=>page.evaluate(()=>(window as unknown as {demo:{calls:unknown[]}}).demo.calls);
/** Points of the canvas: its centre is the house (first one not covered by a label), a bottom corner is beside it. */
const planPoints=(page:Page)=>page.evaluate(()=>{
  const root=document.querySelector('mp-glass-view-v4')!.shadowRoot!.querySelector('mp-spatial-viewer')!.shadowRoot!,canvas=root.querySelector('canvas')!,r=canvas.getBoundingClientRect();
  const house=([[0,0],[0,30],[30,0],[-30,0],[0,-30],[40,40],[-40,40]] as const).map(([dx,dy])=>({x:r.x+r.width/2+dx,y:r.y+r.height/2+dy})).find(p=>root.elementFromPoint(p.x,p.y)===canvas);
  if(!house)throw Error('house hidden by labels');
  return {house,beside:{x:r.x+16,y:r.y+r.height-16}};
});
/** Label position relative to the canvas, independent of the page scroll. */
const labelOffset=async(page:Page,room:string)=>{
  const viewer=page.locator('mp-spatial-viewer');const [label,canvas]=await Promise.all([viewer.locator(`[data-room="${room}"]`).boundingBox(),viewer.locator('canvas').boundingBox()]);
  return {x:Math.round(label!.x-canvas!.x),y:Math.round(label!.y-canvas!.y)};
};

test('3D rotates, zooms, pans, resets and controls a bound light',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');const label=viewer.locator('[data-room="living"]');
  await expect(label).toBeVisible();
  const initial=await label.boundingBox();
  await viewer.getByRole('button',{name:'Zoom avant'}).click();
  const zoomed=await label.boundingBox();expect(zoomed?.x).not.toBe(initial?.x);
  const {house}=await planPoints(page);
  await page.mouse.move(house.x,house.y);
  await page.mouse.down();await page.mouse.move(house.x+90,house.y+30,{steps:8});await page.mouse.up();
  const rotated=await label.boundingBox();expect(rotated?.x).not.toBe(zoomed?.x);
  const canvas=viewer.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowRight');expect((await label.boundingBox())?.x).not.toBe(rotated?.x);
  await viewer.getByRole('button',{name:'Recentrer',exact:true}).click();
  await label.click();
  const card=viewer.getByRole('region',{name:'Salon'});
  await expect(card.getByText('Suspension',{exact:true})).toBeVisible();
  await expect(card.getByText('21,5°',{exact:true})).toBeVisible();
  await expect(card.locator('.stat',{hasText:'Humidité'})).toContainText('46 %');
  await card.getByRole('button',{name:'Allumer',exact:true}).click();
  await expect(card.getByRole('button',{name:'Éteindre',exact:true})).toBeVisible();
  expect(await demoCalls(page)).toEqual([{domain:'light',service:'turn_on',data:{entity_id:'light.circuit_0'}}]);
  await card.getByRole('slider',{name:'Luminosité Suspension'}).fill('75');await card.getByRole('slider',{name:'Luminosité Suspension'}).dispatchEvent('change');
  expect((await demoCalls(page)).at(-1)).toEqual({domain:'light',service:'turn_on',data:{entity_id:'light.circuit_0',brightness_pct:75}});
  await expect(card.getByRole('link',{name:'Ouvrir la pièce'})).toHaveAttribute('href','/area-salon');
  await viewer.getByRole('button',{name:'Fermer la pièce'}).click();
  await expect(viewer.getByRole('region',{name:'Vue d’ensemble du niveau'})).toBeVisible();
  await page.screenshot({path:'artifacts/spatial-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('beside the house the mouse wheel and drags act on the page, on the house they drive the plan',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await page.goto('/?spatial');
  await expect(page.locator('mp-spatial-viewer [data-room="living"]')).toBeVisible();
  const {beside}=await planPoints(page);const before=await labelOffset(page,'living');
  await page.mouse.move(beside.x,beside.y);await page.mouse.down();await page.mouse.move(beside.x+120,beside.y-40,{steps:8});await page.mouse.up();
  expect(await labelOffset(page,'living')).toEqual(before);
  await page.mouse.move(beside.x,beside.y);await page.mouse.wheel(0,240);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  expect(await labelOffset(page,'living')).toEqual(before);
  await page.evaluate(()=>scrollTo(0,0));await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  // A new wheel gesture: the previous one is over once its events stop for a moment.
  const {house}=await planPoints(page);await page.waitForTimeout(400);
  await page.mouse.move(house.x,house.y);await page.mouse.wheel(0,-240);
  await expect.poll(()=>labelOffset(page,'living')).not.toEqual(before);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
});

test.describe('touch',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('a finger beside the house scrolls the page, on the house it rotates the plan',async({page})=>{
    await page.goto('/?spatial');await expect(page.locator('mp-spatial-viewer [data-room="living"]')).toBeVisible();
    const cdp=await page.context().newCDPSession(page);
    const swipe=async(from:{x:number;y:number},dx:number,dy:number)=>{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
      for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+dx*i/10,y:from.y+dy*i/10}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    const {house,beside}=await planPoints(page);const before=await labelOffset(page,'living');
    await swipe(house,0,-120);
    await expect.poll(()=>labelOffset(page,'living')).not.toEqual(before);
    expect(await page.evaluate(()=>scrollY)).toBe(0);
    const rotated=await labelOffset(page,'living');
    await swipe(beside,0,-160);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(40);
    expect(await labelOffset(page,'living')).toEqual(rotated);
  });
});

test('room card groups the lights of a room and shows its climate',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');
  await viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Cuisine'}).click();
  const kitchen=viewer.getByRole('region',{name:'Cuisine'});
  await kitchen.getByRole('button',{name:'Tout allumer'}).click();
  await expect(kitchen.getByRole('button',{name:'Tout éteindre'})).toBeVisible();
  expect(await demoCalls(page)).toEqual([{domain:'light',service:'turn_on',data:{entity_id:['light.circuit_1','light.circuit_2']}}]);
  await expect(viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Cuisine (lumière allumée)'})).toBeVisible();
  await viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Chambre'}).click();
  const bedroom=viewer.getByRole('region',{name:'Chambre'});
  await expect(bedroom.getByText('Chauffage · consigne 20 °')).toBeVisible();
  await expect(bedroom.getByText('Fermé',{exact:true})).toBeVisible();
  await expect(bedroom.getByText('19,5°',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/spatial-room-mobile.png',fullPage:true});
});

test('mobile layout, top view and wall controls remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  await viewer.getByRole('button',{name:'Vue de dessus'}).click();await viewer.getByRole('button',{name:'Murs',exact:true}).click();
  await expect(viewer.getByRole('button',{name:'Murs',exact:true})).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/spatial-mobile.png',fullPage:true});
});

test('AI import needs consent and stays a draft until explicitly applied',async({page})=>{
  await mountEditor(page);
  await expect(page.getByRole('link',{name:'Configurer Gemini',exact:true})).toHaveAttribute('href','https://my.home-assistant.io/redirect/integration/?domain=mp_glass');
  await expect(page.getByText(/une clé API dans MP Glass suffit/)).toBeVisible();
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  const generate=page.getByRole('button',{name:'Générer le brouillon 3D'});await expect(generate).toBeDisabled();
  await page.getByRole('checkbox',{name:'Envoyer ce plan à Google pour l’analyser'}).check();await generate.click();
  await expect(page.getByText('Brouillon IA · non enregistré')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed)).toHaveLength(0);
  await page.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  await expect(page.getByRole('textbox',{name:'Nom de la pièce',exact:true})).toHaveValue('Pièce importée');
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed)).toHaveLength(1);
});

test('quota error preserves plan; non administrators cannot edit',async({page})=>{
  await mountEditor(page,true,true);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await page.getByRole('checkbox',{name:'Envoyer ce plan à Google pour l’analyser'}).check();await page.getByRole('button',{name:'Générer le brouillon 3D'}).click();
  await expect(page.getByRole('status')).toContainText('Quota Gemini atteint');
  await expect(page.getByRole('textbox',{name:'Nom de la pièce',exact:true})).toHaveValue('Salon');
  await mountEditor(page,false);
  await expect(page.getByRole('button',{name:'Ajouter une pièce',exact:true})).toBeDisabled();
});

test('without a saved plan the Studio starts from the default plan',async({page})=>{
  await mountEditor(page,true,false,{saved:false,fallback:true});
  await expect(page.getByRole('note')).toContainText('Plan par défaut');
  await expect(page.getByRole('textbox',{name:'Nom du niveau',exact:true})).toHaveValue('RDC');
  await expect(page.getByRole('combobox',{name:'Pièce Home Assistant'})).toHaveValue('salon');
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed)).toHaveLength(0);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);await page.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  expect(saved.floors[0]!.name).toBe('RDC');expect(saved.floors[0]!.rooms.find(r=>r.name==='Séjour')).toBeTruthy();
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('failures explain the cause with the technical detail',async({page})=>{
  await mountEditor(page,true,false,{jobError:{error:'provider_auth',detail:'HTTP 400 INVALID_ARGUMENT API key not valid.'}});
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  await expect(page.getByRole('status')).toContainText('Clé API Gemini refusée');
  await expect(page.getByRole('status')).toContainText('Détail technique : HTTP 400 INVALID_ARGUMENT API key not valid.');
  await mountEditor(page,true,false,{uploadStatus:404});
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  await expect(page.getByRole('status')).toContainText('Service d’import introuvable');
  await page.getByRole('dialog').getByRole('button',{name:'Fermer'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Plan à importer').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('pas un plan')});
  await consentAndGenerate(page);
  await expect(page.getByRole('status')).toContainText('Format non pris en charge');
});

test('analysis window shows progress and cancels the running job',async({page})=>{
  await mountEditor(page,true,false,{pending:true});
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  const dialog=page.getByRole('dialog',{name:'Analyse du plan en cours'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('li.done')).toHaveText(['Préparation du fichier','Envoi à Home Assistant']);
  await expect(dialog.locator('li.current')).toContainText('Analyse du plan par Gemini');
  await expect(dialog.locator('li.current time')).toHaveText(/^0:0\d$/);
  await page.screenshot({path:'artifacts/spatial-import-progress.png'});
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Annuler l’analyse'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Analyse annulée');
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{messages:Record<string,unknown>[]}}).spatialTest.messages.filter(m=>m.type==='mp_glass/spatial/cancel'))).toEqual([{type:'mp_glass/spatial/cancel',job_id:'job-test'}]);
  await expect(page.getByRole('button',{name:'Générer le brouillon 3D'})).toBeEnabled();
});

test('result window previews the draft and can discard it',async({page})=>{
  await mountEditor(page);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  const dialog=page.getByRole('dialog',{name:'7 pièces reconnues'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Brouillon IA · non enregistré')).toBeVisible();
  await expect(dialog.getByText(/^104 m² · 13 × 8 m · analysé en 0:0\d$/)).toBeVisible();
  await expect(dialog.getByRole('listitem').filter({hasText:'Échelle estimée'})).toBeVisible();
  await expect(dialog.locator('mp-spatial-viewer canvas')).toBeVisible();
  await page.screenshot({path:'artifacts/spatial-import-result.png'});
  await dialog.getByRole('button',{name:'Ignorer'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Brouillon ignoré');
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed)).toHaveLength(0);
});

test('large images are reduced before upload',async({page})=>{
  await mountEditor(page);
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=4000;canvas.height=2500;const context=canvas.getContext('2d')!;context.strokeRect(100,100,3800,2300);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
    const input=document.querySelector('mp-spatial-editor')!.shadowRoot!.querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'grand-plan.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));
  });
  await consentAndGenerate(page);
  await expect(page.getByText('Brouillon IA · non enregistré')).toBeVisible();
  const [upload]=await page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{type:string;side:number}[]}}).spatialTest.uploads);
  expect(upload).toMatchObject({type:'image/png',side:3072});
});

test('editor retains associations and other floors after importing a level',async({page})=>{
  await mountEditor(page);
  await page.getByRole('combobox',{name:'Pièce Home Assistant'}).selectOption('salon');
  await page.getByRole('button',{name:'Ajouter un niveau',exact:true}).click();
  await page.getByRole('textbox',{name:'Nom du niveau',exact:true}).fill('Étage');await page.getByRole('textbox',{name:'Nom du niveau',exact:true}).blur();
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await page.getByRole('checkbox',{name:'Envoyer ce plan à Google pour l’analyser'}).check();await page.getByRole('button',{name:'Générer le brouillon 3D'}).click();
  await page.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  expect(saved.floors).toHaveLength(2);expect(saved.floors[0]!.rooms[0]!.areaId).toBe('salon');expect(saved.floors[1]!.name).toBe('Étage');
});
