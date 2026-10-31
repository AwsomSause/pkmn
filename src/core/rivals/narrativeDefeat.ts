// Narrative rival defeats (M12, spec section 3): a rival fight the player is meant to lose without the run ending.
// The loss is a NARRATIVE_DEFEAT, never a STANDARD_DEFEAT: no run-over, no protection item used, no defeat counter,
// no Pokémon harmed. It is rare (maxPerRun), once per rival, and foreshadowed by the meeting before it.

import { z } from 'zod';
import narrativeJson from '../../data/narrativeDefeats.json';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { Rival } from '../story/schema';

export type DefeatType = 'NARRATIVE_DEFEAT' | 'STANDARD_DEFEAT';

export const NarrativeDefSchema = z.object({
  id: z.string().min(1),
  /** The rival must have fought you this many times already (Rival.encounters). */
  minMeetings: z.number().int().min(1),
  minRegionIndex: z.number().int().min(0),
  levelBonus: z.number().int().min(0),
  /** The fight ends as the story loss after this many turns, so it can never stall. */
  maxTurns: z.number().int().min(1).default(60),
  foreshadow: z.string(),
  introLine: z.string(),
  defeatLine: z.string(),
  victoryLine: z.string(),
  afterLine: z.string(),
});
export type NarrativeDef = z.infer<typeof NarrativeDefSchema>;
export const NarrativeConfigSchema = z.object({ note: z.string(), enabled: z.boolean(), maxPerRun: z.number().int().min(0), defs: z.array(NarrativeDefSchema) });
export const NARRATIVE_CONFIG = NarrativeConfigSchema.parse(narrativeJson);

/** Per-run story flag: 'lost' (narrative defeat played) or 'won' (the player won anyway, so it never repeats). */
export const narrativeFlag = (id: string) => `narrative-defeat:${id}`;
const foreshadowFlag = (id: string, rivalId: string) => `narrative-foreshadow:${id}:${rivalId}`;
/** Read by other systems (NPC talk, rival world): the rival that beat the player in a narrative defeat. */
export const narrativeLossFlag = (rivalId: string) => `narrative-loss:${rivalId}`;

export function getNarrativeDef(id: string): NarrativeDef | undefined {
  return NARRATIVE_CONFIG.defs.find((d) => d.id === id);
}

function playedCount(run: RunState): number {
  return NARRATIVE_CONFIG.defs.filter((d) => run.story.flags[narrativeFlag(d.id)] !== undefined).length;
}

/** The definition (if any) a rival's coming rematch should play as a narrative defeat. Pure: it reads, never rolls. */
export function dueNarrativeDefeat(run: RunState, rival: Rival, ordinaryFight: boolean): NarrativeDef | null {
  if (!NARRATIVE_CONFIG.enabled || !ordinaryFight || playedCount(run) >= NARRATIVE_CONFIG.maxPerRun) return null;
  if (run.story.flags[narrativeLossFlag(rival.id)] !== undefined) return null;
  return NARRATIVE_CONFIG.defs.find((d) => run.story.flags[narrativeFlag(d.id)] === undefined && rival.encounters >= d.minMeetings && run.regionIndex >= d.minRegionIndex) ?? null;
}

/** The meeting before a narrative defeat hints at it (once per rival and definition). */
export function foreshadowNote(run: RunState, rival: Rival): string | null {
  if (!NARRATIVE_CONFIG.enabled || playedCount(run) >= NARRATIVE_CONFIG.maxPerRun) return null;
  for (const d of NARRATIVE_CONFIG.defs) {
    if (rival.encounters + 1 !== d.minMeetings || run.story.flags[narrativeFlag(d.id)] !== undefined) continue;
    const key = foreshadowFlag(d.id, rival.id);
    if (run.story.flags[key] !== undefined) continue;
    run.story.flags[key] = 'told';
    return d.foreshadow;
  }
  return null;
}

/** The player won a narrative battle anyway: it counts as an ordinary win and the story moment never repeats. */
export function narrativeWon(run: RunState, id: string): void {
  run.story.flags[narrativeFlag(id)] = 'won';
}

/** Records a narrative defeat in the story (the narrative and rival systems read this event); touches nothing mechanical. */
export function recordNarrativeDefeat(content: Content, run: RunState, def: NarrativeDef, rivalId: string | undefined): void {
  run.story.flags[narrativeFlag(def.id)] = 'lost';
  if (rivalId) run.story.flags[narrativeLossFlag(rivalId)] = run.encountersCompleted;
  const rival = rivalId ? run.story.rivals.find((r) => r.id === rivalId) : undefined;
  emit(content, run, 'storyMoment', {
    data: { narrativeDefeat: def.id, rival: rivalId ?? null, defeatType: 'NARRATIVE_DEFEAT' },
    importance: 85,
    text: `${rival?.name ?? 'The rival'} beat you in a battle the story needed you to lose. ${def.afterLine}`,
  });
}
