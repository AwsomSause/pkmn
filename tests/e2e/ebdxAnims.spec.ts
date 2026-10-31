import { expect, test, type Page } from '@playwright/test';
import { confirmToMenu } from './battleInput';

// Scripted EBDX move animations (left-out 6.6): each one draws pictures on the
// field, ends by itself, and leaves both Pokémon exactly where they were.

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

test('every scripted EBDX animation plays, finishes and restores the Pokémon', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=ebdx-anims&debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=ebdx-anims&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);

  const names = ['tackle', 'ember', 'water-gun', 'thunderbolt', 'absorb', 'mega-drain', 'giga-drain'];
  for (const [i, name] of names.entries()) {
    const result = await page.evaluate(async (script) => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      const spots = () => ['player', 'enemy'].map((s) => { const v = b.opts?.sprite?.(s) ?? b.fx.opts.sprite(s); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha]; });
      await b.fx.readyScript(script); 
      const before = spots();
      const field = b.fx.opts.field;
      const count = field.length;
      const run = b.fx.play([{ kind: 'moveAnim', user: 'player', target: 'enemy', anim: 'tackle', script, color: '#ffffff', family: 'projectile', moveType: 'normal' }]);
      await new Promise((r) => setTimeout(r, 350));
      const during = field.length - count;
      await run;
      return { before, after: spots(), during, left: field.length - count };
    }, name);
    expect(result.during, `${name} draws pictures`).toBeGreaterThan(0);
    expect(result.left, `${name} cleans up`).toBe(0);
    expect(result.after, `${name} restores the Pokémon`).toEqual(result.before);
    if (name === 'thunderbolt') await page.screenshot({ path: 'test-results/ebdx-thunderbolt.png' });
  }
  expect(errors).toEqual([]);
});
