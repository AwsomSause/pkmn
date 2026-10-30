import { expect, test, type Page } from '@playwright/test';

// Milestone 8.5 in a real browser: with the Mega Ring and Venusaurite in the
// Bag, the battle menu offers "Mega", and choosing it before a move turns
// Venusaur into Mega Venusaur on screen.

const scene = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function waitForScene(page: Page, key: string, timeout = 20_000) {
  await expect.poll(() => scene(page), { timeout }).toBe(key);
  await page.waitForTimeout(250);
}

async function startRun(page: Page, seed: string) {
  await page.goto(`/?seed=${seed}&debug=1`);
  await waitForScene(page, 'MainMenu');
  for (const next of ['Hub', 'TrainerSelect', 'RunPrep', 'StarterSelect', 'Briefing', 'Map']) {
    await page.keyboard.press('Enter');
    await waitForScene(page, next);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__pkr.game.scene.getScene('Map').busy), { timeout: 10_000 }).toBe(false);
}

const textureOf = (page: Page) =>
  page.evaluate(() => {
    const sprite = (window as any).__pkr.game.scene.getScene('Battle').playerSprite;
    return sprite?.texture?.key ?? sprite?.list?.find((c: any) => c.texture)?.texture?.key ?? null;
  });

const menuLabels = (page: Page) =>
  page.evaluate(() => (window as any).__pkr.game.scene.getScene('Battle').menu?.config?.options?.map((o: any) => o.label) ?? null);

/** Waits for a transformation cinematic (battleFx/cinematics.ts) to be on screen, then screenshots it. */
async function seeCinematic(page: Page, kind: string, shot: string, after = 900) {
  const showing = () => page.evaluate((k) => (window as any).__pkr.game.scene.getScene('Battle').children.list.some((c: any) => c.name === `cine-${k}`), kind);
  await expect.poll(showing, { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(after);
  await page.screenshot({ path: `test-results/${shot}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('Mega Evolution happens by itself in battle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-mega');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('venusaur', 50);
    session.run.party.unshift(session.run.party.pop());
    session.debugGiveItem('mega-ring', 1);
    session.debugGiveItem('venusaurite', 1);
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 60);
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => textureOf(page), { timeout: 10_000 }).toBe('pokemon.back.3');
  // PokeRogue style: no Mega button; it Mega Evolves before its first move.
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toEqual(['Fight', 'Bag', 'Pokémon']);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  // The EBDX crystal builds around Venusaur and shatters into the new form.
  await seeCinematic(page, 'mega', 'm8_5-mega-crystal', 1000);
  await expect.poll(() => textureOf(page), { timeout: 15_000 }).toBe('pokemon.back.3-mega');
  await page.screenshot({ path: 'test-results/m8_5-mega-venusaur.png' });
  expect(await page.evaluate(() => (window as any).__pkr.session.run.party[0].speciesId)).toBe('venusaur-mega');
  expect(errors).toEqual([]);
});

test('Terastallization from the battle menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-tera');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('charizard', 50);
    session.run.party.unshift(session.run.party.pop());
    session.run.party[0].teraType = 'water';
    session.debugGiveItem('tera-orb', 1);
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 60);
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toEqual(['Fight', 'Bag', 'Pokémon', 'Tera: OFF']);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menuLabels(page)).toEqual(['Fight', 'Bag', 'Pokémon', 'Tera: ON']);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  const teraType = () =>
    page.evaluate(() => {
      const { session } = (window as any).__pkr;
      return session.run.battle?.transform.teraTypes[session.run.party[0].uid] ?? null;
    });
  await seeCinematic(page, 'tera', 'm8_5-tera-cinematic', 600);
  await expect.poll(teraType, { timeout: 15_000 }).toBe('water');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/m8_5-tera-charizard.png' });
  expect(errors).toEqual([]);
});

test('Z-Move from the battle menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-zmove');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('pikachu', 50);
    session.run.party.unshift(session.run.party.pop());
    session.run.party[0].moves = [{ id: 'thunderbolt', pp: 15 }, { id: 'growl', pp: 40 }];
    session.debugGiveItem('z-ring', 1);
    session.debugGiveItem('electrium-z', 1);
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 60);
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toEqual(['Fight', 'Bag', 'Pokémon', 'Z: OFF']);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menuLabels(page)).toEqual(['Fight', 'Bag', 'Pokémon', 'Z-Move: ON']);
  await page.keyboard.press('Enter');
  // Thunderbolt shows as its Z-Move; Growl is Normal and there's no Normalium Z, so it stays plain (and can't be picked).
  await expect.poll(() => menuLabels(page)).toEqual(['Gigavolt Havoc', 'Growl']);
  await page.screenshot({ path: 'test-results/m8_5-zmove-menu.png' });
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  const used = () => page.evaluate(() => (window as any).__pkr.session.run.battle?.transform.used.player ?? null);
  await seeCinematic(page, 'zmove', 'm8_5-zmove-cinematic');
  await expect.poll(used, { timeout: 15_000 }).toEqual(['zmove']);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/m8_5-zmove-used.png' });
  expect(errors).toEqual([]);
});

test('Gigantamax from the battle menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, 'e2e-dynamax');
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    session.debugAddToParty('charizard', 50);
    session.run.party.unshift(session.run.party.pop());
    session.run.party[0].moves = [{ id: 'flamethrower', pp: 15 }, { id: 'growl', pp: 40 }];
    session.debugGiveItem('dynamax-band', 1);
  });
  await page.keyboard.press('Enter');
  await waitForScene(page, 'Battle');
  await page.evaluate(() => {
    const { session, game } = (window as any).__pkr;
    session.debugReplaceEnemy('snorlax', 70);
    session.run.battle.enemyTeam[0].moves = [{ id: 'growl', pp: 40 }];
    game.scene.getScene('Battle').scene.restart();
  });
  await waitForScene(page, 'Battle');
  await expect.poll(() => menuLabels(page), { timeout: 15_000 }).toEqual(['Fight', 'Bag', 'Pokémon', 'Max: OFF']);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => menuLabels(page)).toEqual(['Fight', 'Bag', 'Pokémon', 'Dynamax: ON']);
  await page.keyboard.press('Enter');
  // Flamethrower becomes Charizard's G-Max Move; Growl becomes Max Guard.
  await expect.poll(() => menuLabels(page)).toEqual(['G-Max Wildfire', 'Max Guard']);
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  const species = () => page.evaluate(() => (window as any).__pkr.session.run.party[0].speciesId);
  await seeCinematic(page, 'gigantamax', 'm8_5-gmax-cinematic', 600);
  await expect.poll(species, { timeout: 15_000 }).toBe('charizard-gmax');
  await expect.poll(() => textureOf(page), { timeout: 15_000 }).toBe('pokemon.back.6-gigantamax');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/m8_5-gigantamax.png' });
  expect(errors).toEqual([]);
});
