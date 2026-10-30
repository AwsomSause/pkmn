// Living Rivalry Engine, slice 1: a Spark makes one rival with a personality and a memory of the battle that did it.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { maybeSpark, type SparkInput } from '../../src/core/rivals/manager';
import { RIVAL_CONFIG, RIVAL_PATHS, RIVAL_PROFILES } from '../../src/core/rivals/schema';
import { sparkGain } from '../../src/core/rivals/manager';
import { nextChoices } from '../../src/core/map';
import type { TrainerPlan } from '../../src/core/encounters';
import { applyDefeat, isHostile, stateFor } from '../../src/core/rivals/outcome';
import { evaluateUltimate, ultimateRival, ultimateScore } from '../../src/core/rivals/ultimate';
import type { Rival } from '../../src/core/story/schema';
import { advanceArc, arcOf, goodChance } from '../../src/core/rivals/arcs';
import { RIVAL_ARCS } from '../../src/core/rivals/schema';
import { edgeKind, simulateRivalWorld } from '../../src/core/rivals/world';
import { rivalMods } from '../../src/core/rivals/profile';
import { rivalChronicle } from '../../src/core/rivals/chronicle';
import { mostUsedType, rivalReturn, rivalReturnFlag, waitingRival } from '../../src/core/rivals/adapt';
import { chooseNode, chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { RivalSchema } from '../../src/core/story/schema';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import catalog from '../../src/data/rivalCatalog.json';
import { afterBattleBehavior, bondLines, bondNote, bondShift, ensureBonds, RIVAL_BONDS, simulateOffscreen } from '../../src/core/rivals/bonds';
import { legacyNote, pokemonInfluence, substitute, trainingExchange, triangleEffect } from '../../src/core/rivals/relations';
import { reputation, signature } from '../../src/core/rivals/bonds';
import { content, toBattle } from './helpers';

function trainerBattle(seed: string, opts: { leaderId?: string | null; faintedMate?: boolean } = {}): RunState {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'rv', seed, archetypeId: 'red' }), 0)));
  const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
  lead.moves = [{ id: 'tackle', pp: 35 }];
  lead.hp = Math.floor(maxHp(content, lead) * 0.2);
  run.party[0] = lead;
  if (opts.faintedMate) {
    const mate = createPokemon(content, 'pidgey', 5, 'mate');
    mate.hp = 0;
    run.party.push(mate);
  }
  const foe = createPokemon(content, 'rattata', 5, 'e1');
  foe.hp = 1;
  foe.moves = [{ id: 'growl', pp: 40 }];
  run.battle = createBattle('trainer', [foe], 0, lead.uid, { classId: 'youngster', name: 'Joey', leaderId: opts.leaderId ?? null });
  return run;
}
const win = (run: RunState) => takeTurn(content, run, { kind: 'move', index: 0 }).run;

describe('rival Spark', () => {
  it('a close or flawless win makes the trainer a rival with traits and a memory of the battle', () => {
    const run = win(trainerBattle('spark'));
    expect(run.story.rivals).toHaveLength(1);
    const rival = run.story.rivals[0]!;
    expect(RivalSchema.parse(rival)).toEqual(rival);
    expect(rival).toMatchObject({ name: 'Joey', classId: 'youngster', origin: { path: expect.any(String) } });
    expect(Object.keys(RIVAL_PROFILES.personalities)).toContain(rival.archetype);
    expect(RIVAL_PROFILES.personalities[rival.archetype]!.styles).toContain(rival.style);
    expect(rival.memory.lastBattle).toMatchObject({ result: 'win', team: ['rattata'] });
    expect(run.story.events.some((e) => e.type === 'rivalryFormed')).toBe(true);
  });

  it('is deterministic: the same seed gives the same rival, and the gameplay streams are untouched', () => {
    const a = win(trainerBattle('same'));
    const b = win(trainerBattle('same'));
    expect(a.story.rivals).toEqual(b.story.rivals);
    expect(a.rng).toEqual(b.rng);
  });

  it('an ordinary win (a Pokémon fainted, little HP lost) is not enough; gym leaders never spark', () => {
    expect(sparkGain({ hpLeftShare: 0.9, flawless: false })).toBeLessThan(RIVAL_CONFIG.spark.threshold);
    expect(win(trainerBattle('boss', { leaderId: 'brock' })).story.rivals).toEqual([]);
  });

  it('a run has at most maxRivals rivals, and one battle never makes two', () => {
    const first = win(trainerBattle('limit'));
    expect(first.story.rivals).toHaveLength(1);
    const again = trainerBattle('limit-2');
    again.story.rivals = Array.from({ length: RIVAL_CONFIG.maxRivals }, (_, i) => ({ ...structuredClone(first.story.rivals[0]!), id: `r${i}` }));
    expect(win(again).story.rivals).toHaveLength(RIVAL_CONFIG.maxRivals);
    // With room left, another memorable win makes a second rival; the same battle can't make it twice.
    const room = trainerBattle('limit-3');
    room.story.rivals = structuredClone(first.story.rivals);
    expect(win(room).story.rivals).toHaveLength(2);
  });
});

