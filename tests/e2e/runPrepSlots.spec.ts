import { expect, test, type Page } from '@playwright/test';

// The reworked Preparation Desk (five pages, Weeks toggle) and the three save slots (Continue, Save Slots screen).

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const prep = async (page: Page) => ({ page: await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').page as number) });

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the Preparation Desk has five pages and a Weeks toggle that sticks for the run', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-weeks&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').page)).toBe(4); // opens on the Overview

  for (const [key, want] of [['KeyQ', 3], ['KeyQ', 2], ['KeyQ', 1], ['KeyQ', 0], ['KeyE', 1]] as const) {
    await page.keyboard.press(key);
    await expect.poll(async () => (await prep(page)).page).toBe(want);
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(0));
  await expect.poll(async () => (await prep(page)).page).toBe(0);
  await page.waitForTimeout(400);
  const labels = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').menu.config.options.map((o: any) => o.label));
  expect(labels).toContain('Weeks: ON (default)');
  const weeksRow = labels.indexOf('Weeks: ON (default)');
  for (let i = 0; i < 10 && (await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').focusIndex)) !== weeksRow; i++) await page.keyboard.press('ArrowDown'); // skips the disabled region row
  await page.keyboard.press('ArrowRight'); // turn Weeks off
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').rules.weeks)).toBe(false);
  await page.screenshot({ path: 'test-results/prep-weeks-off.png' });

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(4));
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); // Roll starters
  await waitForScene(page, 'StarterSelect');
  const rules = await page.evaluate(() => ({ weeks: (window as any).__pkr.session.run.rules.weeks, events: (window as any).__pkr.session.run.gameEvents }));
  expect(rules).toEqual({ weeks: false, events: [] });
  expect(errors).toEqual([]);
});

test('Continue and Save Slots: slots keep separate runs and Continue picks the latest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-slots&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.newRun('red', 'slot-one-run');
    session.chooseStarter(0);
  });
  await page.reload();
  await waitForScene(page, 'MainMenu');
  const labels = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('MainMenu').menu.config.options.map((o: any) => o.label));
  expect(labels).toEqual(['Continue (Slot 1)', 'Enter the Hub', 'New Run', 'Save Slots', 'Settings']);

  await page.evaluate(() => { (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('SaveSlots'); });
  await waitForScene(page, 'SaveSlots');
  const cards = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('SaveSlots').cards.map((c: any) => c.status));
  expect(cards).toEqual(['active', 'empty', 'empty']);
  await page.screenshot({ path: 'test-results/save-slots.png' });

  // Slot 2 is empty: choosing it opens the Hub there, with its own profile.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  expect(await page.evaluate(() => ({ slot: (window as any).__pkr.session.slot, started: (window as any).__pkr.session.profile.stats.runsStarted }))).toEqual({ slot: 2, started: 0 });
  expect(await page.evaluate(() => localStorage.getItem('pkr.slot'))).toBe('2');

  // After a reload the title opens on slot 2, and Continue still finds the run in slot 1.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  expect(await page.evaluate(() => (window as any).__pkr.session.slot)).toBe(2);
  await page.keyboard.press('Enter'); // Continue
  await waitForScene(page, 'Map');
  expect(await page.evaluate(() => ({ slot: (window as any).__pkr.session.slot, seed: (window as any).__pkr.session.run.seed }))).toEqual({ slot: 1, seed: 'slot-one-run' });
  expect(errors).toEqual([]);
});
