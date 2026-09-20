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
    // Plans kept under their levels, as Home Assistant keeps them.
    const backdrops=new Map<string,Blob>();
    const editor=document.createElement('mp-spatial-editor') as HTMLElement&{hass:import('../../frontend/ha/client').Hass;plan?:typeof plan;fallback?:typeof plan;areas:unknown[]};
    if(options.saved!==false)editor.plan=plan;
    if(options.fallback){const fallback=examplePlan();fallback.floors[0].name='RDC';fallback.floors[0].rooms[0].areaId='salon';editor.fallback=fallback;}
    editor.areas=[{area_id:'salon',name:'Salon'}];
    editor.hass={...demo.hass,user:{id:'test',is_admin:isAdmin},fetchWithAuth:async(url,init)=>{
      if(url.startsWith('/api/mp_glass/spatial/backdrop')){
        if(init?.method==='POST'){const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');backdrops.set(id,init.body as Blob);return new Response(JSON.stringify({id}),{status:201});}
        const kept=backdrops.get(url.split('/').pop()!);
        return kept?new Response(kept,{status:200,headers:{'Content-Type':kept.type}}):new Response(JSON.stringify({error:'not_found'}),{status:404});
      }
      const body=init?.body as Blob;const bitmap=await createImageBitmap(body).catch(()=>undefined);
      uploads.push({url,method:init?.method,type:(init?.headers as Record<string,string>)['Content-Type'],side:bitmap&&Math.max(bitmap.width,bitmap.height)});
      if(options.uploadStatus)return new Response('404: Not Found',{status:options.uploadStatus});
      return new Response(JSON.stringify({id:'job-test',status:'running',...(options.model?{model:options.model}:{})}),{status:202});
    },callWS:async<T>(message:Record<string,unknown>)=>{
      messages.push(message);
      if(message.type==='mp_glass/spatial/cancel'&&message.job_id==='job-test')return {cancelled:true} as T;
      if(message.type==='mp_glass/spatial/info')return (options.info??{backend:'gemini',configured:true,model:'gemini-3.8-flash',quality:'precise'}) as T;
      if(message.type==='mp_glass/spatial/normalize'){
        // Stand-in for Home Assistant's geometry (tested in Python): each room is its box, 100 px per metre, bends kept as they are.
        const rooms=message.rooms as {name:string;box_2d:number[];polygon?:number[][];arcs?:number[]}[],width=message.width as number,height=message.height as number;
        const floor={id:'imported',name:'Niveau importé',elevation:0,height:2.6,rooms:rooms.map((room,i)=>{
          const [y0,x0,y1,x1]=room.box_2d.map((v,k)=>v*(k%2?width:height)/100000) as [number,number,number,number];
          return {id:`room-${i+1}`,name:room.name,polygon:room.polygon?room.polygon.map(([y,x])=>[x!*width/100000,y!*height/100000]):[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
            ...(room.arcs?.some(b=>Math.abs(b)>.001)?{arcs:room.arcs}:{})};
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
    // Like the Studio: what the editor gives back becomes the saved plan it is shown next, removal included.
    editor.addEventListener('spatial-change',e=>{const detail=(e as CustomEvent).detail;changed.push(detail);editor.plan=detail as typeof plan|undefined;});
    document.body.replaceChildren(editor);Object.assign(window,{spatialTest:{changed,uploads,messages,backdrops}});
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
const editedRooms=async(page:Page)=>(await page.evaluate(()=>(window as unknown as {spatialTest:{messages:{type:string;rooms?:{name:string;box_2d:number[];polygon?:number[][];arcs?:number[]}[]}[]}}).spatialTest.messages.filter(m=>m.type==='mp_glass/spatial/normalize'))).at(-1)!.rooms!;
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
  await expect(card.locator('.section-title',{hasText:'Lumières'})).toBeVisible();
  await expect(card.locator('.section-title',{hasText:'Climat'})).toBeVisible();
  await expect(card.locator('.section-title',{hasText:'Audio-vidéo'})).toBeVisible();
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
  // Its window, with its contact sensor and its shutter.
  await expect(bedroom.getByRole('list',{name:'Portes et fenêtres'}).getByText('Fermée',{exact:true})).toBeVisible();
  await expect(bedroom.getByText('19,5°',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/spatial-room-mobile.png',fullPage:true});
});

test('ambiance room groups can be collapsed and expanded',async({page})=>{
  await page.goto('/?spatial');
  const view=page.locator('mp-glass-view-v4'),group=view.locator('.room-group').filter({hasText:'Cuisine'}).last();
  const toggle=group.locator('.room-group-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toBeFocused();
  await expect(group.locator('.grid')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(group.locator('.grid')).toBeVisible();
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

test('a house of several floors opens on all of them with their state, and each floor opens on its own view',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?spatial&floors');
  const viewer=page.locator('mp-spatial-viewer'),floors=viewer.getByRole('group',{name:'Niveau affiché'});
  const label=(id:string)=>viewer.locator(`[data-floor="${id}"]`);
  await expect(floors.getByRole('button',{name:'Tous les niveaux'})).toHaveAttribute('aria-pressed','true');
  await expect(label('upstairs')).toBeVisible();await expect(label('ground')).toBeVisible();await expect(label('basement')).toBeVisible();
  await expect(label('upstairs')).toHaveText(/Étage\s*2 lumières allumées/);
  await expect(label('ground')).toHaveText(/Rez-de-chaussée\s*Tout est éteint/);
  await expect(label('basement')).toHaveText(/Sous-sol\s*1 lumière allumée/);
  // Labels stand beside their floors, one above the other, in the order of the floors.
  const [up,ground,down]=await Promise.all(['upstairs','ground','basement'].map(id=>label(id).boundingBox()));
  expect(up!.y+up!.height).toBeLessThan(ground!.y);expect(ground!.y+ground!.height).toBeLessThan(down!.y);
  await expect(viewer.locator('[data-room]')).toHaveCount(0);
  await expect(viewer.getByRole('button',{name:'Vue de dessus'})).toHaveCount(0);
  const house=viewer.getByRole('region',{name:'Vue d’ensemble de la maison'});
  await expect(house.locator('.stat',{hasText:'Niveaux'})).toContainText('3');
  await expect(house.locator('.stat',{hasText:'Lumières'})).toContainText('3 / 8');
  // From the top floor down, each with its rooms, lights and temperatures.
  await expect(house.getByRole('listitem')).toHaveText([/Étage.*5 pièces · 2 lumières allumées.*19,2–22,6 °C/s,/Rez-de-chaussée.*7 pièces · lumières éteintes.*19,5–21,5 °C/s,/Sous-sol.*3 pièces · 1 lumière allumée/s]);
  await viewer.getByRole('button',{name:'Climat',exact:true}).click();
  await expect(label('upstairs')).toHaveText(/Étage\s*19,2–22,6 °C/);
  await expect(label('basement')).toHaveText('Sous-sol');
  await viewer.locator('.layout').screenshot({path:'artifacts/spatial-house.png'});
  // The shutters of the ground floor letting daylight in, and what plays there; the other floors have neither.
  await viewer.getByRole('button',{name:'Ouvrants',exact:true}).click();
  await expect(label('ground')).toHaveText(/Rez-de-chaussée\s*3 \/ 4/);await expect(label('upstairs')).toHaveText('Étage');
  await viewer.getByRole('button',{name:'Audio-vidéo',exact:true}).click();
  await expect(label('ground')).toHaveText(/Rez-de-chaussée\s*1 en lecture/);await expect(label('basement')).toHaveText('Sous-sol');
  await viewer.getByRole('button',{name:'Lumières',exact:true}).click();
  // A floor label opens that floor, as its tab would.
  await label('upstairs').click();
  await expect(floors.getByRole('button',{name:'Étage',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(viewer.locator('[data-room="room-1"]')).toBeVisible();
  await expect(viewer.locator('[data-floor]')).toHaveCount(0);
  await expect(viewer.getByRole('region',{name:'Vue d’ensemble du niveau'}).getByRole('heading',{name:'Étage'})).toBeVisible();
  await expect(viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button')).toHaveCount(5);
  await floors.getByRole('button',{name:'Tous les niveaux'}).click();
  await expect(label('ground')).toBeVisible();
  // Touching a floor on the plan opens it too: the middle of the stack is the ground floor.
  const canvas=(await viewer.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
  await expect(floors.getByRole('button',{name:'Rez-de-chaussée',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(viewer.locator('[data-room="living"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the whole house turns off the lights still on, on every floor, in one call',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/?spatial&floors');
  const viewer=page.locator('mp-spatial-viewer'),house=viewer.getByRole('region',{name:'Vue d’ensemble de la maison'});
  await house.getByRole('button',{name:'Éteindre toute la maison'}).click();
  expect((await demoCalls(page)).at(-1)).toEqual({domain:'light',service:'turn_off',data:{entity_id:['light.buanderie','light.suite','light.palier']}});
  await expect(house.getByRole('button',{name:'Tout est éteint'})).toBeDisabled();
  await expect(viewer.locator('[data-floor="upstairs"]')).toHaveText(/Étage\s*Tout est éteint/);
});

test('on a phone the floors of the house leave room for their labels',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial&floors');
  const viewer=page.locator('mp-spatial-viewer'),labels=viewer.locator('[data-floor]');
  await expect(labels.first()).toBeVisible();
  const boxes=await Promise.all([0,1,2].map(async i=>{await expect(labels.nth(i)).toBeVisible();return (await labels.nth(i).boundingBox())!;}));
  const [stage,tabs]=await Promise.all([viewer.locator('.stage').boundingBox(),viewer.locator('.floors').boundingBox()]);
  for(const [i,a] of boxes.entries()){
    expect(a.x).toBeGreaterThanOrEqual(stage!.x);expect(a.x+a.width).toBeLessThanOrEqual(stage!.x+stage!.width);
    expect(a.y).toBeGreaterThanOrEqual(tabs!.y+tabs!.height);
    for(const b of boxes.slice(i+1))expect(a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/spatial-house-mobile.png',fullPage:true});
});

test('on an iPhone a house of five floors keeps every label, its header and its floor list inside their cards',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial&floors');
  // As reported: five floors with long names, an iPhone held upright.
  await page.evaluate(()=>{
    type Floor={id:string;name:string;elevation:number};
    const view=document.querySelector('mp-glass-view-v4') as HTMLElement&{spatial:{floors:Floor[]};projectName:string;requestUpdate:()=>void};
    const plan=structuredClone(view.spatial),floor=(id:string)=>plan.floors.find(f=>f.id===id)!;
    const [basement,ground,upstairs]=[floor('basement'),floor('ground'),floor('upstairs')];
    basement.name='SJ2 - Basement';ground.name='SJ2 - Ground Floor';upstairs.name='SJ2 - First Floor';
    plan.floors=[basement,{...structuredClone(ground),id:'exterior',name:'SJ2 - Exterior'},ground,{...structuredClone(upstairs),id:'sj5',name:'SJ5 - Ground Floor'},upstairs];
    view.spatial=plan;view.projectName='Saint Jaume';view.requestUpdate();
  });
  const viewer=page.locator('mp-spatial-viewer'),labels=viewer.locator('[data-floor]');
  await expect(labels).toHaveCount(5);
  const boxes=await Promise.all(['upstairs','sj5','ground','exterior','basement'].map(async id=>{const label=viewer.locator(`[data-floor="${id}"]`);await expect(label).toBeVisible();return (await label.boundingBox())!;}));
  const [stage,tabs,modes]=await Promise.all([viewer.locator('.stage').boundingBox(),viewer.locator('.floors').boundingBox(),viewer.locator('.modes').boundingBox()]);
  for(const [i,a] of boxes.entries()){
    expect(a.x).toBeGreaterThanOrEqual(stage!.x);expect(a.x+a.width).toBeLessThanOrEqual(stage!.x+stage!.width);
    expect(a.y).toBeGreaterThanOrEqual(tabs!.y+tabs!.height);expect(a.y+a.height).toBeLessThanOrEqual(modes!.y);
    // From the top floor down, one under the other.
    if(i)expect(a.y).toBeGreaterThanOrEqual(boxes[i-1]!.y+boxes[i-1]!.height);
  }
  // The rows of the floors stay inside the card of the whole house.
  const card=(await viewer.getByRole('region',{name:'Vue d’ensemble de la maison'}).boundingBox())!;
  for(const row of await viewer.locator('.level').all()){const box=(await row.boundingBox())!;expect(box.x+box.width).toBeLessThanOrEqual(card.x+card.width);}
  // The flag stands on the row of the name, the navigation inside the header, its names whole or, too long, replaced by their icons.
  const header=page.locator('mp-glass-view-v4 header.glass');
  const [head,nav,flag]=await Promise.all([header.boundingBox(),header.locator('nav').boundingBox(),page.getByRole('button',{name:'Langue : Français'}).boundingBox()]);
  expect(nav!.x+nav!.width).toBeLessThanOrEqual(head!.x+head!.width);
  expect(flag!.y+flag!.height).toBeLessThanOrEqual(nav!.y);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    await expect.poll(()=>page.evaluate(()=>{
      const nav=document.querySelector('mp-glass-view-v4')!.shadowRoot!.querySelector('nav')!,shown=Array.from(nav.querySelectorAll('a span:last-child')).filter(name=>getComputedStyle(name).display!=='none');
      return nav.getBoundingClientRect().right<=nav.closest('header')!.getBoundingClientRect().right&&shown.every(name=>name.scrollWidth<=name.clientWidth+1);
    })).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('in the Studio, a floor opened on the plan becomes the floor edited',async({page})=>{
  await mountEditor(page);
  await page.getByRole('button',{name:'Ajouter un niveau',exact:true}).click();
  const level=page.getByRole('combobox',{name:'Niveau à modifier'});
  await expect(page.getByRole('textbox',{name:'Nom du niveau',exact:true})).toHaveValue('Niveau 1');
  const viewer=page.locator('mp-spatial-viewer');
  await viewer.locator('[data-floor="ground"]').click();
  await expect(page.getByRole('textbox',{name:'Nom du niveau',exact:true})).toHaveValue('Rez-de-chaussée');
  await expect(level).toHaveValue('ground');
  await expect(viewer.locator('[data-room="living"]')).toBeVisible();
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
  await expect(page.getByText(/une clé API dans MP Nexus suffit/)).toBeVisible();
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
  await expect(dialog.getByRole('status')).toContainText('Gemini 3.8 Flash est momentanément surchargé ; MP Nexus a déjà réessayé deux fois. Réessayez dans quelques minutes, ou tout de suite avec Gemini 3.5 Flash-Lite.');
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

test('the saved plan is removed only once confirmed, and the schematic plan takes over',async({page})=>{
  await mountEditor(page,true,false,{fallback:true});
  const remove=page.getByRole('button',{name:'Supprimer le plan'});
  // Cancelling leaves the saved plan exactly as it was.
  await remove.click();
  await page.getByRole('button',{name:'Annuler'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed)).toHaveLength(0);
  await remove.click();
  const ask=page.getByRole('dialog',{name:'Supprimer le plan enregistré ?'});
  await expect(ask).toBeVisible();
  await page.screenshot({path:'artifacts/spatial-remove-plan.png'});
  await ask.getByRole('button',{name:'Supprimer'}).click();
  // The Studio is handed no plan at all (an `undefined` detail reaches the test as null), and the schematic plan of the Home Assistant areas is what is shown next.
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed.map(p=>p??'aucun'))).toEqual(['aucun']);
  await expect(page.getByText('Plan par défaut')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Cliquez sur Enregistrer dans le Studio');
  await expect(page.getByRole('combobox',{name:'Niveau à modifier'})).toHaveValue('ground');
  await expect(remove).toHaveCount(0);
});

test('a level is removed, never the last one',async({page})=>{
  await mountEditor(page);
  const removeFloor=page.getByRole('button',{name:'Supprimer ce niveau'});
  await expect(removeFloor).toBeDisabled();
  await page.getByRole('button',{name:'Ajouter un niveau',exact:true}).click();
  await page.getByRole('textbox',{name:'Nom du niveau',exact:true}).fill('Étage');await page.getByRole('textbox',{name:'Nom du niveau',exact:true}).blur();
  await removeFloor.click();
  const ask=page.getByRole('dialog',{name:'Supprimer le niveau « Étage » ?'});
  await expect(ask).toBeVisible();
  await ask.getByRole('button',{name:'Supprimer'}).click();
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  expect(saved.floors.map(f=>f.name)).toEqual(['Rez-de-chaussée']);
  await expect(page.getByRole('status')).toContainText('Niveau « Étage » supprimé');
  await expect(removeFloor).toBeDisabled();
});

test('the result window closed on a kept draft reopens from the card',async({page})=>{
  await mountEditor(page,true,false,{source:true});
  await choosePlanImage(page);
  await consentAndGenerate(page);
  await expect(page.getByRole('dialog',{name:'7 pièces reconnues'})).toBeVisible();
  // Escape keeps the draft; the card then offers to correct it rather than a new analysis.
  await page.keyboard.press('Escape');
  const card=page.locator('mp-spatial-editor .box').filter({hasText:'Brouillon IA · non enregistré'});
  await card.screenshot({path:'artifacts/spatial-draft-card.png'});
  await card.getByRole('button',{name:'Modifier le brouillon'}).click();
  const dialog=page.getByRole('dialog',{name:'7 pièces reconnues'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab',{name:'Sur le plan d’origine'})).toHaveAttribute('aria-selected','true');
  await expect(dialog.locator('mp-plan-zones figure polygon')).toHaveCount(7);
  // The same draft as the one received: nothing was sent to Google a second time.
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{uploads:unknown[]}}).spatialTest.uploads)).toHaveLength(1);
});

test('a saved level is edited on its plan: sides drawn to their neighbours, rooms moved with their windows and drawn, then applied',async({page})=>{
  await page.setViewportSize({width:1400,height:950});
  await mountEditor(page);
  // The living room linked to its area with a French window, a bedroom 1 m short of the hall, a window in the bathroom.
  await page.evaluate(()=>{
    const editor=document.querySelector('mp-spatial-editor') as HTMLElement&{plan:import('../../shared/spatial').SpatialPlan};
    const plan=structuredClone(editor.plan),[living,,,bedroom,,,bath]=plan.floors[0]!.rooms;
    living!.areaId='salon';living!.openings=[{id:'baie',kind:'french_window',name:'Baie',side:0,at:.5,width:2.4,entityIds:['cover.salon']}];
    bedroom!.polygon=[[0,4],[3,4],[3,8],[0,8]];
    bath!.openings=[{id:'fenetre',kind:'window',side:1,at:.5,width:1,entityIds:['cover.sdb']}];
    editor.plan=plan;
  });
  const before=await page.evaluate(()=>(document.querySelector('mp-spatial-editor') as HTMLElement&{plan:import('../../shared/spatial').SpatialPlan}).plan);
  await page.getByRole('button',{name:'Modifier le plan',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Modifier « Rez-de-chaussée »'}),zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  await expect(dialog).toBeVisible();
  // The level over a grid of metres, its French window and its bathroom window as marks; nothing to apply yet.
  await expect(figure.locator('polygon[data-zone]')).toHaveCount(7);
  await expect(figure.locator('img')).toHaveCount(0);
  await expect(figure.locator('svg.grid line').first()).toBeAttached();
  await expect(figure.locator('.mark')).toHaveCount(2);
  await expect(dialog.getByRole('button',{name:'Appliquer au niveau'})).toBeDisabled();
  // 13 x 8 m with 2.6 m around it: a point of the plan on the screen.
  const at=async(x:number,y:number)=>{const f=(await figure.boundingBox())!;return {x:f.x+f.width*(x+2.6)/18.2,y:f.y+f.height*(y+2.6)/13.2};};
  const drag=async(from:{x:number;y:number},to:{x:number;y:number})=>{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:4});await page.mouse.move(to.x,to.y,{steps:4});await page.mouse.up();};

  // The bedroom's east side pulled to 10 cm of the hall: it lands on the hall's wall.
  const bedroom=await at(1.5,6);await page.mouse.click(bedroom.x,bedroom.y);
  const east=(await figure.locator('.handle[data-handle=e]').boundingBox())!;
  await drag({x:east.x+east.width/2,y:east.y+east.height/2},await at(3.9,6));
  // The bathroom moved 1 m down; its window follows.
  const mark=(await figure.locator('.mark').nth(1).boundingBox())!;
  await drag(await at(11.5,6),await at(11.5,7));
  const moved=(await figure.locator('.mark').nth(1).boundingBox())!;
  expect(moved.y-mark.y).toBeCloseTo((await figure.boundingBox())!.height/13.2,-1);
  await expect(dialog.getByText('Plan 3D · modifications non appliquées')).toBeVisible();
  // A storeroom drawn below the bedroom, then named.
  await zones.getByRole('button',{name:'Ajouter une pièce'}).click();
  await drag(await at(.3,8.6),await at(2.8,10.2));
  const name=zones.getByRole('textbox',{name:'Nom de la pièce 8'});
  await expect(name).toBeFocused();await name.fill('Cellier');await name.press('Enter');
  await page.screenshot({path:'artifacts/spatial-level-edit.png'});

  // Closed on the way, the changes wait in their card.
  await dialog.getByRole('button',{name:'Fermer'}).click();
  const card=page.locator('mp-spatial-editor .box').filter({hasText:'modifications non appliquées'});
  await expect(card).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:unknown[]}}).spatialTest.changed.length)).toBe(0);
  await card.getByRole('button',{name:'Reprendre'}).click();
  await expect(figure.locator('polygon[data-zone]')).toHaveCount(8);
  await dialog.getByRole('button',{name:'Appliquer au niveau'}).click();
  await expect(page.getByRole('status')).toContainText('Plan du niveau « Rez-de-chaussée » modifié');

  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  const [living,,,edited,,,bath,cellar]=saved.floors[0]!.rooms,original=before.floors[0]!.rooms;
  // Untouched rooms stay exactly as they were, links and openings included.
  expect(living).toEqual(original[0]);
  expect(saved.floors[0]!.rooms.slice(1,3)).toEqual(original.slice(1,3));
  expect(edited!.polygon).toEqual([[0,4],[4,4],[4,8],[0,8]]);
  expect(bath!.polygon.map(p=>p[1])).toEqual([expect.closeTo(5,1),expect.closeTo(5,1),expect.closeTo(9,1),expect.closeTo(9,1)]);
  expect(bath!.openings).toEqual(original[6]!.openings);
  expect(cellar).toMatchObject({name:'Cellier',id:expect.stringMatching(/^room-/)});
  expect(cellar!.areaId).toBeUndefined();
});

test('the shape of a room is edited on the plan from its own settings',async({page})=>{
  await mountEditor(page);
  await page.getByLabel('Pièce à modifier').selectOption({label:'Cuisine'});
  await page.getByRole('button',{name:'Modifier sa forme sur le plan'}).click();
  const zones=page.getByRole('dialog',{name:'Modifier « Rez-de-chaussée »'}).locator('mp-plan-zones');
  await expect(zones.locator('li.selected input')).toHaveValue('Cuisine');
  await expect(zones.locator('.handle[data-handle]')).toHaveCount(8);
  // Closed untouched, it leaves nothing behind.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('mp-spatial-editor .box').filter({hasText:'modifications non appliquées'})).toHaveCount(0);
});

test('the analysed plan stays under its level and comes back under the rooms when the level is edited',async({page})=>{
  await page.setViewportSize({width:1400,height:950});
  await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
  const draft=page.getByRole('dialog');
  await expect(draft.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
  await draft.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Kept in Home Assistant with where it lies: 100 px per metre, the house's corner on the image's.
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  const backdrop=saved.floors[0]!.backdrop!;
  expect(backdrop).toEqual({id:expect.stringMatching(/^[a-f0-9]{32}$/),width:1300,height:800,scale:[.01,.01],origin:[0,0]});
  expect(await page.evaluate(id=>(window as unknown as {spatialTest:{backdrops:Map<string,Blob>}}).spatialTest.backdrops.get(id)?.type,backdrop.id)).toBe('image/png');

  await page.getByRole('button',{name:'Modifier le plan',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/^Modifier « /}),figure=dialog.locator('mp-plan-zones figure'),image=figure.locator('img.backdrop');
  await expect(image).toHaveJSProperty('naturalWidth',1300);
  // Each room lies on the image where it was drawn: its first corner, at 100 px per metre from the image's corner.
  const [frame,drawn]=[(await figure.boundingBox())!,(await image.boundingBox())!];
  const [x,y]=saved.floors[0]!.rooms[0]!.polygon[0]!;
  const [px,py]=(await figure.locator('polygon[data-zone="0"]').getAttribute('points'))!.split(' ')[0]!.split(',').map(Number) as [number,number];
  expect(frame.x+px/1000*frame.width).toBeCloseTo(drawn.x+x*100/1300*drawn.width,0);
  expect(frame.y+py/1000*frame.height).toBeCloseTo(drawn.y+y*100/800*drawn.height,0);
  expect(drawn.width/drawn.height).toBeCloseTo(1300/800,2);
  await page.screenshot({path:'artifacts/spatial-level-backdrop.png'});
  // Hidden and shown again; left as it was, the window leaves nothing behind.
  const tools=dialog.getByRole('toolbar',{name:'Fond de plan'});
  await tools.getByRole('button',{name:'Afficher'}).click();
  await expect(image).toHaveCount(0);
  await tools.getByRole('button',{name:'Afficher'}).click();
  await expect(image).toBeVisible();
  await dialog.getByRole('button',{name:'Fermer'}).click();
  await expect(page.locator('mp-spatial-editor .box').filter({hasText:'modifications non appliquées'})).toHaveCount(0);
});

test('a plan chosen for a saved level is laid under its rooms by its walls, then moved by hand and kept',async({page})=>{
  await page.setViewportSize({width:1400,height:950});
  await mountEditor(page);
  await page.getByRole('button',{name:'Modifier le plan',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Modifier « Rez-de-chaussée »'}),figure=dialog.locator('mp-plan-zones figure'),tools=dialog.getByRole('toolbar',{name:'Fond de plan'});
  await expect(figure.locator('img')).toHaveCount(0);
  // The example plan drawn at 50 px per metre, its corner at (80, 70) on a 900 x 600 image, with a title block.
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;const context=canvas.getContext('2d')!;
    context.fillStyle='#fff';context.fillRect(0,0,900,600);context.lineWidth=6;
    const at=(x:number,y:number):[number,number]=>[80+x*50,70+y*50];
    context.strokeRect(...at(0,0),650,400);
    for(const [x0,y0,x1,y1] of [[5,0,5,4],[9,0,9,4],[0,4,13,4],[4,4,4,8],[7,4,7,8],[10,4,10,8]]){context.beginPath();context.moveTo(...at(x0!,y0!));context.lineTo(...at(x1!,y1!));context.stroke();}
    context.lineWidth=2;context.strokeRect(760,520,120,60);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
    const input=document.querySelector('mp-spatial-editor')!.shadowRoot!.querySelector<HTMLInputElement>('dialog.level .backdrop-tools input[type=file]')!;
    const transfer=new DataTransfer();transfer.items.add(new File([blob],'plan.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change'));
  });
  await expect(dialog.getByRole('listitem').filter({hasText:/^Plan calé sur les murs des pièces/})).toBeVisible();
  const image=figure.locator('img.backdrop');
  await expect(image).toHaveJSProperty('naturalWidth',900);
  await expect(dialog.getByText('Plan 3D · modifications non appliquées')).toBeVisible();
  await dialog.getByRole('button',{name:'Appliquer au niveau'}).click();
  await expect(page.locator('[role="status"]').filter({hasText:'Plan du niveau « Rez-de-chaussée » modifié'})).toBeVisible();
  const kept=async()=>(await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!)).floors[0]!.backdrop!;
  const fitted=await kept();
  expect(fitted).toMatchObject({id:expect.stringMatching(/^[a-f0-9]{32}$/),width:900,height:600});
  expect(1/fitted.scale[0]!).toBeCloseTo(50,0);expect(fitted.origin[0]).toBeCloseTo(80,-.5);expect(fitted.origin[1]).toBeCloseTo(70,-.5);

  // Opened again, it comes back; « Caler le fond » moves it with the pointer and « +5 % » enlarges it.
  await page.getByRole('button',{name:'Modifier le plan',exact:true}).click();
  await expect(image).toHaveJSProperty('naturalWidth',900);
  await tools.getByRole('button',{name:'Caler le fond'}).click();
  await expect(dialog.getByRole('button',{name:'Ajouter une pièce'})).toHaveCount(0);
  const before=(await image.boundingBox())!,box=(await figure.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:3});await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2,{steps:3});await page.mouse.up();
  expect((await image.boundingBox())!.x-before.x).toBeCloseTo(40,-.5);
  await tools.getByRole('button',{name:'Taille du fond +5 %'}).click();
  expect((await image.boundingBox())!.width/before.width).toBeCloseTo(1.05,2);
  await page.keyboard.press('Escape');
  await expect(tools.getByRole('button',{name:'Caler le fond'})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('dialog')).toBeVisible();
  await dialog.getByRole('button',{name:'Appliquer au niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const moved=await kept();
  // The same image, not sent again: only where it lies changed.
  expect(moved.id).toBe(fitted.id);
  expect(await page.evaluate(()=>(window as unknown as {spatialTest:{backdrops:Map<string,Blob>}}).spatialTest.backdrops.size)).toBe(1);
  expect(moved.scale[0]!/fitted.scale[0]!).toBeCloseTo(1.05,6);
  // Its middle, around which it grew, moved 40 screen pixels to the right: 18 m of plan were drawn over `before.width`.
  const middle=(b:{width:number;scale:number[];origin:number[]})=>(b.width/2-b.origin[0]!)*b.scale[0]!;
  expect(middle(moved)-middle(fitted)).toBeCloseTo(40*18/before.width,1);

  // Removed, it goes from the level.
  await page.getByRole('button',{name:'Modifier le plan',exact:true}).click();
  await tools.getByRole('button',{name:'Retirer le fond'}).click();
  await expect(image).toHaveCount(0);
  await dialog.getByRole('button',{name:'Appliquer au niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!)).floors[0]!.backdrop).toBeUndefined();
});

test('without the analysed image the card reopens the draft in 3D',async({page})=>{
  await mountEditor(page);
  await page.getByLabel('Plan à importer').setInputFiles({name:'plan.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
  await consentAndGenerate(page);
  await expect(page.getByRole('dialog',{name:'7 pièces reconnues'})).toBeVisible();
  await page.keyboard.press('Escape');
  const card=page.locator('mp-spatial-editor .box').filter({hasText:'Brouillon IA · non enregistré'});
  await card.getByRole('button',{name:'Revoir le brouillon'}).click();
  const dialog=page.getByRole('dialog',{name:'7 pièces reconnues'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.locator('mp-spatial-viewer canvas')).toBeVisible();
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
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  /** Screen position of a point of the plan, in 0-1000; the plan is brought into view first, so every corner is reachable. */
  const screen=async(x:number,y:number)=>{await figure.scrollIntoViewIfNeeded();const f=(await figure.boundingBox())!;return {x:f.x+f.width*x/1000,y:f.y+f.height*y/1000};};
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

test('a room turns, its sides slide parallel and its walls curve',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
  const dialog=page.getByRole('dialog'),zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  await expect(dialog.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
  const idle=()=>expect(figure).not.toHaveClass(/busy/);
  const room=async()=>(await editedRooms(page))[0]!;
  /** Corners in the plan's pixels (1300 x 800 over 0-1000), where a right angle is a right angle. */
  const pixels=async()=>(await room()).polygon!.map(([y,x])=>[x!*1.3,y!*.8] as [number,number]);
  const screen=async(x:number,y:number)=>{await figure.scrollIntoViewIfNeeded();const f=(await figure.boundingBox())!;return {x:f.x+f.width*x/1000,y:f.y+f.height*y/1000};};
  const click=async(x:number,y:number)=>{await idle();const s=await screen(x,y);await page.mouse.click(s.x,s.y);};
  const drag=async(from:{x:number;y:number},dx:number,dy:number)=>{
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(from.x+dx/2,from.y+dy/2,{steps:4});await page.mouse.move(from.x+dx,from.y+dy,{steps:4});await page.mouse.up();
  };
  const pull=async(selector:string,dx:number,dy:number)=>{
    await idle();
    const b=(await figure.locator(selector).boundingBox())!;
    await drag({x:b.x+b.width/2,y:b.y+b.height/2},dx,dy);
  };
  const square=async()=>{
    const corners=await pixels();
    const sides=corners.map((a,i)=>{const b=corners[(i+1)%corners.length]!;return [b[0]-a[0],b[1]-a[1]] as [number,number];});
    for(const [i,u] of sides.entries()){
      const v=sides[(i+1)%sides.length]!;
      expect(Math.abs(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v))).toBeLessThan(.02);
    }
    return {sides,tilt:Math.atan2(sides[0]![1],sides[0]![0])*180/Math.PI};
  };

  // Turning the living room makes it an outline at an angle, its corners still square.
  await click(150,250);
  await expect(figure.locator('.rotate')).toHaveCount(1);
  await pull('.rotate',0,-70);
  await expect.poll(async()=>(await room()).polygon?.length).toBe(4);
  const turned=await square();
  expect(Math.abs(turned.tilt)).toBeGreaterThan(3);
  await page.screenshot({path:'artifacts/spatial-zones-turned.png'});

  // Its second side, dragged, stays parallel: the room keeps its angle and its corners square.
  // A third of the way along the side, clear of the + that sits in its middle.
  const alongSide=async(index:number,at=1/3)=>{const shape=(await room()).polygon!;const p=shape[index]!,q=shape[(index+1)%shape.length]!;
    return [p[1]!+(q[1]!-p[1]!)*at,p[0]!+(q[0]!-p[0]!)*at] as [number,number];};
  const [mx,my]=await alongSide(1);
  await click(mx,my);
  await expect(figure.locator('.side.active')).toHaveCount(1);
  await expect(figure.locator('.bend')).toHaveCount(1);
  await drag(await screen(...await alongSide(1)),26,0);  // away from the bend handle in its middle
  await expect.poll(async()=>(await room()).polygon![1]![1]).not.toBe(turned.sides[0]![0]);
  const slid=await square();
  expect(slid.tilt).toBeCloseTo(turned.tilt,1);
  expect(Math.hypot(...slid.sides[1]!)).toBeCloseTo(Math.hypot(...turned.sides[1]!),0);  // the side moved, not stretched

  // « Courber le côté » bows that wall out as a quarter circle, and the room gains the surface of the arc.
  const surface=async()=>Number((await zones.locator('li').first().locator('small').textContent())!.replace(/[^\d,]/g,'').replace(',','.'));
  const straight=await surface();
  await idle();await zones.getByRole('button',{name:'Courber le côté'}).click();
  await expect.poll(async()=>(await room()).arcs?.length).toBe(4);
  const bends=(await room()).arcs!;
  expect(Math.abs(bends[1]!)).toBeCloseTo(.4142,3);
  expect(bends.filter((b:number)=>Math.abs(b)>.001)).toHaveLength(1);
  await expect.poll(surface).toBeGreaterThan(straight);
  // The curve is drawn, not its chord: the room's outline gets many more points.
  await expect(figure.locator('polygon[data-zone="0"]')).toHaveAttribute('points',/(\S+ ){10}/);
  await page.screenshot({path:'artifacts/spatial-zones-curved.png'});

  // The bend follows the finger, and « Redresser le côté » puts the wall back straight; Annuler brings the curve back.
  const bend=async()=>(await room()).arcs?.[1]??0;
  await pull('.bend',-25,0);
  await expect.poll(async()=>Math.round(await bend()*100)).not.toBe(Math.round(bends[1]!*100));
  expect(Math.abs(await bend())).toBeGreaterThan(.05);
  await idle();await zones.getByRole('button',{name:'Redresser le côté'}).click();
  await expect.poll(bend).toBe(0);
  await expect.poll(async()=>(await room()).arcs).toBeUndefined();
  await idle();await zones.getByRole('button',{name:'Annuler'}).click();
  await expect.poll(async()=>Math.abs(await bend())).toBeGreaterThan(.05);

  // The curved, turned room is rebuilt in 3D without a hitch.
  await dialog.getByRole('tab',{name:'En 3D'}).click();
  await expect(dialog.locator('mp-spatial-viewer canvas')).toBeVisible();
  await dialog.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!);
  expect(saved.floors[0]!.rooms[0]!.arcs?.filter(b=>Math.abs(b)>.001)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('doors, windows, televisions and speakers are placed on the analysed plan, then come with its rooms and their equipment',async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  await mountEditor(page,true,false,{source:true});
  // The kitchen of Home Assistant has a blind and a speaker: once the draft is used, they go to what was placed in it.
  await page.evaluate(()=>{
    const device=(entityId:string,name:string,planKind:string)=>({entityKey:`key-${entityId}`,entityId,name,planKind,areaId:'cuisine',hidden:false,disabled:false});
    const editor=document.querySelector('mp-spatial-editor') as HTMLElement&{areas:unknown[];devices:unknown[]};
    editor.areas=[{area_id:'cuisine',name:'Cuisine'}];
    editor.devices=[device('cover.cuisine_store','Cuisine · Store','cover'),device('media_player.cuisine','Cuisine · Enceinte','media')];
  });
  await choosePlanImage(page);await consentAndGenerate(page);
  const dialog=page.getByRole('dialog'),zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  await expect(dialog.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
  // The plan is 13 x 8 m on the image.
  const frame=(await figure.boundingBox())!,at=(x:number,y:number)=>({x:frame.x+frame.width*x/13,y:frame.y+frame.height*y/8});
  const place=zones.getByRole('toolbar',{name:'Placer sur le plan'}),placed=zones.getByRole('list',{name:'Portes, fenêtres et appareils du brouillon'}).getByRole('listitem');
  // A window drawn along the top wall of the kitchen, from 10 m to 11.5 m; pressed far from any wall, nothing is placed.
  await place.getByRole('button',{name:'Fenêtre',exact:true}).click();
  await expect(zones.locator('.hint')).toContainText('Glissez le long d’un mur');
  let p=at(2.5,2);await page.mouse.click(p.x,p.y);
  await expect(zones.locator('.hint')).toContainText('Touchez un mur d’une pièce du brouillon');
  p=at(10,.05);await page.mouse.move(p.x,p.y);await page.mouse.down();
  for(const x of [10.5,11,11.5]){p=at(x,.05);await page.mouse.move(p.x,p.y,{steps:3});}
  await page.mouse.up();
  await expect(placed).toHaveCount(1);await expect(placed.first()).toContainText('Fenêtre · Cuisine');await expect(placed.first()).toContainText(/1,[45]\d m/);
  // A door only touched on the wall between the dining room and the kitchen: as wide as usual. The mode stays on for the next one.
  await place.getByRole('button',{name:'Porte',exact:true}).click();
  p=at(9.03,2);await page.mouse.click(p.x,p.y);
  await expect(placed.nth(1)).toContainText(/Porte · (Séjour|Cuisine)/);await expect(placed.nth(1)).toContainText('0,90 m');
  // A speaker in the kitchen, a television in the living room.
  await place.getByRole('button',{name:'Enceinte',exact:true}).click();
  p=at(11,2.5);await page.mouse.click(p.x,p.y);
  await place.getByRole('button',{name:'Téléviseur',exact:true}).click();
  p=at(2.5,2.5);await page.mouse.click(p.x,p.y);
  await expect(placed).toHaveCount(4);await expect(placed.nth(3)).toContainText('Téléviseur · Pièce importée');
  await page.keyboard.press('Escape');
  await expect(place.getByRole('button',{name:'Téléviseur',exact:true})).toHaveAttribute('aria-pressed','false');
  await dialog.screenshot({path:'artifacts/spatial-draft-fixtures.png'});
  // Undone, the television goes; the door's mark dragged onto the wall between the hall and the office goes there.
  await zones.getByRole('button',{name:'Annuler',exact:true}).click();
  await expect(placed).toHaveCount(3);
  const mark=(await zones.locator('.mark').nth(1).boundingBox())!;
  await page.mouse.move(mark.x+mark.width/2,mark.y+mark.height/2);await page.mouse.down();
  p=at(7.03,6);await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.up();
  await expect(placed.nth(1)).toContainText(/Porte · (Entrée|Bureau)/);
  // In 3D, then used for the level: each in its room; the kitchen's only window gets its only blind, its speaker its only player.
  await dialog.getByRole('tab',{name:'En 3D'}).click();
  await expect(dialog.locator('mp-spatial-viewer canvas')).toBeVisible();
  await dialog.screenshot({path:'artifacts/spatial-draft-fixtures-3d.png'});
  await dialog.getByRole('button',{name:'Utiliser pour ce niveau'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const rooms=await page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!.floors[0]!.rooms);
  const kitchen=rooms.find(r=>r.name==='Cuisine')!;
  expect(kitchen.areaId).toBe('cuisine');
  expect(kitchen.openings).toEqual([expect.objectContaining({kind:'window',side:0,entityIds:['cover.cuisine_store']})]);
  expect(kitchen.openings![0]!.width).toBeGreaterThan(1.35);expect(kitchen.openings![0]!.width).toBeLessThan(1.65);
  expect(kitchen.media).toEqual([expect.objectContaining({kind:'speaker',entityId:'media_player.cuisine'})]);
  expect(rooms.filter(r=>['Entrée','Bureau'].includes(r.name)).flatMap(r=>r.openings??[])).toEqual([expect.objectContaining({kind:'door',width:.9})]);
  expect(rooms.flatMap(r=>r.media??[])).toHaveLength(1);
  await expect(page.getByRole('status').filter({hasText:'Portes, fenêtres et appareils du brouillon : 3 repris, dont 2 reliés d’office'})).toBeVisible();
});

test('a rectangle curves a side and rounds a corner from the toolbar, in a window as wide as the screen',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await mountEditor(page,true,false,{source:true});await choosePlanImage(page);await consentAndGenerate(page);
  const dialog=page.getByRole('dialog'),zones=dialog.locator('mp-plan-zones'),figure=zones.locator('figure');
  await expect(dialog.getByRole('listitem').filter({hasText:/aux murs du plan/})).toBeVisible();
  // The window takes the width of the screen, and the plan most of its height.
  expect((await dialog.boundingBox())!.width).toBeGreaterThan(1380);
  expect((await figure.boundingBox())!.height).toBeGreaterThan(560);
  const idle=()=>expect(figure).not.toHaveClass(/busy/);
  const room=async()=>(await editedRooms(page))[0]!;
  const screen=async(x:number,y:number)=>{await figure.scrollIntoViewIfNeeded();const f=(await figure.boundingBox())!;return {x:f.x+f.width*x/1000,y:f.y+f.height*y/1000};};
  const surface=async()=>Number((await zones.locator('li').first().locator('small').textContent())!.replace(/[^\d,]/g,'').replace(',','.'));
  const curve=zones.getByRole('button',{name:'Courber le côté'}),round=zones.getByRole('button',{name:'Arrondir l’angle'});

  // Nothing selected: nothing to curve. The living room, a plain rectangle, can be curved at once.
  await expect(curve).toBeDisabled();
  await idle();const salon=await screen(150,250);await page.mouse.click(salon.x,salon.y);
  await expect(curve).toBeEnabled();await expect(round).toBeEnabled();

  // « Courber le côté » gives it its outline and waits for a side; Échap gives up without closing the window.
  await curve.click();
  await expect.poll(async()=>(await room()).polygon?.length).toBe(4);
  // Its size in metres (the image is drawn at 100 px per metre).
  const outline=(await room()).polygon!,xs=outline.map(([,x])=>x!*.013),ys=outline.map(([y])=>y!*.008);
  const width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys),straight=await surface();
  await expect(curve).toHaveAttribute('aria-pressed','true');
  await expect(figure).toHaveClass(/picking-curve/);
  await figure.focus();await page.keyboard.press('Escape');
  await expect(curve).toHaveAttribute('aria-pressed','false');
  await expect(dialog).toBeVisible();

  // Its east side, touched, bows out as a quarter circle: the room gains the segment of that circle beyond the side.
  await curve.click();
  const shape=(await room()).polygon!,[p,q]=[shape[1]!,shape[2]!];
  await idle();const side=await screen(p[1]!+(q[1]!-p[1]!)/3,p[0]!+(q[0]!-p[0]!)/3);await page.mouse.click(side.x,side.y);
  await expect.poll(async()=>(await room()).arcs?.filter(b=>Math.abs(b)>.001).length).toBe(1);
  expect(Math.abs((await room()).arcs![1]!)).toBeCloseTo(.4142,3);
  // Surfaces are shown to the tenth of a m².
  const near=(expected:number)=>expect.poll(async()=>Math.abs(await surface()-expected)).toBeLessThanOrEqual(.1);
  await near(straight+depth**2/2*(Math.PI/4-.5));
  await expect(zones.getByRole('button',{name:'Redresser le côté'})).toBeEnabled();

  // « Arrondir l’angle », then its south-west corner: an arc joins its two walls a third of the shorter one away.
  // The room loses the corner beyond the arc, (1 − π/4) d², not the triangle under its chord.
  const before=await surface();
  await idle();await round.click();
  await expect(figure).toHaveClass(/picking-round/);
  await idle();const corner=(await figure.locator('.vertex[data-vertex="3"]').boundingBox())!;
  await page.mouse.click(corner.x+corner.width/2,corner.y+corner.height/2);
  await expect.poll(async()=>(await room()).polygon?.length).toBe(5);
  const rounded=await room();
  expect(Math.abs(rounded.arcs![3]!)).toBeCloseTo(.4142,3);
  expect(rounded.arcs!.filter(b=>Math.abs(b)>.001)).toHaveLength(2);
  await near(before-(1-Math.PI/4)*(Math.min(width,depth)/3)**2);
  // The arc is the side now touched: its round handle sets the radius.
  await expect(figure.locator('.bend')).toHaveCount(1);
  await page.screenshot({path:'artifacts/spatial-zones-rounded.png'});
  expect(errors).toEqual([]);
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
  // Shutter positions are read in the openings ambiance.
  await expect(viewer.locator('[data-room="living"]')).not.toContainText('65 %');
  await viewer.getByRole('button',{name:'Ouvrants',exact:true}).click();
  await expect(viewer.locator('[data-room="living"]')).toContainText('65 %');
  await expect(viewer.locator('[data-room="living"]')).not.toContainText('21,5 °C');
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
  // The lights read nothing else: shutters and players have their own ambiances.
  await expect(label('living').locator('.readings')).toHaveCount(0);
  await viewer.getByRole('button',{name:'Climat',exact:true}).click();
  await expect(label('bedroom').locator('.reading.temp')).toHaveText('19,5 °C');
  await expect(label('bedroom').locator('.reading.hvac.heat')).toHaveText('Chauffage');
  await expect(label('bedroom').locator('.reading')).toHaveCount(2);
  // The kitchen's climate reports its temperature while cooling.
  await expect(label('kitchen').locator('.reading.temp')).toHaveText('26,8 °C');
  await expect(label('kitchen').locator('.reading.hvac.cool')).toHaveText('Climatisation');
  for(const room of ['dining','hall','office','bath'])await expect(label(room).locator('.readings')).toHaveCount(0);
  await expect(viewer.locator('.legend')).toContainText('Climatisation en cours');
  await expect(label('kitchen').locator('i')).toHaveCount(0);
  // An offline thermometer still says so.
  await setStates({'sensor.salon_temperature':{state:'unavailable'}});
  await expect(label('living').locator('.reading.temp')).toHaveText('—');
  await expect(label('living').locator('.reading.temp')).toHaveAttribute('title','Température indisponible');
  await viewer.screenshot({path:'artifacts/spatial-labels-climate.png'});
  // No thermometer left on the floor: no climate mode to offer, the plan shows the lights.
  await setStates({'sensor.salon_temperature':null,'climate.chambre':null,'climate.cuisine':null});
  await expect(viewer.getByRole('button',{name:'Climat',exact:true})).toHaveCount(0);
  await expect(viewer.locator('.legend')).toHaveCount(0);
  await expect(label('bedroom').locator('.reading.temp')).toHaveCount(0);
  await expect(label('kitchen').locator('i')).toHaveCount(1);
});

test('the plan offers lights, climate, openings and audio-video ambiances, as far as its rooms have something to show',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer'),modes=viewer.getByRole('group',{name:'Ambiance du plan'});
  await expect(viewer.locator('canvas')).toBeVisible();
  await expect(modes.getByRole('button')).toHaveText(['Lumières','Climat','Ouvrants','Audio-vidéo']);
  // On a phone the ambiance shown keeps its name, the others their icon, all of them on the plan.
  await modes.getByRole('button',{name:'Ouvrants',exact:true}).click();
  const width=async(name:string)=>(await modes.getByRole('button',{name,exact:true}).boundingBox())!.width;
  expect(await width('Climat')).toBeLessThan(40);expect(await width('Ouvrants')).toBeGreaterThan(70);
  const [bar,stage]=await Promise.all([modes.boundingBox(),viewer.locator('.stage').boundingBox()]);
  expect(bar!.x+bar!.width).toBeLessThanOrEqual(stage!.x+stage!.width);
  // The bedroom window opens: its room turns green on the plan and says so.
  await page.evaluate(()=>(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo.hass.callService('binary_sensor','turn_on',{entity_id:'binary_sensor.chambre_fenetre'}));
  await expect(viewer.locator('[data-room="bedroom"] .reading.ajar')).toHaveText('Ouverte');
  await viewer.locator('.stage').screenshot({path:'artifacts/spatial-modes-openings-phone.png'});
  await modes.getByRole('button',{name:'Audio-vidéo',exact:true}).click();
  await viewer.locator('.stage').screenshot({path:'artifacts/spatial-modes-media-phone.png'});
  // Without a player left, no audio-video ambiance: the plan goes back to the lights.
  await page.evaluate(()=>{
    const view=document.querySelector('mp-glass-view-v4') as HTMLElement&{hass:import('../../frontend/ha/client').Hass},states={...view.hass.states};
    delete states['media_player.salon_tv'];delete states['media_player.cuisine'];view.hass={...view.hass,states};
  });
  await expect(modes.getByRole('button')).toHaveText(['Lumières','Climat','Ouvrants']);
  await expect(modes.getByRole('button',{name:'Lumières',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(viewer.locator('.legend')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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

test('doors and windows tell whether they are open, and their shutters, blinds and curtains are commanded from their room',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  // Shutter at 65 %, curtain at 35 %, blind up: three let daylight in; the bedroom shutter is down.
  const overview=viewer.getByRole('region',{name:'Vue d’ensemble du niveau'});
  await expect(overview.locator('.stat',{hasText:'Volets'})).toContainText('3 / 4');
  await viewer.getByRole('button',{name:'Ouvrants',exact:true}).click();
  await expect(viewer.locator('.legend')).toHaveText(/Porte ou fenêtre ouverte\s*Volets ouverts/);
  await expect(viewer.locator('[data-room="living"]')).toContainText('65 %');await expect(viewer.locator('[data-room="living"]')).toContainText('35 %');
  await viewer.locator('[data-room="living"]').click();
  const living=viewer.getByRole('region',{name:'Salon'}),bay=living.getByRole('list',{name:'Portes et fenêtres'});
  await expect(bay.getByText('Baie vitrée',{exact:true})).toBeVisible();await expect(bay.getByText('2,4 × 2,15 m')).toBeVisible();
  // What the bay window holds is not listed again with the rest of the room.
  await expect(living.getByRole('list',{name:'Équipements'}).getByText('Volet baie')).toHaveCount(0);
  await bay.getByRole('button',{name:'Fermer le volet Rideau'}).click();
  await living.getByRole('button',{name:'Fermer tous les volets de la pièce'}).click();
  await expect(viewer.locator('[data-room="living"]')).not.toContainText('65 %');
  await expect(living.getByRole('button',{name:'Fermer tous les volets de la pièce'})).toBeDisabled();
  await viewer.screenshot({path:'artifacts/spatial-openings-living.png'});
  // A blind that tilts has a slider for its slats.
  await viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Cuisine'}).click();
  await viewer.getByRole('region',{name:'Cuisine'}).getByRole('slider',{name:'Inclinaison Store'}).fill('30');
  // The bedroom window is closed, then its sensor says it is open: on its row, and on the plan.
  await viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Chambre'}).click();
  const bedroom=viewer.getByRole('region',{name:'Chambre'}).getByRole('list',{name:'Portes et fenêtres'});
  await expect(bedroom.getByText('Fermée',{exact:true})).toBeVisible();
  await page.evaluate(()=>(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo.hass.callService('binary_sensor','turn_on',{entity_id:'binary_sensor.chambre_fenetre'}));
  await expect(bedroom.getByText('Ouverte',{exact:true})).toBeVisible();
  await expect(viewer.locator('[data-room="bedroom"] .reading.ajar')).toHaveText('Ouverte');
  await viewer.screenshot({path:'artifacts/spatial-openings-bedroom.png'});
  // The whole floor at once, each cover once.
  await viewer.getByRole('button',{name:'Fermer la pièce'}).click();
  await overview.getByRole('button',{name:'Fermer tous les volets du niveau'}).click();
  await expect(overview.locator('.stat',{hasText:'Volets'})).toContainText('0 / 4');
  expect(await demoCalls(page)).toEqual([
    {domain:'cover',service:'close_cover',data:{entity_id:'cover.salon_rideau'}},
    {domain:'cover',service:'close_cover',data:{entity_id:['cover.salon','cover.salon_rideau']}},
    {domain:'cover',service:'set_cover_tilt_position',data:{entity_id:'cover.cuisine_store',tilt_position:30}},
    {domain:'binary_sensor',service:'turn_on',data:{entity_id:'binary_sensor.chambre_fenetre'}},
    {domain:'cover',service:'close_cover',data:{entity_id:['cover.salon','cover.salon_rideau','cover.cuisine_store','cover.chambre']}},
  ]);
  await expect(overview.getByRole('button',{name:'Fermer tous les volets du niveau'})).toBeDisabled();
});

test('a television and a speaker are switched, played, paused, turned down and moved to another source from their room',async({page})=>{
  await page.setViewportSize({width:1440,height:1050});await page.goto('/?spatial');
  const viewer=page.locator('mp-spatial-viewer');await expect(viewer.locator('canvas')).toBeVisible();
  // In the audio-video ambiance, what plays shows under the name of its room.
  await expect(viewer.locator('[data-room="living"] .reading.media')).toHaveCount(0);
  await viewer.getByRole('button',{name:'Audio-vidéo',exact:true}).click();
  await expect(viewer.locator('.legend')).toHaveText(/En lecture\s*Allumé/);
  await expect(viewer.locator('[data-room="living"] .reading.media')).toHaveText('Le Grand Bleu');
  await expect(viewer.locator('[data-room="kitchen"] .reading.player')).toHaveText('En pause');
  await viewer.locator('[data-room="living"]').click();
  const living=viewer.getByRole('region',{name:'Salon'});
  await expect(living.getByText('Lecture · Le Grand Bleu')).toBeVisible();
  await living.getByRole('button',{name:'Pause Téléviseur'}).click();
  await expect(living.getByRole('button',{name:'Lecture Téléviseur'})).toBeVisible();
  await expect(viewer.locator('[data-room="living"] .reading.media')).toHaveCount(0);
  await expect(viewer.locator('[data-room="living"] .reading.player')).toHaveText('En pause');
  await living.getByRole('slider',{name:'Volume Téléviseur'}).fill('50');
  await expect(living.locator('.volume output')).toHaveText('50 %');
  await living.getByRole('button',{name:'Couper le son Téléviseur'}).click();
  await expect(living.getByRole('button',{name:'Rétablir le son Téléviseur'})).toHaveAttribute('aria-pressed','true');
  await expect(living.locator('.volume output')).toHaveText('Muet');
  await living.getByRole('combobox',{name:'Source Téléviseur'}).selectOption('HDMI 1');
  await viewer.screenshot({path:'artifacts/spatial-media-living.png'});
  await living.getByRole('button',{name:'Éteindre Téléviseur'}).click();
  await expect(living.getByRole('button',{name:'Allumer Téléviseur'})).toBeVisible();
  await expect(living.getByRole('button',{name:'Lecture Téléviseur'})).toHaveCount(0);
  // The kitchen speaker, paused: it plays again, then skips to the next track.
  await viewer.getByRole('navigation',{name:'Pièces du niveau'}).getByRole('button',{name:'Cuisine'}).click();
  const kitchen=viewer.getByRole('region',{name:'Cuisine'});
  await expect(kitchen.getByText('En pause · So What · Miles Davis')).toBeVisible();
  await kitchen.getByRole('button',{name:'Lecture Enceinte'}).click();
  await kitchen.getByRole('button',{name:'Piste suivante Enceinte'}).click();
  await expect(viewer.locator('[data-room="kitchen"] .reading.media')).toHaveText('So What · Miles Davis');
  const tv={entity_id:'media_player.salon_tv'},speaker={entity_id:'media_player.cuisine'};
  expect(await demoCalls(page)).toEqual([
    {domain:'media_player',service:'media_pause',data:tv},{domain:'media_player',service:'volume_set',data:{...tv,volume_level:.5}},
    {domain:'media_player',service:'volume_mute',data:{...tv,is_volume_muted:true}},{domain:'media_player',service:'select_source',data:{...tv,source:'HDMI 1'}},
    {domain:'media_player',service:'turn_off',data:tv},{domain:'media_player',service:'media_play',data:speaker},{domain:'media_player',service:'media_next_track',data:speaker},
  ]);
});

test('in the Studio, doors, windows, televisions and speakers are added, placed with a tap on the plan and linked',async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  await mountEditor(page);
  const editor=page.locator('mp-spatial-editor'),viewer=editor.locator('mp-spatial-viewer');
  type Room=import('../../shared/spatial').SpatialRoom;
  const living=()=>page.evaluate(()=>(window as unknown as {spatialTest:{changed:import('../../shared/spatial').SpatialPlan[]}}).spatialTest.changed.at(-1)!.floors[0]!.rooms[0]! as Room);
  const openings=editor.getByRole('region',{name:'Portes et fenêtres de la pièce'});
  // A window goes on the longest wall, in its middle, as wide as usual; the plan then waits for the wall it is on.
  await openings.getByRole('button',{name:'Fenêtre',exact:true}).click();
  expect((await living()).openings).toEqual([{id:expect.stringMatching(/^opening-/),kind:'window',side:0,at:.5,width:1.2}]);
  await expect(viewer.locator('.picking')).toHaveText(/Touchez sur le plan le mur de « Salon » qui reçoit « Fenêtre »/);
  await expect(openings.getByRole('button',{name:'Touchez le plan…'})).toHaveAttribute('aria-pressed','true');
  await viewer.screenshot({path:'artifacts/spatial-studio-placing.png'});
  // Touched beside the right wall, 1.2 m down it.
  await viewer.evaluate(v=>v.dispatchEvent(new CustomEvent('plan-pick',{detail:{floorId:'ground',roomId:'living',point:[5.04,1.2],room:''}})));
  expect((await living()).openings![0]).toMatchObject({side:1,at:.3});
  await expect(viewer.locator('.picking')).toHaveCount(0);
  const wall=openings.getByRole('combobox',{name:'Mur de Fenêtre'});
  await expect(wall).toHaveValue('1');await expect(wall.locator('option:checked')).toHaveText('Mur 2 · à droite · 4 m');
  await expect(wall.locator('option').first()).toHaveText('Mur 1 · en haut · 5 m');
  // Its shutter, and what it really is: a French window, 60 % down the wall.
  await openings.getByRole('group',{name:'Équipements de Fenêtre'}).getByRole('checkbox',{name:/Salon · Volet baie/}).check();
  await openings.getByRole('combobox',{name:'Type de Fenêtre'}).selectOption('french_window');
  await openings.getByRole('slider',{name:'Position de Porte-fenêtre le long du mur'}).fill('60');
  expect((await living()).openings![0]).toMatchObject({kind:'french_window',side:1,at:.6,width:1.4,entityIds:['cover.salon']});
  // A speaker in the middle of the room, placed with a real tap on the floor of the room on the plan.
  const media=editor.getByRole('region',{name:'Audio et vidéo de la pièce'});
  await media.getByRole('button',{name:'Enceinte',exact:true}).click();
  const added=(await living()).media![0]!;
  expect(added).toMatchObject({kind:'speaker',at:[2.5,2]});expect(added.entityId).toBeUndefined();
  await expect(viewer.locator('.picking')).toHaveText(/l’endroit de « Salon » où placer « Enceinte »/);
  await page.waitForTimeout(700);  // The camera flies to the room.
  const tap=await viewer.evaluate(v=>{
    const root=v.shadowRoot!,canvas=root.querySelector('canvas')!,r=canvas.getBoundingClientRect();
    return ([[0,70],[40,70],[-40,70],[0,100],[60,40],[-60,40]] as const).map(([dx,dy])=>({x:r.x+r.width/2+dx,y:r.y+r.height/2+dy})).find(p=>root.elementFromPoint(p.x,p.y)===canvas);
  });
  if(!tap)throw Error('room hidden by labels');
  await page.mouse.click(tap.x,tap.y);
  await expect(viewer.locator('.picking')).toHaveCount(0);
  const placed=(await living()).media![0]!;
  expect(placed.at).not.toEqual([2.5,2]);
  for(const [value,max] of [[placed.at[0],5],[placed.at[1],4]] as const){expect(value).toBeGreaterThan(-.3);expect(value).toBeLessThan(max+.3);}
  // Linked to its player; then a television instead. Escape leaves a placement without moving anything.
  await media.getByRole('combobox',{name:'Lecteur de Enceinte'}).selectOption('media_player.cuisine');
  await media.getByRole('combobox',{name:'Type de Enceinte'}).selectOption('tv');
  await media.getByRole('button',{name:'Placer sur le plan'}).click();
  await expect(viewer.locator('.picking')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer.locator('.picking')).toHaveCount(0);
  expect((await living()).media).toEqual([{id:added.id,kind:'tv',at:placed.at,entityId:'media_player.cuisine'}]);
  await editor.screenshot({path:'artifacts/spatial-studio-fixtures.png'});
  // A corner added keeps it on its wall; the corner it stands by removed, the wall it was on is gone and so is it.
  await editor.getByText('Corriger les sommets (X / Y en mètres) et les courbes').click();
  await editor.getByRole('button',{name:'Ajouter un sommet'}).click();
  expect((await living()).openings![0]).toMatchObject({side:1,at:.6});
  await editor.getByRole('button',{name:'Supprimer sommet 2'}).click();
  expect((await living()).openings).toBeUndefined();
  await expect(editor.getByRole('status').filter({hasText:'Une porte ou une fenêtre, trop loin des murs modifiés, a été retirée'})).toBeVisible();
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
