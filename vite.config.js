import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
