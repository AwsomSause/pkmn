// Writes src/data/legendaryEvents.json: the events and their finale Totems (merged into expeditions and totems when content loads).
// Every Legendary and Mythical gets a world event: hand-designed ones (tools/legendary/bespoke.ts) and a type-themed
// template for the rest. Run with: npm run data:legendary-events
import { readFileSync, writeFileSync } from 'node:fs';
import { BESPOKE } from './legendary/bespoke.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
const speciesFile = read('species.json');
const species: any[] = Array.isArray(speciesFile) ? speciesFile : speciesFile.species;
const byId = new Map<string, any>(species.map((s) => [s.id, s]));

interface TypeKit { word: string; weather?: string; terrain?: string; env: string; deep: string; affinity: string[]; peril: string[]; tint: string; accent: string; time?: string[]; distort?: boolean; wildTypes: string[]; motif: string; phase: string }
const KITS: Record<string, TypeKit> = {
  normal: { word: 'Quiet Meadow', env: 'The air is calm and bright.', deep: 'The calm turns uneasy.', affinity: ['normal'], peril: ['ghost'], tint: '#7a7a5c', accent: '#f0f0d0', wildTypes: ['normal'], motif: 'open meadows', phase: 'The stillness breaks.' },
  fire: { word: 'Burning Ground', weather: 'sun', env: 'Harsh sunlight beats down on every fight.', deep: 'The heat becomes unbearable.', affinity: ['fire'], peril: ['ice', 'grass'], tint: '#a8341d', accent: '#ffc66f', time: ['day', 'eve'], wildTypes: ['fire'], motif: 'embers and ash', phase: 'The flames flare.' },
  water: { word: 'Rising Tide', weather: 'rain', env: 'Rain falls on every fight.', deep: 'The water keeps rising.', affinity: ['water'], peril: ['fire'], tint: '#1d4f9c', accent: '#6fd0ff', wildTypes: ['water'], motif: 'flooded paths', phase: 'A wave rolls through.' },
  electric: { word: 'Static Storm', terrain: 'electric', env: 'Electricity crackles over the stage.', deep: 'The charge keeps building.', affinity: ['electric'], peril: ['water'], tint: '#8a7a1f', accent: '#fff27a', wildTypes: ['electric'], motif: 'storm and wire', phase: 'The charge spikes.' },
  grass: { word: 'Overgrowth', terrain: 'grassy', env: 'The stage is overgrown; grassy terrain covers it.', deep: 'The vines close in.', affinity: ['grass'], peril: ['fire'], tint: '#2f7a2f', accent: '#b8ff8a', wildTypes: ['grass'], motif: 'tangled forest', phase: 'The roots surge.' },
  ice: { word: 'Deep Freeze', weather: 'snow', env: 'Snow falls over every fight.', deep: 'A whiteout closes in.', affinity: ['ice'], peril: ['fire', 'grass'], tint: '#4a86b0', accent: '#e8faff', wildTypes: ['ice'], motif: 'frozen fields', phase: 'The cold bites harder.' },
  fighting: { word: 'Proving Ground', env: 'An old training ground; the air is tense.', deep: 'The echoes grow louder.', affinity: ['fighting'], peril: ['psychic', 'flying'], tint: '#8a3a2a', accent: '#ffb090', wildTypes: ['fighting'], motif: 'training grounds', phase: 'The challenge sharpens.' },
  poison: { word: 'Toxic Mire', terrain: 'misty', env: 'A sour mist hangs over every fight.', deep: 'The fumes thicken.', affinity: ['poison'], peril: ['steel', 'ground'], tint: '#6a2f7a', accent: '#e0a0ff', wildTypes: ['poison'], motif: 'bogs and fumes', phase: 'The fumes surge.' },
  ground: { word: 'Shifting Sands', weather: 'sand', env: 'A sandstorm rages over every fight.', deep: 'The dunes begin to move.', affinity: ['ground', 'rock'], peril: ['water', 'grass'], tint: '#9c7a3a', accent: '#ffe0a0', time: ['day', 'eve'], wildTypes: ['ground'], motif: 'dunes and canyons', phase: 'The ground shudders.' },
  flying: { word: 'Open Sky', env: 'A hard wind blows over the stage.', deep: 'The gale builds.', affinity: ['flying'], peril: ['rock', 'electric'], tint: '#5a8ac0', accent: '#e0f0ff', wildTypes: ['flying'], motif: 'cliff-top winds', phase: 'The wind rises.' },
  psychic: { word: 'Waking Dream', terrain: 'psychic', env: 'Psychic terrain hums over the stage.', deep: 'Thought and sound seem to blur.', affinity: ['psychic'], peril: ['dark', 'bug', 'ghost'], tint: '#7a3a8a', accent: '#ffb0ff', time: ['night'], distort: true, wildTypes: ['psychic'], motif: 'dreamlike halls', phase: 'The air hums louder.' },
  bug: { word: 'Hive Mind', terrain: 'grassy', env: 'The stage is thick with growth and the hum of wings.', deep: 'The swarm thickens.', affinity: ['bug'], peril: ['fire', 'flying'], tint: '#5a8a2a', accent: '#d8ff8a', wildTypes: ['bug'], motif: 'hives and thickets', phase: 'The swarm stirs.' },
  rock: { word: 'Stone Hall', weather: 'sand', env: 'Grit and dust fill the air of every fight.', deep: 'The walls start to shake.', affinity: ['rock', 'steel'], peril: ['water', 'grass'], tint: '#7a6a5a', accent: '#e8d8c0', wildTypes: ['rock'], motif: 'ancient halls', phase: 'The stone cracks.' },
  ghost: { word: 'Haunted Hour', terrain: 'misty', env: 'A cold mist drifts over every fight.', deep: 'The shadows lengthen.', affinity: ['ghost'], peril: ['normal'], tint: '#3a2a50', accent: '#c78aff', time: ['night'], distort: true, wildTypes: ['ghost'], motif: 'lamplit ruins', phase: 'The lights gutter.' },
  dragon: { word: 'Dragon’s Rest', env: 'The air is heavy with old power.', deep: 'The power is waking.', affinity: ['dragon'], peril: ['ice', 'fairy'], tint: '#3a4a9c', accent: '#b0c0ff', wildTypes: ['dragon'], motif: 'high cliffs and scales', phase: 'The air shakes.' },
  dark: { word: 'Long Night', env: 'It is darker here than it should be.', deep: 'The dark deepens.', affinity: ['dark'], peril: ['fighting', 'bug'], tint: '#2a2a3a', accent: '#a0a0c0', time: ['night'], wildTypes: ['dark'], motif: 'unlit alleys', phase: 'The dark closes in.' },
  steel: { word: 'Iron Works', env: 'The air rings with metal.', deep: 'The machinery wakes.', affinity: ['steel'], peril: ['fire'], tint: '#6a7a8a', accent: '#e0e8f0', wildTypes: ['steel'], motif: 'foundries and gears', phase: 'The gears turn.' },
  fairy: { word: 'Moonlit Glade', terrain: 'misty', env: 'A soft mist glitters over every fight.', deep: 'The glitter turns sharp.', affinity: ['fairy'], peril: ['poison', 'steel'], tint: '#b05a9c', accent: '#ffd0f0', wildTypes: ['fairy'], motif: 'moonlit glades', phase: 'The glow flares.' },
};

