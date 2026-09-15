import { test, expect, type Page } from '@playwright/test';

/**
 * Home Assistant's hui-root as far as its bar goes (2026.9): an opaque header above the view container, in its
 * shadow root, here on a subview with its back arrow and title. The demo view is moved into it, as hui-view does.
 */
async function subview(page:Page){
  await page.goto('/');
  await expect(page.locator('mp-glass-light-v4')).toHaveCount(3);
  await page.evaluate(()=>{
    customElements.define('hui-root',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML=`
      <style>
        .header{background-color:rgb(28,28,28);color:white;position:fixed;top:0;width:100%;z-index:4}
        :host([scrolled]) .header{box-shadow:0 2px 4px -1px rgba(0,0,0,.2)}
        .edit-mode .header{background-color:rgb(69,90,100)}
        .toolbar{height:56px;display:flex;align-items:center;padding:0 12px;box-sizing:border-box}
        .main-title{margin-inline-start:24px;flex-grow:1}
        hui-view-container{position:relative;display:flex;min-height:100vh;padding-top:56px;box-sizing:border-box}
        hui-view-container>*{display:flex;flex-direction:column;flex:1 1 100%;max-width:100%}
      </style>
      <div class=""><div class="header"><slot name="toolbar"><div class="toolbar">
        <ha-icon-button-arrow-prev>←</ha-icon-button-arrow-prev><div class="main-title">Lumières</div><div class="action-items">＋ ⌕ ✎</div>
      </div></slot></div><hui-view-container id="view"><hui-view></hui-view></hui-view-container></div>`;}});
    const root=document.createElement('hui-root');
    document.body.append(root);
    root.shadowRoot!.querySelector('hui-view')!.append(document.querySelector('mp-glass-view-v4')!);
  });
}
const bar=(page:Page)=>page.evaluate(()=>{
  const root=document.querySelector('hui-root')!.shadowRoot!,style=(selector:string)=>getComputedStyle(root.querySelector(selector)!);
  return {background:style('.header').backgroundColor,shadow:style('.header').boxShadow,arrow:style('ha-icon-button-arrow-prev').visibility,title:style('.main-title').visibility,actions:style('.action-items').visibility};
});

test('on an MP Glass subview the Home Assistant bar lets the backdrop through and keeps only its actions',async({page})=>{
  await subview(page);
  const actions=await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelector('.action-items')!.getBoundingClientRect().right);
  expect(await bar(page)).toEqual({background:'rgba(0, 0, 0, 0)',shadow:'none',arrow:'hidden',title:'hidden',actions:'visible'});
  // The hidden title keeps its place: the actions stay on the right.
  expect(actions).toBeGreaterThan(page.viewportSize()!.width-40);
  await page.evaluate(()=>document.querySelector('hui-root')!.toggleAttribute('scrolled',true));
  expect((await bar(page)).shadow).toBe('none');
});

test('edit mode and the views of other dashboards keep the Home Assistant bar',async({page})=>{
  await subview(page);
  await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelector('div')!.classList.add('edit-mode'));
  expect(await bar(page)).toMatchObject({background:'rgb(69, 90, 100)',arrow:'visible',title:'visible'});
  await page.evaluate(()=>{
    const root=document.querySelector('hui-root')!.shadowRoot!;
    root.querySelector('div')!.classList.remove('edit-mode');
    // hui-root swaps views by removing the one on screen before adding the next.
    root.querySelector('hui-view')!.replaceChildren(document.createElement('div'));
  });
  expect(await bar(page)).toMatchObject({background:'rgb(28, 28, 28)',arrow:'visible',title:'visible'});
  await page.evaluate(()=>{
    const hui=document.querySelector('hui-root')!.shadowRoot!.querySelector('hui-view')!;
    hui.replaceChildren(document.createElement('mp-glass-view-v4'));
  });
  expect((await bar(page)).background).toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(()=>document.querySelector('hui-root')!.shadowRoot!.querySelectorAll('style[data-mp-glass-header]').length)).toBe(1);
});
