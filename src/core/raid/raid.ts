// Raid rules (pure, no Phaser). The battle engine calls the hooks here: `absorbHit` when the boss takes
// damage (shields), `chargedDamage` when the boss hits the player (telegraphed attack), `advanceRaid`
// at the end of each turn (phases, telegraph countdown, timer), `takeExtraAction` for bonus attacks.
// Nothing here uses randomness during a fight; the boss and den are picked from seeded generators.

import { Rng, hashSeed } from '../rng';
import { maxHp } from '../pokemon';
import type { Content } from '../contentSchema';
import type { BattleState, PokemonInstance, RaidBattle, RunState } from '../state';
import { focusDenBonus } from '../campaign/director';
import { grandRaidFor } from '../story/grandEnemy';
import type { TypeName } from '../contentSchema';
import { isUnlockedAt } from '../availability';
import { levelCap } from '../regions';
import type { RaidApproach, RaidDef, RaidPhase } from './schema';

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

/** The highest raid tier a den can have: the open tiers, or one above the best tier won before (earlier runs or this one). */
export function highestOpenTier(content: Content, run: Partial<Pick<RunState, 'raids'>>): number {
  const raids = run.raids;
  if (!raids) return 6;
  return Math.min(6, Math.max(content.raids.openTiers, raids.unlockedTier + 1, raids.bestTier + 1));
}

