import { expect, test } from '@playwright/test';

// Ideas W0: the shared interaction prompt widget and tiny reactions run over a real scene with no errors.

test('interaction prompts take input and tiny reactions play', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  await page.goto('/?debug=1');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null), { timeout: 20_000 }).toBe('MainMenu');

  // Timing ring: press as it lands (1100 ms) and the grade is not a miss.
  const ring = page.evaluate(() => (window as any).__pkr.prompt('throw-ring'));
  await page.waitForTimeout(1100);
  await page.keyboard.press('Space');
  const r = await ring;
  expect(r.skipped).toBe(false);
  expect(['ok', 'good', 'perfect']).toContain(r.grade);

  // No input: a tap prompt ends as a miss by itself (does not hang).
  const miss = await page.evaluate(() => (window as any).__pkr.prompt('shout-tap'));
  expect(miss.grade).toBe('miss');

  // Escape skips, and the skip is flagged.
  const skipped = page.evaluate(() => (window as any).__pkr.prompt('brace-hold'));
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  expect((await skipped).skipped).toBe(true);

  // The assist skip passes on any press, without aiming.
  const assist = page.evaluate(() => (window as any).__pkr.prompt('aim-drag', { skip: true }));
  await page.waitForTimeout(300);
  await page.mouse.click(480, 270);
  const a = await assist;
  expect(a.skipped).toBe(true);
  expect(a.grade).not.toBe('perfect');

  await page.evaluate(() => (window as any).__pkr.reaction('react.heart'));
  expect(problems).toEqual([]);
});
