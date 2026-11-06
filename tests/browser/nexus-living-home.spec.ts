import { test, expect } from '@playwright/test';

test('the room request opens the matching plan and reports observed information', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: 'Rechercher', exact: true }).click();
  const search = nexus.locator('.modal.search');
  await search.getByRole('searchbox').fill('Montre-moi ce qui se passe dans le salon');
  await search.getByRole('searchbox').press('Enter');
  await expect(search.locator('.answer')).toContainText('Salon');
  await expect(nexus.locator('.full')).toBeVisible();
  await search.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(nexus.locator('.full')).toBeVisible();
});

test('plan replay uses recorded states and prevents commands until returning live', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate((element: HTMLElement & { hass: import('../../frontend/ha/client').Hass }) => {
    const original = element.hass, callWS = original.callWS.bind(original);
    element.hass = { ...original, callWS: async <T>(message: Record<string, unknown>): Promise<T> => {
      if (message.type !== 'history/history_during_period') return callWS<T>(message);
      const ids = message.entity_ids as string[];
      return Object.fromEntries(ids.map(id => [id, [{ state: 'off', last_updated: message.start_time, attributes: {} }]])) as T;
    } };
  });
  await nexus.getByRole('button', { name: 'Plan en plein écran', exact: true }).click();
  const full = nexus.locator('.full');
  await full.getByRole('button', { name: 'Revoir les dernières 24 h' }).click();
  await expect(full.getByText('Lecture seule · seuls les états enregistrés sont affichés.')).toBeVisible();
  await expect(full.locator('.fplan')).toHaveAttribute('inert', '');
  await expect(full.getByRole('slider', { name: 'Moment affiché' })).toBeVisible();
  await full.getByRole('button', { name: 'Retour au direct' }).click();
  await expect(full.locator('.fplan')).not.toHaveAttribute('inert', '');
});
