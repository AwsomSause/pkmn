import { expect, test, type Page } from '@playwright/test';

// Milestone 4 in a real browser: the short developer campaign, the region
// banner, the Pokémon League map, an Elite Four introduction and the victory
// screen.

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

async function startDevRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&campaign=dev&debug=1`);
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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('?campaign=dev starts the short campaign with a region banner', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startDevRun(page, 'e2e-dev');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/m4-region-banner.png' });
  const r = await run(page);
  expect(r.campaignId).toBe('dev');
  expect(r.regionOrder).toHaveLength(2);
  expect(r.stage.map.columns).toBe(5);
  await mapReady(page);
  await page.screenshot({ path: 'test-results/m4-dev-map.png' });
  expect(errors).toEqual([]);
});

test('the Pokémon League map leads to an Elite Four introduction', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startDevRun(page, 'e2e-league');
  await mapReady(page);
  await page.evaluate(() => {
    (window as any).__pkr.session.debugJumpToLeague();
    (window as any).__pkr.game.scene.getScene('Map').scene.restart();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/m4-league-banner.png' });
  await mapReady(page);
  const r = await run(page);
  expect(r.stage.kind).toBe('league');
  await page.screenshot({ path: 'test-results/m4-league-map.png' });
  // Escalation: one glass step per battle, gold rays behind the champion.
  const look = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => (o.name && out.push(o.name), o.list?.forEach(walk));
    (window as any).__pkr.game.scene.getScene('Map').children.list.forEach(walk);
    return out;
  });
  expect(look.filter((n) => n === 'league-step').length).toBe(r.stage.map.columns);
  expect(look).toContain('league-rays');
  await page.keyboard.press('Enter'); // the first Elite Four member
  await waitForScene(page, 'Battle');
  expect((await run(page)).battle.trainer.classId).toBe('elite-four');
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').message.text), { timeout: 10_000 })
    .toMatch(/^Elite Four .* would like to battle!/);
  await page.screenshot({ path: 'test-results/m4-elite-four.png' });
  expect(errors).toEqual([]);
});

test('beating the last champion shows the victory screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startDevRun(page, 'e2e-victory');
  await mapReady(page);
  // Go to the last region's league, walk up to the champion and win that battle through the session.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.run.regionIndex = session.run.regionOrder.length - 1;
    session.debugJumpToLeague();
    session.debugJumpToColumn(session.run.stage.map.columns);
    const champion = session.run.stage.map.nodes.find((n: any) => n.kind === 'champion');
    session.chooseNode(champion.id);
    let guard = 0;
    while (session.run.phase === 'battle' && guard++ < 100) {
      const battle = session.run.battle;
      if (battle.needsSwitch) {
        session.takeTurn({ kind: 'switch', partyIndex: session.run.party.findIndex((p: any) => p.hp > 0) });
        continue;
      }
      const mon = session.run.party[battle.activeIndex];
      battle.enemyItemsUsed = 99; // the champion would otherwise drink a potion at 1 HP
      battle.enemySwitches = 99;
      battle.enemyTeam[battle.enemyIndex].hp = 1;
      mon.hp = 1_000_000; // keeps the lead standing against a champion; only the ending matters here
      let index = mon.moves.findIndex((m: any) => (session.content.moves.get(m.id).power ?? 0) > 0);
      if (index < 0) {
        mon.moves[0] = { id: 'tackle', pp: 35 }; // a lead that only knows status moves can't finish the champion
        index = 0;
      }
      session.takeTurn({ kind: 'move', index: Math.max(0, index) });
    }
    while (session.run.phase === 'decision') session.resolveDecision({ kind: 'skipMove' });
    (window as any).__pkr.game.scene.getScene('Map').scene.start('GameOver');
  });
  await waitForScene(page, 'GameOver');
  const r = await run(page);
  expect(r.victory).toBe(true);
  expect(r.regionsCleared).toHaveLength(1);
  await page.screenshot({ path: 'test-results/m4-victory.png' });
  // The credits roll from the victory screen and return to it.
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('GameOver').scene.start('Credits');
  });
  await waitForScene(page, 'Credits');
  await page.screenshot({ path: 'test-results/m4-credits.png' });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'GameOver');
  // The finished run is no longer offered as Continue.
  expect(await page.evaluate(() => (window as any).__pkr.session.canContinue)).toBe(false);
  expect(errors).toEqual([]);
});
