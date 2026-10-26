// Adds moves to src/data/moves.json from the director's move list (a saved
// copy of pokemondb.net/move/all: name, type, category, power, accuracy, PP,
// a one-line effect and its chance).
//
//   npm run data:moves -- <path to pokemon_moves_list.html>
//
// Every move in the list is added. A move is "supported" only when every
// sentence of its effect is something the battle engine already does (plain
// damage, stat changes, status, flinching, draining, recoil, priority, high
// critical-hit ratio, level damage, and since M8.75 part C confusion,
// multi-hit, recharge, healing, Protect, one-hit KOs, Explosion, False Swipe,
// binding, Leech Seed and a few power rules). The rest are added with
// `supported: false` and `needs` (the effect text still to build), so
// learnsets can list them and the game skips them until they work. Supported
// moves already in moves.json keep their effects; their power, accuracy and
// PP are checked against the list. Unsupported moves are rebuilt each run, so
// a move becomes supported as soon as the engine (and this tool) can run it.
//
// Priority and gaps in the list (Z-Moves and Max Moves have no category) are
// filled from PokeAPI's moves.csv, downloaded into .cache/pokeapi if missing.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const listPath = process.argv[2];
if (!listPath) {
  console.error('Usage: npm run data:moves -- <path to pokemon_moves_list.html>');
  process.exit(1);
}

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const movesPath = join(dataDir, 'moves.json');

type Stat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';
type StatChange = { stat: Stat; stages: number; target: 'self' | 'enemy'; chance: number };
type Effects = {
  status?: { id: 'brn' | 'psn' | 'par' | 'slp' | 'frz'; chance: number };
  flinchChance?: number;
  statChanges?: StatChange[];
  drain?: number;
  recoil?: number;
  fixedDamage?: 'level';
  confuse?: { chance: number };
  hits?: [number, number];
  recharge?: true;
  heal?: number;
  protect?: true;
  ohko?: true;
  selfFaint?: true;
  leaveOne?: true;
  bind?: true;
  seed?: true;
  doubleBelowHalf?: true;
  lowHpPower?: true;
  targetsDefense?: true;
  ignoreStages?: true;
  charge?: { semi?: Semi; sunSkips?: true; boosts?: StatChange[] };
  hitsSemi?: { semi: Semi; double: boolean };
  lockIn?: true;
  weather?: 'rain' | 'sun' | 'sand' | 'snow' | 'hail';
  weatherBall?: true;
  healWeather?: true;
  healSand?: true;
  sureIn?: 'rain' | 'snow';
  firstTurnOnly?: true;
  breaksProtect?: true;
};
type Semi = 'air' | 'underground' | 'underwater' | 'vanished';
type MoveRow = {
  id: string;
  name: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  critStage: number;
  target: 'enemy' | 'self';
  flags: string[];
  effects: Effects;
  supported?: false;
  needs?: string;
};

/** Recoil is "User receives recoil damage." in the list, without the amount; these are the official fractions. */
const RECOIL: Record<string, number> = {
  'take-down': 1 / 4, submission: 1 / 4, 'wild-charge': 1 / 4, 'head-charge': 1 / 4, 'chloroblast': 1 / 2,
  'double-edge': 1 / 3, 'brave-bird': 1 / 3, 'flare-blitz': 1 / 3, 'wood-hammer': 1 / 3, 'volt-tackle': 1 / 3,
  'wave-crash': 1 / 3, 'light-of-ruin': 1 / 2, 'head-smash': 1 / 2,
};
/** "User attacks first." doesn't say how strongly; these moves go before other priority moves. */
const PRIORITY: Record<string, number> = { 'extreme-speed': 2, 'feint': 2, 'first-impression': 2 };

/**
 * Effects the list's text doesn't spell out (or that came after the move was
 * first added): applied to these moves on every run, supported ones included.
 */