describe('rivals in saves', () => {
  it('a version 10 run loads with no rivals', () => {
    const storage = new MemoryStorageProvider();
    const run = win(trainerBattle('save'));
    const { rivals: _r, ...story } = run.story;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 10, savedAt: '', data: { ...run, story } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(10);
    expect(loaded.data.story.rivals).toEqual([]);
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(13);
  });

  it('a version 3 settings record gains the dialogue setting', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 3, savedAt: '', data: { musicVolume: 0.3, sfxVolume: 0.4, muted: false, battleAnimations: 'full', effectIntensity: 1, battleSpeed: 'normal' } }));
    expect(new SaveManager(storage, content).loadSettings()).toMatchObject({ dialogueFrequency: 'normal', battleSpeed: 'normal' });
  });

  it('a version 12 run loads with an empty raid record', () => {
    const storage = new MemoryStorageProvider();
    const { raids: _r, ...run } = win(trainerBattle('save12')) as RunState & { raids?: unknown };
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 12, savedAt: '', data: run }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(12);
    expect(loaded.data.raids).toEqual({ entered: 0, won: 0, lost: 0, bestTier: 0, done: [] });
  });

  it('a version 11 run keeps its rivals and gains empty bonds', () => {
    const storage = new MemoryStorageProvider();
    const run = win(trainerBattle('save11'));
    const rivals = run.story.rivals.map(({ bonds: _b, offscreen: _o, ...r }) => r);
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 11, savedAt: '', data: { ...run, story: { ...run.story, rivals } } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(11);
    expect(loaded.data.story.rivals).toHaveLength(run.story.rivals.length);
    expect(loaded.data.story.rivals[0]!.bonds).toEqual({});
    expect(loaded.data.story.rivals[0]!.offscreen).toEqual([]);
  });

  it('a saved rival survives a reload', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const run = win(trainerBattle('reload'));
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status === 'ok' && loaded.data.story.rivals).toEqual(run.story.rivals);
  });
});

describe('rival return and adaptation', () => {
  function sparked(seed: string): RunState {
    return win(trainerBattle(seed));
  }

  it('a rival from an earlier stage replaces the next ordinary trainer, once per region, with its team and one counter-pick', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'rb', seed: 'rb', archetypeId: 'red' }), 0));
    run.story.rivals = structuredClone(sparked('rb').story.rivals);
    run.story.rivals[0]!.origin.where.stage = 5;
    // The party uses Electric moves.
    run.party[0]!.moves = [{ id: 'thunderbolt', pp: 15 }];
    expect(waitingRival(run)?.id).toBe(run.story.rivals[0]!.id);

    const node = nextChoices(run.stage!)[0]!;
    node.kind = 'trainer';
    const after = chooseNode(content, run, node.id);
    const battle = after.battle!;
    expect(battle.rivalId).toBe(run.story.rivals[0]!.id);
    expect(battle.trainer).toMatchObject({ classId: 'youngster', name: 'Joey' });
    expect(battle.enemyTeam.length).toBeGreaterThanOrEqual(1);
    expect(after.story.flags[rivalReturnFlag(battle.rivalId!)]).toBe(0);
    expect(waitingRival(after)).toBeNull();
    // Telegraphed: if the team changed, the player is told, and the record keeps it.
    if (battle.rivalNote) expect(after.story.rivals[0]!.adaptations).toEqual([battle.rivalNote]);
  });

  it('counter-pick resists the party\'s most-used type and swaps only one member', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ad', seed: 'ad', archetypeId: 'red' }), 0));
    run.party[0]!.moves = [{ id: 'thunderbolt', pp: 15 }];
    expect(mostUsedType(content, run)).toBe('electric');
    const rival = sparked('ad').story.rivals[0]!;
    const plan: TrainerPlan = { classId: 'youngster', name: 'x', leaderId: null, ai: 0, members: [{ speciesId: 'geodude', level: 20 }, { speciesId: 'pidgey', level: 20 }], levelInfo: [{ level: 20 } as never, { level: 20 } as never] };
    const ret = rivalReturn(content, run, rival, plan, { kind: 'rematch', levelBonus: 1, extraMembers: 1, perStage: 1, perRegion: 4 });
    expect(ret.note).toContain('studied your electric moves');
    expect(ret.plan.members.map((m) => m.speciesId)).toContain('geodude');
    expect(ret.plan.members).toHaveLength(2);
    expect(rivalReturn(content, run, rival, plan, { kind: 'rematch', levelBonus: 1, extraMembers: 1, perStage: 1, perRegion: 4 })).toEqual(ret);
  });
});

