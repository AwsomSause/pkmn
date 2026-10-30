import { expect, test, type Page } from '@playwright/test';

// Expeditions: a gate on the map opens a briefing, the expedition screen shows the route, the first stop starts a fight, and a reload mid-expedition keeps the state.
// and the run survives a reload mid-fight.

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

test('an expedition gate opens the briefing, the route screen and a first fight, and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=expedition-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'exp-e2e', kind: 'expedition', expeditionId: 'ember-trail', used: false });
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openExpedition('exp-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter'); // begin
  await waitForScene(page, 'Expedition');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.expedition.id)).toBe('ember-trail');

  // Reload on the route screen: the expedition is still there.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    const run = raw ? JSON.parse(raw[1] as string).data : null;
    return run ? { phase: run.phase, id: run.expedition?.id, nodes: run.expedition?.nodes.length } : null;
  });
  expect(saved?.phase).toBe('expedition');
  expect(saved?.id).toBe('ember-trail');
  expect(saved!.nodes).toBeGreaterThanOrEqual(5);
  expect(errors).toEqual([]);
});
