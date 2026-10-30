import { expect, test, type Page } from '@playwright/test';

// Totems: a Totem territory on the map opens a preview, entering starts the fight with a Totem status line, and the run survives a reload.
// and the run survives a reload mid-fight.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function toMap(page: Page) {
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Hub');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'TrainerSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'RunPrep');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'StarterSelect');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Briefing');
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

test('a Totem territory shows its preview, then starts a Totem fight that survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=totem-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // Put a den on the first column's node and stand on it (the map generator places dens by chance).
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'totem-e2e', kind: 'totem', totemId: 'totem-lurantis', used: false });
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openTotem('totem-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter'); // challenge
  await waitForScene(page, 'Battle');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').status.text), { timeout: 10_000 }).toContain('TOTEM');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.totems.entered)).toBe(1);

  // Reload mid-fight: the Totem fight is still there, entered once.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    const run = raw ? JSON.parse(raw[1] as string).data : null;
    return run ? { totem: run.battle?.totem?.id, entered: run.totems.entered } : null;
  });
  expect(saved).toEqual({ totem: 'totem-lurantis', entered: 1 });
  expect(errors).toEqual([]);
});
