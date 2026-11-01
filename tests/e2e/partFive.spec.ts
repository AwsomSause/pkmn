import { expect, test, type Page } from '@playwright/test';

// Plan Part 5 extras: the Wardrobe in the Hub (titles and card frames), and the Research Directive
// and Challenge Contracts on the Preparation Desk, carried into the briefing.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

const texts = (page: Page, key: string) =>
  page.evaluate((key) => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene(key).children.list) walk(o);
    return out.join('\n');
  }, key);

test('the Wardrobe, the Research Directive and a Challenge Contract', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=part5-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');

  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').openWardrobe();
  });
  await page.waitForTimeout(500);
  const wardrobe = await texts(page, 'Hub');
  expect(wardrobe).toContain('Frame: Classic');
  expect(wardrobe).toContain('Catch 30 different species');
  await page.screenshot({ path: 'test-results/wardrobe.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  // Research Directive is on the Trainer page (trainer, Preparation, then Research Directive): pick the first type with →.
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(1));
  await page.waitForTimeout(500);
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect(await texts(page, 'RunPrep')).toContain('Research Directive: Normal');
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(4)); // the full summary is on the Overview
  await page.waitForTimeout(500);
  const prep = await texts(page, 'RunPrep');
  expect(prep).toContain('defeat or catch 12 Normal-types');
  await page.screenshot({ path: 'test-results/run-prep-directive.png' });
  await page.evaluate(() => {
    const s = (window as any).__pkr.game.scene.getScene('RunPrep');
    s.rules = { ...s.rules, modifierIds: ['no-battle-items'] };
    s.start();
  });
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  const briefing = await texts(page, 'Briefing');
  expect(briefing).toContain('Research Directive');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.rules.modifierIds)).toContain('no-battle-items');
  expect(errors).toEqual([]);
});
