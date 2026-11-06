import { expect, test } from '@playwright/test';

test('Android companion takes over the wake word and receives only the explicitly selected commands', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' }));
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate(element => {
    const view = element as unknown as { hass: { callWS(message: Record<string, unknown>): Promise<unknown>; callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown> }; tabletServices?: string[]; tabletServicesAt: number; nativeCalls: unknown[]; requestUpdate(): void };
    const original = view.hass;
    view.nativeCalls = []; view.tabletServices = undefined; view.tabletServicesAt = 0;
    view.hass = { ...original, callWS: message => message.type === 'get_services' ? Promise.resolve({ notify: { mobile_app_tablette: {} } }) : original.callWS(message),
      callService: async (domain, service, data) => { view.nativeCalls.push({ domain, service, data }); } };
    view.requestUpdate();
  });
  const selector = nexus.getByLabel('Mot d’éveil', { exact: true });
  await selector.selectOption('@android');
  await expect(nexus.getByText(/Le mot personnalisé de MP Nexus ne peut pas être transféré automatiquement/)).toBeVisible();
  const target = nexus.getByLabel('Appareil Android pour le mot d’éveil');
  await expect(target.locator('option[value="mobile_app_tablette"]')).toHaveCount(1);
  await target.selectOption('mobile_app_tablette');
  const calls = () => nexus.evaluate(element => (element as unknown as { nativeCalls: unknown[] }).nativeCalls);
  expect(await calls()).toEqual([]);
  await nexus.getByRole('button', { name: 'Activer sur Android', exact: true }).click();
  await expect.poll(calls).toEqual([{ domain: 'notify', service: 'mobile_app_tablette', data: { message: 'command_wake_word_detection', data: { command: 'turn_on' } } }]);
  await expect(nexus.getByRole('status')).toContainText('Commande envoyée');
  await selector.selectOption('');
  await expect.poll(calls).toHaveLength(2);
  expect((await calls())[1]).toEqual({ domain: 'notify', service: 'mobile_app_tablette', data: { message: 'command_wake_word_detection', data: { command: 'turn_off' } } });
  await expect(nexus.getByRole('status')).toContainText('Vérifiez que la détection Android est arrêtée');
});

test('a refused Android stop command keeps the browser wake engine disabled', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' });
    localStorage.setItem('mp-nexus.voice', JSON.stringify({ speak: 'off', nativeWake: 'android', nativeWakeService: 'mobile_app_tablette' }));
  });
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate(element => {
    const view = element as unknown as { hass: { callService(...args: unknown[]): Promise<unknown> }; requestUpdate(): void };
    view.hass = { ...view.hass, callService: async () => { throw new Error('offline'); } };
    view.requestUpdate();
  });
  const selector = nexus.getByLabel('Mot d’éveil', { exact: true });
  await expect(selector.locator('option[value="hey_jarvis"]')).toHaveCount(1);
  await selector.selectOption('hey_jarvis');
  await expect(nexus.getByRole('status')).toContainText('La commande n’a pas pu être envoyée');
  await expect(selector).toHaveValue('@android');
  const state = await nexus.evaluate(element => { const view = element as unknown as { voicePrefs: { wake?: string; nativeWake?: string }; wakeListener?: object }; return { wake: view.voicePrefs.wake ?? null, native: view.voicePrefs.nativeWake, listening: !!view.wakeListener }; });
  expect(state).toEqual({ wake: null, native: 'android', listening: false });
});
