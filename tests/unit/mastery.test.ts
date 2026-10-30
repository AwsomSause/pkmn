// Species Mastery (plan Part 3 + Kice's answer 4): ranks, recording, unlocks, the Mastered set and saves.

import { describe, expect, it } from 'vitest';
import {
  abilityChoices,
  applyMastery,
  chosenEggMoves,
  eggMoveOptions,
  emptyRecord,
  familyId,
  familyMembers,
  familyRank,
  masteredStarters,
  recordMastery,
  runMasteryPerks,
  setMasteryPicks,
  speciesRank,
} from '../../src/core/mastery';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import { poolStatus } from '../../src/core/runPrep';
import type { MasteryRecord, Profile, RunState } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';
const b = content.balance.mastery;
const rec = (r: Partial<MasteryRecord>): MasteryRecord => ({ ...emptyRecord(), ...r });

function withMastery(entries: Record<string, Partial<MasteryRecord>>): Profile {
  const p = createProfile(content, 'p');
  for (const [id, r] of Object.entries(entries)) p.mastery[id] = rec(r);
  return p;
}

const BRONZE = { seen: 1, caught: 1, battles: b.bronzeBattles };
const SILVER = { ...BRONZE, evolved: 1, bossWins: 1 };
const GOLD = { ...SILVER, battles: b.goldBattles, flawless: 1 };
const MASTER = { ...GOLD, regions: 1 };

/** A family whose first stage has at least two usable egg moves and a hidden ability. */
const FAMILY = [...content.species.values()].find(
  (s) => s.evolutionStage === 1 && !s.form && s.evolutions.length > 0 && s.abilities.hidden && s.abilities.normal.length > 1 && eggMoveOptions(content, s.id).filter((o) => o.active).length >= 3,
)!.id;

function runWith(profile: Profile, speciesId: string, seed = 'm'): RunState {
  const run = createRun(content, { runId: `run-${seed}`, seed, archetypeId: 'red', mastery: profile.mastery });
  run.starterChoices = [speciesId, ...run.starterChoices.slice(1)];
  return chooseStarter(content, run, 0);
}

describe('families', () => {
  it('an evolution line is one family, kept on its first stage', () => {
    expect(familyId(content, 'charizard')).toBe('charmander');
    expect(familyId(content, 'charmeleon')).toBe('charmander');
    expect(familyMembers(content, 'charmander').slice(0, 3)).toEqual(['charmander', 'charmeleon', 'charizard']);
    const mega = [...content.species.values()].find((s) => s.form?.kind === 'mega' && s.form.base === 'charizard');
    if (mega) expect(familyId(content, mega.id)).toBe('charmander');
  });
});

describe('ranks', () => {
  it('each rank starts exactly on its boundary', () => {
    expect(speciesRank(content, 'charmander', undefined)).toBe('none');
    expect(speciesRank(content, 'charmander', rec({ seen: 1 }))).toBe('seen');
    expect(speciesRank(content, 'charmander', rec({ ...BRONZE, battles: b.bronzeBattles - 1 }))).toBe('caught');
    expect(speciesRank(content, 'charmander', rec(BRONZE))).toBe('bronze');
    expect(speciesRank(content, 'charmander', rec({ ...SILVER, evolved: 0 }))).toBe('bronze');
    expect(speciesRank(content, 'charmander', rec(SILVER))).toBe('silver');
    expect(speciesRank(content, 'charmander', rec({ ...GOLD, battles: b.goldBattles - 1 }))).toBe('silver');
    expect(speciesRank(content, 'charmander', rec(GOLD))).toBe('gold');
    expect(speciesRank(content, 'charmander', rec(MASTER))).toBe('master');
  });

  it('a species that cannot evolve reaches Silver with more battles instead', () => {
    expect(speciesRank(content, 'charizard', rec({ ...BRONZE, bossWins: 1 }))).toBe('bronze');
    expect(speciesRank(content, 'charizard', rec({ ...BRONZE, bossWins: 1, battles: b.silverBattles }))).toBe('silver');
  });

  it('a family has the best rank of its members', () => {
    expect(familyRank(content, withMastery({ charizard: GOLD, charmander: BRONZE }), 'charmander')).toBe('gold');
  });
});

describe('recording a run', () => {
  it('counts the run for every species the Pokémon was, pays each rank once, and never twice on reload', () => {
    const profile = createProfile(content, 'p');
    const run = runWith(profile, 'charmander', 'rec');
    const h = Object.values(run.story.histories)[0]!;
    h.battles = b.goldBattles;
    h.bossesBeaten = 2;
    h.evolutions.push({ from: 'charmander', to: 'charmeleon', trigger: 'level', where: h.joinedAt });
    run.regionsCleared = ['kanto'];
    run.phase = 'over';
    const rp = profile.researchPoints;
    const { profile: after, summary } = finalizeRun(content, profile, run, NOW);
    expect(after.mastery.charmander).toMatchObject({ caught: 1, battles: b.goldBattles, bossWins: 2, evolved: 1, flawless: 1, regions: 1 });
    expect(after.mastery.charmeleon!.battles).toBe(b.goldBattles);
    expect(speciesRank(content, 'charmander', after.mastery.charmander)).toBe('master');
    expect(summary!.masteryUps.filter((u) => u.speciesId === 'charmander').map((u) => u.rank)).toEqual(['bronze', 'silver', 'gold', 'master']);
    expect(after.titles).toContain('Charmander Master');
    const paid = b.rankResearch.bronze + b.rankResearch.silver + b.rankResearch.gold + b.rankResearch.master;
    expect(after.researchPoints - rp).toBeGreaterThanOrEqual(paid);
    // The same run again changes nothing.
    const again = finalizeRun(content, after, run, NOW);
    expect(again.applied).toBe(false);
    // Another run pays no rank twice.
    const before = after.researchPoints;
    expect(recordMastery(content, after, { ...run, story: { ...run.story, histories: {} }, log: { ...run.log, speciesSeen: [] } }, NOW)).toEqual([]);
    expect(after.researchPoints).toBe(before);
  });
});

