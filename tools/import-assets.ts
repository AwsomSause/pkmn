// Copies the assets the game needs out of the director's asset zips into
// public/assets/, then rebuilds the manifest. Only files the catalog asks for
// are copied, so the repository stays small.
//
//   npm run assets:import -- <folder containing the zips>
//
// Expected zips (names as supplied): images.zip, audio.zip, fonts.zip, and
// boss-TRAINERS.zip (boss portraits). Inside them, files live under images/,
// audio/ and fonts/; the boss portraits live under boss-TRAINERS/ and are
// copied to images/bosses/.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCatalog, filesOf } from '../src/assets/catalog.ts';
import { readCatalogInputs } from './catalogInputs.ts';

const zipDir = process.argv[2];
if (!zipDir || !existsSync(zipDir)) {
  console.error('Usage: npm run assets:import -- <folder containing images.zip, audio.zip, fonts.zip>');
  process.exit(1);
}

const assetsDir = join(import.meta.dirname, '..', 'public', 'assets');
mkdirSync(assetsDir, { recursive: true });

const wanted = buildCatalog(readCatalogInputs()).flatMap(filesOf);
const zips = readdirSync(zipDir).filter((f) => f.toLowerCase().endsWith('.zip'));

/** Lists the entries of a zip (ignoring macOS metadata). */
function listZip(zip: string): Set<string> {
  const out = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return new Set(out.split('\n').filter((l) => l && !l.startsWith('__MACOSX/')));
}

let copied = 0;
const found = new Set<string>();
for (const zipName of zips) {
  const zip = join(zipDir, zipName);
  const entries = listZip(zip);
  // Boss portraits: "boss-TRAINERS/cynthia-gen7.png" -> images/bosses/cynthia-gen7.png
  const portraits = wanted.filter((f) => f.startsWith('images/bosses/') && !found.has(f) && entries.has(`boss-TRAINERS/${f.slice('images/bosses/'.length)}`));
  if (portraits.length > 0) {
    const tmp = mkdtempSync(join(tmpdir(), 'bosses-'));
    execFileSync('unzip', ['-o', '-q', zip, 'boss-TRAINERS/*.png', '-d', tmp]);
    mkdirSync(join(assetsDir, 'images', 'bosses'), { recursive: true });
    for (const f of portraits) copyFileSync(join(tmp, 'boss-TRAINERS', f.slice('images/bosses/'.length)), join(assetsDir, f));
    rmSync(tmp, { recursive: true, force: true });
    portraits.forEach((f) => found.add(f));
    copied += portraits.length;
    console.log(`${zipName}: copied ${portraits.length} boss portrait(s)`);
  }
  const toExtract = wanted.filter((f) => entries.has(f) && !found.has(f));
  if (toExtract.length === 0) continue;
  // Extract in batches to keep the command line short.
  for (let i = 0; i < toExtract.length; i += 200) {
    execFileSync('unzip', ['-o', '-q', zip, ...toExtract.slice(i, i + 200), '-d', assetsDir]);
  }
  toExtract.forEach((f) => found.add(f));
  copied += toExtract.length;
  console.log(`${zipName}: copied ${toExtract.length} file(s)`);
}

console.log(`Copied ${copied} of ${wanted.length} wanted files.`);
execFileSync(process.execPath, [join(import.meta.dirname, 'build-asset-manifest.ts')], { stdio: 'inherit' });
