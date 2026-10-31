import { expect, test, type Page } from '@playwright/test';

// Ultimate Rival presentation (left-out plan 5.6): the Story screen shows the Ultimate Rival with its emblem and
// quest chain, and Previous Ultimate Rivals from the account archive.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('the Story screen shows the Ultimate Rival, its quest, and Previous Ultimate Rivals', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-ultimate-1');
    session.chooseStarter(0);
    const run = session.run;
    const traits = { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 };
    run.story.rivals = [{
      id: 'u', classId: 'youngster', name: 'Joey', archetype: 'proud', style: 'rush', traits, rivalPotential: 20, state: 'recurring', arc: null, away: 0, cooldown: 0, progress: 0,
      encounters: 2, setbacks: 0, adaptations: [], bonds: {}, offscreen: [], origin: { eventId: 'e-u', where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'spark' },
      memory: { lastBattle: { eventId: 'x', result: 'win', hpLeftShare: 0.5, turns: 5, team: ['rattata'] } },
    }];
    run.story.flags.ultimateRival = 'u';
    run.story.flags['ultimate:ever:u'] = true;
    run.story.flags['rivalW:u'] = 1;
    session.profile.rivalArchive.push({ runId: 'old', name: 'Gary', classId: 'youngster', archetype: 'proud', style: 'rush', traits, state: 'nemesis', encounters: 4, resolution: 'good', team: ['pidgey'], ultimate: true });
    game.scene.getScenes(true)[0].scene.start('Map');
  });
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Map');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const s = (window as any).__pkr.game.scene.getScene('Map');
    s.activate(s.options.findIndex((o: any) => o.kind === 'story'));
  });
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text as string).join('\n');
    });
  await expect.poll(texts, { timeout: 5000 }).toContain('★★ Ultimate Rival');
  expect(await texts()).toContain('Previous Ultimate Rival: Youngster Gary');
  await page.screenshot({ path: 'test-results/ultimate-rival-story.png' });
  expect(errors).toEqual([]);
});
