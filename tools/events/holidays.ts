// Holiday and themed event stops (plan Part 4b, Untitled doc §16.4 and §17.2). Each belongs to a game
// event in gameEvents.json (`gameEvent`), so it only turns up in runs started while that event is on
// (or while it is back from the Event Archive). Their "count" effects feed the event's objectives:
// clues found, event bosses beaten and the finale won.

import { $, BERRIES, SNACKS, TREASURE, any, attr, ch, ev, fight, fr, good, heal, hurt, item, join, lv, out, rp, trainer, wild, type Json } from './dsl.ts';

const G = 'Holiday events';
const clue = (amount = 1): Json => ({ kind: 'count', counter: 'eventClues', amount });
const boss = (): Json => ({ kind: 'count', counter: 'eventBossesWon', amount: 1 });
const finale = (): Json => ({ kind: 'count', counter: 'eventFinalesWon', amount: 1 });

/** The 15 Spooky forms by first stage (custom forms, tools/custom-forms.json). */
const SPOOKY = ['litwick-spooky', 'timburr-spooky', 'emolga-spooky', 'snorunt-spooky', 'ponyta-spooky', 'sinistea-spooky', 'tangela-spooky'];
const S = { gameEvent: 'spooky-season' };

export const HOLIDAY_EVENTS: Json[] = [
  // ---------- Spooky Season: the Spooky pack ----------
  ev('spooky-haunted-mansion', 'The Haunted Mansion', G, { ...S, types: ['ghost'], cast: ['trainer.hex_maniac'], effect: 'fog', tint: '#1a0f24' }, 'One window of the old mansion glows orange. Something giggles behind the door.', [
    ch('Explore the halls', out('Behind a painting you find a clue, and a Spooky friend.', clue(), join({ species: SPOOKY })), { check: 'intelligence', fail: fight('A ghost leaps from the wardrobe!', wild({ types: ['ghost'], lv: 2, win: [clue()] })) }),
    ch('Knock politely', out('A voice whispers a clue and slips you a charm.', clue(), item('spell-tag'))),
  ]),
  ev('spooky-pumpkin-patch', 'The Pumpkin Patch', G, { ...S, types: ['ghost', 'grass'], effect: 'fire', tint: '#2a1408' }, 'Rows of carved pumpkins flicker. One of them blinks.', [
    ch('Pick the blinking pumpkin', out('It was a Spooky Pokémon all along!', clue(), join({ species: ['ponyta-spooky', 'tangela-spooky'] })), { chance: 0.5, fail: out('Just a pumpkin… with a clue carved inside.', clue()) }),
    ch('Carve lanterns together', out('Your team laughs the night away.', clue(), fr(5))),
  ]),
  ev('spooky-candle-vigil', 'The Candle Vigil', G, { ...S, types: ['ghost', 'fire'], pokemon: 'litwick-spooky', effect: 'flicker', tint: '#180c20' }, 'A circle of candles burns in the dark. One of them is watching you.', [
    ch('Light a candle', out('The watching candle hops into your bag.', clue(), join({ species: ['litwick-spooky'] }))),
    ch('Blow them out', fight('The candles flare up and attack!', wild({ species: ['litwick-spooky'], lv: 2, win: [clue(2)] }))),
  ]),
  ev('spooky-lost-spirit', 'The Lost Spirit', G, { ...S, types: ['ghost'], pokemon: 'sinistea-spooky', effect: 'fog', tint: '#101828' }, 'A little teacup spirit floats in circles, lost.', [
    ch('Guide it home', out('It thanks you with two clues.', clue(2), good(2))),
    ch('Follow it into the fog', fight('It leads you to its angry friends!', wild({ species: ['sinistea-spooky', 'snorunt-spooky'], lv: 2, win: [clue()] }))),
  ]),
  ev('spooky-trick-or-treat', 'Trick or Treat!', G, { ...S, cast: ['trainer.hex_maniac'], effect: 'sparkle', tint: '#2a1030' }, 'Costumed kids hold out their bags. "Trick or treat!"', [
    ch('Hand out treats', out('They share a clue they found.', clue(), any(...SNACKS), good(1))),
    ch('Play a trick', out('Perfect trick! They pay up.', clue(), $(600)), { check: 'luck', fail: out('The trick backfires. Boo!', clue(), hurt(0.1)) }),
  ]),
  ev('spooky-graveyard-dig', 'The Moonlit Graveyard', G, { ...S, types: ['ghost', 'fighting'], pokemon: 'timburr-spooky', effect: 'fog', tint: '#0c1018' }, 'Someone is digging by the old gate, carrying a ghostly beam.', [
    ch('Help dig', out('You dig up a clue and a rare treat.', clue(), item('rare-candy'))),
    ch('Challenge the digger', fight('A Spooky Timburr swings its beam!', wild({ species: ['timburr-spooky'], lv: 3, win: [clue(), item('spell-tag')] }))),
  ]),
  ev('spooky-pumpkin-king', 'The Pumpkin King', G, { ...S, rarity: 'uncommon', minStage: 2, types: ['ghost', 'grass'], cast: ['trainer.hex_maniac'], effect: 'fire', tint: '#301000' }, 'A towering figure with a lantern head blocks the road. "Only the brave pass my patch!"', [
    ch('Face the Pumpkin King', fight('The Pumpkin King summons his court!', trainer('The Pumpkin King', { cls: 'hex-maniac', types: ['ghost', 'grass'], size: 3, lv: 4, win: [boss(), rp(30), join({ species: SPOOKY, lv: 2 })] }))),
    ch('Offer a treat to pass', out('He takes it and grumbles. A clue falls from his cape.', clue(), any(...BERRIES))),
  ]),
  ev('spooky-midnight-finale', 'The Midnight Parade', G, { ...S, rarity: 'rare', minStage: 3, types: ['ghost'], cast: ['trainer.hex_maniac'], effect: 'flicker', tint: '#14001e' }, 'At midnight the Hex Coven leads the last parade of Spooky Season.', [
    ch('Join the final battle', fight('The Coven calls every ghost in town!', trainer('Hex Coven', { cls: 'hex-maniac', types: ['ghost'], size: 4, lv: 6, win: [finale(), rp(60), join({ species: SPOOKY, lv: 3, shiny: 3 })] }))),
    ch('Watch from the side', out('The parade glows past. You note a clue.', clue(), heal(0.5))),
  ]),

  // ---------- other holidays and themed events ----------
  ev('harvest-berry-fair', 'The Berry Fair', G, { gameEvent: 'harvest-festival', types: ['grass'], effect: 'sparkle', tint: '#2a2008' }, 'Farmers show off the biggest berries of the year.', [
    ch('Enter the berry contest', out('First prize, and a farmer\'s tip.', clue(), any(...BERRIES), any(...BERRIES)), { check: 'charisma', fail: out('Second place still gets a berry and a tip.', clue(), any(...BERRIES)) }),
    ch('Help with the harvest', out('Hard work pays.', clue(), $(500), fr(3))),
  ]),
  ev('winter-gift-exchange', 'The Gift Exchange', G, { gameEvent: 'winter-festival', types: ['ice'], effect: 'snow', tint: '#0c1a2c' }, 'Under a glowing tree, trainers swap wrapped gifts.', [
    ch('Open a gift', out('A cozy surprise, and a tag with a clue.', clue(), any(...SNACKS), item('rare-candy'))),
    ch('Give a gift', out('Their smile warms the snow.', clue(2), good(2))),
  ]),
  ev('winter-frost-king', 'The Frost King', G, { gameEvent: 'winter-festival', rarity: 'uncommon', minStage: 2, types: ['ice'], cast: ['trainer.snow_worker_m'], effect: 'snow', tint: '#081828' }, 'A snow worker crowned with icicles challenges every passer-by.', [
    ch('Accept the challenge', fight('The Frost King\'s team storms in!', trainer('The Frost King', { cls: 'snow-worker', types: ['ice'], size: 3, lv: 4, win: [boss(), rp(30), $(800)] }))),
    ch('Build a snowman instead', out('He laughs and lets you pass.', clue(), fr(3))),
  ]),
  ev('new-year-countdown', 'The Countdown', G, { gameEvent: 'new-year-countdown', rarity: 'uncommon', minStage: 2, effect: 'sparkle', tint: '#100820' }, 'Fireworks wait for midnight. A trainer wants one last battle of the year.', [
    ch('Battle at the countdown', fight('3… 2… 1… battle!', trainer('Countdown Trainer', { types: [], size: 3, lv: 4, win: [finale(), $(2026)] }))),
    ch('Watch the fireworks', out('A bright start. You make a wish.', clue(), attr('luck', 2))),
  ]),
  ev('lunar-lantern-walk', 'The Lantern Walk', G, { gameEvent: 'lunar-new-year', types: ['fire', 'dragon'], effect: 'fire', tint: '#300808' }, 'Red lanterns line the street. A dragon dance winds between them.', [
    ch('Follow the dragon dance', out('Lucky red envelopes rain down.', clue(), $(888))),
    ch('Light a lantern', out('Your wish floats up with a clue.', clue(), attr('luck', 1))),
  ]),
  ev('friendship-picnic', 'The Friendship Picnic', G, { gameEvent: 'friendship-festival', types: ['fairy', 'normal'], effect: 'hearts', tint: '#301020' }, 'Blankets, sweets and Pokémon everywhere. Someone left you a seat.', [
    ch('Share sweets with your team', out('Your team has never been closer.', clue(), fr(10))),
    ch('Trade stories', out('A new friend wants to come along.', clue(), join({ types: ['fairy', 'normal'] }))),
  ]),
  ev('pokemon-day-parade', 'The Anniversary Parade', G, { gameEvent: 'pokemon-day', effect: 'sparkle', tint: '#202008' }, 'A parade of every kind of Pokémon marches through town.', [
    ch('March with your starter', out('The crowd cheers for your partner.', clue(), fr(5, 'lead'), lv(1))),
    ch('Hand out flyers', out('The organisers pay you and share a clue.', clue(), $(700))),
  ]),
  ev('spring-egg-hunt', 'The Egg Hunt', G, { gameEvent: 'spring-bloom', types: ['grass', 'fairy'], effect: 'sparkle', tint: '#183018' }, 'Painted eggs are hidden all over the meadow.', [
    ch('Search the meadow', out('A basket full of eggs and clues!', clue(2), any(...BERRIES)), { check: 'luck', fail: out('Just one egg, but it counts.', clue()) }),
    ch('Help the little ones find theirs', out('Everyone goes home happy.', clue(), good(2))),
  ]),
  ev('spring-bloom-guardian', 'The Bloom Guardian', G, { gameEvent: 'spring-bloom', rarity: 'uncommon', minStage: 2, types: ['grass', 'fairy'], effect: 'sparkle', tint: '#103018' }, 'A huge flower Pokémon guards the first bloom of spring.', [
    ch('Prove yourself', fight('The guardian blooms with power!', wild({ types: ['grass', 'fairy'], lv: 4, shiny: 2, win: [boss(), rp(30)] }))),
    ch('Admire the bloom', out('Its scent heals your team.', clue(), heal(1))),
  ]),
  ev('earth-week-cleanup', 'The Big Cleanup', G, { gameEvent: 'earth-week', types: ['ground', 'grass'], effect: 'none', tint: '#182010' }, 'Volunteers are clearing litter from a riverbank.', [
    ch('Pitch in', out('The river sparkles again.', clue(), good(3), $(300))),
    ch('Dig for buried junk', out('You find something valuable.', clue(), any(...TREASURE))),
  ]),
  ev('summer-beach-tournament', 'The Beach Tournament', G, { gameEvent: 'summer-splash', rarity: 'uncommon', minStage: 2, types: ['water'], effect: 'none', tint: '#082838' }, 'A sandcastle stadium hosts the summer\'s biggest beach battle.', [
    ch('Enter the tournament', fight('The beach champion dives in!', trainer('Beach Champion', { cls: 'fisherman', types: ['water'], size: 3, lv: 4, win: [boss(), $(1200)] }))),
    ch('Build a sandcastle', out('You win the sandcastle prize.', clue(), any(...SNACKS))),
  ]),
  ev('stargazing-meteor-watch', 'The Meteor Watch', G, { gameEvent: 'stargazing-nights', types: ['psychic', 'fairy'], effect: 'sparkle', tint: '#080820' }, 'Stargazers lie in the grass. A meteor streaks overhead.', [
    ch('Chase the meteor', out('Where it landed: a shard and a clue.', clue(), any('stardust', 'star-piece', 'comet-shard')), { check: 'speed', fail: out('Gone, but you mapped where it fell.', clue()) }),
    ch('Make a wish', out('You feel lucky.', clue(), attr('luck', 2))),
  ]),
  ev('academy-exam', 'The Academy Exam', G, { gameEvent: 'trainer-academy', types: ['psychic'], cast: ['trainer.psychic_m'], effect: 'glint', tint: '#101830' }, 'The Trainer Academy holds an open exam on the road.', [
    ch('Take the written test', out('Top marks!', clue(), rp(20)), { check: 'intelligence', fail: out('A pass, just about.', clue()) }),
    ch('Take the battle test', fight('The examiner sends out a team!', trainer('Academy Examiner', { cls: 'psychic', size: 3, lv: 3, win: [boss(), rp(20)] }))),
  ]),
];
