import { describe, expect, it, vi } from 'vitest';
import { countdown, TimerFeed } from '../frontend/v2/timers';
import type { Hass } from '../frontend/ha/client';

describe('timers', () => {
  it('counts down as m:ss, then h:mm:ss', () => {
    expect(countdown(5)).toBe('0:05');
    expect(countdown(581)).toBe('9:41');
    expect(countdown(3725)).toBe('1:02:05');
  });

  it('follows the snapshots of Home Assistant, with its clock, and survives an empty answer', async () => {
    let push: (event: unknown) => void = () => undefined;
    const subscribeMessage = vi.fn(async (callback: (event: unknown) => void) => { push = callback; return () => undefined; });
    const seen: unknown[] = [];
    const feed = new TimerFeed({ connection: { subscribeMessage } } as unknown as Hass, snapshot => seen.push(snapshot));
    await feed.start();
    expect(subscribeMessage).toHaveBeenCalledWith(expect.any(Function), { type: 'mp_glass/timers/subscribe' });
    // Home Assistant's clock runs 5 s ahead of this device: a timer ending in 60 s of its time has 60 s left, not 65.
    const now = Date.now();
    push({ now: now + 5000, timers: [{ id: 'a', kind: 'timer', label: '', ends: now + 65_000 }], ringing: [] });
    expect(feed.left(feed.snapshot.timers[0]!, now)).toBe(60);
    push({});
    expect(feed.snapshot.timers).toEqual([]);
    expect(feed.snapshot.ringing).toEqual([]);
    expect(seen).toHaveLength(2);
    feed.stop();
    push({ now: 0, timers: [{ id: 'b' }] });
    expect(seen).toHaveLength(2);
  });

  it('asks again every few seconds where the connection cannot subscribe', async () => {
    vi.useFakeTimers();
    const callWS = vi.fn(async () => ({ now: Date.now(), timers: [], ringing: [{ id: 'r', kind: 'alarm', label: 'x', since: 0 }] }));
    const seen: unknown[] = [];
    const feed = new TimerFeed({ connection: {}, callWS } as unknown as Hass, snapshot => seen.push(snapshot));
    await feed.start();
    await vi.advanceTimersByTimeAsync(4100);
    expect(callWS).toHaveBeenCalledWith({ type: 'mp_glass/timers/get' });
    expect(callWS.mock.calls.length).toBeGreaterThanOrEqual(2);
    feed.stop();
    vi.useRealTimers();
  });
});
