import { test, expect } from '@playwright/test';
test('commands the correct light; dimmer only where declared; more-info bubbles',async({page})=>{
  await page.goto('/');const first=page.locator('mp-glass-light-v2').nth(0);
  await first.getByRole('button',{name:'Allumer',exact:true}).click();await expect(first.getByRole('button',{name:'Éteindre',exact:true})).toBeVisible();
  expect(await page.evaluate(()=> (window as unknown as {demo:{calls:unknown[]}}).demo.calls)).toEqual([{domain:'light',service:'turn_on',data:{entity_id:'light.circuit_0'}}]);
  await expect(page.locator('mp-glass-light-v2').nth(1).getByRole('slider')).toHaveCount(0);
  await first.getByRole('slider').fill('75');await first.getByRole('slider').dispatchEvent('change');
  await expect(first.getByText('Luminosité 75 %')).toBeVisible();
  await page.evaluate(()=>document.addEventListener('hass-more-info',event=>Object.assign(window,{moreInfo:(event as CustomEvent).detail})));
  await first.getByRole('button',{name:'Détails'}).click();expect(await page.evaluate(()=>(window as unknown as {moreInfo:unknown}).moreInfo)).toEqual({entityId:'light.circuit_0'});
});
test('displays unavailable and service errors without claiming success',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{const demo=(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass;cards:import('../../frontend/cards/light').MPGlassLight[]}}).demo;demo.hass.callService=async()=>{throw new Error('denied');};demo.cards[0]!.hass={...demo.hass};});
  const first=page.locator('mp-glass-light-v2').first();await first.getByRole('button',{name:'Allumer',exact:true}).click();await expect(first.getByRole('alert')).toContainText('Action impossible');await expect(first.getByRole('button',{name:'Allumer',exact:true})).toBeEnabled();
  await page.evaluate(()=>{const demo=(window as unknown as {demo:{hass:import('../../frontend/ha/client').Hass;cards:import('../../frontend/cards/light').MPGlassLight[]}}).demo;demo.hass.states={...demo.hass.states,'light.circuit_0':{entity_id:'light.circuit_0',state:'unavailable',attributes:{}}};demo.cards[0]!.hass={...demo.hass};});
  await expect(first.getByText('Indisponible')).toBeVisible();await expect(first.getByRole('button',{name:'Allumer',exact:true})).toBeDisabled();
});
for(const [name,width,height] of [['phone-portrait',390,844],['phone-landscape',844,390],['tablet-portrait',820,1180],['tablet-landscape',1180,820],['desktop',1440,1000],['wall',1920,1080]] as const){
  test(`${name}: no overflow and visual baseline`,async({page})=>{await page.clock.setFixedTime(new Date('2026-09-12T20:42:00'));await page.setViewportSize({width,height});await page.goto('/');await expect(page.locator('mp-glass-light-v2')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page).toHaveScreenshot(`${name}.png`,{fullPage:true,animations:'disabled'});});
}
