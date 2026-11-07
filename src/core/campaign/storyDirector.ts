// Story Overhaul S4: the Narrative Director on the Orrery Circuit (design Part V-B, Appendix S.2, S.3, S.7).
// It plans 44 Story Stops over the Circuit's 26 map stages and two scene stops after the Champion, in six Acts,
// as a frozen blueprint (pass 1: the frame; pass 2: the slots). It owns no battle rules and rolls no gameplay
// stream: its draws come from `story_director` (a hash of the run seed and the pass number), so no existing roll moves.
// Story events that fill the slots come from later slices (S5, S11); until then every slot plays its fallback line.

import { pickStoryRivals, rolesForTheme } from '../story2/storyRivals';
import type { Content } from '../contentSchema';
import { evilEventId } from '../evil/content';
import { evilOf, evilTeam, plannedEvilTeamId } from '../evil/teams';
import { getCampaign } from '../regions';
import { hashSeed, Rng } from '../rng';
import type { MapNode, RunState } from '../state';
import { emit } from '../story/record';
import { queueStopScene, startBackstory } from '../story2/module';
import { StoryBlueprintSchema, StoryV2Schema, type StopContract, type StoryBlueprint } from '../story2/schema';
import { evilConfig, HIDEOUT_AT_LEAGUE, isStoryCampaign } from './circuit';

type Category = StopContract['category'];
type StoryKnobs = Content['balance']['story'];

/** One row of the Stop table. `col`: map column; null = Region Gate (after the gym) or a scene; CHAMPION_COL = the Champion's step. */
interface Row { stage: number; col: number | null; category: Category; weight: 'main' | 'side'; tags: string[]; intensity: number; locked?: boolean; beat?: number }
const CHAMPION_COL = -1;
const row = (stage: number, col: number | null, category: Category, weight: 'main' | 'side', tags: string[], intensity: number, extra: Partial<Row> = {}): Row => ({ stage, col, category, weight, tags, intensity, ...extra });
const evil = (stage: number, col: number, beat: number, intensity: number, tags: string[] = []): Row => row(stage, col, 'conflict', 'main', ['evil_beat', ...tags], intensity, { locked: true, beat });
const leader = (stage: number): Row => row(stage, 9, 'character', 'main', ['leader_scene'], 2);
const gate = (stage: number, tags: string[] = []): Row => row(stage, null, 'resolution', 'main', ['region_gate', 'rematch_day', 'downtime', ...tags], 2, { locked: true });

/** Stage 25 is the Elite Four corridor, 26 the Champion, 27 the Finale and Epilogue scenes. */
export const ELITE_STAGE = 25;
export const CHAMPION_STAGE = 26;
export const SCENE_STAGE = 27;

/**
 * The Stop table (design Part V-B "Evil beats and Stops", 26-stage version). Two changes from the doc so its own
 * placement rules hold: the stage 5 relationship Stop moves to column 4 (rule 5) and the stage 14 midpoint reveal to
 * column 7 (rule 8); the Stage 26 intensities alternate so no more than 2 high-intensity Stops run back to back.
 */
