import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14)' });
    const state = window as unknown as { audioInstances: number; played: string[]; blockAudio: boolean };
    state.audioInstances = 0; state.played = []; state.blockAudio = false;
    class FakeAudio {
      src = ''; loop = false; onended: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor() { state.audioInstances++; }
      play() { state.played.push(this.src); return state.blockAudio ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); }
      pause() { /* Browser audio is represented by the fake element. */ }
    }
    Object.defineProperty(window, 'Audio', { configurable: true, value: FakeAudio });
  });
});

test('the Android timer preview and Nexus voice use the same media player', async ({ page }) => {
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate(element => {
    const view = element as unknown as { hass: { states: Record<string, unknown>; entities?: Record<string, unknown>; callApi?: (...args: unknown[]) => Promise<unknown> }; voicePrefs: { speak: string }; requestUpdate(): void };
    view.hass = { ...view.hass, states: { ...view.hass.states, 'tts.voix_nexus': { entity_id: 'tts.voix_nexus', state: 'unknown', attributes: {} } },
      entities: { ...view.hass.entities, 'tts.voix_nexus': { entity_id: 'tts.voix_nexus', platform: 'mp_glass' } }, callApi: async () => ({ url: '/test-voice.mp3' }) };
    view.voicePrefs = { speak: 'device' }; view.requestUpdate();
  });
  await nexus.getByRole('button', { name: /Tester la sonnerie/ }).click();
  await nexus.getByRole('button', { name: /Écouter la voix/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { played: string[] }).played)).toEqual(expect.arrayContaining([expect.stringMatching(/^data:audio\/wav;base64,/), '/test-voice.mp3']));
  expect(await page.evaluate(() => (window as unknown as { audioInstances: number }).audioInstances)).toBe(1);
});

test('a blocked Android timer offers a button to retry playback', async ({ page }) => {
  await page.goto('/plus?v2');
  await page.evaluate(() => { (window as unknown as { blockAudio: boolean }).blockAudio = true; });
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate(element => {
    const view = element as unknown as { timerSnap: unknown; syncRing(): void };
    view.timerSnap = { now: Date.now(), timers: [], ringing: [{ id: 'r1', kind: 'timer', label: 'Four', since: Date.now() }] };
    view.syncRing();
  });
  const retry = nexus.getByRole('button', { name: 'Activer la sonnerie' });
  await expect(retry).toBeVisible();
  await page.evaluate(() => { (window as unknown as { blockAudio: boolean }).blockAudio = false; });
  await retry.click();
  await expect(retry).toHaveCount(0);
});

test('a late voice preview cannot replace the sound of a ringing timer', async ({ page }) => {
  await page.goto('/plus?v2');
  const nexus = page.locator('mp-nexus-view-v2');
  await nexus.evaluate(element => {
    const view = element as unknown as { hass: { states: Record<string, unknown>; entities?: Record<string, unknown>; callApi?: (...args: unknown[]) => Promise<unknown> }; voicePrefs: { speak: string }; requestUpdate(): void };
    view.hass = { ...view.hass, states: { ...view.hass.states, 'tts.voix_nexus': { entity_id: 'tts.voix_nexus', state: 'unknown', attributes: {} } },
      entities: { ...view.hass.entities, 'tts.voix_nexus': { entity_id: 'tts.voix_nexus', platform: 'mp_glass' } }, callApi: () => new Promise(resolve => { (window as unknown as { finishTts: (v: unknown) => void }).finishTts = resolve; }) };
    view.voicePrefs = { speak: 'device' }; view.requestUpdate();
  });
  await nexus.getByRole('button', { name: /Écouter la voix/ }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { finishTts?: unknown }).finishTts)).toBe('function');
  await nexus.evaluate(element => { const view = element as unknown as { timerSnap: unknown; syncRing(): void }; view.timerSnap = { now: Date.now(), timers: [], ringing: [{ id: 'r1', kind: 'timer', label: 'Four', since: Date.now() }] }; view.syncRing(); });
  await page.evaluate(() => (window as unknown as { finishTts: (v: unknown) => void }).finishTts({ url: '/late-voice.mp3' }));
  await expect.poll(() => page.evaluate(() => (window as unknown as { played: string[] }).played.filter(src => src.startsWith('data:audio/wav;base64,')).length)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => (window as unknown as { played: string[] }).played)).not.toContain('/late-voice.mp3');
});
