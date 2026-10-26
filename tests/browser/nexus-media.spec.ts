import { test, expect } from '@playwright/test';

test('v2 keeps per-screen favorites and can browse playable Music Assistant media', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await expect(nexus).toBeVisible();
  await nexus.getByRole('button', { name: 'Salon · Sonos Arc' }).click();
  await expect(nexus.locator('.playing-source .source-logo img')).toHaveCount(1);
  await expect.poll(() => nexus.locator('.cover .media-image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
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
  const currentPath = new URL(page.url()).pathname;
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * .78, box!.y + box!.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(new URL(page.url()).pathname).toBe(currentPath);
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

test('touch on the trackpad stays in the media page and sends one command', async ({ browser }) => {
  test.setTimeout(45_000);
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/media?spatial&v2');
    const nexus = page.locator('mp-nexus-view-v2');
    await nexus.getByRole('button', { name: /Téléviseur/ }).first().click();
    await nexus.getByRole('tab').last().click();
    const toggle = nexus.getByRole('switch', { name: 'Trackpad' });
    if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
    const surface = nexus.getByRole('button', { name: 'Trackpad télécommande' });
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    const center = { x: Math.round(box!.x + box!.width / 2), y: Math.round(box!.y + box!.height / 2), id: 1 };
    const before = await page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls.length);
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...center, x: center.x + 35 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...center, x: center.x + 70 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls.length)).toBe(before + 1);
    expect(new URL(page.url()).pathname).toBe('/media');
    await expect(surface).toBeVisible();
  } finally { await context.close(); }
});

test('a favorite reloads authenticated HA artwork without storing the temporary token', async ({ page }) => {
  await page.goto('/media?spatial&v2&proxy-cover');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: 'Salon · Sonos Arc' }).click();
  await nexus.getByRole('button', { name: 'Garder sur cet écran' }).click();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('mp-nexus.media-favorites:')).map(key => localStorage.getItem(key)).join(''));
  expect(stored).toContain('/api/media_player_proxy/media_player.salon_sonos');
  expect(stored).not.toContain('temporary-demo-token');
  await page.reload();
  await nexus.getByRole('button', { name: 'Salon · Sonos Arc' }).click();
  await nexus.getByRole('tab').nth(1).click();
  await expect.poll(() => nexus.locator('.media-favorite .media-image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
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
    await expect.poll(async () => (await nexus.boundingBox())!.height).toBeLessThanOrEqual(height);
    await expect(nexus.getByRole('button', { name: 'Trackpad télécommande' })).toBeVisible();
  }
});

test('v2 draws the remote of the TV brand and types on televisions that take text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2&tv=androidtv_remote:TCL');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.getByRole('button', { name: /Téléviseur/ }).first().click();
  await nexus.getByRole('tab').last().click();
  await expect(nexus.locator('.remote-brand')).toContainText('TCL');
  await expect(nexus.locator('.remote-brand')).toContainText('Google TV');
  await expect(nexus.getByRole('button', { name: 'Rouge' })).toBeVisible();
  await expect(nexus.getByRole('switch', { name: 'Trackpad' })).toBeEnabled();
  await nexus.getByRole('button', { name: '123' }).click();
  await nexus.locator('.remote-digits').getByRole('button', { name: '7' }).click();
  const calls = () => page.evaluate(() => (window as unknown as { demo: { calls: unknown[] } }).demo.calls);
  expect((await calls()).at(-1)).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.salon_tv', command: '7' } });
  await nexus.getByRole('button', { name: 'Clavier' }).click();
  await nexus.getByRole('textbox', { name: 'Clavier' }).fill('Le Grand Bleu');
  await nexus.getByRole('button', { name: 'Envoyer' }).click();
  await expect.poll(async () => (await calls()).at(-1)).toEqual({ domain: 'remote', service: 'send_command', data: { entity_id: 'remote.salon_tv', command: 'text:Le Grand Bleu' } });
  await expect(nexus.getByText('Texte envoyé au téléviseur.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/media?spatial&v2&tv=samsungtv:Samsung');
  await nexus.getByRole('button', { name: /Téléviseur/ }).first().click();
  await nexus.getByRole('tab').last().click();
  await expect(nexus.locator('.remote-brand')).toContainText('Samsung');
  await expect(nexus.getByRole('button', { name: 'Source' })).toBeVisible();
  await expect(nexus.getByRole('button', { name: 'Clavier' })).toHaveCount(0);
});
