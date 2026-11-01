import { expect, test, type Page } from '@playwright/test';

// Spec §24: the Wii-style cursor glides between menu options (and snaps when Menu animations are off).

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

/** The glowing cursor's y inside the Settings menu. */
const cursorY = (page: Page) =>
  page.evaluate(() => {
    const find = (list: any[]): any => {
      for (const o of list) {
        if (o.name === 'wii-cursor') return o;
        if (o.list) {
          const hit = find(o.list);
          if (hit) return hit;
        }
      }
      return null;
    };
    return find((window as any).__pkr.game.scene.getScene('Settings').children.list)?.y ?? null;
  });

async function openSettings(page: Page, settings: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 11, savedAt: '', data: { musicVolume: 0, sfxVolume: 0, muted: true, battleAnimations: 'full', effectIntensity: 1, battleSpeed: 'normal', dialogueFrequency: 'normal', ...s } }));
  }, settings);
  await page.goto('/?seed=wii-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/wii-main-menu.png' });
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('Settings', { from: 'MainMenu' }));
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Settings');
  await page.waitForTimeout(900);
}

test('the menu cursor glides with a bounce and settles on the new option', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openSettings(page, {});
  const start = await cursorY(page);
  expect(start).not.toBeNull();
  // Record the cursor's y every frame while it moves one row down.
  await page.evaluate(() => {
    const w = window as any;
    const find = (list: any[]): any => list.reduce((hit: any, o: any) => hit ?? (o.name === 'wii-cursor' ? o : o.list ? find(o.list) : null), null);
    const cursor = find(w.__pkr.game.scene.getScene('Settings').children.list);
    w.__wiiPath = [];
    const t0 = performance.now();
    const rec = () => {
      w.__wiiPath.push(cursor.y);
      if (performance.now() - t0 < 900) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'test-results/wii-cursor-glide.png' });
  await page.waitForTimeout(900);
  const end = await cursorY(page);
  const path: number[] = await page.evaluate(() => (window as any).__wiiPath);
  expect(end).toBeGreaterThan(start);
  // It glides (frames caught between the rows) and overshoots a little before settling.
  expect(path.filter((y) => y > start + 1 && y < end - 1).length).toBeGreaterThan(0);
  expect(Math.max(...path)).toBeGreaterThan(end);
  expect(path[path.length - 1]).toBe(end);
  // Input is never blocked: three quick presses land three rows down.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Settings').menu.index)).toBe(2);
  await page.screenshot({ path: 'test-results/wii-cursor-settled.png' });
  expect(errors).toEqual([]);
});

test('with Menu animations off the cursor jumps straight to the option', async ({ page }) => {
  await openSettings(page, { menuAnimations: false });
  const start = await cursorY(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(60);
  const next = await cursorY(page);
  await page.waitForTimeout(600);
  expect(next).toBeGreaterThan(start);
  expect(await cursorY(page)).toBe(next);
});
