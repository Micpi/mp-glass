import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

interface MountOptions { jobError?:{error:string;detail?:string;quota?:Record<string,unknown>}; uploadStatus?:number; saved?:boolean; fallback?:boolean; pending?:boolean; source?:boolean; model?:string; info?:Record<string,unknown> }
/** One-page PDF (600 x 400 pt) with a few walls, built by hand so the test needs no fixture file. */
function pdfPlan():Buffer{
  const stream='4 w 20 20 560 360 re S 300 20 m 300 380 l S 300 200 m 580 200 l S';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let body='%PDF-1.4\n';const offsets:number[]=[];
  objects.forEach((object,i)=>{offsets.push(body.length);body+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=body.length;
  body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body,'latin1');
}
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
      return new Response(JSON.stringify({id:'job-test',status:'running',...(options.model?{model:options.model}:{})}),{status:202});
    },callWS:async<T>(message:Record<string,unknown>)=>{
      messages.push(message);
      if(message.type==='mp_glass/spatial/cancel'&&message.job_id==='job-test')return {cancelled:true} as T;
      if(message.type==='mp_glass/spatial/info')return (options.info??{backend:'gemini',configured:true,model:'gemini-3.8-flash',quality:'precise'}) as T;
      if(message.type==='mp_glass/spatial/normalize'){
        // Stand-in for Home Assistant's geometry (tested in Python): each room is its box, 100 px per metre.
        const rooms=message.rooms as {name:string;box_2d:number[];polygon?:number[][]}[],width=message.width as number,height=message.height as number;
        const floor={id:'imported',name:'Niveau importé',elevation:0,height:2.6,rooms:rooms.map((room,i)=>{
          const [y0,x0,y1,x1]=room.box_2d.map((v,k)=>v*(k%2?width:height)/100000) as [number,number,number,number];
          return {id:`room-${i+1}`,name:room.name,polygon:room.polygon?room.polygon.map(([y,x])=>[x!*width/100000,y!*height/100000]):[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]};
        })};
        return {plan:{version:1,enabled:true,floors:[floor]},warnings:[],source:{width,height,scale:[.01,.01],origin:[0,0]},detection:rooms.map((room,i)=>({...room,id:`room-${i+1}`}))} as T;
      }
      if(message.type!=='mp_glass/spatial/job'||message.job_id!=='job-test')throw Error('unexpected_command');
      if(options.pending)return {id:'job-test',status:'running'} as T;
      const incoming=examplePlan();incoming.floors[0].rooms[0].name='Pièce importée';
      const failure=options.jobError??(jobError?{error:'quota'}:undefined);
      // The example plan (13 x 8 m) drawn at 100 px per metre on the analysed image.
      // Rooms as detected, in 0-1000 over the image; the kitchen's west side is drawn 10 px beside its wall.
      const detection=incoming.floors[0].rooms.map((room:{id:string;name:string;polygon:number[][]})=>{
        const xs=room.polygon.map(p=>p[0]!*100/1.3),ys=room.polygon.map(p=>p[1]!*125);
        return {id:room.id,name:room.name,box_2d:[Math.min(...ys),room.id==='kitchen'?700:Math.min(...xs),Math.max(...ys),Math.max(...xs)]};
      });
      const source=options.source?{source:{width:1300,height:800,scale:[.01,.01],origin:[0,0]},detection}:{};
      return (failure?{id:'job-test',status:'error',...failure}:{id:'job-test',status:'done',plan:incoming,warnings:['Échelle estimée'],...source}) as T;
    }};
    editor.addEventListener('spatial-change',e=>changed.push((e as CustomEvent).detail));
    document.body.replaceChildren(editor);Object.assign(window,{spatialTest:{changed,uploads,messages}});
  },{isAdmin,jobError,options});
}
/** Chooses a PNG of the example plan drawn at 100 px per metre: exterior and interior walls, 8 px thick. */
const choosePlanImage=(page:Page)=>page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=1300;canvas.height=800;const context=canvas.getContext('2d')!;
  context.fillStyle='#fff';context.fillRect(0,0,1300,800);context.lineWidth=8;context.strokeRect(4,4,1292,792);
  for(const [x0,y0,x1,y1] of [[500,0,500,400],[900,0,900,400],[0,400,1300,400],[400,400,400,800],[700,400,700,800],[1000,400,1000,800]]){context.beginPath();context.moveTo(x0!,y0!);context.lineTo(x1!,y1!);context.stroke();}
  const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
  const input=document.querySelector('mp-spatial-editor')!.shadowRoot!.querySelector<HTMLInputElement>('input[type=file]')!;
  const transfer=new DataTransfer();transfer.items.add(new File([blob],'plan.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));
});
/** Rooms sent to Home Assistant by the last edit of the draft. */
const editedRooms=async(page:Page)=>(await page.evaluate(()=>(window as unknown as {spatialTest:{messages:{type:string;rooms?:{name:string;box_2d:number[];polygon?:number[][]}[]}[]}}).spatialTest.messages.filter(m=>m.type==='mp_glass/spatial/normalize'))).at(-1)!.rooms!;
const consentAndGenerate=async(page:Page)=>{await page.getByRole('checkbox',{name:'Envoyer ce plan à Google pour l’analyser'}).check();await page.getByRole('button',{name:'Générer le brouillon 3D'}).click();};
const demoCalls=(page:Page)=>page.evaluate(()=>(window as unknown as {demo:{calls:unknown[]}}).demo.calls);
/** Points of the canvas: its centre is the house (first one not covered by a label), a bottom corner is beside it. */
const planPoints=(page:Page)=>page.evaluate(()=>{
  const root=document.querySelector('mp-glass-view-v4')!.shadowRoot!.querySelector('mp-spatial-viewer')!.shadowRoot!,canvas=root.querySelector('canvas')!,r=canvas.getBoundingClientRect();
  const house=([[0,0],[0,30],[30,0],[-30,0],[0,-30],[40,40],[-40,40]] as const).map(([dx,dy])=>({x:r.x+r.width/2+dx,y:r.y+r.height/2+dy})).find(p=>root.elementFromPoint(p.x,p.y)===canvas);
  if(!house)throw Error('house hidden by labels');
  return {house,beside:{x:r.x+16,y:r.y+r.height-16}};
});
/** Longer than the press Recentrer waits for before offering to save the view. */
const HOLD=750;
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

