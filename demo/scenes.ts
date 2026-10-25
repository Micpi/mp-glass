import type { Hass } from '../frontend/ha/client';
import { captureTarget, SCENE_ATTRIBUTES, sceneValue, type NexusScene, type SceneValue } from '../frontend/v2/scenes';

/** A local simulation of the authenticated scene API; never used by the integration bundle. */
export function installScenesDemo(hass: Hass, publish: () => void, fixtures = false, readonly = false) {
  const key = 'mp-nexus.demo.scenes';
  let scenes: NexusScene[] = [];
  try { scenes = JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { /* A fresh demo. */ }
  const requests: Record<string, unknown>[] = [];
  const persist = () => localStorage.setItem(key, JSON.stringify(scenes));
  const areas = Object.fromEntries(Object.keys(hass.states).map(id => [id, /cuisine/.test(id) ? 'Cuisine' : /chambre/.test(id) ? 'Chambre' : 'Salon']));
  if (fixtures) hass.states = { ...hass.states, 'scene.soiree': { entity_id: 'scene.soiree', state: 'unknown', attributes: { friendly_name: 'Soirée existante', icon: 'mdi:movie-open', entity_id: ['light.circuit_0', 'light.circuit_1'] } } };
  const sync = () => {
    const states = { ...hass.states };
    for (const [id, state] of Object.entries(states)) if (state.attributes.mp_nexus_scene && !scenes.some(s => s.id === state.attributes.mp_nexus_scene)) delete states[id];
    for (const s of scenes) {
      s.entity_id ??= `scene.mp_nexus_${s.id}`;
      states[s.entity_id] = { entity_id: s.entity_id, state: states[s.entity_id]?.state ?? 'unknown', attributes: { friendly_name: s.name, mp_nexus_scene: s.id, mp_nexus_icon: s.icon, mp_nexus_source: s.source, entity_id: s.source ? [s.source] : s.entities.map(e => e.entity_id) } };
    }
    hass.states = states; publish();
  };
  const apply = (value: SceneValue) => {
    if (value.source) return;
    const states = { ...hass.states };
    for (const target of value.entities) {
      const before = states[target.entity_id];
      if (!before || ['unknown', 'unavailable'].includes(before.state)) throw { code: 'unavailable' };
    }
    for (const target of value.entities) states[target.entity_id] = { ...states[target.entity_id]!, state: target.state, attributes: { ...states[target.entity_id]!.attributes, ...structuredClone(target.attributes) } };
    hass.states = states; publish();
  };
  const originalWS = hass.callWS, originalService = hass.callService;
  hass.callWS = async <T>(message: Record<string, unknown>): Promise<T> => {
    if (!String(message.type).startsWith('mp_glass/scenes/')) return originalWS<T>(message);
    requests.push(structuredClone(message));
    const candidates = Object.values(hass.states).filter(s => SCENE_ATTRIBUTES[s.entity_id.split('.')[0]!] && !['unavailable', 'unknown'].includes(s.state)).map(s => s.entity_id);
    if (message.type === 'mp_glass/scenes/list') return structuredClone({ scenes: scenes.map(s => ({ ...s, editable: !readonly })), candidates: readonly ? [] : candidates, native: readonly ? [] : Object.values(hass.states).filter(s => s.entity_id.startsWith('scene.') && !s.attributes.mp_nexus_scene).map(s => s.entity_id), can_create: !readonly, areas }) as T;
    if (readonly) throw { code: 'forbidden' };
    if (message.type === 'mp_glass/scenes/snapshot') return { entities: (message.entities as string[]).map(id => captureTarget(hass.states[id]!)) } as T;
    if (message.type === 'mp_glass/scenes/preview') { apply(message.scene as SceneValue); return undefined as T; }
    const existing = scenes.find(s => s.id === message.scene_id);
    if (Number(message.revision) !== (existing?.revision ?? 0)) throw { code: 'conflict' };
    if (message.type === 'mp_glass/scenes/delete') { scenes = scenes.filter(s => s.id !== message.scene_id); persist(); sync(); return undefined as T; }
    if (message.type === 'mp_glass/scenes/save') {
      const value = sceneValue(message.scene as SceneValue), id = String(message.scene_id);
      const saved: NexusScene = { ...value, id, revision: (existing?.revision ?? 0) + 1, entity_id: existing?.entity_id ?? `scene.mp_nexus_${id}`, editable: true };
      scenes = [...scenes.filter(s => s.id !== id), saved]; persist(); sync(); return structuredClone(saved) as T;
    }
    throw { code: 'unknown_command' };
  };
  hass.callService = async (domain, service, data) => {
    if (domain !== 'scene') return originalService(domain, service, data);
    if (readonly) throw { code: 'forbidden' };
    const saved = scenes.find(s => s.entity_id === data.entity_id);
    if (saved) apply(saved);
    const result = await originalService(domain, service, data);
    const id = String(data.entity_id), before = hass.states[id];
    if (before) hass.states = { ...hass.states, [id]: { ...before, state: new Date().toISOString() } };
    sync(); return result;
  };
  sync();
  return requests;
}
