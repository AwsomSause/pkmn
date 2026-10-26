import { expect, test, type Page } from '@playwright/test';

// Milestone 8.5 in a real browser: with the Mega Ring and Venusaurite in the
// Bag, the battle menu offers "Mega", and choosing it before a move turns
// Venusaur into Mega Venusaur on screen.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

const textureOf = (page: Page) =>
  page.evaluate(() => {
    const sprite = (window as any).__pkr.game.scene.getScene('Battle').playerSprite;
    return sprite?.texture?.key ?? sprite?.list?.find((c: any) => c.texture)?.texture?.key ?? null;
  });

const menuLabels = (page: Page) =>
  page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').menu?.config?.options?.map((o: any) => o.label) ?? null);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Mega Evolution from the battle menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-mega');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('venusaur', 50);
    session.run.party.unshift(session.run.party.pop());
    session.debugGiveItem('mega-ring', 1);
    session.debugGiveItem('venusaurite', 1);
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 60);
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => textureOf(page), { timeout: 10_000 }).toBe('pokemon.back.3');
  // Wait for the intro to reach the menu, then pick "Mega" (bottom right of the 2×2 menu).
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toEqual(['Fight', 'Bag', 'Pokémon', 'Mega: OFF']);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menuLabels(page)).toEqual(['Fight', 'Bag', 'Pokémon', 'Mega: ON']);
  await page.screenshot({ path: 'test-results/m8_5-mega-armed.png' });
  // Fight -> first move.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await expect.poll(() => textureOf(page), { timeout: 15_000 }).toBe('pokemon.back.3-mega');
  await page.screenshot({ path: 'test-results/m8_5-mega-venusaur.png' });
  expect(await page.evaluate(() => (window as any).__pkr.session.run.party[0].speciesId)).toBe('venusaur-mega');
  expect(errors).toEqual([]);
});
