/** Prepare short WAV clips without opening an audio output or holding the microphone. */
const CLIP_SECONDS = 4;

export function wavClip(buffer: AudioBuffer, start: number, end: number) {
  const channels = buffer.numberOfChannels, count = end - start, rate = buffer.sampleRate;
  const bytes = new Uint8Array(44 + count * channels * 2), view = new DataView(bytes.buffer);
  const put = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); put(8, 'WAVE'); put(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); put(36, 'data'); view.setUint32(40, count * channels * 2, true);
  const samples = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let i = start; i < end; i++) for (const channel of samples) {
    const sample = Math.max(-1, Math.min(1, channel[i] ?? 0));
    view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); offset += 2;
  }
  return bytes;
}

export async function voiceClips(encoded: string) {
  const Context = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Context) throw new Error('Offline audio decoding unavailable');
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const buffer = await new Context(1, 1, 24000).decodeAudioData(bytes.buffer);
  if (!buffer.length || !buffer.numberOfChannels || buffer.numberOfChannels > 2) throw new Error('Unsupported voice audio');
  const size = Math.max(1, Math.floor(buffer.sampleRate * CLIP_SECONDS)), urls: string[] = [];
  try {
    for (let start = 0; start < buffer.length; start += size) urls.push(URL.createObjectURL(new Blob([wavClip(buffer, start, Math.min(buffer.length, start + size))], { type: 'audio/wav' })));
    return { urls, dispose: () => { for (const url of urls) URL.revokeObjectURL(url); } };
  } catch (error) { for (const url of urls) URL.revokeObjectURL(url); throw error; }
}