test('holding Recentrer saves the view after a confirmation, and the plan opens on it',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('[data-room="living"]')).toBeVisible();
  const {house}=await planPoints(page);
  await page.mouse.move(house.x,house.y);await page.mouse.down();await page.mouse.move(house.x+110,house.y+25,{steps:8});await page.mouse.up();
  const chosen=await labelOffset(page,'living');
  // Held down, the button asks before keeping the view; a plain click meanwhile only recentres.
  await viewer.getByRole('button',{name:'Recentrer',exact:true}).hover();
  await page.mouse.down();await page.waitForTimeout(HOLD);await page.mouse.up();
  await expect(viewer.getByText('Enregistrer cette vue ?')).toBeVisible();
  await viewer.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(viewer.getByText('Enregistrer cette vue ?')).toBeHidden();
  expect(await labelOffset(page,'living')).toEqual(chosen);
  await page.mouse.move(house.x,house.y);await page.mouse.down();await page.mouse.move(house.x-90,house.y+45,{steps:8});await page.mouse.up();
  await expect.poll(()=>labelOffset(page,'living')).not.toEqual(chosen);
  await viewer.getByRole('button',{name:'Revenir à la vue enregistrée'}).click();
  await expect.poll(()=>labelOffset(page,'living')).toEqual(chosen);
  // Kept in this browser: the plan is framed that way again on the next visit.
  await page.reload();await expect(viewer.locator('[data-room="living"]')).toBeVisible();
  await expect.poll(()=>labelOffset(page,'living')).toEqual(chosen);
  await viewer.getByRole('button',{name:'Revenir à la vue enregistrée'}).hover();
  await page.mouse.down();await page.waitForTimeout(HOLD);await page.mouse.up();
  await viewer.getByRole('button',{name:'Oublier la vue enregistrée'}).click();
  await expect(viewer.getByRole('button',{name:'Recentrer',exact:true})).toBeVisible();
  await page.reload();await expect(viewer.locator('[data-room="living"]')).toBeVisible();
  await expect.poll(()=>labelOffset(page,'living')).not.toEqual(chosen);
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
  test('on a phone a finger on a handle resizes the room, elsewhere it scrolls the result window',async({page})=>{
    await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
    const dialog=page.getByRole('dialog'),figure=dialog.locator('mp-plan-zones figure');
    await expect(dialog.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
    const frame=(await figure.boundingBox())!;
    await page.touchscreen.tap(frame.x+frame.width*.18,frame.y+frame.height*.25);
    await expect(figure.locator('.handle')).toHaveCount(8);
    await dialog.locator('mp-plan-zones').screenshot({path:'artifacts/spatial-zones-phone.png'});
    const cdp=await page.context().newCDPSession(page);
    const swipe=async(from:{x:number;y:number},dx:number,dy:number)=>{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
      for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+dx*i/10,y:from.y+dy*i/10}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    const scrolled=()=>dialog.evaluate(d=>d.scrollTop);
    // Beside the square itself, still on its larger target: 8 px below the south handle, dragged 20 px down.
    const south=(await figure.locator('.handle[data-handle=s]').boundingBox())!;
    const before=await editedRooms(page),top=await scrolled();
    await swipe({x:south.x+south.width/2,y:south.y+south.height/2+8},0,20);
    await expect.poll(async()=>(await editedRooms(page))[0]!.box_2d[2]).toBeGreaterThan(before[0]!.box_2d[2]!+20);
    expect(await scrolled()).toBe(top);
    const list=dialog.locator('mp-plan-zones li').nth(3),item=(await list.boundingBox())!;
    await swipe({x:item.x+item.width/2,y:item.y+item.height/2},0,-200);
    await expect.poll(scrolled).toBeGreaterThan(top+40);
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

test('the floor overview turns off every light still on, in one call',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer'),overview=viewer.getByRole('region',{name:'Vue d’ensemble du niveau'});
  await expect(overview.getByRole('button',{name:'Tout est éteint'})).toBeDisabled();
  await page.evaluate(()=>(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo.hass.callService('light','turn_on',{entity_id:['light.circuit_0','light.circuit_2']}));
  await expect(overview.locator('.stat',{hasText:'Lumières'})).toContainText('2 / 3');
  await viewer.locator('.side').screenshot({path:'artifacts/spatial-overview-lit.png'});
  await overview.getByRole('button',{name:'Éteindre tout le niveau'}).click();
  expect((await demoCalls(page)).at(-1)).toEqual({domain:'light',service:'turn_off',data:{entity_id:['light.circuit_0','light.circuit_2']}});
  await expect(overview.getByRole('button',{name:'Tout est éteint'})).toBeDisabled();
  await expect(overview.locator('.stat',{hasText:'Lumières'})).toContainText('0 / 3');
  await viewer.locator('.side').screenshot({path:'artifacts/spatial-overview-off.png'});
});

test('mobile layout, top view and wall controls remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  await viewer.getByRole('button',{name:'Vue de dessus'}).click();await viewer.getByRole('button',{name:'Murs',exact:true}).click();
  await expect(viewer.getByRole('button',{name:'Murs',exact:true})).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/spatial-mobile.png',fullPage:true});
});

test('the room list stays on one line under the plan and scrolls with its arrows',async({page})=>{
  await page.setViewportSize({width:1000,height:900});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer'),strip=viewer.locator('nav.strip'),chips=strip.getByRole('button');
  await expect(chips.first()).toBeVisible();
  const [stage,list,card]=await Promise.all([viewer.locator('.stage').boundingBox(),strip.boundingBox(),viewer.locator('.card').boundingBox()]);
  expect(list!.y).toBeGreaterThan(stage!.y+stage!.height);
  expect(Math.abs(list!.x-stage!.x)).toBeLessThan(1);expect(Math.abs(list!.width-stage!.width)).toBeLessThan(1);
  expect(card!.x).toBeGreaterThan(stage!.x+stage!.width);
  expect(await chips.evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().top))).size)).toBe(1);
  const next=viewer.getByTitle('Pièces suivantes'),previous=viewer.getByTitle('Pièces précédentes');
  await expect(next).toBeVisible();await expect(previous).toBeHidden();
  await next.click();
  await expect.poll(()=>strip.evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
  await expect(previous).toBeVisible();
  await previous.click();
  await expect.poll(()=>strip.evaluate(el=>el.scrollLeft)).toBe(0);
  await expect(previous).toBeHidden();
  // A room chosen on the plan brings its chip into view.
  const chip=strip.getByRole('button',{name:'Salle de bain'});
  await viewer.locator('[data-room="bath"]').dispatchEvent('click');
  await expect(chip).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>{const [s,c]=await Promise.all([strip.boundingBox(),chip.boundingBox()]);return c!.x>=s!.x&&c!.x+c!.width<=s!.x+s!.width;}).toBe(true);
  await page.screenshot({path:'artifacts/spatial-room-list.png'});
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

