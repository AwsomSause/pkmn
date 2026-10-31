// The Campaign Director (Electric plan §4): gives each region a five-act dramatic arc and a focus,
// and labels the routes on the map with what they promise. It orchestrates existing systems and
// owns no battle rules. Everything is picked from the run's seed, never a gameplay random stream.

import type { Content } from '../contentSchema';
import { currentRegion, getCampaign } from '../regions';
import { waitingRival } from '../rivals/adapt';
import type { MapNode, RunState } from '../state';
import { emit } from '../story/record';
import { FOCUSES, regionFocus, type Focus } from './focus';

export { FOCUSES, regionFocus, type Focus };

export const ACTS = ['arrival', 'escalation', 'turningPoint', 'climax', 'aftermath'] as const;
export type Act = (typeof ACTS)[number];

export const ACT_NAMES: Record<Act, string> = {
  arrival: 'Act I: Arrival',
  escalation: 'Act II: Escalation',
  turningPoint: 'Act III: The Turning Point',
  climax: 'Act IV: The Climax',
  aftermath: 'Act V: The Aftermath',
};


const FOCUS_LINE: Record<Focus, string> = {
  mystery: 'A local mystery hangs over this region, and its secrets lie off the main road.',
  rivals: 'This region belongs to its rivals; expect old faces and fierce rematches.',
  raids: 'Powerful guardians have woken here; raid dens are common.',
  exploration: 'Unmapped country: expeditions and hidden places reward the curious.',
};


/** Extra den chance a raid-focused region gives (and the same for expedition gates in an exploration region). */
export function focusDenBonus(run: RunState, which: 'raids' | 'exploration'): number {
  return regionFocus(run, run.regionIndex) === which ? 0.2 : 0;
}

/** Which act a stage belongs to (the league is the climax). */
export function actOf(content: Content, run: RunState): Act {
  const stage = run.stage;
  if (!stage || stage.kind === 'league') return 'climax';
  const total = Math.max(1, getCampaign(content, run.campaignId).stagesPerRegion);
  const p = stage.index / total;
  return p < 0.25 ? 'arrival' : p < 0.55 ? 'escalation' : p < 0.9 ? 'turningPoint' : 'climax';
}

/** Tells the act into the chronicle when a stage begins (once per stage). */
export function tellAct(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage) return;
  const key = `act:${run.regionIndex}.${stage.kind}.${stage.index}`;
  if (run.story.flags[key] !== undefined) return;
  run.story.flags[key] = true;
  const act = actOf(content, run);
  const prev = run.story.flags[`act:last:${run.regionIndex}`];
  run.story.flags[`act:last:${run.regionIndex}`] = act;
  if (prev === act) return;
  const region = currentRegion(content, run).name;
  const focus = act === 'arrival' ? ` ${FOCUS_LINE[regionFocus(run, run.regionIndex)]}` : '';
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'campaign-act', suppressed: false }, importance: 50, text: `${ACT_NAMES[act]} in ${region}.${focus}` });
}

/** Act V: a regional recap before the next region (once per region). */
export function recapRegion(content: Content, run: RunState): void {
  const key = `recap:${run.regionIndex}`;
  if (run.story.flags[key] !== undefined) return;
  run.story.flags[key] = true;
  const region = currentRegion(content, run).name;
  const bosses = run.story.chronicle.filter((c) => c.where.region === run.regionIndex && c.text.startsWith('Defeated ')).length;
  const rivals = run.story.rivals.filter((r) => r.encounters > 0).length;
  emit(content, run, 'storyMoment', {
    actors: [],
    data: { def: 'campaign-recap', suppressed: false },
    importance: 70,
    text: `${ACT_NAMES.aftermath}: ${region} is behind you (${bosses} boss${bosses === 1 ? '' : 'es'} beaten${rivals > 0 ? `, ${rivals} rival${rivals === 1 ? '' : 's'} met` : ''}). ${FOCUS_LINE[regionFocus(run, run.regionIndex)].split(';')[0]!.replace(/\.$/, '')}.`,
  });
}

// ---------- the route consequence engine ----------

export const ROUTES = ['safe', 'highRisk', 'mystery', 'research', 'nemesis', 'story'] as const;
export type RouteKind = (typeof ROUTES)[number];

export const ROUTE_LABELS: Record<RouteKind, string> = {
  safe: 'Safe path: healing and shops',
  highRisk: 'High-risk path: tougher enemies, better rewards',
  mystery: 'Mystery path: events with unknown but bounded outcomes',
  research: 'Research path: expeditions, minigames and rare finds',
  nemesis: 'Nemesis path: a dangerous recurring rival may be waiting',
  story: 'Story path: the Grand-Enemy is near',
};

/** What a node promises (null for a plain node). The strongest promise wins. */
export function routeKind(run: RunState, node: MapNode): RouteKind | null {
  if (node.sides.some((s) => s.kind === 'raid' && s.raidId?.startsWith('storm-sovereign'))) return 'story';
  if (node.kind === 'trainer' && waitingRival(run)) return 'nemesis';
  if (node.harder || node.sides.some((s) => s.kind === 'raid' || s.kind === 'totem')) return 'highRisk';
  if (node.sides.some((s) => s.kind === 'event')) return 'mystery';
  if (node.sides.some((s) => s.kind === 'expedition' || s.kind === 'minigame' || s.kind === 'fish')) return 'research';
  if (node.sides.some((s) => s.kind === 'heal' || s.kind === 'shop' || s.kind === 'service')) return 'safe';
  return null;
}
