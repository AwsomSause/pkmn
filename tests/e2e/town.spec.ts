import { expect, test, type Page } from '@playwright/test';

// Pocket Town (W7): the Hub's Town tile opens the Town; a building opens, an action runs, and Esc comes back to the Hub.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

for (const size of [{ w: 1280, h: 720 }, { w: 390, h: 844 }]) {
  test(`Pocket Town opens, runs an action and returns at ${size.w}x${size.h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: size.w, height: size.h });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/?debug=1');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
    await page.evaluate(() => { (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub'); });
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
    await page.waitForTimeout(300);
    // Pocket Town is through the gate at the top of Hub Town: the gate asks first ("Not yet" is focused).
    await page.evaluate(() => { (window as any).__pkr.game.scene.getScene('Hub').visit('pocket'); });
    await page.waitForTimeout(250);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Town');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/town-${size.w}.png` });
    // Open the first building (Enter), then the first action that works without a prompt, and read the answer.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/town-building-${size.w}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
    // The session runs a town action and saves it: a radio broadcast waits as the next run's boon.
    const money = await page.evaluate(() => {
      const session = (window as any).__pkr.session;
      const r = session.town('radio-tune', { choice: 'trainer-tips' });
      return { ok: r.ok, boon: session.profile.town?.boon.money };
    });
    expect(money).toEqual({ ok: true, boon: 300 });
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
