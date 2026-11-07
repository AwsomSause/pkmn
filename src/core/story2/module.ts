// Story Overhaul S5: the backstory module loader. A Story Run picks one enabled backstory (S2 will let the player choose; until then the seed does),
// and this file plays that module: the intro scene, its events (arcs one step at a time), the echo events, and the ending the module's grid picks.
// Scenes play on Story Stops (the Director's `playStop` calls `queueStopScene`). Pure and deterministic: the only roll (the module's hidden flags) uses
// its own seeded stream, and nothing here touches battle rules or gameplay RNG. Outcomes never depend on the screen that shows a scene.

import { gainCharge } from './feats';
import type { Content } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import type { Profile, RunState } from '../state';
import { change, freshRecord, meet, ATTRS, type Attr } from './relationships';
import { resolveVariant, scoreCond, type ResolveContext, type ResolveCond } from './resolver';
import { foldKeepsakes, foldStarterMastery, markKeepsake } from './keepsakes';
import { dueRivalScene, epilogueRivalScene } from './rivalPlan';
import { renderTemplate } from './templates';
import { pronounForms, type PronounSet } from './identity';
import { emit } from '../story/record';
import type { StoryData, StoryEvent, StoryV2 } from './schema';

type Eff = { id?: string; kind: string; [k: string]: unknown };
export type ModuleState = NonNullable<StoryV2['module']>;

/** Stops that already have their own scene (an evil beat, a gym leader, a Region Gate): the module never plays over them. */
const BUSY_TAGS = ['evil_beat', 'hideout', 'region_gate', 'leader_scene', 'finale'];

export interface StoryLine { speaker: string | null; text: string }
export interface StoryScene { eventId: string; kicker: string; lines: StoryLine[]; choices: { id: string; text: string }[]; ending: boolean }

const bounded = (n: number): number => Math.max(-99, Math.min(99, n));

// ---------- context and conditions ----------

export function resolveCtx(content: Content, run: RunState): ResolveContext {
  const v2 = run.story.v2;
  const rel: Record<string, Record<string, number>> = {};
  for (const [id, rec] of Object.entries(v2?.cast ?? {})) rel[id] = rec.attrs;
  const stop = v2?.blueprint?.stops.find((s) => s.id === v2.module?.activeStop);
  return { backstory: v2?.module?.backstory, flags: v2?.facts ?? {}, rel, act: stop?.act ?? v2?.blueprint?.stops[Math.max(0, (v2?.stops.index ?? 1) - 1)]?.act ?? 1, ...(v2?.starter ? { starter: { line: v2.starter.lineId, personality: v2.starter.temperament } } : {}) };
}

/** Every condition passes (an unknown kind never passes). An empty list always passes. */
export function condsPass(conds: readonly ResolveCond[], ctx: ResolveContext): boolean {
  return conds.every((c) => scoreCond(c, ctx) > 0);
}

// ---------- start ----------

/** The Gift beat's line when the story text has none. */
const GIFT_LINE = 'The Gift: your partner trots back with something it found along the way, a small worn satchel, and drops it at your feet.';

const moduleOf = (data: StoryData, id: string) => data.backstories.find((b) => b.id === id);
const eventOf = (data: StoryData, id: string): StoryEvent | undefined => data.events.find((e) => e.id === id);
export const enabledBackstories = (content: Content): string[] => content.balance.story.module.enabledBackstories.filter((id) => moduleOf(content.storyData, id));

