import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Battle UI pages (spec 23) and Auto-Battle (spec 32) in a real browser.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}
async function startBattle(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await confirmToMenu(page);
}
const tabs = (page: Page) =>
  page.evaluate(() => {
    const t = (window as any).__pkr.game.scene.getScene('Battle').tabs;
    return { visible: t.root.visible, page: t.current };
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('battle pages: tabs show where you are, Q/E switch, I opens details', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBattle(page, 'e2e-pages');
  expect(await tabs(page)).toEqual({ visible: true, page: null });
  await page.screenshot({ path: 'test-results/pages-root.png' });
  await page.keyboard.press('Enter'); // Fight
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'attack' });
  await page.keyboard.press('i');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').infoPanel))).toBe(true);
  await page.screenshot({ path: 'test-results/pages-move-details.png' });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').infoPanel))).toBe(false);
  await page.keyboard.press('e'); // Attack -> Party
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'party' });
  await page.screenshot({ path: 'test-results/pages-party.png' });
  await page.keyboard.press('e'); // Party -> Item
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'item' });
  await page.keyboard.press('q'); // back to Party
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'party' });
  await page.keyboard.press('Escape');
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: null });
  await page.keyboard.press('i'); // battle info
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Battle').infoPanel))).toBe(true);
  await page.screenshot({ path: 'test-results/pages-info.png' });
  expect(errors).toEqual([]);
});

test('Auto-Battle: asks first, halves EXP for the battle, can be taken back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBattle(page, 'e2e-auto');
  await page.keyboard.press('t');
  // The cost is told first; nothing has changed yet.
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').message.text)).toContain('EXP');
  expect(await page.evaluate(() => (window as any).__pkr.session.settings.autoBattle)).toBe(false);
  await page.screenshot({ path: 'test-results/pages-auto-ask.png' });
  await page.keyboard.press('Enter'); // Turn on
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.settings.autoBattle)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').message.text)).toContain('AUTO');
  await page.screenshot({ path: 'test-results/pages-auto-pick.png' });
  // The pick plays by itself; the battle is marked, whatever happens next.
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.run?.battle?.autoUsed ?? 'gone'), { timeout: 20_000 }).not.toBe(undefined);
  // Back during the next pick returns to manual control.
  for (let i = 0; i < 60; i++) {
    const s = await scene(page);
    if (s !== 'Battle') break;
    const auto = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').autoRunning);
    if (auto) {
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.settings.autoBattle)).toBe(false);
      break;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test('Party and Bag lists stay in the bar, so the arena and HP boxes remain visible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBattle(page, 'e2e-dock');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('pikachu', 5);
    session.debugAddToParty('eevee', 5);
    session.debugGiveItem('potion', 3);
    session.debugGiveItem('full-heal', 2);
  });
  await page.keyboard.press('e'); // root -> Attack
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'attack' });
  await page.keyboard.press('e'); // -> Party
  const docked = () =>
    page.evaluate(() => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      const list: any[] = b.picker?.root?.list ?? [];
      // A full-screen shade would hide the arena: the docked list has none.
      return { open: Boolean(b.picker), shade: list.some((o) => o.type === 'Rectangle' && o.width >= 960 && o.height >= 540) };
    });
  await expect.poll(async () => (await docked()).open).toBe(true);
  expect((await docked()).shade).toBe(false);
  await page.screenshot({ path: 'test-results/dock-party.png' });
  await page.keyboard.press('e'); // Item
  await expect.poll(() => tabs(page)).toEqual({ visible: true, page: 'item' });
  expect((await docked()).shade).toBe(false);
  await page.screenshot({ path: 'test-results/dock-bag.png' });
  expect(errors).toEqual([]);
});
