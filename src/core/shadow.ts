// Shadow Pokémon (catalog #76-77): a hazed Pokémon with a Heart Gauge. While shadowed it hits harder and takes more damage
// (raw, unguarded power); every battle it fights in soothes the gauge, closer bonds soothe faster, and at 0 it is purified.
// Pure rules, no RNG.

import type { Content } from './contentSchema';
import { changeFriendship } from './friendship';
import type { PokemonInstance, RunState } from './state';

export const SHADOW_HEART_START = 100;
export const SHADOW_DAMAGE_DEALT = 1.2;
export const SHADOW_DAMAGE_TAKEN = 1.15;
/** Heart Gauge points soothed by a battle, before the friendship bonus. */
export const SHADOW_BATTLE_SOOTHE = 12;
/** An extra point for every this much friendship. */
export const SHADOW_FRIENDSHIP_STEP = 25;

export const isShadow = (mon: Pick<PokemonInstance, 'shadow'>): boolean => mon.shadow !== undefined;

/** The damage multiplier for one hit: a shadowed attacker hits harder, a shadowed target takes more. */
export function shadowDamageMultiplier(user: Pick<PokemonInstance, 'shadow'>, target: Pick<PokemonInstance, 'shadow'>): number {
  return (isShadow(user) ? SHADOW_DAMAGE_DEALT : 1) * (isShadow(target) ? SHADOW_DAMAGE_TAKEN : 1);
}

/** Heart Gauge points one battle soothes for this Pokémon. */
export function battleSoothe(mon: Pick<PokemonInstance, 'friendship'>): number {
  return SHADOW_BATTLE_SOOTHE + Math.floor(mon.friendship / SHADOW_FRIENDSHIP_STEP);
}

/** Soothes a shadowed Pokémon. Returns true when this purifies it (the Shadow is gone for good). */
export function soothe(content: Content, mon: PokemonInstance, amount: number): boolean {
  if (!mon.shadow) return false;
  const heart = mon.shadow.heart - Math.max(0, amount);
  if (heart > 0) {
    mon.shadow = { heart };
    return false;
  }
  delete mon.shadow;
  changeFriendship(content, mon, 20, 1);
  return true;
}

/** After a won battle: every shadowed Pokémon that fought is soothed. Returns the names that were purified. */
export function soothePartyAfterBattle(content: Content, run: Pick<RunState, 'party'>, participants: readonly string[]): string[] {
  const purified: string[] = [];
  for (const mon of run.party) {
    if (mon.hp <= 0 || !mon.shadow || !participants.includes(mon.uid)) continue;
    if (soothe(content, mon, battleSoothe(mon))) purified.push(content.species.get(mon.speciesId)?.name ?? mon.speciesId);
  }
  return purified;
}