test('over plain HTTP the draft is applied and rooms and floors are added',async({page})=>{
  // Home Assistant at http://IP:8123 is not a secure context: crypto.randomUUID is missing there.
  await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined});});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await mountEditor(page);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);await page.getByRole('dialog').getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Nom de la pièce',exact:true})).toHaveValue('Pièce importée');
  await page.getByRole('button',{name:'Ajouter une pièce',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Nom de la pièce',exact:true})).toHaveValue('Nouvelle pièce');
  await page.getByRole('button',{name:'Ajouter un niveau',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Nom du niveau',exact:true})).toHaveValue('Niveau 1');
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  const rooms=saved.floors[0]!.rooms;
  expect(rooms.find(r=>r.name==='Pièce importée')!.id).toMatch(/^room-[0-9a-f]{8}$/);
  expect(rooms.find(r=>r.name==='Nouvelle pièce')!.id).toMatch(/^room-[0-9a-f]{8}$/);
  expect(saved.floors[1]!.id).toMatch(/^floor-[0-9a-f]{8}$/);
  expect(errors).toEqual([]);
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
  expect(saved.floors[0]!.name).toBe('RDC');
  // "Salon" is not on the imported plan: its only living room, "Séjour", takes the area and follows it.
  expect(saved.floors[0]!.rooms.find(r=>r.name==='Séjour')).toMatchObject({areaId:'salon'});expect(saved.floors[0]!.rooms.find(r=>r.name==='Séjour')!.entityIds).toBeUndefined();
  await expect(page.getByRole('status')).toContainText('1 pièce reliée à Home Assistant par son nom');
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

test('an overloaded model can be swapped for the other one in a click',async({page})=>{
  await mountEditor(page,true,false,{jobError:{error:'provider_unavailable',detail:'HTTP 503 UNAVAILABLE This model is currently experiencing high demand.'},model:'gemini-3.8-flash'});
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  const dialog=page.getByRole('dialog',{name:'Analyse impossible'});
  await expect(dialog.getByRole('status')).toContainText('Gemini 3.8 Flash est momentanément surchargé ; MP Glass a déjà réessayé deux fois. Réessayez dans quelques minutes, ou tout de suite avec Gemini 3.5 Flash-Lite.');
  await expect(dialog.getByRole('status')).toContainText('high demand');
  await dialog.getByRole('button',{name:'Réessayer avec Gemini 3.5 Flash-Lite'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{url:string}[]}}).spatialTest.uploads.map(u=>u.url)))
    .toEqual(['/api/mp_glass/spatial/analyze?page=1&quality=precise','/api/mp_glass/spatial/analyze?page=1&quality=fast']);
  // The retry changed the model chosen for the next analyses.
  await expect(page.getByRole('combobox',{name:'Modèle d’analyse'})).toHaveValue('fast');
});

test('the model is chosen before the analysis and remembered in this browser',async({page})=>{
  await mountEditor(page);
  const choice=()=>page.getByRole('combobox',{name:'Modèle d’analyse'});
  await expect(choice()).toHaveValue('precise');
  await expect(choice().locator('option')).toHaveText(['Gemini 3.8 Flash — le plus précis · réglage par défaut','Gemini 3.5 Flash-Lite — le plus rapide']);
  await page.locator('mp-spatial-editor .box').first().screenshot({path:'artifacts/spatial-model-choice.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('mp-spatial-editor .box').first().screenshot({path:'artifacts/spatial-model-choice-phone.png'});
  await page.setViewportSize({width:1280,height:720});
  await choice().selectOption('fast');
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  await expect(page.getByText('Brouillon IA · non enregistré')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{url:string}[]}}).spatialTest.uploads.map(u=>u.url))).toEqual(['/api/mp_glass/spatial/analyze?page=1&quality=fast']);
  // The Studio opened again: the last choice is kept, the default one is still marked.
  await mountEditor(page);
  await expect(choice()).toHaveValue('fast');
  // A custom model in the options stays available as the default choice.
  await page.evaluate(()=>localStorage.clear());
  await mountEditor(page,true,false,{info:{backend:'gemini',configured:true,model:'gemini-3.8-flash-preview',quality:null}});
  await expect(choice()).toHaveValue('');
  await expect(choice().locator('option')).toHaveText(['Modèle des options (gemini-3.8-flash-preview)','Gemini 3.8 Flash — le plus précis','Gemini 3.5 Flash-Lite — le plus rapide']);
});

test('in add-on mode the worker chooses its own model',async({page})=>{
  await mountEditor(page,true,false,{info:{backend:'addon',configured:true,model:null,quality:null}});
  await expect(page.getByText('Mode add-on : le modèle est celui de l’option « model » de l’add-on.')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Modèle d’analyse'})).toHaveCount(0);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  await expect(page.getByText('Brouillon IA · non enregistré')).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{url:string}[]}}).spatialTest.uploads.map(u=>u.url))).toEqual(['/api/mp_glass/spatial/analyze?page=1']);
});

test.describe('quota',()=>{
  test.use({timezoneId:'Europe/Paris'});
  const uploadedUrls=(page:Page)=>page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{url:string}[]}}).spatialTest.uploads.map(u=>u.url));
  test('an exhausted daily quota says when it comes back and offers the other model',async({page})=>{
    // 17:50 in Paris, 8:50 in California: the quotas come back at midnight there, 9:00 tomorrow here.
    await page.clock.setFixedTime(new Date('2026-09-14T15:50:00Z'));
    await mountEditor(page,true,false,{model:'gemini-3.8-flash',jobError:{error:'quota',detail:'HTTP 429 RESOURCE_EXHAUSTED · GenerateRequestsPerDayPerProjectPerModel-FreeTier · limite 20 · gemini-3.8-flash',
      quota:{period:'day',unit:'requests',limit:20,model:'gemini-3.8-flash',retry:37}}});
    await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
    await consentAndGenerate(page);
    const dialog=page.getByRole('dialog',{name:'Analyse impossible'});
    await expect(dialog.getByRole('status')).toContainText('Quota gratuit du jour épuisé pour Gemini 3.8 Flash (20 requêtes par jour). Google le renouvelle à minuit, heure de Californie, soit demain à 9 h. Gemini 3.5 Flash-Lite a son propre quota : vous pouvez l’essayer tout de suite.');
    await expect(dialog.getByRole('status')).toContainText('GenerateRequestsPerDayPerProjectPerModel-FreeTier · limite 20');
    await expect(dialog.getByRole('link',{name:'Voir vos quotas Gemini'})).toHaveAttribute('href','https://ai.dev/rate-limit');
    await expect(dialog.getByRole('button',{name:'Réessayer avec Gemini 3.5 Flash-Lite'})).toHaveClass('primary');
    expect(await uploadedUrls(page)).toEqual(['/api/mp_glass/spatial/analyze?page=1&quality=precise']);  // nothing sent again on its own
    await page.screenshot({path:'artifacts/spatial-quota.png'});
    await dialog.getByRole('button',{name:'Réessayer avec Gemini 3.5 Flash-Lite'}).click();
    await expect.poll(()=>uploadedUrls(page)).toEqual(['/api/mp_glass/spatial/analyze?page=1&quality=precise','/api/mp_glass/spatial/analyze?page=1&quality=fast']);
  });
  test('a per-minute limit counts down before retrying the same model',async({page})=>{
    await mountEditor(page,true,false,{model:'gemini-3.8-flash',jobError:{error:'quota',quota:{period:'minute',unit:'requests',limit:5,model:'gemini-3.8-flash',retry:2}}});
    await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
    await consentAndGenerate(page);
    const dialog=page.getByRole('dialog',{name:'Analyse impossible'});
    await expect(dialog.getByRole('status')).toContainText('Limite par minute de Gemini 3.8 Flash atteinte (5 requêtes par minute) : réessayez dans 2 secondes.');
    await expect(dialog.getByRole('button',{name:/^Réessayer dans \d s$/})).toBeDisabled();
    await expect(dialog.getByRole('button',{name:/Réessayer avec/})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'Réessayer',exact:true})).toBeEnabled({timeout:5000});
  });
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

