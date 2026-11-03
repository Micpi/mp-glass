import type { Hass } from '../ha/client';

/**
 * The wake word, heard on the screen itself: openWakeWord's models run in the page (ONNX in WebAssembly), on the
 * microphone resampled to 16 kHz. Nothing leaves the device until the word is heard; then the voice of Nexus
 * takes over and records the request as when the orb is touched.
 *
 * The pipeline is openWakeWord's (github.com/dscripka/openWakeWord), streamed by 80 ms chunks: a melspectrogram
 * of the chunk, Google's speech embedding of the last 76 frames, and the word's model on the last embeddings.
 */
export const RATE = 16000, CHUNK = 1280, WINDOW = 76, BANDS = 32, FEATURES = 96;
const MEL_OVERLAP = 160 * 3, MEL_KEEP = 10 * 97, FEATURES_KEEP = 120;
/** Score above which the word counts, frames ignored while the buffers warm up, and the pause before it can count again. */
export const THRESHOLD = 0.5, WARMUP = 5, DEBOUNCE_MS = 2000;

/** The three models, as plain functions: easy to replace in tests. */
export interface WakeModels {
  /** Mel frames (×32) of int16-scaled samples, already transformed as openWakeWord does (x / 10 + 2). */
  mel(samples: Float32Array): Promise<Float32Array>;
  /** Embeddings (×96) of `count` windows of 76 mel frames. */
  embed(windows: Float32Array, count: number): Promise<Float32Array>;
  /** The word's score on the last embeddings. */
  score(features: Float32Array): Promise<number>;
  /** How many embeddings the word's model reads (16 for most). */
  frames: number;
}

export class WakePipeline {
  private raw = new Float32Array(0);
  private pending: number[] = [];
  private mel: Float32Array[] = [];
  private features: Float32Array[] = [];
  private scored = 0;
  private warmed: Float32Array[] = [];
  constructor(private models: WakeModels) {
    this.reset();
  }
  /** Forgets what was heard: after the word, its sound must not count a second time once listening resumes. */
  reset() {
    this.raw = new Float32Array(0); this.pending = []; this.scored = 0;
    this.mel = Array.from({ length: WINDOW }, () => new Float32Array(BANDS).fill(1));
    this.features = this.warmed.slice();
  }
  /** The embeddings start from noise, as in openWakeWord, so that the first seconds score like the rest. */
  async warm(noise: Float32Array = randomNoise(RATE * 4)) {
    const frames = await this.models.mel(noise), n = frames.length / BANDS;
    const windows: Float32Array[] = [];
    for (let i = 0; i + WINDOW <= n; i += 8) windows.push(frames.subarray(i * BANDS, (i + WINDOW) * BANDS));
    if (!windows.length) return;
    const flat = new Float32Array(windows.length * WINDOW * BANDS);
    windows.forEach((w, i) => flat.set(w, i * WINDOW * BANDS));
    const out = await this.models.embed(flat, windows.length);
    this.warmed = Array.from({ length: windows.length }, (_, i) => out.slice(i * FEATURES, (i + 1) * FEATURES));
    this.features = this.warmed.slice();
  }
  /** Adds int16-scaled 16 kHz samples; returns the best score of the chunks completed, if any. */
  async push(samples: ArrayLike<number>): Promise<number | undefined> {
    for (let i = 0; i < samples.length; i++) this.pending.push(samples[i]!);
    let best: number | undefined;
    while (this.pending.length >= CHUNK) {
      const chunk = Float32Array.from(this.pending.splice(0, CHUNK));
      const score = await this.chunk(chunk);
      best = best === undefined ? score : Math.max(best, score);
    }
    return best;
  }
  private async chunk(chunk: Float32Array) {
    const raw = new Float32Array(Math.min(this.raw.length + CHUNK, CHUNK + MEL_OVERLAP));
    raw.set(this.raw.subarray(this.raw.length - (raw.length - CHUNK)), 0);
    raw.set(chunk, raw.length - CHUNK);
    this.raw = raw;
    const frames = await this.models.mel(raw);
    for (let i = 0; i + BANDS <= frames.length; i += BANDS) this.mel.push(frames.slice(i, i + BANDS));
    if (this.mel.length > MEL_KEEP) this.mel.splice(0, this.mel.length - MEL_KEEP);
    const window = new Float32Array(WINDOW * BANDS);
    this.mel.slice(-WINDOW).forEach((f, i) => window.set(f, i * BANDS));
    this.features.push((await this.models.embed(window, 1)).slice(0, FEATURES));
    if (this.features.length > FEATURES_KEEP) this.features.splice(0, this.features.length - FEATURES_KEEP);
    const n = this.models.frames, input = new Float32Array(n * FEATURES);
    this.features.slice(-n).forEach((f, i) => input.set(f, (n - Math.min(n, this.features.length) + i) * FEATURES));
    const score = await this.models.score(input);
    return ++this.scored <= WARMUP ? 0 : score;
  }
}

