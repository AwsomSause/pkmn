// Battle Drama spectacle (APPROVED section 7). Pure rules: Last Stand, Perfect Counter, the Momentum
// Meter (and its Rally), Guard Break, Revenge Moment and boss phases. The engine (engine.ts) calls these
// at fixed points and turns the answers into events; the screen only shows them. Rolls use their own
// seeded streams (hashSeed of stable ids), so no existing roll ever shifts. Off in double battles, and
// the Guard is off for raids and Totems (they have their own shield and phases).

import { z } from 'zod';
import { Rng, hashSeed } from '../rng';
import type { BattleState, PokemonInstance } from '../state';
import type { Content } from '../contentSchema';
import type { SpectacleConfig } from './spectacleConfig';

export const SpectacleKindSchema = z.enum(['lastStand', 'brace', 'counter', 'counterMiss', 'guardUp', 'guardBreak', 'guardRebuilt', 'rally', 'momentumFull', 'revenge', 'signature']);
export type SpectacleKind = z.infer<typeof SpectacleKindSchema>;

export const SpectacleBattleSchema = z.object({
  /** Momentum Meter, 0 to `momentum.max`. */
  momentum: z.number().int().min(0).default(0),
  /** Turns in a row your attack landed. */
  streak: z.number().int().min(0).default(0),
  rallies: z.number().int().min(0).default(0),
  /** This turn's move is a Rally (Surge Strike). */
  rallyOn: z.boolean().default(false),
  /** The telegraphed move was met by this turn's brace. */
  countered: z.boolean().default(false),
  counters: z.number().int().min(0).default(0),
  /** This turn the player braced for the telegraphed move (its id), if any. */
  bracing: z.string().nullable().default(null),
  /** Damage reflected by a landed counter, paid out at the end of the hit. */
  reflect: z.number().int().min(0).default(0),
  /** Pokémon that used their Last Stand this battle. */
  lastStands: z.array(z.string()).default([]),
  /** The Pokémon of yours that fainted last (for the Revenge Moment). */
  fallen: z.string().nullable().default(null),
  revenged: z.number().int().min(0).default(0),
  /** Signature moments already shown (uids). */
  signed: z.array(z.string()).default([]),
  /** The boss's Guard: which Pokémon, points left and at most, stagger turns left, times rebuilt. */
  guard: z.object({ uid: z.string(), hp: z.number().int().min(0), max: z.number().int().min(1), stagger: z.number().int().min(0), rebuilt: z.number().int().min(0) }).nullable().default(null),
  /** Boss phases already played (index into the class's list; 100+ for the final boss's list). */
  phases: z.array(z.number().int().min(0)).default([]),
  /** A Boss Revenge Rematch: the beaten boss's id. Treated as a boss for telegraphs and the Guard. */
  rematch: z.string().optional(),
  /** The run's final boss fight (more Guard, an extra phase). */
  final: z.boolean().default(false),
});
export type SpectacleBattle = z.infer<typeof SpectacleBattleSchema>;

export const freshSpectacle = (): SpectacleBattle => SpectacleBattleSchema.parse({});

export type SpectacleEvent = { type: 'spectacle'; kind: SpectacleKind; side: 'player' | 'enemy'; uid?: string; text: string };

export const cfgOf = (content: Content): SpectacleConfig => content.balance.spectacle;

/** The battle's spectacle state (made on first use). Null when spectacle is off for this battle. */
export function spectacleOf(content: Content, battle: BattleState): SpectacleBattle | null {
  if (!cfgOf(content).enabled || battle.doubles) return null;
  return (battle.spectacle ??= freshSpectacle());
}

/** A boss trainer fight (or a Boss Revenge Rematch): telegraphed attacks, a Guard, phases. Raids and Totems have their own. */
export function isBossFight(battle: Pick<BattleState, 'trainer' | 'raid' | 'totem' | 'spectacle'>): boolean {
  if (battle.raid || battle.totem) return false;
  const id = battle.trainer?.classId;
  return Boolean(battle.spectacle?.rematch) || id === 'gym-leader' || id === 'elite-four' || id === 'champion';
}

/** Bond score of a Pokémon of yours: average of trust and affection (0 to 100). */
export const bondScoreOf = (bond: { trust: number; affection: number } | undefined): number => (bond ? Math.round((bond.trust + bond.affection) / 2) : 0);

/** One seeded yes/no: stable for the same ids, independent of every other roll. */
export function spectacleRoll(key: string, chance: number): boolean {
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return new Rng(hashSeed(`spectacle::${key}`)).float() < chance;
}

// ---------- Last Stand ----------

export interface LastStandInput {
  battle: BattleState;
  mon: PokemonInstance;
  bond: number;
  /** No other Pokémon of yours can still fight. */
  lastStanding: boolean;
}

/** A fatal move hit on your Pokémon: does it hold on at 1 HP? Limited per battle; a deep bond (or being the last one standing) is needed. */
export function rollLastStand(content: Content, i: LastStandInput): boolean {
  const spec = spectacleOf(content, i.battle);
  const cfg = cfgOf(content).lastStand;
  if (!spec || spec.lastStands.length >= cfg.perBattle || spec.lastStands.includes(i.mon.uid)) return false;
  if (i.bond + (i.lastStanding ? cfg.lastMonBonus : 0) < cfg.minBond) return false;
  const enemy = i.battle.enemyTeam[0]?.uid ?? '';
  return spectacleRoll(`laststand::${i.mon.uid}::${enemy}::${i.battle.turn}`, cfg.chance);
}

