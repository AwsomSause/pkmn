import { expect, test, type Page } from '@playwright/test';

// Legacy runs (M9/M18): the Hub stage shows the Legacy Rotation, the Legacy Gallery opens a past Trainer and
// Relive the Moment plays its moments, and the Hall of Fame lists a ranked rival. No console errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const texts = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const sc of (window as any).__pkr.game.scene.getScenes(true)) for (const o of sc.children.list) walk(o);
    return out.join('\n');
  });

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

test('the Legacy Rotation, the Legacy Gallery with Relive the Moment, and the Rival Hall of Fame', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  const records = [record('past-1'), record('past-2', { outcome: 'victory', defeatedBy: null, finalBattle: { result: 'win', speciesId: null, level: null, trainer: 'Lance' }, bosses: { gym: 8, elite: 4, champion: 1 } })];
  await page.evaluate((legacyRuns) => {
    const s = (window as any).__pkr.session;
    s.changeProfile((p: any) => ({ ...p, legacyRuns }));
    (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub');
  }, records);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(1200);
  // The stage shows a past Trainer and its Ace instead of a random Pokémon.
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').rotation?.current?.runId ?? null)).toMatch(/^past-/);
  expect(await texts(page)).toMatch(/Pikachu.*Lv 41/);
  // A reload of the profile keeps the records.
  expect(await page.evaluate(() => (window as any).__pkr.session.saves.loadOrCreateProfile(() => 'x').profile.legacyRuns.length)).toBe(2);

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').scene.start('LegacyGallery') && null);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('LegacyGallery');
  await page.waitForTimeout(400);
  expect(await texts(page)).toContain('Legacy Gallery');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const detail = await texts(page);
  expect(detail).toContain('Relive the Moment');
  expect(detail).toContain('Final battle and ending');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  expect(await texts(page)).toContain('First Gym victory: beat Brock.');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  expect(await texts(page)).toContain("The journey ended against Blue's Pidgeot");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('LegacyGallery').relive)).toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').scene.start('HallOfFame') && null);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('HallOfFame');
  await page.waitForTimeout(400);
  expect(await texts(page)).toContain('Rival Hall of Fame · Blue');
  expect(errors).toEqual([]);
});
