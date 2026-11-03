import type { Hass } from '../ha/client';

/** How Nexus speaks on this screen: with the voice of the device, with a Home Assistant voice (Piper, Nabu Casa…), or not at all. */
export interface VoicePrefs { speak: 'device'|'ha'|'off'; engine?: string }
const VOICE_KEY = 'mp-nexus.voice';
export function readVoicePrefs(): VoicePrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') as Partial<VoicePrefs>;
    return { speak: saved.speak === 'ha' || saved.speak === 'off' ? saved.speak : 'device', engine: typeof saved.engine === 'string' && saved.engine ? saved.engine : undefined };
  } catch { return { speak: 'device' }; }
}
export function writeVoicePrefs(prefs: VoicePrefs) {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(prefs)); } catch { /* The choice holds for this page only. */ }
}

/** Whether the integration can turn speech into text (an AI key is set). */
export async function canTranscribe(hass: Hass) {
  try { return (await hass.callWS<{ transcription?: boolean }>({ type: 'mp_glass/assistant/info' })).transcription === true; }
  catch { return false; }
}

/** The recording formats the provider reads, the best first; Safari records in mp4, the others in webm or ogg. */
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac'];
export function recordingFormat(supported: (type: string) => boolean = type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
  return FORMATS.find(type => { try { return supported(type); } catch { return false; } });
}
export const canRecord = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && !!recordingFormat();

/**
 * When to stop listening, from the loudness heard so far: after a pause once someone spoke,
 * after a long silence when nobody did, and in any case after the longest request.
 */
export interface Endpoint { spokeAt?: number; quietSince?: number }
export const SPEECH_LEVEL = 0.045, PAUSE_MS = 1300, NOBODY_MS = 7000, LONGEST_MS = 20000;
export function shouldStop(state: Endpoint, level: number, now: number, startedAt: number): 'go'|'done'|'nothing' {
  if (level >= SPEECH_LEVEL) { state.spokeAt = now; state.quietSince = undefined; }
  else if (state.quietSince === undefined) state.quietSince = now;
  if (now - startedAt >= LONGEST_MS) return state.spokeAt ? 'done' : 'nothing';
  if (state.spokeAt && state.quietSince !== undefined && now - state.quietSince >= PAUSE_MS) return 'done';
  if (!state.spokeAt && now - startedAt >= NOBODY_MS) return 'nothing';
  return 'go';
}

/** A recording of one request, which ends by itself at the pause and reports how loud it hears. */
export class Recorder {
  private stream?: MediaStream; private recorder?: MediaRecorder; private context?: AudioContext; private timer?: number;
  private chunks: Blob[] = []; private settle?: (blob: Blob | undefined) => void;
  readonly done: Promise<Blob | undefined>;
  constructor(private onLevel: (level: number) => void = () => undefined) {
    this.done = new Promise(resolve => { this.settle = resolve; });
  }
  async start() {
    const type = recordingFormat();
    if (!type) throw new Error('unsupported');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.recorder = new MediaRecorder(this.stream, { mimeType: type, audioBitsPerSecond: 32000 });
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    let heard = false;
    this.recorder.onstop = () => { this.release(); this.settle?.(heard && this.chunks.length ? new Blob(this.chunks, { type: this.recorder?.mimeType || type }) : undefined); };
    this.recorder.start(250);
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const startedAt = performance.now(), state: Endpoint = {};
    if (!Context) { this.timer = window.setTimeout(() => { heard = true; this.stop(); }, 6000); return; }
    this.context = new Context();
    const analyser = this.context.createAnalyser(); analyser.fftSize = 1024;
    this.context.createMediaStreamSource(this.stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const tick = () => {
      if (this.recorder?.state !== 'recording') return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const v of samples) sum += v * v;
      const level = Math.sqrt(sum / samples.length);
      this.onLevel(Math.min(1, level * 8));
      const verdict = shouldStop(state, level, performance.now(), startedAt);
      if (verdict === 'go') { this.timer = window.setTimeout(tick, 50); return; }
      heard = verdict === 'done'; this.recorder.stop();
    };
    tick();
    // Stopped by hand: what was said so far is sent, even before the pause.
    this.stopNow = () => { heard = !!state.spokeAt || performance.now() - startedAt > 1500; if (this.recorder?.state === 'recording') this.recorder.stop(); };
  }
  /** Ends the recording now and sends what was said. */
  stop() { this.stopNow(); }
  private stopNow = () => { if (this.recorder?.state === 'recording') this.recorder.stop(); };
  /** Ends the recording and drops it. */
  cancel() { this.settle?.(undefined); this.settle = undefined; if (this.recorder?.state === 'recording') this.recorder.stop(); else this.release(); }
  private release() {
    window.clearTimeout(this.timer);
    this.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => undefined);
    this.stream = undefined; this.context = undefined;
  }
}

async function base64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
/** What was said, read by Whisper through the integration. */
export async function transcribe(hass: Hass, audio: Blob, language: string) {
  const answer = await hass.callWS<{ text?: string }>({ type: 'mp_glass/assistant/transcribe', audio: await base64(audio), mime: audio.type || 'audio/webm', language });
  return (answer.text ?? '').trim();
}

/** A sentence being spoken, which can be cut short. */
export interface Speech { done: Promise<void>; stop(): void }
const silent: Speech = { done: Promise.resolve(), stop: () => undefined };

/** The voice of the device: free, offline on most phones and tablets. */
export function speakOnDevice(text: string, locale: string): Speech {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
  if (!synth || !text) return silent;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const lang = locale.toLowerCase().split('-')[0] ?? '';
  const voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang));
  utterance.voice = voices.find(v => v.lang.toLowerCase() === locale.toLowerCase() && /premium|enhanced|neural|natural|google/i.test(v.name)) ?? voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) ?? voices[0] ?? null;
  const done = new Promise<void>(resolve => { utterance.onend = () => resolve(); utterance.onerror = () => resolve(); });
  synth.speak(utterance);
  return { done, stop: () => synth.cancel() };
}

/** The text-to-speech engines Home Assistant offers for a language. */
export async function speechEngines(hass: Hass, language: string) {
  try {
    const answer = await hass.callWS<{ providers?: { engine_id: string; name?: string; deprecated?: boolean }[] }>({ type: 'tts/engine/list', language });
    return (answer.providers ?? []).filter(p => !p.deprecated).map(p => ({ id: p.engine_id, name: p.name ?? p.engine_id }));
  } catch { return []; }
}

/** One audio element, unlocked by the touch that opened the voice, so phones let it play the answer later. */
let player: HTMLAudioElement | undefined;
export function unlockAudio() {
  if (typeof Audio === 'undefined') return;
  player ??= new Audio();
  player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  void player.play().catch(() => undefined);
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}

/** A Home Assistant voice: the engine renders the sentence, the page plays it. */
export async function speakWithHomeAssistant(hass: Hass, text: string, language: string, engine: string): Promise<Speech> {
  if (!text || !hass.callApi) return silent;
  const { url } = await hass.callApi<{ url: string }>('POST', 'tts_get_url', { engine_id: engine, message: text, language });
  player ??= new Audio();
  const audio = player;
  audio.src = url;
  const done = new Promise<void>(resolve => { audio.onended = () => resolve(); audio.onerror = () => resolve(); });
  await audio.play();
  return { done, stop: () => { audio.pause(); audio.onended?.(new Event('ended')); } };
}
