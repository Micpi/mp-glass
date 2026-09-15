import type { Hass } from './ha/client';

interface MPGlassModule {
  generateMPGlassDashboard(config: { debug?: boolean }, hass: Hass): Promise<unknown>;
}

/*
 * Loaded by Home Assistant with every page. Home Assistant gives up on a strategy that is not registered within
 * 5 s of opening the dashboard: this file registers it at once and imports nothing before that.
 */
const TAG = 'll-strategy-dashboard-mp-glass';
const log = (message: string) => console.info(`[MP Glass ${__MP_GLASS_VERSION__}] ${message} (${Math.round(performance.now())} ms après l’ouverture de la page)`);
/** Waits before each new attempt at loading the engine. */
const RETRIES = [1000, 2000, 4000, 8000];

/** A failed module fetch stays failed for the whole page, so each new attempt uses another URL. */
async function loadEngine(): Promise<MPGlassModule> {
  for (let attempt = 0; ; attempt++) {
    const url = new URL(/* @vite-ignore */ `./mp-glass.js?v=${__MP_GLASS_VERSION__}`, import.meta.url);
    if (attempt) url.searchParams.set('retry', String(attempt));
    try {
      return await import(/* @vite-ignore */ url.href) as MPGlassModule;
    } catch (error) {
      const wait = RETRIES[attempt];
      if (wait === undefined) throw new Error(`MP Glass n’a pas pu charger son interface (${String(error)}). Vérifiez la connexion à Home Assistant, puis rechargez la page.`);
      log(`interface injoignable, nouvel essai dans ${wait / 1000} s`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

class MPGlassDashboardBootstrap extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    log('dashboard demandé par Home Assistant');
    return (await loadEngine()).generateMPGlassDashboard(config, hass);
  }
}

if (!customElements.get(TAG)) {
  customElements.define(TAG, MPGlassDashboardBootstrap);
  log('stratégie du dashboard enregistrée');
} else {
  log('stratégie déjà enregistrée');
}

declare global { interface Window { customStrategies?: Record<string, unknown>[] } }
window.customStrategies ??= [];
if (!window.customStrategies.some(strategy => strategy.type === 'mp-glass')) {
  window.customStrategies.push({ type: 'mp-glass', strategyType: 'dashboard', name: 'MP Glass Dashboard' });
}
