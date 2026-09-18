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
test('one room change in the Studio moves the equipment on the plan and on the room pages',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const projectModule='/shared/project.ts';const fixturesModule='/tests/fixtures.ts';
    const {defaultProject}=await import(projectModule);const {home}=await import(fixturesModule);
    const snapshot=home(2);
    // A temperature sensor Home Assistant has no room for: the Studio lists it to be placed.
    snapshot.entities.push({id:'stable-sensor',entity_id:'sensor.bureau_temperature'});
    snapshot.states['sensor.bureau_temperature']={entity_id:'sensor.bureau_temperature',state:'20.5',attributes:{friendly_name:'Bureau · Température',device_class:'temperature',unit_of_measurement:'°C'}};
    let record={revision:0,project:defaultProject('Maison test')};
    const hass={connection:{},states:snapshot.states,language:'fr',user:{id:'test',is_admin:true},callService:async()=>{},callWS:async(message:Record<string,unknown>)=>{
      switch(message.type){
        case 'mp_glass/project/get':return structuredClone(record);
        case 'mp_glass/project/save':record={revision:record.revision+1,project:message.project as typeof record.project};return structuredClone(record);
        case 'config/area_registry/list':return snapshot.areas;
        case 'config/floor_registry/list':return snapshot.floors;
        case 'config/device_registry/list':return snapshot.devices;
        case 'config/entity_registry/list':return snapshot.entities;
        case 'lovelace/dashboards/list':return [{url_path:'mp-glass',mode:'storage'}];
        case 'lovelace/config':return {strategy:{type:'custom:mp-glass'}};
        default:throw Error('unexpected command');
      }
    }};
    const panel=document.createElement('mp-glass-settings') as HTMLElement&{hass:typeof hass};
    panel.hass=hass;document.body.replaceChildren(panel);
    Object.assign(window,{settingsTest:{hass,record:()=>record}});
  });
  await page.getByRole('button',{name:/Équipements/}).click();
  await expect(page.locator('.device').filter({hasText:'Bureau · Température'})).toBeVisible();
  await page.getByRole('button',{name:/Plan 3D/}).click();
  const editor=page.locator('mp-spatial-editor');
  await expect(editor.getByRole('note')).toContainText('Plan par défaut');
  await expect(editor.getByText('Équipements automatiques · 2')).toBeVisible();
  await editor.getByRole('combobox',{name:'Pièce de Circuit 1'}).selectOption('kitchen');
  await expect(editor.getByText('Équipements automatiques · 1')).toBeVisible();
  await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Configuration enregistrée');
  const {project,dashboard}=await page.evaluate(async()=>{
    const {hass,record}=(window as unknown as {settingsTest:{hass:import('../../frontend/ha/client').Hass;record:()=>{project:unknown}}}).settingsTest;
    const strategy=customElements.get('ll-strategy-dashboard-mp-glass') as unknown as {generate:(config:object,hass:unknown)=>Promise<{views:{path:string;cards:{entity:string}[];mp_spatial?:import('../../shared/spatial').SpatialPlan}[]}>};
    return {project:record().project as import('../../shared/models').ProjectConfig,dashboard:await strategy.generate({},hass)};
  });
  expect(project.overrides['stable-1']).toEqual({areaId:'kitchen'});expect(project.spatial).toBeUndefined();
  expect(dashboard.views[0]!.mp_spatial!.floors[0]!.rooms.map(r=>[r.name,r.entityIds])).toEqual([['Salon',['light.circuit_0']],['Cuisine',['light.circuit_1']]]);
  expect(dashboard.views.find(v=>v.path==='area-kitchen')!.cards.map(c=>c.entity)).toEqual(['light.circuit_1']);
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
test('each user picks their language with the flag of the dashboard, and the Studio follows it',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{
    const projectModule='/shared/project.ts';
    const {defaultProject}=await import(projectModule);
    const record={revision:0,project:defaultProject('Maison test')};
    const requests:Record<string,unknown>[]=[];
    const hass={connection:{},states:{},language:'fr',user:{id:'test',is_admin:false},callService:async()=>{},callWS:async(message:Record<string,unknown>)=>{
      requests.push(message);
      if(message.type==='mp_glass/project/get')return structuredClone(record);
      if(String(message.type).startsWith('config/'))return [];
      if(message.type==='frontend/get_user_data')return {value:null};
      if(message.type==='frontend/set_user_data')return null;
      throw Error('unexpected command');
    }};
    const view=document.createElement('mp-glass-view-v4') as HTMLElement&{hass:typeof hass};
    view.hass=hass;document.body.replaceChildren(view);
    Object.assign(window,{languageTest:{hass,requests}});
  });
  // Beside the clock on a wide screen: a flag, not a menu of words.
  const flag=page.getByRole('button',{name:'Langue : Français'});
  await expect(flag).toBeVisible();
  expect(await flag.textContent()).toBe('');
  await flag.click();
  await expect(page.getByRole('menuitemradio',{name:'Français'})).toHaveAttribute('aria-checked','true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(flag).toBeFocused();
  await flag.click();
  await page.getByRole('menuitemradio',{name:'English'}).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Home',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Language: English'})).toBeVisible();
  // On a phone the clock is hidden: the flag ends the navigation, and its menu stays on the screen.
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Language: English'}).click();
  const menu=page.getByRole('menu');
  const box=await menu.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  await page.getByRole('menuitemradio',{name:'Русский'}).click();
  await expect(page.getByRole('link',{name:'Главная'})).toBeVisible();
  // Kept by Home Assistant for this user, whoever they are, and in this browser until it answers.
  expect(await page.evaluate(()=>(window as unknown as {languageTest:{requests:Record<string,unknown>[]}}).languageTest.requests.filter(r=>String(r.type).startsWith('frontend/')))).toEqual([
    {type:'frontend/get_user_data',key:'mp_glass_language'},
    {type:'frontend/set_user_data',key:'mp_glass_language',value:'en'},
    {type:'frontend/set_user_data',key:'mp_glass_language',value:'ru'},
  ]);
  expect(await page.evaluate(()=>localStorage.getItem('mp-glass.language'))).toBe('ru');
  // The Studio speaks the language chosen on the dashboard, and has no menu of its own.
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{
    const {hass}=(window as unknown as {languageTest:{hass:{user:{is_admin:boolean}}}}).languageTest;hass.user.is_admin=true;
    const panel=document.createElement('mp-glass-settings') as HTMLElement&{hass:typeof hass};
    panel.hass=hass;document.body.replaceChildren(panel);
  });
  await expect(page.getByRole('button',{name:'Сохранить',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:/Язык|Langue|Language/})).toHaveCount(0);
  await page.evaluate(()=>{localStorage.removeItem('mp-glass.language');});
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
