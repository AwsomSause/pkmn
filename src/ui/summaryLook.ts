// What the Pokémon summary (summaryMenu.ts) shows, worked out without Phaser so
// it can be tested: types, ability, held items, stats, moves, its story this run.

import { natureEffectText, natureName } from '../core/natures';
import { abilityStatus } from '../core/battle/abilities';
import type { Content, StatName } from '../core/contentSchema';
import { abilityOf, calcStats, getSpecies, maxPp } from '../core/pokemon';
import type { PokemonInstance, RunState } from '../core/state';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const STAT_LABELS: Record<StatName, string> = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
/** Base stats are drawn against this (a little above most Pokémon's best). */
export const BASE_STAT_SCALE = 180;

export interface SummaryInfo {
  name: string;
  level: number;
  types: string[];
  ability: { name: string; text: string } | null;
  /** E.g. "Adamant (+Attack, −Sp. Atk)"; null for a Pokémon from before natures. */
  nature: string | null;
  held: { id: string; name: string; icon: string | null; count: number }[];
  stats: { key: StatName; label: string; value: number; base: number; boosted: boolean }[];
  moves: { id: string; name: string; type: string; category: string; power: string; accuracy: string; pp: string; text: string }[];
  /** Battles, knockouts, bosses beaten this run, e.g. "12 battles · 9 KOs · 2 bosses". */
  record: string | null;
  titles: string[];
  /** Its most memorable moments this run, most memorable first (up to 3). */
  memories: string[];
}

export function summaryInfo(content: Content, run: RunState | null, mon: PokemonInstance): SummaryInfo {
  const species = getSpecies(content, mon.speciesId);
  const stats = calcStats(content, mon);
  const abilityId = abilityOf(content, mon);
  const ability = abilityId ? content.abilities.get(abilityId) : undefined;
  const history = run?.story.histories[mon.uid];
  const record = history
    ? [`${history.battles} battle${history.battles === 1 ? '' : 's'}`, `${history.knockoutsDealt} KO${history.knockoutsDealt === 1 ? '' : 's'}`, history.bossesBeaten ? `${history.bossesBeaten} boss${history.bossesBeaten === 1 ? '' : 'es'}` : '']
        .filter(Boolean)
        .join(' · ')
    : null;
  return {
    name: species.name,
    level: mon.level,
    types: [...species.types],
    nature: mon.nature ? `${natureName(mon.nature)} (${natureEffectText(mon.nature)})` : null,
    ability: ability ? { name: ability.name, text: `${ability.description}${abilityStatus(ability.id) === 'pending' ? ' (not working in battle yet)' : ''}` } : null,
    held: Object.entries(mon.held ?? {}).map(([id, count]) => ({ id, name: content.catalog.get(id)?.name ?? id, icon: content.items.get(id)?.iconAssetId ?? null, count })),
    stats: (Object.keys(STAT_LABELS) as StatName[]).map((key) => ({ key, label: STAT_LABELS[key], value: stats[key], base: species.baseStats[key], boosted: (mon.vitamins[key] ?? 0) > 0 || (mon.statBoosts?.[key] ?? 0) > 0 })),
    moves: mon.moves.map((slot) => {
      const m = content.moves.get(slot.id);
      const power = m?.power ? String(m.power) : '—';
      const accuracy = m?.accuracy ? `${m.accuracy}%` : '—';
      return {
        id: slot.id,
        name: m?.name ?? slot.id,
        type: m?.type ?? 'normal',
        category: m?.category ?? 'status',
        power,
        accuracy,
        pp: `${slot.pp}/${maxPp(content, slot)}`,
        text: m ? `${m.name}: ${cap(m.type)} ${m.category} move. Power ${power}, accuracy ${accuracy}, priority ${m.priority > 0 ? `+${m.priority}` : m.priority}.` : slot.id,
      };
    }),
    record,
    titles: history?.titles ?? [],
    memories: [...(history?.memories ?? [])].sort((a, b) => b.importance - a.importance || b.seq - a.seq).slice(0, 3).map((m) => m.text),
  };
}
