// Interaction prompts (ideas W0): tiny, data-driven skill moments that sit on top of the minigame kit's
// grading style (grade + score) but run in real time: tap, hold, drag, rhythm and a timing ring.
// This file is the pure part: the definitions (validated), the grading maths and the accessibility
// assist. Phaser only collects timestamps and positions (ui/interactionPrompt.ts) and hands them here.
// Nothing here uses a random number or the clock, so the same inputs always give the same grade.

import { z } from 'zod';

export const GRADES = ['miss', 'ok', 'good', 'perfect'] as const;
export type Grade = (typeof GRADES)[number];
const RANK: Record<Grade, number> = { miss: 0, ok: 1, good: 2, perfect: 3 };

/** Offsets (ms or px) that earn each grade. Smaller is stricter. */
const WindowsSchema = z.object({ perfect: z.number().positive(), good: z.number().positive(), ok: z.number().positive() }).refine((w) => w.perfect < w.good && w.good < w.ok, 'windows must widen: perfect < good < ok');
export type Windows = z.infer<typeof WindowsSchema>;

const Base = { id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1), hint: z.string().min(1) };

export const PromptDefSchema = z.discriminatedUnion('kind', [
  /** A target shows up; press it. Graded by reaction time from the moment it appears. */
  z.object({ ...Base, kind: z.literal('tap'), windowsMs: WindowsSchema, expireMs: z.number().int().positive() }),
  /** Press and hold, release when the ring fills (targetMs). Graded by how far the release is from targetMs. */
  z.object({ ...Base, kind: z.literal('hold'), targetMs: z.number().int().positive(), windowsMs: WindowsSchema }),
  /** Drag from the start point to the target point. Graded by how close the release lands (px, in a 0-100 box). */
  z.object({ ...Base, kind: z.literal('drag'), from: z.tuple([z.number(), z.number()]), to: z.tuple([z.number(), z.number()]), windowsPx: WindowsSchema, maxMs: z.number().int().positive() }),
  /** Press on each beat. Graded per beat, then averaged; an unanswered beat is a miss. */
  z.object({ ...Base, kind: z.literal('rhythm'), beatsMs: z.array(z.number().int().min(0)).min(2).max(16), windowsMs: WindowsSchema }),
  /** A ring shrinks onto a circle and lands at landMs; press as it lands. */
  z.object({ ...Base, kind: z.literal('timing'), landMs: z.number().int().positive(), windowsMs: WindowsSchema }),
]);
export type PromptDef = z.infer<typeof PromptDefSchema>;
export type PromptKind = PromptDef['kind'];

export interface PromptResult {
  /** Overall grade. */
  grade: Grade;
  /** 0-100, finer than the grade (for bonuses that scale). */
  score: number;
  /** Per-step grades (one for most kinds, one per beat for rhythm). */
  steps: Grade[];
  /** True when the player skipped or the assist auto-passed it. */
  skipped: boolean;
}

/** Player help (accessibility). `widen` multiplies every window; `skip` auto-passes with `skipGrade`. */
export interface PromptAssist {
  widen?: number;
  skip?: boolean;
  skipGrade?: Grade;
}

const SCORE: Record<Grade, number> = { miss: 0, ok: 50, good: 80, perfect: 100 };

/** The grade for an offset (always ≥ 0). `widen` stretches all three windows (assist). */
export function gradeOffset(offset: number, w: Windows, widen = 1): Grade {
  const o = Math.abs(offset);
  if (o <= w.perfect * widen) return 'perfect';
  if (o <= w.good * widen) return 'good';
  if (o <= w.ok * widen) return 'ok';
  return 'miss';
}

const one = (g: Grade, skipped = false): PromptResult => ({ grade: g, score: SCORE[g], steps: [g], skipped });

/** Auto-pass result for assist `skip`. Never better than 'good', so skipping can't beat a real perfect. */
export function skippedResult(assist: PromptAssist): PromptResult {
  const g: Grade = assist.skipGrade ?? 'ok';
  return one(g === 'perfect' ? 'good' : g, true);
}

/** Tap: `pressMs` is the time since the target appeared; null = never pressed. */
export function judgeTap(def: Extract<PromptDef, { kind: 'tap' }>, pressMs: number | null, assist: PromptAssist = {}): PromptResult {
  if (assist.skip) return skippedResult(assist);
  if (pressMs === null || pressMs > def.expireMs) return one('miss');
  return one(gradeOffset(pressMs, def.windowsMs, assist.widen));
}

/** Hold: `heldMs` is how long the button was down; null = never pressed. */
export function judgeHold(def: Extract<PromptDef, { kind: 'hold' }>, heldMs: number | null, assist: PromptAssist = {}): PromptResult {
  if (assist.skip) return skippedResult(assist);
  if (heldMs === null) return one('miss');
  return one(gradeOffset(heldMs - def.targetMs, def.windowsMs, assist.widen));
}

