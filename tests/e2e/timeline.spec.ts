import { expect, test, type Page } from '@playwright/test';

// Revisit This Timeline (M13): a lost run shows up in the Legacy Gallery, rebuilds into a replay that is
// labelled THE FALSE PROTAGONIST on the map, and can be abandoned without touching the original or the profile.

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

test('a lost run can be revisited as the False Protagonist, then abandoned safely', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?debug=1');
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('MainMenu');
  // Start a run and lose it, then open the Hall of Fame.
  const before = await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.newRun('red', 'e2e-timeline');
    session.chooseStarter(0);
    session.run.phase = 'over';
    session.run.victory = false;
    session.finishRun();
    session.closeRun();
    game.scene.getScenes(true)[0].scene.start('LegacyGallery');
    return { profile: localStorage.getItem('pkr.profile'), record: JSON.stringify(session.profile.runHistory[0]) };
  });
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('LegacyGallery');
  // Open the lost run; with no moments to relive, Revisit This Timeline is the first row you can pick.
  await page.keyboard.press('Enter');
  await expect.poll(() => texts(page)).toContain('↺ Revisit This Timeline');
  await page.screenshot({ path: 'test-results/timeline-hall.png' });
  await page.keyboard.press('Enter');
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('StarterSelect');
  expect(await page.evaluate(() => (window as any).__pkr.session.inReplay)).toBe(true);
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.chooseStarter(0);
    game.scene.getScenes(true)[0].scene.start('Map');
  });
  await expect.poll(() => scene(page), { timeout: 10_000 }).toBe('Map');
  await expect.poll(() => texts(page)).toContain('THE FALSE PROTAGONIST');
  for (const size of [{ width: 1280, height: 720 }, { width: 800, height: 600 }]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `test-results/timeline-map-${size.width}.png` });
  }
  // Back to the Legacy Gallery: abandon (press twice to confirm).
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.closeRun();
    game.scene.getScenes(true)[0].scene.start('LegacyGallery');
  });
  await expect.poll(() => texts(page)).toContain('✕ Abandon revisited timeline');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => texts(page)).toContain('✕ Press again to abandon this timeline');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => (window as any).__pkr.session.timeline.replays[0]?.status))
    .toBe('abandoned');
  const after = await page.evaluate(() => ({ profile: localStorage.getItem('pkr.profile'), record: JSON.stringify((window as any).__pkr.session.profile.runHistory[0]), replay: localStorage.getItem('pkr.replay') }));
  expect(after.profile).toBe(before.profile);
  expect(after.record).toBe(before.record);
  expect(after.replay).toBeNull();
  expect(errors).toEqual([]);
});
