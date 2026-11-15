import { test, expect } from '@playwright/test';

const calls = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { demo: { calls: Record<string, unknown>[] } }).demo.calls);

test('rooms that play together show as one zone, and a tick adds or removes a room', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  // The Sonos and the kitchen play together: one zone, not two players.
  await expect(nexus.locator('.zone')).toHaveCount(3);
  await nexus.locator('.zone', { hasText: 'Salon · Sonos Arc + Cuisine' }).click();
  await expect(nexus.locator('.hd .title')).toHaveText('Salon · Sonos Arc + Cuisine');
  await nexus.getByRole('button', { name: 'Pièces et groupes' }).click();
  await expect(nexus.getByRole('tab', { name: 'Groupes' })).toHaveAttribute('aria-selected', 'true');
  await expect(nexus.locator('.zone-card')).toContainText('2 pièces jouent ensemble');
  const kitchen = nexus.getByRole('checkbox', { name: 'Cuisine' }), terrace = nexus.getByRole('checkbox', { name: /Terrasse/ });
  await expect(kitchen).toHaveAttribute('aria-checked', 'true');
  await expect(terrace).toHaveAttribute('aria-checked', 'false');
  await expect(nexus.locator('.grp', { hasText: 'Terrasse' })).toContainText('Disponible');
  await terrace.click();
  await expect(terrace).toHaveAttribute('aria-checked', 'true');
  await expect(nexus.locator('.grp', { hasText: 'Terrasse' })).toContainText('Joue avec Salon');
  await expect(nexus.locator('.zone-card')).toContainText('3 pièces jouent ensemble');
  await expect(nexus.locator('.hd .title')).toHaveText('Salon · Sonos Arc + 2');
  await expect(nexus.locator('.zone')).toHaveCount(2);
  await kitchen.click();
  await expect(kitchen).toHaveAttribute('aria-checked', 'false');
  await expect(nexus.locator('.zone')).toHaveCount(3);
  // The television cannot be grouped: it is offered as another player, one touch away.
  await nexus.locator('.grp.other').getByRole('button', { name: /Téléviseur/ }).click();
  await expect(nexus.locator('.hd .title')).toHaveText('Salon · Téléviseur');
  await expect(nexus.getByRole('checkbox')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('one volume moves every room of a zone and keeps their balance', async ({ page }) => {
  await page.goto('/media?spatial&v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.locator('.zone', { hasText: 'Sonos Arc' }).click();
  const volume = nexus.getByRole('slider', { name: 'Volume du groupe' });
  await expect(volume).toHaveValue('28');
  await volume.evaluate((input: HTMLInputElement) => { input.value = '38'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(async () => (await calls(page)).slice(-2)).toEqual([
    { domain: 'media_player', service: 'volume_set', data: { entity_id: 'media_player.salon_sonos', volume_level: .42 } },
    { domain: 'media_player', service: 'volume_set', data: { entity_id: 'media_player.cuisine', volume_level: .34 } },
  ]);
});

test('the music is sorted on shelves, and a search sorts its answers by kind with their service', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2&music=ready');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.locator('.zone', { hasText: 'Sonos Arc' }).click();
  await nexus.getByRole('tab').nth(1).click();
  await expect(nexus.locator('.shelf-tile')).toHaveCount(6);
  // Connected services no longer stand in the way: they sit under the music.
  await expect(nexus.getByText('Mes services')).toBeVisible();
  expect(await nexus.evaluate(root => { const shelves = root.shadowRoot!.querySelector('.shelves')!, services = root.shadowRoot!.querySelector('.svc-rows')!; return shelves.getBoundingClientRect().top < services.getBoundingClientRect().top; })).toBe(true);
  await nexus.locator('.shelf-tile', { hasText: 'Albums' }).click();
  await expect(nexus.locator('.shelf-head')).toContainText('Albums');
  await expect(nexus.locator('.lib.grid .li')).toHaveCount(8);
  await nexus.locator('.music-kinds').getByRole('button', { name: 'Morceaux' }).click();
  await expect(nexus.locator('.trk')).toHaveCount(8);
  await nexus.locator('.trk-play').first().click();
  await expect.poll(async () => (await calls(page)).at(-1)).toEqual({ music: 'play_now', data: { entity_id: 'media_player.salon_sonos', media: 'library://track/0', media_type: 'track' } });
  await nexus.locator('.shelf-head').getByRole('button', { name: 'Retour' }).click();
  await expect(nexus.locator('.shelf-tile')).toHaveCount(6);
  await nexus.getByRole('textbox', { name: 'Rechercher dans Music Assistant' }).fill('Moon');
  await nexus.getByRole('textbox', { name: 'Rechercher dans Music Assistant' }).press('Enter');
  await expect(nexus.locator('.rlab')).toHaveText(['Morceaux', 'Artistes', 'Albums', 'Playlists', 'Radios']);
  await expect(nexus.locator('.trk .source-logo.tiny')).toHaveCount(3);
  await expect(nexus.locator('.shelf-tile')).toHaveCount(0);
  await nexus.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(nexus.locator('.shelf-tile')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an input of the television opens the remote of the box that plays on it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/media?spatial&v2&tv-sources');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.locator('.zone', { hasText: 'Téléviseur' }).click();
  await nexus.getByRole('tab').last().click();
  const title = nexus.locator('.rc-title');
  await expect(title).toContainText('Canal+');
  await title.click();
  const sources = nexus.getByRole('listbox', { name: 'Source du téléviseur' });
  await expect(sources.getByRole('option')).toHaveCount(4);
  await expect(sources.getByRole('option', { name: /Canal\+/ })).toHaveAttribute('aria-selected', 'true');
  // Apple TV is found by its name: the TV switches to it and the remote becomes the Apple TV's.
  await sources.getByRole('option', { name: /Apple TV/ }).click();
  await expect(title).toContainText('Salon · Apple TV');
  expect((await calls(page)).some(c => c.service === 'select_source' && JSON.stringify(c).includes('Apple TV'))).toBe(true);
  await nexus.locator('.track-surface').focus();
  await page.keyboard.press('ArrowUp');
  expect(JSON.stringify(await calls(page))).toContain('apple_tv');
  // The volume stays the television's.
  await nexus.getByRole('button', { name: 'Monter le volume' }).click();
  expect(JSON.stringify((await calls(page)).filter(c => String(JSON.stringify(c)).includes('volume')))).toContain('media_player.salon_tv');
  // An input can be linked by hand to another box, and the choice is kept.
  await title.click();
  await sources.getByRole('option', { name: /Blu-ray/ }).click();
  await nexus.getByRole('button', { name: 'Plus de touches' }).click();
  await nexus.getByRole('combobox', { name: /Blu-ray/ }).selectOption({ label: 'Salon · Kaleidescape' });
  await page.reload();
  await nexus.locator('.zone', { hasText: 'Téléviseur' }).click();
  await nexus.getByRole('tab').last().click();
  await title.click();
  await sources.getByRole('option', { name: /Blu-ray/ }).click();
  await nexus.getByRole('button', { name: 'Plus de touches' }).click();
  await expect(nexus.getByRole('combobox', { name: /Blu-ray/ })).toHaveValue('media_player.salon_kaleidescape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
