import { audioContext } from './sound';
import type { Speech } from './voice';

/** The impulse of a small, bright room: noise that fades in `seconds`, a little different on each side. */
function impulse(c: BaseAudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(c.sampleRate * seconds)), buffer = c.createBuffer(2, length, c.sampleRate);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = random() * Math.pow(1 - i / length, 3);
  }
  return buffer;
}

/**
 * The « hologram » colour of the butler: a voice a little narrower and brighter, a faint shimmer (a short modulated delay)
 * and a small room. Built between `input` and `output`; returns what to stop afterwards.
 */
export function hologramChain(c: BaseAudioContext, input: AudioNode, output: AudioNode) {
  const low = c.createBiquadFilter(); low.type = 'highpass'; low.frequency.value = 170;
  const presence = c.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 2600; presence.Q.value = 0.9; presence.gain.value = 4;
  const air = c.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 9000;
  const dry = c.createGain(); dry.gain.value = 0.85;
  const shimmer = c.createDelay(0.05); shimmer.delayTime.value = 0.012;
  const shimmerGain = c.createGain(); shimmerGain.gain.value = 0.32;
  const feedback = c.createGain(); feedback.gain.value = 0.22;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.35;
  const depth = c.createGain(); depth.gain.value = 0.003;
  const room = c.createConvolver(); room.buffer = impulse(c, 0.55);
  const roomGain = c.createGain(); roomGain.gain.value = 0.2;
  const level = c.createDynamicsCompressor(); level.threshold.value = -18; level.ratio.value = 3;
  // The shimmer and the room add to the voice: a little headroom keeps loud sentences from clipping.
  const trim = c.createGain(); trim.gain.value = 0.7;
  input.connect(low).connect(presence).connect(air);
  air.connect(dry).connect(level);
  air.connect(shimmer).connect(shimmerGain).connect(level);
  shimmer.connect(feedback).connect(shimmer);
  lfo.connect(depth).connect(shimmer.delayTime);
  air.connect(room).connect(roomGain).connect(level);
  level.connect(trim).connect(output);
  lfo.start();
  return () => { try { lfo.stop(); } catch { /* Already stopped. */ } trim.disconnect(); try { input.disconnect(low); } catch { /* Not connected. */ } };
}

/**
 * Plays a Home Assistant voice through the hologram. The sound is read from this page's own address (Home Assistant may
 * give its internal one, which the page could play but not process).
 */
let holoPlayer: { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; context: AudioContext } | undefined;
export async function speakAsHologram(url: string): Promise<Speech> {
  const c = audioContext();
  if (!c || typeof Audio === 'undefined') throw new Error('no audio');
  if (c.state === 'suspended') await Promise.race([c.resume(), new Promise(resolve => window.setTimeout(resolve, 300))]);
  if (c.state !== 'running') throw new Error('audio locked');
  if (holoPlayer?.context !== c) {
    const audio = new Audio();
    // An element can feed one source node only: it is made once and kept.
    holoPlayer = { audio, source: c.createMediaElementSource(audio), context: c };
  }
  const { audio, source } = holoPlayer;
  const at = new URL(url, location.href);
  // Same origin, so the effect may read the sound.
  audio.src = `${location.origin}${at.pathname}${at.search}`;
  const stopChain = hologramChain(c, source, c.destination);
  let finish: () => void = () => undefined;
  // The room rings a little after the last word.
  const done = new Promise<void>(resolve => {
    finish = () => { stopChain(); resolve(); };
    audio.onended = () => window.setTimeout(finish, 400);
    audio.onerror = () => finish();
  });
  try { await audio.play(); } catch (error) { stopChain(); throw error; }
  return { done, stop: () => { audio.pause(); finish(); } };
}
