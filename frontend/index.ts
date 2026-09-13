import { MPGlassLight, MPGlassGeneric } from './cards/light';
import { MPGlassCardEditor } from './cards/editor';
import { MPGlassView } from './view';
import { MPGlassStrategy } from './strategy';
import { MPGlassSettings } from './settings';
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
for (const [name, component] of Object.entries({ 'mp-glass-light':MPGlassLight, 'mp-glass-light-v2':MPGlassLightV2, 'mp-glass-light-v3':MPGlassLightV3, 'mp-glass-generic':MPGlassGeneric, 'mp-glass-generic-v2':MPGlassGenericV2, 'mp-glass-generic-v3':MPGlassGenericV3, 'mp-glass-card-editor':MPGlassCardEditor, 'mp-glass-view':MPGlassView, 'mp-glass-view-v2':MPGlassViewV2, 'mp-glass-view-v3':MPGlassViewV3, 'll-strategy-dashboard-mp-glass':MPGlassStrategy, 'mp-glass-settings':MPGlassSettings })) {
  if (!customElements.get(name)) customElements.define(name, component);
}
const registeredStrategy = customElements.get('ll-strategy-dashboard-mp-glass') as typeof MPGlassStrategy | undefined;
if (registeredStrategy && registeredStrategy !== MPGlassStrategy) {
  Object.defineProperty(registeredStrategy, 'generate', { configurable: true, value: MPGlassStrategy.generate.bind(MPGlassStrategy) });
  Object.defineProperty(registeredStrategy, 'getCreateSuggestions', { configurable: true, value: MPGlassStrategy.getCreateSuggestions.bind(MPGlassStrategy) });
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
if (!window.customStrategies.some(s=>s.type==='mp-glass')) window.customStrategies.push({ type:'mp-glass', strategyType:'dashboard', name:'MP Glass Dashboard' });
window.customCards ??= [];
if (!window.customCards.some(c=>c.type==='mp-glass-light')) window.customCards.push({ type:'mp-glass-light',name:'MP Glass Light',preview:true,getEntitySuggestion:(_hass:Hass,entityId:string)=>entityId.startsWith('light.') ? {config:{type:'custom:mp-glass-light',entity:entityId}} : null });
