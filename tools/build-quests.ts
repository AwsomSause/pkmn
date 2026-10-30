// Writes src/data/trainerQuests.json: a 5-step quest line for every trainer
// and the Run Quests offered on the briefing screen.
// Run with: npm run data:quests
//
// The first nine trainers have hand-written lines; the rest follow one
// template built from their signature type. Special trainers (Kice's answer 1:
// Red, Blue, Cynthia, Giovanni, N, Oak) end their line with a Trainer Evolution.
import { readFileSync, writeFileSync } from 'node:fs';

type Json = Record<string, unknown>;
const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const archetypes = data('archetypes.json') as { id: string; name: string; signatureTypes?: string[]; available?: boolean }[];
const pools = new Set((data('runPrep.json') as { starterPools: { id: string }[] }).starterPools.map((p) => p.id));

const SPECIAL = new Set(['red', 'blue', 'cynthia', 'giovanni', 'n', 'oak']);
const total = (counter: string, atLeast: number) => ({ kind: 'total', counter, atLeast });
const best = (counter: string, atLeast: number) => ({ kind: 'best', counter, atLeast });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const step = (goal: string, story: string, requirement: Json, reward: Json): Json => ({ goal, story, requirement, reward });

/** Hand-written lines: [goal, story, requirement, reward] for steps 1–5. */
const CUSTOM: Record<string, { name: string; steps: Json[] }> = {
  'hex-maniac': {
    name: 'The Hex Diaries',
    steps: [
      step('Defeat or catch 20 Ghost-types as Hex Maniac', '"They whisper my name. Fu fu fu."', total('defeatedOrCaught.ghost', 20), { researchPoints: 50, title: 'Hex Apprentice' }),
      step('Find 6 clues at Spooky stops as Hex Maniac', '"Every clue is a little curse undone."', total('eventClues', 6), { researchPoints: 75, candies: 10 }),
      step('Win 3 boss battles with a Ghost-type leading', '"My ghosts never miss a show."', total('bossWinsLead.ghost', 3), { candies: 10, bankCredits: 300 }),
      step('Beat 2 event bosses as Hex Maniac', '"Even the Pumpkin King bows to me."', total('eventBossesWon', 2), { researchPoints: 150, title: 'Curse Collector' }),
      step('Clear a region as Hex Maniac', '"The whole region is haunted now. Lovely."', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Queen of Hexes' }),
    ],
  },
  red: {
    name: 'The Silent Champion',
    steps: [
      step('Win 30 battles as Red', 'Red nods. Words were never needed.', total('battlesWon', 30), { researchPoints: 50, title: 'Quiet Challenger' }),
      step('Finish 2 Run Quests as Red', 'Every goal met, one step at a time.', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-red' }),
      step('Defeat 8 gym leaders as Red', 'Eight badges shine on the old cap.', total('gymLeadersDefeated', 8), { candies: 10, bankCredits: 300 }),
      step('Evolve 4 Pokémon in one run as Red', 'The team grows with its trainer.', best('evolutions', 4), { researchPoints: 150, title: 'Pallet Legend' }),
      step('Defeat a Champion as Red', 'At the top of Mt. Silver, a Champion waits for no one.', total('championsDefeated', 1), { researchPoints: 300, bankCredits: 500, title: 'Champion Red', evolution: true }),
    ],
  },
  blue: {
    name: 'Smell Ya Later',
    steps: [
      step('Defeat 15 trainers as Blue', '"Too easy! Who\'s next?"', total('trainersDefeated', 15), { researchPoints: 50, title: 'Know-It-All' }),
      step('Finish 2 Run Quests as Blue', '"See? I always finish what I start."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-blue' }),
      step('Defeat 6 gym leaders as Blue', '"Gym leaders? I eat them for breakfast."', total('gymLeadersDefeated', 6), { candies: 10, bankCredits: 300 }),
      step('Defeat 2 Elite Four members in one run as Blue', '"The Elite Four can\'t keep up with me!"', best('eliteFourDefeated', 2), { researchPoints: 150, title: 'Viridian Ace' }),
      step('Clear a region as Blue', '"Smell ya later, everyone. I\'m the best!"', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Rival Blue', evolution: true }),
    ],
  },
  green: {
    name: 'The Collector',
    steps: [
      step('Catch 15 Pokémon as Green', 'Every catch goes in the notebook.', total('pokemonCaught', 15), { researchPoints: 50, title: 'Notebook Keeper' }),
      step('Finish 2 Run Quests as Green', 'A plan, followed to the letter.', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-green' }),
      step('Catch 6 Pokémon in one run as Green', 'A full box in one trip.', best('pokemonCaught', 6), { candies: 10, bankCredits: 300 }),
      step('Find a shiny Pokémon as Green', 'It sparkles. Green smiles.', total('shiniesFound', 1), { researchPoints: 150, title: 'Shiny Hunter' }),
      step('Clear a region as Green', 'The notebook is full of stories now.', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Master Collector' }),
    ],
  },
  brock: {
    name: 'Rock-Solid Will',
    steps: [
      step('Defeat or catch 25 Rock-types as Brock', '"A rock is patient. So am I."', total('defeatedOrCaught.rock', 25), { researchPoints: 50, title: 'Pewter Hopeful' }),
      step('Finish 2 Run Quests as Brock', '"One stone at a time builds a mountain."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-brock' }),
      step('Win 3 boss battles with a Rock-type leading', '"Rock-solid defence wins the day!"', total('bossWinsLead.rock', 3), { candies: 10, bankCredits: 300 }),
      step('Heal at 5 healing stops as Brock', '"A good breeder always cares for the team."', total('healStopsUsed', 5), { researchPoints: 150, title: 'Pokémon Doctor' }),
      step('Clear a region as Brock', '"The mountain is climbed. Time for a bigger one."', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Rock Master' }),
    ],
  },
  misty: {
    name: 'Tidecaller',
    steps: [
      step('Defeat or catch 25 Water-types as Misty', '"My policy is an all-out offensive!"', total('defeatedOrCaught.water', 25), { researchPoints: 50, title: 'Cerulean Hopeful' }),
      step('Finish 2 Run Quests as Misty', '"Ride the current, don\'t fight it."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-misty' }),
      step('Win 3 boss battles with a Water-type leading', '"The tide always comes back stronger!"', total('bossWinsLead.water', 3), { candies: 10, bankCredits: 300 }),
      step('Defeat or catch 20 Water-types in one run', '"The whole sea is on my side."', best('defeatedOrCaught.water', 20), { researchPoints: 150, title: 'Tidecaller' }),
      step('Clear a region as Misty', '"Tomboyish mermaid? Try Water Master."', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Water Master' }),
    ],
  },
  giovanni: {
    name: 'The Boss Returns',
    steps: [
      step('Defeat or catch 25 Ground-types as Giovanni', '"The earth bends to my will."', total('defeatedOrCaught.ground', 25), { researchPoints: 50, title: 'Rocket Recruit' }),
      step('Earn ₽30,000 as Giovanni', '"Money is power. Power is everything."', total('moneyEarned', 30000), { researchPoints: 75, pool: 'trainer-giovanni' }),
      step('Win 3 boss battles with a Ground-type leading', '"Leaders kneel before the Boss."', total('bossWinsLead.ground', 3), { candies: 10, bankCredits: 300 }),
      step('Finish 3 Run Quests as Giovanni', '"Every plan succeeds, eventually."', total('runQuestsDone', 3), { researchPoints: 150, title: 'Rocket Executive' }),
      step('Defeat a Champion as Giovanni', '"Team Rocket rises again. This time, for good."', total('championsDefeated', 1), { researchPoints: 300, bankCredits: 500, title: 'Rocket Boss', evolution: true }),
    ],
  },
  cynthia: {
    name: 'Myths of Sinnoh',
    steps: [
      step('Defeat or catch 25 Dragon-types as Cynthia', '"Dragons are the stuff of legend. Let\'s meet them."', total('defeatedOrCaught.dragon', 25), { researchPoints: 50, title: 'Myth Seeker' }),
      step('Finish 2 Run Quests as Cynthia', '"Research is patient work."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-cynthia' }),
      step('Win 3 boss battles with a Dragon-type leading', '"A dragon\'s roar shakes any gym."', total('bossWinsLead.dragon', 3), { candies: 10, bankCredits: 300 }),
      step('Complete 8 map events as Cynthia', '"Every ruin tells a story."', total('eventsCompleted', 8), { researchPoints: 150, title: 'Archaeologist' }),
      step('Defeat a Champion as Cynthia', '"A Champion who still seeks. That is the real legend."', total('championsDefeated', 1), { researchPoints: 300, bankCredits: 500, title: 'Champion Cynthia', evolution: true }),
    ],
  },
  oak: {
    name: 'The Complete Pokédex',
    steps: [
      step('See 60 different Pokémon', '"Ah, a new entry! Wonderful!"', { kind: 'distinct', set: 'speciesSeen', atLeast: 60 }, { researchPoints: 75, title: 'Field Researcher' }),
      step('Finish 2 Run Quests as Oak', '"Science rewards a careful hand."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-oak' }),
      step('Catch 25 Pokémon as Oak', '"Every catch teaches us something."', total('pokemonCaught', 25), { candies: 10, bankCredits: 300 }),
      step('Catch 60 different Pokémon', '"Half a Pokédex! My old notes can\'t keep up."', { kind: 'distinct', set: 'speciesCaught', atLeast: 60 }, { researchPoints: 150, title: 'Pokédex Scholar' }),
      step('Clear a region as Oak', '"Not bad for an old man, eh? Back to the field!"', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'Professor Emeritus', evolution: true }),
    ],
  },
  n: {
    name: 'Truths and Ideals',
    steps: [
      step('Catch 15 Pokémon as N', '"They chose to come with me. I can hear it."', total('pokemonCaught', 15), { researchPoints: 50, title: 'Friend of Pokémon' }),
      step('Finish 2 Run Quests as N', '"Ideals need action."', total('runQuestsDone', 2), { researchPoints: 75, pool: 'trainer-n' }),
      step('Keep 8 caught Pokémon in your party as N', '"A team is a family."', total('caughtKept', 8), { candies: 10, bankCredits: 300 }),
      step('Complete 8 map events as N', '"The world is full of voices."', total('eventsCompleted', 8), { researchPoints: 150, title: 'Listener' }),
      step('Clear a region as N', '"Truth and ideals, side by side. I understand now."', total('regionsCleared', 1), { researchPoints: 300, bankCredits: 500, title: 'King N', evolution: true }),
    ],
  },
};

function templateLine(a: { id: string; name: string; signatureTypes?: string[] }): { name: string; steps: Json[] } {
  const type = a.signatureTypes?.[0];
  const pool = pools.has(`trainer-${a.id}`) ? `trainer-${a.id}` : undefined;
  const second = step(`Finish 2 Run Quests as ${a.name}`, `${a.name} checks off another goal.`, total('runQuestsDone', 2), { researchPoints: 75, ...(pool ? { pool } : {}) });
  const last = step(`Clear a region as ${a.name}`, `${a.name}'s journey reaches its peak.`, total('regionsCleared', 1), {
    researchPoints: 300,
    bankCredits: 500,
    title: `${a.name}, Master`,
    ...(SPECIAL.has(a.id) ? { evolution: true } : {}),
  });
  if (type) {
    const T = cap(type);
    return {
      name: `${a.name}'s ${T} Path`,
      steps: [
        step(`Defeat or catch 25 ${T}-types as ${a.name}`, `${a.name} feels the ${T}-type spirit grow.`, total(`defeatedOrCaught.${type}`, 25), { researchPoints: 50, title: `${a.name}'s Apprentice` }),
        second,
        step(`Win 3 boss battles with a ${T}-type leading`, `The ${T}-types roar in victory.`, total(`bossWinsLead.${type}`, 3), { candies: 10, bankCredits: 300 }),
        step(`Defeat or catch 20 ${T}-types in one run`, `A whole run of ${T}-types. Impressive.`, best(`defeatedOrCaught.${type}`, 20), { researchPoints: 150, title: `${T} Expert` }),
        last,
      ],
    };
  }
  return {
    name: `${a.name}'s Journey`,
    steps: [
      step(`Defeat 15 trainers as ${a.name}`, `${a.name} has made a name on the road.`, total('trainersDefeated', 15), { researchPoints: 50, title: `${a.name}'s Apprentice` }),
      second,
      step(`Defeat 5 gym leaders as ${a.name}`, 'The badge case fills up.', total('gymLeadersDefeated', 5), { candies: 10, bankCredits: 300 }),
      step(`Catch 6 Pokémon in one run as ${a.name}`, 'A big team, ready for anything.', best('pokemonCaught', 6), { researchPoints: 150, title: 'Seasoned Trainer' }),
      last,
    ],
  };
}

const lines = archetypes
  .filter((a) => a.available !== false)
  .map((a) => ({ trainerId: a.id, ...(CUSTOM[a.id] ?? templateLine(a)) }));

const rq = (id: string, text: string, counter: string, atLeast: number, researchPoints: number) => ({ id, text, counter, atLeast, researchPoints });
const runQuests = [
  rq('evolve-3', 'Evolve 3 Pokémon this run', 'evolutions', 3, 40),
  rq('catch-5', 'Catch 5 Pokémon this run', 'pokemonCaught', 5, 30),
  rq('keep-3', 'Add 3 caught Pokémon to your party', 'caughtKept', 3, 30),
  rq('trainers-8', 'Defeat 8 trainers this run', 'trainersDefeated', 8, 40),
  rq('gyms-2', 'Defeat 2 gym leaders this run', 'gymLeadersDefeated', 2, 50),
  rq('gyms-4', 'Defeat 4 gym leaders this run', 'gymLeadersDefeated', 4, 80),
  rq('wild-20', 'Defeat 20 wild Pokémon this run', 'wildDefeated', 20, 30),
  rq('battles-30', 'Win 30 battles this run', 'battlesWon', 30, 50),
  rq('events-4', 'Complete 4 map events this run', 'eventsCompleted', 4, 40),
  rq('money-5000', 'Earn ₽5,000 this run', 'moneyEarned', 5000, 40),
  rq('candies-10', 'Earn 10 candies this run', 'candiesEarned', 10, 30),
  rq('boosts-10', 'Raise your Pokémon\'s stats 10 times with moves', 'statsBoosted', 10, 30),
  rq('shiny-1', 'Find a shiny Pokémon this run', 'shiniesFound', 1, 100),
  rq('elite-1', 'Defeat an Elite Four member this run', 'eliteFourDefeated', 1, 80),
  rq('region-starter', 'Clear a region with your starter still in the party', 'regionsClearedWithStarter', 1, 100),
  rq('heal-3', 'Use 3 healing stops this run', 'healStopsUsed', 3, 20),
  rq('water-8', 'Defeat or catch 8 Water-types this run', 'defeatedOrCaught.water', 8, 30),
  rq('bug-8', 'Defeat or catch 8 Bug-types this run', 'defeatedOrCaught.bug', 8, 30),
  rq('flying-8', 'Defeat or catch 8 Flying-types this run', 'defeatedOrCaught.flying', 8, 30),
  rq('normal-10', 'Defeat or catch 10 Normal-types this run', 'defeatedOrCaught.normal', 10, 30),
  rq('grass-8', 'Defeat or catch 8 Grass-types this run', 'defeatedOrCaught.grass', 8, 30),
  rq('ghost-5', 'Defeat or catch 5 Ghost-types this run', 'defeatedOrCaught.ghost', 5, 40),
];

writeFileSync(new URL('../src/data/trainerQuests.json', import.meta.url), JSON.stringify({ lines, runQuests }, null, 1) + '\n');
console.log(`trainerQuests.json: ${lines.length} quest lines, ${runQuests.length} Run Quests`);