function randomNoise(length: number) {
  const noise = new Float32Array(length);
  for (let i = 0; i < length; i++) noise[i] = Math.round(Math.random() * 2000 - 1000);
  return noise;
}

/** Takes the microphone's samples at any rate to 16 kHz, int16-scaled: an averaging filter, then linear interpolation. */
export class Resampler {
  private carry: number[] = [];
  private position = 0;
  constructor(private rate: number) {}
  push(input: Float32Array): Float32Array {
    const ratio = this.rate / RATE, width = Math.max(1, Math.floor(ratio));
    const source = this.carry.concat(Array.from(input));
    const out: number[] = [];
    let pos = this.position;
    while (pos + width + 1 < source.length) {
      const at = Math.floor(pos), frac = pos - at;
      let a = 0, b = 0;
      for (let k = 0; k < width; k++) { a += source[at + k]!; b += source[at + k + 1]!; }
      const v = ((a * (1 - frac) + b * frac) / width) * 32767;
      out.push(Math.max(-32768, Math.min(32767, Math.round(v))));
      pos += ratio;
    }
    const keep = Math.floor(pos);
    this.carry = source.slice(keep);
    this.position = pos - keep;
    return Float32Array.from(out);
  }
}

// ——— The models, with ONNX Runtime in WebAssembly ———
type Ort = typeof import('onnxruntime-web/wasm');
let runtime: Promise<Ort> | undefined;
const ort = () => runtime ??= import('onnxruntime-web/wasm').then(m => { m.env.wasm.numThreads = 1; m.env.logLevel = 'error'; return m; });
/** The shared models ship with the integration, next to the bundle (…/mp_glass_static/wake/). */
// The base in a variable keeps Vite from treating the path as an asset of the bundle: these files are copied as they are.
const here = import.meta.url;
export const wakeAsset = (name: string) => new URL(`../wake/${name}`, here).href;

