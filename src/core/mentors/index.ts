// Mentors and apprentices (spec section 15). The player trains under a mentor chosen on the Preparation Desk.
// A mentor has an identity, lessons that unlock with trust, a mission, events, and a fellow apprentice who is
// both a rival and a mirror. Trust and loyalty grow over a run; graduation and lessons carry across runs.
// Nothing here draws from a gameplay stream: every roll comes from a seed-derived generator of its own.

import { z } from 'zod';
import mentorsJson from '../../data/mentors.json';
import { ArchetypeModifierSchema, TYPE_NAMES, TypeNameSchema } from '../contentSchema';
import type { Content, EventCondition, EventEffect } from '../contentSchema';
import { addItem } from '../items';
import { hashSeed, Rng } from '../rng';
import type { Apprentice, MentorBond, MentorRun, Profile, RunState } from '../state';
import { emit } from '../story/record';

export const MENTOR_CATEGORIES = [
  'battle-specialist', 'breeder', 'researcher', 'explorer', 'coordinator', 'former-champion',
  'rival-trainer', 'gym-leader', 'elite-four', 'legend-researcher', 'item-specialist', 'evolution-specialist',
] as const;
export const CATEGORY_NAMES: Record<(typeof MENTOR_CATEGORIES)[number], string> = {
  'battle-specialist': 'Battle specialist',
  breeder: 'Breeder',
  researcher: 'Researcher',
  explorer: 'Explorer',
  coordinator: 'Coordinator',
  'former-champion': 'Former Champion',
  'rival-trainer': 'Rival trainer',
  'gym-leader': 'Gym Leader',
  'elite-four': 'Elite Four member',
  'legend-researcher': 'Legendary Pokémon researcher',
  'item-specialist': 'Item specialist',
  'evolution-specialist': 'Evolution specialist',
};

const LessonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  text: z.string().min(1),
  /** Mentor trust needed to learn it (0 = from the start). */
  trust: z.number().int().min(0).max(100),
  /** "graduated": only after you graduated under this mentor in an earlier run. */
  needs: z.literal('graduated').optional(),
  effects: z.array(ArchetypeModifierSchema).default([]),
  items: z.array(z.object({ id: z.string(), count: z.number().int().positive() })).default([]),
  money: z.number().int().min(0).default(0),
});
export type MentorLesson = z.infer<typeof LessonSchema>;

const UnlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('runs'), atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('wins'), atLeast: z.number().int().positive() }),
  z.object({ kind: z.literal('trust'), mentor: z.string(), atLeast: z.number().int().positive() }),
]);

const MentorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(MENTOR_CATEGORIES),
  title: z.string(),
  background: z.string(),
  personality: z.string(),
  specialty: z.string(),
  strength: z.string(),
  weakness: z.string(),
  leans: z.array(TypeNameSchema),
  unlock: UnlockSchema,
  unlockText: z.string(),
  teaching: z.string(),
  lessons: z.array(LessonSchema).min(4),
  lines: z.object({ greet: z.string(), praise: z.string(), scold: z.string(), disagree: z.string(), graduate: z.string() }),
  mission: z.object({
    name: z.string(),
    text: z.string(),
    bosses: z.number().int().positive(),
    trust: z.number().int().positive(),
    reward: z.object({ item: z.string(), count: z.number().int().positive() }),
  }),
  graduation: z.object({ title: z.string(), text: z.string() }),
});
export type Mentor = z.infer<typeof MentorSchema>;

const FileSchema = z.object({
  note: z.string(),
  config: z.object({
    trustMax: z.number().int().positive(),
    loyaltyMax: z.number().int().positive(),
    startLoyalty: z.number().int().min(0),
    trustPerBadge: z.number().int().min(0),
    loyaltyPerBadge: z.number().int().min(0),
    trustFirstWin: z.number().int().min(0),
    carryOverShare: z.number().min(0).max(1),
    carryOverCap: z.number().int().min(0),
    graduationTrust: z.number().int().min(1),
    devotedLoyalty: z.number().int().min(0),
    missionCap: z.number().int().min(0),
    maxLegacyApprentices: z.number().int().min(1),
    tiers: z.array(z.object({ id: z.string(), name: z.string(), min: z.number().int().min(0) })).min(2),
  }),
  apprentices: z.object({
    names: z.array(z.string()).min(4),
    personalities: z.array(z.object({ id: z.string(), text: z.string() })).min(4),
    strengths: z.array(z.string()).min(4),
    weaknesses: z.array(z.string()).min(4),
    interests: z.array(z.string()).min(4),
    learning: z.array(z.object({ id: z.enum(['slow', 'steady', 'fast']), pace: z.number().int().positive() })).length(3),
  }),
  mentors: z.array(MentorSchema).min(1),
});
export const MENTOR_DATA = FileSchema.parse(mentorsJson);
export const MENTORS: readonly Mentor[] = MENTOR_DATA.mentors;
const CFG = MENTOR_DATA.config;

