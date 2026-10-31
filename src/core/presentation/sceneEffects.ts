// Data-driven scene effects (catalog 140, 81): the intro of a special form comes from src/data/sceneEffects.json.

import { z } from 'zod';
import effectsJson from '../../data/sceneEffects.json';
import type { Species } from '../contentSchema';
import { specialFamily } from '../specialForms';

const SceneEffectsSchema = z.object({
  note: z.string(),
  formIntro: z.record(z.string(), z.object({ tint: z.string().regex(/^0x[0-9a-fA-F]{6}$/), line: z.string().min(1) })),
});
export const SCENE_EFFECTS = SceneEffectsSchema.parse(effectsJson);

/** The intro burst and line for a special form entering battle, or null for an ordinary species. */
export function formIntro(species: Pick<Species, 'id' | 'tags' | 'form'>, displayName: string): { family: string; tint: number; line: string } | null {
  const family = specialFamily(species);
  const fx = family ? SCENE_EFFECTS.formIntro[family] : undefined;
  if (!family || !fx) return null;
  return { family, tint: Number(fx.tint), line: fx.line.replaceAll('{name}', displayName) };
}