async function session(source: string | Uint8Array) {
  const o = await ort();
  const bytes = typeof source === 'string' ? new Uint8Array(await (await fetch(source)).arrayBuffer()) : source;
  return o.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

export async function loadWakeModels(word: string | Uint8Array, shared: { mel: string | Uint8Array; embed: string | Uint8Array } = { mel: wakeAsset('melspectrogram.onnx'), embed: wakeAsset('embedding_model.onnx') }): Promise<WakeModels> {
  const o = await ort();
  const [mel, embed, kw] = await Promise.all([session(shared.mel), session(shared.embed), session(word)]);
  const shape = (kw as unknown as { inputMetadata?: { shape?: readonly (number | string)[] }[] }).inputMetadata?.[0]?.shape;
  const frames = typeof shape?.[1] === 'number' && shape[1] > 0 ? shape[1] : 16;
  const run = async (s: typeof mel, data: Float32Array, dims: number[]) => {
    const out = await s.run({ [s.inputNames[0]!]: new o.Tensor('float32', data, dims) });
    return out[s.outputNames[0]!]!.data as Float32Array;
  };
  return {
    frames,
    async mel(samples) { const out = await run(mel, samples, [1, samples.length]); return out.map(x => x / 10 + 2); },
    embed: (windows, count) => run(embed, windows, [count, WINDOW, BANDS, 1]),
    async score(features) { return (await run(kw, features, [1, frames, FEATURES]))[0] ?? 0; },
  };
}

// ——— Listening on the page ———
const WORKLET = `class MpWakeTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; }
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) { for (let i = 0; i < ch.length; i++) this.buf.push(ch[i]); if (this.buf.length >= 2048) { this.port.postMessage(Float32Array.from(this.buf)); this.buf = []; } } return true; }
}
registerProcessor('mp-wake-tap', MpWakeTap);`;

/** Listens for the word while the page is shown; `paused` drops the sound while Nexus records or speaks. */
export class WakeListener {
  private hold = false;
  private pipeline?: WakePipeline;
  private stream?: MediaStream; private context?: AudioContext; private node?: AudioNode;
  private busy = false; private queue: Float32Array[] = []; private last = 0;
  constructor(private models: WakeModels, private onWake: () => void, private threshold = THRESHOLD) {}
  get running() { return !!this.context && this.context.state === 'running'; }
  get paused() { return this.hold; }
  /** Paused while Nexus records or speaks; listening starts afresh afterwards. */
  set paused(on: boolean) {
    if (on === this.hold) return;
    this.hold = on;
    this.queue = [];
    if (!on) this.pipeline?.reset();
  }
  async start() {
    if (this.context) { if (this.context.state === 'suspended') await this.context.resume(); return; }
    const pipeline = this.pipeline = new WakePipeline(this.models);
    await pipeline.warm();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const context = this.context = new Context();
    const resampler = new Resampler(context.sampleRate);
    const source = context.createMediaStreamSource(this.stream);
    const feed = (samples: Float32Array) => {
      if (this.paused) return;
      this.queue.push(resampler.push(samples));
      void this.drain(pipeline);
    };
    if (context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      try { await context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      const node = new AudioWorkletNode(context, 'mp-wake-tap');
      node.port.onmessage = e => feed(e.data as Float32Array);
      source.connect(node);
      this.node = node;
    } else {
      const node = context.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = e => feed(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node); node.connect(context.destination);
      this.node = node;
    }
    if (context.state === 'suspended') await context.resume();
  }
  private async drain(pipeline: WakePipeline) {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const samples = this.queue.shift()!;
        const score = await pipeline.push(samples);
        if (score !== undefined && score >= this.threshold && !this.paused && performance.now() - this.last > DEBOUNCE_MS) {
          this.last = performance.now();
          this.queue = [];
          pipeline.reset();
          this.onWake();
        }
      }
    } finally { this.busy = false; }
  }
  stop() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    void this.context?.close().catch(() => undefined);
    this.node = undefined; this.stream = undefined; this.context = undefined; this.queue = [];
  }
}

// ——— The words this home can use ———
export interface WakeWord { id: string; name: string; custom?: boolean }
/** Ready to use: openWakeWord's « Hey Jarvis ». Words trained for this home (« Nexus ») are added in the integration. */
export const BUILT_IN: WakeWord[] = [{ id: 'hey_jarvis', name: 'Hey Jarvis' }];

export async function wakeWords(hass: Hass): Promise<WakeWord[]> {
  try {
    const answer = await hass.callWS<{ words?: { id: string; name: string }[] }>({ type: 'mp_glass/assistant/wake_words' });
    return [...(answer.words ?? []).map(w => ({ ...w, custom: true })), ...BUILT_IN];
  } catch { return BUILT_IN; }
}

/** The model of a word: shipped with the integration, or trained for this home and kept by Home Assistant. */
export async function wakeModel(hass: Hass, id: string): Promise<string | Uint8Array> {
  if (BUILT_IN.some(w => w.id === id)) return wakeAsset(`${id}.onnx`);
  const answer = await hass.callWS<{ model: string }>({ type: 'mp_glass/assistant/wake_word', word: id });
  return Uint8Array.from(atob(answer.model), c => c.charCodeAt(0));
}

export async function addWakeWord(hass: Hass, file: File): Promise<WakeWord> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const name = file.name.replace(/\.onnx$/i, '').replace(/[_-]+/g, ' ').replace(/\bv?\d+(\.\d+)*\b/g, '').trim();
  const answer = await hass.callWS<{ id: string; name: string }>({ type: 'mp_glass/assistant/wake_word/add', name: name || 'Nexus', model: btoa(text) });
  return { ...answer, custom: true };
}

export async function removeWakeWord(hass: Hass, id: string) {
  await hass.callWS({ type: 'mp_glass/assistant/wake_word/remove', word: id });
}
