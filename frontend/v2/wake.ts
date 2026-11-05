import type { Hass } from '../ha/client';
// The same file the runtime would fetch by itself; handing it over lets it come from the browser's storage.
import wasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';

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
/** Chunks (80 ms) between two ordinary sounds kept to teach a voice word: about one every 12 s. */
const AMBIENT_EVERY = 150;

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
  /** The last 16 embeddings, as the word's model reads them: what a screen sends to teach a voice word. */
  lastWindow(frames = 16) {
    const out = new Float32Array(frames * FEATURES);
    this.features.slice(-frames).forEach((f, i) => out.set(f, (frames - Math.min(frames, this.features.length) + i) * FEATURES));
    return out;
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

/**
 * The runtime and the models are kept in the browser's own storage: through a slow connection they took up to twenty
 * seconds at every page load, and the HTTP cache did not always keep them. The key leaves out the query, so an update of
 * the dashboard does not download them again; a new runtime has a new file name.
 */
const STORE = 'mp-nexus-wake-1';
export async function cachedBytes(url: string): Promise<Uint8Array> {
  const key = url.split('?')[0]!;
  let store: Cache | undefined;
  try { store = typeof caches !== 'undefined' ? await caches.open(STORE) : undefined; } catch { /* Private window: no storage. */ }
  try { const hit = await store?.match(key); if (hit) return new Uint8Array(await hit.arrayBuffer()); } catch { /* Read again below. */ }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  try { await store?.put(key, new Response(bytes.slice(), { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* Full: next time from the network. */ }
  return bytes;
}

const ort = () => runtime ??= Promise.all([import('onnxruntime-web/wasm'), cachedBytes(wasmUrl).catch(() => undefined)]).then(([m, wasm]) => {
  m.env.wasm.numThreads = 1; m.env.logLevel = 'error';
  if (wasm) m.env.wasm.wasmBinary = wasm;
  return m;
});
/** The shared models ship with the integration, next to the bundle (…/mp_glass_static/wake/). */
// The base in a variable keeps Vite from treating the path as an asset of the bundle: these files are copied as they are.
const here = import.meta.url;
export const wakeAsset = (name: string) => new URL(`../wake/${name}`, here).href;

async function session(source: string | Uint8Array) {
  // The runtime and the file download together.
  const [o, bytes] = await Promise.all([ort(), typeof source === 'string' ? cachedBytes(source) : source]);
  return o.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

type Shared = { mel: string | Uint8Array; embed: string | Uint8Array };
const SHARED: Shared = { mel: '', embed: '' };
const sharedSources = (): Shared => ({ mel: SHARED.mel || wakeAsset('melspectrogram.onnx'), embed: SHARED.embed || wakeAsset('embedding_model.onnx') });

/** The two models every word shares: sound to mel frames, mel frames to speech embeddings. */
export async function loadSpeechModels(shared: Shared = sharedSources()): Promise<Pick<WakeModels, 'mel' | 'embed'>> {
  const o = await ort();
  const [mel, embed] = await Promise.all([session(shared.mel), session(shared.embed)]);
  const run = async (s: typeof mel, data: Float32Array, dims: number[]) => {
    const out = await s.run({ [s.inputNames[0]!]: new o.Tensor('float32', data, dims) });
    return out[s.outputNames[0]!]!.data as Float32Array;
  };
  return {
    async mel(samples) { const out = await run(mel, samples, [1, samples.length]); return out.map(x => x / 10 + 2); },
    embed: (windows, count) => run(embed, windows, [count, WINDOW, BANDS, 1]),
  };
}

export async function loadWakeModels(word: string | Uint8Array | VoiceModel, shared: Shared = sharedSources(), sensitivity: Sensitivity = 'normal'): Promise<WakeModels> {
  if (isVoice(word)) {
    const speech = await loadSpeechModels(shared), judge = voiceJudge(word, sensitivity);
    return { ...speech, frames: 16, score: async features => judge(features) };
  }
  const o = await ort();
  const [speech, kw] = await Promise.all([loadSpeechModels(shared), session(word)]);
  const shape = (kw as unknown as { inputMetadata?: { shape?: readonly (number | string)[] }[] }).inputMetadata?.[0]?.shape;
  const frames = typeof shape?.[1] === 'number' && shape[1] > 0 ? shape[1] : 16;
  return {
    ...speech, frames,
    async score(features) {
      const out = await kw.run({ [kw.inputNames[0]!]: new o.Tensor('float32', features, [1, frames, FEATURES]) });
      return (out[kw.outputNames[0]!]!.data as Float32Array)[0] ?? 0;
    },
  };
}

// ——— Words made from the user's voice: prints and a small judge, trained by Home Assistant (wake_trainer.py) ———
export type Sensitivity = 'high' | 'normal' | 'low';
const SENSITIVITY: Record<Sensitivity, number> = { high: -0.08, normal: -0.05, low: -0.02 };
export interface VoiceModel {
  kind: 'voice'; center: string; prints: string; count: number; own: number; near: number;
  judge?: { mean: string; std: string; w1: string; b1: string; w2: string; b2: number; hidden: number; threshold: number };
  stats?: Record<string, number>; trained?: number;
}
const isVoice = (word: unknown): word is VoiceModel => typeof word === 'object' && !!word && (word as VoiceModel).kind === 'voice';
export const floats = (text: string) => {
  const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
};
export const base64Floats = (values: Float32Array) => {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};
/**
 * The prints' threshold: near the recordings' own closeness (the same rule as wake_trainer.py). Without a judge it stays
 * above the closest background sound too; with one, the judge keeps the background out, or a voice whose word comes no
 * closer than the background is never heard.
 */
export const voiceThreshold = (own: number, near: number, sensitivity: Sensitivity = 'normal', judged = false) => {
  const gate = own + (SENSITIVITY[sensitivity] ?? -0.05);
  return Math.min(0.97, judged ? gate : Math.max(gate, near + 0.03));
};

/** Scores a window of 16 embeddings: 0.5 and above when it is the word (close to the prints, and the judge agrees). */
export function voiceJudge(model: VoiceModel, sensitivity: Sensitivity = 'normal') {
  const center = floats(model.center), prints = floats(model.prints), count = model.count, size = 16 * FEATURES;
  const j = model.judge, threshold = voiceThreshold(model.own, model.near, sensitivity, !!j);
  const hidden = j?.hidden ?? 0;
  const mean = j ? floats(j.mean) : undefined, std = j ? floats(j.std) : undefined, w1 = j ? floats(j.w1) : undefined, b1 = j ? floats(j.b1) : undefined, w2 = j ? floats(j.w2) : undefined;
  const frame = new Float32Array(FEATURES), sims = new Float64Array(count), x = new Float32Array(size), h = new Float64Array(hidden);
  return (window: Float32Array) => {
    sims.fill(0);
    for (let f = 0; f < 16; f++) {
      let norm = 0;
      for (let d = 0; d < FEATURES; d++) { const v = window[f * FEATURES + d]! - center[d]!; frame[d] = v; norm += v * v; }
      norm = Math.sqrt(norm) + 1e-6;
      for (let t = 0; t < count; t++) {
        let dot = 0;
        const at = t * size + f * FEATURES;
        for (let d = 0; d < FEATURES; d++) dot += frame[d]! * prints[at + d]!;
        sims[t] = sims[t]! + dot / norm / 16;
      }
    }
    const best = Array.from(sims).sort((a, b) => b - a), close = count > 1 ? (best[0]! + best[1]!) / 2 : best[0]!;
    if (close < threshold) return 0.49 * Math.max(0, close) / threshold;
    if (!j) return 0.5 + 0.5 * close;
    for (let i = 0; i < size; i++) x[i] = (window[i]! - mean![i]!) / std![i]!;
    h.fill(0);
    for (let i = 0; i < size; i++) { const v = x[i]!; if (!v) continue; const row = i * hidden; for (let k = 0; k < hidden; k++) h[k] = h[k]! + v * w1![row + k]!; }
    let z = j.b2;
    for (let k = 0; k < hidden; k++) z += Math.max(0, h[k]! + b1![k]!) * w2![k]!;
    const p = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
    return p >= j.threshold ? 0.5 + 0.5 * p : 0.49 * p;
  };
}

// ——— Listening on the page ———
const WORKLET = `class MpWakeTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; }
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) { for (let i = 0; i < ch.length; i++) this.buf.push(ch[i]); if (this.buf.length >= 2048) { this.port.postMessage(Float32Array.from(this.buf)); this.buf = []; } } return true; }
}
registerProcessor('mp-wake-tap', MpWakeTap);`;

const microphone = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });

/** Listens for the word while the page is shown; `paused` drops the sound while Nexus records or speaks. */
export class WakeListener {
  private hold = false;
  private pipeline?: WakePipeline;
  private stream?: MediaStream; private context?: AudioContext; private node?: AudioNode; private source?: MediaStreamAudioSourceNode;
  private micBusy?: Promise<void>; private micOff = false; private stopped = false;
  private busy = false; private queue: Float32Array[] = []; private last = 0; private chunks = 0;
  /** The 16 embeddings that woke Nexus: a voice word learns from them, as the word or as a false wake. */
  heard?: Float32Array;
  /** Called with an ordinary sound of the home about every 12 s of listening, when set: a voice word learns from them. */
  onAmbient?: (window: Float32Array) => void;
  /** Called with each score (0.5 and above wakes Nexus), when set: the settings show how close the word comes. */
  onScore?: (score: number) => void;
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
    if (this.stopped) return;
    if (this.context) { if (this.context.state === 'suspended') await this.context.resume(); return; }
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => { this.starting = undefined; });
    return this.starting;
  }
  private starting?: Promise<void>;
  /**
   * Stopped while it was still starting (the page was hidden, Home Assistant moved the view), it lets go of everything
   * it took: a listener left running in a page nobody sees answered a second time, with a second tone.
   */
  private async open() {
    const pipeline = this.pipeline = new WakePipeline(this.models);
    await pipeline.warm();
    if (this.stopped) return;
    const stream = await microphone();
    if (this.stopped) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const context = this.context = new Context();
    const resampler = new Resampler(context.sampleRate);
    const source = this.source = context.createMediaStreamSource(this.stream);
    const feed = (samples: Float32Array) => {
      if (this.paused) return;
      this.queue.push(resampler.push(samples));
      void this.drain(pipeline);
    };
    if (context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      try { await context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      if (this.stopped) { this.stop(); return; }
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
  /**
   * Lets go of the microphone while Nexus records or speaks, and takes it back afterwards. On iPhones a page that holds
   * the microphone plays sound quietly, in the earpiece, and a second recording silences the first one.
   */
  mic(on: boolean) {
    if (on === !this.micOff) return this.micBusy ?? Promise.resolve();
    this.micOff = !on;
    const previous = this.micBusy ?? Promise.resolve();
    return this.micBusy = previous.then(async () => {
      if (!this.context || !this.node) return;
      if (!on) {
        this.source?.disconnect(); this.source = undefined;
        this.stream?.getTracks().forEach(t => t.stop()); this.stream = undefined;
        return;
      }
      if (this.stream || this.micOff) return;
      try {
        const stream = await microphone();
        if (this.micOff || !this.context) { stream.getTracks().forEach(t => t.stop()); return; }
        this.stream = stream;
        this.source = this.context.createMediaStreamSource(stream);
        this.source.connect(this.node);
        this.pipeline?.reset();
        if (this.context.state === 'suspended') await this.context.resume();
      } catch (error) { console.warn('MP Nexus: wake word microphone', error); }
    });
  }
  private async drain(pipeline: WakePipeline) {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const samples = this.queue.shift()!;
        const score = await pipeline.push(samples);
        this.chunks += samples.length / CHUNK;
        if (score !== undefined && !this.paused) this.onScore?.(score);
        // Sounds teach more than silence: one is taken when something is heard, or after a long quiet anyway.
        let energy = 0;
        for (let i = 0; i < samples.length; i++) energy += samples[i]! * samples[i]!;
        const loud = Math.sqrt(energy / Math.max(1, samples.length)) > 300;
        if (this.onAmbient && (loud ? this.chunks >= AMBIENT_EVERY : this.chunks >= AMBIENT_EVERY * 4) && score !== undefined && score < this.threshold / 2 && !this.paused) {
          this.chunks = 0;
          this.onAmbient(pipeline.lastWindow());
        }
        if (this.stopped) return;
        if (score !== undefined && score >= this.threshold && !this.paused && performance.now() - this.last > DEBOUNCE_MS) {
          this.last = performance.now();
          this.heard = pipeline.lastWindow();
          this.queue = [];
          pipeline.reset();
          this.onWake();
        }
      }
    } finally { this.busy = false; }
  }
  stop() {
    this.stopped = true;
    this.micOff = true;
    this.source?.disconnect(); this.source = undefined;
    this.node?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    void this.context?.close().catch(() => undefined);
    this.node = undefined; this.stream = undefined; this.context = undefined; this.queue = [];
  }
}

// ——— The words this home can use ———
export interface WakeWord { id: string; name: string; custom?: boolean; kind?: 'model' | 'voice' }
/** Ready to use: openWakeWord's « Hey Jarvis ». Words trained for this home (« Nexus ») are added in the integration. */
export const BUILT_IN: WakeWord[] = [{ id: 'hey_jarvis', name: 'Hey Jarvis' }];

/** `failed` marks a list made while Home Assistant did not answer (restarting, integration loading): to ask again. */
export async function wakeWords(hass: Hass): Promise<WakeWord[] & { failed?: boolean }> {
  try {
    const answer = await hass.callWS<{ words?: { id: string; name: string; kind?: 'model' | 'voice' }[] }>({ type: 'mp_glass/assistant/wake_words' });
    return [...(answer.words ?? []).map(w => ({ ...w, custom: true })), ...BUILT_IN];
  } catch { return Object.assign([...BUILT_IN], { failed: true }); }
}

/** The model of a word: shipped with the integration, or trained for this home and kept by Home Assistant. */
/** `moved` hears the id of the twin that replaced a word removed from another screen. */
export async function wakeModel(hass: Hass, id: string, moved?: (id: string) => void): Promise<string | Uint8Array | VoiceModel> {
  if (BUILT_IN.some(w => w.id === id)) return wakeAsset(`${id}.onnx`);
  const answer = await hass.callWS<{ id?: string; model?: string; voice?: VoiceModel }>({ type: 'mp_glass/assistant/wake_word', word: id });
  if (answer.id && answer.id !== id) moved?.(answer.id);
  if (answer.voice) return answer.voice;
  return Uint8Array.from(atob(answer.model ?? ''), c => c.charCodeAt(0));
}

export async function addWakeWord(hass: Hass, file: File): Promise<WakeWord> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const name = file.name.replace(/\.onnx$/i, '').replace(/[_-]+/g, ' ').replace(/\bv?\d+(\.\d+)*\b/g, '').trim();
  const answer = await hass.callWS<{ id: string; name: string }>({ type: 'mp_glass/assistant/wake_word/add', name: name || 'Nexus', model: btoa(text) });
  return { ...answer, custom: true };
}

/** Home Assistant's answer when the word was removed (from another screen) and nothing of its name replaced it. */
export const wakeGone = (error: unknown) => typeof error === 'object' && !!error && (error as { code?: string }).code === 'not_found';

export async function removeWakeWord(hass: Hass, id: string) {
  await hass.callWS({ type: 'mp_glass/assistant/wake_word/remove', word: id });
}

/** Teaches a voice word what a screen heard: ordinary sounds, the word that woke Nexus for a request, a cancelled false wake. */
export async function learnWake(hass: Hass, id: string, lesson: { ambient?: Float32Array[]; confirmed?: Float32Array[]; cancelled?: Float32Array[] }) {
  const pack = (list?: Float32Array[]) => {
    if (!list?.length) return undefined;
    const all = new Float32Array(list.length * 16 * FEATURES);
    list.forEach((w, i) => all.set(w, i * 16 * FEATURES));
    return base64Floats(all);
  };
  const message: Record<string, unknown> = { type: 'mp_glass/assistant/wake_word/learn', word: id };
  for (const key of ['ambient', 'confirmed', 'cancelled'] as const) { const packed = pack(lesson[key]); if (packed) message[key] = packed; }
  await hass.callWS(message);
}

/** Words with the same name are told apart by a number: « Nexus », « Nexus · 2 »… */
export function wakeLabels(words: WakeWord[]): [WakeWord, string][] {
  const seen = new Map<string, number>(), total = new Map<string, number>();
  for (const w of words) total.set(w.name.toLowerCase(), (total.get(w.name.toLowerCase()) ?? 0) + 1);
  return words.map(w => {
    const key = w.name.toLowerCase(), n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return [w, (total.get(key) ?? 0) > 1 ? `${w.name} · ${n}` : w.name];
  });
}
