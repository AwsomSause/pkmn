// Raid rules (pure, no Phaser). The battle engine calls the hooks here: `absorbHit` when the boss takes
// damage (shields), `chargedDamage` when the boss hits the player (telegraphed attack), `advanceRaid`
// at the end of each turn (phases, telegraph countdown, timer), `takeExtraAction` for bonus attacks.
// Nothing here uses randomness during a fight; the boss and den are picked from seeded generators.

import { Rng, hashSeed } from '../rng';
import { maxHp } from '../pokemon';
import type { Content } from '../contentSchema';
import type { BattleState, PokemonInstance, RaidBattle, RunState } from '../state';
import { grandRaidFor } from '../story/grandEnemy';
import type { RaidDef, RaidPhase } from './schema';

export function getRaid(content: Content, id: string): RaidDef {
  const raid = content.raids.raids.find((r) => r.id === id);
  if (!raid) throw new Error(`Unknown raid "${id}"`);
  return raid;
}

/** The raid tiers a den can have in a region (the last list covers later regions). */
export function tiersForRegion(content: Content, regionIndex: number): number[] {
  const lists = content.raids.tiersByRegion;
  return lists[Math.min(regionIndex, lists.length - 1)]!;
}

/** Which raid sits in a den: a seeded pick among the raids of the allowed tiers (stable for a given run, stage and den). */
export function pickRaidFor(content: Content, run: Pick<RunState, 'seed' | 'regionIndex'>, key: string): RaidDef {
  const tiers = tiersForRegion(content, run.regionIndex);
  const pool = content.raids.raids.filter((r) => tiers.includes(r.tier) && !r.grand);
  const rng = new Rng(hashSeed(`${run.seed}::raid-pick::${key}`));
  return rng.pick(pool.length > 0 ? pool : content.raids.raids);
}

/** Which species the boss is, from a seeded generator (so reloading never changes it). */
export function raidSpecies(def: RaidDef, run: Pick<RunState, 'seed'>, key: string): string {
  return new Rng(hashSeed(`${run.seed}::raid-species::${key}`)).pick(def.species);
}

/** Boss level: the top of the region's wild curve plus the raid's bonus, never above the region's level cap. */
export function raidLevel(def: RaidDef, scaleEnd: number, cap: number): number {
  return Math.max(2, Math.min(cap, Math.round(scaleEnd) + def.levelBonus));
}

export function freshRaidBattle(def: RaidDef): RaidBattle {
  return {
    id: def.id,
    pendingShields: def.shield ? [...def.shield.at].sort((a, b) => b - a) : [],
    shieldHp: 0,
    shieldMax: 0,
    phasesDone: [],
    nextCharge: def.telegraph ? def.telegraph.everyTurns : null,
    charging: false,
    extraUsed: 0,
    timerLeft: def.timerTurns,
    notes: [],
  };
}

/** The boss's extra max HP (a stat boost on the instance, so the HP bar and Dynamax maths just work). */
export function applyBossHp(def: RaidDef, boss: PokemonInstance): void {
  boss.statBoosts = { ...boss.statBoosts, hp: def.hpBoostPercent };
}

/**
 * The boss is about to lose `amount` HP. A shield soaks the damage first (overflow is lost); a threshold
 * that would be crossed stops the boss there and raises the next shield. Returns the damage that goes through.
 */
export function absorbHit(content: Content, battle: BattleState, boss: PokemonInstance, amount: number): number {
  const raid = battle.raid;
  if (!raid || amount <= 0) return amount;
  if (raid.shieldHp > 0) {
    raid.shieldHp = Math.max(0, raid.shieldHp - amount);
    if (raid.shieldHp === 0) {
      raid.charging = false;
      raid.notes.push({ tone: 'shield', text: 'The shield shattered!' });
    }
    return 0;
  }
  const next = raid.pendingShields[0];
  const def = getRaid(content, raid.id);
  if (next !== undefined && def.shield) {
    const floorHp = Math.ceil(maxHp(content, boss) * next);
    if (boss.hp - amount < floorHp) {
      raid.pendingShields.shift();
      raid.shieldMax = Math.max(1, Math.ceil(maxHp(content, boss) * def.shield.points));
      raid.shieldHp = raid.shieldMax;
      raid.notes.push({ tone: 'shield', text: 'A shield surrounds the boss! Break it to keep going.' });
      return Math.max(0, boss.hp - floorHp);
    }
  }
  return amount;
}

/** A charged (telegraphed) attack hits harder; returns the damage after the boost. */
export function chargedDamage(content: Content, battle: BattleState, amount: number): number {
  const raid = battle.raid;
  if (!raid || !raid.charging) return amount;
  const boost = getRaid(content, raid.id).telegraph?.boost ?? 1;
  return Math.floor(amount * boost);
}

export type RaidAction =
  | { kind: 'note'; tone: 'shield' | 'phase' | 'warn' | 'info'; text: string }
  | { kind: 'phase'; phase: RaidPhase }
  | { kind: 'timeout' };

