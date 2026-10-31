// Gives every NPC trainer (npc- archetypes) a fixed four-move set for each of its signature species.
// Picks supported moves learned by level MAX_LEVEL: the best two same-type attacks, the best other attack, and a supported status move if there is one.
// Safe to re-run: only `signatureMovesets` on npc- archetypes is rewritten.
// Run: npm run data:npc-movesets
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as Data from '../src/data/index.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const MAX_LEVEL = 14;
const { buildContent } = await loadModule<typeof Data>('/src/data/index.ts');
await closeModules();
const content = buildContent();
const file = join(import.meta.dirname, '..', 'src/data/archetypes.json');
const archetypes = JSON.parse(readFileSync(file, 'utf8')) as { id: string; signatureSpecies: string[]; signatureMovesets?: Record<string, string[]> }[];

for (const a of archetypes) {
  if (!a.id.startsWith('npc-')) continue;
  a.signatureMovesets = {};
  for (const id of a.signatureSpecies) {
    const species = content.species.get(id)!;
    const known = [...new Set(species.learnset.filter((e) => e.level <= MAX_LEVEL).map((e) => content.moves.get(e.move)!).filter((m) => m?.supported))];
    const power = (m: (typeof known)[number]) => m.power ?? 0;
    const attacks = known.filter((m) => m.category !== 'status' && power(m) > 0).sort((x, y) => power(y) - power(x) || x.id.localeCompare(y.id));
    const stab = attacks.filter((m) => species.types.includes(m.type)).slice(0, 2);
    const other = attacks.filter((m) => !stab.includes(m)).slice(0, 1);
    const status = known.filter((m) => m.category === 'status').slice(0, 1);
    const set = [...stab, ...other, ...status];
    for (const m of attacks) if (set.length < 4 && !set.includes(m)) set.push(m);
    if (set.length > 0) a.signatureMovesets[id] = set.map((m) => m.id);
  }
}
writeFileSync(file, JSON.stringify(archetypes, null, 2) + '\n');
