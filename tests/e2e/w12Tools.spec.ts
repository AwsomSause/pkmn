import { expect, test, type Page } from '@playwright/test';

// W12: the Hub "Tools & Community" room opens each of its pages (what's new, content status, stats, seed board,
// mod packs, bug report) and Esc steps back. No console errors; the offline files are served.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const hub = (page: Page, expr: string) => page.evaluate((e) => new Function('hub', `return ${e}`)((window as any).__pkr.game.scene.getScene('Hub')), expr);

test('Tools room pages open and close; offline files are served', async ({ page, request, baseURL }) => {
  test.setTimeout(180_000); // the Hub is heavy to draw, and CI runs two specs at once
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.evaluate(() => (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub'));
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(400);

  for (let item = 0; item < 6; item++) {
    await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').enter('tools'));
    await page.waitForTimeout(250);
    expect(await hub(page, '!!hub.picker'), 'tools list open').toBe(true);
    for (let i = 0; i < item; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    expect(await hub(page, '!!hub.picker'), `page ${item} open`).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    expect(await hub(page, '!!hub.picker'), `page ${item} Esc returns to the list`).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await hub(page, '!hub.picker'), 'list Esc closes').toBe(true);
  }

  for (const file of ['manifest.webmanifest', 'sw.js', 'icons/icon-192.png']) {
    expect((await request.get(`${baseURL}/${file}`)).ok(), file).toBe(true);
  }
  expect(errors).toEqual([]);
});
