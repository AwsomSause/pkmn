// Keepsakes (design Part II-E): 20 cosmetic accessories, five slots, no stat effect. Unlocks live in the profile;
// any unlocked Keepsake can be worn. Pure rules: nothing here touches RNG or battle state.
// Earning: every rule is tracked ('live'). Run events leave marks in `run.itemCounters` under `ks:` (set by the battle,
// care, event and story hooks below; Story Runs only), and the profile rules read the profile at the end of a run.
// 'later' stays in the type for a rule whose event is not tracked; the Keepsakes screen says so.

import { typeEffectiveness } from '../battle/damage';
import type { Content } from '../contentSchema';
import { personalityOfMon } from '../overhaul/personality';
import type { Profile, RunState } from '../state';
import { temperamentOf, type TemperamentId } from './temperament';

export const KEEPSAKE_SLOTS = ['head', 'face', 'neck', 'back', 'chest'] as const;
export type KeepsakeSlot = (typeof KEEPSAKE_SLOTS)[number];

export interface KeepsakeDef { id: string; name: string; slot: KeepsakeSlot; rule: string; status: 'live' | 'later' }

export const KEEPSAKES: readonly KeepsakeDef[] = [
  { id: 'kp_bandana', name: 'Bandana', slot: 'head', rule: 'Win 3 Gym fights in one run with the Starter in the fight', status: 'live' },
  { id: 'kp_bell_collar', name: 'Bell Collar', slot: 'neck', rule: 'Reach Heartbond latch 3 with a Playful or Mischievous Starter', status: 'live' },
  { id: 'kp_bowtie', name: 'Bowtie', slot: 'neck', rule: 'Beat a Gym Leader with no faints', status: 'live' },
  { id: 'kp_cape', name: 'Cape', slot: 'back', rule: 'Beat the Primary Rival in the last region with the Starter in the fight', status: 'live' },
  { id: 'kp_charm_necklace', name: 'Charm Necklace', slot: 'neck', rule: 'Reach Heartbond latch 5 with any Starter', status: 'live' },
  { id: 'kp_feather', name: 'Feather', slot: 'head', rule: 'Unlock any regional bird line in the Archive', status: 'live' },
  { id: 'kp_flower_crown', name: 'Flower Crown', slot: 'head', rule: 'Finish a Nature care event (a garden, bloom or calm-rain stop)', status: 'live' },
  { id: 'kp_flower_pin', name: 'Flower Pin', slot: 'chest', rule: 'Give 5 loved snacks in one run', status: 'live' },
  { id: 'kp_glasses', name: 'Glasses', slot: 'face', rule: 'Finish a Discovery stop that needs a clue, with an Intelligent Starter', status: 'live' },
  { id: 'kp_goggles', name: 'Goggles', slot: 'face', rule: 'Get through a storm or weather event (Weather & Hazards, or a rain or snow scene)', status: 'live' },
  { id: 'kp_headband', name: 'Headband', slot: 'head', rule: 'Win a fight at a type disadvantage', status: 'live' },
  { id: 'kp_leaf_crown', name: 'Leaf Crown', slot: 'head', rule: 'Reach Familiar Friend on any Grass-type line', status: 'live' },
  { id: 'kp_medal', name: 'Medal', slot: 'chest', rule: 'Win the League with any Starter', status: 'live' },
  { id: 'kp_monocle', name: 'Monocle', slot: 'face', rule: 'Find 10 Lore Archive entries across runs', status: 'live' },
  { id: 'kp_party_hat', name: 'Party Hat', slot: 'head', rule: 'Finish your first Story Run (the Tuftin egg in the lab hatches)', status: 'live' },
  { id: 'kp_ribbon_bow', name: 'Ribbon Bow', slot: 'head', rule: 'Reach Heartbond latch 6 with an Affectionate or Playful Starter', status: 'live' },
  { id: 'kp_satchel', name: 'Satchel', slot: 'back', rule: 'Receive "The Gift" beat from a Starter (finish a Starter or quest arc on its good path)', status: 'live' },
  { id: 'kp_scarf', name: 'Scarf', slot: 'neck', rule: 'Finish a snow route event (an event with a snow scene)', status: 'live' },
  { id: 'kp_star_pin', name: 'Star Pin', slot: 'chest', rule: 'Reach Trusted Partner (Heartbond latch 7) with any line', status: 'live' },
  { id: 'kp_tiny_hat', name: 'Tiny Hat', slot: 'head', rule: 'Earn a Keystone Memory', status: 'live' },
];
const BY_ID: ReadonlyMap<string, KeepsakeDef> = new Map(KEEPSAKES.map((k) => [k.id, k]));
export const keepsakeDef = (id: string): KeepsakeDef | undefined => BY_ID.get(id);

const SLOT_MAX: Record<KeepsakeSlot, number> = { head: 8, face: 3, neck: 4, back: 2, chest: 3 };
export const slotCounts = (): Record<KeepsakeSlot, number> => Object.fromEntries(KEEPSAKE_SLOTS.map((s) => [s, KEEPSAKES.filter((k) => k.slot === s).length])) as Record<KeepsakeSlot, number>;
export const SLOT_TOTALS = SLOT_MAX;

