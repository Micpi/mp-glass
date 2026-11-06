import { describe, expect, it } from 'vitest';
import { WakeGuard } from '../frontend/v2/wake-guard';

describe('repeated unanswered wake protection', () => {
  it('temporarily pauses after three unanswered wakes and then allows listening again', () => {
    const guard = new WakeGuard();
    expect(guard.unanswered(1000)).toBe(0);
    expect(guard.unanswered(20_000)).toBe(0);
    expect(guard.unanswered(40_000)).toBe(60_000);
    expect(guard.remaining(70_000)).toBe(30_000);
    expect(guard.remaining(100_000)).toBe(0);
    expect(guard.unanswered(101_000)).toBe(0);
  });
  it('does not count distant wakes or wakes preceding a successful request', () => {
    const guard = new WakeGuard();
    guard.unanswered(1000); guard.unanswered(122_000);
    expect(guard.unanswered(123_000)).toBe(0);
    guard.reset();
    expect(guard.unanswered(124_000)).toBe(0);
    expect(guard.remaining(124_000)).toBe(0);
  });
});
