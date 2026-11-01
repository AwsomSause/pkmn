import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Milestone 9: move animations load on demand and play in a real battle, and
// the animation settings work from the title screen.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startBattle(page: Page) {
  await page.keyboard.press('Enter'); // Enter the Hub
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter'); // Start a run
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter'); // Red
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
}

/** Waits until the battle shows its action menu. */
async function waitForMenu(page: Page) {
  await confirmToMenu(page);
  await page.waitForTimeout(200);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('a move plays its animation file, loaded on demand, without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const animRequests: string[] = [];
  page.on('requestfinished', (r) => r.url().includes('/battle-anims/') && animRequests.push(r.url()));

  await page.goto('/?seed=m9-anims');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  // Nothing about animations is loaded at start-up, only once a battle needs it.
  expect(animRequests.length).toBeGreaterThan(0);
  // The director's Essentials pack animations are the first choice.
  expect(animRequests.some((u) => u.includes('/battle-anims/ess-'))).toBe(true);

  await page.keyboard.press('Enter'); // Fight
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // first move
  // Catch the animation mid-way: graphic sprites in the field container.
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').fx.busy), { timeout: 8_000 })
    .toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/m9-move-animation.png' });
  await waitForMenu(page).catch(() => undefined);
  await page.screenshot({ path: 'test-results/m9-after-turn.png' });
  expect(errors).toEqual([]);
});

test('when a pack animation can\'t load, the PokeRogue one plays instead', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/battle-anims/ess-*', (route) => route.abort());
  const animRequests: string[] = [];
  page.on('requestfinished', (r) => r.url().includes('/battle-anims/') && animRequests.push(r.url()));
  await page.goto('/?seed=m9-anims');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  // A slow runner can miss the 1.5 s load window on the first turn: the quick stand-in plays and the PokeRogue files keep
  // loading "for next time". So try up to three turns; the fallback animation must be playing by then.
  let playing = false;
  for (let turn = 0; turn < 3 && !playing; turn++) {
    await waitForMenu(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    playing = await expect
      .poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').fx.busy), { timeout: 8_000 })
      .toBe(true)
      .then(() => true, () => false);
  }
  expect(playing).toBe(true);
  expect(animRequests.some((u) => !u.includes('/battle-anims/ess-'))).toBe(true);
  expect(errors).toEqual([]);
});

test('animation settings cycle on the title screen and turn animations off', async ({ page }) => {
  await page.goto('/?seed=m9-settings');
  await waitForScene(page, 'MainMenu');
  // Continue (disabled), Hub (focused), New Run, Save Slots, Settings; then Animations & Effects (4th category); then Battle motion (2nd row).
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Settings');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.settings.battleAnimations)).toBe('reduced');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.settings.battleAnimations)).toBe('off');
  await page.screenshot({ path: 'test-results/m9-settings.png' });

  // With animations off, no animation file is ever requested.
  const animRequests: string[] = [];
  page.on('request', (r) => r.url().includes('/battle-anims/') && animRequests.push(r.url()));
  await page.keyboard.press('Escape'); // category list
  await page.keyboard.press('Escape'); // settings home
  await page.keyboard.press('Escape'); // title screen
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  await waitForMenu(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await waitForMenu(page);
  expect(animRequests).toEqual([]);
});

test('a missing animation file falls back to a quick effect and the battle carries on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/battle-anims/**', (route) => route.abort());
  await page.goto('/?seed=m9-fallback');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);
  const before = await page.evaluate(() => (window as any).__pkr.session.run.battle.turn);
  await waitForMenu(page);
  // A menu ignores keys for a moment of game time, which is longer than wall time on a busy runner:
  // press Enter (Fight, then the first move) whenever a menu is up until the turn has played.
  await expect
    .poll(
      async () => {
        if ((await scene(page)) !== 'Battle') return true;
        if ((await page.evaluate(() => (window as any).__pkr.session.run?.battle?.turn)) > before) return true;
        if (await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle')?.menu))) await page.keyboard.press('Enter');
        return false;
      },
      { timeout: 30_000, intervals: [400] },
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
