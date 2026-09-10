import Ajv from 'ajv';
import schema from './project.schema.json';
import type { ProjectConfig } from './models';
const validate = new Ajv({ allErrors: true, strict: true }).compile<ProjectConfig>(schema);
export function parseProject(value: unknown): ProjectConfig {
  if (!validate(value)) throw new Error('invalid_project');
  return structuredClone(value);
}
export function defaultProject(name = 'MP Glass'): ProjectConfig {
  return { schema_version: 1, project: { name }, appearance: { preset: 'glass-blue' }, roles: {}, overrides: {} };
}
export function migrateProject(value: unknown): ProjectConfig {
  // Version 1 is the first published schema. Future versions must not be stripped.
  return parseProject(value);
}
