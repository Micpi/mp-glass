import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class AudioDouble {
  static instances: AudioDouble[] = [];
  src = ''; loop = false; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pause = vi.fn();
  constructor() { AudioDouble.instances.push(this); }
}

beforeEach(() => { vi.resetModules(); AudioDouble.instances = []; vi.stubGlobal('Audio', AudioDouble); vi.stubGlobal('navigator', { userAgent: 'Android', vibrate: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('media output on Android', () => {
  it('plays the voice and timer through one media element without a stale stop silencing the timer', async () => {
    const { playMedia } = await import('../frontend/v2/media-output');
    const { ringSound } = await import('../frontend/v2/sound');
    const voice = playMedia('voice.mp3'); await voice.ready;
    const ring = ringSound('timer'); await Promise.resolve();
    expect(AudioDouble.instances).toHaveLength(1);
    const player = AudioDouble.instances[0]!;
    expect(player.src).toMatch(/^data:audio\/wav;base64,/);
    expect(player.loop).toBe(true);
    const paused = player.pause.mock.calls.length;
    voice.stop();
    expect(player.pause).toHaveBeenCalledTimes(paused);
    ring.stop();
    expect(player.pause).toHaveBeenCalledTimes(paused + 1);
  });
  it('exposes a blocked timer and permits a user-initiated retry', async () => {
    const { ringSound } = await import('../frontend/v2/sound');
    const { unlockMedia } = await import('../frontend/v2/media-output');
    unlockMedia();
    const player = AudioDouble.instances[0]!;
    player.play.mockRejectedValueOnce(new Error('NotAllowedError')).mockResolvedValue(undefined);
    const blocked = vi.fn(), ring = ringSound('timer', blocked);
    await vi.waitFor(() => expect(blocked).toHaveBeenCalledWith(true));
    ring.retry();
    await vi.waitFor(() => expect(blocked).toHaveBeenLastCalledWith(false));
    ring.stop();
  });
  it('produces a valid non-silent PCM timer wave', async () => {
    const { ringWave } = await import('../frontend/v2/sound');
    const data = Uint8Array.from(atob(ringWave('timer').split(',')[1]!), c => c.charCodeAt(0));
    expect(new TextDecoder().decode(data.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(data.slice(8, 12))).toBe('WAVE');
    expect(new DataView(data.buffer).getUint32(40, true)).toBe(data.length - 44);
    expect(data.slice(44).some(value => value !== 0)).toBe(true);
  });
  it('does not replace an active timer when an abandoned TTS request finishes late', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    const { ringSound } = await import('../frontend/v2/sound');
    let answer!: (value: { url: string }) => void;
    const hass = { callApi: () => new Promise<{ url: string }>(resolve => { answer = resolve; }) };
    let wanted = true;
    const speech = speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.voix_nexus', undefined, undefined, undefined, () => wanted);
    const ring = ringSound('timer'); await Promise.resolve();
    wanted = false; answer({ url: '/voice.mp3' }); await speech;
    expect(AudioDouble.instances).toHaveLength(1);
    expect(AudioDouble.instances[0]!.src).toMatch(/^data:audio\/wav;base64,/);
    ring.stop();
  });
});
