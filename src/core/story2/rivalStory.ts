// W3 rival choice scenes in a Story Run (design 14.20): a relationship or rest Stop offers one of the six scenes with
// one of the run's rivals; the player's choice goes through dialogue.ts (relationship deltas, flags, a hidden
// consequence), the reply shows next, and due consequences surface as a short scene at the next Stop. Shown through the
// same Story screen as backstory scenes (GameSession.storyScene). No gameplay RNG: the rival and scene come from a hash.

import type { RunState } from '../state';
import { fnv1a } from '../story/moments';
import { playChoice, sceneAvailable, sceneById, SCENES, surfaceConsequences } from './dialogue';
import type { StoryLine, StoryScene } from './module';

const fill = (text: string, name: string): string => text.replace(/\{rival\}/g, name);
const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Stops that offer a rival scene: the relationship Stop and the rest / downtime Stops. */
export const offersRivalScene = (stop: { category: string; slotTags: readonly string[] }): boolean =>
  stop.category === 'relationship' || stop.category === 'recovery' || stop.slotTags.includes('downtime');

/**
 * Offers a rival scene at a Stop (once; nothing if one is already waiting). The rival is the one with the fewest scenes so
 * far (ties by a hash of the Stop), the scene the first one not yet played with that rival. False when none is left.
 */
export function offerRivalScene(run: RunState, key: string): boolean {
  const v2 = run.story.v2;
  if (!v2 || v2.rivalScene || run.story.rivals.length === 0) return false;
  const played = (id: string): number => v2.scenesDone.filter((d) => d.endsWith(`:${id}`)).length;
  const rivals = [...run.story.rivals].sort((a, b) => played(a.id) - played(b.id) || (fnv1a(`${run.seed}::${key}::${a.id}`) % 997) - (fnv1a(`${run.seed}::${key}::${b.id}`) % 997));
  for (const r of rivals) {
    const scene = SCENES.scenes.find((s) => sceneAvailable(run, s.id, r.id));
    if (scene) {
      v2.rivalScene = { scene: scene.id, rival: r.id };
      return true;
    }
  }
  return false;
}

/** Due hidden consequences become a note shown at the next chance (each fires once; dialogue.ts keeps that promise). */
export function surfaceRivalConsequences(run: RunState): number {
  const v2 = run.story.v2;
  if (!v2) return 0;
  const nameOf = (id: string): string => run.story.rivals.find((r) => r.id === id)?.name ?? id;
  const due = surfaceConsequences(run, nameOf);
  for (const d of due) v2.notes.push({ kicker: 'Word on the Road', lines: [{ speaker: null, text: d.line }] });
  if (v2.notes.length > 20) v2.notes.splice(0, v2.notes.length - 20);
  return due.length;
}

/** The note or rival scene waiting to be shown, as a Story screen scene (notes first). Reads state only. */
export function rivalStoryScene(run: RunState): StoryScene | null {
  const v2 = run.story.v2;
  if (!v2) return null;
  const note = v2.notes[0];
  if (note) return { eventId: 'rival-note', kicker: note.kicker, lines: note.lines, choices: [], ending: false };
  const on = v2.rivalScene;
  const scene = on ? sceneById(on.scene) : undefined;
  const rival = on ? run.story.rivals.find((r) => r.id === on.rival) : undefined;
  if (!on || !scene || !rival) return null;
  const lines: StoryLine[] = [{ speaker: null, text: `${cap(scene.place)}.` }, { speaker: null, text: fill(scene.intro, rival.name) }];
  return { eventId: `rival:${scene.id}`, kicker: 'A Rival', lines, choices: scene.choices.map((c) => ({ id: c.id, text: fill(c.label, rival.name) })), ending: false };
}

/** Finishes the note or rival scene on screen. A scene needs a valid choice; its reply (and the rival's reaction) is queued as a note. */
export function finishRivalScene(run: RunState, choiceId?: string): boolean {
  const v2 = run.story.v2;
  if (!v2) return false;
  if (v2.notes.length > 0) {
    v2.notes.shift();
    return true;
  }
  const on = v2.rivalScene;
  const rival = on ? run.story.rivals.find((r) => r.id === on.rival) : undefined;
  if (!on || !rival) {
    v2.rivalScene = null;
    return false;
  }
  const scene = sceneById(on.scene);
  if (!scene?.choices.some((c) => c.id === choiceId)) return false;
  const res = playChoice(run, rival, on.scene, choiceId!);
  v2.rivalScene = null;
  v2.notes.push({ kicker: 'A Rival', lines: [{ speaker: null, text: res.reply }, ...(res.reaction ? [{ speaker: rival.name, text: res.reaction }] : [])] });
  return true;
}
