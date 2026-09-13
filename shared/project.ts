import Ajv from 'ajv';
import schema from './project.schema.json';
import type { ProjectConfig } from './models';
const validate = new Ajv({ allErrors: true, strict: true }).compile<ProjectConfig>(schema);
export function parseProject(value: unknown): ProjectConfig {
  if (!validate(value)) throw new Error('invalid_project');
  return structuredClone(value);
}
export function defaultProject(name = 'MP Glass'): ProjectConfig {
  return { schema_version: 2, project: { name }, appearance: { preset: 'glass-blue', accent: '#69b7ff', secondaryAccent: '#f1bd86', glassTint: '#102f49', glassOpacity: .62, glassBlur: 22, borderStrength: .22, shadowStrength: .38, radius: 22, backgroundDim: .44, backgroundPosition: 'right', backgroundBlur: 0, backgroundSaturation: 1, density: 'comfortable', fontStyle: 'elegant', iconStyle: 'tile', cardStyle: 'standard', cardColumns: 4, cardGap: 12, maxWidth: 1560, heroHeight: 455, motion: true, showHero: true, showClock: true, showOverview: true, showFooter: true, showSettingsShortcut: true, showCardDetails: true, showBrightness: true, eyebrow: 'Une maison plus simple à vivre', subtitle: 'Vos équipements sont prêts, pièce par pièce.', quote: 'Les plus beaux moments commencent à la maison.', sectionTitle: 'Lumières', sectionSubtitle: 'Contrôle rapide de tous les éclairages détectés' }, navigation: { items: ['home','lights','rooms'], showLabels: true }, roles: {}, overrides: {} };
}
export function migrateProject(value: unknown): ProjectConfig {
  if (value && typeof value === 'object' && (value as {schema_version?:number}).schema_version === 1) {
    const legacy = structuredClone(value) as Record<string, unknown>;
    const identity = legacy.project as {name?:string} | undefined;
    const defaults = defaultProject(identity?.name ?? 'MP Glass');
    return parseProject({ ...defaults, ...legacy, schema_version: 2, appearance: { ...defaults.appearance, ...(legacy.appearance as object ?? {}) }, navigation: defaults.navigation });
  }
  return parseProject(value);
}