test('detected rooms fit the drawn walls and can be moved, resized, drawn, deleted and renamed',async({page})=>{
  await mountEditor(page,true,false,{source:true});
  await choosePlanImage(page);
  await consentAndGenerate(page);
  await expect(page.getByRole('dialog',{name:'7 pièces reconnues'})).toBeVisible();
  const dialog=page.getByRole('dialog');  // Its title follows the rooms added and removed.
  await expect(dialog.getByRole('tab',{name:'Sur le plan d’origine'})).toHaveAttribute('aria-selected','true');
  const zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  const lastRooms=()=>editedRooms(page);
  await expect(figure.locator('img')).toHaveJSProperty('naturalWidth',1300);
  // Right after the analysis, the rooms' sides are moved onto the walls drawn on the plan.
  await expect(dialog.getByRole('listitem').filter({hasText:/bords? de pièce ajustés? aux murs du plan/})).toBeVisible();
  const kitchen=(await lastRooms()).find(r=>r.name==='Cuisine')!;
  expect(kitchen.box_2d[1]).toBeCloseTo(692.3,0);
  await expect(figure.locator('polygon')).toHaveCount(7);
  await expect(figure.locator('.label',{hasText:'Pièce importée'})).toHaveCount(1);
  await page.screenshot({path:'artifacts/spatial-import-zones.png'});

  // Select the living room, then pull its east handle 60 px: away from any wall, the side follows the finger.
  const box=async()=>(await figure.boundingBox())!;
  let frame=await box();
  await page.mouse.click(frame.x+frame.width*.18,frame.y+frame.height*.25);
  await expect(figure.locator('.handle')).toHaveCount(8);
  const east=(await figure.locator('.handle[data-handle=e]').boundingBox())!;
  await page.mouse.move(east.x+east.width/2,east.y+east.height/2);await page.mouse.down();
  await page.mouse.move(east.x+east.width/2+30,east.y+east.height/2,{steps:4});await page.mouse.move(east.x+east.width/2+60,east.y+east.height/2,{steps:4});await page.mouse.up();
  await expect.poll(async()=>(await lastRooms())[0]!.box_2d[3]).toBeGreaterThan(450);
  const living=(await lastRooms())[0]!;
  expect(living.box_2d[3]).toBeCloseTo(385+60/frame.width*1000,-1);
  expect(living.name).toBe('Pièce importée');

  // Close to a wall, the side is attracted by it: the living room back onto its east wall.
  const handle=(await figure.locator('.handle[data-handle=e]').boundingBox())!;
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
  await page.mouse.move(frame.x+frame.width*.385+5,handle.y+handle.height/2,{steps:6});await page.mouse.up();
  await expect.poll(async()=>(await lastRooms())[0]!.box_2d[3]).toBeLessThan(400);
  expect((await lastRooms())[0]!.box_2d[3]).toBeCloseTo(385,-0.5);

  // Undo restores the previous state.
  await zones.getByRole('button',{name:'Annuler'}).click();
  await expect.poll(async()=>(await lastRooms())[0]!.box_2d[3]).toBeGreaterThan(450);

  // Draw a new room, then name it.
  await zones.getByRole('button',{name:'Ajouter une pièce'}).click();
  await expect(zones.getByRole('button',{name:'Ajouter une pièce'})).toHaveAttribute('aria-pressed','true');
  // The plan stays where it was when a drawing mode starts.
  expect((await box()).y).toBe(frame.y);
  frame=await box();
  await page.mouse.move(frame.x+frame.width*.55,frame.y+frame.height*.6);await page.mouse.down();
  await page.mouse.move(frame.x+frame.width*.6,frame.y+frame.height*.7,{steps:3});await page.mouse.move(frame.x+frame.width*.64,frame.y+frame.height*.8,{steps:3});await page.mouse.up();
  await expect(figure.locator('polygon')).toHaveCount(8);
  await expect(dialog.getByRole('heading',{name:'8 pièces reconnues'})).toBeVisible();
  const name=zones.getByRole('textbox',{name:'Nom de la pièce 8'});
  await expect(name).toBeFocused();await expect(name).toHaveValue('Pièce 8');
  await name.fill('Cellier');await name.press('Enter');
  await expect.poll(async()=>(await lastRooms()).map(r=>r.name)).toContain('Cellier');
  const cellar=(await lastRooms()).at(-1)!.box_2d;
  // Drawn 7 px beside the wall at x = 700 px: its west side is put on that wall, the others stay where they were drawn.
  expect(Math.abs(cellar[1]!-538.5)).toBeLessThan(2);expect(cellar[3]).toBeCloseTo(640,-1);expect(cellar[0]).toBeCloseTo(600,-1);expect(cellar[2]).toBeCloseTo(800,-1);

  // Delete a room from the list, another one with the keyboard; each room keeps its colour.
  const swatch=()=>zones.getByRole('listitem').filter({has:page.getByRole('textbox',{name:'Nom de la pièce 4'})}).locator('.swatch').getAttribute('style');
  const bedroom=await swatch();
  await zones.getByRole('button',{name:'Supprimer Cuisine'}).click();
  await expect(figure.locator('polygon')).toHaveCount(7);
  await expect(zones.getByRole('textbox',{name:'Nom de la pièce 3'})).toHaveValue('Chambre');
  expect(await zones.getByRole('listitem').filter({has:page.getByRole('textbox',{name:'Nom de la pièce 3'})}).locator('.swatch').getAttribute('style')).toBe(bedroom);
  frame=await box();  // the window scrolled to the name of the room just drawn
  await page.mouse.click(frame.x+frame.width*.85,frame.y+frame.height*.75);
  await expect(zones.locator('li.selected input')).toHaveValue('Salle de bain');
  await page.keyboard.press('Delete');
  await expect(figure.locator('polygon')).toHaveCount(6);
  expect((await lastRooms()).map(r=>r.name)).not.toContain('Salle de bain');
  await page.screenshot({path:'artifacts/spatial-import-zones-edited.png'});

  await dialog.getByRole('tab',{name:'En 3D'}).click();
  await expect(dialog.locator('mp-spatial-viewer canvas')).toBeVisible();
  await dialog.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  const names=saved.floors[0]!.rooms.map(r=>r.name);
  expect(names).toHaveLength(6);expect(names).toContain('Cellier');expect(names).not.toContain('Cuisine');
});

