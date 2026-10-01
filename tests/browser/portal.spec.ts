import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const html = readFileSync('desktop/access.html', 'utf8').replace('./access.ts', '/desktop/access.ts');
const user = { id: 'demo-user', username: 'visitor', role: 'user', mustChangePassword: false };

async function portal(page: Page, role = 'user', meStatus = 200) {
  let authenticated = role === 'admin';
  await page.route('**/__mpnexus/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/__mpnexus/api/csrf') return route.fulfill({ json: { token: 'test-csrf' } });
    if (path === '/__mpnexus/api/login') {
      authenticated = true;
      return route.fulfill({ json: { returnUrl: '/__mpnexus/' } });
    }
    if (path === '/__mpnexus/api/logout') {
      authenticated = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (path === '/__mpnexus/api/me') {
      const status = meStatus !== 200 ? meStatus : authenticated ? 200 : 401;
      return route.fulfill({ status, json: status === 200 ? { user: { ...user, role }, version: 'test' } : {} });
    }
    if (path === '/__mpnexus/api/admin/analytics') {
      return route.fulfill({ json: { accountCount: 1, activeUsers7Days: 0, sessions7Days: 0, planOpens7Days: 0, users: [], days: [] } });
    }
    return route.fulfill({ contentType: 'text/html', body: html });
  });
}

test('successful login displays all demo choices and allows logout', async ({ page }) => {
  await portal(page);
  await page.goto('/__mpnexus/login');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('visitor');
  await page.getByLabel('Mot de passe', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre univers.' })).toBeVisible();
  for (const title of ['Résidentiel', 'Bureau / magasin', 'Yacht']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Quitter' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});

test('authenticated admin reaches user management', async ({ page }) => {
  await portal(page, 'admin');
  await page.goto('/__mpnexus/admin/users');
  await expect(page.getByRole('heading', { name: 'Gestion des utilisateurs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer le compte' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();
});

test('server failure is reported without silently showing the login form', async ({ page }) => {
  await portal(page, 'user', 500);
  await page.goto('/__mpnexus/');
  await expect(page.getByRole('alert')).toContainText('Impossible de charger votre espace');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toHaveCount(0);
});
