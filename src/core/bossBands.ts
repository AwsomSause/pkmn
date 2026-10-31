// Boss teams past level 100 (left-out plan 1.6 follow-up). bossTeams.json was built for
// levels up to 100, so a boss in a later region would bring the same team at a higher
// level. Each band (balance.bossBands, by the team's top level) upgrades that team:
// members evolve fully, the weakest give way to the boss's signature Pokémon, damaging
// moves are swapped for the strongest ones the species can learn, every member gets
// extra training and a held item, and the AI plays sharper. All of it is worked out
// from the team and the data (no random rolls), so a seed meets the same team every time.

import type { Content, Move, Species, StatName } from './contentSchema';
import { evolvedFormAt, type PlannedMember } from './encounters';
import { getSpecies, isUsableMove, usableLearnset } from './pokemon';

export type BossBand = Content['balance']['bossBands'][number];

/** The band for a team whose strongest member is at `level`, or undefined at 100 and below. */
export function bossBand(content: Content, level: number): BossBand | undefined {
  return content.balance.bossBands.filter((b) => level >= b.minLevel).sort((a, b) => b.minLevel - a.minLevel)[0];
}

const bst = (s: Species) => Object.values(s.baseStats).reduce((a, b) => a + b, 0);
// Moves with a drawback the boss AI handles badly, or that waste a turn.
const DRAWBACKS = ['recharge', 'selfFaint', 'focus', 'charge'] as const;

function moveScore(move: Move, species: Species): number {
  if (move.category === 'status' || !move.power) return 0;
  if (move.priority < 0 || DRAWBACKS.some((k) => (move.effects as Record<string, unknown> | undefined)?.[k])) return 0;
  const { atk, spa } = species.baseStats;
  const stat = move.category === 'physical' ? atk : spa;
  return move.power * ((move.accuracy ?? 100) / 100) * (species.types.includes(move.type) ? 1.5 : 1) * (stat / Math.max(atk, spa));
}

/** The best damaging moves a species knows by `level` or can be taught, strongest first, at most one per type. */
export function strongestMoves(content: Content, species: Species, level: number): string[] {
  const ids = new Set([...usableLearnset(content, species).filter((e) => e.level <= level).map((e) => e.move), ...(content.learnables.get(species.id) ?? [])]);
  const scored = [...ids]
    .filter((id) => isUsableMove(content, id))
    .map((id) => ({ id, move: content.moves.get(id)!, score: moveScore(content.moves.get(id)!, species) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const types = new Set<string>();
  return scored.filter((m) => (types.has(m.move.type) ? false : (types.add(m.move.type), true))).map((m) => m.id);
}

/** Keeps up to two authored status moves (setup, hazards) and fills the rest with the strongest damaging moves. */
function upgradeMoves(content: Content, species: Species, level: number, authored: readonly string[]): string[] {
  const status = authored.filter((id) => content.moves.get(id)?.category === 'status').slice(0, 2);
  const damaging = [...authored.filter((id) => !status.includes(id) && content.moves.has(id)), ...strongestMoves(content, species, level)];
  const best = [...new Set(damaging)].sort((a, b) => moveScore(content.moves.get(b)!, species) - moveScore(content.moves.get(a)!, species) || a.localeCompare(b));
  return [...status, ...best].slice(0, 4);
}

function upgradeTraining(species: Species, training: PlannedMember['training'], extra: number): PlannedMember['training'] {
  const out: Partial<Record<StatName, number>> = { ...(training ?? {}) };
  const stats: StatName[] = Object.keys(out).length > 0 ? (Object.keys(out) as StatName[]) : [species.baseStats.atk >= species.baseStats.spa ? 'atk' : 'spa', 'spe'];
  for (const stat of stats) out[stat] = (out[stat] ?? 0) + extra;
  return out;
}

/**
 * Upgrades a boss team for its band. `signature` is the boss's signature list (ace first);
 * the `swaps` weakest members (never the ace) are replaced by signature species not yet in the team.
 */
export function applyBossBand(content: Content, members: PlannedMember[], signature: readonly string[], ai: number): { members: PlannedMember[]; ai: number; band?: BossBand } {
  const top = Math.max(0, ...members.map((m) => m.level));
  const band = bossBand(content, top);
  if (!band || members.length === 0) return { members, ai };
  let team = members.map((m) => ({ ...m, speciesId: evolvedFormAt(content, m.speciesId, m.level) }));
  // Signature swaps: weakest non-ace members first.
  const have = new Set(team.map((m) => m.speciesId));
  const fresh = signature.filter((id) => content.species.has(id)).map((id) => evolvedFormAt(content, id, top)).filter((id, i, all) => !have.has(id) && all.indexOf(id) === i);
  const weakest = team
    .map((m, i) => ({ i, bst: bst(getSpecies(content, m.speciesId)) }))
    .filter((x) => x.i !== team.length - 1)
    .sort((a, b) => a.bst - b.bst || a.i - b.i);
  for (let k = 0; k < Math.min(band.signatureSwaps, weakest.length, fresh.length); k++) {
    const slot = weakest[k]!.i;
    if (bst(getSpecies(content, fresh[k]!)) <= weakest[k]!.bst) continue;
    team[slot] = { ...team[slot]!, speciesId: fresh[k]!, moves: [], training: undefined };
  }
  team = team.map((m, i) => {
    const species = getSpecies(content, m.speciesId);
    const item = band.items.length > 0 ? band.items[(team.length - 1 - i) % band.items.length]! : undefined;
    return {
      ...m,
      moves: upgradeMoves(content, species, m.level, m.moves ?? []),
      training: upgradeTraining(species, m.training, band.training),
      ...(item ? { held: { [item]: 1 } } : {}),
    };
  });
  return { members: team, ai: Math.min(1, ai + band.ai), band };
}
