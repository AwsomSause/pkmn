// Techno §6.4 to §6.8: sacrifice, comeback records, promises, wild recognition, team chemistry.

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { maxHp } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunEvent } from '../../src/core/run';
import { chemistryOf } from '../../src/core/story/chemistry';
import { recordBattleTurn } from '../../src/core/story/hooks';
import { lossesTo, noteLoss, promiseLines, promiseOf } from '../../src/core/story/promises';
import { emit, openHistory, openRelationship } from '../../src/core/story/record';
import { content, toBattle } from './helpers';

Object.assign(content.story.rarity, { momentChance: 1, flairChance: 1, perBattle: 99, perBossBattle: 99, cooldownBattles: 0 });

function setup(seed: string) {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0)));
  run.battle!.kind = 'trainer';
  return { run, lead: run.party[0]! };
}
const titles = (cues: ReturnType<typeof recordBattleTurn>) => cues.flatMap((c) => c.title.split(' · '));
const turn = (run: ReturnType<typeof setup>['run'], events: RunEvent[] = []) => titles(recordBattleTurn(content, structuredClone(run), run, events));

describe('Sacrifice', () => {
  it('a defensive move while a teammate is nearly down: stood between friend and danger', () => {
    const { run, lead } = setup('sac-stand');
    const buddy = createPokemon(content, 'rattata', 10, 'buddy');
    buddy.hp = 1;
    run.party.push(buddy);
    openHistory(content, run, buddy.uid, buddy.speciesId, 'caught');
    expect(turn(run, [{ type: 'move', side: 'player', moveId: 'protect', uid: lead.uid } as RunEvent])).toContain('It Stood Between Its Friend and Danger!');
  });

  it('the last conscious Pokémon in a boss fight makes a last stand', () => {
    const { run, lead } = setup('sac-last');
    run.battle!.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    const buddy = createPokemon(content, 'rattata', 10, 'buddy');
    buddy.hp = 0;
    run.party.push(buddy);
    lead.hp = Math.floor(maxHp(content, lead) * 0.3);
    expect(turn(run)).toContain('Its Final Move Created an Opening!');
  });
});

describe('Promise and Comeback', () => {
  it('two losses to the same species make a promise; beating it keeps the promise once', () => {
    const { run, lead } = setup('promise');
    const foe = run.battle!.enemyTeam[run.battle!.enemyIndex]!;
    noteLoss(run, lead.uid, foe.speciesId);
    expect(promiseOf(run, lead.uid)).toBeNull();
    noteLoss(run, lead.uid, foe.speciesId);
    expect(promiseOf(run, lead.uid)).toBe(foe.speciesId);
    expect(promiseLines(content, run)[0]).toContain('promised to beat');
    const t = turn(run, [{ type: 'faint', side: 'enemy', uid: foe.uid, participants: [lead.uid] } as RunEvent]);
    expect(t).toContain('A Promise Kept!');
    expect(promiseOf(run, lead.uid)).toBeNull();
  });

  it('one earlier loss to a species makes beating it a Comeback', () => {
    const { run, lead } = setup('comeback');
    const foe = run.battle!.enemyTeam[run.battle!.enemyIndex]!;
    noteLoss(run, lead.uid, foe.speciesId);
    expect(turn(run, [{ type: 'faint', side: 'enemy', uid: foe.uid, participants: [lead.uid] } as RunEvent])).toContain('The Score Is Settled!');
  });
});

describe('Wild recognition', () => {
  it('a species that beat a party member ambushes; a wild kin is recognised', () => {
    const a = setup('wild-ambush');
    a.run.battle!.kind = 'wild';
    a.run.battle!.turn = 1;
    noteLoss(a.run, a.lead.uid, a.run.battle!.enemyTeam[a.run.battle!.enemyIndex]!.speciesId);
    expect(turn(a.run)).toContain('The Wild Pokémon Remembers!');
    const b = setup('wild-kin');
    b.run.battle!.kind = 'wild';
    b.run.battle!.turn = 1;
    const kin = createPokemon(content, b.run.battle!.enemyTeam[b.run.battle!.enemyIndex]!.speciesId, 10, 'kin');
    b.run.party.push(kin);
    openHistory(content, b.run, kin.uid, kin.speciesId, 'caught');
    expect(turn(b.run)).toContain('A Familiar Face');
  });
});

describe('Team chemistry', () => {
  it('a bonded physical and special pair has Perfect Timing; strangers have none', () => {
    const { run, lead } = setup('chem');
    const buddy = createPokemon(content, 'rattata', 10, 'buddy');
    run.party.push(buddy);
    openHistory(content, run, buddy.uid, buddy.speciesId, 'caught');
    expect(chemistryOf(content, run, lead.uid, buddy.uid)).toBeNull();
    lead.moves = [{ id: 'tackle', pp: 10, maxPp: 10 }] as never;
    buddy.moves = [{ id: 'water-gun', pp: 10, maxPp: 10 }] as never;
    const cause = emit(content, run, 'storyMoment', { actors: [lead.uid, buddy.uid], data: { def: 'x', suppressed: false }, importance: 10, text: 'x' });
    openRelationship(content, run, 'bond', { kind: 'pokemon', id: lead.uid }, { kind: 'pokemon', id: buddy.uid }, cause!);
    expect(chemistryOf(content, run, lead.uid, buddy.uid)).toBe('perfectTiming');
    run.battle!.turn = 1;
    expect(turn(run)).toContain('Perfect Timing!');
    expect(chemistryOf(content, run, lead.uid, lead.uid)).toBeNull();
  });
});

describe('Retirement and reunion', () => {
  it('a finished run archives each Pokémon with its legacy titles', async () => {
    const { archiveParty } = await import('../../src/core/story/reunion');
    const { run, lead } = setup('retire');
    run.story.histories[lead.uid]!.titles.push('Iron Will');
    const profile = { pastPokemon: [] } as never as Parameters<typeof archiveParty>[1];
    archiveParty(content, profile, run);
    expect(profile.pastPokemon[0]!.titles).toEqual(['Iron Will']);
  });
});
