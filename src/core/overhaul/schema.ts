// Shapes of the Overhaul content pack (src/data/overhaul/, imported by
// tools/import-overhaul-pack.ts). Slice 1 is data only: every file is "disabled" until a
// later slice wires it into a game system, which then moves it to "limited" or "supported".
// Never imports Phaser.

import { z } from 'zod';

/** Every pack file is wrapped with its status, a note and where it came from. */
const fileOf = <T extends z.ZodType>(entry: T) =>
  z.object({
    status: z.enum(['supported', 'limited', 'disabled', 'invalid']),
    note: z.string().min(1),
    source: z.string().min(1),
    entries: z.array(entry).min(1),
  });

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const text = z.string().min(1);
/** Set on an entry that must stay off (e.g. it needs cross-run memory, which the director turned off). */
const disabled = z.string().min(1).optional();

export const VOICES = ['cheerful', 'nervous', 'boastful', 'gruff', 'formal', 'poetic', 'menacing', 'eccentric'] as const;
export const AI_STYLES = ['Brawler', 'Strategist', 'Gambler', 'Wall', 'Veteran', 'MadScientist'] as const;
export const MOMENT_BUDGETS = ['minor', 'major', 'landmark'] as const;
export const CHAIN_RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'unique', 'legendary'] as const;
export const TRAINER_ROLES = ['protagonist', 'champion', 'gym', 'villain', 'elite', 'mentor', 'rival', 'captain', 'admin', 'ally', 'frontier'] as const;
export const LINE_SITUATIONS = ['intro', 'sendout', 'survive', 'repeat', 'read', 'ace', 'fail', 'overdrive', 'low', 'last', 'win', 'lose', 'taunt', 'weather'] as const;

export const MilestoneSchema = z.object({
  id,
  name: text,
  category: z.enum(['journey', 'battle', 'boss', 'rival', 'clutch', 'evolution', 'survival', 'legendary', 'transformation', 'bond', 'team', 'collection', 'story']),
  weight: z.enum(MOMENT_BUDGETS),
  condition: text,
  phrasings: z.array(text).min(1),
  disabled,
});

export const TitleSchema = z.object({
  id,
  title: text,
  /** 0 = legendary ... 3 = common. */
  tier: z.number().int().min(0).max(3),
  /** "ID", "NxID" or "A+B", naming milestones. */
  requires: text,
  flavor: text,
});

const EMOTIONS = ['joy', 'concern', 'fear', 'resolve', 'curious', 'annoyed', 'rest', 'pride'] as const;
export const PersonalitySchema = z.object({
  id,
  name: text,
  voice: text,
  natures: z.array(text).min(1),
  summary: text,
  phrases: z.object(Object.fromEntries(EMOTIONS.map((e) => [e, text])) as Record<(typeof EMOTIONS)[number], typeof text>),
});

export const QuirkSchema = z.object({
  id,
  name: text,
  category: text,
  description: text,
  moments: z.array(z.object({ when: id, line: text })).min(1),
});

export const RelationshipTypeSchema = z.object({
  id,
  name: text,
  pairing: text,
  minBond: z.number().int().min(0).max(100),
  interaction: text,
  benefit: text.nullable(),
  mechanical: z.boolean(),
});

export const TeamChemistrySchema = z.object({
  id,
  name: text,
  tier: z.enum(['common', 'uncommon', 'rare', 'epic']),
  requirement: text,
  scene: text,
  reward: text.nullable(),
  /** Species named in the requirement that the game has. */
  speciesIds: z.array(id),
  /** False when a named species is missing from the game, so the combo can't happen yet. */
  complete: z.boolean(),
});

export const BattleEnvironmentSchema = z.object({
  id,
  name: text,
  biome: text,
  presentation: text,
  /** "none" or "pow:<Type>:<+|->10" (one mechanic, at most ±10%). */
  mechanic: z.string().regex(/^(none|pow:[A-Za-z/]+:[+-]10)$/),
  banner: text.nullable(),
});

export const BattlefieldConditionSchema = z.object({
  id,
  name: text,
  stage: z.enum(['mid', 'late', 'boss', 'evilteam']),
  announce: text,
  effect: text,
  duration: z.number().int().min(1).max(3),
  counterplay: text,
});

export const GrowthPathSchema = z.object({
  id,
  name: text,
  /** "any", "type:<Type>" or "role:<tag>". */
  gate: z.string().regex(/^(any|type:[A-Z][a-z]+|role:[a-z-]+)$/),
  earnedBy: text,
  bonus: text,
  flavor: text,
});

export const MoveMasterySchema = z.object({
  move: text,
  experienced: text,
  mastered: text,
  /** The game's move id, or null when the game doesn't have the move. */
  moveId: id.nullable(),
});

export const RunTitleTemplateSchema = z.object({
  id,
  template: text,
  phase: z.enum(['start', 'end']),
  requires: z.array(id),
  tone: text,
});

export const TrainerArchetypeSchema = z.object({
  id,
  name: text,
  category: text,
  voice: z.enum(VOICES),
  ai: z.enum(AI_STYLES),
  tierMin: z.number().int().min(1).max(4),
  tierMax: z.number().int().min(1).max(4),
  things: z.array(text).min(1),
  acts: z.array(text).min(1),
  motto: text,
});

