import { copyFile } from 'node:fs/promises';
await copyFile('shared/project.schema.json', 'custom_components/mp_glass/project.schema.json');
await copyFile('shared/spatial.schema.json', 'custom_components/mp_glass/spatial.schema.json');
await copyFile('shared/spatial.schema.json', 'addons/mp_glass_spatial/spatial.schema.json');
await copyFile('custom_components/mp_glass/spatial_contract.py', 'addons/mp_glass_spatial/spatial_contract.py');
await copyFile('custom_components/mp_glass/spatial_gemini.py', 'addons/mp_glass_spatial/spatial_gemini.py');
