import type { Hass } from '../ha/client';
import { speakAsHologram } from './hologram';
import { unlockSound } from './sound';
import { playMedia, unlockMedia } from './media-output';
import { isAndroid } from './native-wake';
import type { TabletVolumeChoice } from './tablet-volume';

/** How Nexus speaks on this screen: with the voice of the device, with a Home Assistant voice (Piper, Nabu Casa…), or not at all. */
export interface VoicePrefs {
  speak: 'device'|'ha'|'off'; engine?: string;
  /** The voice chosen within the device's voices (its name) or within the engine's (its id); the best one when unset. */
  voice?: string;
  /** The « hologram » colour of the butler, for Home Assistant voices (the device's voice cannot be processed). */
  effect?: 'holo';
  /** The wake word this screen listens for, if any. */ wake?: string;
  /** Android Companion owns listening instead of the web page; commands target this explicitly paired device. */
  nativeWake?: 'android'; nativeWakeService?: string;
  /** For a word made from the voice: how readily it wakes, and whether the screen teaches it what it hears. */
  wakeSensitivity?: 'high'|'normal'|'low'; wakeLearn?: boolean;
  /** The short tone that says Nexus is listening after its name (on unless turned off). */
  wakeChime?: boolean;
  followWait?: 5|7|10|15;
  /** This screen's Home Assistant Android device and music-volume sensor. */
  tabletVolume?: TabletVolumeChoice;
}
const VOICE_KEY = 'mp-nexus.voice';
export function readVoicePrefs(): VoicePrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_KEY) ?? '{}') as Partial<VoicePrefs>;
    return { speak: saved.speak === 'ha' || saved.speak === 'off' ? saved.speak : 'device', engine: typeof saved.engine === 'string' && saved.engine ? saved.engine : undefined,
      voice: typeof saved.voice === 'string' && saved.voice ? saved.voice.slice(0, 200) : undefined, effect: saved.effect === 'holo' ? 'holo' : undefined,
      wake: typeof saved.wake === 'string' && /^[a-z0-9_]{1,40}$/.test(saved.wake) ? saved.wake : undefined,
      ...(saved.nativeWake === 'android' ? { nativeWake: 'android' as const } : {}),
      ...(typeof saved.nativeWakeService === 'string' && /^mobile_app_[a-z0-9_]+$/.test(saved.nativeWakeService) ? { nativeWakeService: saved.nativeWakeService } : {}),
      wakeSensitivity: saved.wakeSensitivity === 'high' || saved.wakeSensitivity === 'low' ? saved.wakeSensitivity : undefined,
      wakeLearn: saved.wakeLearn === false ? false : undefined, wakeChime: saved.wakeChime === false ? false : undefined,
      followWait: saved.followWait === 5 || saved.followWait === 10 || saved.followWait === 15 ? saved.followWait : undefined,
      ...(saved.tabletVolume && (saved.tabletVolume.service === '' || /^mobile_app_[a-z0-9_]+$/.test(saved.tabletVolume.service ?? '')) && (saved.tabletVolume.sensor === '' || /^sensor\.[a-z0-9_]+$/.test(saved.tabletVolume.sensor ?? '')) ? { tabletVolume: saved.tabletVolume } : {}) };
  } catch { return { speak: 'device' }; }
}
export function writeVoicePrefs(prefs: VoicePrefs) {
  try { localStorage.setItem(VOICE_KEY, JSON.stringify(prefs)); } catch { /* The choice holds for this page only. */ }
  // Every view of the dashboard keeps its own copy: the one that answers must hear about the change.
  try { window.dispatchEvent(new CustomEvent(VOICE_EVENT, { detail: prefs })); } catch { /* No window. */ }
}
/** Sent on the window when the voice settings change, so that every view of the dashboard speaks the same way. */
export const VOICE_EVENT = 'mp-nexus-voice-prefs';

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
export function shouldStop(state: Endpoint, level: number, now: number, startedAt: number, nobodyMs = NOBODY_MS): 'go'|'done'|'nothing' {
  if (level >= SPEECH_LEVEL) { state.spokeAt = now; state.quietSince = undefined; }
  else if (state.quietSince === undefined) state.quietSince = now;
  if (now - startedAt >= LONGEST_MS) return state.spokeAt ? 'done' : 'nothing';
  if (state.spokeAt && state.quietSince !== undefined && now - state.quietSince >= PAUSE_MS) return 'done';
  if (!state.spokeAt && now - startedAt >= nobodyMs) return 'nothing';
  return 'go';
}

