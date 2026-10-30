// Trainer Evolutions (plan Part 2c + Kice's answer 1): Champion Red, Champion Blue, Champion Cynthia,
// Rocket Boss Giovanni, King N and Champion Oak. Each is its own archetype (archetypes.json, with
// `evolvedFrom`) that unlocks when the base trainer's quest line is finished, and each has one
// mechanic no other trainer has. This file reads those mechanics from the trainer's perks; the
// battle engine, the shop and the end of a battle call these helpers. Nothing here rolls the
// gameplay random streams: N's roll uses its own seed-derived generator.

import type { Perks } from './archetypes';
import type { Archetype, Content } from './contentSchema';
import { hashSeed, Rng } from './rng';
import type { PokemonInstance, Profile, RunState } from './state';

type Kind<K extends string> = Extract<Perks[number], { kind: K }>;
const first = <K extends Perks[number]['kind']>(perks: Perks | undefined, kind: K): Kind<K> | undefined =>
  (perks ?? []).find((m): m is Kind<K> => m.kind === kind);

/** Champion Red: the last Pokémon standing hangs on at 1 HP, once per battle. */
export function hasChampionLastStand(perks: Perks | undefined): boolean {
  return first(perks, 'championLastStand') !== undefined;
}

/** Whether `uid` is your last Pokémon still able to fight. */
export function isLastStanding(party: readonly PokemonInstance[] | undefined, uid: string): boolean {
  return !!party && party.every((m) => m.uid === uid || m.hp <= 0);
}

/** Champion Blue: the turn-order bonus on the first turn of a trainer battle (below any real priority). */
export function firstStrikeBonus(perks: Perks | undefined, battle: { kind: string; turn: number }): number {
  return first(perks, 'firstStrike') && battle.kind === 'trainer' && battle.turn === 1 ? 0.5 : 0;
}

/** Champion Cynthia: stages added to the lead's best stat at the start of a boss battle (0: none). */
export function championsAuraStages(perks: Perks | undefined): number {
  return first(perks, 'championsAura')?.stages ?? 0;
}

/** Rocket Boss Giovanni: the Black Market's price markup, or null without it. */
export function blackMarketMarkup(perks: Perks | undefined): number | null {
  return first(perks, 'blackMarket')?.markup ?? null;
}

/**
 * King N: whether the wild Pokémon just defeated asks to join. The roll comes from the run seed and
 * the battle count on its own generator, so no other roll changes and a reload asks the same.
 */
export function voiceAsksToJoin(perks: Perks | undefined, run: Pick<RunState, 'seed' | 'encountersCompleted'>): boolean {
  const voice = first(perks, 'voiceOfPokemon');
  if (!voice) return false;
  return new Rng(hashSeed(`${run.seed}::voice-of-pokemon::${run.encountersCompleted}`)).chance(voice.chance);
}

/** Champion Oak: money for a species caught for the first time this run (0: none). */
export function fieldResearchMoney(perks: Perks | undefined): number {
  return first(perks, 'fieldResearch')?.money ?? 0;
}

/** The evolved form of a trainer, if it has one. */
export function evolvedFormOf(content: Content, trainerId: string): Archetype | null {
  return [...content.archetypes.values()].find((a) => a.evolvedFrom === trainerId) ?? null;
}

/** Evolved trainers the profile has unlocked. */
export function unlockedEvolutions(content: Content, profile: Profile): Archetype[] {
  return [...content.archetypes.values()].filter((a) => a.evolvedFrom && profile.claims?.[`evolution:${a.evolvedFrom}`]);
}
