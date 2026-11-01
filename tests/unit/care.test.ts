// Care & party life (W2): care actions, per-stop limits, mood/fatigue/talent/training stat nudges, saves.

import { describe, expect, it } from 'vitest';
import { careAction, careFaint, careMultiplier, careProblem, careVictory, careOf, berryFlavor, favoriteFlavor, hatedFlavor, CARE } from '../../src/core/care';
import { calcStats } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { content } from './helpers';

function setup(): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'care', seed: 'care', archetypeId: 'red' }), 0));
  run.phase = 'map';
  return run;
}
const berryIds = () => [...content.catalog.values()].filter((e) => e.family.startsWith('Berries')).map((e) => e.id);

describe('care actions', () => {
  it('pets up to the per-stop limit, then resets next stop', () => {
    let run = setup();
    const before = run.party[0]!.friendship;
    for (let i = 0; i < CARE.pet.perStop; i++) run = careAction(content, run, 0, 'pet').run;
    expect(run.party[0]!.friendship).toBeGreaterThan(before);
    expect(careProblem(content, run, 0, 'pet')).toMatch(/enough/);
    expect(() => careAction(content, run, 0, 'pet')).toThrow();
    run.encountersCompleted += 1;
    expect(careProblem(content, run, 0, 'pet')).toBeNull();
  });

  it('hugs once per stop and raises mood and affection', () => {
    const run = setup();
    const out = careAction(content, run, 0, 'hug').run;
    expect(out.party[0]!.care!.mood).toBe(CARE.hug.mood);
    expect(careProblem(content, out, 0, 'hug')).toMatch(/already/);
    expect(run.party[0]!.care).toBeUndefined();
  });

  it('feeds a loose berry with flavor reactions and sulks on a hated one', () => {
    const run = setup();
    const mon = run.party[0]!;
    expect(careProblem(content, run, 0, 'feed')).toMatch(/no loose berries/);
    const hated = berryIds().find((b) => berryFlavor(b) === hatedFlavor(mon))!;
    const liked = berryIds().find((b) => berryFlavor(b) === favoriteFlavor(mon))!;
    run.looseHeld = { [hated]: 1, [liked]: 1 };
    const first = careAction(content, run, 0, 'feed').run; // liked first
    expect(first.looseHeld![liked]).toBeUndefined();
    expect(first.party[0]!.care!.mood).toBe(CARE.feed.liked.mood);
    first.encountersCompleted += 1;
    const second = careAction(content, first, 0, 'feed').run;
    expect(second.party[0]!.care!.mood).toBe(CARE.feed.liked.mood + CARE.feed.hated.mood);
    second.encountersCompleted += 1;
    expect(careProblem(content, second, 0, 'feed')).toBeTruthy();
  });

  it('lullaby heals extra and groom clears status; both once per stop', () => {
    const run = setup();
    run.party[0]!.hp = 1;
    run.party[0]!.status = { id: 'psn' } as never;
    const a = careAction(content, run, 0, 'lullaby').run;
    expect(a.party[0]!.hp).toBeGreaterThan(1);
    expect(careProblem(content, a, 0, 'lullaby')).toBeTruthy();
    const b = careAction(content, a, 0, 'groom').run;
    expect(b.party[0]!.status).toBeNull();
    expect(b.party[0]!.care!.sparkle).toBe(true);
  });

  it('refuses care in battle and on a fainted Pokémon', () => {
    const run = setup();
    run.phase = 'battle';
    expect(careProblem(content, run, 0, 'pet')).toMatch(/between battles/);
    run.phase = 'map';
    run.party[0]!.hp = 0;
    expect(careProblem(content, run, 0, 'hug')).toMatch(/fainted/);
    expect(careProblem(content, run, 0, 'favourite')).toBeNull();
  });

  it('nickname trims and clears; favourite and ace toggle', () => {
    let run = setup();
    run = careAction(content, run, 0, 'nickname', '  Sparky   the great one ').run;
    expect(run.party[0]!.care!.nickname).toBe('Sparky the g');
    run = careAction(content, run, 0, 'nickname', '').run;
    expect(run.party[0]!.care!.nickname).toBeUndefined();
    run = careAction(content, run, 0, 'favourite').run;
    run = careAction(content, run, 0, 'ace').run;
    expect(run.party[0]!.care!.favourite && run.party[0]!.care!.ace).toBe(true);
  });
});

describe('mood, fatigue, talent and training', () => {
  it('mood and fatigue nudge non-HP stats only', () => {
    const run = setup();
    const mon = run.party[0]!;
    const base = calcStats(content, mon);
    careOf(mon).mood = 3;
    const happy = calcStats(content, mon);
    expect(happy.hp).toBe(base.hp);
    expect(happy.atk).toBeGreaterThanOrEqual(base.atk);
    careOf(mon).mood = 0;
    careOf(mon).fatigue = 4;
    expect(calcStats(content, mon).atk).toBeLessThan(base.atk);
    expect(careMultiplier(undefined, 'atk')).toBe(1);
  });

  it('victory tires fighters, rests the bench, tracks the journal and reveals a talent', () => {
    const run = setup();
    const [a] = run.party;
    run.party.push({ ...structuredClone(a!), uid: 'bench' });
    a!.friendship = 255;
    for (let i = 0; i < CARE.talent.afterFights; i++) careVictory(run, [a!.uid]);
    expect(a!.care!.fights).toBe(CARE.talent.afterFights);
    expect(a!.care!.fatigue).toBe(CARE.fatigue.max);
    expect(a!.care!.talent).toBeTruthy();
    expect(run.party[1]!.care!.fatigue).toBe(0);
    expect(run.party[1]!.care!.mood).toBeLessThan(0); // sulked after 3 benched wins
  });

  it('training boosts the picked stat for exactly N fights', () => {
    let run = setup();
    run = careAction(content, run, 0, 'train', 'spe').run;
    const mon = run.party[0]!;
    expect(careMultiplier(mon.care, 'spe')).toBeGreaterThan(1);
    for (let i = 0; i < CARE.train.fights; i++) careVictory(run, [mon.uid]);
    expect(mon.care!.train).toBeUndefined();
    expect(() => careAction(content, run, 0, 'train', 'hp')).toThrow();
  });

  it('a faint costs mood and adds to the journal', () => {
    const run = setup();
    careFaint(run.party[0]!);
    expect(run.party[0]!.care).toMatchObject({ falls: 1, mood: CARE.faintMood });
  });
});

describe('saves', () => {
  it('a run with care data round-trips and an old run without it loads', () => {
    const run = careAction(content, setup(), 0, 'hug').run;
    expect(RunStateSchema.parse(JSON.parse(JSON.stringify(run))).party[0]!.care!.mood).toBe(CARE.hug.mood);
    const old = JSON.parse(JSON.stringify(setup()));
    expect(RunStateSchema.parse(old).party[0]!.care).toBeUndefined();
  });
});
