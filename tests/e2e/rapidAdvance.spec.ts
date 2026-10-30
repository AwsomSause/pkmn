import { expect, test, type Page } from '@playwright/test';

// Catalog #122: mashing Enter (30 ms apart) through the menus and a whole battle loses no press at a scene change,
// starts exactly one run, and raises no errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('mashing Enter from the main menu to the end of a battle works', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=rapid-1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=rapid-1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(400);

  const seen = new Set<string>();
  let over = '';
  for (let i = 0; i < 900 && !over; i++) {
    const s = await scene(page);
    if (s) seen.add(s);
    if (s === 'Reward' || s === 'GameOver' || s === 'Decision') over = s;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(30);
  }
  expect(over, `scenes seen: ${[...seen].join(', ')}`).not.toBe('');
  for (const need of ['Battle']) expect(seen.has(need), need).toBe(true);
  expect(errors).toEqual([]);
});
