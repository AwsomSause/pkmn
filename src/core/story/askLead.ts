// "Feels Left Out" and the Campfire choice (Techno §3, §7E): a Pokémon that has hardly fought asks to lead.
// The player says yes (it moves to the front of the party and gains friendship) or not now. Nothing random:
// the offer comes from the Pokémon's history and the run's stage, and is made at most once per stage.

import { changeFriendship } from '../friendship';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from './record';

export interface AskLead {
  uid: string;
  reason: 'leftOut' | 'campfire';
}

const flag = (run: RunState) => `askLead:${run.regionIndex}.${run.stage?.index ?? 0}`;

/** A benched, healthy Pokémon with at most one fight asks to lead; later, a quiet one with at most two does the same at the campfire. */
export function planAskLead(content: Content, run: RunState): AskLead | null {
  if (run.story.flags[flag(run)] !== undefined || run.party.length < 2) return null;
  const fights = (uid: string) => run.story.histories[uid]?.battles ?? 99;
  const benched = run.party.filter((m, i) => i > 0 && m.hp > 0);
  const idle = benched.find((m) => fights(m.uid) <= 1);
  if (idle && run.encountersCompleted >= 6) return { uid: idle.uid, reason: 'leftOut' };
  const quiet = benched.find((m) => fights(m.uid) <= 2);
  if (quiet && run.encountersCompleted >= 4) return { uid: quiet.uid, reason: 'campfire' };
  return null;
}

export function askLeadText(content: Content, run: RunState, ask: AskLead): string {
  const mon = run.party.find((m) => m.uid === ask.uid);
  const name = mon ? (content.species.get(mon.speciesId)?.name ?? 'It') : 'It';
  return ask.reason === 'leftOut' ? `${name} has barely fought and feels left out. It asks to lead the next battle.` : `By the campfire, ${name} steps forward: "I want to go first tomorrow."`;
}

/** Records the answer. Yes: the Pokémon takes the lead and gains friendship; not now: it understands. */
export function answerAskLead(content: Content, run: RunState, ask: AskLead, accept: boolean): string {
  run.story.flags[flag(run)] = accept ? 'yes' : 'no';
  const mon = run.party.find((m) => m.uid === ask.uid);
  if (!mon) return '';
  const name = content.species.get(mon.speciesId)?.name ?? 'It';
  if (!accept) {
    changeFriendship(content, mon, 1);
    return `${name} nods. Maybe next time.`;
  }
  const at = run.party.indexOf(mon);
  if (at > 0) {
    run.party.splice(at, 1);
    run.party.unshift(mon);
    // The lead index follows the party order: nothing is mid-battle when this is asked.
  }
  changeFriendship(content, mon, 5);
  emit(content, run, 'storyMoment', { actors: [mon.uid], data: { def: 'ask-lead', suppressed: false }, importance: 60, text: `${name} was given the lead after asking for it`, emotions: ['bravery'] });
  return `${name} takes the lead!`;
}
