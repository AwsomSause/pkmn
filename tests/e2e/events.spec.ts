import { expect, test, type Page } from '@playwright/test';

// Map events: an event stop opens the animated event scene; a choice shows its outcome and goes back to
// the map with the stop used; a battle choice starts the battle; the scene fits several window sizes.

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

/** Stands the run on a first-column node with this event beside it and opens the event scene. */
async function openEvent(page: Page, eventId: string, sideId: string) {
  await page.evaluate(
    ([eventId, sideId]) => {
      const pkr = (window as any).__pkr;
      const run = pkr.session.run;
      const node = run.stage.map.nodes.find((n: any) => n.column === 1);
      node.sides.push({ id: sideId, kind: 'event', used: false, eventId });
      run.stage.current = node.id;
      run.stage.visited = [node.id];
      pkr.game.scene.getScene('Map').scene.start('Event', { sideId });
    },
    [eventId, sideId],
  );
  await waitForScene(page, 'Event');
  await page.waitForTimeout(1200); // cast slides in, cards pop in
}

test('an event stop plays its scene, applies a choice once and returns to the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=events-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // The map already has event stops of its own (three to five, plus two rest spots).
  const stops = await page.evaluate(() => (window as any).__pkr.session.run.stage.map.nodes.flatMap((n: any) => n.sides).filter((s: any) => s.kind === 'event').length);
  expect(stops).toBeGreaterThanOrEqual(5);

  await openEvent(page, 'pokemon-center', 'e2e-center');
  await page.screenshot({ path: 'test-results/events-scene.png' });
  for (const [w, h] of [[800, 450], [480, 800]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/events-scene-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 960, height: 540 });

  await page.keyboard.press('Enter'); // the first choice
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/events-outcome.png' });
  const used = await page.evaluate(() => (window as any).__pkr.session.run.stage.map.nodes.flatMap((n: any) => n.sides).find((s: any) => s.id === 'e2e-center').used);
  expect(used).toBe(true);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');

  // The choice was saved: after a reload the stop is still used.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  const afterReload = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('pkr.run')!);
    return raw.data.stage.map.nodes.flatMap((n: any) => n.sides).find((s: any) => s.id === 'e2e-center').used;
  });
  expect(afterReload).toBe(true);
  expect(errors).toEqual([]);
});

test('a battle choice at an event starts the battle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=events-e2e-2');
  await waitForScene(page, 'MainMenu');
  await toMap(page);
  await openEvent(page, 'rm-2-key-cabin', 'e2e-cabin');
  await page.keyboard.press('Enter'); // Battle
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter'); // Enter: battle!
  await waitForScene(page, 'Battle');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.battle.event.eventId)).toBe('rm-2-key-cabin');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/events-battle.png' });
  expect(errors).toEqual([]);
});
