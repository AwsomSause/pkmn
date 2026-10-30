// Where the run feeds the story layer. The run's actions (core/run.ts) call
// these after they have changed the run, so the story is a record of what
// really happened and never decides an outcome itself (Hyper moments are
// decided by the battle engine; this file only tells their story).

import type { Side } from '../battle/engine';
import { applyMastery } from '../mastery';
import type { Content } from '../contentSchema';
import { CHAMPION_CLASS, ELITE_FOUR_CLASS, GYM_LEADER_CLASS } from '../encounters';
import { maxHp } from '../pokemon';
import { withStream } from '../rng';
import type { RunEvent } from '../run';
import { currentEnemy, type PokemonInstance, type RunState } from '../state';
import { applyStoryEffect, isBattleEffect } from './effects';
import { friendlyRivalsOf, HYPER_EFFECTS } from './hyper';
import { cooldownKey } from './ledger';
import { resolveQueue, type PresentationCue, type StoryTrigger } from './queue';
import { RIVAL_PATHS } from '../rivals/schema';
import { maybeSpark, sparkGain } from '../rivals/manager';
import { onBossBeaten, onRivalDefeated, pathContext } from '../rivals/standing';
import { advanceArc } from '../rivals/arcs';
import { afterBattleBehavior } from '../rivals/bonds';
import { applyDefeat } from '../rivals/outcome';
import { triangleEffect } from '../rivals/relations';
import { evaluateUltimate } from '../rivals/ultimate';
import { battleIndex, createEnemyProfile, emit, noteFought, noteLowHpTurn, openHistory, openRelationship, recordEnemyBattle, whereNow } from './record';
import { rematchRule, returnFlag, vowedTrainers } from './returns';
import { emotionOf } from './emotions';
import { advanceChains } from './chains';
import { graduateMentorships } from './mentorship';
import { awardLegacyTitles, recordEpitaph } from './legacy';
import { clearMomentFlags, detectMoments } from './moments';
import type { StoryEventDefinition, StoryTriggerKind, Where } from './schema';

const ENGINE_EFFECTS = new Set<string>(Object.values(HYPER_EFFECTS));

const name = (content: Content, speciesId: string) => content.species.get(speciesId)?.name ?? speciesId;

