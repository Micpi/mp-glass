import { describe, expect, it, vi } from 'vitest';
import { isAndroid, setAndroidWake } from '../frontend/v2/native-wake';

describe('Android companion wake word', () => {
  it('sends the documented on and off commands only to the selected companion service', async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    await setAndroidWake({ callService }, 'mobile_app_tablette', true);
    await setAndroidWake({ callService }, 'mobile_app_tablette', false);
    expect(callService.mock.calls).toEqual([
      ['notify', 'mobile_app_tablette', { message: 'command_wake_word_detection', data: { command: 'turn_on' } }],
      ['notify', 'mobile_app_tablette', { message: 'command_wake_word_detection', data: { command: 'turn_off' } }],
    ]);
    await expect(setAndroidWake({ callService }, 'mobile_app_tablette.other', true)).rejects.toThrow();
    expect(callService).toHaveBeenCalledTimes(2);
  });
  it('offers Android integration only on Android user agents', () => {
    expect(isAndroid('Mozilla/5.0 (Linux; Android 14)')).toBe(true);
    expect(isAndroid('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
    expect(isAndroid('Mozilla/5.0 (iPad)')).toBe(false);
  });
});
