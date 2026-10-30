// Key-item events: each ticket, key and story item in the item catalog
// ("needs events") opens one stop on the next stage while you hold it, and is
// used up there. A Lost Property office hands some of them out.

import { $, HELD, TREASURE, any, ch, ev, fierce, fight, fr, heal, item, join, leave, out, trainer, wild, attr, type Json } from './dsl.ts';

const K = 'Key items and tickets';
const RARE = ['leftovers', 'focus-sash', 'choice-band', 'choice-specs', 'choice-scarf', 'life-orb', 'eviolite', 'rocky-helmet'];
const UNCOMMON = ['silk-scarf', 'black-belt', 'sharp-beak', 'soft-sand', 'hard-stone', 'spell-tag', 'metal-coat', 'charcoal', 'mystic-water', 'miracle-seed', 'magnet', 'scope-lens', 'expert-belt', 'muscle-band'];
const EPIC = ['relic-statue', 'relic-crown', 'ruby', 'sapphire', 'sacred-ash'];

/** A legendary waits: battle it (and catch it) or leave. */
const legend = (id: string, name: string, key: string, species: string[], o: { cast?: string[]; tint?: string; effect?: string; intro: string; lv?: number }): Json =>
  ev(id, name, K, { keyItem: key, rarity: 'epic', pokemon: species[0], tint: o.tint ?? '#101830', effect: o.effect ?? 'glint', cast: o.cast ?? [] }, o.intro, [
    ch('Step forward', fight('A legendary Pokémon appears!', wild({ species, lv: o.lv ?? 4, shiny: 2 }))),
    ch('Leave an offering and go', out('It watches you leave. You feel blessed.', heal(), attr('luck', 3))),
  ]);

