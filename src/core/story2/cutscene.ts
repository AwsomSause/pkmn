// Cutscene Manager (core): a cutscene is a timeline of steps on six tracks. This module only plans; the UI plays the plan.
// Rules that keep the story honest:
//  - Skipping or reduced motion never drops a step that sets a story flag (`sets`): outcomes do not depend on animation.
//  - `disableAllAnimations` beats everything: only dialogue, portraits and flag steps remain.
//  - Reduce motion removes camera and vfx steps and shortens waits to zero.

import { z } from 'zod';
import { Id, Key } from './schema';
import type { EmoteKind, PoseKind } from '../presentation/poses';

export const TRACKS = ['camera', 'character', 'portrait', 'vfx', 'audio', 'dialogue'] as const;
export type Track = (typeof TRACKS)[number];
export const CUTSCENE_TEMPLATES = ['dialogue_scene', 'reveal', 'chase', 'flashback', 'montage', 'ceremony'] as const;

export const CutsceneStepSchema = z.object({
  /** Start time in milliseconds from the start of the cutscene. */
  at: z.number().int().min(0),
  track: z.enum(TRACKS),
  kind: Id,
  /** How long it lasts, in milliseconds. */
  ms: z.number().int().min(0).default(0),
  textKey: Key.optional(),
  args: z.record(z.string(), z.unknown()).default({}),
  /** Story flags this step sets. Always applied, even when the cutscene is skipped. */
  sets: z.array(Id).default([]),
});
export type CutsceneStep = z.infer<typeof CutsceneStepSchema>;

export const CutsceneSchema = z.object({
  id: Id,
  tier: z.enum(['S', 'A', 'B']),
  template: z.enum(CUTSCENE_TEMPLATES),
  steps: z.array(CutsceneStepSchema).min(1),
  /** The one-line recap card shown after a skip. */
  recapKey: Key,
  skippable: z.boolean().default(true),
});
export type Cutscene = z.infer<typeof CutsceneSchema>;

export interface PlanOptions {
  /** `settings.animationIntensity === 'reduced'` or the Story section's Reduce motion shortcut. */
  reduceMotion: boolean;
  /** `settings.disableAllAnimations`. */
  disableAnimations: boolean;
}

const ANIMATED: ReadonlySet<Track> = new Set(['camera', 'vfx', 'character']);

/** The steps to play, in time order (ties keep authoring order). */
export function planCutscene(c: Cutscene, o: PlanOptions): CutsceneStep[] {
  let steps = c.steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.at - b.s.at || a.i - b.i).map((x) => x.s);
  if (o.disableAnimations) steps = steps.filter((s) => s.track === 'dialogue' || s.track === 'portrait' || s.track === 'audio' || s.sets.length > 0);
  else if (o.reduceMotion) steps = steps.filter((s) => !ANIMATED.has(s.track) || s.sets.length > 0).map((s) => (ANIMATED.has(s.track) ? { ...s, ms: 0 } : s));
  return steps;
}

export const cutsceneLength = (plan: readonly CutsceneStep[]): number => plan.reduce((n, s) => Math.max(n, s.at + s.ms), 0);

/** Subtitle lines: every dialogue step's text, in order. */
export const subtitleKeys = (plan: readonly CutsceneStep[]): string[] => plan.filter((s) => s.track === 'dialogue' && s.textKey).map((s) => s.textKey!);

/** What happens when the player skips: the recap card, and the flags that still get set. */
export function skipCutscene(c: Cutscene): { recapKey: string; flags: string[] } | null {
  if (!c.skippable) return null;
  return { recapKey: c.recapKey, flags: [...new Set(c.steps.flatMap((s) => s.sets))] };
}

// ---------- Trainer Introduction templates ----------

export interface TrainerIntro {
  id: string;
  /** Title card on screen (a text key), when the template has one. */
  titleKey?: string;
  lineKeys: string[];
  pose: PoseKind;
  emote: EmoteKind;
  sting: string;
  ms: number;
}

export const TRAINER_INTROS: readonly TrainerIntro[] = [
  { id: 'rival_challenge', lineKeys: ['intro.rival_challenge.1', 'intro.rival_challenge.2'], pose: 'hop', emote: 'spark', sting: 'sting_rival', ms: 1800 },
  { id: 'leader_pose', titleKey: 'intro.leader_pose.title', lineKeys: ['intro.leader_pose.1'], pose: 'glow', emote: 'bang', sting: 'sting_leader', ms: 2200 },
  { id: 'champion_entry', titleKey: 'intro.champion_entry.title', lineKeys: ['intro.champion_entry.1', 'intro.champion_entry.2'], pose: 'rear', emote: 'spark', sting: 'sting_champion', ms: 3200 },
  { id: 'villain_reveal', lineKeys: ['intro.villain_reveal.1', 'intro.villain_reveal.2'], pose: 'lean', emote: 'dots', sting: 'sting_villain', ms: 2600 },
  { id: 'legendary_focus', lineKeys: ['intro.legendary_focus.1'], pose: 'glow', emote: 'bang', sting: 'sting_legend', ms: 2800 },
  { id: 'grunt_flank', lineKeys: ['intro.grunt_flank.1'], pose: 'hop', emote: 'anger', sting: 'sting_grunt', ms: 1400 },
  { id: 'alpha_roar', lineKeys: ['intro.alpha_roar.1'], pose: 'rear', emote: 'anger', sting: 'sting_alpha', ms: 2000 },
  { id: 'ambush_cut', lineKeys: ['intro.ambush_cut.1'], pose: 'rear', emote: 'bang', sting: 'sting_ambush', ms: 900 },
  { id: 'ally_join', lineKeys: ['intro.ally_join.1'], pose: 'bow', emote: 'note', sting: 'sting_ally', ms: 1600 },
  { id: 'tournament_spotlight', titleKey: 'intro.tournament_spotlight.title', lineKeys: ['intro.tournament_spotlight.1'], pose: 'hop', emote: 'note', sting: 'sting_tournament', ms: 2400 },
];

export const trainerIntro = (id: string): TrainerIntro | undefined => TRAINER_INTROS.find((t) => t.id === id);

/** Which Trainer Introduction a Story Run battle gets: rivals, Gym Leaders and the Elite Four, the Champion. Null for the rest. */
export function introForBattle(b: { trainer: { classId: string } | null; rivalId?: string | null | undefined; rival?: unknown }): { id: string; title: string } | null {
  if (!b.trainer) return null;
  if (b.rivalId || b.rival) return { id: 'rival_challenge', title: 'Rival' };
  if (b.trainer.classId === 'gym-leader') return { id: 'leader_pose', title: 'Gym Leader' };
  if (b.trainer.classId === 'elite-four') return { id: 'leader_pose', title: 'Elite Four' };
  if (b.trainer.classId === 'champion') return { id: 'champion_entry', title: 'Champion' };
  return null;
}

/** The intro's title card (if any) and lines with their tokens filled. Lines whose text is missing are left out. */
export function introText(intro: TrainerIntro, text: (key: string) => string | undefined, values: Record<string, string>): { title: string | null; lines: string[] } {
  const fill = (s: string): string => s.replace(/\{(\w+)\}/g, (whole, k: string) => values[k] ?? whole);
  const title = intro.titleKey ? text(intro.titleKey) : undefined;
  return { title: title ? fill(title) : null, lines: intro.lineKeys.map(text).filter((s): s is string => !!s).map(fill) };
}
