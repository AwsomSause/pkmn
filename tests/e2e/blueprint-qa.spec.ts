import { expect, test, type Page } from '@playwright/test';
// Blueprint QA: the Blueprint screens (map stops, raid preview and fight, minigame and result) at three window sizes, with screenshots in test-results/qa and no console errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function toMap(page: Page) {
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
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

const SIZES = [{ w: 1280, h: 720 }, { w: 960, h: 540 }, { w: 640, h: 360 }];

async function shots(page: Page, name: string) {
  for (const { w, h } of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/qa/${name}-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

async function placeStop(page: Page, side: Record<string, unknown>) {
  await page.evaluate((s) => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push(s);
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  }, side);
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

test('Blueprint screens render at three sizes without console errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=blueprint-qa');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // The map with every Blueprint stop on it.
  await page.evaluate(() => {
    const run = (window as any).__pkr.session.run;
    const col1 = run.stage.map.nodes.filter((n: any) => n.column === 1);
    const kinds = [
      { id: 'q-raid', kind: 'raid', raidId: 'garden-guardian', used: false },
      { id: 'q-totem', kind: 'totem', totemId: 'totem-marowak', used: false },
      { id: 'q-exp', kind: 'expedition', expeditionId: 'frozen-pass', used: false },
      { id: 'q-mg', kind: 'minigame', minigameId: 'knowledge-quiz', used: false },
    ];
    kinds.forEach((k, i) => col1[i % col1.length].sides.push(k));
    run.stage.current = col1[0].id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await shots(page, 'map-stops');

  // A raid preview and the raid fight (Raid Battles arena and music).
  await page.evaluate(() => {
    const run = (window as any).__pkr.session.run;
    const node = run.stage.map.nodes.find((n: any) => n.sides.some((s: any) => s.id === 'q-raid'));
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openRaid('q-raid'));
  await page.waitForTimeout(300);
  await shots(page, 'raid-preview');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.waitForTimeout(1500);
  await shots(page, 'raid-battle');
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').field.list.length)).toBeGreaterThan(0);

  // A minigame on the generic screen, then its result.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    run.battle = null;
    run.phase = 'map';
    session.run = run;
  });
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('Battle').scene.start('Map', { focus: 0 }));
  await waitForScene(page, 'Map');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.sides.some((s: any) => s.id === 'q-mg'));
    run.stage.current = node.id;
    session.beginMinigame('q-mg', 1);
    void (window as any).__pkr.game.scene.getScene('Map').scene.start('Minigame');
  });
  await waitForScene(page, 'Minigame');
  await shots(page, 'minigame-quiz');
  for (let i = 0; i < 12; i++) {
    const done = await page.evaluate(() => Boolean((window as any).__pkr.session.run.minigame?.outcome));
    if (done) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await shots(page, 'minigame-result');

  // The biggest grid: Pokémon Memory on Hard.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.leaveMinigame();
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.sides.some((s: any) => s.id === 'q-mg'));
    node.sides.find((s: any) => s.id === 'q-mg').minigameId = 'pokemon-memory';
    node.sides.find((s: any) => s.id === 'q-mg').used = false;
    run.minigames.attempts = {};
    session.beginMinigame('q-mg', 2);
    void (window as any).__pkr.game.scene.getScene('Minigame').scene.restart({});
  });
  await waitForScene(page, 'Minigame');
  await shots(page, 'minigame-memory-hard');
  expect(errors).toEqual([]);
});