export const CIRCUIT_STOPS: readonly Row[] = [
  row(1, 2, 'narrative', 'main', ['hook'], 2), row(1, 5, 'character', 'main', ['rival_beat', 'rival_intro'], 3),
  row(2, 3, 'recovery', 'side', ['downtime'], 1), evil(2, 6, 1, 3, ['suspicious_trainers']),
  leader(3),
  row(4, 5, 'discovery', 'main', ['clue'], 2),
  row(5, 4, 'relationship', 'side', ['relationship'], 2), leader(5),
  evil(6, 4, 2, 3, ['evidence']), row(6, 8, 'conflict', 'main', ['rival_beat'], 3),
  leader(7),
  row(8, 4, 'narrative', 'main', ['major_event'], 3), gate(8),
  row(9, 5, 'branch', 'main', ['branch'], 3),
  evil(10, 5, 3, 3, ['recognition', 'major_event_preview']),
  leader(11),
  row(12, 5, 'recovery', 'side', ['downtime'], 1),
  leader(13),
  evil(14, 7, 4, 5, ['executive', 'reveal', 'midpoint']),
  leader(15),
  gate(16),
  row(17, 5, 'discovery', 'main', ['clue'], 2),
  evil(18, 4, 5, 4, ['executive_returns']), row(18, 8, 'branch', 'main', ['branch'], 3),
  leader(19),
  row(20, 8, 'climax', 'main', ['rival_beat', 'turning_point'], 5, { locked: true }),
  leader(21),
  evil(22, 4, 6, 4, ['real_plan']), row(22, 8, 'narrative', 'main', ['rally', 'returns'], 3),
  leader(23),
  gate(24, ['league_summit']),
  evil(ELITE_STAGE, 1, 7, 5, ['hideout']), row(ELITE_STAGE, 1, 'conflict', 'main', ['rival_beat'], 4),
  row(ELITE_STAGE, 2, 'character', 'main', ['elite_scene'], 3), row(ELITE_STAGE, 3, 'character', 'main', ['elite_scene'], 3),
  row(ELITE_STAGE, 4, 'discovery', 'main', ['clue'], 3), row(ELITE_STAGE, 4, 'recovery', 'side', ['downtime'], 1),
  row(CHAMPION_STAGE, CHAMPION_COL, 'branch', 'main', ['the_choice'], 3, { locked: true }),
  row(CHAMPION_STAGE, CHAMPION_COL, 'climax', 'main', ['champion'], 4, { locked: true }),
  row(CHAMPION_STAGE, CHAMPION_COL, 'climax', 'main', ['champion', 'reveal'], 3, { locked: true }),
  row(CHAMPION_STAGE, CHAMPION_COL, 'climax', 'main', ['champion', 'final'], 5, { locked: true }),
  row(SCENE_STAGE, null, 'resolution', 'main', ['finale'], 3, { locked: true }), row(SCENE_STAGE, null, 'resolution', 'main', ['finale'], 2, { locked: true }),
  row(SCENE_STAGE, null, 'resolution', 'main', ['epilogue', 'chronicle'], 1, { locked: true }),
];

/** The run Act (1 to 6) of a Circuit stage number; 0 before stage 1 (the Prologue). Classic keeps `actOf` in director.ts. */
export function storyActOf(content: Content, stageNumber: number): number {
  if (stageNumber < 1) return 0;
  const ends = content.balance.story.actEndStages;
  const i = ends.findIndex((end) => stageNumber <= end);
  return i < 0 ? 6 : i + 1;
}

const actOfRow = (content: Content, r: Row): number => (r.stage === SCENE_STAGE ? (r.tags.includes('epilogue') ? 8 : 7) : storyActOf(content, r.stage));

/** The Circuit stage number (1 to 24 for gym stages, 25 for the League) the run is on, or null outside a Story Run stage. */
export function circuitStage(content: Content, run: Pick<RunState, 'stage' | 'campaignId' | 'regionIndex'>): number | null {
  const stage = run.stage;
  if (!stage) return null;
  const campaign = getCampaign(content, run.campaignId);
  if (stage.kind === 'league') return campaign.regularRegions * campaign.stagesPerRegion + 1;
  return run.regionIndex * campaign.stagesPerRegion + stage.index + 1;
}

// ---------- the blueprint (pure) ----------

export interface DirectorInputs {
  seed: string;
  contentHash: string;
  antagonist: string;
  rivals: { primary: string; secondary: string; friendly: string };
  /** The run's backstory id; a theme row may swap Primary and Secondary for it (S10). */
  backstory?: string;
  /** Columns of a Circuit stage map, and the League's Elite Four size (the Champion's step is one after). */
  columns: number;
  eliteFourSize: number;
}

