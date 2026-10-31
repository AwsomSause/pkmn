// Shadow and Blissful world data (APPROVED.md §12-14): how a Shadow Pokémon recovers, the evil factions and
// their lieutenants, and the blessings a sanctuary gives. All numbers live in shadowWorld.json.

import { z } from 'zod';
import { ArchetypeModifierSchema } from '../contentSchema';
import { NATURE_IDS } from '../natures';

const Id = z.string().regex(/^[a-z0-9-]+$/);

/** The named steps of the Heart Gauge: a stage starts when the gauge is at or below the previous stage's `above`. */
export const HeartStageSchema = z.object({ name: z.string().min(1), above: z.number().int().min(0).max(99) });

/** A recovery story: how a Shadow Pokémon of this temperament opens up (by its nature). */
export const TemperamentSchema = z.object({
  id: Id,
  label: z.string().min(1),
  natures: z.array(z.enum(NATURE_IDS)).min(1),
  /** Scales the Heart Gauge points one battle soothes. */
  sootheMultiplier: z.number().min(0.25).max(2),
  /** A one-line story shown when it joins and on its party page. */
  story: z.string().min(1),
  /** What the player reads as it crosses into each stage (by stage name) and when it is purified. */
  lines: z.record(z.string(), z.string().min(1)),
});
export type Temperament = z.infer<typeof TemperamentSchema>;

export const LieutenantSchema = z.object({
  id: Id,
  name: z.string().min(1),
  /** Said at the first gang raid. */
  intro: z.string().min(1),
  /** Said when the lieutenant has escaped before and is back. */
  returns: z.string().min(1),
});

export const FactionSchema = z.object({
  id: Id,
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  aim: z.string().min(1),
  lieutenant: LieutenantSchema,
  /** Gang raids (raids.json `gang.faction`) are found from these tiers on; the faction's operations grow from stage `startStage`. */
  startStage: z.number().int().min(1),
  /** What the faction does when the player ignores it / has just hurt it (shown in the intel line). */
  expands: z.string().min(1),
  retaliates: z.string().min(1),
});
export type Faction = z.infer<typeof FactionSchema>;

/** A temporary blessing from a sanctuary or shrine: ordinary run modifiers that last a few battles. */
export const BlessingSchema = z.object({
  id: Id,
  name: z.string().min(1),
  text: z.string().min(1),
  effects: z.array(ArchetypeModifierSchema).min(1).max(2),
  battles: z.number().int().min(1).max(5),
  until: z.enum(['battle', 'boss', 'wild']),
});
export type Blessing = z.infer<typeof BlessingSchema>;

export const BlissfulAuraSchema = z.object({
  id: Id,
  label: z.string().min(1),
  /** Display colour of the motes. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const ShadowWorldFileSchema = z.object({
  heartStages: z.array(HeartStageSchema).min(2).max(6),
  /** Extra Heart Gauge points soothed per teammate it has chemistry with (at most `chemistryMaxPartners`). */
  chemistrySoothe: z.number().int().min(0).max(10),
  chemistryMaxPartners: z.number().int().min(1).max(3),
  /** A Shadow Pokémon that has not been soothed at all yet sometimes ignores its trainer in battle (percent of turns). */
  resistPercent: z.number().int().min(0).max(40),
  /** Shadow wild encounters in an outbreak (percent of wild encounters on the afflicted stage). */
  outbreakWildPercent: z.number().int().min(0).max(100),
  /** The Heart Gauge a wild/foe Shadow Pokémon starts with, by how hard its faction pushed it. */
  startHeart: z.object({ min: z.number().int().min(50).max(100), max: z.number().int().min(50).max(100) }),
  /** After a battle with a Blissful Pokémon in the party: every other healthy member recovers this share of max HP. */
  blissfulAfterBattleHeal: z.number().min(0).max(0.15),
  /** At a healing stop, a Blissful Pokémon soothes every Shadow Pokémon in the party by this many Heart Gauge points. */
  blissfulRestSoothe: z.number().int().min(0).max(30),
  temperaments: z.array(TemperamentSchema).min(3),
  factions: z.array(FactionSchema).min(2),
  blessings: z.array(BlessingSchema).min(3),
  auras: z.array(BlissfulAuraSchema).min(2),
});
export type ShadowWorldFile = z.infer<typeof ShadowWorldFileSchema>;
