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
  const has = () => page.evaluate(() => (window as any).__pkr.game.scene.getScene('MainMenu').children.list.some((o: any) => o.name === 'options-bg'));
  expect(await has()).toBe(false);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.restart({ page: 'settings' }));
  await page.waitForTimeout(1200);
  expect(await has()).toBe(true);
  await page.screenshot({ path: 'test-results/options-backdrop.png' });
  expect(errors).toEqual([]);
});