describe('rival chronicle', () => {
  it('describes each rival: who, how it fights, what it remembers', () => {
    const run = win(trainerBattle('chron'));
    const [line] = rivalChronicle(content, run);
    expect(line!.title).toContain('Youngster Joey');
    expect(line!.summary).toMatch(/^Fights as [\w -]+\. Strongest trait: \w+ \(\d+\)\.$/);
    expect(line!.memory).toContain('Last battle:');
    expect(rivalChronicle(content, createRun(content, { runId: 'x', seed: 'x', archetypeId: 'red' }))).toEqual([]);
  });
});

describe('personalities and battle styles', () => {
  it('every personality and style of the Examples doc has a profile, and every pairing exists', () => {
    expect(Object.keys(RIVAL_PROFILES.personalities).sort()).toEqual(catalog.personalities.map((p) => p.id).sort());
    expect(Object.keys(RIVAL_PROFILES.styles).sort()).toEqual(catalog.styles.map((s) => s.id).sort());
    for (const p of Object.values(RIVAL_PROFILES.personalities)) for (const s of p.styles) expect(RIVAL_PROFILES.styles[s], s).toBeDefined();
  });

  it('traits change the return: vindictive +1 level, forgiving -1, low adaptability never adapts, style sets AI', () => {
    const base = { archetype: 'avenger', style: 'revenge-striker', traits: { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 90, resilience: 50 } };
    expect(rivalMods(base)).toMatchObject({ levelBonus: 1, canAdapt: true, ai: 0.4 });
    expect(rivalMods({ ...base, traits: { ...base.traits, vindictiveness: 5, adaptability: 20 } })).toMatchObject({ levelBonus: -1, canAdapt: false });
    expect(rivalMods({ ...base, style: 'counter-builder' }).adaptCap).toBe(8);
    expect(rivalMods({ ...base, style: 'nope' })).toMatchObject({ ai: 0, statBias: [] });
  });

  it('a rival that cannot adapt returns without a note, and its battle uses the style AI', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'na', seed: 'na', archetypeId: 'red' }), 0));
    run.party[0]!.moves = [{ id: 'thunderbolt', pp: 15 }];
    const rival = structuredClone(sparked0('na').story.rivals[0]!);
    rival.traits.adaptability = 10;
    rival.style = 'anti-meta';
    const plan: TrainerPlan = { classId: 'youngster', name: 'x', leaderId: null, ai: 0, members: [{ speciesId: 'geodude', level: 20 }, { speciesId: 'pidgey', level: 20 }], levelInfo: [{ level: 20 } as never, { level: 20 } as never] };
    const ret = rivalReturn(content, run, rival, plan, { kind: 'rematch', levelBonus: 1, extraMembers: 1, perStage: 1, perRegion: 4 });
    expect(ret.note).toBeNull();
    expect(ret.plan.ai).toBe(0.6);
  });
});

function sparked0(seed: string): RunState {
  return win(trainerBattle(seed));
}

