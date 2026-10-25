// Builds src/data/customSpecies.json and src/data/customEvolutions.json: the
// director's extra Pokémon and forms that aren't in PokeAPI (Milestone 8), and
// converts their sprites into the game's asset format.
//
//   npm run data:custom -- <new_sprites.zip>
//
// Sources:
// - The director's sprite zip (folders Insurgence, Z-Forms, Z-From BackSprites,
//   Z-Form Icons, Spooky Varients). A file ending in "b" is a back sprite, "s"
//   a shiny one. Forms without an icon use Minior's icon.
// - Pokémon Insurgence's Delta data (types, base stats, evolutions, level-up
//   moves) from the Insurgence Showdown project (github.com/Poilerwags/
//   Insurgence-Showdown, MIT), downloaded into .cache/insurgence with curl.
//   The zip's Insurgence sprites are numbered like Insurgence's own Pokédex
//   (727 = Delta Bulbasaur ... 924 = Delta Hoopa).
// - tools/custom-forms.json: everything designed for this game (Z-Forms,
//   Spooky forms, new Megas, extra Delta forms, Delta Ditto's type forms).
//
// Rules (see GAME_DESIGN.md §5d):
// - Catch rate, experience, growth rate, generation and dex number come from the
//   base species. Forms keep the base species' stats unless a design says otherwise.
// - New Megas get the base species' stats + 100 (`megaStats`).
// - Learnsets: Insurgence's own level-up moves; designed forms start from the
//   base species' moves, drop attacks of types they lost, and gain a ladder of
//   attacks for each new type (`TYPE_LADDERS`). Any Pokémon without a usable
//   attack of one of its types gets that type's ladder too. Moves the game
//   doesn't know are dropped.
// - Evolutions: a level when Insurgence gives one, otherwise the item it names,
//   otherwise the same method as the base species' evolution.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const zipPath = process.argv[2];
if (!zipPath || !existsSync(zipPath)) {
  console.error('Usage: npm run data:custom -- <new_sprites.zip>');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const cacheDir = join(root, '.cache', 'insurgence');
const spriteDir = join(root, '.cache', 'custom-sprites');

// ------------------------------------------------------------------ inputs

type Stats = { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
interface Evolution { to: string; level?: number; item?: string }
interface SpeciesOut {
  id: string;
  dex: number;
  name: string;
  generation: number;
  types: string[];
  baseStats: Stats;
  catchRate: number;
  baseExp: number;
  growthRate: string;
  evolutionStage: number;
  evolvesFrom: string | null;
  tags: string[];
  form?: { kind: string; base: string };
  learnset: { level: number; move: string }[];
  evolutions: Evolution[];
  assets: { sprite: string; icon: string; cry: string };
}
interface MoveIn { id: string; type: string; category: string; power: number | null; supported?: boolean }
interface ItemIn { id: string; effect: { kind: string } }

const readJson = <T>(file: string): T => JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;
const species = readJson<SpeciesOut[]>('species.json');
const moves = readJson<MoveIn[]>('moves.json');
const items = readJson<ItemIn[]>('items.json');
const design = JSON.parse(readFileSync(join(import.meta.dirname, 'custom-forms.json'), 'utf8'));

const speciesById = new Map(species.map((s) => [s.id, s]));
const defaultByDex = new Map(species.filter((s) => !s.form).map((s) => [s.dex, s]));
const moveById = new Map(moves.map((m) => [m.id, m]));
const moveByShowdownId = new Map(moves.map((m) => [m.id.replace(/-/g, ''), m.id]));
const evolutionItems = new Set(items.filter((i) => i.effect.kind === 'evolve').map((i) => i.id));
const MINIOR_ICON = speciesById.get('minior')!.assets.icon;

/** Downloads (once) and loads one of the Insurgence Showdown data files. */
async function showdown(file: string, exportName: string): Promise<Record<string, any>> {
  mkdirSync(cacheDir, { recursive: true });
  const ts = join(cacheDir, file);
  if (!existsSync(ts)) {
    console.log(`Downloading ${file} from Insurgence Showdown…`);
    execFileSync('curl', ['-sSfL', '-o', ts, `https://raw.githubusercontent.com/Poilerwags/Insurgence-Showdown/master/data/${file}`]);
  }
  const mjs = ts.replace(/\.ts$/, '.mjs');
  const src = readFileSync(ts, 'utf8').replace(new RegExp(`^export const ${exportName}[^=]*=`, 'm'), `export const ${exportName} =`);
  writeFileSync(mjs, src);
  return (await import(mjs))[exportName];
}
const dex = await showdown('pokedex.ts', 'Pokedex');
const learnsets = await showdown('learnsets.ts', 'Learnsets');

rmSync(spriteDir, { recursive: true, force: true });
mkdirSync(spriteDir, { recursive: true });
execFileSync('unzip', ['-o', '-q', zipPath, '-x', '__MACOSX/*', '*.DS_Store', '-d', spriteDir]);
const zipRoot = join(spriteDir, 'new sprites');
const zipFile = (rel: string) => join(zipRoot, rel);

// -------------------------------------------------------------- learnsets

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const isAttack = (id: string) => {
  const m = moveById.get(id);
  return !!m && m.category !== 'status' && m.supported !== false;
};

/** Attacks taught for a type (physical, special), as [level, move]. */
const TYPE_LADDERS: Record<string, { physical: [number, string][]; special: [number, string][] }> = {
  normal: { physical: [[1, 'tackle'], [18, 'headbutt'], [32, 'body-slam'], [46, 'double-edge']], special: [[1, 'tackle'], [20, 'swift'], [44, 'hyper-voice']] },
  fire: { physical: [[8, 'fire-fang'], [24, 'fire-punch'], [46, 'flare-blitz']], special: [[6, 'ember'], [30, 'flamethrower'], [48, 'fire-blast']] },
  water: { physical: [[8, 'aqua-jet'], [26, 'waterfall'], [36, 'liquidation'], [50, 'wave-crash']], special: [[6, 'water-gun'], [18, 'bubble-beam'], [32, 'scald'], [48, 'hydro-pump']] },
  electric: { physical: [[8, 'spark'], [26, 'thunder-punch'], [40, 'wild-charge']], special: [[6, 'thunder-shock'], [18, 'shock-wave'], [34, 'thunderbolt'], [48, 'thunder']] },
  grass: { physical: [[6, 'vine-whip'], [16, 'razor-leaf'], [28, 'seed-bomb'], [40, 'leaf-blade'], [50, 'power-whip']], special: [[6, 'absorb'], [14, 'mega-drain'], [26, 'giga-drain'], [36, 'energy-ball'], [50, 'leaf-storm']] },
  ice: { physical: [[10, 'ice-shard'], [22, 'ice-fang'], [40, 'icicle-crash']], special: [[6, 'powder-snow'], [18, 'icy-wind'], [36, 'ice-beam'], [50, 'blizzard']] },
  fighting: { physical: [[8, 'rock-smash'], [24, 'brick-break'], [36, 'drain-punch'], [48, 'close-combat']], special: [[12, 'vacuum-wave'], [32, 'aura-sphere'], [48, 'focus-blast']] },
  poison: { physical: [[6, 'poison-sting'], [18, 'poison-tail'], [30, 'poison-jab'], [48, 'gunk-shot']], special: [[8, 'acid'], [22, 'sludge'], [36, 'sludge-bomb']] },
  ground: { physical: [[8, 'mud-slap'], [20, 'bulldoze'], [42, 'earthquake']], special: [[6, 'mud-slap'], [16, 'mud-shot'], [38, 'earth-power']] },
  flying: { physical: [[6, 'peck'], [16, 'wing-attack'], [30, 'drill-peck'], [46, 'brave-bird']], special: [[6, 'gust'], [18, 'air-cutter'], [32, 'air-slash']] },
  psychic: { physical: [[6, 'confusion'], [24, 'psycho-cut'], [36, 'zen-headbutt']], special: [[6, 'confusion'], [18, 'psybeam'], [36, 'psychic']] },
  bug: { physical: [[10, 'bug-bite'], [30, 'x-scissor'], [48, 'megahorn']], special: [[10, 'struggle-bug'], [36, 'bug-buzz']] },
  rock: { physical: [[8, 'rock-throw'], [18, 'rock-tomb'], [30, 'rock-slide'], [46, 'stone-edge']], special: [[8, 'rock-throw'], [32, 'power-gem']] },
  ghost: { physical: [[6, 'astonish'], [14, 'shadow-sneak'], [30, 'shadow-claw']], special: [[6, 'astonish'], [14, 'night-shade'], [34, 'shadow-ball']] },
  dragon: { physical: [[10, 'twister'], [30, 'dragon-claw'], [46, 'dragon-rush']], special: [[10, 'twister'], [16, 'dragon-breath'], [34, 'dragon-pulse'], [50, 'draco-meteor']] },
  dark: { physical: [[10, 'bite'], [30, 'crunch'], [42, 'night-slash']], special: [[12, 'snarl'], [34, 'dark-pulse'], [46, 'night-daze']] },
  steel: { physical: [[10, 'metal-claw'], [30, 'iron-head'], [44, 'meteor-mash']], special: [[18, 'mirror-shot'], [32, 'flash-cannon']] },
  fairy: { physical: [[8, 'fairy-wind'], [32, 'play-rough'], [44, 'spirit-break']], special: [[8, 'fairy-wind'], [18, 'draining-kiss'], [32, 'dazzling-gleam'], [46, 'moonblast']] },
};
for (const [type, ladder] of Object.entries(TYPE_LADDERS)) {
  for (const [, m] of [...ladder.physical, ...ladder.special]) if (!isAttack(m)) throw new Error(`ladder move ${m} (${type}) is not a usable attack`);
}

const sortLearnset = (list: { level: number; move: string }[]) => {
  const seen = new Set<string>();
  return [...list]
    .sort((a, b) => a.level - b.level)
    .filter((e) => (seen.has(e.move) ? false : (seen.add(e.move), true)));
};

/** Fewer usable attacks than this and every type's ladder is added. */
const MIN_ATTACKS = 4;

/**
 * Adds a type's ladder for every type the learnset has no usable attack of
 * (and for `alwaysTypes`), or for all its types if it has too few attacks.
 */
function fillTypes(learnset: { level: number; move: string }[], types: string[], stats: Stats, alwaysTypes?: string[]) {
  const category = stats.atk >= stats.spa ? 'physical' : 'special';
  const out = [...learnset];
  const few = out.filter((e) => isAttack(e.move)).length < MIN_ATTACKS;
  for (const type of types) {
    const has = out.some((e) => isAttack(e.move) && moveById.get(e.move)!.type === type);
    if (has && !few && !alwaysTypes?.includes(type)) continue;
    for (const [level, move] of TYPE_LADDERS[type]![category]) out.push({ level, move });
  }
  return sortLearnset(out);
}

/** A designed form's moves: the base's, minus attacks of types it lost, plus ladders for new types. */
function designedLearnset(base: SpeciesOut, types: string[], stats: Stats) {
  const lost = base.types.filter((t) => !types.includes(t) && t !== 'normal');
  const kept = base.learnset.filter((e) => !(isAttack(e.move) && lost.includes(moveById.get(e.move)!.type)));
  const gained = types.filter((t) => !base.types.includes(t));
  return fillTypes(kept, types, stats, gained);
}

const unknownMoves = new Map<string, number>();
/** Insurgence's level-up moves: one generation's "<gen>L<level>" entries. */
function insurgenceLearnset(key: string, fallback?: { level: number; move: string }[]) {
  const data = learnsets[key]?.learnset as Record<string, string[]> | undefined;
  if (!data) return fallback ?? [];
  const entries: { gen: number; level: number; move: string }[] = [];
  for (const [move, sources] of Object.entries(data)) {
    for (const s of sources) {
      const m = /^(\d)L(\d+)$/.exec(s);
      if (m) entries.push({ gen: Number(m[1]), level: Math.max(1, Number(m[2])), move });
    }
  }
  if (entries.length === 0) return fallback ?? [];
  // The generation with the most level-up entries (Insurgence's own list is gen 6; a few moves have later extras).
  const perGen = new Map<number, number>();
  for (const e of entries) perGen.set(e.gen, (perGen.get(e.gen) ?? 0) + 1);
  const gen = [...perGen].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]![0];
  const out: { level: number; move: string }[] = [];
  for (const e of entries.filter((x) => x.gen === gen)) {
    const id = moveByShowdownId.get(e.move);
    if (id) out.push({ level: e.level, move: id });
    else unknownMoves.set(e.move, (unknownMoves.get(e.move) ?? 0) + 1);
  }
  return sortLearnset(out);
}

const lower = (types: string[]) => types.map((t) => t.toLowerCase());

/** New Megas: the base species' stats + 100 (30 to its better attack, 10 to the other, 20 each to Defense, Sp. Def and Speed). */
function megaStats(b: Stats): Stats {
  const physical = b.atk >= b.spa;
  const add: Stats = { hp: 0, atk: physical ? 30 : 10, def: 20, spa: physical ? 10 : 30, spd: 20, spe: 20 };
  return Object.fromEntries(STAT_KEYS.map((k) => [k, Math.min(255, b[k] + add[k])])) as Stats;
}

// ------------------------------------------------------------ sprite jobs

interface SpriteJob { key: string; front: string; back?: string; shiny?: string; shinyBack?: string; icon?: string; scale: 'auto' }
const jobs: SpriteJob[] = [];
const out = new Map<string, SpeciesOut>();
const evolutionPatches: { from: string; to: string; level?: number; item?: string }[] = [];

function addSprites(id: string, files: Omit<SpriteJob, 'key' | 'scale'>): { sprite: string; icon: string } {
  const exists = (f?: string) => (f && existsSync(zipFile(f)) ? f : undefined);
  const front = exists(files.front);
  if (!front) throw new Error(`${id}: front sprite ${files.front} not found`);
  const icon = exists(files.icon);
  jobs.push({ key: id, front, back: exists(files.back), shiny: exists(files.shiny), shinyBack: exists(files.shinyBack), icon, scale: 'auto' });
  return { sprite: `custom/${id}`, icon: icon ? `custom/${id}` : MINIOR_ICON };
}

function add(entry: SpeciesOut) {
  if (out.has(entry.id) || speciesById.has(entry.id)) throw new Error(`duplicate species id ${entry.id}`);
  out.set(entry.id, entry);
}

// ------------------------------------------------------ Insurgence Deltas

const VARIANTS: Record<string, string> = { s: 'spider', r: 'ruin', w: 'water', f: 'fairy', b: 'berry', c: 'cake' };
const VARIANT_NAMES: Record<string, string> = { spider: 'Spider', ruin: 'Ruin', water: 'Water', fairy: 'Fairy', berry: 'Berry', cake: 'Cake' };

/** Our id and name for an Insurgence Showdown key (bulbasaurdelta -> bulbasaur-delta, "Delta Bulbasaur"). */
function deltaIdentity(key: string): { id: string; name: string; base: SpeciesOut } {
  const d = dex[key];
  if (!d) throw new Error(`unknown Insurgence key ${key}`);
  const base = defaultByDex.get(d.num);
  if (!base) throw new Error(`${key}: no base species with dex ${d.num}`);
  const m = /delta([a-z]?)(mega)?$/.exec(key.replace(/megaactive$/, 'mega').replace(/(crystal|fired|armor|unleashed|magician|mime)$/, ''));
  const variant = m?.[1] ? VARIANTS[m[1]] : undefined;
  const mega = !!m?.[2];
  const id = [base.id, 'delta', variant, mega ? 'mega' : undefined].filter(Boolean).join('-');
  const name = `${mega ? 'Mega ' : ''}Delta ${base.name}${variant ? ` (${VARIANT_NAMES[variant]})` : ''}`;
  return { id, name, base };
}

// Sprite numbers -> Showdown keys (tools/insurgence-order.json lists Insurgence's Pokédex from 727).
const insurgenceFiles = new Set<string>(execFileSync('ls', [zipFile('Insurgence')], { encoding: 'utf8' }).split('\n').filter(Boolean));
const numbers = [...new Set([...insurgenceFiles].map((f) => /^(\d+)/.exec(f)?.[1]).filter(Boolean) as string[])].sort((a, b) => Number(a) - Number(b));
const INSURGENCE_ORDER: string[] = JSON.parse(readFileSync(join(import.meta.dirname, 'insurgence-order.json'), 'utf8'));
const insurgenceKeyOf = (n: string): string | undefined => INSURGENCE_ORDER[Number(n) - 727];

const insurgenceSprites = (num: string, suffix: string) => {
  const f = (kind: string) => `Insurgence/${num}${kind}${suffix}.png`;
  return { front: f(''), back: f('b'), shiny: f('s'), shinyBack: f('sb') };
};

/** Builds one Insurgence entry from its Showdown key. */
function insurgenceEntry(key: string, num: string, suffix: string, opts: { kind?: string; name?: string; types?: string[]; megaOf?: string } = {}): SpeciesOut {
  const d = dex[key];
  const { id, name, base } = deltaIdentity(key);
  const types = opts.types ?? lower(d.types);
  const baseStats = d.baseStats as Stats;
  const formBase = opts.megaOf ?? base.id;
  const parentKey = key.replace(/(megaactive|mega|crystal|fired|armor|unleashed|magician)$/, '');
  const fallbackMoves = opts.megaOf ? out.get(opts.megaOf)?.learnset : undefined;
  const learnset = fillTypes(insurgenceLearnset(key, fallbackMoves ?? insurgenceLearnset(parentKey)), types, baseStats);
  const art = addSprites(id, insurgenceSprites(num, suffix));
  return {
    id: idForForm(id, key),
    dex: base.dex,
    name: opts.name ?? name,
    generation: base.generation,
    types,
    baseStats,
    catchRate: base.catchRate,
    baseExp: opts.kind === 'mega' ? Math.round(base.baseExp * 1.1) : base.baseExp,
    growthRate: base.growthRate,
    evolutionStage: base.evolutionStage,
    evolvesFrom: null,
    tags: [...base.tags, 'delta'],
    form: { kind: opts.kind ?? 'alternate', base: formBase },
    learnset,
    evolutions: [],
    assets: { ...art, cry: base.assets.cry },
  };
}

/** Battle/other forms keep the parent's id plus the form name (typhlosion-delta-mega-active, emolga-delta-fired). */
function idForForm(id: string, key: string): string {
  const form = /(megaactive|crystal|fired|armor|unleashed|magician)$/.exec(key)?.[1];
  if (!form) return id;
  return `${id}-${form === 'megaactive' ? 'active' : form}`;
}

const formOverrides: Record<string, any> = Object.fromEntries(Object.entries(design.insurgenceForms).filter(([k]) => !k.startsWith('_')));
const keyToId = new Map<string, string>();
for (const num of numbers) {
  const key = insurgenceKeyOf(num);
  if (!key) continue; // designed (e.g. 925)
  const entry = insurgenceEntry(key, num, '');
  fixAssetKey(entry);
  add(entry);
  keyToId.set(key, entry.id);
  // Forms: _1, _2, ... (Delta Ditto and the designed extras are handled below).
  for (let i = 1; i <= 18; i++) {
    const suffix = `_${i}`;
    if (!insurgenceFiles.has(`${num}${suffix}.png`)) break;
    const label = `${num}${suffix}`;
    if (num === '813' || design.insurgenceExtras.some((x: any) => x.sprite === label)) continue;
    const override = formOverrides[label];
    const megaKey = Object.keys(dex).find((k) => k === `${key}mega`);
    const formKey = override?.key ?? (i === 1 ? megaKey : undefined);
    if (!formKey) throw new Error(`no data for Insurgence form ${label}`);
    const kind = override?.kind ?? 'mega';
    const form = insurgenceEntry(formKey, num, suffix, { kind, name: override?.name, types: override?.types, megaOf: entry.id });
    if (kind === 'mega' || kind === 'battle') {
      form.evolutionStage = entry.evolutionStage;
    }
    fixAssetKey(form);
    add(form);
    keyToId.set(formKey, form.id);
  }
}

/** Sprite files are named after the final id. */
function fixAssetKey(entry: SpeciesOut) {
  const job = jobs[jobs.length - 1]!;
  job.key = entry.id;
  entry.assets.sprite = `custom/${entry.id}`;
  if (entry.assets.icon !== MINIOR_ICON) entry.assets.icon = `custom/${entry.id}`;
}

// Delta evolutions.
function mirrorMethod(fromBase: SpeciesOut | undefined, toBase: SpeciesOut | undefined): { level?: number; item?: string } {
  const e = fromBase?.evolutions.find((x) => x.to === toBase?.id) ?? fromBase?.evolutions[0];
  if (e?.item) return { item: e.item };
  return { level: e?.level ?? 30 };
}
for (const [key, childId] of keyToId) {
  const d = dex[key];
  if (!d.prevo || /mega|active|crystal|fired|armor|unleashed|magician/.test(childId.replace(/^.*-delta/, ''))) continue;
  const prevoKey = Object.keys(dex).find((k) => dex[k].name === d.prevo);
  const parentId = prevoKey ? keyToId.get(prevoKey) : undefined;
  if (!parentId) continue;
  const parent = out.get(parentId)!;
  const child = out.get(childId)!;
  let method: { level?: number; item?: string };
  const item = d.evoItem ? d.evoItem.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
  if (d.evoLevel && (!d.evoType || d.evoType === 'levelExtra')) method = { level: d.evoLevel };
  else if (d.evoType === 'useItem' && item && evolutionItems.has(item)) method = { item };
  else method = mirrorMethod(speciesById.get(parent.form!.base), speciesById.get(child.form!.base));
  parent.evolutions.push({ to: childId, ...method });
  child.evolvesFrom = parentId;
}
// Evolution stages follow the chain.
for (const s of out.values()) {
  // Baby Pokémon don't count as a stage (Delta Pikachu is first-stage, like Pikachu).
  let stage = 1;
  for (let p = s.evolvesFrom; p; p = out.get(p)?.evolvesFrom ?? speciesById.get(p)?.evolvesFrom ?? null) {
    if (!(out.get(p) ?? speciesById.get(p))!.tags.includes('baby')) stage++;
  }
  if (!s.form || s.form.kind === 'alternate') s.evolutionStage = Math.min(3, stage);
}
for (const s of out.values()) {
  if (s.form && s.form.kind !== 'alternate') s.evolutionStage = out.get(s.form.base)?.evolutionStage ?? s.evolutionStage;
}

// Delta Ditto's type forms.
const ditto = out.get('ditto-delta')!;
(design.dittoTypes.order as (string | null)[]).forEach((type, i) => {
  if (!type) return;
  const id = `ditto-delta-${type}`;
  const art = addSprites(id, insurgenceSprites('813', `_${i + 1}`));
  add({
    ...ditto,
    id,
    name: `Delta Ditto (${type[0]!.toUpperCase()}${type.slice(1)})`,
    types: [type],
    form: { kind: 'alternate', base: 'ditto-delta' },
    learnset: fillTypes(ditto.learnset, [type], ditto.baseStats, [type]),
    evolutions: [],
    assets: { ...art, cry: ditto.assets.cry },
  });
});

// Designed Insurgence extras (Delta Muk's cages, Delta Snorlax's seasons, ...).
for (const x of design.insurgenceExtras) {
  const base = out.get(x.base) ?? speciesById.get(x.base);
  if (!base) throw new Error(`${x.id}: unknown base ${x.base}`);
  const [num, suffix] = x.sprite.includes('_') ? [x.sprite.split('_')[0], `_${x.sprite.split('_')[1]}`] : [x.sprite, ''];
  const stats = x.stats ?? base.baseStats;
  const art = addSprites(x.id, insurgenceSprites(num, suffix));
  add({
    ...base,
    id: x.id,
    name: x.name,
    types: x.types,
    baseStats: stats,
    evolutionStage: base.evolutionStage,
    evolvesFrom: base.evolvesFrom,
    tags: [...base.tags.filter((t) => t !== 'delta'), 'delta'],
    form: { kind: x.kind, base: x.base },
    learnset: designedLearnset(base, x.types, stats),
    evolutions: [],
    assets: { ...art, cry: base.assets.cry },
  });
  // A variant of an evolved Pokémon is another branch of its pre-evolution (Delta Grimer -> any Delta Muk).
  if (base.evolvesFrom) addBranch(base.evolvesFrom, x.id, mirrorMethod(out.get(base.evolvesFrom) ?? speciesById.get(base.evolvesFrom), base));
}

/** Adds an evolution to `from` (a custom entry, or an existing species through customEvolutions.json). */
function addBranch(from: string, to: string, method: { level?: number; item?: string }) {
  const parent = out.get(from);
  if (parent) parent.evolutions.push({ to, ...method });
  else evolutionPatches.push({ from, to, ...method });
}

// ----------------------------------------------------- designed (Z, Spooky)

let nextDex = Math.max(...species.map((s) => s.dex)) + 1;
for (const x of design.designs) {
  const base = speciesById.get(x.base);
  if (!base) throw new Error(`${x.id}: unknown base ${x.base}`);
  const kind = x.kind ?? 'alternate';
  const stats: Stats = x.stats ?? (kind === 'mega' && !base.form ? megaStats(base.baseStats) : base.baseStats);
  const tag = x.id.endsWith('-spooky') ? 'spooky' : 'zform';
  const art = addSprites(x.id, { front: x.front, back: x.back, shiny: x.shiny, shinyBack: x.shinyBack, icon: x.icon });
  const entry: SpeciesOut = {
    id: x.id,
    dex: x.newSpecies ? nextDex++ : base.dex,
    name: x.name,
    generation: base.generation,
    types: x.types,
    baseStats: stats,
    catchRate: x.newSpecies ? Math.max(30, Math.round(base.catchRate / 2)) : base.catchRate,
    baseExp: x.newSpecies || kind === 'mega' ? Math.round(base.baseExp * 1.2) : base.baseExp,
    growthRate: base.growthRate,
    evolutionStage: base.evolutionStage,
    evolvesFrom: null,
    tags: [...base.tags, tag],
    ...(x.newSpecies ? {} : { form: { kind, base: x.megaOf ?? x.base } }),
    learnset: designedLearnset(base, x.types, stats),
    evolutions: [],
    assets: { ...art, cry: base.assets.cry },
  };
  // Forms whose pre-evolution has no Z/Spooky sprite are another branch of the normal one (Electabuzz -> Z-Electivire).
  const from: string | null = x.from ?? (kind === 'mega' ? null : base.evolvesFrom);
  if (from) {
    const parent = out.get(from);
    const method = x.evolveLevel ? { level: x.evolveLevel } : mirrorMethod(speciesById.get(parent?.form?.base ?? from), base);
    addBranch(from, x.id, method);
    entry.evolvesFrom = from;
    const parentEntry = (out.get(from) ?? speciesById.get(from))!;
    entry.evolutionStage = Math.min(3, parentEntry.evolutionStage + (parentEntry.tags.includes('baby') ? 0 : 1));
  }
  if (kind === 'mega') entry.evolutionStage = (out.get(x.megaOf) ?? speciesById.get(x.megaOf))!.evolutionStage;
  add(entry);
}

// The M- Megas.
const zFormsFiles = execFileSync('ls', [zipFile('Z-Forms')], { encoding: 'utf8' }).split('\n');
const backFiles = execFileSync('ls', [zipFile('Z-From BackSprites')], { encoding: 'utf8' }).split('\n');
// The sprite files' own spellings.
const FILE_NAMES: Record<string, string> = { typhlosion: 'TYPLHOSION', amoonguss: 'AMOONGUS' };
for (const [baseId, types] of Object.entries(design.megas).filter(([k]) => !k.startsWith('_')) as [string, string[]][]) {
  const base = speciesById.get(baseId)!;
  const upper = FILE_NAMES[baseId] ?? baseId.toUpperCase();
  const front = zFormsFiles.find((f) => f.toUpperCase() === `M-${upper}.PNG`);
  const back = backFiles.find((f) => f.toUpperCase() === `M-${upper} BACK.PNG`);
  if (!front) throw new Error(`no M- sprite for ${baseId}`);
  const id = `${baseId}-z-mega`;
  const stats = megaStats(base.baseStats);
  const art = addSprites(id, { front: `Z-Forms/${front}`, back: back ? `Z-From BackSprites/${back}` : undefined });
  add({
    ...base,
    id,
    name: `Z-Mega ${base.name}`,
    types,
    baseStats: stats,
    baseExp: Math.round(base.baseExp * 1.1),
    tags: [...base.tags, 'zform'],
    form: { kind: 'mega', base: baseId },
    learnset: designedLearnset(base, types, stats),
    evolutions: [],
    assets: { ...art, cry: base.assets.cry },
  });
}

// ---------------------------------------------------------------- output

const list = [...out.values()];
writeFileSync(join(dataDir, 'customSpecies.json'), JSON.stringify(list, null, 1) + '\n');
writeFileSync(join(dataDir, 'customEvolutions.json'), JSON.stringify(evolutionPatches, null, 2) + '\n');
writeFileSync(join(spriteDir, 'jobs.json'), JSON.stringify(jobs, null, 1));
execFileSync('python3', ['-I', join(import.meta.dirname, 'convert-custom-sprites.py'), zipRoot, join(spriteDir, 'jobs.json'), join(root, 'public', 'assets', 'images', 'pokemon')], { stdio: 'inherit' });

const counts = new Map<string, number>();
for (const s of list) for (const t of s.tags.filter((t) => ['delta', 'zform', 'spooky'].includes(t))) counts.set(t, (counts.get(t) ?? 0) + 1);
console.log(`Custom species/forms: ${list.length} (${[...counts].map(([k, v]) => `${v} ${k}`).join(', ')}); ${evolutionPatches.length} evolution(s) added to existing species.`);
console.log(`Insurgence moves the game doesn't have (dropped): ${unknownMoves.size} (${[...unknownMoves.keys()].slice(0, 30).join(', ')}…)`);
