// Ideas W1 play rules, batch 2 (Kice, 2026-11-01): skill inputs (aim drag, signature shout, skill throw), the surrender
// deal, mind-read, grudges, spectator buffs and arena hazards. Pure helpers; numbers in balance.json `w1.play`.
// A skill grade is an INPUT to the turn (like a move choice), so the same state + seed + actions give the same result;
// the prompt that earned it lives in the UI and never touches a random number.

import { z } from 'zod';
import type { Content } from '../contentSchema';
import { maxHp } from '../pokemon';
import type { BattleState, PokemonInstance } from '../state';

export const GradeSchema = z.enum(['miss', 'ok', 'good', 'perfect']);
export type SkillGrade = z.infer<typeof GradeSchema>;
export const SkillInputSchema = z.object({ kind: z.enum(['aim', 'shout', 'throw']), grade: GradeSchema });
export type SkillInput = z.infer<typeof SkillInputSchema>;

const Bonus = z.object({ miss: z.number().min(0), ok: z.number().min(0), good: z.number().min(0), perfect: z.number().min(0) });

export const ArenaKindSchema = z.enum(['rocks', 'lava', 'flood']);
export type ArenaKind = z.infer<typeof ArenaKindSchema>;
export const ArenaSchema = z.object({ kind: ArenaKindSchema, spent: z.boolean().default(false) });

export const PlayConfigSchema = z.object({
  /** Moves that can be aimed with a drag; the grade multiplies their accuracy. */
  aim: z.object({ moves: z.array(z.string()).min(1), accuracy: Bonus }),
  /** A trainer echoing the shout of a signature move multiplies its damage. */
  shout: z.object({ damage: Bonus }),
  /** A skill throw multiplies the catch odds, but only on a weakened wild Pokémon. */
  throw: z.object({ catch: Bonus, weakenedBelow: z.number().min(0).max(1) }),
  /** A losing trainer offers a deal: stop now for more money, but no EXP. */
  deal: z.object({ below: z.number().min(0).max(1), money: z.number().min(1), classes: z.array(z.string()) }),
  /** Psychic allies read one foe move per battle. */
  mindRead: z.object({ types: z.array(z.string()).min(1) }),
  /** A Pokémon with a grudge against the foe's species: stat boost on its first turn out. */
  grudge: z.object({ boost: z.record(z.string(), z.number().int()) }),
  /** Doubles: two allies using damaging moves of the same type fire a joint attack (the second hit is stronger). */
  combo: z.object({ bonus: z.number().min(1) }),
  /** A spectator's one-time buff. */
  spectator: z.object({ chance: z.number().min(0).max(1), boost: z.record(z.string(), z.number().int()), names: z.array(z.string()).min(1) }),
  /** Arena hazards hit both sides every `every` turns; smashing the arena once hurts the foe. */
  arena: z.object({ every: z.number().int().min(2), fraction: z.number().min(0).max(0.5), interact: z.number().min(0).max(0.5), types: z.record(z.string(), ArenaKindSchema) }),
});
export type PlayConfig = z.infer<typeof PlayConfigSchema>;

const cfg = (content: Content): PlayConfig => content.balance.w1.play;

export const aimable = (content: Content, moveId: string): boolean => cfg(content).aim.moves.includes(moveId);

export function aimAccuracy(content: Content, skill: SkillInput | undefined, moveId: string): number {
  return skill?.kind === 'aim' && aimable(content, moveId) ? cfg(content).aim.accuracy[skill.grade] : 1;
}

export function shoutDamage(content: Content, skill: SkillInput | undefined, isSignature: boolean): number {
  return skill?.kind === 'shout' && isSignature ? cfg(content).shout.damage[skill.grade] : 1;
}

/** Catch multiplier of a skill throw (1 when it was not a throw or the foe is not weakened). */
export function throwCatch(content: Content, skill: SkillInput | undefined, hpShare: number, statused: boolean): number {
  const c = cfg(content).throw;
  if (skill?.kind !== 'throw') return 1;
  return hpShare <= c.weakenedBelow || statused ? c.catch[skill.grade] : 1;
}

/** The deal a trainer offers when their last Pokémon is nearly beaten (null = no offer). */
export function dealOffer(content: Content, battle: BattleState, foeHp: number, foeMax: number): { moneyMultiplier: number } | null {
  const c = cfg(content).deal;
  if (battle.kind !== 'trainer' || !battle.trainer || battle.deal || battle.dealRefused || battle.outcome) return null;
  if (!c.classes.includes(battle.trainer.classId)) return null;
  if (!battle.doubles && battle.enemyIndex !== battle.enemyTeam.length - 1) return null;
  return foeHp > 0 && foeHp / Math.max(1, foeMax) <= c.below ? { moneyMultiplier: c.money } : null;
}

/** What the foe has left for a deal: the one on the field, or (in doubles) everything still standing on the foe's team. */
export function foeStake(content: Content, battle: BattleState): { hp: number; max: number } {
  const mons = battle.doubles ? battle.enemyTeam : [battle.enemyTeam[battle.enemyIndex]!];
  return { hp: mons.reduce((n, m) => n + Math.max(0, m.hp), 0), max: mons.reduce((n, m) => n + maxHp(content, m), 0) };
}

/** A Psychic-type Pokémon of yours (anywhere in the party, still up) that can read the foe's mind. */
export function mindReader(content: Content, party: readonly PokemonInstance[]): PokemonInstance | null {
  const types = cfg(content).mindRead.types;
  return party.find((p) => p.hp > 0 && content.species.get(p.speciesId)?.types.some((t) => types.includes(t))) ?? null;
}

/** Arena kind for a stage theme (null = a plain arena). */
export function arenaFor(content: Content, themeId: string | undefined): ArenaKind | null {
  for (const t of (themeId ?? '').split('-')) if (cfg(content).arena.types[t]) return cfg(content).arena.types[t]!;
  return null;
}

/** Types that shrug an arena hazard off. */
export const ARENA_IMMUNE: Record<ArenaKind, readonly string[]> = { rocks: ['rock', 'flying'], lava: ['fire', 'rock'], flood: ['water', 'flying'] };

export const arenaText = (kind: ArenaKind): string => ({ rocks: 'Rocks tumble down the cliff!', lava: 'Lava flows across the floor!', flood: 'A wave floods the arena!' })[kind];
