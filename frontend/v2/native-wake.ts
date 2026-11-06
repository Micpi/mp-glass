import type { Hass } from '../ha/client';

/** The Android companion accepts only on/off; selecting its wake word and assistant remains in the app. */
export async function setAndroidWake(hass: Pick<Hass, 'callService'>, service: string, enabled: boolean) {
  if (!/^mobile_app_[a-z0-9_]+$/.test(service)) throw new Error('invalid companion service');
  await hass.callService('notify', service, { message: 'command_wake_word_detection', data: { command: enabled ? 'turn_on' : 'turn_off' } });
}

export function isAndroid(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) { return /Android/i.test(ua); }