export const MajorTrainerSchema = z.object({
  id,
  name: text,
  role: z.enum(TRAINER_ROLES),
  region: text,
  type: text,
  ace: text,
  voice: z.enum(VOICES),
  traits: z.array(text).min(1),
  motto: text,
  /** The game's boss with the same name, or null when the game has none yet. */
  bossId: id.nullable(),
  aceId: id.nullable(),
});

export const ItemSynergySchema = z.object({
  id,
  item: text,
  partner: z.object({ kind: z.enum(['ability', 'move', 'type', 'role', 'species']), value: text }),
  text,
  source: text,
  /** The game's item id, or null when the game doesn't have the item. */
  itemId: id.nullable(),
  /** The game's species, move or ability id for those partner kinds (null for type/role or when missing). */
  partnerId: id.nullable(),
  /** True when both the item and the partner exist in the game. */
  usable: z.boolean(),
});

export const SignatureMomentSchema = z.object({
  id,
  name: text,
  category: text,
  trigger: text,
  scene: text,
  budget: z.enum(MOMENT_BUDGETS),
  disabled,
});

/** `needs`: one flag an earlier stage of the same chain sets; the option only shows after that choice. */
export const ChainOptionSchema = z.object({ id, label: text, outcome: text, sets: z.array(id), needs: id.optional() });
export const ChainStageSchema = z.object({
  id,
  minNodesAfterPrevious: z.number().int().min(0),
  maxNodesAfterPrevious: z.number().int().min(0),
  scene: text,
  options: z.array(ChainOptionSchema).min(2),
});
export const EventChainSchema = z.object({
  id,
  title: text,
  rarity: z.enum(CHAIN_RARITIES),
  regions: z.array(text).nullable(),
  stages: z.array(ChainStageSchema).min(1),
  /** Pick weight by rarity (100/40/12/4/1); null for legendary chains, which use their own gate. */
  weight: z.number().positive().nullable(),
  archetype: z.enum(['sighting', 'trial', 'crisis', 'pursuit', 'shrine', 'calling']).optional(),
});

export const ArchetypeLineSchema = z.object({ id, archetype: id, situation: z.enum(LINE_SITUATIONS), voice: z.enum(VOICES), text, source: text });
export const TrainerLineSchema = z.object({ id, trainer: id, situation: z.enum([...LINE_SITUATIONS, 'signature', 'role']), text, source: z.enum(['curated', 'template+profile']) });
export const ReactionSchema = z.object({
  id,
  source: z.enum(['personality-context', 'quirk', 'type-context']),
  context: z.string().regex(/^[a-z_]+$/),
  text,
  personality: id.optional(),
  quirk: id.optional(),
  type: text.optional(),
});
export const SpeciesMomentSchema = z.object({
  id,
  species: text,
  num: z.number().int().positive(),
  kind: z.enum(['lore', 'type', 'ability', 'hidden-ability', 'move', 'lineage', 'size', 'stat', 'egg-group', 'tag']),
  trigger: text,
  scene: text,
  source: z.enum(['curated-lore', 'data-generated']),
  speciesId: id.nullable(),
});

export const OVERHAUL_CATALOG_SCHEMAS = {
  milestones: fileOf(MilestoneSchema),
  titles: fileOf(TitleSchema),
  personalities: fileOf(PersonalitySchema),
  quirks: fileOf(QuirkSchema),
  relationship_types: fileOf(RelationshipTypeSchema),
  team_chemistry: fileOf(TeamChemistrySchema),
  battle_environments: fileOf(BattleEnvironmentSchema),
  battlefield_conditions: fileOf(BattlefieldConditionSchema),
  growth_paths: fileOf(GrowthPathSchema),
  move_mastery_ideas: fileOf(MoveMasterySchema),
  run_titles: fileOf(RunTitleTemplateSchema).extend({ pools: z.record(z.string(), z.array(text).min(1)) }),
  trainer_archetypes: fileOf(TrainerArchetypeSchema),
  major_trainers: fileOf(MajorTrainerSchema),
  item_synergies: fileOf(ItemSynergySchema),
  signature_moments_library: fileOf(SignatureMomentSchema),
  event_chains: fileOf(EventChainSchema),
} as const;

export const OVERHAUL_LINE_SCHEMAS = {
  archetype_lines: fileOf(ArchetypeLineSchema),
  major_trainer_lines: fileOf(TrainerLineSchema),
  contextual_reactions: fileOf(ReactionSchema),
  species_signature_moments: fileOf(SpeciesMomentSchema),
} as const;

export type OverhaulCatalogName = keyof typeof OVERHAUL_CATALOG_SCHEMAS;
export type OverhaulLineName = keyof typeof OVERHAUL_LINE_SCHEMAS;
export type OverhaulCatalogs = { [K in OverhaulCatalogName]: z.infer<(typeof OVERHAUL_CATALOG_SCHEMAS)[K]> };
export type OverhaulLines<K extends OverhaulLineName> = z.infer<(typeof OVERHAUL_LINE_SCHEMAS)[K]>;
