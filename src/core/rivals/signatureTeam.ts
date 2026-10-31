// Rival signature teams (Expanded Systems §8.3): every rival keeps one recognizable ace, the Pokémon it started
// with, which evolves with it (revisedTeam) and is always sent out last. Its type identity (rival.identity) and
// battle philosophy (rival.style) already exist; this adds the ace slot, its introduction and its defeat line.

import type { Content } from '../contentSchema';
import type { Candidate, PlanCtx } from '../drama/events';
import { pickIndex } from '../drama/schema';
import { familyId } from '../mastery';
import type { TrainerPlan } from '../encounters';
import type { Rival } from '../story/schema';
import { fillLine, RECOGNITION } from './recognition';

/** The ace's family (its first stage). Fixed the first time it is asked for. Mutates `rival`. */
export function ensureAce(content: Content, rival: Rival): string | null {
  const first = rival.memory.lastBattle.team[0];
  if (!rival.ace && first) rival.ace = familyId(content, first);
  return rival.ace ?? null;
}

/** Moves the ace to the last slot (the ACE! beat). A team without it stays as it is. */
export function withSignatureAce(content: Content, rival: Rival, plan: TrainerPlan): TrainerPlan {
  const i = rival.ace ? plan.members.findIndex((m) => familyId(content, m.speciesId) === rival.ace) : -1;
  if (i < 0) return plan;
  const order = [...plan.members.keys()].filter((k) => k !== i).concat(i);
  const members = order.map((k) => plan.members[k]!);
  const levelInfo = plan.levelInfo.length === plan.members.length ? order.map((k) => plan.levelInfo[k]!) : plan.levelInfo;
  return { ...plan, members, levelInfo };
}

/** "Pidgeot (ace)" for the Story screen, or null before the rival has an ace. */
export function aceName(content: Content, rival: Rival): string | null {
  if (!rival.ace) return null;
  const now = rival.memory.lastBattle.team.find((id) => familyId(content, id) === rival.ace) ?? rival.ace;
  return content.species.get(now)?.name ?? now;
}

/** Drama lines: the ace's introduction when it comes out, and the rival's reaction when you beat the team it led. */
export function aceCandidates(c: PlanCtx): Candidate[] {
  const rival = c.rival;
  if (!rival?.ace) return [];
  const title = `${c.content.trainers.get(rival.classId)?.name ?? 'Trainer'} ${rival.name}`;
  const out: Candidate[] = [];
  for (const ev of c.drama) {
    if (ev.kind === 'enemySwitch') {
      const mon = c.battle.enemyTeam.find((m) => m.uid === ev.data.uid);
      if (!mon || familyId(c.content, mon.speciesId) !== rival.ace) continue;
      const ace = c.content.species.get(mon.speciesId)?.name ?? mon.speciesId;
      const pool = RECOGNITION.signature.aceIntro.map((l) => fillLine(l, { rival: title, ace }));
      out.push({ ev: { ...ev, id: `${ev.id}:aceIntro` }, category: 'event', tier: 'major', pool: [pool[pickIndex(ev.id, pool.length)]!], cue: { event: 'rivalAce' } });
    } else if (ev.kind === 'battleEnd' && ev.data.outcome === 'win') {
      const mon = c.battle.enemyTeam.find((m) => familyId(c.content, m.speciesId) === rival.ace);
      if (!mon) continue;
      const ace = c.content.species.get(mon.speciesId)?.name ?? mon.speciesId;
      const pool = RECOGNITION.signature.aceDefeat.map((l) => fillLine(l, { rival: title, ace }));
      out.push({ ev: { ...ev, id: `${ev.id}:aceDefeat` }, category: 'event', tier: 'major', pool: [pool[pickIndex(ev.id, pool.length)]!], cue: { event: 'rivalAceDefeat' } });
    }
  }
  return out;
}
