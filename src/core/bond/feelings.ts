// Emotional Turning Points: what a Pokémon feels during a battle (from what
// really happened to it), and the moment one feeling takes hold. Used for both
// sides; yours also becomes a tagged memory (the Seven Emotions layer).

import type { BattleEvent, Side } from '../battle/engine';
import type { Content } from '../contentSchema';
import { calcStats } from '../pokemon';
import type { RunState } from '../state';
import { emit, whereNow } from '../story/record';
import type { Emotion } from '../story/schema';

/** The feelings a battle can stir, and how many times they must be felt for a turning point. */
export const FEELINGS = ['determination', 'bravery', 'perseverance', 'justice', 'patience'] as const;
export const TURNING_POINT_AT = 3;

type Feel = (typeof FEELINGS)[number];

/** Counts this turn's feelings for the Pokémon in the field and returns a turning-point event for the first feeling to reach the threshold. */
export function trackFeelings(content: Content, prior: RunState, run: RunState, events: readonly BattleEvent[]): BattleEvent[] {
  const battle = run.battle;
  if (!battle || !prior.battle) return [];
  const active: Record<Side, string> = { player: prior.party[prior.battle.activeIndex]?.uid ?? '', enemy: prior.battle.enemyTeam[prior.battle.enemyIndex]?.uid ?? '' };
  const feel = (side: Side, what: Feel) => {
    const uid = active[side];
    if (!uid) return;
    const f = (battle.drama.feelings[uid] ??= {});
    f[what] = (f[what] ?? 0) + 1;
  };
  const alliesLost = (side: Side) => (side === 'player' ? run.party.filter((m) => m.hp <= 0).length : battle.enemyIndex);
  for (const e of events) {
    switch (e.type) {
      case 'switchIn':
        active[e.side] = e.uid;
        break;
      case 'damage':
        // Took a super-effective hit and is still standing.
        if (e.effectiveness > 1 && e.hpAfter > 0) feel(e.side, 'bravery');
        break;
      case 'stat':
        if (e.change < 0) feel(e.side, 'perseverance');
        break;
      case 'status':
        feel(e.side, 'perseverance');
        break;
      case 'protect':
        feel(e.side, 'patience');
        break;
      case 'move': {
        // Fighting on after a teammate fell.
        if (alliesLost(e.side) > 0) feel(e.side, 'justice');
        break;
      }
      default:
    }
  }
  // After the turn: still fighting at a quarter of its HP or less.
  for (const side of ['player', 'enemy'] as const) {
    const mon = side === 'player' ? run.party[battle.activeIndex] : battle.enemyTeam[battle.enemyIndex];
    if (mon && mon.hp > 0 && mon.hp / Math.max(1, calcStats(content, mon).hp) <= 0.25) feel(side, 'determination');
  }
  const out: BattleEvent[] = [];
  for (const side of ['player', 'enemy'] as const) {
    const uid = side === 'player' ? run.party[battle.activeIndex]?.uid : battle.enemyTeam[battle.enemyIndex]?.uid;
    if (!uid || battle.drama.turned.includes(uid)) continue;
    const f = battle.drama.feelings[uid] ?? {};
    const top = FEELINGS.filter((k) => (f[k] ?? 0) >= TURNING_POINT_AT).sort((a, b) => (f[b] ?? 0) - (f[a] ?? 0))[0];
    if (!top) continue;
    battle.drama.turned.push(uid);
    out.push({ type: 'turningPoint', side, uid, emotion: top });
    // Your Pokémon keeps it as a tagged memory of the battle.
    if (side === 'player' && run.story.histories[uid]) {
      const tag: Emotion | null = top === 'patience' ? 'patience' : (top as Emotion);
      emit(content, run, 'feeling', { where: { ...whereNow(run), turn: battle.turn }, actors: [uid], data: { turningPoint: top }, importance: 55, emotions: tag ? [tag] : [], text: `Found its ${top} in the middle of a battle` });
    }
  }
  return out;
}
