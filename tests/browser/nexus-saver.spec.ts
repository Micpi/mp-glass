import { test, expect, type Page } from '@playwright/test';

/** Weather, a timer, music, an alert and someone at home: every widget the screensaver can show. */
async function busyHouse(page: Page) {
  await page.locator('mp-nexus-view-v2').evaluate((view: HTMLElement & { hass: { states: Record<string, unknown> }; media?: string[] }) => {
    const now = Date.now();
    view.media = [...(view.media ?? []), 'media_player.tv'];
    view.hass = { ...view.hass, states: { ...view.hass.states,
      'weather.home': { entity_id: 'weather.home', state: 'rainy', attributes: { friendly_name: 'Maison', temperature: 14.2, temperature_unit: '°C' } },
      'timer.cuisine': { entity_id: 'timer.cuisine', state: 'active', attributes: { friendly_name: 'Cuisine', finishes_at: new Date(now + 754000).toISOString() } },
      'person.mickael': { entity_id: 'person.mickael', state: 'home', attributes: { friendly_name: 'Mickael' } },
      'binary_sensor.fumee': { entity_id: 'binary_sensor.fumee', state: 'on', attributes: { friendly_name: 'Détecteur de fumée', device_class: 'smoke' } },
      'media_player.tv': { entity_id: 'media_player.tv', state: 'playing', attributes: { friendly_name: 'TV', media_title: 'Studio' } } } };
  });
}
const box = (page: Page, selector: string) => page.locator('mp-nexus-view-v2').locator(selector).first().evaluate(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; });

for (const [name, size] of [['computer', { width: 1440, height: 900 }], ['landscape tablet', { width: 1180, height: 820 }], ['upright tablet', { width: 820, height: 1180 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`the screensaver lays out every widget beside the plan on a ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/plus?v2');
    const nexus = page.locator('mp-nexus-view-v2');
    await expect(nexus).toBeVisible();
    await busyHouse(page);
    await nexus.locator('button.rw', { hasText: 'Écran de veille' }).click();
    await nexus.locator('.layers button', { hasText: 'Plan 3D' }).click();
    for (const label of ['Minuteur', 'Qui est là', 'Météo', 'Musique', 'Alertes']) {
      const pill = nexus.locator('.pill', { hasText: label });
      if (await pill.getAttribute('aria-pressed') === 'false') await pill.click();
    }
    await nexus.getByRole('button', { name: 'Aperçu' }).click();
    const widgets = nexus.locator('.saver .sw');
    await expect(widgets).toHaveCount(5);
    // A style of another panel once shrank these to round 34 px buttons, stacked over each other.
    for (const widget of await widgets.all()) {
      const r = await widget.evaluate(e => e.getBoundingClientRect());
      expect(r.width).toBeGreaterThan(150);
      expect(r.height).toBeGreaterThan(40);
    }
    const [clock, plan, last] = [await box(page, '.saver .sclock'), await box(page, '.saver .splan'), await box(page, '.saver .sw:last-of-type')];
    const beside = clock.right <= plan.left + 1, below = Math.max(clock.bottom, last.bottom) <= plan.top + 1;
    expect(beside || below).toBe(true);
  });
}

test('the slideshow brings the next photo in with the transition chosen', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.addInitScript(() => localStorage.setItem('mp-nexus.screensaver', JSON.stringify({ content: 'photos', transition: 'circle', photoSeconds: 8 })));
  await page.clock.install();
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.locator('button.rw', { hasText: 'Écran de veille' }).click();
  await expect(nexus.locator('select[aria-label="Transition"]')).toHaveValue('circle');
  await nexus.getByRole('button', { name: 'Aperçu' }).click();
  await expect(nexus.locator('.saver .pic')).toHaveCount(1);
  const first = await nexus.locator('.saver .pic .backdrop').first().getAttribute('style');
  await page.clock.runFor(9000);
  await expect(nexus.locator('.saver .pic')).toHaveCount(2);
  await expect(nexus.locator('.saver .pic.in.circle')).toHaveCount(1);
  expect(await nexus.locator('.saver .pic.in .backdrop').getAttribute('style')).not.toBe(first);
});

test('the plan of the screensaver turns and shows its layers in turn', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('mp-nexus.screensaver', JSON.stringify({ content: 'plan', spin: 'fast', cycleLayers: true, layerSeconds: 10 })));
  await page.goto('/plus?v2&spatial');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.locator('button.rw', { hasText: 'Écran de veille' }).click();
  await nexus.getByRole('button', { name: 'Aperçu' }).click();
  const viewer = nexus.locator('.saver mp-spatial-viewer');
  await expect(viewer).toHaveJSProperty('spin', 12);
  const chip = nexus.locator('.saver .slayer');
  await expect(chip).toBeVisible({ timeout: 10_000 });
  const before = await chip.textContent();
  const camera = () => viewer.evaluate((v: HTMLElement & { scene?: { view(): { offset: number[] } } }) => v.scene?.view().offset);
  await expect.poll(camera, { timeout: 10_000 }).toBeTruthy();
  const start = await camera();
  await page.waitForTimeout(800);
  expect(await camera()).not.toEqual(start);
  await expect.poll(() => chip.textContent(), { timeout: 15_000 }).not.toBe(before);
});
