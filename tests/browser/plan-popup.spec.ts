import { test, expect, type Locator } from '@playwright/test';

const material = (popup: Locator) => popup.evaluate(e => {
  const s = getComputedStyle(e);
  return { background: s.backgroundImage, border: s.borderTopColor, radius: s.borderTopLeftRadius, blur: s.backdropFilter, width: e.getBoundingClientRect().width };
});

for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1440, height: 900 }]] as const) {
  test(`the room icon opens a themed viewport panel like Search on ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('mp-nexus.appearance', JSON.stringify({ accent: '#ff9f6e', glassTint: '#432342', glassBlur: 12, radius: 30 })));
    await page.goto('/?spatial&v2');
    const nexus = page.locator('mp-nexus-view-v2');
    await nexus.getByRole('button', { name: 'Rechercher', exact: true }).click();
    const search = nexus.locator('.modal.search');
    await expect(search).toBeVisible();
    const expected = await material(search);
    await search.getByRole('button', { name: 'Fermer', exact: true }).click();
    const viewer = nexus.locator('mp-spatial-viewer').first();
    const trigger = viewer.getByRole('button', { name: /^Lumières · Salon ·/ });
    await trigger.click();
    const popup = viewer.getByRole('dialog', { name: 'Informations de Lumières', exact: true });
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute('open', '');
    expect(await material(popup)).toEqual(expected);
    await expect(popup.getByRole('heading', { name: 'Lumières', exact: true })).toBeVisible();
    await expect(popup.locator('.ambient-item')).toHaveCount(1);
    const bounds = (await popup.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: testInfo.outputPath('room-equipment-popup.png') });
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(4, 4);
    await expect(popup).toHaveCount(0);
  });
}

test('device commands return to the room equipment panel and Escape keeps the full plan open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: 'Plan en plein écran', exact: true }).click();
  const full = nexus.locator('.full');
  const viewer = full.locator('mp-spatial-viewer');
  await viewer.getByRole('button', { name: /^Lumières · Salon ·/ }).click();
  const popup = viewer.locator('dialog.equipment-popup');
  await popup.locator('.ambient-item').first().click();
  const details = viewer.locator('mp-glass-detail').getByRole('dialog');
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Allumer', exact: true }).click();
  await expect(details.getByRole('button', { name: 'Éteindre', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).toHaveCount(0);
  await expect(full).toBeVisible();
  await expect(popup).toBeVisible();
  await expect(popup.locator('.ambient-summary')).toContainText('1 sur 1');
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(full).toBeVisible();
});

test('a long equipment list scrolls inside the panel and keeps its close button reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?spatial&v2');
  const viewer = page.locator('mp-nexus-view-v2 mp-spatial-viewer').first();
  await viewer.evaluate((element: HTMLElement & { plan: import('../../shared/spatial').SpatialPlan; hass: import('../../frontend/ha/client').Hass }) => {
    const plan = structuredClone(element.plan), room = plan.floors[0]!.rooms.find(r => r.id === 'living')!, states = { ...element.hass.states };
    for (let i = 1; i <= 20; i++) {
      const id = `light.popup_${i}`;
      room.entityIds = [...(room.entityIds ?? []), id];
      states[id] = { entity_id: id, state: 'off', attributes: { friendly_name: `Salon · Lampe ${i}`, supported_color_modes: ['onoff'] } };
    }
    element.plan = plan; element.hass = { ...element.hass, states };
  });
  await viewer.getByRole('button', { name: /^Lumières · Salon ·/ }).click();
  const popup = viewer.locator('dialog.equipment-popup');
  await expect(popup.locator('.ambient-item')).toHaveCount(21);
  await popup.getByRole('searchbox', { name: 'Rechercher un équipement' }).fill('Lampe 20');
  await expect(popup.locator('.ambient-item')).toHaveCount(1);
  await popup.getByRole('searchbox').fill('');
  const body = popup.locator('.equipment-body');
  expect(await body.evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await body.evaluate(e => { e.scrollTop = e.scrollHeight; });
  await expect(popup.getByRole('button', { name: 'Fermer', exact: true })).toBeInViewport();
  await popup.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(popup).toHaveCount(0);
});

test('the climate popup keeps the equipment state colours inside the shared glass style', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('group', { name: 'Ambiance du plan', exact: true }).getByRole('button', { name: 'Climat', exact: true }).click();
  const viewer = nexus.locator('mp-spatial-viewer').first();
  await viewer.getByRole('button', { name: /^Climat · Cuisine ·/ }).click();
  const popup = viewer.locator('dialog.equipment-popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('header .equipment-hvac-icon')).toHaveCSS('color', 'rgb(124, 232, 255)');
  await expect(popup.locator('.ambient-item .equipment-hvac-icon')).toHaveCSS('color', 'rgb(124, 232, 255)');
});
