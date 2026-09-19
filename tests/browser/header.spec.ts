import { test, expect, type Page } from '@playwright/test';

/**
 * Home Assistant's hui-root as far as its bar goes (2026.9): an opaque header above the view container, in its
 * shadow root, here on a subview with its back arrow and title. The demo view is moved into it, as hui-view does.
 * `theme` adds rules as a theme or a module could inject them there.
 */
async function subview(page:Page,theme=''){
  await page.goto('/');
  await expect(page.locator('mp-glass-light-v4')).toHaveCount(3);
  await page.evaluate(theme=>{
    customElements.define('hui-root',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML=`
      <style>
        .header{background-color:rgb(28,28,28);color:white;position:fixed;top:0;width:100%;z-index:4}
        :host([scrolled]) .header{box-shadow:0 2px 4px -1px rgba(0,0,0,.2)}
        .edit-mode .header{background-color:rgb(69,90,100)}
        .toolbar{height:56px;display:flex;align-items:center;padding:0 12px;box-sizing:border-box;border-bottom:1px solid #444}
        .main-title{margin-inline-start:24px;flex-grow:1}
        hui-view-container{position:relative;display:flex;min-height:100vh;padding-top:56px;box-sizing:border-box}
        hui-view-container>*{display:flex;flex-direction:column;flex:1 1 100%;max-width:100%}
      </style><style>${theme}</style>
      <div class=""><div class="header"><slot name="toolbar"><div class="toolbar">
        <ha-icon-button-arrow-prev>←</ha-icon-button-arrow-prev><div class="main-title">Lumières</div><div class="action-items">＋ ⌕ ✎</div>
      </div></slot></div><hui-view-container id="view"><hui-view></hui-view></hui-view-container></div>`;}});
    const root=document.createElement('hui-root');
    document.body.append(root);
    root.shadowRoot!.querySelector('hui-view')!.append(document.querySelector('mp-glass-view-v4')!);
  },theme);
}
const bar=(page:Page)=>page.evaluate(()=>{
  const root=document.querySelector('hui-root')!.shadowRoot!,style=(selector:string)=>getComputedStyle(root.querySelector(selector)!);
  return {bar:style('.header').visibility,arrow:style('ha-icon-button-arrow-prev').visibility,title:style('.main-title').visibility,actions:style('.action-items').visibility,shadow:style('.header').boxShadow};
});
/** The color on screen in the middle of the bar, read back from a screenshot. */
async function barPixel(page:Page){
  const png=(await page.screenshot({clip:{x:page.viewportSize()!.width/2,y:20,width:1,height:1}})).toString('base64');
  return page.evaluate(async png=>{
    const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
    return [...context.getImageData(0,0,1,1).data.slice(0,3)];
  },png);
}

test('on an MP Nexus subview the Home Assistant bar is hidden but for its actions',async({page})=>{
  await subview(page);
  const actions=await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelector('.action-items')!.getBoundingClientRect().right);
  expect(await bar(page)).toEqual({bar:'hidden',arrow:'hidden',title:'hidden',actions:'visible',shadow:'none'});
  // The hidden title keeps its place: the actions stay on the right.
  expect(actions).toBeGreaterThan(page.viewportSize()!.width-40);
  await page.evaluate(()=>document.querySelector('hui-root')!.toggleAttribute('scrolled',true));
  expect((await bar(page)).shadow).toBe('none');
});

test('no band even when a theme paints the bar, its toolbar and a pseudo-element with !important',async({page})=>{
  const red='rgb(255,0,0)';
  await subview(page,`.header{background:${red}!important}.toolbar{background:${red}!important}.header::after{content:'';position:absolute;inset:0;background:${red}}`);
  const [r,g,b]=await barPixel(page);
  expect(r!-Math.max(g!,b!)).toBeLessThan(100);
  // The same theme without MP Nexus: the band would be there.
  await page.evaluate(()=>document.querySelector('hui-root')!.removeAttribute('mp-glass'));
  expect(await barPixel(page)).toEqual([255,0,0]);
});

test('edit mode and the views of other dashboards keep the Home Assistant bar',async({page})=>{
  await subview(page);
  await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelector('div')!.classList.add('edit-mode'));
  expect(await bar(page)).toMatchObject({bar:'visible',arrow:'visible',title:'visible'});
  await page.evaluate(()=>{
    const root=document.querySelector('hui-root')!.shadowRoot!;
    root.querySelector('div')!.classList.remove('edit-mode');
    // hui-root swaps views by removing the one on screen before adding the next.
    root.querySelector('hui-view')!.replaceChildren(document.createElement('div'));
  });
  expect(await bar(page)).toMatchObject({bar:'visible',arrow:'visible',title:'visible'});
  await page.evaluate(()=>{
    const hui=document.querySelector('hui-root')!.shadowRoot!.querySelector('hui-view')!;
    hui.replaceChildren(document.createElement('mp-glass-view-v4'));
  });
  expect((await bar(page)).bar).toBe('hidden');
  expect(await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelectorAll('style[data-mp-glass-header]').length)).toBe(1);
});
