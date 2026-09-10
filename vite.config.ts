import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'custom_components/mp_glass/www', emptyOutDir: true,
    lib: { entry: 'frontend/index.ts', formats: ['es'], fileName: () => 'mp-glass.js' },
    sourcemap: true,
  },
});
