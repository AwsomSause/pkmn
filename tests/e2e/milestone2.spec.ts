import { expect, test, type Page } from '@playwright/test';
import { confirmUntil } from './battleInput';


// Milestone 2 in a real browser: the Fight / Bag / Pokémon menu, throwing a
// ball, the caught-Pokémon decision, and choosing who gets a reward.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const run = (page: Page) => page.evaluate(() => (window as any).__pkr.session.run);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

/** On the map: waits for the stage banner to clear, then picks the focused node (Enter). */
async function enterFromMap(page: Page) {
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
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
}

/** Presses Enter until the battle shows the Fight / Bag / Pokémon menu. */
async function waitForActionMenu(page: Page) {
  await expect
    .poll(
      async () => {
        const text = await page.evaluate(() => {
          const s = (window as any).__pkr.game.scene.getScene('Battle');
          return s?.menu ? s.message.text : null;
        });
        if (text === null) await page.keyboard.press('Enter');
        return text;
      },
      { timeout: 20_000, intervals: [300] },
    )
    .toMatch(/What will/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('throw a ball from the Bag, catch the Pokémon and add it to the party', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-catch');

  // An easy target: a weak, sleeping wild Pokémon, and plenty of balls.
  await page.evaluate(() => {
    const session = (window as any).__pkr.session;
    session.debugReplaceEnemy('rattata', 2);
    session.run.battle.enemyTeam[0].status = { id: 'slp', turns: 99 };
    session.run.battle.enemyTeam[0].hp = 1;
    session.debugGiveItem('ultra-ball', 10);
    (window as any).__pkr.game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await waitForActionMenu(page);
  await page.screenshot({ path: 'test-results/m2-action-menu.png' });

  const ballsBefore = (await run(page)).inventory['poke-ball'];
  const atRootMenu = () =>
    page.evaluate(() => {
      const pkr = (window as any).__pkr;
      // Caught: the Decision screen is coming, so no further key may be pressed (it would answer it).
      if (pkr.session.run.pending.some((d: any) => d.kind === 'caught')) return 'caught';
      const m = pkr.game.scene.getScene('Battle')?.menu;
      return m ? m.config.options[1]?.label === 'Bag' : null; // null: no menu (messages playing)
    });
  for (let attempt = 0; attempt < 10 && (await scene(page)) === 'Battle'; attempt++) {
    // Wait for the Fight / Bag / Pokémon menu (Enter only skips messages when no menu is up).
    await expect
      .poll(
        async () => {
          if ((await scene(page)) !== 'Battle') return 'left';
          const root = await atRootMenu();
          if (root === 'caught') return 'left';
          if (root === null) await page.keyboard.press('Enter');
          return root ? 'root' : 'busy';
        },
        { timeout: 20_000, intervals: [300] },
      )
      .not.toBe('busy');
    if ((await scene(page)) !== 'Battle' || (await atRootMenu()) === 'caught') break;
    await page.keyboard.press('ArrowRight'); // Bag
    await page.keyboard.press('Enter');
    if (attempt === 0) {
      await page.waitForTimeout(200);
      await page.screenshot({ path: 'test-results/m2-bag.png' });
    }
    await page.keyboard.press('Enter'); // first item: Poké Ball
    // The throw has started once the root menu is gone; the next loop waits for it to come back.
    await expect
      .poll(async () => (await scene(page)) !== 'Battle' || (await atRootMenu()) !== true, { timeout: 10_000, intervals: [100] })
      .toBe(true);
  }
  await confirmUntil(page, async () => (await scene(page)) === 'Decision', 20_000);
  await waitForScene(page, 'Decision');
  const atDecision = await run(page);
  expect(atDecision.inventory['poke-ball'] ?? 0).toBeLessThan(ballsBefore);
  expect(atDecision.pending[0].kind).toBe('caught');
  expect(atDecision.pending[0].mon.speciesId).toBe('rattata');
  await page.screenshot({ path: 'test-results/m2-caught.png' });

  await page.keyboard.press('Enter'); // Add to party
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Reward');
  const after = await run(page);
  expect(after.party).toHaveLength(2);
  expect(after.party[1].speciesId).toBe('rattata');

  // Refreshing keeps the new party member.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Reward');
  expect((await run(page)).party).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('switch Pokémon from the party menu, and give a reward to a chosen Pokémon', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-switch');

  // Give the player a second, strong Pokémon to switch to.
  const secondUid = await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty(session.run.party[0].speciesId, 40);
    // Stage themes vary the wild Pokémon; fix the opponent and the move so the fight is about the menus, not luck.
    session.debugReplaceEnemy('rattata', 4);
    session.run.party[1].moves = [{ id: 'ember', pp: 25 }];
    (window as any).__pkr.game.scene.getScene('Battle').scene.restart();
    return session.run.party[1].uid as string;
  });
  await waitForScene(page, 'Battle');
  await waitForActionMenu(page);
  await page.keyboard.press('ArrowDown'); // Pokémon
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m2-party.png' });
  // The cursor starts on the first Pokémon that can switch in: the second slot.
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).battle?.activeIndex ?? -1, { timeout: 10_000 }).toBe(1);

  // Finish the battle with the strong Pokémon.
  for (let i = 0; i < 400; i++) {
    const s = await scene(page);
    if (s !== 'Battle') break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  while ((await scene(page)) === 'Decision') {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); // "Don't learn"
    await page.keyboard.press('Enter'); // Yes
    await page.waitForTimeout(1600);
  }
  await waitForScene(page, 'Reward');

  // Force a single Pokémon reward into the draft, then give it to slot 2.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.run.draft = ['protein', 'nugget', 'potion', 'ether', 'revive'];
    (window as any).__pkr.game.scene.getScene('Reward').scene.restart();
  });
  await waitForScene(page, 'Reward');
  await page.keyboard.press('Enter'); // Protein → asks which Pokémon
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/m2-reward-target.png' });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).log.rewardsTaken.length, { timeout: 10_000 }).toBe(1);
  const after = await run(page);
  const second = after.party.find((p: { uid: string }) => p.uid === secondUid);
  expect(second.vitamins.atk).toBe(1);
  expect(errors).toEqual([]);
});
