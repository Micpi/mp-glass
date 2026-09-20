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
  await expect(window_.locator('.hero strong')).toHaveText('Éteinte');
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
  await window_.getByRole('button', { name: 'Réglages Home Assistant' }).click();
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
  await expect(window_.locator('.hero strong')).toHaveText('Fermé');
  expect(await calls(page)).toEqual([{ domain: 'cover', service: 'close_cover', data: { entity_id: 'cover.cuisine_store' } }]);
});

test('the bar sets the brightness where it is released, and the keyboard moves it step by step', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('mp-glass-light-v4').filter({ hasText: 'Salon · Suspension' });
  await card.getByRole('button', { name: 'Détails', exact: true }).click();
  const bar = page.getByRole('dialog').getByRole('slider', { name: 'Luminosité' });
  const box = (await bar.boundingBox())!;
  // Released a quarter down from the top of the bar: about three quarters of the brightness, and that exact value commanded.
  await bar.click({ position: { x: box.width / 2, y: box.height * .25 } });
  const value = Number(await bar.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(70);
  expect(value).toBeLessThan(80);
  await bar.press('ArrowUp');
  expect(await calls(page)).toEqual([
    { domain: 'light', service: 'turn_on', data: { entity_id: 'light.circuit_0', brightness_pct: value } },
    { domain: 'light', service: 'turn_on', data: { entity_id: 'light.circuit_0', brightness_pct: value + 1 } },
  ]);
  // Taken all the way down, the light is switched off rather than left on at nothing.
  await bar.press('Home');
  expect(await calls(page)).toHaveLength(3);
  expect(await calls(page)).toContainEqual({ domain: 'light', service: 'turn_off', data: { entity_id: 'light.circuit_0' } });
});

test('the dial turns the setpoint of a thermostat', async ({ page }) => {
  await page.goto('/?spatial');
  await page.locator('.strip .chip').filter({ hasText: 'Chambre' }).click();
  await page.getByRole('button', { name: 'Détails Radiateur' }).click();
  const dial = page.getByRole('dialog').getByRole('slider', { name: 'Consigne' });
  await expect(dial).toHaveAttribute('aria-valuenow', '20');
  await dial.press('ArrowUp');
  await dial.press('ArrowUp');
  expect(await calls(page)).toEqual([
    { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.chambre', temperature: 20.5 } },
    { domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.chambre', temperature: 21 } },
  ]);
});

test('the history is drawn from what the recorder kept, over the period asked', async ({ page }) => {
  await page.goto('/?spatial');
  await page.locator('.strip .chip').filter({ hasText: 'Salon' }).click();
  await page.getByRole('button', { name: 'Détails Température' }).click();
  const window_ = page.getByRole('dialog');
  // A reading over time: a curve, with the highest and the lowest of the period beside it.
  await expect(window_.locator('path.curve')).toBeVisible();
  await expect(window_.locator('.bounds')).toBeVisible();
  const asked = await page.evaluate(() => (window as unknown as { demo: { history: Record<string, unknown>[] } }).demo.history);
  expect(asked.at(-1)).toMatchObject({ type: 'history/history_during_period', entity_ids: ['sensor.salon_temperature'] });
  await window_.getByRole('button', { name: '7 j' }).click();
  await expect(window_.locator('path.curve')).toBeVisible();
  const week = await page.evaluate(() => (window as unknown as { demo: { history: Record<string, string>[] } }).demo.history.at(-1)!);
  expect(Date.parse(String(week.end_time)) - Date.parse(String(week.start_time))).toBeCloseTo(7 * 24 * 3600 * 1000, -4);
});

test('a light without a recorder says so, and its window still commands it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const demo = (window as unknown as { demo: { hass: import('../../frontend/ha/client').Hass; cards: { hass: import('../../frontend/ha/client').Hass }[] } }).demo;
    demo.hass.callWS = async () => { throw new Error('unknown_command'); };
    for (const card of demo.cards) card.hass = { ...demo.hass };
  });
  const card = page.locator('mp-glass-light-v4').filter({ hasText: 'Circuit 1' });
  await card.getByRole('button', { name: 'Détails', exact: true }).click();
  const window_ = page.getByRole('dialog');
  await expect(window_.getByText('Historique indisponible')).toBeVisible();
  await expect(window_.getByRole('button', { name: 'Allumer' })).toBeEnabled();
});
