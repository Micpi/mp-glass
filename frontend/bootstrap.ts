import type { Hass } from './ha/client';

interface MPGlassModule {
  generateMPGlassDashboard(config: { debug?: boolean }, hass: Hass): Promise<unknown>;
}

class MPGlassDashboardBootstrap extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    const url = new URL(/* @vite-ignore */ './mp-glass.js?v=0.2.3', import.meta.url).href;
    const module = await import(/* @vite-ignore */ url) as MPGlassModule;
    return module.generateMPGlassDashboard(config, hass);
  }
}

if (!customElements.get('ll-strategy-dashboard-mp-glass')) {
  customElements.define('ll-strategy-dashboard-mp-glass', MPGlassDashboardBootstrap);
}

declare global { interface Window { customStrategies?: Record<string, unknown>[] } }
window.customStrategies ??= [];
if (!window.customStrategies.some(strategy => strategy.type === 'mp-glass')) {
  window.customStrategies.push({ type: 'mp-glass', strategyType: 'dashboard', name: 'MP Glass Dashboard' });
}
