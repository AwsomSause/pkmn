// Learnset pass (Drive plan 4): adds missing TM/tutor moves to final-stage species from the Gen 9 Learnsets Compendium.
// Usage: node tools/drive/learnset-pass.mjs   (reads tools/drive/gen9-family-pools.json: family base -> all moves the family can learn;
// writes src/data/learnables.json, `other` list). Only fully safe cases: the species ends a straight evolution line (nothing before it
// branches), the family has no regional/alternate forms, and is not legendary, mythical or a baby. Baby/pre-evolution stages, branching
// families (Eevee, Tyrogue...) and form families keep their lists because the compendium pools the whole family.
import { readFileSync, writeFileSync } from 'node:fs';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const species = Object.values(read('src/data/species.json'));
const moves = Object.values(read('src/data/moves.json'));
const learnables = read('src/data/learnables.json');
const pools = read('tools/drive/gen9-family-pools.json');
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
const moveId = new Map(moves.map((m) => [norm(m.id), m.id]));
const byId = new Map(species.map((s) => [s.id, s]));
const children = new Map();
for (const s of species) if (s.evolvesFrom) children.set(s.evolvesFrom, [...(children.get(s.evolvesFrom) ?? []), s.id]);
const root = (s) => { let c = s; while (c.evolvesFrom && byId.has(c.evolvesFrom)) c = byId.get(c.evolvesFrom); return c; };
const formBases = new Set(species.filter((s) => s.form).map((s) => norm(root(s).id)));
for (const s of species) if (/-(alola|galar|hisui|paldea|mega|gmax)/.test(s.id)) formBases.add(norm(root(s).id)), formBases.add(norm(s.id.split('-')[0]));
const pool = new Map(Object.entries(pools).map(([k, v]) => [norm(k), v]));
let touched = 0, added = 0;
for (const s of species) {
  if (s.tags.length || s.form || /-(alola|galar|hisui|paldea|mega|gmax)/.test(s.id) || children.has(s.id)) continue;
  let c = s, straight = true;
  while (c.evolvesFrom) { const p = byId.get(c.evolvesFrom); if (!p || (children.get(p.id) ?? []).length > 1) { straight = false; break; } c = p; }
  const family = norm(root(s).id);
  if (!straight || formBases.has(family) || !pool.has(family) || !learnables[s.id]) continue;
  const l = learnables[s.id];
  const have = new Set([...l.egg, ...l.other, ...s.learnset.map((e) => e.move)]);
  const add = pool.get(family).map((m) => moveId.get(norm(m))).filter((m) => m && !have.has(m));
  if (!add.length) continue;
  l.other = [...l.other, ...add];
  touched++; added += add.length;
}
writeFileSync('src/data/learnables.json', JSON.stringify(learnables));
console.log(`${touched} species, ${added} moves added`);
