// Recording what happens: domain events go into the run's story state, and
// from there into each Pokémon's history, the run chronicle and the
// relationship / enemy records. Every function here mutates the run it is
// given (callers pass the fresh copy an action is building).
//
// Size limits come from src/data/story.json, so a long run never makes the
// save grow without bound.

import type { Content } from '../contentSchema';
import { findNode } from '../map';
import type { RunState } from '../state';
import type {
  ChronicleEntry,
  DomainEvent,
  DomainEventType,
  EnemyProfile,
  Emotion,
  EntityRef,
  Memory,
  PokemonHistory,
  RelationshipRecord,
  StoryState,
  Where,
} from './schema';

export function createStoryState(): StoryState {
  return { seq: 0, events: [], histories: {}, relationships: [], enemyProfiles: [], rivals: [], rivalGraph: [], standing: { sponsor: null, factions: {}, bosses: 0, debts: [] }, chronicle: [], appliedEffects: [], flags: {}, majorCuesThisBattle: 0, nemeses: [] };
}

/** Which battle of the run this is (counted from 0). Lost battles end the run, so this never repeats. */
export function battleIndex(run: RunState): number {
  return run.encountersCompleted;
}

/** Where the run is right now. */
export function whereNow(run: RunState): Where {
  const stage = run.stage;
  const node = stage?.current ? findNode(stage.map, stage.current) : null;
  return {
    region: run.regionIndex,
    stage: stage ? stage.index : null,
    level: node ? node.column : null,
    node: stage?.current ?? null,
    battle: run.battle ? battleIndex(run) : null,
    turn: run.battle ? run.battle.turn : null,
  };
}

/** The deterministic id of the event with this sequence number: the run seed plus the number. */
export function eventId(seed: string, seq: number): string {
  return `${seed}#${seq}`;
}

export interface EmitOptions {
  actors?: string[];
  data?: DomainEvent['data'];
  /** Overrides story.json's importance for this event type. */
  importance?: number;
  /** What a memory or chronicle entry says. Without it the event is never a memory. */
  text?: string;
  /** Overrides the place (e.g. the turn a fact belongs to). */
  where?: Where;
  /** Seven Emotions tags for the memory (default: story.json's emotions.byEvent for the type). */
  emotions?: Emotion[];
}

/**
 * Records a domain event (mutates `run`): keeps it in the recent events,
 * updates histories, and makes memories and chronicle entries for important
 * ones. Returns the event.
 */
export function emit(content: Content, run: RunState, type: DomainEventType, opts: EmitOptions = {}): DomainEvent {
  const story = run.story;
  const cfg = content.story;
  story.seq += 1;
  const event: DomainEvent = {
    id: eventId(run.seed, story.seq),
    seq: story.seq,
    type,
    where: opts.where ?? whereNow(run),
    actors: opts.actors ?? [],
    data: opts.data ?? {},
  };
  story.events.push(event);
  if (story.events.length > cfg.limits.recentEvents) story.events.splice(0, story.events.length - cfg.limits.recentEvents);

  updateCounters(story, event);
  const importance = opts.importance ?? cfg.importance[type];
  if (opts.text && importance > 0) {
    const emotions = opts.emotions ?? cfg.emotions.byEvent[type] ?? [];
    const memory: Memory = { eventId: event.id, seq: event.seq, type, importance, text: opts.text, where: event.where, emotions };
    for (const uid of event.actors) {
      const history = story.histories[uid];
      if (history) addMemory(history, memory, cfg.limits.memoriesPerPokemon);
    }
    if (importance >= cfg.chronicleMinImportance) addChronicle(story, { ...memory, actors: event.actors }, cfg.limits.chronicleEntries);
  }
  return event;
}

/** Keeps the most important memories (the newest wins a tie), in the order they happened. */
function addMemory(history: PokemonHistory, memory: Memory, limit: number): void {
  history.memories.push(memory);
  trimByImportance(history.memories, limit);
}

function addChronicle(story: StoryState, entry: ChronicleEntry, limit: number): void {
  story.chronicle.push(entry);
  trimByImportance(story.chronicle, limit);
}

/** Drops the least important entries (the oldest of those first) until the list fits. Keeps order. */
function trimByImportance<T extends { importance: number; seq: number }>(list: T[], limit: number): void {
  while (list.length > limit) {
    let worst = 0;
    for (let i = 1; i < list.length; i++) {
      const a = list[i]!;
      const b = list[worst]!;
      if (a.importance < b.importance || (a.importance === b.importance && a.seq < b.seq)) worst = i;
    }
    list.splice(worst, 1);
  }
}

/** History counters that follow directly from an event. */
function updateCounters(story: StoryState, e: DomainEvent): void {
  const h = (uid: string | undefined) => (uid ? story.histories[uid] : undefined);
  switch (e.type) {
    case 'knockout': {
      // actors: [fainted, knocked out by]
      const [fainted, by] = e.actors;
      if (e.data.side === 'player') {
        const victim = h(fainted);
        if (victim) victim.knockoutsTaken += 1;
      } else {
        const hero = h(by);
        if (hero) hero.knockoutsDealt += 1;
      }
      break;
    }
    case 'closeCall':
      for (const uid of e.actors) if (h(uid)) h(uid)!.closeCalls += 1;
      break;
    case 'survivedFatal':
      for (const uid of e.actors) if (h(uid)) h(uid)!.survivedFatal += 1;
      break;
    case 'bossBeaten':
      for (const uid of e.actors) if (h(uid)) h(uid)!.bossesBeaten += 1;
      break;
    case 'evolved': {
      const mon = h(e.actors[0]);
      if (mon && typeof e.data.to === 'string') {
        mon.evolutions.push({ from: String(e.data.from), to: e.data.to, trigger: String(e.data.trigger ?? 'level'), where: e.where });
        mon.speciesId = e.data.to;
      }
      break;
    }
    default:
      break;
  }
}

