import type { HAArea, HADevice, HAEntity, HAFloor, HAState, ProjectConfig, Snapshot } from '../../shared/models';
import { parseProject } from '../../shared/project';
export interface Hass {
  states: Record<string, HAState>; language?: string; locale?: { language: string };
  config?: { version?: string; unit_system?: { temperature?: string } };
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
/** `version`: installed integration, returned by `project/get` since 0.2.7. */
export interface ProjectResponse { revision: number; project: ProjectConfig; version?: string }
export async function readProject(hass: Hass): Promise<ProjectResponse> {
  const response = await hass.callWS<ProjectResponse>({ type: 'mp_glass/project/get' });
  return { revision: response.revision, project: parseProject(response.project), ...(typeof response.version === 'string' ? { version: response.version } : {}) };
}
export async function saveProject(hass: Hass, response: ProjectResponse): Promise<ProjectResponse> {
  return hass.callWS({ type: 'mp_glass/project/save', revision: response.revision, project: parseProject(response.project) });
}
export const DASHBOARD_STRATEGY = 'custom:mp-glass';
/**
 * Dashboard running the MP Nexus strategy, created in the sidebar when none exists, through the same
 * public WebSocket commands as Home Assistant's "Add dashboard" dialog. Administrators only.
 */
export async function ensureDashboard(hass: Hass, title = 'MP Nexus'): Promise<{ urlPath: string; created: boolean }> {
  const dashboards = await hass.callWS<{ url_path: string }[]>({ type: 'lovelace/dashboards/list' });
  // Overview (null) last: an MP Nexus dashboard of its own is preferred when both exist.
  const paths: (string | null)[] = [...dashboards.map(d => d.url_path).sort((a, b) => Number(b === 'mp-glass') - Number(a === 'mp-glass')), null];
  const configs = await Promise.all(paths.map(url_path => hass.callWS<{ strategy?: { type?: unknown } }>({ type: 'lovelace/config', url_path }).catch(() => undefined)));
  const found = configs.findIndex(config => config?.strategy?.type === DASHBOARD_STRATEGY);
  if (found >= 0) return { urlPath: paths[found] ?? 'lovelace', created: false };
  const used = new Set(dashboards.map(d => d.url_path));
  for (const urlPath of ['mp-glass', 'mp-glass-2', 'mp-glass-3'].filter(path => !used.has(path))) {
    try { await hass.callWS({ type: 'lovelace/dashboards/create', url_path: urlPath, title, icon: 'mdi:view-dashboard', show_in_sidebar: true, require_admin: false }); }
    catch { continue; } // URL already used by another panel.
    await hass.callWS({ type: 'lovelace/config/save', url_path: urlPath, config: { strategy: { type: DASHBOARD_STRATEGY } } });
    return { urlPath, created: true };
  }
  throw new Error('dashboard_unavailable');
}
