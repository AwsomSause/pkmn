// The "Pokémon Acquired" panel text (Untitled document Phase B). Pure: no UI, no RNG.

import { heartStage, temperamentOf } from './shadow';
import { typeEffectiveness } from './battle/damage';
import { TYPE_NAMES, type Content } from './contentSchema';
import { abilityOf, calcStats, getSpecies, isUsableMove } from './pokemon';
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

export interface CatchExtras {
  /** Where it came from ("Caught in Kanto, stage 2"). */
  source?: string;
  /** True when the account never caught this species before. */
  firstDiscovery?: boolean;
  /** Compact mode (Settings > Catch details): name, types, stats, ability and moves only. */
  compact?: boolean;
}

/** Weak and resistant types of a species, as words. */
function matchups(content: Content, types: readonly import('./contentSchema').TypeName[]): string {
  const weak: string[] = [];
  const resist: string[] = [];
  for (const t of TYPE_NAMES) {
    const x = typeEffectiveness(content.typeChart, t, types);
    if (x > 1) weak.push(`${t.toUpperCase()}${x >= 4 ? ' ×4' : ''}`);
    else if (x < 1) resist.push(`${t.toUpperCase()}${x === 0 ? ' (immune)' : ''}`);
  }
  return `Weak to: ${weak.join(', ') || 'nothing'}\nResists: ${resist.join(', ') || 'nothing'}`;
}

/** One move in full: type, category, power, accuracy, PP, with a warning when the game can't use it yet. */
function moveLine(content: Content, id: string): string {
  const m = content.moves.get(id);
  if (!m) return `${id} (unknown)`;
  const warn = isUsableMove(content, id) ? '' : '  ⚠ not supported yet, it will do nothing';
  return `${m.name}  ${m.type.toUpperCase()} ${m.category}  Pow ${m.power ?? '—'}  Acc ${m.accuracy ?? '—'}  PP ${m.pp}${warn}`;
}

/** What the player sees after a catch: type, all six stats now and base, BST, ability, evolution, moves. */
export function catchSummary(content: Content, mon: PokemonInstance, compareTo?: PokemonInstance, extras: CatchExtras = {}): string[] {
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
  const lines = extras.compact
    ? [
        `${species.name}${mon.shiny ? '  ★ Shiny' : ''}   Lv${mon.level}${extras.firstDiscovery ? '   NEW!' : ''}`,
        `Type: ${species.types.map((t) => t.toUpperCase()).join(' / ')}   Ability: ${abilityName}`,
        `Stats: ${statLine(stats as unknown as Record<string, number>)}`,
        `Moves: ${mon.moves.map((m) => content.moves.get(m.id)?.name ?? m.id).join(', ')}`,
      ]
    : [
        `${species.name}${mon.shiny ? '  ★ Shiny' : ''}   Lv${mon.level}   Dex #${String(species.dex).padStart(4, '0')}${extras.firstDiscovery ? '   ★ First discovery!' : ''}`,
        ...(extras.source ? [extras.source] : []),
        `Type: ${species.types.map((t) => t.toUpperCase()).join(' / ')}`,
        matchups(content, species.types),
        `Stats: ${statLine(stats as unknown as Record<string, number>)}`,
        `Base: ${statLine(base as unknown as Record<string, number>)}  (BST ${bst})`,
        `Ability: ${abilityName}`,
        `Can have: ${[...species.abilities.normal, ...(species.abilities.hidden ? [`${species.abilities.hidden} (Hidden)`] : [])].map((id) => content.abilities.get(id.replace(' (Hidden)', ''))?.name ?? id).join(', ') || 'unknown'}`,
        `Evolves: ${evo}`,
        'Moves:',
        ...mon.moves.map((m) => `  ${moveLine(content, m.id)}`),
      ];
  if (mon.shadow) {
    const t = temperamentOf(content, mon);
    lines.splice(1, 0, `SHADOW · ${heartStage(content, mon.shadow.heart)} · Heart Gauge ${mon.shadow.heart}/100 · ${t.label}: ${t.story}`);
  }
  if (mon.blissful) lines.splice(1, 0, `BLISSFUL · ${content.shadowWorld.auras.find((a) => a.id === mon.blissful!.aura)?.label ?? 'Aura'} aura: mends the party a little after battle and calms Shadow Pokémon at rest`);
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
