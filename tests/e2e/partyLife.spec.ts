import { expect, test, type Page } from '@playwright/test';

// A party scene waits on the map; answering it saves a scrapbook entry; the Album opens.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('a party scene shows on the map, resolves once, and lands in the Album', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=party-life&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(500);
  // Put a scene on the map as if the team had just walked a stretch.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const run = structuredClone(session.run);
    run.stage.current = run.stage.map.nodes[0].id;
    run.partyLife.scene = { id: 'talk-question', key: 'e2e', caption: 'The team talked on the road.', uids: [run.party[0].uid], lines: ['The team shares a quiet moment on the road.'], choices: [], dflt: 0 };
    run.partyLife.rolledFor = 'e2e';
    session.run = run;
    game.scene.getScene('Map').scene.restart({});
  });
  await page.waitForTimeout(1500);
  const picker = () => page.evaluate(() => !!(window as any).__pkr.game.scene.getScene('Map').picker);
  expect(await picker()).toBe(true);
  await page.screenshot({ path: 'test-results/party-scene.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => {
    const p = (window as any).__pkr.session.run.partyLife;
    return { scene: p.scene, book: p.scrapbook.length, recent: p.recent };
  });
  expect(state.scene).toBeNull();
  expect(state.book).toBe(1);
  expect(state.recent).toContain('talk-question');
  // The Album screen opens.
  await page.evaluate(() => {
    const m = (window as any).__pkr.game.scene.getScene('Map');
    m.activate(m.options.findIndex((o: any) => o.kind === 'scrapbook'));
  });
  await page.waitForTimeout(800);
  expect(await picker()).toBe(true);
  await page.screenshot({ path: 'test-results/party-album.png' });
  expect(errors).toEqual([]);
});
