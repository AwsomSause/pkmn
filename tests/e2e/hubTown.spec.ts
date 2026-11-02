import { expect, test, type Page } from '@playwright/test';

// Hub Town (spec 2026-11-01): you walk with the arrow keys, buildings open the Hub's rooms, the Departure Gate asks
// first, the Legacy Display shows past Trainers you can inspect, and the Strange Merchant sells into the next run's
// boon. No console errors. Screenshots go to test-results/.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const hub = (page: Page, expr: string) => page.evaluate((e) => new Function('hub', `return ${e}`)((window as any).__pkr.game.scene.getScene('Hub')), expr);

const mon = (uid: string, speciesId: string, level: number, starter = false) => ({ uid, speciesId, level, shiny: false, moves: ['tackle'], abilitySlot: 0, nature: null, held: [], starter, knockouts: 4, bossesBeaten: 1, titles: [] });
const record = (runId: string, over: Record<string, unknown> = {}) => ({
  format: 1, source: 'run', runId, endedAt: '2026-10-30T12:00:00Z', seed: runId, archetypeId: 'red', campaignId: 'full', prep: null, rules: null,
  starter: { speciesId: 'pikachu', choices: ['pikachu'] }, regionOrder: ['kanto', 'johto'], regionsCleared: ['kanto'], regionReached: 1, outcome: 'defeat',
  encounters: 44, battlesWon: 30, badges: ['brock'], bosses: { gym: 8, elite: 0, champion: 0 }, team: [mon(`${runId}-a`, 'pikachu', 41, true), mon(`${runId}-b`, 'onix', 38)],
  aceUid: `${runId}-a`, rivals: [{ id: 'rv', name: 'Blue', classId: 'youngster', archetype: 'a', state: 'contender', encounters: 4, setbacks: 1, lastResult: 'lose', resolution: null, team: ['pidgeot'], rank: 'champion', world: null, narrativeWins: 0 }],
  nemeses: [], legendaries: { seen: [], caught: [] }, defeatedBy: { speciesId: 'pidgeot', level: 45, trainer: 'Blue' }, finalBattle: { result: 'lose', speciesId: 'pidgeot', level: 45, trainer: 'Blue' },
  stats: { maxLevel: 41, survivedFatal: 0, closeCalls: 0, caught: 5, shinies: 0, rivalWins: 0 }, narrative: [], chronicle: [],
  moments: [{ kind: 'firstGym', text: 'First Gym victory: beat Brock.', speciesId: null, region: 0 }, { kind: 'runEnding', text: "The journey ended against Blue's Pidgeot (Lv 45).", speciesId: 'pidgeot', region: 1 }],
  journal: [], epitaph: 'Pikachu carried this journey.', ...over,
});

test('walk Hub Town, use the gate, inspect the Legacy Display and buy from the Strange Merchant', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.evaluate((legacyRuns) => {
    const s = (window as any).__pkr.session;
    s.changeProfile((p: any) => ({ ...p, legacyRuns, bankCredits: 3000 }));
    (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub');
  }, [record('past-1'), record('past-2', { archetypeId: 'blue', outcome: 'victory' })]);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/hubtown-spawn.png' });

  // Walking: hold Down on the north road (outside every crowd zone, so nobody is in the way) and the Pokémon moves.
  await hub(page, "hub.town.moveTo({ x: 56, y: 26, facing: 'down' })");
  const y0 = await hub(page, 'hub.town.tile().y');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(400);
  expect(await hub(page, 'hub.town.tile().y')).toBeGreaterThan(y0);

  // The crowd: trainers and Pokémon are out and about.
  expect(await hub(page, 'hub.crowd.walkers.length')).toBeGreaterThan(10);

  // The Departure Gate asks first; "not yet" (Esc) steps you back into town.
  const gate = await hub(page, "(() => { const g = hub.town.grid.map.places.find((p) => p.id === 'gate'); return g.door; })()");
  await hub(page, `hub.town.moveTo({ x: ${gate.x}, y: ${gate.y - 1}, facing: 'down' })`);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hub(page, '!!hub.picker'), { timeout: 5_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/hubtown-gate.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  expect(await hub(page, '!hub.picker')).toBe(true);
  expect(await hub(page, 'hub.town.tile().y')).toBe(gate.y - 1);

  // The Legacy Display: the first pedestal holds a past Trainer; face it and press Z for the record.
  expect(await hub(page, 'hub.rotation.current.runId')).toMatch(/^past-/);
  const pad = await hub(page, 'hub.town.grid.map.pads[0]');
  await hub(page, `hub.town.moveTo({ x: ${pad[0]}, y: ${pad[1] + 1}, facing: 'up' })`);
  await page.waitForTimeout(300);
  expect(await hub(page, "hub.children.getByName('hubtown-prompt').visible")).toBe(true);
  await page.keyboard.press('z');
  await expect.poll(() => hub(page, '!!hub.picker'), { timeout: 5_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/hubtown-legacy.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // The Strange Merchant: buy the first ware; it waits in the next run's boon and sells out for today.
  await hub(page, "hub.visit('merchant')");
  await expect.poll(() => hub(page, '!!hub.picker'), { timeout: 5_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/hubtown-merchant.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const p = (window as any).__pkr.session.profile; return { credits: p.bankCredits, boon: Object.keys(p.town?.boon?.items ?? {}).length, bought: p.hubTown.bought.length }; });
  expect(after.credits).toBeLessThan(3000);
  expect(after.boon).toBe(1);
  expect(after.bought).toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // Esc opens the menu; Walking Pokémon is there.
  await page.keyboard.press('Escape');
  await expect.poll(() => hub(page, '!!hub.section'), { timeout: 5_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/hubtown-menu.png' });
  expect(errors).toEqual([]);
});

for (const size of [{ w: 1024, h: 600 }, { w: 390, h: 844 }]) {
  test(`Hub Town fits at ${size.w}x${size.h}`, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?debug=1');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
    await page.evaluate(() => void (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub'));
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
    await page.waitForTimeout(800);
    expect(await hub(page, "!!hub.children.getByName('hubtown-player')")).toBe(true);
    await page.screenshot({ path: `test-results/hubtown-${size.w}.png` });
    expect(errors).toEqual([]);
  });
}
