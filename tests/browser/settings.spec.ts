import { test, expect } from '@playwright/test';
test('custom view fills the Home Assistant flex container',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    const parent=document.createElement('div');parent.style.cssText='display:flex;width:900px;max-width:100%';
    const view=document.createElement('mp-glass-view');parent.append(view);document.body.replaceChildren(parent);
  });
  const bounds=await page.locator('mp-glass-view').boundingBox();
  expect(bounds?.width).toBeGreaterThan(800);
});
test('strategy and settings use registry/project contracts and retain manual overrides',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const projectModule='/shared/project.ts';
    const fixturesModule='/tests/fixtures.ts';
    const {defaultProject}=await import(projectModule);
    const {home}=await import(fixturesModule);
    const snapshot=home(1);snapshot.devices[0].area_id=null;
    let record={revision:0,project:defaultProject('Maison test')};
    record.project.overrides['stable-0']={name:'Éclairage principal'};
    const requests:unknown[]=[];
    const hass={connection:{},states:snapshot.states,language:'fr',user:{id:'test',is_admin:true},callService:async()=>{},callWS:async(message:Record<string,unknown>)=>{
      requests.push(message);
      switch(message.type){
        case 'mp_glass/project/get':return structuredClone(record);
        case 'mp_glass/project/save':record={revision:record.revision+1,project:message.project as typeof record.project};return structuredClone(record);
        case 'config/area_registry/list':return snapshot.areas;
        case 'config/floor_registry/list':return snapshot.floors;
        case 'config/device_registry/list':return snapshot.devices;
        case 'config/entity_registry/list':return snapshot.entities;
        default:throw Error('unexpected command');
      }
    }};
    const panel=document.createElement('mp-glass-settings') as HTMLElement&{hass:typeof hass};panel.hass=hass;document.body.replaceChildren(panel);
    Object.assign(window,{settingsTest:{hass,requests}});
  });
  await expect(page.getByText('Éclairage principal',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Pièce',exact:true}).selectOption('salon');
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Configuration enregistrée');
  const dashboard=await page.evaluate(async()=>{
    const {hass}=(window as unknown as {settingsTest:{hass:import('../../frontend/ha/client').Hass}}).settingsTest;
    const strategy=customElements.get('ll-strategy-dashboard-mp-glass') as unknown as {generate:(config:object,hass:unknown)=>Promise<unknown>};
    return strategy.generate({},hass);
  });
  expect(dashboard).toMatchObject({title:'Maison test',views:[{cards:[{type:'custom:mp-glass-light',name:'Éclairage principal'}]},{title:'Salon'}]});
  await page.getByRole('button',{name:'Analyser l’installation'}).click();
  await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeEnabled();
});
test('card editor emits config-changed and filters unrelated domains',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    const demo=(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass}}).demo;
    const editor=document.createElement('mp-glass-card-editor') as HTMLElement&{hass:typeof demo.hass;setConfig:(config:unknown)=>void};editor.hass=demo.hass;editor.setConfig({type:'custom:mp-glass-light',entity:'light.circuit_0'});
    editor.addEventListener('config-changed',event=>Object.assign(window,{editorChange:(event as CustomEvent).detail}));document.body.replaceChildren(editor);
  });
  await page.getByRole('combobox',{name:'Entité',exact:true}).selectOption('light.circuit_1');
  expect(await page.evaluate(()=>(window as unknown as {editorChange:unknown}).editorChange)).toEqual({config:{type:'custom:mp-glass-light',entity:'light.circuit_1'}});
});
