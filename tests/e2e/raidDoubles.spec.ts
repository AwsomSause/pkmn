import { expect, test, type Page } from '@playwright/test';

// Totems: a Totem territory on the map opens a preview, entering starts the fight with a Totem status line, and the run survives a reload.
// and the run survives a reload mid-fight.

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


async function openDen(page: Page, seed: string, side: Record<string, unknown>, extraMon = false) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?seed=${seed}`);
  await waitForScene(page, 'MainMenu');
  await toMap(page);
  await page.evaluate(
    ({ side, extraMon }) => {
      const { session } = (window as any).__pkr;
      const run = session.run;
      if (extraMon) run.party.push({ ...structuredClone(run.party[0]), uid: 'p-e2e-extra' });
      const node = run.stage.map.nodes.find((n: any) => n.column === 1);
      node.sides.push(side);
      run.stage.current = node.id;
      run.money = 5000;
      (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
    },
    { side, extraMon },
  );
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

test('a rival raid offers help, race or leave; helping starts a raid fight with cheers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openDen(page, 'rival-raid-e2e', { id: 'raid-e2e', kind: 'raid', raidId: 'rival-den', used: false });
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openRaid('raid-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter'); // first row: help your rival
  await waitForScene(page, 'Battle');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').status.text), { timeout: 10_000 }).toContain('RAID');
  const raid = await page.evaluate(() => {
    const b = (window as any).__pkr.session.run.battle;
    return { helped: b.raid.rivalHelped, hp: b.enemyTeam[0].hp, cheers: b.raid.cheersLeft };
  });
  expect(raid.helped).toBe(true);
  expect(raid.cheers).toBe(3);
  // The cheer menu (Offense / Defense / Healing) opens.
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').showCheerMenu());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').menu))).toBe(true);
  expect(errors).toEqual([]);
});

test('a two-versus-one Totem starts a double battle with its ally and survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openDen(page, 'totem-2v1-e2e', { id: 'totem-e2e', kind: 'totem', totemId: 'totem-salazzle', used: false }, true);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openTotem('totem-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').status.text), { timeout: 10_000 }).toContain('TOTEM');
  const state = await page.evaluate(() => {
    const b = (window as any).__pkr.session.run.battle;
    return { doubles: Boolean(b.doubles), foes: b.enemyTeam.length, ally: b.totem.allyUid === b.enemyTeam[1]?.uid };
  });
  expect(state).toEqual({ doubles: true, foes: 2, ally: true });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').duo))).toBe(true);

  await page.reload();
  await waitForScene(page, 'MainMenu');
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    const run = raw ? JSON.parse(raw[1] as string).data : null;
    return run ? { totem: run.battle?.totem?.id, doubles: Boolean(run.battle?.doubles) } : null;
  });
  expect(saved).toEqual({ totem: 'totem-salazzle', doubles: true });
  expect(errors).toEqual([]);
});
