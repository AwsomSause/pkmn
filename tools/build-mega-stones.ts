// Builds src/data/megaStones.json: one Mega Stone item (and its reward-draft
// entry) for every Mega form in the game, plus the Red and Blue Orbs for the
// Primal forms (Milestone 8.5, Mega Evolution).
//
//   npm run data:megas -- <images.zip>
//
// Sources:
// - Pokémon Showdown's item data (github.com/smogon/pokemon-showdown,
//   data/items.ts, MIT), downloaded into .cache/showdown with curl. It names
//   the stone for every official Mega, including the Legends: Z-A ones.
// - The game's own species (species.json + customSpecies.json).
// - images.zip, only to check which stone icons exist (images/items/*.png).
//
// Rules (GAME_DESIGN.md §5f):
// - Official Megas use Showdown's stone ("Charizardite X": charizard -> charizard-mega-x).
// - Mega Rayquaza needs Dragon Ascent in the main games; here it uses a
//   Rayquazite like PokeRogue (the asset pack has its icon).
// - Delta Megas use "Delta <stone>", Z-Megas "<stone> Z", where <stone> is the
//   official stone of the base species, or "<Name>ite" when there is none.
// - The icon is the stone's own when the pack has it, otherwise the base
//   species' official stone, otherwise a generic Mega Stone look.
// - Megas no Pokémon can reach (Magearna's Original Color has no base form
//   here, the Delta Typhlosion "active" battle form) get no stone and are
//   listed at the end of the run.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const imagesZip = process.argv[2];
if (!imagesZip || !existsSync(imagesZip)) {
  console.error('Usage: npm run data:megas -- <images.zip>');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const cacheDir = join(root, '.cache', 'showdown');
const itemsTs = join(cacheDir, 'items.ts');
if (!existsSync(itemsTs)) {
  mkdirSync(cacheDir, { recursive: true });
  execFileSync('curl', ['-sSfL', '-o', itemsTs, 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/items.ts']);
}

interface SpeciesEntry {
  id: string;
  name: string;
  tags: string[];
  form?: { kind: string; base: string };
}
const species: SpeciesEntry[] = [
  ...JSON.parse(readFileSync(join(dataDir, 'species.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(dataDir, 'customSpecies.json'), 'utf8')),
];
const byId = new Map(species.map((s) => [s.id, s]));

const icons = new Set(
  execFileSync('unzip', ['-Z1', imagesZip], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter((l) => l.startsWith('images/items/') && l.endsWith('.png'))
    .map((l) => l.slice('images/items/'.length, -'.png'.length)),
);

/** Showdown species names -> this game's ids. */
const ALIASES: Record<string, string> = {
  'meowstic-m-mega': 'meowstic-male-mega',
  'meowstic-f-mega': 'meowstic-female-mega',
  'meowstic-f': 'meowstic-female',
};
const toId = (showdownName: string): string => {
  const id = showdownName.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return ALIASES[id] ?? id;
};
const snake = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const kebab = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// 1. Official stones from Showdown: `name: "Charizardite X", ... megaStone: { "Charizard": "Charizard-Mega-X" }`.
const source = readFileSync(itemsTs, 'utf8');
const official: { name: string; forms: Record<string, string> }[] = [];
for (const block of source.split(/\n\t(?=[a-z0-9]+: \{)/)) {
  const name = /\n\t\tname: "([^"]+)"/.exec(block)?.[1];
  const mega = /\n\t\tmegaStone: \{([^}]*)\}/.exec(block)?.[1];
  if (!name || !mega) continue;
  const forms: Record<string, string> = {};
  for (const [, from, to] of mega.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    const fromId = toId(from!);
    const toIdValue = toId(to!);
    if (byId.has(fromId) && byId.get(toIdValue)?.form?.kind === 'mega') forms[fromId] = toIdValue;
  }
  if (Object.keys(forms).length > 0) official.push({ name, forms });
}
/** Official stone name for a Mega form id ("venusaur-mega" -> "Venusaurite"). */
const stoneOfMega = new Map<string, string>();
for (const s of official) for (const to of Object.values(s.forms)) stoneOfMega.set(to, s.name);
/** Official stone name for a base species ("venusaur" -> "Venusaurite"; the first one for Charizard/Mewtwo). */
const stoneOfBase = new Map<string, string>();
for (const s of official) for (const from of Object.keys(s.forms)) if (!stoneOfBase.has(from)) stoneOfBase.set(from, s.name.replace(/ [XYZ]$/, ''));

interface Stone {
  name: string;
  forms: Record<string, string>;
  primal?: boolean;
  iconHint: string[];
}
const stones: Stone[] = official.map((s) => ({ name: s.name, forms: s.forms, iconHint: [snake(s.name)] }));

const madeUpStone = (speciesName: string) => `${speciesName.replace(/^(Delta|Mega) /, '').replace(/[aeiou]$/i, '')}ite`;
const baseName = (id: string) => byId.get(id)?.name ?? id;
const unreachable: string[] = [];

// 2. Every other Mega form in the game.
for (const s of species) {
  if (s.form?.kind !== 'mega' || stoneOfMega.has(s.id)) continue;
  const from = s.form.base;
  if (!byId.has(from)) {
    unreachable.push(`${s.id} (no base form "${from}")`);
    continue;
  }
  if (s.id === 'rayquaza-mega') {
    stones.push({ name: 'Rayquazite', forms: { [from]: s.id }, iconHint: ['rayquazite'] });
    continue;
  }
  // The plain species these designs come from: "venusaur-delta" -> "venusaur", "alakazam-z" -> "alakazam".
  const plain = from.replace(/-(delta|z)(-.*)?$/, '');
  const officialStone = stoneOfBase.get(plain);
  const core = officialStone ?? madeUpStone(baseName(plain));
  if (s.tags.includes('delta')) {
    const variant = /-delta-(spider|ruin)$/.exec(from)?.[1];
    const name = `${variant ? `${variant[0]!.toUpperCase()}${variant.slice(1)} ` : ''}Delta ${core}`;
    stones.push({ name, forms: { [from]: s.id }, iconHint: [snake(core), `${snake(core)}_x`] });
  } else if (s.tags.includes('zform')) {
    stones.push({ name: `${core} Z`, forms: { [from]: s.id }, iconHint: [`${snake(core)}_z`, snake(core), `${snake(core)}_x`] });
  } else {
    unreachable.push(`${s.id} (no stone rule)`);
  }
}

// 3. Primal Reversion: the Red and Blue Orbs (automatic, no Mega Ring needed).
for (const [name, base] of [
  ['Red Orb', 'groudon'],
  ['Blue Orb', 'kyogre'],
] as const) {
  const primal = `${base}-primal`;
  if (byId.has(base) && byId.has(primal)) stones.push({ name, forms: { [base]: primal }, primal: true, iconHint: [snake(name)] });
}

// 4. Make sure every Mega the game has is covered (or listed as unreachable).
const covered = new Set(stones.flatMap((s) => Object.values(s.forms)));
for (const s of species) {
  if (s.form?.kind === 'mega' && !covered.has(s.id) && !unreachable.some((u) => u.startsWith(`${s.id} `))) unreachable.push(`${s.id} (not mapped)`);
}

const FALLBACK_ICON = 'meganiumite';
const items = stones.map((s) => {
  const icon = s.iconHint.find((h) => icons.has(h)) ?? FALLBACK_ICON;
  const users = Object.keys(s.forms).map(baseName);
  const description = s.primal
    ? `Lets ${users.join(' or ')} undergo Primal Reversion as it enters battle.`
    : `Lets ${users.join(' or ')} Mega Evolve in battle (needs the Mega Ring).`;
  return {
    id: kebab(s.name),
    name: s.name,
    description,
    category: 'transformation',
    iconAssetId: `item.${icon}`,
    usableInBattle: false,
    usableOutside: false,
    target: 'none',
    effect: { kind: 'megaStone', forms: s.forms, primal: s.primal ?? false },
  };
});
const rewards = items.map((item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  category: 'transformation',
  rarity: 'rare',
  effect: { kind: 'addItem', item: item.id, quantity: 1 },
  stacking: 'instant',
  scope: 'run',
  moneyMultiplierApplies: false,
  iconAssetId: item.iconAssetId,
}));

const ids = new Set<string>();
for (const item of items) {
  if (ids.has(item.id)) throw new Error(`Duplicate stone id ${item.id}`);
  ids.add(item.id);
}
writeFileSync(join(dataDir, 'megaStones.json'), `${JSON.stringify({ items, rewards }, null, 1)}\n`);
console.log(`Wrote ${items.length} stones (${official.length} official, ${items.filter((i) => i.iconAssetId === `item.${FALLBACK_ICON}`).length} with the fallback icon).`);
if (unreachable.length) console.log(`No stone (unreachable):\n  ${unreachable.join('\n  ')}`);
