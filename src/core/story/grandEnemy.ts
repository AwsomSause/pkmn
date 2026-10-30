// The Grand-Enemy (Techno blueprint §5): one campaign-long threat with five phases. It never
// appears as a battle of its own; it shows through the region bosses it influences, and it
// remembers the Pokémon that stood against that influence (its Grudge). Phases follow how far
// through the campaign the run is, so the same run always sees the same story.

import { typeEffectiveness } from '../battle/damage';
import type { Content, TypeName } from '../contentSchema';
import type { RunState } from '../state';
import { emit } from './record';

export type GrandPhase = 'omen' | 'firstContact' | 'escalation' | 'reckoning' | 'legacy';

/** How far through the campaign (0 to 1) the run is, by region. */
export function campaignProgress(run: RunState): number {
  return run.regionOrder.length <= 1 ? 1 : run.regionIndex / (run.regionOrder.length - 1);
}

export function grandPhase(content: Content, run: RunState): GrandPhase {
  if (run.victory) return 'legacy';
  const p = campaignProgress(run);
  const c = content.story.grandEnemy;
  if (p >= 1) return 'reckoning';
  if (p >= c.escalationFrom) return 'escalation';
  if (p >= c.contactFrom) return 'firstContact';
  return 'omen';
}

const fought = (uid: string) => `ge:fought:${uid}`;

/** Times this Pokémon led against a boss the Grand-Enemy was influencing. */
export const stoodAgainst = (run: RunState, uid: string): number => Number(run.story.flags[fought(uid)] ?? 0);

/** Called on the first turn of a boss fight; returns which Grand-Enemy moment (if any) to fire. */
export function grandMoment(content: Content, run: RunState, leadUid: string): 'grandOmen' | 'grandShadow' | 'grandGrudge' | null {
  const phase = grandPhase(content, run);
  if (phase === 'omen') return 'grandOmen';
  if (phase === 'legacy') return null;
  run.story.flags[fought(leadUid)] = stoodAgainst(run, leadUid) + 1;
  const h = run.story.histories[leadUid];
  // Its Grudge: a Pokémon that already stood against the influence twice, and has real boss wins, is remembered.
  if (phase === 'reckoning' && h && stoodAgainst(run, leadUid) > content.story.grandEnemy.grudgeAfter && h.bossesBeaten >= 1) return 'grandGrudge';
  return phase === 'firstContact' ? 'grandOmen' : 'grandShadow';
}

/** At the end of a victorious run: the Pokémon that stood against it most carries the title, and the archive records the outcome. */
export function recordGrandLegacy(content: Content, run: RunState): void {
  if (!run.victory) return;
  const c = content.story.grandEnemy;
  let best: { uid: string; n: number } | null = null;
  for (const m of run.party) {
    const n = stoodAgainst(run, m.uid);
    if (n > 0 && (!best || n > best.n)) best = { uid: m.uid, n };
  }
  if (best) {
    const h = run.story.histories[best.uid];
    if (h && !h.titles.includes(c.title)) h.titles.push(c.title);
  }
  const name = best ? (content.species.get(run.story.histories[best.uid]?.speciesId ?? '')?.name ?? 'A Pokémon') : null;
  emit(content, run, 'storyMoment', {
    actors: best ? [best.uid] : [],
    data: { def: 'grand-enemy-legacy', suppressed: false },
    importance: 90,
    text: `${c.name} was turned back${name ? `; ${name} stood against it the longest` : ''}`,
  });
}

// ---------- its own battle, adaptation, weakness discovery ----------

const MET = 'ge:met';
const CATEGORY = 'ge:category';
const WON = 'ge:won';

export const grandMet = (run: RunState): number => Number(run.story.flags[MET] ?? 0);

