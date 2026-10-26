import { expect, test, type Page } from '@playwright/test';

// M8.75 item effects in a real browser: catalog items show on the reward
// screen with the director's icons, a maxed team item is a free re-roll, and
// a PP Up asks which move to boost.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const run = (page: Page) => page.evaluate(() => (window as any).__pkr.session.run);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

/** Puts the run on the reward screen with this draft. */
async function showDraft(page: Page, draft: string[], passives: Record<string, number> = {}) {
  await page.evaluate(
    ([d, p]) => {
      const { session, game } = (window as any).__pkr;
      session.run.phase = 'reward';
      session.run.draft = d;
      session.run.passives = p;
      const reward = game.scene.getScene('Reward');
      if (reward.scene.isActive()) {
        reward.scene.restart();
        return;
      }
      for (const s of game.scene.getScenes(true)) s.scene.stop();
      game.scene.start('Reward');
    },
    [draft, passives] as const,
  );
  await waitForScene(page, 'Reward');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('catalog items: icons, the free re-roll, and a PP Up', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-items');

  await showDraft(page, ['item:amulet-coin', 'item:heart-scale', 'item:pp-up', 'item:big-pearl', 'item:tm-normal'], { 'amulet-coin': 5 });
  const textures = await page.evaluate(() => ['item.gen5/amulet-coin', 'item.gen5/heart-scale', 'item.gen5/pp-up'].map((k) => (window as any).__pkr.game.textures.exists(k)));
  expect(textures).toEqual([true, true, true]);
  await page.screenshot({ path: 'test-results/m875-draft.png' });

  // The Amulet Coin is at its max (5): picking it re-rolls the draft.
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).log.rewardsTaken.length, { timeout: 10_000 }).toBe(1);
  await waitForScene(page, 'Reward');
  const rerolled = await run(page);
  expect(rerolled.phase).toBe('reward');
  expect(rerolled.passives['amulet-coin']).toBe(5);
  expect(rerolled.draft).toHaveLength(5);

  // A PP Up goes to the only Pokémon, then asks which move.
  await showDraft(page, ['item:pp-up', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Decision');
  await page.screenshot({ path: 'test-results/m875-ppup.png' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).party[0].moves[0].ppUps ?? 0, { timeout: 10_000 }).toBe(1);
  expect(errors).toEqual([]);
});

const menuLabels = (page: Page) =>
  page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').menu?.config?.options?.map((o: any) => o.label) ?? null);

test('held items: Leftovers from the draft heal in battle, and an X Attack raises Attack', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-held');

  // Leftovers go to the only Pokémon.
  await showDraft(page, ['item:leftovers', 'item:x-attack', 'item:charcoal', 'item:heart-scale', 'item:big-pearl']);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).party[0].held?.leftovers ?? 0, { timeout: 10_000 }).toBe(1);

  // Back on the map: the starter is hurt and carries an X Attack boost.
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const mon = (window as any).__pkr.session.run.party[0];
    mon.hp = Math.max(1, Math.floor(mon.hp / 2));
    mon.boosts = [{ kind: 'stage', stat: 'atk', stages: 1, turns: 5 }];
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 60);
    session.run.battle.enemyTeam[0].moves = [{ id: 'splash', pp: 40 }];
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  const hpBefore = (await run(page)).party[0].hp;
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toContain('Fight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).party[0].hp, { timeout: 20_000 }).toBeGreaterThan(hpBefore);
  const after = await run(page);
  expect(after.battle.playerStages.atk).toBe(1);
  expect(after.party[0].boosts).toEqual([{ kind: 'stage', stat: 'atk', stages: 1, turns: 4 }]);
  await page.screenshot({ path: 'test-results/m875-held.png' });
  expect(errors).toEqual([]);
});

test('map items: a Repel skips a wild battle and the map shows what is working', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-map-items');

  await showDraft(page, ['item:black-flute', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).mapEffects?.length ?? 0, { timeout: 10_000 }).toBe(1);
  await waitForScene(page, 'Map');
  await showDraft(page, ['item:repel', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  const notice = () => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').notice?.text ?? '');
  await expect.poll(notice).toBe('Working: Black Flute · Repel ×1');
  await page.screenshot({ path: 'test-results/m875-map-items.png' });

  // Focus a wild stop and walk into it: the Repel keeps the battle away.
  const wildIndex = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').options.findIndex((o: any) => o.kind === 'node' && o.node.kind === 'wild'));
  expect(wildIndex).toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('Map').focus(i, false), wildIndex);
  await page.keyboard.press('Enter');
  await expect.poll(notice, { timeout: 10_000 }).toBe('The Repel kept wild Pokémon away!');
  const after = await run(page);
  expect(after.phase).toBe('map');
  expect(after.stage.current).not.toBeNull();
  expect(after.mapEffects.map((e: any) => e.itemId)).toEqual(['black-flute']);
  expect(errors).toEqual([]);
});
