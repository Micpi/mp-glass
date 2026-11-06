import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hass } from '../frontend/ha/client';
import { TabletVolume } from '../frontend/v2/tablet-volume';

const choice = { service: 'mobile_app_tablette', sensor: 'sensor.tablette_volume_level_music' };
function home() {
  const sensor = { entity_id: choice.sensor, state: '12', attributes: { min: 0, max: 15 } };
  const callService = vi.fn().mockResolvedValue(undefined);
  const hass = { states: { [choice.sensor]: sensor }, callService } as unknown as Hass;
  return { hass, sensor, callService };
}
afterEach(() => { vi.useRealTimers(); });

describe('Android tablet volume while listening', () => {
  it('lowers the selected tablet and restores its original volume for the reply', async () => {
    vi.useFakeTimers();
    const { hass, sensor, callService } = home(), volume = new TabletVolume(() => hass);
    await volume.set(true, choice);
    expect(callService).toHaveBeenNthCalledWith(1, 'notify', choice.service, { message: 'command_volume_level', data: { media_stream: 'music_stream', command: 3 } });
    sensor.state = '3';
    await volume.set(false);
    expect(callService).toHaveBeenNthCalledWith(2, 'notify', choice.service, { message: 'command_volume_level', data: { media_stream: 'music_stream', command: 12 } });
  });
  it('does not overwrite a volume changed by the user during the conversation', async () => {
    const { hass, sensor, callService } = home(), volume = new TabletVolume(() => hass);
    await volume.set(true, choice); sensor.state = '7'; await volume.set(false);
    expect(callService).toHaveBeenCalledTimes(1);
  });
  it('restores after the microphone closes even when the lowering request was still pending', async () => {
    vi.useFakeTimers();
    const { hass, callService } = home(); let finish!: () => void;
    callService.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const volume = new TabletVolume(() => hass), start = volume.set(true, choice);
    await Promise.resolve(); const end = volume.set(false); finish(); await start; await end;
    expect(callService.mock.calls.map(call => call[2].data.command)).toEqual([3, 12]);
  });
  it('does nothing without a valid volume sensor or matching notification service', async () => {
    const { hass, sensor, callService } = home(), volume = new TabletVolume(() => hass);
    sensor.state = 'unavailable'; await volume.set(true, choice); await volume.set(false);
    await volume.set(true, { ...choice, service: 'other' });
    expect(callService).not.toHaveBeenCalled();
  });
  it('repairs a late lowering only while there is no new listening session', async () => {
    vi.useFakeTimers();
    const { hass, sensor, callService } = home(), volume = new TabletVolume(() => hass);
    await volume.set(true, choice); await volume.set(false);
    sensor.state = '3'; await vi.advanceTimersByTimeAsync(2500);
    expect(callService.mock.calls.map(call => call[2].data.command)).toEqual([3, 12, 12]);
  });
  it('does not let an old retry overwrite a later conversation', async () => {
    vi.useFakeTimers();
    const { hass, sensor, callService } = home(), volume = new TabletVolume(() => hass);
    await volume.set(true, choice); await volume.set(false);
    sensor.state = '8'; await volume.set(true, choice); sensor.state = '2'; await volume.set(false);
    sensor.state = '3'; await vi.advanceTimersByTimeAsync(2500);
    expect(callService.mock.calls.map(call => call[2].data.command)).toEqual([3, 12, 2, 8]);
  });
  it('waits briefly for the tablet to report restored volume before speaking', async () => {
    vi.useFakeTimers();
    const { hass, sensor } = home(), volume = new TabletVolume(() => hass);
    await volume.set(true, choice); sensor.state = '3'; await volume.set(false);
    let ready = false; const pending = volume.beforeReply().then(() => { ready = true; });
    await Promise.resolve(); await Promise.resolve();
    expect(ready).toBe(false);
    sensor.state = '12'; await vi.advanceTimersByTimeAsync(250); await pending;
    expect(ready).toBe(true);
  });
});
