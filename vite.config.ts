import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'custom_components/mp_glass/www', emptyOutDir: true,
    rollupOptions: {
      input: { 'mp-glass': 'frontend/index.ts', 'mp-glass-bootstrap': 'frontend/bootstrap.ts' },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
    sourcemap: true,
  },
});
