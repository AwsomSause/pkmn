// More Hyper moments (Overdrive blueprint §3): survival, bond and enemy
// Overdrive events that are detected from what happened in a turn. Like the
// Hyper evolutions they draw no random numbers; the story layer only tells
// them and applies a small effect through the effect ledger. Counters live in
// run.story.flags under "m:" keys and are cleared when the battle ends.

import { chemistryOf } from './chemistry';
import { lossesTo, noteLoss, promiseDoneFlag, promiseOf } from './promises';
import { openingFor, rivalFeeling } from '../rivals/feelings';
import { championOpener, crisisMoments } from './crisis';
import { grandMoment } from './grandEnemy';
import type { Side } from '../battle/engine';
import type { Content } from '../contentSchema';
import { GYM_LEADER_CLASS, ELITE_FOUR_CLASS, CHAMPION_CLASS } from '../encounters';
import { maxHp } from '../pokemon';
import type { RunEvent } from '../run';
import { currentEnemy, type RunState } from '../state';
import { emotionOf } from './emotions';
import { mentorshipOf } from './mentorship';
import type { StoryEffectSpec, StoryTriggerKind } from './schema';

/** The one effect each moment trigger may carry (checked when content loads). */
export const MOMENT_EFFECTS: Partial<Record<StoryTriggerKind, StoryEffectSpec['kind']>> = {
  secondWind: 'heal',
  notGivenUp: 'statStage',
  rememberedTraining: 'statStage',
  brokeLimits: 'statStage',
  somethingAwakened: 'friendship',
  instinctsTookOver: 'statStage',
  refusedWeakness: 'statStage',
  turnedPainIntoPower: 'statStage',
  makeYouProud: 'statStage',
  cameToAid: 'statStage',
  moreThanTeammates: 'flair',
  knowsYouBelieve: 'flair',
  evolvedBeyond: 'flair',
  enemyUnshaken: 'enemyStage',
  enemyInstinct: 'enemyStage',
  enemyLearned: 'enemyStage',
  protectingTrainer: 'enemyStage',
  partnerFall: 'enemyStage',
  willNotLetDown: 'enemyStage',
  somethingDifferent: 'flair',
  waitingForBattle: 'flair',
  somethingWatching: 'flair',
  rivalResentment: 'enemyStage',
  rivalFear: 'enemyStage',
  rivalRespect: 'flair',
  sacrificeStand: 'statStage',
  lastStand: 'statStage',
  comebackRevenge: 'flair',
  promiseKept: 'flair',
  wildAmbush: 'enemyStage',
  wildKin: 'flair',
  chemistryPerfect: 'statStage',
  starterDestiny: 'statStage',
  grandOmen: 'flair',
  grandShadow: 'enemyStage',
  grandGrudge: 'statStage',
  crisisLoom: 'enemyStage',
  crisisAid: 'statStage',
  championRespect: 'enemyStage',
  championRecall: 'enemyStage',
  studentLearned: 'statStage',
  studentSurpassed: 'flair',
  lastLesson: 'flair',
  differentWays: 'flair',
  overdriveDetermination: 'statStage',
  overdriveBravery: 'statStage',
  overdriveJustice: 'statStage',
  overdriveKindness: 'statStage',
  overdrivePatience: 'statStage',
  overdriveIntegrity: 'cure',
  overdrivePerseverance: 'statStage',
  dualEmotion: 'heal',
  emotionalClash: 'flair',
  understandEachOther: 'statStage',
  wontLetFriendFight: 'statStage',
  wantsToProve: 'statStage',
  feelsLeftOut: 'friendship',
  gatheringEverything: 'flair',
  gatherUnleashed: 'enemyStage',
  fightingBeyondLimits: 'enemyStage',
  lostComposure: 'enemyStage',
};

export interface Moment {
  trigger: StoryTriggerKind;
  side: Side;
  uid: string;
  /** Index in the turn's events it is told after. */
  at: number;
  names: Record<string, string>;
}

/** A small string hash (FNV-1a), so "unusual" flavour is fixed by the seed and never draws from a random stream. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Moves that put the user between a teammate and danger. */
const SHIELDING = new Set(['protect', 'detect', 'endure', 'spiky-shield', 'kings-shield', 'baneful-bunker', 'wide-guard', 'quick-guard', 'mat-block', 'substitute', 'follow-me', 'rage-powder', 'helping-hand']);

