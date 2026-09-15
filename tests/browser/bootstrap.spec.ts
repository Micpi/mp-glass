import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

const TAG = 'll-strategy-dashboard-mp-glass';
type Strategy = { generate:(config:object,hass:object)=>Promise<unknown>; shouldRegenerate:(config:object,oldHass:object,newHass:object)=>boolean };

/** A page of the test server without the demo, which would register the full strategy first. */
async function blankPage(page:Page){
  await page.route('**/blank.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>blank</title>'}));
  await page.goto('/blank.html');
}

test('the bootstrap registers the strategy at once and retries an engine that failed to load',async({page})=>{
  const logs:string[]=[];page.on('console',message=>logs.push(message.text()));
  const engine:string[]=[];
  await page.route('**/frontend/mp-glass.js*',route=>{
    engine.push(route.request().url());
    return engine.length===1 ? route.abort('failed') : route.fulfill({contentType:'text/javascript',body:'export const generateMPGlassDashboard=async(config,hass)=>({views:[{title:hass.name}]});'});
  });
  await blankPage(page);
  expect(await page.evaluate(async tag=>{const bootstrap='/frontend/bootstrap.ts';await import(bootstrap);return !!customElements.get(tag);},TAG)).toBe(true);
  expect(logs.some(line=>/^\[MP Glass [\d.]+\] stratégie du dashboard enregistrée \(\d+ ms/.test(line))).toBe(true);
  const dashboard=await page.evaluate(tag=>(customElements.get(tag) as unknown as {generate:(config:object,hass:object)=>Promise<unknown>}).generate({},{name:'ok'}),TAG);
  expect(dashboard).toEqual({views:[{title:'ok'}]});
  expect(engine).toHaveLength(2);
  expect(new URL(engine[1]!).searchParams.get('retry')).toBe('1');
  expect(logs.some(line=>line.includes('interface injoignable, nouvel essai dans 1 s'))).toBe(true);
});

test('registered after Home Assistant gave up, the strategy asks once for a new generation',async({page})=>{
  await page.route('**/frontend/mp-glass.js*',route=>route.fulfill({contentType:'text/javascript',body:'export const generateMPGlassDashboard=async()=>({views:[]});'}));
  await blankPage(page);
  const answers=await page.evaluate(async tag=>{
    const bootstrap='/frontend/bootstrap.ts';await import(bootstrap);
    const strategy=customElements.get(tag) as unknown as Strategy,hass={entities:{},devices:{},areas:{},floors:{}};
    // Home Assistant shows its timeout error: never asked for a dashboard, the strategy wants one, but only once.
    const beforeGeneration=[strategy.shouldRegenerate({},hass,{...hass}),strategy.shouldRegenerate({},hass,{...hass})];
    await strategy.generate({},hass);
    return {beforeGeneration,sameRegistries:strategy.shouldRegenerate({},hass,{...hass}),newEntities:strategy.shouldRegenerate({},hass,{...hass,entities:{}})};
  },TAG);
  expect(answers).toEqual({beforeGeneration:[true,false],sameRegistries:false,newEntities:true});
});

test('a browser that cannot read the engine is named, without retrying',async({page})=>{
  const engine:string[]=[];
  await page.route('**/frontend/mp-glass.js*',route=>{engine.push(route.request().url());return route.fulfill({contentType:'text/javascript',body:'export const a = ;'});});
  await blankPage(page);
  const message=await page.evaluate(async tag=>{
    const bootstrap='/frontend/bootstrap.ts';await import(bootstrap);
    return (customElements.get(tag) as unknown as Strategy).generate({},{}).then(()=>'generated',(error:Error)=>error.message);
  },TAG);
  expect(message).toContain('Ce navigateur est trop ancien pour l’interface MP Glass');
  expect(message).toContain('Navigateur : Mozilla/5.0');
  expect(engine).toHaveLength(1);
});

test('the diagnostic page reports on the built bootstrap and interface',async({page})=>{
  const www=new URL('../../custom_components/mp_glass/www/',import.meta.url);
  await page.route('**/mp_glass_static/**',async route=>{
    const file=new URL(route.request().url()).pathname.replace('/mp_glass_static/','');
    const body=await readFile(new URL(file,www)).catch(()=>undefined);
    return body ? route.fulfill({body,contentType:file.endsWith('.html')?'text/html':'text/javascript'}) : route.fulfill({status:404});
  });
  await page.goto('/mp_glass_static/diagnostic.html');
  const results=page.locator('#results');
  await expect(results.getByText(/^Terminé/)).toBeVisible({timeout:15_000});
  await expect(results.locator('li.ko')).toHaveCount(0);
  await expect(results.locator('li',{hasText:'Téléchargement du bootstrap'})).toContainText('HTTP 200');
  await expect(results.locator('li',{hasText:'Stratégie du dashboard'})).toContainText(/enregistrée en \d+ ms · \[MP Glass [\d.]+\] stratégie du dashboard enregistrée/);
  await expect(results.locator('li',{hasText:'Interface MP Glass'})).toContainText(/chargée en \d+ ms/);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/diagnostic-phone.png',fullPage:true});
});

test('the strategy waits for an integration still starting, but not for a refusal',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async tag=>{
    const projectModule='/shared/project.ts';
    const {defaultProject}=await import(projectModule);
    const strategy=customElements.get(tag) as unknown as {generate:(config:object,hass:unknown)=>Promise<{views:{path:string}[]}>};
    const hass=(answer:(attempt:number)=>unknown)=>{let attempt=0;return {connection:{},states:{},language:'fr',callService:async()=>{},callWS:async(message:{type:string})=>{
      if(message.type!=='mp_glass/project/get') return [];
      attempt++;const response=answer(attempt);if(response instanceof Error||'code' in (response as object)) throw response;return response;
    }};};
    const started=performance.now();
    const views=(await strategy.generate({},hass(attempt=>attempt<3?{code:'not_loaded'}:{revision:0,project:defaultProject('Maison')}))).views.map(view=>view.path);
    const waited=performance.now()-started;
    const refused=await strategy.generate({},hass(()=>({code:'unauthorized'}))).then(()=>'generated',(error:{code?:string})=>error.code);
    const registries={entities:{},devices:{},areas:{},floors:{}};
    const regenerate=(strategy as unknown as Strategy).shouldRegenerate({},registries,{...registries});
    return {views,waited,refused,regenerate};
  },TAG);
  expect(result.views[0]).toBe('home');
  expect(result.waited).toBeGreaterThan(3500);
  expect(result.refused).toBe('unauthorized');
  // Already generated on this page: only a registry change regenerates.
  expect(result.regenerate).toBe(false);
});
