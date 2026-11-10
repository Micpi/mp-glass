import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page, path: string) => { await page.goto(path); return page.locator('mp-nexus-view-v2'); };

test('shortcuts chosen on a screen show on its home page and command their device', async ({ page }) => {
  const nexus = await open(page, '/?spatial&v2');
  await nexus.getByRole('button', { name: 'Choisir mes raccourcis' }).click();
  await nexus.getByRole('switch', { name: 'Raccourci : Suspension' }).click();
  await nexus.getByRole('switch', { name: 'Raccourci : Volet baie' }).click();
  await expect(nexus.getByText('2 sur 12')).toBeVisible();
  await nexus.getByRole('button', { name: 'Retour' }).first().click();
  const row = nexus.locator('.short');
  await expect(row.locator('.tl')).toHaveCount(2);
  await row.locator('.tl .tap').first().click();
  await expect(row.locator('.tl').first()).toHaveClass(/\bon\b/);
  await page.reload();
  await expect(page.locator('mp-nexus-view-v2 .short .tl')).toHaveCount(2);
});

test('what plays at home is said once per room, and the weather stays in sight', async ({ page }) => {
  const nexus = await open(page, '/?spatial&v2');
  const cards = nexus.locator('.side .player-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: 'Le Grand Bleu' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Nuits d’été' })).toContainText('Salon + Cuisine');
  await expect(nexus.locator('.side .live').first()).toContainText('Météo');
});

test('the figures of the home page name what they count and open it', async ({ page }) => {
  const nexus = await open(page, '/?spatial&v2');
  const stat = nexus.locator('.main .body > .stat');
  await expect(stat).toContainText('Volets 3/4ouverts');
  await expect(stat).toContainText('Ouvert : Chambre · Fenêtre');
  await stat.getByRole('button', { name: /Volets/ }).click();
  await expect(nexus.locator('.side .hd')).toContainText('Ouvrants');
});

test('a house without a scene is offered scenes made from its own devices', async ({ page }) => {
  const nexus = await open(page, '/?spatial&v2');
  await nexus.evaluate(() => localStorage.removeItem('mp-nexus.demo.scenes'));
  await page.reload();
  const offered = nexus.locator('button.sug');
  await expect(offered.first()).toContainText('Soirée');
  await offered.first().click();
  await expect(nexus.getByRole('status')).toContainText('Scène « Soirée » créée');
  await expect(nexus.locator('button.sug').filter({ hasText: 'Soirée' })).toHaveCount(0);
  await expect(nexus.locator('.main .houses .btn').filter({ hasText: 'Soirée' }).first()).toBeVisible();
});

