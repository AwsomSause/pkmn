// Run recap with narrative highlights (catalog #103, #114, Combo 6). Pure: reads a finished run, changes nothing.

import type { Content } from './contentSchema';
import type { RunState } from './state';
import { topMoments } from './story/record';

export interface RunRecap {
  /** Why the run ended, in plain words. Never blames the player. */
  ending: string;
  /** The most memorable moment of the run, or null. */
  biggestMoment: string | null;
  /** The Pokémon with the best record, e.g. "Charizard: 12 battles, 3 bosses, 2 survived-a-knockout". */
  legend: string | null;
  /** The Pokémon that stayed up longest at low HP, or null. */
  narrowest: string | null;
  /** One line per rival: their name and where the rivalry stands. */
  rivals: string[];
  /** A short, kind hint on what to try next time, from the cause of defeat. */
  tip: string | null;
}

const name = (content: Content, id: string) => content.species.get(id)?.name ?? id;

export function buildRecap(content: Content, run: RunState): RunRecap {
  const by = run.log.defeatedBy;
  const ending = run.victory
    ? 'You beat every region.'
    : by
      ? `The run ended against ${by.trainer ? `${by.trainer}'s ` : ''}${name(content, by.speciesId)} (Lv${by.level}).`
      : 'The run ended.';
  const moment = topMoments(run.story, 1)[0];
  const histories = Object.values(run.story.histories);
  const score = (h: (typeof histories)[number]) => h.bossesBeaten * 5 + h.battles + h.survivedFatal * 3 + h.evolutions.length * 2;
  const best = [...histories].sort((a, b) => score(b) - score(a) || a.uid.localeCompare(b.uid))[0];
  const stand = [...histories].sort((a, b) => b.longestLowHpStand - a.longestLowHpStand || a.uid.localeCompare(b.uid))[0];
  const stateText: Record<string, string> = { recognized: 'remembers you', recurring: 'keeps coming back', active: 'is chasing you', nemesis: 'is your nemesis', contender: 'is a true contender', ally: 'became an ally', retired: 'stepped away' };
  return {
    ending,
    biggestMoment: moment?.text ?? null,
    legend: best && best.battles > 0 ? `${name(content, best.speciesId)}: ${best.battles} battles, ${best.bossesBeaten} boss wins${best.survivedFatal ? `, survived ${best.survivedFatal} knockout blows` : ''}` : null,
    narrowest: stand && stand.longestLowHpStand >= 2 ? `${name(content, stand.speciesId)} fought on at low HP for ${stand.longestLowHpStand} turns in a row` : null,
    rivals: run.story.rivals.map((r) => `${r.name} ${stateText[r.state] ?? r.state}`),
    tip: run.victory || !by ? null : `Next time, bring an answer to ${name(content, by.speciesId)}: look at its types in the move panel before the fight.`,
  };
}
