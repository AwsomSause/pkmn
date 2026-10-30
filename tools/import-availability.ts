// Builds src/data/availability.json from tools/availability-source.csv (the
// "Pokedex" sheet of the director's Pokemon_Spreadsheet.xlsx), matching rows to
// species by Pokédex number. Forms and custom species have no row and get none.
// Every value is a SUGGESTION (the sheet's levels and difficulty are invented
// from capture rate and base stat total); nothing reads this file yet.
//
//   npm run data:availability

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const lines = readFileSync(join(root, 'tools', 'availability-source.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
const species = JSON.parse(readFileSync(join(root, 'src', 'data', 'species.json'), 'utf8')) as { id: string; dex: number; form?: unknown }[];
const byDex = new Map(species.filter((s) => !s.form).map((s) => [s.dex, s.id]));

const RARITY: Record<string, string> = { 'Very Rare': 'veryRare', Rare: 'rare', Uncommon: 'uncommon', Common: 'common', Legendary: 'legendary', Mythical: 'mythical' };
const out: Record<string, unknown> = {};
for (const line of lines) {
  const [dex, , , , rarity, difficulty, low, high, capture] = line.split(',');
  const id = byDex.get(Number(dex));
  if (!id) continue;
  const key = rarity!.trim();
  if (!(key in RARITY)) throw new Error(`Unknown rarity "${key}" for #${dex}`);
  out[id] = { rarity: RARITY[key], difficulty: Number(difficulty), minLevel: Number(low), maxLevel: Number(high), captureRate: Number(capture) };
}
const file = { status: 'suggested', source: 'Pokemon_Spreadsheet.xlsx (director), Pokedex sheet', species: out };
writeFileSync(join(root, 'src', 'data', 'availability.json'), JSON.stringify(file, null, 1) + '\n');
console.log(`Wrote availability for ${Object.keys(out).length} of ${species.length} species`);
