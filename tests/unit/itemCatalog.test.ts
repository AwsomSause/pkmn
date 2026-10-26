import { describe, expect, it } from 'vitest';
import { isFreeReroll, passivePercent, teachableMoves } from '../../src/core/catalog';
import { calcStats, maxPp } from '../../src/core/pokemon';
import { generateDraft, isRewardEligible, rewardFamily } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { canCashIn, cashInItem, chooseReward, chooseStarter, createRun, resolveDecision } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { catalogRewardId } from '../../src/data';
import { content } from './helpers';

function newRun(seed = 'catalog'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

/** A run on the reward screen with exactly this draft. */
function offering(run: RunState, ...entryIds: string[]): RunState {
  return { ...run, phase: 'reward', draft: entryIds.map(catalogRewardId) };
}

const pick = (run: RunState, entryId: string, target = 0) => chooseReward(content, run, run.draft!.indexOf(catalogRewardId(entryId)), target);

describe('item catalog data', () => {
  it('turns every working catalog item into a draft card, and only those', () => {
    for (const entry of content.catalog.values()) {
      expect(content.rewards.has(catalogRewardId(entry.id)), entry.id).toBe(entry.status === 'supported');
    }
    expect([...content.catalog.values()].filter((e) => e.status === 'supported').length).toBeGreaterThan(100);
  });

  it('never offers an item that is not built yet', () => {
    const run = newRun();
    for (let i = 0; i < 100; i++) {
      for (const id of generateDraft(content, run, new Rng(hashSeed(`d-${i}`)))) {
        const effect = content.rewards.get(id)!.effect;
        if (effect.kind === 'catalog') expect(content.catalog.get(effect.entry)!.status).toBe('supported');
      }
    }
  });

  it('gives the evolution items a cash-in value', () => {
    expect(content.items.get('fire-stone')!.cashIn).toEqual({ ragePeace: 3 });
  });
});

describe('draft variety (Luck)', () => {
  it('with full variety, no family repeats while other families are left', () => {
    const run = newRun();
    for (let i = 0; i < 100; i++) {
      const draft = generateDraft(content, run, new Rng(hashSeed(`v-${i}`)), content.balance.rarityWeights, 1);
      const families = draft.map((id) => rewardFamily(content.rewards.get(id)!));
      expect(new Set(families).size, draft.join()).toBe(families.length);
    }
  });

  it('the same seed gives the same draft', () => {
    const run = newRun();
    expect(generateDraft(content, run, new Rng(hashSeed('same')))).toEqual(generateDraft(content, run, new Rng(hashSeed('same'))));
  });
});

describe('catalog effects', () => {
  it('Heart Scale gives +2 Love', () => {
    const run = offering(newRun(), 'heart-scale');
    const before = run.attributeModifiers.love ?? 0;
    const after = pick(run, 'heart-scale').run;
    expect(after.attributeModifiers.love).toBe(before + 2);
  });

  it('a Wing raises one stat of the chosen Pokémon, up to its max', () => {
    const run = offering(newRun(), 'muscle-wing');
    const before = calcStats(content, run.party[0]!).atk;
    const after = pick(run, 'muscle-wing').run;
    expect(after.party[0]!.statBoosts?.atk).toBe(2);
    expect(calcStats(content, after.party[0]!).atk).toBeGreaterThanOrEqual(before);
    const maxed = newRun();
    maxed.party[0]!.statBoosts = { atk: 20 };
    expect(isRewardEligible(content, maxed, content.rewards.get(catalogRewardId('muscle-wing'))!)).toBe(false);
  });

  it('a PP Up asks for a move and raises its max PP by a fifth', () => {
    let run = pick(offering(newRun(), 'pp-up'), 'pp-up').run;
    expect(run.phase).toBe('decision');
    expect(run.pending[0]!.kind).toBe('ppUp');
    const slot = run.party[0]!.moves[0]!;
    const base = content.moves.get(slot.id)!.pp;
    run = resolveDecision(content, run, { kind: 'ppUpMove', moveIndex: 0 }).run;
    expect(run.party[0]!.moves[0]!.ppUps).toBe(1);
    expect(maxPp(content, run.party[0]!.moves[0]!)).toBe(base + Math.floor(base * 0.2));
  });

  it('a TM offers up to three moves of its type the Pokémon can learn, and teaches the chosen one', () => {
    const base = newRun();
    const mon = base.party[0]!;
    const type = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'].find(
      (t) => teachableMoves(content, mon, t).length > 0,
    )!;
    let run = pick(offering(base, `tm-${type}`), `tm-${type}`).run;
    const decision = run.pending[0]!;
    if (decision.kind !== 'teachMove') throw new Error('expected a TM choice');
    expect(decision.moveIds.length).toBeGreaterThan(0);
    expect(decision.moveIds.length).toBeLessThanOrEqual(3);
    for (const id of decision.moveIds) expect(content.moves.get(id)!.type).toBe(type);
    run = resolveDecision(content, run, { kind: 'teachMove', moveIndex: 0 }).run;
    const party = run.party[0]!;
    const learned = party.moves.some((m) => m.id === decision.moveIds[0]) || run.pending[0]?.kind === 'learnMove';
    expect(learned).toBe(true);
  });

  it('a fossil brings its Pokémon, to keep or release like a catch', () => {
    const run = pick(offering(newRun(), 'helix-fossil'), 'helix-fossil').run;
    const decision = run.pending[0]!;
    expect(decision.kind).toBe('caught');
    if (decision.kind === 'caught') expect(decision.mon.speciesId).toBe('omanyte');
  });

  it('Max Revive can only go to a fainted Pokémon', () => {
    const run = newRun();
    const reward = content.rewards.get(catalogRewardId('max-revive'))!;
    expect(isRewardEligible(content, run, reward)).toBe(false);
    run.party[0]!.hp = 0;
    expect(isRewardEligible(content, run, reward)).toBe(true);
  });

  it('valuables give money now', () => {
    const run = offering(newRun(), 'big-pearl');
    expect(pick(run, 'big-pearl').run.money).toBeGreaterThan(run.money);
  });
});

describe('stacking and the free re-roll', () => {
  it('team items stack up to their max, then picking one re-rolls the draft for free', () => {
    let run = newRun();
    for (let i = 0; i < 5; i++) run = pick(offering(run, 'amulet-coin', 'pearl', 'stardust', 'heart-scale', 'red-shard'), 'amulet-coin').run;
    expect(run.passives?.['amulet-coin']).toBe(5);
    expect(passivePercent(content, run, 'money')).toBe(75);
    expect(isFreeReroll(run, content.catalog.get('amulet-coin')!)).toBe(true);
    const before = offering(run, 'amulet-coin', 'pearl', 'stardust', 'heart-scale', 'red-shard');
    const result = pick(before, 'amulet-coin');
    expect(result.reward.reroll).toBe(true);
    expect(result.run.phase).toBe('reward');
    expect(result.run.draft).toHaveLength(content.balance.draftSize);
    expect(result.run.passives?.['amulet-coin']).toBe(5);
  });
});

describe('cash-in', () => {
  it('an evolution item nobody can use trades for its attribute bonus', () => {
    const run = newRun();
    run.inventory['fire-stone'] = 1;
    const canUse = !canCashIn(content, run, 'fire-stone');
    if (canUse) return; // this starter can evolve with it; nothing to check
    const after = cashInItem(content, run, 'fire-stone').run;
    expect(after.inventory['fire-stone'] ?? 0).toBe(0);
    expect(after.attributeModifiers.ragePeace).toBe((run.attributeModifiers.ragePeace ?? 0) + 3);
  });
});
