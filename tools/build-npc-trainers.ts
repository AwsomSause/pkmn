// Adds the ordinary-NPC trainers (Youngster, Lass, Bug Catcher...) to src/data/archetypes.json and their
// starter pools to src/data/runPrep.json, and copies their Essentials class sprites to images/bosses/.
// Safe to re-run: entries with the `npc-` id prefix are replaced, nothing else is touched.
// Run: npm run data:npc-trainers --  [path to Graphics/Trainers]
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const spriteDir = process.argv[2];
type Mod = Record<string, unknown>;
type Row = { cls: string; first: string; sprite: string; types: string[]; species: string[]; perk: string; line: string };

// Early game on purpose: every unlock is a small first-hours feat on an existing counter.
const R = (cls: string, first: string, sprite: string, types: string[], species: string[], perk: string, line: string): Row => ({ cls, first, sprite, types, species, perk, line });
const ROWS: Row[] = [
  R('Youngster', 'Joey', 'YOUNGSTER', ['normal'], ['rattata', 'spearow', 'ekans', 'nidoran-m', 'meowth'], 'B', 'My Rattata is in the top percentage of Rattata!'),
  R('Lass', 'Janice', 'LASS', ['normal'], ['pidgey', 'clefairy', 'jigglypuff', 'oddish', 'eevee'], 'R', 'Be gentle, okay? They are my friends.'),
  R('Bug Catcher', 'Wade', 'BUGCATCHER', ['bug'], ['caterpie', 'weedle', 'paras', 'venonat', 'scyther'], 'F', 'Bugs are way tougher than they look!'),
  R('Camper', 'Liam', 'CAMPER', ['ground'], ['sandshrew', 'geodude', 'diglett', 'cubone', 'rhyhorn'], 'H', 'Nothing beats a night under the stars.'),
  R('Picnicker', 'Gina', 'PICNICKER', ['grass'], ['bulbasaur', 'oddish', 'bellsprout', 'exeggcute', 'tangela'], 'S', 'We packed sandwiches for the whole team!'),
  R('Hiker', 'Anthony', 'HIKER', ['rock'], ['geodude', 'onix', 'machop', 'rhyhorn', 'sandshrew'], 'H', 'Mountains make for stubborn Pokémon.'),
  R('Fisherman', 'Elliot', 'FISHERMAN', ['water'], ['magikarp', 'poliwag', 'krabby', 'horsea', 'goldeen'], 'C', 'Patience is the whole trick.'),
  R('Bird Keeper', 'Perry', 'BIRDKEEPER', ['flying'], ['pidgey', 'spearow', 'doduo', 'farfetchd', 'hoothoot'], 'F', 'Watch them ride the wind!'),
  R('Black Belt', 'Kenji', 'BLACKBELT', ['fighting'], ['mankey', 'machop', 'tyrogue', 'hitmonlee', 'hitmonchan'], 'B', 'Hup! Train the body, train the Pokémon.'),
  R('Biker', 'Ryder', 'BIKER', ['poison'], ['koffing', 'grimer', 'ekans', 'zubat', 'houndour'], 'B', 'Out of my way, rookie!'),
  R('Burglar', 'Quinn', 'BURGLAR', ['fire'], ['growlithe', 'vulpix', 'ponyta', 'magmar', 'charmander'], 'M', 'Finders keepers, right?'),
  R('Channeler', 'Hester', 'CHANNELER', ['ghost'], ['gastly', 'misdreavus', 'shuppet', 'duskull', 'drifloon'], 'W', 'I feel something behind you...'),
  R('Cooltrainer', 'Marcus', 'COOLTRAINER_M', ['dragon'], ['dratini', 'bagon', 'gible', 'larvitar', 'charmander'], 'B', 'Only the best trainers get my respect.'),
  R('Cooltrainer', 'Selene', 'COOLTRAINER_F', ['psychic'], ['abra', 'ralts', 'slowpoke', 'natu', 'espeon'], 'W', 'My strategy is flawless.'),
  R('Crush Girl', 'Tamsin', 'CRUSHGIRL', ['fighting'], ['makuhita', 'meditite', 'machop', 'riolu', 'mankey'], 'B', 'Throw a punch, then another!'),
  R('Crush Kin', 'Ivan and Mira', 'CRUSHKIN', ['fighting'], ['tyrogue', 'timburr', 'mankey', 'makuhita', 'machop'], 'P', 'Two trainers, double the pressure!'),
  R('Cue Ball', 'Dutch', 'CUEBALL', ['fighting'], ['machop', 'mankey', 'makuhita', 'meditite', 'riolu'], 'B', 'Show me what you have got!'),
  R('Engineer', 'Baxter', 'ENGINEER', ['electric'], ['magnemite', 'voltorb', 'electabuzz', 'elekid', 'pikachu'], 'S', 'Everything runs on current, even teams.'),
  R('Gambler', 'Lucky', 'GAMBLER', ['normal'], ['meowth', 'snubbull', 'eevee', 'lickitung', 'chansey'], 'M', 'Double or nothing on this battle!'),
  R('Gentleman', 'Alfred', 'GENTLEMAN', ['normal'], ['growlithe', 'meowth', 'snubbull', 'eevee', 'houndour'], 'M', 'Proper form, proper manners.'),
  R('Juggler', 'Pierre', 'JUGGLER', ['psychic'], ['drowzee', 'abra', 'voltorb', 'mr-mime', 'natu'], 'F', 'Keep your eyes on the ball. And the Pokémon.'),
  R('Lady', 'Cordelia', 'LADY', ['fairy'], ['clefairy', 'togepi', 'snubbull', 'jigglypuff', 'cleffa'], 'M', 'My Pokémon are only the finest.'),
  R('Painter', 'Vera', 'PAINTER', ['grass'], ['smoochum', 'bellsprout', 'oddish', 'ditto', 'mime-jr'], 'S', 'Every battle is a canvas.'),
  R('Poké Maniac', 'Rex', 'POKEMANIAC', ['rock'], ['cubone', 'omanyte', 'kabuto', 'aerodactyl', 'lileep'], 'C', 'I collect them all, and I mean all!'),
  R('Pokémon Breeder', 'Delia', 'POKEMONBREEDER', ['normal'], ['togepi', 'pichu', 'cleffa', 'igglybuff', 'azurill'], 'R', 'Raised with love since the egg.'),
  R('Pokémon Ranger', 'Hal', 'POKEMONRANGER_M', ['grass'], ['bulbasaur', 'bellsprout', 'oddish', 'pikachu', 'growlithe'], 'C', 'Keep the wild safe, and the wild keeps us safe.'),
  R('Pokémon Ranger', 'Willa', 'POKEMONRANGER_F', ['flying'], ['pidgey', 'taillow', 'starly', 'hoothoot', 'spearow'], 'C', 'Capture on, ranger style!'),
  R('Psychic', 'Edmund', 'PSYCHIC_M', ['psychic'], ['abra', 'drowzee', 'slowpoke', 'natu', 'ralts'], 'W', 'I knew you were coming.'),
  R('Psychic', 'Lorna', 'PSYCHIC_F', ['psychic'], ['ralts', 'abra', 'mime-jr', 'wynaut', 'espeon'], 'W', 'Your next move is already in my head.'),
  R('Rocker', 'Axel', 'ROCKER', ['electric'], ['voltorb', 'magnemite', 'elekid', 'pikachu', 'shinx'], 'F', 'Turn it up to eleven!'),
  R('Ruin Maniac', 'Hadrian', 'RUINMANIAC', ['ground'], ['sandshrew', 'geodude', 'cubone', 'baltoy', 'trapinch'], 'H', 'These ruins hold such secrets.'),
  R('Sailor', 'Murphy', 'SAILOR', ['water'], ['tentacool', 'krabby', 'shellder', 'wingull', 'horsea'], 'B', 'Hoist the sails, matey!'),
  R('Scientist', 'Dr. Orson', 'SCIENTIST', ['electric'], ['magnemite', 'porygon', 'grimer', 'voltorb', 'ditto'], 'S', 'A fascinating battle sample.'),
  R('Sis and Bro', 'Amy and Tim', 'SISANDBRO', ['water'], ['poliwag', 'horsea', 'tentacool', 'staryu', 'psyduck'], 'P', 'We always fight together!'),
  R('Super Nerd', 'Miles', 'SUPERNERD', ['poison'], ['grimer', 'koffing', 'magnemite', 'voltorb', 'porygon'], 'S', 'I did the math on your odds.'),
  R('Swimmer', 'Kai', 'SWIMMER_M', ['water'], ['tentacool', 'staryu', 'horsea', 'goldeen', 'psyduck'], 'F', 'The water is perfect today!'),
  R('Swimmer', 'Marina', 'SWIMMER_F', ['water'], ['staryu', 'shellder', 'goldeen', 'wooper', 'azurill'], 'F', 'Dive in with me!'),
  R('Swimmer', 'Finn', 'SWIMMER2_M', ['water'], ['krabby', 'poliwag', 'slowpoke', 'totodile', 'mudkip'], 'H', 'Cannonball into battle!'),
  R('Swimmer', 'Coral', 'SWIMMER2_F', ['water'], ['seel', 'lapras', 'horsea', 'lotad', 'marill'], 'R', 'Swim and splash!'),
  R('Tamer', 'Garrett', 'TAMER', ['normal'], ['growlithe', 'sandshrew', 'rhyhorn', 'mankey', 'houndour'], 'B', 'Wild or not, they listen to me.'),
  R('Team Rocket Grunt', 'Boris', 'TEAMROCKET_M', ['dark'], ['rattata', 'zubat', 'koffing', 'ekans', 'houndour'], 'M', 'Hand over your Pokémon!'),
  R('Team Rocket Grunt', 'Jessa', 'TEAMROCKET_F', ['poison'], ['ekans', 'grimer', 'zubat', 'meowth', 'koffing'], 'M', 'Prepare for trouble, rookie!'),
  R('Tuber', 'Pip', 'TUBER_M', ['water'], ['psyduck', 'poliwag', 'goldeen', 'marill', 'wooper'], 'R', 'Float on, battle later.'),
  R('Tuber', 'Dot', 'TUBER_F', ['water'], ['marill', 'psyduck', 'azurill', 'lotad', 'goldeen'], 'R', 'Splash fight!'),
  R('Tuber', 'Rudy', 'TUBER2_M', ['water'], ['wooper', 'poliwag', 'tentacool', 'krabby', 'magikarp'], 'C', 'Tube life is the best life.'),
  R('Tuber', 'Sunny', 'TUBER2_F', ['water'], ['staryu', 'lotad', 'marill', 'horsea', 'wingull'], 'R', 'Come join the waves!'),
  R('Twins', 'Nia and Mia', 'TWINS', ['fairy'], ['clefairy', 'cleffa', 'togepi', 'jigglypuff', 'pichu'], 'P', 'Two for the price of one!'),
  R('Young Couple', 'Dan and Eri', 'YOUNGCOUPLE', ['normal'], ['eevee', 'vulpix', 'growlithe', 'pichu', 'meowth'], 'P', 'Together we cannot lose.'),
  R('Beauty', 'Bianca', 'BEAUTY', ['water'], ['staryu', 'goldeen', 'seel', 'horsea', 'marill'], 'M', 'My Pokémon sparkle, and so do I.'),
  R('Aroma Lady', 'Rosalind', 'AROMALADY', ['grass'], ['oddish', 'bellsprout', 'hoppip', 'budew', 'bulbasaur'], 'R', 'Smell the flowers, then fall to them.'),
  R('Cool Couple', 'Leon and Sky', 'COOLCOUPLE', ['normal'], ['eevee', 'ponyta', 'vulpix', 'growlithe', 'pikachu'], 'P', 'Stylish and strong, that is us.'),
];

