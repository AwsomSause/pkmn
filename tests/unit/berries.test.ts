// Berry cultivation (spec §27): plant a held berry, it grows over stages, harvest it; mutations and cross-pollination are seeded.

import { describe, expect, it } from 'vitest';
import { BERRIES, growGarden, growTime, harvestPlot, plantBerry, plantableBerries, plantProblem, plotLabel, soilHere } from '../../src/core/berries';
import { layEgg, warmEggs } from '../../src/core/eggs';
import { applyEffect } from '../../src/core/events';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, hatchEggs } from '../../src/core/run';
import { serviceView, useService } from '../../src/core/services/flow';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { content } from './helpers';

const newRun = (seed = 'berries'): RunState => {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0));
  run.party[0]!.speciesId = 'machop'; // not Water/Grass, so no watering bonus unless a test adds one
  return run;
};
const holdBerry = (run: RunState, id = 'oran-berry', n = 2) => {
  run.party[0]!.held = { ...run.party[0]!.held, [id]: n };
};

describe('Berry garden', () => {
  it('plants one held berry, which grows for its rarity and is ripe after those stages', () => {
    const run = newRun();
    holdBerry(run);
    expect(plantableBerries(content, run.party[0]!)).toContain('oran-berry');
    const plot = plantBerry(content, run, run.party[0]!, 'oran-berry');
    expect(run.party[0]!.held!['oran-berry']).toBe(1);
    expect(run.garden).toHaveLength(1);
    expect(plot.left).toBe(growTime(content, run, 'oran-berry'));
    for (let i = 0; i < plot.left; i++) growGarden(run);
    expect(run.garden[0]!.left).toBe(0);
    growGarden(run);
    expect(run.garden[0]!.left).toBe(0);
    expect(plotLabel(content, run.garden[0]!)).toContain('ripe');
  });

  it('a Water or Grass type in the party waters the plot (one stage faster, never below 1)', () => {
    const run = newRun();
    const rare = growTime(content, run, 'lum-berry');
    run.party[0]!.speciesId = 'squirtle';
    expect(growTime(content, run, 'lum-berry')).toBe(Math.max(1, rare - 1));
    expect(growTime(content, run, 'oran-berry')).toBe(1);
  });

  it('the garden holds at most maxPlots', () => {
    const run = newRun();
    holdBerry(run, 'oran-berry', 9);
    for (let i = 0; i < BERRIES.maxPlots; i++) plantBerry(content, run, run.party[0]!, 'oran-berry');
    expect(plantProblem(run)).not.toBeNull();
  });

  it('a harvest gives the berries once and clears the plot; unripe plots cannot be harvested', () => {
    const run = newRun();
    holdBerry(run);
    const plot = plantBerry(content, run, run.party[0]!, 'oran-berry');
    if (plot.left > 0) expect(() => harvestPlot(content, run, plot.uid)).toThrow();
    growGarden(run);
    growGarden(run);
    const got = harvestPlot(content, run, plot.uid);
    expect(got.length).toBeGreaterThan(0);
    expect(run.garden).toEqual([]);
    expect(() => harvestPlot(content, run, plot.uid)).toThrow();
  });

  it('mutation and harvest are fixed by the seed', () => {
    const a = newRun('mut');
    const b = newRun('mut');
    holdBerry(a, 'occa-berry', 9);
    holdBerry(b, 'occa-berry', 9);
    const pa = [0, 1, 2].map(() => plantBerry(content, a, a.party[0]!, 'occa-berry').mutated);
    const pb = [0, 1, 2].map(() => plantBerry(content, b, b.party[0]!, 'occa-berry').mutated);
    expect(pa).toEqual(pb);
    let sawMutant = false;
    for (let i = 0; i < 80 && !sawMutant; i++) {
      const r = newRun(`m${i}`);
      holdBerry(r, 'occa-berry', 1);
      const p = plantBerry(content, r, r.party[0]!, 'occa-berry');
      if (p.mutated) {
        sawMutant = true;
        growGarden(r);
        growGarden(r);
        harvestPlot(content, r, p.uid);
        expect(r.party.some((m) => (m.held?.['hyper-occa-berry'] ?? 0) > 0)).toBe(true);
      }
    }
    expect(sawMutant).toBe(true);
  });

  it('survives save and reload (older saves load with an empty garden)', () => {
    const run = newRun();
    holdBerry(run);
    plantBerry(content, run, run.party[0]!, 'oran-berry');
    const loaded = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(loaded.garden).toEqual(run.garden);
    const old = JSON.parse(JSON.stringify(run));
    delete old.garden;
    expect(RunStateSchema.parse(old).garden).toEqual([]);
  });

  it('grows one step when a new stage starts (hatchEggs)', () => {
    const run = newRun();
    holdBerry(run, 'lum-berry', 1);
    plantBerry(content, run, run.party[0]!, 'lum-berry');
    const left = run.garden[0]!.left;
    hatchEggs(content, run);
    expect(run.garden[0]!.left).toBe(Math.max(0, left - 1));
  });
});