const EXTRA_EFFECTS: Record<string, Effects> = {
  gust: { hitsSemi: { semi: 'air', double: true } },
  twister: { hitsSemi: { semi: 'air', double: true } },
  thunder: { hitsSemi: { semi: 'air', double: false }, sureIn: 'rain' },
  hurricane: { hitsSemi: { semi: 'air', double: false }, sureIn: 'rain' },
  earthquake: { hitsSemi: { semi: 'underground', double: true } },
  magnitude: { hitsSemi: { semi: 'underground', double: true } },
  surf: { hitsSemi: { semi: 'underwater', double: true } },
  whirlpool: { hitsSemi: { semi: 'underwater', double: true } },
  blizzard: { sureIn: 'snow' },
  moonlight: { healWeather: true },
  'morning-sun': { healWeather: true },
  synthesis: { healWeather: true },
  'hyper-drill': { breaksProtect: true },
  'hyperspace-hole': { breaksProtect: true },
  'hyperspace-fury': { breaksProtect: true },
};
/** Solar Beam and Solar Blade skip charging in sun. */
const SUN_SKIPS = new Set(['solar-beam', 'solar-blade']);

const NO_EFFECT_IN_SINGLES = new Set([
  'Hits all adjacent Pokémon',
  'Hits all adjacent opponents',
  "Ignores target's ability",
  'Breaks through Reflect and Light Screen barriers',
]);

