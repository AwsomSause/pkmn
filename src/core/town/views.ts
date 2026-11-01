// Pocket Town (W7): read-only selectors the town screens and the actions share. Nothing here changes the profile.

import { calcDamage, typeEffectiveness } from '../battle/damage';
import { CAMP } from '../camp/schema';
import type { Content } from '../contentSchema';
import { calcStats, createPokemon } from '../pokemon';
import type { Profile } from '../state';
import { TOWN, freshTown, type TownProfile } from './schema';

const townOf = (p: Pick<Profile, 'town'>): TownProfile => p.town ?? freshTown();

export interface TeamMon { speciesId: string; name: string; level: number; types: string[] }
/** The Pokémon of the last finished run (the Fireplace, Hot Spring, Daycare and Stage use them). */
export function lastTeam(content: Content, p: Profile): TeamMon[] {
  const run = p.runHistory[0];
  if (!run) return [];
  const seen = new Set<string>();
  const out: TeamMon[] = [];
  for (const m of run.party) {
    const sp = content.species.get(m.speciesId);
    if (!sp || seen.has(m.speciesId)) continue;
    seen.add(m.speciesId);
    out.push({ speciesId: m.speciesId, name: sp.name, level: m.level, types: [...sp.types] });
  }
  return out;
}
export const primaryType = (m: { types: string[] }): string => m.types[0] ?? 'normal';

/** Past Pokémon that roam the Pet Corner: the last teams, then the Pokémon you kept. */
export function pets(content: Content, p: Profile): { speciesId: string; name: string }[] {
  const ids = [...p.runHistory.slice(0, 6).flatMap((r) => r.party.map((m) => m.speciesId)), ...p.pastPokemon.map((m) => m.speciesId)];
  return [...new Set(ids)].filter((id) => content.species.has(id)).slice(0, 12).map((id) => ({ speciesId: id, name: content.species.get(id)!.name }));
}

/** Gym badges you ever earned (boss ids), newest runs first. */
export function badgesOwned(p: Profile): string[] {
  return [...new Set((p.legacyRuns ?? []).flatMap((r) => r.badges))];
}

/** A collection's owned entries. Badges come from your runs; free starting pieces are always owned. */
export function ownedSet(p: Profile, set: string): string[] {
  const t = townOf(p);
  if (set === 'badges') return badgesOwned(p);
  const base = t.sets[set] ?? [];
  if (set === 'backdrops') return [...new Set(['bd-meadow', ...base])];
  return base;
}

export interface Relic { key: string; id: string; name: string; tier: number; cursed: boolean }
/** Relics seen in finished runs and not yet offered at the Shrine. A trailing "!" marks a cursed one. */
export function relicList(p: Profile): Relic[] {
  const t = townOf(p);
  return (t.sets.relics ?? []).flatMap((key) => {
    const id = key.replace(/!$/, '');
    const def = CAMP.relics.find((r) => r.id === id);
    return def ? [{ key, id, name: def.name, tier: def.tier, cursed: key.endsWith('!') }] : [];
  });
}
export const curseKnown = (t: TownProfile, id: string): boolean => (t.sets.offered ?? []).includes(`${id}!`) || (t.sets.relics ?? []).includes(`${id}!`);

/** The Museum's set bonus: money for the pedestals' tiers, and a Revive when all three share a tier. */
export function pedestalBonus(p: Profile, t: TownProfile): { money: number; items?: Record<string, number> } {
  const on = relicList(p).filter((r) => (t.sets.pedestal ?? []).includes(r.key));
  const money = on.reduce((s, r) => s + 50 * r.tier, 0);
  const same = on.length === 3 && on.every((r) => r.tier === on[0]!.tier);
  return same ? { money, items: { revive: 1 } } : { money };
}

export interface Trophy { id: string; name: string; kind: 'Achievement' | 'Champion' | 'Mastery' }
/** The trophy shelf: achievements, champion wins and mastered families. */
export function trophies(p: Profile): Trophy[] {
  const out: Trophy[] = [];
  for (const id of Object.keys(p.achievements ?? {})) out.push({ id: `ach:${id}`, name: id.replace(/[-_]/g, ' '), kind: 'Achievement' });
  p.runHistory.filter((r) => r.victory).forEach((r, i, all) => out.push({ id: `win:${r.runId}`, name: `Champion #${all.length - i}`, kind: 'Champion' }));
  for (const [id, m] of Object.entries(p.mastery ?? {})) if ((m.bossWins ?? 0) >= 3) out.push({ id: `mas:${id}`, name: `${id} master`, kind: 'Mastery' });
  return out.slice(0, 40);
}

// ---------- screens ----------

