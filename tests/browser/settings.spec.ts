import { test, expect } from '@playwright/test';
test('custom view fills the Home Assistant flex container',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{
    const parent=document.createElement('div');parent.style.cssText='display:flex;width:900px;max-width:100%';
    const view=document.createElement('mp-glass-view-v4');parent.append(view);document.body.replaceChildren(parent);
  });
  const bounds=await page.locator('mp-glass-view-v4').boundingBox();
  expect(bounds?.width).toBeGreaterThan(800);
  await expect(page.getByRole('link',{name:'Accueil'})).toHaveAttribute('href','/home');
  await expect(page.getByRole('link',{name:'Lumières'})).toHaveAttribute('href','/lights');
  await expect(page.getByRole('link',{name:'Pièces'})).toHaveAttribute('href','/rooms');
  await expect(page.getByRole('link',{name:'Personnaliser'})).toHaveAttribute('href','/mp-glass-settings');
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
    const requests:Record<string,unknown>[]=[];
    // Fresh install: no dashboard yet besides an unrelated one.
    const dashboards:{url_path:string;config?:unknown}[]=[{url_path:'energie',config:{views:[]}}];
    const hass={connection:{},states:snapshot.states,language:'fr',user:{id:'test',is_admin:true},callService:async()=>{},callWS:async(message:Record<string,unknown>)=>{
      requests.push(message);
      switch(message.type){
        case 'mp_glass/project/get':return structuredClone(record);
        case 'mp_glass/project/save':record={revision:record.revision+1,project:message.project as typeof record.project};return structuredClone(record);
        case 'config/area_registry/list':return snapshot.areas;
        case 'config/floor_registry/list':return snapshot.floors;
        case 'config/device_registry/list':return snapshot.devices;
        case 'config/entity_registry/list':return snapshot.entities;
        case 'lovelace/dashboards/list':return dashboards.map(({url_path})=>({url_path,mode:'storage'}));
        case 'lovelace/config':{const config=dashboards.find(d=>d.url_path===message.url_path)?.config;if(config)return config;throw {code:'config_not_found'};}
        case 'lovelace/dashboards/create':dashboards.push({url_path:String(message.url_path)});return {};
        case 'lovelace/config/save':dashboards.find(d=>d.url_path===message.url_path)!.config=message.config;return null;
        default:throw Error('unexpected command');
      }
    }};
    const panel=document.createElement('mp-glass-settings') as HTMLElement&{hass:typeof hass;panel?:unknown};
    panel.panel={component_name:'mp-glass-settings'};
    panel.hass=hass;document.body.replaceChildren(panel);
    Object.assign(window,{settingsTest:{hass,requests}});
  });
  await expect(page.getByText('Dashboard « MP Glass » créé')).toBeVisible();
  await expect(page.getByRole('button',{name:'Recharger la page'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Voir le dashboard'})).toHaveAttribute('href','/mp-glass/home');
  expect(await page.evaluate(()=>(window as unknown as {settingsTest:{requests:Record<string,unknown>[]}}).settingsTest.requests.filter(r=>String(r.type).startsWith('lovelace/dashboards/create')||r.type==='lovelace/config/save'))).toEqual([
    {type:'lovelace/dashboards/create',url_path:'mp-glass',title:'MP Glass',icon:'mdi:view-dashboard',show_in_sidebar:true,require_admin:false},
    {type:'lovelace/config/save',url_path:'mp-glass',config:{strategy:{type:'custom:mp-glass'}}},
  ]);
  await page.getByRole('button',{name:/Équipements/}).click();
  await expect(page.getByText('Éclairage principal',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Pièce',exact:true}).selectOption('salon');
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Configuration enregistrée');
  const dashboard=await page.evaluate(async()=>{
    const {hass}=(window as unknown as {settingsTest:{hass:import('../../frontend/ha/client').Hass}}).settingsTest;
    const strategy=customElements.get('ll-strategy-dashboard-mp-glass') as unknown as {generate:(config:object,hass:unknown)=>Promise<unknown>};
    return strategy.generate({},hass);
  });
  expect(dashboard).toMatchObject({title:'Maison test',views:[{path:'home',cards:[{type:'custom:mp-glass-light-v4',name:'Éclairage principal'}]},{path:'lights'},{path:'rooms'},{title:'Salon'}]});
  await page.getByRole('button',{name:'Analyser l’installation'}).click();
  await expect(page.getByRole('button',{name:'Enregistrer',exact:true})).toBeEnabled();
});
test('an update installed while the page is open asks for a reload',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const projectModule='/shared/project.ts';
    const {defaultProject}=await import(projectModule);
    // The integration was updated (e.g. through HACS) but this page still runs the previous interface.
    const record={revision:0,project:defaultProject('Maison test'),version:'0.0.1'};
    const hass={connection:{},states:{},language:'fr',user:{id:'test',is_admin:true},callService:async()=>{},callWS:async(message:Record<string,unknown>)=>{
      if(message.type==='mp_glass/project/get')return structuredClone(record);
      if(String(message.type).startsWith('config/'))return [];
      throw Error('unexpected command');
    }};
    const panel=document.createElement('mp-glass-settings') as HTMLElement&{hass:typeof hass};
    panel.hass=hass;document.body.replaceChildren(panel);
  });
  await expect(page.getByRole('alert')).toContainText('MP Glass 0.0.1 est installé, mais cette page affiche encore la version');
  await expect(page.getByRole('button',{name:'Recharger la page'})).toBeVisible();
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