test('a room follows its real shape: drawn corner by corner, then corners moved, added and removed',async({page})=>{
  await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
  const dialog=page.getByRole('dialog'),zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  await expect(dialog.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
  const lastRoom=async()=>(await editedRooms(page)).at(-1)!;
  const outline=async()=>(await lastRoom()).polygon!.map(([y,x])=>[x!,y!]);  // [x, y] in 0-1000
  /** Screen position of a point of the plan, in 0-1000. */
  const screen=async(x:number,y:number)=>{const f=(await figure.boundingBox())!;return {x:f.x+f.width*x/1000,y:f.y+f.height*y/1000};};
  const click=async(x:number,y:number)=>{await idle();const s=await screen(x,y);await page.mouse.click(s.x,s.y);};
  // Each edit is rebuilt by Home Assistant; the plan ignores the pointer meanwhile.
  const idle=()=>expect(figure).not.toHaveClass(/busy/);
  const centre=async(handle:string)=>{await idle();const b=(await figure.locator(handle).boundingBox())!;return {x:b.x+b.width/2,y:b.y+b.height/2};};
  const pull=async(handle:string,dx:number,dy:number)=>{const c=await centre(handle);await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+dx/2,c.y+dy/2,{steps:4});await page.mouse.move(c.x+dx,c.y+dy,{steps:4});await page.mouse.up();};

  // An L-shaped room drawn corner by corner, each click a few pixels off: corners go onto the walls and in line with the previous ones.
  await zones.getByRole('button',{name:'Tracer un contour'}).click();
  await expect(zones.getByRole('button',{name:'Terminer le contour'})).toBeDisabled();
  for(const [x,y] of [[541,504],[765,506],[772,760],[640,757],[643,990],[541,992]])await click(x!,y!);
  await expect(figure.locator('.point')).toHaveCount(6);
  await expect(zones.getByRole('button',{name:'Terminer le contour'})).toBeEnabled();
  await page.screenshot({path:'artifacts/spatial-zones-trace.png'});
  await click(540,502);  // back on the first corner: closed
  await expect(figure.locator('polygon[data-zone]')).toHaveCount(8);
  const drawn=await outline();
  expect(drawn).toHaveLength(6);
  expect(Math.abs(drawn[0]![0]!-538.5)).toBeLessThan(2);expect(Math.abs(drawn[0]![1]!-500)).toBeLessThan(2);
  expect(drawn[1]![0]).toBe(drawn[2]![0]);expect(drawn[2]![1]).toBe(drawn[3]![1]);expect(drawn[3]![0]).toBe(drawn[4]![0]);
  expect(drawn[4]![1]).toBe(drawn[5]![1]);expect(drawn[5]![0]).toBe(drawn[0]![0]);expect(drawn[0]![1]).toBe(drawn[1]![1]);
  expect((await lastRoom()).box_2d).toEqual([drawn[0]![1],drawn[0]![0],drawn[4]![1],drawn[1]![0]]);
  await expect(zones.getByRole('textbox',{name:'Nom de la pièce 8'})).toBeFocused();
  await expect(figure.locator('polygon[data-zone="7"]')).toHaveAttribute('points',/^(\S+ ){5}\S+$/);
  await expect(figure.locator('.vertex')).toHaveCount(6);await expect(figure.locator('.mid')).toHaveCount(6);
  await page.screenshot({path:'artifacts/spatial-zones-outline.png'});

  // The inner corner moved 60 px to the right: its side stays horizontal.
  await pull('.vertex[data-vertex="3"]',60,0);
  await expect.poll(async()=>(await outline())[3]![0]).toBeGreaterThan(700);
  let edited=await outline();
  expect(edited[3]![1]).toBe(edited[2]![1]);expect(edited[4]).toEqual(drawn[4]);

  // A + on the top side adds a corner where it is dropped; a double click removes it.
  await pull('.mid[data-mid="0"]',0,30);
  await expect.poll(async()=>(await outline()).length).toBe(7);
  expect((await outline())[1]![1]).toBeGreaterThan(560);
  await page.mouse.dblclick((await centre('.vertex[data-vertex="1"]')).x,(await centre('.vertex[data-vertex="1"]')).y);
  await expect.poll(async()=>(await outline()).length).toBe(6);

  // A corner touched then removed with the toolbar, another with the keyboard.
  await expect(zones.getByRole('button',{name:'Supprimer le point'})).toBeDisabled();
  await page.mouse.click((await centre('.vertex[data-vertex="3"]')).x,(await centre('.vertex[data-vertex="3"]')).y);
  await expect(figure.locator('.vertex.active')).toHaveCount(1);
  await zones.getByRole('button',{name:'Supprimer le point'}).click();
  await expect.poll(async()=>(await outline()).length).toBe(5);
  await page.mouse.click((await centre('.vertex[data-vertex="2"]')).x,(await centre('.vertex[data-vertex="2"]')).y);
  await page.keyboard.press('Delete');
  await expect.poll(async()=>(await outline()).length).toBe(4);
  await expect(figure.locator('polygon[data-zone]')).toHaveCount(8);  // the room itself stays

  // Back to a rectangle, and undone.
  edited=await outline();
  await idle();await zones.getByRole('button',{name:'Rectangle'}).click();
  await expect.poll(async()=>(await lastRoom()).polygon).toBeUndefined();
  expect((await lastRoom()).box_2d[1]).toBe(Math.min(...edited.map(q=>q[0]!)));
  await idle();await zones.getByRole('button',{name:'Annuler'}).click();
  await expect.poll(async()=>(await lastRoom()).polygon?.length).toBe(4);

  // « Forme libre » gives a rectangle its outline as shown, with a handle on each corner.
  await click(150,250);
  await expect(zones.getByRole('button',{name:'Forme libre'})).toBeEnabled();
  await zones.getByRole('button',{name:'Forme libre'}).click();
  await expect.poll(async()=>(await editedRooms(page))[0]!.polygon?.length).toBe(4);
  await expect(figure.locator('.vertex')).toHaveCount(4);
  const living=(await editedRooms(page))[0]!;
  expect(living.box_2d).toEqual([Math.min(...living.polygon!.map(q=>q[0]!)),Math.min(...living.polygon!.map(q=>q[1]!)),Math.max(...living.polygon!.map(q=>q[0]!)),Math.max(...living.polygon!.map(q=>q[1]!))]);
});

