// Battle Drama spectacle (APPROVED section 7). Pure rules: Last Stand, the Momentum
// Meter (and its Rally), Revenge Moment and boss phases. The engine (engine.ts) calls these
// at fixed points and turns the answers into events; the screen only shows them. Rolls use their own
// seeded streams (hashSeed of stable ids), so no existing roll ever shifts. Off in double battles.

import { z } from 'zod';
import { Rng, hashSeed } from '../rng';
import type { BattleState, PokemonInstance } from '../state';
import type { Content } from '../contentSchema';
import type { SpectacleConfig } from './spectacleConfig';

export const SpectacleKindSchema = z.enum(['lastStand', 'rally', 'momentumFull', 'revenge', 'signature', 'bleed', 'curseTag', 'benchShout', 'hazardBurst', 'shout', 'deal', 'mindRead', 'grudge', 'spectator', 'arena', 'combo']);
export type SpectacleKind = z.infer<typeof SpectacleKindSchema>;

export const SpectacleBattleSchema = z.object({
  /** Momentum Meter, 0 to `momentum.max`. */
  momentum: z.number().int().min(0).default(0),
  /** Turns in a row your attack landed. */
  streak: z.number().int().min(0).default(0),
  rallies: z.number().int().min(0).default(0),
  /** This turn's move is a Rally (Surge Strike). */
  rallyOn: z.boolean().default(false),
  /** Pokémon that used their Last Stand this battle. */
  lastStands: z.array(z.string()).default([]),
  /** The Pokémon of yours that fainted last (for the Revenge Moment). */
  fallen: z.string().nullable().default(null),
  revenged: z.number().int().min(0).default(0),
  /** Signature moments already shown (uids). */
  signed: z.array(z.string()).default([]),
  /** Boss phases already played (index into the class's list; 100+ for the final boss's list). */
  phases: z.array(z.number().int().min(0)).default([]),
  /** A Boss Revenge Rematch: the beaten boss's id. Treated as a boss for telegraphs. */
  rematch: z.string().optional(),
  /** The run's final boss fight (an extra phase). */
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

/** A boss trainer fight (or a Boss Revenge Rematch): telegraphed attacks, phases. Raids and Totems have their own. */
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
