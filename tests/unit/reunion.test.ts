// M8.9 Phase 1, slice 5: "A Past Pokémon Wants to Join Your Party" (simple
// version). A finished run's party goes into the profile's archive; a later
// run may meet one of them after a few battles won, at that battle's level,
// keeping its moves. Recruit it, take a keepsake (candies), or let it go.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun, resolveDecision, takeTurn } from '../../src/core/run';
import type { PastPokemon, PokemonInstance, RunState } from '../../src/core/state';
import { formAtLevel, planReunion, reunionPokemon } from '../../src/core/story/reunion';
import { content, toBattle } from './helpers';

const past = (over: Partial<PastPokemon> = {}): PastPokemon => ({
  speciesId: 'charizard',
  level: 50,
  shiny: true,
  abilitySlot: 0,
  moves: ['flamethrower', 'tackle'],
  runId: 'old',
  hallOfFame: false,
  ...over,
});

function weakFoe(uid: string): PokemonInstance {
  const mon = createPokemon(content, 'rattata', 7, uid);
  mon.hp = 1;
  mon.moves = [{ id: 'growl', pp: 40 }];
  return mon;
}

/** A run in a wild battle against one weak foe, with a reunion due after this battle. */
function dueRun(hallOfFame = false): RunState {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'r', seed: 'reunion', archetypeId: 'red' }), 0)));
  const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
  lead.moves = [{ id: 'tackle', pp: 35 }];
  run.party[0] = lead;
  run.battle = createBattle('wild', [weakFoe('e1')], 0, lead.uid);
  run.reunion = { mon: past({ hallOfFame }), afterEncounters: 1, done: false };
  return run;
}

const win = (run: RunState) => takeTurn(content, run, { kind: 'move', index: 0 }).run;

describe('A Past Pokémon Wants to Join: the archive', () => {
  it('a finished run adds its party to the front of the archive, marking a won run as Hall of Fame', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'done', seed: 's', archetypeId: 'red' }), 0));
    run.victory = true;
    const profile = createProfile(content, 'p');
    profile.pastPokemon = [past()];
    const { profile: next } = finalizeRun(content, profile, run, '2026-10-30T00:00:00Z');
    expect(next.pastPokemon).toHaveLength(2);
    expect(next.pastPokemon[0]).toMatchObject({ speciesId: run.party[0]!.speciesId, runId: 'done', hallOfFame: true });
  });

  it('keeps only the newest archiveSize Pokémon', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'done', seed: 's', archetypeId: 'red' }), 0);
    const profile = createProfile(content, 'p');
    profile.pastPokemon = Array.from({ length: content.balance.reunion.archiveSize }, () => past());
    expect(finalizeRun(content, profile, run).profile.pastPokemon).toHaveLength(content.balance.reunion.archiveSize);
  });
});

describe('A Past Pokémon Wants to Join: planning', () => {
  it('no archive, no reunion', () => {
    expect(planReunion(content, 'any', [])).toBeNull();
    expect(createRun(content, { runId: 'x', seed: 'any', archetypeId: 'red' }).reunion).toBeUndefined();
  });

  it('is deterministic per seed, happens at about the configured chance, and waits the configured battles', () => {
    const [min, max] = content.balance.reunion.afterEncounters;
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const plan = planReunion(content, `seed${i}`, [past()]);
      expect(planReunion(content, `seed${i}`, [past()])).toEqual(plan);
      if (!plan) continue;
      hits++;
      expect(plan.afterEncounters).toBeGreaterThanOrEqual(min);
      expect(plan.afterEncounters).toBeLessThanOrEqual(max);
    }
    expect(hits / 400).toBeGreaterThan(content.balance.reunion.chance - 0.1);
    expect(hits / 400).toBeLessThan(content.balance.reunion.chance + 0.1);
  });

  it('does not change any other roll of the run', () => {
    const a = createRun(content, { runId: 'x', seed: 'same', archetypeId: 'red' });
    const b = createRun(content, { runId: 'x', seed: 'same', archetypeId: 'red', pastPokemon: [past()] });
    const { reunion: _r, ...rest } = b;
    expect(rest).toEqual(a);
  });
});

describe('A Past Pokémon Wants to Join: meeting it', () => {
  it('goes back along its line below its evolution levels', () => {
    expect(formAtLevel(content, 'charizard', 7)).toBe('charmander');
    expect(formAtLevel(content, 'charizard', 20)).toBe('charmeleon');
    expect(formAtLevel(content, 'charizard', 40)).toBe('charizard');
  });

  it('keeps its moves, shininess and ability at the given level', () => {
    const mon = reunionPokemon(content, past(), 20, 'p9');
    expect(mon).toMatchObject({ speciesId: 'charmeleon', level: 20, shiny: true, abilitySlot: 0, friendship: content.balance.reunion.friendship });
    expect(mon.moves.map((m) => m.id)).toEqual(['flamethrower', 'tackle']);
    expect(mon.hp).toBe(maxHp(content, mon));
  });

  it('comes after the battle that reaches its count, at that battle\'s level, once', () => {
    const run = win(dueRun());
    expect(run.phase).toBe('decision');
    const decision = run.pending[0]!;
    expect(decision).toMatchObject({ kind: 'reunion', hallOfFame: false, mon: { speciesId: 'charmander', level: 7 } });
    expect(run.reunion!.done).toBe(true);
  });

  it('recruiting adds it to the party and tells the story', () => {
    const { run, message } = resolveDecision(content, win(dueRun(true)), { kind: 'addToParty' });
    expect(message).toContain('joined your party again');
    const joined = run.party.at(-1)!;
    expect(joined).toMatchObject({ speciesId: 'charmander', friendship: content.balance.reunion.hallOfFameFriendship });
    expect(run.story.events.some((e) => e.type === 'joinedParty' && e.data.how === 'reunion')).toBe(true);
    expect(run.phase).toBe('reward');
  });

  it('a keepsake gives candies; letting it go gives nothing', () => {
    const due = win(dueRun());
    const keep = resolveDecision(content, due, { kind: 'keepsake' }).run;
    expect(keep.candies).toBeGreaterThan(due.candies);
    expect(keep.party).toHaveLength(due.party.length);
    const gone = resolveDecision(content, due, { kind: 'release' }).run;
    expect(gone.candies).toBe(due.candies);
    expect(gone.party).toHaveLength(due.party.length);
  });
});

describe('A Past Pokémon Wants to Join: saves', () => {
  it('a version 6 profile loads with an empty archive', () => {
    const storage = new MemoryStorageProvider();
    const { pastPokemon: _p, ...old } = createProfile(content, 'old');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 6, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile).toMatchObject({ profileId: 'old', pastPokemon: [] });
  });
});
