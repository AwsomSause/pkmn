import { expect, test, type Page } from '@playwright/test';

// Holiday events and the Spooky pack (fixed clock: 2026-10-30 = Spooky Season): the Event Hall shows
// Spooky Season, the Archive's pick and the holiday calendar; a new run starts in Spooky Season; and
// once the reward is earned the Hex Maniac and the Spooky Set are open.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

const texts = (page: Page, key: string) =>
  page.evaluate((key) => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene(key).children.list) walk(o);
    return out.join('\n');
  }, key);

test('Spooky Season shows in the Event Hall and a new run starts in it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=holiday-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').openEventHall());
  await page.waitForTimeout(600);
  const hall = await texts(page, 'Hub');
  expect(hall).toContain('★ Spooky Season');
  expect(hall).toContain('Collect 8 clues at Spooky stops');
  expect(hall).toContain('back from the Archive');
  await page.screenshot({ path: 'test-results/holiday-hall.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  for (const at of ['TrainerSelect', 'RunPrep', 'StarterSelect']) {
    await waitForScene(page, at);
    await page.keyboard.press('Enter');
  }
  await waitForScene(page, 'Briefing');
  expect(await texts(page, 'Briefing')).toContain('Spooky forms');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.gameEvents)).toContain('spooky-season@2026');
  expect(errors).toEqual([]);
});

test('after Spooky Season the Hex Maniac is playable with the Spooky Set', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=hex-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.evaluate(() => {
    const p = (window as any).__pkr.session.profile;
    p.unlockedArchetypes.push('hex-maniac');
    p.unlockedPools.push('spooky');
    p.claims['event:spooky-season:reward'] = { at: '2026-10-31T00:00:00.000Z' };
  });
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').openEventHall());
  await page.waitForTimeout(600);
  const hall = await texts(page, 'Hub');
  expect(hall).not.toContain('★ Spooky Season  ·');
  expect(hall).toContain('Holiday calendar');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    (window as any).__pkr.game.scene.getScene('Hub').scene.start('TrainerSelect');
  });
  await waitForScene(page, 'TrainerSelect');
  const hex = await page.evaluate(() => {
    const ts = (window as any).__pkr.game.scene.getScene('TrainerSelect');
    const slot = ts.slots.find((sl: any) => sl?.archetype.id === 'hex-maniac');
    return slot?.status ?? null;
  });
  expect(hex).toBe('unlocked');
  await page.screenshot({ path: 'test-results/hex-maniac.png' });
  expect(errors).toEqual([]);
});
