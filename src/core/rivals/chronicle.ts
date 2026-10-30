// The Rival Chronicle: readable lines about each rival, for the Story screen (slice 3). Pure.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { RIVAL_CONFIG } from './schema';

export interface RivalLine {
  /** "Youngster Joey, The Prodigy". */
  title: string;
  /** One line: how it fights and what stands out about its character. */
  summary: string;
  /** What it remembers of your last battle, and what it has learned. */
  memory: string;
}

export function rivalChronicle(content: Content, run: RunState): RivalLine[] {
  return run.story.rivals.map((r) => {
    const archetype = RIVAL_CONFIG.archetypes.find((a) => a.id === r.archetype);
    const className = content.trainers.get(r.classId)?.name ?? 'Trainer';
    const topTrait = Object.entries(r.traits).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    const last = r.memory.lastBattle;
    const closeness = last.hpLeftShare <= RIVAL_CONFIG.spark.closeHpShare ? 'a close one' : 'a clean win for you';
    const learned = r.adaptations.length > 0 ? ` ${r.adaptations[r.adaptations.length - 1]}` : '';
    return {
      title: `${className} ${r.name}, ${archetype?.name ?? r.archetype}`,
      summary: `Fights ${r.style}. Strongest trait: ${topTrait[0]} (${topTrait[1]}).`,
      memory: `Last battle: ${closeness}, ${last.turns} turns.${learned}`,
    };
  });
}
