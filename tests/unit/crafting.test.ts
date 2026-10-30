// Crafting: material drops, recipes, the Workshop stop and the save migration.

import { describe, expect, it } from 'vitest';
import { applyRecipe, CRAFTING, CraftingSchema, gainBattleMaterials, recipeProblem } from '../../src/core/crafting';
import { serviceView, useService } from '../../src/core/services/flow';
import { chooseStarter, createRun } from '../../src/core/run';
import { itemCount } from '../../src/core/items';
import type { RunState } from '../../src/core/state';
import craftingJson from '../../src/data/crafting.json';
import { content } from './helpers';
import { MemoryStorageProvider } from '../../src/save/storage';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';

function shopRun(seed = 'craft'): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'cr', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'ws', kind: 'service', serviceId: 'workshop', used: false }];
  run.stage!.current = node.id;
  run.money = 2000;
  return run;
}

describe('crafting data', () => {
  it('validates, and recipes only use known materials and items', () => {
    expect(CraftingSchema.safeParse(craftingJson).success).toBe(true);
    const mats = new Set(CRAFTING.materials.map((m) => m.id));
    for (const m of Object.values(CRAFTING.typeMaterial)) expect(mats.has(m)).toBe(true);
    for (const r of CRAFTING.recipes) {
      for (const id of Object.keys(r.cost)) expect(mats.has(id)).toBe(true);
      if (r.gives.kind === 'item') expect(content.items.has(r.gives.item)).toBe(true);
    }
  });
});

describe('material drops', () => {
  it('trainers pay by foe type, bosses add a Star Core, and the same key gives the same drop', () => {
    const a = shopRun();
    const b = structuredClone(a);
    expect(gainBattleMaterials(a, ['fire'], 'trainer', 0, 'x')).toEqual({ ember: 2 });
    expect(gainBattleMaterials(b, ['fire'], 'trainer', 0, 'x')).toEqual({ ember: 2 });
    const boss = gainBattleMaterials(a, ['water'], 'boss', 0, 'y');
    expect(boss.tide).toBe(4);
    expect(boss['star-core']).toBe(1);
  });
  it('raids pay by tier, and Star Cores only from the minimum tier', () => {
    const run = shopRun();
    expect(gainBattleMaterials(run, ['dark'], 'wild', 2, 'r')).toEqual({ aether: 2 });
    expect(gainBattleMaterials(run, ['dark'], 'wild', 5, 'r2')).toEqual({ aether: 5, 'star-core': 1 });
  });
});

describe('recipes and the Workshop stop', () => {
  it('refuses without the materials, then crafts once and spends them', () => {
    const run = shopRun();
    const view = serviceView(content, run, 'ws');
    expect(view.options.find((o) => o.id === 'craft:potion')!.problem).toMatch(/Needs 2 Herb Fiber/);
    run.materials = { fiber: 5 };
    const done = useService(content, run, 'ws', 'craft:potion');
    expect(itemCount(done.run.inventory, 'potion')).toBe(itemCount(run.inventory, 'potion') + 1);
    expect(done.run.materials.fiber).toBe(3);
    expect(run.materials.fiber).toBe(5);
    expect(() => useService(content, done.run, 'ws', 'craft:super-potion')).toThrow();
  });
  it('a rare-encounter token adds the temporary effect, and a Mega Stone needs a party member that can use one', () => {
    const run = shopRun();
    run.badges = ['a', 'b'] as never;
    run.materials = { aether: 8, 'star-core': 4, ember: 2 };
    const token = CRAFTING.recipes.find((r) => r.id === 'rare-token')!;
    expect(recipeProblem(content, run, token)).toBeNull();
    applyRecipe(content, run, token);
    expect(run.tempEffects.at(-1)!.battles).toBe(2);
    const stone = CRAFTING.recipes.find((r) => r.id === 'mega-stone')!;
    run.party[0]!.speciesId = 'charizard';
    expect(recipeProblem(content, run, stone)).toBeNull();
    const before = run.money;
    applyRecipe(content, run, stone);
    expect(run.money).toBe(before - stone.money);
    expect(itemCount(run.inventory, 'charizardite-x') + itemCount(run.inventory, 'charizardite-y')).toBe(1);
    expect(itemCount(run.inventory, 'mega-ring')).toBe(1);
  });
});

describe('save', () => {
  it('a version 23 run loads with no materials', () => {
    const storage = new MemoryStorageProvider();
    const { materials: _m, ...old } = shopRun('save23');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 23, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(23);
    expect(loaded.data.materials).toEqual({});
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(24);
  });
});
