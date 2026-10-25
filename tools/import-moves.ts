// Adds moves to src/data/moves.json from the director's move list (a saved
// copy of pokemondb.net/move/all: name, type, category, power, accuracy, PP,
// a one-line effect and its chance).
//
//   npm run data:moves -- <path to pokemon_moves_list.html>
//
// A move is only added when every sentence of its effect is something the
// battle engine already does (plain damage, stat changes, status, flinching,
// draining, recoil, priority, high critical-hit ratio, level damage). The rest
// are listed so they can be built later. Moves already in moves.json keep
// their effects; their power, accuracy and PP are checked against the list.

import { readFileSync, writeFileSync } from 'node:fs';
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
};
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
};

/** Recoil is "User receives recoil damage." in the list, without the amount; these are the official fractions. */
const RECOIL: Record<string, number> = {
  'take-down': 1 / 4, submission: 1 / 4, 'wild-charge': 1 / 4, 'head-charge': 1 / 4, 'chloroblast': 1 / 2,
  'double-edge': 1 / 3, 'brave-bird': 1 / 3, 'flare-blitz': 1 / 3, 'wood-hammer': 1 / 3, 'volt-tackle': 1 / 3,
  'wave-crash': 1 / 3, 'light-of-ruin': 1 / 2, 'head-smash': 1 / 2,
};
/** "User attacks first." doesn't say how strongly; these moves go before other priority moves. */
const PRIORITY: Record<string, number> = { 'extreme-speed': 2, 'feint': 2, 'first-impression': 2 };

const NO_EFFECT_IN_SINGLES = new Set([
  'Hits all adjacent Pokémon',
  'Hits all adjacent opponents',
  'Can strike through Protect/Detect',
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
  // Dig, Dive and Fly (two-turn moves) aren't in the game yet, so this bonus never applies.
  if (/^Power is doubled if (?:the )?opponent is (?:underground|underwater|in the air)/.test(s)) return true;
  if (s === 'User attacks first') return (move.priority = PRIORITY[move.id] ?? 1), true;
  if (s === 'User receives recoil damage') {
    const recoil = RECOIL[move.id];
    return recoil ? ((move.effects.recoil = recoil), true) : false;
  }
  if (s === 'Puts opponent to sleep') return (move.effects.status = { id: 'slp', chance: 100 }), true;

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

const list = readList(listPath);
const moves = JSON.parse(readFileSync(movesPath, 'utf8')) as MoveRow[];
const known = new Map(moves.map((m) => [m.id, m]));

const added: string[] = [];
const skipped: { name: string; effect: string }[] = [];
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
  if (!['physical', 'special', 'status'].includes(row.category) || row.pp === null || /Z-Move|Max Move|Dynamax/.test(row.effect)) continue;
  if (row.category !== 'status' && row.power === null && !/damage equal to user's level/.test(row.effect)) {
    skipped.push({ name: row.name, effect: row.effect || '(variable power)' });
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
    priority: 0,
    critStage: 0,
    target: 'enemy',
    flags: /Powder|Spore/.test(row.name) ? ['powder'] : [],
    effects: {},
  };
  const sentences = row.effect.split(/(?<=\.)\s+/).filter(Boolean);
  const ok = sentences.every((s) => applySentence(move, s, row.chance));
  // A status move has to do something the engine understands.
  const doesSomething = move.category !== 'status' || move.effects.status || move.effects.statChanges?.length;
  if (!ok || !doesSomething) {
    skipped.push({ name: row.name, effect: row.effect });
    continue;
  }
  const changes = move.effects.statChanges ?? [];
  if (move.category === 'status' && !move.effects.status && changes.every((c) => c.target === 'self')) move.target = 'self';
  moves.push(move);
  known.set(id, move);
  added.push(move.name);
}

writeFileSync(movesPath, JSON.stringify(moves, null, 1) + '\n');
console.log(`Added ${added.length} moves (${moves.length} total).`);
if (corrected.length) console.log(`Corrected ${corrected.length} existing moves to match the list:\n  ${corrected.join('\n  ')}`);
console.log(`Skipped ${skipped.length} moves whose effects the battle engine can't do yet. First 30:`);
for (const s of skipped.slice(0, 30)) console.log(`  ${s.name}: ${s.effect}`);
