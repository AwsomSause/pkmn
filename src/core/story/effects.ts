// Story effects: the changes story events make to the game (money,
// friendship, attributes, items, flags, battle boosts). Each application has
// an id; the ledger (ledger.ts) keeps the ids already applied, so applying the
// same id twice does nothing. That is the "never reward twice" rule: a reload,
// a replayed animation or a resumed save can never pay out again.

import { addRunAttribute } from '../attributes';
import { clampStage } from '../battle/damage';
import type { Content } from '../contentSchema';
import { changeFriendship } from '../friendship';
import { addItem } from '../items';
import { maxHp } from '../pokemon';
import type { RunState } from '../state';
import { markBattleEffect } from './ledger';
import type { StoryEffectSpec } from './schema';

/** Effects that only make sense inside a battle (their ids go in the battle's ledger). */
export function isBattleEffect(spec: StoryEffectSpec): boolean {
  return spec.kind === 'statStage' || spec.kind === 'endure' || spec.kind === 'enemyStage';
}

export type EffectOutcome = 'applied' | 'alreadyApplied' | 'notApplicable';

/**
 * Applies one effect (mutates `run`). `targetUid` is the Pokémon it is for,
 * when it is for one. Returns "alreadyApplied" without changing anything when
 * the id is in the ledger, and "notApplicable" when its target is gone (a
 * Pokémon that left the party, a battle that ended).
 */
export function applyStoryEffect(content: Content, run: RunState, effectId: string, spec: StoryEffectSpec, targetUid?: string): EffectOutcome {
  if (isBattleEffect(spec)) {
    const battle = run.battle;
    if (!battle) return 'notApplicable';
    if (battle.storyEffects.includes(effectId)) return 'alreadyApplied';
    if (spec.kind === 'statStage') {
      if (!targetUid || run.party[battle.activeIndex]?.uid !== targetUid) return 'notApplicable';
      battle.playerStages[spec.stat] = clampStage((battle.playerStages[spec.stat] ?? 0) + spec.stages);
    }
    if (spec.kind === 'enemyStage') battle.enemyStages[spec.stat] = clampStage((battle.enemyStages[spec.stat] ?? 0) + spec.stages);
    markBattleEffect(battle, effectId);
    return 'applied';
  }

  const ledger = run.story.appliedEffects;
  if (ledger.includes(effectId)) return 'alreadyApplied';
  switch (spec.kind) {
    case 'money':
      run.money = Math.max(0, run.money + spec.amount);
      break;
    case 'friendship': {
      const mon = run.party.find((m) => m.uid === targetUid);
      if (!mon) return 'notApplicable';
      changeFriendship(content, mon, spec.amount);
      break;
    }
    case 'heal': {
      const mon = run.party.find((m) => m.uid === targetUid);
      if (!mon || mon.hp <= 0) return 'notApplicable';
      mon.hp = Math.min(maxHp(content, mon), mon.hp + Math.max(1, Math.floor(maxHp(content, mon) * spec.hpShare)));
      break;
    }
    case 'attribute':
      addRunAttribute(content, run, spec.attribute, spec.amount);
      break;
    case 'item':
      if (!content.items.has(spec.itemId)) return 'notApplicable';
      addItem(run.inventory, spec.itemId, spec.quantity);
      break;
    case 'flag':
      run.story.flags[spec.flag] = spec.value;
      break;
  }
  ledger.push(effectId);
  // Effect ids carry the event's sequence number, which only grows, so only
  // recent ids can come round again; the oldest are dropped past the limit.
  const limit = content.story.limits.appliedEffects;
  if (ledger.length > limit) ledger.splice(0, ledger.length - limit);
  return 'applied';
}
