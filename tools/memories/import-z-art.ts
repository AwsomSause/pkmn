// Copies the Deluxe Battle Kit Z-Power art from the Pokémon Memories repo
// (AwsomSause/Pokemon-Memories) into the game: one title card per Z-Move,
// named by our move id, and the Z-Power particle. Unchanged pixels.
//
//   node tools/memories/import-z-art.ts "<Pokemon Memories folder>"
//
// Afterwards run `npm run assets:manifest`.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [game] = process.argv.slice(2);
const src = game ? join(game, 'Graphics', 'Plugins', 'Deluxe Battle Kit', 'Z-Power') : '';
if (!game || !existsSync(join(src, 'Z-Titles'))) {
  console.error('Usage: node tools/memories/import-z-art.ts "<Pokemon Memories folder>"');
  process.exit(1);
}
const root = join(import.meta.dirname, '..', '..');
const out = join(root, 'public', 'assets', 'images', 'packs', 'dbk', 'zpower');
mkdirSync(join(out, 'titles'), { recursive: true });

const essKey = (id: string) => id.replace(/[^a-z0-9]/g, '').toUpperCase();
const moves = JSON.parse(readFileSync(join(root, 'src', 'data', 'moves.json'), 'utf8')) as { id: string }[];
const byKey = new Map(moves.map((m) => [essKey(m.id), m.id]));
byKey.set('TENMILLIONVOLTTHUNDERBOLT', '10-000-000-volt-thunderbolt'); // Essentials spells the number out
const copied: string[] = [];
const missed: string[] = [];
for (const file of readdirSync(join(src, 'Z-Titles'))) {
  const id = byKey.get(file.replace(/\.png$/i, ''));
  if (!id) {
    missed.push(file);
    continue;
  }
  copyFileSync(join(src, 'Z-Titles', file), join(out, 'titles', `${id}.png`));
  copied.push(id);
}
copyFileSync(join(src, 'particle.png'), join(out, 'particle.png'));
console.log(`${copied.length} Z-Move title cards and the particle copied.${missed.length ? ` No move for: ${missed.join(', ')}` : ''}`);
console.log(JSON.stringify(copied.sort()));