/** End of turn: flushes notes, starts phases, counts down the telegraph and the timer. */
export function advanceRaid(content: Content, battle: BattleState, boss: PokemonInstance): RaidAction[] {
  const raid = battle.raid;
  if (!raid) return [];
  const def = getRaid(content, raid.id);
  const actions: RaidAction[] = raid.notes.map((n) => ({ kind: 'note', tone: n.tone, text: n.text }));
  raid.notes = [];
  if (boss.hp <= 0) return actions;
  const share = boss.hp / maxHp(content, boss);
  def.phases.forEach((phase, i) => {
    if (raid.phasesDone.includes(i) || share > phase.atHp) return;
    raid.phasesDone.push(i);
    actions.push({ kind: 'phase', phase });
  });
  if (def.telegraph) {
    if (raid.charging) {
      raid.charging = false;
      raid.nextCharge = def.telegraph.everyTurns;
    } else if (raid.nextCharge !== null) {
      raid.nextCharge -= 1;
      if (raid.nextCharge <= 0) {
        raid.charging = true;
        raid.nextCharge = null;
        actions.push({ kind: 'note', tone: 'warn', text: def.telegraph.text });
      }
    }
  }
  if (raid.timerLeft !== null) {
    raid.timerLeft -= 1;
    if (raid.timerLeft <= 0) actions.push({ kind: 'timeout' });
    else if (raid.timerLeft === 10 || raid.timerLeft === 5) actions.push({ kind: 'note', tone: 'warn', text: `${raid.timerLeft} turns left!` });
  }
  return actions;
}

/** True (and counted) when the boss may take a bonus attack now: under the HP line, within its limit. */
export function takeExtraAction(content: Content, battle: BattleState, boss: PokemonInstance): boolean {
  const raid = battle.raid;
  if (!raid || boss.hp <= 0) return false;
  const extra = getRaid(content, raid.id).extraActions;
  if (!extra || raid.extraUsed >= extra.max || boss.hp / maxHp(content, boss) > extra.belowHp) return false;
  raid.extraUsed += 1;
  return true;
}

/** What the player sees about a raid before and during the fight. */
export interface RaidPreview {
  id: string;
  name: string;
  tier: number;
  blurb: string;
  speciesId: string;
  level: number;
  entryCost: number;
  mechanics: string[];
  rewards: string[];
}

export function describeMechanics(def: RaidDef): string[] {
  const out = [`HP pool ×${(1 + def.hpBoostPercent / 100).toFixed(1)}`];
  if (def.shield) out.push(`${def.shield.at.length} shield${def.shield.at.length > 1 ? 's' : ''}`);
  if (def.phases.length > 0) out.push(`${def.phases.length} phase${def.phases.length > 1 ? 's' : ''}`);
  if (def.telegraph) out.push('charged attack');
  if (def.extraActions) out.push('bonus attacks');
  if (def.timerTurns) out.push(`${def.timerTurns}-turn timer`);
  if (def.weather) out.push(`${def.weather} field`);
  return out;
}

export function describeRewards(def: RaidDef): string[] {
  const out = [`₽${def.rewards.moneyPerLevel} × level`];
  for (const i of def.rewards.items) out.push(`${i.item.replace(/-/g, ' ')}${i.chance < 1 ? ` (${Math.round(i.chance * 100)}%)` : ''}`);
  if (def.rewards.draftExtra > 0) out.push(`+${def.rewards.draftExtra} draft choice${def.rewards.draftExtra > 1 ? 's' : ''}`);
  if (def.rewards.joinChance > 0) out.push(`${Math.round(def.rewards.joinChance * 100)}% the boss joins you`);
  return out;
}

/**
 * When a stage starts: maybe one raid den, beside a node picked by a generator of its own (the stage map
 * and every other stream stay unchanged). Not in the Pokémon League, not at the gym column. Mutates `run`.
 */
export function placeRaidDens(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::raid-den::${run.regionIndex}:${stage.index}`));
  placeGrandEnemy(content, run, rng);
  if (!rng.chance(content.raids.denChance)) return;
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && !n.sides.some((s) => s.kind === 'raid'));
  if (candidates.length === 0) return;
  const node = rng.pick(candidates);
  const def = pickRaidFor(content, run, `${run.regionIndex}:${stage.index}`);
  node.sides.push({ id: `raid-${stage.index}`, kind: 'raid', raidId: def.id, used: false });
}

/** The Grand-Enemy's fight for this stage, if the campaign calls for one: a den beside a node of its own pick. */
function placeGrandEnemy(content: Content, run: RunState, rng: Rng): void {
  const stage = run.stage!;
  const kind = grandRaidFor(content, run);
  if (!kind) return;
  const def = content.raids.raids.find((r) => r.grand === kind);
  if (!def) return;
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && !n.sides.some((s) => s.kind === 'raid'));
  if (candidates.length === 0) return;
  const node = rng.pick(candidates);
  node.sides.push({ id: `raid-grand-${stage.index}`, kind: 'raid', raidId: def.id, used: false });
}
