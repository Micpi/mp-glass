import type { Hass } from '../ha/client';
import { base64Floats, CHUNK, FEATURES, loadSpeechModels, RATE, Resampler, WakePipeline, type VoiceModel, type WakeModels } from './wake';

/**
 * A wake word made from the user's voice: the word said a few times, two ordinary sentences, all turned into speech
 * embeddings on the screen. Home Assistant keeps only these numbers (they cannot be played back) and trains the word.
 */
export const WORD_TIMES = 5, WORD_MS = 2500, SENTENCE_MS = 5500;
/** Silence before each recording, as when the screen listens: the embeddings need a second to settle. */
const LEAD = RATE;

/** Records the microphone at 16 kHz (int16-scaled) for `ms`, with the same processing as the listening screen. */
export async function recordSamples(ms: number, onLevel: (level: number) => void = () => undefined, stopEarly?: { stop?: () => void }) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const context = new Context();
  try {
    if (context.state === 'suspended') await context.resume();
    const resampler = new Resampler(context.sampleRate), parts: Float32Array[] = [];
    const source = context.createMediaStreamSource(stream);
    const node = context.createScriptProcessor(2048, 1, 1);
    let total = 0;
    await new Promise<void>(resolve => {
      const timer = window.setTimeout(resolve, ms);
      if (stopEarly) stopEarly.stop = () => { window.clearTimeout(timer); resolve(); };
      node.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0; for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
        onLevel(Math.min(1, Math.sqrt(sum / input.length) * 8));
        const out = resampler.push(new Float32Array(input));
        parts.push(out); total += out.length;
      };
      source.connect(node); node.connect(context.destination);
    });
    node.disconnect(); source.disconnect();
    const samples = new Float32Array(total);
    let at = 0;
    for (const p of parts) { samples.set(p, at); at += p.length; }
    return samples;
  } finally {
    stream.getTracks().forEach(t => t.stop());
    void context.close().catch(() => undefined);
  }
}

/** Where speech is in a recording, in samples; undefined when nothing was said, or when it was cut at the end. */
export function speechSpan(samples: Float32Array): { start: number; end: number } | undefined {
  const step = 320, levels: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0; for (let k = i; k < i + step; k++) sum += samples[k]! * samples[k]!;
    levels.push(Math.sqrt(sum / step));
  }
  const loudest = Math.max(0, ...levels);
  if (loudest < 600) return undefined;
  const floor = loudest * 0.05;
  const first = levels.findIndex(l => l > floor), last = levels.length - 1 - [...levels].reverse().findIndex(l => l > floor);
  if (last >= levels.length - 3) return undefined;
  return { start: first * step, end: (last + 1) * step };
}

/**
 * A recording as speech embeddings, one per 80 ms, computed exactly as the listening screen does (WakePipeline),
 * after a second of silence: a word heard later then lines up with its prints frame for frame.
 */
export async function clipFrames(models: Pick<WakeModels, 'mel' | 'embed'>, samples: Float32Array) {
  const pipeline = new WakePipeline({ ...models, frames: 1, score: async () => 0 });
  const padded = new Float32Array(LEAD + samples.length);
  padded.set(samples, LEAD);
  const count = Math.floor(padded.length / CHUNK), frames = new Float32Array(count * FEATURES);
  for (let k = 0; k < count; k++) {
    await pipeline.push(padded.subarray(k * CHUNK, (k + 1) * CHUNK));
    frames.set(pipeline.lastWindow(1), k * FEATURES);
  }
  return frames;
}

/** Where the window of the word stops: embedding k hears the sound up to the end of chunk k; one more for the tail. */
export const endFrame = (endSample: number) => Math.ceil((LEAD + endSample) / CHUNK) + 1;

/** The recording made harder, as the screen may hear it: with a fan, a television far away, or spoken softly. */
export function variants(samples: Float32Array, seed = 1): Float32Array[] {
  let state = seed * 9301 + 49297;
  const random = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  let power = 0, n = 0;
  for (const v of samples) if (v) { power += v * v; n++; }
  power /= Math.max(1, n);
  const noisy = (snr: number, colour: number) => {
    const out = new Float32Array(samples.length), gain = Math.sqrt(power / 10 ** (snr / 10));
    let last = 0;
    const noise = new Float32Array(samples.length);
    let np = 0;
    for (let i = 0; i < samples.length; i++) { last = colour * last + (random() * 2 - 1); noise[i] = last; np += last * last; }
    const scale = gain / Math.sqrt(np / samples.length || 1);
    for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, samples[i]! + noise[i]! * scale));
    return out;
  };
  const soft = samples.map(v => v * 0.35);
  const echo = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) echo[i] = Math.max(-32768, Math.min(32767, samples[i]! + 0.45 * (samples[i - 1200] ?? 0) + 0.25 * (samples[i - 2600] ?? 0)));
  return [noisy(20, 0), noisy(10, 0.97), soft, echo];
}

export interface Enrolled { id: string; name: string; voice: VoiceModel }

/** Turns the recordings into embeddings and asks Home Assistant to make the word. */
export async function createVoiceWord(hass: Hass, name: string, words: Float32Array[], sentences: Float32Array[], models?: Pick<WakeModels, 'mel' | 'embed'>): Promise<Enrolled> {
  const speech = models ?? await loadSpeechModels();
  const recordings: { frames: string; end: number }[] = [], noisy: { frames: string; end: number; source: number }[] = [];
  for (const [i, samples] of words.entries()) {
    const span = speechSpan(samples);
    if (!span) continue;
    // Kept short: half a second after the word at most.
    const cut = samples.subarray(0, Math.min(samples.length, span.end + RATE / 2));
    const end = endFrame(span.end);
    recordings.push({ frames: base64Floats(await clipFrames(speech, cut)), end });
    for (const variant of variants(cut, i + 1)) noisy.push({ frames: base64Floats(await clipFrames(speech, variant)), end, source: recordings.length - 1 });
  }
  const spoken = await Promise.all(sentences.map(async s => base64Floats(await clipFrames(speech, s))));
  return hass.callWS<Enrolled>({ type: 'mp_glass/assistant/wake_word/create', name, recordings, noisy, sentences: spoken });
}
