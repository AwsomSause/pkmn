// Nemesis system (left-out plan 1.3, Techno §2) and its Overdrive moments:
// Incident → Return → Reckoning, archetypes, the rarity roll, and the seven
// missing Hyper lines.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { freshSos } from '../../src/core/battle/sos';
import type { Content } from '../../src/core/contentSchema';
import type { TrainerPlan } from '../../src/core/encounters';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { beginNemesisBattle, counterTypes, dueNemesis, isHunted, nemesisAfterBattle, nemesisMember, nemesisTrainerPlan, noteNemesisBreakFree, noteNemesisFaint, NEMESIS_STAGE_FLAG } from '../../src/core/story/nemesis';
import type { Nemesis } from '../../src/core/story/schema';
import { MIGRATIONS } from '../../src/save/saveManager';
import { content, toBattle } from './helpers';

/** Content where every rarity roll passes (the real chance is tested separately). */
const always: Content = { ...content, story: { ...content.story, rarity: { ...content.story.rarity, momentChance: 1 } } };
const never: Content = { ...content, story: { ...content.story, rarity: { ...content.story.rarity, momentChance: 0 } } };

function weakFoe(uid: string, speciesId = 'rattata', level = 5): PokemonInstance {
  const mon = createPokemon(content, speciesId, level, uid);
  mon.hp = 1;
  mon.moves = [{ id: 'growl', pp: 40 }];
  return mon;
}

/** A run in battle with a strong Jolteon lead (at `hpShare` HP) against `foes`. */
function battleRun(kind: 'wild' | 'trainer', foes: PokemonInstance[], opts: { hpShare?: number; leaderId?: string | null; classId?: string; seed?: string } = {}): RunState {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'nem', seed: opts.seed ?? 'nem', archetypeId: 'red' }), 0)));
  const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
  lead.moves = [{ id: 'tackle', pp: 35 }];
  lead.hp = Math.max(1, Math.floor(maxHp(content, lead) * (opts.hpShare ?? 1)));
  run.party[0] = lead;
  run.battle = createBattle(kind, foes, 0, lead.uid, kind === 'trainer' ? { classId: opts.classId ?? 'youngster', name: 'Joey', leaderId: opts.leaderId ?? null } : undefined);
  run.battle.sos = { ...freshSos(), answered: 1 };
  return run;
}

const win = (c: Content, run: RunState) => takeTurn(c, run, { kind: 'move', index: 0 });

function nemesis(over: Partial<Nemesis> = {}): Nemesis {
  return {
    id: 'nemesis-0-0-1',
    speciesId: 'rattata',
    level: 5,
    source: 'wild',
    trainer: null,
    archetype: 'stalker',
    cause: 'starterKo',
    phase: 'return',
    formedAt: { region: 0, stage: 0, level: 3, node: null, battle: 1, turn: 2 },
    lastMet: { region: 0, stage: 0 },
    beat: ['bulbasaur'],
    foeTypes: ['grass'],
    wins: 0,
    changes: [],
    partner: null,
    settledAs: null,
    ...over,
  };
}

