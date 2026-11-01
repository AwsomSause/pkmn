// Kice spec §9/§10/§11/§21/§29: the guaranteed major rival and its tracked ace, studied and counter moves,
// persistent Pokémon rivals, and the rivalry sacrifice.

import { describe, expect, it } from 'vitest';
import { chooseEnemyMove, createBattle, itemProblem } from '../../src/core/battle/engine';
import { sacrificeFor } from '../../src/core/battle/sacrificeRule';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, startEncounter, takeTurn } from '../../src/core/run';
import type { PokemonInstance, RunState } from '../../src/core/state';
import { familyId } from '../../src/core/mastery';
import { adaptMove, canonPlan, characterOf, createMajorRival, learnFromBattle, MAJOR, majorNote, recordAce, withAceProgress } from '../../src/core/rivals/major';
import { beginMonRivalBattle, carriedMonRival, dueMonRival, monRivalState, maybeFormMonRival, monRivalCandidate, monRivalMember, rivalCatchesMonRival } from '../../src/core/rivals/monRivals';
import { armSacrifice, recordSacrifice, SACRIFICE_TITLE, sacrificeEcho } from '../../src/core/rivals/sacrifice';
import { waitingRival } from '../../src/core/rivals/adapt';
import { RIVAL_PROFILES } from '../../src/core/rivals/schema';
import type { DomainEvent, MonRival, Rival, Where } from '../../src/core/story/schema';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content, toBattle } from './helpers';

const where: Where = { region: 0, stage: 1, level: 3, node: null, battle: 2, turn: 4 };
const ended = { id: 'seed#9' } as DomainEvent;

function baseRun(seed = 'depth'): RunState {
  return structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0)));
}

function major(run: RunState, team = ['charmander']): Rival {
  return createMajorRival(run, { classId: 'rival', name: 'Blue', team, ended, where, result: 'win', hpLeftShare: 0.5, turns: 4, foes: [] }, content)!;
}

function monRival(run: RunState, over: Partial<MonRival> = {}): MonRival {
  const m: MonRival = {
    id: 'monrival-x', speciesId: 'rattata', level: 8, mark: 'a torn ear', rivalOf: run.party[0]!.uid, rivalName: 'Bulbasaur',
    formedAt: where, lastMet: 1, meetings: 1, wins: 1, losses: 1, owner: null, bond: 0, sacrificed: false, history: [], ...over,
  };
  (run.story.monRivals ??= []).push(m);
  return m;
}

describe('Major rival data (§21)', () => {
  it('every character, pool species, personality, style and held item exists', () => {
    for (const [id, c] of Object.entries(MAJOR.characters)) {
      expect(RIVAL_PROFILES.personalities[c.personality], id).toBeDefined();
      for (const s of c.pool) expect(content.species.has(s), `${id}: ${s}`).toBe(true);
    }
    for (const item of [...Object.values(MAJOR.config.aceHeld), MAJOR.config.aceHeldFallback]) expect(content.catalog.has(item), item).toBe(true);
  });

  it('every first-rival name is a canon character', () => {
    for (const name of content.trainers.get('rival')!.names) expect(characterOf(name).id).toBe(name);
    // An unknown name still gets a stable character.
    expect(characterOf('Zed').id).toBe(characterOf('Zed').id);
  });
});