describe('unlocks', () => {
  it('Bronze teaches the first egg move to a Pokémon of the family that joins', () => {
    const profile = withMastery({ [FAMILY]: BRONZE });
    const run = runWith(profile, FAMILY, 'bronze');
    const egg = chosenEggMoves(content, profile, FAMILY, 1)[0]!;
    expect(run.mastery[FAMILY]!.eggMoves).toEqual([egg]);
    expect(run.party[0]!.moves.map((m) => m.id)).toContain(egg);
    expect(run.party[0]!.moves.length).toBeLessThanOrEqual(4);
  });

  it('Silver gives the Hidden Ability; Gold a second egg move and a choice of ability; Master an awakened move', () => {
    expect(runMasteryPerks(content, withMastery({ [FAMILY]: SILVER }))[FAMILY]!.abilitySlot).toBe(-1);
    const gold = withMastery({ [FAMILY]: GOLD });
    expect(runMasteryPerks(content, gold)[FAMILY]!.eggMoves).toHaveLength(2);
    expect(abilityChoices(content, gold, FAMILY).length).toBeGreaterThan(1);
    const picked = setMasteryPicks(content, gold, FAMILY, { abilitySlot: 0 });
    expect(runMasteryPerks(content, picked)[FAMILY]!.abilitySlot).toBe(0);
    const run = runWith(withMastery({ [FAMILY]: MASTER }), FAMILY, 'master');
    expect(run.party[0]!.abilitySlot).toBe(-1);
    expect(run.party[0]!.awakened?.length).toBe(1);
  });

  it('refuses a pick the rank does not allow, and never uses an egg move the engine cannot run', () => {
    const bronze = withMastery({ [FAMILY]: BRONZE });
    expect(() => setMasteryPicks(content, bronze, FAMILY, { abilitySlot: -1 })).toThrow();
    const inactive = eggMoveOptions(content, 'bulbasaur').filter((o) => !o.active).map((o) => o.id);
    expect(() => setMasteryPicks(content, bronze, FAMILY, { eggMoves: ['not-a-move'] })).toThrow();
    for (const id of chosenEggMoves(content, withMastery({ bulbasaur: GOLD }), 'bulbasaur', 2)) expect(inactive).not.toContain(id);
  });

  it('a family with nothing unlocked is left alone, and the same run reloads the same', () => {
    const run = runWith(createProfile(content, 'p'), FAMILY, 'plain');
    expect(run.mastery).toEqual({});
    const mon = createPokemon(content, FAMILY, 10, 'x');
    expect(applyMastery(content, run, mon)).toEqual([]);
    const a = runWith(withMastery({ [FAMILY]: GOLD }), FAMILY, 'same');
    const b2 = runWith(withMastery({ [FAMILY]: GOLD }), FAMILY, 'same');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b2));
  });
});

describe('the Mastered starter set', () => {
  it('opens once three species are Silver and draws only from them', () => {
    const pool = content.starterPools.get('mastered')!;
    expect(poolStatus(content, withMastery({ charmander: SILVER, squirtle: SILVER }), pool)).toBe('locked');
    const p = withMastery({ charizard: { ...SILVER, battles: b.silverBattles }, squirtle: SILVER, bulbasaur: SILVER });
    expect(poolStatus(content, p, pool)).toBe('unlocked');
    expect(masteredStarters(content, p)).toEqual(['bulbasaur', 'charmander', 'squirtle']);
    const run = createRun(content, { runId: 'r', seed: 'ms', archetypeId: 'red', mastery: p.mastery, prep: { ...createRun(content, { runId: 'x', seed: 'x', archetypeId: 'red' }).prep, poolId: 'mastered', campaignId: 'full' } });
    for (const id of run.starterChoices) expect(['bulbasaur', 'charmander', 'squirtle']).toContain(id);
  });
});

describe('mastery in saves', () => {
  it('a version 8 profile loads with no mastery', () => {
    const storage = new MemoryStorageProvider();
    const { mastery: _m, ...old } = createProfile(content, 'old');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 8, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('old');
    expect(profile.mastery).toEqual({});
    expect(CURRENT_VERSIONS.profile).toBeGreaterThanOrEqual(9);
  });

  it('a version 19 run loads with no mastery unlocks', () => {
    const storage = new MemoryStorageProvider();
    const { mastery: _m, ...old } = runWith(createProfile(content, 'p'), 'charmander', 'save19');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 19, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(19);
    expect(loaded.data.mastery).toEqual({});
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(20);
  });

  it('a profile that met 1,000 species stays small and reloads its mastery', () => {
    const p = createProfile(content, 'big');
    for (const s of [...content.species.values()].slice(0, 1000)) p.mastery[s.id] = rec({ seen: 3, caught: 2, battles: 120, bossWins: 4, evolved: 1, flawless: 1, regions: 1 });
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveProfile(p);
    expect(JSON.stringify(p.mastery).length).toBeLessThan(150_000);
    expect(Object.keys(saves.loadOrCreateProfile(() => 'new').profile.mastery)).toHaveLength(1000);
  });
});
