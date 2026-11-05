import { describe, expect, it } from 'vitest';
import { wakeLabels } from '../frontend/v2/wake';

describe('wake word list', () => {
  it('tells apart words with the same name', () => {
    const words = [{ id: 'a', name: 'Nexus', custom: true }, { id: 'b', name: 'nexus', custom: true }, { id: 'c', name: 'Hey Jarvis' }];
    expect(wakeLabels(words).map(([, label]) => label)).toEqual(['Nexus · 1', 'nexus · 2', 'Hey Jarvis']);
  });
});

describe('wake models storage', () => {
  it('downloads a model once, whatever the version in the address', async () => {
    const { cachedBytes } = await import('../frontend/v2/wake');
    const store = new Map<string, Response>();
    let fetched = 0;
    const g = globalThis as unknown as { caches?: unknown; fetch: unknown };
    const saved = { caches: g.caches, fetch: g.fetch };
    g.caches = { open: async () => ({ match: async (k: string) => store.get(k)?.clone(), put: async (k: string, r: Response) => { store.set(k, r); } }) };
    g.fetch = async () => { fetched++; return new Response(new Uint8Array([1, 2, 3])); };
    try {
      expect(Array.from(await cachedBytes('https://h/wake/m.onnx?v=1'))).toEqual([1, 2, 3]);
      expect(Array.from(await cachedBytes('https://h/wake/m.onnx?v=2'))).toEqual([1, 2, 3]);
      expect(fetched).toBe(1);
    } finally { g.caches = saved.caches; g.fetch = saved.fetch; }
  });
});

describe('wake word after a restart or a removal', () => {
  it('marks the list made while Home Assistant did not answer, to ask again', async () => {
    const { wakeWords, wakeGone } = await import('../frontend/v2/wake');
    const down = { callWS: async () => { throw { code: 'unknown_command', message: 'Unknown command.' }; } };
    const up = { callWS: async () => ({ words: [{ id: 'ab', name: 'Nexus', kind: 'voice' }] }) };
    expect((await wakeWords(down as never)).failed).toBe(true);
    const list = await wakeWords(up as never);
    expect(list.failed).toBeUndefined();
    expect(list[0]).toMatchObject({ id: 'ab', custom: true });
    expect(wakeGone({ code: 'not_found' })).toBe(true);
    expect(wakeGone({ code: 'unknown_command' })).toBe(false);
  });
  it('follows the twin that replaced a removed word', async () => {
    const { wakeModel } = await import('../frontend/v2/wake');
    let moved = '';
    const hass = { callWS: async () => ({ id: 'kept', voice: { kind: 'voice' } }) };
    await wakeModel(hass as never, 'gone', id => { moved = id; });
    expect(moved).toBe('kept');
  });
});