// ---------- Momentum ----------

export const momentumMax = (content: Content): number => cfgOf(content).momentum.max;

export function addMomentum(content: Content, spec: SpectacleBattle, amount: number): boolean {
  const max = momentumMax(content);
  const before = spec.momentum;
  spec.momentum = Math.max(0, Math.min(max, spec.momentum + amount));
  return before < max && spec.momentum >= max;
}

export function rallyProblem(content: Content, battle: BattleState): string | null {
  const spec = spectacleOf(content, battle);
  if (!spec) return 'Momentum is not in play here';
  if (spec.momentum < momentumMax(content)) return 'The Momentum Meter is not full yet';
  if (spec.rallies >= cfgOf(content).momentum.ralliesPerBattle) return 'No Rallies left this battle';
  return null;
}

// ---------- Perfect Counter ----------

export function counterProblem(content: Content, battle: BattleState, telegraphed: boolean): string | null {
  const spec = spectacleOf(content, battle);
  if (!spec) return 'Countering is not possible here';
  if (!telegraphed) return 'Nothing is telegraphed to counter';
  if (spec.counters >= cfgOf(content).counter.perBattle) return 'No Counters left this battle';
  return null;
}

// ---------- Guard Break ----------

/** Guard points a boss Pokémon starts with (0 = no Guard in this fight). */
export function guardPoints(content: Content, battle: BattleState): number {
  if (!isBossFight(battle)) return 0;
  const cfg = cfgOf(content).guard;
  const base = cfg.classes[battle.trainer?.classId ?? ''] ?? (battle.spectacle?.rematch ? (cfg.classes['gym-leader'] ?? 0) : 0);
  if (base <= 0) return 0;
  return base + (battle.spectacle?.final ? cfg.finalBonus : 0) + (battle.spectacle?.rematch ? cfgOf(content).rematch.guardBonus : 0);
}

/** Puts up the Guard for the Pokémon now in front (once per Pokémon). Returns true when a new Guard went up. */
export function raiseGuard(content: Content, battle: BattleState, spec: SpectacleBattle, enemy: PokemonInstance): boolean {
  if (spec.guard?.uid === enemy.uid) return false;
  const max = guardPoints(content, battle);
  if (max <= 0) return false;
  spec.guard = { uid: enemy.uid, hp: max, max, stagger: 0, rebuilt: 0 };
  return true;
}

export const guardUp = (spec: SpectacleBattle, enemyUid: string): boolean => Boolean(spec.guard && spec.guard.uid === enemyUid && spec.guard.hp > 0 && spec.guard.stagger === 0);
export const staggered = (spec: SpectacleBattle, enemyUid: string): boolean => Boolean(spec.guard && spec.guard.uid === enemyUid && spec.guard.stagger > 0);

/** Damage multiplier on the boss from its Guard / stagger. */
export function guardDamage(content: Content, spec: SpectacleBattle, enemyUid: string): number {
  const cfg = cfgOf(content).guard;
  if (guardUp(spec, enemyUid)) return cfg.taken;
  if (staggered(spec, enemyUid)) return cfg.staggerDamage;
  return 1;
}

/** A damaging hit wears the Guard down (super effective hits wear it down faster). Returns true when it just broke. */
export function wearGuard(content: Content, spec: SpectacleBattle, enemyUid: string, superEffective: boolean): boolean {
  if (!guardUp(spec, enemyUid)) return false;
  const g = spec.guard!;
  g.hp = Math.max(0, g.hp - (superEffective ? cfgOf(content).guard.superEffective : 1));
  if (g.hp > 0) return false;
  // +1: the end of the breaking turn ticks it down once before the boss's next turn.
  g.stagger = cfgOf(content).guard.staggerTurns + 1;
  return true;
}

/** End of a turn: the stagger runs down, then the boss may put its Guard back up (limited). Returns true when it did. */
export function tickGuard(content: Content, spec: SpectacleBattle, enemyUid: string): boolean {
  const g = spec.guard;
  if (!g || g.uid !== enemyUid || g.stagger === 0) return false;
  g.stagger -= 1;
  if (g.stagger > 0 || g.rebuilt >= cfgOf(content).guard.rebuilds) return false;
  g.rebuilt += 1;
  g.hp = Math.max(1, Math.ceil(g.max / 2));
  return true;
}

// ---------- Boss phases ----------

export interface DuePhase { index: number; phase: SpectacleConfig['phases']['final'][number] }

/** Phases of the boss's last Pokémon whose HP line it has crossed and that have not played yet. */
export function duePhases(content: Content, battle: BattleState, spec: SpectacleBattle, hpShare: number): DuePhase[] {
  if (!isBossFight(battle) || battle.enemyIndex !== battle.enemyTeam.length - 1) return [];
  const cfg = cfgOf(content).phases;
  const list = [...(cfg.classes[battle.trainer?.classId ?? ''] ?? (spec.rematch ? (cfg.classes['gym-leader'] ?? []) : [])).map((phase, index) => ({ index, phase }))];
  if (spec.final) list.push(...cfg.final.map((phase, i) => ({ index: 100 + i, phase })));
  return list.filter((p) => hpShare <= p.phase.atHp && !spec.phases.includes(p.index));
}
