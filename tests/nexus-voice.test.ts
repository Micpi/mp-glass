import { describe, expect, it, vi } from 'vitest';
import { LONGEST_MS, NOBODY_MS, PAUSE_MS, Recorder, readVoicePrefs, recordingFormat, shouldStop, VOICE_EVENT, writeVoicePrefs, type Endpoint } from '../frontend/v2/voice';

describe('the voice of Nexus', () => {
  it('releases a microphone granted after the recording was cancelled', async () => {
    let grant!: (stream: MediaStream) => void;
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { grant = resolve; }) } });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } });
    vi.stubGlobal('window', { clearTimeout });
    try {
      const recorder = new Recorder();
      const starting = recorder.start();
      recorder.cancel();
      grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await starting;
      expect(await recorder.done).toBeUndefined();
      expect(stop).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
  it('stops listening after a pause once someone spoke', () => {
    const state: Endpoint = {};
    expect(shouldStop(state, 0.01, 100, 0)).toBe('go');
    expect(shouldStop(state, 0.2, 400, 0)).toBe('go');
    expect(shouldStop(state, 0.01, 500, 0)).toBe('go');
    expect(shouldStop(state, 0.01, 500 + PAUSE_MS - 1, 0)).toBe('go');
    expect(shouldStop(state, 0.01, 500 + PAUSE_MS, 0)).toBe('done');
  });
  it('a word again restarts the pause, and silence alone ends with nothing', () => {
    const state: Endpoint = {};
    shouldStop(state, 0.2, 100, 0); shouldStop(state, 0.01, 200, 0);
    expect(shouldStop(state, 0.2, 1000, 0)).toBe('go');
    expect(shouldStop(state, 0.01, 1100, 0)).toBe('go');
    expect(shouldStop(state, 0.01, 1100 + PAUSE_MS - 50, 0)).toBe('go');
    expect(shouldStop({}, 0.01, NOBODY_MS, 0)).toBe('nothing');
  });
  it('never listens longer than the longest request', () => {
    const state: Endpoint = {};
    let verdict = 'go';
    for (let t = 0; t <= LONGEST_MS && verdict === 'go'; t += 100) verdict = shouldStop(state, 0.3, t, 0);
    expect(verdict).toBe('done');
  });
  it('records in a format Whisper reads: webm first, mp4 on Safari', () => {
    expect(recordingFormat(type => type.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(recordingFormat(type => type === 'audio/mp4')).toBe('audio/mp4');
    expect(recordingFormat(() => false)).toBeUndefined();
  });
  it('remembers how this screen speaks', () => {
    const store = new Map<string, string>();
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } as unknown as Storage;
    expect(readVoicePrefs()).toEqual({ speak: 'device', engine: undefined });
    writeVoicePrefs({ speak: 'ha', engine: 'tts.piper' });
    expect(readVoicePrefs()).toEqual({ speak: 'ha', engine: 'tts.piper' });
    store.set('mp-nexus.voice', '{"speak":"shout"}');
    expect(readVoicePrefs().speak).toBe('device');
  });
  it('tells every view of the dashboard when the voice changes', () => {
    const store = new Map<string, string>(), heard: unknown[] = [];
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } } as unknown as Storage;
    const target = new EventTarget();
    target.addEventListener(VOICE_EVENT, e => heard.push((e as CustomEvent).detail));
    const saved = globalThis.window;
    (globalThis as { window?: unknown }).window = target;
    try { writeVoicePrefs({ speak: 'ha', engine: 'tts.voix_nexus', voice: 'fr-FR-HenriNeural' }); }
    finally { (globalThis as { window?: unknown }).window = saved; }
    expect(heard).toEqual([{ speak: 'ha', engine: 'tts.voix_nexus', voice: 'fr-FR-HenriNeural' }]);
  });
});

describe('the wake word while Nexus is open', () => {
  it('knows a request that is only the wake word', async () => {
    const { onlyWakeWord } = await import('../frontend/v2/voice');
    expect(onlyWakeWord('Nexus.', 'Nexus')).toBe(true);
    expect(onlyWakeWord('Hey, Nexus !', 'Nexus')).toBe(true);
    expect(onlyWakeWord('Nexus, allume la cuisine', 'Nexus')).toBe(false);
    expect(onlyWakeWord('Néxus', 'Nexus')).toBe(true);
  });
});
