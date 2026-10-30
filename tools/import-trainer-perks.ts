// Adds the director's Trainers.md trainers to src/data/archetypes.json. The text (pros, cons)
// comes from tools/sources/trainers.md; the rules come from tools/data/trainer-perk-modifiers.json
// (hand-written, one entry per trainer id). A trainer without modifiers there is skipped, so the
// import grows batch by batch. Existing trainers in archetypes.json are never touched.
//
//   npm run data:trainer-perks

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const source = readFileSync(join(root, 'tools', 'sources', 'trainers.md'), 'utf8').split(/\r?\n/);
const modifiers: Record<string, unknown[]> = JSON.parse(readFileSync(join(root, 'tools', 'data', 'trainer-perk-modifiers.json'), 'utf8'));
const signatures: Record<string, string> = JSON.parse(readFileSync(join(root, 'tools', 'data', 'trainer-signatures.json'), 'utf8'));
const limits: Record<string, string> = JSON.parse(readFileSync(join(root, 'tools', 'data', 'trainer-perk-limits.json'), 'utf8'));
const poolExtras: Record<string, string[]> = JSON.parse(readFileSync(join(root, 'tools', 'data', 'trainer-pool-extras.json'), 'utf8'));
const archetypesPath = join(root, 'src', 'data', 'archetypes.json');
const archetypes: Array<Record<string, unknown> & { id: string }> = JSON.parse(readFileSync(archetypesPath, 'utf8'));
const runPrepPath = join(root, 'src', 'data', 'runPrep.json');
const runPrep: { starterPools: Array<Record<string, unknown> & { id: string }> } = JSON.parse(readFileSync(runPrepPath, 'utf8'));
const bosses: Array<{ id: string; sprites: Record<string, string>; signature: string[] }> = JSON.parse(readFileSync(join(root, 'src', 'data', 'bosses.json'), 'utf8'));

/** The original hand-made trainers keep their ids; a Trainers.md trainer with the same plain name gets "-classic". */
const ORIGINAL = new Set(['red', 'blue', 'green', 'brock', 'misty', 'giovanni', 'cynthia', 'oak', 'n']);
const BOSS_ALIASES: Record<string, string> = { 'ball-guy': 'ballguy' };

