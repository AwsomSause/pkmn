// §29 rivalry sacrifice: the pure check the engine runs on a hit (armed by core/rivals/sacrifice.ts). Types only, so the
// engine can import it without pulling in the rival modules.

import type { BattleState, PokemonInstance } from '../state';

/**
 * The Pokémon that jumps in front of this hit, or null. `attacker` is the enemy using the move, `target` your Pokémon,
 * `damage` the hit's damage. Every condition must hold: armed and unused, singles trainer battle, the hit would knock out
 * the protected Pokémon, the guard is standing, isn't the attacker, and is its trainer's last Pokémon in reserve.
 */
export function sacrificeFor(battle: BattleState, attacker: PokemonInstance, target: PokemonInstance, damage: number): PokemonInstance | null {
  const s = battle.sacrifice;
  if (!s || !s.armed || s.done || battle.kind !== 'trainer' || battle.doubles || battle.raid || battle.totem) return null;
  if (target.uid !== s.protects || damage < target.hp || target.hp <= 0 || attacker.uid === s.uid) return null;
  const guard = battle.enemyTeam.find((m) => m.uid === s.uid);
  if (!guard || guard.hp <= 0) return null;
  // The last Pokémon in reserve: everyone but the attacker and the guard has fainted.
  if (battle.enemyTeam.some((m) => m.uid !== s.uid && m.uid !== attacker.uid && m.hp > 0)) return null;
  return guard;
}
