// Auto-Battle (spec §32): character-driven picks, no RNG, EXP halving that can't be dodged, stances, saves.

import { describe, expect, it } from 'vitest';
import { autoBattleProblem, autoProfile, chooseAutoAction, chooseAutoSwitchIn, flair, setStance, stanceOf } from '../../src/core/battle/autoBattle';
import { moveDescription, moveEffectClauses } from '../../src/core/battle/moveText';
import { bondOf } from '../../src/core/bond';
import { createBattle } from '../../src/core/battle/engine';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import { CURRENT_VERSIONS, MIGRATIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import type { RunState } from '../../src/core/state';
import { openHistory } from '../../src/core/story/record';
import { makeDoubles } from '../../src/core/battle/doubles';
import { content } from './helpers';

function fight(enemy = 'rattata', enemyLevel = 10): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ab', seed: 'auto', archetypeId: 'red' }), 0));
  const lead = run.party[0]!;
  openHistory(content, run, lead.uid, lead.speciesId, 'starter');
  run.battle = createBattle('wild', [createPokemon(content, enemy, enemyLevel, 'e1')], 0, lead.uid, null);
  run.phase = 'battle';
  return run;
}
const setMoves = (run: RunState, ids: string[]) => {
  run.party[0]!.moves = ids.map((id) => ({ id, pp: 20 }));
};

describe('Auto-Battle and Hyper moments', () => {
  it('a heated rivalry makes it bolder and a foe about to rage makes it warier', () => {
    const run = fight();
    const mon = run.party[0]!;
    const base = autoProfile(content, run, mon);
    run.battle!.hyper!.rivals[`${mon.uid}|rattata`] = 'reckless';
    const reckless = autoProfile(content, run, mon);
    expect(reckless.aggr).toBeGreaterThan(base.aggr);
    delete run.battle!.hyper!.rivals[`${mon.uid}|rattata`];
    run.battle!.hyper!.rage[run.battle!.enemyTeam[0]!.uid] = { hits: 3, state: 'warned', uncontrollable: false, denied: false };
    const wary = autoProfile(content, run, mon);
    expect(wary.caution).toBeGreaterThan(base.caution);
  });
});

