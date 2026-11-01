import { expect, test, type Page } from '@playwright/test';

// W11: themes, text size, transitions and hold-to-confirm run without errors and leave the game usable.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function boot(page: Page, data: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 12, savedAt: '', data: { musicVolume: 0, sfxVolume: 0, muted: true, battleAnimations: 'full', effectIntensity: 1, battleSpeed: 'normal', dialogueFrequency: 'normal', ...s } }));
  }, data);
  await page.goto('/?seed=w11-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
}

for (const [uiTheme, transitionStyle] of [['classic', 'fade'], ['aero', 'bounce'], ['ds', 'wipe'], ['wii', 'ripple'], ['cyber', 'bounce']] as const) {
  test(`theme ${uiTheme} with ${transitionStyle} transition opens Settings without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await boot(page, { uiTheme, transitionStyle, fontSize: uiTheme === 'ds' ? 'huge' : 'normal', dyslexiaFont: uiTheme === 'wii', cursorTrail: true, reducedFlash: true });
    await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('Settings', { from: 'MainMenu', page: 'display' }));
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Settings');
    await page.waitForTimeout(700);
    await page.mouse.move(300, 200);
    await page.mouse.move(340, 230);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__pkr.session.settings.uiTheme)).toBe(uiTheme);
    expect(errors).toEqual([]);
  });
}

test('hold-to-confirm shows a ring and cancels on early release', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, { holdToConfirm: true });
  await page.evaluate(() => void (window as any).__pkr.game.scene.getScene('MainMenu').scene.start('Settings', { from: 'MainMenu', page: 'confirmReset' }));
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Settings');
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const hasRing = () => page.evaluate(() => !!(window as any).__pkr.game.scene.getScene('Settings').children.list.find((o: any) => o.name === 'hold-confirm'));
  expect(await hasRing()).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await hasRing()).toBe(false);
  expect(errors).toEqual([]);
});

test('party screen: hotkeys, move, undo, pin and the interaction log', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=w11-party&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const twin = structuredClone(session.run.party[0]);
    twin.uid = 'second-mon';
    session.run.party.push(twin);
    const m = game.scene.getScene('Map');
    m.activate(m.options.findIndex((o: any) => o.kind === 'party'));
  });
  await page.waitForTimeout(800);
  const order = () => page.evaluate(() => (window as any).__pkr.session.run.party.map((p: any) => p.uid));
  const before = await order();
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Enter'); // actions menu
  await page.keyboard.press('Enter'); // Make lead
  await page.waitForTimeout(500);
  expect((await order())[0]).toBe('second-mon');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').activate((window as any).__pkr.game.scene.getScene('Map').options.findIndex((o: any) => o.kind === 'party')));
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!(window as any).__pkr.game.scene.getScene('Map').children.list.find((o: any) => o.name === 'pinned-card'))).toBe(true);
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!(window as any).__pkr.game.scene.getScene('Map').children.list.find((o: any) => o.name === 'interaction-log'))).toBe(true);
  expect(before[0]).not.toBe('second-mon');
  expect(errors).toEqual([]);
});
