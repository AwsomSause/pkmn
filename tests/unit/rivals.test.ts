// Living Rivalry Engine, slice 1: a Spark makes one rival with a personality and a memory of the battle that did it.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { RIVAL_CONFIG } from '../../src/core/rivals/schema';
import { sparkGain } from '../../src/core/rivals/manager';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { RivalSchema } from '../../src/core/story/schema';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
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
    expect(RIVAL_CONFIG.archetypes.map((a) => a.id)).toContain(rival.archetype);
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
