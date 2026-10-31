// The Rival Chronicle: readable lines about each rival, for the Story screen (slice 3). Pure.

import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import catalog from '../../data/rivalCatalog.json';
import { FEELING_NAMES, rivalFeeling } from './feelings';
import { bondLines, reputation, signature } from './bonds';
import { RIVAL_CONFIG, RIVAL_WORLD } from './schema';
import { rivalStatusLine, rivalWorldView } from './progression';
import { aceName } from './signatureTeam';
import { everUltimateFlag, ultimateQuest, ultimateRival, type UltimateQuestStep } from './ultimate';

export interface RivalLine {
  /** "Youngster Joey, The Prodigy". */
  title: string;
  /** One line: how it fights and what stands out about its character. */
  summary: string;
  /** What it remembers of your last battle, and what it has learned. */
  memory: string;
  /** How it gets on with each of its Pokémon (bond summary). */
  bonds: string[];
  /** The ladder rung: "Nemesis", "Ally"... */
  state: string;
  /** True for the rival the story follows. */
  ultimate: boolean;
  /** Its signature ace's current form, once it has one. */
  signature: string | null;
  /** Where it stands in the world: "Ahead · 2 badges · fame 9". */
  world: string;
  /** The Ultimate Rival quest chain, for a rival that is or was the Ultimate Rival (else empty). */
  quest: UltimateQuestStep[];
}

export function rivalChronicle(content: Content, run: RunState): RivalLine[] {
  const views = new Map(rivalWorldView(content, run).map((v) => [v.id, v]));
  return run.story.rivals.map((r) => {
    const personality = catalog.personalities.find((p) => p.id === r.archetype);
    const style = catalog.styles.find((s) => s.id === r.style);
    const className = content.trainers.get(r.classId)?.name ?? 'Trainer';
    const topTrait = Object.entries(r.traits).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
    const last = r.memory.lastBattle;
    const closeness = last.hpLeftShare <= RIVAL_CONFIG.spark.closeHpShare ? 'a close one' : 'a clean win for you';
    const learned = r.adaptations.length > 0 ? ` ${r.adaptations[r.adaptations.length - 1]}` : '';
    return {
      title: `${className} ${r.name}, ${personality?.name ?? r.archetype}`,
      summary: `Fights as ${style?.name ?? r.style}. Strongest trait: ${topTrait[0]} (${topTrait[1]}).`,
      state: `${r.state[0]!.toUpperCase() + r.state.slice(1)}, feels ${FEELING_NAMES[rivalFeeling(r).feeling].toLowerCase()}`,
      world: rivalStatusLine(views.get(r.id)!),
      ultimate: ultimateRival(run)?.id === r.id,
      quest: run.story.flags[everUltimateFlag(r.id)] ? ultimateQuest(run, r) : [],
      memory: `Last battle: ${closeness}, ${last.turns} turns.${learned}`,
      signature: aceName(content, r),
      bonds: [...(r.faction ? [`Faction: ${RIVAL_WORLD.factions.find((f) => f.id === r.faction)?.name ?? r.faction}`] : []), ...(r.sponsor ? [`Sponsored by ${RIVAL_WORLD.sponsors.find((x) => x.id === r.sponsor)?.name ?? r.sponsor}`] : []), ...bondLines(content, r), ...(reputation(r) !== 'unknown' ? [`Other trainers call it ${reputation(r)}`] : []), ...(signature(content, r) ? [`Known for: ${signature(content, r)}`] : [])],
    };
  });
}
