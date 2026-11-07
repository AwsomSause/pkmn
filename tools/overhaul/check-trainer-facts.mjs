// Overhaul content pack: checks the facts of the pack's major trainers (src/data/overhaul/major_trainers.json) against the
// game's own boss teams (bossTeams.json) and species types (plans audit 2026-11-07, section 4; e.g. "Sada listed as Psychic").
// Rules: (1) a trainer with a game boss has an ace that is in that boss's teams, else the ace becomes the boss's top-tier last
// member; (2) the listed type is one of the ace's types or the most common type in its teams, else it becomes the ace's first type.
// A few canon fixes no data can tell are listed by hand below. Run: node tools/overhaul/check-trainer-facts.mjs [--fix]
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const file = 'src/data/overhaul/major_trainers.json';
const data = read(file);
const bosses = read('src/data/bossTeams.json');
const sp = read('src/data/species.json');
const species = new Map((sp.species ?? sp).map((s) => [s.id, s]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = (id) => species.get(id)?.name ?? cap(id.replace(/-/g, ' '));
// Canon facts the data can't settle (checked against the games): Penny (Cassiopeia) leads with Sylveon; Sada and Turo are Paradox (Dragon) specialists.
const CANON = { cassiopeia: { aceId: 'sylveon', type: 'Fairy' }, sada: { aceId: 'koraidon', type: 'Dragon' }, turo: { aceId: 'miraidon', type: 'Dragon' } };

const memberIds = (boss) => Object.values(boss).flat().flatMap((t) => t.members ?? []).map((m) => m.split(' / ')[0].trim());
const topAce = (boss) => {
  const tiers = Object.values(boss).flat();
  const last = tiers[tiers.length - 1]?.members ?? [];
  return last.length ? last[last.length - 1].split(' / ')[0].trim() : null;
};
const problems = [];
for (const t of data.entries) {
  const before = `${t.type}/${t.aceId}`;
  const fix = CANON[t.id];
  if (fix) Object.assign(t, fix, { ace: nameOf(fix.aceId) });
  const boss = bosses[t.bossId];
  const members = boss ? memberIds(boss) : [];
  if (boss && t.aceId && !members.includes(t.aceId)) {
    const ace = topAce(boss);
    if (ace && species.has(ace)) Object.assign(t, { aceId: ace, ace: nameOf(ace) });
  }
  const aceTypes = species.get(t.aceId)?.types ?? [];
  const count = {};
  for (const m of members) for (const ty of species.get(m)?.types ?? []) count[ty] = (count[ty] ?? 0) + 1;
  const teamTop = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  const type = String(t.type).toLowerCase();
  if (aceTypes.length && !aceTypes.includes(type) && type !== teamTop) t.type = cap(aceTypes[0]);
  const after = `${t.type}/${t.aceId}`;
  if (before !== after) problems.push(`${t.id}: ${before} -> ${after}`);
}
console.log(problems.length ? problems.join('\n') : 'trainer facts ok');
if (process.argv.includes('--fix')) writeFileSync(new URL(file, root), JSON.stringify(data, null, 1) + '\n');
else if (problems.length) process.exitCode = 1;