const toId = (s: string): string => s.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '') || 'none';
const directorRng = (seed: string, pass: number): Rng => new Rng(hashSeed(`${seed}::story_director::${pass}`));
const fallbackOf = (r: Row): string => (r.beat ? `evil_beat_${r.beat}` : r.tags.includes('leader_scene') ? 'leader_scene' : r.tags.includes('region_gate') ? 'region_gate' : `echo_${r.category}`);

export function checksumOf(bp: StoryBlueprint): string {
  const s = hashSeed(JSON.stringify({ ...bp, checksum: '' }));
  return [s.a, s.b, s.c, s.d].map((n) => (n >>> 0).toString(36)).join('');
}

/** Picks each unlocked Stop's column inside its window (table column ± jitter) so the placement rules still hold. */
function placeColumns(k: StoryKnobs, inputs: DirectorInputs, rng: Rng): (number | null)[] {
  const cols: (number | null)[] = [];
  const last = inputs.columns - 1;
  for (let i = 0; i < CIRCUIT_STOPS.length; i++) {
    const r = CIRCUIT_STOPS[i]!;
    if (r.col === null) { cols.push(null); continue; }
    if (r.col === CHAMPION_COL) { cols.push(inputs.eliteFourSize + 1); continue; }
    if (r.stage >= ELITE_STAGE || r.locked) { cols.push(r.col); continue; }
    const sameStage = (j: number) => CIRCUIT_STOPS[j]?.stage === r.stage && CIRCUIT_STOPS[j]!.col !== null;
    const prev = sameStage(i - 1) ? cols[i - 1]! : null;
    const next = sameStage(i + 1) ? CIRCUIT_STOPS[i + 1]! : null;
    const nextMin = next ? (next.locked ? next.col! : Math.max(2, next.col! - k.columnJitter)) : last + k.minColumnGap;
    let lo = Math.max(2, r.col - k.columnJitter, prev !== null ? prev + k.minColumnGap : 2);
    let hi = Math.min(last, r.col + k.columnJitter, nextMin - k.minColumnGap);
    if (prev === null && next) hi = Math.min(hi, k.firstStopMaxColumn);
    if (r.tags.includes('leader_scene')) { lo = Math.max(lo, k.leaderSceneColumns[0]); hi = Math.min(hi, k.leaderSceneColumns[1]); }
    cols.push(lo <= hi ? rng.int(lo, hi) : r.col);
  }
  return cols;
}

