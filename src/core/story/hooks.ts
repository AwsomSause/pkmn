// Where the run feeds the story layer. The run's actions (core/run.ts) call
// these after they have changed the run, so the story is a record of what
// really happened and never decides an outcome itself (Love's endure is
// decided by the battle engine; this file only tells its story).

import type { Side } from '../battle/engine';
import type { Content } from '../contentSchema';
import { CHAMPION_CLASS, ELITE_FOUR_CLASS, GYM_LEADER_CLASS } from '../encounters';
import { maxHp } from '../pokemon';
import { withStream } from '../rng';
import type { RunEvent } from '../run';
import { currentEnemy, type PokemonInstance, type RunState } from '../state';
import { applyStoryEffect, isBattleEffect } from './effects';
import { cooldownKey } from './ledger';
import { resolveQueue, type PresentationCue, type StoryTrigger } from './queue';
import { battleIndex, emit, noteFought, noteLowHpTurn, openHistory, whereNow } from './record';
import type { StoryEventDefinition, Where } from './schema';

const name = (content: Content, speciesId: string) => content.species.get(speciesId)?.name ?? speciesId;

function fill(text: string, names: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => names[key] ?? all);
}

export function definitionFor(content: Content, trigger: StoryEventDefinition['triggerConditions']['trigger']): StoryEventDefinition | undefined {
  return content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
}

const BOSS_ROLES: Record<string, string> = { [GYM_LEADER_CLASS]: 'Gym Leader', [ELITE_FOUR_CLASS]: 'Elite Four', [CHAMPION_CLASS]: 'Champion' };

// ---------- run start and map ----------

export function recordRunStarted(content: Content, run: RunState): void {
  emit(content, run, 'runStarted', { data: { archetypeId: run.archetypeId, campaignId: run.campaignId }, text: 'A new journey began' });
}

export function recordRouteChosen(content: Content, run: RunState, nodeId: string, harder: boolean, kind: string): void {
  emit(content, run, 'routeChosen', { data: { node: nodeId, harder, kind } });
}

/** A battle has just been set up (mutates `run`). */
export function recordBattleStarted(content: Content, run: RunState): void {
  const battle = run.battle!;
  run.story.majorCuesThisBattle = 0;
  const lead = run.party[battle.activeIndex]!;
  noteFought(run, lead.uid);
  emit(content, run, 'battleStarted', {
    actors: [lead.uid, ...battle.enemyTeam.map((m) => m.uid)],
    data: { kind: battle.kind, trainer: battle.trainer?.name ?? null, leaderId: battle.trainer?.leaderId ?? null, enemy: currentEnemy(battle).speciesId },
  });
}

export function recordRewardTaken(content: Content, run: RunState, rewardId: string): void {
  emit(content, run, 'rewardTaken', { data: { rewardId } });
}

export function recordReleased(content: Content, run: RunState, mon: PokemonInstance): void {
  emit(content, run, 'released', { actors: [mon.uid], data: { speciesId: mon.speciesId, level: mon.level } });
}

// ---------- one battle turn ----------

/**
 * Records a turn's story (mutates `run`, which is the run after the turn but
 * before the battle is cleared away) and returns the presentation cues for
 * it. `before` is the run before the turn; `events` is the full list the
 * battle screen will play, so cue positions match it.
 */
