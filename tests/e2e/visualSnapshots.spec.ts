import { expect, test, type Page } from '@playwright/test';

// Visual snapshot suite (catalog #136): the same scenes at several window sizes, saved to test-results/visual/ for a
// manual look. It does not compare pixels (that makes brittle tests); it fails only on console errors, a scene that
// never appears, or a page that scrolls sideways.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const SIZES = [
  { name: 'wide', width: 1280, height: 720 },
  { name: 'small', width: 960, height: 540 },
  { name: 'narrow', width: 480, height: 720 },
];

for (const size of SIZES) {
  test(`scenes render at ${size.name} (${size.width}x${size.height})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/visual/${size.name}-main-menu.png` });

    await page.keyboard.press('Enter'); // Enter the Hub
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/visual/${size.name}-hub.png` });

    await page.keyboard.press('Enter'); // Start a run
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('TrainerSelect');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/visual/${size.name}-trainer-select.png` });

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(sideways, 'page scrolls sideways').toBe(false);
    expect(errors).toEqual([]);
  });
}
