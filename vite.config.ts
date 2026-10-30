/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // Hide rolldown's plugin-timing printout: build noise that every check and e2e run repeats.
    rolldownOptions: { checks: { pluginTimings: false } },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
