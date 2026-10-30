// M8.9 Phase 1, slice 4: "This Trainer Will Return!" An ordinary trainer you
// beat with one Pokémon left standing at 25% HP or less vows to come back.
// The first ordinary trainer battle of a later stage is that trainer, with its
// old team at the new levels (+2) and one more Pokémon. One vow per stage,
// four per region.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import type { TrainerPlan } from '../../src/core/encounters';
import { maxHp, createPokemon } from '../../src/core/pokemon';
import { nextChoices } from '../../src/core/map';
import { chooseNode, chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { returnFlag, revisedTeam, waitingTrainer } from '../../src/core/story/returns';
import { content, toBattle } from './helpers';

function weakFoe(uid: string, speciesId = 'rattata'): PokemonInstance {
  const mon = createPokemon(content, speciesId, 5, uid);
  mon.hp = 1;
  mon.moves = [{ id: 'growl', pp: 40 }];
  return mon;
}

/** A run in a trainer battle against one weak foe; your lead is at `hpShare` of its max HP. */
function trainerBattle(hpShare: number, opts: { leaderId?: string | null; seed?: string } = {}): RunState {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'vow', seed: opts.seed ?? 'vow', archetypeId: 'red' }), 0)));
  const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
  lead.moves = [{ id: 'tackle', pp: 35 }];
  lead.hp = Math.max(1, Math.floor(maxHp(content, lead) * hpShare));
  run.party[0] = lead;
  run.battle = createBattle('trainer', [weakFoe('e1')], 0, lead.uid, { classId: 'youngster', name: 'Joey', leaderId: opts.leaderId ?? null });
  return run;
}

const win = (run: RunState) => takeTurn(content, run, { kind: 'move', index: 0 });

describe('This Trainer Will Return: the vow', () => {
  it('a narrow win (one Pokémon left, 25% HP or less) makes the trainer vow to return', () => {
    const result = win(trainerBattle(0.2));
    expect(result.cues.map((c) => c.title)).toContain('This Trainer Will Return!');
    expect(result.cues.find((c) => c.title === 'This Trainer Will Return!')!.messages.join(' ')).toContain('Youngster Joey');
    const story = result.run.story;
    expect(story.enemyProfiles).toHaveLength(1);
    const profile = story.enemyProfiles[0]!;
    expect(profile).toMatchObject({ name: 'Joey', trainerId: 'youngster', team: [{ speciesId: 'rattata', level: 5 }] });
    expect(profile.battles).toEqual([expect.objectContaining({ result: 'win' })]);
    expect(story.flags[returnFlag(profile.id)]).toBe('waiting');
    expect(story.events.some((e) => e.type === 'trainerVowedReturn')).toBe(true);
  });

  it('no vow after a comfortable win, with two Pokémon standing, or against a gym leader', () => {
    expect(win(trainerBattle(0.9)).run.story.enemyProfiles).toEqual([]);
    const two = trainerBattle(0.2);
    two.party.push(createPokemon(content, 'pidgey', 5, 'mate'));
    expect(win(two).run.story.enemyProfiles).toEqual([]);
    expect(win(trainerBattle(0.2, { leaderId: 'brock' })).run.story.enemyProfiles).toEqual([]);
  });

  it('one vow per stage', () => {
    const first = win(trainerBattle(0.2)).run;
    const again = trainerBattle(0.2);
    again.story = structuredClone(first.story);
    expect(win(again).run.story.enemyProfiles).toHaveLength(1);
  });
});

describe('This Trainer Will Return: the rematch', () => {
  const profile = {
    id: 'trainer-0-0-1',
    name: 'Joey',
    trainerId: 'youngster',
    region: 0,
    team: [{ speciesId: 'rattata', level: 5 }],
    battles: [{ eventId: 'x', result: 'win' as const, where: { region: 0, stage: 0, level: 3, node: null, battle: 1, turn: 2 } }],
    adaptations: [],
  };

  it('revises the team: old Pokémon at the new levels +2 (evolved when they can), plus one more', () => {
    const run = createRun(content, { runId: 'r', seed: 'r', archetypeId: 'red' });
    const plan: TrainerPlan = {
      classId: 'hiker',
      name: 'Bob',
      leaderId: null,
      ai: 0,
      members: [
        { speciesId: 'geodude', level: 24 },
        { speciesId: 'onix', level: 25 },
      ],
      levelInfo: [{ level: 24 } as never, { level: 25 } as never],
    };
    const team = revisedTeam(content, run, profile, plan, { kind: 'rematch', levelBonus: 2, extraMembers: 1, perStage: 1, perRegion: 4 });
    expect(team).toMatchObject({ classId: 'youngster', name: 'Joey' });
    expect(team.members).toEqual([
      { speciesId: 'raticate', level: 26 },
      { speciesId: 'onix', level: 27 },
    ]);
    expect(team.levelInfo).toHaveLength(2);
    // The same every time.
    expect(revisedTeam(content, run, profile, plan, { kind: 'rematch', levelBonus: 2, extraMembers: 1, perStage: 1, perRegion: 4 })).toEqual(team);
  });

  it('waits for a later stage, then replaces the next ordinary trainer', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'back', seed: 'back', archetypeId: 'red' }), 0));
    run.story.enemyProfiles.push(structuredClone(profile));
    run.story.flags[returnFlag(profile.id)] = 'waiting';
    // Vowed in this very stage: not yet.
    expect(waitingTrainer(run)).toBeNull();
    run.story.enemyProfiles[0]!.battles[0]!.where.stage = 5;
    expect(waitingTrainer(run)?.id).toBe(profile.id);

    const node = nextChoices(run.stage!)[0]!;
    node.kind = 'trainer';
    const after = chooseNode(content, run, node.id);
    const battle = after.battle!;
    expect(battle.returning).toBe(profile.id);
    expect(battle.trainer).toMatchObject({ classId: 'youngster', name: 'Joey' });
    expect(battle.enemyTeam[0]!.speciesId).toMatch(/rattata|raticate/);
    expect(battle.enemyTeam.length).toBeGreaterThanOrEqual(2);
    expect(after.story.flags[returnFlag(profile.id)]).toBe('returned');
    expect(waitingTrainer(after)).toBeNull();

    // Without the vow the same node gives an ordinary trainer, and the encounter stream is untouched.
    const plain = structuredClone(chooseStarter(content, createRun(content, { runId: 'back', seed: 'back', archetypeId: 'red' }), 0));
    nextChoices(plain.stage!)[0]!.kind = 'trainer';
    const ordinary = chooseNode(content, plain, node.id);
    expect(ordinary.battle!.returning).toBeUndefined();
    expect(ordinary.rng).toEqual(after.rng);
  });
});
