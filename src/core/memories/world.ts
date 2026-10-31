// Persistent World (APPROVED.md §8) and Branch Memory / Old Friend Cameo (§3): the run remembers the roads and stops
// you passed by (they come back as an Echo), helping or turning someone away (it comes back as thanks or a grudge),
// a villain operation that runs across stages and can be foiled, a recurring NPC with a plan that follows how you treat
// people, and old friends from earlier runs. Only a handful of memories are kept. Nothing here rolls a gameplay stream:
// every pick is a hash of the run's seed and the stage.

import type { Content } from '../contentSchema';
import { scheduleKey } from '../rivals/adapt';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import { applyStoryEffect } from '../story/effects';
import { emit } from '../story/record';
import { grantKeepsake } from './keepsakes';
import { MEMORIES, type Consequence, type WorldMemory } from './schema';

const world = (run: RunState): WorldMemory => run.story.world;
const tell = (content: Content, run: RunState, def: string, text: string, importance = 60) => emit(content, run, 'storyMoment', { actors: [], data: { def, suppressed: false }, importance, text });

// ---------- Branch Memory ----------

/**
 * Called as a stage ends (before the next one replaces it): side stops left unused on the route you walked, and the
 * harder road when you took the easy one, are remembered. Each comes back as an Echo a stage or two later.
 */
export function noteSkips(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.visited.length === 0) return;
  const w = world(run);
  const found: { kind: WorldMemory['skipped'][number]['kind']; label: string }[] = [];
  for (const id of stage.visited) {
    const node = stage.map.nodes.find((n) => n.id === id);
    if (!node) continue;
    for (const side of node.sides) {
      if (side.used || side.hidden) continue;
      if (side.kind === 'event') found.push({ kind: 'event', label: side.eventId ? (content.events.get(side.eventId)?.name ?? 'an event') : 'an event' });
      else if (side.kind === 'minigame' || side.kind === 'expedition' || side.kind === 'service') found.push({ kind: side.kind, label: `a ${side.kind} stop` });
    }
    const other = stage.map.nodes.find((n) => n.column === node.column && n.id !== node.id && n.harder && !node.harder && !stage.visited.includes(n.id));
    if (other) found.push({ kind: 'harder', label: 'the harder road' });
  }
  const here = scheduleKey(run);
  for (const f of found.slice(0, MEMORIES.world.perStage)) {
    const id = `echo:${run.regionIndex}.${stage.index}.${w.skipped.length}`;
    w.skipped = [...w.skipped, { id, kind: f.kind, label: f.label, region: run.regionIndex, stage: stage.index }].slice(-MEMORIES.world.skippedKeep);
    w.consequences.push({ id, kind: 'echo', text: `An echo of ${f.label} you passed by earlier: word got around that you skipped it, and someone is here to prove you wrong.`, due: here + MEMORIES.world.echoDelay + 1, done: false });
  }
}

/** The Echo that has come due (the oldest), or null. */
export function dueEcho(run: RunState): Consequence | null {
  const now = scheduleKey(run);
  return world(run).consequences.find((c) => c.kind === 'echo' && !c.done && c.due <= now) ?? null;
}

// ---------- Choices Have Delayed Consequences ----------

/** An event choice just resolved. A clear kindness or cruelty comes back later; turning away is remembered; the villain operation gains a clue. */
export function noteChoice(content: Content, run: RunState, eventName: string, effects: readonly { kind: string; key?: string; amount?: number }[], risky: boolean): void {
  const w = world(run);
  const shift = effects.reduce((sum, e) => sum + (e.kind === 'attribute' && e.key === 'goodEvil' ? (e.amount ?? 0) : 0), 0);
  const here = scheduleKey(run);
  const id = (kind: string) => `${kind}:${run.regionIndex}.${run.stage?.index ?? 0}.${run.encountersCompleted}`;
  if (shift >= MEMORIES.world.moralityAt) {
    w.helped += 1;
    w.consequences.push({ id: id('thanks'), kind: 'thanks', text: `Word of your kindness at "${eventName}" reached someone who wanted to thank you.`, due: here + MEMORIES.world.thanksDelay, done: false });
  } else if (shift <= -MEMORIES.world.moralityAt) {
    w.consequences.push({ id: id('grudge'), kind: 'grudge', text: `What you did at "${eventName}" was not forgotten, and the toll catches up with you.`, due: here + MEMORIES.world.thanksDelay, done: false });
  } else if (effects.length === 0 && !risky) {
    w.declined += 1;
  }
  const op = Object.values(w.ops).find((o) => o.outcome === 'running');
  if (op) op.clues += 1;
}

// ---------- the start of a stage ----------

const pick = <T,>(rng: Rng, list: readonly T[]): T => list[rng.int(0, list.length - 1)]!;

