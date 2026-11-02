import { expect, test, type Page } from '@playwright/test';

// The Bag menu header carries the UIE bag picture and sits on the UIE Bag backdrop.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('the Bag menu shows the UIE bag picture', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=bag-badge&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  const open = () =>
    page.evaluate(() => {
      const m = (window as any).__pkr.game.scene.getScene('Map');
      m.activate(m.options.findIndex((o: any) => o.kind === 'bag'));
    });
  await open();
  await page.waitForTimeout(1500);
  // The badge art loads lazily; on a busy runner it can take longer than a fixed wait, so poll for it.
  const countTiles = () => page.evaluate(() => {
    let n = 0;
    const walk = (o: any) => {
      if (o.name === 'picker-badge' || o.name === 'picker-backdrop') n++;
      for (const c of o.list ?? []) walk(c);
    };
    for (const s of (window as any).__pkr.game.scene.getScenes(true)) for (const o of s.children.list) walk(o);
    return n;
  });
  await expect.poll(countTiles, { timeout: 20_000 }).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/bag-badge.png' });
  expect(errors).toEqual([]);
});
