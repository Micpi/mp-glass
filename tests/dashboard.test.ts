import { describe, expect, it } from 'vitest';
import { ensureDashboard, type Hass } from '../frontend/ha/client';

/** Minimal Lovelace WebSocket API: dashboards list, per-dashboard config, create and save. */
function lovelace(dashboards: { url_path: string; config?: object }[], panels: string[] = []) {
  const calls: Record<string, unknown>[] = [];
  const hass = { connection: {}, states: {}, callService: async () => undefined, callWS: async <T>(message: Record<string, unknown>) => {
    calls.push(message);
    const dashboard = dashboards.find(d => d.url_path === message.url_path);
    switch (message.type) {
      case 'lovelace/dashboards/list': return dashboards.map(({ url_path }) => ({ url_path, mode: 'storage' })) as T;
      case 'lovelace/config': if (dashboard?.config) return dashboard.config as T; throw { code: 'config_not_found' };
      case 'lovelace/dashboards/create': if (panels.includes(String(message.url_path))) throw { code: 'invalid_format' }; dashboards.push({ url_path: String(message.url_path) }); return {} as T;
      case 'lovelace/config/save': dashboard!.config = message.config as object; return undefined as T;
      default: throw Error(`unexpected ${String(message.type)}`);
    }
  } } as Hass;
  return { hass, calls, dashboards };
}

describe('MP Glass dashboard', () => {
  it('reuses a dashboard that already runs the strategy, whatever its URL', async () => {
    const { hass, calls } = lovelace([{ url_path: 'dashboard-maison', config: { strategy: { type: 'custom:mp-glass' } } }, { url_path: 'energie', config: { views: [] } }]);
    expect(await ensureDashboard(hass)).toEqual({ urlPath: 'dashboard-maison', created: false });
    expect(calls.some(c => c.type === 'lovelace/dashboards/create')).toBe(false);
  });

  it('creates it in the sidebar with the strategy when missing', async () => {
    const { hass, calls, dashboards } = lovelace([{ url_path: 'energie', config: { views: [] } }]);
    expect(await ensureDashboard(hass)).toEqual({ urlPath: 'mp-glass', created: true });
    expect(calls).toContainEqual({ type: 'lovelace/dashboards/create', url_path: 'mp-glass', title: 'MP Glass', icon: 'mdi:view-dashboard', show_in_sidebar: true, require_admin: false });
    expect(dashboards.find(d => d.url_path === 'mp-glass')?.config).toEqual({ strategy: { type: 'custom:mp-glass' } });
    expect(await ensureDashboard(hass)).toEqual({ urlPath: 'mp-glass', created: false });
  });

  it('picks another URL when mp-glass belongs to something else', async () => {
    const { hass } = lovelace([{ url_path: 'mp-glass', config: { views: [] } }], ['mp-glass-2']);
    expect(await ensureDashboard(hass)).toEqual({ urlPath: 'mp-glass-3', created: true });
  });
});