describe('Berry Garden stop and Berry Festival', () => {
  const stopRun = (): RunState => {
    const run = newRun('gstop');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'svc-test', kind: 'service', serviceId: 'garden', used: false } as never);
    run.stage!.current = node.id;
    run.money = 5000;
    return run;
  };
  it('offers Plant for held berries, then Harvest when ripe, and the stop stays open', () => {
    const run = stopRun();
    holdBerry(run);
    const plant = serviceView(content, run, 'svc-test').options.find((o) => o.id.startsWith('plant:'));
    expect(plant?.problem).toBeNull();
    const planted = useService(content, run, 'svc-test', plant!.id).run;
    expect(planted.garden).toHaveLength(1);
    planted.garden[0]!.left = 0;
    const harvest = serviceView(content, planted, 'svc-test').options.find((o) => o.id.startsWith('harvest:'));
    expect(harvest?.problem).toBeNull();
    const done = useService(content, planted, 'svc-test', harvest!.id);
    expect(done.run.garden).toEqual([]);
    expect(done.message).toContain('harvest');
    // reusable: the seeded berry is still on offer once, and plant options still work
    expect(serviceView(content, done.run, 'svc-test').options.some((o) => o.id.startsWith('berry:'))).toBe(true);
  });

  it('the festival is a themed game event whose stops only appear during it', () => {
    const fest = content.gameEvents.get('berry-festival')!;
    expect(fest.kind).toBe('themed');
    for (const id of fest.mapEvents) expect(content.events.get(id)?.gameEvent).toBe('berry-festival');
    expect(fest.mapEvents.length).toBeGreaterThanOrEqual(8);
  });

  it('the research tent seedling plants a mutated lansat berry, and does nothing when the garden is full', () => {
    const run = newRun();
    const ev = content.events.get('berry-fest-research')!;
    const effect = ev.choices[0]!.success.effects.find((e) => e.kind === 'seedling')!;
    const rng = new Rng(hashSeed('seedling'));
    expect(applyEffect(content, run, effect, rng)).toContain('seedling');
    expect(run.garden[0]).toMatchObject({ berryId: 'lansat-berry', mutated: true, left: 1 });
    for (let i = 0; i < BERRIES.maxPlots; i++) applyEffect(content, run, effect, rng);
    expect(run.garden).toHaveLength(BERRIES.maxPlots);
    expect(applyEffect(content, run, effect, rng)).toBe('');
  });
});

describe('Soil quality and camp warming', () => {
  it('soil follows the stage theme: rich, poor or fair, and rich soil yields one more berry', () => {
    const run = newRun('soil');
    const themes = [...content.themes.values()];
    const rich = themes.find((t) => t.types.some((x) => BERRIES.soil.rich!.types.includes(x)));
    const poor = themes.find((t) => !t.types.some((x) => BERRIES.soil.rich!.types.includes(x)) && t.types.some((x) => BERRIES.soil.poor!.types.includes(x)));
    run.stage!.themeId = rich!.id;
    expect(soilHere(content, run)).toBe('rich');
    if (poor) {
      run.stage!.themeId = poor.id;
      expect(soilHere(content, run)).toBe('poor');
    }
    run.stage!.themeId = rich!.id;
    holdBerry(run, 'oran-berry', 1);
    const plot = plantBerry(content, run, run.party[0]!, 'oran-berry');
    expect(plot.soil).toBe('rich');
    expect(plotLabel(content, plot)).toContain('rich soil');
  });

  it('a night of camp warms Eggs one step but never hatches them', () => {
    const run = newRun('camp');
    layEgg(content, run, 'charmander', { level: 5, left: 3, unit: 'stage', source: 'Test' }, new Rng(hashSeed('e')));
    expect(warmEggs(run, 1)).toBe(1);
    expect(run.eggs[0]!.left).toBe(2);
    warmEggs(run, 5);
    expect(run.eggs[0]!.left).toBe(1);
    expect(warmEggs(run, 1)).toBe(0);
  });
});
