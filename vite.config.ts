import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
export default defineConfig({
  // Frontend build version: cache key of the bundle and compared with the installed integration.
  define: { __MP_GLASS_VERSION__: JSON.stringify(version) },
  // Relative URLs: the bundle is served under /mp_glass_static/, not at the root.
  base: './',
  // PDF.js worker (PDF import) as an ES module worker, emitted as a .js file.
  worker: { format: 'es' },
  build: {
    outDir: 'custom_components/mp_glass/www', emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { 'mp-glass': 'frontend/index.ts', 'mp-glass-bootstrap': 'frontend/bootstrap.ts' },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
    sourcemap: true,
  },
});