/** Gives a fresh Story Run its backstory (the player's pick when S2 set one, else the seed's), rolls the module's hidden flags, and queues the intro. */
export function startBackstory(content: Content, run: RunState): void {
  const v2 = run.story.v2;
  if (!v2 || v2.module) return;
  const enabled = enabledBackstories(content);
  if (enabled.length === 0) return;
  const picked = v2.protagonist?.backstory;
  const id = picked && moduleOf(content.storyData, picked) ? picked : new Rng(hashSeed(`${run.seed}::story_backstory`)).pick(enabled);
  const m = moduleOf(content.storyData, id)!;
  v2.protagonist = { look: 'look_a', name: '', pronouns: 'they', ...v2.protagonist, backstory: id, ...(m.signatureProp ? { signatureProp: m.signatureProp } : {}) };
  const rng = new Rng(hashSeed(`${run.seed}::story_module::${id}`));
  for (const [k, n] of Object.entries(content.balance.story.module.starts[id] ?? {})) v2.facts[k] = n;
  for (const roll of content.balance.story.module.rolls[id] ?? []) v2.facts[roll.key] = rng.weighted(roll.options.map((o) => ({ item: o.value, weight: o.weight })));
  const intro = content.storyData.events.find((e) => e.backstory === id && e.tags.includes('intro'));
  v2.module = { backstory: id, queue: intro ? [intro.id] : [], active: null, activeStop: null, played: [], echoes: 0, lastSceneStop: 0, ending: null, chronicle: [], snapshots: [] };
  // The module's reception modifiers apply once, at the start.
  const mod = content.storyData.events.find((e) => e.backstory === id && e.tags.includes('modifier'));
  if (mod) applyEffects(content, run, mod.outputs as Eff[]);
  if (v2.module.queue.length > 0) v2.module.active = v2.module.queue.shift()!;
}

/** The player's (or a sim's) pick: switches a fresh run to this backstory (any module in the data, enabled or not) and restarts its module. Only before play begins. */
export function chooseBackstory(content: Content, run: RunState, id: string): void {
  const v2 = run.story.v2;
  if (!v2 || !moduleOf(content.storyData, id) || v2.module?.backstory === id) return;
  v2.module = undefined;
  v2.facts = {};
  v2.fired = [];
  v2.protagonist = { look: 'look_a', name: '', pronouns: 'they', ...v2.protagonist, backstory: id };
  startBackstory(content, run);
}

// ---------- effects (each effect id applies once) ----------

function addRelationship(run: RunState, character: string, attr: string, amount: number): void {
  const v2 = run.story.v2!;
  if (!(ATTRS as readonly string[]).includes(attr)) return;
  // `class_*` targets name a kind of person (every leader, every rival): kept as a pending shift for whoever of that kind the run meets.
  if (character.startsWith('class_')) {
    const k = `rel.${character}.${attr}`;
    v2.facts[k] = bounded((typeof v2.facts[k] === 'number' ? (v2.facts[k] as number) : 0) + amount);
    return;
  }
  const rec = (v2.cast[character] ??= freshRecord());
  meet(rec, v2.stops.index);
  change(rec, { [attr as Attr]: amount }, v2.stops.index, 'story');
}

export function applyEffects(content: Content, run: RunState, effects: readonly Eff[]): void {
  const v2 = run.story.v2;
  if (!v2) return;
  for (const e of effects) {
    if (e.id) {
      if (v2.fired.includes(e.id)) continue;
      v2.fired.push(e.id);
    }
    switch (e.kind) {
      case 'set_flag': v2.facts[String(e.key)] = e.value as string | number | boolean; break;
      case 'add_counter': {
        const k = String(e.counter);
        const [lo, hi] = content.balance.story.module.limits[k] ?? [-99, 99];
        v2.facts[k] = Math.max(lo, Math.min(hi, (typeof v2.facts[k] === 'number' ? (v2.facts[k] as number) : 0) + Number(e.amount ?? 0)));
        break;
      }
      case 'add_relationship': addRelationship(run, String(e.character), String(e.attr), Number(e.amount ?? 0)); break;
      case 'unlock': v2.facts[`unlock.${String(e.target)}`] = true; break;
      case 'unlock_lore': v2.facts[`lore.${String(e.lore)}`] = String(e.state ?? 'known'); break;
      case 'give_item': v2.facts[`item.${String(e.item)}`] = true; break; // the item itself is named, not built (limit in the status note)
      case 'add_memory': v2.facts[`mem.${String(e.memory)}`] = true; break;
      case 'chronicle': if (v2.module && !v2.module.chronicle.includes(String(e.entry))) v2.module.chronicle.push(String(e.entry)); break;
      default: break; // an unknown kind is ignored here; the content gate lists the kinds the loader knows
    }
  }
  void content;
}

// ---------- choosing the next scene ----------

const actTags = (e: StoryEvent): number[] => e.tags.map((t) => /^act(\d)$/.exec(t)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]));
const arcOf = (data: StoryData, eventId: string) => data.arcs.find((a) => a.steps.some((s) => s.event === eventId));
/** The earliest Act an event may play: its own act tags, else Act 2 for an arc (the road must be walked a little first), else Act 1. */
export const minActOf = (data: StoryData, e: StoryEvent): number => {
  const a = actTags(e);
  return a.length > 0 ? Math.min(...a) : arcOf(data, e.id) ? 2 : 1;
};

