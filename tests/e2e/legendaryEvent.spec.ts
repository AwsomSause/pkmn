import { expect, test, type Page } from '@playwright/test';

// Legendary world events: the gate opens a Legendary briefing, the stage screen shows its look (wash, particles, title card),
// the first fight starts with the stage's weather, and a reload mid-event keeps the state. No console errors.

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

test('a Legendary gate opens its briefing, stage look and first fight, and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=legend-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'legend-e2e', kind: 'expedition', expeditionId: 'legend-kyogre', used: false });
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openExpedition('legend-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Expedition');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.expedition.id)).toBe('legend-kyogre');
  await page.waitForTimeout(800);

  // First stop: a fight under the stage's rain.
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.battle.weather?.id)).toBe('rain');

  await page.reload();
  await waitForScene(page, 'MainMenu');
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    const run = raw ? JSON.parse(raw[1] as string).data : null;
    return run ? { id: run.expedition?.id, offered: run.legendary?.offered } : null;
  });
  expect(saved?.id).toBe('legend-kyogre');
  expect(saved?.offered).toEqual(['legend-kyogre']);
  expect(errors).toEqual([]);
});