/** Pass 1 (the frame) and pass 2 (the slots). Same inputs, same blueprint. */
export function buildBlueprint(content: Content, inputs: DirectorInputs): StoryBlueprint {
  const k = content.balance.story;
  const data = content.storyData;
  // Pass 1: the frame. The theme is drawn by weight; the antagonist is the run's Evil Team; the rivals come from the run.
  const frame = directorRng(inputs.seed, 1);
  const themes = data.themes.filter((t) => t.weight > 0);
  const theme = themes.length > 0 ? frame.weighted(themes.map((t) => ({ item: t.id, weight: t.weight }))) : 'none';
  // Pass 2: the slots. Stop columns, side lanes, then one event per slot (or its fallback).
  const fill = directorRng(inputs.seed, 2);
  const cols = placeColumns(k, inputs, fill);
  const perStage = new Map<number, number>();
  const stops: StopContract[] = CIRCUIT_STOPS.map((r, i) => {
    const n = (perStage.get(r.stage) ?? 0) + 1;
    perStage.set(r.stage, n);
    const act = actOfRow(content, r);
    return {
      id: `ss_${act}_${r.stage}_${n}`, stage: r.stage, act, col: cols[i]!, category: r.category, weight: r.weight, slotTags: r.tags, intensity: r.intensity,
      cinematic: r.category === 'climax' || r.tags.includes('reveal'), fallback: fallbackOf(r), locked: !!r.locked, lane: r.weight === 'side' ? fill.int(0, 3) : 0,
      ...(r.beat ? { beat: r.beat } : {}),
    };
  });
  const used: { event: string; at: number }[] = [];
  const slots = stops.map((s, at) => {
    const tags = new Set([s.category, ...s.slotTags]);
    // A theme's exclusive events (`theme_<id>` tag) are only offered inside that theme, and the drawn theme's events are favoured.
    const mine = `theme_${toId(theme)}`;
    const pool = s.beat ? [] : data.events.filter((e) => e.tags.some((t) => tags.has(t))
      && !e.tags.some((t) => t.startsWith('theme_') && t !== mine)
      && used.filter((u) => u.event === e.id).length < k.sameEventMaxPerRun
      && !used.some((u) => u.event === e.id && at - u.at < k.sameEventGapStops));
    const event = pool.length === 0 ? s.fallback
      : pool.some((e) => e.tags.includes(mine)) ? fill.weighted(pool.map((e) => ({ item: e.id, weight: e.tags.includes(mine) ? k.themeEventWeight : 1 })))
      : fill.pick(pool).id;
    if (event !== s.fallback) used.push({ event, at });
    return { slot: s.id, stop: at + 1, event, fallbacks: [s.fallback] };
  });
  const body: StoryBlueprint = {
    id: 'bp_pending', seed: inputs.seed, contentHash: inputs.contentHash, theme: toId(theme), antagonist: toId(inputs.antagonist),
    // S10 rival table: a theme with a row names its Primary, Secondary and Friendly rivals (list order, rule R1); otherwise the run's rivals.
    rivals: (() => { const r = rolesForTheme(data, toId(theme), inputs.backstory) ?? inputs.rivals; return { primary: toId(r.primary), secondary: toId(r.secondary), friendly: toId(r.friendly) }; })(),
    slots, locks: stops.filter((s) => s.locked).map((s) => s.id), replans: [], stops, checksum: '',
  };
  body.id = `bp_${checksumOf(body).slice(0, 12)}`;
  body.checksum = checksumOf(body);
  return body;
}

