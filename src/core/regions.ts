// Regions and the campaign around them (GAME_DESIGN.md §4): regular regions
// in a random order, each visited once, with the Grand Region last. A region
// is 8 themed stages, then its Pokémon League (Elite Four, then champion).
// Each region raises the level cap (director decision D14).

import type { Campaign, Content, LeagueTrainer, Region } from './contentSchema';
import type { Rng } from './rng';
import type { RunState } from './state';

export function getCampaign(content: Content, id: string): Campaign {
  const campaign = content.campaigns.get(id);
  if (!campaign) throw new Error(`Unknown campaign "${id}"`);
  return campaign;
}

export function getRegion(content: Content, id: string): Region {
  const region = content.regions.get(id);
  if (!region) throw new Error(`Unknown region "${id}"`);
  return region;
}

/** A shuffled list of regular regions (as many as the campaign wants), then the Grand Region if it has one. */
export function generateRegionOrder(content: Content, campaign: Campaign, rng: Rng): string[] {
  const all = [...content.regions.values()];
  const regular = rng.shuffle(all.filter((r) => !r.grand).map((r) => r.id)).slice(0, campaign.regularRegions);
  const grand = campaign.grandRegion ? all.filter((r) => r.grand).map((r) => r.id) : [];
  return [...regular, ...grand];
}

/** The region the run is in now. */
export function currentRegion(content: Content, run: RunState): Region {
  const id = run.regionOrder[run.regionIndex];
  if (!id) throw new Error(`The run has no region ${run.regionIndex + 1}`);
  return getRegion(content, id);
}

/**
 * The highest level any Pokémon can reach in a region: levelCapStep × region number
 * (50, 100, ...). Levels above 100 are not decided yet (D14), so it stops at maxLevel.
 */
export function levelCap(content: Content, regionIndex: number): number {
  const { levelCapStep, maxLevel } = content.balance.difficulty;
  return Math.min(maxLevel, levelCapStep * (regionIndex + 1));
}

/** The level cap for the region the run is in now. */
export function runLevelCap(content: Content, run: Pick<RunState, 'regionIndex'>): number {
  return levelCap(content, run.regionIndex);
}

/** Picks someone not used yet: from `local` first, then from everyone, then (if all are used) anyone. */
function pickFresh<T extends { id: string }>(all: T[], local: readonly string[], used: Set<string>, rng: Rng): T {
  const fresh = all.filter((p) => !used.has(p.id));
  const localFresh = fresh.filter((p) => local.includes(p.id));
  for (const list of [localFresh, fresh, all]) if (list.length > 0) return rng.pick(list);
  throw new Error('No one to pick');
}

/** The region's Elite Four (in battle order) and champion, none of them met before this run. */
export function pickLeague(content: Content, region: Region, campaign: Campaign, used: readonly string[], rng: Rng): { eliteFour: string[]; champion: string } {
  const taken = new Set(used);
  const eliteFour: string[] = [];
  const all = [...content.eliteFour.values()];
  for (let i = 0; i < campaign.eliteFourSize; i++) {
    const member = pickFresh(all, region.eliteFour, taken, rng);
    taken.add(member.id);
    eliteFour.push(member.id);
  }
  const champion = pickFresh([...content.champions.values()], region.champions, taken, rng);
  return { eliteFour, champion: champion.id };
}

export type BossRole = 'gym' | 'elite' | 'champion';

export interface BossInfo {
  role: BossRole;
  name: string;
  /** "Gym Leader Brock", "Elite Four Lorelei", "Champion Lance". */
  title: string;
  spriteAssetId: string;
  types: LeagueTrainer['types'];
}

const ROLE_TITLES: Record<BossRole, string> = { gym: 'Gym Leader', elite: 'Elite Four', champion: 'Champion' };

/** Looks up a gym leader, Elite Four member or champion by id and role. */
export function bossInfo(content: Content, role: BossRole, id: string): BossInfo {
  const person = role === 'gym' ? content.gymLeaders.get(id) : role === 'elite' ? content.eliteFour.get(id) : content.champions.get(id);
  if (!person) throw new Error(`Unknown ${ROLE_TITLES[role]} "${id}"`);
  return { role, name: person.name, title: `${ROLE_TITLES[role]} ${person.name}`, spriteAssetId: person.spriteAssetId, types: person.types };
}
