// Milestone 2: catching, the party, the Bag, switching, trainer battles,
// the Last Stand Charm, move learning, evolution and save upgrades.

import { describe, expect, it } from 'vitest';
import { getArchetype, moneyMultiplier } from '../../src/core/archetypes';
import { createBattle, itemProblem, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { catchProbability, resolveCatchRoll, type CatchInput } from '../../src/core/capture';
import { candiesForRelease, evolvedFormAt, planTrainer, rollShiny } from '../../src/core/encounters';
import { evolutionTarget } from '../../src/core/evolution';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  chooseReward,
  chooseStarter,
  createRun,
  debugGiveItem,
  resolveDecision,
  setLead,
  takeTurn,
  useItemOutsideBattle,
  type DecisionChoice,
} from '../../src/core/run';
import { currentEnemy, type PokemonInstance, type RunState } from '../../src/core/state';
import { MIGRATIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

const RED = getArchetype(content, 'red');

function newRun(seed = 'm2', archetypeId = 'red'): RunState {
  return toBattle(chooseStarter(content, createRun(content, { runId: 'run-m2', seed, archetypeId }), 0));
}

function setMoves(mon: PokemonInstance, ...ids: string[]) {
  mon.moves = ids.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
}

function engine(party: PokemonInstance[], enemies: PokemonInstance[], kind: 'wild' | 'trainer' = 'wild', inventory: Record<string, number> = {}, seed = 'eng') {
  const battle = createBattle(kind, enemies, 0, party[0]!.uid, kind === 'trainer' ? { classId: 'youngster', name: 'Joey', leaderId: null } : null);
  const ctx: BattleContext = { content, battle, party, inventory, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { battle, ctx };
}

/** Plays moves until the battle is decided. */
function fightOut(run: RunState) {
  let result;
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 300) {
    const mon = run.party[run.battle!.activeIndex]!;
    if (run.battle!.needsSwitch) {
      result = takeTurn(content, run, { kind: 'switch', partyIndex: run.party.findIndex((p) => p.hp > 0) });
    } else {
      const damaging = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
      result = takeTurn(content, run, { kind: 'move', index: damaging >= 0 ? damaging : mon.moves.findIndex((m) => m.pp > 0) });
    }
    run = result.run;
  }
  return { run, last: result! };
}

function skipDecisions(run: RunState): RunState {
  while (run.phase === 'decision') {
    const choice: DecisionChoice = run.pending[0]!.kind === 'learnMove' ? { kind: 'skipMove' } : { kind: 'release' };
    run = resolveDecision(content, run, choice).run;
  }
  return run;
}

/** Throws balls until the wild Pokémon is caught. The enemy is made easy to catch and harmless. */
function catchWild(run: RunState): RunState {
  run = debugGiveItem(content, run, 'ultra-ball', 50);
  const enemy = currentEnemy(run.battle!);
  enemy.hp = 1;
  enemy.status = { id: 'slp', turns: 99 };
  for (const mon of run.party) mon.hp = maxHp(content, mon);
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 50) run = takeTurn(content, run, { kind: 'item', itemId: 'ultra-ball' }).run;
  return run;
}