describe('rival outcomes and the Ultimate Rival', () => {
  const traits = (over: Partial<Rival['traits']>): Rival['traits'] => ({ ambition: 70, pride: 50, empathy: 50, adaptability: 60, vindictiveness: 60, resilience: 60, ...over });
  const rival = (id: string, over: Partial<Rival> = {}): Rival => ({
    id,
    classId: 'youngster',
    name: id,
    archetype: 'prodigy',
    style: 'blitz',
    traits: traits({}),
    rivalPotential: 15,
    state: 'recognized',
    encounters: 0,
    setbacks: 0,
    arc: null,
    away: 0,
    cooldown: 0,
    progress: 0,
    adaptations: [],
    bonds: {},
    offscreen: [],
    origin: { eventId: 'e', where: { region: 0, stage: 0, level: 1, node: null, battle: 0, turn: null }, path: 'spark' },
    memory: { lastBattle: { eventId: 'e', result: 'win', hpLeftShare: 0.2, turns: 4, team: ['rattata'] } },
    ...over,
  });

  it('climbs the ladder as potential grows; nemesis needs a grudge, contender needs ambition', () => {
    expect(stateFor({ rivalPotential: 10, traits: traits({}) })).toBe('recognized');
    expect(stateFor({ rivalPotential: 30, traits: traits({}) })).toBe('recurring');
    expect(stateFor({ rivalPotential: 45, traits: traits({}) })).toBe('active');
    expect(stateFor({ rivalPotential: 65, traits: traits({ vindictiveness: 80 }) })).toBe('nemesis');
    expect(stateFor({ rivalPotential: 65, traits: traits({ vindictiveness: 10 }) })).toBe('active');
    expect(stateFor({ rivalPotential: 90, traits: traits({}) })).toBe('contender');
  });

  it('losing never deletes a rival: a gracious one becomes an ally, a fragile one is shaken then retires', () => {
    const kind = rival('kind', { traits: traits({ empathy: 90, pride: 20 }), encounters: 1, rivalPotential: 20 });
    expect(applyDefeat(kind, 12)).toBe('ally');
    expect(isHostile(kind)).toBe(false);
    const fragile = rival('fragile', { traits: traits({ resilience: 20, empathy: 10 }), rivalPotential: 40 });
    expect(applyDefeat(fragile, 5)).toBe('shaken');
    expect(fragile.rivalPotential).toBe(35);
    applyDefeat(fragile, 5);
    expect(applyDefeat(fragile, 5)).toBe('retired');
    const tough = rival('tough');
    expect(applyDefeat(tough, 12)).toBe('grew');
    expect(tough).toMatchObject({ encounters: 1, setbacks: 0 });
  });

  it('allies never come back to fight you', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'al', seed: 'al', archetypeId: 'red' }), 0));
    run.story.rivals = [rival('friend', { state: 'ally' })];
    expect(waitingRival(run)).toBeNull();
  });

  it('the Ultimate Rival needs a history with you, is chosen by score, and only changes when clearly beaten', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ul', seed: 'ul', archetypeId: 'red' }), 0));
    run.story.rivals = [rival('a', { encounters: 0 }), rival('b', { encounters: 1, rivalPotential: 30 })];
    expect(evaluateUltimate(run)?.id).toBe('b');
    expect(ultimateRival(run)?.id).toBe('b');
    // Slightly better rival: the story keeps following b.
    run.story.rivals.push(rival('c', { encounters: 1, rivalPotential: 32 }));
    expect(evaluateUltimate(run)).toBeNull();
    expect(ultimateRival(run)?.id).toBe('b');
    // b becomes an ally: the designation moves on.
    run.story.rivals[1]!.state = 'ally';
    expect(evaluateUltimate(run)?.id).toBe('c');
    expect(ultimateScore(run.story.rivals[2]!, 0)).toBeGreaterThan(0);
  });
});

describe('rival battle outcome in a real battle', () => {
  it('beating the returning rival records the encounter, climbs, and may name the Ultimate Rival', () => {
    const first = win(trainerBattle('fight'));
    const again = trainerBattle('fight-2');
    again.story.rivals = structuredClone(first.story.rivals);
    again.battle!.rivalId = again.story.rivals[0]!.id;
    const after = win(again);
    const r = after.story.rivals[0]!;
    expect(r.encounters).toBe(1);
    expect(r.rivalPotential).toBeGreaterThan(first.story.rivals[0]!.rivalPotential);
    expect(['recognized', 'recurring', 'active', 'nemesis', 'contender', 'ally', 'retired']).toContain(r.state);
    // One encounter is enough history unless the rival became an ally or retired.
    if (r.state !== 'ally' && r.state !== 'retired') expect(ultimateRival(after)?.id).toBe(r.id);
  });
});

describe('the rivals\' world', () => {
  function worldRun(seed: string, rivals: Rival[]): RunState {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'w', seed, archetypeId: 'red' }), 0));
    run.story.rivals = rivals;
    return run;
  }
  const sample = (id: string, over: Partial<Rival> = {}) => structuredClone({ ...(win(trainerBattle(`w-${id}`)).story.rivals[0]!), id, name: id, ...over });

  it('is deterministic and runs once per stage', () => {
    const make = () => worldRun('det', [sample('a'), sample('b')]);
    const x = make();
    const y = make();
    simulateRivalWorld(content, x);
    simulateRivalWorld(content, y);
    expect(x.story).toEqual(y.story);
    const snapshot = structuredClone(x.story);
    simulateRivalWorld(content, x);
    expect(x.story).toEqual(snapshot);
  });

  it('over many stages rivals gain progress, sit out, form feelings about each other and leave rumours', () => {
    const run = worldRun('many', [sample('a'), sample('b'), sample('c')]);
    for (let stage = 0; stage < 12; stage++) {
      run.stage!.index = stage;
      simulateRivalWorld(content, run);
    }
    expect(run.story.rivals.some((r) => r.progress > 0)).toBe(true);
    expect(run.story.rivals.every((r) => r.progress <= RIVAL_CONFIG.world.progressCap)).toBe(true);
    expect(run.story.rivalGraph.length).toBeGreaterThan(0);
    expect(new Set(run.story.rivalGraph.map((e) => `${e.a}|${e.b}`)).size).toBe(run.story.rivalGraph.length);
    expect(run.story.chronicle.some((c) => c.text.includes('rumour') || c.text.includes('Word is'))).toBe(true);
    expect(run.rng).toEqual(worldRun('many', []).rng);
  });

  it('feelings come from character, and progress makes a returning rival stronger', () => {
    const kind = (e: number, a: number) => sample('k', { traits: { ambition: a, pride: 50, empathy: e, adaptability: 50, vindictiveness: 50, resilience: 50 } });
    expect(edgeKind(kind(80, 20), kind(70, 20))).toBe('friends');
    expect(edgeKind(kind(10, 80), kind(10, 70))).toBe('enemies');
    expect(edgeKind(kind(10, 20), kind(10, 70))).toBe('partners');
    const base = sample('p');
    expect(rivalMods({ ...base, progress: 2 }).levelBonus).toBe(rivalMods({ ...base, progress: 0 }).levelBonus + 2);
  });

  it('a rival on cooldown or away on a private goal does not take the next trainer slot', () => {
    const run = worldRun('cd', [sample('cd', { cooldown: 1, origin: { eventId: 'e', where: { region: 0, stage: 5, level: 1, node: null, battle: 0, turn: null }, path: 'spark' } })]);
    expect(waitingRival(run)).toBeNull();
    run.story.rivals[0]!.cooldown = 0;
    expect(waitingRival(run)?.id).toBe('cd');
  });
});