const clean = (s: string) => s.replace(/\\([()\-_.!*#])/g, '$1').replace(/\*\*/g, '').trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clauses = (text: string) =>
  text.split(/;\s*|\.\s+(?=[A-Z])/).map((c) => c.replace(/\.$/, '').trim()).filter(Boolean);

interface Entry { name: string; id: string; baseId: string; pros: string[]; cons: string[]; order: number }
const entries: Entry[] = [];
for (const raw of source) {
  const m = /^\*\s+(.+?)\s+—\s+Pros:\s*(.*?)(?:\s+Cons:\s*(.*))?$/.exec(clean(raw));
  if (!m) continue;
  const name = m[1]!.trim();
  const baseName = name.replace(/\s*\(.*\)$/, '');
  let id = slug(name);
  if (ORIGINAL.has(id)) id = `${id}-classic`;
  entries.push({ name, id, baseId: slug(baseName), pros: clauses(m[2]!), cons: clauses(m[3] ?? ''), order: entries.length });
}

const spriteFor = (e: Entry) => {
  const id = BOSS_ALIASES[e.baseId] ?? e.baseId;
  const boss = bosses.find((b) => b.id === id);
  return boss ? boss.sprites.default ?? Object.values(boss.sprites)[0]! : 'trainer.red';
};

const bossFor = (e: Entry) => bosses.find((b) => b.id === (BOSS_ALIASES[e.baseId] ?? e.baseId));

/** Up to two types the trainer boosts (shown on the Trainer Archive). */
const typesOf = (mods: Array<Record<string, unknown>>): string[] => {
  const out: string[] = [];
  for (const m of mods) {
    if (m.kind !== 'damageMultiplier' && m.kind !== 'groupXpMultiplier' && m.kind !== 'survivalChance' && m.kind !== 'statusChanceMultiplier') continue;
    if (m.kind === 'damageMultiplier' && Number(m.value) < 1) continue;
    for (const t of (m.types as string[] | undefined) ?? (m.type ? [m.type as string] : [])) if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 2);
};

const titleFor = (mods: Array<Record<string, unknown>>): string => {
  const typed = mods.find((m) => m.kind === 'damageMultiplier' && (m.type || m.types) && Number(m.value) > 1);
  const type = (typed?.type as string | undefined) ?? (typed?.types as string[] | undefined)?.join(' / ');
  return type ? `The ${type[0]!.toUpperCase()}${type.slice(1)} Specialist` : 'The Specialist';
};

const entry_unlock = (need: number) => ({ kind: 'total', counter: 'trainersDefeated', atLeast: need });
let added = 0;
let skipped = 0;
for (const e of entries) {
  const mods = modifiers[e.id] as Array<Record<string, unknown>> | undefined;
  if (!mods) { skipped++; continue; }
  const need = 10 + 10 * e.order;
  const entry = {
    id: e.id,
    name: e.name,
    title: titleFor(mods),
    description: [e.pros[0], e.cons[0]].filter(Boolean).join(' — ') + '.',
    pros: e.pros,
    cons: e.cons,
    unlockedByDefault: false,
    unlock: { kind: 'total', counter: 'trainersDefeated', atLeast: need },
    unlockText: `Defeat ${need} trainers in total across your runs`,
    unlockCost: 300,
    spriteAssetId: spriteFor(e),
    modifiers: mods,
    signatureTypes: typesOf(mods),
    signatureSpecies: bossFor(e)?.signature.slice(0, 4) ?? [],
    signaturePool: `trainer-${e.id}`,
    eventTags: [],
    signatureMechanic: signatures[e.id] ?? null,
  };
  const pool = {
    id: `trainer-${e.id}`,
    name: `${e.name}’s Team`,
    description: `Pokémon from ${e.name}’s team, as first stages.`,
    category: 'trainer',
    bosses: bossFor(e) ? [bossFor(e)!.id] : [],
    // A pool needs three starters: a boss with a short signature list also gets its types, or listed extras.
    ...(poolExtras[e.id] ? { species: poolExtras[e.id] } : {}),
    filter: (bossFor(e)?.signature.length ?? 0) >= 3 || poolExtras[e.id] || typesOf(mods).length === 0 ? undefined : { types: typesOf(mods) },
    unlock: entry_unlock(need),
    unlockText: `Defeat ${need} trainers in total across your runs`,
  };
  const pAt = runPrep.starterPools.findIndex((p) => p.id === pool.id);
  if (pAt >= 0) runPrep.starterPools[pAt] = pool; else runPrep.starterPools.push(pool);
  const at = archetypes.findIndex((a) => a.id === e.id);
  if (at >= 0) archetypes[at] = entry; else archetypes.push(entry);
  added++;
}
const unknown = Object.keys(modifiers).filter((id) => !entries.some((e) => e.id === id));
if (unknown.length) throw new Error(`modifiers for unknown trainers: ${unknown.join(', ')}`);
writeFileSync(archetypesPath, JSON.stringify(archetypes, null, 2) + '\n');
writeFileSync(runPrepPath, JSON.stringify(runPrep, null, 1) + '\n');
const rows = entries.map((e) => `- [${modifiers[e.id] ? 'x' : ' '}] ${e.name} (\`${e.id}\`)${signatures[e.id] ? ` — signature: ${signatures[e.id]}` : ''}${limits[e.id] ? ` — limited: ${limits[e.id]}` : ''}`);
writeFileSync(
  join(root, 'docs', 'plans', 'trainers-coverage.md'),
  `# Trainers.md coverage\n\nGenerated by \`npm run data:trainer-perks\`. [x] = built and playable (perks run in the engine, see \`core/trainerPerks.ts\`). ${added} of ${entries.length} built.\n\n${rows.join('\n')}\n`,
);
console.log(`trainers.md: ${entries.length} trainers, ${added} in archetypes.json, ${skipped} not built yet`);
