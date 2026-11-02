import { expect, test, type Page } from '@playwright/test';

// Milestone 5.5 in a real browser: buying a license in the Bank, unlocking a
// starter pool in the Starter Laboratory, the Preparation Desk (pool, draft
// rule, preset), the Blind Draft, and the campaign briefing.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const profile = (page: Page) => page.evaluate(() => (window as any).__pkr.session.profile);
const prepFocus = (page: Page) => page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').focusIndex as number);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

/** Moves the Preparation Desk cursor to a row (0 = Roll starters). */
async function prepRow(page: Page, row: number) {
  for (let i = 0; i < 20 && (await prepFocus(page)) !== row; i++) {
    await page.keyboard.press((await prepFocus(page)) < row ? 'ArrowDown' : 'ArrowUp');
  }
  expect(await prepFocus(page)).toBe(row);
}

/** Opens a Preparation Desk page (0 Run Setup, 1 Trainer, 2 Starters, 3 Modifiers, 4 Overview) and waits for it. */
async function prepPage(page: Page, n: number) {
  await page.evaluate((i) => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(i), n);
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').page), { timeout: 5_000 }).toBe(n);
  await page.waitForTimeout(400);
}

/** The row whose label starts with `text` (rows move when a new one is added). */
const prepRowOf = (page: Page, text: string) =>
  page.evaluate((t) => (window as any).__pkr.game.scene.getScene('RunPrep').menu.config.options.findIndex((o: any) => o.label.startsWith(t)) as number, text);

async function toPrepDesk(page: Page, url: string) {
  await page.goto(url);
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); // Red
  await waitForScene(page, 'RunPrep');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('buy a license, unlock a pool, prepare a Type Focus run, save a preset, and read the briefing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-m55&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.profile.bankCredits = 1000;
    session.profile.researchPoints = 500;
    (window as any).__pkr.game.scene.getScene('Hub').scene.restart();
  });
  await waitForScene(page, 'Hub');

  // The Pokémon Bank → licenses: the first license is the Type Specialist License.
  await page.waitForTimeout(400); // the town's art loads first
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').visit('bank'));
  await page.waitForTimeout(250);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/m55-licenses.png' });
  // The Bank list starts with its services (tier, 2 exchange rows, 5 Candy Shop perks); the licenses follow.
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await profile(page)).licenses).toEqual(['type-specialist']);
  await waitForScene(page, 'Hub');

  // Starter Laboratory (in the Starter Sanctuary): Regions (the second category), then unlock Johto (its first set).
  await page.waitForTimeout(400); // the town's art loads first
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').visit('sanctuary'));
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); // Starter Laboratory
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/m55-lab-categories.png' });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/m55-lab.png' });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await profile(page)).unlockedPools).toEqual(['johto']);
  await waitForScene(page, 'Hub');
  expect((await profile(page)).researchPoints).toBe(350);

  // Preparation Desk: Johto pool, Type Focus.
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); // close the Sanctuary page the Hub reopened on
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // you still face the Run Prep Center: start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await prepPage(page, 2); // Starters
  await prepRow(page, 0);
  await page.keyboard.press('ArrowRight'); // Classic → Johto
  await waitForScene(page, 'RunPrep');
  await prepRow(page, 1);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight'); // Standard → Balanced → Blind → Type Focus
    await page.waitForTimeout(250);
  }
  const prep = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').prep);
  expect(prep.poolId).toBe('johto');
  expect(prep.draftRuleId).toBe('type-focus');
  expect(prep.typeFocus).not.toBeNull();
  await page.screenshot({ path: 'test-results/m55-prep.png' });

  // Save it in preset slot 1.
  await prepPage(page, 4); // Overview
  await prepRow(page, await prepRowOf(page, 'Save as preset'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await profile(page)).presets[0]?.poolId ?? null).toBe('johto');
  await waitForScene(page, 'RunPrep');

  await prepRow(page, 0);
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  const run = await page.evaluate(() => (window as any).__pkr.session.run);
  expect(run.prep.poolId).toBe('johto');
  expect(run.seed).toBe('e2e-m55');
  for (const id of run.starterChoices) {
    const types = await page.evaluate((s) => (window as any).__pkr.session.content.species.get(s).types, id);
    if (!run.prep.note) expect(types).toContain(prep.typeFocus);
  }
  await page.screenshot({ path: 'test-results/m55-starters.png' });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.screenshot({ path: 'test-results/m55-briefing.png' });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // Copy seed
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Briefing').status.text as string))
    .toMatch(/e2e-m55/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); // Begin
  await waitForScene(page, 'Map');
  expect((await profile(page)).lastPrep.poolId).toBe('johto');
  expect(errors).toEqual([]);
});

test('the Blind Draft hides the starters until one is chosen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toPrepDesk(page, '/?seed=e2e-blind&debug=1');
  await page.screenshot({ path: 'test-results/m55-prep-default.png' });
  await prepPage(page, 2); // Starters
  await prepRow(page, 1);
  await page.keyboard.press('ArrowRight');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('ArrowRight'); // Standard → Balanced → Blind
  await waitForScene(page, 'RunPrep');
  await prepPage(page, 4); // Overview
  await prepRow(page, 0);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  expect((await page.evaluate(() => (window as any).__pkr.session.run)).prep.draftRuleId).toBe('blind');
  await page.screenshot({ path: 'test-results/m55-blind.png' });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  expect((await page.evaluate(() => (window as any).__pkr.session.run)).party).toHaveLength(1);
  expect(errors).toEqual([]);
});