/** Drag: `end` is where the pointer was released (0-100 box), `ms` how long the drag took; null = never dragged. */
export function judgeDrag(def: Extract<PromptDef, { kind: 'drag' }>, end: [number, number] | null, ms: number, assist: PromptAssist = {}): PromptResult {
  if (assist.skip) return skippedResult(assist);
  if (end === null || ms > def.maxMs) return one('miss');
  const dist = Math.hypot(end[0] - def.to[0], end[1] - def.to[1]);
  return one(gradeOffset(dist, def.windowsPx, assist.widen));
}

/** Timing ring: `pressMs` is the time since the ring started shrinking; null = never pressed. */
export function judgeTiming(def: Extract<PromptDef, { kind: 'timing' }>, pressMs: number | null, assist: PromptAssist = {}): PromptResult {
  if (assist.skip) return skippedResult(assist);
  if (pressMs === null) return one('miss');
  return one(gradeOffset(pressMs - def.landMs, def.windowsMs, assist.widen));
}

/**
 * Rhythm: each press answers the nearest unanswered beat within the 'ok' window (a press can't be used twice,
 * a beat can't be answered twice). The overall grade is the average step score, rounded down to a grade.
 */
export function judgeRhythm(def: Extract<PromptDef, { kind: 'rhythm' }>, pressesMs: readonly number[], assist: PromptAssist = {}): PromptResult {
  if (assist.skip) return skippedResult(assist);
  const reach = def.windowsMs.ok * (assist.widen ?? 1);
  const used = new Set<number>();
  const steps: Grade[] = def.beatsMs.map((beat) => {
    let best = -1;
    let bestOff = Infinity;
    pressesMs.forEach((p, i) => {
      const off = Math.abs(p - beat);
      if (!used.has(i) && off <= reach && off < bestOff) { best = i; bestOff = off; }
    });
    if (best < 0) return 'miss';
    used.add(best);
    return gradeOffset(bestOff, def.windowsMs, assist.widen);
  });
  const score = Math.round(steps.reduce((n, g) => n + SCORE[g], 0) / steps.length);
  return { grade: gradeForScore(score), score, steps, skipped: false };
}

/** The grade a 0-100 score reaches (perfect 95, good 70, ok 35). */
export function gradeForScore(score: number): Grade {
  if (score >= 95) return 'perfect';
  if (score >= 70) return 'good';
  if (score >= 35) return 'ok';
  return 'miss';
}

export const atLeast = (r: PromptResult, g: Grade): boolean => RANK[r.grade] >= RANK[g];

/** Everything the widget needs to know about a prompt's length, in ms (the widget ends the prompt then at the latest). */
export function promptLengthMs(def: PromptDef): number {
  switch (def.kind) {
    case 'tap': return def.expireMs;
    case 'hold': return def.targetMs + Math.round(def.windowsMs.ok * 2);
    case 'drag': return def.maxMs;
    case 'timing': return def.landMs + Math.round(def.windowsMs.ok * 2);
    case 'rhythm': return Math.max(...def.beatsMs) + Math.round(def.windowsMs.ok * 2);
  }
}

/**
 * The shared prompt set later workstreams use by id (aim, throw, shout, scan...). More are added as data here;
 * `PromptDefSchema` is checked for every entry by tests/unit/interaction.test.ts.
 */
const W = (perfect: number, good: number, ok: number): Windows => ({ perfect, good, ok });
export const PROMPTS: readonly PromptDef[] = [
  { id: 'aim-drag', kind: 'drag', label: 'Draw your aim', hint: 'Drag from the Pokémon to the glowing mark.', from: [15, 80], to: [80, 25], windowsPx: W(6, 12, 22), maxMs: 4000 },
  { id: 'throw-ring', kind: 'timing', label: 'Skill throw', hint: 'Press as the ring closes on the circle.', landMs: 1100, windowsMs: W(70, 140, 260) },
  { id: 'shout-tap', kind: 'tap', label: 'Shout!', hint: 'Press the moment the mark appears.', windowsMs: W(220, 380, 650), expireMs: 1200 },
  { id: 'brace-hold', kind: 'hold', label: 'Hold steady', hint: 'Hold, then let go when the ring is full.', targetMs: 1200, windowsMs: W(90, 180, 320) },
  { id: 'echo-rhythm', kind: 'rhythm', label: 'Echo the beat', hint: 'Press on each beat.', beatsMs: [600, 1100, 1600, 2300], windowsMs: W(80, 160, 280) },
];

export const promptById = (id: string): PromptDef => {
  const p = PROMPTS.find((d) => d.id === id);
  if (!p) throw new Error(`Unknown interaction prompt "${id}"`);
  return p;
};