type Perk = { pro: string; con: string; mods: (t: string) => Mod[] };
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const PERKS: Record<string, (t: string) => Perk> = {
  F: (t) => ({ pro: `${cap(t)}-types deal 10% more damage`, con: 'Speed is reduced by 5%', mods: () => [{ kind: 'damageMultiplier', type: t, value: 1.1 }, { kind: 'statMultiplier', stat: 'spe', value: 0.95 }] }),
  S: (t) => ({ pro: `${cap(t)}-types gain 15% more EXP`, con: `${cap(t)}-types take 5% more damage`, mods: () => [{ kind: 'groupXpMultiplier', type: t, value: 1.15 }, { kind: 'damageTakenMultiplier', type: t, value: 1.05 }] }),
  H: (t) => ({ pro: `${cap(t)}-types gain 10% Defense`, con: 'Speed is reduced by 5%', mods: () => [{ kind: 'statMultiplier', stat: 'def', type: t, value: 1.1 }, { kind: 'statMultiplier', stat: 'spe', value: 0.95 }] }),
  M: () => ({ pro: 'Earn 10% more money', con: 'Earn 5% less EXP', mods: () => [{ kind: 'moneyMultiplier', value: 1.1 }, { kind: 'xpMultiplier', value: 0.95 }] }),
  C: () => ({ pro: 'Catch rates are 15% better', con: 'Earn 5% less money', mods: () => [{ kind: 'captureMultiplier', value: 1.15 }, { kind: 'moneyMultiplier', value: 0.95 }] }),
  R: () => ({ pro: 'Healing items work 15% better', con: 'Moves deal 5% less damage', mods: () => [{ kind: 'healingMultiplier', value: 1.15 }, { kind: 'damageMultiplier', value: 0.95 }] }),
  P: (t) => ({ pro: `${cap(t)}-types gain 10% more EXP`, con: 'HP is reduced by 5%', mods: () => [{ kind: 'groupXpMultiplier', type: t, value: 1.1 }, { kind: 'statMultiplier', stat: 'hp', value: 0.95 }] }),
  B: () => ({ pro: 'Physical moves deal 10% more damage', con: 'Take 5% more damage', mods: () => [{ kind: 'damageMultiplier', category: 'physical', value: 1.1 }, { kind: 'damageTakenMultiplier', value: 1.05 }] }),
  W: () => ({ pro: 'Special moves deal 10% more damage', con: 'Defense is reduced by 5%', mods: () => [{ kind: 'damageMultiplier', category: 'special', value: 1.1 }, { kind: 'statMultiplier', stat: 'def', value: 0.95 }] }),
};