describe('Major rival record (§21, §9)', () => {
  it('the first rival becomes one major rival with its starter as ace; never twice', () => {
    const run = baseRun();
    const r = major(run);
    expect(r).toMatchObject({ major: true, canon: 'Blue', ace: 'charmander', state: 'recurring', encounters: 1 });
    expect(major(run)).toBeNull();
    expect(run.story.rivals.filter((x) => x.major)).toHaveLength(1);
  });

  it('comes back every second stage, ahead of other rivals', () => {
    const run = baseRun();
    const r = major(run);
    run.story.flags['rival-seen:rival-major'] = 0;
    run.stage = { ...run.stage!, index: 1 };
    expect(waitingRival(run, content)).toBeNull();
    run.stage = { ...run.stage!, index: 2 };
    expect(waitingRival(run, content)?.id).toBe(r.id);
  });

  it('keeps a semi-canon team: the same slot draws the same family every meeting', () => {
    const run = baseRun();
    const r = major(run);
    const plan = { classId: 'rival', name: 'Blue', leaderId: null, ai: 0, members: [{ speciesId: 'zubat', level: 20 }, { speciesId: 'zubat', level: 20 }, { speciesId: 'zubat', level: 22 }], levelInfo: [] };
    const a = canonPlan(content, r, plan);
    const pool = MAJOR.characters.Blue!.pool;
    for (const m of a.members) expect(pool).toContain(familyId(content, m.speciesId));
    expect(canonPlan(content, r, plan)).toEqual(a);
    expect(new Set(a.members.map((m) => familyId(content, m.speciesId))).size).toBe(3);
    // A trainer rival from a Spark keeps its own team.
    expect(canonPlan(content, { ...r, major: undefined }, plan)).toBe(plan);
  });

  it('tracks the ace battle to battle: form, level, moves, held item and record', () => {
    const run = baseRun();
    const r = major(run);
    const ace = createPokemon(content, 'charmeleon', 20, 'e1');
    ace.held = { charcoal: 1 };
    recordAce(content, r, [createPokemon(content, 'pidgey', 18, 'e0'), ace], false);
    expect(r.aceLog).toMatchObject({ speciesId: 'charmeleon', level: 20, held: 'charcoal', battles: 1, wins: 0, losses: 1 });
    ace.speciesId = 'charizard';
    recordAce(content, r, [ace], true);
    expect(r.aceLog).toMatchObject({ speciesId: 'charizard', battles: 2, wins: 1 });
    expect(r.aceLog!.mods.join()).toContain('Evolved into Charizard');
  });
});

describe('Studied and counter moves (§10)', () => {
  it('studies the move that knocked out the most of its team, and trains a counter for whoever beat its ace', () => {
    const run = baseRun();
    // The starter here is a Fighting type; a Pidgey ace can learn a Flying move against it.
    const r = major(run, ['pidgey']);
    const me = run.party[0]!;
    const lines = learnFromBattle(content, run, r, [
      { foeUid: 'e0', foeSpecies: 'rattata', by: me.uid, moveId: 'vine-whip' },
      { foeUid: 'e1', foeSpecies: 'pidgey', by: me.uid, moveId: 'vine-whip' },
    ], where);
    expect(r.studied?.map((s) => s.moveId)).toEqual(['vine-whip']);
    expect(r.counters).toHaveLength(1);
    expect(r.counters![0]!.target).toBe(me.uid);
    expect(content.moves.get(r.counters![0]!.moveId)!.type).toBe('flying');
    expect(lines).toHaveLength(2);
    // The same move and the same target are never learned twice.
    learnFromBattle(content, run, r, [{ foeUid: 'e1', foeSpecies: 'pidgey', by: me.uid, moveId: 'vine-whip' }], where);
    expect(r.studied).toHaveLength(1);
    expect(r.counters).toHaveLength(1);
  });

  it('learns nothing from a battle with no knockouts, and never more than the limit', () => {
    const run = baseRun();
    const r = major(run);
    expect(learnFromBattle(content, run, r, [], where)).toEqual([]);
    expect(r.studied).toBeUndefined();
    for (const moveId of ['tackle', 'vine-whip', 'razor-leaf', 'body-slam']) learnFromBattle(content, run, r, [{ foeUid: 'e0', foeSpecies: 'pidgey', by: run.party[0]!.uid, moveId }], where);
    expect(r.studied!.length).toBe(MAJOR.config.study.max);
  });

  it('adapts a move the ace cannot learn to its own same-type move (or nothing)', () => {
    expect(adaptMove(content, 'charmander', 30, 'ember')).toBe('ember');
    expect(adaptMove(content, 'charmander', 30, 'not-a-move')).toBeNull();
    const water = adaptMove(content, 'charmander', 30, 'water-gun');
    if (water) expect(content.moves.get(water)!.type).toBe('water');
  });

  it('the ace carries what it learned and, after a few meetings, a held item', () => {
    const run = baseRun();
    const r = major(run);
    r.studied = [{ moveId: 'ember', from: 'Bulbasaur', at: '0.1' }];
    r.encounters = MAJOR.config.aceHeldAt;
    const plan = withAceProgress(content, r, { classId: 'rival', name: 'Blue', leaderId: null, ai: 0, members: [{ speciesId: 'pidgey', level: 20 }, { speciesId: 'charmeleon', level: 22 }], levelInfo: [] });
    expect(plan.members[1]!.moves).toContain('ember');
    expect(plan.members[1]!.held).toEqual({ charcoal: 1 });
    expect(plan.members[0]).toEqual({ speciesId: 'pidgey', level: 20 });
    expect(majorNote(content, r, 'charmeleon')).toContain('Ember');
  });

  it('a counter move is used on sight of its target, and only of its target', () => {
    const ace = createPokemon(content, 'charmeleon', 22, 'e1');
    ace.moves = [{ id: 'scratch', pp: 35 }, { id: 'ember', pp: 25 }];
    const target = createPokemon(content, 'bulbasaur', 20, 'p1');
    const battle = createBattle('trainer', [ace], 0, 'p1', { classId: 'rival', name: 'Blue', leaderId: null });
    battle.rivalCounter = { uid: 'e1', target: 'p1', moveId: 'ember' };
    for (let i = 0; i < 10; i++) expect(chooseEnemyMove(ace, new Rng(hashSeed(`s${i}`)), { content, ai: 0, target, stages: battle.enemyStages, battle, party: [target] })).toBe(1);
    const other = createPokemon(content, 'squirtle', 20, 'p2');
    const picks = new Set(Array.from({ length: 30 }, (_, i) => chooseEnemyMove(ace, new Rng(hashSeed(`s${i}`)), { content, ai: 0, target: other, stages: battle.enemyStages, battle, party: [other] })));
    expect(picks.has(0)).toBe(true);
  });
});

