import { expect, test, type Page } from '@playwright/test';

// Hyper moment codex (left-out plan 5.19): the Hub lists every story moment, found ones by name.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

const texts = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const o of (window as any).__pkr.game.scene.getScene('Hub').children.list) walk(o);
    return out.join('\n');
  });

test('the Hub Moment Codex shows discovered moments and hides the rest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=codex-e2e');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.evaluate(() => {
    (window as any).__pkr.session.profile.momentCodex = { 'secondWind': 1, 'remember-defeat': 2 };
    const def = (window as any).__pkr.session.content.story.definitions.find((d: any) => d.triggerConditions.trigger === 'secondWind');
    (window as any).__pkr.session.profile.momentCodex = { [def.id]: 1, 'remember-defeat': 2 };
    (window as any).__pkr.game.scene.getScene('Hub').openCodex();
  });
  await page.waitForTimeout(600);
  const shown = await texts(page);
  expect(shown).toContain('Moment Codex (2/');
  expect(shown).toContain('???');
  await page.screenshot({ path: 'test-results/codex-hub.png' });
  expect(errors).toEqual([]);
});
