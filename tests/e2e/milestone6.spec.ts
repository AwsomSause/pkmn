import { expect, test, type Page } from '@playwright/test';

// Milestone 6 in a real browser: Pokémon art is loaded on demand (a Gen 7
// regional form shows its real sprite in battle), and an evolution stone from
// the Bag evolves a Pokémon, with a choice when there are several results.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const run = (page: Page) => page.evaluate(() => (window as any).__pkr.session.run);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function mapReady(page: Page) {
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter'); // Begin the run
  await mapReady(page);
}

/** Opens the map's Bag (the last option) with the keyboard. */
async function openBag(page: Page) {
  const bag = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').options.findIndex((o: any) => o.kind === 'bag') as number);
  for (let i = 0; i < bag; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Pokémon art is loaded when a screen needs it, not at start-up', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-lazy');
  const loadedAtStart = await page.evaluate(() =>
    (window as any).__pkr.game.textures.getTextureKeys().filter((k: string) => k.startsWith('pokemon.front.')).length,
  );
  // Only the starter choices' sprites and the few Pokémon shown off on the title
  // screen and the Hub (one, plus one per Hub tile; the Hub has grown by a tile) have been needed so far (there are over 1,200).
  expect(loadedAtStart).toBeLessThanOrEqual(3 + 1 + 6);

  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugReplaceEnemy('rattata-alola', 4);
    (window as any).__pkr.game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  // Alolan Rattata's sprite (PokeRogue file 2019) is drawn as a real sprite, not a placeholder.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = (window as any).__pkr.game.scene.getScene('Battle');
          const sprite = s.enemySprite;
          const key = sprite?.texture?.key ?? sprite?.list?.find((c: any) => c.texture)?.texture?.key;
          return key ?? null;
        }),
      { timeout: 10_000 },
    )
    .toBe('pokemon.front.2019');
  await page.screenshot({ path: 'test-results/m6-alolan-rattata.png' });
  expect(errors).toEqual([]);
});

test('an evolution stone from the Bag evolves a Pokémon; Eevee asks which evolution', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-stone');

  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('eevee', 20);
    session.run.party.splice(0, 1); // Eevee alone
    session.run.inventory = { 'water-stone': 1, 'soothe-bell': 1 };
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ notice: 'test' });
  });
  await mapReady(page);

  // Bag → Soothe Bell (second row) → Eevee → choose the second result (Umbreon).
  await openBag(page);
  await page.keyboard.press('ArrowDown'); // one column: Down reaches the second row (Left/Right switch pockets)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // Eevee
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/m6-evolution-choice.png' });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await run(page)).party[0].speciesId, { timeout: 5000 }).toBe('umbreon');
  expect((await run(page)).inventory['soothe-bell']).toBeUndefined();

  // The Water Stone now does nothing for Umbreon.
  await mapReady(page);
  await openBag(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect((await run(page)).inventory['water-stone']).toBe(1);
  expect(errors).toEqual([]);
});