describe('Nemesis: the Incident', () => {
  it('a wild Pokémon that broke free and was then beaten becomes a Survivor (This Enemy Will Return…)', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    noteNemesisBreakFree(run, 'e1');
    const result = win(always, run);
    expect(result.run.story.nemeses).toHaveLength(1);
    expect(result.run.story.nemeses[0]).toMatchObject({ speciesId: 'rattata', archetype: 'survivor', cause: 'escaped', phase: 'return', source: 'wild' });
    expect(result.cues.map((c) => c.title)).toContain('This Enemy Will Return…');
    expect(result.run.story.events.some((e) => e.type === 'nemesisFormed')).toBe(true);
  });

  it('respects the rarity roll: nothing forms when the roll fails, and the real 30% chance is used', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    noteNemesisBreakFree(run, 'e1');
    expect(win(never, run).run.story.nemeses).toEqual([]);
    expect(content.story.rarity.momentChance).toBe(0.3);
  });

  it('an ordinary battle with no incident makes no nemesis', () => {
    expect(win(always, battleRun('wild', [weakFoe('e1')])).run.story.nemeses).toEqual([]);
  });

  it('a foe that knocked out your starter becomes a nemesis; one that knocked out the Pokémon that felled its partner is an Avenger', () => {
    const run = battleRun('trainer', [weakFoe('e1'), weakFoe('e2')]);
    run.battle!.outcome = 'win';
    noteNemesisFaint(run, 'enemy', 'e1', 'mate');
    noteNemesisFaint(run, 'player', 'mate', 'e2');
    const moments = nemesisAfterBattle(always, run, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(run.story.nemeses[0]).toMatchObject({ archetype: 'avenger', cause: 'avenged', source: 'trainer', trainer: { classId: 'youngster', name: 'Joey' } });
    expect(moments.map((m) => m.trigger)).toEqual(['enemyWillReturn']);

    const starter = battleRun('trainer', [weakFoe('e1')]);
    starter.battle!.outcome = 'win';
    noteNemesisFaint(starter, 'player', starter.log.starterUid!, 'e1');
    nemesisAfterBattle(always, starter, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(starter.story.nemeses[0]).toMatchObject({ cause: 'starterKo', archetype: 'unfinished' });
  });

  it("a boss's ace that barely lost swears it isn't over (Fallen Ace for the Elite Four, Unfinished Business for a gym)", () => {
    const run = battleRun('trainer', [weakFoe('e1'), weakFoe('e2', 'onix', 12)], { hpShare: 0.2, leaderId: 'brock', classId: 'gym-leader' });
    run.battle!.outcome = 'win';
    const moments = nemesisAfterBattle(always, run, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(run.story.nemeses[0]).toMatchObject({ speciesId: 'onix', source: 'boss', archetype: 'unfinished', cause: 'narrowBoss', trainer: { leaderId: 'brock' } });
    expect(moments.map((m) => m.trigger)).toEqual(['notOverBetweenUs']);
    const e4 = battleRun('trainer', [weakFoe('e1')], { hpShare: 0.2, leaderId: 'lorelei', classId: 'elite-four' });
    e4.battle!.outcome = 'win';
    nemesisAfterBattle(always, e4, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(e4.story.nemeses[0]?.archetype).toBe('fallenAce');
  });

  it('a foe that beat your team is remembered, at most one forms per region, and no more than two are open', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    run.battle!.outcome = 'lose';
    noteNemesisFaint(run, 'player', 'x', 'e1');
    nemesisAfterBattle(always, run, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(run.story.nemeses[0]).toMatchObject({ cause: 'defeat', wins: 1, archetype: 'stalker' });
    run.battle = createBattle('wild', [weakFoe('e9')], 0, run.party[0]!.uid);
    run.battle.outcome = 'lose';
    noteNemesisFaint(run, 'player', 'x', 'e9');
    nemesisAfterBattle(always, run, { region: 0, stage: 1, level: 1, node: null, battle: 2, turn: 3 });
    expect(run.story.nemeses).toHaveLength(1);
  });
});

describe('Nemesis: the Return and the Reckoning', () => {
  it('comes back in a later stage only, once per stage, never during the opening fights', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    run.story.nemeses = [nemesis()];
    run.encountersCompleted = 10;
    expect(dueNemesis(content, run, 'wild')).toBeNull(); // same stage as the Incident
    run.stage!.index = 1;
    expect(dueNemesis(content, run, 'wild')?.id).toBe('nemesis-0-0-1');
    expect(dueNemesis(content, run, 'trainer')).toBeNull(); // a wild nemesis waits on wild nodes
    run.story.flags[NEMESIS_STAGE_FLAG] = `${run.regionIndex}:1`;
    expect(dueNemesis(content, run, 'wild')).toBeNull();
    run.encountersCompleted = 0;
    run.story.flags = {};
    expect(dueNemesis(content, run, 'wild')).toBeNull();
  });

  it('returns at the planned level + bonus, evolved, with a move that answers the types that fought it', () => {
    const { member, change } = nemesisMember(content, nemesis({ speciesId: 'charmander', foeTypes: ['grass'] }), 30);
    expect(member.level).toBe(30 + content.story.nemesis.levelBonus);
    expect(member.speciesId).toBe('charmeleon');
    expect(member.moves!.length).toBeLessThanOrEqual(4);
    const fire = member.moves!.filter((id) => content.moves.get(id)!.type === 'fire' && (content.moves.get(id)!.power ?? 0) > 0);
    expect(fire.length).toBeGreaterThan(0);
    expect(change === null || change.includes('Grass')).toBe(true);
    // A Fallen Ace is a little weaker.
    expect(nemesisMember(content, nemesis({ archetype: 'fallenAce' }), 30).member.level).toBe(30 + content.story.nemesis.levelBonus - content.story.nemesis.fallenAcePenalty);
  });

  it("a trainer nemesis leads its trainer's team; at its Reckoning another open nemesis joins (the Nemesis of the Nemesis)", () => {
    const run = battleRun('trainer', [weakFoe('e1')]);
    const main = nemesis({ id: 'a', source: 'trainer', trainer: { classId: 'hiker', name: 'Ray', leaderId: null }, phase: 'reckoning', speciesId: 'geodude' });
    const other = nemesis({ id: 'b', speciesId: 'zubat' });
    run.story.nemeses = [main, other];
    const plan: TrainerPlan = { classId: 'youngster', name: 'Joey', leaderId: null, members: [{ speciesId: 'rattata', level: 28 }, { speciesId: 'pidgey', level: 29 }, { speciesId: 'spearow', level: 30 }], levelInfo: [], ai: 0 };
    const r = nemesisTrainerPlan(content, run, main, plan);
    expect(r.plan).toMatchObject({ classId: 'hiker', name: 'Ray', leaderId: null });
    expect(r.plan.members).toHaveLength(3);
    expect(r.plan.members[0]!.speciesId).not.toBe('geodude'); // evolved for its new level
    expect(r.plan.members[1]!.speciesId).not.toBe('zubat');
    expect(r.partner?.id).toBe('b');

    run.battle = createBattle('trainer', [createPokemon(content, 'graveler', 24, 'n1'), createPokemon(content, 'golbat', 24, 'n2')], 0, run.party[0]!.uid, { classId: 'hiker', name: 'Ray', leaderId: null });
    beginNemesisBattle(content, run, main, r.change, r.partner);
    expect(run.battle.nemesis).toBe('a');
    expect(run.battle.enemyStages.spe).toBe(1); // the Stalker is fast
    expect(run.battle.nemesisNote).toContain('The Reckoning');
    expect(run.battle.nemesisNote).toContain('Neither nemesis');
    expect(other.archetype).toBe('nemesisOfNemesis');
    expect(main.partner).toBe('b');
  });

  it('beaten at its Return it slips away for the Reckoning; beaten at the Reckoning it is settled with a reward, a memory and a title', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    const n = nemesis();
    run.story.nemeses = [n];
    beginNemesisBattle(content, run, n, null, null);
    let result = win(content, run);
    expect(n.phase).toBe('return'); // the original object was cloned by the turn
    expect(result.run.story.nemeses[0]!.phase).toBe('reckoning');
    expect(result.cues.map((c) => c.title)).toContain('This Enemy Will Return…');

    const again = battleRun('wild', [weakFoe('e2')]);
    again.story.nemeses = structuredClone(result.run.story.nemeses);
    const m = again.story.nemeses[0]!;
    beginNemesisBattle(content, again, m, null, null);
    const money = again.money;
    const candies = again.inventory['full-restore'] ?? 0;
    result = win(content, again);
    const after = result.run;
    expect(after.story.nemeses[0]).toMatchObject({ phase: 'settled', settledAs: 'beaten' });
    expect(after.money).toBeGreaterThanOrEqual(money + content.story.nemesis.reward.money);
    expect(after.inventory['full-restore'] ?? 0).toBe(candies + 1);
    expect(result.cues.map((c) => c.title)).toContain('The Reckoning!');
    expect(after.story.events.some((e) => e.type === 'nemesisSettled')).toBe(true);
    expect(after.story.histories[after.party[0]!.uid]?.titles).toContain('Nemesis Slayer');
    expect(content.items.has(content.story.nemesis.reward.itemId)).toBe(true);
  });

  it('beating you again only makes it remember more (It Remembers That Defeat! on the next meeting)', () => {
    const run = battleRun('wild', [weakFoe('e1')]);
    const n = nemesis({ beat: [] });
    run.story.nemeses = [n];
    beginNemesisBattle(content, run, n, null, null);
    run.battle!.outcome = 'lose';
    nemesisAfterBattle(content, run, { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: 3 });
    expect(n.wins).toBe(1);
    expect(n.phase).toBe('return');
    const next = battleRun('wild', [createPokemon(content, 'rattata', 5, 'e5')]);
    next.story.nemeses = [structuredClone(n)];
    beginNemesisBattle(content, next, next.story.nemeses[0]!, null, null);
    const titles = win(content, next).cues.map((c) => c.title);
    expect(titles).toContain('It Remembers That Defeat!');
  });
});

