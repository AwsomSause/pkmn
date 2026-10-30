import { expect, test, type Page } from '@playwright/test';

// Double battles: a trainer fights two at a time; both spots get a command (with a target
// picker), the turn plays, and the battle survives a reload.

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

const battleState = (page: Page) =>
  page.evaluate(() => {
    const b = (window as any).__pkr.session.run?.battle;
    return b ? { doubles: Boolean(b.doubles), turn: b.turn, outcome: b.outcome, needsSwitch: b.needsSwitch } : null;
  });

test('a double battle takes two commands a turn and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=doubles-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // Every ordinary trainer fights doubles here, the party has two Pokémon, and the first node is a trainer.
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.content.balance.doubles = { chance: 1, fromStage: 0 };
    const run = session.run;
    const twin = structuredClone(run.party[0]);
    twin.uid = 'p-dbl';
    run.party.push(twin);
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.kind = 'trainer';
    session.chooseNode(node.id);
    // The first stage's trainers bring one Pokémon: give this one a partner and make it a double battle.
    const battle = session.run.battle;
    if (!battle.doubles) {
      const foe = structuredClone(battle.enemyTeam[0]);
      foe.uid = 'e-dbl';
      battle.enemyTeam.push(foe);
      const blank = (v: any) => structuredClone(v);
      battle.doubles = {
        player: { index: 1, stages: blank(battle.playerStages), vol: blank(battle.playerVolatile) },
        enemy: { index: 1, stages: blank(battle.enemyStages), vol: blank(battle.enemyVolatile) },
        swapped: { player: false, enemy: false },
        refill: [],
        commanding: [],
        aims: {},
      };
      battle.participants.push('p-dbl');
    }
    game.scene.getScene('Map').scene.start('Battle');
  });
  await waitForScene(page, 'Battle');
  expect((await battleState(page))?.doubles).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').duo))).toBe(true);

  // Play turns with Enter: Fight, first move, first target, for each Pokémon.
  for (let i = 0; i < 80; i++) {
    const s = await battleState(page);
    if (!s || s.outcome || s.turn >= 3) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  const after = await battleState(page);
  expect(after === null || after.outcome !== null || after.turn >= 2).toBe(true);

  // Reload: if the battle is still on, it is still a double battle.
  if (after && !after.outcome) {
    await page.reload();
    await waitForScene(page, 'MainMenu');
    const saved = await page.evaluate(() => {
      const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
      const run = raw ? JSON.parse(raw[1] as string).data : null;
      return run?.battle ? Boolean(run.battle.doubles) : null;
    });
    expect(saved).toBe(true);
  }
  expect(errors).toEqual([]);
});