function fill(text: string, names: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => names[key] ?? all);
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

  /** Friendly Competition: two teammates take turns landing finishing blows (counted across the run). */
  const noteFinisher = (by: string, at: number) => {
    const def = content.story.definitions.find((d) => d.triggerConditions.trigger === 'friendlyCompetition');
    if (!def) return;
    const last = run.story.flags.lastFinisher;
    run.story.flags.lastFinisher = by;
    const a = run.story.histories[by];
    const b = typeof last === 'string' && last !== by && run.party.some((m) => m.uid === last) ? run.story.histories[last] : undefined;
    if (!a || !b || !run.party.some((m) => m.uid === by)) return;
    const trades = (a.finishTrades[b.uid] ?? 0) + 1;
    a.finishTrades[b.uid] = trades;
    b.finishTrades[a.uid] = trades;
    if (trades < (def.triggerConditions.trades ?? Infinity) || friendlyRivalsOf(run, by).includes(b.uid)) return;
    const cause = emit(content, run, 'rivalryFormed', {
      where,
      actors: [a.uid, b.uid],
      data: { kind: 'friendly' },
      text: `Started a friendly competition with ${speciesOf(b.uid)}`,
    });
    if (!openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: a.uid }, { kind: 'pokemon', id: b.uid }, cause)) return;
    triggers.push({ ...makeTrigger(run, def, at, triggers.length, { name: speciesOf(a.uid), other: speciesOf(b.uid) }, null, a.uid), combat: false });
  };

  events.forEach((e, i) => {
    switch (e.type) {
      case 'move':
        lastMove[e.side] = e.moveId;
        emit(content, run, 'moveUsed', { where, actors: active[e.side] ? [active[e.side]!] : [], data: { side: e.side, moveId: e.moveId } });
        if (e.side === 'player' && active.player) {
          const t = signatureMove(content, run, active.player, e.moveId, i, triggers.length, battle.kind === 'trainer');
          if (t) triggers.push(t);
        }
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
        if (next && (next.type === 'hyper' || next.type === 'lastStand') && next.side === 'player') break;
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
      case 'hyper': {
        const def = content.story.definitions.find((d) => d.id === e.defId);
        if (!def) break;
        if (e.side === 'enemy') {
          // The enemy's rage: told from its side ({enemy} is your Pokémon). The engine keeps its own
          // one-per-turn limit for each side, so it never competes with your moment in the queue.
          const t = makeTrigger(run, def, i, triggers.length, { name: speciesOf(e.uid), enemy: speciesOf(active.player) }, e.variant, e.uid);
          triggers.push({ ...t, side: 'enemy', combat: false });
          break;
        }
        const history = run.story.histories[e.uid];
        if (history) history.hyper[def.id] = (history.hyper[def.id] ?? 0) + 1;
        const kind = def.effect?.kind;
        if (!e.cured && (kind === 'endure' || kind === 'endureOrCure' || kind === 'revive')) {
          emit(content, run, 'survivedFatal', { where, actors: [e.uid], data: { cause: def.id, enemy: mon(active.enemy)?.speciesId ?? null } });
        }
        const move = lastMove.enemy ? content.moves.get(lastMove.enemy)?.name ?? lastMove.enemy : 'attack';
        const t = makeTrigger(run, def, i, triggers.length, { name: speciesOf(e.uid), enemy: speciesOf(active.enemy), other: speciesOf(active.player), move }, e.variant, e.uid);
        if (def.effect?.kind !== 'rivalry') {
          triggers.push(t);
          break;
        }
        // Rivalry lines change no HP or status, so they never compete with a knockout save in the queue.
        triggers.push({ ...t, combat: false });
        const foe = mon(active.enemy);
        if (def.triggerConditions.trigger === 'heatedRivalry' && e.variant === null && foe) {
          const cause = emit(content, run, 'rivalryFormed', {
            where,
            actors: [e.uid],
            data: { kind: 'heated', speciesId: foe.speciesId },
            text: `Formed a heated rivalry with ${name(content, foe.speciesId)}`,
          });
          openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: e.uid }, { kind: 'enemy', id: `species:${foe.speciesId}` }, cause);
        }
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
        // Justice: knocking out the foe that knocked out one of your Pokémon.
        const avenged = e.side === 'enemy' && run.story.events.some((k) => k.type === 'knockout' && k.data.side === 'player' && k.actors[1] === e.uid);
        emit(content, run, 'knockout', {
          where,
          actors: by ? [e.uid, by] : [e.uid],
          data: { side: e.side, moveId: move, speciesId: mon(e.uid)?.speciesId ?? null, bySpeciesId: mon(by)?.speciesId ?? null },
          text: e.side === 'player' ? `Fainted to ${speciesOf(by)}` : avenged ? `Avenged a fallen teammate by knocking out ${speciesOf(e.uid)}` : `Knocked out ${speciesOf(e.uid)}`,
          importance: avenged ? content.story.importance.closeCall : undefined,
          emotions: avenged ? ['justice'] : undefined,
        });
        if (e.side === 'enemy' && by) noteFinisher(by, i);
        if (avenged && by) advanceChains(content, run, 'avenged', by);
        break;
      }
      case 'levelUp':
        emit(content, run, 'levelUp', { where, actors: [e.uid], data: { level: e.level } });
        break;
      case 'transform':
        if (e.side === 'player') active.player = e.uid;
        if (e.kind === 'ability' || e.kind === 'illusion') break;
        emit(content, run, 'transformed', {
          where,
          actors: [e.uid],
          data: { side: e.side, kind: e.kind, from: e.from, to: e.to },
          // Only your own Pokémon's transformations become memories.
          text: e.side === 'player' ? `${e.kind === 'primal' ? 'Underwent Primal Reversion into' : 'Mega Evolved into'} ${name(content, e.to)}` : undefined,
        });
        if (e.side === 'player') {
          const t = transformMoment(content, run, e, i, triggers.length, battle.trainer?.classId ?? null);
          if (t) triggers.push(t);
        }
        break;
      default:
        break;
    }
  });

  // End of turn: a low-HP stand grows or ends.
  const lead = run.party[battle.activeIndex];
  if (lead && !battle.outcome) noteLowHpTurn(run, lead.uid, lead.hp > 0 && lead.hp <= maxHp(content, lead) * cfg.lowHpShare);

  if (battle.outcome === 'win') trainerVow(content, run, triggers, events.length - 1, where);
  for (const m of detectMoments(content, before, run, events)) {
    const def = content.story.definitions.find((d) => d.triggerConditions.trigger === m.trigger)!;
    triggers.push({ ...makeTrigger(run, def, m.at, triggers.length, m.names, null, m.uid), side: m.side, combat: false });
  }
  const cues = resolveTriggers(content, run, triggers, where);
  if (battle.outcome) {
    recordBattleEnd(content, run, where);
    awardLegacyTitles(content, run);
    clearMomentFlags(run);
  }
  return cues;
}

