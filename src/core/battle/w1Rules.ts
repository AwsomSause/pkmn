// Ideas W1 battle rules (Kice, 2026-11-01): Type Resonance (M17), Bleed (M43), Curse Tags (M44), Hazard Layers 2.0 (M29)
// and the Underdog XP bonus (F25). Pure helpers with numbers from balance.json `w1`; no random numbers at all.

import { z } from 'zod';
import type { Content } from '../contentSchema';
import type { PokemonInstance } from '../state';
import { PlayConfigSchema } from './w1Play';

export const W1ConfigSchema = z.object({
  resonance: z.object({ minParty: z.number().int().min(2), bonus: z.number().min(1) }),
  bleed: z.object({
    maxStacks: z.number().int().min(1),
    /** Share of max HP lost per stack at the end of each turn. */
    perStack: z.number().min(0).max(0.2),
    /** The few moves that cause bleed (slicing moves and some Steel moves). */
    moves: z.array(z.string()).min(1),
  }),
  curse: z.object({ bonus: z.number().min(1), followUpTypes: z.array(z.string()).min(1) }),
  /** Spikes + Toxic Spikes both down: the switch-in takes this share of max HP and the poison is Toxic. */
  hazardBurst: z.object({ fraction: z.number().min(0).max(0.5) }),
  luck: z.object({
    /** Extra shiny odds per encounter since the last shiny (additive on the base chance), up to meterCap encounters. */
    meterBonus: z.number().min(0),
    meterCap: z.number().int().min(1),
    /** Extra shiny odds per wild of the same species in a row, up to chainCap. */
    chainBonus: z.number().min(0),
    chainCap: z.number().int().min(1),
    alphaChance: z.number().min(0).max(1),
    alphaLevels: z.number().int().min(0),
    /** Prize money multiplier for beating or catching an Alpha. */
    alphaMoney: z.number().min(1),
  }),
  play: PlayConfigSchema,
  bench: z.object({ minFriendship: z.number().int().min(0).max(255) }),
  underdog: z.object({ levels: z.number().int().min(1), xpBonus: z.number().min(1) }),
});
export type W1Config = z.infer<typeof W1ConfigSchema>;

/** How many of the party share this type (fainted ones still count: it is about the team you built). */
export function resonanceCount(content: Content, party: readonly PokemonInstance[], type: string): number {
  return party.filter((p) => content.species.get(p.speciesId)?.types.includes(type as never)).length;
}

/** Damage multiplier for the player's moves of a type shared by 3+ of the party (+5%). */
export function resonanceMultiplier(content: Content, party: readonly PokemonInstance[], moveType: string): number {
  const cfg = content.balance.w1.resonance;
  return resonanceCount(content, party, moveType) >= cfg.minParty ? cfg.bonus : 1;
}

export const causesBleed = (content: Content, moveId: string): boolean => content.balance.w1.bleed.moves.includes(moveId);

/** One more stack of bleed (capped). Returns the new stack count. */
export function addBleed(content: Content, stacks: number): number {
  return Math.min(content.balance.w1.bleed.maxStacks, stacks + 1);
}

export const bleedDamage = (content: Content, maxHp: number, stacks: number): number =>
  stacks <= 0 ? 0 : Math.max(1, Math.floor(maxHp * content.balance.w1.bleed.perStack * stacks));

/** Follow-up Ghost/Dark hits on a cursed target hit harder. */
export function curseMultiplier(content: Content, cursed: boolean, moveType: string): number {
  const cfg = content.balance.w1.curse;
  return cursed && cfg.followUpTypes.includes(moveType) ? cfg.bonus : 1;
}

/** Bench support: the benched Pokémon that likes you most (friendship high enough) and the stat it cheers on. */
export function benchSupporter(content: Content, party: readonly PokemonInstance[], activeIndex: number): { mon: PokemonInstance; stat: 'atk' | 'def' | 'spa' | 'spd' } | null {
  const min = content.balance.w1.bench.minFriendship;
  const best = party.filter((p, i) => i !== activeIndex && p.hp > 0 && p.friendship >= min).sort((a, b) => b.friendship - a.friendship || a.uid.localeCompare(b.uid))[0];
  if (!best) return null;
  const base = content.species.get(best.speciesId)?.baseStats;
  const stats = (['atk', 'def', 'spa', 'spd'] as const).map((k) => ({ k, v: base?.[k] ?? 0 }));
  return { mon: best, stat: stats.sort((a, b) => b.v - a.v)[0]!.k };
}

/** Underdog: the foe's team averages `levels`+ above your party's average. */
export function underdogXpMultiplier(content: Content, party: readonly PokemonInstance[], foes: readonly PokemonInstance[]): number {
  const cfg = content.balance.w1.underdog;
  if (party.length === 0 || foes.length === 0) return 1;
  const avg = (l: readonly PokemonInstance[]) => l.reduce((n, m) => n + m.level, 0) / l.length;
  return avg(foes) - avg(party) >= cfg.levels ? cfg.xpBonus : 1;
}
