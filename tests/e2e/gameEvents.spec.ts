import { expect, test, type Page } from '@playwright/test';

// Game events: the Event Hall shows this week's event (fixed clock: 2026-10-30, ISO week 44 = Egg Expedition),
// its objectives and reward, and a new run's briefing shows the event's rules.

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

test('the Event Hall shows the weekly event and runs play by its rules', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(new Date('2026-10-30T12:00:00Z'));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=events-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');

  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Hub').openEventHall());
  await page.waitForTimeout(600);
  const hall = await texts(page, 'Hub');
  expect(hall).toContain('★ Egg Expedition');
  expect(hall).toContain('ends in');
  expect(hall).toContain('Finish 25 encounters');
  expect(hall).toContain('Coming up');
  await page.screenshot({ path: 'test-results/event-hall.png' });
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
  expect(await texts(page, 'Briefing')).toContain('Your Pokémon gain 15% more experience');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.gameEvents)).toContain('egg-expedition@2026-W44');
  expect(errors).toEqual([]);
});
