import { copyFile } from 'node:fs/promises';
await copyFile('shared/project.schema.json', 'custom_components/mp_glass/project.schema.json');