export function getMentor(id: string | null | undefined): Mentor | undefined {
  return id ? MENTORS.find((m) => m.id === id) : undefined;
}
export const categoryName = (m: Mentor) => CATEGORY_NAMES[m.category];

/** Mentor problems for the content gate: unknown item ids or unlock references. */
export function mentorProblems(content: Content): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const m of MENTORS) {
    if (ids.has(m.id)) problems.push(`mentors.json: duplicate mentor "${m.id}"`);
    ids.add(m.id);
  }
  for (const m of MENTORS) {
    if (m.unlock.kind === 'trust' && !ids.has(m.unlock.mentor)) problems.push(`mentors.json: "${m.id}" unlocks through unknown mentor "${m.unlock.mentor}"`);
    const items = [...m.lessons.flatMap((l) => l.items.map((i) => i.id)), m.mission.reward.item];
    for (const id of items) if (!content.items.has(id) && !content.catalog.has(id)) problems.push(`mentors.json: "${m.id}" gives unknown item "${id}"`);
    if (new Set(m.lessons.map((l) => l.id)).size !== m.lessons.length) problems.push(`mentors.json: "${m.id}" repeats a lesson id`);
  }
  const lessonIds = new Set(MENTORS.flatMap((m) => m.lessons.map((l) => l.id)));
  for (const ev of content.events.values()) {
    const conds = [...ev.requires, ...ev.choices.flatMap((c) => c.requires)];
    for (const c of conds) {
      if (c.kind !== 'mentor') continue;
      if (c.id !== undefined && !ids.has(c.id)) problems.push(`events.json "${ev.id}" names unknown mentor "${c.id}"`);
      if (c.lesson !== undefined && !lessonIds.has(c.lesson)) problems.push(`events.json "${ev.id}" names unknown lesson "${c.lesson}"`);
      if (c.category !== undefined && !(MENTOR_CATEGORIES as readonly string[]).includes(c.category)) problems.push(`events.json "${ev.id}" names unknown mentor category "${c.category}"`);
    }
  }
  return problems;
}

// ---------- unlocking and the persistent bond ----------

export function bondOf(profile: Pick<Profile, 'mentorBonds'>, id: string): MentorBond {
  return profile.mentorBonds?.[id] ?? { trust: 0, runs: 0, graduated: 0, devoted: 0, bestTier: CFG.tiers[0]!.id, lessons: [], apprentices: [] };
}

export function mentorUnlocked(m: Mentor, profile: Pick<Profile, 'mentorBonds' | 'counters'>): boolean {
  const u = m.unlock;
  switch (u.kind) {
    case 'default':
      return true;
    case 'runs':
      return (profile.counters?.runsFinished ?? 0) >= u.atLeast;
    case 'wins':
      return (profile.counters?.runsWon ?? 0) >= u.atLeast;
    case 'trust':
      return bondOf(profile, u.mentor).trust >= u.atLeast;
  }
}

export const availableMentors = (profile: Pick<Profile, 'mentorBonds' | 'counters'>): Mentor[] => MENTORS.filter((m) => mentorUnlocked(m, profile));

// ---------- tiers ----------

export function tierFor(trust: number): { id: string; name: string } {
  let tier = CFG.tiers[0]!;
  for (const t of CFG.tiers) if (trust >= t.min) tier = t;
  return tier;
}
export const tierName = (id: string) => CFG.tiers.find((t) => t.id === id)?.name ?? id;
const tierRank = (id: string) => Math.max(0, CFG.tiers.findIndex((t) => t.id === id));

// ---------- the fellow apprentice ----------

