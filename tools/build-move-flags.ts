// Builds src/data/moveFlags.json: the move flags the battle screen shows as Enhanced
// Battle UI icons that moves.json doesn't carry (dance, bypasses Protect, thaws the
// user, tramples Minimize, electrocutes, can't be copied by Mirror Move). Source:
// the director's Essentials pack, PBS/moves.txt (`Flags` and `Target` per move),
// read from the zip in /mnt/project-files or a copy in .cache/essentials.
//
//   npm run data:move-flags
//
// Moves are matched by name (letters and digits only). A move Essentials doesn't
// know gets no extra flags.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cache = join(root, '.cache', 'essentials');
const path = join(cache, 'moves.txt');
if (!existsSync(path)) {
  mkdirSync(cache, { recursive: true });
  const zip = '/mnt/project-files/Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip';
  execFileSync('unzip', ['-o', '-q', '-j', zip, 'Pokemon-Essentials-21-With-Unofficial-EBDX-main/PBS/moves.txt', '-d', cache]);
}
const moves = JSON.parse(readFileSync(join(root, 'src', 'data', 'moves.json'), 'utf8')) as { id: string; name: string }[];
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(moves.map((m) => [key(m.name), m.id]));

// Targets that aim at another Pokémon (the ones Protect and Mirror Move care about).
const AIMED = new Set(['NearOther', 'Other', 'NearFoe', 'RandomNearFoe', 'AllNearFoes', 'AllNearOthers', 'AllFoes']);
const out: Record<string, string[]> = { dance: [], noProtect: [], thaw: [], minimize: [], electrocute: [], noMirror: [] };
for (const block of readFileSync(path, 'utf8').split('#-------------------------------')) {
  const field = (name: string) => block.match(new RegExp(`^${name} = (.*)$`, 'm'))?.[1]?.trim();
  const id = byName.get(key(field('Name') ?? ''));
  if (!id) continue;
  const flags = new Set((field('Flags') ?? '').split(',').map((f) => f.trim()));
  const aimed = AIMED.has(field('Target') ?? '');
  if (flags.has('Dance')) out.dance!.push(id);
  if (flags.has('ThawsUser')) out.thaw!.push(id);
  if (flags.has('TramplesMinimize')) out.minimize!.push(id);
  if (flags.has('ElectrocuteUser')) out.electrocute!.push(id);
  if (aimed && !flags.has('CanProtect')) out.noProtect!.push(id);
  if (aimed && !flags.has('CanMirrorMove')) out.noMirror!.push(id);
}
// Gen 9 dances that Essentials 21 doesn't have yet (the Dancer ability copies them in the main games).
for (const id of ['aqua-step', 'victory-dance']) if (!out.dance!.includes(id)) out.dance!.push(id);
for (const list of Object.values(out)) list.sort();
writeFileSync(join(root, 'src', 'data', 'moveFlags.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`moveFlags.json: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
