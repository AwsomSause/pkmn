// Clear disabled reasons (catalog #123): why a move on the player's menu can't work right now, in plain words.
// Pure: reads the battle, changes nothing. The engine still decides what actually happens.

import type { Content } from '../contentSchema';
import type { BattleState, PokemonInstance } from '../state';

/** A short reason the move in `slot` is blocked, or null when it can be used. */
export function moveBlockReason(content: Content, battle: BattleState, mon: PokemonInstance, slot: number): string | null {
  const known = mon.moves[slot];
  const move = known ? content.moves.get(known.id) : undefined;
  if (!known || !move) return null;
  if (known.pp <= 0) return 'no PP left';
  const v = battle.playerVolatile;
  if (v.disabled && v.disabled.turns > 0 && v.disabled.moveId === move.id) return `Disabled for ${v.disabled.turns} more turn${v.disabled.turns === 1 ? '' : 's'}`;
  if (v.torment && v.lastMove === move.id) return 'Torment: it cannot repeat';
  if (v.taunt > 0 && move.category === 'status') return 'Taunt: no status moves';
  if (v.throat > 0 && move.flags.includes('sound')) return 'Throat Chop: no sound moves';
  return null;
}
