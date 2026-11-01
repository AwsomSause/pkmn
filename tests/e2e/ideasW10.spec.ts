import { expect, test, type Page } from '@playwright/test';

// Ideas W10: the Hub Corner Nook lists the fortune cookie, wish, note, poster code and donation drive; no console errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

const texts = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene('Hub').children.list) walk(o);
    return out.join('\n');
  });

test('the Hub Corner Nook shows its five things', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=w10-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').openLegacy('nook'));
  await page.waitForTimeout(600);
  const shown = await texts(page);
  expect(shown).toContain('Corner Nook');
  expect(shown).toContain("Crack today's fortune cookie");
  expect(shown).toContain('Wish upon the star');
  expect(shown).toContain('Write a note to your future self');
  expect(shown).toContain('Enter a poster code');
  expect(shown).toContain('Donation drive: 0/100');
  await page.screenshot({ path: 'test-results/nook-hub.png' });
  expect(errors).toEqual([]);
});
