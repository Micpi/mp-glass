import { test, expect } from '@playwright/test';

test('v2 keeps per-screen favorites and can browse playable Music Assistant media', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await expect(nexus).toBeVisible();
  await nexus.getByRole('button', { name: 'Salon · Sonos Arc' }).click();
  await nexus.getByRole('tab').nth(1).click();
  await nexus.getByRole('textbox', { name: 'Rechercher dans Music Assistant' }).fill('Moon Song');
  await nexus.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(nexus.getByRole('button', { name: 'Moon Song' })).toBeVisible();
  await expect(nexus.getByRole('button', { name: 'Golden Hour' })).toBeVisible();
  await nexus.getByRole('button', { name: 'Garder sur cet écran' }).first().click();
  await expect(nexus.getByRole('button', { name: 'Golden Hour' })).toBeVisible();
  await expect(nexus.getByText('Favoris MP Nexus · cet écran')).toBeVisible();
  await expect(nexus.locator('.media-favorite')).toContainText('Moon Song');
  await expect(nexus.locator('.media-favorite').getByRole('button', { name: 'Retirer des favoris' })).toBeVisible();
  await expect(nexus.locator('.lib').first()).toHaveCSS('grid-template-columns', /\d+/);
});

test('v2 switches the TV remote to trackpad navigation and sends one directional command per swipe', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await expect(nexus).toBeVisible();
  await nexus.getByRole('button', { name: /Téléviseur/ }).first().click();
  await nexus.getByRole('tab', { name: 'Télécommande' }).click();
  const toggle = nexus.getByRole('switch', { name: 'Trackpad' });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const surface = nexus.getByRole('button', { name: 'Trackpad télécommande' });
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  const before = await page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls.length);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * .78, box!.y + box!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls.length)).toBe(before + 1);
  const calls = await page.evaluate(() => (window as unknown as { demo: { calls: { domain: string; service: string; data: Record<string, unknown> }[] } }).demo.calls);
  expect(calls.at(-1)).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.salon_tv', command: 'right' } });
  const tapBefore = calls.length;
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect.poll(() => page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls.length)).toBe(tapBefore + 1);
  const afterTap = await page.evaluate(() => (window as unknown as { demo: { calls: { domain: string; service: string; data: Record<string, unknown> }[] } }).demo.calls);
  expect(afterTap.at(-1)).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.salon_tv', command: 'select' } });
  await expect(surface).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem(`mp-nexus.trackpad:${(window as unknown as { demo: { hass: { user: { id: string } } } }).demo.hass.user.id}:${location.pathname}:media_player.salon_tv`))).toBe('on');
});

test('v2 media and the trackpad fit phone and tablet orientations without horizontal overflow', async ({ page }) => {
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: /Téléviseur/ }).first().click();
  await nexus.getByRole('tab').last().click();
  const toggle = nexus.getByRole('switch', { name: 'Trackpad' });
  if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
  for (const [width, height] of [[390, 844], [844, 390], [820, 1180], [1180, 820], [1440, 1000]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(nexus.getByRole('button', { name: 'Trackpad télécommande' })).toBeVisible();
  }
});
