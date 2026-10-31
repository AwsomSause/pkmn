import { expect, test, type Page } from '@playwright/test';

// Hub tiles with several rooms open their own full page (Picker with a Back button), and Esc returns to the Hub.
// The Preparation Desk keeps its menu and summary inside their panels. Screenshots go to test-results/.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const hub = (page: Page, expr: string) => page.evaluate((e) => new Function('hub', `return ${e}`)((window as any).__pkr.game.scene.getScene('Hub')), expr);

for (const size of [{ w: 1280, h: 720 }, { w: 1024, h: 600 }, { w: 390, h: 844 }]) {
  test(`Hub section pages and Preparation Desk at ${size.w}x${size.h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: size.w, height: size.h });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/?debug=1');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
    await page.evaluate(() => {
      (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub');
    });
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
    await page.waitForTimeout(400);

    for (const tile of [0, 1, 3, 4]) {
      await page.evaluate((i) => {
        const h = (window as any).__pkr.game.scene.getScene('Hub');
        h.focusTile(i, false);
        h.confirmTile();
      }, tile);
      await page.waitForTimeout(250);
      expect(await hub(page, '!!hub.section'), `tile ${tile} opens a page`).toBe(true);
      await page.screenshot({ path: `test-results/hubpage-${size.w}-tile${tile}.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      expect(await hub(page, '!hub.section'), `tile ${tile} Esc returns to the Hub`).toBe(true);
    }

    // A room opens on top of its page; Esc goes back to the page, then to the Hub.
    await page.evaluate(() => {
      const h = (window as any).__pkr.game.scene.getScene('Hub');
      h.focusTile(4, false);
      h.confirmTile();
      h.enter('achievements');
    });
    await page.waitForTimeout(250);
    expect(await hub(page, '!!hub.picker && !!hub.section')).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await hub(page, '!hub.picker && !!hub.section')).toBe(true);

    await page.evaluate(() => {
      (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
    });
    await expect.poll(() => scene(page)).toBe('TrainerSelect');
    await page.evaluate(() => {
      (window as any).__pkr.game.scene.getScene('TrainerSelect').scene.start('RunPrep', { archetypeId: 'red' });
    });
    await expect.poll(() => scene(page)).toBe('RunPrep');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/runprep-${size.w}.png` });
    expect(errors).toEqual([]);
  });
}
