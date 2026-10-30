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
  // On this seed the first fatal hit is survived by Toughened It Out (found by replaying these steps; re-picked when abilities arrived).
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.profile.attributes = { ...session.profile.attributes, love: 100 };
    session.newRun('red', 'e2e-hyper-16');
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

test('The Two Pokémon Feel a Heated Rivalry: a banner when your Pokémon meets a species for the third battle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-rivalry-1');
    session.chooseStarter(0);
    const stage = session.run.stage;
    const first = stage.map.nodes.filter((n: any) => n.column === 1).find((n: any) => !n.harder) ?? stage.map.nodes.find((n: any) => n.column === 1);
    session.chooseNode(first.id);
    session.debugReplaceEnemy('snorlax', 20);
    session.run.battle.enemyTeam[0].moves = [{ id: 'growl', pp: 40 }];
    // Two earlier battles against Snorlax.
    session.run.story.histories[session.run.party[0].uid].foes = { snorlax: 2 };
    game.scene.getScenes(true)[0].scene.start('Battle');
  });
  await waitForScene(page, 'Battle');
  await page.waitForTimeout(1500);
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Battle').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
    });
  const rivals = () => page.evaluate(() => (window as any).__pkr.session.run.battle?.hyper.rivals ?? {});
  for (let i = 0; i < 20 && Object.keys(await rivals()).length === 0; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  expect(Object.values(await rivals())).toEqual(['calm']);
  await expect.poll(async () => (await texts()).includes('The Two Pokémon Feel a Heated Rivalry!'), { timeout: 15_000, intervals: [100] }).toBe(true);
  await page.screenshot({ path: 'test-results/m89-heated-rivalry.png' });
  expect(await page.evaluate(() => (window as any).__pkr.session.run.story.relationships.filter((r: any) => r.kind === 'rivalry').length)).toBe(1);
  expect(errors).toEqual([]);
});

test('This Trainer Will Return: a trainer that vowed to return comes back for a rematch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-return-1');
    session.chooseStarter(0);
    const run = session.run;
    run.story.enemyProfiles.push({
      id: 'trainer-0-9-1',
      name: 'Joey',
      trainerId: 'youngster',
      region: 0,
      team: [{ speciesId: 'rattata', level: 5 }],
      battles: [{ eventId: 'x', result: 'win', where: { region: 0, stage: 9, level: 3, node: null, battle: 1, turn: 2 } }],
      adaptations: [],
    });
    run.story.flags['return:trainer-0-9-1'] = 'waiting';
    const first = run.stage.map.nodes.filter((n: any) => n.column === 1)[0];
    first.kind = 'trainer';
    session.chooseNode(first.id);
    game.scene.getScenes(true)[0].scene.start('Battle');
  });
  await waitForScene(page, 'Battle');
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Battle').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text as string);
    });
  await expect.poll(async () => (await texts()).some((t: string) => t.includes('is back for a rematch!')), { timeout: 15_000, intervals: [100] }).toBe(true);
  await page.screenshot({ path: 'test-results/m89-trainer-returns.png' });
  expect(await page.evaluate(() => (window as any).__pkr.session.run.battle.returning)).toBe('trainer-0-9-1');
  expect(errors).toEqual([]);
});

test('The Seven Emotions: a coloured heart on the party screen and the Story screen on the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-emotions-1');
    session.chooseStarter(0);
    const run = session.run;
    const uid = run.party[0].uid;
    const where = { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: 1 };
    const add = (seq: number, text: string, emotions: string[]) => {
      const m = { eventId: `x${seq}`, seq: 900 + seq, type: 'storyMoment', importance: 80, text, where, emotions };
      run.story.histories[uid].memories.push(m);
      run.story.chronicle.push({ ...m, actors: [uid] });
    };
    add(1, 'Hung in there at low HP against Pidgey', ['patience']);
    add(2, 'Toughened it out against Rattata', ['determination']);
    add(3, 'Hung on again', ['patience']);
    game.scene.getScenes(true)[0].scene.start('Map');
  });
  await waitForScene(page, 'Map');
  await page.waitForTimeout(400);
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => ({ text: o.text as string, name: o.name as string }));
    });
  // Opens a map button's menu the way a click does (the button's option, by label).
  const clickButton = async (label: string) => {
    await page.evaluate((l) => {
      const scene = (window as any).__pkr.game.scene.getScene('Map');
      const i = scene.options.findIndex((o: any) => o.kind === l.toLowerCase());
      scene.activate(i);
    }, label);
    await page.waitForTimeout(400);
  };
  await clickButton('Party');
  const named = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).map((o: any) => o.name as string);
  });
  expect(named).toContain('emotion-patience');
  await page.screenshot({ path: 'test-results/m89-emotion-party.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await clickButton('Story');
  await expect.poll(async () => (await texts()).some((t: { text: string; name: string }) => t.text.includes('Toughened it out against Rattata')), { timeout: 5000 }).toBe(true);
  await page.screenshot({ path: 'test-results/m89-story-screen.png' });
  expect(errors).toEqual([]);
});

test('A Past Pokémon Wants to Join: it offers to join, and a keepsake gives candies', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-reunion-1');
    session.chooseStarter(0);
    const run = session.run;
    const mon = { ...structuredClone(run.party[0]), uid: 'p99', speciesId: 'charmander', shiny: true };
    run.pending = [{ kind: 'reunion', mon, hallOfFame: true }];
    run.afterDecisions = 'reward';
    run.phase = 'decision';
    game.scene.getScenes(true)[0].scene.start('Decision');
  });
  await waitForScene(page, 'Decision');
  const texts = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Decision').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text as string);
  });
  expect(texts.join(' ')).toContain('Charmander never forgot you!');
  expect(texts.join(' ')).toContain('Take a keepsake');
  expect(texts.join(' ')).toContain('Let it go on its journey');
  await page.screenshot({ path: 'docs/m89-reunion.png' });
  const candiesBefore = await page.evaluate(() => (window as any).__pkr.session.run.candies);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Reward');
  const after = await page.evaluate(() => (window as any).__pkr.session.run);
  expect(after.candies).toBeGreaterThan(candiesBefore);
  expect(after.party).toHaveLength(1);
  expect(errors).toEqual([]);
});
