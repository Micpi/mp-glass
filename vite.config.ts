import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
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
/**
 * Brotli copies (.br) next to the large files: Home Assistant's web server sends them to browsers that accept them.
 * The wake word's speech engine is 12 MB of WebAssembly, 2 MB compressed: over a home's upload link the plain file took
 * more than five minutes, and the word stayed « Préparation… » until the page was closed.
 */
const OUT = 'custom_components/mp_glass/www';
const precompress: Plugin = {
  name: 'mp-glass-brotli',
  apply: 'build',
  closeBundle() {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
    for (const path of walk(OUT)) {
      if (!/\.(js|wasm|onnx)$/.test(path) || statSync(path).size < 16_384) continue;
      const data = readFileSync(path);
      const packed = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
      if (packed.length < data.length * 0.9) writeFileSync(`${path}.br`, packed);
    }
  },
};
export default defineConfig({
  // Frontend build version: cache key of the bundle and compared with the installed integration.
  define: { __MP_GLASS_VERSION__: JSON.stringify(version) },
  // Relative URLs: the bundle is served under /mp_glass_static/, not at the root.
  base: './',
  plugins: [bootstrapForOldBrowsers, precompress],
  // PDF.js worker (PDF import) as an ES module worker, emitted as a .js file.
  worker: { format: 'es' },
  build: {
    outDir: OUT, emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: { 'mp-glass': 'frontend/index.ts', 'mp-glass-bootstrap': 'frontend/bootstrap.ts' },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
    sourcemap: true,
  },
});
