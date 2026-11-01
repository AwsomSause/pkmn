import { expect, test, type Page } from '@playwright/test';

// Mentors (spec section 15) in a real browser: choose a mentor on the Preparation Desk, start the run, see the mentorship in the run.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

const prepFocus = (page: Page) => page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').focusIndex as number);
/** Moves the Preparation Desk cursor to a row (0 = Roll starters). */
async function prepRow(page: Page, row: number) {
  for (let i = 0; i < 40 && (await prepFocus(page)) !== row; i++) {
    await page.keyboard.press((await prepFocus(page)) < row ? 'ArrowDown' : 'ArrowUp');
    await page.waitForTimeout(60);
  }
  expect(await prepFocus(page)).toBe(row);
}

test('the Preparation Desk offers a mentor and the run starts with one', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=e2e-mentor&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(1)); // the Trainer page holds the Mentor row
  await waitForScene(page, 'RunPrep');
  const row = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').menu.config.options.findIndex((o: any) => o.label.startsWith('Mentor:')) as number);
  expect(row).toBeGreaterThan(0);
  await prepRow(page, row);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const prep = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').prep);
  expect(prep.mentorId).toBe('ravi-ironhand');
  await page.screenshot({ path: 'test-results/mentor-prep.png' });
  // Roll starters (Overview page), take the first one, and the run carries the mentorship.
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('RunPrep').goPage(4));
  await waitForScene(page, 'RunPrep');
  await prepRow(page, 0);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  const mentor = await page.evaluate(() => (window as any).__pkr.session.run.mentor);
  expect(mentor).toMatchObject({ id: 'ravi-ironhand', trust: 0 });
  expect(mentor.lessons).toContain('ravi-footwork');
  expect(errors).toEqual([]);
});
