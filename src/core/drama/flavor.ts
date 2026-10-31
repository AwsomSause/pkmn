// Battle Drama Engine, left-out 2.1: lines picked by bond, rival arc and your trainer's type,
// the trainer's words after the battle, and declarations from your own side.
// Presentation only: picks are hashed, never gameplay RNG, and nothing here changes a battle.

import { getArchetype } from '../archetypes';
import { currentEnemy } from '../state';
import { calcStats } from '../pokemon';
import { DRAMA, type DialogueCategory } from './schema';
import type { Candidate, PlanCtx } from './events';
import type { DramaEvent } from './index';

/** The tags that colour this trainer's lines, strongest first. Non-rivals only get the type tag. */
export function flavorTags(c: PlanCtx): string[] {
  const tags: string[] = [];
  const b = c.bond;
  if (c.rival) {
    if (c.rival.state === 'nemesis') tags.push('nemesis');
    if (b.strain >= 60) tags.push('strained');
    else if (b.trust >= 70 && b.affection >= 60) tags.push('devoted');
    if (c.rival.state === 'ally') tags.push('ally');
    if (b.respect >= 70) tags.push('respect');
  }
  if (getArchetype(c.content, c.run.archetypeId).signatureTypes[0]) tags.push('specialist');
  return tags;
}

/** Flavoured lines for a category, or null when none fit. {type} is filled by the caller via vars. */
export function flavorPool(c: PlanCtx, category: DialogueCategory): { tag: string; lines: string[] } | null {
  for (const tag of flavorTags(c)) {
    const lines = DRAMA.flavor[tag]?.[category];
    if (lines) return { tag, lines };
  }
  return null;
}

export const favouredType = (c: PlanCtx): string => getArchetype(c.content, c.run.archetypeId).signatureTypes[0] ?? 'favourite';

const mostUsedMove = (c: PlanCtx): string | null => {
  const used = Object.entries(c.battle.drama.playerMoves).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return used ? (c.content.moves.get(used[0])?.name ?? null) : null;
};

/** After the last line of the battle, the trainer remarks on what you actually did. */
export function afterBattleCandidates(c: PlanCtx, ends: readonly DramaEvent[]): Candidate[] {
  const end = ends.find((e) => e.kind === 'battleEnd' && (e.data.outcome === 'win' || e.data.outcome === 'lose'));
  if (!end || c.cls === 'ordinary') return [];
  const move = mostUsedMove(c);
  if (!move) return [];
  const pool = end.data.outcome === 'win' ? DRAMA.afterBattle.win : DRAMA.afterBattle.lose;
  const ev: DramaEvent = { id: `${c.key}:after`, kind: 'battleEnd', turn: c.turn, at: end.at + 1, data: end.data };
  return [{ ev, category: 'defeat', tier: 'climactic', pool, vars: { move, foe: c.foeName } }];
}

/** Your own Pokémon's declaration: its last stand, a finishing blow, or a bold first call with a strong move. */
export function playerDeclarationCandidates(c: PlanCtx): Candidate[] {
  const out: Candidate[] = [];
  const seen = c.battle.drama.seen;
  const mon = c.run.party[c.battle.activeIndex];
  if (!mon) return out;
  c.events.forEach((e, i) => {
    if (e.type !== 'move' || e.side !== 'player') return;
    const move = c.content.moves.get(e.moveId);
    if (!move || (move.power ?? 0) < DRAMA.config.declarationMoveBpMin) return;
    const sig = `psig:${mon.uid}:${e.moveId}`;
    if (seen.includes(sig)) return;
    const low = mon.hp / Math.max(1, calcStats(c.content, mon).hp) <= DRAMA.config.desperationHpShare;
    const lastFoe = c.battle.enemyIndex === c.battle.enemyTeam.length - 1;
    const hurt = currentEnemy(c.battle).hp / Math.max(1, calcStats(c.content, currentEnemy(c.battle)).hp) <= DRAMA.config.desperationHpShare;
    const kind = low ? 'lastStand' : lastFoe && hurt ? 'finisher' : c.cls !== 'ordinary' && c.turn <= 1 ? 'bold' : null;
    if (!kind) return;
    seen.push(sig);
    const name = c.content.species.get(mon.speciesId)?.name ?? 'Pokémon';
    out.push({
      ev: { id: `${c.key}:t${c.turn}:e${i}:psignature`, kind: 'playerMove', turn: c.turn, at: i, data: { moveId: e.moveId } },
      category: 'signature',
      tier: 'tactical',
      pool: DRAMA.playerDeclarations[kind],
      vars: { name, move: move.name },
      cue: { style: kind, moveId: e.moveId },
      speaker: 'You',
    });
  });
  return out;
}
