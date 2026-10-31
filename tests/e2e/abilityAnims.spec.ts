import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Ability and battle-text animations (M14 6.1, 6.2): each draws pictures, ends by itself,
// leaves the Pokémon where they were and throws no errors.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function waitForScene(page: Page, key: string) {
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(250);
}

test('ability and text animations play, finish and restore the Pokémon', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=ability-anims&debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=ability-anims&debug=1');
  await waitForScene(page, 'MainMenu');
  await page.keyboard.press('Enter');
  for (const key of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    if (key !== 'Hub') await page.keyboard.press('Enter');
    await waitForScene(page, key);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await confirmToMenu(page);

  const cues = [
    { kind: 'abilityAnim', side: 'player', anim: 'ability.menace', label: 'Intimidate', ability: 'intimidate' },
    { kind: 'abilityAnim', side: 'enemy', anim: 'ability.weather', label: 'Drizzle', ability: 'drizzle' },
    { kind: 'abilityAnim', side: 'player', anim: 'ability.boost', label: 'Speed Boost', ability: 'speed-boost' },
    { kind: 'abilityAnim', side: 'enemy', anim: 'ability.heal', label: 'Regenerator', ability: 'regenerator' },
    { kind: 'abilityAnim', side: 'player', anim: 'ability.absorb', label: 'Levitate', ability: 'levitate' },
    { kind: 'textAnim', side: 'enemy', anim: 'text.statUp', label: 'ATTACK ++' },
    { kind: 'textAnim', side: 'player', anim: 'text.status', label: 'BURNED!' },
    { kind: 'badge', side: 'enemy', badge: 'super' },
  ];
  for (const [i, cue] of cues.entries()) {
    const before = await page.evaluate((c) => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      const spots = ['player', 'enemy'].map((s) => { const v = b.fx.opts.sprite(s); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha]; });
      (window as any).__run = b.fx.play([c]);
      return spots;
    }, cue);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `test-results/ability-${i}-${(cue as any).anim ?? 'badge'}.png` });
    const after = await page.evaluate(async () => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      await (window as any).__run;
      await new Promise((r) => setTimeout(r, 1800));
      return ['player', 'enemy'].map((s) => { const v = b.fx.opts.sprite(s); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha]; });
    });
    // Position and opacity come back exactly; scale is only checked loosely because the idle breathing moves it.
    for (const [k, spot] of after.entries()) {
      expect(spot.slice(0, 2).concat(spot[4]), `cue ${i} restores sprite ${k}`).toEqual(before[k]!.slice(0, 2).concat(before[k]![4]));
      expect(Math.abs(spot[2]! - before[k]![2]!), `cue ${i} scale ${k}`).toBeLessThan(0.15);
    }
  }
  expect(errors).toEqual([]);
});