const STAT_NAMES: Record<string, Stat> = {
  'attack': 'atk', 'defense': 'def', 'special attack': 'spa', 'special defense': 'spd', 'speed': 'spe',
  'accuracy': 'acc', 'evasiveness': 'eva',
};
const STATUS_VERBS: Record<string, NonNullable<Effects['status']>['id']> = {
  burn: 'brn', paralyze: 'par', poison: 'psn', freeze: 'frz', burns: 'brn', paralyzes: 'par', poisons: 'psn',
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();

const moveId = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function parseStats(text: string): Stat[] | null {
  const parts = text.toLowerCase().replace(/ stat$/, '').split(/,\s*| and /).map((p) => p.trim()).filter(Boolean);
  const stats = parts.map((p) => STAT_NAMES[p]);
  return stats.every(Boolean) ? (stats as Stat[]) : null;
}

/** Turns one effect sentence into engine effects; returns false when the engine can't do it yet. */
function applySentence(move: MoveRow, sentence: string, chance: number | null): boolean {
  const s = sentence.replace(/\.$/, '').trim();
  if (!s) return true;
  if (s === 'High critical hit ratio') return (move.critStage = 1), true;
  if (s === 'May cause flinching') return chance ? ((move.effects.flinchChance = chance), true) : false;
  if (s === 'User recovers half the HP inflicted on opponent') return (move.effects.drain = 0.5), true;
  if (s === "Inflicts damage equal to user's level") return (move.effects.fixedDamage = 'level'), true;
  if (s === 'Ignores Accuracy and Evasiveness') return move.accuracy === null;
  // Battles are one-on-one and there are no abilities, Protect or screens yet, so these change nothing.
  if (NO_EFFECT_IN_SINGLES.has(s)) return true;
  // Earthquake on Dig and friends (EXTRA_EFFECTS sets which hidden Pokémon each one reaches).
  if (/^Power is doubled if (?:the )?opponent is (?:underground|underwater|in the air)/.test(s)) return true;
  if (s === 'User attacks first') return (move.priority = PRIORITY[move.id] ?? 1), true;
  if (s === 'User receives recoil damage') {
    const recoil = RECOIL[move.id];
    return recoil ? ((move.effects.recoil = recoil), true) : false;
  }
  if (s === 'Puts opponent to sleep') return (move.effects.status = { id: 'slp', chance: 100 }), true;
  // M8.75 part C, tier 1.
  if (s === 'Hits 2-5 times in one turn') return (move.effects.hits = [2, 5]), true;
  if (s === 'Hits twice in one turn') return (move.effects.hits = [2, 2]), true;
  if (s === 'User must recharge next turn') return (move.effects.recharge = true), true;
  if (s === 'May confuse opponent') return chance ? ((move.effects.confuse = { chance }), true) : false;
  if (s === 'Confuses opponent') return (move.effects.confuse = { chance: 100 }), true;
  if (s === "May raise all user's stats at once") {
    if (!chance) return false;
    const all: Stat[] = ['atk', 'def', 'spa', 'spd', 'spe'];
    move.effects.statChanges = [...(move.effects.statChanges ?? []), ...all.map((stat) => ({ stat, stages: 1, target: 'self' as const, chance }))];
    return true;
  }
  if (s === 'User recovers half its max HP' || s === 'User recovers HP') return move.category === 'status' && ((move.effects.heal = 0.5), true);
  // There is no weather yet, so Synthesis and friends always heal half.
  if (s === 'Amount varies with the weather') return move.effects.heal !== undefined;
  if (s === 'Protects the user, but may fail if used consecutively') return (move.effects.protect = true), true;
  if (s === 'One-Hit-KO, if it hits') return (move.effects.ohko = true), true;
  if (s === 'User faints') return (move.effects.selfFaint = true), true;
  if (s === 'Always results in a critical hit') return (move.critStage = 3), true;
  if (s === 'Always goes first') return move.priority > 0;
  if (s === 'Always hits') return move.accuracy === null;
  if (s === 'Always leaves opponent with at least 1 HP') return (move.effects.leaveOne = true), true;
  if (s === 'Traps opponent, damaging them for 4-5 turns') return (move.effects.bind = true), true;
  if (s === 'Drains HP from opponent each turn') return move.category === 'status' && ((move.effects.seed = true), true);
  if (s === "Power doubles if opponent's HP is less than 50%") return (move.effects.doubleBelowHalf = true), true;
  if (s === "The lower the user's HP, the higher the power") return (move.effects.lowHpPower = true), true;
  if (s === "Inflicts damage based on the target's Defense, not Special Defense") return (move.effects.targetsDefense = true), true;
  if (s === "Ignores opponent's stat changes") return (move.effects.ignoreStages = true), true;
  // M8.75 part C, second batch.
  if (s === 'Can strike through Protect/Detect') return (move.effects.breaksProtect = true), true;
  if (s === 'Charges on first turn, attacks on second') return (move.effects.charge = SUN_SKIPS.has(move.id) ? { sunSkips: true } : {}), true;
  if (s === 'Flies up on first turn, attacks on second turn' || s === 'Springs up on first turn, attacks on second') return (move.effects.charge = { semi: 'air' }), true;
  if (s === 'Digs underground on first turn, attacks on second') return (move.effects.charge = { semi: 'underground' }), true;
  if (s === 'Can also escape from caves') return true;
  if (s === 'Dives underwater on first turn, attacks on second turn') return (move.effects.charge = { semi: 'underwater' }), true;
  if (s === 'Disappears on first turn, attacks on second') return (move.effects.charge = { semi: 'vanished' }), true;
  if (s === 'Raises Defense on first turn, attacks on second') return (move.effects.charge = { boosts: [{ stat: 'def', stages: 1, target: 'self', chance: 100 }] }), true;
  if (s === 'User gathers space power and boosts its Sp. Atk stat, then attacks the target on the next turn') return (move.effects.charge = { boosts: [{ stat: 'spa', stages: 1, target: 'self', chance: 100 }] }), true;
  if (s === "Charges on first turn, sharply raises user's Sp. Attack, Sp. Defense and Speed on the second") {
    move.effects.charge = {};
    move.effects.statChanges = (['spa', 'spd', 'spe'] as Stat[]).map((stat) => ({ stat, stages: 2, target: 'self', chance: 100 }));
    return true;
  }
  if (s === 'Hits the opponent, even during Fly') return (move.effects.hitsSemi = { semi: 'air', double: false }), true;
  if (s === 'User attacks for 2-3 turns but then becomes confused') return (move.effects.lockIn = true), true;
  if (s === 'Makes it rain for 5 turns') return (move.effects.weather = 'rain'), true;
  if (s === 'Makes it sunny for 5 turns') return (move.effects.weather = 'sun'), true;
  if (s === 'Creates a sandstorm for 5 turns') return (move.effects.weather = 'sand'), true;
  if (s === 'Non-Ice types are damaged for 5 turns') return (move.effects.weather = 'hail'), true;
  if (s === 'Raises Defense of Ice types for 5 turns') return (move.effects.weather = 'snow'), true;
  if (s === "Move's power and type changes with the weather") return (move.effects.weatherBall = true), true;
  if (s === 'The user regains up to half of its max HP') return move.category === 'status' && ((move.effects.heal = 0.5), true);
  if (s === 'It restores more HP in a sandstorm') return (move.effects.healSand = true), true;
  if (s === 'User attacks first, foe flinches') return move.priority > 0 && ((move.effects.flinchChance = 100), true);
  if (s === 'Only usable on first turn' || s === 'Although this move has great power, it only works the first turn the user is in battle') return (move.effects.firstTurnOnly = true), true;

  let m = /^May (burn|paralyze|poison|freeze) (?:the )?opponent$/.exec(s);
  if (m) return chance ? ((move.effects.status = { id: STATUS_VERBS[m[1]!]!, chance }), true) : false;
  m = /^(Burns|Paralyzes|Poisons) (?:the )?opponent$/.exec(s);
  if (m) return (move.effects.status = { id: STATUS_VERBS[m[1]!.toLowerCase()]!, chance: 100 }), true;

  // Stat changes: "(May) (sharply|drastically) raises/lowers user's|opponent's|the target's X (and Y)".
  m = /^(May )?(sharply |drastically )?(raise|raises|lower|lowers) (user's|opponent's|the target's|target's) (.+)$/i.exec(s);
  if (m) {
    const may = Boolean(m[1]);
    if (may && !chance) return false;
    const size = m[2]?.trim().toLowerCase() === 'sharply' ? 2 : m[2]?.trim().toLowerCase() === 'drastically' ? 3 : 1;
    const sign = m[3]!.toLowerCase().startsWith('raise') ? 1 : -1;
    const target = m[4] === "user's" ? 'self' : 'enemy';
    const stats = parseStats(m[5]!);
    if (!stats) return false;
    // Status moves always work; a damaging move's own stat change ("Lowers user's Defense") always happens too.
    const c = may ? chance! : 100;
    move.effects.statChanges = [...(move.effects.statChanges ?? []), ...stats.map((stat) => ({ stat, stages: sign * size, target, chance: c }) as StatChange)];
    return true;
  }
  return false;
}

interface ListRow {
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  effect: string;
  chance: number | null;
}

function readList(path: string): ListRow[] {
  const html = readFileSync(path, 'utf8');
  const rows: ListRow[] = [];
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    if (cells.length < 8) continue;
    const num = (i: number) => {
      const v = decode(cells[i]![2]!);
      return /^\d+$/.test(v) ? Number(v) : null;
    };
    const category = /data-filter-value="(\w+)"/.exec(cells[2]![1]!)?.[1] ?? '';
    rows.push({
      name: decode(cells[0]![2]!),
      type: decode(cells[1]![2]!).toLowerCase(),
      category,
      power: num(3),
      accuracy: num(4),
      pp: num(5),
      effect: decode(cells[6]![2]!),
      chance: num(7),
    });
  }
  return rows;
}

