import { expect, test, type Page } from '@playwright/test';

// W13: run Save / Save & Quit / Save & go back to Hub, and Settings > Game Summary.

const scene = (page: Page) => page.evaluate(() => (window as any)?.__pkr?.activeScene() ?? null);

async function toMap(page: Page, seed: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?seed=${seed}&campaign=dev&debug=1`);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(600);
}

const openSave = (page: Page) =>
  page.evaluate(() => {
    const map = (window as any).__pkr.game.scene.getScene('Map');
    map.activate(map.options.findIndex((o: any) => o.kind === 'save'));
  });

async function pickSaveRow(page: Page, row: number): Promise<void> {
  await openSave(page);
  await page.waitForTimeout(500);
  for (let i = 0; i < row; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

test('Save keeps playing; Save & Quit and Save & Hub leave a run that Continue resumes', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await toMap(page, 'w13-save');
  const runId = await page.evaluate(() => (window as any).__pkr.session.run.runId);

  // Save: stays on the map, run still live.
  await pickSaveRow(page, 0);
  await page.waitForTimeout(500);
  expect(await scene(page)).toBe('Map');
  expect(await page.evaluate(() => (window as any).__pkr.session.run !== null)).toBe(true);

  // Save & go back to Hub: Hub scene, run left in the save slot.
  await pickSaveRow(page, 2);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  expect(await page.evaluate(() => (window as any).__pkr.session.run)).toBeNull();
  expect(await page.evaluate(() => (window as any).__pkr.session.canContinue)).toBe(true);

  // Reload: Continue on the title screen resumes the same run on the map.
  await page.goto(`/?seed=w13-save&campaign=dev&debug=1`);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Map');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.runId)).toBe(runId);

  // Save & Quit: title screen, still resumable.
  await page.waitForTimeout(600);
  await pickSaveRow(page, 1);
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  expect(await page.evaluate(() => (window as any).__pkr.session.canContinue)).toBe(true);
  expect(errors).toEqual([]);
});

test('Settings > Game Summary lists topics and their entries', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=w13-summary');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(800);
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('Settings', { from: 'MainMenu' }));
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Settings');
  await page.waitForTimeout(800);
  // 8 categories, then Game Summary.
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Settings').page)).toBe('summary');
  await page.keyboard.press('ArrowDown'); // Pokémon
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Settings').picker !== null)).toBe(true);
  await page.screenshot({ path: 'test-results/w13-summary.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Settings').picker)).toBeNull();
  expect(errors).toEqual([]);
});
