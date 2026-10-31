// Legacy runs (M9, Kice's "Expanded Systems" §1): one immutable record per finished run, written once when the run
// ends (profile v14 `legacyRuns`). The Legacy Rotation, Legacy Score, legacy interactions, the Legacy Gallery and
// Relive the Moment all read these records; the False Protagonist rebuilds a run's start from them (seed, trainer,
// campaign, prep, rules, starter, region order). Nothing here rolls a random number or touches a run in progress.

import { z } from 'zod';
import cfgJson from '../data/legacyRuns.json';
import type { Content } from './contentSchema';
import { getBoss } from './regions';
import type { LegacyMon, LegacyRun, PokemonInstance, Profile, RunRecord, RunState } from './state';

const LegacyRunsConfigSchema = z.object({
  note: z.string(),
  recordCap: z.number().int().min(1),
  chronicleKept: z.number().int().min(0),
  ace: z.object({ perKnockout: z.number(), perBossBeaten: z.number(), perLevel: z.number(), starterBonus: z.number() }),
  moments: z.object({ minLowHpStand: z.number().int().min(1), minSurvivedFatal: z.number().int().min(1) }),
  score: z.object({
    regionCompleted: z.number(), gymLeader: z.number(), eliteFour: z.number(), champion: z.number(), newRegion: z.number(), rivalDefeated: z.number(),
    legendary: z.number(), comeback: z.number(), highLevel: z.number(), campaign: z.number(), narrativeEvent: z.number(), narrativeEventMax: z.number().int().min(0),
    perEncounter: z.number(), perShiny: z.number(), perRareMon: z.number(), highLevelAt: z.number().int(), comebackSurvivedFatal: z.number().int().min(1), memorableImportance: z.number().int(),
  }),
  rotation: z.object({ size: z.number().int().min(1), rotateMs: z.number().int().positive(), fadeMs: z.number().int().min(0), baseWeight: z.number().positive(), recentBonus: z.number().min(0), recentRuns: z.number().int().min(0), cooldownFactor: z.number().min(0).max(1), memorableScore: z.number() }),
  interactions: z.object({ chance: z.number().min(0).max(1), longRunEncounters: z.number().int(), lines: z.object({ champion: z.string(), rivalEnding: z.string(), samePokemon: z.string(), longRun: z.string() }) }),
  defeats: z.object({ chance: z.number().min(0).max(1), absentDays: z.number().int().min(1), lines: z.object({ rival: z.string(), narrative: z.string(), close: z.string(), absent: z.string(), different: z.string(), fell: z.string() }) }),
});
export const LEGACY_RUNS = LegacyRunsConfigSchema.parse(cfgJson);

const speciesName = (content: Content, id: string) => content.species.get(id)?.name ?? id;
const isLegendary = (content: Content, id: string) => {
  const tags = content.species.get(id)?.tags ?? [];
  return tags.includes('legendary') || tags.includes('mythical');
};
const bossName = (content: Content, id: string) => {
  try {
    return getBoss(content, id).name;
  } catch {
    return id;
  }
};

/** The Ace: the team member that did the most (knockouts, bosses, level; the starter breaks close calls). First slot wins ties. */
export function pickAce(team: readonly LegacyMon[]): LegacyMon | null {
  const w = LEGACY_RUNS.ace;
  let best: LegacyMon | null = null;
  let bestScore = -Infinity;
  for (const m of team) {
    const score = m.knockouts * w.perKnockout + m.bossesBeaten * w.perBossBeaten + m.level * w.perLevel + (m.starter ? w.starterBonus : 0);
    if (score > bestScore) [best, bestScore] = [m, score];
  }
  return best;
}

