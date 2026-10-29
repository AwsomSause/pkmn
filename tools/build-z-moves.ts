// Builds src/data/zMoves.json: which Z-Move each type's Z-Crystal turns a move
// into, the Z-Move power of every damaging move, and the extra effect each
// status move gets as a Z-Move (Milestone 8.5, Z-Moves).
//
//   npm run data:zmoves
//
// Source: Pokémon Showdown's move data (github.com/smogon/pokemon-showdown,
// data/moves.ts, MIT), downloaded into .cache/showdown with curl.
//
// Rules (GAME_DESIGN.md §5f):
// - A damaging move's Z-power is Showdown's `zMove.basePower` when the move
//   has one, otherwise the standard table on the move's power (multi-hit
//   moves count three hits), the same table Showdown uses.
// - A status move keeps working as itself and adds its `zMove` bonus: stat
//   boosts, clearing its lowered stats, or a full heal. Bonuses this game
//   can't do yet (raising the critical-hit ratio, follow me, healing the next
//   Pokémon, Z-Curse) are left out, so those moves can't be used as Z-Moves.

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

/** The Z-Move each type's crystal makes (Stellar has no crystal). */
const BY_TYPE: Record<string, string> = {
  normal: 'breakneck-blitz',
  fighting: 'all-out-pummeling',
  flying: 'supersonic-skystrike',
  poison: 'acid-downpour',
  ground: 'tectonic-rage',
  rock: 'continental-crush',
  bug: 'savage-spin-out',
  ghost: 'never-ending-nightmare',
  steel: 'corkscrew-crash',
  fire: 'inferno-overdrive',
  water: 'hydro-vortex',
  grass: 'bloom-doom',
  electric: 'gigavolt-havoc',
  psychic: 'shattered-psyche',
  ice: 'subzero-slammer',
  dragon: 'devastating-drake',
  dark: 'black-hole-eclipse',
  fairy: 'twinkle-tackle',
};

interface GameMove {
  id: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
}
const moves = JSON.parse(readFileSync(join(dataDir, 'moves.json'), 'utf8')) as GameMove[];
const gameIds = new Set(moves.map((m) => m.id));
for (const id of Object.values(BY_TYPE)) if (!gameIds.has(id)) throw new Error(`moves.json has no Z-Move "${id}"`);

// Showdown blocks: `\tbulletseed: {\n\t\tnum: 331, ... multihit: [2, 5], ... zMove: { basePower: 140 },`
interface ShowdownMove {
  /** A Z-Move or Max Move itself: never turned into a Z-Move. */
  special: boolean;
  multihitRange: boolean;
  zPower?: number;
  zBoost?: Record<string, number>;
  zEffect?: string;
}
const showdown = new Map<string, ShowdownMove>();
for (const block of readFileSync(movesTs, 'utf8').split(/\n\t(?=["a-z0-9]+: \{)/)) {
  const key = /^"?([a-z0-9]+)"?: \{/.exec(block)?.[1];
  if (!key) continue;
  const z = /\n\t\tzMove: \{([^}]*\}?[^}]*)\}/.exec(block)?.[1] ?? '';
  const boost = /boost: \{([^}]*)\}/.exec(z)?.[1];
  showdown.set(key, {
    special: /\n\t\t(isZ|isMax): /.test(block),
    multihitRange: /\n\t\tmultihit: \[/.test(block),
    zPower: Number(/basePower: (\d+)/.exec(z)?.[1]) || undefined,
    zBoost: boost ? Object.fromEntries([...boost.matchAll(/(\w+): (-?\d+)/g)].map((m) => [m[1]!, Number(m[2])])) : undefined,
    zEffect: /effect: '(\w+)'/.exec(z)?.[1],
  });
}

/** Showdown's table (sim/dex-moves.ts) for moves without their own Z-power. */
function tablePower(power: number): number {
  if (!power) return 100;
  if (power >= 140) return 200;
  if (power >= 130) return 195;
  if (power >= 120) return 190;
  if (power >= 110) return 185;
  if (power >= 100) return 180;
  if (power >= 90) return 175;
  if (power >= 80) return 160;
  if (power >= 70) return 140;
  if (power >= 60) return 120;
  return 100;
}

const STAT: Record<string, string> = { atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe', accuracy: 'acc', evasion: 'eva' };
const zMoveIds = new Set(Object.values(BY_TYPE));
const power: Record<string, number> = {};
const status: Record<string, { boosts?: { stat: string; stages: number }[]; effect?: 'clearNegative' | 'heal' }> = {};
const skipped: string[] = [];
for (const move of moves) {
  if (zMoveIds.has(move.id)) continue;
  const sd = showdown.get(move.id.replace(/[^a-z0-9]/g, ''));
  if (sd?.special) continue;
  if (move.category !== 'status') {
    const base = (move.power ?? 0) * (sd?.multihitRange ? 3 : 1);
    power[move.id] = sd?.zPower ?? tablePower(base);
    continue;
  }
  if (sd?.zBoost) status[move.id] = { boosts: Object.entries(sd.zBoost).map(([stat, stages]) => ({ stat: STAT[stat]!, stages })) };
  else if (sd?.zEffect === 'clearnegativeboost') status[move.id] = { effect: 'clearNegative' };
  else if (sd?.zEffect === 'heal') status[move.id] = { effect: 'heal' };
  else skipped.push(`${move.id}${sd?.zEffect ? ` (${sd.zEffect})` : sd ? '' : ' (not in Showdown)'}`);
}

const out = { byType: BY_TYPE, power, status };
writeFileSync(join(dataDir, 'zMoves.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`zMoves.json: ${Object.keys(power).length} damaging moves, ${Object.keys(status).length} status moves with a Z bonus.`);
console.log(`${skipped.length} status moves have no Z bonus this game can do: ${skipped.join(', ')}`);