/** Every rule the blueprint must keep (design Part V-B, placement rules 1 to 9, Act budgets, slot and lock lists). Empty = valid. */
export function validateBlueprint(content: Content, bp: StoryBlueprint, columns: number): string[] {
  const k = content.balance.story;
  const out: string[] = [];
  const parsed = StoryBlueprintSchema.safeParse(bp);
  if (!parsed.success) out.push(`schema: ${parsed.error.issues[0]?.message}`);
  if (bp.stops.length !== k.stopsTotal) out.push(`${bp.stops.length} stops, want ${k.stopsTotal}`);
  if (new Set(bp.stops.map((s) => s.id)).size !== bp.stops.length) out.push('duplicate stop ids');
  k.actBudgets.forEach((want, i) => {
    const got = bp.stops.filter((s) => s.act === i + 1).length;
    if (got !== want) out.push(`act ${i + 1}: ${got} stops, want ${want}`);
  });
  const circuitStages = ELITE_STAGE - 1;
  for (let stage = 1; stage <= circuitStages; stage++) {
    const all = bp.stops.filter((s) => s.stage === stage);
    const onMap = all.filter((s) => s.col !== null);
    if (all.length < k.stopsPerStageMin || all.length > k.stopsPerStageMax) out.push(`stage ${stage}: ${all.length} stops`);
    if (all.filter((s) => s.weight === 'main' && s.col !== null).length > k.maxMainStopsPerStage) out.push(`stage ${stage}: too many main stops`);
    for (const s of onMap) if (s.col! < 2 || s.col! > columns - 1) out.push(`${s.id}: column ${s.col} (rule 1)`);
    const sorted = [...onMap].sort((a, b) => a.col! - b.col!);
    for (let i = 1; i < sorted.length; i++) if (sorted[i]!.col! - sorted[i - 1]!.col! < k.minColumnGap) out.push(`stage ${stage}: stops ${sorted[i - 1]!.col} and ${sorted[i]!.col} too close (rule 2)`);
    if (onMap.length >= 2 && sorted[0]!.col! > k.firstStopMaxColumn) out.push(`stage ${stage}: first stop at column ${sorted[0]!.col} (rule 5)`);
    for (const s of onMap.filter((x) => x.slotTags.includes('leader_scene'))) {
      if (s.col! < k.leaderSceneColumns[0] || s.col! > k.leaderSceneColumns[1]) out.push(`${s.id}: leader scene at column ${s.col} (rule 9)`);
      if (sorted[sorted.length - 1] !== s) out.push(`${s.id}: leader scene is not the stage's last stop (rule 9)`);
    }
    for (const s of onMap.filter((x) => x.category === 'climax' || x.slotTags.includes('reveal'))) {
      if (s.weight !== 'main' || !s.locked || s.col! < k.climaxColumns[0] || s.col! > k.climaxColumns[1]) out.push(`${s.id}: climax/reveal must be main, locked, in columns ${k.climaxColumns.join('-')} (rule 8)`);
    }
  }
  for (const s of bp.stops.filter((x) => x.beat)) if (s.weight !== 'main' || !s.locked) out.push(`${s.id}: evil beat must be main and locked (rule 6)`);
  const beats = bp.stops.filter((s) => s.beat).map((s) => `${s.beat}@${s.stage}`).join(',');
  if (beats !== '1@2,2@6,3@10,4@14,5@18,6@22,7@25') out.push(`evil beats at ${beats}`);
  for (let act = 1; act <= 5; act++) {
    const rest = bp.stops.filter((s) => s.act === act && (s.category === 'recovery' || s.slotTags.includes('downtime')));
    if (rest.length === 0) out.push(`act ${act}: no recovery or downtime stop (rule 7)`);
    for (const s of rest.filter((x) => x.category === 'recovery')) if (s.weight !== 'side' && s.stage < ELITE_STAGE) out.push(`${s.id}: a rest stop should be side (rule 7)`);
  }
  let run = 0;
  for (const s of bp.stops) {
    run = s.intensity >= 4 ? run + 1 : 0;
    if (run > k.maxConsecutiveHighIntensity) out.push(`${s.id}: ${run} high-intensity stops in a row`);
  }
  if (bp.slots.length !== bp.stops.length || bp.slots.some((sl, i) => sl.slot !== bp.stops[i]!.id || !sl.fallbacks.includes(bp.stops[i]!.fallback))) out.push('slots do not match stops');
  const locks = bp.stops.filter((s) => s.locked).map((s) => s.id).join();
  if (bp.locks.join() !== locks) out.push('lock list does not match locked stops');
  if (bp.checksum !== checksumOf(bp)) out.push('checksum mismatch');
  return out;
}

// ---------- the run (mutates run) ----------

export function directorInputs(content: Content, run: RunState): DirectorInputs {
  const campaign = getCampaign(content, run.campaignId);
  const old = run.story.v2?.blueprint;
  const rivals = run.story.rivals;
  return {
    seed: run.seed, contentHash: content.storyData.hash, antagonist: plannedEvilTeamId(content, run) ?? 'none',
    rivals: old?.rivals ?? pickStoryRivals(content.storyData, run.seed) ?? { primary: rivals[0]?.id ?? 'none', secondary: rivals[1]?.id ?? 'none', friendly: rivals[2]?.id ?? 'none' },
    backstory: run.story.v2?.protagonist?.backstory,
    columns: campaign.columns, eliteFourSize: campaign.eliteFourSize,
  };
}

/** A Story Run gets its v2 container and a frozen blueprint once; a missing or damaged blueprint is rebuilt (never a dropped save). */
/**
 * The run's starter is its Heartbond partner and names its Remembrance line (`v2.starter`), once, as soon as there is a
 * starter: Heartbond, Feats, signature moves and the Starter arc all read these. A line is found by the starter's species.
 */
