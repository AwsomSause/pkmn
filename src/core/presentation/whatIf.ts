// "What if?" reflection on the death screen (I483): which party member's types matched up best against the
// Pokémon that ended the run. Pure and deterministic; advice only, it changes nothing.

import { typeEffectiveness } from '../battle/damage';
import type { Content } from '../contentSchema';
import { lookSpecies } from '../pokemon';
import type { RunState } from '../state';

export function whatIf(content: Content, run: RunState): string | null {
  const by = run.log.defeatedBy;
  if (!by || run.party.length === 0) return null;
  const foe = content.species.get(by.speciesId);
  if (!foe) return null;
  let best: { name: string; score: number } | null = null;
  for (const mon of run.party) {
    const sp = lookSpecies(content, mon);
    const attack = Math.max(...sp.types.map((t) => typeEffectiveness(content.typeChart, t, foe.types)));
    const defence = Math.min(...foe.types.map((t) => typeEffectiveness(content.typeChart, t, sp.types)));
    const score = attack - defence;
    if (!best || score > best.score) best = { name: sp.name, score };
  }
  if (!best) return null;
  return best.score > 0.5
    ? `What if ${best.name} had led against ${foe.name}? Its types matched up best.`
    : `What if you had brought a ${foe.types.map((t) => t).join('/')}-resistant partner? Nothing in your party matched up well against ${foe.name}.`;
}
