import { test, expect } from '@playwright/test';

test('v2 turns music on in one touch and connects Spotify then Deezer from MP Nexus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2&music');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: 'Salon · Sonos Arc' }).click();
  await nexus.getByRole('tab').nth(1).click();
  await nexus.getByRole('button', { name: 'Activer la musique' }).click();
  await expect(nexus.getByText('Préparation de la musique')).toBeVisible();
  await expect(nexus.getByText('Touchez votre service : la connexion se fait sur sa propre page.')).toBeVisible({ timeout: 15_000 });
  await nexus.locator('.svc-grid').getByRole('button', { name: /Spotify/ }).click();
  const signIn = nexus.getByRole('link', { name: 'Se connecter avec Spotify' });
  await expect(signIn).toHaveAttribute('href', /accounts\.spotify\.com/);
  await expect(signIn).toHaveAttribute('target', '_blank');
  await expect(nexus.getByText('Spotify est connecté')).toBeVisible({ timeout: 15_000 });
  await nexus.getByRole('button', { name: 'Ajouter un autre service' }).click();
  await nexus.locator('.svc-grid').getByRole('button', { name: /Deezer/ }).click();
  await expect(nexus.getByText('Ouvrez deezer.com sur un ordinateur et connectez-vous.')).toBeVisible();
  await nexus.locator('.flow-form input[type=password]').fill('demo-arl');
  await nexus.getByRole('button', { name: 'Connecter Deezer' }).click();
  await nexus.getByRole('button', { name: 'Commencer à écouter' }).click();
  await expect(nexus.locator('.svc-row')).toHaveCount(2);
  await expect(nexus.getByText('Mes services')).toBeVisible();
});
