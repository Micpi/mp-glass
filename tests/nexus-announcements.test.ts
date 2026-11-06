import { describe, expect, it } from 'vitest';
import { AlertAnnouncements } from '../frontend/v2/announcements';
import type { Alert } from '../frontend/v2/assist';

describe('announcing alerts', () => {
  it('ignores existing alerts, waits for a new alert to persist and says it only once', () => {
    const a: Alert = { key: 'a', level: 'house', kind: 'battery', entity: 'sensor.a' };
    const b: Alert = { key: 'b', level: 'security', kind: 'open', entity: 'binary_sensor.b' };
    const x = new AlertAnnouncements();
    expect(x.next([a], 0, true)).toBeUndefined();
    expect(x.next([a, b], 100, true)).toBeUndefined();
    expect(x.next([a, b], 60100, false)).toBeUndefined();
    expect(x.next([a, b], 60101, true)).toEqual(b);
    expect(x.next([a, b], 120000, true)).toBeUndefined();
    x.next([a], 130000, true);
    expect(x.next([a, b], 140000, true)).toBeUndefined();
    expect(x.next([a, b], 200000, true)).toEqual(b);
  });
});
