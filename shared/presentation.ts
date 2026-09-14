import type { CardDefinition, LogicalDevice, MPHomeGraph, ProjectConfig } from './models';
import { defaultSpatialPlan, examplePlan } from './spatial';

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
    const fallback = this.definitions.find(d => d.type === 'custom:mp-glass-generic-v4');
    if (!selected && !fallback) throw new Error('missing_fallback');
    return selected ?? fallback!;
  }
}

export const cardRegistry = new MPCardRegistry();
cardRegistry.register({ type: 'custom:mp-glass-light-v4', categories: ['light'], requires: ['POWER'], priority: 100, variants: ['compact','standard','spacious'] });
cardRegistry.register({ type: 'custom:mp-glass-generic-v4', categories: ['generic'], requires: [], priority: 0, variants: ['standard'] });

export class MPPresentationResolver {
  static resolve(device: LogicalDevice) { return { card: cardRegistry.resolve(device), evidence: device.evidence, capabilities: device.capabilities }; }
}

export class MPDashboardComposer {
  static compose(graph: MPHomeGraph, project: ProjectConfig, debug = false, inventoryTitle = 'Inventory') {
    const visible = graph.devices.filter(d => !d.hidden && !d.disabled);
    const devices = visible.filter(d => d.category !== 'generic');
    const lights = devices.filter(d => d.category === 'light');
    const inventory = visible.filter(d => d.category === 'generic');
    const cards = (items: LogicalDevice[]) => items.map(d => ({
      type: cardRegistry.resolve(d).type,
      entity: d.entityId,
      name: d.name,
      preset: project.appearance.preset,
      appearance: project.appearance,
      debug,
    }));
    const areas = graph.areas
      .filter(a => devices.some(d => d.areaId === a.area_id))
      .map(a => {
        const members = devices.filter(d => d.areaId === a.area_id);
        return {
          id: a.area_id,
          name: a.name,
          icon: a.icon ?? undefined,
          picture: a.picture ?? undefined,
          deviceCount: members.length,
          lightCount: members.filter(d => d.category === 'light').length,
        };
      });
    // Until a plan is saved in the Studio, the home view shows a schematic plan of the HA areas.
    const generated = project.spatial ? undefined : defaultSpatialPlan(graph);
    const spatial = project.spatial ?? generated ?? examplePlan();
    const spatialOrigin = project.spatial ? 'project' as const : generated ? 'areas' as const : 'example' as const;
    const view = (path: string, title: string, kind: 'home'|'lights'|'rooms'|'area'|'inventory', viewCards: ReturnType<typeof cards>, icon: string) => ({
      title,
      path,
      icon,
      type: 'custom:mp-glass-view-v5',
      mp_project_name: project.project.name,
      mp_appearance: project.appearance,
      mp_navigation: project.navigation,
      mp_view_kind: kind,
      mp_view_path: path,
      mp_view_title: title,
      mp_areas: areas,
      ...(kind === 'home' ? { mp_spatial: spatial, mp_spatial_origin: spatialOrigin } : {}),
      cards: viewCards,
    });
    return {
      title: project.project.name,
      views: [
        view('home', project.project.name, 'home', cards(devices), 'mdi:home'),
        view('lights', 'Lumières', 'lights', cards(lights), 'mdi:lightbulb-group'),
        view('rooms', 'Pièces', 'rooms', [], 'mdi:floor-plan'),
        ...areas.map(a => view(`area-${a.id}`, a.name, 'area', cards(devices.filter(d => d.areaId === a.id)), a.icon ?? 'mdi:floor-plan')),
        ...(inventory.length ? [view('inventory', inventoryTitle, 'inventory', cards(inventory), 'mdi:archive-search')] : []),
      ],
    };
  }
}
