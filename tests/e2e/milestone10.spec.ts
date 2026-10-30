import { expect, test, type Page } from '@playwright/test';

// Milestone 10 visual slice 1: the Aero battle screen (glass panels, glossy
// buttons, Essentials type/category/status art, arena ambience) and its
// motion settings.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startBattle(page: Page) {
  await page.keyboard.press('Enter'); // Enter the Hub
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); // Red
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
}

/** Waits until the battle shows its action menu. */
async function waitForMenu(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').menu)), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

/** Texture keys of everything drawn on the battle field (arena, ambience, sprites). */
const fieldKeys = (page: Page) =>
  page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').field.list.map((o: any) => o.texture?.key ?? null).filter(Boolean));

test('the battle screen uses the Aero look and pack art', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/?seed=m10-visual&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  // Ambience layers from the EBDX scenery sit on the field.
  expect((await fieldKeys(page)).some((k: string) => k.startsWith('pack.'))).toBe(true);
  // The command menu is glossy buttons.
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').menu.config.glass))).toBe(true);
  await page.screenshot({ path: 'test-results/m10-battle.png' });

  // Fight: the focused move shows Essentials' type label and category icon.
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').moveBadges?.list.map((o: any) => o.texture.key).slice(0, 2)))
    .toEqual(['pack.ebdx.types', 'pack.ebdx.category']);
  // Enhanced Battle UI extras: an effectiveness tag with words (damaging moves) or none (status moves).
  const extras = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').moveBadges.list.map((o: any) => o.text ?? o.texture.key));
  expect(extras.some((k: string) => /effective|No effect|Normal damage/.test(k)) || !extras.includes('pack.ebui.effectiveness')).toBe(true);
  await page.screenshot({ path: 'test-results/m10-moves.png' });

  // A status shows Essentials' status icon in the foe's databox.
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    pkr.session.run.battle.enemyTeam[0].status = { id: 'par', turns: 0 };
    pkr.game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await waitForMenu(page);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').enemyBox.statusBadge.list[0].texture.key)).toBe('pack.ebdx.status');

  // Smaller and narrow windows still fit the whole 960×540 game.
  for (const [w, h] of [[800, 450], [480, 800]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/m10-battle-${w}x${h}.png` });
  }
  expect(errors).toEqual([]);
});

test('with battle animations off the arena has no ambience', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-still&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    (window as any).__pkr.session.settings.battleAnimations = 'off';
  });
  await startBattle(page);
  await waitForMenu(page);
  expect((await fieldKeys(page)).some((k: string) => k.startsWith('pack.'))).toBe(false);
  await page.keyboard.press('Enter');
  await waitForMenu(page);
  await page.keyboard.press('Enter');
  await waitForMenu(page);
  expect(errors).toEqual([]);
});

test('slice 2: the trainer VS intro can be skipped and the battle carries on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-vs&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  // Turn the wild battle into a trainer battle at a low HP foe and restart it from turn 1.
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    const run = pkr.session.run;
    run.battle.trainer = { classId: [...pkr.session.content.trainers.keys()][0], name: 'Joey' };
    run.battle.enemyTeam[0].hp = 1;
    pkr.game.scene.getScene('Battle').scene.restart();
  });
  await page.waitForTimeout(400);
  // The VS screen is up (EBDX transition art on the display list) ...
  const vsShown = await page.evaluate(() =>
    (window as any).__pkr.game.scene.getScene('Battle').children.list.some((o: any) => o.list?.some((c: any) => String(c.texture?.key).startsWith('pack.ebdx.tr.'))),
  );
  expect(vsShown).toBe(true);
  await page.screenshot({ path: 'test-results/m10-vs.png' });
  // ... and a key press skips it straight to the challenge line.
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').message.text), { timeout: 1500 })
    .toMatch(/would like to battle/);
  await waitForMenu(page);
  // Low HP: the foe's box glows.
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').enemyBox.danger))).toBe(true);
  expect(errors).toEqual([]);
});

/** True while a text with exactly this content is on the battle screen (inside any container). */
const showsText = (page: Page, text: string) =>
  page.evaluate((t) => (window as any).__pkr.game.scene.getScene('Battle').children.list.some((o: any) => o.text === t || o.list?.some((c: any) => c.text === t)), text);

const hasNamed = (page: Page, name: string) =>
  page.evaluate((n) => (window as any).__pkr.game.scene.getScene('Battle').children.list.some((o: any) => o.name === n), name);

test('slice 4: a gym leader gets a title card, an ace beat and a victory stamp', async ({ page }) => {
  test.setTimeout(150_000); // the fights play out in real time and a move can miss
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-boss&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  // Turn it into a gym battle against Brock with two weak Pokémon (the second is the ace).
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    // A fixed Normal-type foe: the random first enemy can be a Ghost that Scratch cannot hurt.
    pkr.session.debugReplaceEnemy('rattata', 5);
    const battle = pkr.session.run.battle;
    battle.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    const team = battle.enemyTeam;
    team[0].hp = 1;
    team.push({ ...structuredClone(team[0]), uid: 'm10-ace' });
    pkr.game.scene.getScene('Battle').scene.restart();
  });
  await expect.poll(() => showsText(page, 'Gym Leader Brock'), { timeout: 6000, intervals: [100] }).toBe(true);
  await page.screenshot({ path: 'test-results/m10-boss-title.png' });
  // Catalog 67: this seed's first stage is The Chemical Plant, so lab light panels hang behind the battle.
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').field.list.some((o: any) => o.name === 'env-lab'))).toBe(true);
  await waitForMenu(page);
  // Knock out the first Pokémon: the ace comes out with its stamp.
  // A move can miss, so attack (first move, Enter twice) until the banner shows.
  const attackUntil = async (text: string) => {
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      // Wait for the banner; if the command menu comes back first, the move missed: attack again.
      for (let t = 0; t < 150; t++) {
        if (await showsText(page, text)) return;
        if (await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle')?.menu))) break;
        await page.waitForTimeout(100);
      }
    }
  };
  await attackUntil('ACE!');
  expect(await showsText(page, 'ACE!')).toBe(true);
  await waitForMenu(page);
  await attackUntil('VICTORY!');
  expect(await showsText(page, 'VICTORY!')).toBe(true);
  await page.screenshot({ path: 'test-results/m10-victory.png' });
  // Catalog 91: the boss victory card with its Chronicle stamp follows the stamp.
  const victoryTexts = () =>
    page.evaluate(() => {
      const out: string[] = [];
      const walk = (o: any) => (typeof o.text === 'string' && out.push(o.text), o.list?.forEach(walk));
      (window as any).__pkr.game.scene.getScene('Battle').children.list.filter((o: any) => o.name === 'boss-victory').forEach(walk);
      return out;
    });
  await expect.poll(async () => (await victoryTexts()).includes('Gym Leader Brock defeated!'), { timeout: 8000, intervals: [100] }).toBe(true);
  expect((await victoryTexts()).some((t) => t.startsWith('Chronicle · Turn'))).toBe(true);
  await page.screenshot({ path: 'test-results/m10-boss-victory.png' });
  expect(errors).toEqual([]);
});

test('the map has drifting ambience, and the Bond screen shows each Pokémon’s mood and bond bars', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=visual-bond');
  await waitForScene(page, 'MainMenu');
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
  // Slice 6: the map has the stage's ambience (pack art) drifting behind it.
  const mapKeys: string[] = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).map((o: any) => o.texture?.key ?? '');
  });
  expect(mapKeys.some((k) => k.startsWith('pack.'))).toBe(true);
  await page.screenshot({ path: 'test-results/m10-map.png' });
  await page.evaluate(() => {
    const map = (window as any).__pkr.game.scene.getScene('Map');
    map.activate(map.options.findIndex((o: any) => o.kind === 'bond'));
  });
  await page.waitForTimeout(1200);
  const texts: string[] = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
  });
  expect(texts.some((t) => t.startsWith('Bonds:'))).toBe(true);
  for (const label of ['Trust', 'Affection', 'Sync', 'Strain']) expect(texts).toContain(label);
  expect(texts.some((t) => ['Wary', 'Steady', 'Devoted'].includes(t))).toBe(true);
  await page.screenshot({ path: 'test-results/m10-bond-screen.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('Map');
  // Slice 9: the Summary shows each Pokémon's info & stats page and its moves & story page.
  await page.evaluate(() => {
    const map = (window as any).__pkr.game.scene.getScene('Map');
    map.activate(map.options.findIndex((o: any) => o.kind === 'summary'));
  });
  await page.waitForTimeout(1000);
  const summary: string[] = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
  });
  for (const label of ['Ability', 'Holding', 'Moves', 'This run', 'Sp. Atk', 'Speed']) expect(summary).toContain(label);
  await page.screenshot({ path: 'test-results/m10-summary.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await scene(page)).toBe('Map');
  expect(errors).toEqual([]);
});

test('slice 7: a Totem fight shows a NEW PHASE banner with its rule', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=totem-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  for (const next of ['TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'totem-m10', kind: 'totem', totemId: 'totem-lurantis', used: false });
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openTotem('totem-m10'));
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  let seen = false;
  for (let i = 0; i < 120 && !seen; i++) {
    seen = await hasNamed(page, 'phase-banner');
    if (seen) break;
    if (await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').menu))) await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  expect(seen).toBe(true);
  await page.screenshot({ path: 'test-results/m10-phase-banner.png' });
  expect(errors).toEqual([]);
});

test('slice 7: a trainer line shows in a speech bubble that goes away with the line', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-speech');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  await page.evaluate(() => {
    const battle = (window as any).__pkr.game.scene.getScene('Battle');
    void battle.sayTrainer({ at: 0, speaker: 'Youngster Joey', text: 'My Rattata is in the top percentage!', category: 'taunt', tier: 'common', voice: 'cocky', eventId: 'm10' });
  });
  await expect.poll(() => hasNamed(page, 'speech-bubble'), { timeout: 3000, intervals: [100] }).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/m10-speech.png' });
  await page.keyboard.press('Enter');
  await expect.poll(() => hasNamed(page, 'speech-bubble'), { timeout: 3000, intervals: [100] }).toBe(false);
  expect(errors).toEqual([]);
});

test('the Hall of Fame shows records, champion teams with epitaphs, shinies and Legacy Cards', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    const base = { endedAt: '2026-10-30T12:00:00Z', seed: 'hof', archetypeId: 'red', campaignId: 'kanto', regionsCleared: 1, regions: 1, defeatedBy: null, bankCredits: 0, researchPoints: 0, achievements: [], moments: [], journal: [] };
    pkr.session.profile.runHistory = [
      { ...base, runId: 'hof-1', victory: true, badges: 8, encounters: 42, party: [{ speciesId: 'pikachu', level: 55, shiny: true }, { speciesId: 'onix', level: 52, shiny: false }], epitaph: 'Pikachu, The Unbroken, carried this journey: held on at 1 HP against the Champion.', legacy: [{ speciesId: 'pikachu', level: 55, shiny: true, titles: ['The Unbroken'], tags: ['Run Ace'], signature: 'Held on at 1 HP against the Champion' }] },
    ];
    pkr.game.scene.getScene('Hub').scene.start('HallOfFame');
  });
  await waitForScene(page, 'HallOfFame');
  await page.waitForTimeout(800);
  const texts: string[] = await page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('HallOfFame').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
  });
  expect(texts).toContain('Hall of Fame');
  expect(texts.some((t) => t.startsWith('♛ Champion team'))).toBe(true);
  expect(texts.some((t) => t.includes('carried this journey'))).toBe(true);
  expect(texts.some((t) => t.includes('The Unbroken'))).toBe(true);
  expect(texts).toContain('✦ Rare forms');
  await page.screenshot({ path: 'test-results/m10-hall-of-fame.png' });
  await page.keyboard.press('Escape');
  await waitForScene(page, 'Hub');
  expect(errors).toEqual([]);
});

test('slice 10: a Pokémon evolves after battle with the light-pulse sequence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-evolve&debug=1');
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  // Charmander one experience point short of level 16 (it evolves at 16), leading.
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('charmander', 15);
    session.run.party.unshift(session.run.party.pop());
    session.run.party[0].xp = 2534;
    // The level cap (stage and region) would stop the experience short of level 16.
    session.run.regionIndex = 3;
    if (session.run.stage) session.run.stage.kind = 'rest';
    // A sure damaging move first (its learnset may start with a status move).
    session.run.party[0].moves = [{ id: 'scratch', pp: 35 }];
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const pkr = (window as any).__pkr;
    pkr.session.debugReplaceEnemy('rattata', 5);
    pkr.session.run.battle.enemyTeam[0].hp = 1;
    pkr.game.scene.getScene('Battle').scene.restart();
  });
  const evolving = () => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle')?.children.list.some((c: any) => c.name === 'cine-evolve') ?? false);
  let seen = false;
  for (let i = 0; i < 8 && !seen; i++) {
    await waitForMenu(page).catch(() => undefined);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    for (let t = 0; t < 120 && !seen; t++) {
      seen = await evolving();
      if (!seen && (await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle')?.menu)))) break;
      // Move the post-battle lines along until the evolution starts.
      if (!seen && t % 10 === 9) await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
  }
  expect(seen).toBe(true);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/m10-evolution.png' });
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run.party[0].speciesId), { timeout: 10_000 }).toBe('charmeleon');
  expect(errors).toEqual([]);
});

test('catalog 107: a gold-mastered move plays its mastery flourish', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=m10-mastery&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const lead = session.run.party[session.run.battle.activeIndex];
    lead.moves = [{ id: 'tackle', pp: 35 }];
    session.profile.moveUses = { ...(session.profile.moveUses ?? {}), tackle: 100 };
  });
  // Watch for the gold sparks while the move plays.
  await page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScene('Battle');
    (window as any).__sawMastery = false;
    scene.events.on('postupdate', () => {
      if (scene.children.list.some((o: any) => o.name === 'mastery-gold')) (window as any).__sawMastery = true;
    });
  });
  await page.keyboard.press('Enter'); // Fight
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); // Tackle
  await expect.poll(() => page.evaluate(() => (window as any).__sawMastery), { timeout: 15_000 }).toBe(true);
  expect(errors).toEqual([]);
});
