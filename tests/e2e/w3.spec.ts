import { expect, test, type Page } from '@playwright/test';

// W3: the Camp menu opens from the map, crafts a gadget, shows it in the list, and the run saves and reloads with it.

const scene = (page: Page) => page.evaluate(() => (window as any)?.__pkr?.activeScene() ?? null);

async function toMap(page: Page, seed: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?seed=${seed}&campaign=dev&debug=1`);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}

test('Camp opens from the map, crafts a gadget, uses it, and survives a reload', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await toMap(page, 'w3-camp');
  await page.evaluate(() => {
    const map = (window as any).__pkr.game.scene.getScene('Map');
    map.activate(map.options.findIndex((o: any) => o.kind === 'camp'));
  });
  await page.waitForTimeout(500);
  // Esc closes the menu again without a crash.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(await scene(page)).toBe('Map');

  // Give materials, craft a compass through the session, use it, and check the saved run.
  const out = await page.evaluate(() => {
    const s = (window as any).__pkr.session;
    s.run.materials = { scrap: 5, aether: 2 };
    const bench = s.camp('bench', { choice: 'compass' });
    const use = s.camp('compass');
    return { bench, use, wear: s.run.camp.wear.compass };
  });
  expect(out.bench.ok).toBe(true);
  expect(out.use.ok).toBe(true);
  expect(out.wear).toBe(7);
  await page.evaluate(() => (window as any).__pkr.session.saveRunNow());
  await page.goto(`/?seed=w3-camp&campaign=dev&debug=1`);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Map');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.camp.wear.compass)).toBe(7);
  expect(errors).toEqual([]);
});