test('walls 2 px thick are found on a small plan, not the thin lines',async({page})=>{
  await page.goto('/?spatial');
  const walls=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=650;canvas.height=400;const context=canvas.getContext('2d')!;
    context.fillStyle='#fff';context.fillRect(0,0,650,400);context.fillStyle='#222';
    for(const [x,y,w,h] of [[0,0,650,2],[0,398,650,2],[0,0,2,400],[648,0,2,400],[324,0,2,400],[0,199,650,2]])context.fillRect(x!,y!,w!,h!);
    context.fillRect(60,100,200,1);  // furniture drawn with a thin line
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
    const module='/frontend/spatial/zones.ts';const {detectWalls}=await import(module);
    return detectWalls(blob) as Promise<{x:{at:number}[];y:{at:number}[]}>;
  });
  const found=(lines:{at:number}[],at:number)=>lines.some(line=>Math.abs(line.at-at)<3);
  expect(found(walls.x,500)).toBe(true);expect(found(walls.y,500)).toBe(true);
  expect(found(walls.y,251)).toBe(false);
});

test('a PDF page is drawn in the browser and only that image is sent',async({page})=>{
  await mountEditor(page);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.pdf',mimeType:'application/pdf',buffer:pdfPlan()});
  await consentAndGenerate(page);
  await expect(page.getByText('Brouillon IA · non enregistré')).toBeVisible();
  // 600 x 400 pt drawn at 4x: 2400 x 1600 pixels, PNG.
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{uploads:{type:string;side:number}[]}}).spatialTest.uploads)).toMatchObject([{type:'image/png',side:2400}]);
  await page.getByRole('dialog').getByRole('button',{name:'Ignorer'}).click();
  await page.getByLabel('Page du PDF').fill('2');await page.getByLabel('Page du PDF').blur();
  await consentAndGenerate(page);
  await expect(page.getByRole('status')).toContainText('La page 2 n’existe pas : ce PDF compte 1 page.');
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


test('precise zoom keeps editing coordinates, supports panning and can disable snapping',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
  const zones=page.locator('mp-plan-zones');await expect(zones.locator('polygon[data-zone="0"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {spatialTest:{messages:{type:string}[]}}).spatialTest.messages.filter(m=>m.type==='mp_glass/spatial/normalize').length)).toBeGreaterThan(0);
  await zones.getByRole('button',{name:'Zoom avant du plan'}).click();await zones.getByRole('button',{name:'Zoom avant du plan'}).click();
  await expect(zones.getByLabel('Zoom du plan',{exact:true})).toHaveText('225 %');
  await zones.getByRole('button',{name:'Déplacer le plan',exact:true}).click();
  const viewport=zones.locator('.viewport'),v=(await viewport.boundingBox())!;
  const before=await viewport.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop}));
  await page.mouse.move(v.x+v.width/2,v.y+v.height/2);await page.mouse.down();await page.mouse.move(v.x+v.width/2-70,v.y+v.height/2-35,{steps:5});await page.mouse.up();
  expect(await viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(before.x+50);
  await zones.getByRole('button',{name:'Déplacer le plan',exact:true}).click();
  await zones.getByRole('button',{name:'Aimantation',exact:true}).click();
  await expect(zones.getByRole('button',{name:'Aimantation',exact:true})).toHaveAttribute('aria-pressed','false');
  await viewport.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
  await zones.locator('li').first().click();
  const handle=zones.locator('[data-handle=e]'),h=(await handle.boundingBox())!,f=(await zones.locator('figure').boundingBox())!;
  const initial=(await editedRooms(page))[0]!.box_2d[3]!;
  await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2,{steps:4});await page.mouse.up();
  await expect.poll(async()=>(await editedRooms(page))[0]!.box_2d[3]!).toBeGreaterThan(initial+1);
  expect((await editedRooms(page))[0]!.box_2d[3]!-initial).toBeCloseTo(12/f.width*1000,0);
  expect(h.width).toBeLessThan(25); // handles remain the same screen size at high zoom
  await zones.screenshot({path:'artifacts/spatial-precision-zoom.png'});
  await zones.getByRole('button',{name:'Ajuster à l’écran'}).click();await expect(zones.getByLabel('Zoom du plan',{exact:true})).toHaveText('100 %');
});

