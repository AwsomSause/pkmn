import { expect, test, type Page } from '@playwright/test';

// Memories (APPROVED.md §3, §7): Run Journal, Fallen Trainers, Battle Replays and Legacy Heirlooms open from the Hub's
// Memories room, read the legacy records, and choosing an heirloom survives a reload. No console errors.

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
  replays: [{ id: `${runId}:r0:s0:e5`, kind: 'gym', title: 'Gym battle against Brock', outcome: 'lose', region: 0, stage: 0, foe: { name: 'Brock', team: ['onix'] }, team: ['pikachu'], turns: 3, lines: ['T1: Pikachu used Tackle (-4); Onix used Tackle', 'T2: Pikachu fainted'] }],
  world: null,
  format: 1, source: 'run', runId, endedAt: '2026-10-30T12:00:00Z', seed: runId, archetypeId: 'red', campaignId: 'full', prep: null, rules: null,
  starter: { speciesId: 'pikachu', choices: ['pikachu'] }, regionOrder: ['kanto', 'johto'], regionsCleared: ['kanto'], regionReached: 1, outcome: 'defeat',
  encounters: 44, battlesWon: 30, badges: ['brock'], bosses: { gym: 8, elite: 0, champion: 0 }, team: [mon(`${runId}-a`, 'pikachu', 41, true), mon(`${runId}-b`, 'onix', 38)],
  aceUid: `${runId}-a`, rivals: [{ id: 'rv', name: 'Blue', classId: 'youngster', archetype: 'a', state: 'contender', encounters: 4, setbacks: 1, lastResult: 'lose', resolution: null, team: ['pidgeot'], rank: 'champion', world: null, narrativeWins: 0 }],
  nemeses: [], legendaries: { seen: [], caught: [] }, defeatedBy: { speciesId: 'pidgeot', level: 45, trainer: 'Blue' }, finalBattle: { result: 'lose', speciesId: 'pidgeot', level: 45, trainer: 'Blue' },
  stats: { maxLevel: 41, survivedFatal: 0, closeCalls: 0, caught: 5, shinies: 0, rivalWins: 0 }, narrative: [], chronicle: [],
  moments: [{ kind: 'firstGym', text: 'First Gym victory: beat Brock.', speciesId: null, region: 0 }, { kind: 'runEnding', text: "The journey ended against Blue's Pidgeot (Lv 45).", speciesId: 'pidgeot', region: 1 }],
  journal: [], epitaph: 'Pikachu carried this journey.', ...over,
});

test('Memories: journal, fallen trainers, battle replay and heirloom choice', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  const heirloom = { runId: 'past-1', speciesId: 'pikachu', name: 'Pikachu', level: 41, shiny: false, trainer: 'Red', chosen: null, spent: false, options: [{ id: 'egg', label: 'A Pikachu Egg', text: 'A Legacy Egg.' }, { id: 'item', label: 'Everstone', text: 'A keepsake.', itemId: 'everstone' }] };
  await page.evaluate(({ legacyRuns, heirloom }) => {
    const s = (window as any).__pkr.session;
    s.changeProfile((p: any) => ({ ...p, legacyRuns, memories: { heirlooms: [heirloom], claimed: [], cameos: [] } }));
    (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Memories');
  }, { legacyRuns: [record('past-1'), record('past-2', { outcome: 'victory', defeatedBy: null })], heirloom });
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Memories');
  await page.waitForTimeout(400);
  expect(await texts(page)).toContain('Run Journal');
  // Run Journal: open the newest entry.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await texts(page)).toContain('Team:');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Archive of Fallen Trainers is the fourth section, Battle Replays the fifth.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await texts(page)).toContain('Archive of Fallen Trainers');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await texts(page)).toMatch(/Final opponent: .*Pidgeot/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await texts(page)).toContain('T2: Pikachu fainted');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // Legacy Heirlooms: Enter picks an option and the pick is saved.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.session.profile.memories.heirlooms[0].chosen)).toBe('egg');
  expect(await page.evaluate(() => (window as any).__pkr.session.saves.loadOrCreateProfile(() => 'x').profile.memories.heirlooms[0].chosen)).toBe('egg');
  expect(errors).toEqual([]);
});
