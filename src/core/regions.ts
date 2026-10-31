// Regions and the campaign around them (GAME_DESIGN.md §4): regular regions
// in a random order, each visited once, with the Grand Region last. A region
// is 8 themed stages, then its Pokémon League (Elite Four, then champion).
// Each region raises the level cap (director decision D14).

import type { Boss, BossRole, Campaign, Content, Region, TypeName } from './contentSchema';
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
export function generateRegionOrder(content: Content, campaign: Campaign, rng: Rng, chosen: string | null = null): string[] {
  const all = [...content.regions.values()];
  const shuffled = rng.shuffle(all.filter((r) => !r.grand).map((r) => r.id));
  // A chosen region (Regional Circuit) replaces the random pick, after the shuffle so no later roll moves.
  const regular = campaign.regularRegions === 1 && chosen && shuffled.includes(chosen) ? [chosen] : shuffled.slice(0, campaign.regularRegions);
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
 * (50, 100, ...), never above balance.difficulty.maxLevel (D14).
 */
export function levelCap(content: Content, regionIndex: number): number {
  const { levelCapStep, maxLevel } = content.balance.difficulty;
  return Math.min(maxLevel, levelCapStep * (regionIndex + 1));
}

/** The level cap for the region the run is in now. */
export function runLevelCap(content: Content, run: Pick<RunState, 'regionIndex'> & Partial<Pick<RunState, 'stage' | 'campaignId'>>): number {
  const region = levelCap(content, run.regionIndex);
  if (!run.stage || run.stage.kind !== 'stage' || !run.campaignId) return region;
  return Math.min(region, stageLevelCap(content, getCampaign(content, run.campaignId), run.regionIndex, run.stage.index));
}

/** What the party may reach in a stage: the level of that stage's last wild enemy plus balance.difficulty.stageCapMargin. */
export function stageLevelCap(content: Content, campaign: Campaign, regionIndex: number, stageIndex: number): number {
  const cfg = content.balance.difficulty;
  const cap = levelCap(content, regionIndex);
  const start = regionIndex === 0 ? cfg.baseLevel : levelCap(content, regionIndex - 1);
  const end = Math.max(start, cap - cfg.capMargin);
  const total = campaign.stagesPerRegion * campaign.columns - 1;
  const t = Math.min(1, ((stageIndex + 1) * campaign.columns - 1) / Math.max(1, total));
  return Math.min(cap, Math.round(start + (end - start) * Math.pow(t, cfg.curve)) + cfg.stageCapMargin);
}

/** Picks someone not used yet: from `local` first, then from everyone, then (if all are used) anyone. */
function pickFresh<T extends { id: string }>(all: T[], local: readonly string[], used: Set<string>, rng: Rng): T {
  const fresh = all.filter((p) => !used.has(p.id));
  const localFresh = fresh.filter((p) => local.includes(p.id));
  for (const list of [localFresh, fresh, all]) if (list.length > 0) return rng.pick(list);
  throw new Error('No one to pick');
}

/** The region's Elite Four (in battle order) and champion, none of them met before this run. Any boss can take either role. */
export function pickLeague(content: Content, region: Region, campaign: Campaign, used: readonly string[], rng: Rng): { eliteFour: string[]; champion: string } {
  const taken = new Set(used);
  const eliteFour: string[] = [];
  const all: Boss[] = [...content.bosses.values()];
  for (let i = 0; i < campaign.eliteFourSize; i++) {
    const member = pickFresh(all, region.eliteFour, taken, rng);
    taken.add(member.id);
    eliteFour.push(member.id);
  }
  const champion = pickFresh(all, region.champions, taken, rng);
  return { eliteFour, champion: champion.id };
}

export type { BossRole };

export interface BossInfo {
  role: BossRole;
  name: string;
  /** "Gym Leader Brock", "Elite Four Lorelei", "Champion Lance". */
  title: string;
  /** The portrait for this role (a boss can have a champion outfit, for example). */
  spriteAssetId: string;
  types: TypeName[];
}

const ROLE_TITLES: Record<BossRole, string> = { gym: 'Gym Leader', elite: 'Elite Four', champion: 'Champion' };

export function getBoss(content: Content, id: string): Boss {
  const boss = content.bosses.get(id);
  if (!boss) throw new Error(`Unknown boss "${id}"`);
  return boss;
}

/** Looks up a gym leader, Elite Four member or champion by id and role. */
export function bossInfo(content: Content, role: BossRole, id: string): BossInfo {
  const person = getBoss(content, id);
  return { role, name: person.name, title: `${ROLE_TITLES[role]} ${person.name}`, spriteAssetId: person.sprites[role] ?? person.sprites.default, types: person.types };
}

/** Every portrait any boss uses (for loading assets). */
export function bossSpriteIds(content: Content): string[] {
  return [...content.bosses.values()].flatMap((b) => Object.values(b.sprites).filter((id): id is string => Boolean(id)));
}
