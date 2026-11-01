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

/** Records one named object's x every frame for `ms` while `press` runs. */
async function glidePath(page: Page, sceneKey: string, name: string, press: () => Promise<void>, ms = 900): Promise<{ start: number; end: number; path: number[] }> {
  const start = await page.evaluate(([k, n]) => (window as any).__pkr.game.scene.getScene(k).children.getByName(n)?.x ?? null, [sceneKey, name]);
  await page.evaluate(([k, n, t]) => {
    const w = window as any;
    const o = w.__pkr.game.scene.getScene(k).children.getByName(n);
    w.__glide = [];
    const t0 = performance.now();
    const rec = () => {
      w.__glide.push(o.x);
      if (performance.now() - t0 < (t as number)) requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  }, [sceneKey, name, ms] as const);
  await press();
  await page.waitForTimeout(ms + 200);
  const path: number[] = await page.evaluate(() => (window as any).__glide);
  return { start, end: path[path.length - 1]!, path };
}

test('the Hub tiles and Trainer Select grid share the gliding cursor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await openSettings(page, {});
  for (const [key, name, keyName] of [['Hub', 'hub-cursor', 'ArrowRight'], ['TrainerSelect', 'trainer-cursor', 'ArrowRight']] as const) {
    await page.evaluate((k) => void (window as any).__pkr.game.scene.getScenes(true)[0].scene.start(k), key);
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(key);
    await page.waitForTimeout(1500);
    const { start, end, path } = await glidePath(page, key, name, () => page.keyboard.press(keyName));
    expect(start, key).not.toBeNull();
    expect(end, key).toBeGreaterThan(start);
    expect(path.filter((x) => x > start + 1 && x < end - 1).length, key).toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/wii-${key.toLowerCase()}-cursor.png` });
  }
  expect(errors).toEqual([]);
});
