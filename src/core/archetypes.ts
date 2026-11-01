// Trainer archetype modifiers. Archetypes are pure data (src/data/archetypes.json);
// this module only knows how to combine modifier entries by kind, never by name.
//
// Combination rules:
//   *Multiplier kinds multiply together (start at 1).
//   *Offset kinds add together (start at 0).

import { resolveCounterPerks } from './eventToolkit';
import type { Archetype, ArchetypeModifier, ArchetypeModifierKind, Content, TypeName } from './contentSchema';

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
    const v = (mod as { value?: number }).value ?? 0;
    value = isOffset ? value + v : value * v;
  }
  return value;
}

export function xpMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'xpMultiplier');
}

export function friendshipMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'friendshipMultiplier');
}

export function researchMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'researchMultiplier');
}

/** Whether the trainer shows this kind of map preview (Cynthia: gym teams; Oak: wild Pokémon). */
export function trainerPreviews(archetype: Archetype, what: 'wild' | 'trainers' | 'gymTeam'): boolean {
  return archetype.modifiers.some((m) => m.kind === 'preview' && m.what === what);
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

/** HP restored by healing items is multiplied by this (e.g. Brock's 1.5). */
export function healingMultiplier(archetype: Archetype): number {
  return modifierValue(archetype, 'healingMultiplier');
}

/** How many badges sooner (positive) the shop's stock unlocks. */
export function shopUnlockOffset(archetype: Archetype): number {
  return modifierValue(archetype, 'shopUnlockOffset');
}

/** The trainer's multiplier on one shop item's price (several entries multiply together). */
export function priceMultiplier(archetype: Archetype, itemId: string, isBall = false): number {
  let value = 1;
  for (const mod of archetype.modifiers) {
    if (mod.kind !== 'priceMultiplier') continue;
    if (mod.items?.includes(itemId) || mod.group === 'all' || (mod.group === 'balls' && isBall) || (mod.group === 'otherItems' && !isBall)) value *= mod.value;
  }
  return value;
}

/** Damage multipliers by type for the player's side of a battle (see battle/engine.ts). */
export interface TypeModifiers {
  /** Damage dealt by your Pokémon of a type. */
  damageDealt: Partial<Record<TypeName, number>>;
  /** Super-effective damage taken by your Pokémon of a type. */
  weaknessTaken: Partial<Record<TypeName, number>>;
}

export function typeModifiers(archetype: Archetype): TypeModifiers {
  const out: TypeModifiers = { damageDealt: {}, weaknessTaken: {} };
  for (const mod of archetype.modifiers) {
    if (mod.kind === 'typeDamageMultiplier') out.damageDealt[mod.type] = (out.damageDealt[mod.type] ?? 1) * mod.value;
    if (mod.kind === 'weaknessDamageTakenMultiplier') out.weaknessTaken[mod.type] = (out.weaknessTaken[mod.type] ?? 1) * mod.value;
  }
  return out;
}

/** The trainer's modifier list: battle code reads perks through the helpers in trainerPerks.ts. */
export type Perks = readonly ArchetypeModifier[];

/** The trainer with the run's signature-choice effects added (Rival's Answer and the like; see core/signature.ts). */
export function runArchetype(content: Content, run: { archetypeId: string; perkEffects?: ArchetypeModifier[] }): Archetype {
  const archetype = getArchetype(content, run.archetypeId);
  return run.perkEffects && run.perkEffects.length > 0 ? { ...archetype, modifiers: [...archetype.modifiers, ...run.perkEffects] } : archetype;
}

/** The run's whole perk list (trainer plus signature choices), or undefined for an unknown trainer. */
export function runPerks(content: Content, run: { archetypeId: string; perkEffects?: ArchetypeModifier[]; itemCounters?: Record<string, number> }): Perks | undefined {
  const archetype = content.archetypes.get(run.archetypeId);
  return archetype ? resolveCounterPerks([...archetype.modifiers, ...(run.perkEffects ?? [])], run) : undefined;
}
