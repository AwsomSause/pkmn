// Writes src/data/gameEvents.json: the weekly, holiday and themed game events (Untitled doc §17.2, plan Part 4b).
// Run with: npm run data:game-events
//
// Weekly events rotate by ISO week (core/gameEvents.ts). Each has a themed ruleset (trainer
// modifiers added to every run started that week), 3–5 milestone objectives counted over the
// week's runs, a permanent reward the first time every objective is done, and a fallback reward
// after that. Holiday and themed events come back every year between two dates.
import { readFileSync, writeFileSync } from 'node:fs';

type Json = Record<string, unknown>;
const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const pools = new Set((data('runPrep.json') as { starterPools: { id: string }[] }).starterPools.map((p) => p.id));
const mapEvents = new Set((data('events.json') as { events: { id: string }[] }).events.map((e) => e.id));

const goal = (id: string, text: string, counter: string, atLeast: number, reward: Json): Json => ({ id, text, counter, atLeast, reward });
const rp = (researchPoints: number): Json => ({ researchPoints });
const FALLBACK = { researchPoints: 150, candies: 10 };

function weekly(id: string, name: string, description: string, ruleText: string, modifiers: Json[], featured: string[], objectives: Json[], reward: Json, color: string, icon: string, tags: string[]): Json {
  return timed(id, 'weekly', null, name, description, ruleText, modifiers, featured, objectives, reward, color, icon, tags);
}

/** A holiday or themed event, on every year between two "MM-DD" dates (UTC, inclusive; may wrap the new year). */
function yearly(id: string, kind: 'holiday' | 'themed', window: [string, string], name: string, description: string, ruleText: string, modifiers: Json[], featured: string[], objectives: Json[], reward: Json, color: string, icon: string, tags: string[]): Json {
  return timed(id, kind, window, name, description, ruleText, modifiers, featured, objectives, reward, color, icon, tags);
}

function timed(id: string, kind: string, window: [string, string] | null, name: string, description: string, ruleText: string, modifiers: Json[], featured: string[], objectives: Json[], reward: Json, color: string, icon: string, tags: string[]): Json {
  for (const e of featured) if (!mapEvents.has(e)) throw new Error(`${id}: unknown map event "${e}"`);
  if (reward.pool && !pools.has(reward.pool as string)) throw new Error(`${id}: unknown pool "${reward.pool}"`);
  return {
    id,
    version: 1,
    name,
    kind,
    description,
    schedule: window ? { kind: 'yearly', start: window[0], end: window[1] } : { kind: 'weeklyRotation' },
    seedRule: window ? 'year' : 'isoWeek',
    progressionEligibility: true,
    eligibility: { minRunsFinished: 0 },
    mode: 'any',
    ruleText,
    modifiers,
    mapEvents: featured,
    objectives,
    reward,
    repeatPolicy: 'oncePerEvent',
    fallbackReward: FALLBACK,
    visualTheme: { color, icon },
    contentTags: tags,
  };
}

