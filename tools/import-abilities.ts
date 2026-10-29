// Adds each species' abilities to src/data/species.json and writes
// src/data/abilities.json (every ability any species can have: name and a
// one-line description), from PokeAPI's open data.
//
//   npm run data:abilities [-- <PokeAPI CSV folder>]
//
// Run it again after `npm run data:species`, which rebuilds species.json
// without abilities. Missing CSVs are downloaded into .cache/pokeapi with
// curl. A species gets the abilities of its PokeAPI Pokémon of the same id,
// or of its default form (Deoxys → deoxys-normal). Which abilities the battle
// engine runs is listed in src/core/battle/abilities.ts, not here.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const csvDir = process.argv[2] ?? join(root, '.cache', 'pokeapi');

function readCsv(name: string): Record<string, string>[] {
  const path = join(csvDir, `${name}.csv`);
  if (!existsSync(path)) {
    mkdirSync(csvDir, { recursive: true });
    execFileSync('curl', ['-sSfL', '-o', path, `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}.csv`]);
  }
  // Quoted fields can hold commas and line breaks (ability_prose's long text).
  const text = readFileSync(path, 'utf8');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(field), (field = '');
    else if (ch === '\n') row.push(field), rows.push(row), (row = []), (field = '');
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ''])));
}

const pokemon = readCsv('pokemon');
const abilityRows = readCsv('abilities');
const abilityNames = readCsv('ability_names').filter((r) => r.local_language_id === '9');
const prose = readCsv('ability_prose').filter((r) => r.local_language_id === '9');
const links = readCsv('pokemon_abilities');

const abilityId = new Map(abilityRows.map((r) => [r.id!, r.identifier!]));
const nameOf = new Map(abilityNames.map((r) => [abilityId.get(r.ability_id!)!, r.name!]));
const textOf = new Map(prose.map((r) => [abilityId.get(r.ability_id!)!, r.short_effect!.replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1').replace(/\s+/g, ' ').trim()]));

const byPokemon = new Map<string, { normal: string[]; hidden: string | null }>();
const pokemonIdent = new Map(pokemon.map((p) => [p.id!, p.identifier!]));
for (const l of [...links].sort((a, b) => Number(a.slot) - Number(b.slot))) {
  const ident = pokemonIdent.get(l.pokemon_id!);
  const ability = abilityId.get(l.ability_id!);
  if (!ident || !ability) continue;
  const entry = byPokemon.get(ident) ?? { normal: [], hidden: null };
  if (l.is_hidden === '1') entry.hidden = ability;
  else if (!entry.normal.includes(ability)) entry.normal.push(ability);
  byPokemon.set(ident, entry);
}
const defaultForm = new Map<string, string>();
for (const p of pokemon) if (p.is_default === '1') defaultForm.set(p.identifier!.split('-')[0]!, defaultForm.get(p.identifier!.split('-')[0]!) ?? p.identifier!);

type Species = { id: string; abilities?: { normal: string[]; hidden: string | null } };
const speciesPath = join(dataDir, 'species.json');
const species = JSON.parse(readFileSync(speciesPath, 'utf8')) as Species[];
const used = new Set<string>();
const missing: string[] = [];
for (const s of species) {
  const found = byPokemon.get(s.id) ?? byPokemon.get(defaultForm.get(s.id) ?? '') ?? byPokemon.get(s.id.split('-')[0]!);
  if (!found || found.normal.length === 0) {
    missing.push(s.id);
    continue;
  }
  s.abilities = found;
  for (const a of [...found.normal, ...(found.hidden ? [found.hidden] : [])]) used.add(a);
}
writeFileSync(speciesPath, JSON.stringify(species, null, 1) + '\n');

const abilities = [...used].sort().map((id) => ({ id, name: nameOf.get(id) ?? id, description: textOf.get(id) ?? '' }));
writeFileSync(join(dataDir, 'abilities.json'), JSON.stringify(abilities, null, 1) + '\n');
console.log(`${species.length - missing.length} species have abilities; ${abilities.length} abilities in abilities.json.`);
if (missing.length) console.log(`No abilities found for ${missing.length}: ${missing.join(', ')}`);