/** Builds the immutable record for a finished run. `history` is the Run History entry made for it (journal, epitaph). */
export function buildLegacyRun(content: Content, run: RunState, now: string, history?: RunRecord): LegacyRun {
  const histories = run.story.histories;
  const team: LegacyMon[] = run.party.map((m) => {
    const h = histories[m.uid];
    return {
      uid: m.uid,
      speciesId: m.speciesId,
      level: m.level,
      shiny: m.shiny,
      moves: m.moves.map((s) => s.id),
      abilitySlot: m.abilitySlot,
      nature: m.nature ?? null,
      held: Object.keys(m.held ?? {}).sort(),
      starter: m.uid === run.log.starterUid,
      knockouts: h?.knockoutsDealt ?? 0,
      bossesBeaten: h?.bossesBeaten ?? 0,
      titles: [...(h?.titles ?? [])],
    };
  });
  const starterHistory = run.log.starterUid ? histories[run.log.starterUid] : undefined;
  const starterSpecies = starterHistory?.originalSpeciesId ?? null;
  const counters = run.log.counters;
  const rivals = run.story.rivals.map((r) => ({
    id: r.id, name: r.name, classId: r.classId, archetype: r.archetype, state: r.state,
    encounters: r.encounters, setbacks: r.setbacks,
    lastResult: r.memory.lastBattle.result,
    resolution: r.arc?.resolution ?? null,
    team: [...r.memory.lastBattle.team],
    rank: r.rank ?? null,
    world: r.world ? { lead: r.world.lead, region: r.world.region, badges: r.world.badges, regionsDone: r.world.regionsDone, wins: r.world.wins, defeats: r.world.defeats, fame: r.world.fame, milestones: r.world.milestones.map((m) => m.kind) } : null,
    narrativeWins: r.world?.milestones.filter((m) => m.kind === 'narrativeWin').length ?? 0,
  }));
  const seenLegends = run.log.speciesSeen.filter((id) => isLegendary(content, id));
  const caughtLegends = run.log.speciesCaught.filter((id) => isLegendary(content, id));
  const all = Object.values(histories);
  const sum = (f: (h: (typeof all)[number]) => number) => all.reduce((n, h) => n + f(h), 0);
  const victory = run.victory;
  const lastBoss = run.usedLeaders.at(-1) ?? null;
  const finalBattle = run.log.defeatedBy
    ? { result: 'lose' as const, speciesId: run.log.defeatedBy.speciesId, level: run.log.defeatedBy.level, trainer: run.log.defeatedBy.trainer }
    : victory ? { result: 'win' as const, speciesId: null, level: null, trainer: lastBoss ? bossName(content, lastBoss) : null } : null;

  // Relive the Moment: the run's key moments, in the order they happened.
  const moments: LegacyRun['moments'] = [];
  const firstBadge = run.badges[0];
  if (firstBadge) moments.push({ kind: 'firstGym', text: `First Gym victory: beat ${bossName(content, firstBadge)}.`, speciesId: null, region: 0 });
  const firstLegend = seenLegends[0];
  if (firstLegend) moments.push({ kind: 'firstLegendary', text: caughtLegends.includes(firstLegend) ? `Met and caught ${speciesName(content, firstLegend)}.` : `Met ${speciesName(content, firstLegend)}.`, speciesId: firstLegend, region: null });
  for (const r of rivals) {
    if (r.lastResult === 'win') moments.push({ kind: 'rivalDefeat', text: `Beat rival ${r.name} (${r.encounters} battle${r.encounters === 1 ? '' : 's'}).`, speciesId: r.team[0] ?? null, region: null });
    else if (r.lastResult === 'lose') moments.push({ kind: 'rivalLoss', text: `Lost to rival ${r.name}.`, speciesId: r.team[0] ?? null, region: null });
  }
  const stand = [...all].sort((a, b) => b.longestLowHpStand - a.longestLowHpStand)[0];
  if (stand && stand.longestLowHpStand >= LEGACY_RUNS.moments.minLowHpStand) moments.push({ kind: 'finalStanding', text: `${speciesName(content, stand.speciesId)} fought on for ${stand.longestLowHpStand} turns at low HP.`, speciesId: stand.speciesId, region: null });
  const fatal = [...all].sort((a, b) => b.survivedFatal - a.survivedFatal)[0];
  if (fatal && fatal.survivedFatal >= LEGACY_RUNS.moments.minSurvivedFatal) moments.push({ kind: 'lastSecond', text: `${speciesName(content, fatal.speciesId)} survived a hit that should have ended it${fatal.survivedFatal > 1 ? ` (${fatal.survivedFatal} times)` : ''}.`, speciesId: fatal.speciesId, region: null });
  if (victory) moments.push({ kind: 'championVictory', text: lastBoss ? `Became Champion by beating ${bossName(content, lastBoss)}.` : 'Became Champion.', speciesId: null, region: run.regionIndex });
  if (run.log.defeatedBy) {
    const d = run.log.defeatedBy;
    moments.push({ kind: 'runEnding', text: `The journey ended against ${d.trainer ? `${d.trainer}'s ` : 'a wild '}${speciesName(content, d.speciesId)} (Lv ${d.level}).`, speciesId: d.speciesId, region: run.regionIndex });
  }

  const record: LegacyRun = {
    format: 1,
    source: 'run',
    runId: run.runId,
    endedAt: now,
    seed: run.seed,
    archetypeId: run.archetypeId,
    campaignId: run.campaignId,
    prep: structuredClone(run.prep),
    rules: structuredClone(run.rules),
    starter: starterSpecies ? { speciesId: starterSpecies, choices: [...run.starterChoices] } : null,
    regionOrder: [...run.regionOrder],
    regionsCleared: [...run.regionsCleared],
    regionReached: run.regionIndex,
    outcome: victory ? 'victory' : 'defeat',
    encounters: run.encountersCompleted,
    battlesWon: run.log.battlesWon,
    badges: [...run.badges],
    bosses: { gym: counters.gymLeadersDefeated ?? 0, elite: counters.eliteFourDefeated ?? 0, champion: counters.championsDefeated ?? 0 },
    team,
    aceUid: pickAce(team)?.uid ?? null,
    rivals,
    nemeses: run.story.nemeses.map((n) => ({ id: n.id, speciesId: n.speciesId, archetype: n.archetype, cause: n.cause, settledAs: n.settledAs })),
    legendaries: { seen: seenLegends, caught: caughtLegends },
    defeatedBy: run.log.defeatedBy ? { ...run.log.defeatedBy } : null,
    finalBattle,
    stats: {
      maxLevel: Math.max(0, ...run.party.map((m) => m.level)),
      survivedFatal: sum((h) => h.survivedFatal),
      closeCalls: sum((h) => h.closeCalls),
      caught: run.log.speciesCaught.length,
      shinies: counters.shiniesFound ?? 0,
      rivalWins: counters.rivalBattlesWon ?? 0,
    },
    narrative: [...new Set([...run.gameEvents, ...run.story.appliedEffects])],
    chronicle: [...run.story.chronicle]
      .sort((a, b) => b.importance - a.importance || a.seq - b.seq)
      .slice(0, LEGACY_RUNS.chronicleKept)
      .map((c) => ({ type: c.type, text: c.text, importance: c.importance, region: c.where.region, stage: c.where.stage })),
    moments,
    journal: [...(history?.journal ?? run.journal)],
    epitaph: history?.epitaph ?? null,
  };
  return record;
}

/** A thin record rebuilt from an older Run History entry (profile v13 → v14 migration): what that entry kept, nothing more. */
export function legacyRunFromHistory(r: RunRecord): LegacyRun {
  const team: LegacyMon[] = r.party.map((m, i) => ({ uid: `${r.runId}:${i}`, speciesId: m.speciesId, level: m.level, shiny: m.shiny, moves: [], abilitySlot: 0, nature: null, held: [], starter: false, knockouts: 0, bossesBeaten: 0, titles: [...(r.legacy.find((c) => c.speciesId === m.speciesId)?.titles ?? [])] }));
  return {
    format: 1,
    source: 'history',
    runId: r.runId,
    endedAt: r.endedAt,
    seed: r.seed,
    archetypeId: r.archetypeId,
    campaignId: r.campaignId,
    prep: null,
    rules: null,
    starter: null,
    regionOrder: [],
    regionsCleared: [],
    regionReached: r.victory ? Math.max(0, r.regions - 1) : r.regionsCleared,
    outcome: r.victory ? 'victory' : 'defeat',
    encounters: r.encounters,
    battlesWon: 0,
    badges: [],
    bosses: { gym: r.badges, elite: 0, champion: r.victory ? 1 : 0 },
    team,
    aceUid: [...team].sort((a, b) => b.level - a.level)[0]?.uid ?? null,
    rivals: [],
    nemeses: [],
    legendaries: { seen: [], caught: [] },
    defeatedBy: r.defeatedBy ? { ...r.defeatedBy } : null,
    finalBattle: r.defeatedBy ? { result: 'lose', speciesId: r.defeatedBy.speciesId, level: r.defeatedBy.level, trainer: r.defeatedBy.trainer } : null,
    stats: { maxLevel: Math.max(0, ...r.party.map((m) => m.level)), survivedFatal: 0, closeCalls: 0, caught: 0, shinies: r.party.filter((m) => m.shiny).length, rivalWins: 0 },
    narrative: [],
    chronicle: r.moments.map((text) => ({ type: 'storyMoment', text, importance: 0, region: 0, stage: null })),
    moments: r.defeatedBy ? [{ kind: 'runEnding', text: `The journey ended against ${r.defeatedBy.trainer ? `${r.defeatedBy.trainer}'s ` : 'a wild '}${r.defeatedBy.speciesId} (Lv ${r.defeatedBy.level}).`, speciesId: r.defeatedBy.speciesId, region: null }] : [],
    journal: [...r.journal],
    epitaph: r.epitaph,
  };
}

/** Adds a finished run's record once (a run id already kept is never rewritten), newest first, trimmed to the cap. */
export function recordLegacyRun(content: Content, profile: Profile, run: RunState, now: string): LegacyRun | null {
  profile.legacyRuns ??= [];
  if (profile.legacyRuns.some((r) => r.runId === run.runId)) return null;
  const record = deepFreeze(buildLegacyRun(content, run, now, profile.runHistory.find((r) => r.runId === run.runId)));
  profile.legacyRuns = [record, ...profile.legacyRuns].slice(0, LEGACY_RUNS.recordCap);
  return record;
}

/** The Ace of a record (null when its team is empty). */
export function legacyAce(record: LegacyRun): LegacyMon | null {
  return record.team.find((m) => m.uid === record.aceUid) ?? record.team[0] ?? null;
}

/** The start a record can rebuild: everything createRun needs to replay the same run from its seed (null for rebuilt records). */
export function legacyRunStart(record: LegacyRun): { seed: string; archetypeId: string; campaignId: string; prep: NonNullable<LegacyRun['prep']>; rules: NonNullable<LegacyRun['rules']>; starter: string; regionOrder: string[] } | null {
  if (record.source !== 'run' || !record.prep || !record.rules || !record.starter) return null;
  return { seed: record.seed, archetypeId: record.archetypeId, campaignId: record.campaignId, prep: record.prep, rules: record.rules, starter: record.starter.speciesId, regionOrder: [...record.regionOrder] };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ---------- Legacy Score (§1.2) ----------

/** How much a run deserves to be remembered (§1.2 weights in legacyRuns.json). Worked out from the record, never stored. */
export function legacyScore(content: Content, record: LegacyRun): number {
  const w = LEGACY_RUNS.score;
  const cleared = record.source === 'run' ? record.regionsCleared.length : Math.max(0, record.regionReached - (record.outcome === 'victory' ? 0 : 0));
  const narrative = record.nemeses.filter((n) => n.settledAs).length + record.chronicle.filter((c) => c.importance >= w.memorableImportance).length;
  const rareMons = record.team.filter((m) => isLegendary(content, m.speciesId) || (content.species.get(m.speciesId)?.tags ?? []).some((t) => t === 'delta' || t === 'zform')).length;
  return Math.round(
    cleared * w.regionCompleted +
      record.bosses.gym * w.gymLeader +
      record.bosses.elite * w.eliteFour +
      record.bosses.champion * w.champion +
      record.regionReached * w.newRegion +
      record.rivals.filter((r) => r.lastResult === 'win').length * w.rivalDefeated +
      record.legendaries.caught.length * w.legendary +
      (record.stats.survivedFatal >= w.comebackSurvivedFatal ? w.comeback : 0) +
      (record.stats.maxLevel >= w.highLevelAt ? w.highLevel : 0) +
      (record.outcome === 'victory' ? w.campaign : 0) +
      Math.min(w.narrativeEventMax, narrative) * w.narrativeEvent +
      record.encounters * w.perEncounter +
      record.team.filter((m) => m.shiny).length * w.perShiny +
      rareMons * w.perRareMon,
  );
}

// ---------- the Legacy Rotation (§1.1) ----------

/** One Trainer in the rotation: a past run (or the run in progress) and its Ace. */
export interface RotationEntry {
  runId: string;
  current: boolean;
  archetypeId: string;
  ace: { speciesId: string; level: number; shiny: boolean } | null;
  /** The region the run reached (its id), or null when unknown. */
  regionId: string | null;
  outcome: 'victory' | 'defeat' | 'inProgress';
  /** Up to three short accomplishments, best first. */
  accomplishments: string[];
  memorable: boolean;
  score: number;
}

/** Presentation-only randomness (never a gameplay stream): a small generator from a string. */
export function viewRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Short accomplishment lines for a record, best first. */
export function accomplishments(content: Content, record: LegacyRun): string[] {
  const out: string[] = [];
  if (record.outcome === 'victory') out.push('Champion');
  if (record.bosses.elite > 0 && record.outcome !== 'victory') out.push(`${record.bosses.elite} Elite Four beaten`);
  const cleared = record.regionsCleared.length;
  if (cleared > 0) out.push(`${cleared} region${cleared === 1 ? '' : 's'} cleared`);
  if (record.bosses.gym > 0) out.push(`${record.bosses.gym} badge${record.bosses.gym === 1 ? '' : 's'}`);
  const rivalWins = record.rivals.filter((r) => r.lastResult === 'win').length;
  if (rivalWins > 0) out.push(`Beat ${rivalWins} rival${rivalWins === 1 ? '' : 's'}`);
  if (record.legendaries.caught[0]) out.push(`Caught ${speciesName(content, record.legendaries.caught[0])}`);
  if (record.stats.survivedFatal >= LEGACY_RUNS.score.comebackSurvivedFatal) out.push('Came back from the brink');
  if (out.length === 0) out.push(`${record.encounters} encounters`);
  return out.slice(0, 3);
}

const regionAt = (record: LegacyRun) => record.regionOrder[Math.min(record.regionReached, record.regionOrder.length - 1)] ?? null;

export function rotationEntry(content: Content, record: LegacyRun): RotationEntry {
  const ace = legacyAce(record);
  const score = legacyScore(content, record);
  return {
    runId: record.runId, current: false, archetypeId: record.archetypeId,
    ace: ace ? { speciesId: ace.speciesId, level: ace.level, shiny: ace.shiny } : null,
    regionId: regionAt(record), outcome: record.outcome, accomplishments: accomplishments(content, record),
    memorable: score >= LEGACY_RUNS.rotation.memorableScore, score,
  };
}

/** The run in progress as a rotation entry (always shown first): its trainer and its strongest Pokémon. */
export function currentRunEntry(content: Content, run: RunState): RotationEntry {
  const best = run.party.reduce<PokemonInstance | null>((a, m) => (!a || m.level > a.level ? m : a), null);
  const badges = run.badges.length;
  return {
    runId: run.runId, current: true, archetypeId: run.archetypeId,
    ace: best ? { speciesId: best.speciesId, level: best.level, shiny: best.shiny } : null,
    regionId: run.regionOrder[run.regionIndex] ?? null, outcome: 'inProgress',
    accomplishments: [badges > 0 ? `${badges} badge${badges === 1 ? '' : 's'} so far` : 'Journey under way', `${run.encountersCompleted} encounters`],
    memorable: false, score: 0,
  };
}

/**
 * The six-Trainer rotation (§1.1/§1.2): the run in progress first, then past runs picked by weight without
 * replacement, so high scores show more often but the six are not always the top six. Recent runs get a bonus;
 * runs in `cooldown` (shown last time) get much less weight. Same inputs give the same list.
 */
export function legacyRotation(content: Content, records: readonly LegacyRun[], opts: { seed: string; current?: RunState | null; cooldown?: readonly string[] }): RotationEntry[] {
  const cfg = LEGACY_RUNS.rotation;
  const out: RotationEntry[] = [];
  if (opts.current) out.push(currentRunEntry(content, opts.current));
  const cooldown = new Set(opts.cooldown ?? []);
  const pool = records
    .filter((r) => r.runId !== opts.current?.runId && r.team.length > 0)
    .map((r, i) => {
      const entry = rotationEntry(content, r);
      const recent = i < cfg.recentRuns ? cfg.recentBonus * (1 - i / Math.max(1, cfg.recentRuns)) : 0;
      return { entry, weight: (cfg.baseWeight + entry.score + recent) * (cooldown.has(r.runId) ? cfg.cooldownFactor : 1) };
    });
  const rand = viewRandom(`legacy-rotation:${opts.seed}`);
  while (out.length < cfg.size && pool.length > 0) {
    const total = pool.reduce((n, p) => n + p.weight, 0);
    let roll = rand() * total;
    let i = 0;
    while (i < pool.length - 1 && roll >= pool[i]!.weight) roll -= pool[i++]!.weight;
    out.push(pool.splice(i, 1)[0]!.entry);
  }
  return out;
}

// ---------- legacy interactions (§1.3) ----------

/**
 * A rare line for a past Trainer on show (§1.3): beat a Champion, lost to a rival, shared a Pokémon with the current
 * team, or ran a long way. `roll` is a presentation roll in [0, 1); most of the time there is no line.
 */
export function legacyInteraction(record: LegacyRun, currentSpecies: readonly string[], roll: number): string | null {
  const cfg = LEGACY_RUNS.interactions;
  if (roll >= cfg.chance) return null;
  const rivalNames = new Set(record.rivals.map((r) => r.name));
  if (record.defeatedBy?.trainer && rivalNames.has(record.defeatedBy.trainer)) return cfg.lines.rivalEnding;
  if (record.team.some((m) => currentSpecies.includes(m.speciesId))) return cfg.lines.samePokemon;
  if (record.bosses.champion > 0 || record.outcome === 'victory') return cfg.lines.champion;
  if (record.encounters >= cfg.longRunEncounters) return cfg.lines.longRun;
  return null;
}

// ---------- the world remembers your defeats (§8.2) ----------

/**
 * Now and then, someone remembers how your last run ended (§8.2). Uses the newest record only; a won last run has
 * nothing to remember. `roll` is a presentation roll in [0, 1). The line depends on what happened: a rival beat you,
 * you nearly finished, you were away a long time, you came back as a different trainer, or a Pokémon ended it.
 */
export function rememberedDefeat(content: Content, records: readonly LegacyRun[], next: { archetypeId: string; now: string }, roll: number): string | null {
  const cfg = LEGACY_RUNS.defeats;
  const last = records[0];
  if (!last || roll >= cfg.chance) return null;
  // A story loss to a rival is remembered differently from a failed run, and a won run still remembers it.
  const storyWinner = last.rivals.find((r) => r.narrativeWins > 0);
  if (last.outcome !== 'defeat') return storyWinner ? cfg.lines.narrative.replace('{rival}', storyWinner.name) : null;
  const rival = last.defeatedBy?.trainer ? last.rivals.find((r) => r.name === last.defeatedBy!.trainer) : undefined;
  if (rival) return cfg.lines.rival.replace('{rival}', rival.name);
  const days = (Date.parse(next.now) - Date.parse(last.endedAt)) / 86400000;
  if (Number.isFinite(days) && days >= cfg.absentDays) return cfg.lines.absent;
  if (last.regionOrder.length > 0 && last.regionReached >= last.regionOrder.length - 1) return cfg.lines.close;
  if (next.archetypeId !== last.archetypeId) return cfg.lines.different;
  if (last.defeatedBy) return cfg.lines.fell.replace('{species}', speciesName(content, last.defeatedBy.speciesId));
  return null;
}

// ---------- the Rival Hall of Fame (§8.1) ----------

export interface RivalFameEntry {
  name: string;
  classId: string;
  /** Its signature Pokémon (the first of its last team), if known. */
  signature: string | null;
  /** The region its run took place in (where it reached its rank). */
  regionId: string | null;
  /** Champion, finalist or Gym Leader title, or null for a rival that never ranked. */
  title: 'champion' | 'finalist' | 'gymLeader' | null;
  /** Its standing with you when the run ended (ladder state, or ally/retired), and how the arc ended. */
  relationship: string;
  resolution: 'good' | 'bad' | null;
  encounters: number;
  /** Its fame and badges in the rival world when the run ended (0 when it had no off-screen journey). */
  fame: number;
  badges: number;
  /** Story losses it handed you (M12). */
  narrativeWins: number;
  /** You beat it at least once (its last battle with you was your win, or a loss shook it). */
  defeatedByYou: boolean;
  runId: string;
  endedAt: string;
}

const TITLE_ORDER = { champion: 0, finalist: 1, gymLeader: 2 } as const;

/** Every rival that finished its journey (ranked), plus the strongest rivalries, across all legacy runs; champions first. */
export function rivalHallOfFame(records: readonly LegacyRun[], limit = 24): RivalFameEntry[] {
  const entries = records.flatMap((rec) =>
    rec.rivals
      .filter((r) => r.rank !== null || r.encounters >= 3 || r.state === 'nemesis' || r.state === 'contender' || (r.world?.regionsDone ?? 0) > 0)
      .map((r): RivalFameEntry => ({
        name: r.name, classId: r.classId, signature: r.team[0] ?? null, regionId: regionAt(rec), title: r.rank,
        relationship: r.state, resolution: r.resolution, encounters: r.encounters, fame: r.world?.fame ?? 0, badges: r.world?.badges ?? 0, narrativeWins: r.narrativeWins,
        defeatedByYou: r.lastResult === 'win' || r.setbacks > 0, runId: rec.runId, endedAt: rec.endedAt,
      })),
  );
  return entries
    .sort((a, b) => (a.title ? TITLE_ORDER[a.title] : 9) - (b.title ? TITLE_ORDER[b.title] : 9) || b.fame - a.fame || b.encounters - a.encounters || b.endedAt.localeCompare(a.endedAt))
    .slice(0, limit);
}
