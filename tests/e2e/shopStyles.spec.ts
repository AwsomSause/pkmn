import { expect, test, type Page } from '@playwright/test';

// Shops redesign: every built shop type draws, moves focus, buys in place (no screen restart) and opens Sell.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const run = (page: Page) => page.evaluate(() => (window as any).__pkr.session.run);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function mapReady(page: Page) {
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

for (const type of ['mart', 'boutique']) test(`shop type ${type}: draws, buys in place and opens Sell`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-m7&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter'); await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter'); await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter'); await mapReady(page);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugJumpToColumn(5); session.run.money = 3240; session.run.badges = ['a','b'];
    const node = session.run.stage.map.nodes.find((n: any) => n.id === session.run.stage.current);
    node.sides.push({ id: 'e2e-shop', kind: 'shop', used: false });
    game.scene.getScene('Map').scene.restart({ notice: 'test' });
  });
  await mapReady(page);
  await page.evaluate((t) => { (window as any).__pkr.session.visitSide('e2e-shop'); (window as any).__pkr.game.scene.getScene('Map').scene.start('Shop', { type: t }); }, type);
  await waitForScene(page, 'Shop'); await page.waitForTimeout(900);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Shop').shopType)).toBe(type);
  await page.screenshot({ path: `test-results/shop-${type}-1.png` });
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(k);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shop-${type}-2.png` });
  const before = await page.evaluate(() => (window as any).__pkr.session.run.money);
  const created = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Shop').sys.settings.data);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run.money)).toBeLessThan(before);
  // Bought in place: the scene was not restarted with new data.
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Shop').sys.settings.data)).toEqual(created);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/shop-${type}-3.png` });
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/shop-${type}-4.png` });
  // The last stop going down is Sell; confirming opens the sell list.
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Shop').sys.settings.data?.sell ?? false)).toBe(true);
  expect(errors).toEqual([]);
});