function eligible(content: Content, run: RunState, e: StoryEvent, act: number, ctx: ResolveContext): boolean {
  const m = run.story.v2!.module!;
  if (m.played.includes(e.id) || m.queue.includes(e.id)) return false;
  if (minActOf(content.storyData, e) > act) return false;
  if (!condsPass(e.requires as ResolveCond[], ctx)) return false;
  const arc = arcOf(content.storyData, e.id);
  if (arc) {
    const i = arc.steps.findIndex((s) => s.event === e.id);
    if (i > 0 && !m.played.includes(arc.steps[i - 1]!.event)) return false;
  }
  return true;
}

/** The ending id the module's grid picks for this run (first matching row wins; the last row is the catch-all). */
export function pickEnding(content: Content, run: RunState): string | null {
  const m = run.story.v2?.module;
  const mod = m && moduleOf(content.storyData, m.backstory);
  if (!mod) return null;
  const ctx = resolveCtx(content, run);
  return mod.endingGrid.find((r) => condsPass(r.when as ResolveCond[], ctx))?.ending ?? mod.catchAllEnding ?? null;
}
const endingEvent = (content: Content, ending: string): string | undefined => content.storyData.events.find((e) => e.id === `ev_${ending}`)?.id;

/** A Story Stop was reached: decide whether a module scene plays here (the intro and follow-ups first, then the next event, echoes late, the ending at the Epilogue). */
export function queueStopScene(content: Content, run: RunState, stopId: string): void {
  const v2 = run.story.v2;
  const m = v2?.module;
  const stop = v2?.blueprint?.stops.find((s) => s.id === stopId);
  if (!v2 || !m || !stop || m.active) return;
  if (stop.slotTags.includes('epilogue')) {
    if (m.ending) return;
    const ending = pickEnding(content, run);
    const ev = ending ? endingEvent(content, ending) : undefined;
    if (ending && ev) {
      m.ending = ending;
      v2.facts.ending = ending;
      m.active = ev;
      m.activeStop = stopId;
      // The ending counts the moment it is reached (the run may be finalized before the screen is read); the screen only shows it.
      commit(content, run, eventOf(content.storyData, ev)!, undefined);
      // The Primary rival's epilogue (beat 8) plays after the ending.
      const rv = epilogueRivalScene(content, run);
      if (rv && !m.played.includes(rv) && eventOf(content.storyData, rv)) m.queue.push(rv);
    }
    return;
  }
  if (stop.slotTags.some((t) => BUSY_TAGS.includes(t))) return;
  const index = v2.stops.index;
  if (m.queue.length > 0) {
    m.active = m.queue.shift()!;
    m.activeStop = stopId;
    return;
  }
  // A Stop built for rivals plays the next rival scene due (the Primary first), whatever the gap.
  // It follows the Stop's own module scene (if any) instead of taking its place.
  const rivalDue = stop.slotTags.includes('rival_beat') ? dueRivalScene(content, run, stop.act, true, m.played, m.queue) : null;
  const mod = moduleOf(content.storyData, m.backstory);
  if (!mod) {
    if (rivalDue) { m.active = rivalDue; m.activeStop = stopId; }
    return;
  }
  const ctx = { ...resolveCtx(content, run), act: stop.act };
  // The partner's own Starter arc (`arc_<Remembrance id>`) plays alongside any backstory: at Stops the backstory leaves free, and
  // at the quiet Stops between backstory scenes (it never moves the backstory's gap; its steps are Act-gated).
  const starterArc = v2.starter ? content.storyData.arcs.find((a) => a.id === `arc_${v2.starter!.lineId}`) : undefined;
  const ownPick = (): StoryEvent | undefined => (starterArc?.steps ?? []).map((s) => eventOf(content.storyData, s.event)).find((e) => !!e && eligible(content, run, e, stop.act, ctx));
  if (m.lastSceneStop > 0 && index - m.lastSceneStop <= content.balance.story.module.gapStops) {
    // A rival Stop's scene comes first, whatever the gap; else the Starter arc, else a quest arc that unlocks a Rare or
    // Exceptional line, may use the quiet Stop (neither moves the gap).
    const own = rivalDue ?? ownPick()?.id ?? questPick(content, run, stop.act, ctx)?.id;
    if (own) {
      m.active = own;
      m.activeStop = stopId;
    }
    return;
  }
  const slotEvent = v2.blueprint?.slots.find((s) => s.slot === stopId)?.event;
  const pool: string[] = [...mod.events];
  // The next step of an arc already begun is also a candidate, ahead of anything new.
  const next = mod.events.flatMap((id) => {
    const arc = arcOf(content.storyData, id);
    return arc ? arc.steps.map((s) => s.event) : [];
  }).filter((id) => !pool.includes(id));
  const order = [...(slotEvent && mod.events.includes(slotEvent) ? [slotEvent] : []), ...next, ...pool];
  let pick = order.map((id) => eventOf(content.storyData, id)).find((e) => !!e && eligible(content, run, e, stop.act, ctx) && !e.tags.includes('micro'));
  if (!pick && stop.act >= content.balance.story.module.echoFromAct && m.echoes < mod.echoEvents.length) {
    const echo = eventOf(content.storyData, mod.echoEvents[m.echoes]!);
    if (echo && condsPass(echo.requires as ResolveCond[], ctx)) pick = echo;
  }
  if (!pick) {
    // Nothing from the module: a Secondary or Friendly rival scene that is due may take the Stop, else the Starter arc's
    // next scene, else a quest arc scene.
    const due = rivalDue ?? dueRivalScene(content, run, stop.act, false, m.played, m.queue) ?? ownPick()?.id ?? questPick(content, run, stop.act, ctx)?.id;
    if (due) { m.active = due; m.activeStop = stopId; }
    return;
  }
  m.active = pick.id;
  m.activeStop = stopId;
  if (rivalDue) m.queue.push(rivalDue);
}

