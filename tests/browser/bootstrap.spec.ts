import { test, expect } from '@playwright/test';

const TAG = 'll-strategy-dashboard-mp-glass';

test('the bootstrap registers the strategy at once and retries an engine that failed to load',async({page})=>{
  const logs:string[]=[];page.on('console',message=>logs.push(message.text()));
  // A page of the test server without the demo, which would register the full strategy first.
  await page.route('**/blank.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>blank</title>'}));
  const engine:string[]=[];
  await page.route('**/frontend/mp-glass.js*',route=>{
    engine.push(route.request().url());
    return engine.length===1 ? route.abort('failed') : route.fulfill({contentType:'text/javascript',body:'export const generateMPGlassDashboard=async(config,hass)=>({views:[{title:hass.name}]});'});
  });
  await page.goto('/blank.html');
  expect(await page.evaluate(async tag=>{const bootstrap='/frontend/bootstrap.ts';await import(bootstrap);return !!customElements.get(tag);},TAG)).toBe(true);
  expect(logs.some(line=>/^\[MP Glass [\d.]+\] stratégie du dashboard enregistrée \(\d+ ms/.test(line))).toBe(true);
  const dashboard=await page.evaluate(tag=>(customElements.get(tag) as unknown as {generate:(config:object,hass:object)=>Promise<unknown>}).generate({},{name:'ok'}),TAG);
  expect(dashboard).toEqual({views:[{title:'ok'}]});
  expect(engine).toHaveLength(2);
  expect(new URL(engine[1]!).searchParams.get('retry')).toBe('1');
  expect(logs.some(line=>line.includes('interface injoignable, nouvel essai dans 1 s'))).toBe(true);
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
    return {views,waited,refused};
  },TAG);
  expect(result.views[0]).toBe('home');
  expect(result.waited).toBeGreaterThan(3500);
  expect(result.refused).toBe('unauthorized');
});