/** Which raid sits in a den: a seeded pick among the raids of the allowed tiers (stable for a given run, stage and den). */
export function pickRaidFor(content: Content, run: Pick<RunState, 'seed' | 'regionIndex'> & Partial<Pick<RunState, 'raids'>>, key: string): RaidDef {
  const open = highestOpenTier(content, run);
  const region = tiersForRegion(content, run.regionIndex).filter((t) => t <= open);
  // A region whose tiers are all still closed gets the highest open tier instead.
  const tiers = region.length > 0 ? region : [Math.max(...content.raids.raids.filter((r) => !r.grand && !r.gang && r.tier <= open && !r.legendary).map((r) => r.tier))];
  const tiered = content.raids.raids.filter((r) => tiers.includes(r.tier) && !r.grand && !r.gang && !r.legendary);
  // Spreadsheet availability: a den's boss must be unlocked at the level it would fight at (else the tier's dens stay as they were).
  const cap = levelCap(content, run.regionIndex);
  const end = Math.max(1, cap - content.balance.difficulty.capMargin);
  const unlocked = tiered.filter((r) => r.species.every((id) => isUnlockedAt(content, id, raidLevel(r, end, cap))));
  const pool = unlocked.length > 0 ? unlocked : tiered;
  const rng = new Rng(hashSeed(`${run.seed}::raid-pick::${key}`));
  return rng.pick(pool.length > 0 ? pool : content.raids.raids.filter((r) => !r.gang && !r.legendary));
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
    cheersLeft: 3,
    cheerOffense: 0,
    cheerDefense: 0,
    cheerLevel: 1,
    lead: null,
    breaker: null,
    tank: null,
    survivor: null,
    rivalHelped: false,
    rival: null,
    rivalFinished: false,
    returning: false,
    rewardPercent: 100,
    draftDelta: 0,
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

/** The type the boss is weak to right now (rotating weakness), or null. Stateless: it follows the turn number. */
export function rotatingWeakness(content: Content, battle: BattleState, turn = battle.turn): { type: TypeName; boost: number } | null {
  const rot = battle.raid ? getRaid(content, battle.raid.id).modifiers.rotatingWeakness : undefined;
  if (!rot) return null;
  return { type: rot.types[Math.floor(turn / rot.everyTurns) % rot.types.length]!, boost: rot.boost };
}

/**
 * Damage multiplier from raid field rules and cheers for one hit: your Offense cheer and the rotating weakness
 * on your hits; the elemental surge and your Defense cheer on the boss's hits.
 */
export function raidFieldMultiplier(content: Content, battle: BattleState, attacker: 'player' | 'enemy', moveType: TypeName): number {
  const raid = battle.raid;
  if (!raid) return 1;
  const mods = getRaid(content, raid.id).modifiers;
  let m = 1;
  if (attacker === 'player') {
    if (raid.cheerOffense > 0) m *= OFFENSE_CHEER[raid.cheerLevel - 1]!;
    const weak = rotatingWeakness(content, battle);
    if (weak && weak.type === moveType) m *= weak.boost;
  } else {
    if (mods.surge && mods.surge.type === moveType) m *= mods.surge.boost;
    if (raid.cheerDefense > 0) m *= DEFENSE_CHEER[raid.cheerLevel - 1]!;
  }
  return m;
}

/** Cheer strengths (Raid Battles pack: Offense, Defense, Healing). */
export const OFFENSE_CHEER = [1.3, 1.45, 1.6];
export const DEFENSE_CHEER = [0.7, 0.6, 0.5];
export const HEALING_CHEER = [0.3, 0.45, 0.6];
/** Cheer level from the raids won so far: 0 wins = 1, 1 to 2 = 2, 3 or more = 3. */
export const cheerLevelFor = (raidsWon: number): number => (raidsWon >= 3 ? 3 : raidsWon >= 1 ? 2 : 1);
export const CHEER_TURNS = 3;
export type Cheer = 'offense' | 'defense' | 'healing' | 'counter';

/** Why a cheer can't be used now, or null. */
export function cheerProblem(content: Content, battle: BattleState, cheer: Cheer): string | null {
  const raid = battle.raid;
  if (!raid) return 'Only raid fights have cheers.';
  if (raid.cheersLeft <= 0) return 'No cheers left.';
  if (cheer === 'healing' && getRaid(content, raid.id).modifiers.noHealing) return 'Healing is restricted in this raid.';
  return null;
}

/** Why a healing item can't be used in this raid, or null. */
export function raidItemProblem(content: Content, battle: BattleState, isHealing: boolean): string | null {
  const raid = battle.raid;
  return raid && isHealing && getRaid(content, raid.id).modifiers.noHealing ? 'Healing is restricted in this raid.' : null;
}

/** A charged (telegraphed) attack hits harder; returns the damage after the boost. */
export function chargedDamage(content: Content, battle: BattleState, amount: number): number {
  const raid = battle.raid;
  if (!raid || !raid.charging) return amount;
  const tele = getRaid(content, raid.id).telegraph;
  // Counterplay: a boss under sleep, paralysis or freeze loses its charge.
  const boss = battle.enemyTeam[battle.enemyIndex];
  const status = boss?.status?.id;
  if (tele && status && (tele.interruptedBy as string[]).includes(status)) {
    raid.charging = false;
    raid.nextCharge = tele.everyTurns;
    raid.notes.push({ tone: 'info', text: 'The charged attack was interrupted!' });
    return amount;
  }
  return Math.floor(amount * (tele?.boost ?? 1));
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
  if (raid.cheerOffense > 0) raid.cheerOffense -= 1;
  if (raid.cheerDefense > 0) raid.cheerDefense -= 1;
  if (boss.hp <= 0) return actions;
  const rot = def.modifiers.rotatingWeakness;
  if (rot) {
    const next = rotatingWeakness(content, battle, battle.turn + 1)!;
    if (next.type !== rotatingWeakness(content, battle)!.type) actions.push({ kind: 'note', tone: 'info', text: `The boss is now weak to ${next.type}-type moves!` });
  }
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
  kind: RaidDef['kind'];
  returning: boolean;
  approaches: { id: string; label: string; text: string; cost: number; leave: boolean }[];
}

export function describeMechanics(def: RaidDef): string[] {
  const out = [`HP pool ×${(1 + def.hpBoostPercent / 100).toFixed(1)}`];
  if (def.shield) out.push(`${def.shield.at.length} shield${def.shield.at.length > 1 ? 's' : ''}`);
  if (def.phases.length > 0) out.push(`${def.phases.length} phase${def.phases.length > 1 ? 's' : ''}`);
  if (def.telegraph) out.push(`charged attack (${def.telegraph.interruptedBy.map((s) => ({ slp: "sleep", par: "paralysis", frz: "freeze" })[s]).join(', ')} interrupts it)`);
  if (def.extraActions) out.push('bonus attacks');
  if (def.timerTurns) out.push(`${def.timerTurns}-turn timer`);
  if (def.weather) out.push(`${def.weather} field`);
  const m = def.modifiers;
  if (m.terrain) out.push(`${m.terrain} terrain`);
  if (m.surge) out.push(`${m.surge.type} surge`);
  if (m.noHealing) out.push('no healing');
  if (m.rotatingWeakness) out.push('rotating weakness');
  if (def.extraMoves.length > 0) out.push(`${4 + def.extraMoves.length} moves`);
  return out;
}

export function describeRewards(def: RaidDef): string[] {
  const out = [`₽${def.rewards.moneyPerLevel} × level`];
  for (const i of def.rewards.items) out.push(`${i.item.replace(/-/g, ' ')}${i.chance < 1 ? ` (${Math.round(i.chance * 100)}%)` : ''}`);
  if (def.rewards.draftExtra > 0) out.push(`+${def.rewards.draftExtra} draft choice${def.rewards.draftExtra > 1 ? 's' : ''}`);
  if (def.rewards.joinChance > 0) out.push(`${Math.round(def.rewards.joinChance * 100)}% the boss joins you`);
  if (def.rewards.megaStones > 0) out.push(`up to ${def.rewards.megaStones} Mega Stone${def.rewards.megaStones > 1 ? 's' : ''} for your team`);
  if (def.rewards.rareEncounters > 0) out.push(`${def.rewards.rareEncounters} rare-encounter token${def.rewards.rareEncounters > 1 ? 's' : ''}`);
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
  if (placeReturning(content, run, rng)) return;
  if (!rng.chance(content.raids.denChance + focusDenBonus(run, 'raids'))) return;
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

/** A Pokémon-specific raid memory earned by what it did (Overdrive §3 "Raid memories"). */
export interface RaidMemory {
  uid: string;
  key: 'lead' | 'breaker' | 'tank' | 'finisher' | 'survivor';
  title: string;
  text: (name: string, boss: string) => string;
}

/**
 * The memories a won raid hands out: contribution, not only the last hit. A Pokémon can earn more than one;
 * the same Pokémon is not listed twice for the same memory.
 */
export function raidMemories(battle: BattleState, finisherUid: string | undefined): RaidMemory[] {
  const raid = battle.raid;
  if (!raid) return [];
  const out: RaidMemory[] = [];
  if (raid.lead) out.push({ uid: raid.lead, key: 'lead', title: 'First to Face the Beast', text: (n, b) => `${n} was first to face ${b}.` });
  if (raid.breaker) out.push({ uid: raid.breaker, key: 'breaker', title: 'The One Who Broke Its Guard', text: (n, b) => `${n} broke ${b}'s guard.` });
  if (raid.tank) out.push({ uid: raid.tank, key: 'tank', title: 'It Took the Hit for Everyone', text: (n, b) => `${n} took ${b}'s charged attack for the whole team.` });
  if (raid.survivor) out.push({ uid: raid.survivor, key: 'survivor', title: 'The One That Survived', text: (n, b) => `${n} survived ${b}'s signature attack.` });
  if (finisherUid) out.push({ uid: finisherUid, key: 'finisher', title: 'The Final Blow Belonged to...', text: (n, b) => `${n} landed the final blow on ${b}.` });
  return out;
}

/** Friendship each distinct contributor gets for a won raid (a share of it per memory, so contribution counts). */
export const RAID_MEMORY_FRIENDSHIP = 4;

/** A boss that escaped earlier comes back as a den in this stage (one per stage, stronger); returns true when it did. */
function placeReturning(content: Content, run: RunState, rng: Rng): boolean {
  const stage = run.stage!;
  const raidId = run.raids.escaped[0];
  if (!raidId || !content.raids.raids.some((r) => r.id === raidId)) {
    run.raids.escaped.shift();
    return false;
  }
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && !n.sides.some((s) => s.kind === 'raid'));
  if (candidates.length === 0) return false;
  run.raids.escaped.shift();
  rng.pick(candidates).sides.push({ id: `raid-return-${stage.index}`, kind: 'raid', raidId, used: false, returning: true });
  return true;
}

/** The approach a player picked at a den: the one named, else the first (so older callers and bots still work). */
export function pickApproach(def: RaidDef, approachId: string | undefined): RaidApproach | null {
  if (def.approaches.length === 0) return null;
  const found = approachId ? def.approaches.find((a) => a.id === approachId) : def.approaches.find((a) => !a.leave);
  if (!found) throw new Error(`Unknown approach "${approachId}"`);
  return found;
}

/** Stat and reward changes of a returning boss ("the one that got away", back and changed). */
export const RETURNING_LEVEL_BONUS = 3;
export const RETURNING_HP_PERCENT = 50;
