import { playMedia } from './media-output';
import { isAndroid } from './native-wake';

/**
 * The sounds of Nexus: one audio context for the whole page, unlocked by the first touch (phones play nothing before),
 * the short tone that says « I am listening », and the ring of timers and alarms.
 */
let context: AudioContext | undefined;

export function audioContext() {
  if (context && context.state !== 'closed') return context;
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return undefined;
  try { context = new Context(); } catch { context = undefined; }
  return context;
}

/** Called from a touch: creates and wakes the context, with a silent blip, so that later sounds are allowed. */
export function unlockSound() {
  const c = audioContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  try {
    const o = c.createOscillator(), g = c.createGain();
    g.gain.value = 0.0001; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.02);
  } catch { /* No sound on this device. */ }
}

export interface Tone { at: number; hz: number; length: number; gain?: number; glide?: number }

/** Plays tones (seconds from now); resolves when the last one ends. Never rejects: no sound is better than an error. */
export async function playTones(tones: Tone[]) {
  const c = audioContext();
  if (!c || !tones.length) return;
  try {
    // Without a recent touch a browser may leave resume() pending forever: wait a moment, then go on in silence.
    if (c.state === 'suspended') await Promise.race([c.resume(), new Promise(resolve => window.setTimeout(resolve, 300))]);
    if (c.state !== 'running') return;
    const t0 = c.currentTime + 0.02;
    for (const tone of tones) {
      const o = c.createOscillator(), g = c.createGain(), start = t0 + tone.at, peak = tone.gain ?? 0.2;
      o.type = 'sine';
      o.frequency.setValueAtTime(tone.hz, start);
      if (tone.glide) o.frequency.exponentialRampToValueAtTime(tone.glide, start + tone.length * 0.6);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + tone.length);
      o.connect(g).connect(c.destination);
      o.start(start); o.stop(start + tone.length + 0.03);
    }
    const end = Math.max(...tones.map(t => t.at + t.length));
    await new Promise<void>(resolve => window.setTimeout(resolve, end * 1000 + 60));
  } catch { /* No sound on this device. */ }
}

/** Two rising notes. On Android they use the media output without opening a second audio context. */
export async function listenTone() {
  const tones = [{ at: 0, hz: 660, length: 0.13, gain: 0.22 }, { at: 0.11, hz: 990, length: 0.2, gain: 0.26 }];
  if (!isAndroid() || typeof Audio === 'undefined') return playTones(tones);
  const media = playMedia(toneWave(tones, .38));
  let timeout: number | undefined;
  try { await Promise.race([media.ready.then(() => media.done), new Promise<void>(resolve => { timeout = window.setTimeout(resolve, 800); })]); }
  catch { /* The chime must not prevent the request from being recorded. */ }
  finally { window.clearTimeout(timeout); media.stop(); }
}

/** A short PCM wave, so Android can play a ring through the same media element as a spoken reply. */
function toneWave(tones: Tone[], duration: number) {
  const rate = 22050, count = Math.round(rate * duration);
  const data = new Uint8Array(44 + count * 2), view = new DataView(data.buffer);
  const put = (at: number, text: string) => { for (let i = 0; i < text.length; i++) data[at + i] = text.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, data.length - 8, true); put(8, 'WAVE'); put(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    let value = 0;
    for (const tone of tones) { const elapsed = t - tone.at; if (elapsed >= 0 && elapsed < tone.length) value += Math.sin(2 * Math.PI * tone.hz * elapsed) * Math.min(1, elapsed / .015, (tone.length - elapsed) / .025) * (tone.gain ?? .3); }
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
  }
  let binary = '';
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
}
export function ringWave(kind: 'timer' | 'alarm') {
  const tones = kind === 'alarm' ? [440, 554, 659, 880].map((hz, i) => ({ at: i * .22, hz, length: .2 })) : [0, .18, .36, .54].map(at => ({ at, hz: 1320, length: .1 }));
  return toneWave(tones, kind === 'alarm' ? 1.6 : 1.3);
}
const waves: Partial<Record<'timer'|'alarm', string>> = {};

export function ringSound(kind: 'timer' | 'alarm', onBlocked: (blocked: boolean) => void = () => undefined) {
  if (isAndroid() && typeof Audio !== 'undefined') {
    let stopped = false, media: ReturnType<typeof playMedia> | undefined;
    const start = () => {
      if (stopped) return;
      media?.stop();
      media = playMedia(waves[kind] ??= ringWave(kind), true, () => onBlocked(true));
      void media.ready.then(() => { if (!stopped) onBlocked(false); }, () => undefined);
    };
    start();
    try { navigator.vibrate?.(kind === 'alarm' ? [300, 150, 300] : [120, 80, 120]); } catch { /* No vibration. */ }
    return { pause() { media?.pause(); }, resume() { if (media) void media.resume().catch(() => undefined); }, retry: start, stop() { stopped = true; media?.stop(); } };
  }
  let timer: number | undefined, paused = false, stopped = false;
  const pattern: Tone[] = kind === 'alarm'
    ? [440, 554, 659, 880].map((hz, i) => ({ at: i * 0.22, hz, length: 0.2, gain: 0.32 }))
    : [0, 0.18, 0.36, 0.54].map(at => ({ at, hz: 1320, length: 0.1, gain: 0.3 }));
  const cycle = kind === 'alarm' ? 1.6 : 1.3;
  const next = () => {
    if (stopped) return;
    if (!paused) {
      void playTones(pattern);
      try { navigator.vibrate?.(kind === 'alarm' ? [300, 150, 300] : [120, 80, 120]); } catch { /* No vibration. */ }
    }
    timer = window.setTimeout(next, cycle * 1000);
  };
  next();
  return {
    pause() { paused = true; },
    resume() { paused = false; },
    retry() { unlockSound(); paused = false; },
    stop() { stopped = true; window.clearTimeout(timer); },
  };
}