/** A recording of one request, which ends by itself at the pause and reports how loud it hears. */
export class Recorder {
  private cancelled = false;
  private stream?: MediaStream; private recorder?: MediaRecorder; private context?: AudioContext; private timer?: number;
  private chunks: Blob[] = []; private settle?: (blob: Blob | undefined) => void;
  readonly done: Promise<Blob | undefined>;
  constructor(private onLevel: (level: number) => void = () => undefined, private nobodyMs = NOBODY_MS) {
    this.done = new Promise(resolve => { this.settle = resolve; });
  }
  async start() {
    const type = recordingFormat();
    if (!type) throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    this.recorder = new MediaRecorder(this.stream, { mimeType: type, audioBitsPerSecond: 32000 });
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    let heard = false;
    this.recorder.onstop = () => {
      const result = heard && this.chunks.length ? new Blob(this.chunks, { type: this.recorder?.mimeType || type }) : undefined;
      // Let Android release its recording audio session before the spoken answer starts.
      void this.release().then(() => { this.settle?.(result); this.settle = undefined; });
    };
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
      const verdict = shouldStop(state, level, performance.now(), startedAt, this.nobodyMs);
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
  cancel() { this.cancelled = true; this.settle?.(undefined); this.settle = undefined; if (this.recorder?.state === 'recording') this.recorder.stop(); void this.release(); }
  private async release() {
    window.clearTimeout(this.timer);
    const stream = this.stream, context = this.context;
    this.stream = undefined; this.context = undefined;
    stream?.getTracks().forEach(track => track.stop());
    if (context) {
      let timeout: number | undefined;
      try { await Promise.race([context.close().catch(() => undefined), new Promise<void>(resolve => { timeout = window.setTimeout(resolve, 1000); })]); }
      finally { window.clearTimeout(timeout); }
    }
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

/**
 * Only one tab of this device answers the wake word: each tab that hears it asks for the same lock, and the ones that
 * do not get it stay quiet. Resolves with the release of the lock, or undefined when another tab already answers.
 */
export function claimVoice(): Promise<(() => void) | undefined> {
  const locks = (navigator as unknown as { locks?: LockManager }).locks;
  if (!locks?.request) return Promise.resolve(() => undefined);
  return new Promise(resolve => {
    locks.request('mp-nexus-voice', { ifAvailable: true }, lock => {
      if (!lock) { resolve(undefined); return undefined; }
      return new Promise<void>(release => resolve(release));
    }).catch(() => resolve(() => undefined));
  });
}

/** A sentence being spoken, which can be cut short. */
export interface Speech { done: Promise<void>; stop(): void }
const silent: Speech = { done: Promise.resolve(), stop: () => undefined };

/** The device's voices for a language (they may arrive a moment after the page opens: see `onvoiceschanged`). */
export function deviceVoices(locale: string) {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
  const lang = locale.toLowerCase().split('-')[0] ?? '';
  return (synth?.getVoices() ?? []).filter(v => v.lang.toLowerCase().startsWith(lang));
}

/** The voice of the device: free, offline on most phones and tablets. `voice` is the name of one of its voices. */
export function speakOnDevice(text: string, locale: string, voice?: string): Speech {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
  if (!synth || !text) return silent;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voices = deviceVoices(locale);
  utterance.voice = (voice ? voices.find(v => v.name === voice) : undefined) ?? voices.find(v => v.lang.toLowerCase() === locale.toLowerCase() && /premium|enhanced|neural|natural|google/i.test(v.name)) ?? voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) ?? voices[0] ?? null;
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

/** The voices of a Home Assistant engine for a language (Piper, Edge TTS, ElevenLabs… each has its own). */
export async function engineVoices(hass: Hass, engine: string, language: string) {
  try {
    const answer = await hass.callWS<{ voices?: { voice_id: string; name?: string }[] | null }>({ type: 'tts/engine/voices', engine_id: engine, language });
    return (answer.voices ?? []).map(v => ({ id: v.voice_id, name: v.name ?? v.voice_id }));
  } catch { return []; }
}

/**
 * Whether the page can keep hearing the wake word while Nexus speaks. iPhones and iPads cannot: a page that holds the
 * microphone plays sound quietly, in the earpiece. Android releases it too while answering, to reduce audio route changes
 * on Bluetooth devices. A computer can keep listening with echo cancellation.
 */
export function micWhileSpeaking() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  return !/Android|iPhone|iPad|iPod/.test(ua) && !(/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/** On Android, use the installed Nexus TTS for the device-voice default so replies use the same media output as rings. */
export function mediaVoiceEngine(hass: Pick<Hass, 'entities'|'states'>, prefs: VoicePrefs, android = isAndroid()) {
  if (prefs.speak === 'ha' && prefs.engine) return prefs.engine;
  if (!android || prefs.speak !== 'device') return undefined;
  const entry = Object.values(hass.entities ?? {}).find(e => e.platform === 'mp_glass' && e.entity_id.startsWith('tts.') && hass.states[e.entity_id]?.state !== 'unavailable');
  if (entry && hass.states[entry.entity_id]) return entry.entity_id;
  return hass.states['tts.voix_nexus'] && hass.states['tts.voix_nexus'].state !== 'unavailable' ? 'tts.voix_nexus' : undefined;
}

/** A request that is only the wake word (said again while Nexus listened): Nexus listens afresh instead of answering « Nexus ». */
export function onlyWakeWord(text: string, word: string) {
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const said = plain(text), name = plain(word);
  return !!name && (said === name || said === `hey ${name}` || said === `ok ${name}` || said === `${name} ${name}`);
}

/**
 * What the page's sound is for, on iPhones and iPads (Safari 16.4+): « playback » while Nexus speaks, so that the answer
 * plays loud on the speaker even in a page that listens; « auto » again before listening.
 */
export function audioSession(type: 'playback' | 'auto') {
  if (typeof navigator === 'undefined' || !(/iPhone|iPad|iPod/.test(navigator.userAgent ?? '') || (/Macintosh/.test(navigator.userAgent ?? '') && (navigator.maxTouchPoints ?? 0) > 1))) return;
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (!session || session.type === type) return;
  try { session.type = type; } catch { /* Not on this device. */ }
}

/** One audio element, unlocked by the touch that opened the voice, so phones let it play the answer later. */
export function unlockAudio() {
  if (typeof Audio === 'undefined') return;
  unlockMedia();
  if (!isAndroid() && typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  if (!isAndroid()) unlockSound();
}

/** A Home Assistant voice: the engine renders the sentence, the page plays it. */
export function ttsPlaybackUrl(result: { url?: string; path?: string }) {
  // HA may return an internal URL (even 127.0.0.1) that the tablet cannot reach. Its TTS proxy is also accessible
  // from the same origin as this dashboard; preserve query parameters and do not rewrite unrelated provider URLs.
  for (const candidate of [result.path, result.url]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate, 'https://mp-nexus.invalid');
      if (['http:', 'https:'].includes(parsed.protocol) && parsed.pathname.startsWith('/api/tts_proxy/')) return `${parsed.pathname}${parsed.search}`;
    } catch { /* Try the next field. */ }
  }
  if (result.url) return result.url;
  throw new Error('Home Assistant did not return a playable TTS URL');
}

export async function speakWithHomeAssistant(hass: Hass, text: string, language: string, engine: string, voice?: string, effect?: 'holo', failed?: () => void, wanted: () => boolean = () => true): Promise<Speech> {
  if (!text) return silent;
  if (!hass.callApi) throw new Error('Home Assistant TTS unavailable');
  const ask = (lang: string) => hass.callApi!<{ url?: string; path?: string }>('POST', 'tts_get_url', { engine_id: engine, message: text, language: lang, ...(voice ? { options: { voice } } : {}) });
  // Engines want an exact language tag: some take « fr », others only « fr-FR ».
  const regional = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith(language.toLowerCase()) ? navigator.language : `${language}-${language.toUpperCase()}`;
  let result: { url?: string; path?: string };
  try { result = await ask(language); } catch (error) { if (regional === language) throw error; result = await ask(regional); }
  if (!wanted()) return silent;
  const url = ttsPlaybackUrl(result);
  if (effect === 'holo' && !isAndroid()) {
    // The colour is a bonus: when the page cannot process the sound, the plain voice plays.
    try { return await speakAsHologram(url); } catch { /* Plain voice below. */ }
  }
  const playback = playMedia(url, false, failed);
  try { await playback.ready; } catch (error) { playback.stop(); throw error; }
  return { done: playback.done, stop: playback.stop };
}
