import { test, expect } from '@playwright/test';

for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
  test(`appearance follows every v2 page on ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { if (!localStorage.getItem('mp-nexus.appearance')) localStorage.setItem('mp-nexus.appearance', JSON.stringify({ accent: '#ff9f6e', glassTint: '#432342', radius: 36, glassOpacity: .85, motion: false })); });
    for (const path of ['home', 'lights', 'rooms', 'media', 'plus', 'info']) {
      await page.goto(`/${path}?v2`);
      const view = page.locator('mp-nexus-view-v2');
      await expect(view).toBeVisible();
      await expect(view).toHaveCSS('--mp-accent', '#ff9f6e');
      await expect(view).toHaveCSS('--mp-tint', '#432342');
      await expect(view).not.toHaveAttribute('motion');
      const button = view.locator('button:enabled:visible, a:visible').first();
      await page.keyboard.press('Tab');
      // The plan can finish rendering after the page appears and replace its room buttons.
      await expect.poll(async () => {
        await button.focus();
        return button.evaluate(e => getComputedStyle(e).outlineColor);
      }).toBe('rgb(255, 159, 110)');
      const bounds = await view.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.goto('/plus?v2');
    await page.locator('mp-nexus-view-v2').locator('button.rw', { hasText: 'Apparence' }).click();
    await page.screenshot({ path: testInfo.outputPath('appearance.png') });
    const input = page.getByLabel('Autre couleur');
    await input.fill('#173177');
    const view = page.locator('mp-nexus-view-v2');
    await expect(view).toHaveCSS('--mp-on-accent', '#ffffff');
    await page.reload();
    await expect(view).toHaveCSS('--mp-accent', '#173177');
  });
}

test('standalone card and its detail window share the material and border settings', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('mp-glass-light-v4').first();
  await card.evaluate((element: HTMLElement & { setConfig: (config: unknown) => void }) => element.setConfig({ type: 'custom:mp-glass-light-v4', entity: 'light.circuit_0', appearance: { preset: 'glass-blue', accent: '#4fd1c5', glassTint: '#432342', glassOpacity: .8, borderStrength: .6, radius: 36, glassBlur: 8 } }));
  await card.getByRole('button', { name: 'Détails', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('--mp-accent', '#4fd1c5');
  await expect(dialog).toHaveCSS('--mp-border', '0.6');
  await expect(dialog).toHaveCSS('backdrop-filter', 'blur(8px)');
  const before = await dialog.evaluate(e => getComputedStyle(e).borderTopColor);
  await card.evaluate((e: HTMLElement) => e.style.setProperty('--mp-border', '.05'));
  expect(await dialog.evaluate(e => getComputedStyle(e).borderTopColor)).not.toBe(before);
});
