/** One HTML media element for spoken replies and Android rings, following the device's current media output. */
let audio: HTMLAudioElement | undefined;
let active: { finish(): void } | undefined;
/** A real, short silent PCM clip: an empty WAV may be rejected before Android grants playback. */
function silentClip() {
  const samples = 1600, data = new Uint8Array(44 + samples * 2), view = new DataView(data.buffer);
  const put = (at: number, text: string) => { for (let i = 0; i < text.length; i++) data[at + i] = text.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, data.length - 8, true); put(8, 'WAVE'); put(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data'); view.setUint32(40, samples * 2, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...data))}`;
}
let silence: string | undefined;

function player() { return audio ??= new Audio(); }

/** Called inside a user gesture, to permit subsequent playback when the browser requires it. */
export function unlockMedia() {
  if (typeof Audio === 'undefined' || active) return;
  const p = player(); p.src = silence ??= silentClip(); p.loop = false;
  void p.play().catch(() => undefined);
}

export function playMedia(src: string, loop = false, failed: () => void = () => undefined) {
  const p = player();
  active?.finish(); p.pause();
  let finished = false, finishDone: () => void = () => undefined;
  const done = new Promise<void>(resolve => { finishDone = resolve; });
  const owner = { finish() { if (finished) return; finished = true; if (active === owner) { p.pause(); p.onended = null; p.onerror = null; active = undefined; } finishDone(); } };
  active = owner; p.loop = loop; p.src = src; p.onended = () => owner.finish(); p.onerror = () => { if (!finished) { failed(); owner.finish(); } };
  const resume = () => {
    if (finished || active !== owner) return Promise.resolve();
    try { return Promise.resolve(p.play()).catch(error => { if (!finished && active === owner) failed(); throw error; }); }
    catch (error) { if (!finished && active === owner) failed(); return Promise.reject(error); }
  };
  const ready = resume();
  return { done, ready, stop: () => owner.finish(), pause: () => { if (active === owner) p.pause(); }, resume };
}
