// The "Pokémon Acquired" panel text (Untitled document Phase B). Pure: no UI, no RNG.

import type { Content } from './contentSchema';
import { abilityOf, calcStats, getSpecies } from './pokemon';
import type { PokemonInstance } from './state';

const STAT_LABELS = [
  ['hp', 'HP'],
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
] as const;

function statLine(stats: Record<string, number>): string {
  return STAT_LABELS.map(([k, label]) => `${label} ${stats[k]}`).join('  ');
}

/** What the player sees after a catch: type, all six stats now and base, BST, ability, evolution, moves. */
export function catchSummary(content: Content, mon: PokemonInstance, compareTo?: PokemonInstance): string[] {
  const species = getSpecies(content, mon.speciesId);
  const stats = calcStats(content, mon);
  const base = species.baseStats;
  const bst = STAT_LABELS.reduce((sum, [k]) => sum + base[k], 0);
  const ability = abilityOf(content, mon);
  const abilityName = ability ? (content.abilities.get(ability)?.name ?? ability) : 'None';
  const evo = species.evolutions.length
    ? species.evolutions
        .map((e) => `${getSpecies(content, e.to).name} (${e.level !== undefined ? `Lv${e.level}` : (content.items.get(e.item!)?.name ?? e.item!)})`)
        .join(', ')
    : 'Does not evolve';
  const lines = [
    `${species.name}${mon.shiny ? '  ★ Shiny' : ''}   Lv${mon.level}`,
    `Type: ${species.types.map((t) => t.toUpperCase()).join(' / ')}`,
    `Stats: ${statLine(stats as unknown as Record<string, number>)}`,
    `Base: ${statLine(base as unknown as Record<string, number>)}  (BST ${bst})`,
    `Ability: ${abilityName}`,
    `Evolves: ${evo}`,
    `Moves: ${mon.moves.map((m) => content.moves.get(m.id)?.name ?? m.id).join(', ')}`,
  ];
  if (compareTo) {
    const other = calcStats(content, compareTo);
    const diff = STAT_LABELS.map(([k, label]) => {
      const d = stats[k] - other[k];
      return `${label} ${d > 0 ? '+' : ''}${d}`;
    }).join('  ');
    lines.push(`vs ${getSpecies(content, compareTo.speciesId).name} Lv${compareTo.level}: ${diff}`);
  }
  return lines;
}