/** A stable per-run order for the quest arcs (a string hash; no RNG stream, so no roll ever moves). */
function questOrder(runId: string, id: string): number {
  let h = 2166136261;
  for (const ch of `${runId}:${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/**
 * A quest arc scene for a Stop the backstory and the Starter arc left free: the next scene of the quest arc already begun, else
 * the first scene of a new one. One quest arc at a time, and at most one started per Act from Act 2 (Design v2: at most one
 * non-Starter arc per Act). The last scene unlocks a Rare or Exceptional Remembrance line (data/story/questArcs.ts).
 */
function questPick(content: Content, run: RunState, act: number, ctx: ResolveContext): StoryEvent | undefined {
  const v2 = run.story.v2!;
  const quests = content.storyData.arcs.filter((a) => a.id.startsWith('arc_qa_'));
  const active = quests.find((a) => v2.arcs[a.id]?.state === 'active');
  if (active) return active.steps.map((s) => eventOf(content.storyData, s.event)).find((e) => !!e && eligible(content, run, e, act, ctx));
  const started = quests.filter((a) => v2.arcs[a.id]).length;
  if (started >= act - 1) return undefined;
  const fresh = quests.filter((a) => !v2.arcs[a.id]).sort((a, b) => questOrder(run.runId, a.id) - questOrder(run.runId, b.id));
  for (const a of fresh) {
    const e = eventOf(content.storyData, a.steps[0]!.event);
    if (e && eligible(content, run, e, act, ctx)) return e;
  }
  return undefined;
}

// ---------- the scene a player sees ----------

/** The pronoun tokens ({they}, {Their}, {they_are}...) for story text, from the run's protagonist (they/them when unset). */
const pronounValues = (pronouns: string | PronounSet | undefined): Record<string, string> => {
  const forms = pronounForms(pronouns);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(forms)) { out[k] = v; out[k[0]!.toUpperCase() + k.slice(1)] = v[0]!.toUpperCase() + v.slice(1); }
  return out;
};
const textOf = (data: StoryData, key: string | undefined, values: Record<string, string>): string => renderTemplate(key ? data.text[key] ?? '' : '', values);
const nameOf = (data: StoryData, id: string): string => {
  const c = data.characters.find((x) => x.id === id);
  return (c && data.text[c.nameKey]) || id.replace(/^ch_/, '').replace(/_/g, ' ');
};

/** The scene on screen right now, or null. Reads state only. */
export function activeScene(content: Content, run: RunState): StoryScene | null {
  const v2 = run.story.v2;
  const id = v2?.module?.active;
  const e = id ? eventOf(content.storyData, id) : undefined;
  if (!v2 || !e) return null;
  const data = content.storyData;
  const ctx = resolveCtx(content, run);
  const values: Record<string, string> = { ...pronounValues(v2.protagonist?.pronouns), player: v2.protagonist?.name || 'you', starter: v2.starter?.lineId.replace(/^rm_/, '') ?? 'your partner' };
  const lines: StoryLine[] = [];
  for (const b of e.beats) {
    const b2 = b as { line?: string; textKey?: string };
    if (b2.line) {
      const d = data.dialogue.find((x) => x.id === b2.line);
      if (d) lines.push({ speaker: nameOf(data, d.speaker), text: textOf(data, d.textKey, values) });
    } else if (b2.textKey) lines.push({ speaker: null, text: textOf(data, b2.textKey, values) });
  }
  // Each role's line: the best-matching variant (the one without conditions is the neutral line).
  for (const role of [...new Set(e.variants.map((v) => v.role))]) {
    const vs = e.variants.filter((v) => v.role === role);
    const neutral = vs.find((v) => v.when.length === 0) ?? vs[0]!;
    const best = resolveVariant(neutral.id, vs.map((v) => ({ id: v.id, when: v.when as ResolveCond[] })), ctx);
    const chosen = vs.find((v) => v.id === best) ?? neutral;
    const who = e.roles[role]?.character;
    lines.push({ speaker: who && who !== 'ch_vance' && role !== 'narrator' ? nameOf(data, who) : null, text: textOf(data, chosen.textKey, values) });
  }
  return {
    eventId: e.id,
    kicker: e.tags.includes('ending') ? 'The Ending' : e.tags.includes('rv_story') ? 'A Rival' : e.tags.includes('echo') ? 'An Echo' : e.tags.includes('intro') ? 'Your Story Begins' : `Act ${ctx.act ?? 1}`,
    lines: lines.filter((l) => l.text.length > 0),
    choices: e.choices.map((c) => ({ id: c.id, text: textOf(data, c.textKey, values) })),
    ending: e.tags.includes('ending'),
  };
}

/** Records a scene as played: its outputs (and the chosen option's effects) once, the arc step, a snapshot. Does not touch the screen state. */
function commit(content: Content, run: RunState, e: StoryEvent, choice: StoryEvent['choices'][number] | undefined): void {
  const v2 = run.story.v2!;
  const m = v2.module!;
  const scene = activeScene(content, run);
  if (choice) applyEffects(content, run, choice.effects as Eff[]);
  applyEffects(content, run, e.outputs as Eff[]);
  m.played.push(e.id);
  v2.scenesDone.push(e.id);
  if (e.tags.includes('echo')) m.echoes += 1;
  if (choice?.goto && eventOf(content.storyData, choice.goto) && !m.played.includes(choice.goto)) m.queue.push(choice.goto);
  const arc = arcOf(content.storyData, e.id);
  if (arc) {
    const i = arc.steps.findIndex((s) => s.event === e.id);
    const done = i === arc.steps.length - 1;
    v2.arcs[arc.id] = { state: done ? 'done' : 'active', step: i + 1, nodeCost: arc.nodeCost };
    // S7: a beat of the partner's own Starter arc (`arc_<line>`) adds Resolve Charge, once per beat.
    if (v2.starter && arc.id === `arc_${v2.starter.lineId}`) gainCharge(content, run, 'arc_beat', `${arc.id}:${i}`);
    if (done) {
      applyEffects(content, run, arc.effects as Eff[]);
      // Two exits: the first is the good one; a "sabotaged" or "none" flag named for the arc takes the last.
      const flag = v2.facts[arc.id.replace(/^arc_/, '')];
      const good = !(arc.exits.length > 1 && (flag === 'sabotaged' || flag === 'none'));
      v2.facts[`arc.${arc.id}`] = good ? arc.exits[0]! : arc.exits[arc.exits.length - 1]!;
      // "The Gift" beat (design Part II, Heartbond beats): after a questline ends well, the Starter brings back a small find.
      if (good && v2.heartbond.partner && !v2.facts['beat.gift']) {
        v2.facts['beat.gift'] = true;
        markKeepsake(run, 'gift');
        emit(content, run, 'storyMoment', { actors: [], data: { beat: 'gift', arc: arc.id }, importance: 40, text: content.storyData.text['hb.beat.gift'] ?? GIFT_LINE });
      }
    }
  }
  if (scene) {
    const text = scene.lines.map((l) => (l.speaker ? `${l.speaker}: ` : '') + l.text).join(' ').slice(0, 220);
    m.snapshots = [...m.snapshots, { event: e.id, stop: m.activeStop, act: resolveCtx(content, run).act ?? 0, text, choice: choice?.id ?? null }].slice(-content.balance.story.module.maxSnapshots);
  }
  // A Starter arc scene does not count toward the backstory's gap between scenes.
  if (!e.tags.includes('starter_arc') && !e.tags.includes('quest_arc')) m.lastSceneStop = v2.stops.index;
}

/** Finishes the scene on screen: commits it (an ending was committed when reached) and clears the screen state. A choice scene needs a valid choice. */
export function finishScene(content: Content, run: RunState, choiceId?: string): boolean {
  const m = run.story.v2?.module;
  const e = m?.active ? eventOf(content.storyData, m.active) : undefined;
  if (!m || !e) return false;
  if (!m.played.includes(e.id)) {
    const choice = e.choices.length > 0 ? e.choices.find((c) => c.id === choiceId) : undefined;
    if (e.choices.length > 0 && !choice) return false;
    commit(content, run, e, choice);
  }
  const stop = m.activeStop;
  m.active = null;
  m.activeStop = null;
  // After the ending, the scenes queued for the Epilogue play one after another (the screen asks for the next one).
  const head = m.queue[0];
  const rivalNext = !!head && !!eventOf(content.storyData, head)?.tags.includes('rv_story');
  if ((m.ending || rivalNext) && m.queue.length > 0) { m.active = m.queue.shift()!; m.activeStop = stop; }
  return true;
}

// ---------- run end: what the profile keeps ----------

/**
 * Folds the run's module results into the profile once (Remembrances unlocked, Lore learned, the ending seen, scene
 * snapshots), then the Starter's Remembrance Mastery and the Keepsakes (which read the folded Archive and Lore).
 * Called with the Chronicle. `storyData` gives the Grass-type lines for the Leaf Crown.
 */
export function foldModuleIntoProfile(profile: Profile, run: RunState, storyData?: Pick<StoryData, 'remembrances'>): void {
  foldModuleResults(profile, run);
  if (!run.story.v2) return;
  foldStarterMastery(profile, run);
  foldKeepsakes(profile, run, (storyData?.remembrances ?? []).filter((r) => r.types.includes('grass')).map((r) => r.id));
}

function foldModuleResults(profile: Profile, run: RunState): void {
  const v2 = run.story.v2;
  const m = v2?.module;
  if (!v2 || !m) return;
  const story = profile.story;
  for (const [k, v] of Object.entries(v2.facts)) {
    if (k.startsWith('unlock.rm_') && v === true) {
      const id = k.slice('unlock.'.length);
      const prev = story.remembrance[id];
      story.remembrance[id] = { state: 'unlocked', firstSeenRun: prev?.firstSeenRun ?? null, runs: prev?.runs ?? 0, mastery: prev?.mastery ?? 0 };
    } else if (k.startsWith('lore.') && typeof v === 'string') {
      const id = k.slice('lore.'.length);
      const state = (['rumor', 'known', 'verified', 'contested'] as const).find((s) => s === v) ?? 'known';
      const prev = story.lore[id];
      if (!prev || ['rumor', 'known', 'verified', 'contested'].indexOf(state) > ['rumor', 'known', 'verified', 'contested'].indexOf(prev.state)) story.lore[id] = { state, sources: prev?.sources ?? [] };
    }
  }
  if (m.ending && !story.endingsSeen.includes(m.ending)) story.endingsSeen = [...story.endingsSeen, m.ending].slice(-60);
  if (m.snapshots.length > 0 && !story.sceneSnapshots.some((s) => (s as { runId?: string }).runId === run.runId)) {
    story.sceneSnapshots = [...story.sceneSnapshots, ...m.snapshots.map((s) => ({ ...s, runId: run.runId, backstory: m.backstory }))].slice(-60);
  }
}
