import { describe, expect, it, vi } from 'vitest';
import { addFact, factsOf, lessonMarker, loadFacts, removeFact } from '../frontend/v2/facts';

const hass = (answer: unknown) => ({ callWS: vi.fn().mockResolvedValue(answer) }) as never;

describe('Nexus education', () => {
  it('marks a lesson the way Home Assistant reads it', () => {
    expect(lessonMarker('pieces')).toBe('__lesson:pieces');
  });
  it('shapes whatever an integration answers', async () => {
    expect(await loadFacts(hass({}))).toEqual({ facts: [], progress: {}, max: 80, lessons: [] });
    const h = hass({ facts: [{ id: 'a', topic: 'pieces', text: 'x', at: 1 }], progress: { pieces: 1 }, max: 80, lessons: [{ id: 'pieces', title: 't', blurb: 'b' }] });
    const listing = await addFact(h, 'Le salon, c’est Living', 'pieces');
    expect((h as { callWS: ReturnType<typeof vi.fn> }).callWS).toHaveBeenCalledWith({ type: 'mp_glass/assistant/facts/add', text: 'Le salon, c’est Living', topic: 'pieces' });
    expect(factsOf(listing, 'pieces')).toHaveLength(1);
    await removeFact(h, listing.facts[0]!);
    expect((h as { callWS: ReturnType<typeof vi.fn> }).callWS).toHaveBeenLastCalledWith({ type: 'mp_glass/assistant/facts/remove', fact: 'a' });
  });
  it('lists the latest facts of a topic first', () => {
    const listing = { facts: [{ id: 'a', topic: 'style', text: 'a', at: 1 }, { id: 'b', topic: 'style', text: 'b', at: 2 }, { id: 'c', topic: 'autre', text: 'c', at: 3 }], progress: {}, max: 80, lessons: [] } as never;
    expect(factsOf(listing, 'style').map(f => f.id)).toEqual(['b', 'a']);
  });
});