// ---------- run marks (Story Runs only) ----------

/** What a run can mark; each is a counter `ks:<mark>` in `run.itemCounters`. */
export type KeepsakeMark = 'gym_starter' | 'gym_clean' | 'rival_final' | 'league_win' | 'disadvantage_win' | 'snack_loved' | 'weather' | 'snow' | 'nature' | 'clue_smart' | 'gift';
const KS = 'ks:';
/** The battle (encountersCompleted + 1) in which a player Pokémon last fainted. */
const FAINT_AT = 'ks-faint-at';

export const keepsakeMark = (run: Pick<RunState, 'itemCounters'>, mark: KeepsakeMark): number => run.itemCounters?.[KS + mark] ?? 0;

/** Adds to a run mark. Classic runs (no `story.v2`) are left untouched. */
export function markKeepsake(run: RunState, mark: KeepsakeMark, add = 1): void {
  if (!run.story.v2) return;
  run.itemCounters = { ...run.itemCounters, [KS + mark]: keepsakeMark(run, mark) + add };
}

/** A player Pokémon fainted in the current battle (for "no faints" Gym wins). */
export function noteKeepsakeFaint(run: RunState): void {
  if (!run.story.v2) return;
  run.itemCounters = { ...run.itemCounters, [FAINT_AT]: run.encountersCompleted + 1 };
}

export interface KeepsakeWin {
  /** The beaten trainer's class id (gym-leader, elite-four, champion...), if any. */
  trainerClass?: string | undefined;
  /** The Starter (Heartbond partner) took part in this battle. */
  partnerFought: boolean;
  /** Beat the Primary (journey-defining) Rival in the run's last region. */
  finalRival: boolean;
  /** The Pokémon on the field at the end was at a type disadvantage against the last foe. */
  disadvantage: boolean;
}

/** True when `mon` is at a type disadvantage against `foe`: one of the foe's types hits it super-effectively and none of its own types hit the foe super-effectively. */
export function atTypeDisadvantage(content: Pick<Content, 'typeChart' | 'species'>, mon: { speciesId: string } | undefined, foe: { speciesId: string } | undefined): boolean {
  const mine = mon ? content.species.get(mon.speciesId)?.types : undefined;
  const theirs = foe ? content.species.get(foe.speciesId)?.types : undefined;
  if (!mine?.length || !theirs?.length) return false;
  const hurt = Math.max(...theirs.map((t) => typeEffectiveness(content.typeChart, t, mine)));
  const hit = Math.max(...mine.map((t) => typeEffectiveness(content.typeChart, t, theirs)));
  return hurt > 1 && hit <= 1;
}

/** Marks a won battle. Called once per win (the battle hook in core/run.ts). */
export function keepsakeVictory(run: RunState, win: KeepsakeWin): void {
  if (!run.story.v2) return;
  if (win.trainerClass === 'gym-leader') {
    if (win.partnerFought) markKeepsake(run, 'gym_starter');
    if ((run.itemCounters?.[FAINT_AT] ?? 0) !== run.encountersCompleted + 1) markKeepsake(run, 'gym_clean');
  }
  if (win.finalRival && win.partnerFought) markKeepsake(run, 'rival_final');
  if (win.trainerClass === 'champion') markKeepsake(run, 'league_win');
  if (win.disadvantage) markKeepsake(run, 'disadvantage_win');
}

/** Garden, bloom and calm-rain stops count as Nature care events (design Part II-E: "Midnight Bloom or a rain-calm event"). */
export const NATURE_EVENTS: readonly string[] = ['flower-garden', 'flower-field-rest', 'cherry-blossom', 'spring-bloom-guardian', 'neighbors-garden', 'rain-dance-ritual', 'wx-rainbow-after-rain', 'wx-blossom-storm', 'wx-pollen-season', 'wx-bioluminescent-bay', 'wx-aurora-night'];

/** Marks a finished map event: weather (Weather & Hazards, or a rain/snow scene), snow (a snow scene), nature (the list above). */
export function keepsakeEvent(run: RunState, event: { id: string; group?: string | undefined; scene?: { effect?: string | undefined } | undefined }): void {
  if (!run.story.v2) return;
  const fx = event.scene?.effect;
  if (event.group === 'Weather & Hazards' || fx === 'rain' || fx === 'snow') markKeepsake(run, 'weather');
  if (fx === 'snow') markKeepsake(run, 'snow');
  if (NATURE_EVENTS.includes(event.id)) markKeepsake(run, 'nature');
}

/** The nine regional bird lines (design Part II-D roster). */
export const BIRD_LINES: readonly string[] = ['rm_pidgey', 'rm_hoothoot', 'rm_taillow', 'rm_starly', 'rm_pidove', 'rm_fletchling', 'rm_pikipek', 'rm_rookidee', 'rm_wattrel'];