describe('Pokémon rivals across stages (§11)', () => {
  it('a wild Pokémon that knocked out one of yours is a candidate; the roll decides, once per battle', () => {
    const run = baseRun();
    const foe = createPokemon(content, 'rattata', 6, 'e9');
    run.battle = createBattle('wild', [foe], 0, run.party[0]!.uid);
    run.battle.outcome = 'win';
    const cand = monRivalCandidate(content, run, [{ fainted: run.party[0]!.uid, by: 'e9' }]);
    expect(cand?.cause).toBe('knockout');
    expect(monRivalCandidate(content, run, [])).toBeNull();
    // Find an event id the seeded roll passes, then one it fails.
    let made: MonRival | null = null;
    for (let i = 0; i < 40 && !made; i++) made = maybeFormMonRival(content, run, { foe, rival: cand!.rival, cause: 'knockout', eventId: `ev${i}`, where });
    expect(made).not.toBeNull();
    expect(made).toMatchObject({ speciesId: 'rattata', rivalOf: run.party[0]!.uid, owner: null, sacrificed: false });
    // Only one open at a time.
    expect(maybeFormMonRival(content, run, { foe, rival: cand!.rival, cause: 'knockout', eventId: 'other', where })).toBeNull();
  });

  it('caught or raid fights never start one', () => {
    const run = baseRun();
    const foe = createPokemon(content, 'rattata', 6, 'e9');
    run.battle = createBattle('wild', [foe], 0, run.party[0]!.uid);
    run.battle.outcome = 'caught';
    expect(monRivalCandidate(content, run, [{ fainted: run.party[0]!.uid, by: 'e9' }])).toBeNull();
  });

  it('comes back once per stage, the same individual, stronger, and cannot be caught', () => {
    const run = baseRun();
    run.encountersCompleted = 10;
    const m = monRival(run);
    run.stage = { ...run.stage!, index: 2 };
    expect(dueMonRival(content, run)?.id).toBe(m.id);
    const back = monRivalMember(content, m, 12);
    expect(back.level).toBe(12 + MAJOR.monRival.levelBonus);
    const foe = createPokemon(content, back.speciesId, back.level, 'e5');
    run.battle = createBattle('wild', [foe], 0, run.party[0]!.uid);
    const line = beginMonRivalBattle(content, run, m, foe);
    expect(line).toContain('a torn ear');
    expect(run.battle.enemyStages.atk).toBe(MAJOR.monRival.atkBoost);
    expect(dueMonRival(content, run)).toBeNull();
    expect(itemProblem({ content, battle: run.battle, party: run.party, inventory: { 'poke-ball': 5 } as never }, 'poke-ball')).toContain("won't be caught");
  });

  it('appears every stage: on the last wild column it goes ahead of a waiting nemesis', () => {
    const setup = (column: 'first' | 'last') => {
      const run = baseRun();
      run.encountersCompleted = 10;
      run.stage = { ...run.stage!, index: 2, current: null, visited: [] };
      run.battle = null;
      run.phase = 'map';
      run.story.nemeses.push({
        id: 'nemesis-0-0-1', speciesId: 'pidgey', level: 5, source: 'wild', trainer: null, archetype: 'stalker', cause: 'starterKo', phase: 'return',
        formedAt: where, lastMet: { region: 0, stage: 0 }, beat: ['bulbasaur'], foeTypes: ['grass'], wins: 0, changes: [], partner: null, settledAs: null,
      } as never);
      const m = monRival(run);
      const wild = run.stage.map.nodes.filter((n) => n.kind === 'wild');
      const node = column === 'first' ? wild[0]! : wild[wild.length - 1]!;
      startEncounter(content, run, node);
      return { run, m };
    };
    const early = setup('first');
    expect(early.run.battle?.monRival).toBeUndefined();
    const last = setup('last');
    expect(last.run.battle?.monRival?.id).toBe(last.m.id);
    expect(familyId(content, last.run.battle!.enemyTeam[0]!.speciesId)).toBe(familyId(content, 'rattata'));
  });

  it('a hostile trainer rival may catch it, and then always carries it', () => {
    const run = baseRun();
    const r = major(run);
    const m = monRival(run, { meetings: MAJOR.monRival.catchAfterMeetings });
    let caught: string | null = null;
    for (let s = 0; s < 40 && !caught; s++) {
      run.stage = { ...run.stage!, index: s };
      caught = rivalCatchesMonRival(content, run);
    }
    expect(caught).toContain(r.name);
    expect(m.owner).toBe(r.id);
    expect(carriedMonRival(run, r)?.id).toBe(m.id);
    expect(dueMonRival(content, run)).toBeNull();
  });
});

