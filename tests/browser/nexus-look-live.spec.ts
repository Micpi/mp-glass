import { test, expect } from '@playwright/test';

test('a look chosen in Personnaliser reaches the other pages at once, and the save button reloads with it', async ({ page }) => {
  await page.goto('/plus?v2&spatial');
  const nexus = page.locator('mp-nexus-view-v2').first();
  await expect(nexus).toBeVisible();
  // Home Assistant keeps the home page alive aside while Plus is shown.
  await page.evaluate(() => {
    const view = document.querySelector('mp-nexus-view-v2') as HTMLElement & { hass: unknown };
    const home = document.createElement('mp-nexus-view-v2') as HTMLElement & { hass: unknown; setConfig: (c: object) => void };
    home.id = 'home'; home.style.display = 'none';
    home.setConfig({ mp_view_kind: 'home', mp_view_path: 'home' }); home.hass = view.hass;
    document.body.append(home);
  });
  await nexus.getByRole('button', { name: /^Personnaliser/ }).click();
  await nexus.locator('button.pal', { hasText: 'Néon' }).click();
  await expect.poll(() => page.evaluate(() => (document.getElementById('home') as unknown as { appearance: { planColors?: { room?: string } } }).appearance.planColors?.room)).toBe('#3a5bff');
  await nexus.getByRole('button', { name: 'Enregistrer et recharger' }).click();
  await page.waitForLoadState('load');
  await expect(page.locator('mp-nexus-view-v2').first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mp-nexus.appearance') ?? '{}').planColors?.room)).toBe('#3a5bff');
});
