// The "never apply twice" ledgers. Every story effect has an id; a ledger keeps
// the ids already applied, and applying an id it already holds does nothing.
//
// Battle-scope effects live in the battle state (thrown away when the battle
// ends); run-scope effects live in the run's story state. Both are saved, so a
// reload or a replayed animation can never apply an effect again.
//
// This file only touches plain state, so the battle engine can use it.

import type { BattleState } from '../state';
import type { StoryEventDefinition } from './schema';

/**
 * The ledger key for a definition's cooldown. Per-battle cooldowns are checked
 * in the battle's ledger, so the key needs no battle number.
 */
export function cooldownKey(def: Pick<StoryEventDefinition, 'id' | 'cooldown'>, uid: string): string {
  switch (def.cooldown) {
    case 'oncePerBattlePerPokemon':
    case 'oncePerRunPerPokemon':
      return `${def.id}@${uid}`;
    default:
      return def.id;
  }
}

export function hasBattleEffect(battle: Pick<BattleState, 'storyEffects'>, key: string): boolean {
  return battle.storyEffects.includes(key);
}

/** Records a battle-scope effect. Returns false (and changes nothing) if it was already there. */
export function markBattleEffect(battle: Pick<BattleState, 'storyEffects'>, key: string): boolean {
  if (battle.storyEffects.includes(key)) return false;
  battle.storyEffects.push(key);
  return true;
}
