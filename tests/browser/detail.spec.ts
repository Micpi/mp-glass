import { test, expect, type Page } from '@playwright/test';

/** Home Assistant more-info requests that reached the page, as its own dialog would receive them. */
const nativeRequests = (page: Page) => page.evaluate(() => (window as unknown as { native: unknown[] }).native);
const watchNative = (page: Page) => page.evaluate(() => {
  Object.assign(window, { native: [] });
  document.addEventListener('hass-more-info', event => (window as unknown as { native: unknown[] }).native.push((event as CustomEvent).detail));
});
const calls = (page: Page) => page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls);

test('the card opens the MP Nexus window, and commands the light from it', async ({ page }) => {
  await page.goto('/');
  await watchNative(page);
  const card = page.locator('mp-glass-light-v4').filter({ hasText: 'Salon · Suspension' });
  await card.getByRole('button', { name: 'Détails', exact: true }).click();
  const window_ = page.getByRole('dialog');
  await expect(window_.getByRole('heading', { name: 'Salon · Suspension' })).toBeVisible();
  await expect(window_.getByText('Éteinte')).toBeVisible();
  // The Home Assistant dialog is not asked for: the window replaces it.
  expect(await nativeRequests(page)).toEqual([]);
  await window_.getByRole('button', { name: 'Allumer' }).click();
  await expect(window_.getByRole('button', { name: 'Éteindre' })).toBeVisible();
  await window_.getByRole('button', { name: 'Rouge' }).click();
  expect(await calls(page)).toEqual([
    { domain: 'light', service: 'turn_on', data: { entity_id: 'light.circuit_0' } },
    { domain: 'light', service: 'turn_on', data: { entity_id: 'light.circuit_0', rgb_color: [255, 72, 72] } },
  ]);
  // Home Assistant keeps its history and its settings, one touch away and never intercepted.
  await window_.getByRole('button', { name: 'Historique et réglages Home Assistant' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await nativeRequests(page)).toEqual([{ entityId: 'light.circuit_0', mpNative: true }]);
});

test('a light without brightness offers only its switch; Escape closes the window', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('mp-glass-light-v4').filter({ hasText: 'Circuit 1' });
  await card.getByRole('button', { name: 'Détails', exact: true }).click();
  const window_ = page.getByRole('dialog');
  await expect(window_.getByRole('heading', { name: 'Circuit 1' })).toBeVisible();
  await expect(window_.getByRole('slider')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a card of Home Assistant asking for its dialog is answered by the window', async ({ page }) => {
  await page.goto('/');
  await watchNative(page);
  await page.evaluate(() => {
    const view = document.querySelector('mp-glass-view-v4')!;
    view.shadowRoot!.querySelector('.badges')!.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: 'light.circuit_2' }, bubbles: true, composed: true }));
  });
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Circuit 2' })).toBeVisible();
  expect(await nativeRequests(page)).toEqual([]);
});

test('the plan opens the window of a device, with the commands that device declares', async ({ page }) => {
  await page.goto('/?spatial');
  await page.locator('.strip .chip').filter({ hasText: 'Chambre' }).click();
  await page.getByRole('button', { name: 'Détails Radiateur' }).click();
  const window_ = page.getByRole('dialog');
  await expect(window_.getByRole('heading', { name: 'Chambre · Radiateur' })).toBeVisible();
  await expect(window_.getByText('mesurée 19,5 ° · consigne 20 °')).toBeVisible();
  await window_.getByRole('button', { name: 'Monter la consigne' }).click();
  await window_.getByRole('button', { name: 'Arrêt' }).click();
  expect(await calls(page)).toEqual([
    { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.chambre', temperature: 20.5 } },
    { domain: 'climate', service: 'set_hvac_mode', data: { entity_id: 'climate.chambre', hvac_mode: 'off' } },
  ]);
  await window_.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The room card is still there, behind: the window never took the page away.
  await expect(page.getByRole('heading', { name: 'Chambre' })).toBeVisible();
});

test('a shutter is opened, stopped and closed from its window', async ({ page }) => {
  await page.goto('/?spatial');
  await page.locator('.strip .chip').filter({ hasText: 'Cuisine' }).click();
  await page.getByRole('button', { name: 'Détails Fenêtre' }).click();
  const window_ = page.getByRole('dialog');
  await expect(window_.getByRole('heading', { name: 'Cuisine · Store' })).toBeVisible();
  await window_.getByRole('button', { name: 'Fermer le volet' }).click();
  await expect(window_.getByText('Fermé', { exact: true })).toBeVisible();
  expect(await calls(page)).toEqual([{ domain: 'cover', service: 'close_cover', data: { entity_id: 'cover.cuisine_store' } }]);
});
