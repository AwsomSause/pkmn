// Overhaul slice 23: the 180 pack event chains become ordinary map events.
// Each chain stage is one event (src/data/events.json shape). Stage 1 is a normal stop; later stages are
// "callback" events that appear on a later stage once the player took a continuing option of the one before
// (a flag, checked by the existing event conditions). Outcomes are free text in the pack, so a small keyword
// mapper turns each into real effects (items, coins, healing, friendship, eggs, battles...). An outcome the
// mapper cannot turn into a rule stays story-only: its text shows and its pack flags are recorded, nothing else.
// Pure: no RNG, no run state. The runtime picks and rolls them like any other event.

import { overhaulCatalogs } from './catalogs';

export interface ChainsConfig {
  enabled: boolean;
  /** Legendary chains do not start before this stage of the run (later than the first region). */
  legendaryMinStage: number;
}
export const DEFAULT_CHAINS_CONFIG: ChainsConfig = { enabled: true, legendaryMinStage: 7 };

/** A catalog item reduced to what the mapper needs. */
export interface PoolItem { id: string; family: string; rarity: string; status: string }
type Effect = Record<string, unknown>;
type RawEvent = Record<string, unknown>;

/** Which wild Pokémon a legendary chain's last stage offers (one of them, by the event roll). */
export const LEGEND_SPECIES: Record<string, string[]> = {
  'legend-lugia-shrine': ['lugia'],
  'legend-hooh-pursuit': ['ho-oh'],
  'legend-birds-trial': ['articuno', 'zapdos', 'moltres'],
  'legend-mewtwo-crisis': ['mewtwo'],
  'legend-beasts-pursuit': ['raikou', 'entei', 'suicune'],
  'legend-weather-crisis': ['kyogre', 'groudon', 'rayquaza'],
  'legend-eon-pursuit': ['latias', 'latios'],
  'legend-regis-shrine': ['regirock', 'regice', 'registeel'],
  'legend-time-space-trial': ['dialga', 'palkia'],
  'legend-giratina-shrine': ['giratina'],
  'legend-lake-trial': ['uxie', 'mesprit', 'azelf'],
  'legend-ideals-calling': ['reshiram', 'zekrom'],
  'legend-aura-crisis': ['xerneas', 'yveltal'],
  'legend-sun-moon-shrine': ['solgaleo', 'lunala'],
  'legend-sword-shield-calling': ['zacian', 'zamazenta'],
  'legend-ruin-quartet-shrine': ['wo-chien', 'chien-pao', 'ting-lu', 'chi-yu'],
  'legend-guardians-trial': ['tapu-koko', 'tapu-lele', 'tapu-bulu', 'tapu-fini'],
  'legend-justice-trial': ['cobalion', 'terrakion', 'virizion'],
  'legend-necrozma-crisis': ['necrozma'],
  'legend-eternal-crisis': ['eternatus'],
};

const RARITY_MAP: Record<string, string> = { common: 'common', uncommon: 'uncommon', rare: 'rare', very_rare: 'epic', unique: 'epic', legendary: 'epic' };
const COINS: Record<string, number> = { common: 40, uncommon: 70, rare: 110, very_rare: 150, unique: 150, legendary: 200 };
const LEVEL_BONUS: Record<string, number> = { common: 0, uncommon: 1, rare: 2, very_rare: 3, unique: 3, legendary: 4 };
/** A label that ends the chain: the player walked away. */
const END_LABEL = /^(ignore|leave|decline|skip|retreat|flee|walk away|lose|watch|hide|seal|block|run|fail|bow|keep it|wave|keep walking|force|smash|let |refuse|pass)/i;
const TYPE_REGIONS = new Set(['water', 'fire', 'grass', 'ice', 'rock', 'ground', 'electric', 'ghost', 'dragon', 'steel', 'dark', 'psychic', 'fairy', 'flying', 'bug', 'poison', 'fighting', 'normal']);

export interface Pools { berry: string[]; rareBerry: string[]; heal: string[]; rareHeld: string[]; tm: string[]; valuable: string[]; rareValuable: string[]; map: string[]; evo: string[] }

export function buildPools(items: readonly PoolItem[]): Pools {
  const ok = items.filter((i) => i.status === 'supported' || i.status === 'existing');
  const pick = (family: RegExp, rarities: string[]) => ok.filter((i) => family.test(i.family) && rarities.includes(i.rarity)).map((i) => i.id).sort();
  return {
    berry: pick(/^Berries/, ['common']),
    rareBerry: pick(/^Berries/, ['rare', 'epic']),
    heal: pick(/^Healing/, ['common', 'uncommon']),
    rareHeld: pick(/^(Held items|Battle held items|Type boosters)/, ['rare', 'epic']),
    tm: pick(/^TMs/, ['common', 'uncommon', 'rare']),
    valuable: pick(/^Valuables/, ['common', 'uncommon']),
    rareValuable: pick(/^Valuables/, ['rare', 'epic']),
    map: pick(/^Map and encounter/, ['common', 'uncommon']),
    evo: pick(/^Evolution items/, ['common', 'uncommon']),
  };
}

