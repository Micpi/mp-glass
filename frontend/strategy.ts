import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { HARegistryReader, readProject, type Hass } from './ha/client';
import { t } from './i18n';
/** Codes answered while the MP Glass integration is still starting or reloading. */
const NOT_READY = ['unknown_command', 'not_loaded'];
/** Waits for the integration rather than failing: Home Assistant keeps its loading screen meanwhile. */
async function readProjectWhenReady(hass: Hass) {
  for (let attempt = 1; ; attempt++) {
    try { return await readProject(hass); }
    catch (error) {
      if (!NOT_READY.includes((error as { code?: string })?.code ?? '')) throw error;
      if (attempt === 10) throw new Error('MP Glass n’est pas chargé dans Home Assistant. Vérifiez l’intégration dans Paramètres → Appareils et services, puis rechargez la page.');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
export class MPGlassStrategy extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    const [snapshot, {project}] = await Promise.all([HARegistryReader.read(hass), readProjectWhenReady(hass)]);
    return MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot, project), project, !!config.debug && !!hass.user?.is_admin, t(hass.locale?.language ?? hass.language, 'inventory'));
  }
}
