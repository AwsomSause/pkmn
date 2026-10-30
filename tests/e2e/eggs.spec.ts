import { expect, test, type Page } from '@playwright/test';

// Eggs: an Egg rides along on the map, then hatches (wobble, cracks, flash) into a Pokémon that can join the party.

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

test('an Egg shows on the map, hatches with its animation, and the Pokémon joins the party', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=eggs-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // An Egg in the bag: the map shows it after the party.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.run.eggs = [{ uid: 'egg1', speciesId: 'togepi', level: 5, left: 1, unit: 'battle', shiny: false, eggMoves: [], source: 'Egg Nest' }];
    game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').textures.exists('pack.ebdx.egg'))).toBe(true);

  // It hatches: the decision screen plays the hatch, then offers the new Pokémon.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const run = session.run;
    const mon = structuredClone(run.party[0]);
    Object.assign(mon, { uid: 'p-egg', speciesId: 'togepi', level: 5, hatched: true, friendship: 120 });
    run.eggs = [];
    run.pending = [{ kind: 'caught', mon }];
    run.phase = 'decision';
    run.afterDecisions = 'map';
    game.scene.getScene('Map').scene.start('Decision');
  });
  await waitForScene(page, 'Decision');
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Decision').hatching)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Decision').hatching), { timeout: 10_000 }).toBe(false);
  const texts = await page.evaluate(() =>
    (window as any).__pkr.game.scene.getScene('Decision').children.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text as string),
  );
  expect(texts.some((t: string) => t.includes('hatched from the Egg'))).toBe(true);
  await page.keyboard.press('Enter'); // Add to party
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run.party.some((m: any) => m.uid === 'p-egg')), { timeout: 10_000 }).toBe(true);
  expect(errors).toEqual([]);
});
