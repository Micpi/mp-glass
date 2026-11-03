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
    if (c.state === 'suspended') await c.resume();
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

/** Two rising notes, clear but gentle: Nexus heard its name and listens. Resolves when it has ended, so listening can start after it. */
export const listenTone = () => playTones([{ at: 0, hz: 660, length: 0.13, gain: 0.22 }, { at: 0.11, hz: 990, length: 0.2, gain: 0.26 }]);

/** The ring of a timer (quick beeps) or an alarm (a rising melody) until `stop()`; `pause()` keeps it quiet while Nexus listens. */
export function ringSound(kind: 'timer' | 'alarm') {
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
    stop() { stopped = true; window.clearTimeout(timer); },
  };
}
