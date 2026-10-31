import { expect, test, type Page } from '@playwright/test';

// With a saved run, the title screen shows the UIE Continue card; the Hub's Save data screen uses the Save backdrop.

const scene = (page: Page) => page.evaluate(() => (window as any)?.__pkr?.activeScene() ?? null);

test('Continue card and Save backdrop', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=load-card&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  // Back to the title screen: the run stays saved.
  await page.goto('/?seed=load-card&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(1500);
  const hasCard = () => page.evaluate(() => (window as any).__pkr.game.scene.getScene('MainMenu').children.list.some((o: any) => o.name === 'continue-card'));
  expect(await hasCard()).toBe(true);
  await page.screenshot({ path: 'test-results/continue-card.png' });
  // Save data screen.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('Hub').openSaveData());
  await page.waitForTimeout(600);
  const hasBg = await page.evaluate(() => {
    let n = 0;
    const walk = (o: any) => {
      if (o.name === 'picker-backdrop') n++;
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene('Hub').children.list) walk(o);
    return n;
  });
  expect(hasBg).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/save-backdrop.png' });
  expect(errors).toEqual([]);
});
