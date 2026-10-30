// Who may have a Hyper moment, and how likely it is (M8.9 Phase 1). The
// battle engine decides the moments (core/battle/hyper.ts); this file gives
// it the run's side of the question: the Pokémon's friendship and memories,
// what it has already done this run, and the player's attributes.

import { effectiveAttributes, type Attributes } from '../attributes';
import type { HyperAttribute, HyperContext } from '../battle/hyper';
import type { Content } from '../contentSchema';
import { Rng } from '../rng';
import type { RunState } from '../state';
import type { HyperChance, PokemonHistory, StoryEffectSpec, StoryTriggerKind } from './schema';

/** The one effect the engine knows for each trigger (checked when content loads). */
export const HYPER_EFFECTS: Record<StoryTriggerKind, StoryEffectSpec['kind']> = {
  toughenedItOut: 'endure',
  feltABond: 'endureOrCure',
  pushedBackUp: 'revive',
  hungInThere: 'boost',
  enemyRiledUp: 'rage',
  heatedRivalry: 'rivalry',
  friendlyCompetition: 'rivalry',
  trainerReturns: 'rematch',
};

/** Memories a trigger can ask for besides other Hyper moments (see PokemonHistory). */
export const HISTORY_MEMORIES: readonly string[] = ['closeCall', 'survivedFatal', 'bossBeaten'];

/** Points of an attribute, reading each end of a meter on its own (Peace is negative Rage/Peace). */
export function attributePoints(attrs: Attributes, key: HyperAttribute): number {
  switch (key) {
    case 'rage':
      return Math.max(0, attrs.ragePeace);
    case 'peace':
      return Math.max(0, -attrs.ragePeace);
    case 'good':
      return Math.max(0, attrs.goodEvil);
    case 'evil':
      return Math.max(0, -attrs.goodEvil);
    default:
      return Math.max(0, attrs[key]);
  }
}

/** The chance rule: base (times `again` for a repeat), plus perPoint per attribute point (averaged), at most cap × base. */
export function hyperChance(rule: HyperChance, attrs: Attributes, again: boolean): number {
  const base = rule.base * (again ? rule.again : 1);
  const points = rule.attributes.length === 0 ? 0 : rule.attributes.reduce((sum, a) => sum + attributePoints(attrs, a), 0) / rule.attributes.length;
  return Math.min(base * rule.cap, base + rule.perPoint * points);
}

/** Has this Pokémon got a memory of this kind this run? */
export function hasMemory(history: PokemonHistory | undefined, key: string): boolean {
  if (!history) return false;
  switch (key) {
    case 'closeCall':
      return history.closeCalls > 0;
    case 'survivedFatal':
      return history.survivedFatal > 0;
    case 'bossBeaten':
      return history.bossesBeaten > 0;
    default:
      return (history.hyper[key] ?? 0) > 0;
  }
}

/** Builds the engine's view of the run for one turn. `rng` is the run's "hyper" stream (its state is saved by the caller). */
export function buildHyperContext(content: Content, run: RunState, rng: Rng): HyperContext {
  const attrs = effectiveAttributes(content, run);
  return {
    rng,
    eligibility(trigger, mon) {
      const def = content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
      if (!def) return null;
      const cond = def.triggerConditions;
      const history = run.story.histories[mon.uid];
      if (cond.minFriendship !== undefined && mon.friendship < cond.minFriendship) return null;
      if (cond.needsMemory && !cond.needsMemory.some((m) => hasMemory(history, m))) return null;
      const again = (history?.hyper[def.id] ?? 0) > 0 && def.variants.again !== undefined;
      return { def, chance: def.chance ? hyperChance(def.chance, attrs, again) : 1, variant: again ? 'again' : null };
    },
    attributeShare(attribute) {
      return Math.min(1, attributePoints(attrs, attribute) / content.balance.attributeMax);
    },
    rivalBattles(uid, speciesId) {
      return run.story.histories[uid]?.foes[speciesId] ?? 0;
    },
    friendlyRivals(uid) {
      return friendlyRivalsOf(run, uid);
    },
  };
}

/** The teammates a Pokémon has a Friendly Competition with (open rivalries between two of your Pokémon still in the party). */
export function friendlyRivalsOf(run: RunState, uid: string): string[] {
  const inParty = new Set(run.party.map((m) => m.uid));
  const out: string[] = [];
  for (const r of run.story.relationships) {
    if (!r.open || r.kind !== 'rivalry' || r.a.kind !== 'pokemon' || r.b.kind !== 'pokemon') continue;
    const other = r.a.id === uid ? r.b.id : r.b.id === uid ? r.a.id : null;
    if (other && inParty.has(other) && !out.includes(other)) out.push(other);
  }
  return out;
}
