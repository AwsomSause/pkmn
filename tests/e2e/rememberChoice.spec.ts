import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Overhaul slice 6: the move menu starts on the move you used last, and the setting turns that off.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function waitForScene(page: Page, key: string) {
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(250);
}
async function startBattle(page: Page, seed: string) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await toCommands(page);
}
// The command menu (Fight / Bag / Pokémon), not the move list: confirmToMenu's last Enter can land just as the command menu opens and
// open the move list, so step back to the commands before pressing Fight.
const onCommands = (page: Page) => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').menu?.labels?.[0]?.text === 'Fight');
async function toCommands(page: Page) {
  await confirmToMenu(page);
  await expect.poll(async () => {
    if (await onCommands(page)) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    return false;
  }, { timeout: 10_000 }).toBe(true);
}
const menuIndex = (page: Page) => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').menu?.index ?? -1);

test('the move menu returns to the move you used last, and still lets you pick another', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBattle(page, 'e2e-remember');
  await page.keyboard.press('Enter'); // Fight
  await expect.poll(() => menuIndex(page)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => menuIndex(page)).toBe(1);
  await page.keyboard.press('Enter'); // use move 2
  await toCommands(page);
  await page.keyboard.press('Enter'); // Fight again
  await expect.poll(() => menuIndex(page)).toBe(1);
  await page.keyboard.press('ArrowLeft'); // free to choose differently
  await expect.poll(() => menuIndex(page)).toBe(0);
  expect(errors).toEqual([]);
});
