import { MPCapabilityEngine } from './capabilities';
import type { LogicalDevice, MPHomeGraph, ProjectConfig, Snapshot } from './models';
const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export class MPDiscoveryEngine {
  static discover(snapshot: Snapshot, project: ProjectConfig): MPHomeGraph {
    const source = new Map(snapshot.devices.map(d => [d.id, d]));
    const areas = new Map(snapshot.areas.map(a => [a.area_id, a]));
    const registry = new Map(snapshot.entities.map(e => [e.entity_id, e]));
    for (const entityId of Object.keys(snapshot.states)) if (!registry.has(entityId)) registry.set(entityId, { entity_id: entityId });
    const warnings = [...snapshot.warnings];
    const devices: LogicalDevice[] = [...registry.values()].map((entity): LogicalDevice => {
      const state = snapshot.states[entity.entity_id];
      const entityKey = entity.id ?? `state:${entity.entity_id}`;
      const override = project.overrides[entityKey];
      const device = entity.device_id ? source.get(entity.device_id) : undefined;
      const areaId = override?.areaId ?? entity.area_id ?? device?.area_id ?? undefined;
      const category = entity.entity_id.split('.')[0] === 'light' ? 'light' : 'generic';
      const evidence = [category === 'light' ? 'domain:light' : 'fallback:unknown'];
      if (!areaId) warnings.push(`no_area:${entityKey}`);
      else if (!areas.has(areaId)) warnings.push(`missing_area:${entityKey}`);
      if (!entity.id) evidence.push('identity:provisional');
      let presentation = override?.presentation;
      if (presentation === 'light' && category !== 'light') { warnings.push(`incompatible_override:${entityKey}`); presentation = undefined; }
      return {
        id: `logical:${entityKey}`, entityKey, entityId: entity.entity_id,
        name: override?.name ?? entity.name ?? (typeof state?.attributes.friendly_name === 'string' ? state.attributes.friendly_name : entity.original_name) ?? entity.entity_id,
        sourceDeviceIds: entity.device_id ? [entity.device_id] : [], areaId, floorId: areaId ? areas.get(areaId)?.floor_id ?? undefined : undefined,
        category, presentation, confidence: category === 'light' ? 0.99 : 0,
        evidence, capabilities: MPCapabilityEngine.detect(entity.entity_id, state),
        hidden: override?.hidden ?? !!entity.hidden_by, disabled: !!entity.disabled_by,
      };
    }).sort(byId);
    return { floors: [...snapshot.floors].sort((a,b) => byId({id:a.floor_id},{id:b.floor_id})), areas: [...snapshot.areas].sort((a,b) => byId({id:a.area_id},{id:b.area_id})), sourceDevices: [...snapshot.devices].sort(byId), devices, warnings: [...new Set(warnings)].sort() };
  }
}