describe('The other Overdrive moments', () => {
  it('The Hunter Has Become the Hunted!: three wins over one class send a counter-team (once per region)', () => {
    const run = battleRun('trainer', [weakFoe('e1')]);
    for (let i = 0; i < 3; i++) {
      run.battle = createBattle('trainer', [weakFoe(`h${i}`)], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
      run.battle.outcome = 'win';
      nemesisAfterBattle(never, run, { region: 0, stage: 0, level: 1, node: null, battle: i, turn: 1 });
    }
    expect(isHunted(content, run, 'youngster')).toBe(true);
    expect(isHunted(content, run, 'lass')).toBe(false);
    expect(counterTypes(content, ['electric'])).toEqual(['ground']);
    run.battle = createBattle('trainer', [createPokemon(content, 'diglett', 20, 'd1')], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
    run.battle.hunted = true;
    run.battle.sos = { ...freshSos(), answered: 1 };
    expect(win(content, run).cues.map((c) => c.title)).toContain('The Hunter Has Become the Hunted!');
  });

  it('Its Anger Is Becoming Dangerous!: a trainer foe hit three turns running (passing the rarity roll) gets angry', () => {
    const big = createPokemon(content, 'snorlax', 60, 'big');
    big.moves = [{ id: 'growl', pp: 40 }];
    let run = battleRun('trainer', [big]);
    run.log.starterUid = null; // no Starter's Destiny using up the cue budget
    const seen: string[] = [];
    for (let i = 0; i < 3 && run.battle && !run.battle.outcome; i++) {
      const r = takeTurn(always, run, { kind: 'move', index: 0 });
      seen.push(...r.cues.map((c) => c.title));
      run = r.run;
    }
    expect(seen).toContain('Its Anger Is Becoming Dangerous!');
  });

  it('The Enemy Is Fighting for Its Pride!: a boss down to its last of three Pokémon', () => {
    const a = weakFoe('b1');
    const b = weakFoe('b2');
    a.hp = 0;
    b.hp = 0;
    const run = battleRun('trainer', [a, b, createPokemon(content, 'snorlax', 60, 'b3')], { leaderId: 'brock', classId: 'gym-leader' });
    run.battle!.enemyIndex = 2;
    expect(takeTurn(always, run, { kind: 'move', index: 0 }).cues.map((c) => c.title)).toContain('The Enemy Is Fighting for Its Pride!');
  });

  it('every new moment is defined with its one effect', () => {
    for (const t of ['rememberDefeat', 'notOverBetweenUs', 'fightingForPride', 'angerDangerous', 'somethingToProve', 'hunterHunted', 'enemyWillReturn', 'nemesisReckoning']) {
      expect(content.story.definitions.some((d) => d.triggerConditions.trigger === t)).toBe(true);
    }
  });
});

describe('Nemesis save', () => {
  it('v24 runs gain an empty nemesis list', () => {
    expect(MIGRATIONS.run[24]!({ story: { seq: 1 } })).toEqual({ story: { seq: 1, nemeses: [] } });
    expect(MIGRATIONS.run[24]!({ x: 1 })).toEqual({ x: 1 });
  });
});
