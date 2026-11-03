import type { Hass } from '../ha/client';

/** The timers and alarms of Nexus, as Home Assistant keeps them (custom_components/mp_glass/timers.py). */
export interface TimerItem {
  id: string; kind: 'timer' | 'alarm'; label: string;
  /** When it rings, in ms since 1970 on Home Assistant's clock. */
  ends: number;
  seconds?: number; hour?: number; minute?: number; days?: number[]; snoozed?: boolean;
}
export interface Ring { id: string; kind: 'timer' | 'alarm'; label: string; since: number }
export interface TimerSnapshot { now: number; timers: TimerItem[]; ringing: Ring[] }

export const EMPTY: TimerSnapshot = { now: 0, timers: [], ringing: [] };
export const SNOOZE_SECONDS = 9 * 60;

interface Connection { subscribeMessage?: (callback: (event: TimerSnapshot) => void, message: Record<string, unknown>) => Promise<() => void> }

/** Follows the timers live (a subscription), or every few seconds where the connection cannot subscribe. */
export class TimerFeed {
  snapshot: TimerSnapshot = EMPTY;
  /** Home Assistant's clock minus this device's, to count down right even when the two differ. */
  skew = 0;
  private stopFeed?: () => void; private poll?: number; private closed = false;
  constructor(private hass: Hass, private onChange: (snapshot: TimerSnapshot) => void) {}
  private take = (raw: Partial<TimerSnapshot> | undefined) => {
    if (this.closed) return;
    // Whatever arrives, the screens get lists (an older integration or a proxy may answer with nothing).
    const snapshot: TimerSnapshot = { now: typeof raw?.now === 'number' ? raw.now : Date.now(), timers: Array.isArray(raw?.timers) ? raw.timers : [], ringing: Array.isArray(raw?.ringing) ? raw.ringing : [] };
    this.skew = snapshot.now - Date.now();
    this.snapshot = snapshot;
    this.onChange(snapshot);
  };
  async start() {
    const connection = this.hass.connection as Connection;
    if (connection.subscribeMessage) {
      try {
        const stop = await connection.subscribeMessage(this.take, { type: 'mp_glass/timers/subscribe' });
        if (this.closed) stop(); else this.stopFeed = stop;
        return;
      } catch { /* An older integration: poll instead. */ }
    }
    const read = () => this.hass.callWS<TimerSnapshot>({ type: 'mp_glass/timers/get' }).then(this.take, () => undefined);
    void read();
    this.poll = setInterval(read, 4000) as unknown as number;
  }
  stop() {
    this.closed = true;
    this.stopFeed?.(); this.stopFeed = undefined;
    clearInterval(this.poll);
  }
  /** Seconds before an item rings, from Home Assistant's clock. */
  left(item: TimerItem, now = Date.now()) { return Math.max(0, Math.ceil((item.ends - (now + this.skew)) / 1000)); }
}

export const stopRing = (hass: Hass, ring?: Ring) => hass.callWS({ type: 'mp_glass/timers/stop', ...(ring ? { ring: ring.id } : {}) });
export const snoozeRing = (hass: Hass, ring: Ring, seconds = SNOOZE_SECONDS) => hass.callWS({ type: 'mp_glass/timers/snooze', ring: ring.id, seconds });
export const cancelTimer = (hass: Hass, item: TimerItem) => hass.callWS({ type: 'mp_glass/timers/cancel', item: item.id });

/** 9:05, or 1:02:09 beyond the hour. */
export function countdown(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** The time of day an alarm rings, in the page's language (a 24 h clock for French, German and Italian). */
export function clockLabel(item: TimerItem, locale: string) {
  const at = new Date(item.ends);
  return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
