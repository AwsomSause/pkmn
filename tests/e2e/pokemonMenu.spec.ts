import { expect, test, type Page } from '@playwright/test';

// The merged Pokémon screen (spec §5, §6): party list, seven tabs, held item effects, reordering.
// Screenshots go to test-results/ for a look by hand.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
  { width: 390, height: 844 },
];

async function texts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const all = (o: any): any[] => (o.list ? [o, ...o.list.flatMap(all)] : [o]);
    return (window as any).__pkr.game.scene.getScene('Map').children.list.flatMap(all).filter((o: any) => o.type === 'Text').map((o: any) => o.text);
  });
}

test('the Pokémon screen shows tabs, explains held items and reorders the party', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=pokemon-menu&campaign=dev&debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    const lead = session.run.party[0];
    lead.held = { 'choice-band': 1, leftovers: 2 };
    const twin = structuredClone(lead);
    twin.uid = 'second-mon';
    twin.held = {};
    session.run.party.push(twin);
    const m = game.scene.getScene('Map');
    m.activate(m.options.findIndex((o: any) => o.kind === 'party'));
  });
  await page.waitForTimeout(800);
  // There is no separate Summary button any more.
  expect(await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').options.some((o: any) => o.kind === 'summary'))).toBe(false);
  let t = await texts(page);
  for (const label of ['Overview', 'Stats', 'Moves', 'Items', 'Bond', 'History', 'Traits', 'Ability', 'Holding']) expect(t).toContain(label);
  await page.screenshot({ path: 'test-results/pokemon-overview.png' });
  // Stats tab: comparison against the other Pokémon.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  t = await texts(page);
  expect(t.some((s) => s.startsWith('Stats') && s.includes('compared with'))).toBe(true);
  await page.screenshot({ path: 'test-results/pokemon-stats.png' });
  // Moves tab.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/pokemon-moves.png' });
  // Items tab: the real effects of the Choice Band.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  t = await texts(page);
  expect(t.some((s) => s.includes('Attack is ×1.5') && s.includes('Locked'))).toBe(true);
  expect(t.some((s) => s.startsWith('2 items, 3 effects active'))).toBe(true);
  await page.screenshot({ path: 'test-results/pokemon-items.png' });
  // Take off: Enter opens the action menu, "Review items" (4th entry) focuses the list, Enter takes the Choice Band into the Bag.
  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const bag = await page.evaluate(() => {
    const run = (window as any).__pkr.session.run;
    return { held: run.party[0].held, loose: run.looseHeld };
  });
  expect(bag.held['choice-band']).toBeUndefined();
  expect(bag.loose['choice-band']).toBe(1);
  await page.keyboard.press('Escape');
  for (const tab of ['Bond', 'History', 'Traits']) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/pokemon-${tab.toLowerCase()}.png` });
  }
  // Reorder: Enter opens the action menu, the second Pokémon becomes the lead.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/pokemon-menu.png' });
  await page.keyboard.press('Enter'); // Make lead (first entry)
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__pkr.session.run.party[0].uid)).toBe('second-mon');
  await page.keyboard.press('Escape');
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Map');
  expect(errors).toEqual([]);
});

for (const size of SIZES) {
  test(`the Pokémon screen fits a ${size.width}x${size.height} window`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?seed=pokemon-menu-size&campaign=dev&debug=1');
    await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
    for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
      await page.keyboard.press('Enter');
      await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(next);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => {
      const m = (window as any).__pkr.game.scene.getScene('Map');
      m.activate(m.options.findIndex((o: any) => o.kind === 'party'));
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/pokemon-${size.width}.png` });
    expect(errors).toEqual([]);
  });
}
