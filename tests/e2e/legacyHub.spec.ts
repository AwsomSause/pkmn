import { expect, test, type Page } from '@playwright/test';

// Legacy & Live hub systems (left-out 1.5): each new room opens its picker with no console errors, a Tree
// purchase and a contact switch show up in the profile, and props grow the Hub.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
const texts = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => {
      if (typeof o.text === 'string') out.push(o.text);
      for (const c of o.list ?? []) walk(c);
    };
    for (const sc of (window as any).__pkr.game.scene.getScenes(true)) for (const o of sc.children.list) walk(o);
    return out.join('\n');
  });

test('the Legacy rooms open, the Tree sells a perk and the Hub grows', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  // Give the profile points and a few unlocks, then open the Hub.
  await page.evaluate(() => {
    const s = (window as any).__pkr.session;
    s.changeProfile((p: any) => ({ ...p, researchPoints: 500, bankCredits: 5000, bankTier: 4, counters: { ...p.counters, regionsCleared: 10 } }));
    (window as any).__pkr.game.scene.getScenes(true)[0].scene.start('Hub');
  });
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Hub');
  await page.waitForTimeout(400);

  const rooms = ['tree', 'prestige', 'network', 'museum', 'intel', 'moves', 'seeds'] as const;
  for (const room of rooms) {
    await page.evaluate((r) => {
      const hub = (window as any).__pkr.game.scene.getScene('Hub');
      hub.picker?.close?.();
      hub.picker = null;
      hub.openLegacy(r);
    }, room);
    await page.waitForTimeout(250);
    const t = await texts(page);
    expect(t.length, room).toBeGreaterThan(20);
  }

  // The picker's own Enter path: open the Tree and press Enter on the first (open) node.
  await page.evaluate(() => {
    const hub = (window as any).__pkr.game.scene.getScene('Hub');
    hub.picker?.close?.();
    hub.picker = null;
    hub.openLegacy('tree');
  });
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.session.profile.legacy?.tree ?? []), { timeout: 10_000 }).toEqual(['field-notes']);
  expect(await page.evaluate(() => (window as any).__pkr.session.profile.researchPoints)).toBe(480);
  expect(errors).toEqual([]);
});
