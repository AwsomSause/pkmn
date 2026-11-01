// Habitat reading (ideas W1 M82): scouting a route lists the species this stage's theme is likeliest to throw up.
// A plain read of the encounter pool's weights: no random numbers, so looking never changes what you meet.

import type { Content } from './contentSchema';
import { themePool } from './themes';
import type { RunState } from './state';

/** The `count` likeliest wild species of the stage (names, most likely first), merging evolution lines by their base form. */
export function habitatList(content: Content, run: Pick<RunState, 'stage' | 'regionOrder' | 'regionIndex'>, count = 4): string[] {
  const stage = run.stage;
  if (!stage) return [];
  const theme = content.themes.get(stage.themeId);
  if (!theme) return [];
  const pool = themePool(content, theme, run.regionOrder[run.regionIndex]);
  const byLine = new Map<string, number>();
  for (const p of pool) {
    let id = p.speciesId;
    for (let i = 0; i < 6; i++) {
      const from = content.species.get(id)?.evolvesFrom;
      if (!from || !content.species.has(from)) break;
      id = from;
    }
    byLine.set(id, (byLine.get(id) ?? 0) + p.weight);
  }
  return [...byLine.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([id]) => content.species.get(id)?.name ?? id);
}
