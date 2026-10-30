import { expect, test, type Page } from '@playwright/test';

// Trainer sorting: Tab on the trainer screen changes the sort, and the choice is remembered.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function waitForScene(page: Page, key: string) {
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(key);
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

test('trainers can be sorted and the sort is remembered', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=sort-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  await waitForScene(page, 'TrainerSelect');
  expect(await texts(page, 'TrainerSelect')).toContain('Sort: Default');
  await page.keyboard.press('Tab'); // Game
  await page.waitForTimeout(300);
  expect(await texts(page, 'TrainerSelect')).toContain('Sort: Game ▲');
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  expect(await texts(page, 'TrainerSelect')).toContain('Sort: Game ▼');
  await page.screenshot({ path: 'test-results/trainer-sort.png' });
  // Leave and come back: the sort stays.
  await page.keyboard.press('Escape');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  await waitForScene(page, 'TrainerSelect');
  expect(await texts(page, 'TrainerSelect')).toContain('Sort: Game ▼');
  expect(errors).toEqual([]);
});