describe('rival paths', () => {
  const emptyRun = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'pa', seed: 'pa', archetypeId: 'red' }), 0));
  const where = { region: 0, stage: 0, level: 1, node: null, battle: 3, turn: null };
  const input = (over: Partial<SparkInput> = {}): SparkInput => ({
    where,
    classId: 'youngster',
    name: 'Joey',
    team: ['rattata'],
    ended: { id: 'pa#9', seq: 9, type: 'battleEnded', where, actors: [], data: {} },
    hpLeftShare: 0.2,
    turns: 6,
    flawless: true,
    ...over,
  });
  /** The paths a spark can take across many seeds. */
  function pathsSeen(over: Partial<SparkInput>, setup: (run: RunState) => void = () => undefined): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const run = emptyRun();
      run.seed = `paths-${i}`;
      setup(run);
      const rival = maybeSpark(run, input({ ended: { ...input().ended, id: `paths-${i}#9` }, ...over }));
      if (rival) seen.add(rival.origin.path);
    }
    return seen;
  }

  it('a dominant win becomes public humiliation (proud rival) or a merciful victory; a close win never does', () => {
    const seen = pathsSeen({ hpLeftShare: 0.95, turns: 3 });
    expect([...seen].every((p) => ['public-humiliation', 'merciful-victor', 'family-legacy', 'self-made-challenger', 'researcher', 'collector-s-rival', 'ideological-opponent', 'fallen-prodigy'].includes(p) || p === 'unexpected-nemesis')).toBe(true);
    expect(seen.has('public-humiliation') || seen.has('merciful-victor')).toBe(true);
    expect(pathsSeen({ hpLeftShare: 0.2 }).has('public-humiliation')).toBe(false);
  });

  it('a trainer who lost again after vowing to return is a rival you neglected', () => {
    expect(pathsSeen({ returning: true })).toEqual(new Set(['rival-you-neglected']));
  });

  it('a rival who turns up in a later region is a world traveller; a second one in a region is an accidental competitor', () => {
    expect(pathsSeen({ where: { ...where, region: 2 }, hpLeftShare: 0.2 }).has('world-traveler')).toBe(true);
    const second = pathsSeen({}, (run) => {
      run.story.rivals = structuredClone(win(trainerBattle('pa-first')).story.rivals);
    });
    expect(second.has('accidental-competitor')).toBe(true);
  });

  it('a path nudges traits and adds potential, and every path in the data is in the catalog', () => {
    for (const p of RIVAL_PATHS.paths) expect(catalog.paths.map((c) => c.id), p.id).toContain(p.id);
    const humiliated = RIVAL_PATHS.paths.find((p) => p.id === 'public-humiliation')!;
    expect(humiliated.potentialBonus).toBeGreaterThan(0);
    expect(RIVAL_PATHS.paths.at(-1)!.id).toBe('unexpected-nemesis');
  });
});

