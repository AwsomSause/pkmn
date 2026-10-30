// Species Mastery (plan Part 3 + Kice's answer 4).
//
// Every species you meet gets account-level counters (profile.mastery), filled
// in at the end of each run from the run's Pokémon histories. The counters give
// a rank, Seen → Caught → Bronze → Silver → Gold → Master, and a family (an
// evolution line, kept on its first stage) has the best rank of its members.
//
// A family's rank unlocks things for every Pokémon of it that joins a later run:
//   Bronze: its first egg move     Silver: its Hidden Ability
//   Gold:   a second egg move, and a choice of ability
//   Master: its strongest move starts awakened (Signature Move Awakening)
// Each rank also pays Research Points once (claim ledger "mastery:<species>:<rank>"),
// and Master gives the title "<Species> Master". Silver species fill the
// "Mastered" starter set. An egg move the engine can't run never enters a moveset.
//
// The unlocks are worked out once at the start of a run (run.mastery), so a run
// plays the same after a reload whatever the profile does meanwhile.

import type { Content, Species } from './contentSchema';
import type { MasteryPerk, MasteryRecord, PokemonInstance, Profile, RunState } from './state';
import { claim } from './quests';

export const MASTERY_RANKS = ['none', 'seen', 'caught', 'bronze', 'silver', 'gold', 'master'] as const;
export type MasteryRank = (typeof MASTERY_RANKS)[number];
export const RANK_NAMES: Record<MasteryRank, string> = { none: 'Unknown', seen: 'Seen', caught: 'Caught', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', master: 'Master' };

export const rankIndex = (rank: MasteryRank) => MASTERY_RANKS.indexOf(rank);
export const atLeast = (rank: MasteryRank, min: MasteryRank) => rankIndex(rank) >= rankIndex(min);

export function emptyRecord(): MasteryRecord {
  return { seen: 0, caught: 0, battles: 0, bossWins: 0, evolved: 0, flawless: 0, regions: 0 };
}

// ---------- families ----------

/** The family a species belongs to: its first stage (a Mega or other battle form counts as its base species). */
export function familyId(content: Content, speciesId: string): string {
  let s = content.species.get(speciesId);
  if (s?.form && s.form.kind !== 'regional' && s.form.kind !== 'alternate') s = content.species.get(s.form.base) ?? s;
  while (s && s.evolutionStage > 1 && s.evolvesFrom) s = content.species.get(s.evolvesFrom);
  return s?.id ?? speciesId;
}

const familyCache = new WeakMap<Content, Map<string, string[]>>();

/** Every species in a family, first stage first. */
export function familyMembers(content: Content, family: string): string[] {
  let map = familyCache.get(content);
  if (!map) {
    map = new Map();
    for (const s of content.species.values()) {
      const f = familyId(content, s.id);
      map.set(f, [...(map.get(f) ?? []), s.id]);
    }
    for (const list of map.values()) list.sort((a, b) => content.species.get(a)!.evolutionStage - content.species.get(b)!.evolutionStage);
    familyCache.set(content, map);
  }
  return map.get(family) ?? [family];
}

// ---------- ranks ----------

export interface MasteryGoal {
  /** The rank this goal reaches. */
  rank: MasteryRank;
  /** What to do, in words, with each part's progress. */
  parts: { text: string; current: number; target: number }[];
}

function goalFor(content: Content, species: Species, rec: MasteryRecord, rank: MasteryRank): MasteryGoal | null {
  const b = content.balance.mastery;
  const battles = (n: number) => ({ text: `Fight ${n} battles with it`, current: Math.min(rec.battles, n), target: n });
  switch (rank) {
    case 'seen':
      return { rank, parts: [{ text: 'Meet it in a run', current: Math.min(rec.seen, 1), target: 1 }] };
    case 'caught':
      return { rank, parts: [{ text: 'Have it join your party', current: Math.min(rec.caught, 1), target: 1 }] };
    case 'bronze':
      return { rank, parts: [battles(b.bronzeBattles)] };
    case 'silver':
      return {
        rank,
        parts: [
          species.evolutions.length > 0 ? { text: 'Evolve it', current: Math.min(rec.evolved, 1), target: 1 } : battles(b.silverBattles),
          { text: 'Beat a boss with it', current: Math.min(rec.bossWins, 1), target: 1 },
        ],
      };
    case 'gold':
      return { rank, parts: [battles(b.goldBattles), { text: 'Beat a boss with it in a run where it never fainted', current: Math.min(rec.flawless, 1), target: 1 }] };
    case 'master':
      return { rank, parts: [{ text: 'Clear a region with it in your party', current: Math.min(rec.regions, 1), target: 1 }] };
    default:
      return null;
  }
}

/** A species' own rank from its counters. */
export function speciesRank(content: Content, speciesId: string, rec: MasteryRecord | undefined): MasteryRank {
  const species = content.species.get(speciesId);
  if (!species || !rec) return 'none';
  let rank: MasteryRank = 'none';
  for (const next of MASTERY_RANKS.slice(1)) {
    const goal = goalFor(content, species, rec, next)!;
    if (!goal.parts.every((p) => p.current >= p.target)) break;
    rank = next;
  }
  return rank;
}

/** The next rank's goal for a species, or null when it is Master. */
export function nextGoal(content: Content, speciesId: string, rec: MasteryRecord | undefined): MasteryGoal | null {
  const species = content.species.get(speciesId);
  if (!species) return null;
  const rank = speciesRank(content, speciesId, rec);
  const next = MASTERY_RANKS[rankIndex(rank) + 1];
  return next ? goalFor(content, species, rec ?? emptyRecord(), next) : null;
}

/** A family's rank: the best rank among its members. */
export function familyRank(content: Content, profile: Profile, family: string): MasteryRank {
  let best: MasteryRank = 'none';
  for (const id of familyMembers(content, family)) {
    const r = speciesRank(content, id, profile.mastery?.[id]);
    if (rankIndex(r) > rankIndex(best)) best = r;
  }
  return best;
}

// ---------- unlocks ----------

function moveScore(content: Content, species: Species | undefined, moveId: string): number {
  const move = content.moves.get(moveId);
  if (!move) return 0;
  if (!move.power) return 30;
  const stab = species?.types.includes(move.type) ? 1.5 : 1;
  return move.power * stab * ((move.accuracy ?? 100) / 100);
}

export interface EggMoveOption {
  id: string;
  /** False: the battle engine can't run it yet ("found, not active yet"). */
  active: boolean;
}

/** A family's egg moves (from its first stage), the strongest usable ones first. */
export function eggMoveOptions(content: Content, family: string): EggMoveOption[] {
  const species = content.species.get(family);
  const ids = content.eggMoves.get(family) ?? [];
  return ids
    .map((id) => ({ id, active: content.moves.get(id)?.supported === true }))
    .sort((a, b) => Number(b.active) - Number(a.active) || moveScore(content, species, b.id) - moveScore(content, species, a.id) || a.id.localeCompare(b.id));
}

/** The egg moves a family's Pokémon get: the player's picks, else the strongest usable ones. */
export function chosenEggMoves(content: Content, profile: Profile, family: string, count: number): string[] {
  const usable = eggMoveOptions(content, family).filter((o) => o.active).map((o) => o.id);
  const picks = (profile.mastery?.[family]?.eggMoves ?? []).filter((id) => usable.includes(id));
  const out = [...new Set([...picks, ...usable])];
  return out.slice(0, count);
}

/** The ability slots a family may use at its rank: Silver adds the Hidden Ability, Gold lets you pick any. */
export function abilityChoices(content: Content, profile: Profile, family: string): number[] {
  const rank = familyRank(content, profile, family);
  const species = content.species.get(family);
  if (!species || !atLeast(rank, 'silver')) return [];
  const hidden = species.abilities.hidden ? [-1] : [];
  if (!atLeast(rank, 'gold')) return hidden;
  return [...hidden, ...species.abilities.normal.map((_, i) => i)];
}

/** What one family's rank gives its Pokémon this run, or null for nothing. */
export function familyPerk(content: Content, profile: Profile, family: string): MasteryPerk | null {
  const rank = familyRank(content, profile, family);
  if (!atLeast(rank, 'bronze')) return null;
  const choices = abilityChoices(content, profile, family);
  const pick = profile.mastery?.[family]?.abilitySlot;
  const abilitySlot = choices.length === 0 ? null : pick !== undefined && choices.includes(pick) ? pick : choices[0]!;
  return { eggMoves: chosenEggMoves(content, profile, family, atLeast(rank, 'gold') ? 2 : 1), abilitySlot, awaken: atLeast(rank, 'master') };
}

/** Every family's unlocks for a new run (run.mastery). */
export function runMasteryPerks(content: Content, profile: { mastery?: Profile['mastery'] } | undefined): Record<string, MasteryPerk> {
  const out: Record<string, MasteryPerk> = {};
  if (!profile?.mastery) return out;
  const families = new Set(Object.keys(profile.mastery).map((id) => familyId(content, id)));
  for (const f of [...families].sort()) {
    const perk = familyPerk(content, { mastery: profile.mastery } as Profile, f);
    if (perk) out[f] = perk;
  }
  return out;
}

/** Species ranked Silver or better, as first stages, for the "Mastered" starter set. */
export function masteredStarters(content: Content, profile: { mastery?: Profile['mastery'] } | undefined): string[] {
  const out = new Set<string>();
  for (const [id, rec] of Object.entries(profile?.mastery ?? {})) if (atLeast(speciesRank(content, id, rec), 'silver')) out.add(familyId(content, id));
  return [...out].sort();
}

/**
 * Gives a Pokémon that just joined its family's unlocks (mutates `mon`).
 * Returns what changed, in words. A Pokémon with nothing unlocked is left alone.
 */
export function applyMastery(content: Content, run: RunState, mon: PokemonInstance): string[] {
  const perk = run.mastery?.[familyId(content, mon.speciesId)];
  if (!perk) return [];
  const species = content.species.get(mon.speciesId);
  const changes: string[] = [];
  for (const id of perk.eggMoves) {
    if (!content.moves.get(id)?.supported || mon.moves.some((m) => m.id === id)) continue;
    const entry = { id, pp: content.moves.get(id)!.pp };
    if (mon.moves.length < 4) mon.moves.push(entry);
    else {
      // Replaces its weakest move that isn't another egg move.
      let weakest = -1;
      mon.moves.forEach((m, i) => {
        if (perk.eggMoves.includes(m.id)) return;
        if (weakest < 0 || moveScore(content, species, m.id) < moveScore(content, species, mon.moves[weakest]!.id)) weakest = i;
      });
      if (weakest < 0) continue;
      mon.moves[weakest] = entry;
    }
    changes.push(`knows the egg move ${content.moves.get(id)!.name}`);
  }
  if (perk.abilitySlot !== null && species) {
    const fits = perk.abilitySlot === -1 ? Boolean(species.abilities.hidden) : perk.abilitySlot < species.abilities.normal.length;
    if (fits && mon.abilitySlot !== perk.abilitySlot) {
      mon.abilitySlot = perk.abilitySlot;
      const name = perk.abilitySlot === -1 ? species.abilities.hidden! : species.abilities.normal[perk.abilitySlot]!;
      changes.push(`has ${content.abilities.get(name)?.name ?? name}`);
    }
  }
  if (perk.awaken) {
    const best = mon.moves
      .map((m) => m.id)
      .filter((id) => content.moves.get(id)?.power)
      .sort((a, b) => moveScore(content, species, b) - moveScore(content, species, a))[0];
    if (best && !mon.awakened?.includes(best)) {
      mon.awakened = [...(mon.awakened ?? []), best];
      changes.push(`starts with ${content.moves.get(best)!.name} awakened`);
    }
  }
  return changes;
}

// ---------- recording a run ----------

export interface MasteryRankUp {
  speciesId: string;
  rank: MasteryRank;
}

/**
 * Adds a finished run to the mastery counters and pays each new rank once
 * (mutates `profile`). Every species a Pokémon was during the run counts it.
 */
export function recordMastery(content: Content, profile: Profile, run: RunState, now: string): MasteryRankUp[] {
  profile.mastery ??= {};
  const touched = new Set<string>();
  const rec = (id: string) => {
    if (!content.species.has(id)) return null;
    touched.add(id);
    return (profile.mastery[id] ??= emptyRecord());
  };
  for (const id of new Set(run.log.speciesSeen)) {
    const r = rec(id);
    if (r) r.seen += 1;
  }
  const inParty = new Set(run.party.map((m) => m.uid));
  const regionCleared = run.regionsCleared.length > 0;
  for (const h of Object.values(run.story?.histories ?? {})) {
    const forms = [...new Set([h.originalSpeciesId, ...h.evolutions.map((e) => e.to), h.speciesId])];
    const evolvedFrom = new Set(h.evolutions.map((e) => e.from));
    for (const id of forms) {
      const r = rec(id);
      if (!r) continue;
      r.seen = Math.max(r.seen, 1);
      r.caught += 1;
      r.battles += h.battles;
      r.bossWins += h.bossesBeaten;
      if (evolvedFrom.has(id)) r.evolved += 1;
      if (h.bossesBeaten > 0 && h.knockoutsTaken === 0) r.flawless += 1;
      if (regionCleared && inParty.has(h.uid)) r.regions += 1;
    }
  }
  const ups: MasteryRankUp[] = [];
  const pay = content.balance.mastery.rankResearch;
  for (const id of [...touched].sort()) {
    const reached = speciesRank(content, id, profile.mastery[id]);
    for (let i = rankIndex('bronze'); i <= rankIndex(reached); i++) {
      const rank = MASTERY_RANKS[i]! as 'bronze' | 'silver' | 'gold' | 'master';
      if (!claim(profile, `mastery:${id}:${rank}`, now)) continue;
      profile.researchPoints += pay[rank];
      if (rank === 'master') {
        const title = `${content.species.get(id)!.name} Master`;
        if (!profile.titles.includes(title)) profile.titles.push(title);
      }
      ups.push({ speciesId: id, rank });
    }
  }
  return ups;
}

/**
 * Sets a family's picks (its egg moves or ability slot). Returns a new profile.
 * A pick the family's rank doesn't allow is refused.
 */
export function setMasteryPicks(content: Content, current: Profile, family: string, picks: { eggMoves?: string[]; abilitySlot?: number }): Profile {
  const rank = familyRank(content, current, family);
  if (!atLeast(rank, 'bronze')) throw new Error('This family has no mastery unlocks yet.');
  const usable = eggMoveOptions(content, family).filter((o) => o.active).map((o) => o.id);
  if (picks.eggMoves && (picks.eggMoves.length > (atLeast(rank, 'gold') ? 2 : 1) || picks.eggMoves.some((id) => !usable.includes(id)))) throw new Error('That egg move is not unlocked.');
  if (picks.abilitySlot !== undefined && !abilityChoices(content, current, family).includes(picks.abilitySlot)) throw new Error('That ability is not unlocked.');
  const profile = structuredClone(current);
  profile.mastery[family] = { ...(profile.mastery[family] ?? emptyRecord()), ...picks };
  return profile;
}

/** For the catch screen: the family's rank, and what its unlocks would change if this Pokémon joins. */
export function masteryPreview(content: Content, profile: Profile, run: RunState, mon: PokemonInstance): string {
  const family = familyId(content, mon.speciesId);
  const rank = familyRank(content, profile, family);
  const changes = applyMastery(content, run, structuredClone(mon));
  const goal = nextGoal(content, mon.speciesId, profile.mastery?.[mon.speciesId]);
  const next = goal ? `  Next ${RANK_NAMES[goal.rank]}: ${goal.parts.map((g) => `${g.text} ${g.current}/${g.target}`).join(', ')}` : '';
  return `Mastery: ${RANK_NAMES[rank]}${changes.length > 0 ? `, joins and ${changes.join(', ')}` : ''}.${next}`;
}
