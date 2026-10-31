import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Hyper/Overdrive, interaction and rival flourishes (spec 6.3-6.5): each one
// draws on the field, finishes by itself and leaves both Pokémon where they were.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);
async function waitForScene(page: Page, key: string) {
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(250);
}

async function startBattle(page: Page) {
  await page.keyboard.press('Enter');
  for (const key of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    if (key !== 'Hub') await page.keyboard.press('Enter');
    await waitForScene(page, key);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await confirmToMenu(page);
}

const IDS = [
  'overdrive.toughened', 'overdrive.hung', 'overdrive.rise', 'overdrive.bond', 'overdrive.rivalry', 'overdrive.flair', 'overdrive.emotion', 'overdrive.rage', 'overdrive.moment',
  'interaction.enter', 'interaction.item', 'interaction.catch', 'rival.ace', 'rival.win', 'rival.lose',
];

test('every story flourish plays, finishes and restores the Pokémon', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=story-anims&debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=story-anims&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);

  for (const id of IDS) {
    const side = id === 'rival.ace' || id === 'rival.win' || id === 'rival.lose' ? 'enemy' : 'player';
    const before = await page.evaluate(async ([anim, s]) => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      const spots = ['player', 'enemy'].map((x) => { const v = b.fx.opts.sprite(x); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha, v.angle]; });
      (window as any).__fieldCount = b.fx.opts.field.length;
      (window as any).__run = b.fx.flourish(s, anim);
      return spots;
    }, [id, side]);
    await page.waitForTimeout(id === 'overdrive.rise' ? 700 : 350);
    await page.screenshot({ path: `test-results/story-${id}.png` });
    const after = await page.evaluate(async () => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      await (window as any).__run;
      await new Promise((r) => setTimeout(r, 1500));
      return { spots: ['player', 'enemy'].map((x) => { const v = b.fx.opts.sprite(x); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha, v.angle]; }), left: b.fx.opts.field.length - (window as any).__fieldCount };
    });
    expect(after.left, `${id} cleans up`).toBe(0);
    if (id !== 'rival.win' && id !== 'rival.lose') {
      // Position, opacity and tilt come back exactly; the scale only has to be near (the idle breathing moves it).
      const flat = (a: number[][]) => a.map(([x, y, , , alpha, angle]) => [x, y, alpha, angle]);
      expect(flat(after.spots), `${id} restores the Pokémon`).toEqual(flat(before));
      after.spots.forEach((sp, i) => expect(Math.abs(sp[3]! / before[i]![3]! - 1), `${id} scale`).toBeLessThan(0.1));
    }
  }
  expect(errors).toEqual([]);
});
