// Party Personality & Chemistry (APPROVED.md §1, §9, §10): the authored data (src/data/partyLife.json)
// and the run's saved state (`RunState.partyLife`).

import { z } from 'zod';
import json from '../../data/partyLife.json';

const Effect = z.object({
  /** Pair chemistry points (doubled when the choice fits either Pokémon's personality). */
  chem: z.number().int().optional(),
  tension: z.number().int().optional(),
  /** Affection and trust for both Pokémon's bond with you. */
  aff: z.number().int().optional(),
  trust: z.number().int().optional(),
  /** Share of the second Pokémon's max HP it recovers. */
  heal: z.number().min(0).max(1).optional(),
  friendship: z.number().int().optional(),
});
export type SceneEffect = z.infer<typeof Effect>;

const Who = z.object({
  traits: z.array(z.string()).optional(),
  /** Hurt: HP at or below this share (still standing). */
  hurt: z.number().min(0).max(1).optional(),
  small: z.boolean().optional(),
  big: z.boolean().optional(),
  ghost: z.boolean().optional(),
  affection: z.number().int().optional(),
  fainted: z.boolean().optional(),
  evolved: z.boolean().optional(),
  newcomer: z.boolean().optional(),
  recent: z.boolean().optional(),
});

const Choice = z.object({
  label: z.string(),
  text: z.string(),
  effect: Effect,
  /** Personalities this choice suits; a Pokémon of that personality in the scene doubles the gain. */
  fits: z.array(z.string()).optional(),
  spot: z.number().int().optional(),
});

export const SCENE_CONTEXTS = ['any', 'camp', 'faint', 'win', 'boss', 'prebattle', 'evolve', 'newcomer', 'sulk', 'grudge'] as const;

export const VignetteSchema = z.object({
  id: z.string(),
  ctx: z.enum(SCENE_CONTEXTS),
  who: z.enum(['solo', 'pair', 'party', 'pact']),
  text: z.array(z.string()).min(1),
  caption: z.string(),
  weight: z.number().positive(),
  voice: z.string().optional(),
  a: Who.optional(),
  b: Who.optional(),
  /** Both Pokémon need a damaging move. */
  both: z.object({ damaging: z.boolean() }).optional(),
  stage: z.tuple([z.number().int(), z.number().int()]).optional(),
  affinity: z.enum(['warm', 'clash']).optional(),
  rivalry: z.enum(['friendly', 'tense']).optional(),
  env: z.array(z.string()).optional(),
  /** Needs a pair memory with this tag ('*' = any). */
  mem: z.string().optional(),
  action: z.enum(['gift', 'hint', 'berry', 'forget', 'hide', 'egg', 'spirit', 'photo', 'reassure']).optional(),
  debrief: z.enum(['hero', 'miss', 'close', 'any']).optional(),
  settled: z.boolean().optional(),
  effect: Effect.optional(),
  choices: z.array(Choice).optional(),
  /** The choice used when the player closes the scene without picking. */
  dflt: z.number().int().optional(),
  remember: z.object({ tag: z.string(), text: z.string() }).optional(),
});
export type Vignette = z.infer<typeof VignetteSchema>;

const Personality = z.object({
  label: z.string(),
  blurb: z.string(),
  gifts: z.array(z.string()).min(1),
  weather: z.object({ rain: z.string(), snow: z.string(), heat: z.string(), wind: z.string() }),
  sulk: z.string(),
  pose: z.string(),
  say: z.record(z.string(), z.string()),
  warm: z.array(z.string()),
  clash: z.array(z.string()),
});
export type Personality = z.infer<typeof Personality>;

export const PartyLifeDataSchema = z.object({
  note: z.string(),
  stages: z.array(z.object({ id: z.string(), name: z.string(), at: z.number().int().min(0) })).min(2),
  milestones: z.record(z.string(), z.string()),
  rules: z.object({
    sceneChance: z.number().min(0).max(1),
    recentLimit: z.number().int().positive(),
    pairCooldown: z.number().int().min(0),
    giftMinAffection: z.number().int(),
    sulkAfter: z.number().int().positive(),
    grudgeAfterFaints: z.number().int().positive(),
    pactMinStage: z.number().int().min(0),
    pactBattles: z.number().int().positive(),
    scrapbookLimit: z.number().int().positive(),
    memoryLimit: z.number().int().positive(),
    chemCap: z.number().int().positive(),
    synergyMinStage: z.number().int().min(0),
    recognizeAfter: z.number().int().positive(),
    smallWeight: z.number(),
    bigWeight: z.number(),
    tensionTense: z.number().int(),
    tensionRival: z.number().int(),
    shared: z.object({ closeCall: z.number().int(), boss: z.number().int(), aid: z.number().int(), evolve: z.number().int() }),
  }),
  quirks: z.array(z.string()).min(1),
  envByType: z.record(z.string(), z.string()),
  envWeather: z.record(z.string(), z.string()),
  babies: z.array(z.string()).min(1),
  hideRewards: z.array(z.string()).min(1),
  culture: z.array(z.object({ id: z.string(), name: z.string(), traits: z.array(z.string()), blurb: z.string() })).min(1),
  personalities: z.record(z.string(), Personality),
  vignettes: z.array(VignetteSchema).min(1),
});
export type PartyLifeData = z.infer<typeof PartyLifeDataSchema>;
export const PARTY_LIFE = PartyLifeDataSchema.parse(json);

