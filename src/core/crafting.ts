// Crafting: materials from battles and raids, spent at the Workshop service stop (data/crafting.json).
// Materials are rolled from a generator of their own, so no existing roll changes; crafting uses none.

import { z } from 'zod';
import json from '../data/crafting.json';
import { hashSeed, Rng } from './rng';
import { addItem, itemCount } from './items';
import { pickStones } from './expedition/flow';
import type { ArchetypeModifier, Content } from './contentSchema';
import type { RunState } from './state';
import { runPerks } from './archetypes';
import { megaCraftCost } from './trainerPerks';

const Cost = z.record(z.string(), z.number().int().positive());
const Gives = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), item: z.string(), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('rareToken'), battles: z.number().int().positive() }),
  z.object({ kind: z.literal('megaStone') }),
]);
const Drop = z.object({ chance: z.number().min(0).max(1), amount: z.number().int().min(0) });

export const CraftingSchema = z.object({
  note: z.string(),
  materials: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string() })).min(1),
  typeMaterial: z.record(z.string(), z.string()),
  drops: z.object({ wild: Drop, trainer: Drop, boss: Drop.extend({ starCores: z.number().int().min(0) }), raidPerTier: z.number().int().min(0), raidCoreMinTier: z.number().int().min(1), raidCores: z.number().int().min(0) }),
  recipes: z.array(z.object({ id: z.string(), name: z.string(), cost: Cost, money: z.number().int().min(0), minBadges: z.number().int().min(0), gives: Gives })).min(1),
});
export type Recipe = z.infer<typeof CraftingSchema>['recipes'][number];
export const CRAFTING = CraftingSchema.parse(json);

/** A rare-encounter token: rare Pokémon x3 and Legendaries x2 in the encounter table (same as Omen of Rarity). */
export const RARE_TOKEN_EFFECTS: ArchetypeModifier[] = [{ kind: 'encounterWeightMultiplier', group: 'rare', value: 3 }, { kind: 'encounterWeightMultiplier', group: 'legendary', value: 2 }];

export const STAR_CORE = 'star-core';
export const materialName = (id: string): string => CRAFTING.materials.find((m) => m.id === id)?.name ?? id;

function addMaterial(run: RunState, id: string, amount: number): void {
  if (amount > 0) run.materials[id] = (run.materials[id] ?? 0) + amount;
}

/** Materials from a won battle (applies once: the caller clears the battle right after). `raidTier` is 0 outside raids. */
export function gainBattleMaterials(run: RunState, types: string[], kind: 'wild' | 'trainer' | 'boss', raidTier: number, key: string): Record<string, number> {
  const before = { ...run.materials };
  const rng = new Rng(hashSeed(`${run.seed}::materials::${key}:${run.encountersCompleted}`));
  const d = CRAFTING.drops;
  const main = types.map((t) => CRAFTING.typeMaterial[t]).find((m) => m) ?? 'scrap';
  if (raidTier > 0) {
    addMaterial(run, main, d.raidPerTier * raidTier);
    if (raidTier >= d.raidCoreMinTier) addMaterial(run, STAR_CORE, d.raidCores);
  } else {
    const drop = d[kind];
    if (rng.chance(drop.chance)) addMaterial(run, main, drop.amount);
    if (kind === 'boss') addMaterial(run, STAR_CORE, d.boss.starCores);
  }
  const gained: Record<string, number> = {};
  for (const [id, n] of Object.entries(run.materials)) if (n > (before[id] ?? 0)) gained[id] = n - (before[id] ?? 0);
  return gained;
}

/** The materials a recipe charges this run (Calem's discount on Mega Stones, rounded up, at least 1). */
export function recipeCost(content: Content, run: RunState, r: Recipe): Record<string, number> {
  if (r.gives.kind !== 'megaStone') return r.cost;
  const share = megaCraftCost(runPerks(content, run));
  return share === 1 ? r.cost : Object.fromEntries(Object.entries(r.cost).map(([id, n]) => [id, Math.max(1, Math.ceil(n * share))]));
}

export function recipeProblem(content: Content, run: RunState, r: Recipe): string | null {
  if (run.badges.length < r.minBadges) return `Needs ${r.minBadges} badge${r.minBadges === 1 ? '' : 's'}.`;
  for (const [id, n] of Object.entries(recipeCost(content, run, r))) if ((run.materials[id] ?? 0) < n) return `Needs ${n} ${materialName(id)} (you have ${run.materials[id] ?? 0}).`;
  if (run.money < r.money) return `You need ₽${r.money}.`;
  if (r.gives.kind === 'megaStone' && pickStones(content, run, 1, new Rng(hashSeed(`${run.seed}::craft-stone`))).length === 0) return 'No one in your party can use a Mega Stone you do not own.';
  return null;
}

/** Spends the cost and applies the result (mutates `run`; the caller checked `recipeProblem`). Returns a message. */
export function applyRecipe(content: Content, run: RunState, r: Recipe): string {
  for (const [id, n] of Object.entries(recipeCost(content, run, r))) {
    run.materials[id] = (run.materials[id] ?? 0) - n;
    if (run.materials[id] === 0) delete run.materials[id];
  }
  run.money -= r.money;
  const g = r.gives;
  if (g.kind === 'item') {
    addItem(run.inventory, g.item, g.amount);
    return `Crafted ${g.amount}× ${content.items.get(g.item)?.name ?? g.item}.`;
  }
  if (g.kind === 'rareToken') {
    run.perkEffects.push(...RARE_TOKEN_EFFECTS);
    run.tempEffects.push({ effects: RARE_TOKEN_EFFECTS, battles: g.battles, until: 'wild' });
    return `Rare-encounter token: the next ${g.battles} wild encounters are far likelier to be rare.`;
  }
  const [stone] = pickStones(content, run, 1, new Rng(hashSeed(`${run.seed}::craft-stone::${run.nextUid}:${run.encountersCompleted}:${Object.keys(run.inventory).length}`)));
  addItem(run.inventory, stone!.id, 1);
  const ring = itemCount(run.inventory, 'mega-ring') === 0;
  if (ring) addItem(run.inventory, 'mega-ring', 1);
  return `Crafted ${stone!.name}${ring ? ' and a Mega Ring' : ''}.`;
}
