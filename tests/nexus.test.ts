import { describe, expect, it } from 'vitest';
import { home } from './fixtures';
import { MPDiscoveryEngine } from '../shared/discovery';
import { defaultProject, interfaceVersion, parseProject, projectChanges } from '../shared/project';
import { MPDashboardComposer } from '../shared/presentation';

describe('MP Nexus v2 interface', () => {
  it('keeps v1 for a project that never chose, and v2 once chosen', () => {
    const v1 = defaultProject(), v2 = { ...v1, interface: { version: 2 as const } };
    expect(interfaceVersion(v1)).toBe(1);
    expect(interfaceVersion(parseProject(v2))).toBe(2);
    expect(() => parseProject({ ...v1, interface: { version: 3 } })).toThrow();
    expect(projectChanges(v1, v2)).toEqual([{ field: 'interface' }]);
    expect(projectChanges(v1, { ...v1, interface: { version: 1 } })).toEqual([]);
  });
  it('draws every page in the v2 view, with Multimédia, Plus and the plan beside each page', () => {
    const project = { ...defaultProject(), interface: { version: 2 as const } };
    const dashboard = MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(), project), project);
    expect(dashboard.views.every(view => view.type === 'custom:mp-nexus-view-v2')).toBe(true);
    expect(dashboard.views.map(view => view.path)).toEqual(expect.arrayContaining(['home', 'lights', 'rooms', 'media', 'plus', 'info']));
    expect(dashboard.views.every(view => 'mp_spatial' in view)).toBe(true);
  });
  it('leaves the v1 dashboard as it was', () => {
    const project = defaultProject();
    const dashboard = MPDashboardComposer.compose(MPDiscoveryEngine.discover(home(), project), project);
    expect(dashboard.views.every(view => view.type === 'custom:mp-glass-view-v5')).toBe(true);
    expect(dashboard.views.map(view => view.path)).not.toContain('media');
    expect(dashboard.views.filter(view => 'mp_spatial' in view).map(view => view.path)).toEqual(['home']);
  });
});
