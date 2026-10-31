// Battle-style tricks (Living Rivalry Engine §3): a few rival battle styles do something in the fight itself,
// not only through AI sharpness and stat bias. Each trick happens once per battle, at a turn boundary, from
// real battle state (HP, fainted teammates); no random numbers, and it is recorded in `battle.drama.seen`
// so a reload never repeats it. Switched off by `balance.styleTricks`.

import type { BattleEvent } from '../battle/engine';
import { clampStage } from '../battle/damage';
import type { Content } from '../contentSchema';
import { calcStats } from '../pokemon';
import type { RunState } from '../state';
import { currentEnemy } from '../state';

type Stat = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
interface Trick {
  /** The text of the info line. */
  text: (name: string) => string;
  stages: Partial<Record<Stat, number>>;
  /** Whether the moment has come, from the enemy's HP share and how many of its team have fainted. */
  when: (hpShare: number, fainted: number, left: number) => boolean;
}

export const STYLE_TRICKS: Record<string, Trick> = {
  berserker: { text: (n) => `${n} flies into a rage!`, stages: { atk: 2, def: -1 }, when: (hp) => hp <= 0.5 },
  'revenge-striker': { text: (n) => `${n} fights to avenge its fallen friend!`, stages: { atk: 1, spe: 1 }, when: (_hp, fainted) => fainted >= 1 },
  'last-stand': { text: (n) => `${n} stands its ground for the last time!`, stages: { def: 1, spd: 1 }, when: (hp, _f, left) => left === 1 && hp <= 0.35 },
};

/** Applies the rival's style trick if its moment has come. Returns the event to show, or null. */
export function styleTrick(content: Content, run: RunState): BattleEvent | null {
  const battle = run.battle;
  if (!battle || battle.outcome || !battle.rivalId || !content.balance.styleTricks) return null;
  const rival = run.story.rivals.find((r) => r.id === battle.rivalId);
  const trick = rival ? STYLE_TRICKS[rival.style] : undefined;
  if (!rival || !trick) return null;
  const enemy = currentEnemy(battle);
  const key = `trick:${rival.style}:${enemy.uid}`;
  if (enemy.hp <= 0 || battle.drama.seen.includes(key)) return null;
  const fainted = battle.enemyTeam.filter((m) => m.hp <= 0).length;
  const left = battle.enemyTeam.length - fainted;
  if (!trick.when(enemy.hp / Math.max(1, calcStats(content, enemy).hp), fainted, left)) return null;
  battle.drama.seen.push(key);
  for (const [stat, change] of Object.entries(trick.stages) as [Stat, number][]) battle.enemyStages[stat] = clampStage(battle.enemyStages[stat] + change);
  const name = content.species.get(enemy.speciesId)?.name ?? 'The Pokémon';
  return { type: 'raid', tone: 'phase', text: trick.text(name) };
}
