import { expect, test, type Page } from '@playwright/test';

// Party rows sit on the UIE icon tiles.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('party rows draw the icon tile behind each Pokémon', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=party-tiles&campaign=dev&debug=1');
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
      m.activate(m.options.findIndex((o: any) => o.kind === 'party'));
    });
  await open();
  await page.waitForTimeout(1500);
  const tiles = await page.evaluate(() => {
    let n = 0;
    const walk = (o: any) => {
      if (o.name === 'party-icon-tile') n++;
      for (const c of o.list ?? []) walk(c);
    };
    for (const s of (window as any).__pkr.game.scene.getScenes(true)) for (const o of s.children.list) walk(o);
    return n;
  });
  expect(tiles).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/party-tiles.png' });
  expect(errors).toEqual([]);
});
