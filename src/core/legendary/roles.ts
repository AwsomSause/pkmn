// Battle roles for every Legendary and Mythical base species (Overhaul slice 12, THE OVERHAUL.md 3.6): so they are
// not just stronger ordinary Pokémon. Forms use their base species' role. Data: src/data/legendaryRoles.json.

import { z } from 'zod';
import rolesJson from '../../data/legendaryRoles.json';
import { BoostStatSchema, type BoostStat, type Content } from '../contentSchema';

export const LEGEND_ROLES = ['striker', 'powerhouse', 'wall', 'support', 'controller'] as const;
export type LegendRole = (typeof LEGEND_ROLES)[number];
const RoleSchema = z.enum(LEGEND_ROLES);

export const LegendRolesFileSchema = z.object({
  status: z.literal('supported'),
  source: z.string(),
  roles: z.record(RoleSchema, z.string().min(1)),
  species: z.record(z.string(), RoleSchema),
  /** What each role does the first time its Pokémon comes onto the field (either side): one stat stage. `best-attack` = Attack or Sp. Atk, whichever base stat is higher. */
  entry: z.record(RoleSchema, z.object({ stat: z.union([BoostStatSchema, z.literal('best-attack')]), stages: z.number().int().min(1).max(2) })),
});
export const LEGEND_ROLE_DATA = LegendRolesFileSchema.parse(rolesJson);

/** The role of a Legendary or Mythical species (or form), or null for any other Pokémon. */
export function legendRoleOf(content: Content, speciesId: string): LegendRole | null {
  const s = content.species.get(speciesId);
  if (!s || !(s.tags.includes('legendary') || s.tags.includes('mythical'))) return null;
  return LEGEND_ROLE_DATA.species[s.form?.base ?? s.id] ?? null;
}

/** The stat stage a Legendary or Mythical gets on entering the field for its role, or null (not a legend). */
export function roleEntryBoost(content: Content, speciesId: string): { stat: BoostStat; stages: number } | null {
  const role = legendRoleOf(content, speciesId);
  const e = role ? LEGEND_ROLE_DATA.entry[role] : undefined;
  if (!e) return null;
  if (e.stat !== 'best-attack') return { stat: e.stat, stages: e.stages };
  const base = content.species.get(speciesId)!.baseStats;
  return { stat: base.spa > base.atk ? 'spa' : 'atk', stages: e.stages };
}