const WEEKLY: Json[] = [
  weekly('delta-research-week', 'Delta Research Week', 'Strange readings across the regions: find clues at events, win research battles and study rare Pokémon.',
    'Rare Pokémon turn up 50% more often; mysteries and odd signals appear on the map more often.',
    [{ kind: 'encounterWeightMultiplier', group: 'rare', value: 1.5 }],
    ['time-rift', 'meteorite-crash', 'abandoned-lab', 'strange-signal', 'distortion-world'],
    [
      goal('clues', 'Find 3 clues (finish 3 map events)', 'eventsCompleted', 3, rp(40)),
      goal('research-battles', 'Win 15 research battles against trainers', 'trainersDefeated', 15, rp(60)),
      goal('samples', 'Catch 8 Pokémon for study', 'pokemonCaught', 8, rp(60)),
      goal('report', 'Report to 3 gym leaders (beat them)', 'gymLeadersDefeated', 3, rp(80)),
    ],
    { researchPoints: 300, title: 'Delta Researcher', pool: 'rare' }, '#7a5cff', 'item.scanner', ['delta', 'research']),
  weekly('rivalry-week', 'Rivalry Week', 'Old rivals are back and hungrier than ever. Beat them, and keep winning.',
    'Rivals come back 2 levels stronger; rival rematches appear on the map more often.',
    [{ kind: 'rivalLevelOffset', value: 2 }],
    ['rival-rematch', 'blue-taunt', 'kieran-rivalry', 'mirror-match'],
    [
      goal('first-grudge', 'Beat a rival once', 'rivalBattlesWon', 1, rp(50)),
      goal('trainers', 'Beat 20 trainers', 'trainersDefeated', 20, rp(60)),
      goal('respect', 'Beat rivals 3 times', 'rivalBattlesWon', 3, rp(100)),
    ],
    { researchPoints: 300, title: 'Rival of the Week', pool: 'trainer-blue' }, '#e04848', 'item.leaders_crest', ['rivals']),
  weekly('gym-circuit', 'Gym Circuit', 'Tour the gyms under tournament rules: the leaders hit harder, and every badge counts.',
    "Boss Pokémon deal 15% more damage; gym scouts and ambushes appear more often.",
    [{ kind: 'bossDamageTakenMultiplier', value: 1.15 }],
    ['gym-scout', 'gym-trainer-ambush', 'trainers-test', 'champion-cup'],
    [
      goal('two-badges', 'Win 2 gym badges', 'gymLeadersDefeated', 2, rp(50)),
      goal('five-badges', 'Win 5 gym badges', 'gymLeadersDefeated', 5, rp(80)),
      goal('eight-badges', 'Win 8 gym badges', 'gymLeadersDefeated', 8, rp(120)),
    ],
    { researchPoints: 300, title: 'Circuit Champion', pool: 'league-kanto' }, '#f0b030', 'item.master_ribbon', ['gyms']),
  weekly('egg-expedition', 'Egg Expedition', 'Breeders are out in force: travel far, catch plenty and watch your team grow.',
    'Your Pokémon gain 15% more experience; nests, breeders and daycares appear more often.',
    [{ kind: 'xpMultiplier', value: 1.15 }],
    ['egg-nest', 'wandering-breeder', 'daycare-couple', 'breeders-visit', 'pokemon-daycare-visit'],
    [
      goal('travel', 'Finish 25 encounters', 'encountersCompleted', 25, rp(40)),
      goal('catch', 'Catch 10 Pokémon', 'pokemonCaught', 10, rp(60)),
      goal('grow', 'Evolve 4 Pokémon', 'evolutions', 4, rp(80)),
    ],
    { researchPoints: 250, candies: 30, title: 'Egg Expedition Leader', pool: 'late-bloomers' }, '#78c850', 'item.mystery_egg', ['eggs', 'catching']),
  weekly('catch-carnival', 'Catch Carnival', 'Every ball is a lucky ball this week. Catch, keep and catch some more.',
    'Poké Balls work 25% better; swarms and the Safari Zone appear more often.',
    [{ kind: 'captureMultiplier', value: 1.25 }],
    ['swarm', 'safari-zone', 'ball-factory-outlet', 'uncommon-breed'],
    [
      goal('ten', 'Catch 10 Pokémon', 'pokemonCaught', 10, rp(40)),
      goal('keep', 'Keep 5 caught Pokémon in your party', 'caughtKept', 5, rp(60)),
      goal('twenty-five', 'Catch 25 Pokémon', 'pokemonCaught', 25, rp(100)),
    ],
    { researchPoints: 300, title: 'Carnival Catcher', pool: 'tricksters' }, '#ff70b0', 'ball.pb', ['catching']),
  weekly('raid-rally', 'Raid Rally', 'Giant Pokémon are stirring in dens and territories everywhere. Field medics stand by.',
    'Healing items restore 25% more HP; sleeping giants and alpha Pokémon appear more often.',
    [{ kind: 'healingMultiplier', value: 1.25 }],
    ['alpha-pokemon', 'sleeping-giant', 'slumbering-snorlax', 'legendary-shadow'],
    [
      goal('first-raid', 'Win a raid', 'raidsWon', 1, rp(60)),
      goal('totem', 'Beat a Totem', 'totemsWon', 1, rp(60)),
      goal('three-raids', 'Win 3 raids', 'raidsWon', 3, rp(120)),
    ],
    { researchPoints: 300, title: 'Raid Rallier', pool: 'bulwarks' }, '#c03028', 'item.golden_mystic_ticket', ['raids', 'totems']),
  weekly('dragon-week', 'Dragon Week', 'Dragons gather at the old shrines. Face them, or fly with them.',
    'Dragon moves deal 20% more damage and Dragon-types appear twice as often.',
    [{ kind: 'typeDamageMultiplier', type: 'dragon', value: 1.2 }, { kind: 'typeEncounterWeight', type: 'dragon', value: 2 }],
    ['dragons-den', 'dragon-shrine'],
    [
      goal('five-dragons', 'Defeat or catch 5 Dragon-types', 'defeatedOrCaught.dragon', 5, rp(50)),
      goal('dragon-boss', 'Beat a boss with a Dragon-type leading', 'bossWinsLead.dragon', 1, rp(80)),
      goal('fifteen-dragons', 'Defeat or catch 15 Dragon-types', 'defeatedOrCaught.dragon', 15, rp(100)),
    ],
    { researchPoints: 300, title: 'Dragon Week Hero', pool: 'type-dragon' }, '#7038f8', 'item.exp_charm', ['types', 'dragon']),
  weekly('market-week', 'Market Week', 'The merchants are in town: everything is 10% off, and the deals are everywhere.',
    'Shop prices are 10% lower; sales and bazaars appear more often.',
    [{ kind: 'priceMultiplier', group: 'all', value: 0.9 }],
    ['department-store-sale', 'haggle-sale', 'mega-bazaar', 'bargain-bin'],
    [
      goal('earn', 'Earn ₽15,000', 'moneyEarned', 15000, rp(40)),
      goal('spend', 'Spend ₽8,000', 'moneySpent', 8000, rp(60)),
      goal('deals', 'Finish 6 map events', 'eventsCompleted', 6, rp(80)),
    ],
    { researchPoints: 200, bankCredits: 3000, title: 'Market Mogul', pool: 'glass-cannons' }, '#e0c030', 'item.coin_case', ['money', 'shops']),
  weekly('champions-gauntlet', "Champion's Gauntlet", 'The League is holding open trials. Enemies are a little tougher, and prize money is richer.',
    'Enemy Pokémon are 1 level higher; prize money is 20% higher.',
    [{ kind: 'enemyLevelOffset', value: 1 }, { kind: 'moneyMultiplier', value: 1.2 }],
    ['battle-tower-floor', 'champion-lunch', 'veteran-challenge', 'champion-cup'],
    [
      goal('elite-two', 'Beat 2 Elite Four members', 'eliteFourDefeated', 2, rp(80)),
      goal('champion', 'Beat a champion', 'championsDefeated', 1, rp(120)),
      goal('trainers', 'Beat 30 trainers', 'trainersDefeated', 30, rp(60)),
    ],
    { researchPoints: 400, title: 'Gauntlet Victor', pool: 'league-johto' }, '#3890f8', 'item.leaders_crest', ['league']),
  // Exploration and story events (APPROVED.md §5-6). Their stops are in tools/events/explore.ts.
  weekly('legendary-beasts-chase', 'Legendary Beasts Chase', 'Raikou, Entei and Suicune are roaming the region. Follow their trail, and be ready when they turn to face you.',
    'Raikou, Entei and Suicune roam every map from the third stage, moving as you do; tracks and sightings turn up on the road.',
    [{ kind: 'xpMultiplier', value: 1.1 }],
    ['beast-clue-thunder', 'beast-clue-ash', 'beast-clue-ripple', 'beast-lookout', 'lookout-tower'],
    [
      goal('trail', 'Follow 4 trails (clues)', 'eventClues', 4, rp(50)),
      goal('face', 'Face a beast', 'eventBossesWon', 1, rp(100)),
      goal('hunt', 'Face all three', 'eventBossesWon', 3, rp(150)),
      goal('badges', 'Win 3 gym badges', 'gymLeadersDefeated', 3, rp(80)),
    ],
    { researchPoints: 450, title: 'Beast Tracker', pool: 'rare' }, '#e0a030', 'item.sun_stone', ['legendary', 'roaming']),
  weekly('campfire-tales-week', 'Campfire Tales', 'Storytellers are out and the fires are lit. Every stop is a chance to hear, or tell, a story.',
    'Storytellers, ghost stories and Pokémon memories turn up at camps and on the road; your Pokémon bond faster at rest.',
    [{ kind: 'researchMultiplier', value: 1.15 }],
    ['tale-storyteller', 'tale-ghost-story', 'tale-pokemon-memory', 'tale-world-lore', 'tale-festival-night', 'camp-checkpoint'],
    [
      goal('tales', 'Hear 4 tales (clues)', 'eventClues', 4, rp(50)),
      goal('events', 'Finish 8 map events', 'eventsCompleted', 8, rp(70)),
      goal('trainers', 'Beat 15 trainers', 'trainersDefeated', 15, rp(60)),
    ],
    { researchPoints: 300, title: 'Fireside Keeper', pool: 'research' }, '#e07830', 'item.fire_stone', ['stories', 'camp']),
  weekly('plasma-operation', 'Team Plasma Liberation Operation', 'Team Plasma is taking Pokémon again. Cut their supply routes, free the captives and face the commander.',
    'Three stops follow the operation from the supply route to the holding yard to the commander; what you do early changes the later fights.',
    [{ kind: 'moneyMultiplier', value: 1.1 }],
    ['plasma-op-1', 'plasma-op-2', 'plasma-op-3', 'plasma-liberation', 'plasma-protest', 'plasma-substage-gate'],
    [
      goal('route', 'Disrupt the supply route (a clue)', 'eventClues', 1, rp(50)),
      goal('yard', 'Free the holding yard (3 clues)', 'eventClues', 3, rp(70)),
      goal('commander', 'Beat the commander', 'eventBossesWon', 1, rp(120)),
      goal('finale', 'End the operation', 'eventFinalesWon', 1, rp(100)),
    ],
    { researchPoints: 400, title: 'Liberator', pool: 'team-plasma' }, '#c03050', 'item.dusk_stone', ['villains', 'rescue']),
  weekly('hidden-path-week', 'Hidden Path Week', 'The secret branches of every route are open for a week. Pokémon with the right ability can find them.',
    'Secret paths show themselves more often; path keepers, signposts and shortcuts turn up on the road.',
    [{ kind: 'xpMultiplier', value: 1.1 }],
    ['hidden-path-signpost', 'hidden-path-shortcut', 'hidden-path-keeper', 'secret-levitate-chasm', 'secret-keen-eye-ledge', 'secret-intimidate-gate', 'secret-magnet-vein', 'secret-damp-cave', 'secret-flash-fire-door', 'secret-synchronize-whisper', 'secret-pickup-burrow', 'secret-arena-tunnel'],
    [
      goal('paths', 'Find 3 hidden paths (clues)', 'eventClues', 3, rp(50)),
      goal('keeper', 'Beat or best a Path Keeper', 'eventBossesWon', 1, rp(80)),
      goal('events', 'Finish 8 map events', 'eventsCompleted', 8, rp(70)),
    ],
    { researchPoints: 300, title: 'Pathfinder', pool: 'rare' }, '#58b0a0', 'item.scanner', ['exploration', 'secrets']),
  weekly('mystery-dungeon-week', 'Mystery Dungeon Week', 'A stair appears on the road that leads down to a dungeon whose rooms change every time. Take what you can and leave before your luck runs out.',
    'A Mystery Dungeon opens on the road: three floors, new rooms each time, traps, shops, monster houses and a boss.',
    [{ kind: 'xpMultiplier', value: 1.1 }],
    ['md-entrance', 'md-1-monster-house', 'md-1-trap-corridor', 'md-1-item-room', 'md-2-fork', 'md-2-shop', 'md-2-sleeping-den', 'md-3-boss-door', 'md-3-ambush', 'md-3-spring'],
    [
      goal('descend', 'Go down 3 floors (clues)', 'eventClues', 3, rp(50)),
      goal('boss', 'Beat the Dungeon Boss or Pack', 'eventBossesWon', 1, rp(100)),
      goal('out', 'Reach the surface again', 'eventFinalesWon', 1, rp(100)),
    ],
    { researchPoints: 400, title: 'Dungeon Delver', pool: 'spin-mystery-dungeon' }, '#6a60c0', 'item.mystery_egg', ['exploration', 'dungeon']),
  weekly('tower-of-legends', 'Tower of Legends', 'The Tower of Legends opens its doors to everyone. Five floors, each a different test, and a Legend at the top.',
    'The Tower of Legends has a door on every road: five floors that test resources, team, battle and endurance, with a Legendary at the top.',
    [{ kind: 'moneyMultiplier', value: 1.1 }],
    ['tower-week-entrance', 'tower-1', 'tower-2', 'tower-3', 'tower-4', 'tower-5'],
    [
      goal('climb', 'Climb 3 floors (clues)', 'eventClues', 3, rp(60)),
      goal('legend', 'Beat the Legend at the top', 'eventBossesWon', 1, rp(150)),
      goal('summit', 'Reach the summit', 'eventFinalesWon', 1, rp(120)),
    ],
    { researchPoints: 500, title: 'Legend Climber', pool: 'grand' }, '#a070e0', 'item.leaders_crest', ['legendary', 'tower']),
];