/** What the profile rules need: Archive lines (state, Mastery tier), Lore found, Keepsakes already owned. */
export interface KeepsakeProfileView {
  remembrance: Record<string, { state: string; mastery: number }>;
  lore: Record<string, unknown>;
  /** Grass-type Remembrance line ids (from the story data). */
  grassLines: readonly string[];
}

/** Keepsakes this run has earned, in catalog order. Needs a Story Run with a Heartbond partner; `profile` adds the profile rules (end of run). */
export function keepsakesEarned(run: RunState, profile?: KeepsakeProfileView): string[] {
  const v2 = run.story.v2;
  const uid = v2?.heartbond.partner;
  const mon = uid ? run.party.find((m) => m.uid === uid) : undefined;
  if (!v2 || !uid) return [];
  const latched = v2.heartbond.latched;
  const tm: TemperamentId | undefined = mon ? temperamentOf(personalityOfMon(mon).id) : undefined;
  const has = (m: KeepsakeMark, n = 1): boolean => keepsakeMark(run, m) >= n;
  const out: string[] = [];
  if (latched.includes(3) && (tm === 'tm_playful' || tm === 'tm_mischievous')) out.push('kp_bell_collar');
  if (latched.includes(5)) out.push('kp_charm_necklace');
  if (latched.includes(6) && (tm === 'tm_affectionate' || tm === 'tm_playful')) out.push('kp_ribbon_bow');
  if (latched.includes(7)) out.push('kp_star_pin');
  if (v2.feats.gains.includes('keystone')) out.push('kp_tiny_hat');
  if (has('gym_starter', 3)) out.push('kp_bandana');
  if (has('gym_clean')) out.push('kp_bowtie');
  if (has('rival_final')) out.push('kp_cape');
  if (has('nature')) out.push('kp_flower_crown');
  if (has('snack_loved', 5)) out.push('kp_flower_pin');
  if (has('clue_smart')) out.push('kp_glasses');
  if (has('weather')) out.push('kp_goggles');
  if (has('disadvantage_win')) out.push('kp_headband');
  if (has('league_win')) out.push('kp_medal');
  if (has('gift')) out.push('kp_satchel');
  if (has('snow')) out.push('kp_scarf');
  if (profile) {
    const unlocked = (id: string): boolean => profile.remembrance[id]?.state === 'unlocked';
    if (BIRD_LINES.some(unlocked)) out.push('kp_feather');
    if (profile.grassLines.some((id) => unlocked(id) && (profile.remembrance[id]?.mastery ?? 0) >= 1)) out.push('kp_leaf_crown');
    if (Object.keys(profile.lore).length >= 10) out.push('kp_monocle');
    // The Tuftin egg in Vance's lab hatches when the first Story Run ends (any result).
    out.push('kp_party_hat');
  }
  return KEEPSAKES.filter((k) => out.includes(k.id)).map((k) => k.id);
}

/** Adds this run's new Keepsakes to the profile. Called with the Chronicle, after the run's Archive and Lore are folded. Returns the new ids. */
export function foldKeepsakes(profile: Profile, run: RunState, grassLines: readonly string[] = []): string[] {
  const have = new Set(profile.story.keepsakes);
  const fresh = keepsakesEarned(run, { remembrance: profile.story.remembrance, lore: profile.story.lore, grassLines }).filter((id) => !have.has(id));
  if (fresh.length) profile.story.keepsakes = [...profile.story.keepsakes, ...fresh];
  return fresh;
}

/** Wears an unlocked Keepsake in its slot (replacing what was there); null takes the slot's item off. False if locked or unknown. */
export function wearKeepsake(profile: Profile, slot: KeepsakeSlot, id: string | null): boolean {
  if (id === null) { delete profile.story.worn[slot]; return true; }
  const def = BY_ID.get(id);
  if (!def || def.slot !== slot || !profile.story.keepsakes.includes(id)) return false;
  profile.story.worn[slot] = id;
  return true;
}

/**
 * Remembrance Mastery (design Part II-D): the run's Starter line is unlocked in the Archive, its run count goes up,
 * and its tier rises to Familiar Friend (1, any run finished with it), Trusted Partner (2, Heartbond latch 7) or
 * Mastered (3, latch 10 and a Keystone). Tiers never fall.
 */
export function foldStarterMastery(profile: Profile, run: RunState): void {
  const v2 = run.story.v2;
  const line = v2?.starter?.lineId;
  if (!v2 || !line) return;
  const latched = v2.heartbond.latched;
  const tier = latched.includes(10) && v2.feats.gains.includes('keystone') ? 3 : latched.includes(7) ? 2 : 1;
  const prev = profile.story.remembrance[line];
  profile.story.remembrance[line] = { state: 'unlocked', firstSeenRun: prev?.firstSeenRun ?? null, runs: (prev?.runs ?? 0) + 1, mastery: Math.max(prev?.mastery ?? 0, tier) };
}