// ---------- Pokémon histories ----------

/** Starts a Pokémon's history when it joins you (does nothing if it already has one). */
export function openHistory(content: Content, run: RunState, uid: string, speciesId: string, joinedBy: PokemonHistory['joinedBy']): PokemonHistory {
  const existing = run.story.histories[uid];
  if (existing) return existing;
  const history: PokemonHistory = {
    uid,
    speciesId,
    originalSpeciesId: speciesId,
    joinedBy,
    joinedAt: whereNow(run),
    battles: 0,
    knockoutsDealt: 0,
    knockoutsTaken: 0,
    closeCalls: 0,
    survivedFatal: 0,
    bossesBeaten: 0,
    longestLowHpStand: 0,
    lowHpStreak: 0,
    lastBattle: null,
    evolutions: [],
    titles: [],
    memories: [],
    hyper: {},
    foes: {},
    moves: {},
    finishTrades: {},
  };
  run.story.histories[uid] = history;
  trimHistories(content, run);
  return history;
}

/**
 * Keeps at most the limit of histories: Pokémon still with you are always
 * kept; of the others, the ones with the least important memories go first.
 */
function trimHistories(content: Content, run: RunState): void {
  const histories = run.story.histories;
  const limit = content.story.limits.histories;
  const ids = Object.keys(histories);
  if (ids.length <= limit) return;
  const inParty = new Set(run.party.map((m) => m.uid));
  const weight = (h: PokemonHistory) => h.memories.reduce((sum, m) => sum + m.importance, 0);
  const removable = ids.filter((id) => !inParty.has(id)).sort((a, b) => weight(histories[a]!) - weight(histories[b]!));
  for (const id of removable.slice(0, ids.length - limit)) delete histories[id];
}

/** Counts a battle for a Pokémon the first time it fights in it. */
export function noteFought(run: RunState, uid: string): void {
  const history = run.story.histories[uid];
  const battle = battleIndex(run);
  if (!history || history.lastBattle === battle) return;
  history.lastBattle = battle;
  history.battles += 1;
}

/** Updates the low-HP stand streak at the end of a turn. */
export function noteLowHpTurn(run: RunState, uid: string, low: boolean): void {
  const history = run.story.histories[uid];
  if (!history) return;
  history.lowHpStreak = low ? history.lowHpStreak + 1 : 0;
  history.longestLowHpStand = Math.max(history.longestLowHpStand, history.lowHpStreak);
}

export function awardTitle(run: RunState, uid: string, title: string): boolean {
  const history = run.story.histories[uid];
  if (!history || history.titles.includes(title)) return false;
  history.titles.push(title);
  return true;
}

// ---------- relationships and recurring enemies ----------

/**
 * Opens a relationship between two entities. Returns null when the run
 * already has the limit of open relationships, or the same pair already has
 * one of that kind.
 */
export function openRelationship(content: Content, run: RunState, kind: RelationshipRecord['kind'], a: EntityRef, b: EntityRef, cause: DomainEvent): RelationshipRecord | null {
  const story = run.story;
  const same = (x: EntityRef, y: EntityRef) => x.kind === y.kind && x.id === y.id;
  if (story.relationships.some((r) => r.open && r.kind === kind && ((same(r.a, a) && same(r.b, b)) || (same(r.a, b) && same(r.b, a))))) return null;
  if (story.relationships.filter((r) => r.open).length >= content.story.limits.openRelationships) return null;
  const record: RelationshipRecord = { id: `rel-${cause.id}`, kind, a, b, stage: 0, open: true, formedAt: cause.where, history: [cause.id] };
  story.relationships.push(record);
  return record;
}

/** Moves a relationship along (stage +1 by default), remembering why. */
export function advanceRelationship(content: Content, record: RelationshipRecord, cause: DomainEvent, stages = 1): void {
  record.stage = Math.max(0, record.stage + stages);
  record.history.push(cause.id);
  const limit = content.story.limits.relationshipHistory;
  // Keep the event that formed it and the latest ones.
  if (record.history.length > limit) record.history.splice(1, record.history.length - limit);
}

export function closeRelationship(record: RelationshipRecord): void {
  record.open = false;
}

/**
 * Makes a recurring enemy. Returns null when the run already has the limit
 * of enemy profiles, or the region already has its limit.
 */
export function createEnemyProfile(content: Content, run: RunState, profile: Omit<EnemyProfile, 'region' | 'battles' | 'adaptations'>): EnemyProfile | null {
  const { enemyProfilesPerRun, enemyProfilesPerRegion } = content.story.limits;
  const all = run.story.enemyProfiles;
  if (all.some((p) => p.id === profile.id)) return null;
  if (all.length >= enemyProfilesPerRun) return null;
  if (all.filter((p) => p.region === run.regionIndex).length >= enemyProfilesPerRegion) return null;
  const record: EnemyProfile = { ...profile, region: run.regionIndex, battles: [], adaptations: [] };
  all.push(record);
  return record;
}

export function recordEnemyBattle(content: Content, profile: EnemyProfile, event: DomainEvent, result: 'win' | 'lose'): void {
  profile.battles.push({ eventId: event.id, result, where: event.where });
  const limit = content.story.limits.enemyProfileBattles;
  if (profile.battles.length > limit) profile.battles.splice(0, profile.battles.length - limit);
}

// ---------- reading the story ----------

/** The chronicle's most memorable moments, most important first (the earlier one wins a tie). */
export function topMoments(story: StoryState, count = 5): ChronicleEntry[] {
  return [...story.chronicle].sort((a, b) => b.importance - a.importance || a.seq - b.seq).slice(0, count);
}
