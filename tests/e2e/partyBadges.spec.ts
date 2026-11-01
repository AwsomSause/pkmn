import { expect, test, type Page } from '@playwright/test';

// The Pokémon screen's party list marks a burned lead as needing care.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('the Pokémon screen marks a burned lead as needing care', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=party-badges&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const lead = session.run.party[0];
    lead.status = { id: 'brn', turns: 0 };
    lead.held = { 'oran-berry': 1 };
    const m = game.scene.getScene('Map');
    m.activate(m.options.findIndex((o: any) => o.kind === 'party'));
  });
  await page.waitForTimeout(1500);
  const found = await page.evaluate(() => {
    const names = new Set<string>();
    const walk = (o: any) => {
      if (o.name) names.add(o.name);
      for (const c of o.list ?? []) walk(c);
    };
    for (const s of (window as any).__pkr.game.scene.getScenes(true)) for (const o of s.children.list) walk(o);
    return { caution: names.has('ready-caution'), row: names.has('party-row-0') };
  });
  expect(found).toEqual({ caution: true, row: true });
  await page.screenshot({ path: 'test-results/party-badges.png' });
  expect(errors).toEqual([]);
});
