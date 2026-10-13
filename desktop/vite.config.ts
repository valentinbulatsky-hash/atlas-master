import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: root + '/public',
  resolve: {alias: {'@': root}},
  plugins: [react()],
  css: {postcss: root + '/postcss.config.mjs'},
  build: {outDir: 'dist-renderer', emptyOutDir: true},
});