// Holiday and themed events (Untitled doc §16.4 and §17.2). Each owns map stops (tools/events/holidays.ts,
// `gameEvent`) whose clues, bosses and finales count toward its objectives. When an event is not in its
// window it still comes back from the Event Archive for a week now and then (core/gameEvents.ts).
const HOLIDAY_FALLBACK = { researchPoints: 200, candies: 15 };
const YEARLY: Json[] = [
  yearly('spooky-season', 'holiday', ['10-01', '11-07'], 'Spooky Season', 'The Spooky pack: haunted stops, Spooky forms in the wild, the Pumpkin King and the Midnight Parade.',
    'About 1 in 7 wild Pokémon turn into Spooky forms and Ghost-types appear twice as often; Spooky stops appear on the map.',
    [{ kind: 'spookyEncounters', chance: 0.15 }, { kind: 'typeEncounterWeight', type: 'ghost', value: 2 }],
    ['spooky-haunted-mansion', 'spooky-pumpkin-patch', 'spooky-candle-vigil', 'spooky-lost-spirit', 'spooky-trick-or-treat', 'spooky-graveyard-dig', 'spooky-pumpkin-king', 'spooky-midnight-finale', 'spooky-festival', 'ghost-train', 'haunted-house', 'graveyard-vigil'],
    [
      goal('stages', 'Clear 3 stages (beat 3 gym leaders)', 'gymLeadersDefeated', 3, rp(60)),
      goal('clues', 'Collect 8 clues at Spooky stops', 'eventClues', 8, { researchPoints: 60, candies: 10 }),
      goal('pumpkin-king', 'Beat a special boss (the Pumpkin King)', 'eventBossesWon', 1, rp(100)),
      goal('ghosts', 'Defeat or catch 15 Ghost-types', 'defeatedOrCaught.ghost', 15, rp(60)),
      goal('finale', 'Win the final encounter (the Midnight Parade)', 'eventFinalesWon', 1, rp(150)),
    ],
    { researchPoints: 400, title: 'Spooky Champion', pool: 'spooky', trainer: 'hex-maniac' }, '#ff7a1a', 'item.reaper_cloth', ['spooky', 'holiday', 'ghost']),
  yearly('harvest-festival', 'themed', ['11-14', '11-30'], 'Harvest Festival', 'Farmers bring in the harvest: berries, fairs and well-fed Pokémon.',
    'Healing items restore 20% more HP and Grass-types appear 50% more often.',
    [{ kind: 'healingMultiplier', value: 1.2 }, { kind: 'typeEncounterWeight', type: 'grass', value: 1.5 }],
    ['harvest-berry-fair', 'berry-patch', 'berry-tree', 'berries-abound', 'berry-merchant'],
    [
      goal('fairs', 'Find 4 clues at the Berry Fair and harvest stops', 'eventClues', 4, rp(50)),
      goal('grass', 'Defeat or catch 15 Grass-types', 'defeatedOrCaught.grass', 15, rp(60)),
      goal('events', 'Finish 8 map events', 'eventsCompleted', 8, rp(80)),
    ],
    { researchPoints: 300, candies: 20, title: 'Harvest Hero', pool: 'type-grass' }, '#d09030', 'item.sweet_apple', ['holiday', 'berries']),
  yearly('winter-festival', 'holiday', ['12-15', '01-05'], 'Winter Festival', 'Snow, lights and gifts for everyone. The Frost King waits on the road.',
    'Ice moves deal 15% more damage, Ice-types appear twice as often and prize money is 10% higher.',
    [{ kind: 'typeDamageMultiplier', type: 'ice', value: 1.15 }, { kind: 'typeEncounterWeight', type: 'ice', value: 2 }, { kind: 'moneyMultiplier', value: 1.1 }],
    ['winter-gift-exchange', 'winter-frost-king', 'frozen-lake', 'blizzard-pass', 'candice-snowball', 'ice-training'],
    [
      goal('gifts', 'Swap 4 gifts (clues at the Gift Exchange)', 'eventClues', 4, { researchPoints: 50, candies: 10 }),
      goal('frost-king', 'Beat the Frost King', 'eventBossesWon', 1, rp(100)),
      goal('ice', 'Defeat or catch 12 Ice-types', 'defeatedOrCaught.ice', 12, rp(60)),
      goal('badges', 'Win 4 gym badges', 'gymLeadersDefeated', 4, rp(80)),
    ],
    { researchPoints: 350, title: 'Winter Star', pool: 'type-ice' }, '#80c8ff', 'item.ice_stone', ['holiday', 'ice', 'gifts']),
  yearly('new-year-countdown', 'holiday', ['12-29', '01-07'], 'New Year Countdown', 'Ring in the new year with fireworks, wishes and one last big battle.',
    'Prize money is 25% higher; your Pokémon gain 10% more experience.',
    [{ kind: 'moneyMultiplier', value: 1.25 }, { kind: 'xpMultiplier', value: 1.1 }],
    ['new-year-countdown', 'lottery-booth', 'wishing-well', 'prize-wheel'],
    [
      goal('countdown', 'Win the Countdown battle', 'eventFinalesWon', 1, rp(100)),
      goal('earn', 'Earn ₽20,000', 'moneyEarned', 20000, rp(60)),
      goal('travel', 'Finish 30 encounters', 'encountersCompleted', 30, rp(60)),
    ],
    { researchPoints: 300, bankCredits: 2026, title: 'Fresh Start' }, '#f0d050', 'item.pair_of_tickets', ['holiday', 'money']),
  yearly('lunar-new-year', 'holiday', ['01-25', '02-12'], 'Lantern Festival', 'Red lanterns, dragon dances and lucky envelopes for the Lunar New Year.',
    'Fire and Dragon moves deal 10% more damage; prize money is 15% higher.',
    [{ kind: 'typeDamageMultiplier', type: 'fire', value: 1.1 }, { kind: 'typeDamageMultiplier', type: 'dragon', value: 1.1 }, { kind: 'moneyMultiplier', value: 1.15 }],
    ['lunar-lantern-walk', 'dragon-shrine', 'firebreather-show', 'dragons-den'],
    [
      goal('lanterns', 'Light 3 lanterns (clues on the Lantern Walk)', 'eventClues', 3, rp(50)),
      goal('dragons', 'Defeat or catch 8 Dragon-types', 'defeatedOrCaught.dragon', 8, rp(80)),
      goal('fire', 'Defeat or catch 12 Fire-types', 'defeatedOrCaught.fire', 12, rp(60)),
    ],
    { researchPoints: 300, title: 'Lucky Lantern', pool: 'type-fire' }, '#e03030', 'item.fire_stone', ['holiday', 'dragon', 'fire']),
  yearly('friendship-festival', 'holiday', ['02-07', '02-21'], 'Friendship Festival', 'A festival of hearts: picnics, sweets and teams that stick together.',
    'Your Pokémon gain 50% more friendship; Fairy-types appear 50% more often.',
    [{ kind: 'friendshipMultiplier', value: 1.5 }, { kind: 'typeEncounterWeight', type: 'fairy', value: 1.5 }],
    ['friendship-picnic', 'fairy-tea', 'bond-ceremony', 'wild-tea-party'],
    [
      goal('picnics', 'Share 3 picnics (clues)', 'eventClues', 3, rp(50)),
      goal('keep', 'Keep 6 caught Pokémon in your party', 'caughtKept', 6, rp(60)),
      goal('evolve', 'Evolve 4 Pokémon', 'evolutions', 4, rp(80)),
    ],
    { researchPoints: 300, candies: 20, title: 'Best Friends', pool: 'type-fairy' }, '#ff80b0', 'item.soothe_bell', ['holiday', 'friendship']),
  yearly('pokemon-day', 'themed', ['02-24', '03-03'], 'Anniversary Week', 'Celebrate where it all began: starters, parades and old friends.',
    'Your Pokémon gain 15% more experience and your starter deals 10% more damage.',
    [{ kind: 'xpMultiplier', value: 1.15 }, { kind: 'starterDamageMultiplier', starter: true, value: 1.1 }],
    ['pokemon-day-parade', 'professors-lab', 'gift-from-mom', 'ash-training'],
    [
      goal('parade', 'March in 2 parades (clues)', 'eventClues', 2, rp(50)),
      goal('starter', 'Clear a region with your starter still in the party', 'regionsClearedWithStarter', 1, rp(120)),
      goal('battles', 'Win 30 battles', 'battlesWon', 30, rp(60)),
    ],
    { researchPoints: 350, title: 'Day One Fan', pool: 'classic' }, '#f0c020', 'item.master_ribbon', ['themed', 'starters']),
  yearly('spring-bloom', 'holiday', ['03-20', '04-12'], 'Spring Bloom', 'Flowers open, eggs hide in the meadows and the Bloom Guardian wakes.',
    'Grass and Fairy-types appear 50% more often; Poké Balls work 10% better.',
    [{ kind: 'typeEncounterWeight', type: 'grass', value: 1.5 }, { kind: 'typeEncounterWeight', type: 'fairy', value: 1.5 }, { kind: 'captureMultiplier', value: 1.1 }],
    ['spring-egg-hunt', 'spring-bloom-guardian', 'cherry-blossom', 'flower-garden', 'egg-nest', 'lucky-egg-hunt'],
    [
      goal('eggs', 'Find 5 eggs (clues at the Egg Hunt)', 'eventClues', 5, { researchPoints: 50, candies: 10 }),
      goal('guardian', 'Beat the Bloom Guardian', 'eventBossesWon', 1, rp(100)),
      goal('catch', 'Catch 12 Pokémon', 'pokemonCaught', 12, rp(60)),
    ],
    { researchPoints: 300, title: 'Spring Sprout', pool: 'late-bloomers' }, '#90e070', 'item.mystery_egg', ['holiday', 'eggs', 'catching']),
  yearly('earth-week', 'themed', ['04-18', '04-28'], 'Earth Week', 'Clean up the routes and meet the Pokémon of rock, earth and forest.',
    'Ground, Rock and Grass-types appear 50% more often; research pays 20% more.',
    [{ kind: 'typeEncounterWeight', type: 'ground', value: 1.5 }, { kind: 'typeEncounterWeight', type: 'rock', value: 1.5 }, { kind: 'typeEncounterWeight', type: 'grass', value: 1.5 }, { kind: 'researchMultiplier', value: 1.2 }],
    ['earth-week-cleanup', 'volunteer-cleanup', 'fossil-dig', 'ancient-forest', 'trash-to-treasure'],
    [
      goal('cleanup', 'Help 3 cleanups (clues)', 'eventClues', 3, rp(50)),
      goal('ground', 'Defeat or catch 10 Ground-types', 'defeatedOrCaught.ground', 10, rp(60)),
      goal('rock', 'Defeat or catch 10 Rock-types', 'defeatedOrCaught.rock', 10, rp(60)),
    ],
    { researchPoints: 300, title: 'Earth Keeper', pool: 'type-ground' }, '#a08050', 'item.leaf_stone', ['themed', 'nature']),
  yearly('summer-splash', 'holiday', ['06-21', '07-20'], 'Summer Splash', 'Beaches, tide pools and the biggest beach tournament of the year.',
    'Water moves deal 15% more damage and Water-types appear twice as often.',
    [{ kind: 'typeDamageMultiplier', type: 'water', value: 1.15 }, { kind: 'typeEncounterWeight', type: 'water', value: 2 }],
    ['summer-beach-tournament', 'tide-pools', 'surf-rescue', 'misty-swim', 'fishing-derby', 'hot-spring'],
    [
      goal('tournament', 'Win the Beach Tournament', 'eventBossesWon', 1, rp(100)),
      goal('water', 'Defeat or catch 20 Water-types', 'defeatedOrCaught.water', 20, rp(60)),
      goal('events', 'Finish 6 map events', 'eventsCompleted', 6, rp(60)),
    ],
    { researchPoints: 300, title: 'Summer Splasher', pool: 'type-water' }, '#30b0f0', 'item.water_stone', ['holiday', 'water']),
  yearly('stargazing-nights', 'themed', ['08-08', '08-20'], 'Stargazing Nights', 'Meteor showers light the sky. Rare Pokémon come out to watch.',
    'Rare Pokémon turn up 50% more often and your Hyper moments come twice as often.',
    [{ kind: 'encounterWeightMultiplier', group: 'rare', value: 1.5 }, { kind: 'hyperChanceMultiplier', value: 2 }],
    ['stargazing-meteor-watch', 'meteor-shower', 'starry-camp', 'meteorite-crash', 'moonlit-path'],
    [
      goal('meteors', 'Chase 3 meteors (clues)', 'eventClues', 3, rp(50)),
      goal('psychic', 'Defeat or catch 10 Psychic-types', 'defeatedOrCaught.psychic', 10, rp(60)),
      goal('catch', 'Catch 10 Pokémon', 'pokemonCaught', 10, rp(60)),
    ],
    { researchPoints: 300, title: 'Stargazer', pool: 'type-psychic' }, '#6060e0', 'item.moon_stone', ['themed', 'rare']),
  yearly('trainer-academy', 'themed', ['09-01', '09-14'], 'Trainer Academy', 'Back to school! Exams on the road, study halls and tougher trainers.',
    'Research pays 25% more; trainers are 1 level higher.',
    [{ kind: 'researchMultiplier', value: 1.25 }, { kind: 'enemyLevelOffset', value: 1 }],
    ['academy-exam', 'study-hall', 'library', 'quiz-master', 'trainers-test'],
    [
      goal('exams', 'Pass 3 exams (clues)', 'eventClues', 3, rp(50)),
      goal('examiner', 'Beat an Academy Examiner', 'eventBossesWon', 1, rp(80)),
      goal('trainers', 'Beat 20 trainers', 'trainersDefeated', 20, rp(60)),
    ],
    { researchPoints: 350, title: 'Honor Student', pool: 'research' }, '#5080c0', 'item.wise_glasses', ['themed', 'research']),
];

const events = [...WEEKLY, ...YEARLY.map((e) => ({ ...e, fallbackReward: HOLIDAY_FALLBACK }))];
writeFileSync(new URL('../src/data/gameEvents.json', import.meta.url), JSON.stringify({ events }, null, 1) + '\n');
console.log(`gameEvents.json: ${events.length} game events (${WEEKLY.length} weekly, ${YEARLY.length} holiday/themed)`);
