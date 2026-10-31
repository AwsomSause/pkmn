import { expect, test } from '@playwright/test';

// Left-out 3.1 perf pass: boot time, frame pacing and heap on the main menu and the Hub.
// Budgets are loose on purpose (shared CI runners are slow); the numbers print so a slide shows up in the log.

const active = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('boot, frame pacing and memory stay inside the budget', async ({ page }) => {
  test.setTimeout(120_000);
  const t0 = Date.now();
  await page.goto('/');
  await expect.poll(() => active(page), { timeout: 60_000 }).toBe('MainMenu');
  const bootMs = Date.now() - t0;
  await page.waitForTimeout(500);
  const stats = await page.evaluate(
    () =>
      new Promise<{ median: number; p95: number; heapMb: number | null }>((resolve) => {
        const times: number[] = [];
        let last = performance.now();
        const tick = (now: number) => {
          times.push(now - last);
          last = now;
          if (times.length < 120) requestAnimationFrame(tick);
          else {
            const s = [...times].sort((a, b) => a - b);
            const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
            resolve({ median: s[Math.floor(s.length / 2)]!, p95: s[Math.floor(s.length * 0.95)]!, heapMb: mem ? mem.usedJSHeapSize / 1048576 : null });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  console.log(`perf: boot ${bootMs} ms, frame median ${stats.median.toFixed(1)} ms, p95 ${stats.p95.toFixed(1)} ms, heap ${stats.heapMb?.toFixed(0) ?? 'n/a'} MB`);
  expect(bootMs).toBeLessThan(45_000);
  // Headless Chromium draws WebGL in software: a clean main measures about 66 ms per frame on CI and in the dev container.
  // The budget is 110 ms, so it still catches a real slide (a frame twice as slow) but not the runner's own speed.
  expect(stats.median).toBeLessThan(110);
  if (stats.heapMb !== null) expect(stats.heapMb).toBeLessThan(700);
});
