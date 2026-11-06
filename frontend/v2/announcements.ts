import type { Alert } from './assist';

/** This screen announces new persistent alerts only; existing alerts are not replayed on startup. */
export class AlertAnnouncements {
  private initialized = false;
  private observed = new Map<string, number>();
  private announced = new Set<string>();

  reset() { this.initialized = false; this.observed.clear(); this.announced.clear(); }

  next(alerts: Alert[], now: number, canSpeak: boolean): Alert | undefined {
    const active = new Set(alerts.map(a => a.key));
    for (const key of this.observed.keys()) if (!active.has(key)) this.observed.delete(key);
    for (const key of this.announced) if (!active.has(key)) this.announced.delete(key);
    if (!this.initialized) {
      for (const a of alerts) this.announced.add(a.key);
      this.initialized = true;
      return undefined;
    }
    for (const alert of alerts) if (!this.observed.has(alert.key)) this.observed.set(alert.key, now);
    if (!canSpeak) return undefined;
    const alert = alerts.find(a => !this.announced.has(a.key) && now - (this.observed.get(a.key) ?? now) >= 60_000);
    if (alert) this.announced.add(alert.key);
    return alert;
  }
}
