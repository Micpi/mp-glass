import { describe, expect, it } from 'vitest';
import { replayRows, replayStates } from '../frontend/v2/replay';

describe('plan replay', () => {
  it('uses only recorded values at the chosen time, never the current state', () => {
    const rows = replayRows({ 'light.a': [
      { s: 'off', lu: 1000, a: { brightness: 0 } },
      { s: 'on', lu: 2000, a: { brightness: 100 } },
    ] }, ['light.a', 'light.missing']);
    expect(replayStates(rows, 999_000)['light.a']?.state).toBe('unknown');
    expect(replayStates(rows, 1_500_000)['light.a']).toMatchObject({ state: 'off', attributes: { brightness: 0 } });
    expect(replayStates(rows, 2_100_000)['light.a']).toMatchObject({ state: 'on', attributes: { brightness: 100 } });
    expect(replayStates(rows, 2_100_000)['light.missing']).toMatchObject({ state: 'unknown', attributes: {} });
  });
});
