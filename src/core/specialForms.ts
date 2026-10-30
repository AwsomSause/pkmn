// Special forms are event-only discoveries (Untitled doc §8). One place says which species are special
// so wild pools, trainer teams, starter pools and rewards can all leave them out the same way.

import { z } from 'zod';
import specialJson from '../data/specialForms.json';
import type { Species } from './contentSchema';

const Route = z.enum(['runEvent', 'gameEvent', 'npcTrade', 'egg', 'researchQuest', 'bossReward', 'secretRoute', 'starterSet', 'spookyMode']);
export const SpecialFormsSchema = z.object({
  note: z.string(),
  families: z.record(z.string(), z.object({ name: z.string(), tag: z.string().optional(), formKind: z.string().optional(), routes: z.array(Route).min(1) })),
  routes: z.record(Route, z.object({ status: z.enum(['supported', 'limited', 'planned']), note: z.string() })),
  ordinary: z.array(z.string()),
});
export const SPECIAL_FORMS = SpecialFormsSchema.parse(specialJson);

/** The special-form family of a species ("delta", "spooky", "regional"...), or null for an ordinary one. */
export function specialFamily(s: Pick<Species, 'id' | 'tags' | 'form'>): string | null {
  if (SPECIAL_FORMS.ordinary.includes(s.id)) return null;
  for (const [id, f] of Object.entries(SPECIAL_FORMS.families)) {
    if (f.tag && s.tags.includes(f.tag as never)) return id;
    if (f.formKind && s.form?.kind === f.formKind) return id;
  }
  return null;
}

export const isSpecialForm = (s: Pick<Species, 'id' | 'tags' | 'form'>): boolean => specialFamily(s) !== null;