export function makeFellow(seed: string, mentor: Mentor, bond: MentorBond): Apprentice {
  const rng = new Rng(hashSeed(`${seed}::mentor-fellow::${mentor.id}`));
  const pool = MENTOR_DATA.apprentices;
  // A graduate of an earlier run may come back as a veteran (legacy apprentice): the same character, a little further along.
  if (bond.graduated > 0 && bond.apprentices.length > 0 && rng.chance(0.5)) {
    const old = rng.pick(bond.apprentices);
    return { ...old, potential: Math.min(5, old.potential + 1), progress: Math.max(old.progress, 4), veteran: true };
  }
  const types = new Set<string>();
  if (mentor.leans.length > 0) types.add(rng.pick(mentor.leans));
  while (types.size < 2) types.add(rng.pick([...TYPE_NAMES]));
  return {
    name: rng.pick(pool.names),
    potential: rng.int(1, 5),
    personality: rng.pick(pool.personalities).id,
    strength: rng.pick(pool.strengths),
    weakness: rng.pick(pool.weaknesses),
    types: [...types] as Apprentice['types'],
    learning: rng.pick(pool.learning).id,
    interest: rng.pick(pool.interests),
    progress: 0,
    veteran: false,
  };
}
export const personalityText = (id: string) => MENTOR_DATA.apprentices.personalities.find((p) => p.id === id)?.text ?? id;
const paceOf = (a: Apprentice) => MENTOR_DATA.apprentices.learning.find((l) => l.id === a.learning)?.pace ?? 2;
/** How far along the fellow apprentice is, on the same scale as trust. */
export const fellowScore = (a: Apprentice) => a.potential * 4 + a.progress * 2 + (a.veteran ? 10 : 0);

// ---------- starting a mentorship ----------

export function startMentorship(seed: string, mentorId: string | null, bond: MentorBond): MentorRun | null {
  const mentor = getMentor(mentorId);
  if (!mentor) return null;
  const trust = Math.min(CFG.carryOverCap, Math.floor(bond.trust * CFG.carryOverShare));
  return {
    id: mentor.id,
    trust,
    loyalty: CFG.startLoyalty,
    rivalry: 0,
    lessons: [],
    tier: tierFor(trust).id,
    mission: { state: 'none', bossesLeft: 0 },
    fellow: makeFellow(seed, mentor, bond),
    disagreements: 0,
    priorGraduations: bond.graduated,
    ending: null,
    log: [`${mentor.name} takes you on. "${mentor.lines.greet}"`],
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const note = (m: MentorRun, line: string) => {
  m.log = [...m.log, line].slice(-12);
};

/**
 * Learns every lesson the trust now allows (each applies once: its id is kept in the run). Returns the new lessons' names.
 * At the start of a run (`announce` false) nothing is written to the story.
 */
export function applyLessons(content: Content, run: RunState, announce = true): string[] {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return [];
  const learned: string[] = [];
  for (const l of mentor.lessons) {
    if (m.lessons.includes(l.id) || l.trust > m.trust) continue;
    if (l.needs === 'graduated' && m.priorGraduations < 1) continue;
    m.lessons.push(l.id);
    run.perkEffects = [...run.perkEffects, ...l.effects];
    for (const it of l.items) addItem(run.inventory, it.id, it.count);
    run.money += l.money;
    learned.push(l.name);
    note(m, `${mentor.name} taught you ${l.name}: "${l.text}"`);
    if (announce) emit(content, run, 'storyMoment', { actors: [], data: { def: 'mentor-lesson', suppressed: false }, importance: 55, text: `${mentor.name} taught: ${l.name}` });
  }
  return learned;
}

function tierUp(content: Content, run: RunState, m: MentorRun, mentor: Mentor): string {
  const next = tierFor(m.trust);
  if (tierRank(next.id) <= tierRank(m.tier)) return '';
  m.tier = next.id;
  note(m, `${mentor.name} now sees you as a ${next.name}.`);
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'mentor-tier', suppressed: false }, importance: 70, text: `${mentor.name} counts you a ${next.name} now` });
  return `${mentor.name} counts you a ${next.name}`;
}

export interface MentorChange {
  trust?: number;
  loyalty?: number;
  rivalry?: number;
}

