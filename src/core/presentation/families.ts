// Animation families (Visual Bible §4.4): every move belongs to one of 26
// reusable visual families, worked out from its data (type, category, flags,
// effects). A family is a small recipe the battle screen plays on top of the
// move's own animation (or alone when the move has none): how it starts, how it
// travels, how it lands and what lingers. Presentation only: the battle rules
// never read this file.

import type { Move } from '../contentSchema';
import type { MovePresentation } from './moveAnims';

export const FAMILY_IDS = [
  'contact', 'heavy-contact', 'bite-slash', 'punch-kick', 'projectile', 'beam', 'wave', 'burst',
  'flame', 'electric', 'ice', 'wind', 'rock-ground', 'poison', 'psychic', 'ghost', 'dragon',
  'healing', 'drain', 'status', 'barrier', 'multi-hit', 'recoil', 'field', 'two-turn', 'signature',
] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

/** How a family's accent travels from the user to the target. */
export type Travel = 'none' | 'dash' | 'orb' | 'beam' | 'wave' | 'tether' | 'rise';
/** What it looks like where it lands. */
export type Impact = 'ring' | 'slash' | 'burst' | 'shards' | 'sparks' | 'cloud' | 'pips' | 'shield' | 'sparkle' | 'quake' | 'swirl';

export interface FamilyRecipe {
  label: string;
  /** Wind-up on the user before it moves. */
  startup: 'none' | 'glow' | 'charge';
  travel: Travel;
  impact: Impact;
  /** Where the impact plays: on the target, or on the user (self moves). */
  on: 'target' | 'user';
  /** A screen-wide wash for field and signature moves. */
  wash: boolean;
  /** How long the accent takes at normal speed. */
  ms: number;
}

const R = (label: string, startup: FamilyRecipe['startup'], travel: Travel, impact: Impact, on: FamilyRecipe['on'], ms: number, wash = false): FamilyRecipe => ({ label, startup, travel, impact, on, wash, ms });

export const FAMILY_RECIPES: Record<FamilyId, FamilyRecipe> = {
  contact: R('Contact strike', 'none', 'dash', 'ring', 'target', 220),
  'heavy-contact': R('Heavy contact strike', 'glow', 'dash', 'burst', 'target', 320),
  'bite-slash': R('Bite / slash / claw', 'none', 'dash', 'slash', 'target', 240),
  'punch-kick': R('Punch / kick', 'none', 'dash', 'burst', 'target', 240),
  projectile: R('Projectile', 'none', 'orb', 'burst', 'target', 280),
  beam: R('Beam', 'charge', 'beam', 'burst', 'target', 360),
  wave: R('Wave / splash', 'none', 'wave', 'ring', 'target', 320),
  burst: R('Burst / explosion', 'charge', 'none', 'burst', 'user', 360, true),
  flame: R('Fire breath / flame stream', 'none', 'beam', 'burst', 'target', 320),
  electric: R('Electric bolt / chain spark', 'none', 'none', 'sparks', 'target', 260),
  ice: R('Ice shard / freeze ring', 'none', 'orb', 'shards', 'target', 300),
  wind: R('Wind / air slash', 'none', 'wave', 'slash', 'target', 280),
  'rock-ground': R('Rock / ground impact', 'none', 'none', 'quake', 'target', 300),
  poison: R('Poison cloud / drip', 'none', 'orb', 'cloud', 'target', 300),
  psychic: R('Psychic pulse / force wave', 'glow', 'wave', 'ring', 'target', 320),
  ghost: R('Ghost apparition / shadow sweep', 'none', 'none', 'swirl', 'target', 320),
  dragon: R('Dragon aura / breath', 'glow', 'beam', 'burst', 'target', 340),
  healing: R('Healing / radiant pulse', 'none', 'rise', 'sparkle', 'user', 320),
  drain: R('Drain / leech tether', 'none', 'tether', 'sparkle', 'target', 360),
  status: R('Status / mental effect', 'none', 'orb', 'swirl', 'target', 280),
  barrier: R('Protection / barrier', 'none', 'none', 'shield', 'user', 300),
  'multi-hit': R('Multi-hit sequence', 'none', 'dash', 'pips', 'target', 320),
  recoil: R('Recoil / self-effect', 'glow', 'dash', 'burst', 'target', 320),
  field: R('Field / weather / terrain setup', 'none', 'none', 'sparkle', 'user', 380, true),
  'two-turn': R('Two-turn charge and release', 'charge', 'beam', 'burst', 'target', 380),
  signature: R('Signature / cinematic attack', 'charge', 'beam', 'burst', 'target', 460, true),
};

const TYPE_FAMILY: Partial<Record<string, FamilyId>> = {
  fire: 'flame', electric: 'electric', ice: 'ice', flying: 'wind', rock: 'rock-ground', ground: 'rock-ground',
  poison: 'poison', psychic: 'psychic', ghost: 'ghost', dragon: 'dragon', water: 'wave',
};

/** The family a move belongs to. The first rule that matches wins, most specific first. */
export function familyOf(move: Pick<Move, 'type' | 'category' | 'power' | 'flags' | 'target' | 'effects'>): FamilyId {
  const fx = move.effects as Record<string, unknown>;
  const flags = new Set(move.flags);
  if (flags.has('zmove') || flags.has('max')) return 'signature';
  if (fx.charge || fx.recharge) return 'two-turn';
  if (fx.selfFaint || fx.userFaint) return 'burst';
  if (fx.protect || fx.shield || fx.substitute || fx.sideMove) return 'barrier';
  if (fx.weather || fx.terrain || fx.field || fx.fieldBoost) return 'field';
  if (fx.drain || fx.strengthSap) return 'drain';
  if (move.category === 'status') {
    if (fx.heal || fx.healWeather || fx.healSand || fx.roost || fx.rest || fx.wish || fx.healTarget || fx.cure) return 'healing';
    return 'status';
  }
  if (fx.hits) return 'multi-hit';
  if (fx.recoil || fx.recoilMaxHp || fx.crashOnMiss) return 'recoil';
  if (flags.has('bite') || flags.has('slicing')) return 'bite-slash';
  if (flags.has('punch')) return 'punch-kick';
  if (flags.has('wind')) return 'wind';
  if (flags.has('pulse')) return 'beam';
  if (flags.has('bullet')) return 'projectile';
  const byType = TYPE_FAMILY[move.type];
  if (flags.has('contact')) return (move.power ?? 0) >= 90 ? 'heavy-contact' : byType === 'rock-ground' ? 'rock-ground' : 'contact';
  if (byType) return byType;
  return (move.power ?? 0) >= 100 ? 'beam' : 'projectile';
}

/**
 * The family a move plays as in battle. Moves that borrow another move's
 * animation are the Z-Moves and Max Moves (no pack has attacks for them), so
 * they get the signature treatment whatever their data says.
 */
export function moveFamily(move: Parameters<typeof familyOf>[0], look: Pick<MovePresentation, 'source'>): FamilyId {
  return look.source === 'type' ? 'signature' : familyOf(move);
}