export type MapKind = 'none' | 'effects' | 'battle' | 'story';
export interface Mapped { kind: MapKind; effects: Effect[]; battle?: Record<string, unknown> }

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
function countIn(text: string): number {
  const m = /\b(\d+|one|two|three|four|five)\b/.exec(text);
  if (!m) return 1;
  const n = Number(m[1]);
  return Math.min(5, Number.isFinite(n) ? n : (NUM[m[1]!] ?? 1));
}

/** Turn a pack outcome sentence into real effects. `rarity` is the pack chain rarity; `legend` is the legendary species list for a legendary battle outcome. */
export function mapOutcome(outcome: string, rarity: string, pools: Pools, legend?: string[]): Mapped {
  const s = outcome.toLowerCase().trim();
  const effects: Effect[] = [];
  const coins = COINS[rarity] ?? 40;
  const itemFrom = (ids: string[], count = 1) => { if (ids.length > 0) effects.push({ kind: 'itemFrom', ids, count }); return ids.length > 0; };
  if (s === '' || /^(nothing|safe|safe, nothing|nothing happens|nothing\.)$/.test(s)) return { kind: 'none', effects };

  // Battles first: they carry their own win reward.
  if (/\b(battle|duel|trial|encounter|fight)\b/.test(s) && !/\bno battle\b/.test(s) && !/\bresets?\b|\bretry\b/.test(s) && !/^(a )?(trial of|three small|four short)/.test(s)) {
    const win: Effect[] = [{ kind: 'money', amount: coins }];
    if (legend && legend.length > 0) return { kind: 'battle', effects, battle: { kind: 'wild', species: legend, levelBonus: LEVEL_BONUS[rarity] ?? 4, win: [] } };
    if (/wild/.test(s)) return { kind: 'battle', effects, battle: { kind: 'wild', types: [], levelBonus: LEVEL_BONUS[rarity] ?? 0, win } };
    const double = /double/.test(s);
    const harder = /harder|trial/.test(s);
    return { kind: 'battle', effects, battle: { kind: 'trainer', name: double ? 'Double Challengers' : 'Challenger', size: double ? 2 : harder ? 3 : 2, levelBonus: (LEVEL_BONUS[rarity] ?? 0) + (harder ? 1 : 0), win } };
  }
  const wildCatch = /catchable wild|joins the walk|in disguise/.test(s);
  if (wildCatch) return { kind: 'battle', effects, battle: { kind: 'wild', types: [], levelBonus: LEVEL_BONUS[rarity] ?? 0, win: [{ kind: 'money', amount: Math.round(coins / 2) }] } };

  const coin = /(\d+)\s*coins?/.exec(s);
  if (coin) effects.push({ kind: 'money', amount: Number(coin[1]) });
  else if (/\ba coin\b|common stone or a coin|discount|small reward|^a reward$|a reward/.test(s)) effects.push({ kind: 'money', amount: Math.round(coins * 0.75) });

  if (/rare berry/.test(s)) itemFrom(pools.rareBerry);
  else if (/berr/.test(s) || /snack/.test(s)) itemFrom(pools.berry, /berr/.test(s) ? countIn(s) : 1);
  if (/healing item|jam|parent thanks/.test(s)) itemFrom(pools.heal);
  if (/rare tm|\btm\b/.test(s)) itemFrom(pools.tm);
  if (/lantern|feather|bait|umbrella/.test(s)) itemFrom(pools.map);
  if (/common stone/.test(s)) itemFrom(pools.evo);
  if (/rare item|rare water item|part item|keepsake|curiosity|random same-rarity|a gem|token/.test(s)) itemFrom(/rare|keepsake|part/.test(s) ? pools.rareHeld.concat(pools.rareValuable) : pools.valuable);
  if (/common egg|\begg\b/.test(s)) effects.push({ kind: 'egg', species: [], types: [], left: 3, unit: 'battle' });
  if (/heal/.test(s) && !/healing item/.test(s)) effects.push({ kind: 'heal', share: 0.25 });
  if (/morale|friendship|bond|calm|handshake|trust|pleased|thank/.test(s)) effects.push({ kind: 'friendship', amount: 4, who: 'party' });
  if (/blessing|luck/.test(s)) effects.push({ kind: 'attribute', key: 'luck', amount: 3 });
  if (/vision|hint|riddle|secret|clue|tip|warning|voice/.test(s)) effects.push({ kind: 'research', amount: 4 });

  return effects.length > 0 ? { kind: 'effects', effects } : { kind: 'story', effects };
}

