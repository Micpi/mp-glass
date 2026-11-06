import { expect, test } from '@playwright/test';

test('a voice routine is saved only after an explicit confirmation', async ({ page }) => {
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await expect(nexus).toBeVisible();
  const result = await nexus.evaluate(async element => {
    const view = element as unknown as {
      hass: { states: Record<string, unknown>; user: unknown; fetchWithAuth: (url: string, options: RequestInit) => Promise<Response> };
      answer?: { text: string }; pendingVoiceRoutine?: { expires: number }; access?: { guest: boolean; profile: string }; ask(text: string, voice: boolean): Promise<void>;
    };
    const calls: { url: string; options: RequestInit }[] = [];
    view.hass = { ...view.hass, user: { is_admin: true }, states: { ...view.hass.states, 'light.test_salon': { entity_id: 'light.test_salon', state: 'off', attributes: {} } },
      fetchWithAuth: async (url, options) => { calls.push({ url, options }); return { ok: true } as Response; } };
    Object.defineProperty(view, 'placedAll', { value: [{ room: { id: 'salon', name: 'Salon', entityIds: ['light.test_salon'] }, floor: { id: 'rdc', name: 'Rez-de-chaussée' } }] });
    const request = 'Quand je dis bonne nuit, éteins les lumières du salon';
    await view.ask(request, true);
    const proposal = view.answer?.text, before = calls.length;
    await view.ask('non', true);
    const afterCancel = calls.length;
    await view.ask(request, true);
    await view.ask('oui', true);
    const afterConfirm = calls.length;
    await view.ask(request, true);
    if (view.pendingVoiceRoutine) view.pendingVoiceRoutine.expires = 0;
    await view.ask('oui', true);
    const afterExpired = calls.length;
    await view.ask(request, true);
    view.access = { guest: true, profile: 'read' };
    await view.ask('oui', true);
    return { proposal, before, afterCancel, afterConfirm, afterExpired, afterReadOnly: calls.length, automation: JSON.parse(String(calls[0]?.options.body ?? '{}')) };
  });
  expect(result.proposal).toContain('Confirmez-vous');
  expect([result.before, result.afterCancel, result.afterConfirm, result.afterExpired]).toEqual([0, 0, 1, 1]);
  expect(result.afterReadOnly).toBe(1);
  expect(result.automation.triggers).toEqual([{ trigger: 'conversation', command: ['bonne nuit'] }]);
  expect(result.automation.actions[0].target.entity_id).toEqual(['light.test_salon']);
});
