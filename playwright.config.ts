import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // The long fights and the CI runner (about twice as slow as a laptop) need more than 60 s.
  timeout: 120_000,
  // Dot output keeps logs short; failures still print in full.
  reporter: 'dot',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
  },
  // Keep the baseline picture names as they were (no project name in them).
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  // The frame-time budget is only meaningful when nothing else is drawing: run it alone, after every other spec.
  // (Next to another worker's software-WebGL game the median reads 100-117 ms; alone it is about 66 ms.)
  projects: [
    { name: 'main', testIgnore: /perfBaseline\.spec\.ts/ },
    { name: 'perf', testMatch: /perfBaseline\.spec\.ts/, dependencies: ['main'] },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