describe('Camp scenes for Pokémon rivals (§11, §29)', () => {
  it('the event condition follows the rival Pokémon: open, carried, then sacrificed', () => {
    const run = baseRun();
    expect(monRivalState(run, 'open')).toBe(false);
    expect(monRivalState(run, 'any')).toBe(false);
    const m = monRival(run);
    expect(monRivalState(run, 'any')).toBe(true);
    expect(monRivalState(run, 'open')).toBe(true);
    m.owner = 'rival-major';
    expect([monRivalState(run, 'open'), monRivalState(run, 'carried')]).toEqual([false, true]);
    m.sacrificed = true;
    expect([monRivalState(run, 'carried'), monRivalState(run, 'sacrificed')]).toEqual([false, true]);
  });

  it('the rival trail stop needs a Pokémon rival and has a choice for each state', () => {
    const camp = content.events.get('camp-rival-trail')!;
    const states = camp.choices.flatMap((c) => (c.requires ?? []).filter((r) => r.kind === 'monRival').map((r) => (r as { state: string }).state));
    expect(states.sort()).toEqual(['carried', 'open', 'sacrificed']);
    expect(camp.requires).toEqual([{ kind: 'monRival', state: 'any' }]);
  });
});

describe('Rivalry sacrifice (§29)', () => {
  function sacrificeBattle(): { run: RunState; attacker: PokemonInstance; guard: PokemonInstance; me: PokemonInstance } {
    const run = baseRun('sac');
    const me = run.party[0]!;
    const fallen = createPokemon(content, 'pidgey', 10, 'e0');
    fallen.hp = 0;
    const attacker = createPokemon(content, 'charizard', 60, 'e1');
    attacker.moves = [{ id: 'flamethrower', pp: 15 }];
    const guard = createPokemon(content, 'raticate', 20, 'e2');
    run.battle = createBattle('trainer', [attacker, fallen, guard], 0, me.uid, { classId: 'rival', name: 'Blue', leaderId: null });
    run.battle.monRival = { id: 'monrival-x', uid: 'e2', rivalOf: me.uid };
    run.battle.sacrifice = { uid: 'e2', protects: me.uid, armed: true, done: false, priority: 2, moves: 2 };
    return { run, attacker, guard, me };
  }

  it('fires only when every condition holds', () => {
    const { run, attacker, guard, me } = sacrificeBattle();
    expect(sacrificeFor(run.battle!, attacker, me, me.hp)).toBe(guard);
    expect(sacrificeFor(run.battle!, attacker, me, me.hp - 1)).toBeNull();
    expect(sacrificeFor(run.battle!, guard, me, me.hp)).toBeNull();
    expect(sacrificeFor({ ...run.battle!, sacrifice: { ...run.battle!.sacrifice!, armed: false } }, attacker, me, me.hp)).toBeNull();
    expect(sacrificeFor({ ...run.battle!, sacrifice: { ...run.battle!.sacrifice!, done: true } }, attacker, me, me.hp)).toBeNull();
    const other = createPokemon(content, 'squirtle', 10, 'p9');
    expect(sacrificeFor(run.battle!, attacker, other, other.hp)).toBeNull();
    // Another Pokémon still in reserve: it isn't the last.
    run.battle!.enemyTeam[1]!.hp = 5;
    expect(sacrificeFor(run.battle!, attacker, me, me.hp)).toBeNull();
  });

  it('in battle: the guard takes the blow, yours is restored, cured and strikes first twice', () => {
    const { run, me } = sacrificeBattle();
    run.party[0]!.hp = 1;
    run.party[0]!.status = { id: 'psn' } as never;
    const r = takeTurn(content, run, { kind: 'move', index: 0 });
    const ev = r.events.find((e) => e.type === 'sacrifice');
    expect(ev).toBeDefined();
    const after = r.run;
    expect(after.battle!.enemyTeam[2]!.hp).toBe(0);
    const mine = after.party.find((p) => p.uid === me.uid)!;
    expect(mine.status).toBeNull();
    expect(after.battle!.enraged).toMatchObject({ uid: me.uid, priority: 2 });
    expect(after.battle!.sacrifice!.done).toBe(true);
  });

  it('is recorded once: the Pokémon rival is gone for the run and yours remembers it', () => {
    const { run } = sacrificeBattle();
    const r = major(run);
    const m = monRival(run, { owner: r.id });
    r.monRival = m.id;
    run.battle!.sacrifice!.done = true;
    recordSacrifice(content, run);
    recordSacrifice(content, run);
    expect(m.sacrificed).toBe(true);
    expect(r.monRival).toBeUndefined();
    expect(carriedMonRival(run, r)).toBeNull();
    expect(run.story.histories[m.rivalOf]?.titles.filter((t) => t === SACRIFICE_TITLE)).toHaveLength(1);
    run.encountersCompleted = 10;
    expect(dueMonRival(content, run)).toBeNull();
    expect(sacrificeEcho(content, run, 'rattata', m.rivalOf)).toContain('a torn ear');
    expect(sacrificeEcho(content, run, 'pidgey', m.rivalOf)).toBeNull();
  });

  it('is armed per battle by a seeded roll, only with a carried Pokémon rival', () => {
    const { run } = sacrificeBattle();
    run.battle!.sacrifice = undefined;
    run.battle!.monRival = undefined;
    const r = major(run);
    armSacrifice(run, r.id, run.battle!.enemyTeam, content);
    expect(run.battle!.sacrifice).toBeUndefined();
    const m = monRival(run, { owner: r.id });
    r.monRival = m.id;
    armSacrifice(run, r.id, run.battle!.enemyTeam, content);
    const sac = () => run.battle!.sacrifice;
    expect(sac()?.uid).toBe('e2');
    const first = sac()!.armed;
    armSacrifice(run, r.id, run.battle!.enemyTeam, content);
    expect(sac()!.armed).toBe(first);
  });
});

