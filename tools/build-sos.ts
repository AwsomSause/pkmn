// Builds src/data/sos.json: which wild Pokémon can call for help and whom they call
// (Milestone Z7, from the DBK "SOS Battles" add-on's PBS files).
//
//   node tools/build-sos.ts <folder with the add-on's pokemon*.txt files>
//
// Source: SOS Battles.zip (PBS/Plugins/[DBK] SOS Battles/pokemon*.txt). `CallRateSOS`
// is the species' call rate; `SpeciesSOS` lists the species it may call (default: its own).
// Names that match no species here are listed and skipped.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dir = process.argv[2];
if (!dir) throw new Error('Pass the folder with the SOS pokemon*.txt files');
const species = JSON.parse(readFileSync(join(root, 'src/data/species.json'), 'utf8')) as { id: string }[] | { species: { id: string }[] };
const list = Array.isArray(species) ? species : species.species;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(list.map((s) => [norm(s.id), s.id]));
const aliases: Record<string, string> = { nidoranf: 'nidoran-f', nidoranm: 'nidoran-m' };
const resolve = (name: string) => byName.get(norm(name)) ?? aliases[norm(name)];

const rates: Record<string, { rate: number; allies?: string[] }> = {};
const unknown = new Set<string>();
for (const file of readdirSync(dir).filter((f) => /^pokemon.*\.txt$/.test(f) && !f.includes('forms'))) {
  let current: string | null = null;
  for (const raw of readFileSync(join(dir, file), 'utf8').split(/\r?\n/)) {
    const head = raw.match(/^\[([A-Z0-9_]+)\]$/);
    if (head) {
      current = resolve(head[1]!) ?? null;
      if (!current) unknown.add(head[1]!);
      continue;
    }
    if (!current) continue;
    const kv = raw.match(/^(\w+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const entry = (rates[current] ??= { rate: 0 });
    if (kv[1] === 'CallRateSOS') entry.rate = Number(kv[2]);
    if (kv[1] === 'SpeciesSOS') {
      const allies = kv[2]!.split(',').map((n) => resolve(n.trim())).filter((x): x is string => Boolean(x));
      if (allies.length > 0) entry.allies = allies;
    }
  }
}
for (const id of Object.keys(rates)) if (rates[id]!.rate <= 0) delete rates[id];
const sorted = Object.fromEntries(Object.entries(rates).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(root, 'src/data/sos.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${Object.keys(sorted).length} species can call for help; ${unknown.size} names unmatched${unknown.size ? ': ' + [...unknown].slice(0, 20).join(', ') : ''}`);
