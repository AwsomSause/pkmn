// Totem rules (pure, no Phaser). A Totem is a bigger single Pokémon with an aura, behaviour phases and
// optional ally calls. An ally takes the field in the Totem's place (the engine swaps them), so turn order
// and the one-against-one rules stay the same; defeating the ally brings the Totem back.

import { Rng, hashSeed } from '../rng';
import { maxHp } from '../pokemon';
import type { Content } from '../contentSchema';
import type { BattleState, PokemonInstance, RunState, TotemBattle } from '../state';
import type { TotemDef } from './schema';

export function getTotem(content: Content, id: string): TotemDef {
  const t = content.totems.totems.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown Totem "${id}"`);
  return t;
}

export function freshTotemBattle(def: TotemDef, uid: string): TotemBattle {
  return { id: def.id, uid, auraDone: false, phasesDone: [], callsUsed: 0, allyUid: null };
}

export function totemTier(content: Content, regionIndex: number): TotemDef['tier'] {
  const list = content.totems.tierByRegion;
  return list[Math.min(regionIndex, list.length - 1)]!;
}

/** The Totem of a stage: one whose type is in the stage's theme (its home), else any of the region's tier. */
export function pickTotemFor(content: Content, run: Pick<RunState, 'seed' | 'regionIndex'>, themeTypes: readonly string[], key: string): TotemDef {
  const tier = totemTier(content, run.regionIndex);
  const inTier = content.totems.totems.filter((t) => t.tier === tier && !t.legendary);
  const home = inTier.filter((t) => themeTypes.includes(t.type));
  const pool = home.length > 0 ? home : inTier.length > 0 ? inTier : content.totems.totems.filter((t) => !t.legendary);
  return new Rng(hashSeed(`${run.seed}::totem-pick::${key}`)).pick(pool);
}

/** Does this stage get a Totem? (Seeded by the run, region and stage only.) */
export function placeTotem(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::totem-den::${run.regionIndex}:${stage.index}`));
  if (!rng.chance(content.totems.denChance)) return;
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && !n.sides.some((s) => s.kind === 'totem' || s.kind === 'raid'));
  if (candidates.length === 0) return;
  const node = rng.pick(candidates);
  const theme = content.themes.get(stage.themeId);
  const def = pickTotemFor(content, run, theme?.types ?? [], `${run.regionIndex}:${stage.index}`);
  node.sides.push({ id: `totem-${stage.index}`, kind: 'totem', totemId: def.id, used: false });
}

export function totemSpecies(def: TotemDef, run: Pick<RunState, 'seed'>, key: string): string {
  return new Rng(hashSeed(`${run.seed}::totem-species::${key}`)).pick(def.species);
}

export function totemLevel(def: TotemDef, scaleEnd: number, cap: number): number {
  return Math.max(2, Math.min(cap, Math.round(scaleEnd) + def.levelBonus));
}

export function applyTotemHp(def: TotemDef, mon: PokemonInstance): void {
  mon.statBoosts = { ...mon.statBoosts, hp: def.hpBoostPercent };
}

/** Level of a called ally: the Totem's level plus its (negative) offset. */
export function allyLevel(def: TotemDef, totemLevel: number): number {
  return Math.max(2, totemLevel + (def.ally?.levelOffset ?? 0));
}

/** True when an ally should be called now (checked at the start of a turn, while the Totem itself is on the field). */
export function allyDue(content: Content, battle: BattleState, active: PokemonInstance): boolean {
  const t = battle.totem;
  if (!t || active.uid !== t.uid || active.hp <= 0) return false;
  const ally = getTotem(content, t.id).ally;
  if (!ally || t.callsUsed >= ally.maxCalls) return false;
  if (t.callsUsed > 0 && !ally.resummon) return false;
  return active.hp / maxHp(content, active) <= ally.triggerHp;
}

export interface TotemPreview {
  id: string;
  name: string;
  tier: string;
  blurb: string;
  speciesId: string;
  level: number;
  aura: string;
  environment: string | null;
  ally: string | null;
  phases: number;
  rewards: string[];
}

export function describeTotemRewards(def: TotemDef): string[] {
  const r = def.rewards;
  const out = [`₽${r.moneyPerLevel} × level`];
  for (const i of r.items) out.push(`${i.item.replace(/-/g, ' ')}${i.chance < 1 ? ` (${Math.round(i.chance * 100)}%)` : ''}`);
  if (r.draftExtra > 0) out.push(`+${r.draftExtra} draft choice${r.draftExtra > 1 ? 's' : ''}`);
  if (r.rareJoin) out.push(`${Math.round(r.rareJoin.chance * 100)}% a rare ${r.rareJoin.species.replace(/-/g, ' ')}`);
  if (r.unlock) out.push(`unlocks ${r.unlock.replace(/-/g, ' ')}`);
  if (r.research > 0) out.push(`${r.research} research`);
  if (r.megaStones > 0) out.push(`up to ${r.megaStones} Mega Stone${r.megaStones > 1 ? 's' : ''}`);
  return out;
}

export function describeAlly(def: TotemDef): string | null {
  const a = def.ally;
  if (!a) return null;
  const help = [a.support.heal ? 'heals the Totem' : '', a.support.weather ? `sets ${a.support.weather}` : '', a.support.screens ? 'raises screens' : ''].filter(Boolean).join(', ');
  return `${a.species.replace(/-/g, ' ')} (${def.twoVsOne ? 'fights beside it from the start in a double battle; ' : ''}up to ${a.maxCalls} call${a.maxCalls > 1 ? 's' : ''}${a.resummon ? ', can be called again' : ''}${help ? `; ${help}` : ''})`;
}
