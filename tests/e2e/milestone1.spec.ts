import { expect, test, type Page } from '@playwright/test';

// Drives the real game in a browser with the keyboard, like a player would.
// The fixed seed makes the run reproducible.

type Hook = {
  activeScene: () => string | null;
  session: {
    run: null | {
      phase: string;
      encountersCompleted: number;
      money: number;
      draft: string[] | null;
      log: { rewardsTaken: string[]; battlesWon: number };
      party: { speciesId: string; level: number; xp: number; hp: number }[];
    };
    canContinue: boolean;
  };
};

const scene = (page: Page) => page.evaluate(() => (window as unknown as { __pkr?: Hook }).__pkr?.activeScene() ?? null);
const run = (page: Page) => page.evaluate(() => (window as unknown as { __pkr: Hook }).__pkr.session.run);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  // A short human-like pause: the very first key press after a page load can
  // arrive before the browser has routed keyboard input to the game.
  await page.waitForTimeout(250);
}

/** Presses Enter until the battle ends (Enter advances text, opens Fight and picks the first move). */
async function fightUntilOver(page: Page): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const s = await scene(page);
    if (s === 'Reward' || s === 'GameOver' || s === 'Decision') return s;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  throw new Error('Battle did not finish');
}

/** On the map: waits for the stage banner to clear, then picks the focused node (Enter). */
async function enterFromMap(page: Page) {
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('menu → trainer → starter → map → battle → reward → map → next battle, then save and continue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?seed=e2e-seed-1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter'); // Enter the Hub (Continue is disabled)
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); // Red
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  const choices = await page.evaluate(() => (window as any).__pkr.session.run.starterChoices as string[]);
  expect(new Set(choices).size).toBe(3);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // second starter
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter'); // Begin the run
  await enterFromMap(page);
  expect((await run(page))!.party[0]!.speciesId).toBe(choices[1]);
  const startXp = (await run(page))!.party[0]!.xp;

  expect(await fightUntilOver(page)).toBe('Reward');
  const afterWin = (await run(page))!;
  expect(afterWin.phase).toBe('reward');
  expect(afterWin.draft).toHaveLength(5);
  expect(new Set(afterWin.draft).size).toBe(5);
  expect(afterWin.money).toBeGreaterThan(0);
  expect(afterWin.party[0]!.xp).toBeGreaterThan(startXp);
  await page.screenshot({ path: 'test-results/reward-screen.png' });

  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // take the second reward
  await enterFromMap(page);
  const next = (await run(page))!;
  expect(next.log.rewardsTaken).toEqual([afterWin.draft![1]]);
  expect(next.encountersCompleted).toBe(1);
  await page.screenshot({ path: 'test-results/second-battle.png' });

  // Refresh the page: the run must continue exactly where it was.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  expect(await page.evaluate(() => (window as any).__pkr.session.canContinue)).toBe(true);
  await page.keyboard.press('Enter'); // Continue is focused when a save exists
  await waitForScene(page, 'Battle');
  const resumed = (await run(page))!;
  expect(resumed.log.rewardsTaken).toEqual(next.log.rewardsTaken);
  expect(resumed.money).toBe(next.money);
  expect(resumed.encountersCompleted).toBe(1);
  expect(errors).toEqual([]);
});

test('a damaged save is reported and can be discarded safely', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('pkr.run', '{"broken": true'));
  await page.reload();
  await waitForScene(page, 'MainMenu');
  expect(await page.evaluate(() => (window as any).__pkr.session.savedRun.status)).toBe('corrupt');
  await page.keyboard.press('Enter'); // "Discard damaged save"
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.savedRun.status)).toBe('none');
  const backups = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pkr.run.corrupt.')));
  expect(backups).toHaveLength(1);
});

test('losing a battle ends the run and keeps the profile', async ({ page }) => {
  test.setTimeout(180_000); // a long fight of key presses; slow when the whole suite runs at once
  await page.goto('/?seed=e2e-lose&debug=1');
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
  await enterFromMap(page);
  // Use the debug tools to face a much stronger opponent.
  await page.evaluate(() => (window as any).__pkr.session.debugReplaceEnemy('growlithe', 40));
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Battle').scene.restart();
  });
  expect(await fightUntilOver(page)).toBe('GameOver');
  expect(await page.evaluate(() => localStorage.getItem('pkr.run'))).toBeNull();
  const stats = await page.evaluate(() => (window as any).__pkr.session.profile.stats);
  expect(stats.runsEnded).toBe(1);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
});