/** Moves trust, loyalty and rivalry (clamped), then learns new lessons and advances the tier. Returns a short description. */
export function changeMentor(content: Content, run: RunState, change: MentorChange): string {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return '';
  const parts: string[] = [];
  if (change.trust) {
    m.trust = clamp(m.trust + change.trust, 0, CFG.trustMax);
    parts.push(`${mentor.name}'s trust ${change.trust > 0 ? '+' : ''}${change.trust}`);
  }
  if (change.loyalty) {
    m.loyalty = clamp(m.loyalty + change.loyalty, 0, CFG.loyaltyMax);
    parts.push(`loyalty ${change.loyalty > 0 ? '+' : ''}${change.loyalty}`);
  }
  if (change.rivalry) {
    m.rivalry = clamp(m.rivalry + change.rivalry, -10, 10);
    parts.push(`${m.fellow.name} ${change.rivalry > 0 ? 'falls behind' : 'pulls ahead'}`);
  }
  const up = tierUp(content, run, m, mentor);
  const lessons = applyLessons(content, run);
  if (up) parts.push(up);
  for (const l of lessons) parts.push(`learned ${l}`);
  return parts.join('; ');
}

/** A gym badge was won: trust and loyalty grow, the fellow apprentice learns too, and the mission may finish. */
export function mentorBadgeWon(content: Content, run: RunState): void {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return;
  m.fellow = { ...m.fellow, progress: m.fellow.progress + paceOf(m.fellow) };
  const ahead = m.trust + CFG.trustPerBadge >= fellowScore(m.fellow);
  let trust = CFG.trustPerBadge;
  if (m.mission.state === 'active') {
    m.mission = { ...m.mission, bossesLeft: Math.max(0, m.mission.bossesLeft - 1) };
    if (m.mission.bossesLeft === 0) {
      m.mission = { state: 'done', bossesLeft: 0 };
      trust += mentor.mission.trust;
      addItem(run.inventory, mentor.mission.reward.item, mentor.mission.reward.count);
      note(m, `${mentor.mission.name} complete. "${mentor.lines.praise}"`);
      emit(content, run, 'storyMoment', { actors: [], data: { def: 'mentor-mission', suppressed: false }, importance: 75, text: `Finished ${mentor.mission.name} for ${mentor.name}` });
    }
  }
  changeMentor(content, run, { trust, loyalty: CFG.loyaltyPerBadge, rivalry: ahead ? 1 : -1 });
}

/** The mentor's mission starts (once). */
function startMission(run: RunState, mentor: Mentor): string {
  const m = run.mentor!;
  if (m.mission.state !== 'none') return '';
  m.mission = { state: 'active', bossesLeft: mentor.mission.bosses };
  note(m, `${mentor.name} set you ${mentor.mission.name}: ${mentor.mission.text}`);
  return `${mentor.mission.name}: ${mentor.mission.text}`;
}

// ---------- events ----------

export function mentorConditionMet(run: RunState, c: Extract<EventCondition, { kind: 'mentor' }>): boolean {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return false;
  if (c.id !== undefined && c.id !== m.id) return false;
  if (c.category !== undefined && c.category !== mentor.category) return false;
  if (c.trustAtLeast !== undefined && m.trust < c.trustAtLeast) return false;
  if (c.loyaltyAtLeast !== undefined && m.loyalty < c.loyaltyAtLeast) return false;
  if (c.lesson !== undefined && !m.lessons.includes(c.lesson)) return false;
  if (c.mission !== undefined && m.mission.state !== c.mission) return false;
  return true;
}

export function mentorConditionText(c: Extract<EventCondition, { kind: 'mentor' }>): string {
  const mentor = getMentor(c.id);
  const who = mentor ? mentor.name : c.category ? `a ${CATEGORY_NAMES[c.category as keyof typeof CATEGORY_NAMES] ?? c.category} mentor` : 'a mentor';
  if (c.trustAtLeast) return `Needs ${who} to trust you (${c.trustAtLeast}+)`;
  if (c.loyaltyAtLeast) return `Needs your loyalty to ${who} (${c.loyaltyAtLeast}+)`;
  if (c.lesson) return `Needs a lesson from ${who}`;
  if (c.mission === 'none') return `Needs ${who} to have no mission for you yet`;
  if (c.mission === 'active') return `Needs ${who}'s mission under way`;
  return `Needs ${who}`;
}

