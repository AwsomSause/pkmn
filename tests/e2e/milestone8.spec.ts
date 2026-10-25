import { expect, test, type Page } from '@playwright/test';

// Milestone 8 in a real browser: the director's custom forms are drawn with
// their converted sprites (a Delta Pokémon as the enemy, a Spooky form as the
// player's), and the party screen shows their icons.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

const textureOf = (page: Page, field: 'enemySprite' | 'playerSprite') =>
  page.evaluate((f) => {
    const sprite = (window as any).__pkr.game.scene.getScene('Battle')[f];
    return sprite?.texture?.key ?? sprite?.list?.find((c: any) => c.texture)?.texture?.key ?? null;
  }, field);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('custom forms are drawn with their own sprites in battle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-custom');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('chandelure-spooky', 40);
    session.run.party.unshift(session.run.party.pop());
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    (window as any).__pkr.session.debugReplaceEnemy('venusaur-delta', 40);
    (window as any).__pkr.game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => textureOf(page, 'enemySprite'), { timeout: 10_000 }).toBe('pokemon.front.custom/venusaur-delta');
  await expect.poll(() => textureOf(page, 'playerSprite'), { timeout: 10_000 }).toBe('pokemon.back.custom/chandelure-spooky');
  await page.screenshot({ path: 'test-results/m8-custom-battle.png' });
  expect(errors).toEqual([]);
});