describe('rival character arcs', () => {
  const kindRival = (over: Partial<Rival> = {}): Rival => structuredClone({ ...(win(trainerBattle('arc')).story.rivals[0]!), arc: { id: 'prodigy-learns-humility', stage: 0, ticks: 0, resolution: null }, encounters: 0, ...over });

  it('every arc of the data is in the catalog, and a prodigy gets the humility arc', () => {
    for (const a of RIVAL_ARCS.arcs) expect(catalog.arcs.map((c) => c.id), a.id).toContain(a.id);
    const seen = new Set<string | undefined>();
    for (let i = 0; i < 200; i++) {
      const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'a', seed: `arcs-${i}`, archetypeId: 'red' }), 0));
      const rival = maybeSpark(run, { where: { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: null }, classId: 'youngster', name: 'J', team: ['rattata'], ended: { id: `arcs-${i}#1`, seq: 1, type: 'battleEnded', where: { region: 0, stage: 0, level: 1, node: null, battle: 1, turn: null }, actors: [], data: {} }, hpLeftShare: 0.2, turns: 6, flawless: true });
      if (rival?.archetype === 'prodigy') seen.add(rival.arc?.id);
    }
    expect([...seen]).toEqual(['prodigy-learns-humility']);
  });

  it('turns after the first fight, resolves after three, once, nudging traits', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'a', seed: 'arc-run', archetypeId: 'red' }), 0));
    const rival = kindRival();
    expect(arcOf(rival)!.id).toBe('prodigy-learns-humility');
    expect(advanceArc(content, run, rival)).toBeNull();
    rival.encounters = 1;
    expect(advanceArc(content, run, rival)).toBe('turned');
    expect(advanceArc(content, run, rival)).toBeNull();
    rival.encounters = 3;
    const before = { ...rival.traits };
    expect(advanceArc(content, run, rival)).toBe('resolved');
    expect(rival.arc!.resolution).not.toBeNull();
    expect(rival.traits).not.toEqual(before);
    expect(advanceArc(content, run, rival)).toBeNull();
    // Same seed, same ending.
    const again = kindRival({ encounters: 3, arc: { id: 'prodigy-learns-humility', stage: 1, ticks: 0, resolution: null } });
    advanceArc(content, run, again);
    expect(again.arc!.resolution).toBe(rival.arc!.resolution);
  });

  it('arcs also move with the stages even if you never meet the rival, and empathetic resilient rivals usually grow', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'a', seed: 'arc-tick', archetypeId: 'red' }), 0));
    const rival = kindRival();
    const results = [];
    for (let i = 0; i < RIVAL_ARCS.resolveTicks; i++) results.push(advanceArc(content, run, rival, true));
    expect(results).toContain('turned');
    expect(results).toContain('resolved');
    expect(goodChance(kindRival({ traits: { ambition: 50, pride: 50, empathy: 90, adaptability: 50, vindictiveness: 50, resilience: 90 } }))).toBeGreaterThan(goodChance(kindRival({ traits: { ambition: 50, pride: 50, empathy: 10, adaptability: 50, vindictiveness: 50, resilience: 10 } })));
  });
});

