import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { applyCatalog, getCatalogEntry, isCatalogUseful } from '../../src/core/catalog';
import { throwMultiplier } from '../../src/core/mapItems';
import { maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseReward, chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { catalogRewardId } from '../../src/data';
import { content } from './helpers';

const newRun = (): RunState => chooseStarter(content, createRun(content, { runId: 'r', seed: 'sweep', archetypeId: 'red' }), 0);

/** Takes every working catalog item once: it must not throw, and must change something the player can see. */
describe('every catalog item can be taken', () => {
  const noEffect: string[] = [];
  const threw: string[] = [];
  for (const entry of content.catalog.values()) {
    if (entry.status !== 'supported') continue;
    it(entry.id, () => {
      const run = { ...newRun(), money: 0 };
      run.phase = 'reward';
      run.draft = [catalogRewardId(entry.id)];
      if (!isCatalogUseful(content, run, entry)) return;
      const before = JSON.stringify({ ...run, draft: null, phase: null });
      let after: RunState;
      try {
        after = chooseReward(content, run, 0, 0).run;
      } catch (e) {
        threw.push(`${entry.id}: ${(e as Error).message}`);
        throw e;
      }
      if (JSON.stringify({ ...after, draft: null, phase: null }) === before) noEffect.push(entry.id);
      expect(JSON.stringify({ ...after, draft: null, phase: null }), `${entry.id} changed nothing`).not.toBe(before);
    });
  }
});

describe('item audit regressions (icons and the new items)', () => {
  const take = (run: RunState, id: string) => applyCatalog(content, run, getCatalogEntry(content, id), run.party[0], { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });

  it('every catalog item has an icon file', () => {
    const missing = [...content.catalog.values()].filter((e) => !e.icon || !existsSync(`public/assets/images/items/gen5/${e.icon}.png`)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('Max Potion fully heals the target', () => {
    const run = newRun();
    run.party[0]!.hp = 1;
    take(run, 'max-potion');
    expect(run.party[0]!.hp).toBe(maxHp(content, run.party[0]!));
  });

  it('Catching Charm makes every throw easier', () => {
    const run = newRun();
    take(run, 'catching-charm');
    expect(throwMultiplier(content, run, run.party[0]!)).toBe(1.25);
  });
});
