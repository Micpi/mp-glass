import { afterEach, describe, expect, it, vi } from 'vitest';
import { WakeListener, type WakeModels } from '../frontend/v2/wake';
import { claimVoice } from '../frontend/v2/voice';

/** Models that answer at once: only the listener's own life is tested here. */
const models = { frames: 16, mel: async (s: Float32Array) => new Float32Array(Math.floor(s.length / 160) * 32), embed: async (_w: Float32Array, n: number) => new Float32Array(n * 96), score: async () => 0 } as unknown as WakeModels;

afterEach(() => { vi.unstubAllGlobals(); });

describe('one Nexus answers the word', () => {
  it('keeps the worklet graph active through a muted output and releases it on stop', async () => {
    const track = { stop: vi.fn() }, node = { port: { onmessage: null }, connect: vi.fn(), disconnect: vi.fn() };
    const source = { connect: vi.fn(), disconnect: vi.fn() }, sink = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    const destination = {}, close = vi.fn().mockResolvedValue(undefined);
    const context = { sampleRate: 48000, state: 'running', destination, audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) }, createMediaStreamSource: () => source, createGain: () => sink, close };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) } });
    vi.stubGlobal('window', { AudioContext: vi.fn(function () { return context; }) });
    vi.stubGlobal('AudioWorkletNode', vi.fn(function () { return node; }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const listener = new WakeListener(models, vi.fn());
    await listener.start();
    expect(source.connect).toHaveBeenCalledWith(node);
    expect(node.connect).toHaveBeenCalledWith(sink);
    expect(sink.gain.value).toBe(0);
    expect(sink.connect).toHaveBeenCalledWith(destination);
    listener.stop();
    expect(sink.disconnect).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('releases an incomplete audio graph and starts afresh after a worklet failure', async () => {
    const track = { stop: vi.fn() }, node = { port: { onmessage: null }, connect: vi.fn(), disconnect: vi.fn() };
    const source = { connect: vi.fn(), disconnect: vi.fn() }, sink = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    const addModule = vi.fn().mockRejectedValueOnce(new Error('not ready')).mockResolvedValue(undefined);
    const context = { sampleRate: 48000, state: 'running', destination: {}, audioWorklet: { addModule }, createMediaStreamSource: () => source, createGain: () => sink, close: vi.fn().mockResolvedValue(undefined) };
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('window', { AudioContext: vi.fn(function () { return context; }) });
    vi.stubGlobal('AudioWorkletNode', vi.fn(function () { return node; }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const listener = new WakeListener(models, vi.fn());
    await expect(listener.start()).rejects.toThrow('not ready');
    expect(listener.running).toBe(false);
    expect(track.stop).toHaveBeenCalledTimes(1);
    await listener.start();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(listener.running).toBe(true);
    listener.stop();
  });
  it('a listener stopped while it starts lets go of the microphone and never listens', async () => {
    const track = { stop: vi.fn() };
    let grant: (s: unknown) => void = () => undefined;
    const getUserMedia = vi.fn(() => new Promise(resolve => { grant = resolve; }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const Context = vi.fn();
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('window', { AudioContext: Context });
    const onWake = vi.fn();
    const listener = new WakeListener(models, onWake);
    const starting = listener.start();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    listener.stop();
    grant({ getTracks: () => [track] });
    await starting;
    expect(track.stop).toHaveBeenCalled();
    expect(Context).not.toHaveBeenCalled();
    expect(listener.running).toBe(false);
    // Started again after a stop: nothing happens, a new listener is made instead.
    await listener.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
  it('two tabs hear the word: only the first answers until it is done', async () => {
    const held = new Set<string>();
    vi.stubGlobal('navigator', { locks: { request: async (name: string, _o: unknown, cb: (lock: unknown) => unknown) => {
      if (held.has(name)) return cb(null);
      held.add(name);
      try { return await cb({ name }); } finally { held.delete(name); }
    } } });
    const first = await claimVoice();
    expect(first).toBeTypeOf('function');
    expect(await claimVoice()).toBeUndefined();
    first!();
    await Promise.resolve(); await Promise.resolve();
    expect(await claimVoice()).toBeTypeOf('function');
  });
  it('without locks (old browsers), the tab answers', async () => {
    vi.stubGlobal('navigator', {});
    expect(await claimVoice()).toBeTypeOf('function');
  });
});
