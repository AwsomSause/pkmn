import { expect, test, type Page } from '@playwright/test';

// Research Room: a set opens its Pokédex list, and Enter on a species opens its page on the UIE Dex art.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

test('Pokédex list and species page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=dex-page');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.profile.speciesCaught.push('bulbasaur');
    session.profile.speciesSeen.push('bulbasaur');
    game.scene.getScene('Hub').openResearch();
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); // first set: Generation 1
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/dex-list.png' });
  await page.keyboard.press('ArrowRight'); // the first row is the tab switcher; Bulbasaur sits beside it
  await page.keyboard.press('Enter'); // first species: Bulbasaur
  await page.waitForTimeout(1500);
  const open = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').children.list.some((o: any) => o.name === 'dex-info'));
  expect(open).toBe(true);
  await page.screenshot({ path: 'test-results/dex-page.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').children.list.some((o: any) => o.name === 'dex-info'))).toBe(false);
  expect(errors).toEqual([]);
});
