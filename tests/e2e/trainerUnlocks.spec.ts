import { expect, test, type Page } from '@playwright/test';

// Trainer unlock challenges: the Trainer Archive lists locked trainers with their own challenge and progress.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('Trainer Archive shows each locked trainer\'s own challenge', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(250);

  const data = await page.evaluate(() => {
    const a = (window as any).__pkr.session.content.archetypes.get('aaron');
    return { text: a.unlockText, tier: a.unlockTier, kind: a.unlock.kind };
  });
  expect(data.kind).toBe('all');
  expect(data.tier).toBeGreaterThan(0);
  expect(data.text).toContain('all-Bug party');

  await page.waitForTimeout(400); // the town's art loads first
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').visit('arena'));
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); // Trainer Archive
  await page.waitForTimeout(700); // progress bars spring open
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').picker !== null)).toBe(true);
  await page.screenshot({ path: 'test-results/trainer-unlocks-archive.png' });
  expect(errors).toEqual([]);
});