export interface Stats { runs: number; wins: number; winRate: number; bestStreak: number; favouriteType: string | null; favouriteSpecies: string | null; badges: number; achievements: number; townVisits: number }
export function townStats(content: Content, p: Profile): Stats {
  const runs = p.runHistory;
  let best = 0, cur = 0;
  for (const r of [...runs].reverse()) { cur = r.victory ? cur + 1 : 0; best = Math.max(best, cur); }
  const types: Record<string, number> = {};
  const species: Record<string, number> = {};
  for (const r of runs) for (const m of r.party) {
    species[m.speciesId] = (species[m.speciesId] ?? 0) + 1;
    for (const ty of content.species.get(m.speciesId)?.types ?? []) types[ty] = (types[ty] ?? 0) + 1;
  }
  const top = (rec: Record<string, number>): string | null => Object.entries(rec).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const wins = runs.filter((r) => r.victory).length;
  return { runs: runs.length, wins, winRate: runs.length > 0 ? Math.round((wins / runs.length) * 100) : 0, bestStreak: best, favouriteType: top(types), favouriteSpecies: top(species), badges: badgesOwned(p).length, achievements: Object.keys(p.achievements ?? {}).length, townVisits: townOf(p).counts.visits ?? 0 };
}

export type LedgerFilter = 'all' | 'wins' | 'losses';
export type LedgerSort = 'newest' | 'oldest' | 'regions' | 'encounters';
export const LEDGER_FILTERS: LedgerFilter[] = ['all', 'wins', 'losses'];
export const LEDGER_SORTS: LedgerSort[] = ['newest', 'oldest', 'regions', 'encounters'];
/** Run History with a filter and a sort. Each row keeps its seed for copying. */
export function ledger(p: Profile, filter: LedgerFilter, sort: LedgerSort): Profile['runHistory'] {
  const rows = p.runHistory.filter((r) => (filter === 'wins' ? r.victory : filter === 'losses' ? !r.victory : true));
  const by: Record<LedgerSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    newest: () => 0, oldest: () => 0,
    regions: (a, b) => b.regionsCleared - a.regionsCleared,
    encounters: (a, b) => b.encounters - a.encounters,
  };
  const out = [...rows].sort(by[sort]);
  return sort === 'oldest' ? out.reverse() : out;
}

export const rosterOpen = (p: Profile): { id: string; name: string; role: string; line: string; open: boolean; need: number }[] =>
  TOWN.roster.map((n) => ({ ...n, need: n.achievements, open: Object.keys(p.achievements ?? {}).length >= n.achievements }));

export function trackView(p: Profile): { xp: number; level: number; rows: { label: string; xp: number; claimed: boolean; reached: boolean; text: string }[] } {
  const t = townOf(p);
  const xp = t.counts.season ?? 0;
  const rows = TOWN.track.map((tr) => ({ label: tr.label, xp: tr.xp, claimed: (t.sets.track ?? []).includes(tr.label), reached: xp >= tr.xp, text: tr.reward.say ?? '' }));
  return { xp, level: rows.filter((r) => r.reached).length, rows };
}

export function collections(p: Profile): { id: string; name: string; have: number; of: number | null; entries: string[] }[] {
  const t = townOf(p);
  const set = (id: string, name: string, of: number | null, entries = t.sets[id] ?? []) => ({ id, name, have: entries.length, of, entries });
  const cards = Object.entries(p.mastery ?? {}).filter(([, m]) => (m.caught ?? 0) > 0).map(([id]) => id);
  return [set('badges', 'Gym badges', null, badgesOwned(p)), set('ribbons', 'Ribbons', 6), set('stickers', 'Stickers', 9), set('cards', 'Trading cards', null, cards), set('fish', 'Pond fish', 10), set('recipes', 'Recipes', TOWN.recipes.length), set('books', 'Lore books', TOWN.lore.length)];
}

/** The Hub's weather mirrors the last run: sun after a win, storm after a defeat, a mild day otherwise. */
export function townWeather(p: Profile): 'sun' | 'storm' | 'cloud' | 'clear' {
  const last = townOf(p).last;
  if (!last) return 'clear';
  return last.victory ? 'sun' : last.cleared >= 2 ? 'cloud' : 'storm';
}
/** The rooftop forecast for a date: a seeded pick, cosmetic only. */
export function forecast(now: Date): { label: string; tip: string }[] {
  const names = ['Clear skies', 'Light rain', 'Thunderstorm', 'Fog', 'Sandstorm', 'Snow', 'Strong sun'];
  const tips = ['A fine day for catching.', 'Water types are in a good mood.', 'Electric types are restless.', 'Ghosts wander. Keep your lantern.', 'Rock and Ground like it.', 'Ice types sparkle.', 'Fire types stretch out.'];
  return [0, 1, 2].map((d) => { const day = now.getFullYear() * 400 + now.getMonth() * 31 + now.getDate() + d; const i = (day * 7 + 3) % names.length; return { label: ['Today', 'Tomorrow', 'In two days'][d]!, tip: `${names[i]}. ${tips[i]}` }; });
}
export const currentSeason = (now: Date) => TOWN.seasons.find((s) => s.months.includes(now.getMonth() + 1)) ?? TOWN.seasons[0]!;