test('a room opens on its devices and its tile switches its lights', async ({ page }) => {
  const nexus = await open(page, '/rooms?spatial&v2');
  const salon = nexus.locator('div.rm').filter({ hasText: 'Salon' });
  await salon.getByRole('switch').click();
  await expect(salon).toHaveClass(/\blit\b/);
  await expect(salon).toContainText('lumière');
  await salon.locator('.tap').click();
  const sheet = page.locator('mp-nexus-view-v2 .main');
  await expect(sheet.locator('.hd')).toContainText('Salon');
  // The demo loads the page of the room afresh: its lights are off again.
  await expect(sheet.locator('.secg').filter({ hasText: 'Ouvrants' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Tout allumer' }).click();
  await expect(sheet.getByRole('button', { name: 'Tout éteindre' })).toBeVisible();
  await expect(sheet.locator('.secg').filter({ hasText: 'Lumières' })).toContainText('3 sur 3');
});

test('a light is dimmed by sliding along its tile, without switching it by mistake', async ({ page }) => {
  const nexus = await open(page, '/lights?spatial&v2');
  const tile = nexus.locator('.tl.dimm').first(), box = (await tile.boundingBox())!;
  await page.mouse.move(box.x + 12, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 42, { steps: 4 });
  await page.mouse.move(box.x + 12 + box.width / 2, box.y + 42, { steps: 4 });
  await expect(tile).toHaveClass(/sliding/);
  await expect(tile.locator('small')).toContainText('Luminosité');
  await page.mouse.up();
  await expect(tile).toHaveClass(/\bon\b/);
  const level = await nexus.evaluate((el: HTMLElement & { hass: { states: Record<string, { attributes: { brightness?: number } }> } }) => Math.round((el.hass.states['light.salon_main']?.attributes.brightness ?? Object.values(el.hass.states).find(s => typeof s.attributes.brightness === 'number' && (s as unknown as { state: string }).state === 'on')?.attributes.brightness ?? 0) / 2.55));
  expect(level).toBeGreaterThan(35);
  expect(level).toBeLessThan(65);
});

test('rooms are put in order by dragging, and the order is kept on this screen', async ({ page }) => {
  const nexus = await open(page, '/rooms?spatial&v2');
  const names = () => nexus.locator('div.rm b').allTextContents();
  const before = await names();
  await nexus.getByRole('button', { name: 'Ranger' }).click();
  const first = (await nexus.locator('.rm.arr').nth(0).boundingBox())!, third = (await nexus.locator('.rm.arr').nth(2).boundingBox())!;
  await page.mouse.move(first.x + 30, first.y + 30);
  await page.mouse.down();
  await page.mouse.move(third.x + 30, third.y + 30, { steps: 8 });
  await page.mouse.up();
  await nexus.getByRole('button', { name: 'Terminé' }).click();
  const after = await names();
  expect(after).toEqual([before[1], before[2], before[0], ...before.slice(3)]);
  await page.reload();
  expect(await page.locator('mp-nexus-view-v2 div.rm b').allTextContents()).toEqual(after);
});

test('each screen chooses the tabs of its bar; a panel tab opens over the page', async ({ page }) => {
  const nexus = await open(page, '/plus?spatial&v2');
  await nexus.getByRole('button', { name: /Barre de navigation/ }).click();
  await nexus.getByRole('switch', { name: 'Lumières' }).click();
  await nexus.getByRole('switch', { name: 'Climat' }).click();
  const nav = nexus.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Lumières' })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Climat' }).click();
  await expect(nexus.locator('.side .hd')).toContainText('Climat');
  await expect(nexus.locator('.main').getByRole('link', { name: /Lumières/ })).toBeVisible();
});

test('security gathers the alarm, cameras, locks and what stands open', async ({ page }) => {
  const nexus = await open(page, '/plus?spatial&v2&security');
  await nexus.getByRole('button', { name: /Sécurité/ }).first().click();
  const panel = nexus.locator('.side');
  await expect(panel.locator('.alarm')).toContainText('Désactivée');
  await panel.getByRole('button', { name: 'Activer · absent' }).click();
  await expect(panel.locator('.alarm')).toContainText('Activée · absent');
  await expect(panel.getByRole('button', { name: 'Désactiver' })).toBeVisible();
  await expect(panel.locator('.cam')).toHaveCount(1);
  await expect(panel).toContainText('Ouvert en ce moment');
  await panel.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(panel.getByRole('button', { name: 'Verrouiller', exact: true })).toBeVisible();
});

test('on a phone the name of the house is whole and its figures wrap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const nexus = await open(page, '/?spatial&v2');
  const title = nexus.locator('.main .hd .title');
  await expect(title).toHaveText('Maison de démonstration');
  expect(await title.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  expect(await nexus.locator('.main .body > .stat').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('the hint of the plan leaves once the plan has been handled a few times', async ({ page }) => {
  const nexus = await open(page, '/?spatial&v2');
  await expect(nexus.locator('mp-spatial-viewer .hint').first()).toBeVisible();
  await nexus.evaluate(() => localStorage.setItem('mp-glass.plan-hint', '3'));
  await page.reload();
  await expect(page.locator('mp-nexus-view-v2 mp-spatial-viewer .hint').first()).toBeHidden();
});

test('a room of the plan without a zone opens on the page of rooms, and comes back to the list', async ({ page }) => {
  const nexus = await open(page, '/rooms?spatial&v2');
  await nexus.locator('div.rm').filter({ hasText: 'Séjour' }).locator('.tap').click();
  await expect(nexus.locator('.main .hd .title')).toHaveText('Séjour');
  await expect(nexus.locator('.main')).toContainText('Aucun équipement dans cette pièce pour le moment.');
  await nexus.locator('.main').getByRole('button', { name: 'Retour' }).click();
  await expect(nexus.locator('.main .hd .title')).toHaveText('Pièces');
});
