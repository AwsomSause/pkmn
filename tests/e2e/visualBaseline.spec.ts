import { expect, test, type Page } from '@playwright/test';

// Visual Bible V0/V5: baseline screenshots of the gameplay screens at a fixed
// seed (reward, shop, event, League map, run end) at three window sizes, saved
// to test-results/visual/ for a manual look, and a repeated-battle leak check.
// No pixel comparison; it fails on console errors or a screen that won't open.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startDevRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&campaign=dev&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

/** Stops every running scene and starts `key` with `data`, after `prep` changed the run. */
async function open(page: Page, key: string, prep: string, data: object = {}) {
  await page.evaluate(
    ([k, p, d]) => {
      const { session, game } = (window as any).__pkr;
      new Function('session', p)(session);
      for (const s of game.scene.getScenes(true)) s.scene.stop();
      game.scene.start(k, d);
    },
    [key, prep, data] as const,
  );
  await waitForScene(page, key);
  await page.waitForTimeout(1300); // entry motion settles
}

async function shoot(page: Page, name: string) {
  for (const [w, h] of [
    [960, 540],
    [800, 450],
    [480, 800],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/visual/baseline-${name}-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 960, height: 540 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('baseline screens: reward, shop, event, League map and run end', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await startDevRun(page, 'visual-base');

  await open(page, 'Reward', "session.run.phase = 'reward'; session.run.draft = ['item:amulet-coin', 'item:pp-up', 'item:big-pearl', 'item:leftovers', 'item:charcoal'];");
  await shoot(page, 'reward');

  await open(page, 'Shop', "session.run.phase = 'map'; session.run.money = 3000;");
  await shoot(page, 'shop');

  await open(
    page,
    'Event',
    "const run = session.run; const node = run.stage.map.nodes.find((n) => n.column === 1); node.sides.push({ id: 'base-event', kind: 'event', used: false, eventId: 'department-store-sale' }); run.stage.current = node.id; run.stage.visited = [node.id];",
    { sideId: 'base-event' },
  );
  await shoot(page, 'event');

  await open(page, 'Map', 'session.debugJumpToLeague();');
  await shoot(page, 'league');

  await open(page, 'GameOver', 'session.run.victory = true;');
  await shoot(page, 'run-end');
  expect(errors).toEqual([]);
});

test('repeated battles do not pile up textures, objects or tweens', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startDevRun(page, 'visual-leak');
  const sample = () =>
    page.evaluate(() => {
      const { game } = (window as any).__pkr;
      const battle = game.scene.getScene('Battle');
      return { textures: game.textures.getTextureKeys().length, objects: battle.children.list.length, tweens: battle.tweens.getTweens().length };
    });
  const restart = async () => {
    await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('Battle').scene.restart());
    await waitForScene(page, 'Battle');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').menu)), { timeout: 20_000 }).toBe(true);
    await page.waitForTimeout(400);
  };
  await page.keyboard.press('Enter'); // the first node: a battle
  await waitForScene(page, 'Battle');
  await restart();
  const first = await sample();
  for (let i = 0; i < 5; i++) await restart();
  const last = await sample();
  // Same battle, same screen: textures stay cached (no growth), objects and tweens don't accumulate.
  expect(last.textures).toBeLessThanOrEqual(first.textures + 2);
  expect(last.objects).toBeLessThanOrEqual(first.objects + 10);
  expect(last.tweens).toBeLessThanOrEqual(first.tweens + 10);
  console.log(`leak check: first ${JSON.stringify(first)}, after 5 restarts ${JSON.stringify(last)}`);
  expect(errors).toEqual([]);
});