describe('rival bonds and off-screen events', () => {
  const mk = (seed: string, over: Partial<Rival> = {}): { run: RunState; rival: Rival } => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'b', seed, archetypeId: 'red' }), 0));
    const base = win(trainerBattle(`b-${seed}`)).story.rivals[0]!;
    const rival = structuredClone({ ...base, ...over });
    rival.memory.lastBattle.team = ['rattata', 'pidgey', 'jolteon'];
    run.story.rivals = [rival];
    return { run, rival };
  };

  it('data: 39 events, 14 behaviours, 12 traits, 7 habit slots, every cause points at a real event', () => {
    const ids = new Set(RIVAL_BONDS.events.map((e) => e.id));
    expect(RIVAL_BONDS.events).toHaveLength(39);
    expect(RIVAL_BONDS.behaviors).toHaveLength(14);
    expect(Object.keys(RIVAL_BONDS.traits)).toHaveLength(12);
    expect(RIVAL_BONDS.habits.slots).toHaveLength(7);
    for (const e of RIVAL_BONDS.events) if (e.after) expect(ids.has(e.after)).toBe(true);
  });

  it('gives each Pokémon its own bond, trait and starting values', () => {
    const { run, rival } = mk('init');
    ensureBonds(run, rival);
    expect(Object.keys(rival.bonds).sort()).toEqual(['jolteon', 'pidgey', 'rattata']);
    for (const b of Object.values(rival.bonds)) {
      expect(RIVAL_BONDS.traits[b.trait]).toBeDefined();
      expect(b.trust).toBeGreaterThanOrEqual(RIVAL_BONDS.start.low);
      expect(b.strain).toBe(RIVAL_BONDS.start.strain);
    }
  });

  it('runs one event per stage, deterministically, keeping dimensions in range and a bounded history', () => {
    const a = mk('det2');
    const b = mk('det2');
    for (let i = 0; i < 40; i++) {
      simulateOffscreen(content, a.run, a.rival, `0.${i}`);
      simulateOffscreen(content, b.run, b.rival, `0.${i}`);
    }
    expect(a.rival).toEqual(b.rival);
    expect(a.rival.offscreen.length).toBeLessThanOrEqual(RIVAL_BONDS.perStage.historyKept);
    for (const bond of Object.values(a.rival.bonds)) {
      expect(bond.recent.length).toBeLessThanOrEqual(RIVAL_BONDS.perStage.recentKept);
      for (const k of ['trust', 'affection', 'respect', 'synchronization', 'confidence', 'autonomy', 'strain', 'hyperReadiness'] as const) {
        expect(bond[k]).toBeGreaterThanOrEqual(0);
        expect(bond[k]).toBeLessThanOrEqual(100);
      }
    }
    expect(a.run.rng).toEqual(mk('det2').run.rng);
  });

  it('follows causal chains: an event with a cause only happens after it, and records that cause', () => {
    const { run, rival } = mk('chain');
    for (let i = 0; i < 120; i++) simulateOffscreen(content, run, rival, `0.${i}`);
    const withCause = rival.offscreen.filter((o) => o.cause);
    // Over 120 stages every chained event that happened was preceded by its cause on the same Pokémon.
    for (const o of withCause) {
      const before = rival.offscreen.find((p) => p.id === o.cause);
      expect(before?.pokemon === undefined || before.pokemon === o.pokemon).toBe(true);
    }
  });

  it('never runs an Overtraining Incident on a worn-out Pokémon or a Technique Breakthrough on a confident one', () => {
    const { run, rival } = mk('elig');
    ensureBonds(run, rival);
    for (const b of Object.values(rival.bonds)) { b.strain = 85; b.confidence = 95; }
    for (let i = 0; i < 30; i++) simulateOffscreen(content, run, rival, `0.${i}`);
    expect(rival.offscreen.some((o) => o.eventType === 'offscreen-16' || o.eventType === 'offscreen-20')).toBe(false);
  });

  it('skips Pokémon that are worn out (rest first)', () => {
    const { run, rival } = mk('rest');
    ensureBonds(run, rival);
    for (const b of Object.values(rival.bonds)) b.strain = 100;
    expect(simulateOffscreen(content, run, rival, '0.0')).toBeNull();
  });

  it('trainer behaviour after a loss depends on character', () => {
    const kind = mk('beh', { traits: { ambition: 50, pride: 80, empathy: 20, adaptability: 40, vindictiveness: 50, resilience: 50 } });
    const warm = mk('beh', { traits: { ambition: 50, pride: 20, empathy: 80, adaptability: 40, vindictiveness: 50, resilience: 50 } });
    const names = (m: { run: RunState; rival: Rival }) => {
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) { m.rival.encounters = i; seen.add(afterBattleBehavior(content, m.run, m.rival, false) ?? ''); }
      return seen;
    };
    const proud = names(kind);
    expect(proud.has('Repeatedly blames a Pokémon for losing') || proud.has('Repeatedly benches a Pokémon after one loss')).toBe(true);
    expect(proud.has('Lets a Pokémon rest after a difficult battle')).toBe(false);
    expect(names(warm).has('Lets a Pokémon rest after a difficult battle')).toBe(true);
  });

  it('bonds change the rival: synced and confident returns stronger, worn out weaker, and the player can notice', () => {
    const { run, rival } = mk('shift');
    ensureBonds(run, rival);
    for (const b of Object.values(rival.bonds)) { b.synchronization = 90; b.confidence = 90; b.strain = 10; }
    expect(bondShift(rival)).toBe(1);
    for (const b of Object.values(rival.bonds)) b.strain = 90;
    expect(bondShift(rival)).toBe(-1);
    rival.offscreen = [{ id: 'x', eventType: 'offscreen-05', pokemon: 'rattata', at: '0.0', cause: null, visibility: 'observed', text: 'Rattata now sits beside Joey without being asked.', shown: false }];
    expect(bondNote(rival)).toContain('sits beside');
    expect(bondNote(rival)).toBeNull();
    expect(bondLines(content, rival)).toHaveLength(3);
  });

  it('a save from before bonds loads with empty bonds (migration v12)', () => {
    const { run } = mk('mig');
    const old = structuredClone(run) as unknown as { story: { rivals: Record<string, unknown>[] } };
    for (const r of old.story.rivals) { delete r.bonds; delete r.offscreen; }
    const parsed = RivalSchema.parse(old.story.rivals[0]);
    expect(parsed.bonds).toEqual({});
    expect(parsed.offscreen).toEqual([]);
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(12);
  });
});

