// Evil Teams (spec §16) and Permanent Run Choices (spec §17): data shapes and saved state.
// The teams live in src/data/evilTeams.json; their storyline and operation stops are written once as
// templates and expanded into ordinary map events per team (core/evil/content.ts).

import { z } from 'zod';
import { ArchetypeModifierSchema } from '../contentSchema';

export const EVIL_RANKS = ['grunt', 'specialist', 'executive', 'leader'] as const;
export const EvilRankSchema = z.enum(EVIL_RANKS);
export type EvilRank = z.infer<typeof EvilRankSchema>;

/** How a team presents itself: openly hostile, working in secret, or behind a legitimate front. */
export const EVIL_STYLES = ['open', 'secret', 'front'] as const;

/** Kinds of regional operation (spec §16 "Regional operations"). */
export const EVIL_OP_KINDS = ['facility', 'steal', 'research', 'legendary', 'trade', 'recruit', 'interfere', 'control', 'experiment', 'artificial', 'habitat'] as const;
export const EvilOpKindSchema = z.enum(EVIL_OP_KINDS);

/** How an operation ended. `foiled` and `infiltrated` stop it; `succeeded` (ignored) and `joined` let it through. */
export const EVIL_OP_OUTCOMES = ['running', 'foiled', 'infiltrated', 'succeeded', 'joined'] as const;
export const EvilOpOutcomeSchema = z.enum(EVIL_OP_OUTCOMES);

/** How the team's story ended this run. */
export const EVIL_ENDS = ['none', 'defeated', 'exposed', 'allied'] as const;

/** What a recurring villain says, by how your past meetings went. */
const LinesSchema = z.object({
  first: z.string().min(1),
  /** After you beat them last time. */
  beaten: z.string().min(1),
  /** After they beat you last time. */
  winning: z.string().min(1),
  /** After you beat them twice or more: grudging respect. */
  respect: z.string().min(1),
});

const RankSchema = z.object({
  /** Who they are ("Rocket Grunt", "Executive Ariana"). */
  name: z.string().min(1),
  /** Asset id of the picture shown in their scenes. */
  sprite: z.string().min(1),
  /** Their Pokémon, weakest first; a battle takes the first ones and evolves them to the level. */
  species: z.array(z.string()).min(2),
  lines: LinesSchema,
});

export const EvilTeamSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  style: z.enum(EVIL_STYLES),
  /** The name they hide behind (a front company, a club, a charity). */
  front: z.string().min(1),
  philosophy: z.string().min(1),
  motivation: z.string().min(1),
  goal: z.string().min(1),
  ranks: z.object({ grunt: RankSchema, specialist: RankSchema, executive: RankSchema, leader: RankSchema }),
  /** A team battle rule: `swarm` adds a Pokémon, `shadow` makes the first one a Shadow Pokémon you can snag, `elite` trades a Pokémon for levels. */
  rule: z.object({ kind: z.enum(['swarm', 'shadow', 'elite']), text: z.string().min(1) }),
  /** Team-exclusive spoils (items.json or itemCatalog.json ids). */
  spoils: z.array(z.string()).min(1),
  /** The Legendary they are after: it stirs once the team is stopped. */
  legendary: z.array(z.string()).min(1),
  /** The operations they run, one per region (in order, wrapping). */
  ops: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), kind: EvilOpKindSchema, name: z.string().min(1), text: z.string().min(1) })).min(3),
});
export type EvilTeam = z.infer<typeof EvilTeamSchema>;

/** What an operation's ending leaves behind for the rest of the run, by kind (an upside when stopped, a downside when let through). */
const OpConsequenceSchema = z.object({
  stopped: z.object({ text: z.string().min(1), effects: z.array(ArchetypeModifierSchema).max(2) }),
  through: z.object({ text: z.string().min(1), effects: z.array(ArchetypeModifierSchema).max(2) }),
});

