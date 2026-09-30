import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Build the self-contained demonstration app used by the Windows and macOS launchers. */
export default defineConfig({
  define: { __MP_GLASS_VERSION__: JSON.stringify(version) },
  base: '/',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: 'index.html', launcher: 'desktop/launcher.html' },
    },
  },
});