test('climate and shutter position update on the plan and cover commands target only the selected entity',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  await viewer.getByRole('button',{name:'Climat',exact:true}).click();
  await expect(viewer.locator('[data-room="living"]')).toContainText('21,5 °C');
  await expect(viewer.locator('[data-room="bedroom"]')).toContainText('19,5 °C');
  await viewer.locator('[data-room="living"]').click();
  const card=viewer.getByRole('region',{name:'Salon'});
  await card.getByRole('button',{name:'Fermer le volet Volet baie'}).click();
  await expect(viewer.locator('[data-room="living"]')).toContainText('0 %');
  await card.getByRole('slider',{name:'Ouverture Volet baie'}).fill('45');
  await expect(viewer.locator('[data-room="living"]')).toContainText('45 %');
  await card.getByRole('button',{name:'Arrêter le volet Volet baie'}).click();
  expect(await demoCalls(page)).toEqual([{domain:'cover',service:'close_cover',data:{entity_id:'cover.salon'}},{domain:'cover',service:'set_cover_position',data:{entity_id:'cover.salon',position:45}},{domain:'cover',service:'stop_cover',data:{entity_id:'cover.salon'}}]);
  await viewer.screenshot({path:'artifacts/spatial-climate-covers.png'});
  await page.setViewportSize({width:390,height:844});await viewer.screenshot({path:'artifacts/spatial-climate-covers-phone.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('plan labels show a temperature only in rooms that measure it, and no climate mode without any',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  const label=(room:string)=>viewer.locator(`[data-room="${room}"]`);
  const setStates=(patch:Record<string,{state:string}|null>)=>page.evaluate(patch=>{
    const view=document.querySelector('mp-glass-view-v4') as HTMLElement&{hass:import('../../frontend/ha/client').Hass},states={...view.hass.states};
    for(const [id,value] of Object.entries(patch)){if(value)states[id]={...states[id]!,...value};else delete states[id];}
    view.hass={...view.hass,states};
  },patch);
  await page.evaluate(()=>(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo.hass.callService('light','turn_on',{entity_id:'light.circuit_1'}));
  // Lights: a warm dot on the lit kitchen only, names alone where there is nothing to read.
  await expect(label('kitchen').locator('i')).toHaveCount(1);await expect(label('dining').locator('i')).toHaveCount(0);
  await expect(label('dining')).toHaveText('Séjour');await expect(label('dining').locator('.readings')).toHaveCount(0);
  await viewer.getByRole('button',{name:'Climat',exact:true}).click();
  await expect(label('bedroom').locator('.reading')).toHaveText('19,5 °C');
  for(const room of ['kitchen','dining','hall','office','bath'])await expect(label(room).locator('.readings')).toHaveCount(0);
  await expect(label('kitchen').locator('i')).toHaveCount(0);
  // An offline thermometer still says so; its room keeps its shutter.
  await setStates({'sensor.salon_temperature':{state:'unavailable'}});
  await expect(label('living').locator('.reading.temp')).toHaveText('—');
  await expect(label('living').locator('.reading.temp')).toHaveAttribute('title','Température indisponible');
  await expect(label('living')).toContainText('65 %');
  await viewer.screenshot({path:'artifacts/spatial-labels-climate.png'});
  // No thermometer left on the floor: no climate mode to offer, the plan shows the lights.
  await setStates({'sensor.salon_temperature':null,'climate.chambre':null});
  await expect(viewer.getByRole('button',{name:'Climat',exact:true})).toHaveCount(0);
  await expect(viewer.locator('.legend')).toHaveCount(0);
  await expect(label('bedroom').locator('.readings')).toHaveCount(0);
  await expect(label('kitchen').locator('i')).toHaveCount(1);
});

test('wall fitting follows concave outlines and does not count duplicate wall fragments twice',async({page})=>{
  await page.goto('/?spatial');
  const result=await page.evaluate(async()=>{
    const module='/frontend/spatial/zones.ts';const {snapOutline,snapBox,detectWalls}=await import(module);
    const shape=[[100,100],[100,500],[300,500],[300,300],[500,300],[500,100]];
    const adjusted=snapOutline(shape,{x:[{at:105,from:100,to:500}],y:[]},10,10);
    const box=snapBox([100,100,500,500],{x:[{at:105,from:100,to:200},{at:106,from:100,to:200}],y:[]},10,10);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1000;const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,1000,1000);context.fillStyle='#aaa';context.fillRect(200,100,8,700);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));const faded=await detectWalls(blob);
    return {adjusted,box,faded};
  });
  expect(result.adjusted).toEqual([[100,105],[100,500],[300,500],[300,300],[500,300],[500,105]]);
  expect(result.box).toEqual([100,100,500,500]);
  expect(result.faded.x.some((line:{at:number})=>Math.abs(line.at-204)<5)).toBe(true);
});


test('equipment selection survives searches and missing entities',async({page})=>{
  await mountEditor(page);
  const editor=page.locator('mp-spatial-editor');
  await page.getByLabel('Rechercher un équipement').fill('cover.salon');
  await editor.getByRole('checkbox',{name:/Volet baie/}).check();
  await page.getByLabel('Rechercher un équipement').fill('sensor.salon_temperature');
  await editor.getByRole('checkbox',{name:/Température/}).check();
  const saved=()=>page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!.floors[0]!.rooms[0]!.entityIds!);
  expect(await saved()).toContain('cover.salon');expect(await saved()).toContain('sensor.salon_temperature');
  await page.evaluate(()=>{const editor=document.querySelector('mp-spatial-editor') as HTMLElement&{hass:import('../../frontend/ha/client').Hass};const states={...editor.hass.states};delete states['cover.salon'];editor.hass={...editor.hass,states};});
  await page.getByLabel('Rechercher un équipement').fill('cover.salon');
  const missing=editor.getByRole('checkbox',{name:/cover.salon.*indisponible/});await expect(missing).toBeChecked();await missing.click();
  expect(await saved()).not.toContain('cover.salon');expect(await saved()).toContain('sensor.salon_temperature');
});

