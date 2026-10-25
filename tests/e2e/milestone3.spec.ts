import { expect, test, type Page } from '@playwright/test';

// Milestone 3 in a real browser: the stage map, the healing spot, the shop,
// the gym leader and resuming on the map after a reload.

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

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter'); // Begin the run
  await waitForScene(page, 'Map');
}

/** Restarts the Map screen after changing the run from the test. */
async function reopenMap(page: Page) {
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ notice: 'test' });
  });
  await mapReady(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the map shows the stage theme; choosing a node starts its battle; reload resumes on the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-map');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/m3-stage-banner.png' });
  await mapReady(page);
  const before = await run(page);
  expect(before.phase).toBe('map');
  expect(before.stage.current).toBeNull();
  await page.screenshot({ path: 'test-results/m3-map.png' });

  // Reload while on the map: Continue brings the player back to the same map.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await mapReady(page);
  expect((await run(page)).stage).toEqual(before.stage);

  // The cursor starts on the first node choice.
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  const after = await run(page);
  expect(after.stage.current).toMatch(/^c1r/);
  expect(after.battle.kind).toBe('wild');
  await page.screenshot({ path: 'test-results/m3-themed-battle.png' });
  expect(errors).toEqual([]);
});

test('the healing spot and the shop work from the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-heal-shop');
  await mapReady(page);

  // Jump next to the gym (the column before it always has a healing spot), hurt the party, add a shop.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugJumpToColumn(20);
    session.run.party[0].hp = 1;
    session.run.money = 500;
    const node = session.run.stage.map.nodes.find((n: any) => n.id === session.run.stage.current);
    node.sides.push({ id: 'e2e-shop', kind: 'shop', used: false });
  });
  await reopenMap(page);
  await page.screenshot({ path: 'test-results/m3-side-stops.png' });

  // Options: the gym node, then Heal, Shop, Party, Bag.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // Heal
  await expect.poll(async () => (await run(page)).party[0].hp, { timeout: 5000 }).toBeGreaterThan(1);
  await mapReady(page);

  // Heal is gone now; the options are: gym, Shop, Party, Bag.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // Shop
  await waitForScene(page, 'Shop');
  await page.screenshot({ path: 'test-results/m3-shop.png' });
  const balls = (await run(page)).inventory['poke-ball'] ?? 0;
  await page.keyboard.press('Enter'); // first row: Poké Ball
  await expect.poll(async () => (await run(page)).inventory['poke-ball'] ?? 0, { timeout: 5000 }).toBe(balls + 1);
  expect((await run(page)).money).toBe(300);
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await mapReady(page);
  expect((await run(page)).phase).toBe('map');
  expect(errors).toEqual([]);
});

test('the gym leader introduces themselves in the themed arena', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-gym');
  await mapReady(page);
  await page.evaluate(() => (window as any).__pkr.session.debugJumpToColumn(20));
  await reopenMap(page);
  await page.keyboard.press('Enter'); // the gym
  await waitForScene(page, 'Battle');
  const r = await run(page);
  expect(r.battle.trainer.classId).toBe('gym-leader');
  expect(r.battle.trainer.leaderId).toBe(r.stage.leaderId);
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').message.text), { timeout: 10_000 })
    .toMatch(/^Gym Leader .* would like to battle!/);
  await page.screenshot({ path: 'test-results/m3-gym-leader.png' });
  expect(errors).toEqual([]);
});
