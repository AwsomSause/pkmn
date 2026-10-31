import { expect, test, type Page } from '@playwright/test';

// Quality gates 6 and 7 (QUALITY_GATES.md): the main screens open at several window
// sizes with no console errors, page errors or failed requests, and the game canvas
// always fits inside the window. Screenshots go to test-results/ for a look by hand.

const SIZES = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'laptop', width: 1024, height: 600 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
];

const active = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitFor(page: Page, key: string) {
  await expect.poll(() => active(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(300);
}

async function go(page: Page, key: string) {
  await page.evaluate((k) => {
    (window as any).__pkr.game.scene.getScenes(true)[0].scene.start(k);
  }, key);
  await waitFor(page, key);
}

for (const size of SIZES) {
  test(`main screens at ${size.name} (${size.width}x${size.height}) have no errors and fit the window`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));

    await page.goto('/?debug=1');
    await waitFor(page, 'MainMenu');

    const check = async (label: string) => {
      const box = await page.evaluate(() => {
        const c = document.querySelector('canvas')!.getBoundingClientRect();
        return { w: c.width, h: c.height, vw: window.innerWidth, vh: window.innerHeight, sx: document.documentElement.scrollWidth };
      });
      expect(box.w, `${label}: canvas wider than the window`).toBeLessThanOrEqual(box.vw + 1);
      expect(box.h, `${label}: canvas taller than the window`).toBeLessThanOrEqual(box.vh + 1);
      expect(box.sx, `${label}: page scrolls sideways`).toBeLessThanOrEqual(box.vw + 1);
      await page.screenshot({ path: `test-results/viewport-${size.name}-${label}.png` });
    };

    await check('menu');
    await go(page, 'Hub');
    await check('hub');
    await go(page, 'TrainerSelect');
    await check('trainers');
    await page.evaluate(() => {
      const { session } = (window as any).__pkr;
      session.newRun('red', 'e2e-viewports');
      session.chooseStarter(0);
    });
    await go(page, 'Map');
    await check('map');
    await page.evaluate(() => {
      const { session } = (window as any).__pkr;
      const first = session.run.stage.map.nodes.find((n: any) => n.column === 1);
      session.chooseNode(first.id);
    });
    await go(page, 'Battle');
    await check('battle');
    expect(problems).toEqual([]);
  });
}

// Release gate (left-out 3.3): the basics a screen reader and keyboard player rely on.
test('page has a language, a title and a named game canvas, and the menu answers the keyboard', async ({ page }) => {
  await page.goto('/?debug=1');
  await waitFor(page, 'MainMenu');
  expect(await page.getAttribute('html', 'lang')).toBe('en');
  expect((await page.title()).length).toBeGreaterThan(0);
  expect(await page.getAttribute('canvas', 'aria-label')).toContain('Pocket Raiders');
  const before = await page.evaluate(() => (window as any).__pkr.game.scene.getScenes(true)[0].menu?.index ?? 0);
  await page.keyboard.press('ArrowDown');
  const after = await page.evaluate(() => (window as any).__pkr.game.scene.getScenes(true)[0].menu?.index ?? 0);
  expect(after).not.toBe(before);
});
