import { expect, test, type Page } from '@playwright/test';

// Milestone 5 in a real browser: the Hub, the Trainer Archive, the
// Achievement Hall, the run-end payout and choosing an unlocked trainer.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const profile = (page: Page) => page.evaluate(() => (window as any).__pkr.session.profile);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the Hub shows the Bank, the Trainer Archive and the Achievement Hall', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter'); // Enter the Hub
  await waitForScene(page, 'Hub');
  await page.screenshot({ path: 'test-results/m5-hub.png' });

  // The Hub is a row of tiles: Settings, Trainers, New Run (focused), Events (and Past Runs), Unlocks.
  await page.keyboard.press('ArrowLeft'); // Trainers
  await page.keyboard.press('Enter'); // open the Trainers menu
  await page.keyboard.press('Enter'); // Trainer Archive
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').picker !== null)).toBe(true);
  await page.screenshot({ path: 'test-results/m5-archive.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // Unlocks
  await page.keyboard.press('Enter'); // opens Achievement Hall, Bank, Starter Laboratory, Attributes
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // Achievement Hall
  await page.waitForTimeout(300);
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown'); // scrolls the list
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m5-achievements.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.keyboard.press('ArrowDown'); // Bank, in the Unlocks menu
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m5-bank.png' });
  expect(errors).toEqual([]);
});

test('a lost run pays Bank Credits and earns achievements; a claimed trainer can start a run', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-m5&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); // Red
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter'); // Begin the run
  await waitForScene(page, 'Map');

  // Win one battle and lose the next, through the session.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const fight = (strong: boolean) => {
      const node = session.run.stage.map.nodes.find((n: any) => n.column === (session.run.stage.current ? 2 : 1));
      session.chooseNode(node.id);
      let guard = 0;
      while (session.run.phase === 'battle' && guard++ < 200) {
        const battle = session.run.battle;
        if (strong) battle.enemyTeam[battle.enemyIndex].hp = 1;
        else session.run.party[battle.activeIndex].hp = 1;
        session.takeTurn({ kind: 'move', index: 0 });
      }
      while (session.run.phase === 'decision') session.resolveDecision({ kind: 'skipMove' });
    };
    fight(true);
    if (session.run.phase === 'reward') session.chooseReward(0);
    session.run.party.forEach((m: any) => (m.hp = 1));
    fight(false);
    (window as any).__pkr.game.scene.getScene((window as any).__pkr.activeScene()).scene.start('GameOver');
  });
  await waitForScene(page, 'GameOver');
  await page.screenshot({ path: 'test-results/m5-run-end.png' });
  const p = await profile(page);
  expect(p.bankCredits).toBeGreaterThan(0);
  expect(p.achievements['first-steps']).toBeTruthy();
  expect(p.runHistory).toHaveLength(1);

  // Meet Brock's requirement and give enough credits, then claim him in the Archive.
  await page.keyboard.press('Enter'); // Back to the Hub
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.profile.best.regionsClearedNoCharm = 1;
    session.profile.bankCredits = 1000;
    (window as any).__pkr.game.scene.getScene('Hub').scene.restart();
  });
  await waitForScene(page, 'Hub');
  await page.keyboard.press('ArrowLeft'); // Trainers
  await page.keyboard.press('Enter'); // open the Trainers menu
  await page.keyboard.press('Enter'); // Trainer Archive
  await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // Red, Blue, Green, Brock
  await page.keyboard.press('Enter'); // claim Brock
  await expect.poll(async () => (await profile(page)).unlockedArchetypes).toContain('brock');
  await waitForScene(page, 'Hub');
  await page.screenshot({ path: 'test-results/m5-claimed.png' });

  await page.keyboard.press('ArrowRight'); // from Trainers to New Run
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m5-trainer-select.png' });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  const r = await page.evaluate(() => (window as any).__pkr.session.run);
  expect(r.archetypeId).toBe('brock');
  expect(r.inventory.potion).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});
