// The Extraordinary Pokémon Rivalry Sacrifice (Kice spec §29). The run arms it per battle and records it afterwards;
// the engine checks it on every hit (battle/sacrificeRule.ts `sacrificeFor`).
//
// All of these must hold: a Pokémon rival (core/rivals/monRivals.ts) is on a trainer's team in this battle, its own
// rival (your Pokémon) is in front and about to take a knockout hit from a move, the rival Pokémon is still standing and
// is that trainer's last Pokémon in reserve (everyone else but the attacker has fainted), it isn't the attacker, the
// battle is singles, and this battle's seeded roll armed it. Then it jumps in front of the hit and is gone for the run;
// your Pokémon is fully healed, cured and enraged (its next moves get +priority).

import type { Content } from '../contentSchema';
import { familyId } from '../mastery';
import { hashSeed, Rng } from '../rng';
import type { PokemonInstance, RunState } from '../state';
import { emit } from '../story/record';
import { MAJOR } from './major';
import { carriedMonRival, monRivalById } from './monRivals';

export const SACRIFICE_TITLE = 'Saved by a Rival';

/** Arms the sacrifice for a trainer battle where a rival carries its Pokémon rival (mutates battle). One seeded roll per battle. */
export function armSacrifice(run: RunState, rivalId: string | undefined, enemyTeam: readonly PokemonInstance[], content: Content): void {
  const battle = run.battle;
  const rival = rivalId ? run.story.rivals.find((r) => r.id === rivalId) : undefined;
  const m = rival ? carriedMonRival(run, rival) : null;
  if (!battle || !m || battle.doubles || !run.party.some((p) => p.uid === m.rivalOf)) return;
  const mon = enemyTeam.find((e) => familyId(content, e.speciesId) === familyId(content, m.speciesId));
  if (!mon) return;
  battle.monRival = { id: m.id, uid: mon.uid, rivalOf: m.rivalOf };
  const armed = new Rng(hashSeed(`${run.seed}::rival-sacrifice::${run.encountersCompleted}::${m.id}`)).chance(MAJOR.sacrifice.chance);
  battle.sacrifice = { uid: mon.uid, protects: m.rivalOf, armed, done: false, priority: MAJOR.sacrifice.priority, moves: MAJOR.sacrifice.moves };
}

/** After the sacrifice: the rival Pokémon is gone for the run, your Pokémon remembers it (mutates run; safe to call again). */
export function recordSacrifice(content: Content, run: RunState): void {
  const battle = run.battle;
  const m = monRivalById(run, battle?.monRival?.id);
  if (!battle?.sacrifice?.done || !m || m.sacrificed) return;
  m.sacrificed = true;
  m.history.push('Jumped in front of a knockout blow meant for its rival, and was gone');
  const owner = m.owner ? run.story.rivals.find((r) => r.id === m.owner) : undefined;
  if (owner) delete owner.monRival;
  const foe = content.species.get(battle.enemyTeam.find((e) => e.uid === battle.sacrifice!.uid)?.speciesId ?? m.speciesId)?.name ?? m.speciesId;
  const history = run.story.histories[m.rivalOf];
  if (history && !history.titles.includes(SACRIFICE_TITLE)) history.titles.push(SACRIFICE_TITLE);
  emit(content, run, 'survivedFatal', {
    actors: [m.rivalOf],
    data: { cause: 'rivalSacrifice', monRival: m.id },
    importance: 100,
    emotions: ['determination', 'integrity'],
    text: `${foe} with ${m.mark}, its rival, took a knockout blow in its place and was never seen again`,
  });
}

/** A line when the saved Pokémon meets another of its lost rival's species (null otherwise). */
export function sacrificeEcho(content: Content, run: RunState, foeSpecies: string, activeUid: string): string | null {
  const m = (run.story.monRivals ?? []).find((x) => x.sacrificed && x.rivalOf === activeUid && familyId(content, x.speciesId) === familyId(content, foeSpecies));
  if (!m) return null;
  const name = content.species.get(foeSpecies)?.name ?? foeSpecies;
  return `Your ${m.rivalName} goes still at the sight of the ${name}. It is not the one with ${m.mark}. It never will be again.`;
}