describe('Saves', () => {
  it('rival depth state survives save and reload', () => {
    const run = baseRun();
    const r = major(run);
    r.studied = [{ moveId: 'ember', from: 'Bulbasaur', at: '0.1' }];
    r.counters = [{ target: run.party[0]!.uid, targetName: 'Bulbasaur', moveId: 'ember', at: '0.1' }];
    recordAce(content, r, [createPokemon(content, 'charmander', 10, 'e1')], true);
    monRival(run, { owner: r.id });
    r.monRival = 'monrival-x';
    run.battle!.enraged = { uid: run.party[0]!.uid, left: 1, priority: 2 };
    const storage = new MemoryStorageProvider();
    const sm = new SaveManager(storage, content);
    expect(sm.saveRun(run).ok).toBe(true);
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    const back = loaded.data.story.rivals.find((x) => x.major)!;
    expect(back).toMatchObject({ canon: 'Blue', studied: r.studied, counters: r.counters, aceLog: r.aceLog, monRival: 'monrival-x' });
    expect(loaded.data.story.monRivals).toEqual(run.story.monRivals);
    expect(loaded.data.battle!.enraged).toEqual(run.battle!.enraged);
  });

  it('older runs without these fields still load', () => {
    const run = baseRun();
    expect(run.story.monRivals).toBeUndefined();
    expect(maxHp(content, run.party[0]!)).toBeGreaterThan(0);
  });
});
