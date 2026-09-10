import type { Capability, CapabilityBinding, HAState } from './models';
const dimModes = new Set(['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white']);
export class MPCapabilityEngine {
  static detect(entityId: string, state?: HAState): CapabilityBinding[] {
    if (entityId.split('.')[0] !== 'light') return [];
    const bindings: CapabilityBinding[] = [{ capability: 'POWER', entityId, evidence: 'domain:light' }];
    const modes = Array.isArray(state?.attributes.supported_color_modes) ? state.attributes.supported_color_modes.filter((v): v is string => typeof v === 'string') : [];
    const add = (capability: Capability, evidence: string) => bindings.push({ capability, entityId, evidence });
    if (modes.some(m => dimModes.has(m))) add('DIM', 'supported_color_modes');
    if (modes.includes('color_temp')) add('COLOR_TEMP', 'supported_color_modes:color_temp');
    if (modes.some(m => ['rgb', 'hs', 'xy'].includes(m))) add('RGB', 'supported_color_modes:color');
    if (modes.includes('rgbw')) add('RGBW', 'supported_color_modes:rgbw');
    if (modes.includes('rgbww')) add('RGBWW', 'supported_color_modes:rgbww');
    const features = state?.attributes.supported_features;
    if (typeof features === 'number' && (features & 4) !== 0) add('EFFECT', 'supported_features:4');
    return bindings;
  }
}
export const available = (state?: HAState): boolean => !!state && !['unavailable', 'unknown'].includes(state.state);
export function brightnessPercent(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(255, Math.max(0, value)) / 255 * 100) : undefined;
}
