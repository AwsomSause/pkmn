import { expect, test, type Page } from '@playwright/test';

// Milestone 7 in a real browser: the Hub's Attributes room, attributes on the
// Briefing, and a shop item that raises an attribute as soon as it's bought.

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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the Attributes room shows each attribute, what it does and how it grows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.profile.attributes = { strength: 12, intelligence: 4, speed: 30, charisma: 8, luck: 25, love: 3, ragePeace: -20, goodEvil: 15 };
    game.scene.getScene('Hub').scene.restart({ focus: 5 });
  });
  await waitForScene(page, 'Hub');
  await page.screenshot({ path: 'test-results/m7-hub-attributes.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/m7-attributes-detail.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('the Briefing shows the run’s attributes, and a shop Plate raises one when bought', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-m7&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    (window as any).__pkr.session.profile.attributes = { strength: 10, intelligence: 0, speed: 0, charisma: 20, luck: 5, love: 0, ragePeace: 10, goodEvil: 0 };
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.screenshot({ path: 'test-results/m7-briefing.png' });
  expect((await run(page)).baseAttributes.charisma).toBe(20);
  await page.keyboard.press('Enter');
  await mapReady(page);

  // Add a shop to the current spot, with a badge so the Plates are on sale.
  const index = await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugJumpToColumn(5);
    session.run.money = 5000;
    session.run.badges = ['e2e-badge'];
    const node = session.run.stage.map.nodes.find((n: any) => n.id === session.run.stage.current);
    node.sides.push({ id: 'e2e-shop', kind: 'shop', used: false });
    game.scene.getScene('Map').scene.restart({ notice: 'test' });
    // Red has no shop offsets, so the stock is every entry with minBadges ≤ 1, in file order.
    return session.content.shop.filter((e: any) => e.minBadges <= 1).findIndex((e: any) => e.item === 'fist-plate');
  });
  await mapReady(page);
  expect(index).toBeGreaterThan(-1);
  await page.evaluate(() => {
    (window as any).__pkr.session.visitSide('e2e-shop');
  });
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Map').scene.start('Shop');
  });
  await waitForScene(page, 'Shop');
  for (let i = 0; i < Math.floor(index / 2); i++) await page.keyboard.press('ArrowDown');
  if (index % 2 === 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m7-shop.png' });
  const price = Math.round(1500 * 0.8); // Charisma 20
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).attributeModifiers.strength, { timeout: 5000 }).toBe(5);
  const r = await run(page);
  expect(r.inventory['fist-plate']).toBeUndefined();
  expect(r.money).toBe(5000 - price);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m7-shop-bought.png' });
  expect(errors).toEqual([]);
});
