// Legacy runs (M9, Kice's "Expanded Systems" §1): one immutable record per finished run, written once when the run
// ends (profile v14 `legacyRuns`). The Legacy Rotation, Legacy Score, legacy interactions, the Legacy Gallery and
// Relive the Moment all read these records; the False Protagonist rebuilds a run's start from them (seed, trainer,
// campaign, prep, rules, starter, region order). Nothing here rolls a random number or touches a run in progress.

import { z } from 'zod';
import cfgJson from '../data/legacyRuns.json';
import type { Content } from './contentSchema';
import { getBoss } from './regions';
import type { LegacyMon, LegacyRun, Profile, RunRecord, RunState } from './state';

const LegacyRunsConfigSchema = z.object({
  note: z.string(),
  recordCap: z.number().int().min(1),
  chronicleKept: z.number().int().min(0),
  ace: z.object({ perKnockout: z.number(), perBossBeaten: z.number(), perLevel: z.number(), starterBonus: z.number() }),
  moments: z.object({ minLowHpStand: z.number().int().min(1), minSurvivedFatal: z.number().int().min(1) }),
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
