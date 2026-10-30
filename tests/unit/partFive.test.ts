// Plan Part 5 extras: Challenge Contracts (Empty Bag, No Rest), the Research Directive, and the
// Wardrobe (titles and card frames), plus their save upgrades.

import { describe, expect, it } from 'vitest';
import { itemProblem } from '../../src/core/battle/engine';
import { directiveProgress } from '../../src/core/directive';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { claim } from '../../src/core/quests';
import { defaultPrep } from '../../src/core/runPrep';
import { rewardMultiplier, STANDARD_CHOICE } from '../../src/core/rules';
import { chooseStarter, createRun, visitSide } from '../../src/core/run';
import type { TypeName } from '../../src/core/contentSchema';
import type { RunState } from '../../src/core/state';
import { CARD_FRAMES, frameOpen, getFrame, setCardFrame } from '../../src/core/wardrobe';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const NOW = '2026-10-30T12:00:00.000Z';

function newRun(opts: { modifierIds?: string[]; directive?: TypeName | null; seed?: string } = {}): RunState {
  return chooseStarter(
    content,
    createRun(content, {
      runId: 'r',
      seed: opts.seed ?? 'p5',
      archetypeId: 'red',
      prep: { ...defaultPrep(content), directive: opts.directive ?? null },
      rules: { ...STANDARD_CHOICE, modifierIds: opts.modifierIds ?? [] },
    }),
    0,
  );
}

describe('Challenge Contracts', () => {
  it('Empty Bag allows only Poké Balls in battle and raises the reward multiplier', () => {
    const ctx = (no: boolean) => ({ content, battle: { kind: 'wild' } as any, party: [], inventory: { potion: 1, 'poke-ball': 1 }, noBattleItems: no });
    expect(itemProblem(ctx(true), 'potion', 0)).toContain('Empty Bag');
    expect(itemProblem(ctx(false), 'potion', 0) ?? '').not.toContain('Empty Bag');
    expect(itemProblem(ctx(true), 'poke-ball') ?? '').not.toContain('Empty Bag');
    expect(rewardMultiplier({ ...STANDARD_CHOICE, modifierIds: ['no-battle-items'] })).toBeCloseTo(1.3);
  });

  it('No Rest leaves healing stops unused', () => {
    const run = newRun({ modifierIds: ['no-heal-stops'] });
    const node = run.stage!.map.nodes[0]!;
    run.stage!.current = node.id;
    node.sides.push({ id: 'h', kind: 'heal', used: false });
    run.party[0]!.hp = 1;
    const result = visitSide(content, run, 'h');
    expect(result.message).toContain('No Rest');
    expect(result.run.party[0]!.hp).toBe(1);
    const free = newRun();
    free.stage!.current = free.stage!.map.nodes[0]!.id;
    free.stage!.map.nodes[0]!.sides.push({ id: 'h', kind: 'heal', used: false });
    free.party[0]!.hp = 1;
    expect(visitSide(content, free, 'h').run.party[0]!.hp).toBeGreaterThan(1);
  });
});

describe('the Research Directive', () => {
  it('pays its Research Points once the studied type reaches the goal, and nothing below it', () => {
    const { target, researchPoints } = content.balance.directive;
    const end = (directive: TypeName | null, n: number) => {
      const run = newRun({ directive, seed: `d-${directive}-${n}` });
      run.log.counters = { ...run.log.counters, 'defeatedOrCaught.ghost': n };
      run.phase = 'over';
      return finalizeRun(content, createProfile(content, 'p'), run, NOW);
    };
    const done = end('ghost', target);
    const none = end(null, target);
    expect(done.summary!.directive).toMatchObject({ type: 'ghost', done: true });
    expect(done.profile.researchPoints - none.profile.researchPoints).toBe(researchPoints);
    expect(end('ghost', target - 1).summary!.directive).toMatchObject({ done: false, current: target - 1 });
    expect(none.summary!.directive).toBeNull();
    expect(directiveProgress(content, newRun())).toBeNull();
  });
});

describe('the Wardrobe', () => {
  it('opens frames by their requirement and only puts on open ones', () => {
    const p = createProfile(content, 'p');
    expect(p.cardFrame).toBe('classic');
    expect(CARD_FRAMES.length).toBeGreaterThanOrEqual(8);
    const spooky = getFrame('spooky');
    expect(frameOpen(p, spooky)).toBe(false);
    expect(() => setCardFrame(p, 'spooky')).toThrow('Finish Spooky Season');
    claim(p, 'event:spooky-season:reward', NOW);
    expect(setCardFrame(p, 'spooky').cardFrame).toBe('spooky');
    expect(() => setCardFrame(p, 'nope')).toThrow('Unknown');
  });
});

describe('saves', () => {
  it('a version 10 profile gets the classic frame and loadouts without a directive', () => {
    const storage = new MemoryStorageProvider();
    const fresh = createProfile(content, 'old');
    const { cardFrame: _c, ...old } = fresh;
    const { directive: _d, ...prep } = defaultPrep(content);
    const preset = { ...prep, name: 'mine', archetypeId: 'red' };
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 10, savedAt: '', data: { ...old, lastPrep: preset, presets: [preset, null] } }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('old');
    expect(profile.cardFrame).toBe('classic');
    expect(profile.lastPrep!.directive).toBeNull();
    expect(profile.presets[0]!.directive).toBeNull();
    expect(CURRENT_VERSIONS.profile).toBeGreaterThanOrEqual(11);
  });

  it('a version 21 run studies no type', () => {
    const storage = new MemoryStorageProvider();
    const run = newRun({ directive: 'fire', seed: 'save21' });
    const { directive: _d, ...prep } = run.prep;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 21, savedAt: '', data: { ...run, prep } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(21);
    expect(loaded.data.prep.directive).toBeNull();
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(22);
  });
});
