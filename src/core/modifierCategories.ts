// Sorts run modifiers into categories for the dedicated Modifiers page, so a
// long list stays browsable. A modifier whose group is not listed lands in
// "Other", so new modifiers appear on the page without touching this file.

import { RUN_RULES, getModifier, type RulesChoice } from './rules';

export interface ModifierCategory {
  id: string;
  label: string;
  /** Modifier groups (see runRules.json) that belong here. */
  groups: readonly string[];
}

export const MODIFIER_CATEGORIES: readonly ModifierCategory[] = [
  { id: 'party', label: 'Party', groups: ['party', 'draft', 'tag-team'] },
  { id: 'economy', label: 'Economy', groups: ['economy', 'economy-stakes', 'supplies'] },
  { id: 'contracts', label: 'Contracts', groups: ['contract-bag', 'contract-rest', 'contract-evolution', 'rules'] },
  { id: 'battle', label: 'Battle', groups: ['type-chart', 'normal-moves', 'freeze-rule', 'sleep-rule', 'ability-pick', 'level-cap', 'speed-clear', 'boss-remix', 'doubles', 'pacifist', 'time-attack', 'random-encounters', 'random-moves', 'luck', 'tag-team'] },
  { id: 'world', label: 'World', groups: ['campaign', 'dex', 'info', 'events'] },
];
const OTHER: ModifierCategory = { id: 'other', label: 'Other', groups: [] };

export function categoryOf(group: string): ModifierCategory {
  return MODIFIER_CATEGORIES.find((c) => c.groups.includes(group)) ?? OTHER;
}

/** Categories that have at least one modifier, in display order ("Other" last). */
export function usedCategories(): ModifierCategory[] {
  const used = new Set(RUN_RULES.modifiers.map((m) => categoryOf(m.group).id));
  return [...MODIFIER_CATEGORIES, OTHER].filter((c) => used.has(c.id));
}

export function modifiersIn(categoryId: string | null) {
  return RUN_RULES.modifiers.filter((m) => categoryId === null || categoryOf(m.group).id === categoryId);
}

/** Turns one modifier on or off. Turning one on switches off any other of the same group. Planned ones cannot be turned on. */
export function toggleModifier(choice: RulesChoice, id: string): RulesChoice {
  const m = getModifier(id);
  if (!m) return choice;
  const on = choice.modifierIds.includes(id);
  if (on) return { ...choice, modifierIds: choice.modifierIds.filter((x) => x !== id) };
  if (m.status !== 'supported') return choice;
  const others = choice.modifierIds.filter((x) => getModifier(x)?.group !== m.group);
  return { ...choice, modifierIds: [...others, id] };
}

/** Names of the active modifiers an enabled one would replace (same group). */
export function replacedBy(choice: RulesChoice, id: string): string[] {
  const m = getModifier(id);
  if (!m || choice.modifierIds.includes(id)) return [];
  return choice.modifierIds.filter((x) => getModifier(x)?.group === m.group).map((x) => getModifier(x)!.name);
}
