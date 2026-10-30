// Milestone 8.75, slices 3b-3b and 4: draft items, and RSVP Mail's rival. Dowsing Machine and Bloom Mail add
// a choice to the draft; Cornn Berry re-rolls one choice; Lock Capsule and
// Favored Mail carry a choice into the next draft; TM Case shows more TM moves.

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry, TM_CHOICES } from '../../src/core/catalog';
import { usesLeft } from '../../src/core/mapItems';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseNode, chooseReward, chooseStarter, createRun, draftItemUses, takeTurn, useDraftItem, type TurnResult } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { content, takeAnyReward } from './helpers';

function newRun(seed = 'draft-items'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

function take(run: RunState, id: string, times = 1): RunState {
  for (let i = 0; i < times; i++) applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Wins the battle in progress with a level 100 lead. */
function win(run: RunState): TurnResult {
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 50 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

/** Enters and wins a battle of this kind on the current stage: the run is at its reward draft. */
function winNode(run: RunState, kind: 'wild' | 'trainer'): RunState {
  const node = run.stage!.map.nodes.find((n) => n.kind === kind && n.column > 1)!;
  run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(node.id))!.id;
  const after = win(chooseNode(content, run, node.id)).run;
  expect(after.phase).toBe('reward');
  return after;
}

/** Beats this stage's gym leader and takes a reward: the next stage starts. */
function nextStage(run: RunState): RunState {
  const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym')!;
  run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(gym.id))!.id;
  return takeAnyReward(win(chooseNode(content, run, gym.id)).run);
}

const size = content.balance.draftSize;

describe('Dowsing Machine and Bloom Mail: bigger drafts', () => {
  it('Dowsing Machine: one extra choice in the first draft of each stage', () => {
    const run = take(newRun(), 'dowsing-mchn');
    const first = winNode(run, 'wild');
    expect(first.draft).toHaveLength(size + 1);
    expect(new Set(first.draft)).toHaveProperty('size', size + 1);
    const second = winNode(takeAnyReward(first), 'wild');
    expect(second.draft).toHaveLength(size);
    expect(winNode(nextStage(takeAnyReward(second)), 'wild').draft).toHaveLength(size + 1);
  });

  it('Bloom Mail: next stage, trainer wins give one extra choice; wild wins do not; the stage after is back to normal', () => {
    const run = nextStage(take(newRun('bloom'), 'bloom-mail'));
    expect(winNode(run, 'wild').draft).toHaveLength(size);
    const trainer = winNode(run, 'trainer');
    expect(trainer.draft).toHaveLength(size + 1);
    expect(trainer.itemCounters?.['draft-extra']).toBeUndefined();
    expect(winNode(nextStage(takeAnyReward(trainer)), 'trainer').draft).toHaveLength(size);
  });

  it('without draft items the draft is unchanged', () => {
    expect(winNode(newRun(), 'trainer').draft).toHaveLength(size);
  });
});

describe('Cornn Berry: re-roll one choice', () => {
  it('swaps the chosen card for a reward not already in the draft, then is used up', () => {
    const run = winNode(take(newRun('cornn'), 'cornn-berry'), 'wild');
    expect(draftItemUses(content, run, 'reroll')).toBe(1);
    const before = run.draft!;
    const { run: after, message } = useDraftItem(content, run, 'reroll', 2);
    expect(after.draft).toHaveLength(size);
    expect(after.draft![2]).not.toBe(before[2]);
    expect(before).not.toContain(after.draft![2]);
    expect(after.draft!.filter((_, i) => i !== 2)).toEqual(before.filter((_, i) => i !== 2));
    expect(message).toContain('was swapped for');
    expect(draftItemUses(content, after, 'reroll')).toBe(0);
    expect(() => useDraftItem(content, after, 'reroll', 0)).toThrow(/Cornn Berry/);
    // The same choice on the same run gives the same new card.
    expect(useDraftItem(content, run, 'reroll', 2).run.draft).toEqual(after.draft);
  });

  it('three berries give three uses', () => {
    const run = winNode(take(newRun('cornn3'), 'cornn-berry', 3), 'wild');
    expect(draftItemUses(content, run, 'reroll')).toBe(3);
  });
});

describe('Lock Capsule and Favored Mail: carrying a choice into the next draft', () => {
  it('Lock Capsule: the locked card is first in the next draft, and the capsule is used up', () => {
    const run = winNode(take(newRun('lock'), 'lock-capsule'), 'wild');
    const locked = run.draft![3]!;
    const { run: after, message } = useDraftItem(content, run, 'lock', 3);
    expect(message).toContain('locked in');
    expect(after.draftCarry).toEqual([locked]);
    expect(after.draft).toEqual(run.draft);
    expect(draftItemUses(content, after, 'lock')).toBe(0);
    expect(RunStateSchema.parse(after).draftCarry).toEqual([locked]);
    const next = winNode(takeAnyReward(after), 'wild');
    expect(next.draft![0]).toBe(locked);
    expect(next.draft).toHaveLength(size);
    expect(next.draftCarry).toBeUndefined();
  });

  it('Favored Mail: the best reward you skipped comes back in the next draft', () => {
    const run = winNode(take(newRun('favored'), 'favored-mail'), 'wild');
    const rank = (id: string) => ['common', 'uncommon', 'rare', 'epic'].indexOf(content.rewards.get(id)!.rarity);
    const draft = run.draft!;
    // Take the worst card; the best of the rest should be kept.
    const worst = draft.reduce((a, b) => (rank(b) < rank(a) ? b : a));
    const rest = draft.filter((id) => id !== worst);
    const best = rest.reduce((a, b) => (rank(b) > rank(a) ? b : a));
    const result = chooseReward(content, run, draft.indexOf(worst), 0);
    expect(result.reward.messages.join(' ')).toContain('Favored Mail keeps');
    expect(result.run.draftCarry).toEqual([best]);
    expect(usesLeft(result.run, 'favored-mail')).toBe(0);
    const next = winNode(result.run, 'wild');
    expect(next.draft![0]).toBe(best);
  });
});

describe('TM Case', () => {
  it('a TM offers one more move to pick from', () => {
    const plain = newRun('tm-case');
    plain.party[0] = createPokemon(content, 'houndoom', 60, plain.party[0]!.uid);
    const withCase = take(structuredClone(plain), 'tm-case');
    const tm = getCatalogEntry(content, 'tm-normal');
    const opts = () => ({ moneyMultiplier: 1, rng: new Rng(hashSeed('tm')) });
    const before = applyCatalog(content, plain, tm, plain.party[0], opts()).pending[0]!;
    const after = applyCatalog(content, withCase, tm, withCase.party[0], opts()).pending[0]!;
    expect(before.kind === 'teachMove' && before.moveIds.length).toBe(TM_CHOICES);
    expect(after.kind === 'teachMove' && after.moveIds.length).toBe(TM_CHOICES + 1);
  });
});

describe('RSVP Mail: a rival', () => {
  it('next stage, the first ordinary trainer is a stronger rival; beating it gives gym odds and one more choice; only once', () => {
    const run = nextStage(take(newRun('rsvp-c'), 'rsvp-mail'));
    const trainers = run.stage!.map.nodes.filter((n) => n.kind === 'trainer' && n.column > 1);
    const enter = (r: RunState, id: string) => {
      r.stage!.current = r.stage!.map.nodes.find((n) => n.next.includes(id))!.id;
      return chooseNode(content, r, id);
    };
    const plain = enter(structuredClone(newRun('rsvp-c')), trainers[0]!.id);
    expect(plain.battle!.rival).toBeUndefined();
    const fight = enter(run, trainers[0]!.id);
    expect(fight.battle!.rival).toBe(true);
    expect(fight.battle!.trainer?.name ?? '').toBeDefined();
    const after = win(fight).run;
    expect(after.phase).toBe('reward');
    expect(after.draft).toHaveLength(size + 1);
    // The rival comes once per stage: the next trainer is ordinary.
    const next = takeAnyReward(after);
    const second = enter(next, trainers[1] ? trainers[1].id : trainers[0]!.id);
    expect(second.battle!.rival).toBeUndefined();
  });
});
