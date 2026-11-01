import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

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
  // The card ignores Enter for its first 220 ms of game time, which runs slower than the clock on a busy runner.
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Reward').inputReady), { timeout: 10_000 }).toBe(true);
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
  await confirmToMenu(page);
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

test('shop items: a Coupon halves a price and the Member Card sells an item early', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-shop-items');

  for (const id of ['item:coupon-3', 'item:member-card']) {
    await showDraft(page, [id, 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
    await page.keyboard.press('Enter');
    await waitForScene(page, 'Map');
  }
  // Open a shop beside the next node.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes[0];
    node.sides = [{ id: 'e2e-shop', kind: 'shop', used: false }];
    run.stage.current = node.id;
    run.money = 5000;
    session.visitSide('e2e-shop');
    for (const s of game.scene.getScenes(true)) s.scene.stop();
    game.scene.start('Shop');
  });
  await waitForScene(page, 'Shop');
  // Every text on the shop screen, however deep in its containers.
  const rows = () =>
    page.evaluate(() => {
      const out: string[] = [];
      const walk = (o: any) => {
        if (typeof o.text === 'string') out.push(o.text);
        for (const c of o.list ?? []) walk(c);
      };
      for (const c of (window as any).__pkr.game.scene.getScene('Shop').children.list) walk(c);
      return out;
    });
  const texts: string[] = await rows();
  expect(texts.some((t) => t.endsWith('(early)'))).toBe(true);
  expect(texts).toContain('₽100');
  await page.screenshot({ path: 'test-results/m875-shop-items.png' });
  // The first row is the Poké Ball at half price.
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).money, { timeout: 10_000 }).toBe(4900);
  expect((await run(page)).mapEffects).toEqual([]);
  expect(errors).toEqual([]);
});

test('map movement items: the Items menu puts you on a Bicycle, and the Devon Scope shows the next wild Pokémon', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-move-items');

  // Take the Bicycle, then the Devon Scope (showDraft sets the passives, so the second keeps the Bicycle).
  await showDraft(page, ['item:bicycle', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await showDraft(page, ['item:devon-scope', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl'], { bicycle: 1 });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  expect((await run(page)).passives).toEqual({ bicycle: 1, 'devon-scope': 1 });
  const map = () => page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScene('Map');
    return { busy: scene.busy, notice: scene.notice?.text ?? '', info: scene.info?.text ?? '', options: scene.options.map((o: any) => (o.kind === 'node' ? `node:${o.node.column}:${o.node.kind}` : o.kind)) as string[], previews: Object.keys(scene.previews) };
  });
  await expect.poll(async () => (await map()).busy, { timeout: 10_000 }).toBe(false);
  // The Devon Scope previews the wild stops on offer, and the info line names them.
  const before = await map();
  expect(before.previews.length).toBeGreaterThan(0);
  const wildIndex = before.options.findIndex((o) => o.endsWith(':wild'));
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('Map').focus(i, false), wildIndex);
  await expect.poll(async () => (await map()).info).toMatch(/Devon Scope: .+/);
  await page.screenshot({ path: 'test-results/m875-map-previews.png' });

  // Items → Bicycle: the stops on offer move two columns ahead.
  const itemsIndex = before.options.indexOf('items');
  expect(itemsIndex).toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('Map').focus(i, false), itemsIndex);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m875-map-items-menu.png' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).moveMode, { timeout: 10_000 }).toBe('bicycle');
  await waitForScene(page, 'Map');
  await expect.poll(async () => (await map()).busy, { timeout: 10_000 }).toBe(false);
  const riding = await map();
  expect(riding.notice).toMatch(/Bicycle/);
  expect(riding.options.filter((o) => o.startsWith('node:')).every((o) => o.startsWith('node:2:'))).toBe(true);

  // Near the gym with a Rule Book, Fame Checker and Itemfinder: the Items menu lists what they show.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const run = session.run;
    delete run.moveMode;
    run.passives = { ...run.passives, 'rule-book': 1, 'fame-checker': 1, itemfinder: 1 };
    run.stage.current = run.stage.map.nodes.find((n: any) => n.column === run.stage.map.columns - 2).id;
    game.scene.getScene('Map').scene.restart({ notice: 'test' });
  });
  await expect.poll(async () => (await map()).busy, { timeout: 10_000 }).toBe(false);
  await page.screenshot({ path: 'test-results/m875-map-gym-preview.png' });
  const items = (await map()).options.indexOf('items');
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('Map').focus(i, false), items);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m875-map-items-info.png' });
  const rows = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').itemRows().map((r: any) => r.title));
  expect(rows).toEqual(['Bicycle', 'Fame Checker', 'Rule Book']);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('fishing: a Good Rod spot offers two Water Pokémon and starts a battle with the one picked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await startRun(page, 'e2e-fishing');
  await showDraft(page, ['item:good-rod', 'item:heart-scale', 'item:big-pearl', 'item:stardust', 'item:pearl']);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  // Stand on a stop with a fishing spot beside it (a new stage would add one; this test puts it here).
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const stage = session.run.stage;
    const node = stage.map.nodes.find((n: any) => n.column === 1);
    node.sides = [{ id: 'item-stop-1', kind: 'fish', used: false }];
    stage.current = node.id;
    stage.visited = [node.id];
    game.scene.getScene('Map').scene.restart({ notice: 'test' });
  });
  const map = () => page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScene('Map');
    return { busy: scene.busy, options: scene.options.map((o: any) => (o.kind === 'side' ? `side:${o.side.kind}` : o.kind)) as string[] };
  });
  await expect.poll(async () => (await map()).busy, { timeout: 10_000 }).toBe(false);
  const fishIndex = (await map()).options.indexOf('side:fish');
  expect(fishIndex).toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('Map').focus(i, false), fishIndex);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m875-fishing.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  const after = await run(page);
  expect(after.battle.fishing).toBe(true);
  expect(after.stage.map.nodes.find((n: any) => n.id === after.stage.current).sides[0].used).toBe(true);
  expect(errors).toEqual([]);
});

test('draft items (3b-3b): a six-card draft, and the Lock Capsule keeps a card for the next draft', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-draft-items');
    session.chooseStarter(0);
    const run = session.run;
    run.mapEffects = [{ itemId: 'cornn-berry', uses: 1 }, { itemId: 'lock-capsule', uses: 1 }];
    run.draft = [...session.content.rewards.keys()].slice(0, 6);
    run.phase = 'reward';
    game.scene.getScenes(true)[0].scene.start('Reward');
  });
  await waitForScene(page, 'Reward');
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Reward').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text as string);
    });
  const before = await texts();
  expect(before).toContain('Re-roll ×1');
  expect(before).toContain('Lock ×1');
  expect((await page.evaluate(() => (window as any).__pkr.session.run.draft.length))).toBe(6);
  // Down to the buttons, right to "Lock one", then lock the first card.
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await texts()).some((t: string) => t.includes('Lock Capsule'))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run.draftCarry?.length ?? 0), { timeout: 10_000 }).toBe(1);
  await page.waitForTimeout(1000);
  const after = await texts();
  expect(after).toContain('Locked: in the next draft too');
  expect(after.some((t: string) => t.includes('locked in'))).toBe(true);
  expect(after).not.toContain('Lock ×1');
  await page.screenshot({ path: 'docs/m875-draft-items.png' });
  expect(errors).toEqual([]);
});
