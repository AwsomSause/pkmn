// Nuzlocke and Hardcore Nuzlocke (idea F82; Kice's definitions, plan Q3):
//  - Nuzlocke: only the first wild Pokémon met in each area (a stage) can be caught. A Pokémon that faints is lost for good
//    and goes on the memorial list. A wipe ends the run. Revives never appear (bundled "No Revives").
//  - Hardcore Nuzlocke: the same, plus a party level cap equal to the stage's last enemy (no margin), Poké Balls
//    as the only battle items, and the Set battle style (no voluntary switching in trainer battles).
// Pure: no RNG.

import type { Content } from './contentSchema';
import { getMode } from './rules';
import { getSpecies } from './pokemon';
import type { RunRules, RunState } from './state';

export type NuzlockeLevel = 'standard' | 'hardcore';

/** Which Nuzlocke rules the run plays by, or null. */
export const nuzlockeLevel = (rules: Pick<RunRules, 'modeId'>): NuzlockeLevel | null => getMode(rules.modeId)?.nuzlocke ?? null;
export const isHardcore = (rules: Pick<RunRules, 'modeId'>): boolean => nuzlockeLevel(rules) === 'hardcore';

/** The area a battle belongs to: the stage the party is in. */
export const areaKey = (run: Pick<RunState, 'regionIndex' | 'stage'>): string => `${run.regionIndex}:${run.stage?.index ?? 0}`;

/**
 * A wild battle has begun (mutates `run`). The first catchable one in an area keeps the catch; later ones are marked
 * so Poké Balls refuse. A rival's or boss-like fight never uses up the area.
 */
export function claimArea(run: RunState): void {
  const battle = run.battle;
  if (!battle || !nuzlockeLevel(run.rules)) return;
  if (battle.monRival || battle.totem || battle.raid) return;
  const nz = (run.nuzlocke ??= { areas: [], memorial: [] });
  const key = areaKey(run);
  if (nz.areas.includes(key)) battle.nuzlockeNoCatch = true;
  else nz.areas.push(key);
}

/** The reason a ball can't be thrown, or null. */
export const nuzlockeCatchProblem = (battle: { nuzlockeNoCatch?: boolean }): string | null =>
  battle.nuzlockeNoCatch ? 'Nuzlocke: you already had your one catch in this area.' : null;

/**
 * Fainted party members are lost for good (mutates `run`). If the whole party is down nothing is buried (the run ends instead).
 * Returns the names of the fallen, for the battle-end message.
 */
export function buryFallen(content: Content, run: RunState, cause: string): string[] {
  if (!nuzlockeLevel(run.rules)) return [];
  const fallen = run.party.filter((m) => m.hp <= 0 && m.uid !== run.battle?.loaner);
  if (fallen.length === 0 || fallen.length >= run.party.length) return [];
  const nz = (run.nuzlocke ??= { areas: [], memorial: [] });
  const top = Math.max(...run.party.map((m) => m.level));
  for (const m of fallen) {
    nz.memorial.push({ uid: m.uid, speciesId: m.speciesId, level: m.level, shiny: m.shiny, ace: m.uid === run.log.starterUid || m.level === top, area: areaKey(run), cause });
  }
  const gone = new Set(fallen.map((m) => m.uid));
  run.party = run.party.filter((m) => !gone.has(m.uid));
  return fallen.map((m) => getSpecies(content, m.speciesId).name);
}

/** The memorial as plain lines ("Pikachu Lv.12, lost to Brock" ...). */
export function memorialLines(content: Content, run: Pick<RunState, 'nuzlocke'>): string[] {
  return (run.nuzlocke?.memorial ?? []).map((e) => `${getSpecies(content, e.speciesId).name} Lv.${e.level}${e.ace ? ' ★' : ''} — ${e.cause}`);
}
