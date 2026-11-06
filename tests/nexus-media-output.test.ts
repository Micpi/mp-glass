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
  it('unlocks and plays the listening tone without opening a Web Audio context', async () => {
    const Context = vi.fn();
    vi.stubGlobal('window', { AudioContext: Context, setTimeout, clearTimeout });
    const { unlockAudio } = await import('../frontend/v2/voice');
    const { listenTone } = await import('../frontend/v2/sound');
    unlockAudio();
    const tone = listenTone();
    await Promise.resolve();
    expect(Context).not.toHaveBeenCalled();
    expect(AudioDouble.instances).toHaveLength(1);
    expect(AudioDouble.instances[0]!.src).toMatch(/^data:audio\/wav;base64,/);
    AudioDouble.instances[0]!.onended?.();
    await tone;
  });
  it('plays Nexus MP3 returned by the existing Home Assistant connection without requesting a TTS URL', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    const callWS = vi.fn().mockResolvedValue({ audio: 'SUQz', mime: 'audio/mpeg' });
    const callApi = vi.fn();
    const hass = { callWS, callApi };
    const speech = await speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.voix_nexus', 'fr-FR-RemyNeural');
    expect(callWS).toHaveBeenCalledWith({ type: 'mp_glass/assistant/voice_audio', engine: 'tts.voix_nexus', message: 'Bonjour', language: 'fr', voice: 'fr-FR-RemyNeural' });
    expect(callApi).not.toHaveBeenCalled();
    expect(AudioDouble.instances[0]!.src).toBe('data:audio/mpeg;base64,SUQz');
    speech.stop();
  });
  it('does not start a direct Nexus voice after the request is cancelled', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    let finish!: (value: { audio: string; mime: string }) => void;
    const hass = { callWS: () => new Promise<{ audio: string; mime: string }>(resolve => { finish = resolve; }) };
    let wanted = true;
    const speaking = speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.voix_nexus', undefined, undefined, undefined, () => wanted);
    wanted = false; finish({ audio: 'SUQz', mime: 'audio/mpeg' }); await speaking;
    expect(AudioDouble.instances).toHaveLength(0);
  });
  it('keeps the direct Nexus service error code for the user-facing diagnostic', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    const hass = { callWS: vi.fn().mockRejectedValue({ code: 'nexus_voice_unavailable' }) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try { await expect(speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.voix_nexus')).rejects.toMatchObject({ stage: 'generation', reason: 'nexus_voice_unavailable' }); }
    finally { warn.mockRestore(); }
  });
  it('stops the remaining voice clips when a timer takes the shared media player', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    const { ringSound } = await import('../frontend/v2/sound');
    const buffer = { sampleRate: 2, length: 17, numberOfChannels: 1, getChannelData: () => new Float32Array(17) };
    vi.stubGlobal('window', { OfflineAudioContext: class { decodeAudioData() { return Promise.resolve(buffer); } } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:1').mockReturnValueOnce('blob:2').mockReturnValueOnce('blob:3');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    try {
      const hass = { callWS: vi.fn().mockResolvedValue({ audio: 'SUQz', mime: 'audio/mpeg' }) };
      const speech = await speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.voix_nexus');
      expect(AudioDouble.instances[0]!.src).toBe('blob:1');
      const ring = ringSound('timer'); await speech.done;
      expect(AudioDouble.instances[0]!.src).toMatch(/^data:audio\/wav;base64,/);
      expect(revoke).toHaveBeenCalledTimes(3);
      ring.stop();
    } finally { create.mockRestore(); revoke.mockRestore(); }
  });
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
    const speech = speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.other', undefined, undefined, undefined, () => wanted);
    const ring = ringSound('timer'); await Promise.resolve();
    wanted = false; answer({ url: '/voice.mp3' }); await speech;
    expect(AudioDouble.instances).toHaveLength(1);
    expect(AudioDouble.instances[0]!.src).toMatch(/^data:audio\/wav;base64,/);
    ring.stop();
  });
  it('downloads Android TTS into a local media source and revokes it after playback', async () => {
    const { speakWithHomeAssistant } = await import('../frontend/v2/voice');
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:voice');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const fetcher = vi.fn().mockResolvedValue(new Response(new Blob(['audio'], { type: 'audio/mpeg' })));
    vi.stubGlobal('fetch', fetcher);
    try {
      const hass = { callApi: async () => ({ path: '/api/tts_proxy/test.mp3' }) };
      const speech = await speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.other');
      expect(fetcher).toHaveBeenCalledWith('/api/tts_proxy/test.mp3');
      expect(AudioDouble.instances[0]!.src).toBe('blob:voice');
      speech.stop(); await speech.done;
      expect(revoke).toHaveBeenCalledWith('blob:voice');
    } finally { create.mockRestore(); revoke.mockRestore(); }
  });
  it('reports an HTTP error from the TTS proxy rather than treating it as an audio output problem', async () => {
    const { speakWithHomeAssistant, VoicePlaybackError } = await import('../frontend/v2/voice');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    const hass = { callApi: async () => ({ path: '/api/tts_proxy/test.mp3' }) };
    const result = speakWithHomeAssistant(hass as never, 'Bonjour', 'fr', 'tts.other');
    await expect(result).rejects.toBeInstanceOf(VoicePlaybackError);
    await expect(result).rejects.toMatchObject({ stage: 'download', status: 500 });
    expect(AudioDouble.instances).toHaveLength(0);
  });
});
