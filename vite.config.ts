import { readFileSync } from 'node:fs';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
/**
 * The bootstrap must register the strategy even on old tablets, to show why the dashboard cannot run there:
 * its syntax is lowered to ES2017 (iOS 12), keeping import() and import.meta, which those browsers support.
 * Runs after Vite's own minification, which would otherwise bring newer syntax back.
 */
const bootstrapForOldBrowsers: Plugin = {
  name: 'mp-glass-bootstrap-es2017',
  apply: 'build',
  renderChunk: {
    order: 'post',
    async handler(code, chunk) {
      if (chunk.name !== 'mp-glass-bootstrap') return null;
      const result = await transformWithEsbuild(code, chunk.fileName, { target: 'es2017', supported: { 'dynamic-import': true, 'import-meta': true }, minify: true, charset: 'utf8', sourcemap: true });
      return { code: result.code, map: JSON.stringify(result.map) };
    },
  },
};
export default defineConfig({
  // Frontend build version: cache key of the bundle and compared with the installed integration.
  define: { __MP_GLASS_VERSION__: JSON.stringify(version) },
  // Relative URLs: the bundle is served under /mp_glass_static/, not at the root.
  base: './',
  plugins: [bootstrapForOldBrowsers],
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
