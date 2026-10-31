import { expect, test, type Page } from '@playwright/test';

// The Research Room rows carry the UIE caught/seen marks.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('Research Room rows show the Pokédex marks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=research-marks');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('Hub').openResearch());
  await page.waitForTimeout(800);
  const marks = await page.evaluate(() => {
    let n = 0;
    const walk = (o: any) => {
      if (o.name === 'dex-mark') n++;
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene('Hub').children.list) walk(o);
    return n;
  });
  expect(marks).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/research-marks.png' });
  expect(errors).toEqual([]);
});
