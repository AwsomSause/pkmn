// Data for the Trainer Plaza (APPROVED.md §11): plaza.json.

import { z } from 'zod';
import json from '../../data/plaza.json';
import { EventEffectSchema, TradeWantSchema, TypeNameSchema } from '../contentSchema';

const Effects = z.array(EventEffectSchema).default([]);

/** What a trade post, errand or notice asks for. `have` only checks; `mon` and `item` hand it over. */
export const PlazaNeedSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('have'), want: TradeWantSchema }),
  z.object({ kind: z.literal('mon'), want: TradeWantSchema }),
  z.object({ kind: z.literal('item'), id: z.string(), count: z.number().int().positive().default(1) }),
  z.object({ kind: z.literal('badges'), n: z.number().int().min(1) }),
  /** Proof of work done: the counter must grow by `n` after the errand is taken (for a board notice: reach `n` in all). */
  z.object({ kind: z.literal('counter'), counter: z.string(), n: z.number().int().positive(), label: z.string() }),
]);
export type PlazaNeed = z.infer<typeof PlazaNeedSchema>;

export const RegularSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  goal: z.string(),
  /** What they say once you know them this well (friendship 0, 2, 5). */
  lines: z.array(z.object({ at: z.number().int().min(0), text: z.string() })).min(1),
  /** Friendship at which their stall sells to you at this fraction of the price. */
  perk: z.object({ at: z.number().int().min(1), discount: z.number().min(0).max(0.5), text: z.string() }).optional(),
  /** Types of Pokémon that make them smile (the party reacts too). */
  likes: z.array(TypeNameSchema).default([]),
});

export const StallSchema = z.object({
  id: z.string(),
  name: z.string(),
  keeper: z.string(),
  blurb: z.string(),
  /** Catalog families this stall draws from (or the item category "ball"). */
  families: z.array(z.string()).min(1),
  minRep: z.number().int().min(0).default(0),
  markup: z.number().min(0.5).default(1.3),
  /** How many items it shows. */
  size: z.number().int().min(1).default(3),
});

export const OddityDefSchema = z.object({
  item: z.string(),
  hint: z.string(),
  price: z.number().int().positive(),
  minBadges: z.number().int().min(0).default(0),
});

export const TraderSchema = z.object({
  id: z.string(),
  name: z.string(),
  line: z.string(),
  want: TradeWantSchema,
  give: z.object({ label: z.string(), species: z.array(z.string()).default([]), types: z.array(TypeNameSchema).default([]), levelBonus: z.number().int().default(0) }),
  minRep: z.number().int().min(0).default(0),
  minBadges: z.number().int().min(0).default(0),
});

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  need: PlazaNeedSchema,
  effects: Effects,
  rewardText: z.string(),
  rep: z.number().int().default(1),
  minBadges: z.number().int().min(0).default(0),
});

export const ErrandSchema = PostSchema.extend({
  giver: z.string(),
  /** Flag set when the errand is done (unlocks things: "alley", "trade:<id>", "discount:<regular>"). */
  unlocks: z.string().optional(),
  friendship: z.number().int().default(2),
});

export const ClubFormatSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  fee: z.number().int().min(0),
  rounds: z.number().int().min(1).max(5),
  size: z.number().int().min(1).max(6),
  levelBonus: z.number().int(),
  themed: z.boolean().default(false),
  boss: z.boolean().default(false),
  minRep: z.number().int().min(0).default(0),
  minBadges: z.number().int().min(0).default(0),
  roundPrize: Effects,
  prize: Effects,
  prizeText: z.string(),
  rep: z.number().int().default(1),
});

export const AlleyOfferSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  cost: z.number().int().min(0),
  effects: Effects,
  /** Chance it goes wrong; `trouble` then applies instead. */
  risk: z.number().min(0).max(1).default(0),
  trouble: Effects,
  troubleText: z.string().default(''),
  /** Goodness drops when you deal in it. */
  evil: z.number().int().default(0),
  minRep: z.number().int().min(0).default(0),
});

export const ServiceSchema = z.object({
  id: z.enum(['heal', 'groom', 'appraise', 'advice']),
  name: z.string(),
  keeper: z.string(),
  text: z.string(),
  cost: z.number().int().min(0),
  /** Times it can be used per plaza (the plaza must not replace the heal stops). */
  limit: z.number().int().min(1),
  minRep: z.number().int().min(0).default(0),
});

