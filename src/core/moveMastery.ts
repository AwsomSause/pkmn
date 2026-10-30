// Move Mastery (catalog #107): every damaging move counts its uses in trainer fights over all finished runs.
// Ranks unlock move-page lore and pay Research Points once (claim ledger). They never add damage or any other power.

import type { Content } from './contentSchema';
import { claim } from './quests';
import type { Profile, RunState } from './state';

export const MOVE_RANKS = ['none', 'bronze', 'silver', 'gold'] as const;
export type MoveRank = (typeof MOVE_RANKS)[number];
export const MOVE_RANK_USES: Record<Exclude<MoveRank, 'none'>, number> = { bronze: 10, silver: 30, gold: 100 };
export const MOVE_RANK_RESEARCH: Record<Exclude<MoveRank, 'none'>, number> = { bronze: 2, silver: 5, gold: 10 };

export function moveRank(uses: number): MoveRank {
  return uses >= MOVE_RANK_USES.gold ? 'gold' : uses >= MOVE_RANK_USES.silver ? 'silver' : uses >= MOVE_RANK_USES.bronze ? 'bronze' : 'none';
}

/** What the move's page shows at a rank: type and kind first, then power and accuracy, then the full lore. */
export function moveLore(content: Content, moveId: string, rank: MoveRank): string[] {
  const m = content.moves.get(moveId);
  if (!m || rank === 'none') return [];
  const lines = [`${m.name}: a ${m.type} ${m.category} move.`];
  if (rank === 'silver' || rank === 'gold') lines.push(`Power ${m.power ?? '-'}, accuracy ${m.accuracy ?? '-'}, PP ${m.pp}.`);
  if (rank === 'gold') lines.push(`Aims at ${m.target}${m.priority ? `, priority ${m.priority > 0 ? '+' : ''}${m.priority}` : ''}${m.flags.length > 0 ? `; traits: ${m.flags.join(', ')}` : ''}.`);
  return lines;
}

export interface MoveRankUp {
  moveId: string;
  rank: Exclude<MoveRank, 'none'>;
}

/** Adds a finished run's move uses to the profile and pays each new rank once. Mutates `profile`. */
export function recordMoveMastery(content: Content, profile: Profile, run: RunState, now: string): MoveRankUp[] {
  const uses = (profile.moveUses ??= {});
  const touched = new Set<string>();
  for (const h of Object.values(run.story?.histories ?? {})) {
    for (const [id, n] of Object.entries(h.moves)) {
      if (!content.moves.has(id) || n <= 0) continue;
      uses[id] = (uses[id] ?? 0) + n;
      touched.add(id);
    }
  }
  const ups: MoveRankUp[] = [];
  for (const id of [...touched].sort()) {
    for (const rank of ['bronze', 'silver', 'gold'] as const) {
      if (uses[id]! < MOVE_RANK_USES[rank] || !claim(profile, `movemastery:${id}:${rank}`, now)) continue;
      profile.researchPoints += MOVE_RANK_RESEARCH[rank];
      ups.push({ moveId: id, rank });
    }
  }
  return ups;
}

/** The most-used moves with their ranks, for the Research Room. */
export function topMoves(profile: Pick<Profile, 'moveUses'>, count = 3): { moveId: string; uses: number; rank: MoveRank }[] {
  return Object.entries(profile.moveUses ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([moveId, uses]) => ({ moveId, uses, rank: moveRank(uses) }));
}
