// Care & party life (W2): care actions, per-stop limits, mood/fatigue/talent/training stat nudges, saves.

import { describe, expect, it } from 'vitest';
import { careAction, careFaint, careMultiplier, careProblem, careVictory, careOf, careRest, teamworkOnSwitch, careMoves, swapForms, careAceFell, evolutionPreview, healFirst, tapsOf, releaseGift, berryFlavor, favoriteFlavor, hatedFlavor, CARE } from '../../src/core/care';
import { tradeCandidates } from '../../src/core/events';
import { bondOf } from '../../src/core/bond';
import { evolutionTarget } from '../../src/core/evolution';
import { createPokemon, calcStats } from '../../src/core/pokemon';
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

describe('dress-up, egg songs and release gifts', () => {
  it('an accessory gives a tiny buff to one stat and can come off', () => {
    let run = setup();
    const base = calcStats(content, run.party[0]!);
    run = careAction(content, run, 0, 'dress', 'scarf').run;
    expect(calcStats(content, run.party[0]!).def).toBeGreaterThanOrEqual(base.def);
    expect(careMultiplier(run.party[0]!.care, 'def')).toBeGreaterThan(1);
    expect(() => careAction(content, run, 0, 'dress', 'crown')).toThrow();
    run = careAction(content, run, 0, 'dress', '').run;
    expect(careMultiplier(run.party[0]!.care, 'def')).toBe(1);
  });

  it('singing moves Eggs one step but never hatches them, once per stop', () => {
    const run = setup();
    expect(careProblem(content, run, 0, 'sing')).toMatch(/no Eggs/);
    run.eggs = [{ kind: 'ordinary', left: 1, unit: 'battle', speciesId: 'pidgey', level: 3 } as never, { kind: 'ordinary', left: 4, unit: 'battle', speciesId: 'pidgey', level: 3 } as never];
    const out = careAction(content, run, 0, 'sing').run;
    expect(out.eggs.map((e) => e.left)).toEqual([1, 3]);
    expect(careProblem(content, out, 0, 'sing')).toMatch(/Already/);
  });

  it('release gift is a few extra candies by level', () => {
    expect(releaseGift(content, 45)).toBe(2);
    expect(releaseGift(content, 5)).toBe(0);
  });
});

describe('fetch and bedtime story', () => {
  it('fetch is once per stop and can bring back a loose berry', () => {
    let run = setup();
    let got = 0;
    for (let i = 0; i < 12; i++) {
      run.encountersCompleted = i;
      run = careAction(content, run, 0, 'fetch').run;
      got = Object.values(run.looseHeld ?? {}).reduce((a, b) => a + b, 0);
    }
    expect(got).toBeGreaterThan(0);
    expect(careProblem(content, run, 0, 'fetch')).toMatch(/Already/);
  });

  it('a story needs trust and is heard once', () => {
    let run = setup();
    run.party[0]!.friendship = 0;
    expect(careProblem(content, run, 0, 'story')).toMatch(/trust/);
    run.party[0]!.friendship = 100;
    run = careAction(content, run, 0, 'story').run;
    expect(careProblem(content, run, 0, 'story')).toMatch(/heard/);
    expect(run.party[0]!.care!.mood).toBe(CARE.story.mood);
  });
});

describe('tap mini-interactions', () => {
  it('a good tapping gives the cheer, groom and wake bonuses; a poor one does not', () => {
    const a = careAction(content, setup(), 0, 'cheer', `tap:${CARE.tap.goal}`).run.party[0]!.care!.mood;
    const b = careAction(content, setup(), 0, 'cheer', 'tap:1').run.party[0]!.care!.mood;
    expect(a - b).toBe(CARE.tap.cheerBonusMood);
    const run = setup();
    careOf(run.party[0]!).fatigue = 3;
    expect(careAction(content, run, 0, 'wake', 'tap:9').run.party[0]!.care!.fatigue).toBe(3 - CARE.tap.wakeFatigue - CARE.tap.wakeBonusFatigue);
    expect(careProblem(content, setup(), 0, 'wake')).toMatch(/not tired/);
    expect(tapsOf('tap:abc')).toBe(0);
  });
});

describe('favourite, ace, previews', () => {
  it('a favourite is never offered as trade fodder and cannot be swapped out', () => {
    let run = setup();
    const want = { species: [], minLevel: 0 } as never;
    expect(tradeCandidates(content, run, want).length).toBe(1);
    run = careAction(content, run, 0, 'favourite').run;
    expect(tradeCandidates(content, run, want).length).toBe(0);
  });

  it('an ace is remembered on the memorial and its fall shakes the team', () => {
    let run = setup();
    run.party.push({ ...structuredClone(run.party[0]!), uid: 'friend', care: undefined });
    run.party[1]!.level = 99;
    run = careAction(content, run, 0, 'ace').run;
    run.rules = { ...run.rules, mode: 'nuzlocke' } as never;
    careAceFell(run, run.party[0]!.uid);
    expect(run.party[1]!.care!.mood).toBe(-1);
    expect(run.party[0]!.care!.ace).toBe(true);
  });

  it('shows evolutions and the heal-first suggestion', () => {
    const run = setup();
    const mon = run.party[0]!;
    const lines = evolutionPreview(content, mon);
    expect(Array.isArray(lines)).toBe(true);
    expect(healFirst(content, run)).toBeNull();
    mon.hp = 1;
    expect(healFirst(content, run)?.uid).toBe(mon.uid);
  });
});

