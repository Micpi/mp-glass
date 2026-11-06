/** A screen that repeatedly wakes without any request pauses its wake word briefly, rather than opening forever. */
export class WakeGuard {
  private empty: number[] = [];
  private until = 0;
  remaining(now = Date.now()) { return Math.max(0, this.until - now); }
  unanswered(now = Date.now()) {
    if (this.remaining(now)) return this.remaining(now);
    this.empty = [...this.empty.filter(at => now >= at && now - at <= 120_000), now];
    if (this.empty.length < 3) return 0;
    this.empty = [];
    this.until = now + 60_000;
    return this.remaining(now);
  }
  reset() { this.empty = []; this.until = 0; }
}
