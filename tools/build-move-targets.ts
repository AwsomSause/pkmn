// Builds src/data/moveTargets.json: which moves hit more than one Pokémon (or
// an ally) in double battles, from PokeAPI's moves.csv `target_id` column
// (downloaded into .cache/pokeapi if missing, like tools/import-moves.ts).
//
//   npm run data:move-targets
//
// Moves not listed (and custom moves PokeAPI doesn't know) hit one chosen foe.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', '.cache', 'pokeapi');
const path = join(dir, 'moves.csv');
if (!existsSync(path)) {
  mkdirSync(dir, { recursive: true });
  execFileSync('curl', ['-sSfL', '-o', path, 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/moves.csv']);
}
const moves = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'moves.json'), 'utf8')) as { id: string }[];
const known = new Set(moves.map((m) => m.id));

// PokeAPI move_targets.csv ids.
const GROUPS: Record<string, string> = { '11': 'foes', '9': 'others', '3': 'ally', '5': 'userOrAlly', '13': 'userAndAllies', '15': 'userAndAllies', '8': 'random' };
const out: Record<string, string[]> = { foes: [], others: [], ally: [], userOrAlly: [], userAndAllies: [], random: [] };
const [header, ...rows] = readFileSync(path, 'utf8').trim().split('\n');
const cols = header!.split(',');
const idCol = cols.indexOf('identifier');
const targetCol = cols.indexOf('target_id');
for (const row of rows) {
  const cells = row.split(',');
  const group = GROUPS[cells[targetCol]!];
  const id = cells[idCol]!;
  if (group && known.has(id)) out[group]!.push(id);
}
for (const list of Object.values(out)) list.sort();
writeFileSync(join(import.meta.dirname, '..', 'src', 'data', 'moveTargets.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.length}`).join(', '));
