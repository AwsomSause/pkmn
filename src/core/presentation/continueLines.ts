// The lines on the title screen's Continue card (pure; drawn by `ui/loadCard.ts`).

import { getArchetype } from '../archetypes';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';

/** The lines written on the card, top to bottom. */
export function continueLines(content: Content, run: RunState): string[] {
  const region = run.regionOrder[run.regionIndex] ?? '';
  const stage = run.stage ? `Stage ${run.stage.index + 1}` : 'Between stages';
  const top = run.party.reduce((m, p) => Math.max(m, p.level), 0);
  return [
    getArchetype(content, run.archetypeId).name,
    `${region.charAt(0).toUpperCase()}${region.slice(1)} · ${stage}`,
    `Party ${run.party.length} · top Lv${top}`,
    `₽${run.money}`,
  ];
}