// Early feats, easiest first. Each rung is a counter and a small number: all reachable in the first few runs.
const LADDER: Array<[string, number, string]> = [
  ['battlesWon', 3, 'Win 3 battles'], ['wildDefeated', 8, 'Defeat 8 wild Pokémon'], ['pokemonCaught', 2, 'Catch 2 Pokémon'],
  ['runsFinished', 1, 'Finish a run'], ['healStopsUsed', 2, 'Use 2 healing stops'], ['battlesWon', 8, 'Win 8 battles'],
  ['evolutions', 1, 'Evolve a Pokémon'], ['eventsCompleted', 2, 'Complete 2 map events'], ['pokemonCaught', 6, 'Catch 6 Pokémon'],
  ['moneyEarned', 1500, 'Earn ₽1500'], ['wildDefeated', 25, 'Defeat 25 wild Pokémon'], ['battlesWon', 15, 'Win 15 battles'],
  ['candiesEarned', 5, 'Earn 5 candies'], ['evolutions', 3, 'Evolve 3 Pokémon'], ['eventsCompleted', 6, 'Complete 6 map events'],
  ['battlesWon', 25, 'Win 25 battles'], ['runsFinished', 3, 'Finish 3 runs'], ['pokemonCaught', 15, 'Catch 15 Pokémon'],
  ['wildDefeated', 60, 'Defeat 60 wild Pokémon'], ['regionsCleared', 1, 'Clear a region'],
];

