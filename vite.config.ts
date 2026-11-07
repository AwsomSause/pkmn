/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// One id per build; the site publishes it as version.json so open pages can tell a newer build is online (W12 F222).
const BUILD_ID = process.env.GITHUB_SHA?.slice(0, 8) ?? new Date().toISOString().replace(/\D/g, '').slice(0, 14);

const versionFile = (): Plugin => ({
  name: 'pkr-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, version: pkg.version }) });
  },
});

export default defineConfig(({ command }) => ({
  base: './',
  define: command === 'build' ? { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(BUILD_ID) } : {},
  plugins: [versionFile()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    // Hide rolldown's plugin-timing printout: build noise that every check and e2e run repeats.
    rolldownOptions: {
      checks: { pluginTimings: false },
      // Phaser in its own file: it never changes between deploys, so browsers keep it cached while the game code and data update.
      // Story data (Design v2 Part XII lazy story loader, first step) in its own file too: it changes on its own schedule, so a code-only deploy keeps it cached.
      output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }, { name: 'story', test: /src[\\/]data[\\/]story[\\/].*\.json$/ }] } },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Several suites build the whole content set; on a slow or busy machine that takes longer than the 5 s default.
    testTimeout: 90_000, // CI runs 300+ heavy files at once; single simulation tests passed alone but timed out at 30 s
  },
}));
