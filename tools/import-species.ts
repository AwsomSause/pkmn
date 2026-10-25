// Rebuilds src/data/species.json with every Pokémon species and form, and
// writes src/data/learnables.json (egg and other learnable moves, for tools).
//
//   npm run data:species -- <move dataset folder> <images.zip> <audio.zip> [PokeAPI CSV folder]
//
// Sources:
// - PokeAPI's open data (CSV files from github.com/PokeAPI/pokeapi): names,
//   types, base stats, catch rates, experience, growth rates, evolutions,
//   legendary/mythical/baby flags and forms. Missing CSVs are downloaded into
//   the CSV folder (default: .cache/pokeapi) with curl.
// - The director's move dataset (SortedMoveset.html for level-up moves,
//   EggMoves.html and AllMoves.html for everything else).
// - The asset zips, to find each form's sprite, icon and cry file names
//   (PokeRogue names regional forms 2000+dex for Alola, 4000+ Galar, 6000+
//   Hisui, 8000+ Paldea, and other forms "<dex>-<form>").
//
// Evolution methods are turned into the game's rules (GAME_DESIGN.md §5c):
// level-ups stay level-ups; stones and other "use an item" evolutions use that
// item; trade evolutions use their held item or a Linking Cord; friendship
// evolutions use a Soothe Bell; methods the game has no equivalent for (steps
// walked, critical hits landed, ...) become a level, from the table below.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [datasetDir, imagesZip, audioZip, csvArg] = process.argv.slice(2);
if (!datasetDir || !imagesZip || !audioZip) {
  console.error('Usage: npm run data:species -- <move dataset folder> <images.zip> <audio.zip> [PokeAPI CSV folder]');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const dataDir = join(root, 'src', 'data');
const csvDir = csvArg ?? join(root, '.cache', 'pokeapi');

// ---------------------------------------------------------------- CSV input

const CSV_FILES = [
  'pokemon', 'pokemon_species', 'pokemon_stats', 'pokemon_types', 'pokemon_evolution', 'pokemon_forms',
  'pokemon_form_names', 'pokemon_species_names', 'items', 'version_groups', 'moves',
];

function ensureCsvs(): void {
  mkdirSync(csvDir, { recursive: true });
  for (const name of CSV_FILES) {
    const path = join(csvDir, `${name}.csv`);
    if (existsSync(path)) continue;
    console.log(`Downloading ${name}.csv from PokeAPI…`);
    execFileSync('curl', ['-sSfL', '-o', path, `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}.csv`]);
  }
}

/** Parses a CSV file (with quoted fields) into objects keyed by the header row. */
function readCsv(name: string): Record<string, string>[] {
  const text = readFileSync(join(csvDir, `${name}.csv`), 'utf8');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n') row.push(field.replace(/\r$/, '')), rows.push(row), (row = []), (field = '');
    else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ''])));
}

// ------------------------------------------------------------ sheet input

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

/** Spellings in the sheet that differ from the move list. */
const MOVE_SPELLINGS: Record<string, string> = { judgement: 'judgment', 'kowtow-kleave': 'kowtow-cleave', 'hydro-stream': 'hydro-steam' };
/** "Double-Edge" -> "double-edge", "King's Shield" -> "kings-shield" (the ids used in moves.json). */
const moveId = (name: string) => {
  const id = name
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return MOVE_SPELLINGS[id] ?? id;
};

function sheetRows(file: string): string[][] {
  const html = readFileSync(join(datasetDir!, file), 'utf8');
  return (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []).map((row) =>
    [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => decode(m[1] ?? '')),
  );
}