describe('Auto-Battle picks', () => {
  it('is deterministic and never touches the run or its RNG', () => {
    const run = fight();
    setMoves(run, ['tackle', 'ember', 'growl']);
    const before = JSON.stringify(run);
    const a = chooseAutoAction(content, run);
    const b = chooseAutoAction(content, run);
    expect(a).toEqual(b);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('goes for a knockout', () => {
    const run = fight('rattata', 5);
    setMoves(run, ['growl', 'tackle']);
    run.party[0]!.level = 30;
    run.battle!.enemyTeam[0]!.hp = 1;
    const pick = chooseAutoAction(content, run)!;
    expect(pick.action).toMatchObject({ kind: 'move', index: 1 });
    expect(pick.tags).toContain('ko');
    expect(pick.intent).toMatch(/will use/i);
  });

  it('does not simply pick the highest listed power: it avoids an immune target', () => {
    const run = fight('gastly', 12);
    setMoves(run, ['tackle', 'shadow-ball']);
    const pick = chooseAutoAction(content, run)!;
    expect(pick.action).toMatchObject({ kind: 'move', index: 1 });
  });

  it('a cautious hurt Pokémon heals while a daring one keeps attacking', () => {
    const base = fight('rattata', 12);
    setMoves(base, ['tackle', 'recover']);
    base.party[0]!.hp = Math.floor(calcStats(content, base.party[0]!).hp * 0.3);
    const cautious = setStance(base, base.party[0]!.uid, 'cautious');
    const aggressive = setStance(base, base.party[0]!.uid, 'aggressive');
    const c = chooseAutoAction(content, cautious)!;
    const a = chooseAutoAction(content, aggressive)!;
    expect(c.action).toMatchObject({ kind: 'move', index: 1 });
    expect(c.tags).toContain('defensive');
    expect(autoProfile(content, aggressive, aggressive.party[0]!).aggr).toBeGreaterThan(autoProfile(content, cautious, cautious.party[0]!).aggr);
    expect(a.action.kind).toBe('move');
  });

  it('same species, different character: nature and trait change the profile', () => {
    const run = fight();
    const twin = structuredClone(run.party[0]!);
    twin.uid = 'twin';
    twin.nature = 'adamant';
    run.party[0]!.nature = 'bold';
    const a = autoProfile(content, run, run.party[0]!);
    const b = autoProfile(content, run, twin);
    expect(b.aggr).toBeGreaterThan(a.aggr);
    expect(a.caution).toBeGreaterThan(b.caution);
  });

  it('picks who to send out after a faint', () => {
    const run = fight('gastly', 12);
    const lead = run.party[0]!;
    const second = createPokemon(content, 'pidgey', 12, 'p2');
    const third = createPokemon(content, 'haunter', 12, 'p3');
    run.party.push(second, third);
    lead.hp = 0;
    run.battle!.needsSwitch = true;
    const pick = chooseAutoSwitchIn(content, run)!;
    expect(pick.action.kind).toBe('switch');
    expect([1, 2]).toContain((pick.action as { partyIndex: number }).partyIndex);
  });

  it('plays only single battles', () => {
    const run = fight();
    expect(autoBattleProblem(run)).toBeNull();
    run.battle!.outcome = 'win';
    expect(autoBattleProblem(run)).not.toBeNull();
    expect(chooseAutoAction(content, run)).toBeNull();
  });

  it('flair is stable and between 0 and 1', () => {
    expect(flair('x')).toBe(flair('x'));
    expect(flair('x')).toBeGreaterThanOrEqual(0);
    expect(flair('x')).toBeLessThan(1);
  });
});

describe('stances (trainer instillment)', () => {
  it('are saved in the bond habits, can be cleared, and never change other state', () => {
    const run = fight();
    const uid = run.party[0]!.uid;
    expect(stanceOf(run, uid)).toEqual({ stance: 'balanced', taught: false });
    const taught = setStance(run, uid, 'protective');
    expect(stanceOf(taught, uid)).toEqual({ stance: 'protective', taught: true });
    expect(bondOf(taught, uid).habits.stance).toBe('protective');
    expect(stanceOf(setStance(taught, uid, 'balanced'), uid).taught).toBe(false);
    expect(stanceOf(run, uid).taught).toBe(false); // the original is untouched
    expect(JSON.parse(JSON.stringify(taught.story.histories[uid]!.bond))).toEqual(taught.story.histories[uid]!.bond);
  });
});

describe('Auto-Battle EXP', () => {
  function winWith(auto: boolean): number {
    const run = fight('rattata', 5);
    setMoves(run, ['tackle']);
    run.party[0]!.level = 30;
    run.battle!.enemyTeam[0]!.hp = 1;
    if (auto) run.battle!.autoUsed = true;
    const before = run.party[0]!.xp;
    const result = takeTurn(content, run, { kind: 'move', index: 0 });
    return result.run.party[0]!.xp - before;
  }
  it('halves EXP for a battle that used Auto-Battle', () => {
    const manual = winWith(false);
    const auto = winWith(true);
    expect(manual).toBeGreaterThan(1);
    expect(auto).toBe(Math.floor(manual * content.balance.difficulty.autoBattleXp));
    expect(content.balance.difficulty.autoBattleXp).toBe(0.5);
  });
  it('the flag survives a save round trip, so switching to manual later cannot undo it', () => {
    const run = fight();
    run.battle!.autoUsed = true;
    const back = JSON.parse(JSON.stringify(run)) as RunState;
    expect(back.battle!.autoUsed).toBe(true);
  });
  it('save versions were bumped', () => {
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(29);
    expect(CURRENT_VERSIONS.settings).toBeGreaterThanOrEqual(10);
    const run = fight();
    expect(MIGRATIONS.run[28]!(run as never)).toEqual(run);
    expect(MIGRATIONS.settings[9]!({ musicVolume: 0.5 } as never)).toMatchObject({ autoBattle: false, autoExplain: true });
  });
});

describe('move descriptions', () => {
  it('say what a move does from its data', () => {
    expect(moveDescription(content.moves.get('flamethrower')!)).toMatch(/burn/);
    expect(moveEffectClauses(content.moves.get('recover')!).join(' ')).toMatch(/restores/);
    expect(moveDescription(content.moves.get('tackle')!).length).toBeGreaterThan(5);
  });
});

describe('Auto-Battle and Bag items', () => {
  const hurt = (stance: 'cautious' | 'aggressive') => {
    const base = fight('rattata', 12);
    setMoves(base, ['tackle']);
    base.inventory = { potion: 2 };
    base.party[0]!.hp = Math.max(1, Math.floor(calcStats(content, base.party[0]!).hp * 0.2));
    return setStance(base, base.party[0]!.uid, stance);
  };
  it('a hurt cautious Pokémon uses a potion on itself', () => {
    const pick = chooseAutoAction(content, hurt('cautious'))!;
    expect(pick.action).toMatchObject({ kind: 'item', itemId: 'potion', targetIndex: 0 });
    expect(pick.tags).toContain('item');
  });
  it('a healthy one never wastes the turn on an item', () => {
    const run = fight('rattata', 12);
    run.inventory = { potion: 2 };
    expect(chooseAutoAction(content, run)!.action.kind).not.toBe('item');
  });
  it('goes for the knockout instead of healing', () => {
    const run = hurt('cautious');
    run.party[0]!.level = 30;
    run.battle!.enemyTeam[0]!.hp = 1;
    expect(chooseAutoAction(content, run)!.action.kind).toBe('move');
  });
});

describe('Auto-Battle in double battles', () => {
  function duo() {
    const make = (species: string, level: number, uid: string, moves: string[]) => {
      const m = createPokemon(content, species, level, uid);
      m.moves = moves.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
      return m;
    };
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ad', seed: 'autodbl', archetypeId: 'red' }), 0));
    run.party = [make('charizard', 40, 'p0', ['flamethrower', 'tackle']), make('gyarados', 40, 'p1', ['waterfall', 'tackle'])];
    const team = [make('venusaur', 45, 'e0', ['tackle']), make('blastoise', 45, 'e1', ['tackle'])];
    run.battle = createBattle('trainer', team, 0, 'p0', { classId: 'ace-trainer', name: 'Pat', leaderId: null });
    makeDoubles(run.battle, run.party);
    run.phase = 'battle';
    return run;
  }
  it('commands both Pokémon, aims each at a foe, and plays through the engine', () => {
    const run = duo();
    const pick = chooseAutoAction(content, run)!;
    expect(pick.action.kind).toBe('double');
    const commands = (pick.action as { commands: ({ target?: { side: string } } | null)[] }).commands;
    expect(commands.filter(Boolean)).toHaveLength(2);
    expect(commands.every((c) => !c || c.target?.side === 'enemy')).toBe(true);
    const before = JSON.stringify(run);
    expect(chooseAutoAction(content, run)).toEqual(pick);
    expect(JSON.stringify(run)).toBe(before);
    const result = takeTurn(content, run, pick.action);
    expect(result.run.battle!.turn).toBe(run.battle!.turn + 1);
  });
  it('is no longer blocked in doubles', () => {
    expect(autoBattleProblem(duo())).toBeNull();
  });
});

describe('older saves load with Auto-Battle', () => {
  it('a version 28 run loads (its battle has no autoUsed)', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 28, savedAt: '', data: fight() }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(28);
    expect(loaded.data.battle!.autoUsed).toBeUndefined();
  });
  it('version 9 settings load with Auto-Battle off and explanations on', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 9, savedAt: '', data: { musicVolume: 0.3 } }));
    const settings = new SaveManager(storage, content).loadSettings();
    expect(settings.autoBattle).toBe(false);
    expect(settings.autoExplain).toBe(true);
  });
});
