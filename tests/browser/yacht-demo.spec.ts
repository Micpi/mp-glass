import { test, expect } from '@playwright/test';

test('yacht demo presents furnished English decks and commands the selected room',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1600,height:1100});
  await page.goto('/?spatial&scenario=yacht');
  const yacht=page.locator('mp-yacht-demo');
  const decks=yacht.getByRole('navigation',{name:'Yacht decks'});
  await expect(decks.getByRole('button')).toHaveCount(4);
  await expect(yacht.getByRole('group',{name:'Main Deck furnished yacht plan'})).toBeVisible();
  await expect(yacht.locator('.furnishing').first()).toBeVisible();
  await page.screenshot({path:'artifacts/yacht-main-deck.png',fullPage:true});
  await yacht.getByRole('button',{name:'Open Main Salon',exact:true}).click();
  const room=yacht.getByRole('complementary',{name:'Main Salon systems'});
  await room.getByRole('button',{name:'Turn off',exact:true}).click();
  await expect(room.getByRole('button',{name:'Turn on',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {demo:{hass:{states:Record<string,{state:string}>}}}).demo.hass.states['light.demo_saloon']!.state)).toBe('off');
  await yacht.getByRole('button',{name:'Climate',exact:true}).click();
  await expect(room.getByRole('button',{name:'Turn on',exact:true})).toHaveCount(0);
  await room.getByRole('button',{name:'Raise Air conditioning temperature'}).click();
  await expect(room.getByText('Set to 24 °C',{exact:true})).toBeVisible();
  await yacht.getByRole('button',{name:'Access & shades',exact:true}).click();
  await room.getByRole('button',{name:'Close',exact:true}).click();
  await expect(room.getByText('0% open',{exact:true})).toBeVisible();
  await yacht.getByRole('button',{name:'All systems',exact:true}).click();
  for(const [name,file] of [['Upper Deck','upper'],['Sun Deck','sun'],['Lower Deck','lower']]){
    await decks.getByRole('button',{name:new RegExp(name!)}).click();
    await expect(yacht.getByRole('group',{name:`${name} furnished yacht plan`})).toBeVisible();
    await page.screenshot({path:`artifacts/yacht-${file}-deck.png`,fullPage:true});
  }
  await yacht.getByRole('button',{name:'Open Laundry',exact:true}).click();
  await expect(yacht.getByRole('complementary',{name:'Laundry systems'}).getByText('Drying',{exact:true})).toBeVisible();
  await yacht.getByRole('button',{name:'3D view',exact:true}).click();
  await expect(yacht.locator('mp-yacht-spatial-viewer canvas')).toBeVisible();
  await expect(yacht.locator('mp-yacht-spatial-viewer .side')).toBeHidden();
  await page.screenshot({path:'artifacts/yacht-3d.png',fullPage:true});
  await yacht.locator('mp-yacht-spatial-viewer .labels [data-room="lower-garage-platform"]').click();
  await expect(yacht.getByRole('complementary',{name:'Swim Platform systems'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('yacht demo remains usable on a phone with room details and all four decks',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?spatial&scenario=yacht');
  const yacht=page.locator('mp-yacht-demo');
  await yacht.getByRole('navigation',{name:'Yacht decks'}).getByRole('button',{name:/Lower Deck/}).click();
  await yacht.getByRole('navigation',{name:'Spaces on this deck'}).getByRole('button',{name:'Laundry',exact:true}).click();
  await expect(yacht.getByRole('complementary',{name:'Laundry systems'})).toBeVisible();
  await expect(yacht.getByRole('complementary',{name:'Laundry systems'}).getByText('Rinsing',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/yacht-mobile.png',fullPage:true});
});
