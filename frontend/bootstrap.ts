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
type Language = 'fr' | 'en' | 'ru';
/** The interface language as frontend/i18n.ts decides it (this file imports nothing), for the two messages shown from here. */
function language(hass?: Hass): Language {
  let choice: string | null = null;
  try { choice = localStorage.getItem('mp-glass.language'); } catch { /* Storage blocked: the language of Home Assistant. */ }
  if (choice === 'fr' || choice === 'en' || choice === 'ru') return choice;
  const tag = (hass?.locale?.language ?? hass?.language ?? '').toLowerCase();
  return !tag || tag.startsWith('fr') ? 'fr' : tag.startsWith('ru') ? 'ru' : 'en';
}
const TOO_OLD: Record<Language, (agent: string) => string> = {
  fr: agent => `Ce navigateur est trop ancien pour l’interface MP Glass (au minimum Chrome 107, Safari 16 ou Firefox 104). Mettez à jour le navigateur, ou Android System WebView pour une application. Navigateur : ${agent}`,
  en: agent => `This browser is too old for the MP Glass interface (Chrome 107, Safari 16 or Firefox 104 at least). Update the browser, or Android System WebView for an app. Browser: ${agent}`,
  ru: agent => `Этот браузер слишком старый для интерфейса MP Glass (нужен как минимум Chrome 107, Safari 16 или Firefox 104). Обновите браузер или Android System WebView для приложения. Браузер: ${agent}`,
};
const UNREACHABLE: Record<Language, (error: string) => string> = {
  fr: error => `MP Glass n’a pas pu charger son interface (${error}). Vérifiez la connexion à Home Assistant, puis rechargez la page.`,
  en: error => `MP Glass could not load its interface (${error}). Check the connection to Home Assistant, then reload the page.`,
  ru: error => `MP Glass не удалось загрузить интерфейс (${error}). Проверьте подключение к Home Assistant, затем перезагрузите страницу.`,
};
/** Waits before each new attempt at loading the engine. */
const RETRIES = [1000, 2000, 4000, 8000];
/** Registries whose change regenerates a strategy dashboard, as Home Assistant does by default. */
const REGISTRIES = ['entities', 'devices', 'areas', 'floors'];
let requested = false;
let healed = false;
/** Failed engine downloads on this page, including those of an earlier dashboard generation. */
let failures = 0;

/** A failed module fetch stays failed for the whole page, so each new attempt uses another URL. */
async function loadEngine(lang: Language): Promise<MPGlassModule> {
  for (let attempt = 0; ; attempt++) {
    const url = new URL(/* @vite-ignore */ `./mp-glass.js?v=${__MP_GLASS_VERSION__}`, import.meta.url);
    if (failures) url.searchParams.set('retry', String(failures));
    try {
      return await import(/* @vite-ignore */ url.href) as MPGlassModule;
    } catch (error) {
      failures++;
      // The engine downloaded but this browser cannot read it: waiting would not help.
      if (error instanceof SyntaxError) throw new Error(TOO_OLD[lang](navigator.userAgent));
      const wait = RETRIES[attempt];
      if (wait === undefined) throw new Error(UNREACHABLE[lang](String(error)));
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
    return (await loadEngine(language(hass))).generateMPGlassDashboard(config, hass);
  }
}

if (!customElements.get(TAG)) {
  customElements.define(TAG, MPGlassDashboardBootstrap);
  log('stratégie du dashboard enregistrée');
  // A registry polyfill loaded later replaces window.customElements with a registry that ignores this strategy:
  // define it there too. Same rule as frontend/registry.ts, which this file cannot import.
  let registry = window.customElements;
  setInterval(() => {
    const current = window.customElements;
    if (current === registry) return;
    registry = current;
    if (current.get(TAG)) return;
    try {
      current.define(TAG, MPGlassDashboardBootstrap);
      log('stratégie enregistrée à nouveau : un module a remplacé le registre des éléments');
    } catch { /* Defined meanwhile by the engine. */ }
  }, 250);
} else {
  log('stratégie déjà enregistrée');
}

declare global { interface Window { customStrategies?: Record<string, unknown>[] } }
const strategies = window.customStrategies || (window.customStrategies = []);
if (!strategies.some(strategy => strategy.type === 'mp-glass')) {
  strategies.push({ type: 'mp-glass', strategyType: 'dashboard', name: 'MP Glass Dashboard' });
}