/** Jukebox tracks you may play. Unlock rules: free, runs:N, wins:N, or gacha (found in capsules or the track). */
export function jukeboxTracks(p: Profile): { id: string; name: string; open: boolean; how: string }[] {
  const t = townOf(p);
  const wins = p.runHistory.filter((r) => r.victory).length;
  return TOWN.tracks.map((tr) => {
    const [kind, n] = tr.unlock.split(':');
    const open = kind === 'free' || (kind === 'runs' && p.stats.runsStarted >= Number(n)) || (kind === 'wins' && wins >= Number(n)) || (t.sets.tracks ?? []).includes(tr.id);
    return { id: tr.id, name: tr.name, open, how: kind === 'free' ? 'Free' : kind === 'gacha' ? 'Found in the Capsule Corner or the season track' : kind === 'runs' ? `Start ${n} run${n === '1' ? '' : 's'}` : `Win ${n} run${n === '1' ? '' : 's'}` };
  });
}

export function guestbook(p: Profile): { from: string; text: string }[] {
  const ghosts = Object.entries(p.legacy?.ghosts ?? {}).map(([seed, g]) => ({ from: g.from, text: `${g.victory ? 'Won' : 'Fell'} with ${g.badges} badge${g.badges === 1 ? '' : 's'} on seed ${seed.slice(0, 12)}.` }));
  const own = p.runHistory.slice(0, 3).map((r) => ({ from: 'You', text: `${r.victory ? 'Champion run' : 'Run'} of ${r.encounters} encounters, ${r.badges} badges.` }));
  return [...ghosts, ...own];
}

export function theatreList(p: Profile): { id: string; title: string; lines: string[] }[] {
  const ends = p.runHistory.filter((r) => r.victory).map((r) => ({ id: r.runId, title: `Ending: ${r.epitaph ?? 'A champion\'s run'}`, lines: r.moments.slice(0, 4) }));
  const rivals = (p.rivalArchive ?? []).slice(0, 6).map((r, i) => ({ id: `rival-${i}`, title: `Rival arc: ${(r as { name?: string }).name ?? `Rival ${i + 1}`}`, lines: ['A rival you once faced is archived here.'] }));
  return [...ends, ...rivals];
}

export const elevatorFloors = (p: Profile): { id: string; name: string; scene: string; open: boolean }[] => {
  const t = townOf(p);
  return TOWN.floors.map((f) => ({ id: f.id, name: f.name, scene: f.scene, open: f.building === null || (t.counts[`visit:${f.building}`] ?? 0) > 0 }));
};

/** Best damaging move name a species knows at a level (the dummy lab's default). */
export function bestMove(content: Content, speciesId: string, level: number): string | null {
  const mon = createPokemon(content, speciesId, level, 'dummy');
  return [...mon.moves].map((m) => content.moves.get(m.id)).filter((m) => m && (m.power ?? 0) > 0).sort((a, b) => (b!.power ?? 0) - (a!.power ?? 0))[0]?.id ?? null;
}
export const dummyMoves = (content: Content, speciesId: string, level: number): string[] => createPokemon(content, speciesId, level, 'dummy').moves.map((m) => m.id).filter((id) => (content.moves.get(id)?.power ?? 0) > 0);

/** The practice dummy: Normal type, Defense and Sp. Def 100. Returns the damage range of one hit (no crit) and the % of 200 HP. */
export function dummyHit(content: Content, speciesId: string, level: number, moveId: string): { min: number; max: number; pct: [number, number]; effectiveness: number } | null {
  const move = content.moves.get(moveId);
  const sp = content.species.get(speciesId);
  if (!move || !sp || !(move.power ?? 0)) return null;
  const mon = createPokemon(content, speciesId, level, 'dummy');
  const stats = calcStats(content, mon);
  const physical = move.category === 'physical';
  const eff = typeEffectiveness(content.typeChart, move.type, ['normal']);
  const input = { level, power: move.power!, attack: physical ? stats.atk : stats.spa, defense: 100, attackStage: 0, defenseStage: 0, stab: sp.types.includes(move.type), effectiveness: eff, crit: false, burned: false, physical };
  const min = calcDamage(content.ruleset, { ...input, randomFactor: content.ruleset.randomFactorMin });
  const max = calcDamage(content.ruleset, { ...input, randomFactor: 100 });
  return { min, max, pct: [Math.round((min / 200) * 100), Math.round((max / 200) * 100)], effectiveness: eff };
}