/** Which Hyper evolution a battle transformation can be (Overdrive blueprint §4). Primal Reversion has none. */
const TRANSFORM_TRIGGER: Record<string, StoryTriggerKind> = {
  mega: 'megaOverdrive',
  zmove: 'zHeart',
  dynamax: 'dynamaxResolve',
  gigantamax: 'dynamaxResolve',
  tera: 'teraTrueColors',
};

/**
 * A Mega Overdrive, "All of Its Heart", "A Giant Resolve" or "Its True Colors Shine Through!": the
 * normal transformation rules decide everything; this only adds the banner, the line and a memory,
 * and only when the moment is decisive (a boss fight or the Pokémon at half HP) or, for the Z-Move,
 * the bond is strong. It draws no random numbers and never grants a second use.
 */
function transformMoment(content: Content, run: RunState, e: Extract<RunEvent, { type: 'transform' }>, at: number, order: number, classId: string | null): StoryTrigger | null {
  const trigger = TRANSFORM_TRIGGER[e.kind];
  const def = trigger && content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
  const mon = run.party.find((m) => m.uid === e.uid);
  if (!def || !mon) return null;
  const cond = def.triggerConditions;
  if (cond.minFriendship !== undefined && mon.friendship < cond.minFriendship) return null;
  const boss = classId === GYM_LEADER_CLASS || classId === ELITE_FOUR_CLASS || classId === CHAMPION_CLASS;
  if (cond.decisive && !boss && mon.hp > maxHp(content, mon) / 2) return null;
  const history = run.story.histories[e.uid];
  if (history) history.hyper[def.id] = (history.hyper[def.id] ?? 0) + 1;
  const emotion = trigger === 'teraTrueColors' ? emotionOf(content, run, e.uid)?.id : undefined;
  const variant = emotion && def.variants[emotion] ? emotion : null;
  return { ...makeTrigger(run, def, at, order, { name: name(content, mon.speciesId), type: e.teraType ?? '' }, variant, e.uid), combat: false };
}

/**
 * Signature Move Awakening ("It Mastered the Power Within!"): a damaging move used again and again in
 * trainer fights awakens for the rest of the run and hits harder. Counting is deterministic, uses no
 * random numbers and keeps the move's rules (type, accuracy, PP) as they were.
 */
