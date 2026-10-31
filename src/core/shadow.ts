// Shadow Pokémon (catalog #76-77): a hazed Pokémon with a Heart Gauge. While shadowed it hits harder and takes more damage
// (raw, unguarded power); every battle it fights in soothes the gauge, closer bonds soothe faster, and at 0 it is purified.
// Pure rules, no RNG.

import type { Content } from './contentSchema';
import { changeFriendship } from './friendship';
import type { Rng } from './rng';
import { chemistryOf } from './story/chemistry';
import type { PokemonInstance, RunState } from './state';
import type { Temperament } from './shadowWorld/schema';

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

/** The named step of the Heart Gauge a value is in ("Sealed", "Wary", ...; the last one runs down to 1). */
export function heartStage(content: Content, heart: number): string {
  const stages = content.shadowWorld.heartStages;
  return (stages.find((s) => heart > s.above) ?? stages[stages.length - 1]!).name;
}

/** How a Shadow Pokémon recovers, decided by its nature (a Pokémon with no nature gets the first story). */
export function temperamentOf(content: Content, mon: Pick<PokemonInstance, 'nature'>): Temperament {
  const list = content.shadowWorld.temperaments;
  return (mon.nature ? list.find((t) => t.natures.includes(mon.nature!)) : undefined) ?? list[0]!;
}

/** The Heart Gauge a freshly shadowed Pokémon starts with, from a generator the caller owns. */
export function rollShadowHeart(content: Content, rng: Rng): number {
  const { min, max } = content.shadowWorld.startHeart;
  return rng.int(min, max);
}

/** Seals a Pokémon's heart. */
export function makeShadow(mon: PokemonInstance, heart: number): void {
  mon.shadow = { heart: Math.max(1, Math.min(100, heart)) };
}

/** A Sealed Shadow Pokémon sometimes ignores its trainer; `roll` is a 0-99 draw the battle owns. */
export function shadowResists(content: Content, mon: Pick<PokemonInstance, 'shadow'>, roll: number): boolean {
  return Boolean(mon.shadow) && heartStage(content, mon.shadow!.heart) === content.shadowWorld.heartStages[0]!.name && roll < content.shadowWorld.resistPercent;
}

/** Teammates this Pokémon shares a Team Chemistry label with (healthy, in the party). */
function chemistryPartners(content: Content, run: Pick<RunState, 'party' | 'story'>, mon: PokemonInstance): number {
  if (!run.story) return 0;
  return run.party.filter((o) => o.uid !== mon.uid && o.hp > 0 && chemistryOf(content, run as RunState, mon.uid, o.uid) !== null).length;
}

/** Heart Gauge points one battle soothes: the base, scaled by its temperament, plus a bonus for each close teammate. */
export function sootheAmount(content: Content, run: Pick<RunState, 'party' | 'story'>, mon: PokemonInstance): number {
  const t = temperamentOf(content, mon);
  const partners = Math.min(content.shadowWorld.chemistryMaxPartners, chemistryPartners(content, run, mon));
  return Math.max(1, Math.round(battleSoothe(mon) * t.sootheMultiplier) + partners * content.shadowWorld.chemistrySoothe);
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
export function soothePartyAfterBattle(content: Content, run: Pick<RunState, 'party'> & Partial<Pick<RunState, 'story'>>, participants: readonly string[], stageLines?: string[]): string[] {
  const purified: string[] = [];
  for (const mon of run.party) {
    if (mon.hp <= 0 || !mon.shadow || !participants.includes(mon.uid)) continue;
    const before = heartStage(content, mon.shadow.heart);
    const name = content.species.get(mon.speciesId)?.name ?? mon.speciesId;
    const t = temperamentOf(content, mon);
    if (soothe(content, mon, sootheAmount(content, run as Pick<RunState, 'party' | 'story'>, mon))) {
      purified.push(name);
      stageLines?.push(`${name}: ${t.lines.purified}`);
    } else if (mon.shadow && heartStage(content, mon.shadow.heart) !== before) {
      const line = t.lines[heartStage(content, mon.shadow.heart)];
      if (line) stageLines?.push(`${name}: ${line}`);
    }
  }
  return purified;
}
