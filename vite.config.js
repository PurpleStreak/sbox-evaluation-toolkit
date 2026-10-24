import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vite.dev/config/
// `vite build --mode single` produces dist-single/index.html: the whole app (code, styles,
// data and workers) in one file that runs offline from disk.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
  // Classic (IIFE) workers can be started from inline Blob URLs in every browser.
  worker: { format: 'iife' },
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  // Listen on all interfaces so a Windows browser can reach the dev server inside WSL.
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}));