/** Which fight the campaign calls for in this stage (null: none). Contact at the first contact region's second stage; the reckoning in the last region's second stage. */
export function grandRaidFor(content: Content, run: RunState): 'contact' | 'reckoning' | null {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || stage.index !== 1 || run.victory) return null;
  const last = run.regionOrder.length - 1;
  const contactRegion = Math.min(last, Math.ceil(content.story.grandEnemy.contactFrom * last));
  if (run.regionIndex === last && (last > contactRegion || grandMet(run) > 0)) return 'reckoning';
  if (run.regionIndex === contactRegion && grandMet(run) === 0) return 'contact';
  return null;
}

/** The kind of damage the party leans on: its damaging moves, physical against special (a tie counts as physical). */
export function dominantCategory(content: Content, run: RunState): 'physical' | 'special' {
  let physical = 0;
  let special = 0;
  for (const m of run.party) {
    for (const slot of m.moves) {
      const move = content.moves.get(slot.id);
      if (move?.category === 'physical') physical += 1;
      else if (move?.category === 'special') special += 1;
    }
  }
  return special > physical ? 'special' : 'physical';
}

/**
 * Adaptation: if the party leans on the same kind of damage as when it last fought the Grand-Enemy,
 * the Grand-Enemy braces against it (+1 Defense or Sp. Def). Visible in the preview, so changing tactics beats it.
 */
export function grandAdaptation(content: Content, run: RunState): { stat: 'def' | 'spd'; text: string } | null {
  if (grandMet(run) === 0 || run.story.flags[CATEGORY] !== dominantCategory(content, run)) return null;
  const physical = run.story.flags[CATEGORY] === 'physical';
  return { stat: physical ? 'def' : 'spd', text: `It remembers your ${physical ? 'physical' : 'special'} attacks and braces against them (+1 ${physical ? 'Defense' : 'Sp. Def'}). Fight a different way.` };
}

/** Weakness discovery: after a first fight, the types that hurt this species most are revealed. */
export function grandWeaknesses(content: Content, run: RunState, speciesId: string): string[] {
  if (grandMet(run) === 0) return [];
  const types = content.species.get(speciesId)?.types ?? [];
  return Object.keys(content.typeChart).filter((t) => typeEffectiveness(content.typeChart, t as TypeName, types) > 1);
}

/** Preview lines for the den: what the Grand-Enemy has adapted and what research has revealed. */
export function grandNotes(content: Content, run: RunState, speciesId: string): string[] {
  const out: string[] = [];
  const adapt = grandAdaptation(content, run);
  if (adapt) out.push(adapt.text);
  const weak = grandWeaknesses(content, run, speciesId);
  if (weak.length > 0) out.push(`Research from your last fight: it is weak to ${weak.join(', ')}.`);
  if (grandMet(run) === 0) out.push('You have never fought it. Learn how it fights.');
  return out;
}

/** When the Grand-Enemy's battle begins (mutates `run`): its adaptation takes effect. */
export function startGrandBattle(content: Content, run: RunState): void {
  const adapt = grandAdaptation(content, run);
  if (adapt && run.battle) run.battle.enemyStages[adapt.stat] = Math.min(6, (run.battle.enemyStages[adapt.stat] ?? 0) + 1);
}

/** When the fight ends, won or lost (mutates `run`): remember it, and how the party fought. */
export function endGrandBattle(content: Content, run: RunState, won: boolean, leadUid: string | undefined): void {
  run.story.flags[MET] = grandMet(run) + 1;
  run.story.flags[CATEGORY] = dominantCategory(content, run);
  if (leadUid) run.story.flags[fought(leadUid)] = stoodAgainst(run, leadUid) + 2;
  if (won) run.story.flags[WON] = grandMet(run);
  emit(content, run, 'storyMoment', {
    actors: leadUid ? [leadUid] : [],
    data: { def: 'grand-enemy-battle', suppressed: false },
    importance: won ? 85 : 70,
    text: won ? `${content.story.grandEnemy.name} was driven back` : `${content.story.grandEnemy.name} was too strong, but you learned how it fights`,
  });
}