describe('rival relations and memory', () => {
  const mk = (seed: string, over: Partial<Rival> = {}): { run: RunState; rival: Rival } => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0));
    const rival = structuredClone({ ...win(trainerBattle(`r-${seed}`)).story.rivals[0]!, ...over });
    rival.memory.lastBattle.team = ['rattata', 'pidgey', 'jolteon'];
    run.story.rivals = [rival];
    return { run, rival };
  };
  const t = (o: Partial<Rival['traits']>): Rival['traits'] => ({ ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50, ...o });

  it('training exchange moves two rivals toward each other on the trait where they differ most', () => {
    const a = mk('a', { traits: t({ ambition: 90 }) }).rival;
    const b = mk('b', { traits: t({ ambition: 30 }) }).rival;
    expect(trainingExchange(a, b)).toBe('ambition');
    expect(a.traits.ambition).toBe(90 - RIVAL_CONFIG.relations.exchangeShift);
    expect(b.traits.ambition).toBe(30 + RIVAL_CONFIG.relations.exchangeShift);
    expect(trainingExchange(mk('c').rival, mk('c').rival)).toBeNull();
  });

  it('enemy Pokémon spar: one gains confidence, the other loses it, deterministically', () => {
    const run = mk('inf').run;
    const a = run.story.rivals[0]!;
    const b = structuredClone({ ...a, id: 'other', name: 'other' });
    const run2 = structuredClone(run);
    const r1 = pokemonInfluence(run, a, b, '0.0');
    const r2 = pokemonInfluence(run2, run2.story.rivals[0]!, structuredClone({ ...run2.story.rivals[0]!, id: 'other', name: 'other' }), '0.0');
    expect(r1?.winner.id).toBe(r2?.winner.id);
    expect(r1?.winner.id).not.toBe(r1?.loser.id);
  });

  it('rivalry triangle: beating a rival spurs its enemy and a vindictive friend, not a gentle friend', () => {
    const run = mk('tri').run;
    const [beaten] = run.story.rivals as [Rival];
    const mkOther = (id: string, vind: number) => structuredClone({ ...beaten, id, name: id, traits: t({ vindictiveness: vind }) });
    const enemy = mkOther('enemy', 10);
    const vindictive = mkOther('vind', 90);
    const gentle = mkOther('gentle', 10);
    run.story.rivals = [beaten, enemy, vindictive, gentle];
    run.story.rivalGraph = [{ a: beaten.id, b: 'enemy', kind: 'enemies' }, { a: beaten.id, b: 'vind', kind: 'friends' }, { a: beaten.id, b: 'gentle', kind: 'friends' }];
    const before = run.story.rivals.map((r) => r.rivalPotential);
    expect(triangleEffect(run, beaten).sort()).toEqual(['enemy', 'vind']);
    expect(enemy.rivalPotential).toBe(before[1]! + RIVAL_CONFIG.relations.triangleGain);
    expect(gentle.rivalPotential).toBe(before[3]);
  });

  it('a worn-out ace sits out and the next Pokémon leads; a rested one leads', () => {
    const { run, rival } = mk('sub');
    const members = [{ speciesId: 'rattata' }, { speciesId: 'pidgey' }, { speciesId: 'jolteon' }];
    ensureBonds(run, rival);
    expect(substitute(content, run, rival, members)).toBeNull();
    rival.bonds.rattata!.strain = 95;
    const sub = substitute(content, run, rival, members)!;
    expect(sub.order).toEqual([1, 0, 2]);
    expect(sub.note).toContain('leads');
  });

  it('a rival remembers a close last battle but not a clean one', () => {
    const { rival } = mk('leg');
    rival.encounters = 1;
    rival.memory.lastBattle.hpLeftShare = 0.05;
    expect(legacyNote(rival)).toContain('close');
    rival.memory.lastBattle.hpLeftShare = 0.9;
    expect(legacyNote(rival)).toBeNull();
  });
});

describe('reputation and signature', () => {
  it('reputation comes from trust, strain and ambition; a signature needs two fights and a tell', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'q', seed: 'rep', archetypeId: 'red' }), 0));
    const rival = structuredClone(win(trainerBattle('rep')).story.rivals[0]!);
    rival.memory.lastBattle.team = ['rattata'];
    run.story.rivals = [rival];
    ensureBonds(run, rival);
    rival.encounters = 1;
    rival.bonds.rattata!.trust = 90;
    rival.bonds.rattata!.strain = 10;
    expect(reputation(rival)).toBe('respected');
    rival.bonds.rattata!.strain = 90;
    rival.traits.ambition = 80;
    expect(reputation(rival)).toBe('feared');
    rival.traits.ambition = 20;
    expect(reputation(rival)).toBe('disliked');
    rival.encounters = 0;
    expect(reputation(rival)).toBe('unknown');
    rival.encounters = 1;
    rival.bonds.rattata!.habits.tell = 'stamps before a big move';
    expect(signature(content, rival)).toBeNull();
    rival.encounters = 2;
    expect(signature(content, rival)).toContain('stamps');
  });
});
