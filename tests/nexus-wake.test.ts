import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHUNK, loadWakeModels, Resampler, WakePipeline, type WakeModels } from '../frontend/v2/wake';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/wake/${name}`, import.meta.url)));
const shared = { mel: new Uint8Array(readFileSync(new URL('../public/wake/melspectrogram.onnx', import.meta.url))), embed: new Uint8Array(readFileSync(new URL('../public/wake/embedding_model.onnx', import.meta.url))) };
/** 16 kHz mono PCM16 samples of a WAV, padded with a second of silence on each side, as openWakeWord's own tests do. */
function wav(name: string) {
  const bytes = fixture(name), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12, data = 0, size = 0;
  while (at < bytes.length - 8) { const id = String.fromCharCode(...bytes.subarray(at, at + 4)), len = view.getUint32(at + 4, true); if (id === 'data') { data = at + 8; size = len; break; } at += 8 + len; }
  const samples = new Float32Array(16000 * 2 + size / 2);
  for (let i = 0; i < size / 2; i++) samples[16000 + i] = view.getInt16(data + i * 2, true);
  return samples;
}
/** The same warm-up noise every run, so that the scores do not vary from one run to the next. */
function seeded(length = 64000) { let x = 1; return new Float32Array(length).map(() => { x = (x * 1103515245 + 12345) % 2147483648; return Math.round((x / 2147483648) * 2000 - 1000); }); }
async function best(word: string, clip: string) {
  const pipeline = new WakePipeline(await loadWakeModels(fixture(word), shared));
  await pipeline.warm(seeded());
  const audio = wav(clip);
  let top = 0;
  // Uneven pieces, as the microphone delivers them.
  for (let i = 0; i < audio.length; i += 700) top = Math.max(top, (await pipeline.push(audio.subarray(i, i + 700))) ?? 0);
  return top;
}

describe('wake word', () => {
  it('hears its word and nothing else, like openWakeWord itself', async () => {
    expect(await best('hey_mycroft_v0.1.onnx', 'hey_mycroft_test.wav')).toBeGreaterThan(0.9);
    expect(await best('hey_mycroft_v0.1.onnx', 'alexa_test.wav')).toBeLessThan(0.1);
  }, 60_000);
  it('the shipped « Hey Jarvis » loads and stays quiet on another word', async () => {
    const models = await loadWakeModels(new Uint8Array(readFileSync(new URL('../public/wake/hey_jarvis.onnx', import.meta.url))), shared);
    expect(models.frames).toBe(16);
    const pipeline = new WakePipeline(models);
    await pipeline.warm(seeded());
    const audio = wav('hey_mycroft_test.wav');
    let top = 0;
    for (let i = 0; i < audio.length; i += CHUNK) top = Math.max(top, (await pipeline.push(audio.subarray(i, i + CHUNK))) ?? 0);
    expect(top).toBeLessThan(0.1);
  }, 60_000);
  it('scores once per 80 ms chunk and ignores the first ones', async () => {
    let scored = 0;
    const fake: WakeModels = { frames: 16, mel: async x => new Float32Array(Math.floor((x.length - 400) / 160 + 1) * 32), embed: async (_w, n) => new Float32Array(n * 96), score: async () => { scored++; return 0.9; } };
    const pipeline = new WakePipeline(fake);
    expect(await pipeline.push(new Float32Array(CHUNK - 1))).toBeUndefined();
    const scores: (number | undefined)[] = [];
    for (let i = 0; i < 7; i++) scores.push(await pipeline.push(new Float32Array(i ? CHUNK : 1)));
    expect(scored).toBe(7);
    expect(scores.slice(0, 5).every(s => s === 0)).toBe(true);
    expect(scores[5]).toBe(0.9);
  });
  it('resamples 48 kHz and 44.1 kHz to 16 kHz in int16 range', () => {
    for (const rate of [48000, 44100]) {
      const r = new Resampler(rate);
      let out = 0;
      for (let k = 0; k < 10; k++) {
        const block = new Float32Array(rate / 10).map((_, i) => Math.sin(2 * Math.PI * 440 * (k * rate / 10 + i) / rate) * 0.5);
        const o = r.push(block); out += o.length;
        expect(Math.max(...o)).toBeLessThanOrEqual(32767);
        expect(Math.max(...o)).toBeGreaterThan(15000);
      }
      expect(Math.abs(out - 16000)).toBeLessThan(10);
    }
  });
});