const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aPath = join(root, 'src/data/archetypes.json');
const rPath = join(root, 'src/data/runPrep.json');
const arch: Array<{ id: string }> = JSON.parse(readFileSync(aPath, 'utf8')).filter((a: { id: string }) => !a.id.startsWith('npc-'));
const prep = JSON.parse(readFileSync(rPath, 'utf8'));
prep.starterPools = prep.starterPools.filter((p: { id: string }) => !p.id.startsWith('trainer-npc-'));

ROWS.forEach((row, i) => {
  const id = `npc-${slug(`${row.cls}-${row.first}`)}`;
  const type = row.types[0]!;
  const perk = PERKS[row.perk]!(type);
  const [counter, atLeast, text] = LADDER[i % LADDER.length]!;
  const step = Math.floor(i / LADDER.length);
  const need = atLeast * (step + 1);
  const unlockText = text.replace(/\d[\d,]*/, String(need));
  const unlock = { kind: 'total', counter, atLeast: need };
  const cost = 25 * (1 + (i % LADDER.length >> 2) + step * 2);
  const sprite = `npc_${slug(row.sprite).replace(/-/g, '_')}`;
  if (spriteDir) {
    const src = join(spriteDir, `${row.sprite}.png`);
    if (!existsSync(src)) throw new Error(`missing sprite ${src}`);
    copyFileSync(src, join(root, 'public/assets/images/bosses', `${sprite}.png`));
  }
  arch.push({
    id, name: `${row.cls} ${row.first}`, title: `The ${row.cls}`,
    description: `${perk.pro} — ${perk.con}.`, pros: [perk.pro], cons: [perk.con],
    unlockedByDefault: false, unlock, unlockText, unlockCost: cost, spriteAssetId: `boss.${sprite}`,
    modifiers: perk.mods(type), signatureTypes: row.types, signatureSpecies: row.species, signaturePool: `trainer-${id}`,
    eventTags: ['npc'], signatureMechanic: null, unlockFlavor: `"${row.line}"`, unlockStatus: 'supported',
  } as never);
  prep.starterPools.push({
    id: `trainer-${id}`, name: `${row.cls} ${row.first}’s Team`, description: `The ${row.cls}’s everyday team, as first stages.`,
    category: 'trainer', species: row.species, unlock, unlockText,
  });
});

writeFileSync(aPath, JSON.stringify(arch, null, 2) + '\n');
writeFileSync(rPath, JSON.stringify(prep, null, 1) + '\n');
console.log(`npc trainers: ${ROWS.length}`);
