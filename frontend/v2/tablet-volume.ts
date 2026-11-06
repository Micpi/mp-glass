import type { Hass } from '../ha/client';

export interface TabletVolumeChoice { service: string; sensor: string }
type Saved = TabletVolumeChoice & { original: number; lowered: number };

/** Quiet the Android music stream only while this screen is listening, then restore what the sensor reported. */
export class TabletVolume {
  private desired = '';
  private revision = 0;
  private chain: Promise<void> = Promise.resolve();
  private saved?: Saved;
  private restoring?: Saved & { revision: number };
  constructor(private hass: () => Hass | undefined) {}

  set(listening: boolean, choice?: TabletVolumeChoice): Promise<void> {
    const key = listening && choice && /^mobile_app_[a-z0-9_]+$/.test(choice.service) && /^sensor\.[a-z0-9_]+$/.test(choice.sensor) ? `${choice.service}|${choice.sensor}` : '';
    if (key === this.desired) return this.chain;
    this.desired = key;
    this.revision++;
    this.chain = this.chain.then(async () => {
      if (key !== this.desired) return;
      if (this.saved && `${this.saved.service}|${this.saved.sensor}` !== key) await this.restore();
      if (key !== this.desired) return;
      if (!key || this.saved || !choice) return;
      const hass = this.hass(), state = hass?.states[choice.sensor];
      const original = Number(state?.state), min = Number(state?.attributes.min ?? 0), max = Number(state?.attributes.max);
      if (!hass || !state || !/^\d+$/.test(state.state) || !Number.isInteger(original) || !Number.isFinite(min) || !Number.isFinite(max) || original <= min || original > max) return;
      const lowered = Math.max(min, Math.round(min + (original - min) * .25));
      if (lowered >= original) return;
      try {
        await this.command(hass, choice.service, lowered);
        this.saved = { ...choice, original, lowered };
      } catch { /* An unavailable device must not prevent the conversation. */ }
    }).catch(() => undefined);
    return this.chain;
  }

  private command(hass: Hass, service: string, value: number) {
    return hass.callService('notify', service, { message: 'command_volume_level', data: { media_stream: 'music_stream', command: value } });
  }

  private async restore() {
    const revision = this.revision;
    const saved = this.saved; this.saved = undefined;
    const hass = this.hass(); if (!saved || !hass) return;
    const current = hass.states[saved.sensor]?.state;
    // A different value means someone changed the volume while listening; do not overwrite it.
    if (current && /^\d+$/.test(current) && current !== String(saved.lowered) && current !== String(saved.original)) return;
    this.restoring = { ...saved, revision };
    try { await this.command(hass, saved.service, saved.original); } catch { /* The sensor-based retries below can recover after a brief disconnect. */ }
    // The command is delivered asynchronously. If the lowering arrives late, correct it once the sensor reflects it.
    for (const delay of [2500, 6000, 12000]) setTimeout(() => {
      const latest = this.hass();
      if (revision === this.revision && !this.desired && latest?.states[saved.sensor]?.state === String(saved.lowered)) void this.command(latest, saved.service, saved.original).catch(() => undefined);
    }, delay);
  }

  /** Let a prompt local answer wait briefly for the tablet's sensor to confirm restoration. */
  async beforeReply() {
    await this.set(false);
    const restoring = this.restoring;
    if (!restoring || restoring.revision !== this.revision) return;
    for (let i = 0; i < 6; i++) {
      const state = this.hass()?.states[restoring.sensor]?.state;
      if (this.revision !== restoring.revision || state !== String(restoring.lowered)) return;
      await new Promise<void>(resolve => setTimeout(resolve, 250));
    }
  }
}