/** PokeAPI's move table (priority, category, type, power, accuracy, PP) by move id. */
function readPokeApiMoves(): Map<string, Record<string, string>> {
  const dir = join(import.meta.dirname, '..', '.cache', 'pokeapi');
  const path = join(dir, 'moves.csv');
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('curl', ['-sSfL', '-o', path, 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv']);
  }
  const [header, ...rows] = readFileSync(path, 'utf8').trim().split('\n').map((l) => l.split(','));
  return new Map(rows.map((r) => [r[1]!, Object.fromEntries(header!.map((h, i) => [h, r[i] ?? '']))]));
}
const POKEAPI_TYPES = ['', 'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];
const POKEAPI_CATEGORY = ['', 'status', 'physical', 'special'] as const;

const list = readList(listPath);
const pokeApi = readPokeApiMoves();
// Unsupported moves are rebuilt from the list every time.
const moves = (JSON.parse(readFileSync(movesPath, 'utf8')) as MoveRow[]).filter((m) => m.supported !== false);
const known = new Map(moves.map((m) => [m.id, m]));

const added: string[] = [];
const skipped: { name: string; effect: string }[] = [];

/** Adds a move the battle engine can't run yet, with whatever the list and PokeAPI know about it. */
function addUnsupported(row: ListRow, id: string, needs: string): void {
  const api = pokeApi.get(id);
  const category = (['physical', 'special', 'status'].includes(row.category) ? row.category : POKEAPI_CATEGORY[Number(api?.damage_class_id)] || 'status') as MoveRow['category'];
  const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
  const type = POKEAPI_TYPES.includes(row.type) ? row.type : POKEAPI_TYPES[Number(api?.type_id)] || 'normal';
  const move: MoveRow = {
    id,
    name: row.name,
    type,
    category,
    // The list writes 0 for "never misses" and "varies"; the game uses null for both.
    power: category === 'status' ? null : row.power || num(api?.power) || null,
    accuracy: row.accuracy || num(api?.accuracy) || null,
    pp: row.pp || num(api?.pp) || 1,
    priority: Number(api?.priority ?? 0),
    critStage: 0,
    target: 'enemy',
    flags: [],
    effects: {},
    supported: false,
    needs,
  };
  moves.push(move);
  known.set(id, move);
  skipped.push({ name: row.name, effect: needs });
}
const corrected: string[] = [];
for (const row of list) {
  const id = moveId(row.name);
  const existing = known.get(id);
  if (existing) {
    // Keep the existing effects, but take power, accuracy and PP from the list when they differ.
    const fixes: string[] = [];
    if (row.power !== existing.power && !(existing.effects.fixedDamage && row.power === null)) fixes.push(`power ${existing.power}→${row.power}`), (existing.power = row.power);
    if (row.accuracy !== existing.accuracy) fixes.push(`accuracy ${existing.accuracy}→${row.accuracy}`), (existing.accuracy = row.accuracy);
    if (row.pp !== null && row.pp !== existing.pp) fixes.push(`PP ${existing.pp}→${row.pp}`), (existing.pp = row.pp);
    if (fixes.length) corrected.push(`${existing.name}: ${fixes.join(', ')}`);
    continue;
  }
  if (!['physical', 'special', 'status'].includes(row.category) || row.pp === null || /Z-Move|Max Move|Dynamax/.test(row.effect)) {
    addUnsupported(row, id, row.effect || 'Z-Move or Max Move');
    continue;
  }
  if (row.category !== 'status' && row.power === null && !/damage equal to user's level|One-Hit-KO|lower the user's HP, the higher the power/.test(row.effect)) {
    addUnsupported(row, id, row.effect || '(variable power)');
    continue;
  }
  const move: MoveRow = {
    id,
    name: row.name,
    type: row.type,
    category: row.category as MoveRow['category'],
    power: row.category === 'status' ? null : row.power,
    accuracy: row.accuracy,
    pp: row.pp,
    priority: Number(pokeApi.get(id)?.priority ?? 0),
    critStage: 0,
    target: 'enemy',
    flags: /Powder|Spore/.test(row.name) ? ['powder'] : [],
    effects: {},
  };
  const sentences = row.effect.split(/(?<=\.)\s+/).filter(Boolean);
  const ok = sentences.every((s) => applySentence(move, s, row.chance));
  // A status move has to do something the engine understands.
  const fx = move.effects;
  const doesSomething = move.category !== 'status' || fx.status || fx.statChanges?.length || fx.heal || fx.protect || fx.confuse || fx.seed || fx.weather;
  if (!ok || !doesSomething) {
    addUnsupported(row, id, row.effect || '(no effect text)');
    continue;
  }
  const changes = move.effects.statChanges ?? [];
  const onTarget = fx.status || fx.confuse || fx.seed || changes.some((c) => c.target === 'enemy');
  if (move.category === 'status' && !onTarget) move.target = 'self';
  moves.push(move);
  known.set(id, move);
  added.push(move.name);
}

for (const move of moves) {
  const extra = EXTRA_EFFECTS[move.id];
  if (extra && move.supported !== false) Object.assign(move.effects, extra);
}

writeFileSync(movesPath, JSON.stringify(moves, null, 1) + '\n');
console.log(`Added ${added.length} supported moves; ${moves.length} moves in total.`);
if (corrected.length) console.log(`Corrected ${corrected.length} existing moves to match the list:\n  ${corrected.join('\n  ')}`);
console.log(`${skipped.length} moves are flagged as not supported yet (the battle engine can't run their effects). First 30:`);
for (const s of skipped.slice(0, 30)) console.log(`  ${s.name}: ${s.effect}`);