describe('catch probability', () => {
  const base: CatchInput = { maxHp: 100, hp: 100, catchRate: 45, ballMultiplier: 1, statusMultiplier: 1, finalMultiplier: 1 };

  it('stays between 0 and 1 for any input', () => {
    const rng = new Rng(hashSeed('catch-bounds'));
    for (let i = 0; i < 2000; i++) {
      const p = catchProbability({
        maxHp: rng.int(1, 500),
        hp: rng.int(-5, 520),
        catchRate: rng.int(0, 255),
        ballMultiplier: rng.float() * 5,
        statusMultiplier: [1, 1.5, 2.5][rng.int(0, 2)]!,
        finalMultiplier: rng.float() * 2,
      });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('is higher at low HP, with a status, and with a better ball', () => {
    const full = catchProbability(base);
    expect(catchProbability({ ...base, hp: 1 })).toBeGreaterThan(full);
    expect(catchProbability({ ...base, statusMultiplier: 2.5 })).toBeGreaterThan(full);
    expect(catchProbability({ ...base, ballMultiplier: 2 })).toBeGreaterThan(full);
    expect(catchProbability({ ...base, finalMultiplier: 0.85 })).toBeCloseTo(full * 0.85);
  });

  it('is certain when the catch value reaches 255, and impossible at catch rate 0', () => {
    expect(catchProbability({ ...base, catchRate: 255, hp: 1, statusMultiplier: 2.5 })).toBe(1);
    expect(catchProbability({ ...base, catchRate: 0 })).toBe(0);
  });

  it('a roll below the probability catches; otherwise 0–3 shakes', () => {
    expect(resolveCatchRoll(0.5, 0.49)).toEqual({ caught: true, shakes: 3 });
    for (let r = 0.5; r < 1; r += 0.05) {
      const roll = resolveCatchRoll(0.5, r);
      expect(roll.caught).toBe(false);
      expect(roll.shakes).toBeGreaterThanOrEqual(0);
      expect(roll.shakes).toBeLessThanOrEqual(3);
    }
    expect(resolveCatchRoll(0, 0).caught).toBe(false);
  });
});

describe('catching in a run', () => {
  it('a caught Pokémon can join the party', () => {
    let run = catchWild(newRun('catch-add'));
    expect(run.phase).toBe('decision');
    expect(run.pending[0]?.kind).toBe('caught');
    const caughtUid = (run.pending[0] as { mon: PokemonInstance }).mon.uid;
    run = resolveDecision(content, run, { kind: 'addToParty' }).run;
    run = skipDecisions(run);
    expect(run.party.map((p) => p.uid)).toContain(caughtUid);
    expect(run.party).toHaveLength(2);
    expect(run.phase).toBe('reward');
  });

  it('balls are used up, and cannot be thrown at a trainer’s Pokémon', () => {
    const run = newRun('ball-count');
    const before = run.inventory['poke-ball']!;
    const after = takeTurn(content, run, { kind: 'item', itemId: 'poke-ball' }).run;
    expect(after.inventory['poke-ball'] ?? 0).toBe(before - 1);

    const player = createPokemon(content, 'charmander', 10, 'p1');
    const { ctx } = engine([player], [createPokemon(content, 'rattata', 5, 'e1')], 'trainer', { 'poke-ball': 3 });
    expect(itemProblem(ctx, 'poke-ball')).toMatch(/can't catch/);
  });

  it('the party never grows past six: replace or release instead', () => {
    let run = newRun('full-party');
    run.party = Array.from({ length: 6 }, (_, i) => createPokemon(content, 'pidgey', 20, `full${i}`));
    run.battle!.activeIndex = 0;
    run.battle!.participants = ['full0'];
    run = catchWild(run);
    expect(run.phase).toBe('decision');
    expect(() => resolveDecision(content, run, { kind: 'addToParty' })).toThrow(/full/);

    const replaced = skipDecisions(resolveDecision(content, run, { kind: 'replace', partyIndex: 2 }).run);
    expect(replaced.party).toHaveLength(6);
    expect(replaced.party.map((p) => p.uid)).not.toContain('full2');
    expect(replaced.candies).toBe(run.candies);

    const mon = (run.pending[0] as { mon: PokemonInstance }).mon;
    const released = resolveDecision(content, run, { kind: 'release' }).run;
    expect(released.party.map((p) => p.uid)).toEqual(run.party.map((p) => p.uid));
    expect(released.candies).toBe(run.candies + candiesForRelease(content, mon.level));
  });

  it('candies from a run are added to the profile once', () => {
    const run = { ...newRun('candy'), candies: 7, phase: 'over' as const };
    const once = finalizeRun(createProfile(content, 'p'), run).profile;
    expect(once.candies).toBe(7);
    expect(finalizeRun(once, run).profile.candies).toBe(7);
  });

  it('shinies roll at the configured odds', () => {
    expect(content.balance.shinyChance).toBe(1 / 2000);
    const rng = new Rng(hashSeed('shiny'));
    let count = 0;
    for (let i = 0; i < 200000; i++) if (rollShiny(content, rng)) count++;
    expect(count).toBeGreaterThan(60);
    expect(count).toBeLessThan(140);
  });
});

describe('switching', () => {
  it('switching uses the turn: the opponent still moves', () => {
    const party = [createPokemon(content, 'charmander', 10, 'p1'), createPokemon(content, 'squirtle', 10, 'p2')];
    const { battle, ctx } = engine(party, [createPokemon(content, 'rattata', 5, 'e1')]);
    const events = resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(battle.activeIndex).toBe(1);
    expect(events[0]).toMatchObject({ type: 'switchOut', side: 'player', uid: 'p1' });
    expect(events.some((e) => e.type === 'move' && e.side === 'enemy')).toBe(true);
    expect(battle.participants).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(() => resolveTurn(ctx, { kind: 'switch', partyIndex: 1 })).toThrow(/already in battle/);
  });

  it('after a faint the player must send out another Pokémon, which costs no turn', () => {
    const party = [createPokemon(content, 'charmander', 5, 'p1'), createPokemon(content, 'squirtle', 5, 'p2')];
    const enemy = createPokemon(content, 'growlithe', 40, 'e1');
    setMoves(enemy, 'tackle');
    setMoves(party[0]!, 'growl');
    party[0]!.hp = 1;
    const { battle, ctx } = engine(party, [enemy]);
    let guard = 0;
    while (!battle.needsSwitch && guard++ < 20) resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(battle.needsSwitch).toBe(true);
    expect(battle.outcome).toBeNull();
    expect(() => resolveTurn(ctx, { kind: 'move', index: 0 })).toThrow(/send out/);
    expect(() => resolveTurn(ctx, { kind: 'switch', partyIndex: 0 })).toThrow(/fainted/);
    const turn = battle.turn;
    const events = resolveTurn(ctx, { kind: 'switch', partyIndex: 1 });
    expect(events).toEqual([expect.objectContaining({ type: 'switchIn', side: 'player', uid: 'p2' })]);
    expect(battle.turn).toBe(turn);
    expect(battle.needsSwitch).toBe(false);
  });
});

describe('trainer battles', () => {
  it('the trainer sends out the next Pokémon when one faints, and you win after the last', () => {
    const player = createPokemon(content, 'charmander', 60, 'p1');
    setMoves(player, 'ember');
    const team = [createPokemon(content, 'rattata', 3, 'e1'), createPokemon(content, 'pidgey', 3, 'e2')];
    const { battle, ctx } = engine([player], team, 'trainer');
    const events: BattleEvent[] = [];
    let guard = 0;
    while (!battle.outcome && guard++ < 30) events.push(...resolveTurn(ctx, { kind: 'move', index: player.moves.findIndex((m) => m.pp > 0) }));
    expect(battle.outcome).toBe('win');
    expect(events).toContainEqual(expect.objectContaining({ type: 'switchIn', side: 'enemy', uid: 'e2' }));
    expect(team.every((m) => m.hp === 0)).toBe(true);
  });

  it('trainer battles come from trainer columns on the map, and winning pays moneyPerLevel × highest level', () => {
    for (const archetypeId of ['red', 'green']) {
      let run = newRun('trainer-money', archetypeId);
      run.party[0] = createPokemon(content, run.party[0]!.speciesId, 70, run.party[0]!.uid);
      while (run.battle?.kind !== 'trainer') {
        run = skipDecisions(fightOut(run).run);
        if (run.phase === 'reward') run = toBattle(skipDecisions(chooseReward(content, run, 0).run));
      }
      const column = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!.column;
      expect(column).toBe(run.stage!.map.trainerColumns[0]);
      const battle = run.battle!;
      const cls = content.trainers.get(battle.trainer!.classId)!;
      const expected = Math.floor(cls.moneyPerLevel * Math.max(...battle.enemyTeam.map((m) => m.level)) * moneyMultiplier(getArchetype(content, archetypeId)));
      const { last } = fightOut(run);
      expect(last.end).toMatchObject({ outcome: 'win', moneyGained: expected });
    }
  });

  it('trainer Pokémon arrive already evolved for their level', () => {
    expect(evolvedFormAt(content, 'charmander', 15)).toBe('charmander');
    expect(evolvedFormAt(content, 'charmander', 16)).toBe('charmeleon');
    const theme = content.themes.get('fire-psychic')!;
    const plan = planTrainer(content, RED, theme, 3, 120, new Rng(hashSeed('plan')));
    expect(plan.members.length).toBeGreaterThanOrEqual(content.balance.trainerTeam.baseSize);
    expect(plan.members.length).toBeLessThanOrEqual(content.balance.trainerTeam.maxSize);
    for (const m of plan.members) expect(evolvedFormAt(content, m.speciesId, m.level)).toBe(m.speciesId);
  });
});

describe('Last Stand Charm', () => {
  function lethal(inventory: Record<string, number>, extraParty: PokemonInstance[] = []) {
    const player = createPokemon(content, 'charmander', 5, 'p1');
    setMoves(player, 'growl');
    const enemy = createPokemon(content, 'growlithe', 50, 'e1');
    setMoves(enemy, 'tackle');
    const { battle, ctx } = engine([player, ...extraParty], [enemy], 'wild', inventory, 'last-stand');
    const events: BattleEvent[] = [];
    let guard = 0;
    while (!events.some((e) => e.type === 'damage' && e.side === 'player') && guard++ < 20) events.push(...resolveTurn(ctx, { kind: 'move', index: 0 }));
    return { player, battle, events, inventory };
  }

  it('saves the last healthy Pokémon once, at 1 HP, and is used up', () => {
    const { player, battle, events, inventory } = lethal({ 'last-stand-charm': 1 });
    expect(player.hp).toBe(1);
    expect(events).toContainEqual({ type: 'lastStand', side: 'player', itemId: 'last-stand-charm' });
    expect(inventory['last-stand-charm']).toBeUndefined();
    expect(battle.lastStandUsed).toBe(true);
  });

  it('does nothing without the charm, or while other Pokémon can still fight', () => {
    expect(lethal({}).player.hp).toBe(0);
    const withBackup = lethal({ 'last-stand-charm': 1 }, [createPokemon(content, 'squirtle', 5, 'p2')]);
    expect(withBackup.player.hp).toBe(0);
    expect(withBackup.inventory['last-stand-charm']).toBe(1);
  });
});

describe('items outside battle', () => {
  it('a Potion heals 20 HP but never past max, and is used up', () => {
    let run = skipDecisions(fightOut(newRun('potion')).run);
    expect(run.phase).toBe('reward');
    const mon = run.party[0]!;
    const max = maxHp(content, mon);
    mon.hp = max - 5;
    const count = run.inventory.potion!;
    const result = useItemOutsideBattle(content, run, 'potion', 0);
    expect(result.run.party[0]!.hp).toBe(max);
    expect(result.run.inventory.potion ?? 0).toBe(count - 1);
    run = result.run;
    expect(() => useItemOutsideBattle(content, run, 'potion', 0)).toThrow(/full/);
  });

  it('a Revive only works on a fainted Pokémon', () => {
    let run = skipDecisions(fightOut(newRun('revive')).run);
    run = debugGiveItem(content, run, 'revive', 1);
    expect(() => useItemOutsideBattle(content, run, 'revive', 0)).toThrow(/hasn't fainted/);
    run.party.push(createPokemon(content, 'pidgey', 10, 'fainted'));
    run.party[1]!.hp = 0;
    const revived = useItemOutsideBattle(content, run, 'revive', 1).run.party[1]!;
    expect(revived.hp).toBe(Math.floor(maxHp(content, revived) / 2));
  });

  it('setting the lead moves a Pokémon to the front', () => {
    const run = skipDecisions(fightOut(newRun('lead')).run);
    run.party.push(createPokemon(content, 'pidgey', 10, 'second'));
    expect(setLead(run, 1).party.map((p) => p.uid)).toEqual(['second', run.party[0]!.uid]);
  });
});

describe('rewards, move learning and evolution', () => {
  function inRewardPhase(seed: string): RunState {
    const start = newRun(seed);
    start.party[0] = createPokemon(content, start.party[0]!.speciesId, 30, start.party[0]!.uid);
    const run = skipDecisions(fightOut(start).run);
    expect(run.phase).toBe('reward');
    return run;
  }

  it('Pokémon rewards go to the chosen party member', () => {
    const run = inRewardPhase('target');
    run.party.push(createPokemon(content, 'pidgey', 10, 'second'));
    run.draft = ['protein'];
    const after = chooseReward(content, run, 0, 1).run;
    expect(after.party[1]!.vitamins.atk).toBe(1);
    expect(after.party[0]!.vitamins.atk ?? 0).toBe(0);
  });

  it('a Rare Candy at the evolution level evolves the Pokémon', () => {
    const run = inRewardPhase('evolve');
    run.party[0] = createPokemon(content, 'charmander', 15, run.party[0]!.uid);
    run.draft = ['rare-candy'];
    const { run: after, reward } = chooseReward(content, run, 0, 0);
    expect(after.party[0]!.speciesId).toBe('charmeleon');
    expect(after.party[0]!.level).toBe(16);
    expect(reward.messages.join(' ')).toMatch(/evolved into Charmeleon/);
  });

  it('fainted Pokémon do not evolve', () => {
    const mon = createPokemon(content, 'charmander', 20, 'x');
    expect(evolutionTarget(content, mon)).toBe('charmeleon');
    mon.hp = 0;
    expect(evolutionTarget(content, mon)).toBeNull();
  });

  it('a Pokémon that knows four moves asks before learning a new one (offered once)', () => {
    const run = inRewardPhase('learn');
    // Charmeleon knows smokescreen, dragon-breath, metal-claw and leer at 24, and learns fire-fang at 25.
    run.party[0] = createPokemon(content, 'charmeleon', 24, run.party[0]!.uid);
    expect(run.party[0]!.moves).toHaveLength(4);
    run.draft = ['rare-candy'];
    const asked = chooseReward(content, run, 0, 0).run;
    expect(asked.phase).toBe('decision');
    expect(asked.pending).toEqual([{ kind: 'learnMove', uid: asked.party[0]!.uid, moveId: 'fire-fang' }]);

    const learned = resolveDecision(content, asked, { kind: 'forgetMove', moveIndex: 1 }).run;
    expect(learned.party[0]!.moves.map((m) => m.id)).toEqual(['smokescreen', 'fire-fang', 'metal-claw', 'leer']);
    expect(learned.phase).toBe('map');

    const skipped = resolveDecision(content, asked, { kind: 'skipMove' }).run;
    expect(skipped.party[0]!.moves.map((m) => m.id)).toEqual(['smokescreen', 'dragon-breath', 'metal-claw', 'leer']);
  });

  it('evolving and levelling up at once does not offer the same move twice', () => {
    const run = inRewardPhase('learn-twice');
    // Ekans and Arbok both learn Acid at 23; Ekans evolves at 22, so a Rare Candy at 22 does both at once.
    run.party[0] = createPokemon(content, 'ekans', 22, run.party[0]!.uid);
    expect(run.party[0]!.moves).toHaveLength(4);
    run.draft = ['rare-candy'];
    const asked = chooseReward(content, run, 0, 0).run;
    expect(asked.party[0]!.speciesId).toBe('arbok');
    expect(asked.pending.filter((d) => d.kind === 'learnMove')).toHaveLength(1);
  });
});

describe('save upgrades (v1 → v2)', () => {
  it('upgrades a Milestone 1 run save', () => {
    const run = newRun('migrate');
    const enemy = currentEnemy(run.battle!);
    const { enemyTeam, enemyIndex, trainer, needsSwitch, lastStandUsed, kind, ...battleV1 } = run.battle!;
    void [enemyTeam, enemyIndex, trainer, needsSwitch, lastStandUsed, kind];
    const { inventory, candies, pending, afterDecisions, ...runV1 } = run;
    void [inventory, candies, pending, afterDecisions];
    const v1 = { ...runV1, battle: { ...battleV1, enemy } };

    const storage = new MemoryStorageProvider();
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 1, savedAt: '', data: v1 }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(1);
    expect(loaded.data.battle).toMatchObject({ kind: 'wild', enemyTeam: [enemy], enemyIndex: 0, trainer: null, needsSwitch: false });
    expect(loaded.data).toMatchObject({ inventory: {}, candies: 0, pending: [], afterDecisions: 'reward' });
  });

  it('upgrades a Milestone 1 profile save', () => {
    const { candies, ...v1 } = createProfile(content, 'old');
    void candies;
    expect(MIGRATIONS.profile[1]).toBeDefined();
    const storage = new MemoryStorageProvider();
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 1, savedAt: '', data: v1 }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('old');
    expect(profile.candies).toBe(0);
  });

  it('rejects a save that refers to an item that no longer exists', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveRun({ ...newRun('bad-item'), inventory: { 'master-ball': 1 } });
    expect(saves.loadRun()).toMatchObject({ status: 'corrupt' });
  });
});