function signatureMove(content: Content, run: RunState, uid: string, moveId: string, at: number, order: number, trainerFight: boolean): StoryTrigger | null {
  const def = content.story.definitions.find((d) => d.triggerConditions.trigger === 'signatureAwakening');
  const move = content.moves.get(moveId);
  const mon = run.party.find((m) => m.uid === uid);
  const history = run.story.histories[uid];
  const cfg = content.story.awakening;
  if (!def || !move || !mon || !history || !trainerFight || !move.power || mon.awakened?.includes(moveId)) return null;
  history.moves[moveId] = (history.moves[moveId] ?? 0) + 1;
  if (history.moves[moveId]! < cfg.uses || (mon.awakened?.length ?? 0) >= cfg.perPokemon || !mon.moves.some((m) => m.id === moveId)) return null;
  mon.awakened = [...(mon.awakened ?? []), moveId];
  history.hyper[def.id] = (history.hyper[def.id] ?? 0) + 1;
  const names = { name: name(content, mon.speciesId), move: move.name };
  const t = makeTrigger(run, def, at, order, names, null, uid);
  const memory = def.memoryRecord ? { ...t, names } : t;
  return { ...memory, combat: false };
}

function makeTrigger(
  run: RunState,
  def: StoryEventDefinition,
  at: number,
  order: number,
  names: Record<string, string>,
  variant: string | null,
  uid: string,
): StoryTrigger {
  const shown = (variant && def.variants[variant]) || def;
  const pool = shown.messagePool;
  const line = pool.length === 1 ? pool[0]! : withStream(run.rng, 'story', (r) => r.pick(pool));
  return {
    defId: def.id,
    uid,
    side: 'player',
    title: shown.displayName,
    message: fill(line, names),
    priority: def.priority,
    combat: def.effect !== null,
    at,
    cue: 'major' in shown && shown.major !== undefined ? { ...def.visualCue, major: shown.major } : def.visualCue,
    order,
    names,
  };
}

/** "This Trainer Will Return": an ordinary trainer you beat with one Pokémon left at low HP vows to come back. */
function trainerVow(content: Content, run: RunState, triggers: StoryTrigger[], at: number, where: Where): void {
  const rule = rematchRule(content);
  const battle = run.battle!;
  const trainer = battle.trainer;
  if (!rule || battle.kind !== 'trainer' || !trainer || trainer.leaderId || battle.rematch || battle.returning) return;
  const standing = run.party.filter((m) => m.hp > 0);
  const last = standing[0];
  if (standing.length !== 1 || !last || last.hp > maxHp(content, last) * rule.lowHpShare) return;
  const inRegion = vowedTrainers(run).filter((p) => p.battles[0]?.where.region === where.region);
  if (inRegion.length >= rule.effect.perRegion || inRegion.filter((p) => p.battles[0]?.where.stage === where.stage).length >= rule.effect.perStage) return;
  const profile = createEnemyProfile(content, run, {
    id: `trainer-${where.region}-${where.stage ?? 0}-${battleIndex(run)}`,
    name: trainer.name,
    trainerId: trainer.classId,
    team: battle.enemyTeam.slice(0, 6).map((m) => ({ speciesId: m.speciesId, level: m.level })),
  });
  if (!profile) return;
  const title = `${content.trainers.get(trainer.classId)?.name ?? 'Trainer'} ${trainer.name}`;
  const cause = emit(content, run, 'trainerVowedReturn', {
    where,
    actors: [last.uid],
    data: { profile: profile.id, classId: trainer.classId, name: trainer.name },
    text: `Barely beat ${title}, who vowed to return`,
  });
  recordEnemyBattle(content, profile, cause, 'win');
  run.story.flags[returnFlag(profile.id)] = 'waiting';
  const def = content.story.definitions.find((d) => d.id === rule.id)!;
  triggers.push({ ...makeTrigger(run, def, at, triggers.length, { trainer: title, name: name(content, last.speciesId) }, null, last.uid), combat: false });
}

