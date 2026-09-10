import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { HARegistryReader, readProject, type Hass } from './ha/client';
export class MPGlassStrategy extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    const [snapshot, {project}] = await Promise.all([HARegistryReader.read(hass), readProject(hass)]);
    return MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot, project), project, !!config.debug && !!hass.user?.is_admin);
  }
}
