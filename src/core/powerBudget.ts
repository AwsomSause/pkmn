// Power budget (Overhaul slice 4, THE OVERHAUL.md rule 2). The Threat Rating (core/threat.ts)
// scores a built Pokémon; this scores a species *as content*: its base stats, ability and best
// level-up moveset at a fixed level, raised to the strongest battle form it can reach (Mega,
// Primal, Gigantamax). Each species falls in one power class with a cap in balance.json
// `powerBudget`; moves have their own cap on effective power. The content gate
// (`over-power-budget`) lists anything over its cap, so a new form or move can't ship stronger
// than its class allows. Rarity is set separately: rare doesn't mean strong.
// Pure and deterministic: no RNG.

import type { Content, Move, Species } from './contentSchema';
import { gmaxFormFor, stoneForms } from './battle/transform';
import { speciesThreat } from './threat';

export const POWER_CLASSES = ['baby', 'basic', 'middle', 'final', 'legendary', 'mythical', 'form'] as const;
export type PowerClass = (typeof POWER_CLASSES)[number];

const FORM_KINDS = new Set(['mega', 'primal', 'gigantamax', 'battle']);

/** The class a species is budgeted in: battle forms on their own, then legendary/mythical tags, then evolution position. */
export function powerClass(s: Species): PowerClass {
  if (s.form && FORM_KINDS.has(s.form.kind)) return 'form';
  if (s.tags.includes('mythical')) return 'mythical';
  if (s.tags.includes('legendary')) return 'legendary';
  if (s.tags.includes('baby')) return 'baby';
  if (s.evolutions.length === 0) return 'final';
  return s.evolutionStage === 1 ? 'basic' : 'middle';
}

const cache = new WeakMap<Content, Map<string, number>>();

/** The species' own rating: Threat Rating at the budget level with its default moves and ability. */
export function basePower(content: Content, speciesId: string): number {
  let map = cache.get(content);
  if (!map) cache.set(content, (map = new Map()));
  let v = map.get(speciesId);
  if (v === undefined) map.set(speciesId, (v = speciesThreat(content, speciesId, content.balance.powerBudget.level)));
  return v;
}

/** The battle forms this species can reach (Mega and Primal by stone or orb, Gigantamax). */
export function reachableForms(content: Content, speciesId: string): string[] {
  const out = [...stoneForms(content, speciesId, false), ...stoneForms(content, speciesId, true)].map((o) => o.formId);
  const gmax = gmaxFormFor(content, speciesId);
  if (gmax) out.push(gmax);
  return out.filter((id) => content.species.has(id));
}

export interface PowerScore {
  speciesId: string;
  powerClass: PowerClass;
  /** Its own rating. */
  base: number;
  /** The best of its own rating and every battle form it can reach. */
  withForms: number;
  /** `base` plus the Tera and Z spike (a species Z-Crystal counts more than the type Z-Move). */
  withAccess: number;
  cap: number;
}

/** True when some species Z-Crystal is made for this species. */
export function hasSpeciesZ(content: Content, speciesId: string): boolean {
  for (const item of content.items.values()) if (item.effect.kind === 'speciesZCrystal' && item.effect.species.includes(speciesId)) return true;
  return false;
}

export function powerScore(content: Content, s: Species): PowerScore {
  const base = basePower(content, s.id);
  const withForms = Math.max(base, ...reachableForms(content, s.id).map((id) => basePower(content, id)));
  const cls = powerClass(s);
  const a = content.balance.powerBudget.access;
  const z = hasSpeciesZ(content, s.id) ? a.speciesZPercent : a.zPercent;
  const withAccess = Math.round(base * (1 + (a.teraPercent + z) / 100));
  return { speciesId: s.id, powerClass: cls, base, withForms, withAccess, cap: content.balance.powerBudget.caps[cls] };
}

/** A move's effective power: power × accuracy, times the most hits for multi-hit moves. Status moves and fixed-damage moves score 0. */
export function movePower(m: Move): number {
  if (m.category === 'status' || m.power === null) return 0;
  const hits = m.effects.hits ? m.effects.hits[1] : 1;
  return Math.round(m.power * ((m.accuracy ?? 100) / 100) * hits);
}

/** Everything over its cap: species (scored with the forms they can reach) and moves a Pokémon can learn. */
export function overBudget(content: Content): string[] {
  const out: string[] = [];
  for (const s of content.species.values()) {
    const p = powerScore(content, s);
    if (content.balance.powerBudget.exempt[s.id]) continue;
    if (p.base > p.cap) out.push(`species ${s.id} (${p.powerClass}): ${p.base} > ${p.cap}`);
    else if (p.withAccess > p.cap * content.balance.powerBudget.access.headroom) out.push(`species ${s.id} (${p.powerClass}) with Tera/Z access: ${p.withAccess} > ${Math.round(p.cap * content.balance.powerBudget.access.headroom)}`);
  }
  const learned = new Set<string>();
  for (const s of content.species.values()) for (const e of s.learnset) learned.add(e.move);
  const moveCap = content.balance.powerBudget.moveCap;
  for (const id of learned) {
    const m = content.moves.get(id);
    if (m?.supported && movePower(m) > moveCap) out.push(`move ${id}: ${movePower(m)} > ${moveCap}`);
  }
  return out;
}
