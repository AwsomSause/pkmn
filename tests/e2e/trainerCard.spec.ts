import { expect, test, type Page } from '@playwright/test';

// The Hub's Trainer Card room shows the UIE card art with the player's numbers on it.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('the Trainer Card room draws the card art and stats', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=card-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('Hub').showDetail('card'));
  await page.waitForTimeout(300);
  const found = await page.evaluate(() => {
    const hub = (window as any).__pkr.game.scene.getScene('Hub');
    const items: any[] = hub.detail.list;
    return { art: items.some((o) => o.texture?.key === 'ui.trainercard'), runs: items.some((o) => typeof o.text === 'string' && o.text.startsWith('Runs ')) };
  });
  expect(found).toEqual({ art: true, runs: true });
  await page.screenshot({ path: 'test-results/trainer-card.png' });
  expect(errors).toEqual([]);
});
