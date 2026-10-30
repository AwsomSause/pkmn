import { expect, test, type Page } from '@playwright/test';

// Trainer quests: the Hub lists every trainer's quest line and its steps; the briefing shows the Run Quest
// and the next quest step.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

const texts = (page: Page, key: string) =>
  page.evaluate((key) => (window as any).__pkr.game.scene.getScene(key).children.list.filter((o: any) => typeof o.text === 'string').map((o: any) => o.text).join('\n'), key);

test('the Hub shows quest lines and the briefing shows the Run Quest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=quests-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').openQuests());
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/quests-hub.png' });
  await page.keyboard.press('Enter'); // the first trainer's steps
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/quests-line.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  for (const at of ['TrainerSelect', 'RunPrep', 'StarterSelect']) {
    await waitForScene(page, at);
    await page.keyboard.press('Enter');
  }
  await waitForScene(page, 'Briefing');
  const briefing = await texts(page, 'Briefing');
  expect(briefing).toContain('Run Quest');
  expect(briefing).toContain('step 1/5');
  await page.screenshot({ path: 'test-results/quests-briefing.png' });
  expect(errors).toEqual([]);
});
