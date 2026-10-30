// Writes src/data/gameEvents.json: the weekly game events (Untitled doc §17.2, plan Part 4b).
// Run with: npm run data:game-events
//
// Weekly events rotate by ISO week (core/gameEvents.ts). Each has a themed ruleset (trainer
// modifiers added to every run started that week), 3–5 milestone objectives counted over the
// week's runs, a permanent reward the first time every objective is done, and a fallback reward
// after that. Holiday and themed events are added to the same file.
import { readFileSync, writeFileSync } from 'node:fs';

type Json = Record<string, unknown>;
const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const pools = new Set((data('runPrep.json') as { starterPools: { id: string }[] }).starterPools.map((p) => p.id));
const mapEvents = new Set((data('events.json') as { events: { id: string }[] }).events.map((e) => e.id));

const goal = (id: string, text: string, counter: string, atLeast: number, reward: Json): Json => ({ id, text, counter, atLeast, reward });
const rp = (researchPoints: number): Json => ({ researchPoints });
const FALLBACK = { researchPoints: 150, candies: 10 };

function weekly(id: string, name: string, description: string, ruleText: string, modifiers: Json[], featured: string[], objectives: Json[], reward: Json, color: string, icon: string, tags: string[]): Json {
  for (const e of featured) if (!mapEvents.has(e)) throw new Error(`${id}: unknown map event "${e}"`);
  if (reward.pool && !pools.has(reward.pool as string)) throw new Error(`${id}: unknown pool "${reward.pool}"`);
  return {
    id,
    version: 1,
    name,
    kind: 'weekly',
    description,
    schedule: { kind: 'weeklyRotation' },
    seedRule: 'isoWeek',
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
];

const events = [...WEEKLY];
writeFileSync(new URL('../src/data/gameEvents.json', import.meta.url), JSON.stringify({ events }, null, 1) + '\n');
console.log(`gameEvents.json: ${events.length} game events (${WEEKLY.length} weekly)`);
