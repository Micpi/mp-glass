import { describe, expect, it, vi } from 'vitest';
import { voiceClips, wavClip } from '../frontend/v2/voice-clips';

describe('short voice clips', () => {
  it('encodes every stereo sample in a valid WAV without dropping boundary samples', () => {
    const buffer = { sampleRate: 2, numberOfChannels: 2, getChannelData: (channel: number) => channel ? new Float32Array([0.5, -0.5, 1]) : new Float32Array([-1, 0, 0.25]) } as AudioBuffer;
    const bytes = wavClip(buffer, 1, 3), data = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(data.getUint16(22, true)).toBe(2);
    expect(data.getUint32(40, true)).toBe(8);
    expect([data.getInt16(44, true), data.getInt16(46, true), data.getInt16(48, true), data.getInt16(50, true)]).toEqual([0, -16384, 8192, 32767]);
  });
  it('decodes offline and returns clips no longer than four seconds, then releases them', async () => {
    const buffer = { sampleRate: 2, length: 19, numberOfChannels: 1, getChannelData: () => new Float32Array(19).fill(0.25) } as unknown as AudioBuffer;
    const blobs: Blob[] = [];
    vi.stubGlobal('window', { OfflineAudioContext: class { decodeAudioData() { return Promise.resolve(buffer); } } });
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { blobs.push(blob as Blob); return `blob:${blobs.length}`; });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    try {
      const clips = await voiceClips('SUQz');
      expect(clips.urls).toEqual(['blob:1', 'blob:2', 'blob:3']);
      expect(blobs.map(blob => blob.size)).toEqual([60, 60, 50]);
      clips.dispose();
      expect(revoke).toHaveBeenCalledTimes(3);
    } finally { create.mockRestore(); revoke.mockRestore(); vi.unstubAllGlobals(); }
  });
});
