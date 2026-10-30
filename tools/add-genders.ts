// Adds `femaleRatio` to every species in src/data/species.json from Pokémon Essentials' pokemon.txt
// (GenderRatio): 1 = always female, 0 = always male, null = genderless. Forms use their base species' ratio.
//
//   node tools/add-genders.ts   (needs .cache/ess-pbs from the Essentials import)

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const RATIOS: Record<string, number | null> = {
  AlwaysFemale: 1, AlwaysMale: 0, Female25Percent: 0.25, Female50Percent: 0.5, Female75Percent: 0.75, FemaleOneEighth: 0.125, FemaleSevenEighths: 0.875, Genderless: null,
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ratio = new Map<string, number | null>();
for (const file of ['pokemon.txt', 'pokemon_base_Gen_9_Pack.txt']) {
  const text = readFileSync(join(root, '.cache', 'ess-pbs', file), 'utf8');
  for (const block of text.split(/\n\[/)) {
    const key = /^\[?([A-Z0-9_]+)\]/.exec(block)?.[1];
    const g = /GenderRatio = (\w+)/.exec(block)?.[1];
    if (key && g && g in RATIOS) ratio.set(norm(key), RATIOS[g]!);
  }
}
ratio.set('nidoranf', 1);
ratio.set('nidoranm', 0);

const path = join(root, 'src', 'data', 'species.json');
const species = JSON.parse(readFileSync(path, 'utf8')) as { id: string; name: string; form?: { base: string }; femaleRatio?: number | null }[];
let missing = 0;
for (const s of species) {
  const keys = [norm(s.id), norm(s.name), ...(s.form ? [norm(s.form.base)] : [])];
  const key = keys.find((k) => ratio.has(k));
  if (key === undefined) {
    missing += 1;
    continue;
  }
  s.femaleRatio = ratio.get(key)!;
}
writeFileSync(path, JSON.stringify(species, null, 1) + '\n');
console.log(`Genders added to ${species.length - missing} species (${missing} without a ratio).`);