function flagKey(flag: string): string { return flag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'; }
const sentence = (t: string) => { const x = t.trim(); return x === '' ? 'Nothing comes of it.' : `${x.charAt(0).toUpperCase()}${x.slice(1)}${/[.!?]$/.test(x) ? '' : '.'}`; };

export interface ChainStats { chains: number; stages: number; options: number; mapped: number; battles: number; none: number; story: number }

/** All chains as raw map-event objects (validated later by the normal events schema), plus coverage numbers. */
export function chainEvents(items: readonly PoolItem[], config: ChainsConfig = DEFAULT_CHAINS_CONFIG): { events: RawEvent[]; stats: ChainStats } {
  const pools = buildPools(items);
  const stats: ChainStats = { chains: 0, stages: 0, options: 0, mapped: 0, battles: 0, none: 0, story: 0 };
  const events: RawEvent[] = [];
  for (const chain of overhaulCatalogs().event_chains.entries) {
    stats.chains++;
    const legendary = chain.rarity === 'legendary';
    const typeRegion = (chain.regions ?? []).filter((r) => TYPE_REGIONS.has(r));
    chain.stages.forEach((stage, si) => {
      stats.stages++;
      const last = si === chain.stages.length - 1;
      const prev = si > 0 ? chain.stages[si - 1]! : null;
      const requires: Effect[] = [];
      // A later stage waits its window: `ovt-<previous stage>` counts the map nodes since that stage (tickChainTimers), and the stage only
      // shows between its min and max nodes; past the max the chain lapses.
      if (prev) requires.push({ kind: 'flag', key: `ovc-${prev.id}` }, { kind: 'flag', key: `ovt-${prev.id}`, atLeast: stage.minNodesAfterPrevious, atMost: stage.maxNodesAfterPrevious });
      else if (legendary) requires.push({ kind: 'flag', key: 'ovc-legend', atMost: 0 });
      const choices = stage.options.map((o) => {
        stats.options++;
        const mapped = mapOutcome(o.outcome, chain.rarity, pools, legendary && last && /^battle$/i.test(o.label.trim()) ? LEGEND_SPECIES[chain.id] : undefined);
        if (mapped.kind === 'none') stats.none++; else if (mapped.kind === 'story') stats.story++; else if (mapped.kind === 'battle') stats.battles++; else stats.mapped++;
        const effects: Effect[] = [...mapped.effects];
        const continues = !last && o.sets.length > 0 && !END_LABEL.test(o.label.trim());
        for (const f of o.sets) effects.push({ kind: 'flag', key: `ovp-${flagKey(f)}`, amount: 1 });
        if (continues) effects.push({ kind: 'flag', key: `ovc-${stage.id}`, amount: 1 }, { kind: 'flag', key: `ovt-${stage.id}`, amount: 0 });
        if (legendary && si === 0 && continues) effects.push({ kind: 'flag', key: 'ovc-legend', amount: 1 });
        return { label: o.label, requires: o.needs ? [{ kind: 'flag', key: `ovp-${flagKey(o.needs)}` }] : [], success: { text: sentence(o.outcome), effects, ...(mapped.battle ? { battle: mapped.battle } : {}) } };
      });
      events.push({
        id: `ovc-${stage.id}`,
        name: chain.title,
        group: 'Overhaul chains',
        stop: 'event',
        rarity: RARITY_MAP[chain.rarity] ?? 'common',
        types: typeRegion,
        minStage: legendary ? config.legendaryMinStage : si === 0 ? 1 : 2,
        requires,
        callback: si > 0,
        intro: stage.scene,
        choices,
      });
    });
  }
  return { events, stats };
}

/** Highest node count a chain timer keeps (beyond every stage window). */
const TIMER_CAP = 99;

/**
 * One map node passed: every running chain timer (`ev:ovt-*`, started at 0 by the stage before) counts up. A save from before timers
 * existed has `ev:ovc-*` without its timer: that one starts now, so its next stage still comes.
 */
export function tickChainTimers(flags: Record<string, unknown>): void {
  for (const key of Object.keys(flags)) {
    if (key.startsWith('ev:ovc-') && key !== 'ev:ovc-legend' && Number(flags[key] ?? 0) > 0 && flags[`ev:ovt-${key.slice(7)}`] === undefined) flags[`ev:ovt-${key.slice(7)}`] = 0;
  }
  for (const key of Object.keys(flags)) if (key.startsWith('ev:ovt-')) flags[key] = Math.min(TIMER_CAP, Number(flags[key] ?? 0) + 1);
}
