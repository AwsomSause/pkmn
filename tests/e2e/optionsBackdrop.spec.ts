import { expect, test, type Page } from '@playwright/test';

// The title screen's Settings page sits on the UIE Options backdrop.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('the Settings page shows the Options backdrop', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=options-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(800);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('Settings', { from: 'MainMenu' }));
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Settings');
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Settings').children.list.some((o: any) => o.name === 'options-bg'))).toBe(true);
  // Open Animations & Effects (4th row) and flip "Disable all animations", then back out.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.session?.settings?.disableAllAnimations ?? true)).toBe(true);
  await page.screenshot({ path: 'test-results/options-backdrop.png' });
  expect(errors).toEqual([]);
});
