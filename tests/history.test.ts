import { beforeAll, describe, expect, it } from 'vitest';
import { curvePath, curveRange, historyPoints, historyRows, historySegments, stateTone, type HistoryRow } from '../frontend/history';
import { arcPath, DIAL_START, DIAL_SWEEP, dialFraction } from '../frontend/controls';
import { chooseLanguage, followHass } from '../frontend/i18n';

const hour = 3_600_000;
const start = Date.UTC(2026, 8, 20, 6), end = start + 6 * hour;

beforeAll(() => { followHass({ language: 'fr' }); chooseLanguage('auto'); });

describe('the history Home Assistant kept', () => {
  it('reads the states however the recorder spells them, and leaves out what has no date', () => {
    const answer = { 'light.salon': [
      { s: 'off', lu: start / 1000 },
      { s: 'on', lu: (start + hour) / 1000, a: { brightness: 128 } },
      { state: 'off', last_updated: new Date(start + 2 * hour).toISOString() },
      { s: 'on' },
      { lu: (start + 3 * hour) / 1000 },
    ] };
    expect(historyRows(answer, 'light.salon')).toEqual([
      { at: start, state: 'off', attributes: {} },
      { at: start + hour, state: 'on', attributes: { brightness: 128 } },
      { at: start + 2 * hour, state: 'off', attributes: {} },
    ]);
    // Another entity, an answer of another shape, or no recorder at all: nothing to draw, never a crash.
    expect(historyRows(answer, 'light.cuisine')).toEqual([]);
    expect(historyRows(undefined, 'light.salon')).toEqual([]);
    expect(historyRows({ 'light.salon': 'nope' }, 'light.salon')).toEqual([]);
  });

  it('draws a reading from the state, or from the attribute a thermostat measures', () => {
    const rows: HistoryRow[] = [
      { at: start, state: 'heat', attributes: { current_temperature: 19.5 } },
      { at: start + hour, state: 'heat', attributes: { current_temperature: 20.5 } },
      { at: start + 2 * hour, state: 'heat', attributes: {} },
    ];
    expect(historyPoints(rows, 'current_temperature')).toEqual([{ at: start, value: 19.5 }, { at: start + hour, value: 20.5 }]);
    expect(historyPoints(rows)).toEqual([]);
    expect(historyPoints([{ at: start, state: '21.4', attributes: {} }])).toEqual([{ at: start, value: 21.4 }]);
  });

  it('holds each state until the next one, merges identical neighbours and runs the last to the end', () => {
    const rows: HistoryRow[] = [
      { at: start - hour, state: 'off', attributes: {} },
      { at: start + hour, state: 'on', attributes: {} },
      { at: start + 2 * hour, state: 'on', attributes: {} },
      { at: start + 3 * hour, state: 'off', attributes: {} },
      { at: end + hour, state: 'on', attributes: {} },
    ];
    expect(historySegments(rows, start, end)).toEqual([
      { start, end: start + hour, state: 'off' },
      { start: start + hour, end: start + 3 * hour, state: 'on' },
      { start: start + 3 * hour, end, state: 'off' },
    ]);
    expect(historySegments([], start, end)).toEqual([]);
  });

  it('keeps the curve off the edges of its box, and a flat reading in the middle of it', () => {
    expect(curveRange([{ at: start, value: 10 }, { at: end, value: 20 }])).toEqual([8.5, 21.5]);
    const [low, high] = curveRange([{ at: start, value: 20 }, { at: end, value: 20 }]);
    expect(low).toBeLessThan(20);
    expect(high).toBeGreaterThan(20);
    expect(curveRange([])).toEqual([0, 1]);
  });

  it('turns readings into a path, the lowest at the bottom of the box and the newest on its right', () => {
    const { line, area } = curvePath([{ at: start, value: 0 }, { at: end, value: 10 }], start, end, 0, 10);
    expect(line).toBe('M0.00 100.00 L100.00 0.00');
    expect(area).toBe('M0.00 100.00 L100.00 0.00 L100 100 L0 100 Z');
    expect(curvePath([], start, end, 0, 10)).toEqual({ line: '', area: '' });
  });

  it('colours a state by what it says: a light on is warm, a shutter open is green, the unknown is grey', () => {
    expect(stateTone('light', 'on')).toBe('#ffc540');
    expect(stateTone('cover', 'open')).toBe('#8ff0c8');
    expect(stateTone('climate', 'cool')).toBe('#5cd8ff');
    expect(stateTone('media', 'playing')).toBe('#c3a6ff');
    expect(stateTone('light', 'unavailable')).toBe('rgba(190,210,230,.16)');
    expect(stateTone('sensor', 'whatever')).toBe('rgba(190,210,230,.22)');
  });
});

describe('the dial of a thermostat', () => {
  it('turns from its start to its end, and stops at the nearer end rather than jumping across the gap', () => {
    const at = (angle: number) => dialFraction(Math.cos(angle * Math.PI / 180), Math.sin(angle * Math.PI / 180));
    expect(at(DIAL_START)).toBeCloseTo(0);
    expect(at(DIAL_START + DIAL_SWEEP / 2)).toBeCloseTo(.5);
    expect(at(DIAL_START + DIAL_SWEEP)).toBeCloseTo(1);
    // In the gap under the dial: just past the end stays at the end, just before the start stays at the start.
    expect(at(DIAL_START + DIAL_SWEEP + 20)).toBe(1);
    expect(at(DIAL_START - 20)).toBe(0);
  });
  it('draws an arc, and nothing at all when there is no arc to draw', () => {
    expect(arcPath(100, 100, 84, DIAL_START, DIAL_START)).toBe('');
    expect(arcPath(100, 100, 84, DIAL_START, DIAL_START + 90)).toBe('M40.60 159.40 A84 84 0 0 1 40.60 40.60');
    // Beyond a full turn the arc stops at the end of the dial instead of winding back over itself.
    expect(arcPath(100, 100, 84, DIAL_START, DIAL_START + 400)).toBe(arcPath(100, 100, 84, DIAL_START, DIAL_START + DIAL_SWEEP));
  });
});
