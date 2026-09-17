import { copyFile, readFile, writeFile } from 'node:fs/promises';
// The plan schema lives in one place and is embedded in the project schema, so a room never has two definitions.
const project = JSON.parse(await readFile('shared/project.schema.json', 'utf8'));
const { $schema, ...spatial } = JSON.parse(await readFile('shared/spatial.schema.json', 'utf8'));
project.properties.spatial = spatial;
await writeFile('shared/project.schema.json', `${JSON.stringify(project, null, 2)}\n`);
await copyFile('shared/project.schema.json', 'custom_components/mp_glass/project.schema.json');
await copyFile('shared/spatial.schema.json', 'custom_components/mp_glass/spatial.schema.json');
await copyFile('shared/spatial.schema.json', 'addons/mp_glass_spatial/spatial.schema.json');
await copyFile('custom_components/mp_glass/spatial_contract.py', 'addons/mp_glass_spatial/spatial_contract.py');
await copyFile('custom_components/mp_glass/spatial_gemini.py', 'addons/mp_glass_spatial/spatial_gemini.py');