export const EventDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  weight: z.number().min(0),
  minBadges: z.number().int().min(0).default(0),
  /** Stall prices are multiplied by this. */
  priceScale: z.number().min(0).default(1),
  /** Battle Club fees are multiplied by this and prizes pay this many extra copies of their money effects. */
  clubFee: z.number().min(0).default(1),
  /** Plaza services cost this much of the usual (an emergency makes them free). */
  serviceScale: z.number().min(0).default(1),
  /** Stalls, traders and the board close (an evacuation); only a handout remains. */
  closed: z.boolean().default(false),
  /** Free gift for everyone who comes (festival, evacuation relief). */
  gift: Effects,
  giftText: z.string().default(''),
  /** Extra reputation for every deed. */
  repBonus: z.number().int().default(0),
});

export const CaravanSchema = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  minBadges: z.number().int().min(0).default(0),
  offers: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), cost: z.number().int().min(0), effects: Effects, need: PlazaNeedSchema.optional() })).min(1),
  /** Setting the flag opens a follow-up errand on the next plaza ("caravan:<id>"). */
  followUp: z.string().optional(),
});

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  rep: z.string(),
  text: z.string(),
  offers: z.array(z.object({ id: z.string(), title: z.string(), text: z.string(), cost: z.number().int().min(0), effects: Effects, good: z.number().int().default(0), minRep: z.number().int().min(0).default(0) })).min(1),
  /** The faction this one dislikes (their stalls never share a plaza). */
  rival: z.string().optional(),
});

export const RumorSchema = z.object({
  id: z.string(),
  text: z.string(),
  /** firsthand = true; secondhand = true but vague; hearsay = may be out of date. */
  source: z.enum(['firsthand', 'secondhand', 'hearsay']),
  minBadges: z.number().int().min(0).default(0),
});

export const ReactionSchema = z.object({
  /** A party Pokémon of this type, or this species. */
  type: TypeNameSchema.optional(),
  species: z.string().optional(),
  /** The visitor it reacts to: a regular id, "rival", "foe" or "alley". */
  at: z.string(),
  text: z.string(),
});

export const PlazaSchema = z.object({
  note: z.string(),
  balance: z.object({
    regionScale: z.number().min(0),
    rarityPrice: z.object({ common: z.number(), uncommon: z.number(), rare: z.number(), epic: z.number() }),
    ballPrice: z.number(),
    stallsOpen: z.number().int().min(1),
    repTitles: z.array(z.object({ at: z.number().int().min(0), title: z.string() })).min(1),
    alleyRep: z.number().int().min(1),
    alleyEvil: z.number().int(),
    caravanChance: z.number().min(0).max(1),
    eventChance: z.number().min(0).max(1),
    rivalChance: z.number().min(0).max(1),
    foeChance: z.number().min(0).max(1),
    traderCount: z.number().int().min(1),
    postCount: z.number().int().min(1),
    errandSlots: z.number().int().min(1),
    scoutCost: z.number(),
    routeTipCost: z.number(),
    oddityShow: z.number().int().min(1),
    alleyShow: z.number().int().min(1),
    repCap: z.number().int().min(1),
  }),
  regulars: z.array(RegularSchema).min(1),
  stalls: z.array(StallSchema).min(1),
  oddities: z.object({ keeper: z.string(), items: z.array(OddityDefSchema).min(1) }),
  traders: z.array(TraderSchema).min(1),
  posts: z.array(PostSchema).min(1),
  errands: z.array(ErrandSchema).min(1),
  club: z.array(ClubFormatSchema).min(1),
  alley: z.object({ keeper: z.string(), entry: z.string(), offers: z.array(AlleyOfferSchema).min(1) }),
  services: z.array(ServiceSchema).min(1),
  events: z.array(EventDefSchema).min(1),
  caravans: z.array(CaravanSchema).min(1),
  factions: z.array(FactionSchema).min(1),
  rumors: z.array(RumorSchema).min(1),
  reactions: z.array(ReactionSchema).min(1),
  gatherings: z.object({ early: z.array(z.string()).min(1), preBoss: z.array(z.string()).min(1), postBadge: z.array(z.string()).min(1), late: z.array(z.string()).min(1) }),
});
export type PlazaData = z.infer<typeof PlazaSchema>;
export const PLAZA = PlazaSchema.parse(json);
