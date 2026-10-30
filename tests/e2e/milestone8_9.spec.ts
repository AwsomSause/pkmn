import { expect, test, type Page } from '@playwright/test';

// Milestone 8.9 in a real browser: a Hyper moment (Toughened It Out) shows as
// a story moment (banner + its own line), the debug Story Log lists the events
// live, and the run-end screen shows the run's top moments.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Toughened It Out shows as a story moment, the Story Log shows it, and the run-end screen lists the moments', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  // On this seed the first fatal hit is survived by Toughened It Out (found by replaying these steps in a unit test).
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.profile.attributes = { ...session.profile.attributes, love: 100 };
    session.newRun('red', 'e2e-hyper-12');
    session.chooseStarter(0);
    const stage = session.run.stage;
    const first = stage.map.nodes.filter((n: any) => n.column === 1).find((n: any) => !n.harder) ?? stage.map.nodes.find((n: any) => n.column === 1);
    session.chooseNode(first.id);
    session.debugReplaceEnemy('machamp', 80);
    game.scene.getScenes(true)[0].scene.start('Battle');
  });
  await waitForScene(page, 'Battle');
  await page.waitForTimeout(1500);
  // Fight, then the first move (a key press can be dropped, so press until the turn starts).
  for (let i = 0; i < 6 && (await page.evaluate(() => (window as any).__pkr.session.run.battle?.turn)) === 1; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run.story.events.some((e: any) => e.type === 'storyMoment')), { timeout: 10_000 }).toBe(true);
  // The banner appears when the moment is played back.
  const bannerShown = () => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').children.list.some((o: any) => o.type === 'Text' && o.text === 'Toughened It Out!'));
  await expect.poll(bannerShown, { timeout: 15_000, intervals: [100] }).toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m89-love-moment.png' });
  const party = await page.evaluate(() => (window as any).__pkr.session.run.party[0]);
  expect(party.hp).toBe(1);

  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  await expect(page.locator('#debug-panel')).toContainText('Story Log');
  await expect(page.locator('#debug-panel')).toContainText('storyMoment');
  await page.screenshot({ path: 'test-results/m89-story-log.png' });
  await page.keyboard.press('F2');

  // Play on until the run is lost (the Machamp is far too strong).
  for (let i = 0; i < 60 && (await scene(page)) !== 'GameOver'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  await waitForScene(page, 'GameOver');
  const texts = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('GameOver').children.list.filter((o: any) => o.type === 'Text').map((o: any) => o.text).join('\n'));
  expect(texts).toContain('Moments of this run');
  expect(texts).toContain('Toughened it out against Machamp');
  await page.screenshot({ path: 'test-results/m89-run-end.png' });
  expect(errors).toEqual([]);
});

test('The Enemy Is Getting Riled Up: a banner a turn ahead and a "Riled up!" badge until it strikes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-rage-1');
    session.chooseStarter(0);
    const stage = session.run.stage;
    const first = stage.map.nodes.filter((n: any) => n.column === 1).find((n: any) => !n.harder) ?? stage.map.nodes.find((n: any) => n.column === 1);
    session.chooseNode(first.id);
    // A sturdy foe that only lowers stats, so the starter lands three hits.
    session.debugReplaceEnemy('snorlax', 20);
    session.run.battle.enemyTeam[0].moves = [{ id: 'growl', pp: 40 }];
    game.scene.getScenes(true)[0].scene.start('Battle');
  });
  await waitForScene(page, 'Battle');
  await page.waitForTimeout(1500);
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Battle').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
    });
  const warned = () => page.evaluate(() => (Object.values((window as any).__pkr.session.run.battle?.hyper.rage ?? {})[0] as any)?.state ?? null);
  for (let i = 0; i < 40 && (await warned()) !== 'warned'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  expect(await warned()).toBe('warned');
  await expect.poll(async () => (await texts()).includes('The Enemy Is Getting Riled Up!'), { timeout: 15_000, intervals: [100] }).toBe(true);
  await page.screenshot({ path: 'test-results/m89-riled-up-banner.png' });
  await expect.poll(async () => (await texts()).includes('RILED UP!'), { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'test-results/m89-riled-up-badge.png' });
  // Next turn it unleashes its rage before its move, and the badge goes.
  for (let i = 0; i < 20 && (await warned()) === 'warned'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  expect(await warned()).toBe('spent');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.battle?.enemyStages.atk)).toBe(1);
  expect(errors).toEqual([]);
});