export function applyMentorEffect(content: Content, run: RunState, e: Extract<EventEffect, { kind: 'mentor' }>): string {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return '';
  const parts: string[] = [];
  if (e.disagree) {
    m.disagreements += 1;
    note(m, `You and ${mentor.name} disagreed. "${mentor.lines.disagree}"`);
  }
  if (e.mission === 'start') {
    const t = startMission(run, mentor);
    if (t) parts.push(t);
  }
  const change = changeMentor(content, run, { trust: e.trust, loyalty: e.loyalty, rivalry: e.rivalry });
  if (change) parts.push(change);
  return parts.join('; ');
}

/** The mentor event the stage always offers (a stream of its own; none without a mentor). */
export function mentorStopEvent(content: Content, run: RunState, open: ReadonlySet<string>): string | null {
  if (!run.mentor) return null;
  const mine = [...open].filter((id) => content.events.get(id)?.group === 'Mentors').sort();
  if (mine.length === 0) return null;
  // The mission offer comes first when it is on the table.
  const offer = mine.find((id) => id === 'mentor-mission-offer');
  if (offer) return offer;
  const rng = new Rng(hashSeed(`${run.seed}::mentor-stop::${run.regionIndex}:${run.stage?.index ?? 0}`));
  return rng.pick(mine);
}

// ---------- the end of the run ----------

/** How the mentorship ends: graduation needs trust; loyalty decides whether the pupil stays devoted or goes their own way. */
export function mentorEnding(run: RunState): 'devoted' | 'independent' | null {
  const m = run.mentor;
  if (!m || m.trust < CFG.graduationTrust) return null;
  return m.loyalty >= CFG.devotedLoyalty ? 'devoted' : 'independent';
}

/** Writes the run's mentorship into the profile (lasting trust, lessons, graduation, the fellow apprentice). Returns lines for the run summary. */
export function settleMentor(profile: Profile, run: RunState): string[] {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return [];
  profile.mentorBonds ??= {};
  const bond = structuredClone(bondOf(profile, mentor.id));
  const ending = mentorEnding(run);
  m.ending = ending;
  bond.trust = Math.max(bond.trust, m.trust);
  bond.runs += 1;
  if (ending) {
    bond.graduated += 1;
    if (ending === 'devoted') bond.devoted += 1;
    bond.apprentices = [...bond.apprentices, m.fellow].slice(-CFG.maxLegacyApprentices);
  }
  if (tierRank(m.tier) > tierRank(bond.bestTier)) bond.bestTier = m.tier;
  bond.lessons = [...new Set([...bond.lessons, ...m.lessons])];
  profile.mentorBonds[mentor.id] = bond;
  const lines = [`Mentor: ${mentor.name} (${tierName(m.tier)}, trust ${m.trust}, loyalty ${m.loyalty}); learned ${m.lessons.length} lesson${m.lessons.length === 1 ? '' : 's'}.`];
  if (ending) lines.push(`${mentor.graduation.title}: ${mentor.graduation.text}${ending === 'devoted' ? ' You stayed devoted.' : ' You went your own way.'}`);
  return lines;
}

// ---------- text for screens ----------

export function mentorSummaryLines(run: Pick<RunState, 'mentor'>): string[] {
  const m = run.mentor;
  const mentor = getMentor(m?.id);
  if (!m || !mentor) return [];
  const standing = m.rivalry > 0 ? 'you lead' : m.rivalry < 0 ? `${m.fellow.name} leads` : 'even';
  return [
    `${mentor.name}, ${mentor.title} (${categoryName(mentor)})`,
    `${tierName(m.tier)}: trust ${m.trust}/${CFG.trustMax}, loyalty ${m.loyalty}/${CFG.loyaltyMax}`,
    `Fellow apprentice ${m.fellow.name}${m.fellow.veteran ? ' (veteran)' : ''}: ${standing}`,
    m.mission.state === 'active' ? `Mission: ${mentor.mission.name}, ${m.mission.bossesLeft} badge${m.mission.bossesLeft === 1 ? '' : 's'} to go` : m.mission.state === 'done' ? `Mission done: ${mentor.mission.name}` : 'No mission yet',
  ];
}

export function mentorBlurb(m: Mentor): string[] {
  return [`${m.name}, ${m.title}`, `${categoryName(m)}. ${m.personality}`, m.background, `Teaches: ${m.teaching}`, `Strength: ${m.strength} Weakness: ${m.weakness}`];
}

export const MENTOR_CONFIG = CFG;
