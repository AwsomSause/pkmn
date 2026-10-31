// Variant support report (catalog 84): every custom form (Delta, Z, Spooky, regional, bespoke) is checked for
// sprites, icon, cry, types, stats, evolution targets, moves, support status and encounter eligibility.
// Read-only. `fileExists` takes a path under public/assets so the same check works in tests and in tools.

import customJson from '../data/customSpecies.json';
import type { Content } from './contentSchema';
import { SPECIAL_FORMS, specialFamily } from './specialForms';

export interface VariantRow {
  id: string;
  family: string | null;
  /** Everything that is wrong with this form (empty: fully supported). */
  problems: string[];
  /** supported (no problems, all its routes supported), limited (routes limited), planned or invalid. */
  status: 'supported' | 'limited' | 'planned' | 'invalid';
  /** The routes by which the form can reach a run (events, trade, egg...). Empty means it is not obtainable. */
  routes: string[];
}

export function variantIds(): string[] {
  const list = customJson as unknown as { id: string }[];
  return list.map((s) => s.id);
}

export function variantRows(content: Content, fileExists: (assetPath: string) => boolean): VariantRow[] {
  return variantIds().map((id) => {
    const s = content.species.get(id);
    const problems: string[] = [];
    if (!s) return { id, family: null, problems: ['not loaded as a species'], status: 'invalid', routes: [] };
    if (s.types.length === 0) problems.push('no types');
    if (Object.values(s.baseStats).some((v) => !(v > 0))) problems.push('a base stat is zero');
    if (s.form && !content.species.has(s.form.base)) problems.push(`base species ${s.form.base} is missing`);
    if (s.evolvesFrom && !content.species.has(s.evolvesFrom)) problems.push(`evolvesFrom ${s.evolvesFrom} is missing`);
    for (const l of s.learnset) if (!content.moves.has(l.move)) problems.push(`unknown move ${l.move}`);
    if (s.learnset.length === 0) problems.push('no learnset');
    const a = s.assets;
    if (!fileExists(`images/pokemon/${a.sprite}.png`)) problems.push('no front sprite');
    if (!fileExists(`images/pokemon/back/${a.sprite}.png`)) problems.push('no back sprite');
    if (!fileExists(`images/pokemon/icons/${a.icon}.png`)) problems.push('no icon');
    if (!fileExists(`audio/cry/${a.cry}.m4a`) && !fileExists(`audio/cry/${a.cry}.ogg`)) problems.push('no cry (the base species cry is the fallback)');
    const family = specialFamily(s);
    const routes = family ? SPECIAL_FORMS.families[family]!.routes : [];
    if (family && routes.length === 0) problems.push('special form with no encounter route');
    const states = routes.map((r) => SPECIAL_FORMS.routes[r]!.status);
    const status = problems.length > 0 ? 'invalid' : states.includes('planned') && !states.some((x) => x === 'supported' || x === 'limited') ? 'planned' : states.every((x) => x === 'supported') ? 'supported' : 'limited';
    return { id, family, problems, status, routes: [...routes] };
  });
}
