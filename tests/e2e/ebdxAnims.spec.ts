import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=ebdx-anims&debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?seed=ebdx-anims&debug=1');
  await waitForScene(page, 'MainMenu');
  await startBattle(page);

  const names = Object.keys(JSON.parse(readFileSync('src/data/ebdxAnims.json', 'utf8')).scripts);
  const shots = ['thunderbolt', 'psychic', 'bite', 'hydropump', 'giga-drain'];
  for (const name of names) {
    const before = await page.evaluate(async (script) => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      await b.fx.readyScript(script);
      const spots = ['player', 'enemy'].map((s) => { const v = b.fx.opts.sprite(s); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha]; });
      (window as any).__fieldCount = b.fx.opts.field.length;
      (window as any).__run = b.fx.play([{ kind: 'moveAnim', user: 'player', target: 'enemy', anim: 'tackle', script, color: '#ffffff', family: 'projectile', moveType: 'normal' }]);
      return spots;
    }, name);
    await page.waitForTimeout(450);
    const during = await page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').fx.opts.field.length - (window as any).__fieldCount);
    if (shots.includes(name)) await page.screenshot({ path: `test-results/ebdx-${name}.png` });
    const after = await page.evaluate(async () => {
      const b = (window as any).__pkr.game.scene.getScene('Battle');
      await (window as any).__run;
      return { spots: ['player', 'enemy'].map((s) => { const v = b.fx.opts.sprite(s); return [v.x, v.y, v.scaleX, v.scaleY, v.alpha]; }), left: b.fx.opts.field.length - (window as any).__fieldCount };
    });
    expect(during, `${name} draws pictures`).toBeGreaterThan(0);
    expect(after.left, `${name} cleans up`).toBe(0);
    expect(after.spots, `${name} restores the Pokémon`).toEqual(before);
  }
  expect(errors).toEqual([]);
});