const flagKey = (...parts: (string | number)[]) => `m:${parts.join(':')}`;

/** Removes the per-battle counters (called when a battle ends). */
export function clearMomentFlags(run: RunState): void {
  for (const key of Object.keys(run.story.flags)) if (key.startsWith('m:')) delete run.story.flags[key];
}

const isBossClass = (classId: string | undefined) => classId === GYM_LEADER_CLASS || classId === ELITE_FOUR_CLASS || classId === CHAMPION_CLASS;

/**
 * Finds the moments that happened in one turn. `before` is the run before the turn, `run` after it
 * (mutated only for the "m:" counters and the boss-finisher memory).
 */
export function detectMoments(content: Content, before: RunState, run: RunState, events: RunEvent[]): Moment[] {
  const battle = run.battle!;
  const prior = before.battle!;
  const flags = run.story.flags;
  const out: Moment[] = [];
  const nameOf = (id: string) => content.species.get(id)?.name ?? id;
  const boss = isBossClass(battle.trainer?.classId);
  const trainerFight = battle.kind === 'trainer';
  const once = (trigger: StoryTriggerKind, uid: string): boolean => {
    const key = flagKey('fired', trigger, uid);
    if (flags[key]) return false;
    flags[key] = true;
    return true;
  };
  const rarity = content.story.rarity;
  const fire = (trigger: StoryTriggerKind, side: Side, uid: string, at: number, names: Record<string, string>) => {
    if (!content.story.definitions.some((d) => d.triggerConditions.trigger === trigger) || !once(trigger, uid)) return;
    // Rarity: a moment that helps your side must be earned by a seeded roll, and only so many per battle, spaced apart.
    if (side === 'player' && !rarity.exempt.includes(trigger)) {
      const helps = MOMENT_EFFECTS[trigger] !== 'flair';
      const roll = (fnv1a(`${run.seed}:rare:${trigger}:${uid}:${run.encountersCompleted}`) % 1000) / 1000;
      if (roll >= (helps ? rarity.momentChance : rarity.flairChance)) return;
      if (helps) {
        const used = Number(flags[flagKey('helped')] ?? 0);
        const last = flags['rare:last'];
        if (used >= (boss ? rarity.perBossBattle : rarity.perBattle)) return;
        if (!boss && used === 0 && typeof last === 'number' && run.encountersCompleted - last < rarity.cooldownBattles) return;
        flags[flagKey('helped')] = used + 1;
        flags['rare:last'] = run.encountersCompleted;
      }
    }
    out.push({ trigger, side, uid, at, names });
  };
  const lead = run.party[battle.activeIndex];
  const leadBefore = before.party[prior.activeIndex];
  const foe = currentEnemy(battle);
  const lastAt = events.length - 1;
  const leadNames = () => ({ name: nameOf(lead!.speciesId), enemy: nameOf(foe.speciesId) });
  let leadUid = leadBefore?.uid;
  let enemyUid = currentEnemy(prior).uid;
  let lastMoveByLead: string | null = null;

  events.forEach((e, i) => {
    switch (e.type) {
      case 'move':
        if (e.side === 'player') {
          lastMoveByLead = e.moveId;
          // It Stood Between Its Friend and Danger: a defensive move while a teammate is down or nearly down.
          if (lead && SHIELDING.has(e.moveId)) {
            const friend = run.party.find((m) => m.uid !== lead.uid && m.hp <= maxHp(content, m) * 0.3);
            if (friend) fire('sacrificeStand', 'player', lead.uid, i, { name: nameOf(lead.speciesId), other: nameOf(friend.speciesId) });
          }
          // It Remembered Its Training: a move that finished a boss before, used again.
          // It Learned Something Today: a protégé's first use of a move its mentor has used often.
          const rel = leadUid ? mentorshipOf(run, leadUid) : undefined;
          const mentorH = rel ? run.story.histories[rel.a.id] : undefined;
          const proteH = leadUid ? run.story.histories[leadUid] : undefined;
          if (rel && lead && mentorH && proteH && (mentorH.moves[e.moveId] ?? 0) >= 5 && proteH.moves[e.moveId] === 1) {
            fire('studentLearned', 'player', lead.uid, i, { name: nameOf(lead.speciesId), move: content.moves.get(e.moveId)?.name ?? e.moveId, other: nameOf(run.party.find((m) => m.uid === rel.a.id)?.speciesId ?? '') });
          }
          const memory = leadUid ? flags[`fin:${leadUid}`] : undefined;
          if (leadUid && memory === e.moveId && trainerFight && lead?.uid === leadUid) {
            fire('rememberedTraining', 'player', leadUid, i, { name: nameOf(lead.speciesId), move: content.moves.get(e.moveId)?.name ?? e.moveId });
          }
          // It Has Learned From Your Attacks: the same move three turns in a row.
          const streak = flags[flagKey('streak')] === e.moveId ? Number(flags[flagKey('streakN')] ?? 1) + 1 : 1;
          flags[flagKey('streak')] = e.moveId;
          flags[flagKey('streakN')] = streak;
          if (streak >= 3 && trainerFight) fire('enemyLearned', 'enemy', enemyUid, i, { name: nameOf(foe.speciesId), move: content.moves.get(e.moveId)?.name ?? e.moveId });
        } else if (boss) {
          // It Is Gathering Everything It Has: two set-up turns in a row are shown as a charge. Any status
          // on it, or a knockout, breaks the charge (It Has Lost Its Composure); otherwise its next attack is stronger.
          const setup = !(content.moves.get(e.moveId)?.power ?? 0);
          const n = setup ? Number(flags[flagKey('setupN')] ?? 0) + 1 : 0;
          flags[flagKey('setupN')] = n;
          const names = { name: nameOf(foe.speciesId) };
          if (setup && n >= 2 && !flags[flagKey('gather')]) {
            flags[flagKey('gather')] = true;
            fire('gatheringEverything', 'enemy', enemyUid, i, names);
          } else if (!setup && flags[flagKey('gather')]) {
            delete flags[flagKey('gather')];
            fire('gatherUnleashed', 'enemy', enemyUid, i, names);
          }
        }
        break;
      case 'status':
        if (e.side === 'enemy' && flags[flagKey('gather')]) {
          delete flags[flagKey('gather')];
          fire('lostComposure', 'enemy', enemyUid, i, { name: nameOf(foe.speciesId) });
        }
        break;
      case 'switchIn':
        if (e.side === 'player') {
          leadUid = e.uid;
          const mon = run.party.find((m) => m.uid === e.uid);
          if (mon && boss && mon.friendship >= 150) fire('makeYouProud', 'player', mon.uid, i, { name: nameOf(mon.speciesId) });
          if (mon && flags[flagKey('fell')]) fire('cameToAid', 'player', mon.uid, i, { name: nameOf(mon.speciesId) });
          // Bond pairs (More Than Teammates): They Understand Each Other Perfectly / It Won't Let Its Friend Fight Alone.
          for (const rel of run.story.relationships) {
            if (!mon || !rel.open || rel.kind !== 'bond' || (rel.a.id !== mon.uid && rel.b.id !== mon.uid)) continue;
            const friend = run.party.find((m) => m.uid === (rel.a.id === mon.uid ? rel.b.id : rel.a.id));
            if (!friend || friend.hp <= 0) continue;
            const names = { name: nameOf(mon.speciesId), other: nameOf(friend.speciesId) };
            if ((run.story.histories[mon.uid]?.finishTrades[friend.uid] ?? 0) >= 2) fire('understandEachOther', 'player', mon.uid, i, names);
            if (friend.hp <= maxHp(content, friend) * 0.25) fire('wontLetFriendFight', 'player', mon.uid, i, names);
          }
        } else {
          enemyUid = e.uid;
          const ace = battle.enemyTeam.length > 1 && battle.enemyTeam[battle.enemyTeam.length - 1]!.uid === e.uid;
          if (boss && ace) fire('willNotLetDown', 'enemy', e.uid, i, { name: nameOf(e.speciesId) });
          if (trainerFight && flags[flagKey('enemyFell')]) fire('partnerFall', 'enemy', e.uid, i, { name: nameOf(e.speciesId) });
        }
        break;
      case 'damage': {
        // It Is Fighting Beyond Its Limits: a boss survives a hit that took half its health.
        if (e.side === 'enemy' && boss && e.hpAfter > 0 && e.amount >= maxHp(content, foe) * 0.5) fire('fightingBeyondLimits', 'enemy', enemyUid, i, { name: nameOf(foe.speciesId) });
        if (e.side !== 'player' || e.hpAfter <= 0 || !lead) break;
        const hits = Number(flags[flagKey('hits', lead.uid)] ?? 0) + 1;
        flags[flagKey('hits', lead.uid)] = hits;
        const max = maxHp(content, lead);
        if (hits >= 3 && lead.hp <= max * 0.6) fire('notGivenUp', 'player', lead.uid, i, leadNames());
        if (e.effectiveness > 1) fire('refusedWeakness', 'player', lead.uid, i, leadNames());
        if (e.amount >= max * 0.5) fire('turnedPainIntoPower', 'player', lead.uid, i, leadNames());
        if (prior.turn === 1 && battle.kind === 'wild' && e.amount >= max * 0.4) fire('instinctsTookOver', 'player', lead.uid, i, leadNames());
        break;
      }
      case 'faint':
        if (e.side === 'player') {
          flags[flagKey('fell')] = true;
          const fellUid = (e as { uid?: string }).uid;
          if (fellUid) noteLoss(run, fellUid, foe.speciesId);
        } else {
          flags[flagKey('enemyFell')] = true;
          const dead = battle.enemyTeam.find((m) => m.uid === e.uid);
          if (lead && dead && dead.level >= lead.level + 10) fire('brokeLimits', 'player', lead.uid, i, { name: nameOf(lead.speciesId), enemy: nameOf(dead.speciesId) });
          if (boss && leadUid && lastMoveByLead) flags[`fin:${leadUid}`] = lastMoveByLead;
          // Comeback and Promise: beating a species that has beaten this Pokémon before.
          if (lead && dead) {
            const promised = promiseOf(run, lead.uid);
            if (promised === dead.speciesId) {
              flags[promiseDoneFlag(lead.uid, dead.speciesId)] = true;
              fire('promiseKept', 'player', lead.uid, i, { name: nameOf(lead.speciesId), enemy: nameOf(dead.speciesId) });
            } else if (lossesTo(run, lead.uid, dead.speciesId) >= 1) {
              fire('comebackRevenge', 'player', lead.uid, i, { name: nameOf(lead.speciesId), enemy: nameOf(dead.speciesId) });
            }
          }
          // The Student Has Surpassed the Teacher: a protégé beats a species that once knocked out its mentor.
          const rel = lead ? mentorshipOf(run, lead.uid) : undefined;
          const h = lead ? run.story.histories[lead.uid] : undefined;
          if (rel && lead && dead && h && !h.hyper['student-surpassed'] && run.story.events.some((k) => k.type === 'knockout' && k.actors[0] === rel.a.id && k.data.bySpeciesId === dead.speciesId)) {
            h.hyper['student-surpassed'] = 1;
            fire('studentSurpassed', 'player', lead.uid, i, { name: nameOf(lead.speciesId), enemy: nameOf(dead.speciesId), other: nameOf(run.party.find((m) => m.uid === rel.a.id)?.speciesId ?? '') });
          }
        }
        break;
      default:
        break;
    }
  });

  // Unusual events (blueprint §5) that need no choice: told on the first turn, from the run's seed, never from a gameplay stream.
  if (prior.turn === 1 && lead) {
    const mark = fnv1a;
    if (battle.kind === 'wild' && (foe.shiny ? mark(`${run.seed}:${foe.uid}:s`) % 5 !== 0 : mark(`${run.seed}:${foe.uid}:d`) % 60 === 0)) {
      fire('somethingDifferent', 'player', lead.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
    }
    // It Wants to Prove Itself / It Feels Left Out…
    const ace = run.party.find((m) => m.uid !== lead.uid && (run.story.histories[m.uid]?.bossesBeaten ?? 0) >= 2);
    if (ace && (run.story.histories[lead.uid]?.battles ?? 99) <= 2) fire('wantsToProve', 'player', lead.uid, -1, { name: nameOf(lead.speciesId), other: nameOf(ace.speciesId) });
    if (run.encountersCompleted >= 6) {
      const idle = run.party.find((m) => m.uid !== lead.uid && m.hp > 0 && (run.story.histories[m.uid]?.battles ?? 99) <= 1);
      if (idle) fire('feelsLeftOut', 'player', idle.uid, -1, { name: nameOf(idle.speciesId), other: nameOf(lead.speciesId) });
    }
    const feltRival = battle.rivalId ? run.story.rivals.find((r) => r.id === battle.rivalId) : undefined;
    const opening = feltRival ? openingFor(rivalFeeling(feltRival).feeling) : null;
    if (opening) fire(opening, opening === 'rivalRespect' ? 'player' : 'enemy', opening === 'rivalRespect' ? lead.uid : foe.uid, -1, { name: nameOf(foe.speciesId), enemy: nameOf(foe.speciesId), trainer: battle.trainer?.name ?? 'The rival' });
    if (boss) {
      const g = grandMoment(content, run, lead.uid);
      if (g) fire(g, g === 'grandShadow' ? 'enemy' : 'player', g === 'grandShadow' ? foe.uid : lead.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
      const champ = championOpener(run, battle.trainer?.classId);
      if (champ) fire(champ, 'enemy', foe.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
      for (const c of crisisMoments(run)) fire(c, c === 'crisisLoom' ? 'enemy' : 'player', c === 'crisisLoom' ? foe.uid : lead.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
    }
    // Wild Encounter Recognition: a species that beat your team ambushes; a wild kin of a party member is recognised.
    if (battle.kind === 'wild') {
      if (run.party.some((m) => lossesTo(run, m.uid, foe.speciesId) >= 1)) fire('wildAmbush', 'enemy', foe.uid, -1, { name: nameOf(foe.speciesId) });
      const kin = run.party.find((m) => m.uid !== lead.uid && m.speciesId === foe.speciesId);
      if (kin) fire('wildKin', 'player', kin.uid, -1, { name: nameOf(kin.speciesId), enemy: nameOf(foe.speciesId) });
    }
    // Starter Destiny: the starter you chose meets an unusually difficult opponent and finds something extra.
    if (lead.uid === run.log.starterUid && trainerFight && foe.level >= lead.level + 6) {
      fire('starterDestiny', 'player', lead.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
    }
    // Team Chemistry: Perfect Timing partners open together with a lift.
    const timed = run.party.find((m) => m.uid !== lead.uid && m.hp > 0 && chemistryOf(content, run, lead.uid, m.uid) === 'perfectTiming');
    if (timed) fire('chemistryPerfect', 'player', lead.uid, -1, { name: nameOf(lead.speciesId), other: nameOf(timed.speciesId) });
    const rival = run.story.rivals.some((r) => r.state === 'contender' || r.state === 'nemesis');
    if (boss && rival) fire('waitingForBattle', 'player', lead.uid, -1, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
    if (mark(`${run.seed}:watch:${run.encountersCompleted}`) % 14 === 0 && run.encountersCompleted > 0) {
      run.story.flags['lead:watcher'] = Number(run.story.flags['lead:watcher'] ?? 0) + 1;
      fire('somethingWatching', 'player', lead.uid, -1, { name: nameOf(lead.speciesId) });
    }
  }

  // End of the turn: states rather than events.
  if (lead && lead.hp > 0 && boss && run.party.length > 1 && run.party.every((m) => m.uid === lead.uid || m.hp <= 0) && lead.hp <= maxHp(content, lead) * 0.4) {
    fire('lastStand', 'player', lead.uid, lastAt, { name: nameOf(lead.speciesId), enemy: nameOf(foe.speciesId) });
  }
  if (lead && lead.hp > 0) {
    if (prior.turn >= 8 && lead.hp <= maxHp(content, lead) / 2) fire('secondWind', 'player', lead.uid, lastAt, leadNames());
    const h = run.story.histories[lead.uid];
    if (h && Object.keys(h.hyper).length >= 3) fire('somethingAwakened', 'player', lead.uid, lastAt, leadNames());
  }
  // Emotional Overdrives (blueprint §2): the Pokémon's current emotion plus a dramatic moment, once per battle.
  if (lead && lead.hp > 0 && !flags[flagKey('eo', lead.uid)]) {
    const em = emotionOf(content, run, lead.uid)?.id;
    const max = maxHp(content, lead);
    const hurtAlly = run.party.some((m) => m.uid !== lead.uid && m.hp > 0 && m.hp <= maxHp(content, m) * 0.3);
    const fallen = run.party.some((m) => m.hp <= 0);
    const names = leadNames();
    const go = (trigger: StoryTriggerKind) => {
      const before = out.length;
      fire(trigger, 'player', lead.uid, lastAt, names);
      if (out.length > before) flags[flagKey('eo', lead.uid)] = true;
    };
    const justice = events.some((e) => e.type === 'faint' && e.side === 'enemy') && run.story.events.some((k) => k.type === 'knockout' && k.data.side === 'player' && k.actors[1] === (events.find((e) => e.type === 'faint' && e.side === 'enemy') as { uid?: string } | undefined)?.uid);
    const status = events.some((e) => e.type === 'status' && e.side === 'player') && Boolean(lead.status);
    if (em === 'determination' && lead.hp <= max * 0.25 && hurtAlly) go('dualEmotion');
    else if (em === 'determination' && lead.hp <= max * 0.25) go('overdriveDetermination');
    else if (em === 'bravery' && foe.level >= lead.level + 5 && prior.turn >= 2) go('overdriveBravery');
    else if (em === 'justice' && justice) go('overdriveJustice');
    else if (em === 'kindness' && hurtAlly) go('overdriveKindness');
    else if (em === 'patience' && prior.turn >= 5 && lead.hp >= max * 0.5) go('overdrivePatience');
    else if (em === 'integrity' && status) go('overdriveIntegrity');
    else if (em === 'perseverance' && prior.turn >= 5 && (lead.status || fallen)) go('overdrivePerseverance');
    // Emotional clash: a Brave lead hurt while a Kind teammate watches.
    else if (em === 'bravery' && lead.hp <= max * 0.5 && run.party.some((m) => m.uid !== lead.uid && m.hp > 0 && emotionOf(content, run, m.uid)?.id === 'kindness')) go('emotionalClash');
  }

  // The Teacher Has One Last Lesson / They Have Different Ways of Fighting.
  for (const rel of run.story.relationships) {
    if (!rel.open || rel.kind !== 'mentorship') continue;
    const mentor = run.party.find((m) => m.uid === rel.a.id);
    const prote = run.party.find((m) => m.uid === rel.b.id);
    if (!mentor || !prote) continue;
    if (lead?.uid === mentor.uid && mentor.hp > 0 && mentor.hp <= maxHp(content, mentor) * 0.2 && prote.hp > 0) {
      fire('lastLesson', 'player', mentor.uid, lastAt, { name: nameOf(mentor.speciesId), other: nameOf(prote.speciesId) });
    }
    const mh = run.story.histories[mentor.uid];
    const ph = run.story.histories[prote.uid];
    const top = (hist?: { moves: Record<string, number> }) => Object.entries(hist?.moves ?? {}).sort((a, b) => b[1] - a[1])[0];
    const pt = top(ph);
    if (ph && !ph.hyper['different-ways'] && pt && pt[1] >= 6 && pt[0] !== top(mh)?.[0]) {
      ph.hyper['different-ways'] = 1;
      fire('differentWays', 'player', prote.uid, lastAt, { name: nameOf(prote.speciesId), other: nameOf(mentor.speciesId) });
    }
  }
  if (trainerFight && foe.hp > 0) {
    const share = foe.hp / maxHp(content, foe);
    const last = battle.enemyIndex === battle.enemyTeam.length - 1;
    if (boss && share <= 0.5) fire('enemyUnshaken', 'enemy', foe.uid, lastAt, { name: nameOf(foe.speciesId) });
    if (boss && last && share <= 0.25) fire('enemyInstinct', 'enemy', foe.uid, lastAt, { name: nameOf(foe.speciesId) });
    if (last && battle.enemyTeam.length > 1 && share <= 0.4) fire('protectingTrainer', 'enemy', foe.uid, lastAt, { name: nameOf(foe.speciesId), trainer: battle.trainer?.name ?? 'its trainer' });
  }
  return out;
}
