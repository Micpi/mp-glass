import { test, expect } from '@playwright/test';

test('a wake waiting for the voice lock cannot open Nexus after the word is disabled', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const result = await page.locator('mp-nexus-view-v2').evaluate(async (element) => {
    const view = element as unknown as {
      voicePrefs: { speak: string; wake?: string }; wakeListener?: { stop(): void; heard?: Float32Array }; wakeGen: number;
      overlay: string; wakeAttempt: boolean; woke(): Promise<void>; applyVoicePrefs(p: { speak: string; wake?: string }): void;
    };
    const original = Object.getOwnPropertyDescriptor(navigator, 'locks');
    let grant: (() => void) | undefined, released = false, stopped = false;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, _opts: unknown, callback: (lock: object) => Promise<void>) => new Promise<void>(resolve => { grant = () => { void callback({}).then(() => { released = true; resolve(); }); }; }) } });
    try {
      view.voicePrefs = { speak: 'off', wake: 'test' }; view.wakeListener = { stop: () => { stopped = true; } }; view.wakeGen = 7;
      const pending = view.woke();
      view.applyVoicePrefs({ speak: 'off' });
      grant?.(); await pending; await Promise.resolve();
      return { stopped, released, overlay: view.overlay, attempt: view.wakeAttempt };
    } finally { if (original) Object.defineProperty(navigator, 'locks', original); else Reflect.deleteProperty(navigator, 'locks'); }
  });
  expect(result).toEqual({ stopped: true, released: true, overlay: '', attempt: false });
});

test('disabling the word closes a conversation started by a wake', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const result = await page.locator('mp-nexus-view-v2').evaluate((element) => {
    const view = element as unknown as { voicePrefs: { speak: string; wake?: string }; wakeListener?: { stop(): void }; wakeAttempt: boolean; overlay: string; voiceState: string; handsFreeTurns: number; voiceHeard: string; answer?: object; applyVoicePrefs(p: { speak: string; wake?: string }): void };
    let stopped = false;
    view.voicePrefs = { speak: 'off', wake: 'test' }; view.wakeListener = { stop: () => { stopped = true; } };
    view.wakeAttempt = true; view.overlay = 'voice'; view.voiceState = 'listening'; view.handsFreeTurns = 0; view.voiceHeard = ''; view.answer = undefined;
    view.applyVoicePrefs({ speak: 'off' });
    return { stopped, overlay: view.overlay, attempt: view.wakeAttempt };
  });
  expect(result).toEqual({ stopped: true, overlay: '', attempt: false });
});

test('repeated wakes without a request pause listening and release the microphone', async ({ page }) => {
  await page.goto('/?spatial&v2');
  const result = await page.locator('mp-nexus-view-v2').evaluate(async (element) => {
    const view = element as unknown as {
      voicePrefs: { speak: string; wake?: string }; wakeFor: string; wakeListener?: { paused: boolean; mic(on: boolean): Promise<void>; stop(): void };
      wakeGuard: { unanswered(): number }; wakeState: string; requestUpdate(): void; updateComplete: Promise<unknown>;
    };
    const calls: boolean[] = [], listener = { paused: false, mic: async (on: boolean) => { calls.push(on); }, stop: () => undefined };
    view.voicePrefs = { speak: 'off', wake: 'test' }; view.wakeFor = 'test:normal:true'; view.wakeListener = listener; view.wakeState = 'armed';
    view.wakeGuard.unanswered(); view.wakeGuard.unanswered(); view.wakeGuard.unanswered();
    view.requestUpdate(); await view.updateComplete; await Promise.resolve();
    return { paused: listener.paused, calls };
  });
  expect(result.paused).toBe(true);
  expect(result.calls).toContain(false);
});
