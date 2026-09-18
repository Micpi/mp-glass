import { MPDiscoveryEngine } from '../shared/discovery';
import { MPDashboardComposer } from '../shared/presentation';
import { HARegistryReader, readProject, type Hass } from './ha/client';
import { followHass, tr } from './i18n';
/** Codes answered while the MP Glass integration is still starting or reloading. */
const NOT_READY = ['unknown_command', 'not_loaded'];
/** Waits for the integration rather than failing: Home Assistant keeps its loading screen meanwhile. */
async function readProjectWhenReady(hass: Hass) {
  for (let attempt = 1; ; attempt++) {
    try { return await readProject(hass); }
    catch (error) {
      if (!NOT_READY.includes((error as { code?: string })?.code ?? '')) throw error;
      if (attempt === 10) throw new Error(tr('MP Glass n’est pas chargé dans Home Assistant. Vérifiez l’intégration dans Paramètres → Appareils et services, puis rechargez la page.'));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
/** Registries whose change regenerates a strategy dashboard, as Home Assistant does by default. */
const REGISTRIES = ['entities', 'devices', 'areas', 'floors'];
let generated = false;
let healed = false;
export class MPGlassStrategy extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  /** Registered after Home Assistant gave up waiting for it, the strategy replaces the timeout error once (see the bootstrap). */
  static shouldRegenerate(_config: unknown, oldHass: Record<string, unknown>, newHass: Record<string, unknown>) {
    if (!generated && !healed) return healed = true;
    return REGISTRIES.some(key => oldHass[key] !== newHass[key]);
  }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    generated = true;
    followHass(hass);
    const [snapshot, {project}] = await Promise.all([HARegistryReader.read(hass), readProjectWhenReady(hass)]);
    return MPDashboardComposer.compose(MPDiscoveryEngine.discover(snapshot, project), project, !!config.debug && !!hass.user?.is_admin, tr('Inventaire'), { lights: tr('Lumières'), rooms: tr('Pièces') });
  }
}
