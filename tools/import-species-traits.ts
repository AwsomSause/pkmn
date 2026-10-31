// Adds `eggGroups` and `color` to every species in src/data/species.json and customSpecies.json (forms
// take their base dex entry's values). Source: PokeAPI's open data (github.com/PokeAPI/pokeapi, CSV files
// pokemon_species, pokemon_egg_groups, egg_groups, pokemon_colors), downloaded into .cache/pokeapi if missing.
// Run: npm run data:traits. Safe to re-run.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = process.argv[2] ?? '.cache/pokeapi';
mkdirSync(dir, { recursive: true });
const csv = (name: string): Record<string, string>[] => {
  const file = `${dir}/${name}.csv`;
  if (!existsSync(file)) execFileSync('curl', ['-sSf', '-o', file, `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}.csv`]);
  const [head, ...rows] = readFileSync(file, 'utf8').trim().split('\n');
  const keys = head!.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [keys[i]!, v])));
};

const colors = new Map(csv('pokemon_colors').map((r) => [r.id!, r.identifier!]));
const groups = new Map(csv('egg_groups').map((r) => [r.id!, r.identifier!]));
const colorOf = new Map(csv('pokemon_species').map((r) => [Number(r.id), colors.get(r.color_id!)!]));
const eggOf = new Map<number, string[]>();
for (const r of csv('pokemon_egg_groups')) eggOf.set(Number(r.species_id), [...(eggOf.get(Number(r.species_id)) ?? []), groups.get(r.egg_group_id!)!]);

for (const file of ['species', 'customSpecies']) {
  const path = new URL(`../src/data/${file}.json`, import.meta.url);
  const list = JSON.parse(readFileSync(path, 'utf8')) as Array<Record<string, unknown> & { dex: number }>;
  let missing = 0;
  for (const s of list) {
    const color = colorOf.get(s.dex);
    if (!color) { missing++; continue; }
    s.eggGroups = eggOf.get(s.dex) ?? [];
    s.color = color;
  }
  writeFileSync(path, JSON.stringify(list, null, 1) + '\n');
  console.log(`${file}.json: ${list.length} species, ${missing} without PokeAPI data`);
}
