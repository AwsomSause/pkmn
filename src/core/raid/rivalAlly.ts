// A named rival in a rival raid: the rival from the Nemesis work (run.story.rivals) fights the boss with
// one of its own Pokémon. No dice: the same state always gives the same strike.

import { typeEffectiveness } from '../battle/damage';
import type { Content } from '../contentSchema';
import { getSpecies, maxHp } from '../pokemon';
import type { BattleState, PokemonInstance, RaidBattle, RunState } from '../state';

/** Share of the boss's max HP a rival's strike takes before type effectiveness; racing rivals hit harder. */
export const RIVAL_STRIKE_PERCENT = 4;
export const RIVAL_RACE_PERCENT = 6;
/** Rival levels trail the boss by this much (a contender is a little closer). */
export const RIVAL_LEVEL_GAP = 3;
const RIVAL_STRIKE_CAP = 2;

export type RaidRival = NonNullable<RaidBattle['rival']>;

/** The rival that joins (or races) in this raid, or null when the run has none to speak of. Allies first, then the greater rivalry. */
export function pickRaidRival(content: Content, run: Pick<RunState, 'story'>, bossLevel: number, mode: RaidRival['mode']): RaidRival | null {
  const ranked = run.story.rivals
    .filter((r) => r.state !== 'retired')
    .map((r) => {
      const bonded = Object.entries(r.bonds).filter(([id]) => content.species.has(id)).sort((a, b) => b[1].sharedHistory - a[1].sharedHistory || a[0].localeCompare(b[0]))[0]?.[0];
      const speciesId = bonded ?? r.memory?.lastBattle.team.find((id) => content.species.has(id));
      return { r, speciesId };
    })
    .filter((x): x is { r: typeof x.r; speciesId: string } => !!x.speciesId)
    .sort((a, b) => Number(b.r.state === 'ally') - Number(a.r.state === 'ally') || b.r.rivalPotential - a.r.rivalPotential || a.r.id.localeCompare(b.r.id));
  const top = ranked[0];
  if (!top) return null;
  const level = Math.max(5, bossLevel - RIVAL_LEVEL_GAP + (top.r.state === 'contender' ? 2 : 0));
  return { id: top.r.id, name: top.r.name, speciesId: top.speciesId, level, mode };
}

/** What the rival's Pokémon does to the boss this turn (type chart applied, shields respected by the caller). */
export function rivalStrikeDamage(content: Content, rival: RaidRival, boss: PokemonInstance): { amount: number; effectiveness: number } {
  const own = getSpecies(content, rival.speciesId).types;
  const foe = getSpecies(content, boss.speciesId).types;
  const effectiveness = Math.min(RIVAL_STRIKE_CAP, Math.max(...own.map((t) => typeEffectiveness(content.typeChart, t, foe))));
  const percent = rival.mode === 'race' ? RIVAL_RACE_PERCENT : RIVAL_STRIKE_PERCENT;
  return { amount: Math.max(1, Math.floor((maxHp(content, boss) * percent / 100) * effectiveness)), effectiveness };
}

/** Whether the rival fights this turn: it has to be there, and the boss still standing. */
export const rivalActs = (battle: BattleState): boolean => !!battle.raid?.rival && !battle.raid.rivalFinished;