// ---------- saved state ----------

export const PairSchema = z.object({
  key: z.string(),
  a: z.string(),
  b: z.string(),
  points: z.number().int().min(0),
  /** 0 to 100: how heated their contest or quarrel is. */
  tension: z.number().int().min(0).max(100),
  /** The highest relationship stage whose milestone scene has been queued. */
  stageSeen: z.number().int().min(0),
  memories: z.array(z.object({ tag: z.string(), text: z.string(), at: z.number().int(), used: z.number().int().min(0) })),
  /** Battles completed when a scene last featured the pair. */
  lastScene: z.number().int(),
});
export type Pair = z.infer<typeof PairSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  key: z.string(),
  caption: z.string(),
  uids: z.array(z.string()),
  lines: z.array(z.string()),
  choices: z.array(z.object({ label: z.string(), text: z.string() })),
  dflt: z.number().int(),
  /** Facts rolled once with the scene, so reloading never changes them. */
  gift: z.string().optional(),
  move: z.string().optional(),
  hidden: z.number().int().optional(),
  foe: z.string().optional(),
  milestone: z.string().optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const PartyLifeStateSchema = z.object({
  pairs: z.array(PairSchema),
  /** A grudge a Pokémon carries against a species (set by repeated or dramatic defeats; settled when it wins). */
  grudges: z.array(z.object({ uid: z.string(), species: z.string(), since: z.number().int(), settled: z.boolean() })),
  /** Times each Pokémon (uid|species) has fainted to a species. */
  lost: z.record(z.string(), z.number().int().min(0)),
  /** Revenge pacts: `uid` avenges `forUid` against `species` until battle number `until`. */
  pacts: z.array(z.object({ uid: z.string(), forUid: z.string(), species: z.string(), until: z.number().int() })),
  scrapbook: z.array(z.object({
    id: z.string(),
    n: z.number().int(),
    region: z.number().int(),
    stage: z.number().int(),
    kind: z.string(),
    caption: z.string(),
    uids: z.array(z.string()),
    delta: z.number().int(),
    poses: z.array(z.string()),
  })),
  recent: z.array(z.string()),
  scene: SceneSchema.nullable(),
  rolledFor: z.string(),
  /** Species and battle number when each party Pokémon was first seen (to notice newcomers and evolutions). */
  known: z.record(z.string(), z.object({ species: z.string(), joined: z.number().int() })),
  /** What happened since the last scene: the raw material for the next one. */
  ctx: z.object({
    faints: z.array(z.object({ uid: z.string(), foe: z.string() })),
    kos: z.record(z.string(), z.number().int().min(0)),
    fought: z.array(z.string()),
    close: z.array(z.string()),
    won: z.number().int().min(0),
    boss: z.boolean(),
    camp: z.boolean(),
    evolved: z.array(z.string()),
    newcomers: z.array(z.string()),
    settled: z.array(z.string()),
    ccBase: z.record(z.string(), z.number().int()),
    aidBase: z.record(z.string(), z.number().int()),
    milestones: z.array(z.string()),
  }),
  /** Victories each boxed Pokémon has sat out. */
  bench: z.record(z.string(), z.number().int().min(0)),
  /** The battle number of the last team photo. */
  photoAt: z.number().int(),
});
export type PartyLifeState = z.infer<typeof PartyLifeStateSchema>;

export function createPartyLife(): PartyLifeState {
  return {
    pairs: [], grudges: [], lost: {}, pacts: [], scrapbook: [], recent: [], scene: null, rolledFor: '', known: {},
    ctx: { faints: [], kos: {}, fought: [], close: [], won: 0, boss: false, camp: false, evolved: [], newcomers: [], settled: [], ccBase: {}, aidBase: {}, milestones: [] },
    bench: {}, photoAt: -1,
  };
}
