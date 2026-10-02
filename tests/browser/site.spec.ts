import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const demoCalls = (page: Page) => page.evaluate(() => (window as unknown as { demo: { calls: { domain: string; service: string; data: Record<string, unknown> }[] } }).demo.calls);

test('the site plan of a domain is shown in 3D, by category, and flies to a house before opening its inside', async ({ page }) => {
  await page.goto('/?site');
  const site = page.locator('mp-site-viewer');
  await expect(site.locator('canvas')).toBeVisible();
  await expect(site.locator('.card h3')).toHaveText('Vue d’ensemble');
  await expect(site.locator('.modes button')).toHaveText(['Vue d’ensemble', 'Éclairage extérieur', 'Arrosage', 'Accès et caméras']);
  // The sprinklers watering stop together.
  await site.locator('[data-category=irrigation]').click();
  await expect(site.locator('.legend')).toHaveText(/Arrosage en cours\s*À l’arrêt/);
  await site.locator('.stat', { hasText: 'Zones en arrosage' }).getByRole('button', { name: 'Tout arrêter' }).click();
  await expect(site.locator('.stat', { hasText: 'Zones en arrosage' })).toContainText('0/6');
  expect((await demoCalls(page)).filter(c => c.domain === 'valve').every(c => c.service === 'close_valve')).toBe(true);
  // A house chosen: its garden, its outdoor lights, and its inside one tap away.
  await expect(site.locator('.labels button[data-house=bastide]')).toBeVisible({ timeout: 15000 });
  await site.locator('.labels button[data-house=bastide]').click();
  await expect(site.locator('.card h3')).toHaveText('Bastide');
  await expect(site.locator('.stat', { hasText: 'Éclairage extérieur' })).toContainText('/3');
  await site.getByRole('button', { name: 'Voir l’intérieur' }).click();
  await expect(page.locator('mp-spatial-viewer')).toBeVisible();
  await expect(page.locator('mp-glass-view-v4 nav.houses button[aria-pressed=true]')).toHaveText(/Bastide/);
});

test('the multi-property mode stays off in the Studio until it is turned on, and stays on while the domain has houses', async ({ page }) => {
  await page.goto('/?spatial&studio');
  const editor = page.locator('mp-spatial-editor'), mode = editor.getByRole('checkbox', { name: /Mode multi-propriété/ });
  await expect(mode).not.toBeChecked();
  await expect(editor.getByText('Maisons du domaine')).toHaveCount(0);
  await mode.check();
  await expect(editor.getByText('Maisons du domaine')).toBeVisible();
  await expect(editor.getByText('Plan de masse du domaine')).toBeVisible();
  await page.goto('/?site&studio');
  await expect(mode).toBeChecked();
  await expect(mode).toBeDisabled();
  // Equipment placed on the site plan, tied to its entity.
  await editor.locator('.equipment-list').getByRole('button', { name: 'Portail est', exact: true }).click();
  await expect(editor.getByLabel('Entité Home Assistant')).toHaveValue('cover.portail_est');
});
