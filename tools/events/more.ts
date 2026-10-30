// Kice asked to "double the amount of ideas" in the events plan (2026-10-30), with
// PokeRogue's Mystery Encounters as a reference. These are the new events: the
// PokeRogue-style encounters the plan didn't already have, then more for every group.

import {
  $, BALLS, BERRIES, FOSSILS, HEALING, HELD, RARE_HELD, SNACKS, STONES, TREASURE, TYPE_ITEMS, VITAMINS,
  any, att, attr, better, ch, cure, ev, evil, ferry, fierce, fight, fr, good, gym, has, heal, hurt, isEvil, isGood, isPeace, isRage,
  item, join, egg, leave, lose, lv, money, out, party, peace, ptype, rage, reveal, rp, status, stopHere, trade, trainer, wild, type Json,
} from './dsl.ts';

const PR = 'PokeRogue-style encounters';
const M = 'Merchants and deals';
const T = 'Trainers and challenges';
const W = 'Wild Pokémon scenes';
const V = 'Tricksters, villains and teams';
const H = 'Helpers, gifts and kindness';
const G = 'Games of chance';
const R = 'Training and growth';
const Y = 'Mysteries and story';
const F = 'Famous faces';
const P = 'Places and weather';

export const MORE_EVENTS: Json[] = [
  // ---------- PokeRogue-style encounters the plan didn't have ----------
  ev('dark-deal', 'Dark Deal', PR, { rarity: 'rare', minStage: 3, cast: ['trainer.psychic_m'], effect: 'flicker', tint: '#180820' }, 'A strange scientist offers a device. "Give me one Pokémon and I\'ll give you a legend… maybe."', [
    ch('Accept the deal', out('The machine whirs. A powerful Pokémon steps out!', join({ lv: 6, shiny: 2 }), evil(8), hurt(0.2)), { requires: [party(2)] }),
    ch('Refuse', leave('"Pity. Science waits for no one."')),
  ]),
  ev('safari-zone', 'Safari Zone', PR, { rarity: 'uncommon', cast: ['trainer.worker_m'], effect: 'float', tint: '#284018' }, 'A gate to the Safari Zone. "Rare Pokémon inside, ₽500 entry!"', [
    ch('Enter (₽500)', fight('Something rare rustles in the tall grass!', wild({ lv: 2, shiny: 4 }), $(-500)), { requires: [money(500)] }),
    ch('Throw bait from the fence', out('A friendly Pokémon wanders up and follows you.', join({ lv: -1 })), { check: 'luck', fail: out('It ate the bait and ran.', lose()) }),
    ch('Walk on', leave()),
  ]),
  ev('teleporting-hijinks', 'Teleporting Hijinks', PR, { rarity: 'uncommon', minStage: 2, effect: 'spin', tint: '#201838' }, 'A glowing pad hums by the path. A sign reads "DO NOT STAND HERE".', [
    ch('Stand on it', out('Zap! You land much further down the road.', ferry()), { chance: 0.5, fail: fight('Zap! You land in a nest of angry Psychic-types!', wild({ types: ['psychic'], lv: 2 })) }),
    ch('Study it', out('Fascinating tech.', attr('intelligence', 3), rp(15))),
  ]),
  ev('the-strong-stuff', 'The Strong Stuff', PR, { rarity: 'rare', minStage: 3, pokemon: 'shuckle', effect: 'shake' }, 'A Shuckle sits on a pile of fermented berry juice. It offers you a sip.', [
    ch('Let your lead drink', out('Your lead feels incredibly tough, if a bit slower.', lv(3), status('sleep'), attr('strength', 3))),
    ch('Battle the Shuckle', fight('The Shuckle hides in its shell!', wild({ species: ['shuckle'], lv: 4, win: [item('leftovers')] }))),
    ch('Leave it', leave()),
  ]),
  ev('offer-you-cant-refuse', "An Offer You Can't Refuse", PR, { rarity: 'uncommon', minStage: 2, cast: ['trainer.roughneck'], effect: 'glint' }, 'A rich kid points at your Pokémon. "I\'ll pay a fortune for that one!"', [
    ch('Sell for ₽4000', out('A stack of cash. Your team looks at you funny.', $(4000), evil(5), fr(-10)), { requires: [party(2)] }),
    ch('Ask for an item instead', out('"Fine, take this!"', any(...RARE_HELD)), { check: 'charisma', fail: out('"Ugh, no deal then."') }),
    ch('Refuse', out('Your team cheers.', fr(5), good(3))),
  ]),
  ev('delibird-y', 'Delibird-y', PR, { rarity: 'uncommon', pokemon: 'delibird', effect: 'snow', tint: '#203040' }, 'Three Delibird waddle up with sacks. They want a present first.', [
    ch('Give money (₽600)', out('They hand you a treat.', $(-600), any(...RARE_HELD)), { requires: [money(600)] }),
    ch('Give a healing item', out('They chirp happily and give you a berry bundle.', lose(), any(...BERRIES), any(...BERRIES))),
    ch('Battle them', fight('Present attack!', wild({ species: ['delibird'], lv: 1, win: [any(...TREASURE)] })), { requires: [fierce] }),
  ]),
  ev('absolute-avarice', 'Absolute Avarice', PR, { rarity: 'rare', minStage: 3, pokemon: 'greedent', effect: 'shake' }, 'A huge Greedent sits on a hoard of berries. It glares at you.', [
    ch('Battle for the hoard', fight('Greedent charges!', wild({ species: ['greedent'], lv: 4, win: [any(...BERRIES), any(...BERRIES), any(...BERRIES)] }))),
    ch('Offer your berries', out('Greedent is pleased and joins you!', lose(), join({ species: ['skwovet'], lv: 0 }))),
    ch('Sneak past', leave('You tiptoe away.')),
  ]),
  ev('clowning-around', 'Clowning Around', PR, { rarity: 'uncommon', minStage: 2, pokemon: 'mr-mime', effect: 'spin', tint: '#302040' }, 'A clown and his Mr. Mime block the road. "Laugh, or battle!"', [
    ch('Battle the clown', fight('Honk honk!', trainer('Clown', { types: ['psychic', 'fairy'], size: 2, lv: 1, win: [any(...TYPE_ITEMS), attr('charisma', 2)] }))),
    ch('Laugh at the show', out('It\'s actually funny!', attr('charisma', 2), peace(3))),
  ]),
  ev('part-timer', 'Part-Timer', PR, { rarity: 'common', cast: ['trainer.worker_m'], effect: 'rattle' }, 'A shop needs a hand. Your Pokémon could help for pay.', [
    ch('Help at the counter', out('Your team charmed every customer.', $(900), attr('charisma', 1)), { check: 'charisma', fail: out('A slow day.', $(300)) }),
    ch('Help in the warehouse', out('Heavy work, good pay.', $(1000), hurt(0.15)), { check: 'strength', fail: out('You dropped a box.', $(200), hurt(0.15)) }),
    ch('Deliver orders', out('Fastest delivery ever!', $(800), attr('speed', 1)), { check: 'speed', fail: out('Late again.', $(250)) }),
  ]),
  ev('dancing-lessons', 'Dancing Lessons', PR, { rarity: 'uncommon', pokemon: 'oricorio', effect: 'sparkle', tint: '#402030' }, 'An Oricorio dances by the road. It wants a partner.', [
    ch('Dance with it', out('A great dance! It joins your team.', join({ species: ['oricorio'], lv: 0 }), fr(5)), { check: 'speed', fail: out('You tripped. It laughs and flies away.', attr('charisma', 1)) }),
    ch('Watch and learn', out('Your team learned a few moves.', fr(5), attr('speed', 2))),
    ch('Battle it', fight('It attacks with a flourish!', wild({ species: ['oricorio'], lv: 2 })), { requires: [fierce] }),
  ]),
  ev('global-trade', 'Global Trade Station', PR, { rarity: 'uncommon', minStage: 2, cast: ['trainer.worker_m'], effect: 'glint', tint: '#102838' }, 'A trading booth links to trainers around the world.', [
    ch('Trade a Pokémon from this generation for a surprise', out('A Pokémon from far away arrives!', trade('a Generation 1 Pokémon', { generation: 1 }), join({ lv: 1, shiny: 2 }))),
    ch('Trade an item', out('Someone sends a held item back.', lose(), any(...HELD))),
    ch('Just browse', out('You learn about faraway Pokémon.', rp(10))),
  ]),
  ev('pikachu-collector', 'The Pikachu Collector', PR, { rarity: 'uncommon', minStage: 2, cast: ['trainer.worker_m'], effect: 'hearts' }, '"I only collect Pikachu and Eevee. Bring me one and I will swap you something rare."', [
    ch('Trade a Pikachu or Eevee', out('He cradles it and hands over a rare Pokémon.', trade('a Pikachu or an Eevee', { species: ['pikachu', 'eevee'] }), join({ species: ['porygon', 'lapras', 'aerodactyl'], lv: 3 }))),
    ch('Not today', leave()),
  ]),
  ev('heavyweight-swap', 'The Heavyweight Swap', PR, { rarity: 'common', minStage: 2, cast: ['trainer.hiker'], effect: 'shake' }, '"My cart needs a big strong Pokémon, 100 kg or more. I will trade you a sturdy Steel-type for it."', [
    ch('Trade a Pokémon of 100 kg or more', out('The cart rolls on. A sturdy partner joins you.', trade('a Pokémon of 100 kg or more', { minWeight: 100 }), join({ types: ['steel'], lv: 2 }))),
    ch('Not today', leave()),
  ]),
  ev('water-fan-swap', 'The Water Fan', PR, { rarity: 'common', minStage: 2, cast: ['trainer.fisherman'], effect: 'rain' }, '"Water is life! Trade me a Water-type and I will find you a Dragon."', [
    ch('Trade a Water-type', out('He beams and sends a Dragon your way.', trade('a Water-type', { type: 'water' }), join({ types: ['dragon'], lv: 2 }))),
    ch('Not today', leave()),
  ]),
  ev('fun-and-games', 'Fun and Games!', PR, { rarity: 'uncommon', cast: ['trainer.guitarist'], pokemon: 'wobbuffet', effect: 'rattle', tint: '#302018' }, 'A carnival game: knock out the Wobbuffet in three turns to win!', [
    ch('Play (₽300)', fight('Wobbuffet stands its ground!', wild({ species: ['wobbuffet'], lv: 0, win: [any(...TREASURE), $(1000)] }), $(-300)), { requires: [money(300)] }),
    ch('Walk on', leave()),
  ]),
  ev('bug-superfan', 'Bug-Type Superfan', PR, { rarity: 'common', cast: ['trainer.bug_catcher'], effect: 'float' }, '"Bugs are the BEST! Show me yours!"', [
    ch('Show a Bug-type', out('"WOW!" He gives you his best stuff.', any('silverpowder', 'quick-claw', 'shed-shell'), $(500)), { requires: [ptype('bug')] }),
    ch('Battle him', fight('"Bug power!"', trainer('Bug Maniac', { types: ['bug'], size: 3, win: [any(...BALLS)] }))),
    ch('Say bugs are gross', out('He cries. You feel bad.', evil(2))),
  ]),
  ev('unlikely-ally', 'An Unlikely Ally', PR, { rarity: 'rare', minStage: 3, effect: 'sparkle' }, 'A strong wild Pokémon fights off a gang of others. It looks hurt.', [
    ch('Jump in and help', fight('You fight side by side against the gang!', wild({ lv: 2, win: [join({ lv: 3 })] }))),
    ch('Heal it after', out('It nods at you, healed. It decides to come along.', lose(), join({ lv: 3 })), { check: 'love', fail: out('It limps away.') }),
  ]),
  ev('trash-to-treasure', 'Trash to Treasure', PR, { rarity: 'uncommon', minStage: 2, pokemon: 'garbodor', effect: 'fog', tint: '#202818' }, 'A huge heap of junk. Something shiny pokes out. Something smelly guards it.', [
    ch('Dig through the trash', out('Treasure among the junk!', any(...TREASURE), any(...TREASURE), status('poison')), { check: 'luck', fail: out('Just junk, and now you smell.', status('poison')) }),
    ch('Battle the guardian', fight('Garbodor rises from the heap!', wild({ species: ['garbodor'], lv: 3, win: [any(...RARE_HELD)] }))),
    ch('Leave', leave()),
  ]),
  ev('field-trip', 'Field Trip', PR, { rarity: 'common', cast: ['trainer.youngster_m'], effect: 'sparkle' }, 'A teacher and her class want to see a Pokémon move in action.', [
    ch('Show a physical move', out('"Amazing!" The class gives you a gift.', any(...VITAMINS), good(2)), { check: 'strength', fail: out('A bit clumsy, but they clapped.', good(1)) }),
    ch('Show a special move', out('"So pretty!" They give you a gift.', any(...VITAMINS), good(2)), { check: 'intelligence', fail: out('Polite clapping.', good(1)) }),
    ch('Show a status move', out('The class learns something new.', rp(15), good(2))),
  ]),

  // ---------- more merchants ----------
  ev('berry-merchant', 'Berry Merchant', M, { stop: 'merchant', rarity: 'common', cast: ['trainer.aroma_lady'], effect: 'hearts' }, 'A cart full of fresh berries. "Two for ₽400!"', [
    ch('Buy two (₽400)', out('Juicy!', $(-400), any(...BERRIES), any(...BERRIES)), { requires: [money(400)] }),
    ch('Trade a held item for five', out('A huge basket.', lose(), any(...BERRIES), any(...BERRIES), any(...BERRIES), any(...BERRIES), any(...BERRIES))),
    ch('Walk on', leave()),
  ]),
  ev('stone-seller', 'Evolution Stone Seller', M, { stop: 'merchant', rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], effect: 'glint' }, '"Fire, water, thunder, leaf… pick a stone, ₽1200!"', [
    ch('Buy a stone (₽1200)', out('It glows in your hand.', $(-1200), any(...STONES)), { requires: [money(1200)] }),
    ch('Haggle', out('"Fine, ₽600!"', $(-600), any(...STONES)), { check: 'charisma', requires: [money(600)], fail: out('"No discounts!"') }),
    ch('Walk on', leave()),
  ]),
  ev('ball-factory-outlet', 'Poké Ball Outlet', M, { stop: 'shop', rarity: 'common', cast: ['trainer.worker_m'], effect: 'rattle' }, 'Factory seconds: slightly dented Poké Balls, cheap!', [
    ch('Buy a bag (₽500)', out('Five balls, barely dented.', $(-500), item('poke-ball', 3), item('great-ball', 2)), { requires: [money(500)] }),
    ch('Buy Ultra Balls (₽1000)', out('Shiny and yellow.', $(-1000), item('ultra-ball', 2)), { requires: [money(1000)] }),
    ch('Walk on', leave()),
  ]),
  ev('snack-stand', 'Snack Stand', M, { stop: 'shop', rarity: 'common', cast: ['trainer.fairy_tale_girl'], effect: 'hearts' }, 'Fresh Water, Soda Pop, Lava Cookies… your team stares hungrily.', [
    ch('Buy snacks (₽400)', out('Yum!', $(-400), any(...SNACKS), any(...SNACKS), fr(3)), { requires: [money(400)] }),
    ch('Treat everyone (₽800)', out('A feast! Your team loves you.', $(-800), heal(0.5), fr(8)), { requires: [money(800)] }),
    ch('Walk on', leave()),
  ]),
  ev('fossil-trader', 'Fossil Trader', M, { stop: 'merchant', rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], effect: 'shake', tint: '#302418' }, '"Ancient fossils! Revive them at any lab!"', [
    ch('Buy a fossil (₽1500)', out('A fossil, cold and heavy.', $(-1500), any(...FOSSILS)), { requires: [money(1500)] }),
    ch('Trade a treasure', out('Fair trade.', lose(), any(...FOSSILS))),
    ch('Walk on', leave()),
  ]),
  ev('tm-vendor', 'Move Tutor Stall', M, { stop: 'merchant', rarity: 'uncommon', cast: ['trainer.psychic_m'], effect: 'sparkle' }, '"I teach moves for money. Your lead could learn a lot."', [
    ch('Lesson (₽1000)', out('Your lead learned well.', $(-1000), lv(2), attr('intelligence', 1)), { requires: [money(1000)] }),
    ch('Group lesson (₽2000)', out('The whole team learned.', $(-2000), lv(1, 'party')), { requires: [money(2000)] }),
    ch('Walk on', leave()),
  ]),
  ev('mystery-box', 'Mystery Box Seller', M, { stop: 'merchant', rarity: 'common', cast: ['trainer.roughneck'], effect: 'rattle' }, '"Mystery boxes! Could be anything! ₽700!"', [
    ch('Buy one (₽700)', out('Ooh, nice!', $(-700), any(...RARE_HELD)), { requires: [money(700)], chance: 0.4, fail: out('A rock. A literal rock.', $(-700)) }),
    ch('Walk on', leave()),
  ]),
  ev('scrap-buyer', 'Scrap Buyer', M, { stop: 'merchant', rarity: 'common', cast: ['trainer.worker_m'], effect: 'glint' }, '"I buy anything! Anything at all!"', [
    ch('Sell an item', out('Easy cash.', lose(), $(800))),
    ch('Sell two items', out('Even more cash.', lose(), lose(), $(1700))),
    ch('Walk on', leave()),
  ]),
  ev('lucky-charm-shop', 'Lucky Charm Shop', M, { stop: 'shop', rarity: 'uncommon', cast: ['trainer.hex_maniac'], effect: 'sparkle', tint: '#281838' }, 'Charms, trinkets and good-luck pendants line the shelves.', [
    ch('Buy a clover charm (₽800)', out('You feel lucky.', $(-800), attr('luck', 4)), { requires: [money(800)] }),
    ch('Buy a heart charm (₽800)', out('You feel warm.', $(-800), attr('love', 3), fr(3)), { requires: [money(800)] }),
    ch('Walk on', leave()),
  ]),
  ev('healing-herbalist', 'Herbalist', M, { stop: 'merchant', rarity: 'common', cast: ['trainer.aroma_lady'], effect: 'hearts', tint: '#203018' }, 'Bitter herbs that heal fast. "Cheap, but your Pokémon won\'t like the taste."', [
    ch('Buy herbs (₽200)', out('Bitter, but it works.', $(-200), heal(), fr(-5)), { requires: [money(200)] }),
    ch('Buy a revival herb (₽500)', out('A strong herb.', $(-500), item('revive')), { requires: [money(500)] }),
    ch('Walk on', leave()),
  ]),
  ev('ticket-booth', 'Ferry Ticket Booth', M, { stop: 'merchant', rarity: 'rare', minStage: 2, cast: ['trainer.worker_m'], effect: 'float', tint: '#103050' }, '"Express ferry to the gym town! ₽1500!"', [
    ch('Ride the express (₽1500)', out('You step off near the gym.', $(-1500), ferry()), { requires: [money(1500)] }),
    ch('Buy a souvenir (₽300)', out('A little model ship.', $(-300), attr('charisma', 1)), { requires: [money(300)] }),
    ch('Walk on', leave()),
  ]),

  // ---------- more trainers and challenges ----------
  ev('triple-battle', 'Triple Trouble', T, { rarity: 'uncommon', minStage: 2, cast: ['trainer.youngster_m'], effect: 'shake' }, 'Three kids challenge you at once. "All of us! Right now!"', [
    ch('Take them all', fight('Three teams, one after another!', trainer('Kid Squad', { size: 4, lv: 1, win: [$(1500), any(...HEALING)] }))),
    ch('Just one of them', fight('The bravest steps up.', trainer('Youngster', { size: 1, win: [$(400)] }))),
  ]),
  ev('veteran-challenge', 'Veteran\'s Challenge', T, { rarity: 'rare', minStage: 4, cast: ['trainer.marshal'], effect: 'shake' }, 'An old Veteran nods. "Show me what you\'ve learned."', [
    ch('Battle', fight('"Don\'t hold back!"', trainer('Veteran', { size: 4, lv: 3, win: [any(...RARE_HELD), better(1)] })), { requires: [fierce] }),
    ch('Ask for advice', out('"Train with heart." You feel wiser.', attr('intelligence', 2), fr(5))),
  ]),
  ev('type-specialist', 'Type Specialist', T, { rarity: 'common', cast: ['trainer.ryme'], effect: 'sparkle' }, 'A trainer who uses only one type wants a battle.', [
    ch('Battle', fight('A mono-type team!', trainer('Specialist', { size: 3, win: [any(...TYPE_ITEMS)] }))),
    ch('Talk shop', out('You learn about type matchups.', rp(10), attr('intelligence', 1))),
  ]),
  ev('speed-trial', 'Speed Trial', T, { rarity: 'common', cast: ['trainer.biker'], effect: 'float' }, 'A racer dares you: "Beat my time through the course!"', [
    ch('Race', out('You win the race!', $(800), attr('speed', 3)), { check: 'speed', fail: out('Lost by a hair.', attr('speed', 1)) }),
    ch('Battle instead', fight('"Fast battle, then!"', trainer('Racer', { types: ['electric', 'flying'], size: 2, win: [$(700)] }))),
  ]),
  ev('strength-trial', 'Boulder Push', T, { rarity: 'common', cast: ['trainer.hiker'], effect: 'shake' }, 'A Hiker dares your team to push a huge boulder up a hill.', [
    ch('Push!', out('It rolls to the top!', any(...VITAMINS), attr('strength', 3)), { check: 'strength', fail: out('It rolls back. Ouch.', hurt(0.2), attr('strength', 1)) }),
    ch('Battle the Hiker', fight('"Rock solid!"', trainer('Hiker', { types: ['rock', 'ground'], size: 2, win: [$(700)] }))),
  ]),
  ev('quiz-master', 'Quiz Master', T, { rarity: 'common', cast: ['trainer.psychic_m'], effect: 'sparkle' }, '"Answer my three questions about Pokémon!"', [
    ch('Take the quiz', out('Three for three!', $(1000), rp(20), attr('intelligence', 2)), { check: 'intelligence', fail: out('Two wrong. Still learned something.', rp(5)) }),
    ch('Battle him', fight('"Question four: can you win?"', trainer('Quiz Master', { types: ['psychic'], size: 2, win: [$(800)] }))),
  ]),
  ev('beauty-pageant', 'Beauty Pageant', T, { stop: 'contest', rarity: 'uncommon', cast: ['trainer.aroma_lady'], effect: 'glint', tint: '#402038' }, 'A stage, lights and judges. Your lead is entered!', [
    ch('Strut your stuff', out('First place!', $(1200), attr('charisma', 4), fr(5, 'lead')), { check: 'charisma', fail: out('Third place. Still pretty.', attr('charisma', 2)) }),
    ch('Battle the champion', fight('"Beauty AND brawn!"', trainer('Beauty', { types: ['fairy', 'grass'], size: 2, win: [attr('charisma', 3), $(800)] }))),
  ]),
  ev('marathon', 'Pokémon Marathon', T, { rarity: 'uncommon', cast: ['trainer.biker'], effect: 'float' }, 'Runners and their Pokémon line up at the start.', [
    ch('Run it', out('You finish strong!', $(800), attr('speed', 2), lv(1, 'party'), hurt(0.25)), { check: 'speed', fail: out('You finish last, tired but proud.', hurt(0.25), attr('speed', 1)) }),
    ch('Cheer the runners', out('The crowd loves you.', attr('charisma', 2), good(2))),
  ]),
  ev('gym-trainer-ambush', 'Gym Trainer Practice', T, { rarity: 'common', minStage: 2, cast: ['trainer.black_belt_m'], effect: 'shake' }, 'A gym trainer is practising nearby. "Want to see what the leader uses?"', [
    ch('Battle for the scoop', fight('"If you win, I\'ll tell you!"', trainer('Gym Trainer', { size: 2, lv: 1, win: [gym()] }))),
    ch('Pay for the info (₽600)', out('He spills it all.', $(-600), gym()), { requires: [money(600)] }),
    ch('Walk on', leave()),
  ]),
  ev('mirror-match', 'Mirror Match', T, { rarity: 'rare', minStage: 3, cast: ['trainer.mira'], effect: 'glint', tint: '#203040' }, 'A trainer who looks like you, with a team that looks like yours…', [
    ch('Battle your mirror', fight('It\'s like fighting yourself!', trainer('Mirror Trainer', { size: 3, lv: 2, win: [better(1), attr('intelligence', 2)] }))),
    ch('Walk away', out('Spooky.', attr('luck', 1))),
  ]),
  ev('little-league', 'Little League', T, { rarity: 'common', cast: ['trainer.youngster_m'], effect: 'sparkle' }, 'Kids practise battling. They want a coach.', [
    ch('Coach them', out('The kids learn fast.', good(3), attr('charisma', 2), rp(5))),
    ch('Battle them', fight('"Ready, coach?"', trainer('Kid', { size: 2, lv: -1, win: [any(...HEALING)] }))),
  ]),
  ev('champion-cup', 'Champion Cup Qualifier', T, { rarity: 'rare', minStage: 5, cast: ['trainer.drayton'], effect: 'glint', tint: '#302810' }, 'A qualifier for a big tournament. Only strong teams enter.', [
    ch('Enter', fight('A tough qualifier!', trainer('Ace Trainer', { size: 4, lv: 3, win: [$(3000), any(...RARE_HELD), better(1)] })), { requires: [party(3)] }),
    ch('Watch from the stands', out('You pick up tactics.', attr('intelligence', 2), rp(10))),
  ]),

  // ---------- more wild Pokémon scenes ----------
  ev('sleeping-hollow', 'Sleeping Hollow', W, { rarity: 'common', effect: 'fog', tint: '#182028' }, 'A hollow where wild Pokémon nap in a pile.', [
    ch('Sneak up for a catch', fight('One wakes up grumpy!', wild({ lv: 0, shiny: 2 })), { check: 'speed', fail: fight('They ALL wake up!', wild({ lv: 2 })) }),
    ch('Nap with them', out('A peaceful rest.', heal(0.5), peace(3))),
  ]),
  ev('migrating-flock', 'Migrating Flock', W, { rarity: 'common', types: ['flying'], effect: 'float', tint: '#203048' }, 'A flock of bird Pokémon passes overhead.', [
    ch('Whistle at them', fight('One swoops down!', wild({ types: ['flying'], lv: 1 }))),
    ch('Watch them go', out('Beautiful.', peace(2), attr('love', 1))),
  ]),
  ev('tide-pools', 'Tide Pools', W, { rarity: 'common', types: ['water'], effect: 'rain', tint: '#103040' }, 'Small pools on the rocks are full of tiny Water Pokémon.', [
    ch('Look closer', fight('Something snaps at you!', wild({ types: ['water'], lv: 0, shiny: 2 }))),
    ch('Collect shells', out('Pretty shells and a pearl.', any('pearl', 'big-pearl'))),
  ]),
  ev('glowing-mushrooms', 'Glowing Mushrooms', W, { rarity: 'uncommon', types: ['grass', 'bug'], effect: 'sparkle', tint: '#182818' }, 'Mushrooms glow blue in the dark woods.', [
    ch('Pick some', out('Big Mushrooms!', item('big-mushroom')), { check: 'luck', fail: out('Spores! Your team gets sleepy.', status('sleep')) }),
    ch('Follow the glow', fight('A Grass-type guards the patch.', wild({ types: ['grass', 'bug'], lv: 1 }))),
  ]),
  ev('wild-stampede-2', 'Rumbling Herd', W, { rarity: 'uncommon', minStage: 2, types: ['ground', 'normal'], effect: 'shake' }, 'The ground shakes. A herd charges down the valley.', [
    ch('Stand firm', out('You stand your ground!', attr('strength', 3), rage(2)), { check: 'strength', fail: out('Trampled!', hurt(0.3)) }),
    ch('Catch a straggler', fight('One slows down to fight!', wild({ types: ['ground', 'normal'], lv: 1 }))),
    ch('Hide', leave('You wait it out.')),
  ]),
  ev('shiny-glint', 'A Shiny Glint', W, { rarity: 'rare', effect: 'glint', tint: '#302810' }, 'Something sparkles in the tall grass. Could it be…?', [
    ch('Check it out', fight('A shiny Pokémon!', wild({ lv: 1, shiny: 50 })), { chance: 0.6, fail: out('Just a bottle cap.', $(100)) }),
    ch('Ignore it', leave()),
  ]),
  ev('pokemon-playground', 'Pokémon Playground', W, { rarity: 'common', effect: 'hearts' }, 'Young wild Pokémon play tag in a clearing.', [
    ch('Join the game', out('Your team made friends!', fr(8), attr('love', 2))),
    ch('Invite one along', out('A little one follows you.', join({ lv: -2 })), { check: 'love', fail: out('They scatter, giggling.') }),
  ]),
  ev('alpha-pokemon', 'Alpha Pokémon', W, { rarity: 'rare', minStage: 4, effect: 'shake', tint: '#401010' }, 'A huge Pokémon with red eyes stomps through the clearing.', [
    ch('Fight the Alpha', fight('It roars!', wild({ lv: 6, shiny: 2, win: [any(...RARE_HELD), lv(1, 'party')] })), { requires: [fierce] }),
    ch('Sneak away', leave('It doesn\'t notice you. Phew.')),
  ]),
  ev('nesting-ground', 'Nesting Ground', W, { rarity: 'uncommon', effect: 'hearts', tint: '#283018' }, 'Parent Pokémon guard their eggs. One egg rolls toward you.', [
    ch('Return the egg', out('The parents thank you.', good(3), fr(3), any(...BERRIES))),
    ch('Keep the egg', out('It wriggles in your bag. It will hatch soon!', egg({ lv: -3, shiny: 3, left: 2 }), evil(5)), { requires: [fierce] }),
  ]),
  ev('lightning-storm', 'Lightning Storm', W, { rarity: 'uncommon', types: ['electric'], effect: 'rain', tint: '#181830' }, 'Thunder cracks. Electric Pokémon dance in the storm.', [
    ch('Run through the storm', fight('An Electric-type zaps you!', wild({ types: ['electric'], lv: 1 }))),
    ch('Shelter and wait', out('You wait it out.', heal(0.3))),
  ]),
  ev('lake-legend', 'Lake Legend', W, { rarity: 'epic', minStage: 6, pokemon: 'suicune', effect: 'fog', tint: '#103040' }, 'Mist rises from the lake. A blue shape runs across the water.', [
    ch('Chase it', fight('A legendary beast!', wild({ species: ['suicune', 'raikou', 'entei'], lv: 4, shiny: 2 }))),
    ch('Watch in awe', out('You will never forget this.', attr('love', 2), peace(3))),
  ]),
  ev('wild-tea-party', 'Wild Tea Party', W, { rarity: 'uncommon', types: ['fairy'], pokemon: 'sinistea', effect: 'hearts', tint: '#402838' }, 'Fairy Pokémon sit around a tiny table with teacups.', [
    ch('Join them', out('Tea and cake! Lovely.', heal(0.5), attr('love', 2))),
    ch('Ask one to come along', out('A teacup Pokémon hops into your bag.', join({ species: ['sinistea', 'polteageist'], lv: 0 })), { check: 'charisma', fail: out('They politely decline.') }),
  ]),

  // ---------- more tricksters, villains and teams ----------
  ev('rocket-roadblock', 'Rocket Roadblock', V, { rarity: 'common', cast: ['trainer.giovanni'], effect: 'flicker', tint: '#200810' }, '"Team Rocket toll! ₽500 or battle!"', [
    ch('Battle', fight('"Prepare for trouble!"', trainer('Rocket Grunt', { types: ['poison', 'dark'], size: 2, win: [$(800), good(2)] })), { requires: [fierce] }),
    ch('Pay the toll', out('They laugh and let you pass.', $(-500), evil(1)), { requires: [money(500)] }),
    ch('Sneak around', out('You slip past.', attr('speed', 1)), { check: 'speed', fail: fight('Spotted!', trainer('Rocket Grunt', { types: ['poison'], size: 2 })) }),
  ]),
  ev('aqua-flood', 'Team Aqua\'s Flood', V, { rarity: 'uncommon', minStage: 2, cast: ['boss.archie-gen6'], effect: 'rain', tint: '#102040' }, 'Team Aqua is flooding a valley "for the Pokémon"!', [
    ch('Stop them', fight('Aqua Grunts surround you!', trainer('Aqua Admin', { types: ['water', 'dark'], size: 3, lv: 1, win: [good(5), any(...TYPE_ITEMS)] }))),
    ch('Help the villagers instead', out('You get everyone to high ground.', good(5), attr('love', 2), hurt(0.1))),
  ]),
  ev('magma-drill', 'Team Magma\'s Drill', V, { rarity: 'uncommon', minStage: 2, cast: ['boss.maxie-gen6'], effect: 'fire', tint: '#400808' }, 'A giant drill digs into the mountain. Team Magma laughs.', [
    ch('Smash the drill', fight('Magma Grunts defend it!', trainer('Magma Admin', { types: ['fire', 'ground'], size: 3, lv: 1, win: [good(5), $(1500)] }))),
    ch('Steal their supplies', out('A bag of their gear.', any(...HELD), evil(3)), { check: 'speed', fail: fight('Caught!', trainer('Magma Grunt', { types: ['fire'], size: 2 })) }),
  ]),
  ev('galactic-lecture', 'Galactic Lecture', V, { rarity: 'common', minStage: 2, cast: ['boss.cyrus'], effect: 'spin', tint: '#102030' }, 'A Galactic speaker preaches about a "new world without spirit".', [
    ch('Argue back', out('The crowd turns against him.', good(3), attr('charisma', 2)), { check: 'charisma', fail: out('Nobody listens to you either.') }),
    ch('Battle the speaker', fight('"You\'ll see!"', trainer('Galactic Grunt', { types: ['poison', 'dark'], size: 2, win: [$(800)] })), { requires: [fierce] }),
    ch('Listen', out('Creepy, but you learn their plan.', rp(10), evil(1))),
  ]),
  ev('plasma-protest', 'Plasma Protest', V, { rarity: 'common', minStage: 2, cast: ['boss.ghetsis'], effect: 'flicker', tint: '#182030' }, '"Free your Pokémon!" Team Plasma waves signs at you.', [
    ch('Show how happy your team is', out('The protesters go quiet.', fr(5), good(3)), { check: 'love', fail: out('They shout louder.') }),
    ch('Battle them', fight('"Liberation!"', trainer('Plasma Grunt', { types: ['dark', 'psychic'], size: 2, win: [$(800)] })), { requires: [fierce] }),
  ]),
  ev('flare-boutique', 'Flare Boutique', V, { rarity: 'uncommon', minStage: 3, cast: ['boss.lysandre'], effect: 'fire', tint: '#401808' }, 'An exclusive boutique run by Team Flare. "Only the beautiful may shop."', [
    ch('Buy a fancy item (₽2500)', out('Very stylish.', $(-2500), any(...RARE_HELD), attr('charisma', 2)), { requires: [money(2500)] }),
    ch('Expose them', fight('"How dare you!"', trainer('Flare Admin', { types: ['fire', 'dark'], size: 3, lv: 2, win: [good(5), $(2000)] }))),
  ]),
  ev('skull-graffiti', 'Team Skull Graffiti', V, { rarity: 'common', cast: ['boss.guzma'], effect: 'shake' }, 'Team Skull is spray-painting a Pokémon Center. "Yo, whatchu lookin\' at?"', [
    ch('Battle them', fight('"Skull, yo!"', trainer('Skull Grunt', { types: ['poison', 'bug', 'dark'], size: 2, win: [$(600), good(2)] }))),
    ch('Help clean up', out('The nurse thanks you.', good(3), heal())),
    ch('Join in', out('You tag your name. Rebel!', evil(3), attr('charisma', 1)), { requires: [isEvil(10)] }),
  ]),
  ev('yell-blockade', 'Team Yell Blockade', V, { rarity: 'common', cast: ['boss.piers'], effect: 'shake' }, 'Team Yell won\'t let anyone near Marnie\'s gym. They chant loudly.', [
    ch('Battle through', fight('"YEEELL!"', trainer('Yell Grunt', { types: ['dark'], size: 2, win: [$(600)] }))),
    ch('Chant along', out('They let you pass, laughing.', attr('charisma', 2), rage(2))),
  ]),
  ev('macro-cosmos-lab', 'Macro Cosmos Lab', V, { rarity: 'rare', minStage: 4, cast: ['trainer.worker_m'], effect: 'sparkle', tint: '#301018' }, 'A Macro Cosmos lab drains energy from wild Pokémon.', [
    ch('Shut it down', fight('Security bots and staff attack!', trainer('Macro Cosmos Staff', { types: ['steel', 'fairy'], size: 3, lv: 2, win: [good(5), any(...RARE_HELD)] }))),
    ch('Steal research notes', out('Interesting data.', rp(30), evil(2)), { check: 'intelligence', fail: out('Alarm! You run.', hurt(0.1)) }),
  ]),
  ev('star-heist', 'Team Star Heist', V, { rarity: 'uncommon', minStage: 2, cast: ['trainer.ryme'], effect: 'spin' }, 'Team Star is "borrowing" Poké Balls from a school.', [
    ch('Stop them', fight('"Star Barrage!"', trainer('Star Grunt', { size: 3, lv: 1, win: [item('great-ball', 3), good(3)] }))),
    ch('Talk them out of it', out('"…Fine. We\'ll return them."', good(3), attr('charisma', 2)), { check: 'charisma', fail: fight('"Nice try!"', trainer('Star Grunt', { size: 2 })) }),
  ]),
  ev('counterfeit-items', 'Counterfeit Items', V, { rarity: 'common', cast: ['trainer.roughneck'], effect: 'glint' }, '"Genuine Leftovers, only ₽300!" They look suspiciously plastic.', [
    ch('Buy them anyway (₽300)', out('Fake, of course.', $(-300)), { requires: [money(300)], chance: 0.15, fail: out('Plastic. You got scammed.', $(-300)) }),
    ch('Report the scammer', out('The police thank you.', good(3), $(400))),
  ]),
  ev('poacher-camp', 'Poacher Camp', V, { rarity: 'rare', minStage: 3, cast: ['trainer.roughneck'], effect: 'flicker', tint: '#201008' }, 'Hunters keep caged Pokémon in their camp.', [
    ch('Free the Pokémon', fight('The hunters attack!', trainer('Pokémon Hunter', { size: 3, lv: 2, win: [good(8), join({ lv: 1 })] }))),
    ch('Sneak in and open the cages', out('They all escape! One stays with you.', good(6), join({ lv: 0 })), { check: 'speed', fail: fight('Caught!', trainer('Pokémon Hunter', { size: 2, lv: 1 })) }),
  ]),

  // ---------- more helpers, gifts and kindness ----------
  ev('lost-wallet', 'Lost Wallet', H, { rarity: 'common', effect: 'glint' }, 'A wallet lies on the path, full of cash.', [
    ch('Return it', out('The owner rewards you.', good(5), $(500))),
    ch('Keep it', out('₽1500, nobody saw.', $(1500), evil(5)), { requires: [fierce] }),
  ]),
  ev('stuck-pokemon', 'Stuck Pokémon', H, { rarity: 'common', effect: 'hearts' }, 'A Pokémon is stuck in a fence and crying.', [
    ch('Free it gently', out('It nuzzles you and follows along.', join({ lv: -1 }), good(3)), { check: 'love', fail: out('It runs off, but it\'s free.', good(2)) }),
    ch('Force the fence', out('Snap! It\'s free.', good(2), attr('strength', 1), hurt(0.05))),
  ]),
  ev('old-mans-tale', "Old Man's Tale", H, { rarity: 'common', cast: ['trainer.hiker'], effect: 'fog' }, 'An old man by a campfire wants to share a story.', [
    ch('Listen', out('A tale of a legendary bird. You feel wiser.', rp(15), attr('intelligence', 1))),
    ch('Share your own story', out('He laughs and gives you a gift.', any(...HEALING), attr('charisma', 1))),
  ]),
  ev('bakery-gift', 'Bakery Gift', H, { rarity: 'common', cast: ['trainer.fairy_tale_girl'], effect: 'hearts' }, 'A baker is giving out free treats to trainers.', [
    ch('Take a treat', out('Delicious!', any(...SNACKS), fr(3))),
    ch('Help bake', out('Your team helped knead the dough.', fr(6), heal(0.3))),
  ]),
  ev('volunteer-cleanup', 'Volunteer Cleanup', H, { rarity: 'common', cast: ['trainer.worker_m'], effect: 'sparkle' }, 'Volunteers clean a polluted river.', [
    ch('Help out', out('The river sparkles again.', good(5), hurt(0.1), any(...HEALING))),
    ch('Donate (₽500)', out('They thank you warmly.', $(-500), good(4), attr('charisma', 1)), { requires: [money(500)] }),
    ch('Walk on', leave()),
  ]),
  ev('mom-calls', 'Mom Calls', H, { rarity: 'uncommon', effect: 'hearts', tint: '#302028' }, 'Your phone rings. It\'s Mom! "Are you eating well?"', [
    ch('Tell her everything', out('She sends a care package.', any(...HEALING), any(...BERRIES), attr('love', 2))),
    ch('Ask for money', out('"Here, but spend it wisely!"', $(1000))),
  ]),
  ev('rescue-team', 'Rescue Team Call', H, { rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], effect: 'rain' }, 'A Rescue Team asks for help finding a lost hiker in the fog.', [
    ch('Search with them', out('You find the hiker! The team rewards you.', good(5), $(800), any(...HEALING)), { check: 'intelligence', fail: out('No luck, but the team thanks you.', good(2)) }),
    ch('Battle the wild Pokémon blocking the path', fight('Clearing the way!', wild({ lv: 1, win: [good(4), $(600)] }))),
  ]),
  ev('kind-ranger', 'Pokémon Ranger', H, { rarity: 'common', cast: ['trainer.hiker'], effect: 'float' }, 'A Ranger offers to check your team.', [
    ch('Accept the check-up', out('All healthy!', heal(), cure())),
    ch('Ask about rare Pokémon', out('She marks a spot on your map.', reveal(), rp(5))),
  ]),
  ev('blind-old-lady', 'Old Lady at the Crossing', H, { rarity: 'common', effect: 'hearts' }, 'An old lady can\'t cross the busy road.', [
    ch('Help her cross', out('She gives you a lucky charm.', good(3), attr('luck', 2))),
    ch('Have a Pokémon carry her bags', out('She pats your lead.', good(3), fr(5, 'lead'))),
  ]),
  ev('pokemon-daycare-visit', 'Daycare Drop-In', H, { rarity: 'uncommon', cast: ['trainer.hiker'], effect: 'hearts', tint: '#283018' }, 'The daycare man waves. "Leave one with us a while?"', [
    ch('Leave the lead for a bit', out('It comes back stronger.', lv(2), fr(5, 'lead'))),
    ch('Ask about eggs', out('"Here, this one was left behind."', egg({ lv: -3, shiny: 2, left: 3 }))),
  ]),
  ev('stray-kitten', 'Stray Kitten', H, { rarity: 'common', pokemon: 'skitty', effect: 'hearts' }, 'A hungry little cat Pokémon mews at you.', [
    ch('Feed it', out('It purrs and joins you.', lose(), join({ species: ['skitty', 'meowth', 'purrloin', 'espurr', 'litleo', 'sprigatito'], lv: -1 }))),
    ch('Pet it', out('So soft.', attr('love', 2), peace(2))),
  ]),

  // ---------- more games of chance ----------
  ev('slot-machine', 'Slot Machine', G, { stop: 'casino', rarity: 'common', cast: ['trainer.guitarist'], effect: 'spin' }, 'A dusty slot machine blinks "777!"', [
    ch('Pull (₽300)', out('JACKPOT!', $(1500)), { requires: [money(300)], check: 'luck', fail: out('Nothing.', $(-300)) }),
    ch('Walk on', leave()),
  ]),
  ev('dice-game', 'Dice Game', G, { rarity: 'common', cast: ['trainer.roughneck'], effect: 'rattle' }, '"Roll higher than me and double your money!"', [
    ch('Bet ₽500', out('You win!', $(500)), { requires: [money(500)], chance: 0.5, fail: out('You lose.', $(-500)) }),
    ch('Bet ₽1500', out('Big win!', $(1500)), { requires: [money(1500)], chance: 0.45, fail: out('Big loss.', $(-1500)) }),
    ch('Walk on', leave()),
  ]),
  ev('ball-toss', 'Ball Toss', G, { rarity: 'common', cast: ['trainer.youngster_m'], effect: 'float' }, 'Throw a ball into the basket from far away.', [
    ch('Throw!', out('Swish! A prize!', any(...BALLS), any(...BALLS)), { check: 'speed', fail: out('Missed. Have a consolation ball.', item('poke-ball')) }),
  ]),
  ev('scratch-card', 'Scratch Card', G, { rarity: 'common', cast: ['trainer.worker_m'], effect: 'glint' }, '"Scratch cards, ₽200 each!"', [
    ch('Buy one', out('A winner!', $(1000)), { requires: [money(200)], chance: 0.25, fail: out('Not a winner.', $(-200)) }),
    ch('Buy five', out('Two winners!', $(1500)), { requires: [money(1000)], chance: 0.5, fail: out('All duds.', $(-1000)) }),
    ch('Walk on', leave()),
  ]),
  ev('voltorb-flip', 'Voltorb Flip', G, { rarity: 'uncommon', pokemon: 'voltorb', effect: 'sparkle' }, 'A board of cards. Some hide coins, some hide Voltorb!', [
    ch('Play carefully', out('Coins and more coins!', $(1200), attr('intelligence', 1)), { check: 'intelligence', fail: fight('BOOM! A Voltorb pops out!', wild({ species: ['voltorb'], lv: 0 })) }),
    ch('Flip wildly', out('Lucky flips!', $(2000)), { chance: 0.35, fail: fight('BOOM!', wild({ species: ['voltorb', 'electrode'], lv: 1 })) }),
  ]),
  ev('lucky-egg-hunt', 'Egg Hunt', G, { rarity: 'uncommon', effect: 'hearts', tint: '#283018' }, 'Painted eggs are hidden all over a park.', [
    ch('Search high', out('A golden egg!', item('lucky-egg')), { check: 'luck', fail: out('A chocolate egg. Yum.', heal(0.2)) }),
    ch('Search low', out('A basket of goodies.', any(...BERRIES), any(...HEALING))),
  ]),
  ev('fishing-derby', 'Fishing Derby', G, { stop: 'fish', rarity: 'uncommon', types: ['water'], cast: ['trainer.fisherman'], effect: 'rain', tint: '#103040' }, 'A fishing contest! Biggest catch wins.', [
    ch('Cast your line', fight('Something big bites!', wild({ types: ['water'], lv: 2, win: [$(1200)] }))),
    ch('Watch and bet (₽400)', out('Your fisherman won!', $(1000)), { requires: [money(400)], chance: 0.4, fail: out('Your fisherman lost.', $(-400)) }),
  ]),
  ev('mystery-door', 'Three Doors', G, { rarity: 'uncommon', effect: 'fog', tint: '#201828' }, 'Three doors. One has treasure, one has a Pokémon, one has nothing.', [
    ch('Left door', out('Treasure!', any(...TREASURE), any(...TREASURE)), { chance: 0.34, fail: out('An empty room.') }),
    ch('Middle door', fight('A Pokémon jumps out!', wild({ lv: 1, shiny: 2 }))),
    ch('Right door', out('A healing spring!', heal(), cure()), { chance: 0.5, fail: out('A broom closet.') }),
  ]),
  ev('ghost-gamble', 'Ghost\'s Gamble', G, { rarity: 'rare', minStage: 3, pokemon: 'gengar', effect: 'flicker', tint: '#180820' }, 'A grinning Gengar shuffles cards. "Pick one, if you dare."', [
    ch('Pick a card', out('The Ace! Gengar bows and gives you a prize.', any(...RARE_HELD), attr('luck', 2)), { chance: 0.5, fail: out('The Joker! Gengar curses your team.', status('sleep'), hurt(0.2)) }),
    ch('Challenge Gengar', fight('Gengar cackles!', wild({ species: ['gengar'], lv: 3 }))),
  ]),
  ev('coin-fountain', 'Coin Fountain', G, { rarity: 'common', effect: 'sparkle' }, 'A fountain full of coins. A sign says "Make a wish".', [
    ch('Toss a coin (₽100)', out('Your wish comes true!', $(-100), attr('luck', 3)), { requires: [money(100)] }),
    ch('Fish out some coins', out('₽400 in coins.', $(400), evil(3))),
  ]),

  // ---------- more training and growth ----------
  ev('waterfall-training', 'Waterfall Training', R, { rarity: 'common', types: ['water'], effect: 'rain', tint: '#103040' }, 'A roaring waterfall. Trainers meditate under it.', [
    ch('Stand under it', out('Freezing, but strong!', lv(1, 'party'), hurt(0.2), attr('strength', 2))),
    ch('Swim against it', out('Tough!', lv(2), attr('speed', 2)), { check: 'strength', fail: out('Swept away!', hurt(0.3)) }),
  ]),
  ev('mountain-climb', 'Mountain Climb', R, { rarity: 'common', types: ['rock'], effect: 'snow', tint: '#283038' }, 'A steep path up the mountain. The view must be amazing.', [
    ch('Climb to the top', out('What a view! Your team grows.', lv(1, 'party'), attr('strength', 2)), { check: 'strength', fail: out('Too steep. You turn back.', hurt(0.1)) }),
    ch('Meditate at the base', out('Calm and focused.', peace(3), heal(0.3))),
  ]),
  ev('sparring-partner', 'Sparring Partner', R, { rarity: 'common', cast: ['trainer.black_belt_m'], effect: 'shake' }, 'A Black Belt\'s Pokémon wants to spar with yours.', [
    ch('Spar hard', out('Both grow tougher.', lv(2), hurt(0.25), rage(2))),
    ch('Spar softly', out('Good practice.', lv(1), fr(3, 'lead'))),
  ]),
  ev('study-hall', 'Study Hall', R, { stop: 'library', rarity: 'common', cast: ['trainer.psychic_m'], effect: 'sparkle' }, 'A quiet room full of Pokémon books.', [
    ch('Study type matchups', out('You understand battles better.', attr('intelligence', 3), rp(10))),
    ch('Study Pokémon care', out('Your team trusts you more.', attr('love', 2), fr(4))),
  ]),
  ev('yoga-retreat', 'Yoga Retreat', R, { rarity: 'uncommon', cast: ['trainer.psychic_m'], effect: 'hearts', tint: '#283028' }, 'A calm retreat for trainers and Pokémon alike.', [
    ch('Join the class', out('Deep breaths.', peace(5), heal(0.5), fr(3))),
    ch('Skip to the hot spring', out('Ahh.', heal(), cure())),
  ]),
  ev('obstacle-course', 'Obstacle Course', R, { rarity: 'common', cast: ['trainer.biker'], effect: 'float' }, 'Ropes, tunnels and jumps. A record time wins a prize.', [
    ch('Go for the record', out('New record!', $(800), attr('speed', 3), lv(1)), { check: 'speed', fail: out('A tumble, but you finish.', hurt(0.1), attr('speed', 1)) }),
  ]),
  ev('ev-trainer', 'EV Coach', R, { rarity: 'uncommon', minStage: 2, cast: ['trainer.marshal'], effect: 'shake' }, '"I train one stat at a time. Pick your focus."', [
    ch('Power', out('Strong!', any('protein', 'calcium'), attr('strength', 1))),
    ch('Defence', out('Sturdy!', any('iron', 'zinc', 'hp-up'))),
    ch('Speed', out('Fast!', item('carbos'), attr('speed', 1))),
  ]),
  ev('rare-candy-cache', 'Candy Cache', R, { rarity: 'rare', minStage: 2, effect: 'sparkle', tint: '#302838' }, 'A hidden jar of Rare Candies behind a rock!', [
    ch('Share them with the team', out('Everyone levels up!', lv(1, 'party'))),
    ch('Give them all to the lead', out('Your lead grows a lot!', lv(3))),
  ]),
  ev('bond-ceremony', 'Bond Ceremony', R, { rarity: 'uncommon', effect: 'hearts', tint: '#402838' }, 'A shrine where trainers and Pokémon promise to stay together.', [
    ch('Make a promise', out('Your bond feels stronger than ever.', fr(12), attr('love', 3))),
    ch('Pray for strength', out('A warm light.', lv(1, 'party'), good(2))),
  ]),
  ev('ice-training', 'Ice Training', R, { rarity: 'common', types: ['ice'], effect: 'snow', tint: '#203040' }, 'A frozen lake perfect for slide practice.', [
    ch('Slide drills', out('Smooth moves!', attr('speed', 2), lv(1)), { check: 'speed', fail: out('Splat on the ice.', hurt(0.15)) }),
    ch('Ice fishing', fight('Something bites!', wild({ types: ['ice', 'water'], lv: 1 }))),
  ]),

  // ---------- more mysteries and story ----------
  ev('unown-wall', 'Unown Wall', Y, { rarity: 'rare', minStage: 3, pokemon: 'unown', effect: 'glint', tint: '#201810' }, 'Letters on a cave wall shift and spell a word.', [
    ch('Read the message', out('"FRIEND". An Unown floats out to join you.', join({ species: ['unown'], lv: 0 }), rp(20)), { check: 'intelligence', fail: out('Gibberish to you.', rp(5)) }),
    ch('Copy it down', out('A researcher would love this.', rp(25))),
  ]),
  ev('time-capsule', 'Time Capsule', Y, { rarity: 'uncommon', effect: 'rattle', tint: '#302418' }, 'A buried box labelled "Open in 20 years". It\'s been 30.', [
    ch('Open it', out('Old Poké Balls and a note.', item('great-ball', 2), any(...TREASURE), attr('love', 1))),
    ch('Rebury it with a gift', out('Someone will be happy one day.', lose(), good(4), attr('luck', 2))),
  ]),
  ev('ancient-tablet', 'Ancient Tablet', Y, { rarity: 'rare', minStage: 4, effect: 'glint', tint: '#201810' }, 'A stone tablet shows a giant Pokémon shaping the land.', [
    ch('Study it', out('You understand the legends better.', rp(30), attr('intelligence', 2))),
    ch('Touch it', fight('The tablet glows. A guardian appears!', wild({ types: ['rock', 'ground', 'steel'], lv: 3, win: [any(...TREASURE)] }))),
  ]),
  ev('ghost-ship', 'Ghost Ship', Y, { rarity: 'rare', minStage: 3, types: ['ghost'], effect: 'fog', tint: '#101820' }, 'A ship drifts in the fog. Nobody is on deck.', [
    ch('Board it', fight('The ship\'s ghosts awake!', wild({ types: ['ghost'], lv: 3, win: [any(...TREASURE), any(...RARE_HELD)] }))),
    ch('Watch it pass', out('A chill runs down your spine.', attr('luck', 1))),
  ]),
  ev('meteor-shower', 'Meteor Shower', Y, { rarity: 'uncommon', effect: 'sparkle', tint: '#080818' }, 'Shooting stars fill the sky. One lands nearby!', [
    ch('Find the meteorite', out('A Star Piece!', item('star-piece'), attr('luck', 1))),
    ch('Make a wish', out('You wish for your team\'s health.', heal(), attr('love', 1))),
    ch('Look for space Pokémon', fight('Something fell with the meteor!', wild({ species: ['clefairy', 'minior', 'beldum', 'elgyem', 'solrock', 'lunatone'], lv: 1 }))),
  ]),
  ev('lost-journal', 'Lost Journal', Y, { rarity: 'common', effect: 'fog' }, 'A soggy journal of a trainer who walked this road long ago.', [
    ch('Read it', out('Old secrets of this route.', reveal(), rp(10))),
    ch('Return it to the town', out('The family is grateful.', good(3), $(300))),
  ]),
  ev('distortion-world', 'Distortion', Y, { rarity: 'epic', minStage: 6, pokemon: 'giratina', effect: 'spin', tint: '#180818' }, 'The world flips upside down. A shadow with six wings watches.', [
    ch('Step into the distortion', fight('Giratina!', wild({ species: ['giratina'], lv: 4, shiny: 2 }))),
    ch('Run back', out('Everything is normal again… right?', attr('luck', -1), rp(15))),
  ]),
  ev('pokemon-statue', 'Mysterious Statue', Y, { rarity: 'common', effect: 'glint' }, 'An old statue of a Pokémon nobody recognizes.', [
    ch('Polish it', out('Its eyes glint. You feel lucky.', attr('luck', 3))),
    ch('Leave an offering', out('Something whispers "thank you".', lose(), good(2), heal(0.5))),
  ]),
  ev('dream-mist', 'Dream Mist', Y, { rarity: 'rare', minStage: 3, pokemon: 'munna', effect: 'fog', tint: '#281830' }, 'Pink mist drifts by. Your team starts dreaming of the future.', [
    ch('Follow the dream', out('You glimpse the gym leader\'s team in the dream.', gym(), attr('intelligence', 1))),
    ch('Catch the dreamer', fight('A Psychic-type feeding on dreams!', wild({ species: ['munna', 'musharna', 'drowzee'], lv: 1 }))),
  ]),
  ev('cursed-doll', 'Cursed Doll', Y, { rarity: 'uncommon', pokemon: 'banette', effect: 'flicker', tint: '#180818' }, 'A creepy doll sits on a bench. Its zipper mouth moves.', [
    ch('Pick it up', fight('It\'s a Banette!', wild({ species: ['shuppet', 'banette'], lv: 1 }))),
    ch('Give it a hug', out('It giggles and joins you.', join({ species: ['shuppet'], lv: 0 })), { check: 'love', fail: out('It bites!', hurt(0.1)) }),
    ch('Run', leave('You run very fast.')),
  ]),
  ev('ancient-seed', 'Ancient Seed', Y, { rarity: 'uncommon', types: ['grass'], effect: 'sparkle', tint: '#183018' }, 'A seed that glows warm, found in old ruins.', [
    ch('Plant it', out('It sprouts instantly into a berry bush!', any(...BERRIES), any(...BERRIES), any(...BERRIES))),
    ch('Keep it safe', out('It hatches! It was a Pokémon all along.', join({ types: ['grass'], lv: 0 }))),
  ]),

  // ---------- more famous faces ----------
  ev('brock-cooking', "Brock's Cooking", F, { rarity: 'uncommon', cast: ['trainer.hiker'], effect: 'hearts' }, 'A friendly breeder is cooking stew for every Pokémon in sight.', [
    ch('Share a meal', out('The best food ever.', heal(), fr(8))),
    ch('Ask for breeding tips', out('Your team trusts you more.', attr('love', 3), rp(10))),
  ]),
  ev('misty-swim', "Gym Leader's Swim", F, { rarity: 'uncommon', types: ['water'], cast: ['trainer.lacey'], effect: 'rain', tint: '#103050' }, 'A Water gym leader swims laps. "Race me!"', [
    ch('Race her', out('You won! She hands you a prize.', any('mystic-water', 'water-stone')), { check: 'speed', fail: out('She laps you twice. Still fun.', attr('speed', 1)) }),
    ch('Battle her', fight('"Splash!"', trainer('Swimmer', { types: ['water'], size: 3, lv: 2, win: [gym(), $(1500)] }))),
  ]),
  ev('blue-taunt', "Blue's Taunt", F, { rarity: 'uncommon', minStage: 2, cast: ['trainer.blue'], effect: 'shake' }, '"Smell ya later, loser!" Blue blocks the road.', [
    ch('Battle Blue', fight('"Let\'s see who\'s better!"', trainer('Blue', { size: 3, lv: 2, win: [$(2000), better(1)] }))),
    ch('Ignore him', out('"Hey! Don\'t ignore me!" You feel calm.', peace(3))),
  ]),
  ev('roark-mine', "Roark's Mine", F, { rarity: 'common', types: ['rock'], cast: ['trainer.roark'], effect: 'shake', tint: '#302418' }, 'A gym leader digs in the mine. "Help me dig, and we\'ll split the finds!"', [
    ch('Dig with him', out('Fossils and shards!', any(...FOSSILS), any(...TREASURE)), { check: 'strength', fail: out('Just rocks.', any('hard-stone')) }),
    ch('Battle him', fight('"Rock on!"', trainer('Roark', { types: ['rock'], size: 3, lv: 1, win: [item('hard-stone')] }))),
  ]),
  ev('candice-snowball', "Snowball Fight", F, { rarity: 'common', types: ['ice'], cast: ['trainer.candice'], effect: 'snow', tint: '#203040' }, '"Snowball fight! Focus, focus, focus!"', [
    ch('Throw snowballs', out('Direct hit!', attr('speed', 2), fr(5)), { check: 'speed', fail: out('Snow in your face.', attr('charisma', -1)) }),
    ch('Build a snow Pokémon', out('It looks great!', attr('charisma', 2), any('nevermeltice')), { check: 'charisma', fail: out('A lumpy snowman. Still fun.', fr(3)) }),
  ]),
  ev('lenora-museum', "Museum Tour", F, { rarity: 'common', cast: ['trainer.lenora'], effect: 'glint' }, 'A gym leader runs a museum. "Want the full tour?"', [
    ch('Take the tour', out('Fascinating fossils!', rp(20), attr('intelligence', 2))),
    ch('Battle her', fight('"Let\'s research your strength!"', trainer('Lenora', { types: ['normal'], size: 3, lv: 2, win: [item('silk-scarf'), $(1000)] }))),
  ]),
  ev('burgh-painting', "Artist's Studio", F, { rarity: 'common', types: ['bug'], cast: ['trainer.burgh'], effect: 'sparkle' }, 'An artist paints Bug Pokémon. "Pose for me?"', [
    ch('Pose', out('A masterpiece!', attr('charisma', 3), $(500))),
    ch('Battle him', fight('"Inspiration!"', trainer('Burgh', { types: ['bug'], size: 3, lv: 1, win: [any('silverpowder')] }))),
  ]),
  ev('mustard-dojo', 'Master Dojo', F, { rarity: 'rare', minStage: 4, cast: ['trainer.mustard'], effect: 'shake' }, 'A cheerful old master. "Train with me for a day?"', [
    ch('Train the lead', out('A huge jump in power!', lv(3), fr(5, 'lead'))),
    ch('Battle the master', fight('"Hohoho! Come on!"', trainer('Mustard', { types: ['fighting'], size: 3, lv: 3, win: [any(...RARE_HELD), better(1)] })), { requires: [fierce] }),
  ]),
  ev('larry-lunch', 'Salaryman\'s Lunch', F, { rarity: 'common', cast: ['trainer.larry'], effect: 'fog' }, 'A tired man eats rice balls. "Normal day, normal lunch."', [
    ch('Eat with him', out('He shares a rice ball. Very normal. Very nice.', heal(0.5), peace(2))),
    ch('Battle him', fight('"…Fine. One battle."', trainer('Larry', { types: ['normal', 'flying'], size: 3, lv: 2, win: [$(1500)] }))),
  ]),
  ev('kieran-rivalry', 'A Bitter Rival', F, { rarity: 'uncommon', minStage: 3, cast: ['trainer.kieran'], effect: 'flicker', tint: '#182030' }, 'A gloomy boy glares at you. "I\'ll get stronger than you. I have to."', [
    ch('Battle him', fight('"This time I\'ll win!"', trainer('Kieran', { size: 4, lv: 2, win: [$(2000), any(...RARE_HELD)] }))),
    ch('Encourage him', out('He looks surprised. "…Thanks."', good(4), attr('charisma', 2)), { check: 'love', fail: out('"Don\'t pity me!" He storms off.') }),
  ]),
  ev('poppy-steel', 'Little Steel Master', F, { rarity: 'common', types: ['steel'], cast: ['trainer.poppy'], effect: 'glint' }, 'A tiny girl with a big hammer. "Wanna play?"', [
    ch('Play', fight('"Hammer time!"', trainer('Poppy', { types: ['steel'], size: 2, lv: 2, win: [item('metal-coat')] }))),
    ch('Give her a snack', out('"Yay!" She gives you a shiny bolt.', lose(), any('metal-coat', 'iron-ball'))),
  ]),

  // ---------- places and weather ----------
  ev('sandstorm', 'Sandstorm', P, { rarity: 'common', types: ['ground', 'rock'], effect: 'fog', tint: '#403018' }, 'A sandstorm blows across the desert route.', [
    ch('Push through', out('Sand everywhere, but you made it.', hurt(0.15), attr('strength', 1))),
    ch('Shelter in ruins', fight('Something lives in the ruins!', wild({ types: ['ground', 'rock'], lv: 1, win: [any(...TREASURE)] }))),
  ]),
  ev('heatwave', 'Heatwave', P, { rarity: 'common', types: ['fire'], effect: 'fire', tint: '#402010' }, 'The sun burns hot. Your team pants.', [
    ch('Rest in the shade', out('Cooler now.', heal(0.4))),
    ch('Train in the heat', out('Tough, but worth it.', lv(1, 'party'), status('burn'))),
    ch('Buy cold drinks (₽300)', out('Refreshing!', $(-300), heal(0.6), fr(3)), { requires: [money(300)] }),
  ]),
  ev('blizzard-pass', 'Blizzard Pass', P, { rarity: 'uncommon', types: ['ice'], effect: 'snow', tint: '#203040' }, 'A mountain pass buried in snow.', [
    ch('Trudge through', out('Cold, but you make it.', hurt(0.2), attr('strength', 2))),
    ch('Find a cave', fight('An Ice-type lives here!', wild({ types: ['ice'], lv: 1 }))),
    ch('Camp by a fire', out('Warm and cozy.', heal(0.5), attr('love', 1))),
  ]),
  ev('foggy-moor', 'Foggy Moor', P, { rarity: 'common', types: ['ghost', 'dark'], effect: 'fog', tint: '#182020' }, 'Thick fog. You can\'t see your feet.', [
    ch('Feel your way forward', out('You find a lost item!', any(...HEALING)), { check: 'luck', fail: out('You walk in circles for hours.', hurt(0.1)) }),
    ch('Use a Pokémon\'s senses', out('Your team leads the way.', fr(5), reveal())),
  ]),
  ev('rainbow-bridge', 'Rainbow Bridge', P, { rarity: 'rare', minStage: 2, effect: 'sparkle', tint: '#203048' }, 'After the rain, a rainbow arcs over the route.', [
    ch('Walk under it', out('You feel blessed.', heal(), attr('luck', 3))),
    ch('Look for a rainbow Pokémon', fight('Something bright appears!', wild({ lv: 2, shiny: 10 }))),
  ]),
  ev('hot-spring', 'Hot Spring', P, { stop: 'rest', rarity: 'uncommon', effect: 'fog', tint: '#302020' }, 'Steam rises from a natural hot spring. Your team runs in.', [
    ch('Soak together', out('Bliss.', heal(), cure(), fr(5, 'lead'))),
    ch('Massage the lead', out('It melts with happiness.', fr(10, 'lead'), attr('love', 1))),
    ch('Talk', out('A quiet chat in the steam.', fr(5, 'lead'), peace(2))),
  ]),
  ev('starry-camp', 'Starry Campsite', P, { stop: 'rest', rarity: 'uncommon', effect: 'sparkle', tint: '#080818' }, 'A campsite under the stars. Your lead curls up beside you.', [
    ch('Tell stories', out('It falls asleep smiling.', fr(8, 'lead'), heal(0.5))),
    ch('Stargaze', out('A shooting star!', attr('luck', 2), fr(4, 'lead'))),
    ch('Cook curry', out('A delicious curry for everyone!', heal(0.7), fr(4))),
  ]),
  ev('flower-field-rest', 'Flower Field', P, { stop: 'rest', rarity: 'uncommon', types: ['grass', 'fairy'], effect: 'hearts', tint: '#304028' }, 'Flowers as far as you can see. Your lead rolls in them.', [
    ch('Make a flower crown', out('Your lead looks adorable.', fr(8, 'lead'), attr('charisma', 2))),
    ch('Play hide and seek', out('So much fun!', fr(6, 'lead'), attr('speed', 1))),
    ch('Nap in the flowers', out('A sweet nap.', heal(0.5), peace(2))),
  ]),
  ev('ruined-bridge', 'Broken Bridge', P, { rarity: 'common', effect: 'shake' }, 'The bridge ahead is broken. The river below is wild.', [
    ch('Fix it', out('Good as new! Travellers thank you.', good(3), attr('intelligence', 1)), { check: 'intelligence', fail: out('It collapses. You swim across.', hurt(0.15)) }),
    ch('Swim across', fight('A Water-type lives in the river!', wild({ types: ['water'], lv: 1 }))),
  ]),
  ev('lighthouse', 'Lighthouse', P, { rarity: 'uncommon', types: ['electric'], effect: 'sparkle', tint: '#102030' }, 'The lighthouse lamp is out. Its Ampharos looks sick.', [
    ch('Help the Ampharos', out('The light shines again! The keeper rewards you.', good(5), any(...HEALING), $(500)), { requires: [has('potion')] }),
    ch('Charge the lamp with your team', out('Bright as day!', good(3), attr('strength', 1)), { requires: [ptype('electric')] }),
    ch('Walk on', leave()),
  ]),
  ev('cherry-blossom', 'Cherry Blossoms', P, { rarity: 'common', effect: 'hearts', tint: '#402830' }, 'Pink petals fall everywhere. A festival is going on.', [
    ch('Join the festival', out('Food, games and laughs.', heal(0.5), fr(5), attr('charisma', 1))),
    ch('Catch a petal', out('Good luck all year!', attr('luck', 2))),
  ]),
  ev('volcano-rim', 'Volcano Rim', P, { rarity: 'rare', minStage: 3, types: ['fire'], effect: 'fire', tint: '#400808' }, 'The edge of an active volcano. Lava bubbles below.', [
    ch('Look into the crater', fight('A Fire-type rises from the lava!', wild({ types: ['fire'], lv: 3, win: [any('fire-stone', 'charcoal', 'heat-rock')] }))),
    ch('Collect volcanic ash', out('Rare ash and a stone.', item('fire-stone'), status('burn'))),
  ]),
  ev('crystal-cave', 'Crystal Cave', P, { rarity: 'uncommon', types: ['rock', 'ice'], effect: 'glint', tint: '#182838' }, 'A cave of glowing crystals.', [
    ch('Mine a crystal', out('A glittering shard.', any(...TREASURE)), { check: 'strength', fail: out('It cracks. Just dust.', hurt(0.05)) }),
    ch('Follow the light', fight('A crystal Pokémon!', wild({ species: ['carbink', 'sableye', 'boldore', 'crustle', 'nosepass'], lv: 2 }))),
  ]),
  ev('desert-oasis', 'Desert Oasis', P, { rarity: 'uncommon', types: ['ground', 'water'], effect: 'float', tint: '#403018' }, 'Palm trees and a pool of fresh water in the desert.', [
    ch('Drink and rest', out('Refreshed!', heal(), fr(3))),
    ch('Look around', fight('Something lives here!', wild({ types: ['ground', 'water'], lv: 1, shiny: 2 }))),
  ]),
  ev('ancient-forest', 'Ancient Forest', P, { rarity: 'rare', minStage: 4, types: ['grass', 'bug'], pokemon: 'celebi', effect: 'sparkle', tint: '#103010' }, 'Huge old trees. Time feels slower here.', [
    ch('Visit the shrine', fight('A time-travelling Pokémon!', wild({ species: ['celebi'], lv: 3, shiny: 2 })), { chance: 0.4, fail: out('Only the wind. You feel at peace.', peace(4), heal(0.5)) }),
    ch('Gather old berries', out('Rare berries.', any(...BERRIES), any(...BERRIES))),
  ]),
  ev('stormy-sea', 'Stormy Sea', P, { rarity: 'uncommon', types: ['water'], effect: 'rain', tint: '#102030' }, 'Huge waves crash. A boat is stuck on the rocks.', [
    ch('Rescue the boat', out('Everyone is safe! The captain rewards you.', good(5), $(1000)), { check: 'strength', fail: out('The waves knock you back.', hurt(0.2)) }),
    ch('Surf the waves', fight('A sea Pokémon surfs beside you!', wild({ types: ['water', 'dragon'], lv: 2 }))),
  ]),
  ev('moonlit-path', 'Moonlit Path', P, { rarity: 'uncommon', types: ['fairy', 'dark'], effect: 'sparkle', tint: '#101830' }, 'A full moon lights the path. Fairy Pokémon dance in a circle.', [
    ch('Dance with them', out('You feel light as a feather.', attr('love', 2), fr(5)), { check: 'charisma', fail: out('They stop and stare.') }),
    ch('Find a Moon Stone', out('Glowing under the moon.', item('moon-stone'))),
    ch('Meet a night Pokémon', fight('Something stirs in the dark.', wild({ types: ['dark', 'fairy'], lv: 1 }))),
  ]),
  ev('abandoned-power-plant', 'Abandoned Power Plant', P, { rarity: 'rare', minStage: 3, types: ['electric'], effect: 'flicker', tint: '#202008' }, 'Sparks fly in an old power plant.', [
    ch('Explore', fight('A strong Electric-type!', wild({ types: ['electric'], lv: 3, shiny: 2, win: [any('magnet', 'thunder-stone')] }))),
    ch('Search the control room', out('Old parts worth money.', $(1200), attr('intelligence', 1))),
  ]),
];

// The checks and the rage/peace meters stay part of the vocabulary even where unused here.
void [att, isGood, isPeace, isRage, peace, rage, evil, good, better];
