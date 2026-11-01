import { expect, test, type Page } from '@playwright/test';

// Spec 2, 3 and 12 (major update): node text has no Pokémon-level commentary, the run screen's buttons never cover
// the party or the info line, and long names are cut with "..." inside their boxes instead of running over neighbours.

const active = (page: Page) => page.evaluate(() => (window as any).__pkr?.activeScene() ?? null);

async function startRun(page: Page, long: boolean) {
  await page.goto('/?debug=1');
  await expect.poll(() => active(page), { timeout: 30_000 }).toBe('MainMenu');
  await page.evaluate((longNames) => {
    const { session } = (window as any).__pkr;
    session.newRun('red', 'clip-seed');
    session.chooseStarter(0);
    const run = session.run;
    if (longNames) {
      for (const key of ['species', 'items', 'catalog', 'moves', 'abilities', 'rewards', 'events']) {
        const map = session.content[key];
        for (const [id, v] of [...map.entries()]) {
          if (v && typeof v.name === 'string') map.set(id, { ...v, name: `${v.name} of Unending Splendour Deluxe`, ...(typeof v.description === 'string' ? { description: `${v.description} And a very long extra sentence that goes on and on.` } : {}) });
        }
      }
    }
    for (let i = 0; i < 5; i++) run.party.push({ ...structuredClone(run.party[0]), uid: `clip-${i}` });
    for (let i = 0; i < 4; i++) run.eggs.push({ id: `egg-${i}`, left: i + 1, unit: 'stage', speciesId: run.party[0].speciesId });
    for (const id of [...session.content.items.keys()].slice(0, 12)) run.inventory[id] = (run.inventory[id] ?? 0) + 2;
  }, long);
}

async function start(page: Page, key: string, data?: unknown) {
  await page.evaluate(([k, d]) => { const { game } = (window as any).__pkr; for (const s of game.scene.getScenes(true)) s.scene.stop(); game.scene.start(k, d); }, [key, data] as const);
  await expect.poll(() => active(page), { timeout: 20_000 }).toBe(key);
  await page.waitForTimeout(1500);
}

/** Every pair of visible texts that cover each other, plus texts that stand outside the 960x540 screen. */
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScenes(true)[0];
    const walk = (list: any[]): any[] => list.flatMap((c) => (c.list ? walk(c.list) : [c]));
    // A menu on top of the screen (depth 100) hides everything under it, so only its texts count.
    const modal = scene.children.list.filter((c: any) => c.depth >= 100 && c.visible);
    // Rows scrolled out of a masked list are not drawn at all.
    const maskedOut = (o: any) => {
      for (let p = o.parentContainer; p; p = p.parentContainer) if (p.mask) { const b = o.getBounds(); return b.bottom > 462 || b.y < 76; }
      return false;
    };
    const texts = walk(modal.length ? modal : scene.children.list).filter((o: any) => o.type === 'Text' && o.visible && o.alpha > 0.3 && String(o.text).trim().length > 1 && !maskedOut(o));
    const out: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].getBounds();
        const b = texts[j].getBounds();
        const ox = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        if (ox > 6 && oy > 0.5 * Math.min(a.height, b.height)) out.push(`"${texts[i].text}" over "${texts[j].text}"`);
      }
    }
    return out;
  });

test('map: no level commentary on nodes, and the bottom panel keeps party, buttons and info apart', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, false);
  await start(page, 'Map');
  const info = await page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScene('Map');
    const texts: string[] = [];
    scene.options.forEach((o: any, i: number) => {
      if (o.kind !== 'node') return;
      scene.focus(i, false);
      texts.push(scene.info.text);
    });
    return texts;
  });
  expect(info.length).toBeGreaterThan(0);
  for (const t of info) expect(t).not.toMatch(/\bLv ?\d|enemy levels/);
  // Nothing in the map's lower panel is cut off or covers something else.
  const panel = await page.evaluate(() => {
    const scene = (window as any).__pkr.game.scene.getScene('Map');
    const walk = (list: any[]): any[] => list.flatMap((c) => (c.list ? walk(c.list) : [c]));
    const texts = walk(scene.children.list).filter((o: any) => o.type === 'Text' && o.visible && String(o.text).trim() && o.getBounds().y > 420);
    return texts.map((o: any) => { const b = o.getBounds(); return { text: String(o.text), x: b.x, y: b.y, right: b.right, bottom: b.bottom }; });
  });
  expect(panel.length).toBeGreaterThan(8);
  for (const b of panel) {
    expect(b.bottom, b.text).toBeLessThanOrEqual(540);
    expect(b.right, b.text).toBeLessThanOrEqual(960);
  }
  expect(await overlaps(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('long names are cut inside their boxes on Shop, Hub pages and field menus', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRun(page, true);
  await start(page, 'Map');
  await page.evaluate(() => { (window as any).__pkr.session.run.money = 3000; });
  await start(page, 'Shop');
  expect(await overlaps(page), 'shop').toEqual([]);
  await start(page, 'Map');
  for (const kind of ['party', 'bag', 'bond']) {
    await page.evaluate((k) => { const s = (window as any).__pkr.game.scene.getScene('Map'); s.activate(s.options.findIndex((o: any) => o.kind === k)); }, kind);
    await page.waitForTimeout(1200);
    const found = (await overlaps(page)).filter((o) => !/^"(Enter choose|Party|Bag|Bonds|Album|Story|Summary)/.test(o));
    expect(found, kind).toEqual([]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  expect(errors).toEqual([]);

  // Reward cards and an event screen with long names and descriptions.
  await page.evaluate(() => { const { session } = (window as any).__pkr; session.run.phase = 'reward'; session.run.draft = ['item:amulet-coin', 'item:pp-up', 'item:big-pearl', 'item:leftovers', 'item:charcoal']; });
  await start(page, 'Reward');
  expect(await overlaps(page), 'reward').toEqual([]);
  await page.evaluate(() => {
    const { session } = (window as any).__pkr;
    const run = session.run;
    run.phase = 'map';
    const node = run.stage.map.nodes.find((n: any) => n.column === 1);
    node.sides.push({ id: 'clip-event', kind: 'event', used: false, eventId: 'department-store-sale' });
    run.stage.current = node.id;
    run.stage.visited = [node.id];
  });
  await start(page, 'Event', { sideId: 'clip-event' });
  expect(await overlaps(page), 'event').toEqual([]);
  expect(errors).toEqual([]);
});
