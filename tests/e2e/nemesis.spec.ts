import { expect, test, type Page } from '@playwright/test';
import { confirmUntil } from './battleInput';

// Nemesis system (left-out plan 1.3) in a real browser: a wild nemesis takes a
// wild node of a later stage and its intro tells what changed.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('a wild nemesis comes back, telegraphed in the battle intro', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-nemesis-1');
    session.chooseStarter(0);
    const run = session.run;
    run.encountersCompleted = 10;
    run.story.nemeses.push({
      id: 'nemesis-0-9-1', speciesId: 'rattata', level: 5, source: 'wild', trainer: null, archetype: 'stalker', cause: 'starterKo', phase: 'return',
      formedAt: { region: 0, stage: 9, level: 3, node: null, battle: 1, turn: 2 }, lastMet: { region: 0, stage: 9 }, beat: ['charmander'], foeTypes: ['fire'],
      wins: 0, changes: [], partner: null, settledAs: null,
    });
    const first = run.stage.map.nodes.filter((n: any) => n.column === 1)[0];
    first.kind = 'wild';
    session.chooseNode(first.id);
    game.scene.getScenes(true)[0].scene.start('Battle');
  });
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Battle');
  const texts = () =>
    page.evaluate(() => {
      const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
      return (window as any).__pkr.game.scene.getScene('Battle').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text as string);
    });
  await confirmUntil(page, async () => (await texts()).some((t: string) => t.includes('Your nemesis returns')));
  await page.screenshot({ path: 'test-results/nemesis-return.png' });
  expect(await page.evaluate(() => (window as any).__pkr.session.run.battle.nemesis)).toBe('nemesis-0-9-1');
  expect(errors).toEqual([]);
});
