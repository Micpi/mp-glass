import { expect, test } from '@playwright/test';

test('la page de connexion met en valeur ICM sans afficher d’autre mention de propriété', async ({ page }) => {
  await page.route('**/__mpnexus/api/csrf', route => route.fulfill({ json: { token: 'test-token' } }));
  await page.route('**/__mpnexus/api/me', route => route.fulfill({ status: 401, json: { error: 'Non connecté' } }));

  const logoResponse = page.waitForResponse('**/assets/access-icm-logo.png');
  await page.goto('/desktop/access.html');

  await expect(page.getByRole('heading', { name: 'Bienvenue dans MP Nexus.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByText('Intégration & déploiement par ICM')).toBeVisible();
  await expect(page.getByText('Integrated Components for Media · Votre interface de contrôle.')).toBeVisible();
  await expect(page.getByText(/MP Programming/)).toHaveCount(0);
  await expect(page.getByLabel('Nom d’utilisateur')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();

  const response = await logoResponse;
  expect(response.status()).toBe(200);
  expect(await page.locator('.login-credit img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/login-icm.png', fullPage: true });
});
