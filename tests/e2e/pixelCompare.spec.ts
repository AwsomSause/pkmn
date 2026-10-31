import { expect, test, type Page } from '@playwright/test';

// Left-out 6.5: pixel compare for Hub and Trainer Select, with animations Off so the frame holds still.
// A change that moves or recolours these screens fails here; if it is intended, refresh the pictures with
// `npx playwright test tests/e2e/pixelCompare.spec.ts --update-snapshots` and look at them before committing.

const active = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function open(page: Page, key: string) {
  await page.evaluate((k) => { (window as any).__pkr.game.scene.getScenes(true)[0].scene.start(k); }, key);
  await expect.poll(() => active(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(1500);
}

test('Hub and Trainer Select match their baseline pictures', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 960, height: 540 });
  // Cosmetic randomness (which Pokémon the Hub shows) is pinned so the frame is the same every run.
  await page.addInitScript(() => {
    let a = 12345;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Date.now = () => 1_761_900_000_000;
  });
  await page.addInitScript(() => {
    localStorage.setItem('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 8, savedAt: '', data: { musicVolume: 0, sfxVolume: 0, muted: true, battleAnimations: 'off', effectIntensity: 0, shakeIntensity: 0, reduceParticles: true, battleSpeed: 'normal', dialogueFrequency: 'normal', damageDetails: false, accessibilityProfile: 'custom', trainerSort: 'default', trainerSortReverse: false, battleUi: 'aero' } }));
  });
  await page.goto('/?seed=pixel&debug=1');
  await expect.poll(() => active(page), { timeout: 20_000 }).toBe('MainMenu');
  await open(page, 'Hub');
  await expect(page).toHaveScreenshot('hub.png', { maxDiffPixelRatio: 0.03 });
  await open(page, 'TrainerSelect');
  await expect(page).toHaveScreenshot('trainer-select.png', { maxDiffPixelRatio: 0.03 });
});
