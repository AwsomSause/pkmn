import { expect, test, type Page } from '@playwright/test';

// Ideas W5: the Hub "Tales & News" room lists the paper, found lore and hidden lore; no console errors.

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

test('the Hub Tales & News room shows the paper, found lore and ??? for the rest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=w5-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.evaluate(() => {
    const s = (window as any).__pkr.session;
    s.profile.npcMemory = { ...s.profile.npcMemory, news: ['CHAMPION CROWNED: a test headline.'], lore: ['first-ember'] };
    (window as any).__pkr.game.scene.getScene('Hub').openTales();
  });
  await page.waitForTimeout(600);
  const shown = await texts(page);
  expect(shown).toContain('Tales & News');
  expect(shown).toContain("Today's Paper");
  expect(shown).toContain('The First Ember');
  expect(shown).toContain('???');
  await page.screenshot({ path: 'test-results/tales-hub.png' });
  expect(errors).toEqual([]);
});
