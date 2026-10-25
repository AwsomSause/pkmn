// Builds every boss team from the boss profiles in src/data/bosses.json and
// writes src/data/bossTeams.json. Each boss gets:
//   - 16 gym teams: team 1–8 for the run's first eight stages, 9–16 for the
//     next eight, and team 16 again for any later gym (director, 2026-10-25);
//   - 10 Elite Four teams, one per region (9 regions + the Grand Region);
//   - 10 champion teams, one per region, far harder than the rest.
//
//   npm run data:bosses                    (uses src/data)
//   npm run data:bosses -- --data <dir>    (reads species.json / learnables.json from <dir>)
//
// A team lists species, moves, "training" (extra vitamin-style stat stacks)
// and how cleverly the boss picks moves (ai, 0–1). Levels are not stored:
// the game's difficulty curve sets them, and `level` is only the level the
// team was built for. The same input always gives the same teams.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const argData = process.argv.indexOf('--data');
const speciesDir = argData > 0 ? process.argv[argData + 1]! : dataDir;
const readJson = <T>(dir: string, file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;

type Stat = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type Evolution = { to: string; level?: number; item?: string };
interface SpeciesRow {
  id: string;
  name: string;
  types: string[];
  baseStats: Record<Stat, number>;
  learnset: { level: number; move: string }[];
  evolutions?: Evolution[];
  evolvesFrom?: string | null;
  tags?: string[];
  form?: { kind: string; base: string };
}
interface MoveRow {
  id: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  priority?: number;
  target: 'enemy' | 'self';
  supported?: boolean;
  effects?: {
    status?: { id: string; chance: number };
    statChanges?: { stat: string; stages: number; target: 'self' | 'enemy'; chance: number }[];
    drain?: number;
    recoil?: number;
    recoilMaxHp?: number;
    fixedDamage?: 'level';
  };
}
interface Boss {
  id: string;
  name: string;
  types: string[];
  signature: string[];
}
interface TeamConfig { baseSize: number; extraPerStage: number; maxSize: number }
interface Balance {
  gymTeam: TeamConfig;
  eliteFourTeam: TeamConfig;
  campaigns: { id: string; stagesPerRegion: number; columns: number }[];
  difficulty: { baseLevel: number; curve: number; capMargin: number; levelCapStep: number; maxLevel: number; gymBonus: number; aceBonus: number; eliteFourBonus: number; championBonus: number };
}

interface BossMember { species: string; moves: string[]; training?: Partial<Record<Stat, number>> }
interface BossTeam { level: number; ai: number; members: BossMember[] }

const bosses = readJson<Boss[]>(dataDir, 'bosses.json');
const speciesList = readJson<SpeciesRow[]>(speciesDir, 'species.json');
const learnablesPath = join(speciesDir, 'learnables.json');
const learnables: Record<string, { egg?: string[]; other?: string[] }> = existsSync(learnablesPath) ? readJson(speciesDir, 'learnables.json') : {};
const moves = new Map(readJson<MoveRow[]>(dataDir, 'moves.json').filter((m) => m.supported !== false).map((m) => [m.id, m]));
const balance = readJson<Balance>(dataDir, 'balance.json');
const species = new Map(speciesList.map((s) => [s.id, s]));

const GYM_TEAMS = 16;
const LEAGUE_TEAMS = 10;

// ---------------------------------------------------------------- randomness
/** Small seeded generator (mulberry32) so the output never changes between runs. */
function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- levels
/** The same curve as enemyLevel() in src/core/encounters.ts, without the random variance. */
function curveLevel(regionIndex: number, t: number, bonus: number): number {
  const d = balance.difficulty;
  const cap = Math.min(d.maxLevel, d.levelCapStep * (regionIndex + 1));
  const start = regionIndex === 0 ? d.baseLevel : Math.min(d.maxLevel, d.levelCapStep * regionIndex);
  const end = Math.max(start, cap - d.capMargin);
  return Math.max(2, Math.min(cap, Math.round(start + (end - start) * Math.pow(t, d.curve)) + bonus));
}
const full = balance.campaigns.find((c) => c.id === 'full')!;
/** Ace level of gym team `k` (1-based): the gym of the run's k-th stage in the full campaign. */
function gymLevel(k: number): number {
  const stage = Math.min(k, GYM_TEAMS) - 1;
  const region = Math.floor(stage / full.stagesPerRegion);
  const s = stage % full.stagesPerRegion;
  const total = full.stagesPerRegion * full.columns - 1;
  const t = (s * full.columns + full.columns - 1) / total;
  return curveLevel(region, t, balance.difficulty.gymBonus + balance.difficulty.aceBonus);
}
const eliteLevel = (r: number) => curveLevel(r - 1, 1, balance.difficulty.eliteFourBonus + balance.difficulty.aceBonus);
const championLevel = (r: number) => curveLevel(r - 1, 1, balance.difficulty.championBonus + balance.difficulty.aceBonus);

// ---------------------------------------------------------------- species helpers
const bst = (s: SpeciesRow) => Object.values(s.baseStats).reduce((a, b) => a + b, 0);
const isLegend = (s: SpeciesRow) => (s.tags ?? []).some((t) => t === 'legendary' || t === 'mythical');
const isBaby = (s: SpeciesRow) => (s.tags ?? []).includes('baby');
/** Regional forms are fine; mega, gigantamax, primal and battle forms wait for their mechanics. */
const usableForm = (s: SpeciesRow) => !s.form || s.form.kind === 'regional';

function preEvolution(s: SpeciesRow): SpeciesRow | undefined {
  const fromId = s.evolvesFrom ?? (s.form ? species.get(s.form.base)?.evolvesFrom : undefined);
  if (!fromId) return undefined;
  // A regional form pre-evolves into the same region's form when there is one (e.g. growlithe-hisui).
  const suffix = s.form?.kind === 'regional' ? s.id.slice(s.form.base.length) : '';
  return species.get(fromId + suffix) ?? species.get(fromId);
}

/** How far up its line a species is: 0 for a first stage. */
function depth(s: SpeciesRow): number {
  let d = 0;
  for (let p = preEvolution(s); p; p = preEvolution(p)) d++;
  return d;
}

/** The level a boss's Pokémon may be this species: its evolution level, or a fixed level for stone, trade and friendship evolutions. */
function minimumLevel(s: SpeciesRow): number {
  const from = preEvolution(s);
  if (!from) return 1;
  const baseId = s.form?.base ?? s.id;
  const evo = (from.evolutions ?? []).find((e) => e.to === s.id || e.to === baseId);
  if (evo?.level) return evo.level;
  const before = minimumLevel(from);
  return depth(s) >= 2 ? Math.max(before + 8, 36) : Math.max(before + 10, 28);
}

/** The form of `finalId`'s line that a boss would have at `level` (Garchomp at 60, Gible at 12). Babies are skipped. */
function formAt(id: string, level: number): SpeciesRow | undefined {
  let s = species.get(id);
  while (s && level < minimumLevel(s)) {
    const from = preEvolution(s);
    if (!from || isBaby(from)) break;
    s = from;
  }
  return s;
}

/** The first stage of a line, for keeping one Pokémon per evolution family in a team. */
function family(s: SpeciesRow): string {
  let r = s;
  for (let p = preEvolution(r); p; p = preEvolution(p)) r = p;
  return r.form?.base ?? r.id;
}

/** Never added to a team just for its type (they can still be in a boss's signature list). */
const NOT_FILLER = new Set([
  // Ultra Beasts
  'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana', 'guzzlord', 'poipole', 'naganadel', 'stakataka', 'blacephalon',
  // Paradox Pokémon
  'great-tusk', 'scream-tail', 'brute-bonnet', 'flutter-mane', 'slither-wing', 'sandy-shocks', 'roaring-moon', 'walking-wake', 'gouging-fire', 'raging-bolt',
  'iron-treads', 'iron-bundle', 'iron-hands', 'iron-jugulis', 'iron-moth', 'iron-thorns', 'iron-valiant', 'iron-leaves', 'iron-boulder', 'iron-crown',
]);
const fullyEvolved = speciesList.filter(
  (s) => usableForm(s) && !s.form && !isLegend(s) && !isBaby(s) && !NOT_FILLER.has(s.id) && (s.evolutions ?? []).length === 0,
);

/** Strong teams bring the evolved form when the level allows it (Onix becomes Steelix). */
function evolveUp(s: SpeciesRow, level: number): SpeciesRow {
  for (let guard = 0; guard < 3; guard++) {
    const next = (s.evolutions ?? []).map((e) => species.get(e.to)).find((n) => n && usableForm(n) && minimumLevel(n) <= level);
    if (!next) break;
    s = next;
  }
  return s;
}

// ---------------------------------------------------------------- moves
const mainStat = (s: SpeciesRow): 'atk' | 'spa' => (s.baseStats.atk >= s.baseStats.spa ? 'atk' : 'spa');

function learnable(s: SpeciesRow, level: number, wide: boolean): MoveRow[] {
  const ids = new Set(s.learnset.filter((e) => e.level <= level).map((e) => e.move));
  if (wide) {
    const extra = learnables[s.id] ?? (s.form ? learnables[s.form.base] : undefined) ?? {};
    // TM, tutor and egg moves, but nothing much stronger than the level allows.
    for (const id of [...(extra.egg ?? []), ...(extra.other ?? [])]) {
      const m = moves.get(id);
      if (m && (m.power ?? 0) <= 40 + 2 * level) ids.add(id);
    }
  }
  return [...ids].map((id) => moves.get(id)).filter((m): m is MoveRow => Boolean(m));
}

function damageScore(m: MoveRow, s: SpeciesRow, level: number): number {
  if (m.category === 'status') return 0;
  const e = m.effects ?? {};
  const power = e.fixedDamage === 'level' ? level : (m.power ?? 0);
  const stat = m.category === 'physical' ? s.baseStats.atk : s.baseStats.spa;
  let score = power * ((m.accuracy ?? 100) / 100) * (s.types.includes(m.type) ? 1.5 : 1) * (stat / Math.max(s.baseStats.atk, s.baseStats.spa));
  if ((m.priority ?? 0) > 0) score *= 1.1;
  if (e.drain) score *= 1 + e.drain / 2;
  if (e.recoil || e.recoilMaxHp) score *= 0.85;
  if ((e.statChanges ?? []).some((c) => c.target === 'self' && c.stages < 0)) score *= 0.9;
  if (e.status) score *= 1 + e.status.chance / 400;
  return score;
}

/** How useful a status move is to this Pokémon, relative to its best attack (0 = not worth a slot). */
function statusValue(m: MoveRow, s: SpeciesRow): number {
  const e = m.effects ?? {};
  if (m.category !== 'status') return 0;
  const acc = (m.accuracy ?? 100) / 100;
  const main = mainStat(s);
  const self = (e.statChanges ?? []).filter((c) => c.target === 'self');
  if (self.length > 0) {
    const mainGain = self.filter((c) => c.stat === main).reduce((a, c) => a + c.stages, 0);
    const speedGain = self.filter((c) => c.stat === 'spe').reduce((a, c) => a + c.stages, 0);
    return mainGain > 0 ? 0.45 + 0.12 * mainGain + 0.1 * speedGain : 0;
  }
  if (e.status?.id === 'slp') return 0.75 * acc;
  if (e.status?.id === 'brn' && main === 'spa') return 0.5 * acc;
  if (e.status?.id === 'par') return 0.45 * acc;
  if (e.status?.id === 'psn') return 0.3 * acc;
  return 0;
}

/**
 * Four moves for a boss's Pokémon. Weak teams just know their latest level-up
 * moves; stronger teams get strong same-type attacks, coverage for other
 * types and, near the top, one status or set-up move.
 */
function pickMoves(s: SpeciesRow, level: number, strength: number): string[] {
  const levelUp = learnable(s, level, false);
  if (strength < 0.3) {
    const latest = s.learnset.filter((e) => e.level <= level && moves.has(e.move)).map((e) => e.move);
    const unique = [...new Set(latest)];
    const picked = unique.slice(-4);
    // Make sure at least one of them does damage.
    if (!picked.some((id) => moves.get(id)!.category !== 'status')) {
      const attack = [...unique].reverse().find((id) => moves.get(id)!.category !== 'status');
      if (attack) picked[0] = attack;
    }
    return picked.length > 0 ? picked : ['tackle'];
  }
  const pool = strength >= 0.45 ? learnable(s, level, true) : levelUp;
  const attacks = pool.filter((m) => m.category !== 'status').map((m) => ({ m, score: damageScore(m, s, level) }));
  const chosen: MoveRow[] = [];
  const covered = new Set<string>();
  const maxAttacks = strength >= 0.55 ? 3 : 4;
  while (chosen.length < maxAttacks) {
    const next = attacks
      .filter((a) => !chosen.includes(a.m))
      .map((a) => ({ ...a, value: a.score * (covered.has(a.m.type) ? 0.45 : 1) }))
      .sort((x, y) => y.value - x.value || x.m.id.localeCompare(y.m.id))[0];
    if (!next) break;
    chosen.push(next.m);
    covered.add(next.m.type);
  }
  if (chosen.length < 4) {
    const support = pool
      .map((m) => ({ m, value: statusValue(m, s) }))
      .filter((x) => x.value > 0)
      .sort((x, y) => y.value - x.value || x.m.id.localeCompare(y.m.id))[0];
    if (support && strength >= 0.55) chosen.push(support.m);
  }
  // Top up with whatever attacks are left.
  for (const a of attacks.sort((x, y) => y.score - x.score)) if (chosen.length < 4 && !chosen.includes(a.m)) chosen.push(a.m);
  if (chosen.length === 0) return levelUp.slice(-4).map((m) => m.id);
  return chosen.map((m) => m.id);
}

// ---------------------------------------------------------------- training
const TRAINING_CAP = 6;
/** Spreads `stacks` over the stats that matter most to this Pokémon: its attacking stat, Speed, HP, then defences. */
function train(s: SpeciesRow, stacks: number): Partial<Record<Stat, number>> | undefined {
  if (stacks <= 0) return undefined;
  const main = mainStat(s);
  const order: Stat[] = [main, 'spe', 'hp', s.baseStats.def <= s.baseStats.spd ? 'def' : 'spd', s.baseStats.def <= s.baseStats.spd ? 'spd' : 'def'];
  const out: Partial<Record<Stat, number>> = {};
  for (let i = 0, left = stacks; left > 0 && i < 200; i++) {
    const stat = order[i % order.length]!;
    if ((out[stat] ?? 0) < TRAINING_CAP) (out[stat] = (out[stat] ?? 0) + 1), left--;
  }
  return out;
}

// ---------------------------------------------------------------- teams
interface TeamSpec {
  role: 'gym' | 'elite' | 'champion';
  index: number;
  level: number;
  size: number;
  /** 0–1: how strong the picks and moves are. */
  strength: number;
  ai: number;
  training: number;
  aceTraining: number;
  legendsAllowed: boolean;
}

function typePool(boss: Boss): SpeciesRow[] {
  const types = boss.types.length > 0 ? boss.types : [...new Set(boss.signature.flatMap((id) => species.get(id)?.types ?? []))];
  return fullyEvolved.filter((s) => s.types.some((t) => types.includes(t)));
}

function buildTeam(boss: Boss, spec: TeamSpec, warnings: Set<string>): BossTeam {
  const rnd = seeded(`${boss.id}|${spec.role}|${spec.index}`);
  const signature = boss.signature.filter((id) => {
    const s = species.get(id);
    if (!s) warnings.add(`${boss.id}: species "${id}" is not in the game data`);
    return s && usableForm(s) && (spec.legendsAllowed || !isLegend(s));
  });
  const legend = spec.legendsAllowed ? signature.find((id) => isLegend(species.get(id)!)) : undefined;
  const aceId = legend ?? signature[0];
  const level = spec.level;
  const members: SpeciesRow[] = [];
  const families = new Set<string>();
  const add = (id: string | undefined): boolean => {
    const at = id ? formAt(id, level) : undefined;
    const s = at && spec.strength >= 0.5 ? evolveUp(at, level) : at;
    if (!s || families.has(family(s)) || members.length >= spec.size) return false;
    families.add(family(s));
    members.push(s);
    return true;
  };
  // Order the rest of the signature: random for weak teams, strongest first for strong ones.
  const maxBst = 720;
  const rest = signature
    .filter((id) => id !== aceId)
    .map((id) => ({ id, key: (1 - spec.strength) * rnd() + spec.strength * (bst(species.get(id)!) / maxBst) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.id);
  // Weaker teams sometimes swap in a Pokémon of the boss's types for variety.
  const extraFromType = spec.strength < 0.8 && rnd() < 0.5 ? 1 : 0;
  const fromSignature = Math.max(0, spec.size - 1 - extraFromType);
  for (const id of rest) if (members.length < fromSignature) add(id);
  const pool = typePool(boss)
    .map((s) => ({ s, key: (1 - spec.strength) * rnd() + spec.strength * (bst(s) / maxBst) + 0.0001 * rnd() }))
    .sort((a, b) => b.key - a.key);
  for (const { s } of pool) if (members.length < spec.size - 1) add(s.id);
  for (const id of rest) if (members.length < spec.size - 1) add(id);
  // The ace goes last.
  if (!add(aceId)) for (const { s } of pool) if (add(s.id)) break;
  // Last resort (the boss's Pokémon aren't in the game data yet): the strongest fully evolved Pokémon.
  if (members.length < spec.size) for (const s of [...fullyEvolved].sort((x, y) => bst(y) - bst(x))) add(s.id);
  return {
    level,
    ai: Math.round(spec.ai * 100) / 100,
    members: members.map((s, i) => {
      const isAce = i === members.length - 1;
      const training = train(s, spec.training + (isAce ? spec.aceTraining : 0));
      return { species: s.id, moves: pickMoves(s, level, spec.strength), ...(training ? { training } : {}) };
    }),
  };
}

const sizeFor = (cfg: TeamConfig, step: number) => Math.min(cfg.maxSize, cfg.baseSize + Math.floor(cfg.extraPerStage * step));

function gymSpec(k: number): TeamSpec {
  return {
    role: 'gym',
    index: k,
    level: gymLevel(k),
    size: sizeFor(balance.gymTeam, k - 1),
    strength: 0.7 * ((k - 1) / (GYM_TEAMS - 1)),
    ai: 0.15 + 0.55 * ((k - 1) / (GYM_TEAMS - 1)),
    training: k <= 8 ? 0 : Math.ceil((k - 8) / 2),
    aceTraining: k <= 8 ? 0 : 1,
    legendsAllowed: false,
  };
}

function eliteSpec(r: number): TeamSpec {
  const f = (r - 1) / (LEAGUE_TEAMS - 1);
  return { role: 'elite', index: r, level: eliteLevel(r), size: sizeFor(balance.eliteFourTeam, r - 1), strength: 0.45 + 0.5 * f, ai: 0.6 + 0.3 * f, training: r, aceTraining: 1, legendsAllowed: r >= 9 };
}

function championSpec(r: number): TeamSpec {
  const f = (r - 1) / (LEAGUE_TEAMS - 1);
  return { role: 'champion', index: r, level: championLevel(r), size: 6, strength: 0.8 + 0.2 * f, ai: 0.85 + 0.15 * f, training: 2 + 2 * r, aceTraining: 2, legendsAllowed: r >= 5 };
}

const warnings = new Set<string>();
const out: Record<string, { gym: BossTeam[]; elite: BossTeam[]; champion: BossTeam[] }> = {};
for (const boss of bosses) {
  out[boss.id] = {
    gym: Array.from({ length: GYM_TEAMS }, (_, i) => buildTeam(boss, gymSpec(i + 1), warnings)),
    elite: Array.from({ length: LEAGUE_TEAMS }, (_, i) => buildTeam(boss, eliteSpec(i + 1), warnings)),
    champion: Array.from({ length: LEAGUE_TEAMS }, (_, i) => buildTeam(boss, championSpec(i + 1), warnings)),
  };
}

/** "garchomp / earthquake dragon-claw stone-edge swords-dance / atk+4 spe+4 hp+3": the format the game reads. */
const memberText = (m: BossMember) =>
  [m.species, m.moves.join(' '), ...(m.training ? [Object.entries(m.training).map(([stat, n]) => `${stat}+${n}`).join(' ')] : [])].join(' / ');
const teamText = (t: BossTeam) => JSON.stringify({ level: t.level, ai: t.ai, members: t.members.map(memberText) });

// One team per line keeps the file readable and its diffs small.
const lines: string[] = [];
for (const [id, roles] of Object.entries(out)) {
  const roleText = (Object.keys(roles) as (keyof typeof roles)[])
    .map((role) => `  ${JSON.stringify(role)}: [\n${roles[role].map((t) => '   ' + teamText(t)).join(',\n')}\n  ]`)
    .join(',\n');
  lines.push(` ${JSON.stringify(id)}: {\n${roleText}\n }`);
}
writeFileSync(join(dataDir, 'bossTeams.json'), `{\n${lines.join(',\n')}\n}\n`);
const count = Object.keys(out).length;
console.log(`Wrote ${count * (GYM_TEAMS + 2 * LEAGUE_TEAMS)} teams for ${count} bosses to src/data/bossTeams.json.`);
for (const w of warnings) console.warn(`warning: ${w}`);