export const KEY_EVENTS: Json[] = [
  legend('oaks-letter-birds', "Oak's Letter: The Sky Trio", 'oaks-letter', ['articuno', 'zapdos', 'moltres'], { cast: ['boss.oak'], effect: 'float', intro: 'The letter leads to a cliff. Wings beat overhead: a legendary bird of Kanto.' }),
  ev('ss-ticket-ferry', 'S.S. Ticket: The Ferry', K, { keyItem: 'ss-ticket', rarity: 'rare', effect: 'float', tint: '#103050' }, 'The S.S. Anne sounds its horn. "All aboard for the gym city!"', [
    ch('Ride the ferry', out('You step off right beside the gym, and the ship\'s shop is open.', { kind: 'skipAhead' }, { kind: 'addStop', stop: 'shop' })),
    ch('Shop on board, then walk', out('The deck shop has fair prices.', { kind: 'addStop', stop: 'shop' }, $(300))),
  ]),
  ev('card-key-silph', 'Card Key: Silph Doors', K, { keyItem: 'card-key', rarity: 'uncommon', cast: ['trainer.worker_m'], effect: 'glint' }, 'A Silph Co. door clicks open. A crate of prototypes sits inside.', [
    ch('Take one', out('A Silph prototype!', any(...RARE))),
  ]),
  ev('secret-key-volcano', 'Secret Key: Hidden Volcano', K, { keyItem: 'secret-key', rarity: 'rare', effect: 'fire', tint: '#401008' }, 'The Secret Key opens a gate on Cinnabar\'s slope. Something hot stirs.', [
    ch('Go in', fight('A rare Fire-type!', wild({ types: ['fire'], lv: 3, shiny: 3 }))),
    ch('Search the lab instead', out('Old notes and a pouch of coins.', $(1200), attr('intelligence', 2))),
  ]),
  ev('lift-key-hideout', 'Lift Key: Rocket Hideout', K, { keyItem: 'lift-key', rarity: 'uncommon', cast: ['trainer.giovanni'], effect: 'flicker', tint: '#200810' }, 'The lift drops to the Rocket hideout\'s vault floor.', [
    ch('Fight for the vault', fight('Rockets guard the money!', trainer('Rocket Admin', { types: ['poison', 'dark'], size: 3, lv: 2, win: [$(3000)] })), { requires: [fierce] }),
    ch('Sneak to the vault', out('You slip in and out.', $(1500)), { check: 'speed', fail: fight('Spotted!', trainer('Rocket Grunt', { types: ['poison'], size: 2, lv: 1, win: [$(1000)] })) }),
  ]),
  ev('basement-key-tunnel', 'Basement Key: Old Tunnels', K, { keyItem: 'basement-key', rarity: 'uncommon', effect: 'shake', tint: '#302010' }, 'Under the Goldenrod basement, the tunnels rumble.', [
    ch('Dig deeper', fight('A rare Ground or Rock Pokémon!', wild({ types: ['ground', 'rock'], lv: 3, shiny: 3 }))),
    ch('Pick up what fell', out('Shards in the dust.', any(...TREASURE))),
  ]),
  ev('storage-key-room', 'Storage Key: The Warehouse', K, { keyItem: 'storage-key', rarity: 'uncommon', effect: 'rattle' }, 'Boxes from floor to ceiling. Some are labelled for you.', [
    ch('Open three boxes', out('Three items!', any(...UNCOMMON), any(...TREASURE), any('potion', 'super-potion', 'great-ball', 'ultra-ball'))),
  ]),
  ev('suite-key-rest', 'Suite Key: Luxury Suite', K, { keyItem: 'suite-key', rarity: 'uncommon', effect: 'hearts', tint: '#402838' }, 'A suite with soft beds and a view. Your team flops down.', [
    ch('Rest in style', out('Fully rested and looking sharp.', heal(), { kind: 'cure' }, attr('charisma', 2), fr(5))),
  ]),
  ev('works-key-plant', 'Works Key: Power Plant', K, { keyItem: 'works-key', rarity: 'uncommon', effect: 'sparkle', tint: '#303008' }, 'The old power plant crackles. Sparks dance between the coils.', [
    ch('Follow the sparks', fight('A rare Electric-type!', wild({ types: ['electric'], lv: 3, shiny: 3 }))),
    ch('Fix a generator', out('The town thanks you.', $(800), attr('intelligence', 2)), { check: 'intelligence', fail: out('Zap! Ouch.', { kind: 'damage', share: 0.15 }) }),
  ]),
  ev('rm-1-key-cabin', 'Room 1 Key: Abandoned Ship', K, { keyItem: 'rm-1-key', rarity: 'common', effect: 'fog', tint: '#182028' }, 'Cabin 1 creaks open. A dusty trunk sits under the porthole.', [
    ch('Open the trunk', out('Something useful inside.', any(...UNCOMMON))),
  ]),
  ev('rm-2-key-cabin', 'Room 2 Key: Abandoned Ship', K, { keyItem: 'rm-2-key', rarity: 'common', cast: ['trainer.fisherman'], effect: 'fog', tint: '#182028' }, 'A sailor in cabin 2 jumps up. "A battle! Winner takes double!"', [
    ch('Battle', fight('The sailor sends out his team!', trainer('Sailor', { types: ['water', 'fighting'], size: 2, lv: 1, win: [$(2000)] }))),
    ch('Back out', leave('You close the door quietly.')),
  ]),
  ev('rm-4-key-cabin', 'Room 4 Key: Abandoned Ship', K, { keyItem: 'rm-4-key', rarity: 'common', effect: 'flicker', tint: '#100818' }, 'Cabin 4 is cold. A shadow slides across the wall.', [
    ch('Face it', fight('A Ghost-type!', wild({ types: ['ghost'], lv: 2, shiny: 2 }))),
    ch('Run!', out('You slam the door. Your heart races.', attr('speed', 1))),
  ]),
  ev('rm-6-key-cabin', 'Room 6 Key: The Scanner', K, { keyItem: 'rm-6-key', rarity: 'common', effect: 'glint', tint: '#182028' }, 'In cabin 6 you find a Scanner. A collector on deck offers a trade for it.', [
    ch('Trade the Scanner', out('The collector hands over a treasure.', any(...EPIC))),
    ch('Sell it for cash', out('Easy money.', $(2500))),
  ]),
  ev('galactic-key-hq', 'Galactic Key: Veilstone HQ', K, { keyItem: 'galactic-key', rarity: 'uncommon', cast: ['boss.cyrus'], effect: 'spin', tint: '#102030' }, 'Team Galactic\'s warehouse door slides open.', [
    ch('Take them on', fight('Galactic grunts block the way!', trainer('Galactic Commander', { types: ['poison', 'dark', 'steel'], size: 3, lv: 2, win: [any(...RARE)] }))),
    ch('Free the stolen Pokémon', out('A grateful Pokémon follows you out.', join({ lv: 1 }), { kind: 'attribute', key: 'goodEvil', amount: 3 }), { check: 'charisma', fail: fight('Caught at the cages!', trainer('Galactic Grunt', { types: ['poison'], size: 2, lv: 1 })) }),
  ]),
  ev('magma-emblem-hideout', 'Magma Emblem: The Hideout', K, { keyItem: 'magma-emblem', rarity: 'rare', cast: ['boss.maxie-gen6'], pokemon: 'groudon', effect: 'fire', tint: '#400808' }, 'The emblem opens Team Magma\'s volcano base. Deep below, Groudon sleeps.', [
    ch('Wake Groudon', fight('The ground splits!', wild({ species: ['groudon'], lv: 4, shiny: 2 }))),
    ch('Stop Team Magma', fight('Maxie\'s team blocks you!', trainer('Magma Admin', { types: ['fire', 'ground', 'dark'], size: 3, lv: 2, win: [$(2500), any(...RARE)] }))),
  ]),
  legend('red-chain-pillar', 'Red Chain: Spear Pillar', 'red-chain', ['dialga', 'palkia', 'giratina'], { cast: ['boss.cyrus'], effect: 'spin', tint: '#180828', intro: 'The Red Chain glows at the top of Mt. Coronet. Time and space twist.' }),
  legend('eon-ticket-island', 'Eon Ticket: Southern Island', 'eon-ticket', ['latios', 'latias'], { effect: 'float', tint: '#103040', intro: 'A small island. Two shapes circle above the tree.' }),
  legend('mysticticket-rock', 'MysticTicket: Navel Rock', 'mysticticket', ['ho-oh', 'lugia'], { effect: 'fog', intro: 'Navel Rock. At the top a rainbow; at the bottom, deep water.' }),
  legend('auroraticket-island', 'AuroraTicket: Birth Island', 'auroraticket', ['deoxys'], { effect: 'sparkle', tint: '#100820', intro: 'A triangle on Birth Island shifts as you step close.' }),
  legend('old-sea-map-island', 'Old Sea Map: Faraway Island', 'old-sea-map', ['mew'], { effect: 'float', tint: '#103018', intro: 'Tall grass on Faraway Island. Something pink giggles.' }),
  legend('liberty-pass-garden', 'Liberty Pass: Liberty Garden', 'liberty-pass', ['victini'], { effect: 'sparkle', tint: '#302008', intro: 'Under the lighthouse, a tiny Pokémon with a V on its head waits.' }),
  legend('azure-flute-hall', 'Azure Flute: Hall of Origin', 'azure-flute', ['arceus'], { effect: 'glint', tint: '#202020', intro: 'You play the Azure Flute. Stairs of light rise into the sky.', lv: 6 }),
  legend('dark-stone-zekrom', 'Dark Stone: Zekrom', 'dark-stone', ['zekrom'], { effect: 'sparkle', tint: '#080818', intro: 'The Dark Stone crackles with black lightning.' }),
  legend('light-stone-reshiram', 'Light Stone: Reshiram', 'light-stone', ['reshiram'], { effect: 'fire', tint: '#302828', intro: 'The Light Stone burns white-hot in your hands.' }),
  legend('magma-stone-heatran', 'Magma Stone: Stark Mountain', 'magma-stone', ['heatran'], { effect: 'fire', tint: '#400808', intro: 'Deep in Stark Mountain, the lava bubbles around a steel shape.' }),
  legend('rainbow-wing-tower', 'Rainbow Wing: Bell Tower', 'rainbow-wing', ['ho-oh'], { effect: 'sparkle', tint: '#302010', intro: 'The bells ring. A rainbow bird lands on the roof.' }),
  legend('silver-wing-islands', 'Silver Wing: Whirl Islands', 'silver-wing', ['lugia'], { effect: 'rain', tint: '#102030', intro: 'Whirlpools roar. A silver shape rises from the sea.' }),
  ev('tri-pass-ferry', 'Tri-Pass: Sevii Ferry', K, { keyItem: 'tri-pass', rarity: 'uncommon', effect: 'float', tint: '#103050' }, 'The Seagallop ferry can take you to one of three islands.', [
    ch('Market island', out('A shop on the pier.', { kind: 'addStop', stop: 'shop' })),
    ch('Hot-spring island', out('The springs heal your team.', heal(), { kind: 'cure' })),
    ch('Wild island', fight('A rare Pokémon in the grass!', wild({ lv: 2, shiny: 3 }))),
  ]),
  ev('rainbow-pass-ferry', 'Rainbow Pass: All the Islands', K, { keyItem: 'rainbow-pass', rarity: 'rare', effect: 'sparkle', tint: '#103050' }, 'The Rainbow Pass covers every island. Shop, rest, then explore!', [
    ch('Visit all three', fight('Market, springs, and now a rare Pokémon!', wild({ lv: 2, shiny: 3 }), { kind: 'addStop', stop: 'shop' }, heal(), { kind: 'cure' })),
  ]),
  ev('contest-pass-hall', 'Contest Pass: Super Contest', K, { keyItem: 'contest-pass', stop: 'contest', rarity: 'uncommon', cast: ['trainer.fairy_tale_girl'], effect: 'glint', tint: '#402040' }, 'The Contest Pass gets you on stage. The crowd waits.', [
    ch('Show off your lead', out('The crowd cheers!', attr('charisma', 4), fr(5, 'lead'), $(500)), { check: 'charisma', fail: out('Polite clapping.', attr('charisma', 2)) }),
    ch('Dance routine', out('A perfect finish!', attr('charisma', 3), attr('love', 1)), { check: 'speed', fail: out('A slip, but the crowd liked it.', attr('charisma', 1)) }),
  ]),

  // A source of keys in the run besides reward drafts.
  ev('lost-property', 'Lost Property Office', K, { rarity: 'uncommon', minStage: 2, cast: ['trainer.worker_m'], effect: 'rattle' }, '"Nobody ever comes back for these," the clerk sighs, waving at a shelf of keys and tickets.', [
    ch('Take a key', out('One of these must open something.', any('card-key', 'lift-key', 'basement-key', 'storage-key', 'suite-key', 'works-key', 'rm-1-key', 'rm-2-key', 'rm-4-key', 'rm-6-key'))),
    ch('Take a ticket (₽1000)', out('Where will it lead?', $(-1000), any('ss-ticket', 'tri-pass', 'contest-pass', 'secret-key')), { requires: [{ kind: 'money', atLeast: 1000 }] }),
    ch('Ask about rumours', out('"They say a ticket to a faraway island turned up once…"', attr('intelligence', 1))),
  ]),
  ev('old-collector', 'The Old Collector', K, { rarity: 'rare', minStage: 4, cast: ['trainer.hiker'], effect: 'glint' }, 'An old man keeps a case of rare tickets and stones. "Prove yourself and pick one."', [
    ch('Battle him', fight('"Show me your strength!"', trainer('Collector', { size: 3, lv: 3, win: [any('eon-ticket', 'mysticticket', 'auroraticket', 'old-sea-map', 'liberty-pass', 'magma-stone', 'rainbow-wing', 'silver-wing')] })), { requires: [fierce] }),
    ch('Trade a held item', out('He hands you an old sea chart.', { kind: 'loseItem' }, any('old-sea-map', 'eon-ticket', 'tidal-bell', 'clear-bell')), { check: 'charisma', fail: out('"Not good enough, youngster."') }),
    ch('Listen to his stories', out('You learn a lot.', attr('intelligence', 2))),
  ]),
  ev('ruins-dig', 'Ruins Dig Site', K, { rarity: 'rare', minStage: 5, cast: ['boss.cynthia-masters'], effect: 'shake', tint: '#302418' }, 'Researchers dig at ancient ruins. Two stones glint in the dirt, one dark and one light.', [
    ch('Take the dark stone', out('It hums with lightning.', item('dark-stone'))),
    ch('Take the light stone', out('It glows warm.', item('light-stone'))),
    ch('Help the dig', out('The team pays well.', $(1000), any(...HELD)), { check: 'strength', fail: out('Hard work, little to show.', $(200)) }),
  ]),
  ev('ancient-chain', 'The Lake Trio\'s Gift', K, { rarity: 'epic', minStage: 6, effect: 'sparkle', tint: '#182040' }, 'Three lights rise from three lakes and meet over your head. A red chain falls into your hand.', [
    ch('Keep the Red Chain', out('It is warm and heavy.', item('red-chain'))),
    ch('Ask for wisdom instead', out('Your mind feels clear.', attr('intelligence', 3), attr('love', 1))),
  ]),
  ev('flute-maker', 'The Flute Maker', K, { rarity: 'epic', minStage: 7, effect: 'float', tint: '#101830' }, 'A craftsman plays a blue flute. "This one opens the sky. It costs a lot."', [
    ch('Buy it (₽5000)', out('The Azure Flute is yours.', $(-5000), item('azure-flute')), { requires: [{ kind: 'money', atLeast: 5000 }] }),
    ch('Buy a bell (₽2500)', out('A bell for a legendary bird.', $(-2500), any('tidal-bell', 'clear-bell')), { requires: [{ kind: 'money', atLeast: 2500 }] }),
    ch('Just listen', out('Beautiful music.', heal(0.5))),
  ]),
  ev('rocket-emblem-swap', 'Shady Emblem Seller', K, { rarity: 'rare', minStage: 4, cast: ['trainer.roughneck'], effect: 'flicker' }, '"Psst. Want a Magma Emblem? Or a Galactic key? No questions asked."', [
    ch('Buy the emblem (₽2000)', out('It feels warm.', $(-2000), item('magma-emblem'), { kind: 'attribute', key: 'goodEvil', amount: -1 }), { requires: [{ kind: 'money', atLeast: 2000 }] }),
    ch('Buy the key (₽1500)', out('A cold metal key.', $(-1500), item('galactic-key'), { kind: 'attribute', key: 'goodEvil', amount: -1 }), { requires: [{ kind: 'money', atLeast: 1500 }] }),
    ch('Report him', out('Officer Jenny thanks you.', { kind: 'attribute', key: 'goodEvil', amount: 2 }, $(300))),
  ]),
  ev('professors-errand', "Professor's Errand", K, { rarity: 'rare', minStage: 3, cast: ['boss.oak'], effect: 'sparkle' }, '"Could you take this letter to an old friend? It might lead somewhere special."', [
    ch('Take the letter', out("Oak's Letter.", item('oaks-letter'), { kind: 'attribute', key: 'goodEvil', amount: 1 })),
    ch('Ask for gadgets', out('"Try these!"', any('explorer-kit', 'prop-case', 'silph-scope'))),
  ]),
];
