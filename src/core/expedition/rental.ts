// Rental teams that scale with badges (spec 30). Pure: the same run, expedition and stage always offer the same team.
// Badges pick the team (simple plans early, coverage, weather synergy, pivots, then competitive cores); the party's own
// level caps the rental level, so a rental is a helping hand and never replaces the player's own party.

import { Rng, hashSeed } from '../rng';
import type { Content } from '../contentSchema';
import type { PokemonInstance, RunState } from '../state';
import type { ExpeditionDef, RentalMember, RentalTeam } from './schema';

/** Teams open at this badge count. */
export function eligibleRentalTeams(content: Content, badges: number): RentalTeam[] {
  return content.expeditions.rentalTeams.filter((t) => badges >= t.minBadges && (t.maxBadges === null || badges <= t.maxBadges));
}

/** The team on offer: a seeded pick among the teams for the badge count, preferring one not borrowed yet this run. */
export function pickRentalTeam(content: Content, run: Pick<RunState, 'seed' | 'badges' | 'rentalsUsed'>, key: string): RentalTeam {
  const open = eligibleRentalTeams(content, run.badges.length);
  const pool = open.length > 0 ? open : content.expeditions.rentalTeams;
  const fresh = pool.filter((t) => !run.rentalsUsed.includes(t.id));
  return new Rng(hashSeed(`${run.seed}::rental-team::${key}`)).pick(fresh.length > 0 ? fresh : pool);
}

/** The rental level: the expedition's level, but no more than `partyMargin` above the strongest own Pokémon's level (average of the healthy party). */
export function rentalLevel(content: Content, expeditionLevel: number, ownParty: Pick<PokemonInstance, 'level' | 'hp'>[], team: Pick<RentalTeam, 'levelOffset'>): number {
  const alive = ownParty.filter((p) => p.hp > 0);
  const avg = alive.length > 0 ? Math.round(alive.reduce((n, p) => n + p.level, 0) / alive.length) : expeditionLevel;
  return Math.max(2, Math.min(expeditionLevel, avg + content.expeditions.rentalLevel.partyMargin) + team.levelOffset);
}

/** Gives a freshly made rental its team moves, held item and ability. */
export function outfitRental(content: Content, mon: PokemonInstance, member: RentalMember): void {
  const moves = member.moves.map((id) => content.moves.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  if (moves.length > 0) mon.moves = moves.map((m) => ({ id: m.id, pp: m.pp }));
  if (member.item) mon.held = { [member.item]: 1 };
  if (member.ability === 'hidden' && content.species.get(mon.speciesId)?.abilities.hidden) mon.abilitySlot = -1;
}

export function describeRental(team: RentalTeam, content: Content): string {
  const names = team.members.map((m) => content.species.get(m.species)?.name ?? m.species).join(', ');
  return `${team.name} (${names}): ${team.strategy}`;
}

/**
 * Who a draft, recruit or combined expedition offers (spec 30 variety): the expedition's own list plus the Pokémon of the
 * rental teams open at this badge count, kept to the evolution stage the badges call for. Stable order, so the seeded pick is stable.
 */
export function offerPool(content: Content, def: Pick<ExpeditionDef, 'rentals'>, badges: number, need: number): string[] {
  const all = [...new Set([...def.rentals, ...eligibleRentalTeams(content, badges).flatMap((t) => t.members.map((m) => m.species))])];
  const stages = content.expeditions.offerStages.filter((o) => badges >= o.minBadges);
  let floor = Math.max(1, ...stages.map((o) => o.minStage));
  for (; floor >= 1; floor--) {
    const ok = all.filter((id) => (content.species.get(id)?.evolutionStage ?? 1) >= floor);
    if (ok.length >= need) return ok;
  }
  return all;
}
