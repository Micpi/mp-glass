import { expect, test } from '@playwright/test';

test('the selected Android tablet is quiet while listening and restored before the answer', async ({ page }) => {
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await expect(nexus).toBeVisible();
  await nexus.evaluate(element => {
    const view = element as unknown as { hass: { states: Record<string, unknown>; callWS: (message: Record<string, unknown>) => Promise<unknown>; callService: (domain: string, service: string, data: Record<string, unknown>) => Promise<unknown> }; tabletServices?: string[]; tabletServicesAt: number; volumeCalls: number[]; requestUpdate(): void };
    const original = view.hass, sensor = { entity_id: 'sensor.tablette_volume_level_music', state: '12', attributes: { friendly_name: 'Tablette · volume musique', min: 0, max: 15 } };
    view.volumeCalls = [];
    view.tabletServices = undefined; view.tabletServicesAt = 0;
    view.hass = { ...original, states: { ...original.states, [sensor.entity_id]: sensor },
      callWS: message => message.type === 'get_services' ? Promise.resolve({ notify: { mobile_app_tablette: {} } }) : original.callWS(message),
      callService: async (domain, service, data) => {
        if (domain === 'notify' && service === 'mobile_app_tablette') {
          const command = (data.data as { command: number }).command;
          view.volumeCalls.push(command); sensor.state = String(command); return undefined;
        }
        return original.callService(domain, service, data);
      } };
    view.requestUpdate();
  });
  const tablet = nexus.getByLabel('Tablette Android');
  await expect(tablet.locator('option[value="mobile_app_tablette"]')).toHaveCount(1);
  await tablet.selectOption('mobile_app_tablette');
  await nexus.getByLabel('Capteur de volume multimédia').selectOption('sensor.tablette_volume_level_music');
  await nexus.evaluate(element => { const view = element as unknown as { overlay: string; voiceState: string }; view.overlay = 'voice'; view.voiceState = 'listening'; });
  const calls = () => nexus.evaluate(element => (element as unknown as { volumeCalls: number[] }).volumeCalls);
  await expect.poll(calls).toEqual([3]);
  await nexus.evaluate(element => { (element as unknown as { voiceState: string }).voiceState = 'thinking'; });
  await expect.poll(calls).toEqual([3, 12]);
});