/** Runs the event queue over the turn's triggers: effects, memories and cues. */
function resolveTriggers(content: Content, run: RunState, triggers: StoryTrigger[], where: Where): PresentationCue[] {
  if (triggers.length === 0) return [];
  const budgetLeft = content.story.majorCuesPerBattle - run.story.majorCuesThisBattle;
  const result = resolveQueue(triggers, budgetLeft);
  run.story.majorCuesThisBattle += result.majorUsed;
  const tell = (t: StoryTrigger, suppressed: boolean) => {
    const def = content.story.definitions.find((d) => d.id === t.defId)!;
    const actor = t.uid;
    const event = emit(content, run, 'storyMoment', {
      where,
      actors: [actor],
      data: { def: def.id, suppressed },
      importance: def.memoryRecord?.importance ?? 0,
      text: def.memoryRecord ? fill(def.memoryRecord.text, t.names) : undefined,
      emotions: def.emotions,
    });
    advanceChains(content, run, def.id, t.side === 'player' ? actor : undefined);
    // Effects the engine has not already applied (it decides every Hyper moment's effect itself).
    if (!suppressed && def.effect && !ENGINE_EFFECTS.has(def.effect.kind)) {
      const id = isBattleEffect(def.effect) ? cooldownKey(def, actor) : `${event.id}:${def.id}`;
      applyStoryEffect(content, run, id, def.effect, actor);
    }
  };
  for (const t of result.resolved) tell(t, false);
  for (const t of result.suppressed) tell(t, true);
  return result.cues;
}

