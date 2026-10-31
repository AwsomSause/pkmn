// Enemy intent (catalog #117): in special battles (gym leaders, Elite Four, champions, raids, totems) the foe telegraphs the
// move it values most. Pure and RNG-free, so showing it never changes a roll; the foe may still pick otherwise
// (smart bosses choose their best move only `ai` of the time).

import type { Content } from '../contentSchema';
import { isBossClass } from '../trainerPerks';
import { currentEnemy, type BattleState, type PokemonInstance } from '../state';
import { moveValue } from './engine';

export interface EnemyIntent {
  moveId: string;
  moveName: string;
  /** True when the move deals damage (otherwise a set-up or status move). */
  attack: boolean;
  /** The line shown before the player chooses. */
  text: string;
}

export function hasTelegraphedIntent(battle: Pick<BattleState, 'trainer' | 'raid' | 'totem' | 'spectacle'>): boolean {
  return Boolean(battle.raid || battle.totem || battle.spectacle?.rematch || (battle.trainer && isBossClass(battle.trainer.classId)));
}

export function enemyIntent(content: Content, battle: BattleState, target: PokemonInstance, party?: PokemonInstance[]): EnemyIntent | null {
  if (!hasTelegraphedIntent(battle) || battle.outcome) return null;
  const foe = currentEnemy(battle);
  const usable = foe.moves.filter((m) => m.pp > 0);
  if (foe.hp <= 0 || usable.length === 0) return null;
  const brain = { content, ai: Math.max(battle.ai, 0.7), target, stages: battle.enemyStages, battle, party };
  const best = usable.map((m) => ({ id: m.id, v: moveValue(brain, foe, m.id) })).reduce((a, b) => (b.v > a.v ? b : a));
  const move = content.moves.get(best.id);
  if (!move) return null;
  const name = content.species.get(foe.speciesId)?.name ?? foe.speciesId;
  const attack = move.category !== 'status';
  return { moveId: move.id, moveName: move.name, attack, text: attack ? `${name} is lining up ${move.name}!` : `${name} is preparing ${move.name}...` };
}