function bindPartner(content: Content, run: RunState): void {
  const v2 = run.story.v2!;
  const mon = run.party.find((m) => m.uid === run.log.starterUid) ?? run.party[0];
  if (!mon) return;
  v2.heartbond.partner ??= mon.uid;
  if (v2.starter) return;
  const r = content.storyData.remembrances.find((x) => x.line.includes(mon.speciesId));
  if (r) v2.starter = { lineId: r.id, temperament: r.temperament, keystone: [] };
}

export function ensureStoryRun(content: Content, run: RunState): void {
  if (!isStoryCampaign(content, run.campaignId)) return;
  if (!run.story.v2) run.story.v2 = StoryV2Schema.parse({ mode: 'story_run' });
  const v2 = run.story.v2;
  bindPartner(content, run);
  startBackstory(content, run);
  const bp = v2.blueprint;
  if (bp && bp.checksum === checksumOf(bp) && bp.stops.length === content.balance.story.stopsTotal) return;
  const fresh = buildBlueprint(content, directorInputs(content, run));
  if (bp) run.journal.push('The story was re-told.');
  v2.blueprint = fresh;
  v2.blueprintId = fresh.id;
  v2.contentHash = fresh.contentHash;
  v2.stops.planned = fresh.stops.length;
}

/** The event id of an Evil Team beat (1 to 7) for the run's team, or null. */
function evilBeatEvent(content: Content, run: RunState, beat: number): string | null {
  const team = evilTeam(content, run);
  if (!team) return null;
  for (const t of content.evilTeams.templates) {
    if (t.beat !== beat) continue;
    const id = evilEventId(team.id, t.id);
    if (content.events.has(id)) return id;
  }
  return null;
}

/** Rule 6: the Director adopts the evil team's forced stop as the beat's Story Stop: the event moves onto the Stop's node (never a second stop). */
function adoptEvilBeat(content: Content, run: RunState, stop: StopContract, target: MapNode): void {
  const eventId = evilBeatEvent(content, run, stop.beat!);
  const map = run.stage!.map;
  if (!eventId) return;
  if (stop.beat === 7) {
    // Appendix S.7 A (3): the hideout comes due at League entry and sits on the corridor's first step.
    const s = evilOf(run);
    if (!evilConfig(content, run).hideoutAtLeague || s.beat !== 6 || s.end !== 'none') return;
    if (s.nextAt === HIDEOUT_AT_LEAGUE) s.nextAt = s.stages;
    if (!target.sides.some((x) => x.eventId === eventId)) target.sides.push({ id: `event-hideout-${target.id}`, kind: 'event', used: false, eventId });
    return;
  }
  for (const node of map.nodes) {
    const i = node.sides.findIndex((x) => x.kind === 'event' && x.eventId === eventId && !x.used);
    if (i < 0 || node === target) continue;
    target.sides.push(node.sides.splice(i, 1)[0]!);
    return;
  }
}

/** Marks this stage's Story Stops on its map (after the map and its event stops exist). It never adds or removes columns. */
export function placeStoryStops(content: Content, run: RunState): void {
  const bp = run.story.v2?.blueprint;
  const stage = run.stage;
  const n = circuitStage(content, run);
  if (!bp || !stage || n === null || !isStoryCampaign(content, run.campaignId)) return;
  const stops = bp.stops.filter((s) => s.col !== null && (s.stage === n || (stage.kind === 'league' && s.stage === n + 1)));
  for (const s of stops) {
    const nodes = stage.map.nodes.filter((x) => x.column === s.col).sort((a, b) => a.row - b.row);
    if (nodes.length === 0 || (stage.kind === 'stage' && s.col! >= stage.map.columns)) continue;
    const targets = s.weight === 'main' ? nodes : [nodes[s.lane % nodes.length]!];
    for (const node of targets) if (!(node.storyStops ??= []).includes(s.id)) node.storyStops.push(s.id);
    if (s.beat) adoptEvilBeat(content, run, s, nodes[0]!);
  }
}