export function recordBattleTurn(content: Content, before: RunState, run: RunState, events: RunEvent[]): PresentationCue[] {
  const battle = run.battle!;
  const cfg = content.story;
  const prior = before.battle!;
  const where: Where = { ...whereNow(run), turn: prior.turn };
  const active: Record<Side, string | undefined> = { player: before.party[prior.activeIndex]?.uid, enemy: currentEnemy(prior).uid };
  const lastMove: Record<Side, string | null> = { player: null, enemy: null };
  const mon = (uid: string | undefined) => (uid ? run.party.find((m) => m.uid === uid) ?? battle.enemyTeam.find((m) => m.uid === uid) : undefined);
  const speciesOf = (uid: string | undefined) => {
    const m = mon(uid);
    return m ? name(content, m.speciesId) : '???';
  };
  const triggers: StoryTrigger[] = [];

  events.forEach((e, i) => {
    switch (e.type) {
      case 'move':
        lastMove[e.side] = e.moveId;
        emit(content, run, 'moveUsed', { where, actors: active[e.side] ? [active[e.side]!] : [], data: { side: e.side, moveId: e.moveId } });
        break;
      case 'switchIn':
        active[e.side] = e.uid;
        if (e.side === 'player') noteFought(run, e.uid);
        emit(content, run, 'switchIn', { where, actors: [e.uid], data: { side: e.side, speciesId: e.speciesId } });
        break;
      case 'switchOut':
        emit(content, run, 'switchOut', { where, actors: [e.uid], data: { side: e.side } });
        break;
      case 'status':
        emit(content, run, 'statusInflicted', { where, actors: active[e.side] ? [active[e.side]!] : [], data: { side: e.side, status: e.status } });
        break;
      case 'damage': {
        if (e.side !== 'player' || e.hpAfter <= 0) break;
        // A hit that was survived by enduring is told by that event instead.
        const next = events[i + 1];
        if (next && (next.type === 'endure' || next.type === 'lastStand') && next.side === 'player') break;
        const target = mon(active.player);
        if (!target || e.hpAfter > maxHp(content, target) * cfg.closeCallHpShare) break;
        const move = lastMove.enemy ? content.moves.get(lastMove.enemy)?.name ?? lastMove.enemy : 'an attack';
        emit(content, run, 'closeCall', {
          where,
          actors: [target.uid],
          data: { hpAfter: e.hpAfter, enemy: mon(active.enemy)?.speciesId ?? null },
          text: `Survived ${speciesOf(active.enemy)}'s ${move} with ${e.hpAfter} HP left`,
        });
        break;
      }
      case 'endure': {
        if (e.side !== 'player' || !active.player) break;
        emit(content, run, 'survivedFatal', { where, actors: [active.player], data: { cause: 'love', enemy: mon(active.enemy)?.speciesId ?? null } });
        const def = definitionFor(content, 'loveEndure');
        if (def) triggers.push(makeTrigger(run, def, i, triggers.length, { name: speciesOf(active.player), enemy: speciesOf(active.enemy) }));
        break;
      }
      case 'lastStand':
        if (e.side !== 'player' || !active.player) break;
        emit(content, run, 'survivedFatal', {
          where,
          actors: [active.player],
          data: { cause: 'lastStand', itemId: e.itemId },
          text: `Hung on with the ${content.items.get(e.itemId)?.name ?? 'charm'} against ${speciesOf(active.enemy)}`,
        });
        break;
      case 'faint': {
        const other: Side = e.side === 'player' ? 'enemy' : 'player';
        const by = active[other];
        const move = lastMove[other];
        emit(content, run, 'knockout', {
          where,
          actors: by ? [e.uid, by] : [e.uid],
          data: { side: e.side, moveId: move, speciesId: mon(e.uid)?.speciesId ?? null },
          text: e.side === 'player' ? `Fainted to ${speciesOf(by)}` : `Knocked out ${speciesOf(e.uid)}`,
        });
        break;
      }
      case 'levelUp':
        emit(content, run, 'levelUp', { where, actors: [e.uid], data: { level: e.level } });
        break;
      default:
        break;
    }
  });

  // End of turn: a low-HP stand grows or ends.
  const lead = run.party[battle.activeIndex];
  if (lead && !battle.outcome) noteLowHpTurn(run, lead.uid, lead.hp > 0 && lead.hp <= maxHp(content, lead) * cfg.lowHpShare);

  const cues = resolveTriggers(content, run, triggers, where);
  if (battle.outcome) recordBattleEnd(content, run, where);
  return cues;
}

function makeTrigger(run: RunState, def: StoryEventDefinition, at: number, order: number, names: Record<string, string>): StoryTrigger {
  const line = def.messagePool.length === 1 ? def.messagePool[0]! : withStream(run.rng, 'story', (r) => r.pick(def.messagePool));
  return {
    defId: def.id,
    title: def.displayName,
    message: fill(line, names),
    priority: def.priority,
    combat: def.effect !== null,
    at,
    cue: def.visualCue,
    order,
    names,
  };
}

/** Runs the event queue over the turn's triggers: effects, memories and cues. */
function resolveTriggers(content: Content, run: RunState, triggers: StoryTrigger[], where: Where): PresentationCue[] {
  if (triggers.length === 0) return [];
  const budgetLeft = content.story.majorCuesPerBattle - run.story.majorCuesThisBattle;
  const result = resolveQueue(triggers, budgetLeft);
  run.story.majorCuesThisBattle += result.majorUsed;
  const actor = run.party[run.battle!.activeIndex]?.uid;
  const tell = (t: StoryTrigger, suppressed: boolean) => {
    const def = content.story.definitions.find((d) => d.id === t.defId)!;
    const event = emit(content, run, 'storyMoment', {
      where,
      actors: actor ? [actor] : [],
      data: { def: def.id, suppressed },
      importance: def.memoryRecord?.importance ?? 0,
      text: def.memoryRecord ? fill(def.memoryRecord.text, t.names) : undefined,
    });
    // Effects the engine has not already applied (Love's endure is decided in the engine).
    if (!suppressed && def.effect && def.effect.kind !== 'endure' && actor) {
      const id = isBattleEffect(def.effect) ? cooldownKey(def, actor) : `${event.id}:${def.id}`;
      applyStoryEffect(content, run, id, def.effect, actor);
    }
  };
  for (const t of result.resolved) tell(t, false);
  for (const t of result.suppressed) tell(t, true);
  return result.cues;
}

