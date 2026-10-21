import { defineConfig } from 'vite';

// GitHub Pages project site: https://<user>.github.io/qr-pocket/  (SPEC-004/005)
export default defineConfig({
  base: '/qr-pocket/',
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
