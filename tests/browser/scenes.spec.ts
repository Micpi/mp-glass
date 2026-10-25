import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, path = '/?spatial&v2&scenes') {
  await page.goto(path);
  await page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Gérer les scènes', exact: true }).click();
  const dialog = page.locator('mp-nexus-scenes').getByRole('dialog', { name: 'Scènes', exact: true });
  await expect(dialog.getByRole('button', { name: 'Créer une scène', exact: true })).toBeVisible();
}
async function draft(page: Page, name = 'Soirée cinéma') {
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Créer une scène', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('textbox', { name: 'Nom de la scène', exact: true }).fill(name);
  await page.locator('mp-nexus-scenes').getByRole('group', { name: 'Icône du bouton' }).getByRole('button', { name: 'Cinéma', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('checkbox', { name: /Salon · Suspension/ }).check();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('combobox', { name: 'État souhaité', exact: true }).selectOption('on');
  await page.locator('mp-nexus-scenes').getByRole('spinbutton', { name: 'Luminosité (%)', exact: true }).fill('35');
}
const device = (page: Page) => page.evaluate(() => (window as unknown as { demo: { hass: { states: Record<string, { state: string; attributes: Record<string, unknown> }> } } }).demo.hass.states['light.circuit_0']!);

for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
  test(`creates, tries, restores, edits and deletes a persistent scene inside Nexus on ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await open(page);
    await draft(page);
    const before = await device(page);
    expect(before.state).toBe('off');
    await page.screenshot({ path: testInfo.outputPath('scene-editor.png') });
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Essayer', exact: true }).click();
    const confirmation = page.locator('mp-nexus-scenes').getByRole('alertdialog');
    await expect(confirmation).toContainText('Les appareils vont changer.');
    await confirmation.getByRole('button', { name: 'Essayer maintenant' }).click();
    await expect.poll(async () => (await device(page)).state).toBe('on');
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Revenir aux réglages d’avant' }).click();
    await expect.poll(() => device(page)).toEqual(before);
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.locator('mp-nexus-scenes').getByRole('status')).toContainText('Scène enregistrée');
    await page.locator('mp-nexus-scenes').getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
    const scene = page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Soirée cinéma', exact: true });
    await expect(scene.locator('[data-icon=tv]')).toHaveCount(1);
    // An unplayed scene has an unknown timestamp, but its button is immediately available.
    await scene.click();
    await expect.poll(async () => (await device(page)).state).toBe('on');
    await open(page);
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Modifier Soirée cinéma', exact: true }).click();
    await expect(page.locator('mp-nexus-scenes').getByRole('textbox', { name: 'Nom de la scène' })).toHaveValue('Soirée cinéma');
    await page.locator('mp-nexus-scenes').getByRole('textbox', { name: 'Nom de la scène' }).fill('Lecture du soir');
    await page.locator('mp-nexus-scenes').getByRole('group', { name: 'Icône du bouton' }).getByRole('button', { name: 'Nuit', exact: true }).click();
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
    await expect(page.locator('mp-nexus-scenes').getByRole('spinbutton', { name: 'Luminosité (%)', exact: true })).toHaveValue('35');
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Supprimer Lecture du soir', exact: true }).click();
    await page.locator('mp-nexus-scenes').getByRole('alertdialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(page.locator('mp-nexus-scenes').getByRole('button', { name: 'Modifier Lecture du soir' })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/');
  });
}

test('keeps dirty edits on cancel and after a refused save, with a recoverable copy', async ({ page }) => {
  await open(page);
  await draft(page);
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('alertdialog')).toContainText('Quitter ce brouillon');
  await page.locator('mp-nexus-scenes').getByRole('alertdialog').getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.locator('mp-nexus-view-v2').evaluate((view: HTMLElement & { hass: import('../../frontend/ha/client').Hass }) => {
    const previous = view.hass.callWS;
    let fail = true;
    view.hass = { ...view.hass, callWS: async <T>(message: Record<string, unknown>) => { if (message.type === 'mp_glass/scenes/save' && fail) { fail = false; throw { code: 'conflict' }; } return previous<T>(message); } };
  });
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('alert')).toContainText('Votre brouillon est conservé');
  await expect(page.locator('mp-nexus-scenes').getByRole('spinbutton', { name: 'Luminosité (%)', exact: true })).toHaveValue('35');
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Garder une copie de mon brouillon' }).click();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('button', { name: 'Modifier Copie de Soirée cinéma', exact: true })).toBeVisible();
});

test('discarding a real trial restores the previous settings and saves no scene', async ({ page }) => {
  await open(page);
  await draft(page);
  const before = await device(page);
  const editor = page.locator('mp-nexus-scenes');
  await editor.getByRole('button', { name: 'Essayer', exact: true }).click();
  await editor.getByRole('button', { name: 'Essayer maintenant' }).click();
  await expect.poll(async () => (await device(page)).state).toBe('on');
  await editor.getByRole('button', { name: 'Fermer', exact: true }).click();
  await editor.getByRole('button', { name: 'Abandonner et rétablir', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(await device(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('mp-nexus.demo.scenes'))).toBeNull();
});

test('personalizes an existing native scene without redirecting or replacing its behavior', async ({ page }) => {
  await open(page);
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Personnaliser Soirée existante' }).click();
  await page.locator('mp-nexus-scenes').getByRole('textbox', { name: 'Nom de la scène' }).fill('Bonne nuit');
  await page.locator('mp-nexus-scenes').getByRole('group', { name: 'Icône du bouton' }).getByRole('button', { name: 'Sommeil', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('dialog')).toContainText('La scène d’origine reste intacte');
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Fermer', exact: true }).click();
  const button = page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Bonne nuit', exact: true });
  await expect(button.locator('[data-icon=bed]')).toHaveCount(1);
  await expect(page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Soirée existante', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { demo: { hass: { states: Record<string, unknown> } } }).demo.hass.states['scene.soiree'])).toBeTruthy();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('ordinary household members create scenes and read-only members get no editing controls', async ({ page }) => {
  await page.goto('/?spatial&v2');
  await page.locator('mp-nexus-view-v2').evaluate((view: HTMLElement & { hass: import('../../frontend/ha/client').Hass }) => { view.hass = { ...view.hass, user: { id: 'member', is_admin: false } }; });
  await page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Gérer les scènes', exact: true }).click();
  await draft(page, 'Ma scène de membre');
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('button', { name: 'Modifier Ma scène de membre' })).toBeVisible();
  await page.goto('/?spatial&v2&readonly');
  await page.locator('mp-nexus-view-v2').getByRole('button', { name: 'Gérer les scènes', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('dialog')).toContainText('Votre compte peut consulter les scènes');
  await expect(page.locator('mp-nexus-scenes').getByRole('button', { name: 'Créer une scène', exact: true })).toHaveCount(0);
  await expect(page.locator('mp-nexus-scenes').getByRole('button', { name: 'Modifier Ma scène de membre' })).toHaveCount(0);
});

test('groups equipment by room and saves light, cover, climate and media targets without sending commands', async ({ page }) => {
  await open(page);
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Créer une scène', exact: true }).click();
  await page.locator('mp-nexus-scenes').getByRole('textbox', { name: 'Nom de la scène' }).fill('Maison prête');
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  for (const name of ['Salon · Volet baie', 'Cuisine · Climatisation', 'Salon · Téléviseur']) await page.locator('mp-nexus-scenes').getByRole('checkbox', { name: new RegExp(name) }).check();
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Suivant', exact: true }).click();
  const cover = page.locator('mp-nexus-scenes article.target').filter({ hasText: 'Salon · Volet baie' });
  await cover.getByRole('spinbutton', { name: 'Ouverture (%)' }).fill('20');
  const climate = page.locator('mp-nexus-scenes article.target').filter({ hasText: 'Cuisine · Climatisation' });
  await climate.getByRole('spinbutton', { name: 'Température souhaitée', exact: true }).fill('22');
  const media = page.locator('mp-nexus-scenes article.target').filter({ hasText: 'Salon · Téléviseur' });
  await media.getByRole('spinbutton', { name: 'Volume (%)' }).fill('15');
  await media.getByRole('combobox', { name: 'Source', exact: true }).selectOption('HDMI 1');
  await page.locator('mp-nexus-scenes').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('mp-nexus-scenes').getByRole('status')).toContainText('Scène enregistrée');
  const saved = await page.evaluate(() => { const { calls, sceneRequests } = (window as unknown as { demo: { calls: unknown[]; sceneRequests: { type: string; scene: unknown }[] } }).demo; return { calls, sceneRequests }; });
  expect(saved.calls).toEqual([]);
  const value = saved.sceneRequests.filter(r => r.type === 'mp_glass/scenes/save').at(-1)!.scene as { entities: { entity_id: string; attributes: Record<string, unknown> }[] };
  expect(value.entities.find(e => e.entity_id === 'cover.salon')!.attributes.current_position).toBe(20);
  expect(value.entities.find(e => e.entity_id === 'climate.cuisine')!.attributes.temperature).toBe(22);
  expect(value.entities.find(e => e.entity_id === 'media_player.salon_tv')!.attributes).toMatchObject({ volume_level: .15, source: 'HDMI 1' });
});

test('white and colour settings are explicit, stay editable while typing and never conflict', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mp-nexus.appearance', JSON.stringify({ accent: '#ff9f6e', glassTint: '#432342', radius: 30 })));
  await open(page);
  await expect(page.locator('mp-nexus-scenes').getByRole('dialog')).toHaveCSS('--mp-accent', '#ff9f6e');
  await expect(page.locator('mp-nexus-scenes').getByRole('dialog')).toHaveCSS('border-top-left-radius', '30px');
  await draft(page);
  const editor = page.locator('mp-nexus-scenes');
  const mode = editor.getByRole('combobox', { name: 'Teinte de la lumière', exact: true });
  await mode.selectOption('white');
  const temperature = editor.getByRole('spinbutton', { name: 'Blanc (kelvins)', exact: true });
  await temperature.fill('');
  await expect(temperature).toBeVisible();
  await temperature.fill('3200');
  await mode.selectOption('colour');
  await editor.getByLabel('Couleur de la lumière', { exact: true }).fill('#abcdef');
  await editor.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Scène enregistrée');
  const value = await page.evaluate(() => JSON.parse(localStorage.getItem('mp-nexus.demo.scenes')!)[0].entities[0].attributes as Record<string, unknown>);
  expect(value.rgb_color).toEqual([171, 205, 239]);
  expect(value.color_temp_kelvin).toBeUndefined();
});

test('the Plus page opens the same manager with a complete icon gallery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/plus?spatial&v2');
  await page.locator('mp-nexus-view-v2 button.rw').filter({ hasText: 'Créer, modifier et personnaliser vos ambiances' }).click();
  const editor = page.locator('mp-nexus-scenes');
  await editor.getByRole('button', { name: 'Créer une scène', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Nom de la scène' }).fill('Une soirée à la maison');
  await expect(editor.getByRole('group', { name: 'Icône du bouton' }).getByRole('button')).toHaveCount(25);
  await page.screenshot({ path: testInfo.outputPath('scene-identity.png') });
  expect(new URL(page.url()).pathname).toBe('/plus');
});
