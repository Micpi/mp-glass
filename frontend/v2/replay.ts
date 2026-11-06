import type { HAState } from '../../shared/models';
import { historyRows, type HistoryRow } from '../history';

/** Recorded states only. A missing reading stays unknown, rather than borrowing today's state. */
export function replayRows(answer: unknown, ids: string[]): Record<string, HistoryRow[]> {
  return Object.fromEntries(ids.map(id => [id, historyRows(answer, id)]));
}

export function replayStates(rows: Record<string, HistoryRow[]>, at: number): Record<string, HAState> {
  return Object.fromEntries(Object.entries(rows).map(([id, history]) => {
    const row = [...history].reverse().find(item => item.at <= at);
    return [id, { entity_id: id, state: row?.state ?? 'unknown', attributes: row?.attributes ?? {}, ...(row ? { last_changed: new Date(row.at).toISOString() } : {}) }];
  }));
}
