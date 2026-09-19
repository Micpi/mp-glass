import { MPGlassLight, MPGlassGeneric } from './cards/light';
import { MPGlassCardEditor } from './cards/editor';
import { MPGlassView } from './view';
import { MPGlassStrategy } from './strategy';
import { MPGlassSettings } from './settings';
import { defineElement } from './registry';
import type { Hass } from './ha/client';
export const generateMPGlassDashboard = (config: { debug?: boolean }, hass: Hass) => MPGlassStrategy.generate(config, hass);
declare global {
  interface Window { customCards?: Record<string, unknown>[]; customStrategies?: Record<string, unknown>[] }
}
class MPGlassLightV2 extends MPGlassLight {}
class MPGlassGenericV2 extends MPGlassGeneric {}
class MPGlassViewV2 extends MPGlassView {}
class MPGlassLightV3 extends MPGlassLight {}
class MPGlassGenericV3 extends MPGlassGeneric {}
class MPGlassViewV3 extends MPGlassView {}
class MPGlassLightV4 extends MPGlassLight {}
class MPGlassGenericV4 extends MPGlassGeneric {}
class MPGlassViewV4 extends MPGlassView {}
class MPGlassViewV5 extends MPGlassView {}
defineElement('mp-glass-view-v5', MPGlassViewV5);
for (const [name, component] of Object.entries({ 'mp-glass-light':MPGlassLight, 'mp-glass-light-v2':MPGlassLightV2, 'mp-glass-light-v3':MPGlassLightV3, 'mp-glass-light-v4':MPGlassLightV4, 'mp-glass-generic':MPGlassGeneric, 'mp-glass-generic-v2':MPGlassGenericV2, 'mp-glass-generic-v3':MPGlassGenericV3, 'mp-glass-generic-v4':MPGlassGenericV4, 'mp-glass-card-editor':MPGlassCardEditor, 'mp-glass-view':MPGlassView, 'mp-glass-view-v2':MPGlassViewV2, 'mp-glass-view-v3':MPGlassViewV3, 'mp-glass-view-v4':MPGlassViewV4, 'll-strategy-dashboard-mp-glass':MPGlassStrategy, 'mp-glass-settings':MPGlassSettings })) {
  defineElement(name, component);
}
const registeredStrategy = customElements.get('ll-strategy-dashboard-mp-glass') as typeof MPGlassStrategy | undefined;
if (registeredStrategy && registeredStrategy !== MPGlassStrategy) {
  // shouldRegenerate goes with generate: both follow what this engine has generated.
  for (const key of ['generate', 'getCreateSuggestions', 'shouldRegenerate'] as const) {
    Object.defineProperty(registeredStrategy, key, { configurable: true, value: MPGlassStrategy[key].bind(MPGlassStrategy) });
  }
}
const registeredSettings = customElements.get('mp-glass-settings') as typeof MPGlassSettings | undefined;
if (registeredSettings && registeredSettings !== MPGlassSettings) {
  for (const key of Object.getOwnPropertyNames(MPGlassSettings.prototype)) {
    if (key === 'constructor') continue;
    const descriptor = Object.getOwnPropertyDescriptor(MPGlassSettings.prototype, key);
    if (descriptor) Object.defineProperty(registeredSettings.prototype, key, descriptor);
  }
  const sourceSettings = MPGlassSettings as unknown as { finalize(): void; elementStyles: unknown };
  const targetSettings = registeredSettings as unknown as { elementStyles: unknown };
  sourceSettings.finalize();
  Object.defineProperty(targetSettings, 'elementStyles', { configurable: true, value: sourceSettings.elementStyles });
}
window.customStrategies ??= [];
if (!window.customStrategies.some(s=>s.type==='mp-glass')) window.customStrategies.push({ type:'mp-glass', strategyType:'dashboard', name:'MP Nexus Dashboard' });
window.customCards ??= [];
if (!window.customCards.some(c=>c.type==='mp-glass-light')) window.customCards.push({ type:'mp-glass-light',name:'MP Nexus Light',preview:true,getEntitySuggestion:(_hass:Hass,entityId:string)=>entityId.startsWith('light.') ? {config:{type:'custom:mp-glass-light',entity:entityId}} : null });
