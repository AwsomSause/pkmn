import { expect, test, type Page } from '@playwright/test';

// Left-out 3.1: no two visible texts on a main screen cover each other (a narrow window only scales the canvas,
// so the check runs in game coordinates). Menu, Hub and map are checked at phone width.

const active = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function go(page: Page, key: string) {
  await page.evaluate((k) => { (window as any).__pkr.game.scene.getScenes(true)[0].scene.start(k); }, key);
  await expect.poll(() => active(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(1200);
}
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScenes(true)[0];
    const texts = scene.children.list
      .flatMap((c: any) => (c.list ? c.list : [c]))
      .filter((o: any) => o.type === 'Text' && o.visible && o.alpha > 0.3 && String(o.text).trim().length > 1 && o.parentContainer?.visible !== false);
    const out: string[] = [];
    if (texts.length < 3) out.push(`only ${texts.length} texts found`);
    const rect = (o: any) => {
      const b = o.getBounds();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = rect(texts[i]);
        const b = rect(texts[j]);
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 6 && oy > 0.5 * Math.min(a.h, b.h)) out.push(`"${texts[i].text}" over "${texts[j].text}"`);
      }
    }
    return out;
  });

test('main screens have no overlapping text at phone width', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?debug=1');
  await expect.poll(() => active(page), { timeout: 30_000 }).toBe('MainMenu');
  await page.waitForTimeout(800);
  expect(await overlaps(page), 'menu').toEqual([]);
  await go(page, 'Hub');
  expect(await overlaps(page), 'hub').toEqual([]);
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.newRun('red', 'e2e-overlap');
    session.chooseStarter(0);
  });
  await go(page, 'Map');
  expect(await overlaps(page), 'map').toEqual([]);
});
