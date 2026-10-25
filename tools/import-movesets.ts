// Rebuilds each species' level-up learnset in src/data/species.json from the
// director's move dataset (the "SortedMoveset" sheet, exported as HTML).
//
//   npm run data:movesets -- <path to SortedMoveset.html>
//
// The sheet has one row per Pokémon: dex number, name, then pairs of
// (level, move name). Moves the game doesn't support yet (not in moves.json)
// are left out and listed, so they can be added later. Power, accuracy, PP
// and effects are not in the sheet; they stay in moves.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sheetPath = process.argv[2];
if (!sheetPath) {
  console.error('Usage: npm run data:movesets -- <path to SortedMoveset.html>');
  process.exit(1);
}

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const speciesPath = join(dataDir, 'species.json');

type LearnsetEntry = { level: number; move: string };
type SpeciesRow = { id: string; name: string; dex: number; learnset: LearnsetEntry[] };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

/** "Double-Edge" -> "double-edge", "King's Shield" -> "kings-shield" (the ids used in moves.json). */
const moveId = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Pokémon name -> learnset from the sheet (the first row with that name wins; later rows are alternate forms). */
function readSheet(path: string): Map<string, LearnsetEntry[]> {
  const html = readFileSync(path, 'utf8');
  const sets = new Map<string, LearnsetEntry[]>();
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => decode(m[1]!));
    // cells: [row number, dex, name, (blank), level, move, level, move, ...]
    const name = cells[2];
    if (!name || !/^\d+$/.test(cells[1] ?? '') || sets.has(name.toLowerCase())) continue;
    const learnset: LearnsetEntry[] = [];
    for (let i = 4; i + 1 < cells.length; i += 2) {
      const level = Number(cells[i]);
      const move = cells[i + 1];
      if (move && Number.isInteger(level) && level >= 1) learnset.push({ level, move: moveId(move) });
    }
    sets.set(name.toLowerCase(), learnset);
  }
  return sets;
}

const sheet = readSheet(sheetPath);
const species = JSON.parse(readFileSync(speciesPath, 'utf8')) as SpeciesRow[];
const supported = new Set((JSON.parse(readFileSync(join(dataDir, 'moves.json'), 'utf8')) as { id: string }[]).map((m) => m.id));

const missingSpecies: string[] = [];
const unsupported = new Map<string, string[]>();
const noLevelOne: string[] = [];
const movedToLevelOne: string[] = [];
for (const s of species) {
  const fromSheet = sheet.get(s.name.toLowerCase());
  if (!fromSheet) {
    missingSpecies.push(s.name);
    continue;
  }
  const kept = fromSheet.filter((e) => supported.has(e.move));
  for (const e of fromSheet) if (!supported.has(e.move)) unsupported.set(e.move, [...(unsupported.get(e.move) ?? []), s.name]);
  // The same move can appear once only; keep its lowest level.
  const seen = new Set<string>();
  const learnset = kept
    .sort((a, b) => a.level - b.level)
    .filter((e) => (seen.has(e.move) ? false : (seen.add(e.move), true)));
  if (learnset.length === 0) {
    noLevelOne.push(s.name);
    continue;
  }
  if (!learnset.some((e) => e.level === 1)) {
    // Every Pokémon needs a move at level 1. Some sheet lists start later (or with a move the
    // game doesn't support yet), so the earliest supported move is moved to level 1.
    movedToLevelOne.push(`${s.name} (${learnset[0]!.move} from level ${learnset[0]!.level})`);
    learnset[0]!.level = 1;
  }
  s.learnset = learnset;
}

writeFileSync(speciesPath, JSON.stringify(species, null, 1) + '\n');

console.log(`Updated learnsets for ${species.length - missingSpecies.length - noLevelOne.length} of ${species.length} species.`);
if (missingSpecies.length) console.log(`Not in the sheet (unchanged): ${missingSpecies.join(', ')}`);
if (noLevelOne.length) console.log(`No supported moves in the sheet (unchanged): ${noLevelOne.join(', ')}`);
if (movedToLevelOne.length) console.log(`Earliest move moved to level 1: ${movedToLevelOne.join(', ')}`);
const top = [...unsupported.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`${top.length} moves in these learnsets are not supported yet (left out). Most common:`);
for (const [move, who] of top.slice(0, 25)) console.log(`  ${move} (${who.length})`);