/** They're More Than Just Teammates: two Pokémon that fought together through three boss wins form a bond. */
function noteDuos(content: Content, run: RunState, fought: string[], where: Where): void {
  const def = content.story.definitions.find((d) => d.triggerConditions.trigger === 'moreThanTeammates');
  if (!def) return;
  const team = fought.filter((uid) => run.party.some((m) => m.uid === uid)).sort();
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const a = team[i]!;
      const b = team[j]!;
      const key = `duo:${a}:${b}`;
      const n = Number(run.story.flags[key] ?? 0) + 1;
      run.story.flags[key] = n;
      if (n !== 3) continue;
      const nameA = name(content, run.party.find((m) => m.uid === a)!.speciesId);
      const nameB = name(content, run.party.find((m) => m.uid === b)!.speciesId);
      const cause = emit(content, run, 'storyMoment', {
        where,
        actors: [a, b],
        data: { def: def.id, suppressed: false },
        importance: def.memoryRecord?.importance ?? 0,
        text: fill(def.memoryRecord?.text ?? '', { name: nameA, other: nameB }),
        emotions: def.emotions,
      });
      openRelationship(content, run, 'bond', { kind: 'pokemon', id: a }, { kind: 'pokemon', id: b }, cause);
    }
  }
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
  // Heated Rivalry counts the battles each of your Pokémon fought each opposing species.
  for (const [uid, species] of Object.entries(battle.hyper.met ?? {})) {
    const history = run.story.histories[uid];
    if (history) for (const id of species) history.foes[id] = (history.foes[id] ?? 0) + 1;
  }
  const ended = emit(content, run, 'battleEnded', {
    where,
    actors: fought,
    data: { result, kind: battle.kind, turns: battle.turn - 1, hpLeftShare: totalHp > 0 ? Math.round((hpLeft / totalHp) * 100) / 100 : 0 },
  });
  // A returning trainer's rematch goes into its record.
  const back = battle.returning ? run.story.enemyProfiles.find((p) => p.id === battle.returning) : undefined;
  if (back && (result === 'win' || result === 'lose')) recordEnemyBattle(content, back, ended, result);
  const trainer = battle.trainer;
  // A rival back for its rematch remembers this battle.
  const rivalBack = battle.rivalId ? run.story.rivals.find((r) => r.id === battle.rivalId) : undefined;
  if (rivalBack && (result === 'win' || result === 'lose')) {
    const hpShare = totalHp > 0 ? Math.round((hpLeft / totalHp) * 100) / 100 : 0;
    rivalBack.memory.lastBattle = { eventId: ended.id, result: result === 'win' ? 'win' : 'lose', hpLeftShare: hpShare, turns: battle.turn - 1, team: battle.enemyTeam.slice(0, 6).map((m) => m.speciesId), foes: fought };
    if (result === 'win') {
      const before = rivalBack.state;
      const outcome = applyDefeat(rivalBack, sparkGain({ hpLeftShare: hpShare, flawless: run.party.every((m) => m.hp > 0) }));
      const title = `${content.trainers.get(rivalBack.classId)?.name ?? 'Trainer'} ${rivalBack.name}`;
      const say = (text: string) => emit(content, run, 'rivalryFormed', { where, actors: fought, data: { rival: rivalBack.id, outcome }, text });
      if (outcome === 'ally') say(`${title} accepted your lead and became an ally`);
      else if (outcome === 'retired') say(`${title}, worn down by defeats, stepped away from competition`);
      else if (outcome === 'shaken') say(`${title} was shaken by the loss and questioned their ambition`);
      else if (rivalBack.state !== before && (rivalBack.state === 'nemesis' || rivalBack.state === 'contender')) say(`${title} is now a ${rivalBack.state === 'nemesis' ? 'nemesis' : 'regional contender'}`);
      onRivalDefeated(content, run, rivalBack, outcome, where);
      advanceArc(content, run, rivalBack);
      afterBattleBehavior(content, run, rivalBack, false);
      triangleEffect(run, rivalBack);
      const chosen = evaluateUltimate(run);
      if (chosen) say(`${content.trainers.get(chosen.classId)?.name ?? 'Trainer'} ${chosen.name} became the rival who defines your journey`);
    }
  }
  // Rival Spark: a memorable win over an ordinary trainer can make them your rival.
  if (result === 'win' && trainer && !trainer.leaderId && battle.kind === 'trainer' && !battle.rivalId) {
    const rival = maybeSpark(run, {
      where,
      classId: trainer.classId,
      name: trainer.name,
      team: battle.enemyTeam.slice(0, 6).map((m) => m.speciesId),
      ended,
      // A gripping comeback (the Battle Drama Engine's Last-Second Resolve or Comeback Call) counts as a close fight.
      hpLeftShare: Math.min(totalHp > 0 ? Math.round((hpLeft / totalHp) * 100) / 100 : 0, battle.drama.seen.some((id) => id === 'ev:comebackCall' || id === 'ev:lastSecondResolve') ? 0.1 : 1),
      turns: battle.turn - 1,
      flawless: run.party.every((m) => m.hp > 0),
      returning: Boolean(battle.returning),
      ctx: pathContext(content, run, { where, team: battle.enemyTeam.slice(0, 6).map((m) => m.speciesId), hpLeftShare: totalHp > 0 ? hpLeft / totalHp : 0, turns: battle.turn - 1 }),
    });
    if (rival) {
      const title = `${content.trainers.get(trainer.classId)?.name ?? 'Trainer'} ${trainer.name}`;
      emit(content, run, 'rivalryFormed', { where, actors: fought, data: { rival: rival.id, archetype: rival.archetype }, text: `${(RIVAL_PATHS.paths.find((p) => p.id === rival.origin.path)?.line ?? '{who} became your rival').replace('{who}', title)}` });
    }
  }
  const role = trainer?.leaderId ? BOSS_ROLES[trainer.classId] : undefined;
  if (!trainer || !role) return;
  if (result === 'win') {
    emit(content, run, 'bossBeaten', {
      where,
      actors: fought,
      data: { leaderId: trainer.leaderId, role: trainer.classId, name: trainer.name },
      text: `Defeated ${role} ${trainer.name}`,
    });
    onBossBeaten(content, run, where, ended.id);
    noteDuos(content, run, fought, where);
    // A milestone: the story may now follow a different rival.
    const chosen = evaluateUltimate(run);
    if (chosen) emit(content, run, 'rivalryFormed', { where, actors: fought, data: { rival: chosen.id, outcome: 'ultimate' }, text: `${content.trainers.get(chosen.classId)?.name ?? 'Trainer'} ${chosen.name} became the rival who defines your journey` });
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
      const reunion = before.pending.find((d) => d.kind === 'reunion' && d.mon.uid === mon.uid);
      openHistory(content, run, mon.uid, mon.speciesId, starter ? 'starter' : caught ? 'caught' : 'gift');
      // Species Mastery unlocks (egg moves, ability, an awakened move) for a Pokémon that just joined.
      applyMastery(content, run, mon);
      if (starter) emit(content, run, 'starterChosen', { actors: [mon.uid], data: { speciesId: mon.speciesId }, text: 'Chosen as your starter' });
      else if (reunion?.kind === 'reunion') {
        advanceChains(content, run, 'reunion', mon.uid);
        emit(content, run, 'joinedParty', {
          actors: [mon.uid],
          data: { speciesId: mon.speciesId, how: 'reunion', hallOfFame: reunion.hallOfFame },
          text: reunion.hallOfFame ? 'Never forgot you, and came back from a past run' : 'Came back from a past run to join you',
        });
      } else emit(content, run, 'joinedParty', { actors: [mon.uid], data: { speciesId: mon.speciesId, how: caught ? 'caught' : 'gift' }, text: `Joined your team as a ${name(content, mon.speciesId)}` });
      continue;
    }
    // A battle transformation (Mega, Primal...) and its reversion are not evolutions; the battle turn tells those.
    const transformed = Boolean(before.battle?.transform.forms[mon.uid] ?? run.battle?.transform.forms[mon.uid]);
    if (prev.speciesId !== mon.speciesId && !transformed) {
      emit(content, run, 'evolved', {
        actors: [mon.uid],
        data: { from: prev.speciesId, to: mon.speciesId, trigger: evolutionTrigger },
        text: `Evolved from ${name(content, prev.speciesId)} into ${name(content, mon.speciesId)}`,
      });
      // Determination Evolution: the evolution rules are unchanged; an exceptional story (a boss beaten
      // after surviving a fatal hit) only earns it a named memory and its own record.
      graduateMentorships(content, run, mon.uid);
      const h = run.story.histories[mon.uid];
      const beyond = content.story.definitions.find((d) => d.id === 'evolved-beyond');
      if (h && beyond && h.bossesBeaten >= 3 && !h.hyper[beyond.id]) {
        h.hyper[beyond.id] = 1;
        emit(content, run, 'storyMoment', { actors: [mon.uid], data: { def: beyond.id, suppressed: false }, importance: beyond.memoryRecord?.importance ?? 0, text: fill(beyond.memoryRecord?.text ?? '', { name: name(content, mon.speciesId) }), emotions: beyond.emotions });
      }
      if (h && h.bossesBeaten > 0 && h.survivedFatal > 0) {
        h.hyper['determination-evolution'] = (h.hyper['determination-evolution'] ?? 0) + 1;
        advanceChains(content, run, 'determination-evolution', mon.uid);
        emit(content, run, 'storyMoment', {
          actors: [mon.uid],
          data: { def: 'determination-evolution', suppressed: false },
          importance: 85,
          text: `Determination Evolution: became ${name(content, mon.speciesId)} after everything it endured`,
          emotions: ['determination'],
        });
      }
    }
    for (const mark of content.story.friendshipMilestones) {
      if (prev.friendship < mark && mon.friendship >= mark) {
        emit(content, run, 'friendshipMilestone', { actors: [mon.uid], data: { value: mark }, text: `Its friendship with you reached ${mark}` });
        const believe = content.story.definitions.find((d) => d.id === 'knows-you-believe');
        const h = run.story.histories[mon.uid];
        if (believe && h && h.battles >= 10 && mark === Math.max(...content.story.friendshipMilestones) && !h.hyper[believe.id]) {
          h.hyper[believe.id] = 1;
          emit(content, run, 'storyMoment', { actors: [mon.uid], data: { def: believe.id, suppressed: false }, importance: believe.memoryRecord?.importance ?? 0, text: fill(believe.memoryRecord?.text ?? '', { name: name(content, mon.speciesId) }), emotions: believe.emotions });
        }
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
  recordEpitaph(content, run);
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