test('rooms link to Home Assistant by name and follow their area, where equipment is moved, added and hidden',async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  await mountEditor(page);
  await page.evaluate(()=>{
    type Device={entityKey:string;entityId:string;name:string;areaId?:string;planKind:string;hidden:boolean;disabled:boolean};
    const device=(entityId:string,name:string,planKind:string,areaId?:string):Device=>({entityKey:`key-${entityId}`,entityId,name,planKind,hidden:false,disabled:false,...(areaId?{areaId}:{})});
    const editor=document.querySelector('mp-spatial-editor') as HTMLElement&{areas:unknown[];devices:Device[]};
    editor.areas=[{area_id:'salon',name:'Salon'},{area_id:'cuisine',name:'Cuisine'},{area_id:'sdb',name:'Salle d’eau'},{area_id:'leo',name:'Chambre Léo'},{area_id:'parents',name:'Chambre parents'},{area_id:'couloir',name:'Couloir'}];
    editor.devices=[device('light.circuit_0','Salon · Suspension','light','salon'),device('light.circuit_1','Circuit 1','light','salon'),device('sensor.salon_temperature','Salon · Température','temperature','salon'),device('cover.salon','Salon · Volet baie','cover','salon'),device('light.circuit_2','Circuit 2','light','cuisine'),device('sensor.bureau_temperature','Bureau · Température','temperature')];
    // Stand-in for the Studio: the override changes the entity's room, then the list is discovered again.
    const overrides:unknown[]=[];
    editor.addEventListener('override-change',event=>{const {entityKey,patch}=(event as CustomEvent<{entityKey:string;patch:{areaId?:string;hidden?:boolean}}>).detail;overrides.push({entityKey,patch});editor.devices=editor.devices.map(d=>d.entityKey===entityKey?{...d,...patch}:d);});
    Object.assign((window as unknown as {spatialTest:object}).spatialTest,{overrides});
  });
  const editor=page.locator('mp-spatial-editor');
  const last=()=>page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!.floors[0]!.rooms);
  await expect(editor.getByText('Pièces Home Assistant · 0 / 7 reliées')).toBeVisible();
  await expect(editor).toContainText('Proposition : 4 pièces à relier par leur nom.');
  await editor.getByRole('button',{name:'Associer automatiquement'}).click();
  await expect(page.getByRole('status')).toContainText('4 pièces reliées par leur nom. À relier à la main : Séjour, Chambre, Bureau.');
  expect(Object.fromEntries((await last()).map(r=>[r.name,r.areaId??null]))).toEqual({'Salon':'salon','Séjour':null,'Cuisine':'cuisine','Chambre':null,'Entrée':'couloir','Bureau':null,'Salle de bain':'sdb'});
  expect((await last()).some(r=>r.entityIds)).toBe(false);
  await expect(editor.getByRole('button',{name:'Associer automatiquement'})).toHaveCount(0);

  // The Salon shows its area's equipment without any box to tick.
  await expect(editor.getByText('Équipements automatiques · 4')).toBeVisible();
  const list=editor.getByRole('list',{name:'Équipements de la pièce'});
  await expect(list.getByRole('listitem')).toHaveText([/Circuit 1/,/Suspension/,/Volet baie/,/Température/]);
  await list.getByRole('combobox',{name:'Pièce de Circuit 1'}).selectOption('cuisine');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  // Equipment without a room is offered first; adding it places it in this room's area.
  await editor.getByRole('button',{name:'Ajouter Bureau · Température'}).click();
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await list.getByRole('combobox',{name:'Pièce de Salon · Volet baie'}).selectOption('hide');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{overrides:unknown[]}}).spatialTest.overrides)).toEqual([
    {entityKey:'key-light.circuit_1',patch:{areaId:'cuisine'}},{entityKey:'key-sensor.bureau_temperature',patch:{areaId:'salon',hidden:false}},{entityKey:'key-cover.salon',patch:{hidden:true}},
  ]);
  await editor.locator('.box:has(.equipment)').screenshot({path:'artifacts/spatial-room-equipment.png'});

  // Touching the kitchen on the plan opens it in the editor; the plan shows the light moved there.
  const viewer=editor.locator('mp-spatial-viewer');
  await viewer.locator('nav.strip').getByRole('button',{name:/Cuisine/}).click();
  await expect(editor.getByRole('textbox',{name:'Nom de la pièce',exact:true})).toHaveValue('Cuisine');
  await expect(list.getByRole('listitem')).toHaveText([/Circuit 1/,/Circuit 2/]);
  await expect(viewer.getByRole('region',{name:'Cuisine'})).toContainText('Circuit 1');

  // A list of its own, then back to following the area.
  await editor.getByRole('button',{name:'Choisir à la main'}).click();
  expect((await last()).find(r=>r.name==='Cuisine')!.entityIds).toEqual(['light.circuit_1','light.circuit_2']);
  await expect(editor.getByText('Équipements choisis à la main · 2 / 12')).toBeVisible();
  await editor.getByRole('button',{name:'Suivre la pièce Home Assistant'}).click();
  expect((await last()).find(r=>r.name==='Cuisine')!.entityIds).toBeUndefined();

  // An unlinked room offers its likely area in one click.
  await editor.getByRole('combobox',{name:'Pièce à modifier'}).selectOption({label:'Séjour'});
  await expect(editor.getByRole('button',{name:/^Relier à/})).toHaveCount(0);
  await editor.getByRole('combobox',{name:'Pièce Home Assistant'}).selectOption('salon');
  expect((await last()).find(r=>r.name==='Séjour')).toMatchObject({areaId:'salon'});
});

test('associating automatically lets a hand-made list follow its area only when nothing would disappear from it',async({page})=>{
  await mountEditor(page);
  await page.evaluate(async()=>{
    const module='/shared/spatial.ts';const {examplePlan}=await import(module);
    const device=(entityId:string,name:string,planKind:string,areaId?:string)=>({entityKey:`key-${entityId}`,entityId,name,planKind,hidden:false,disabled:false,...(areaId?{areaId}:{})});
    const editor=document.querySelector('mp-spatial-editor') as HTMLElement&{areas:unknown[];devices:unknown[];plan:unknown};
    editor.areas=[{area_id:'salon',name:'Salon'},{area_id:'cuisine',name:'Cuisine'}];
    editor.devices=[device('light.circuit_0','Salon · Suspension','light','salon'),device('light.circuit_1','Circuit 1','light','salon'),device('light.circuit_2','Circuit 2','light','cuisine'),device('sensor.bureau_temperature','Bureau · Température','temperature')];
    // Saved before 0.7.0: the Salon list is part of its area, the kitchen one holds a sensor from elsewhere.
    const plan=examplePlan();Object.assign(plan.floors[0].rooms[0],{areaId:'salon',entityIds:['light.circuit_0']});Object.assign(plan.floors[0].rooms[2],{areaId:'cuisine',entityIds:['sensor.bureau_temperature']});
    editor.plan=plan;
  });
  const editor=page.locator('mp-spatial-editor');
  await expect(editor).toContainText('Proposition : 1 liste à passer en automatique.');
  await editor.getByRole('button',{name:'Associer automatiquement'}).click();
  await expect(page.getByRole('status')).toContainText('1 pièce passée en automatique · 1 pièce garde sa liste à la main (équipements d’autres pièces). À relier à la main : Séjour, Chambre, Entrée, Bureau, Salle de bain.');
  const rooms=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!.floors[0]!.rooms);
  expect(rooms[0]).toMatchObject({areaId:'salon'});expect(rooms[0]!.entityIds).toBeUndefined();
  expect(rooms[2]).toMatchObject({areaId:'cuisine',entityIds:['sensor.bureau_temperature']});
  await expect(editor.getByText('Équipements automatiques · 2')).toBeVisible();
});

test.describe('precision touch',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('pinch zoom does not change the room geometry',async({page})=>{
    await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
    const zones=page.locator('mp-plan-zones');await expect(page.getByRole('dialog').getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
    await zones.locator('.viewport').scrollIntoViewIfNeeded();
    const before=await editedRooms(page),v=(await zones.locator('.viewport').boundingBox())!,x=v.x+v.width/2,y=v.y+v.height/2;
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});
    for(let distance=30;distance<=60;distance+=5)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-distance,y,id:1},{x:x+distance,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(zones.getByLabel('Zoom du plan',{exact:true})).toHaveText('240 %');expect(await editedRooms(page)).toEqual(before);
    await zones.screenshot({path:'artifacts/spatial-precision-phone.png'});
  });
});
