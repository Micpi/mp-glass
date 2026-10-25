import type { HAState } from '../../shared/models';
import type { Hass } from '../ha/client';
import type { MPIconName } from '../icons';
import type { MessageKey } from '../locales';

export const SCENE_ICONS = [
  ['sparkle', 'Ambiance'], ['home', 'Maison'], ['bulb', 'Lumières'], ['moon', 'Nuit'], ['sun', 'Jour'],
  ['tv', 'Cinéma'], ['music', 'Musique'], ['speaker', 'Enceinte'], ['heart', 'Détente'], ['coffee', 'Matin'],
  ['bed', 'Sommeil'], ['sofa', 'Salon'], ['kitchen', 'Repas'], ['shutter', 'Volets'], ['curtain', 'Rideaux'],
  ['flame', 'Chauffage'], ['snow', 'Climatisation'], ['thermo', 'Température'], ['leaf', 'Économie'],
  ['door', 'Départ'], ['shield', 'Sécurité'], ['power', 'Arrêt'], ['clock', 'Horloge'], ['party', 'Fête'], ['star', 'Favori'],
] as const satisfies readonly (readonly [MPIconName, MessageKey])[];
export type SceneIcon = typeof SCENE_ICONS[number][0];
export interface SceneTarget { entity_id: string; state: string; attributes: Record<string, unknown> }
export interface SceneValue { name: string; icon: SceneIcon; transition: number; entities: SceneTarget[]; source?: string }
export interface NexusScene extends SceneValue { id: string; revision: number; entity_id: string | null; editable: boolean }
export interface SceneList { scenes: NexusScene[]; candidates: string[]; native: string[]; can_create: boolean; areas?: Record<string, string> }
export const newScene = (): SceneValue => ({ name: '', icon: 'sparkle', transition: 0, entities: [] });
export const sceneValue = (s: SceneValue): SceneValue => ({ name: s.name.trim(), icon: s.icon, transition: s.transition, entities: structuredClone(s.entities), ...(s.source ? { source: s.source } : {}) });
export const sceneReady = (s: SceneValue) => !!s.name.trim() && s.name.trim().length <= 80 && (s.entities.length > 0 || !!s.source) && s.entities.length <= 80 && Number.isFinite(s.transition) && s.transition >= 0 && s.transition <= 300;
export function sceneIcon(state?: HAState): SceneIcon {
  const icon = state?.attributes.mp_nexus_icon;
  if (SCENE_ICONS.some(([key]) => key === icon)) return icon as SceneIcon;
  const native = String(state?.attributes.icon ?? '');
  return /movie|television/.test(native) ? 'tv' : /night|moon/.test(native) ? 'moon' : /music/.test(native) ? 'music' : /lightbulb/.test(native) ? 'bulb' : /bed/.test(native) ? 'bed' : /sun/.test(native) ? 'sun' : 'sparkle';
}
export const listScenes = (hass: Hass) => hass.callWS<SceneList>({ type: 'mp_glass/scenes/list' });
export const captureScene = (hass: Hass, entities: string[]) => hass.callWS<{ entities: SceneTarget[] }>({ type: 'mp_glass/scenes/snapshot', entities });
export const newSceneId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(v => v.toString(16).padStart(2, '0')).join('');
export const saveScene = (hass: Hass, scene: SceneValue, existing?: NexusScene, draftId?: string) => hass.callWS<NexusScene>({ type: 'mp_glass/scenes/save', ...(existing || draftId ? { scene_id: existing?.id ?? draftId } : {}), revision: existing?.revision ?? 0, scene: sceneValue(scene) });
export const deleteScene = (hass: Hass, scene: NexusScene) => hass.callWS<void>({ type: 'mp_glass/scenes/delete', scene_id: scene.id, revision: scene.revision });
export const previewScene = (hass: Hass, scene: SceneValue) => hass.callWS<void>({ type: 'mp_glass/scenes/preview', scene: sceneValue(scene) });

/** A colour editor changes one representation and removes the previous one. */
export function targetAttribute(target: SceneTarget, key: string, value: unknown): SceneTarget {
  const attributes = { ...target.attributes };
  if (['rgb_color', 'color_temp_kelvin'].includes(key)) for (const old of ['color_temp_kelvin', 'rgb_color', 'hs_color', 'xy_color', 'rgbw_color', 'rgbww_color']) delete attributes[old];
  if (value === undefined || value === '') delete attributes[key]; else attributes[key] = value;
  return { ...target, attributes };
}

/** Used by the demo and by summaries: only settings which a scene can reproduce. */
export const SCENE_ATTRIBUTES: Record<string, readonly string[]> = {
  light: ['brightness', 'color_temp_kelvin', 'rgb_color', 'hs_color', 'xy_color', 'rgbw_color', 'rgbww_color', 'effect'],
  cover: ['current_position', 'current_tilt_position'], climate: ['temperature', 'target_temp_low', 'target_temp_high', 'preset_mode', 'fan_mode', 'swing_mode'],
  media_player: ['volume_level', 'is_volume_muted', 'source', 'sound_mode'], fan: ['percentage', 'preset_mode', 'direction', 'oscillating'],
  humidifier: ['humidity', 'mode'], switch: [], input_boolean: [], select: [], input_select: [], number: [], input_number: [], valve: ['current_position'],
};
export function captureTarget(s: HAState): SceneTarget {
  const domain = s.entity_id.split('.')[0]!, attributes = Object.fromEntries(Object.entries(s.attributes).filter(([key, value]) => SCENE_ATTRIBUTES[domain]?.includes(key) && value !== undefined && value !== null));
  const features = s.attributes.supported_features;
  if (typeof features === 'number') {
    const gated: Record<string, Record<string, number>> = { cover: { current_position: 4, current_tilt_position: 128 }, media_player: { volume_level: 4, is_volume_muted: 8, source: 2048, sound_mode: 65536 }, fan: { percentage: 1, oscillating: 2, direction: 4, preset_mode: 8 } };
    for (const [key, flag] of Object.entries(gated[domain] ?? {})) if (!(features & flag)) delete attributes[key];
  }
  if (domain === 'light') {
    if (Array.isArray(s.attributes.supported_color_modes) && s.attributes.supported_color_modes.every(mode => ['onoff', 'unknown'].includes(String(mode)))) delete attributes.brightness;
    const chosen = ({ color_temp: 'color_temp_kelvin', hs: 'hs_color', xy: 'xy_color', rgb: 'rgb_color', rgbw: 'rgbw_color', rgbww: 'rgbww_color' } as Record<string, string>)[String(s.attributes.color_mode)];
    for (const key of ['color_temp_kelvin', 'rgb_color', 'hs_color', 'xy_color', 'rgbw_color', 'rgbww_color']) if (key !== chosen) delete attributes[key];
  }
  const state = ['cover', 'valve'].includes(domain) ? s.state === 'closed' ? 'closed' : 'open' : domain === 'media_player' && s.state === 'buffering' ? 'playing' : s.state;
  return { entity_id: s.entity_id, state, attributes: structuredClone(attributes) };
}
