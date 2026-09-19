import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

async function user(page: Page, admin?: boolean) {
  await page.evaluate(admin => {
    const view = document.querySelector('mp-glass-view-v4') as HTMLElement & { hass: { user?: { id: string; is_admin: boolean }; config?: { version: string } } };
    view.hass = { ...view.hass, user: admin === undefined ? undefined : { id: 'test', is_admin: admin }, config: { version: '2026.9.1' } };
  }, admin);
}

test('Info opens within the dashboard, shows versions, and reserves Customize for admins', async ({ page }) => {
  await page.goto('/dashboard-maison/home');
  const info = page.getByRole('link', { name: 'Info', exact: true });
  await expect(info).toHaveAttribute('href', '/dashboard-maison/info');
  await expect(page.getByRole('link', { name: 'Personnaliser', exact: true })).toHaveCount(0);
  await info.click();
  await expect(page.getByRole('heading', { name: 'Info', exact: true })).toBeVisible();
  await expect(info).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('dl > div').filter({ hasText: 'Version de l’intégration MP Nexus' }).locator('dd')).toHaveText(version);
  await user(page, true);
  await expect(page.locator('dl > div').filter({ hasText: 'Home Assistant' }).locator('dd')).toHaveText('2026.9.1');
  const customize = page.getByRole('link', { name: 'Personnaliser', exact: true });
  await expect(customize).toHaveAttribute('href', '/mp-glass-settings');
  await user(page, false);
  await expect(customize).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Versions', exact: true })).toBeVisible();
  await user(page);
  await expect(customize).toHaveCount(0);
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard-maison\/home$/);
  await expect(page.locator('mp-glass-light-v4')).toHaveCount(3);
});

test('Info reports an unavailable installed version honestly and flags a stale interface', async ({ page }) => {
  await page.goto('/info');
  const setVersion = (installed?: string) => page.evaluate(installed => {
    const view = document.querySelector('mp-glass-view-v4') as HTMLElement & { setConfig(config: unknown): void };
    view.setConfig({ mp_view_kind: 'info', mp_info: { version: installed, deviceCount: 3, lightCount: 3, areaCount: 1 } });
  }, installed);
  await setVersion();
  await expect(page.locator('dl > div').filter({ hasText: 'Version de l’intégration MP Nexus' }).locator('dd')).toHaveText('Indisponible');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await setVersion('99.0.0');
  await expect(page.getByRole('alert')).toContainText(`MP Nexus 99.0.0 est installé, mais cette page affiche encore la version ${version}`);
  await expect(page.getByRole('button', { name: 'Recharger la page' })).toBeVisible();
});

test('Info remains readable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/info');
  await expect(page.getByRole('link', { name: 'Info', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Personnaliser', exact: true })).toBeVisible();
  expect(await page.locator('main').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
