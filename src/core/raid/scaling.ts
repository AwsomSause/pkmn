// Badge-scaled raids (spec 31). Pure: the same badge count always gives the same raid. Badges are the main
// progression signal; rival and anomaly raids take half of them, the Grand-Enemy's and gang raids none.
// The scaled copy of a raid definition is what the battle hooks read (RaidBattle.badges remembers the count).

import type { Content } from '../contentSchema';
import { levelCap } from '../regions';
import type { PokemonInstance, RunState } from '../state';
import type { BadgeScaling, RaidDef } from './schema';

/** How many badges count for this raid (after the kind's share; none for Grand-Enemy and gang raids). */
export function effectiveBadges(s: BadgeScaling, def: Pick<RaidDef, 'kind' | 'grand' | 'gang'>, badges: number): number {
  if (def.grand || def.gang) return 0;
  return Math.floor(Math.max(0, badges) * (s.kindShare[def.kind] ?? 1));
}

/** Extra boss levels for the badges (before the region cap). */
export function badgeLevelBonus(s: BadgeScaling, def: Pick<RaidDef, 'kind' | 'grand' | 'gang'>, badges: number): number {
  return Math.min(s.maxLevelBonus, Math.floor(effectiveBadges(s, def, badges) * s.levelPerBadge));
}

/** The boss level once the badge bonus is added, never above the region's level cap. */
export function raidBadgeLevel(content: Content, run: Pick<RunState, 'regionIndex' | 'badges'>, def: RaidDef, level: number): number {
  const bonus = badgeLevelBonus(content.raids.badgeScaling, def, run.badges.length);
  return bonus === 0 ? level : Math.max(level, Math.min(levelCap(content, run.regionIndex), level + bonus));
}

/** A raid's name for its tier ("Elite"), or "Event" for rival and anomaly raids. */
export function raidTierName(s: BadgeScaling, def: Pick<RaidDef, 'tier' | 'kind'>): string {
  return def.kind === 'rival' || def.kind === 'anomaly' ? s.eventLabel : s.tierNames[def.tier - 1]!;
}

/** Whether a tier is open to dens at this badge count. */
export function tierOpenAtBadges(s: BadgeScaling, tier: number, badges: number): boolean {
  return badges >= (s.tierBadges[tier - 1] ?? 0);
}

/** The raid as it is for this many badges: tougher boss and mechanics, better prizes. The input is never changed. */
export function scaledRaid(content: Content, def: RaidDef, badges: number): RaidDef {
  const s = content.raids.badgeScaling;
  const b = effectiveBadges(s, def, badges);
  if (b === 0) return def;
  const out: RaidDef = structuredClone(def);
  out.hpBoostPercent = def.hpBoostPercent + Math.min(s.maxHpPercent, Math.round(b * s.hpPercentPerBadge));
  if (out.shield) {
    out.shield.points = Math.min(0.5, out.shield.points + b * s.shieldPointsPerBadge);
    if (def.tier >= 3 && b >= s.lastShieldBadges && out.shield.at.length < 3 && !out.shield.at.includes(0.25)) out.shield.at = [...out.shield.at, 0.25];
  }
  if (out.telegraph) {
    out.telegraph.boost = Math.min(2, Math.round((out.telegraph.boost + b * s.telegraphBoostPerBadge) * 100) / 100);
    if (b >= s.fasterChargeBadges) out.telegraph.everyTurns = Math.max(2, out.telegraph.everyTurns - 1);
  }
  if (out.extraActions && b >= s.extraActionBadges) out.extraActions.max = Math.min(3, out.extraActions.max + 1);
  // The second extra move needs badges (the first is always known).
  if (b < s.secondMoveBadges) out.extraMoves = def.extraMoves.slice(0, 1);
  out.rewards.moneyPerLevel = Math.round(def.rewards.moneyPerLevel * (1 + Math.min(s.maxMoneyPercent, b * s.moneyPercentPerBadge) / 100));
  if (b >= s.extraDraftBadges) out.rewards.draftExtra = Math.min(3, def.rewards.draftExtra + 1);
  if (b >= s.rareTokenBadges && def.tier >= 5) out.rewards.rareEncounters = Math.min(3, def.rewards.rareEncounters + 1);
  return out;
}

/** From these badges the boss uses its hidden ability, if its species has one. */
export function bossGetsHiddenAbility(content: Content, def: RaidDef, badges: number): boolean {
  const s = content.raids.badgeScaling;
  return effectiveBadges(s, def, badges) >= s.hiddenAbilityBadges;
}

/** Gives the boss its hidden ability when the badges call for it (and its species has one). */
export function applyBossAbility(content: Content, def: RaidDef, boss: PokemonInstance, badges: number): void {
  if (bossGetsHiddenAbility(content, def, badges) && content.species.get(boss.speciesId)?.abilities.hidden) boss.abilitySlot = -1;
}
