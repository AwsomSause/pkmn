// Builds src/data/maxMoves.json: which Max Move each type turns into, the Max
// Move power of every damaging move, what each Max Move does after it hits,
// and the G-Max Moves of Gigantamax Pokémon (Milestone 8.5, Dynamax).
//
//   npm run data:maxmoves
//
// Source: Pokémon Showdown's move data (github.com/smogon/pokemon-showdown,
// data/moves.ts, MIT), downloaded into .cache/showdown with curl.
//
// Rules (GAME_DESIGN.md §5f):
// - A damaging move's Max power is Showdown's `maxMove.basePower` when the
//   move has one, otherwise Showdown's table on the move's power (a lower
//   table for Fighting and Poison moves). Status moves become Max Guard.
// - Max Move side effects this game can run: weather (Max Flare, Geyser,
//   Rockfall, Hailstorm), terrain (Lightning, Overgrowth, Mindstorm, Starfall)
//   and stat changes.
// - A G-Max Move replaces its type's Max Move for that Gigantamax Pokémon,
//   with the same power (or Showdown's fixed 160 for Drum Solo, Fireball and
//   Hydrosnipe). Its side effect is kept only when the game can run it
//   exactly (G_MAX_EFFECTS below); the rest only deal damage for now.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const cacheDir = join(root, '.cache', 'showdown');
const movesTs = join(cacheDir, 'moves.ts');
if (!existsSync(movesTs)) {
  mkdirSync(cacheDir, { recursive: true });
  execFileSync('curl', ['-sSfL', '-o', movesTs, 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts']);
}

const BY_TYPE: Record<string, string> = {
  normal: 'max-strike',
  fighting: 'max-knuckle',
  flying: 'max-airstream',
  poison: 'max-ooze',
  ground: 'max-quake',
  rock: 'max-rockfall',
  bug: 'max-flutterby',
  ghost: 'max-phantasm',
  steel: 'max-steelspike',
  fire: 'max-flare',
  water: 'max-geyser',
  grass: 'max-overgrowth',
  electric: 'max-lightning',
  psychic: 'max-mindstorm',
  ice: 'max-hailstorm',
  dragon: 'max-wyrmwind',
  dark: 'max-darkness',
  fairy: 'max-starfall',
};

type StatChange = { stat: string; stages: number; target: 'self' | 'enemy' };
interface MaxEffect {
  weather?: string;
  terrain?: string;
  heal?: number;
  cureUser?: true;
  randomStatus?: string[];
  statChanges?: StatChange[];
  status?: string;
  confuse?: true;
  bind?: true;
  breaksProtect?: true;
}
const self = (stat: string): MaxEffect => ({ statChanges: [{ stat, stages: 1, target: 'self' }] });
const foe = (stat: string, stages = -1): MaxEffect => ({ statChanges: [{ stat, stages, target: 'enemy' }] });
const EFFECTS: Record<string, MaxEffect> = {
  'max-strike': foe('spe'),
  'max-knuckle': self('atk'),
  'max-airstream': self('spe'),
  'max-ooze': self('spa'),
  'max-quake': self('spd'),
  'max-rockfall': { weather: 'sand' },
  'max-flutterby': foe('spa'),
  'max-phantasm': foe('def'),
  'max-steelspike': self('def'),
  'max-lightning': { terrain: 'electric' },
  'max-overgrowth': { terrain: 'grassy' },
  'max-mindstorm': { terrain: 'psychic' },
  'max-starfall': { terrain: 'misty' },
  'max-flare': { weather: 'sun' },
  'max-geyser': { weather: 'rain' },
  'max-hailstorm': { weather: 'hail' },
  'max-wyrmwind': foe('atk'),
  'max-darkness': foe('spd'),
};
/** G-Max side effects the game can run exactly; the others deal damage only. */
const G_MAX_EFFECTS: Record<string, MaxEffect> = {
  'g-max-volt-crash': { status: 'par' },
  'g-max-finale': { heal: 0.1667 },
  'g-max-sweetness': { cureUser: true },
  'g-max-stun-shock': { randomStatus: ['par', 'psn'] },
  'g-max-befuddle': { randomStatus: ['par', 'psn', 'slp'] },
  'g-max-malodor': { status: 'psn' },
  'g-max-smite': { confuse: true },
  'g-max-foam-burst': foe('spe', -2),
  'g-max-tartness': foe('eva'),
  'g-max-sandblast': { bind: true },
  'g-max-centiferno': { bind: true },
  'g-max-one-blow': { breaksProtect: true },
  'g-max-rapid-flow': { breaksProtect: true },
};

interface GameMove {
  id: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
}
interface GameSpecies {
  id: string;
  form?: { kind: string; base: string };
}
const moves = JSON.parse(readFileSync(join(dataDir, 'moves.json'), 'utf8')) as GameMove[];
const gameMoves = new Map(moves.map((m) => [m.id, m]));
const species = [
  ...(JSON.parse(readFileSync(join(dataDir, 'species.json'), 'utf8')) as GameSpecies[]),
  ...(JSON.parse(readFileSync(join(dataDir, 'customSpecies.json'), 'utf8')) as GameSpecies[]),
];
for (const id of [...Object.values(BY_TYPE), 'max-guard']) if (!gameMoves.has(id)) throw new Error(`moves.json has no Max Move "${id}"`);

/** Showdown owners whose Gigantamax forms can't be found by base species (both Urshifu styles share one base). */
const FORM_ALIASES: Record<string, string[]> = { urshifu: ['urshifu-single-strike-gmax'], 'urshifu-rapid-strike': ['urshifu-rapid-strike-gmax'] };
const toId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
interface ShowdownMove {
  name: string;
  special: boolean;
  maxPower?: number;
  basePower: number;
  isMax?: string;
}
const showdown = new Map<string, ShowdownMove>();
for (const block of readFileSync(movesTs, 'utf8').split(/\n\t(?=["a-z0-9]+: \{)/)) {
  const key = /^"?([a-z0-9]+)"?: \{/.exec(block)?.[1];
  if (!key) continue;
  const isMax = /\n\t\tisMax: (true|"([^"]+)")/.exec(block);
  showdown.set(key, {
    name: /\n\t\tname: "([^"]+)"/.exec(block)?.[1] ?? key,
    special: /\n\t\t(isZ|isMax): /.test(block),
    maxPower: Number(/\n\t\tmaxMove: \{ basePower: (\d+) \}/.exec(block)?.[1]) || undefined,
    basePower: Number(/\n\t\tbasePower: (\d+)/.exec(block)?.[1] ?? 0),
    isMax: isMax?.[2],
  });
}

/** Showdown's table (sim/dex-moves.ts) for moves without their own Max power. */
function tablePower(power: number, type: string): number {
  if (!power) return 100;
  if (type === 'fighting' || type === 'poison') {
    if (power >= 150) return 100;
    if (power >= 110) return 95;
    if (power >= 75) return 90;
    if (power >= 65) return 85;
    if (power >= 55) return 80;
    if (power >= 45) return 75;
    return 70;
  }
  if (power >= 150) return 150;
  if (power >= 110) return 140;
  if (power >= 75) return 130;
  if (power >= 65) return 120;
  if (power >= 55) return 110;
  if (power >= 45) return 100;
  return 90;
}

const power: Record<string, number> = {};
for (const move of moves) {
  if (move.category === 'status') continue;
  const sd = showdown.get(move.id.replace(/[^a-z0-9]/g, ''));
  if (sd?.special || /^(max|g-max)-/.test(move.id)) continue;
  power[move.id] = sd?.maxPower ?? tablePower(move.power ?? 0, move.type);
}

// G-Max Moves: Showdown's `isMax: "Charizard"` names the Pokémon; match it to the game's Gigantamax forms.
const gmaxForms = species.filter((s) => s.form?.kind === 'gigantamax');
const gmax: Record<string, { forms: string[]; type: string; power?: number; effects?: MaxEffect }> = {};
const unmatched: string[] = [];
for (const sd of showdown.values()) {
  if (!sd.isMax) continue;
  const id = toId(sd.name);
  const move = gameMoves.get(id);
  if (!move) throw new Error(`moves.json has no G-Max Move "${id}"`);
  const owner = toId(sd.isMax);
  const forms = FORM_ALIASES[owner] ?? gmaxForms.filter((s) => s.form!.base === owner).map((s) => s.id);
  if (forms.length === 0) {
    unmatched.push(`${id} (${sd.isMax})`);
    continue;
  }
  gmax[id] = { forms, type: move.type, ...(sd.basePower === 160 ? { power: 160 } : {}), ...(G_MAX_EFFECTS[id] ? { effects: G_MAX_EFFECTS[id] } : {}) };
}
const covered = new Set(Object.values(gmax).flatMap((g) => g.forms));
const noMove = gmaxForms.filter((s) => !covered.has(s.id)).map((s) => s.id);

writeFileSync(join(dataDir, 'maxMoves.json'), JSON.stringify({ byType: BY_TYPE, guard: 'max-guard', power, effects: EFFECTS, gmax }, null, 2) + '\n');
console.log(`maxMoves.json: ${Object.keys(power).length} damaging moves, ${Object.keys(gmax).length} G-Max Moves.`);
if (unmatched.length) console.log(`G-Max Moves with no Gigantamax form in the game: ${unmatched.join(', ')}`);
if (noMove.length) console.log(`Gigantamax forms with no G-Max Move: ${noMove.join(', ')}`);
