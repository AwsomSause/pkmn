import { expect, test, type Page } from '@playwright/test';

// Trainer Plaza: the middle node of the stage has a plaza stop, its menu opens, an area opens, a purchase works, and no console errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function toMap(page: Page) {
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

test('the plaza opens from its map stop, lists its areas, and sells an item', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=plaza-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // Every node in the middle column carries the plaza stop; stand on one with plenty of money.
  const sideId = await page.evaluate(() => {
    const run = (window as any).__pkr.session.run;
    const middle = Math.ceil(run.stage.map.columns / 2);
    const nodes = run.stage.map.nodes.filter((n: any) => n.column === middle);
    if (!nodes.every((n: any) => n.sides.some((s: any) => s.kind === 'plaza'))) return null;
    run.stage.current = nodes[0].id;
    run.money = 50000;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
    return nodes[0].sides.find((s: any) => s.kind === 'plaza').id as string;
  });
  expect(sideId).not.toBeNull();
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);

  await page.evaluate((id) => (window as any).__pkr.game.scene.getScene('Map').openPlaza(id), sideId);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.screenshot({ path: 'test-results/plaza-menu.png' });

  // Open "Merchant stalls" (the first area), then buy the first thing on offer.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => (window as any).__pkr.session.run.money);
  await page.screenshot({ path: 'test-results/plaza-stalls.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window as any).__pkr.session.run.money);
  expect(after).toBeLessThan(before);
  expect(await page.evaluate(() => (window as any).__pkr.session.run.plaza.rep)).toBeGreaterThan(0);

  // The state survives into the save.
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    return raw ? JSON.parse(raw[1] as string).data.plaza.rep : null;
  });
  expect(saved).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
