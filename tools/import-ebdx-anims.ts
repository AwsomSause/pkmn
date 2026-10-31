// Brings the scripted EBDX move animations (src/data/ebdxAnims.json) into the
// game: copies the pictures they use, converts their sounds to .m4a (ffmpeg),
// and sets each move's `script` in src/data/moveAnims.json.
//
//   npm run data:ebdx-anims -- <Pokemon-Essentials-...-EBDX-main folder>
//
// Afterwards run `npm run assets:manifest`. Safe to re-run.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEbdxAnims, scriptAssets } from '../src/core/presentation/scriptAnim.ts';

const root = process.argv[2];
if (!root) {
  console.error('Usage: npm run data:ebdx-anims -- <EBDX Essentials folder>');
  process.exit(1);
}
const dataDir = 'src/data';
const file = parseEbdxAnims(JSON.parse(readFileSync(join(dataDir, 'ebdxAnims.json'), 'utf8')));
const { images, sounds } = scriptAssets(file);
const srcOf = new Map<string, string>();
for (const sc of Object.values(file.scripts)) for (const f of sc.sfx) srcOf.set(f.id, f.src ?? `EBDX/Anim/${f.id}`);

const imgOut = 'public/assets/images/packs/ebdx/moves';
const sndOut = 'public/assets/audio/ebdx';
mkdirSync(imgOut, { recursive: true });
mkdirSync(sndOut, { recursive: true });

for (const name of images) {
  const src = join(root, 'Graphics/EBDX/Animations/Moves', `${name}.png`);
  if (!existsSync(src)) throw new Error(`missing picture ${src}`);
  copyFileSync(src, join(imgOut, `${name}.png`));
}
for (const id of sounds) {
  const base = join(root, 'Audio/SE', srcOf.get(id)!);
  const out = join(sndOut, `${id}.m4a`);
  // Some pack files are damaged; use the first copy ffmpeg can read.
  const ok = ['.ogg', '.wav', '.mp3', '.m4a'].map((e) => base + e).some((src) => {
    if (!existsSync(src)) return false;
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', out], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
  if (!ok) throw new Error(`no readable sound for ${base}`);
}

const animsPath = join(dataDir, 'moveAnims.json');
const anims = JSON.parse(readFileSync(animsPath, 'utf8'));
for (const [move, script] of Object.entries(file.moves)) {
  if (!anims.moves[move]) throw new Error(`move ${move} is not in moveAnims.json`);
  anims.moves[move].script = script;
}
writeFileSync(animsPath, JSON.stringify(anims, null, 2) + '\n');
console.log(`${images.length} pictures, ${sounds.length} sounds, ${Object.keys(file.moves).length} moves set.`);
