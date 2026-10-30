import { expect, test, type Page } from '@playwright/test';

// Raids: a raid den on the map opens a preview, entering starts the boss fight with a raid status line,
// and the run survives a reload mid-raid.

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

test('a raid den shows its preview, then starts a raid fight that survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=raid-e2e');
  await waitForScene(page, 'MainMenu');
  await toMap(page);

  // Put a den on the first column's node and stand on it (the map generator places dens by chance).
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'raid-e2e', kind: 'raid', raidId: 'sleeping-snorlax', used: false });
    run.stage.current = node.id;
    (window as any).__pkr.game.scene.getScene('Map').scene.restart({ focus: 0 });
  });
  await waitForScene(page, 'Map');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').openRaid('raid-e2e'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => Boolean((window as any).__pkr.game.scene.getScene('Map').picker))).toBe(true);
  await page.keyboard.press('Enter'); // challenge
  await waitForScene(page, 'Battle');
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').header.text), { timeout: 10_000 }).toContain('RAID');
  expect(await page.evaluate(() => (window as any).__pkr.session.run.raids.entered)).toBe(1);

  // Reload mid-raid: the raid is still there, entered once, the den used.
  await page.reload();
  await waitForScene(page, 'MainMenu');
  const saved = await page.evaluate(() => {
    const raw = Object.entries(localStorage).find(([k]) => k.endsWith('run'));
    const run = raw ? JSON.parse(raw[1] as string).data : null;
    return run ? { raid: run.battle?.raid?.id, entered: run.raids.entered } : null;
  });
  expect(saved).toEqual({ raid: 'sleeping-snorlax', entered: 1 });
  expect(errors).toEqual([]);
});
