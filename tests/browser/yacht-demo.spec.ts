import { test, expect } from '@playwright/test';

test('yacht demo keeps the original interface with English decks and room information',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1050});
  await page.goto('/?spatial&scenario=yacht');
  const original=page.locator('mp-glass-view-v4');
  await expect(original).toBeVisible();
  await expect(page.locator('mp-yacht-demo')).toHaveCount(0);
  for(const name of ['Accueil','Lumières','Pièces','Info'])await expect(original.getByRole('link',{name,exact:true})).toBeVisible();
  const viewer=original.locator('mp-spatial-viewer');
  const decks=viewer.getByRole('group',{name:'Niveau affiché'});
  for(const name of ['Lower Deck','Main Deck','Upper Deck','Sun Deck'])await expect(decks.getByRole('button',{name,exact:true})).toBeVisible();
  await decks.getByRole('button',{name:'Main Deck',exact:true}).click();
  await expect(viewer.locator('.chip').filter({hasText:'Galley'})).toBeVisible();
  await viewer.locator('.chip').filter({hasText:'Main Salon'}).click();
  await expect(viewer.getByRole('region',{name:'Main Salon',exact:true})).toBeVisible();
  await decks.getByRole('button',{name:'Main Deck',exact:true}).click();
  await page.screenshot({path:'artifacts/yacht-restored-interface.png',fullPage:true});
  await decks.getByRole('button',{name:'Lower Deck',exact:true}).click();
  await expect(viewer.locator('.chip').filter({hasText:'Engine Room'})).toBeVisible();
  await expect(viewer.locator('.chip').filter({hasText:'Laundry'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('yacht demo keeps the original interface on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?spatial&scenario=yacht');
  const viewer=page.locator('mp-glass-view-v4 mp-spatial-viewer');
  await expect(viewer).toBeVisible();
  await viewer.getByRole('group',{name:'Niveau affiché'}).getByRole('button',{name:'Lower Deck',exact:true}).click();
  await viewer.locator('.chip').filter({hasText:'Laundry'}).click();
  await expect(viewer.getByRole('region',{name:'Laundry',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/yacht-restored-mobile.png',fullPage:true});
});
