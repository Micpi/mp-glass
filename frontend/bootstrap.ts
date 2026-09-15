import type { Hass } from './ha/client';

interface MPGlassModule {
  generateMPGlassDashboard(config: { debug?: boolean }, hass: Hass): Promise<unknown>;
}

/*
 * Loaded by Home Assistant with every page. Home Assistant gives up on a strategy that is not registered within
 * 5 s of opening the dashboard: this file registers it at once and imports nothing before that. Its syntax is
 * lowered to ES2017 at build time (vite.config.ts), so that it registers even on old tablets.
 */
const TAG = 'll-strategy-dashboard-mp-glass';
const log = (message: string) => console.info(`[MP Glass ${__MP_GLASS_VERSION__}] ${message} (${Math.round(performance.now())} ms après l’ouverture de la page)`);
/** Waits before each new attempt at loading the engine. */
const RETRIES = [1000, 2000, 4000, 8000];
/** Registries whose change regenerates a strategy dashboard, as Home Assistant does by default. */
const REGISTRIES = ['entities', 'devices', 'areas', 'floors'];
let requested = false;
let healed = false;

/** A failed module fetch stays failed for the whole page, so each new attempt uses another URL. */
async function loadEngine(): Promise<MPGlassModule> {
  for (let attempt = 0; ; attempt++) {
    const url = new URL(/* @vite-ignore */ `./mp-glass.js?v=${__MP_GLASS_VERSION__}`, import.meta.url);
    if (attempt) url.searchParams.set('retry', String(attempt));
    try {
      return await import(/* @vite-ignore */ url.href) as MPGlassModule;
    } catch (error) {
      // The engine downloaded but this browser cannot read it: waiting would not help.
      if (error instanceof SyntaxError) throw new Error(`Ce navigateur est trop ancien pour l’interface MP Glass (au minimum Chrome 107, Safari 16 ou Firefox 104). Mettez à jour le navigateur, ou Android System WebView pour une application. Navigateur : ${navigator.userAgent}`);
      const wait = RETRIES[attempt];
      if (wait === undefined) throw new Error(`MP Glass n’a pas pu charger son interface (${String(error)}). Vérifiez la connexion à Home Assistant, puis rechargez la page.`);
      log(`interface injoignable, nouvel essai dans ${wait / 1000} s`);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

class MPGlassDashboardBootstrap extends HTMLElement {
  static getCreateSuggestions() { return { title: 'MP Glass', icon: 'mdi:view-dashboard' }; }
  /**
   * Home Assistant asks this on each state update of a strategy dashboard on screen. Never asked for a dashboard
   * yet means it gave up before this strategy was registered and shows its timeout error: replace it, once.
   * Same rule as MPGlassStrategy.shouldRegenerate, which the engine puts in place of this one.
   */
  static shouldRegenerate(_config: unknown, oldHass: Record<string, unknown>, newHass: Record<string, unknown>) {
    if (!requested && !healed) {
      healed = true;
      log('dashboard resté en erreur, nouvelle génération');
      return true;
    }
    return REGISTRIES.some(key => oldHass[key] !== newHass[key]);
  }
  static async generate(config: { debug?: boolean }, hass: Hass) {
    requested = true;
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
const strategies = window.customStrategies || (window.customStrategies = []);
if (!strategies.some(strategy => strategy.type === 'mp-glass')) {
  strategies.push({ type: 'mp-glass', strategyType: 'dashboard', name: 'MP Glass Dashboard' });
}