/** The battle's outcome: boss wins and losses, and how close it was. */
function recordBattleEnd(content: Content, run: RunState, where: Where): void {
  const battle = run.battle!;
  const index = battleIndex(run);
  const fought = Object.values(run.story.histories)
    .filter((h) => h.lastBattle === index && run.party.some((m) => m.uid === h.uid))
    .map((h) => h.uid);
  const totalHp = run.party.reduce((sum, m) => sum + maxHp(content, m), 0);
  const hpLeft = run.party.reduce((sum, m) => sum + m.hp, 0);
  const result = battle.outcome!;
  emit(content, run, 'battleEnded', {
    where,
    actors: fought,
    data: { result, kind: battle.kind, turns: battle.turn - 1, hpLeftShare: totalHp > 0 ? Math.round((hpLeft / totalHp) * 100) / 100 : 0 },
  });
  const trainer = battle.trainer;
  const role = trainer?.leaderId ? BOSS_ROLES[trainer.classId] : undefined;
  if (!trainer || !role) return;
  if (result === 'win') {
    emit(content, run, 'bossBeaten', {
      where,
      actors: fought,
      data: { leaderId: trainer.leaderId, role: trainer.classId, name: trainer.name },
      text: `Defeated ${role} ${trainer.name}`,
    });
  } else if (result === 'lose') {
    emit(content, run, 'lostToBoss', {
      where,
      actors: fought,
      data: { leaderId: trainer.leaderId, role: trainer.classId, name: trainer.name },
      text: `Lost to ${role} ${trainer.name}`,
    });
  }
}

/** After a catch: the caught Pokémon (waiting for its party decision) gets its event. */
export function recordCaught(content: Content, run: RunState, mon: PokemonInstance): void {
  emit(content, run, 'caught', {
    actors: [mon.uid],
    data: { speciesId: mon.speciesId, level: mon.level, shiny: mon.shiny },
    importance: mon.shiny ? 70 : undefined,
    text: `Caught ${mon.shiny ? 'a shiny ' : ''}${name(content, mon.speciesId)} (Lv${mon.level})`,
  });
}

// ---------- changes between two states ----------

/**
 * Records what changed between `before` and `run` (mutates `run`): Pokémon
 * that joined or left, evolutions, friendship milestones, and the end of the
 * run. `evolutionTrigger` says what caused any evolution (battle, item, reward).
 */
export function recordChanges(content: Content, before: RunState, run: RunState, evolutionTrigger: string): void {
  const old = new Map(before.party.map((m) => [m.uid, m]));
  const now = new Set(run.party.map((m) => m.uid));
  for (const mon of run.party) {
    const prev = old.get(mon.uid);
    if (!prev) {
      const starter = mon.uid === run.log.starterUid && !before.log.starterUid;
      const caught = before.pending.some((d) => d.kind === 'caught' && d.mon.uid === mon.uid);
      openHistory(content, run, mon.uid, mon.speciesId, starter ? 'starter' : caught ? 'caught' : 'gift');
      if (starter) emit(content, run, 'starterChosen', { actors: [mon.uid], data: { speciesId: mon.speciesId }, text: 'Chosen as your starter' });
      else emit(content, run, 'joinedParty', { actors: [mon.uid], data: { speciesId: mon.speciesId, how: caught ? 'caught' : 'gift' }, text: `Joined your team as a ${name(content, mon.speciesId)}` });
      continue;
    }
    if (prev.speciesId !== mon.speciesId) {
      emit(content, run, 'evolved', {
        actors: [mon.uid],
        data: { from: prev.speciesId, to: mon.speciesId, trigger: evolutionTrigger },
        text: `Evolved from ${name(content, prev.speciesId)} into ${name(content, mon.speciesId)}`,
      });
    }
    for (const mark of content.story.friendshipMilestones) {
      if (prev.friendship < mark && mon.friendship >= mark) {
        emit(content, run, 'friendshipMilestone', { actors: [mon.uid], data: { value: mark }, text: `Its friendship with you reached ${mark}` });
      }
    }
  }
  for (const prev of before.party) {
    if (!now.has(prev.uid)) emit(content, run, 'leftParty', { actors: [prev.uid], data: { speciesId: prev.speciesId }, text: `Left your team` });
  }
  if (before.phase !== 'over' && run.phase === 'over') recordRunEnded(content, run);
}

function recordRunEnded(content: Content, run: RunState): void {
  const by = run.log.defeatedBy;
  const text = run.victory
    ? 'Conquered every region'
    : by
      ? `The journey ended against ${by.trainer ? `${by.trainer}'s ` : ''}${name(content, by.speciesId)}`
      : 'The journey ended';
  emit(content, run, 'runEnded', {
    actors: run.party.map((m) => m.uid),
    data: { victory: run.victory, regionsCleared: run.regionsCleared.length, badges: run.badges.length },
    text,
  });
}

/** Debug and old saves: makes sure every party Pokémon has a history (mutates `run`). */
export function ensureHistories(content: Content, run: RunState): void {
  for (const mon of run.party) openHistory(content, run, mon.uid, mon.speciesId, mon.uid === run.log.starterUid ? 'starter' : 'gift');
}
