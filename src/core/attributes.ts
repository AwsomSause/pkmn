// Attributes (GAME_DESIGN.md §9, Milestone 7): six plain attributes and two
// meters (D9). The permanent value grows from lifetime counters (D10); a run
// adds its own modifiers from rewards. Every effect scales in a straight line
// from 0 to the maximum (director decision: each point is worth the full
// percentage, so 100 Strength doubles physical damage); the numbers live in
// balance.json.

import { friendshipPerk } from './trainerPerks';
import { ATTRIBUTE_KEYS, METER_ATTRIBUTES, type AttributeKey, type Content, type Rarity } from './contentSchema';
import type { Profile, RunState } from './state';
import { hyperChance } from './story/hyper';

export type Attributes = Record<AttributeKey, number>;

export function isMeter(key: AttributeKey): boolean {
  return (METER_ATTRIBUTES as readonly string[]).includes(key);
}

export function attributeRange(content: Content, key: AttributeKey): [number, number] {
  const { attributeMin, attributeMax } = content.balance;
  return isMeter(key) ? [-attributeMax, attributeMax] : [attributeMin, attributeMax];
}

function clampAttribute(content: Content, key: AttributeKey, value: number): number {
  const [lo, hi] = attributeRange(content, key);
  return Math.max(lo, Math.min(hi, value));
}

export function zeroAttributes(): Attributes {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Attributes;
}

/** Reads a stored attribute record (missing keys count as 0). */
export function readAttributes(content: Content, record: Record<string, number>): Attributes {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, clampAttribute(content, k, record[k] ?? 0)])) as Attributes;
}

/** The permanent attributes earned by a profile's lifetime counters and discoveries (D10). */
export function permanentAttributes(content: Content, profile: Profile): Attributes {
  const out = zeroAttributes();
  for (const g of content.balance.attributeGrowth) {
    const total = g.counter ? (profile.counters[g.counter] ?? 0) : profile[g.set!].length;
    out[g.attribute] += Math.floor(total / g.per) * g.amount;
  }
  for (const k of ATTRIBUTE_KEYS) out[k] = clampAttribute(content, k, out[k]);
  return out;
}

/** The run's effective attributes: the permanent value at the start plus the run's modifiers, clamped. */
export function effectiveAttributes(content: Content, run: RunState): Attributes {
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((k) => [k, clampAttribute(content, k, (run.baseAttributes[k] ?? 0) + (run.attributeModifiers[k] ?? 0))]),
  ) as Attributes;
}

/** What the attributes add up to, as multipliers and chances. 1 (or 0 for chances) means no effect. */
export interface AttributeEffects {
  physicalDamage: number;
  specialDamage: number;
  speed: number;
  price: number;
  exp: number;
  /** Multiplies friendship gains. */
  friendship: number;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  catchRate: number;
  money: number;
  uncommonWeight: number;
  rareWeight: number;
  epicWeight: number;
  /** 0–1: how strongly the draft avoids repeating an item family (Luck). */
  draftVariety: number;
  shinyChance: number;
}

export function attributeEffects(content: Content, a: Attributes): AttributeEffects {
  const e = content.balance.attributeEffects;
  const max = content.balance.attributeMax;
  const share = (v: number) => Math.max(0, v) / max;
  const rage = share(a.ragePeace);
  const peace = share(-a.ragePeace);
  return {
    physicalDamage: 1 + e.strengthPhysicalDamage * share(a.strength),
    specialDamage: 1 + e.intelligenceSpecialDamage * share(a.intelligence),
    speed: 1 + e.speedStat * share(a.speed),
    price: 1 - e.charismaPriceCut * share(a.charisma),
    exp: 1 + e.charismaExpGain * share(a.charisma),
    friendship: 1 + e.charismaFriendshipGain * share(a.charisma),
    damageDealt: 1 + e.rageDamageDealt * rage,
    damageTaken: (1 + e.rageDamageTaken * rage) * (1 - e.peaceDamageTakenCut * peace),
    healing: 1 + e.peaceHealing * peace,
    catchRate: 1 + e.goodCatch * share(a.goodEvil),
    money: 1 + e.evilMoney * share(-a.goodEvil),
    uncommonWeight: 1 + e.luckUncommonWeight * share(a.luck),
    rareWeight: 1 + e.luckRareWeight * share(a.luck),
    epicWeight: 1 + e.luckEpicWeight * share(a.luck),
    draftVariety: e.luckDraftVariety * share(a.luck),
    shinyChance: 1 + e.luckShinyChance * share(a.luck),
  };
}

export function runAttributeEffects(content: Content, run: RunState): AttributeEffects {
  const effects = attributeEffects(content, effectiveAttributes(content, run));
  const perks = content.archetypes.get(run.archetypeId)?.modifiers;
  return perks ? { ...effects, friendship: effects.friendship * friendshipPerk(perks) } : effects;
}

/** Luck tilts the draft's rarity weights toward uncommon, rare and epic; common is unchanged. */
export function luckWeights(weights: Partial<Record<Rarity, number>>, effects: AttributeEffects): Partial<Record<Rarity, number>> {
  return {
    ...weights,
    uncommon: (weights.uncommon ?? 0) * effects.uncommonWeight,
    rare: (weights.rare ?? 0) * effects.rareWeight,
    epic: (weights.epic ?? 0) * effects.epicWeight,
  };
}

