import { expect, test } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Left-out 2.9 / 6.7: the Essentials Kit battle UI draws name and level plates of its own and shows the EXP strip.
// Saves a screenshot to test-results/visual/ for a look; fails on console errors or a battle that won't open.

const scene = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('Essentials Kit battle UI shows plates, names, levels and the EXP strip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=kit-plates&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.saveSettings({ ...session.settings, battleUi: 'kit' });
  });
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Battle');
  await confirmToMenu(page);
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const b = (window as any).__pkr.game.scene.getScene('Battle');
    return { level: b.playerBox.level.text as string, name: b.playerBox.name.text as string, hasXp: Boolean(b.playerBox.xpBar), foeLevel: b.enemyBox.level.text as string };
  });
  expect(info.level).toMatch(/^Lv\d+$/);
  expect(info.foeLevel).toMatch(/^Lv\d+$/);
  expect(info.name.length).toBeGreaterThan(0);
  expect(info.hasXp).toBe(true);
  await page.screenshot({ path: 'test-results/visual/kit-battle.png' });
  expect(errors).toEqual([]);
});