const SKIP = new Set(['cosmog', 'cosmoem', 'kubfu', 'phione', 'meltan']);
const bst = (s: any) => Object.values(s.baseStats as Record<string, number>).reduce((a, b) => a + b, 0);
const nice = (id: string) => byId.get(id)?.name ?? id;
const check = (id: string, where: string) => { if (!byId.has(id)) throw new Error(`${where}: unknown species "${id}"`); return id; };

function wildFor(types: string[], self: string): string[] {
  const pool = species.filter((s) => !s.form && s.tags.length === 0 && s.evolutionStage >= 2 && bst(s) >= 400 && bst(s) <= 540 && s.types.some((t: string) => types.includes(t)));
  pool.sort((a, b) => a.dex - b.dex);
  const out: string[] = [];
  const step = Math.max(1, Math.floor(pool.length / 6));
  for (let i = 0; i < pool.length && out.length < 6; i += step) out.push(pool[i].id);
  return out.filter((id) => id !== self);
}

const legends = species.filter((s) => !s.form && (s.tags.includes('legendary') || s.tags.includes('mythical')) && !SKIP.has(s.id));
const events: any[] = [];
const totems: any[] = [];

for (const s of legends) {
  const b = BESPOKE[s.id];
  const kit = KITS[s.types[0]]!;
  const total = bst(s);
  const tier = total >= 660 ? 4 : total >= 600 ? 3 : total >= 540 ? 2 : 1;
  const rarity = b?.rarity ?? (s.tags.includes('mythical') || total >= 660 ? 'veryRare' : total >= 580 ? 'rare' : 'uncommon');
  const minRegion = tier === 1 ? 1 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
  const attackStat = s.baseStats.spa >= s.baseStats.atk ? 'spa' : 'atk';
  const defStat = s.baseStats.spd >= s.baseStats.def ? 'spd' : 'def';
  const id = `legend-${s.id}`;
  const epithet = b?.epithet ?? kit.word;
  const wild = (b?.wild ?? wildFor(s.types, s.id)).map((w) => check(w, id));
  if (wild.length < 3) throw new Error(`${id}: too few wild species`);
  const mystery = s.tags.includes('mythical');
  const name = `${s.name}: ${epithet}`;
  const types: string[] = s.types;
  const mainType = types[0]!;

  const defEnv = b?.env ?? [
    { fromLayer: 0, text: kit.env, ...(kit.weather ? { weather: kit.weather } : {}), ...(kit.terrain ? { terrain: kit.terrain } : {}) },
    { fromLayer: 4, text: kit.deep, ...(kit.weather ? { weather: kit.weather } : {}), ...(kit.terrain ? { terrain: kit.terrain } : {}) },
  ];
  const tmpl = {
    omen: `${s.name} has been sighted nearby, and the land is changing around it: ${kit.motif}.`,
    lore: [`Locals speak of ${s.name} in whispers.`, `Where it passes, the stage turns to ${kit.motif}.`],
    npcs: [
      { id: `${s.id}-witness`, name: 'A Local Witness', text: `"I saw ${s.name}. Nobody believes me. You look like you might."`, options: [{ label: 'Listen to the story', result: 'The witness tells you what to expect.', effect: { research: 1 } }, { label: 'Share your rations', result: 'The witness shares a hidden cache.', effect: { item: 'hyper-potion' } }] },
      { id: `${s.id}-pilgrim`, name: 'A Pilgrim', text: '"Rest here. The road ahead is not kind."', options: [{ label: 'Rest with the pilgrim', result: 'Your team rests.', effect: { heal: 0.25 } }, { label: 'Press on', result: 'You find a few coins on the road.', effect: { money: 200 } }] },
    ],
    modifiers: [kit.env.replace(/\.$/, ''), `${kit.affinity.join('/')}-type Pokémon recover HP`, 'A path collapses as you go'],
    finale: { intro: `${s.name} waits at the end of the road.`, win: `${s.name} yields. The land begins to settle.`, lose: `${s.name} lets the land push you back. It is not done with you.` },
    aura: { text: `Its presence fills the stage (${attackStat === 'spa' ? 'Special Attack' : 'Attack'} up).`, boost: { [attackStat]: 1 }, ...(kit.weather ? { weather: kit.weather } : {}), ...(kit.terrain ? { terrain: kit.terrain } : {}) },
    environment: { text: `${epithet}: ${kit.env}`, ...(kit.weather ? { weather: kit.weather } : {}), ...(kit.terrain ? { terrain: kit.terrain } : {}) },
    phases: [
      { atHp: 0.65, text: `${kit.phase} ${s.name} presses the attack.`, boost: { [defStat]: 1 }, clearPlayerStages: true },
      { atHp: 0.3, text: `${s.name} gives everything it has!`, boost: { [attackStat]: 1, spe: 1 }, cleanse: true },
    ],
  };
  const T = b?.totem;
  const finale = b?.finale ?? tmpl.finale;
  const trigger = {
    minRegion, maxRegion: null, time: kit.time && !b ? kit.time : [], themeTypes: [], requires: [],
    any: mystery && !b ? [{ kind: 'friendship', atLeast: 120 }, { kind: 'partyTag', tag: 'legendary' }] : [], favoured: types, weight: 1,
    ...(b?.trigger ?? {}),
  };
  const legendary = {
    species: s.id, epithet, rarity,
    omen: b?.omen ?? tmpl.omen, lore: b?.lore ?? tmpl.lore,
    temporaryNote: 'This chance is temporary: if you move on without entering, the way is gone when this stage ends.',
    visual: { tint: b?.tint ?? kit.tint, accent: b?.accent ?? kit.accent, motif: b?.motif ?? kit.motif },
    music: null, trigger, env: defEnv,
    closes: b?.closes ?? [{ afterLayer: 2, text: 'A path collapses behind you. One way forward is gone.' }],
    distort: b?.distort ?? (kit.distort ? [{ afterLayer: 1, text: 'The way on shifts and rearranges itself.' }] : []),
    affinity: b?.affinity === undefined ? { types: kit.affinity, heal: 0.08, text: `${kit.affinity.join('/')}-type Pokémon recover a little HP here.` } : b.affinity,
    peril: b?.peril === undefined ? { types: kit.peril, chip: 0.05, text: `${kit.peril.join('/')}-type Pokémon lose some HP here.` } : b.peril,
    wild, wildLevelBonus: 2, npcs: b?.npcs ?? tmpl.npcs, modifiers: b?.modifiers ?? tmpl.modifiers, finale,
  };
  const reward = tier + 3;
  events.push({
    id, name, tier, blurb: `${s.name} stirs, and its stage is open for a short time. ${legendary.omen}`,
    nodes: { min: 6, max: 8 }, partyMode: 'own',
    nodeWeights: { wild: 5, trainer: 2, elite: 1, rest: 1, cache: 1, research: 1, mystery: 2 },
    finale: { kind: 'totem', totemId: id },
    rentals: wild.slice(0, 3), restHeal: 0.4,
    cache: [{ item: 'hyper-potion', chance: 1 }, { item: 'full-heal', chance: 0.5 }],
    megaCost: 3, researchGoal: 2,
    rewards: { moneyPerLevel: 40 * reward, items: [{ item: `${mainType}-tera-shard`, chance: 1 }, { item: 'full-restore', chance: 0.6 }, ...(rarity === 'veryRare' ? [{ item: 'master-ball', chance: 0.15 }] : [])], megaStones: tier >= 3 ? 1 : 0, researchBonusItem: null },
    unlocks: null, failureKeep: 0.3, legendary,
  });
  totems.push({
    id, name: `${s.name}, ${epithet}`, tier: tier <= 2 ? 'mid' : tier === 3 ? 'late' : 'grand', legendary: true, type: mainType,
    blurb: `${s.name} at the heart of its own stage.`, species: [s.id], levelBonus: 6, hpBoostPercent: 160 + tier * 70,
    aura: T?.aura ?? tmpl.aura, ally: null, twoVsOne: false, fieldEffect: T?.fieldEffect ?? null,
    phases: T?.phases ?? tmpl.phases, environment: T?.environment ?? tmpl.environment,
    rewards: {
      moneyPerLevel: 40 * reward, items: [{ item: 'full-restore', chance: 1 }], draftExtra: 2,
      rareJoin: { species: s.id, chance: rarity === 'veryRare' ? 0.2 : rarity === 'rare' ? 0.3 : 0.4 },
      unlock: null, research: 3, megaStones: 0,
    },
  });
}

const file = new URL('../src/data/legendaryEvents.json', import.meta.url);
writeFileSync(file, JSON.stringify({ gateChance: 0.12, perRegion: 1, events, totems }, null, 1) + '\n');
console.log(`legendaryEvents.json: ${events.length} events (${Object.keys(BESPOKE).length} hand-designed) and ${totems.length} legendary finale Totems (${nice('mewtwo')} included)`);
