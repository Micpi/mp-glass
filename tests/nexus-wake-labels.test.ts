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
