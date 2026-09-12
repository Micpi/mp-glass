import type { CardDefinition, LogicalDevice, MPHomeGraph, ProjectConfig } from './models';
export class MPCardRegistry {
  private definitions: CardDefinition[] = [];
  register(definition: CardDefinition) {
    if (this.definitions.some(d => d.type === definition.type)) throw new Error('duplicate_card');
    this.definitions.push(definition);
  }
  resolve(device: LogicalDevice): CardDefinition {
    const category = device.presentation ?? device.category;
    const candidates = this.definitions.filter(d => d.categories.includes(category) && d.requires.every(c => device.capabilities.some(b => b.capability === c)));
    const selected = candidates.sort((a,b) => b.priority - a.priority || (a.type < b.type ? -1 : 1))[0];
    const fallback = this.definitions.find(d => d.type === 'custom:mp-glass-generic');
    if (!selected && !fallback) throw new Error('missing_fallback');
    return selected ?? fallback!;
  }
}
export const cardRegistry = new MPCardRegistry();
cardRegistry.register({ type: 'custom:mp-glass-light', categories: ['light'], requires: ['POWER'], priority: 100, variants: ['standard'] });
cardRegistry.register({ type: 'custom:mp-glass-generic', categories: ['generic'], requires: [], priority: 0, variants: ['standard'] });
export class MPPresentationResolver {
  static resolve(device: LogicalDevice) { return { card: cardRegistry.resolve(device), evidence: device.evidence, capabilities: device.capabilities }; }
}
export class MPDashboardComposer {
  static compose(graph: MPHomeGraph, project: ProjectConfig, debug = false, inventoryTitle = 'Inventory') {
    const visible = graph.devices.filter(d => !d.hidden && !d.disabled);
    const devices = visible.filter(d => d.category !== 'generic');
    const inventory = visible.filter(d => d.category === 'generic');
    const cards = (items: LogicalDevice[]) => items.map(d => ({ type: cardRegistry.resolve(d).type, entity: d.entityId, name: d.name, preset: project.appearance.preset, debug }));
    return {
      title: project.project.name,
      views: [
        { title: project.project.name, path: 'home', icon: 'mdi:home', type: 'custom:mp-glass-view', cards: cards(devices) },
        ...graph.areas.filter(a => devices.some(d => d.areaId === a.area_id)).map(a => ({ title: a.name, path: `area-${a.area_id}`, icon: a.icon ?? 'mdi:floor-plan', type: 'custom:mp-glass-view', cards: cards(devices.filter(d => d.areaId === a.area_id)) })),
        ...(inventory.length ? [{title: inventoryTitle, path: 'inventory', icon: 'mdi:archive-search', type: 'custom:mp-glass-view', cards: cards(inventory)}] : []),
      ],
    };
  }
}
