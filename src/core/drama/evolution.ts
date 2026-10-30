// Battle Drama Engine, Phase 5: a rival's Pokémon can evolve in the middle of a battle.
//
// Rules (so it is fair and uses the one evolution implementation):
// - Only a rival's ace that was brought in one stage below its final form AND is
//   already at or above the level that evolves it ("training" Pokémon).
// - It evolves at a turn boundary: the current turn finishes first, so no action
//   is skipped or doubled, then it evolves if its trainer is "in the moment"
//   (turn 3 or later, or the Pokémon is at half HP or less).
// - `evolve()` from core/evolution.ts does the work: same level, status and damage
//   taken carry over, max HP gained is added to HP, moves stay. Everstone blocks it.
// - Once per Pokémon per battle (saved in the battle state, so a reload cannot repeat it).
// - The AI reads the Pokémon's current species and moves on its next decision.

import type { BattleEvent } from '../battle/engine';
import { blocksEvolution } from '../battle/held';
import type { Content } from '../contentSchema';
import { evolutionTarget, evolve } from '../evolution';
import { calcStats } from '../pokemon';
import type { PlannedMember } from '../encounters';
import type { RunState } from '../state';
import { currentEnemy } from '../state';
import { emit, whereNow } from '../story/record';

/** The species one stage below `speciesId` that evolves into it by level, with that level. */
export function trainingForm(content: Content, speciesId: string): { from: string; level: number } | null {
  for (const sp of content.species.values()) {
    const branch = sp.evolutions.find((e) => e.to === speciesId && e.level !== undefined && !e.region);
    if (branch) return { from: sp.id, level: branch.level! };
  }
  return null;
}

/** For a returning rival: its last team member is brought in a stage lower when it is already high enough level to evolve. Returns the members and the index changed (or -1). */
export function withTrainingEvolution(content: Content, members: PlannedMember[]): { members: PlannedMember[]; index: number } {
  const index = members.length - 1;
  const ace = members[index];
  if (!ace || members.length < 2) return { members, index: -1 };
  const pre = trainingForm(content, ace.speciesId);
  if (!pre || ace.level < pre.level) return { members, index: -1 };
  return { members: members.map((m, i) => (i === index ? { ...m, speciesId: pre.from } : m)), index };
}

/** Called once the turn's events are final and the battle isn't over: evolves the active enemy if allowed. Returns the event to show, or null. */
export function midBattleEvolution(content: Content, run: RunState): BattleEvent | null {
  const battle = run.battle;
  if (!battle || battle.outcome || battle.kind !== 'trainer') return null;
  const enemy = currentEnemy(battle);
  const state = battle.drama;
  if (enemy.hp <= 0 || !state.evolvable.includes(enemy.uid) || state.evolved.includes(enemy.uid) || blocksEvolution(content, enemy)) return null;
  const inTheMoment = battle.turn >= 3 || enemy.hp / Math.max(1, calcStats(content, enemy).hp) <= 0.5;
  if (!inTheMoment) return null;
  const to = evolutionTarget(content, enemy, run.regionOrder[run.regionIndex]);
  if (!to) return null;
  const result = evolve(content, enemy, to);
  state.evolved.push(enemy.uid);
  const trainer = battle.trainer?.name ?? 'A trainer';
  const name = content.species.get(to)?.name ?? to;
  emit(content, run, 'evolved', {
    where: { ...whereNow(run), turn: battle.turn },
    actors: [enemy.uid],
    data: { from: result.from, to, trainer, side: 'enemy' },
    text: `${trainer}'s Pokémon evolved into ${name} mid-battle`,
  });
  if (battle.rivalId) run.story.flags[`drama:rival:${battle.rivalId}:midBattleEvolution`] = `${run.encountersCompleted}|${name}`;
  return { type: 'evolved', side: 'enemy', uid: enemy.uid, from: result.from, to, hpAfter: enemy.hp };
}