export const EvilFileSchema = z.object({
  config: z.object({
    /** Stages between two storyline beats. */
    beatEvery: z.number().int().min(1),
    /** Run stage (1 = first) of the first beat. */
    firstStage: z.number().int().min(1),
    /** Heat (0 to max): how hard the team pushes back. */
    heatMax: z.number().int().min(1),
    /** Heat at which the team sends reinforcements (one more Pokémon). */
    reinforceAt: z.number().int().min(1),
    /** Heat at which they start ambushing you. */
    ambushAt: z.number().int().min(1),
    /** Heat per extra level on their Pokémon. */
    heatPerLevel: z.number().int().min(1),
    /** Extra levels per operation they pulled off. */
    levelsPerSuccess: z.number().int().min(0),
    /** Extra levels per time a recurring villain has met you. */
    levelsPerMeeting: z.number().int().min(0),
  }),
  consequences: z.record(EvilOpKindSchema, OpConsequenceSchema),
  teams: z.array(EvilTeamSchema),
  /** Plaza integration: disguised members in the crowd, a returning executive, and the price markup while they control trade. */
  plaza: z.object({
    agentChance: z.number().min(0).max(1),
    villainChance: z.number().min(0).max(1),
    markup: z.number().min(0).max(1),
    buyCost: z.number().int().min(0),
    unmaskMoney: z.number().int().min(0),
    hidden: z.object({ name: z.string().min(1), line: z.string().min(1) }),
    open: z.object({ name: z.string().min(1), line: z.string().min(1) }),
    unmask: z.string().min(1),
    buy: z.string().min(1),
    allied: z.string().min(1),
    controlled: z.string().min(1),
  }),
  /** Storyline beats (1 to 7) and the extra stops, as event templates with {team}-style tokens (core/evil/content.ts). */
  templates: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), beat: z.number().int().min(1).max(7).optional(), slot: z.enum(['op', 'ambush', 'disguise', 'legend']).optional(), styles: z.array(z.enum(EVIL_STYLES)).optional(), event: z.record(z.string(), z.unknown()) })).min(7),
});
export type EvilFile = z.infer<typeof EvilFileSchema>;

// ---------- saved state (run v32) ----------

export const VillainRecordSchema = z.object({ met: z.number().int().min(0), won: z.number().int().min(0), lost: z.number().int().min(0), last: z.enum(['none', 'won', 'lost']) });
export type VillainRecord = z.infer<typeof VillainRecordSchema>;

export const EvilStateSchema = z.object({
  /** The team working in this run's world (picked when the first beat comes due). */
  teamId: z.string().nullable(),
  /** Storyline beats played (0 to 7). */
  beat: z.number().int().min(0).max(7),
  /** Stages counted since the run began, and the count at which the next beat may come. */
  stages: z.number().int().min(0),
  nextAt: z.number().int().min(0),
  /** How hard the team pushes back. */
  heat: z.number().int().min(0),
  /** One operation per region. */
  ops: z.array(z.object({ id: z.string(), region: z.number().int().min(0), outcome: EvilOpOutcomeSchema })),
  /** Recurring villains by rank. */
  villains: z.record(z.string(), VillainRecordSchema),
  /** A member defected to your side. */
  defector: z.boolean(),
  end: z.enum(EVIL_ENDS),
});
export type EvilState = z.infer<typeof EvilStateSchema>;
export const freshEvil = (): EvilState => ({ teamId: null, beat: 0, stages: 0, nextAt: 0, heat: 0, ops: [], villains: {}, defector: false, end: 'none' });

/** A significant decision, in the run's choice history (spec §17). Weight 1 = small, 3 = run-defining. */
export const ChoiceRecordSchema = z.object({
  id: z.string(),
  pick: z.string(),
  text: z.string(),
  weight: z.number().int().min(1).max(3),
  region: z.number().int().min(0),
  stage: z.number().int().min(0),
});
export type ChoiceRecord = z.infer<typeof ChoiceRecordSchema>;