describe('show off and hold evolution', () => {
  it('show-off raises hyper readiness once per stop', () => {
    const run = setup();
    const before = bondOf(run, run.party[0]!.uid).hyperReadiness;
    const out = careAction(content, run, 0, 'showoff').run;
    expect(bondOf(out, out.party[0]!.uid).hyperReadiness).toBe(before + CARE.showoff.hyperReadiness);
    expect(careProblem(content, out, 0, 'showoff')).toMatch(/Already/);
  });

  it('a held evolution does not happen until a healing stop', () => {
    let run = setup();
    const mon = run.party[0]!;
    mon.level = 100;
    mon.friendship = 255;
    const before = evolutionTarget(content, mon);
    run = careAction(content, run, 0, 'hold').run;
    expect(evolutionTarget(content, run.party[0]!)).toBeNull();
    expect(careRest(run)).toEqual([run.party[0]!.uid]);
    expect(evolutionTarget(content, run.party[0]!)).toBe(before);
  });
});

describe('teamwork, stars, whistle, forms', () => {
  it('whistle gives a next-fight boost, once per stop, only when trusted', () => {
    const run = setup();
    bondOf(run, run.party[0]!.uid).trust = 10;
    expect(careProblem(content, run, 0, 'whistle', 'focus')).toMatch(/trust/);
    bondOf(run, run.party[0]!.uid).trust = 80;
    expect(careProblem(content, run, 0, 'whistle', 'bogus')).toMatch(/Pick/);
    const out = careAction(content, run, 0, 'whistle', 'focus').run;
    expect(out.party[0]!.boosts).toContainEqual({ kind: 'stage', stat: 'crit', stages: 1, turns: 4 });
    expect(careProblem(content, out, 0, 'whistle', 'rush')).toMatch(/Already/);
  });

  it('teamwork boosts a pair member sent in beside its partner, once per battle', () => {
    const run = setup();
    run.party[0]!.speciesId = 'plusle';
    run.party.push({ ...structuredClone(run.party[0]!), uid: 'minun', speciesId: 'minun' });
    run.party.push({ ...structuredClone(run.party[0]!), uid: 'p3', speciesId: 'plusle' });
    run.battle = { drama: { combos: [] }, playerStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0, crit: 0 } } as never;
    const first = teamworkOnSwitch(run, 'minun');
    expect(first?.name).toBe('Double Spark');
    expect((run.battle as unknown as { playerStages: { spa: number } }).playerStages.spa).toBe(1);
    expect(teamworkOnSwitch(run, 'minun')).toBeNull();
  });

  it('a move earns a mastery star after enough uses', () => {
    const run = setup();
    const mon = run.party[0]!;
    run.battle = { doubles: false, activeIndex: 0 } as never;
    const ev = Array.from({ length: CARE.stars.usesForStar }, () => ({ type: 'move', side: 'player', moveId: mon.moves[0]!.id }));
    expect(careMoves(run, ev)).toEqual([mon.moves[0]!.id]);
    expect(mon.moves[0]!.star).toBe(true);
  });

  it('Castform takes the season form at a healing stop', () => {
    const run = setup();
    run.party[0]!.speciesId = 'castform';
    run.clock.day = 1 + content.balance.clock.seasonLength; // Summer
    expect(swapForms(content, run)).toBe(1);
    expect(run.party[0]!.speciesId).toBe('castform-sunny');
  });
});

it('sing-along is for singers and a good one protects the team from sleep', () => {
  const run = setup();
  expect(careProblem(content, run, 0, 'singalong')).toMatch(/singers/);
  run.party[0]!.speciesId = 'jigglypuff';
  const out = careAction(content, run, 0, 'singalong', `tap:${CARE.tap.goal}`).run;
  expect(out.party[0]!.boosts).toContainEqual({ kind: 'immune', status: 'slp' });
});

describe('whole-team activities and more forms', () => {
  function team(): RunState {
    const run = setup();
    for (const [id, uid] of [['pidgey', 'b2'], ['rattata', 'b3'], ['caterpie', 'b4']] as const) run.party.push(createPokemon(content, id, 10, uid));
    return run;
  }
  it('team dance lifts everyone, more with good tapping; needs two Pokémon', () => {
    expect(careProblem(content, setup(), 0, 'teamdance')).toMatch(/two/);
    const run = team();
    const out = careAction(content, run, 0, 'teamdance', `tap:${CARE.tap.goal}`).run;
    expect(out.party.every((m) => m.care!.mood === CARE.team.dance.mood + CARE.team.dance.goodMood)).toBe(true);
  });
  it('camp race crowns the same winner every time', () => {
    const a = careAction(content, team(), 0, 'race').message;
    const b = careAction(content, team(), 0, 'race').message;
    expect(a).toBe(b);
    expect(a).toMatch(/wins/);
  });
  it('healing circle needs three healers', () => {
    const run = team();
    expect(careProblem(content, run, 0, 'healcircle')).toMatch(/needs/);
    for (const m of run.party.slice(0, 3)) m.moves = [{ id: 'recover', pp: 5 }];
    run.party.forEach((m) => (m.hp = 1));
    const out = careAction(content, run, 0, 'healcircle').run;
    expect(out.party[0]!.hp).toBeGreaterThan(1);
  });
  it('sparring trains both partners', () => {
    const out = careAction(content, team(), 0, 'spar', 'atk').run;
    expect(out.party[0]!.care!.train).toMatchObject({ stat: 'atk', left: CARE.team.spar.fights });
    expect(out.party[1]!.care!.train).toMatchObject({ stat: 'atk', left: CARE.team.spar.fights });
  });
  it('Oricorio takes a season style', () => {
    const run = setup();
    run.party[0]!.speciesId = 'oricorio';
    run.clock.day = 1;
    expect(swapForms(content, run)).toBe(1);
    expect(run.party[0]!.speciesId).toBe('oricorio-pom-pom');
  });
});
