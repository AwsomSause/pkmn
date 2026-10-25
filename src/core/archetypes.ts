// Trainer archetype modifiers. Archetypes are pure data (src/data/archetypes.json);
// this module only knows how to combine modifier entries by kind, never by name.
//
// Combination rules:
//   *Multiplier kinds multiply together (start at 1).
//   *Offset kinds add together (start at 0).

import type { Archetype, ArchetypeModifierKind, Content } from './contentSchema';

export function getArchetype(content: Content, id: string): Archetype {
  const archetype = content.archetypes.get(id);
  if (!archetype) throw new Error(`Unknown trainer archetype "${id}"`);
  return archetype;
}

export function modifierValue(archetype: Archetype, kind: ArchetypeModifierKind): number {
  const isOffset = kind.endsWith('Offset');
  let value = isOffset ? 0 : 1;
  for (const mod of archetype.modifiers) {
    if (mod.kind !== kind) continue;
    value = isOffset ? value + mod.value : value * mod.value;
  }
  return value;
}

export function xpMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'xpMultiplier');
}

export function moneyMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'moneyMultiplier');
}

export function enemyLevelOffset(archetype: Archetype): number {
  return modifierValue(archetype, 'enemyLevelOffset');
}

/** Applied to the final capture probability (capture itself arrives in Milestone 2). */
export function captureMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'captureMultiplier');
}

export function isArchetypeUnlocked(archetype: Archetype, unlockedIds: readonly string[]): boolean {
  return archetype.unlockedByDefault || unlockedIds.includes(archetype.id);
}
