import { expect, test, type Page } from '@playwright/test';

// Ideas W4: traversal obstacles show on the map and are crossed on the way to a node, the map legend opens
// with L, a skill-prompt event choice plays its prompt (Esc skips it), and nothing logs an error.

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

const named = (page: Page, key: string, name: string) =>
  page.evaluate(([key, name]) => {
    const s = (window as any).__pkr.game.scene.getScene(key);
    const all: any[] = [];
    const walk = (list: any[]) => list.forEach((o) => (all.push(o), o.list && walk(o.list)));
    walk(s.children.list);
    return all.filter((o) => o.name === name).length;
  }, [key, name] as const);

test('obstacles on the map, the legend, crossing on the way to a node, and a skill-prompt choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=w4-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // Put a lake on a first-column node and redraw the map: its badge shows and the info line explains it.
  const nodeId = await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    const node = pkr.session.run.stage.map.nodes.find((n: any) => n.column === 1);
    pkr.session.run.stage.obstacles = { [node.id]: 'lake' };
    pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
    return node.id;
  });
  await waitForScene(page, 'Map');
  await page.waitForTimeout(600);
  expect(await named(page, 'Map', 'obstacle')).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').info.text)).toContain('Wide Lake');
  await page.screenshot({ path: 'test-results/w4-map-obstacle.png' });

  // L opens the legend over the map; L again closes it.
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  expect(await named(page, 'Map', 'map-legend')).toBe(1);
  await page.screenshot({ path: 'test-results/w4-map-legend.png' });
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  expect(await named(page, 'Map', 'map-legend')).toBe(0);

  // Walking onto the node crosses (or goes round) the lake before the battle.
  await page.evaluate((id) => {
    const map = (window as any).__pkr.game.scene.getScene('Map');
    const i = map.options.findIndex((o: any) => o.kind === 'node' && o.node.id === id);
    map.activate(i);
  }, nodeId);
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.lastCrossing), { timeout: 5000 }).toMatch(/Lake|lake/);
  await waitForScene(page, 'Battle', 15_000);
  expect(await page.evaluate((id) => (window as any).__pkr.session.run.stage.obstacles[id] ?? null, nodeId)).toBeNull();

  // A skill-prompt event choice: the zip-line. Esc skips the prompt (counts as ok, which is not enough here).
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    const run = pkr.session.run;
    run.battle = null;
    run.phase = 'map';
    const node = run.stage.map.nodes.find((n: any) => n.id === run.stage.current);
    node.sides.push({ id: 'e2e-zip', kind: 'event', used: false, eventId: 'w4-zip-line' });
    pkr.game.scene.getScenes(true)[0].scene.start('Event', { sideId: 'e2e-zip' });
  });
  await waitForScene(page, 'Event');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/w4-zip-prompt.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Event').result?.success ?? null), { timeout: 5000 }).toBe(false);

  expect(errors).toEqual([]);
});
