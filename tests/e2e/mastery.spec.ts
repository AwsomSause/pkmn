import { expect, test, type Page } from '@playwright/test';

// Species Mastery: the Hub lists the families you met with their rank, and a family's page shows
// each member's goal and its unlocks; Enter changes a pick and it is saved.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

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

test('the Hub shows Species Mastery ranks and unlocks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=mastery-e2e');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');

  await page.evaluate(() => {
    const p = (window as any).__pkr.session.profile;
    const r = { seen: 2, caught: 2, battles: 60, bossWins: 2, evolved: 1, flawless: 1, regions: 0 };
    p.mastery = { charmander: r, charmeleon: { ...r, evolved: 0 }, pidgey: { seen: 1, caught: 0, battles: 0, bossWins: 0, evolved: 0, flawless: 0, regions: 0 } };
    (window as any).__pkr.game.scene.getScene('Hub').openMastery();
  });
  await page.waitForTimeout(600);
  let shown = await texts(page);
  expect(shown).toContain('Species Mastery');
  expect(shown).toContain('Charmander');
  expect(shown).toContain('Gold');
  await page.screenshot({ path: 'test-results/mastery-hub.png' });

  await page.keyboard.press('Enter'); // Charmander's family (best rank first)
  await page.waitForTimeout(500);
  shown = await texts(page);
  expect(shown).toContain('Charmander family');
  expect(shown).toContain('first egg move');
  expect(shown).toContain('Hidden Ability');
  await page.screenshot({ path: 'test-results/mastery-family.png' });
  expect(errors).toEqual([]);
});
