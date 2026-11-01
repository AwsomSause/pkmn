// Spec 8: the Overdrive behaviors in double battles (the attacker is the one struck back at,
// and the end-of-turn moments run for both of your Pokémon).

import { describe, expect, it } from 'vitest';
import { createBattle, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { makeDoubles, resolveDoublesTurn } from '../../src/core/battle/doubles';
import type { HyperContext } from '../../src/core/battle/hyper';
import { calcStats, createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import type { StoryTriggerKind } from '../../src/core/story/schema';
import { content } from './helpers';

const def = (trigger: StoryTriggerKind) => content.story.definitions.find((d) => d.triggerConditions.trigger === trigger)!;
const certain = (triggers: StoryTriggerKind[]): HyperContext => ({
  rng: new Rng(hashSeed('dbl-overdrive')),
  eligibility: (t) => (triggers.includes(t) ? { def: def(t), chance: 1, variant: null } : null),
  attributeShare: () => 0,
  rivalBattles: () => 0,
  friendlyRivals: () => [],
  emotion: () => null,
});

function setup(triggers: StoryTriggerKind[]) {
  const mk = (species: string, level: number, uid: string, moves: string[]) => {
    const mon = createPokemon(content, species, level, uid);
    mon.moves = moves.map((id) => ({ id, pp: 30 }));
    return mon;
  };
  const party = [mk('pidgey', 5, 'p0', ['tackle']), mk('snorlax', 50, 'p1', ['splash'])];
  const team = [mk('snorlax', 50, 'e0', ['splash']), mk('machamp', 60, 'e1', ['tackle'])];
  const battle = createBattle('trainer', team, 0, party[0]!.uid, { classId: 'ace-trainer', name: 'Pat', leaderId: null });
  makeDoubles(battle, party);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed('dbl')), captureRng: new Rng(hashSeed('dblc')), catchMultiplier: 1, hyper: certain(triggers) };
  return { ctx, party, team };
}

const hypers = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'hyper' }> => e.type === 'hyper');

describe('Overdrive in double battles', () => {
  it('Emotional Awakening runs at the end of a double-battle turn for a badly hurt Pokémon', () => {
    const { ctx, party } = setup(['emotionalAwakening']);
    party[1]!.hp = Math.floor(calcStats(content, party[1]!).hp * 0.2);
    const events = resolveDoublesTurn(ctx, { kind: 'double', commands: [{ action: { kind: 'move', index: 0 } }, { action: { kind: 'move', index: 0 } }] });
    const woke = hypers(events).filter((e) => e.defId === 'emotional-awakening');
    expect(woke.length).toBeLessThanOrEqual(1);
    expect(woke.every((e) => e.ability === 'guts')).toBe(true);
  });

  it('Defiance strikes back at the Pokémon that hit, not at whichever foe is in front', () => {
    const { ctx, team } = setup(['defiance']);
    ctx.battle.hyper.taken['p0'] = 2;
    const events = resolveDoublesTurn(ctx, { kind: 'double', commands: [{ action: { kind: 'move', index: 0 } }, { action: { kind: 'move', index: 0 } }] });
    for (const e of hypers(events).filter((h) => h.defId === 'defiance')) {
      expect(e.foeUid).toBeDefined();
      const foe = team.find((m) => m.uid === e.foeUid)!;
      expect(foe.hp).toBeGreaterThanOrEqual(1);
    }
  });
});