const STOP_LINES: Record<Category, string> = {
  narrative: 'The road turns a page. Something new is starting here.',
  character: 'A familiar face steps into your path with something to say.',
  conflict: 'Trouble on the road ahead, and it is looking for you.',
  discovery: 'You spot a clue the others walked past.',
  relationship: 'A quiet word with someone who travels the same road.',
  branch: 'The story splits here. Which way it goes is up to you.',
  climax: 'Everything you have done on this road comes due now.',
  resolution: 'A chapter closes behind you.',
  recovery: 'A calm moment to rest and take stock.',
};
const TAG_LINES: Record<string, string> = {
  evil_beat: 'The Evil Team is up to something here. Their story moves on.',
  leader_scene: 'The Gym Leader comes out to meet you before the fight.',
  region_gate: 'The Region Gate: your Charter is sealed, and passed-over leaders may ask for a rematch.',
  hideout: 'The Evil Team\'s hideout opens at the foot of the League.',
  finale: 'The Champion has fallen. The story gathers its threads.',
  epilogue: 'The Hall of Memories writes down how this story ended.',
};

/** Rebuilds the next few unlocked slots whose event no longer exists (a content change since the run began). Locked Stops never move. */
export function replanStops(content: Content, run: RunState, at: number): void {
  const bp = run.story.v2?.blueprint;
  if (!bp) return;
  const known = new Set(content.storyData.events.map((e) => e.id));
  const window = bp.stops.slice(at).filter((s) => !s.locked).slice(0, content.balance.story.replanWindowStops);
  let changed = false;
  for (const s of window) {
    const slot = bp.slots.find((x) => x.slot === s.id);
    if (slot && slot.event !== s.fallback && !known.has(slot.event)) {
      slot.event = s.fallback;
      changed = true;
    }
  }
  if (!changed) return;
  bp.replans.push({ at, reason: 'event_missing' });
  bp.checksum = checksumOf(bp);
  emit(content, run, 'directorReplan', { data: { at, reason: 'event_missing' } });
}

/** Plays one Stop once: marks it done, replans ahead, and tells it (a chronicle moment and a line for the map). */
function playStop(content: Content, run: RunState, id: string, say?: (text: string) => void): void {
  const v2 = run.story.v2;
  const bp = v2?.blueprint;
  const stop = bp?.stops.find((s) => s.id === id);
  if (!v2 || !bp || !stop || v2.stops.done.includes(id)) return;
  v2.stops.done.push(id);
  v2.stops.index = Math.max(v2.stops.index, bp.stops.indexOf(stop) + 1);
  replanStops(content, run, v2.stops.index);
  queueStopScene(content, run, id);
  const tag = stop.slotTags.find((t) => TAG_LINES[t]);
  const text = tag ? TAG_LINES[tag]! : STOP_LINES[stop.category];
  emit(content, run, 'storyMoment', { data: { storyStop: id, category: stop.category, act: stop.act }, importance: 30 + stop.intensity * 10, text });
  say?.(text);
}

/** The Story Stops on the node the player just reached. */
export function playNodeStops(content: Content, run: RunState, node: MapNode, say?: (text: string) => void): void {
  for (const id of node.storyStops ?? []) playStop(content, run, id, say);
}

/** After a Circuit gym: that stage's Region Gate (stages 8, 16, 24). */
export function playStageEndStops(content: Content, run: RunState): void {
  const bp = run.story.v2?.blueprint;
  const n = circuitStage(content, run);
  if (!bp || n === null) return;
  for (const s of bp.stops) if (s.stage === n && s.col === null) playStop(content, run, s.id);
}

/** After the Champion: the Finale and Epilogue scenes. */
export function playFinaleStops(content: Content, run: RunState): void {
  const bp = run.story.v2?.blueprint;
  if (!bp) return;
  // S20: the last Champion is beaten when the Finale plays; the Champion's Heir ending grid reads this.
  run.story.v2!.facts.championship_won = true;
  for (const s of bp.stops) if (s.stage === SCENE_STAGE) playStop(content, run, s.id);
}