/** Adds a run modifier from a reward (mutates `run`). Returns the attribute's new effective value. */
export function addRunAttribute(content: Content, run: RunState, key: AttributeKey, amount: number): number {
  run.attributeModifiers[key] = (run.attributeModifiers[key] ?? 0) + amount;
  return effectiveAttributes(content, run)[key];
}

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  strength: 'Strength',
  intelligence: 'Intelligence',
  speed: 'Speed',
  charisma: 'Charisma',
  luck: 'Luck',
  love: 'Love',
  ragePeace: 'Rage / Peace',
  goodEvil: 'Good / Evil',
};

/** "Luck 12", "Rage 30", "Peace 10", "Good 0"... */
export function attributeText(key: AttributeKey, value: number): string {
  if (key === 'ragePeace') return value >= 0 ? `Rage ${value}` : `Peace ${-value}`;
  if (key === 'goodEvil') return value >= 0 ? `Good ${value}` : `Evil ${-value}`;
  return `${ATTRIBUTE_LABELS[key]} ${value}`;
}

/** What one attribute does at its current value, in plain words (for the Hub and summaries). */
export function attributeEffectText(content: Content, key: AttributeKey, value: number): string {
  const fx = attributeEffects(content, { ...zeroAttributes(), [key]: value });
  const pct = (m: number) => `${Math.round((m - 1) * 1000) / 10}%`;
  switch (key) {
    case 'strength':
      return `Physical moves +${pct(fx.physicalDamage)} damage`;
    case 'intelligence':
      return `Special moves +${pct(fx.specialDamage)} damage`;
    case 'speed':
      return `Your Pokémon +${pct(fx.speed)} Speed`;
    case 'charisma':
      return `Shop prices −${pct(2 - fx.price)}, +${pct(fx.exp)} experience, +${pct(fx.friendship)} friendship`;
    case 'luck':
      return `Rare rewards ×${fx.rareWeight.toFixed(2)}, epic ×${fx.epicWeight.toFixed(2)}, more varied drafts, shinies ×${fx.shinyChance.toFixed(2)}`;
    case 'love':
      return loveText(content, value);
    case 'ragePeace':
      return value >= 0
        ? `+${pct(fx.damageDealt)} damage dealt, +${pct(fx.damageTaken)} damage taken`
        : `Healing +${pct(fx.healing)}, −${pct(2 - fx.damageTaken)} damage taken`;
    case 'goodEvil':
      return value >= 0 ? `Catching +${pct(fx.catchRate)} easier` : `+${pct(fx.money)} prize money`;
  }
}

/** Love feeds the Hyper moments (story.json): each point adds to their chances. */
function loveText(content: Content, value: number): string {
  const attrs = { ...zeroAttributes(), love: value };
  const pct = (trigger: string) => {
    const def = content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
    return def?.chance ? `${Math.round(hyperChance(def.chance, attrs, false) * 1000) / 10}%` : '—';
  };
  return `Toughened It Out ${pct('toughenedItOut')}, Felt a Bond ${pct('feltABond')}, Pushed Itself Back Up ${pct('pushedBackUp')}`;
}

/** "Luck +1, Rage +2" for what changed between two attribute sets ('' when nothing did). */
export function attributeChanges(before: Attributes, after: Attributes): string {
  const parts: string[] = [];
  for (const k of ATTRIBUTE_KEYS) {
    const d = after[k] - before[k];
    if (d === 0) continue;
    if (k === 'ragePeace') parts.push(d > 0 ? `Rage +${d}` : `Peace +${-d}`);
    else if (k === 'goodEvil') parts.push(d > 0 ? `Good +${d}` : `Evil +${-d}`);
    else parts.push(`${ATTRIBUTE_LABELS[k]} ${d > 0 ? '+' : ''}${d}`);
  }
  return parts.join(', ');
}

/** The attributes that aren't zero, as "Luck 12 · Rage 5" ('none yet' when all are zero). */
export function attributesLine(a: Attributes): string {
  const parts = ATTRIBUTE_KEYS.filter((k) => a[k] !== 0).map((k) => attributeText(k, a[k]));
  return parts.length ? parts.join(' · ') : 'none yet';
}

/** How a permanent attribute grows, in plain words, from the growth rules. */
export function growthText(content: Content, key: AttributeKey): string {
  const words: Record<string, string> = {
    battlesWon: 'battles won',
    encountersCompleted: 'encounters completed',
    moneySpent: 'Poké Dollars spent in shops',
    pokemonCaught: 'Pokémon caught',
    shiniesFound: 'shiny found',
    wildDefeated: 'wild Pokémon defeated',
    healStopsUsed: 'healing stop used',
    caughtKept: 'caught Pokémon kept',
    caughtToCandies: 'caught Pokémon turned into candies',
    evolutions: 'evolution',
    regionsClearedWithStarter: 'region cleared with your starter',
    speciesSeen: 'new species seen',
    speciesCaught: 'new species caught',
    statsBoosted: 'stat your Pokémon raise with a move (Bulk Up, Nasty Plot...)',
  };
  return content.balance.attributeGrowth
    .filter((g) => g.attribute === key)
    .map((g) => {
      const source = g.counter ?? g.set!;
      const type = source.startsWith('defeatedOrCaught.') ? source.slice('defeatedOrCaught.'.length) : null;
      const what = type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}-type Pokémon defeated or caught` : (words[source] ?? source);
      const amount = isMeter(key) ? `${Math.abs(g.amount)} toward ${key === 'ragePeace' ? (g.amount > 0 ? 'Rage' : 'Peace') : g.amount > 0 ? 'Good' : 'Evil'}` : `+${g.amount}`;
      return `${amount} per ${g.per === 1 ? '' : `${g.per.toLocaleString('en-US')} `}${what}`;
    })
    .join('; ');
}
