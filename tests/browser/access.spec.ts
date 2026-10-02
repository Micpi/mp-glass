import { expect, test } from '@playwright/test';

async function choosePortalLanguage(page: import('@playwright/test').Page, name: string) {
  await page.locator('[data-portal-language-toggle]').click();
  await page.getByRole('menuitemradio', { name }).click();
}

test('la page de connexion met en valeur ICM sans afficher d’autre mention de propriété', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mpnexus.demo.language', 'fr'));
  await page.route('**/__mpnexus/api/csrf', route => route.fulfill({ json: { token: 'test-token' } }));
  await page.route('**/__mpnexus/api/me', route => route.fulfill({ status: 401, json: { error: 'Non connecté' } }));
  await page.route('**/__mpnexus/api/login', route => route.fulfill({ status: 401, json: { error: 'Nom d’utilisateur ou mot de passe incorrect.' } }));

  const logoResponse = page.waitForResponse('**/assets/access-icm-logo.png');
  await page.goto('/desktop/access.html');

  await expect(page.getByRole('heading', { name: 'Bienvenue dans MP Nexus.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByText('Intégration & déploiement par ICM')).toBeVisible();
  await expect(page.getByText('Integrated Components for Media · Votre interface de contrôle.')).toBeVisible();
  await expect(page.getByText(/MP Programming/)).toHaveCount(0);
  await expect(page.getByLabel('Nom d’utilisateur')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();
  await expect(page.locator('[data-portal-language-toggle] .portal-flag svg')).toHaveCount(1);
  await page.locator('[data-portal-language-toggle]').click();
  await expect(page.getByRole('menu', { name: 'Langue' }).getByRole('menuitemradio')).toHaveCount(5);
  await expect(page.getByRole('menu', { name: 'Langue' }).locator('.portal-flag svg')).toHaveCount(5);
  await page.locator('[data-portal-language-toggle]').click();

  const response = await logoResponse;
  expect(response.status()).toBe(200);
  expect(await page.locator('.login-credit img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/login-icm.png', fullPage: true });

  await choosePortalLanguage(page, 'Deutsch');
  await expect(page.getByRole('heading', { name: 'Willkommen bei MP Nexus.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText('Integration und Bereitstellung durch ICM')).toBeVisible();
  await page.getByLabel('Benutzername').fill('demo');
  await page.getByLabel('Passwort').fill('wrong-password');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('Benutzername oder Passwort ist falsch.')).toBeVisible();
  await choosePortalLanguage(page, 'Italiano');
  await expect(page.getByRole('heading', { name: 'Benvenuto in MP Nexus.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accesso' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await page.getByLabel('Nome utente').fill('demo');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Nome utente o password non corretti.')).toBeVisible();
});

test('la sélection de démo est disponible en allemand et en italien', async ({ page }) => {
  await page.route('**/__mpnexus/api/csrf', route => route.fulfill({ json: { token: 'test-token' } }));
  await page.route('**/__mpnexus/api/me', route => route.fulfill({ json: {
    user: { id: 'demo-user', username: 'Demo', role: 'user', createdAt: '', lastLoginAt: null, mustChangePassword: false },
    version: 'test',
  } }));
  await page.goto('/desktop/access.html');

  await choosePortalLanguage(page, 'Deutsch');
  await expect(page.getByRole('heading', { name: 'Wählen Sie Ihre Umgebung.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wohnen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Büro / Geschäft' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yacht' })).toBeVisible();

  await choosePortalLanguage(page, 'Italiano');
  await expect(page.getByRole('heading', { name: 'Scegli il tuo ambiente.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Residenziale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ufficio / negozio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yacht' })).toBeVisible();
});
