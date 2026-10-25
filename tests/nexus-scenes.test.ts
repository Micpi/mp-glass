import { describe, expect, it, vi } from 'vitest';
import { captureTarget, newScene, sceneIcon, sceneReady, sceneValue, saveScene, targetAttribute } from '../frontend/v2/scenes';
import type { Hass } from '../frontend/ha/client';

describe('scene drafts', () => {
  it('requires a name and real targets or an existing scene, and sends only the public value', () => {
    expect(sceneReady(newScene())).toBe(false);
    const scene = { ...newScene(), name: ' Film ', source: 'scene.vendor', id: 'ignored', editable: true };
    expect(sceneReady(scene)).toBe(true);
    expect(sceneValue(scene)).toEqual({ name: 'Film', icon: 'sparkle', transition: 0, source: 'scene.vendor', entities: [] });
    expect(sceneReady({ ...scene, transition: NaN })).toBe(false);
  });
  it('replaces the previous colour model rather than combining contradictory colour settings', () => {
    const target = { entity_id: 'light.a', state: 'on', attributes: { brightness: 120, color_temp_kelvin: 2700 } };
    const changed = targetAttribute(target, 'rgb_color', [255, 0, 0]);
    expect(changed.attributes).toEqual({ brightness: 120, rgb_color: [255, 0, 0] });
    expect(target.attributes.color_temp_kelvin).toBe(2700);
    expect(targetAttribute(changed, 'brightness', undefined).attributes.brightness).toBeUndefined();
  });
  it('captures actionable settings without stale colour models or private attributes', () => {
    expect(captureTarget({ entity_id: 'light.a', state: 'on', attributes: { color_mode: 'color_temp', color_temp_kelvin: 2700, rgb_color: [255, 0, 0], token: 'private' } })).toEqual({ entity_id: 'light.a', state: 'on', attributes: { color_temp_kelvin: 2700 } });
    expect(captureTarget({ entity_id: 'cover.a', state: 'closing', attributes: { current_position: 30 } }).state).toBe('open');
  });
  it('keeps a stable creation id on retries and an existing revision for edits', async () => {
    const callWS = vi.fn(async () => ({})), hass = { callWS } as unknown as Hass;
    const value = { ...newScene(), name: 'Film', source: 'scene.vendor' };
    await saveScene(hass, value, undefined, 'a'.repeat(32));
    await saveScene(hass, value, undefined, 'a'.repeat(32));
    expect(callWS.mock.calls[0]).toEqual(callWS.mock.calls[1]);
  });
  it('uses the chosen scene icon and maps native scene icons without interpreting arbitrary markup', () => {
    expect(sceneIcon({ entity_id: 'scene.a', state: 'unknown', attributes: { mp_nexus_icon: 'coffee' } })).toBe('coffee');
    expect(sceneIcon({ entity_id: 'scene.a', state: 'unknown', attributes: { icon: 'mdi:movie-open' } })).toBe('tv');
    expect(sceneIcon({ entity_id: 'scene.a', state: 'unknown', attributes: { mp_nexus_icon: '<svg>' } })).toBe('sparkle');
  });
});
