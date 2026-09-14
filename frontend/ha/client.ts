import type { HAArea, HADevice, HAEntity, HAFloor, HAState, ProjectConfig, Snapshot } from '../../shared/models';
import { parseProject } from '../../shared/project';
export interface Hass {
  states: Record<string, HAState>; language?: string; locale?: { language: string };
  user?: { id: string; is_admin: boolean };
  connection: object;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown>;
  fetchWithAuth?(path: string, init?: RequestInit): Promise<Response>;
}
interface Structure { floors: HAFloor[]; areas: HAArea[]; devices: HADevice[]; entities: HAEntity[]; warnings: string[] }
const cache = new WeakMap<object, { at: number; promise: Promise<Structure> }>();
export class HARegistryReader {
  static invalidate(hass: Hass) { cache.delete(hass.connection); }
  static async read(hass: Hass, force = false): Promise<Snapshot> {
    let entry = cache.get(hass.connection);
    if (force || !entry || Date.now() - entry.at > 60_000) {
      const promise = Promise.all([
        hass.callWS<HAArea[]>({ type: 'config/area_registry/list' }),
        hass.callWS<HADevice[]>({ type: 'config/device_registry/list' }),
        hass.callWS<HAEntity[]>({ type: 'config/entity_registry/list' }),
        hass.callWS<HAFloor[]>({ type: 'config/floor_registry/list' }).then(floors => ({ floors, warnings: [] as string[] })).catch((error: unknown) => {
          if ((error as { code?: string })?.code === 'unknown_command') return { floors: [], warnings: ['floors:unsupported'] };
          throw error;
        }),
      ]).then(([areas, devices, entities, floor]) => ({ areas, devices, entities, ...floor }));
      entry = { at: Date.now(), promise }; cache.set(hass.connection, entry);
      promise.catch(() => { if (cache.get(hass.connection)?.promise === promise) cache.delete(hass.connection); });
    }
    return { ...await entry.promise, states: hass.states };
  }
}
export interface ProjectResponse { revision: number; project: ProjectConfig }
export async function readProject(hass: Hass): Promise<ProjectResponse> {
  const response = await hass.callWS<ProjectResponse>({ type: 'mp_glass/project/get' });
  return { revision: response.revision, project: parseProject(response.project) };
}
export async function saveProject(hass: Hass, response: ProjectResponse): Promise<ProjectResponse> {
  return hass.callWS({ type: 'mp_glass/project/save', revision: response.revision, project: parseProject(response.project) });
}
