// Living Rivalry Engine, slice 1: a Spark makes one rival with a personality and a memory of the battle that did it.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { RIVAL_CONFIG, RIVAL_PROFILES } from '../../src/core/rivals/schema';
import { sparkGain } from '../../src/core/rivals/manager';
import { nextChoices } from '../../src/core/map';
import type { TrainerPlan } from '../../src/core/encounters';
import { rivalMods } from '../../src/core/rivals/profile';
import { rivalChronicle } from '../../src/core/rivals/chronicle';
import { mostUsedType, rivalReturn, rivalReturnFlag, waitingRival } from '../../src/core/rivals/adapt';
import { chooseNode, chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { RivalSchema } from '../../src/core/story/schema';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import catalog from '../../src/data/rivalCatalog.json';
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
    expect(rival).toMatchObject({ name: 'Joey', classId: 'youngster', origin: { path: 'spark' } });
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
    const again = trainerBattle('limit-2');
    again.story.rivals = structuredClone(first.story.rivals);
    expect(win(again).story.rivals).toHaveLength(RIVAL_CONFIG.maxRivals);
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
    expect(CURRENT_VERSIONS.run).toBe(11);
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