/** Called as a new stage begins: due thanks and grudges, the villain operation, the recurring NPC, an old friend. */
export function worldStageStart(content: Content, run: RunState): void {
  const w = world(run);
  const now = scheduleKey(run);
  for (const c of w.consequences) {
    if (c.done || c.kind === 'echo' || c.due > now) continue;
    c.done = true;
    if (c.kind === 'thanks') {
      applyStoryEffect(content, run, `world:${c.id}`, { kind: 'money', amount: MEMORIES.world.thanksMoney });
      tell(content, run, 'world-thanks', `${c.text} (+₽${MEMORIES.world.thanksMoney})`, 65);
    } else {
      const amount = Math.min(run.money, MEMORIES.world.grudgeMoney);
      applyStoryEffect(content, run, `world:${c.id}`, { kind: 'money', amount: -amount });
      tell(content, run, 'world-grudge', `${c.text} (-₽${amount})`, 55);
    }
  }
  worldOperation(content, run);
  worldNpc(content, run);
  oldFriend(content, run);
}

/** A villain operation runs across three stages: a hint each stage, then it succeeds or you foil it (enough clues from events). */
function worldOperation(content: Content, run: RunState): void {
  const w = world(run);
  const cfg = MEMORIES.ops;
  const running = Object.entries(w.ops).find(([, o]) => o.outcome === 'running');
  if (running) {
    const [id, o] = running;
    const def = MEMORIES.operations.find((x) => x.id === id);
    if (!def) return;
    if (o.step < def.steps.length) {
      tell(content, run, 'world-operation', `${def.org} (${def.name}): ${def.steps[o.step]}${o.clues > 0 ? ` You have ${o.clues} clue${o.clues === 1 ? '' : 's'}.` : ''}`, 55);
      o.step += 1;
      return;
    }
    if (o.clues >= cfg.clues) {
      o.outcome = 'foiled';
      applyStoryEffect(content, run, `op:${id}`, { kind: 'money', amount: cfg.reward });
      tell(content, run, 'world-operation-foiled', `${def.foiled} (+₽${cfg.reward})`, 80);
    } else {
      o.outcome = 'succeeded';
      const loss = Math.min(cfg.lossMax, Math.floor(run.money * cfg.loss));
      applyStoryEffect(content, run, `op:${id}`, { kind: 'money', amount: -loss });
      tell(content, run, 'world-operation-succeeded', `${def.succeeded} (-₽${loss})`, 70);
    }
    return;
  }
  // A new operation starts at the first stage of a region, once per region, picked by a hash.
  if ((run.stage?.index ?? 0) !== 0 || run.regionIndex < 1) return;
  const rng = new Rng(hashSeed(`${run.seed}::operation::${run.regionIndex}`));
  const fresh = MEMORIES.operations.filter((o) => !w.ops[o.id]);
  if (fresh.length === 0 || rng.float() >= cfg.start) return;
  const def = pick(rng, fresh);
  w.ops[def.id] = { step: 0, clues: 0, outcome: 'running' };
  worldOperation(content, run);
}

/** A recurring NPC with a plan: one beat in each of the first three regions, kinder or colder by how you treated people. */
function worldNpc(content: Content, run: RunState): void {
  if ((run.stage?.index ?? 0) !== 1 || run.regionIndex > 2) return;
  const w = world(run);
  const npc = pick(new Rng(hashSeed(`${run.seed}::npc`)), MEMORIES.npcs);
  const beat = run.regionIndex;
  if ((w.npcs[npc.id] ?? -1) >= beat) return;
  w.npcs[npc.id] = beat;
  const warm = w.helped >= w.declined;
  tell(content, run, 'world-npc', `${warm ? npc.beats[beat] : npc.badBeats[beat]}`, 50);
  if (warm && beat >= 1) applyStoryEffect(content, run, `npc:${npc.id}:${beat}`, { kind: 'money', amount: npc.money });
  if (warm && beat === 2 && !run.story.appliedEffects.includes(`npc:${npc.id}:item`) && grantKeepsake(content, run, npc.item)) run.story.appliedEffects.push(`npc:${npc.id}:item`);
}

/** Old Friend Cameo: once in a while a rival or Pokémon from an earlier run turns up, and says so. */
function oldFriend(content: Content, run: RunState): void {
  const past = run.past;
  if (!past || past.friends.length === 0 || (run.stage?.index ?? 0) !== 1) return;
  const key = `cameo:${run.regionIndex}`;
  if (run.story.flags[key]) return;
  run.story.flags[key] = true;
  const rng = new Rng(hashSeed(`${run.seed}::cameo::${run.regionIndex}`));
  const fresh = past.friends.filter((f) => !past.used.includes(f.id));
  if (fresh.length === 0 || rng.float() >= MEMORIES.cameo.chance) return;
  const friend = pick(rng, fresh);
  past.used.push(friend.id);
  applyStoryEffect(content, run, `cameo:${friend.id}:money`, { kind: 'money', amount: MEMORIES.cameo.money });
  const lead = run.party[0];
  if (lead) applyStoryEffect(content, run, `cameo:${friend.id}:friend`, { kind: 'friendship', amount: MEMORIES.cameo.friendship }, lead.uid);
  tell(content, run, 'world-cameo', `${friend.name} turns up on the road: "${friend.line}" (+₽${MEMORIES.cameo.money})`, 70);
}