/** Words that differ between the sheet's and PokeAPI's form names ("Attack Forme Deoxys" / "Deoxys (Attack Forme)"). */
const FILLER = new Set(['form', 'forme', 'style', 'mode', 'cloak', 'breed', 'flower', 'the']);
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/♀/g, ' female ')
    .replace(/♂/g, ' male ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’.:()]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w))
    .sort()
    .join(' ');

type LearnsetEntry = { level: number; move: string };

/** Sheet name key -> level-up moves (SortedMoveset: dex, name, then level/move pairs). */
function readLevelUp(): Map<string, LearnsetEntry[]> {
  const sets = new Map<string, LearnsetEntry[]>();
  for (const cells of sheetRows('SortedMoveset.html')) {
    const name = cells[2];
    if (!name || !/^\d+$/.test(cells[1] ?? '')) continue;
    const learnset: LearnsetEntry[] = [];
    for (let i = 4; i + 1 < cells.length; i += 2) {
      const level = Number(cells[i]);
      const move = cells[i + 1];
      if (move && Number.isInteger(level) && level >= 1) learnset.push({ level: Math.min(level, 100), move: moveId(move) });
    }
    if (!sets.has(nameKey(name))) sets.set(nameKey(name), learnset);
  }
  return sets;
}

/** Sheet name key -> egg moves (EggMoves: dex, name, then move names). */
function readEggMoves(): Map<string, string[]> {
  const sets = new Map<string, string[]>();
  for (const cells of sheetRows('EggMoves.html')) {
    const name = cells[2];
    if (!name || !/^\d+$/.test(cells[1] ?? '')) continue;
    if (!sets.has(nameKey(name))) sets.set(nameKey(name), cells.slice(4).filter(Boolean).map(moveId));
  }
  return sets;
}

/** Sheet name key -> every learnable move (AllMoves: a y/blank grid under a header row of move names). */
function readAllMoves(): Map<string, string[]> {
  const rows = sheetRows('AllMoves.html');
  const header = rows.find((r) => r[0] === '1' && !r[2]) ?? [];
  const sets = new Map<string, string[]>();
  for (const cells of rows) {
    const name = cells[2];
    if (!name || !/^\d+$/.test(cells[1] ?? '')) continue;
    const moves = cells.flatMap((v, i) => (i >= 4 && v.toLowerCase() === 'y' && header[i] ? [moveId(header[i]!)] : []));
    if (!sets.has(nameKey(name))) sets.set(nameKey(name), moves);
  }
  return sets;
}

// ------------------------------------------------------------ asset input

function listZip(zip: string): Set<string> {
  const out = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return new Set(out.split('\n').filter((l) => l && !l.startsWith('__MACOSX/')));
}

// ------------------------------------------------------------ the rules

/** Non-default Pokémon left out: cosmetic copies, totems, costume Pikachu, ability variants, Minior's cores. */
const EXCLUDED = /-totem|-cap$|-cosplay$|^pikachu-(rock-star|belle|pop-star|phd|libre|starter)$|^eevee-starter$|-power-construct$|-battle-bond$|^minior-/;
/** Forms that only exist during a battle (besides those PokeAPI marks as battle-only). */
const BATTLE_FORMS = new Set(['eternatus-eternamax']);
/** Forms merged into another for evolution purposes (identical Pokémon). */
const SAME_AS: Record<string, string> = { 'rockruff-own-tempo': 'rockruff' };
const REGION_SUFFIX: Record<string, { region: string; prefix: number; generation: number }> = {
  alola: { region: 'alola', prefix: 2000, generation: 7 },
  galar: { region: 'galar', prefix: 4000, generation: 8 },
  // Hisui (Legends: Arceus) is ancient Sinnoh.
  hisui: { region: 'sinnoh', prefix: 6000, generation: 8 },
  paldea: { region: 'paldea', prefix: 8000, generation: 9 },
};
/** PokeAPI region ids used by regional evolutions (e.g. Pikachu -> Alolan Raichu in Alola). */
const REGION_IDS: Record<string, string> = { '7': 'alola', '8': 'galar', '9': 'sinnoh' };
const GROWTH: Record<string, string> = {
  '1': 'slow', '2': 'medium-fast', '3': 'fast', '4': 'medium-slow', '5': 'erratic', '6': 'fluctuating',
};
/** Sprite names PokeRogue uses for some PokeAPI form names. */
const SPRITE_FORM: Record<string, string> = {
  gmax: 'gigantamax', 'amped-gmax': 'gigantamax', 'low-key-gmax': 'gigantamax', 'single-strike-gmax': 'gigantamax-single',
  'rapid-strike-gmax': 'gigantamax-rapid', 'low-key': 'lowkey', 'pom-pom': 'pompom', dusk: 'dusk', dawn: 'dawn-wings',
  'family-of-four': 'four', 'family-of-three': 'three', 'two-segment': '', 'three-segment': 'three-segment',
  'galar-standard': '', 'galar-zen': 'zen', 'paldea-combat-breed': '', 'paldea-blaze-breed': 'blaze', 'paldea-aqua-breed': 'aqua',
  'female': 'female', 'male': '', 'red-striped': 'red-striped', super: 'jumbo', noice: 'no-ice',
};
/** Names the director's sheet uses that no rule can work out. */
const SHEET_NAMES: Record<string, string> = { basculin: 'Red/Blue Striped Basculin' };
/** Sprites that don't follow any naming rule. */
const SPRITE_OVERRIDE: Record<string, string> = {
  'greninja-ash': '2658', 'necrozma-dusk': '800-dusk-mane', 'necrozma-dawn': '800-dawn-wings', ogerpon: '1017-teal-mask',
  'ursaluna-bloodmoon': '8901', 'floette-eternal': '2670',
};
/** Evolutions that need something the game doesn't have (steps, critical hits, ...): the level used instead. */
const LEVEL_INSTEAD: Record<string, number> = {
  sirfetchd: 30, runerigus: 34, wyrdeer: 31, basculegion: 36, 'basculegion-female': 36, annihilape: 35, kingambit: 52,
  gholdengo: 40, melmetal: 48, pawmot: 32, brambleghast: 30, rabsca: 30, mantine: 30, palafin: 38, maushold: 25,
  overqwil: 31, farigiraf: 32, dudunsparce: 32, hydrapple: 45, tsareena: 29, naganadel: 40, grapploct: 35,
};
/** The game has no gender, time of day or weather, so these evolution conditions are ignored. */
const IGNORED_CONDITIONS = [
  'gender_id', 'time_of_day', 'party_type_id', 'party_species_id', 'needs_overworld_rain', 'turn_upside_down',
  'needs_multiplayer', 'nature_bitmask', 'condition_expression', 'percentage_chance', 'location_id', 'near_special_rock',
  'minimum_damage_taken', 'minimum_steps', 'used_move_id', 'minimum_move_count', 'trade_species_id',
];

type FormKind = 'regional' | 'alternate' | 'mega' | 'gigantamax' | 'primal' | 'battle';
type Evolution = { to: string; level?: number; item?: string; region?: string; condition?: string };
interface SpeciesOut {
  id: string;
  dex: number;
  name: string;
  generation: number;
  types: string[];
  baseStats: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  catchRate: number;
  baseExp: number;
  growthRate: string;
  evolutionStage: number;
  evolvesFrom: string | null;
  tags: string[];
  form?: { kind: FormKind; base: string; region?: string };
  learnset: LearnsetEntry[];
  evolutions: Evolution[];
  assets: { sprite: string; icon: string; cry: string };
}

ensureCsvs();
const pokemonRows = readCsv('pokemon');
const speciesRows = new Map(readCsv('pokemon_species').map((r) => [r.id!, r]));
const formRows = readCsv('pokemon_forms');
const itemIds = new Map(readCsv('items').map((r) => [r.id!, r.identifier!]));
const moveIds = new Map(readCsv('moves').map((r) => [r.id!, r.identifier!]));
const versionGen = new Map(readCsv('version_groups').map((r) => [r.id!, Number(r.generation_id)]));
const englishSpecies = new Map(readCsv('pokemon_species_names').filter((r) => r.local_language_id === '9').map((r) => [r.pokemon_species_id!, r.name!]));
const englishForms = new Map(readCsv('pokemon_form_names').filter((r) => r.local_language_id === '9').map((r) => [r.pokemon_form_id!, r]));
const STAT_KEYS: Record<string, keyof SpeciesOut['baseStats']> = { '1': 'hp', '2': 'atk', '3': 'def', '4': 'spa', '5': 'spd', '6': 'spe' };
const stats = new Map<string, SpeciesOut['baseStats']>();
for (const r of readCsv('pokemon_stats')) {
  const key = STAT_KEYS[r.stat_id!];
  if (!key) continue;
  const block = stats.get(r.pokemon_id!) ?? ({} as SpeciesOut['baseStats']);
  block[key] = Number(r.base_stat);
  stats.set(r.pokemon_id!, block);
}
const types = new Map<string, string[]>();
const TYPE_NAMES = ['', 'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];
for (const r of readCsv('pokemon_types').sort((a, b) => Number(a.slot) - Number(b.slot))) {
  types.set(r.pokemon_id!, [...(types.get(r.pokemon_id!) ?? []), TYPE_NAMES[Number(r.type_id)]!]);
}
const defaultFormOf = new Map(formRows.filter((f) => f.is_default === '1').map((f) => [f.pokemon_id!, f]));
const formById = new Map(formRows.map((f) => [f.id!, f]));
const formByIdentifier = new Map(formRows.map((f) => [f.identifier!, f]));

const levelUp = readLevelUp();
const eggMoves = readEggMoves();
const allMoves = readAllMoves();
const images = listZip(imagesZip);
const audio = listZip(audioZip);
const supportedMoves = JSON.parse(readFileSync(join(dataDir, 'moves.json'), 'utf8')) as { id: string; supported?: boolean }[];
const knownMoves = new Set(supportedMoves.map((m) => m.id));

const evolutionForms = new Set(
  readCsv('pokemon_evolution').flatMap((r) => [r.required_pokemon_form_id, r.evolved_pokemon_form_id].filter(Boolean).map((f) => formById.get(f!)?.pokemon_id)),
);
/** A form with the same types and stats as its species that nothing evolves from or into (Koraidon's builds, Squawkabilly's colours). */
function isCosmetic(p: Record<string, string>): boolean {
  if (/-(alola|galar|hisui|paldea)/.test(p.identifier!) || evolutionForms.has(p.id!) || formKind(p) !== 'alternate') return false;
  const base = defaultPokemonOfSpecies.get(p.species_id!) ?? pokemonRows.find((q) => q.species_id === p.species_id && q.is_default === '1')?.id;
  if (!base) return false;
  return JSON.stringify(types.get(p.id!)) === JSON.stringify(types.get(base)) && JSON.stringify(stats.get(p.id!)) === JSON.stringify(stats.get(base));
}

// Pick the Pokémon to include and give each its id.
const idOfPokemon = new Map<string, string>(); // PokeAPI pokemon id -> species id in the game
const defaultPokemonOfSpecies = new Map<string, string>();
const included: Record<string, string>[] = [];
for (const p of pokemonRows) {
  const species = speciesRows.get(p.species_id!)!;
  if (p.is_default === '1') {
    defaultPokemonOfSpecies.set(p.species_id!, p.id!);
    idOfPokemon.set(p.id!, species.identifier!);
    included.push(p);
  } else if (!EXCLUDED.test(p.identifier!) && !SAME_AS[p.identifier!] && !isCosmetic(p)) {
    idOfPokemon.set(p.id!, p.identifier!);
    included.push(p);
  }
}
const pokemonByIdentifier = new Map(pokemonRows.map((p) => [p.identifier!, p]));
for (const [from, to] of Object.entries(SAME_AS)) idOfPokemon.set(pokemonByIdentifier.get(from)!.id!, to);
/** The game species a PokeAPI form belongs to (cosmetic forms count as their Pokémon's default). */
function speciesOfForm(formId: string): string | undefined {
  const form = formById.get(formId);
  if (!form) return undefined;
  const direct = idOfPokemon.get(form.pokemon_id!);
  if (direct) return direct;
  const pokemon = pokemonRows.find((p) => p.id === form.pokemon_id);
  return pokemon ? idOfPokemon.get(defaultPokemonOfSpecies.get(pokemon.species_id!)!) : undefined;
}

function formKind(p: Record<string, string>): FormKind | null {
  if (p.is_default === '1') return null;
  const form = defaultFormOf.get(p.id!);
  const suffix = p.identifier!.slice(speciesRows.get(p.species_id!)!.identifier!.length + 1);
  if (form?.is_mega === '1') return 'mega';
  if (suffix.endsWith('gmax')) return 'gigantamax';
  if (suffix === 'primal') return 'primal';
  if (form?.is_battle_only === '1' || BATTLE_FORMS.has(p.identifier!)) return 'battle';
  if (Object.keys(REGION_SUFFIX).some((r) => suffix === r || suffix.startsWith(`${r}-`))) return 'regional';
  return 'alternate';
}

const missingArt: string[] = [];
const sharedArt: string[] = [];
const defaultSpriteOf = new Map<string, string>();
function spriteKey(p: Record<string, string>, dex: number): string {
  const speciesIdentifier = speciesRows.get(p.species_id!)!.identifier!;
  const suffix = p.identifier!.slice(speciesIdentifier.length + 1);
  const candidates: string[] = [];
  const region = Object.entries(REGION_SUFFIX).find(([r]) => suffix === r || suffix.startsWith(`${r}-`));
  const override = SPRITE_OVERRIDE[p.identifier!] ?? (p.is_default === '1' ? SPRITE_OVERRIDE[speciesIdentifier] : undefined);
  if (override) candidates.push(override);
  if (region) {
    const base = String(region[1].prefix + dex);
    const rest = SPRITE_FORM[suffix] ?? suffix.slice(region[0].length + 1);
    if (p.identifier === 'darmanitan-galar-zen') candidates.push(`${base}-zen`);
    candidates.push(rest ? `${base}-${rest}` : base, base);
  } else if (suffix && p.is_default !== '1') {
    const mapped = SPRITE_FORM[suffix] ?? suffix;
    // PokeRogue writes "978-mega-curly" for PokeAPI's "tatsugiri-curly-mega".
    if (suffix.endsWith('-mega')) candidates.push(`${dex}-mega-${suffix.slice(0, -'-mega'.length)}`);
    candidates.push(`${dex}-${mapped}`, `${dex}-${suffix}`, `${dex}-${suffix.replace(/-/g, '')}`);
    if (!mapped) candidates.push(String(dex));
  } else {
    candidates.push(String(dex));
    // Some species only have art for their named default form (e.g. 412-plant).
    const formIdentifier = defaultFormOf.get(p.id!)?.form_identifier;
    if (formIdentifier) candidates.push(`${dex}-${SPRITE_FORM[formIdentifier] || formIdentifier}`);
  }
  // A form without its own art uses its species' art.
  candidates.push(String(dex));
  const defaultSprite = defaultSpriteOf.get(p.species_id!);
  if (defaultSprite) candidates.push(defaultSprite);
  const found = candidates.find((c) => images.has(`images/pokemon/${c}.png`) && images.has(`images/pokemon/${c}.json`));
  if (!found) missingArt.push(`${p.identifier} (tried ${[...new Set(candidates)].join(', ')})`);
  else if ((found === String(dex) || found === defaultSprite) && candidates[0] !== found) sharedArt.push(p.identifier!);
  if (p.is_default === '1' && found) defaultSpriteOf.set(p.species_id!, found);
  return found ?? candidates[0]!;
}

function iconOf(key: string): string {
  for (let gen = 1; gen <= 9; gen++) if (images.has(`images/pokemon/icons/${gen}/${key}.png`)) return `${gen}/${key}`;
  return `0/${key}`;
}

function cryOf(key: string, dex: number): string {
  return audio.has(`audio/cry/${key}.m4a`) ? key : String(dex);
}

// Build every species entry (evolutions come after).
const out = new Map<string, SpeciesOut>();
const pokemonIdOf = new Map<string, string>();
const notInSheet: string[] = [];
const unknownMoves = new Map<string, string[]>();
const learnables: Record<string, { egg: string[]; other: string[] }> = {};
for (const p of included) {
  const id = idOfPokemon.get(p.id!)!;
  const species = speciesRows.get(p.species_id!)!;
  const dex = Number(p.species_id);
  const kind = formKind(p);
  const baseId = species.identifier!;
  const formInfo = defaultFormOf.get(p.id!);
  const formNames = formInfo ? englishForms.get(formInfo.id!) : undefined;
  const speciesName = englishSpecies.get(p.species_id!) ?? baseId;
  let name = speciesName;
  if (kind) name = formNames?.pokemon_name || (formNames?.form_name ? `${speciesName} (${formNames.form_name})` : speciesName);
  const suffix = p.identifier!.slice(baseId.length + 1);
  const regional = kind === 'regional' ? Object.entries(REGION_SUFFIX).find(([r]) => suffix === r || suffix.startsWith(`${r}-`))?.[1] : undefined;
  const introduced = formInfo ? versionGen.get(formInfo.introduced_in_version_group_id!) : undefined;
  const generation = regional?.generation ?? (kind ? introduced : undefined) ?? Number(species.generation_id);

  // Level-up moves from the director's sheet; forms the sheet doesn't list use their base form's moves.
  const sheetKeys = [
    SHEET_NAMES[id] ?? '', name, formNames?.pokemon_name ?? '', `${formNames?.form_name ?? ''} ${speciesName}`, speciesName,
  ].filter(Boolean).map(nameKey);
  let sheetKey = sheetKeys.find((k) => levelUp.has(k));
  if (!sheetKey) {
    if (!kind) notInSheet.push(name);
    sheetKey = nameKey(speciesName);
  }
  const rawLearnset = levelUp.get(sheetKey) ?? [];
  const seen = new Set<string>();
  const learnset = rawLearnset
    .filter((e) => {
      if (knownMoves.has(e.move)) return true;
      unknownMoves.set(e.move, [...(unknownMoves.get(e.move) ?? []), name]);
      return false;
    })
    .sort((a, b) => a.level - b.level)
    .filter((e) => (seen.has(e.move) ? false : (seen.add(e.move), true)));
  const levelUpMoves = new Set(learnset.map((e) => e.move));
  const egg = (eggMoves.get(sheetKey) ?? []).filter((m) => knownMoves.has(m));
  const other = (allMoves.get(sheetKey) ?? []).filter((m) => knownMoves.has(m) && !levelUpMoves.has(m) && !egg.includes(m));
  learnables[id] = { egg, other };

  const sprite = spriteKey(p, dex);
  const defaultPokemon = pokemonRows.find((q) => q.id === defaultPokemonOfSpecies.get(p.species_id!));
  const tags: string[] = [];
  if (species.is_baby === '1') tags.push('baby');
  if (species.is_legendary === '1') tags.push('legendary');
  if (species.is_mythical === '1') tags.push('mythical');
  const entry: SpeciesOut = {
    id,
    dex,
    name,
    generation,
    types: types.get(p.id!)!,
    baseStats: stats.get(p.id!)!,
    catchRate: Math.max(1, Number(species.capture_rate) || 45),
    baseExp: Number(p.base_experience) || Number(defaultPokemon?.base_experience) || 100,
    growthRate: GROWTH[species.growth_rate_id!]!,
    evolutionStage: 1,
    evolvesFrom: null,
    tags,
    ...(kind ? { form: { kind, base: baseId, ...(regional ? { region: regional.region } : {}) } } : {}),
    learnset,
    evolutions: [],
    assets: { sprite, icon: iconOf(sprite), cry: cryOf(sprite, dex) },
  };
  out.set(id, entry);
  pokemonIdOf.set(id, p.id!);
}

// Evolutions.
interface EvoRow { row: Record<string, string>; from: string; to: string }
const evoRows: EvoRow[] = [];
const unmapped: string[] = [];
for (const r of readCsv('pokemon_evolution')) {
  const evolvedSpecies = speciesRows.get(r.evolved_species_id!)!;
  const fromSpecies = evolvedSpecies.evolves_from_species_id!;
  const to = r.evolved_pokemon_form_id ? speciesOfForm(r.evolved_pokemon_form_id) : idOfPokemon.get(defaultPokemonOfSpecies.get(evolvedSpecies.id!)!);
  const from = r.required_pokemon_form_id ? speciesOfForm(r.required_pokemon_form_id) : idOfPokemon.get(defaultPokemonOfSpecies.get(fromSpecies)!);
  if (!to || !from || !out.has(to) || !out.has(from)) {
    unmapped.push(`${evolvedSpecies.identifier} (row ${r.id})`);
    continue;
  }
  evoRows.push({ row: r, from, to });
}

/** The level at which `speciesId` learns `move`, or undefined. */
const learnLevel = (speciesId: string, move: string | undefined) =>
  move ? out.get(speciesId)!.learnset.find((e) => e.move === move)?.level : undefined;

const noEquivalent: string[] = [];
function methodOf({ row: r, from, to }: EvoRow): Evolution | null {
  const trigger = r.evolution_trigger_id;
  const item = r.trigger_item_id ? itemIds.get(r.trigger_item_id) : undefined;
  const held = r.held_item_id ? itemIds.get(r.held_item_id) : undefined;
  const region = r.region_id ? REGION_IDS[r.region_id] : undefined;
  const base: Evolution = { to, ...(region ? { region } : {}) };
  if (trigger === '3' && item) return { ...base, item };
  if (trigger === '2') return { ...base, item: held ?? 'linking-cord' };
  if (trigger === '5' && held) return { ...base, item: held }; // Alcremie: spin while holding a Sweet
  if (held) return { ...base, item: held }; // e.g. Sneasel holding a Razor Claw
  if (r.minimum_level) {
    const condition = r.relative_physical_stats === '1' ? 'atkGtDef' : r.relative_physical_stats === '-1' ? 'atkLtDef' : r.relative_physical_stats === '0' ? 'atkEqDef' : undefined;
    return { ...base, level: Number(r.minimum_level), ...(condition ? { condition } : {}) };
  }
  if (r.minimum_happiness || r.minimum_affection || r.minimum_beauty) return { ...base, item: 'soothe-bell' };
  const moveLevel = learnLevel(from, r.known_move_id ? moveIds.get(r.known_move_id) : undefined);
  if (moveLevel) return { ...base, level: Math.max(2, moveLevel) };
  const instead = LEVEL_INSTEAD[to] ?? LEVEL_INSTEAD[out.get(to)!.form?.base ?? ''];
  if (instead) return { ...base, level: instead };
  noEquivalent.push(`${from}>${to}`, `${from} -> ${to} (trigger ${trigger}${IGNORED_CONDITIONS.filter((c) => r[c] && r[c] !== '0').map((c) => `, ${c}`).join('')})`);
  return null;
}

// One method per (from, to): prefer an item over friendship, a newer method over an older one for the same kind.
const byPair = new Map<string, Evolution>();
for (const e of evoRows) {
  const method = methodOf(e);
  if (!method) continue;
  const key = `${e.from}>${e.to}`;
  const prev = byPair.get(key);
  const rank = (m: Evolution) => (m.item && m.item !== 'soothe-bell' && m.item !== 'linking-cord' ? 3 : m.level ? 2 : 1);
  if (!prev || rank(method) > rank(prev)) byPair.set(key, method);
}
for (const [key, method] of byPair) {
  const from = key.split('>')[0]!;
  const species = out.get(from)!;
  if (!species.evolutions.some((e) => e.to === method.to)) species.evolutions.push(method);
}
for (const s of out.values()) for (const e of s.evolutions) out.get(e.to)!.evolvesFrom ??= s.id;
// Forms the sheet has no moves for (Mega Meowstic, Gigantamax Toxtricity, ...) use their base form's moves.
for (const s of out.values()) if (s.learnset.length === 0 && s.form) s.learnset = out.get(s.form.base)!.learnset;
// Forms (megas etc.) count as their base species for evolution stage purposes.
for (const s of out.values()) {
  if (s.form && s.form.kind !== 'regional' && s.form.kind !== 'alternate') s.evolvesFrom = out.get(s.form.base)!.evolvesFrom;
}
// Evolution stage: 1 = no pre-evolution. Babies don't count, so Pikachu (from Pichu) is still stage 1.
const stageOf = (s: SpeciesOut, guard = 0): number => {
  if (!s.evolvesFrom || guard > 3) return 1;
  const pre = out.get(s.evolvesFrom)!;
  return pre.tags.includes('baby') ? stageOf(pre, guard + 1) : stageOf(pre, guard + 1) + 1;
};
for (const s of out.values()) s.evolutionStage = Math.min(3, stageOf(s));

const list = [...out.values()].sort((a, b) => a.dex - b.dex || Number(pokemonIdOf.get(a.id)) - Number(pokemonIdOf.get(b.id)));
writeFileSync(join(dataDir, 'species.json'), JSON.stringify(list, null, 1) + '\n');
writeFileSync(join(dataDir, 'learnables.json'), JSON.stringify(learnables) + '\n');

const kinds = new Map<string, number>();
for (const s of list) kinds.set(s.form?.kind ?? 'species', (kinds.get(s.form?.kind ?? 'species') ?? 0) + 1);
console.log(`Wrote ${list.length} species and forms: ${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}.`);
const usedItems = new Set(list.flatMap((s) => s.evolutions.flatMap((e) => (e.item ? [e.item] : []))));
console.log(`Evolution items: ${[...usedItems].sort().join(', ')}`);
if (notInSheet.length) console.log(`Not in the move sheet (no level-up moves): ${notInSheet.join(', ')}`);
if (sharedArt.length) console.log(`Forms using their species' art (no art of their own): ${sharedArt.join(', ')}`);
if (missingArt.length) console.log(`No sprite found for ${missingArt.length}:\n  ${missingArt.join('\n  ')}`);
// Only report evolutions that no other row gave a method (Magnezone's magnetic field has a Thunder Stone row too).
const leftOut = noEquivalent.filter((_, i) => i % 2 === 1 && !byPair.has(noEquivalent[i - 1]!));
if (leftOut.length) console.log(`Evolutions with no game equivalent (left out):\n  ${[...new Set(leftOut)].join('\n  ')}`);
if (unmapped.length) console.log(`Evolution rows for left-out forms: ${unmapped.length}`);
const top = [...unknownMoves].sort((a, b) => b[1].length - a[1].length);
if (top.length) console.log(`${top.length} sheet moves are not in moves.json (left out): ${top.map(([m, w]) => `${m} (${w.length})`).join(', ')}`);
