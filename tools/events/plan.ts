// Every event and map stop in Kice's "Events and map stops plan" (2026-10-25),
// in its order: the twelve approved events, the 96 drafts in nine groups, one
// event per type, the draft map stops and the rest spots.

import { $, BALLS, BERRIES, FOSSILS, HEALING, HELD, STONES, TREASURE, VITAMINS, any, att, better, ch, cure, ev, evil, fierce, fight, fr, good, gym, has, heal, hurt, isEvil, isGood, item, join, egg, eggMove, leave, lose, lv, money, out, party, peace, ptype, rage, isRage, isPeace, reveal, rp, status, trade, trainer, wild, attr, type Json } from './dsl.ts';

const A = 'Approved events';
const M = 'Merchants and deals';
const T = 'Trainers and challenges';
const W = 'Wild Pokémon scenes';
const V = 'Tricksters, villains and teams';
const H = 'Helpers, gifts and kindness';
const G = 'Games of chance';
const R = 'Training and growth';
const Y = 'Mysteries and story';
const F = 'Famous faces';
const P = 'One event for every type';
const S = 'Map stops';
const B = 'Rest spots';

export const PLAN_EVENTS: Json[] = [
  // ---------- the twelve approved events ----------
  ev('mysterious-chest', 'Mysterious Chest', A, { stop: 'treasure', cast: [], effect: 'rattle', tint: '#3a2a10' }, 'A heavy chest sits alone in the grass. It rattles once.', [
    ch('Open it', out('Treasure! It was full of shiny things.', any(...TREASURE), any(...HELD), attr('luck', 5)), { chance: 0.6, fail: fight('A Pokémon bursts out of the chest!', wild({ lv: 3, win: [any(...TREASURE)] })) }),
    ch('Leave it', leave()),
  ]),
  ev('shady-dealer', 'Shady Dealer', A, { stop: 'merchant', cast: ['trainer.roughneck'], effect: 'fog', tint: '#2a1838' }, '"Psst. Trade me one of yours and I\'ll give you something… stronger."', [
    ch('Trade an unevolved Pokémon for a stronger one', out('He takes your Pokémon and hands over a Poké Ball with a wink.', trade('an unevolved Pokémon', { stage: 1 }), join({ lv: 4 }), evil(10))),
    ch('Refuse', leave('"Your loss, kid."')),
  ]),
  ev('lost-pokemon', 'Lost Pokémon', A, { cast: [], effect: 'hearts' }, 'A small Pokémon is crying by the path. Its trainer is nowhere to be seen.', [
    ch('Help it find its trainer', out('The grateful trainer rewards you!', good(10), $(600), any(...HEALING))),
    ch('Keep it', out('It nervously joins your party.', join({ lv: -2 }), evil(10)), { requires: [fierce] }),
    ch('Walk on', leave()),
  ]),
  ev('training-session', 'Training Session', A, { cast: ['trainer.black_belt_m'], effect: 'shake' }, 'A Black Belt offers to train your lead Pokémon.', [
    ch('Train hard', out('Your lead grits its teeth and grows stronger!', lv(2), hurt(0.3), attr('strength', 5), rage(5))),
    ch('Train gently', out('A calm session. Your lead trusts you more.', fr(15, 'lead'), peace(5))),
  ]),
  ev('department-store-sale', 'Department Store Sale', A, { stop: 'shop', cast: [], effect: 'glint' }, 'A pop-up stall: "Everything must go!"', [
    ch('Ball bundle (₽400)', out('A bundle of balls!', $(-400), item('great-ball', 3), item('poke-ball', 3)), { requires: [money(400)] }),
    ch('Healing bundle (₽500)', out('Medicine for the road.', $(-500), item('super-potion', 3), item('full-heal')), { requires: [money(500)] }),
    ch('Vitamin bundle (₽1,200)', out('Two vitamins, cheap!', $(-1200), any(...VITAMINS), any(...VITAMINS)), { requires: [money(1200)] }),
    ch('Just browse', leave()),
  ]),
  ev('vitamin-seller', 'Vitamin Seller', A, { stop: 'merchant', cast: ['trainer.guitarist'], effect: 'glint' }, 'A man in sunglasses opens a crate of unlabeled bottles.', [
    ch('Cheap vitamins (₽300)', out('Probably fine…', $(-300), any(...VITAMINS)), { requires: [money(300)], chance: 0.5, fail: out('They tasted awful. Your Pokémon sulk.', $(-300), fr(-10)) }),
    ch('The real thing (₽900)', out('Genuine vitamins.', $(-900), any(...VITAMINS), any(...VITAMINS)), { requires: [money(900)] }),
    ch('Leave', leave()),
  ]),
  ev('fight-or-flight', 'Fight or Flight', A, { effect: 'glint', tint: '#402010' }, 'A strong Pokémon guards something glowing.', [
    ch('Fight it', fight('It roars and charges!', wild({ lv: 4, win: [any(...HELD, ...STONES)] }))),
    ch('Sneak past', out('You slip by and grab the item!', any(...HELD, ...STONES)), { requires: [att('speed', 30)] }),
  ]),
  ev('berry-patch', 'Berry Patch', A, { effect: 'sparkle', tint: '#204018' }, 'A berry bush, heavy with fruit. Something is munching on it.', [
    ch('Pick berries', out('A handful of berries.', any(...BERRIES), any(...BERRIES))),
    ch('Fight the muncher', fight('The muncher turns on you!', wild({ types: ['grass', 'bug'], win: [item('sitrus-berry', 2), good(5)] }), rage(3)), { requires: [fierce] }),
  ]),
  ev('wandering-breeder', 'Wandering Breeder', A, { cast: ['trainer.aroma_lady'], effect: 'hearts' }, 'A breeder offers to look after one of your Pokémon for a while.', [
    ch('Leave a Pokémon with her', out('It comes back glowing and happy, with a new trick.', fr(30, 'lead'), lv(1)), { requires: [party(2)] }),
    ch('No thanks', leave()),
  ]),
  ev('challengers', 'Mysterious Challengers', A, { cast: ['trainer.youngster_m', 'trainer.psychic_m', 'trainer.dragon_tamer'], effect: 'sparkle' }, 'Three trainers on pedestals. "Pick your opponent!"', [
    ch('Easy', fight('A warm-up.', trainer('Rookie', { cls: 'youngster', size: 1, lv: -2, win: [$(400)] }))),
    ch('Medium', fight('A fair fight.', trainer('Ace', { cls: 'psychic', size: 2, lv: 1, win: [$(900), better()] }))),
    ch('Hard', fight('The strongest of them steps down.', trainer('Veteran', { cls: 'dragon-tamer', size: 3, lv: 3, win: [$(1500), better(1)] })), { requires: [fierce] }),
  ]),
  ev('sleeping-giant', 'Sleeping Giant', A, { pokemon: 'snorlax', effect: 'float' }, 'A huge Snorlax is asleep across the path.', [
    ch('Battle it', fight('It wakes up grumpy!', wild({ species: ['snorlax'], lv: 3, win: [item('leftovers')] })), { requires: [fierce] }),
    ch('Feed it a berry', out('It munches happily and rolls aside. Something fell from its fur.', attr('love', 5), any(...HELD)), { requires: [has('oran-berry')] }),
    ch('Sneak past', out('You tiptoe by.'), { requires: [att('speed', 40)] }),
  ]),
  ev('fortune-teller', 'Fortune Teller', A, { cast: ['trainer.hex_maniac'], effect: 'float', tint: '#301848' }, '"The cards know who waits at the gym…"', [
    ch('Pay ₽500 for a reading', out('She describes the gym leader\'s whole team.', $(-500), gym()), { requires: [money(500)] }),
    ch('Read it yourself', out('You work it out from the signs.', gym()), { requires: [att('intelligence', 40)] }),
    ch('Ignore her', leave()),
  ]),

  // ---------- merchants and deals ----------
  ev('haggle-sale', 'Department Store Haggle', M, { stop: 'shop', cast: ['trainer.worker_m'], effect: 'glint' }, 'Price tags flip to red as a clerk waves you over.', [
    ch('Buy a bundle (₽600)', out('Balls and medicine.', $(-600), any(...BALLS), any(...HEALING)), { requires: [money(600)] }),
    ch('Haggle', out('You talk the price right down.', $(-200), any(...BALLS), any(...HEALING)), { requires: [money(200)], check: 'charisma', fail: out('He won\'t budge. You leave.') }),
    ch('Leave', leave()),
  ]),
  ev('shady-vitamins', 'Shady Vitamin Dealer', M, { stop: 'merchant', cast: ['trainer.biker'], effect: 'fog' }, 'A crate of bottles. Some labels are… spelled wrong.', [
    ch('Cheap vitamins (₽250)', out('They work!', $(-250), any(...VITAMINS)), { requires: [money(250)], chance: 0.45, fail: out('Fakes. Your Pokémon feel queasy.', $(-250), fr(-10)) }),
    ch('Real vitamins (₽1,000)', out('The real deal.', $(-1000), any(...VITAMINS), any(...VITAMINS)), { requires: [money(1000)] }),
    ch('Test them first', out('You spot the fakes and pick a real one.', $(-250), any(...VITAMINS)), { requires: [att('intelligence', 30), money(250)] }),
  ]),
  ev('black-market', 'Black Market', M, { stop: 'merchant', cast: ['trainer.giovanni'], effect: 'fog', tint: '#200810' }, 'A curtain parts. Goods no shop would sell.', [
    ch('Buy contraband (₽1,500)', out('No questions asked.', $(-1500), any('life-orb', 'choice-band', 'focus-sash', 'rare-candy'), evil(10)), { requires: [money(1500)] }),
    ch('Report them', fight('"You\'ll regret that!"', trainer('Rocket Grunt', { cls: 'roughneck', size: 2, types: ['poison', 'dark'], win: [$(800), any(...HELD)] }), good(10)), { requires: [fierce] }),
    ch('Walk on', leave()),
  ]),
  ev('travelling-collector', 'Travelling Collector', M, { cast: ['boss.bill'], effect: 'glint' }, 'A collector peers at your Bag through a glass case.', [
    ch('Sell a treasure for triple', out('He pays handsomely.', lose(), $(2500))),
    ch('Swap an item', out('A mystery item, wrapped in paper.', lose(), any(...HELD, ...STONES))),
    ch('Leave', leave()),
  ]),
  ev('pokemon-salesman', 'Pokémon Salesman', M, { pokemon: 'magikarp', cast: ['trainer.guitarist'], effect: 'sparkle' }, '"A Magikarp on a cushion! Only ₽500! It\'s a secret kind!"', [
    ch('Buy it (₽500)', out('It flops into your party.', $(-500), join({ species: ['magikarp'], lv: -3 })), { requires: [money(500)] }),
    ch('Ask its secret', out('It\'s shiny!', $(-500), join({ species: ['magikarp'], shiny: 400 })), { requires: [money(500)], check: 'luck', fail: out('"Secret? It\'s a fish." You buy it anyway.', $(-500), join({ species: ['magikarp'] })) }),
    ch('Refuse', leave()),
  ]),
  ev('bargain-bin', 'Bargain Bin', M, { stop: 'treasure', cast: ['trainer.worker_m'], effect: 'rattle' }, 'A janitor tips over a bin of odds and ends.', [
    ch('Dig through it', out('Something good was buried in there!', any(...TREASURE, ...HELD)), { check: 'luck', fail: out('Mostly junk. One Potion.', item('potion')) }),
    ch('Pay ₽300 to dig deeper', out('Two finds!', $(-300), any(...TREASURE), any(...HEALING)), { requires: [money(300)] }),
    ch('Leave', leave()),
  ]),
  ev('chefs-tasting', "Chef's Tasting", M, { effect: 'fire' }, 'Steaming plates line a roadside table.', [
    ch('Pay for a meal (₽400)', out('Delicious. Everyone feels better.', $(-400), heal(1), fr(8)), { requires: [money(400)] }),
    ch('Cook-off', out('You win the cook-off! Free berries.', item('sitrus-berry', 3), attr('intelligence', 2)), { check: 'intelligence', fail: out('Burnt. You help with the dishes.', hurt(0.1)) }),
    ch('Leave', leave()),
  ]),
  ev('item-pawnshop', 'Item Pawnshop', M, { stop: 'merchant', effect: 'glint' }, 'A maid sits at a ledger. "Pawn something?"', [
    ch('Pawn an item', out('Quick cash.', lose(), $(1200))),
    ch('Leave', leave()),
  ]),
  ev('ticket-tout', 'Ticket Tout', M, { cast: ['trainer.roughneck'], effect: 'glint' }, '"Ticket to a secret stop? Real, I swear."', [
    ch('Buy a ticket (₽400)', out('It was real! Every "?" on this stage is revealed.', $(-400), reveal()), { requires: [money(400)], chance: 0.6, fail: out('Fake. He\'s gone.', $(-400)) }),
    ch('Call his bluff', out('He hands it over for free.', reveal()), { requires: [att('intelligence', 40)] }),
    ch('Leave', leave()),
  ]),
  ev('charm-peddler', 'Charm Peddler', M, { cast: ['trainer.fairy_tale_girl'], effect: 'sparkle', tint: '#402038' }, 'Lanterns sway over a cart of charms.', [
    ch('Luck charm (₽700)', out('You feel lucky.', $(-700), attr('luck', 10)), { requires: [money(700)] }),
    ch('Love charm (₽700)', out('Your Pokémon gather close.', $(-700), attr('love', 10)), { requires: [money(700)] }),
    ch('Leave', leave()),
  ]),
  ev('mega-bazaar', 'Mega Bazaar', M, { stop: 'merchant', rarity: 'rare', minStage: 3, effect: 'sparkle' }, 'A shopfront glittering with strange stones.', [
    ch('Buy a Mega Ring (₽5,000)', out('It hums on your wrist.', $(-5000), item('mega-ring')), { requires: [money(5000)] }),
    ch('Buy a Tera Orb (₽5,000)', out('It shimmers like crystal.', $(-5000), item('tera-orb')), { requires: [money(5000)] }),
    ch('Leave', leave()),
  ]),

  // ---------- trainers and challenges ----------
  ev('winstrate-family', 'The Winstrate Family', T, { cast: ['trainer.youngster_m', 'trainer.aroma_lady', 'trainer.biker'], effect: 'sparkle' }, 'A whole family lines up. "Beat us all, back to back!"', [
    ch('Take them all on', fight('The family sends out their best!', trainer('Winstrates', { size: 4, lv: 1, win: [$(3000), any(...HELD)] }))),
    ch('Decline', leave()),
  ]),
  ev('trainers-test', "A Trainer's Test", T, { cast: ['trainer.psychic_m'], effect: 'sparkle' }, '"Battle me with one Pokémon, and I\'ll teach it something."', [
    ch('Accept', fight('A one-on-one test!', trainer('Expert', { cls: 'psychic', size: 1, lv: 2, win: [lv(2), fr(10, 'lead')] }))),
    ch('Decline', leave()),
  ]),
  ev('double-trouble', 'Double Trouble', T, { cast: ['trainer.youngster_m', 'trainer.fairy_tale_girl'], effect: 'hearts' }, 'Twins hold hands. "We battle together!"', [
    ch('Battle them both', fight('Two at once!', trainer('Twins', { size: 2, lv: 1, win: [$(1000), better()] }))),
    ch('Decline', leave()),
  ]),
  ev('dojo-challenge', 'Dojo Challenge', T, { stop: 'dojo', cast: ['trainer.black_belt_m'], types: ['fighting'], effect: 'shake' }, 'A Black Belt bows. "Spar, or meditate?"', [
    ch('Spar', out('A great bout!', attr('strength', 5), lv(1)), { check: 'strength', fail: out('You take a beating, but learn.', hurt(0.3), attr('strength', 2)) }),
    ch('Meditate', out('Calm settles over you.', peace(10))),
    ch('Leave', leave()),
  ]),
  ev('rival-rematch', 'Rival Rematch', T, { cast: ['boss.hop'], effect: 'sparkle' }, 'Your rival runs up, out of breath. "Battle! Now!"', [
    ch('Battle your rival', fight('"I\'ve been training!"', trainer('Rival', { boss: 'hop', size: 3, lv: 2, win: [$(1500), better(1)] }))),
    ch('Train together', out('You both get better.', fr(10), lv(1))),
  ]),
  ev('battle-tower-floor', 'Battle Tower Floor', T, { stop: 'tower', cast: ['boss.ingo', 'boss.emmet'], effect: 'sparkle' }, 'Two conductors stand at a lift door. "All aboard for the next floor!"', [
    ch('Climb one floor', fight('Floor 1!', trainer('Tower Trainer', { size: 2, lv: 1, win: [$(1000)] }))),
    ch('Climb three floors', fight('Floor 3! Much harder.', trainer('Tower Ace', { size: 4, lv: 4, win: [$(4000), better(2)] })), { requires: [fierce] }),
    ch('Leave', leave()),
  ]),
  ev('youngsters-shorts', "Youngster's Shorts", T, { cast: ['trainer.youngster_m'], types: ['normal'], effect: 'sparkle' }, '"Like my shorts? They\'re comfy and easy to wear!"', [
    ch('Battle', fight('"Let\'s go!"', trainer('Youngster Joey', { cls: 'youngster', size: 1, win: [$(300)] }))),
    ch('Compliment his shorts', out('He\'s so happy he gives you a Rare Candy.', item('rare-candy')), { requires: [att('charisma', 20)] }),
  ]),
  ev('ace-trainer-bet', 'Ace Trainer Bet', T, { effect: 'glint' }, 'An Ace Trainer flips a coin. "Bet on our battle?"', [
    ch('Bet ₽1,000', fight('Winner takes all!', trainer('Ace Trainer', { size: 3, lv: 2, win: [$(3000)] }), $(-1000)), { requires: [money(1000)] }),
    ch('Battle for free', fight('Just for fun.', trainer('Ace Trainer', { size: 2, lv: 1, win: [$(700)] }))),
  ]),
  ev('gym-scout', 'Gym Scout', T, { stop: 'scout', cast: ['boss.Spr_Pt_Looker'], effect: 'fog' }, 'A guide points at the gym. "Want to know what\'s inside?"', [
    ch('Pay ₽600', out('You learn the leader\'s whole team.', $(-600), gym()), { requires: [money(600)] }),
    ch('Sneak a look', out('You peek through a window.', gym()), { requires: [att('speed', 40)] }),
    ch('Leave', leave()),
  ]),
  ev('pokeathlon', 'Pokéathlon', T, { effect: 'sparkle' }, 'A track, hurdles and a cheering crowd.', [
    ch('Race', out('First place!', attr('speed', 5), item('protein')), { check: 'speed', fail: out('You trip at the end.', attr('speed', 1)) }),
    ch('Hurdle', out('Clean jumps!', attr('strength', 5), item('carbos')), { check: 'strength', fail: out('You knock every hurdle.', attr('strength', 1)) }),
    ch('Skip', leave()),
  ]),
  ev('contest-hall', 'Contest Hall', T, { stop: 'contest', cast: ['boss.dawn', 'boss.may-rs'], effect: 'sparkle', tint: '#402848' }, 'Spotlights sweep the stage. "Beauty, Cool or Cute?"', [
    ch('Enter Beauty', out('A ribbon!', attr('charisma', 10), $(800)), { check: 'charisma', fail: out('The judges yawn.', attr('charisma', 2)) }),
    ch('Enter Cool', out('The crowd goes wild!', attr('charisma', 10), $(800)), { check: 'charisma', fail: out('A polite clap.', attr('charisma', 2)) }),
    ch('Enter Cute', out('Aww! A ribbon!', attr('charisma', 8), fr(8)), { check: 'charisma', fail: out('Cute, but not enough.', attr('charisma', 2)) }),
    ch('Watch', out('You pick up a few tips.', attr('charisma', 2))),
  ]),

  // ---------- wild Pokémon scenes ----------
  ev('slumbering-snorlax', 'Slumbering Snorlax', W, { pokemon: 'snorlax', types: ['normal'], effect: 'float' }, 'Snoring shakes the ground.', [
    ch('Battle', fight('It wakes!', wild({ species: ['snorlax'], lv: 2, win: [item('leftovers')] })), { requires: [fierce] }),
    ch('Feed it a berry', out('It rolls over and drops something.', attr('love', 5), any(...HELD)), { requires: [has('sitrus-berry')] }),
    ch('Sneak past', out('Not a twitch.'), { requires: [att('speed', 40)] }),
  ]),
  ev('fight-or-flight-2', 'Glowing Guardian', W, { effect: 'glint' }, 'A strong Pokémon stands over a glowing item.', [
    ch('Fight', fight('It attacks!', wild({ lv: 4, win: [any(...STONES, ...HELD)] }))),
    ch('Sneak', out('You grab it and run!', any(...STONES, ...HELD)), { check: 'speed', fail: fight('It spots you!', wild({ lv: 4, win: [any(...STONES)] })) }),
    ch('Bribe it with food', out('It trades the item for a snack.', lose(), any(...STONES, ...HELD))),
  ]),
  ev('berries-abound', 'Berries Abound', W, { types: ['grass', 'bug'], effect: 'sparkle' }, 'A berry tree shakes with Pokémon.', [
    ch('Pick berries', out('Berries!', any(...BERRIES), any(...BERRIES))),
    ch('Shoo them', fight('One won\'t leave!', wild({ types: ['grass', 'bug'], win: [item('sitrus-berry', 2)] }), rage(5)), { requires: [fierce] }),
    ch('Share', out('They share back.', good(5), item('oran-berry', 2))),
  ]),
  ev('lost-at-sea', 'Lost at Sea', W, { types: ['water'], effect: 'rain', tint: '#102848' }, 'A swimmer waves from a drifting raft.', [
    ch('Guide them with a Water-type', out('Safe! They give you a gift.', item('mystic-water'), fr(10), good(5)), { requires: [ptype('water')] }),
    ch('Swim out yourself', out('You haul the raft back!', any(...HEALING), good(5)), { check: 'strength', fail: out('The current is too strong. You barely make it.', hurt(0.25)) }),
  ]),
  ev('fiery-fallout', 'Fiery Fallout', W, { types: ['fire'], effect: 'fire', tint: '#401808' }, 'Ash rains down. Fire Pokémon sleep in the warm haze.', [
    ch('Battle the Fire Pokémon', fight('It wakes in a blaze!', wild({ types: ['fire'], lv: 2, win: [item('fire-stone'), item('charcoal')] })), { requires: [fierce] }),
    ch('Wait it out', out('The ash clears. Your party is tired.', hurt(0.15))),
    ch('Use a Water move', out('Steam! A rare Fire Pokémon wants to come with you.', join({ types: ['fire'], lv: 1 })), { requires: [ptype('water')] }),
  ]),
  ev('uncommon-breed', 'Uncommon Breed', W, { effect: 'sparkle' }, 'A strangely coloured Pokémon is eating quietly.', [
    ch('Battle it', fight('It\'s strong!', wild({ lv: 2, shiny: 4 }))),
    ch('Feed it to calm it', out('It follows you!', join({ shiny: 4 })), { check: 'love', fail: out('It runs off.') }),
  ]),
  ev('stampede', 'Pokémon Stampede', W, { effect: 'shake', tint: '#3a2810' }, 'A herd thunders towards you!', [
    ch('Stand firm', out('The herd parts around you. One stays.', join({ lv: 1 })), { requires: [att('strength', 40)] }),
    ch('Dodge', out('You leap aside and catch one\'s eye.', join()), { requires: [att('speed', 40)] }),
    ch('Hide', out('You hide, but get trampled a bit.', hurt(0.3))),
  ]),
  ev('swarm', 'Swarm', W, { stop: 'swarm', effect: 'sparkle' }, 'Dozens of the same Pokémon fill the field.', [
    ch('Battle one', fight('Here comes one!', wild({ shiny: 3, win: [$(500)] }))),
    ch('Throw a lure', out('One comes right to you!', join({ shiny: 3 })), { requires: [has('honey')] }),
  ]),
  ev('injured-pokemon', 'Injured Pokémon', W, { effect: 'hearts' }, 'A fainted wild Pokémon lies in the grass.', [
    ch('Heal it with a Potion', out('It wakes and nuzzles you. It wants to come along!', good(10), join({ lv: -1 })), { requires: [has('potion')] }),
    ch('Catch it now', out('You catch it while it\'s down.', evil(10), join({ lv: -2 })), { requires: [fierce] }),
    ch('Walk on', leave()),
  ]),
  ev('egg-nest', 'Egg Nest', W, { effect: 'sparkle' }, 'An unguarded nest holds one egg.', [
    ch('Take the egg', out('You tuck the Egg into your bag. It feels warm.', egg({ lv: -5, left: 3 }), evil(5))),
    ch('Wait for the parent', fight('The parent is furious!', wild({ lv: 3, win: [good(5), item('oval-stone')] })), { requires: [fierce] }),
    ch('Leave it', out('You walk on, feeling good.', good(5))),
  ]),
  ev('legendary-shadow', 'Legendary Shadow', W, { rarity: 'epic', minStage: 4, effect: 'fog', tint: '#101020' }, 'A huge silhouette moves in the fog. The air goes still.', [
    ch('Follow it', fight('It turns to face you!', wild({ species: ['articuno', 'zapdos', 'moltres', 'raikou', 'entei', 'suicune', 'latias', 'latios', 'uxie', 'mesprit', 'azelf'], lv: 6, win: [rp(50)] })), { check: 'luck', fail: out('The shadow fades into the fog.', rp(10)) }),
    ch('Ignore it', leave()),
  ]),
  ev('fishing-spot-event', 'Fishing Spot', W, { stop: 'fish', cast: ['trainer.fisherman'], types: ['water'], effect: 'rain' }, '"Borrow a rod? Old, Good or Super!"', [
    ch('Old Rod (free)', fight('Something bites!', wild({ types: ['water'], lv: -2 }))),
    ch('Good Rod (₽300)', fight('A strong pull!', wild({ types: ['water'], lv: 1 }), $(-300)), { requires: [money(300)] }),
    ch('Super Rod (₽800)', fight('A huge catch!', wild({ types: ['water', 'dragon'], lv: 3, shiny: 2 }), $(-800)), { requires: [money(800)] }),
  ]),

  // ---------- tricksters, villains and teams ----------
  ev('rocket-ambush', 'Team Rocket Ambush', V, { stop: 'ambush', cast: ['boss.teamrocket'], effect: 'net', tint: '#300810' }, 'A net drops from the trees! "Prepare for trouble!"', [
    ch('Battle', fight('"Make it double!"', trainer('Team Rocket', { size: 2, types: ['poison', 'normal'], win: [$(1200), any(...HELD)] }))),
    ch('Pay them off (₽800)', out('They grab the cash and blast off.', $(-800)), { requires: [money(800)] }),
    ch('Bluff', out('"The police are right behind me!" They flee, dropping something.', any(...TREASURE)), { requires: [att('charisma', 40)] }),
  ]),
  ev('aqua-dig', 'Team Aqua Dig', V, { cast: ['boss.archie-gen6'], types: ['water'], effect: 'rain' }, 'Team Aqua grunts are digging up the shore.', [
    ch('Battle', fight('"Get lost!"', trainer('Aqua Grunt', { size: 2, types: ['water', 'dark'], win: [item('water-stone'), $(800)] }))),
    ch('Steal their find', out('You grab it and run!', item('water-stone'), evil(10)), { check: 'speed', fail: fight('Caught!', trainer('Aqua Grunt', { size: 2, types: ['water'] }), evil(5)) }),
  ]),
  ev('magma-heist', 'Team Magma Heist', V, { cast: ['boss.maxie-gen6'], types: ['fire', 'ground'], effect: 'fire' }, 'Team Magma surrounds a smoking crate.', [
    ch('Battle', fight('"For the land!"', trainer('Magma Grunt', { size: 2, types: ['fire', 'ground'], win: [any('fire-stone', 'sun-stone'), $(800)] }))),
    ch('Distract them', out('While they argue, you take the crate.', any('fire-stone', 'sun-stone')), { check: 'charisma', fail: out('They see right through you.') }),
  ]),
  ev('galactic-survey', 'Galactic Survey', V, { cast: ['boss.cyrus'], effect: 'sparkle', tint: '#182838' }, 'A Galactic grunt waves a scanner. "Mind if I scan your party?"', [
    ch('Battle', fight('"Then I\'ll take the data by force!"', trainer('Galactic Grunt', { size: 2, types: ['poison', 'steel'], win: [$(900)] }))),
    ch('Let them scan', out('You peek at their readings. Interesting!', attr('intelligence', 5), rp(25))),
  ]),
  ev('plasma-liberation', 'Plasma Liberation', V, { cast: ['boss.ghetsis'], effect: 'fog' }, '"Liberate your Pokémon!" A Plasma grunt waves a banner.', [
    ch('Battle', fight('"You\'re a prisoner of your own Pokémon!"', trainer('Plasma Grunt', { size: 2, types: ['dark', 'normal'], win: [$(1000), better()] }))),
    ch('Give them money for their cause', out('They pay you back double, oddly.', good(-10), $(1500))),
  ]),
  ev('flare-fashion', 'Flare Fashion', V, { cast: ['boss.lysandre'], types: ['fire'], effect: 'glint', tint: '#401010' }, 'Two grunts in red suits strike a pose.', [
    ch('Battle', fight('"How unfashionable!"', trainer('Flare Grunt', { size: 2, types: ['fire', 'dark'], win: [$(1000)] }))),
    ch('Buy their style (₽2,000)', out('You look amazing.', $(-2000), attr('charisma', 15)), { requires: [money(2000)] }),
  ]),
  ev('skull-squad', 'Skull Squad', V, { cast: ['boss.guzma', 'boss.plumeria'], types: ['bug', 'poison'], effect: 'shake' }, 'Team Skull grunts spray graffiti. "Yo, what you lookin\' at?"', [
    ch('Battle', fight('"We\'re gonna mess you up!"', trainer('Skull Grunt', { size: 2, types: ['bug', 'poison', 'dark'], win: [$(900)] }), rage(5))),
    ch('Rap battle', out('Your rhymes win! They pay up.', $(800), attr('charisma', 3)), { check: 'charisma', fail: out('They laugh you off the stage.') }),
  ]),
  ev('yell-fans', 'Yell Fans', V, { cast: ['boss.piers'], types: ['dark'], effect: 'shake' }, 'Team Yell blocks the road with signs and noise.', [
    ch('Battle', fight('"For Marnie!"', trainer('Yell Grunt', { size: 2, types: ['dark'], win: [lv(1)] }))),
    ch('Cheer louder', out('Out-yelled! They let you through, impressed.', attr('charisma', 3), lv(1)), { check: 'charisma', fail: out('You lose your voice.') }),
  ]),
  ev('star-raid', 'Star Squad Raid', V, { cast: ['trainer.penny'], effect: 'sparkle' }, 'A Starmobile revs outside a Team Star base.', [
    ch('Battle the boss', fight('"Let\'s rumble!"', trainer('Team Star Boss', { boss: 'ortega', size: 3, lv: 2, win: [any('life-orb', 'focus-sash', 'choice-band'), $(1500)] }))),
    ch('Sneak past', out('You slip by unnoticed.'), { check: 'speed', fail: fight('Spotted!', trainer('Star Grunt', { size: 2 })) }),
  ]),
  ev('rainbow-rocket', 'Rainbow Rocket', V, { rarity: 'rare', minStage: 5, cast: ['boss.teamrocket'], effect: 'spin', tint: '#281040' }, 'A portal crackles. A villain boss steps through.', [
    ch('Battle', fight('A boss from another world!', trainer('Rainbow Rocket Boss', { boss: 'ghetsis', size: 4, lv: 4, win: [any('life-orb', 'choice-band', 'focus-sash'), better(2), $(3000)] })), { requires: [fierce] }),
    ch('Run', out('You escape!'), { check: 'speed', fail: out('The portal sucks something from your Bag.', lose()) }),
  ]),
  ev('shadow-triad', 'Shadow Triad', V, { rarity: 'uncommon', effect: 'fog', tint: '#101010' }, 'Three figures appear in a puff of smoke.', [
    ch('Battle all three', fight('They attack together!', trainer('Shadow Triad', { size: 3, types: ['dark'], lv: 2, win: [any(...HELD), $(1500)] })), { requires: [fierce] }),
    ch('Hand over an item', out('They vanish with it.', lose())),
  ]),
  ev('ghetsis-offer', "Ghetsis's Offer", V, { rarity: 'rare', cast: ['boss.ghetsis'], effect: 'fog', tint: '#281038' }, '"Power, child. Take it."', [
    ch('Accept power', out('Dark strength floods in.', evil(20), attr('strength', 10))),
    ch('Refuse', out('"Fool." He fades away.', good(10))),
  ]),
  ev('pickpocket', 'Pickpocket', V, { effect: 'shake' }, 'Someone bumps into you and runs off with something!', [
    ch('Chase', out('You catch them and get it back, plus a bit extra.', $(300)), { check: 'speed', fail: out('Gone.', lose()) }),
    ch('Let it go', out('You lose an item.', lose())),
  ]),
  ev('fake-nurse', 'Fake Nurse', V, { cast: [], effect: 'flicker' }, 'A nurse offers to heal your team. Her smile is… off.', [
    ch('Accept healing', out('Your party is healed.', heal(1)), { check: 'intelligence', fail: out('It was poison!', status('poison')) }),
    ch('Decline', leave()),
  ]),

  // ---------- helpers, gifts and kindness ----------
  ev('center-lady', 'Pokémon Center Lady', H, { stop: 'heal', effect: 'hearts' }, '"Would you like me to heal your Pokémon?"', [
    ch('Full heal', out('Your Pokémon are fighting fit!', heal(1), cure())),
    ch('Ask for advice', out('Good tips.', attr('intelligence', 3))),
  ]),
  ev('breeders-visit', "Breeder's Visit", H, { cast: ['trainer.aroma_lady'], effect: 'hearts' }, 'A breeder with a basket. "I can look after one for a bit."', [
    ch('Leave a Pokémon', out('It comes back happier and a little stronger.', fr(25, 'lead'), lv(1)), { requires: [party(2)] }),
    ch('Ask for tips', out('Very helpful.', fr(5), attr('love', 2))),
  ]),
  ev('professors-lab', "Professor's Lab", H, { stop: 'lab', cast: ['boss.oak'], effect: 'sparkle' }, 'A professor waves you into a lab full of machines.', [
    ch('Show your Pokédex', out('"Wonderful data!"', rp(40))),
    ch('Ask for a gift', out('"Take these!"', item('ultra-ball', 2))),
  ]),
  ev('gift-from-mom', 'Gift from Mom', H, { effect: 'hearts' }, 'A parcel addressed to you. "From Mom."', [
    ch('Open it', out('Money, medicine and a note: "Eat your vegetables."', $(800), any(...HEALING))),
    ch('Save it for later', out('You put it away. It\'s heavy… a Rare Candy!', item('rare-candy'))),
  ]),
  ev('ranger-rescue', 'Ranger Rescue', H, { effect: 'sparkle' }, 'A Ranger with a Capture Styler needs help freeing a trapped Pokémon.', [
    ch('Help', out('Freed! It chooses to come with you.', good(10), join({ lv: 2, shiny: 2 }))),
    ch('Keep walking', leave()),
  ]),
  ev('daycare-couple', 'Daycare Couple', H, { stop: 'daycare', effect: 'hearts' }, 'An old couple at a fence. "We\'ll raise one for you!"', [
    ch('Leave a Pokémon', out('It\'s grown while you were away!', lv(3)), { requires: [party(2)] }),
    ch('Ask about eggs', out('They found an Egg! Keep it warm and it will hatch.', egg({ lv: -6, left: 2 }))),
    ch('Ask about an old friend\'s egg', out('"Oh, that one! It has been waiting for you."', { kind: 'legacyEgg' }), { requires: [{ kind: 'legacyEgg' }] }),
  ]),
  ev('lost-child', 'Lost Child', H, { effect: 'hearts' }, 'Two preschoolers are crying.', [
    ch('Help them home', out('Their parent rewards you warmly.', good(10), attr('love', 5), $(700))),
    ch('Ignore them', out('You walk on.', evil(5))),
  ]),
  ev('nurse-clinic', "Nurse Joy's Clinic", H, { stop: 'heal', effect: 'hearts' }, 'A small clinic with a friendly doctor.', [
    ch('Cure statuses', out('All better.', cure(), heal(0.5))),
    ch('Full check-up (₽300)', out('Fully healed and checked.', $(-300), heal(1), cure()), { requires: [money(300)] }),
  ]),
  ev('kind-hiker', 'Kind Hiker', H, { cast: ['trainer.hiker'], effect: 'hearts' }, 'A hiker offers trail mix.', [
    ch('Accept', out('Tasty! Your team recovers.', heal(0.5))),
    ch('Share yours', out('You share a snack. Good vibes.', good(5), fr(5))),
  ]),
  ev('wishing-well', 'Wishing Well', H, { stop: 'well', effect: 'glint' }, 'A stone well. Coins glint at the bottom.', [
    ch('Toss a coin (₽100)', out('You feel lucky.', $(-100), attr('luck', 5)), { requires: [money(100)] }),
    ch('Toss a big coin (₽1,000)', out('Very lucky!', $(-1000), attr('luck', 15)), { requires: [money(1000)] }),
    ch('Take coins', out('Free money…', $(500), evil(10))),
  ]),

  // ---------- games of chance ----------
  ev('game-corner', 'Game Corner', G, { stop: 'casino', cast: ['trainer.guitarist'], effect: 'spin', tint: '#281838' }, 'Slot reels spin under flashing lights.', [
    ch('Play slots (₽300)', out('Jackpot!', $(1200)), { requires: [money(300)], check: 'luck', fail: out('Nothing.', $(-300)) }),
    ch('Prize counter (₽2,000)', out('You trade coins for a prize.', $(-2000), any('rare-candy', 'focus-sash', 'leftovers')), { requires: [money(2000)] }),
    ch('Leave', leave()),
  ]),
  ev('mysterious-chest-2', 'Rattling Chest', G, { stop: 'treasure', effect: 'rattle' }, 'Another chest. This one rattles a lot.', [
    ch('Open', out('Treasure!', any(...TREASURE, ...HELD)), { chance: 0.5, fail: fight('A Mimic! It was a Pokémon all along!', wild({ species: ['mimikyu', 'sableye', 'banette', 'misdreavus'], lv: 3 })) }),
    ch('Shake it first', out('You hear a Pokémon inside and leave it. A coin rolls out.', $(300)), { requires: [att('intelligence', 30)] }),
  ]),
  ev('coin-flip', 'Coin Flip Gambler', G, { effect: 'glint' }, '"Heads or tails? Double or nothing!"', [
    ch('Heads (₽500)', out('Heads! You win.', $(500)), { requires: [money(500)], chance: 0.5, fail: out('Tails.', $(-500)) }),
    ch('Tails (₽500)', out('Tails! You win.', $(500)), { requires: [money(500)], chance: 0.5, fail: out('Heads.', $(-500)) }),
    ch('Walk away', leave()),
  ]),
  ev('lottery-booth', 'Lottery Booth', G, { effect: 'spin' }, 'A drum of numbered balls. "Try your luck!"', [
    ch('Buy a ticket (₽200)', out('A big prize!', $(-200), any('rare-candy', 'ultra-ball', 'leftovers', 'nugget')), { requires: [money(200)], check: 'luck', fail: out('A consolation Potion.', $(-200), item('potion')) }),
    ch('Leave', leave()),
  ]),
  ev('card-shark', 'Card Shark', G, { effect: 'spin' }, 'A harlequin shuffles a deck.', [
    ch('Play (₽500)', out('You read the cards perfectly.', $(1000)), { requires: [money(500)], check: 'intelligence', fail: out('Outplayed.', $(-500)) }),
    ch('Cheat', out('Big winnings.', $(1500), evil(10)), { check: 'speed', fail: out('Caught! You pay a fine.', $(-800), evil(5)) }),
    ch('Leave', leave()),
  ]),
  ev('fortune-teller-2', 'Crystal Ball', G, { effect: 'float', tint: '#301848' }, 'A medium gazes into a crystal ball.', [
    ch('Read the next boss (₽500)', out('The gym leader\'s team appears in the glass.', $(-500), gym()), { requires: [money(500)] }),
    ch('Read your luck', out('Good fortune ahead!', attr('luck', 5))),
  ]),
  ev('roulette-of-fate', 'Roulette of Fate', G, { effect: 'spin', tint: '#300818' }, 'A clown spins a giant wheel.', [
    ch('Spin!', out('Big win: money and a Rare Candy!', $(1000), item('rare-candy')), { chance: 0.4, fail: out('The wheel lands on "Ouch".', hurt(0.2), $(-200)) }),
    ch('Leave', leave()),
  ]),
  ev('prize-wheel', 'Pokémon Prize Wheel', G, { effect: 'spin' }, 'An idol presents a wheel of Pokémon.', [
    ch('Spin for a Pokémon (₽800)', out('A rare one!', $(-800), join({ lv: 2, shiny: 3 })), { requires: [money(800)], check: 'luck', fail: out('A common one.', $(-800), join({ lv: -2 })) }),
    ch('Leave', leave()),
  ]),

  // ---------- training and growth ----------
  ev('training-session-2', 'Punching Bag', R, { cast: ['trainer.black_belt_m'], types: ['fighting'], effect: 'shake' }, 'A punching bag swings in the breeze.', [
    ch('Hard training', out('Stronger!', attr('strength', 5), hurt(0.2), lv(1))),
    ch('Gentle training', out('Calm and steady.', peace(5), fr(10, 'lead'))),
  ]),
  ev('move-tutor', 'Move Tutor', R, { stop: 'tutor', cast: ['trainer.psychic_m'], effect: 'sparkle' }, 'A sage sits by an old scroll.', [
    ch('Learn (₽800)', out('Your lead learns from the scroll.', $(-800), lv(2)), { requires: [money(800)] }),
    ch('Prove yourself', fight('"Show me!"', trainer('Sage', { cls: 'psychic', size: 2, lv: 2, win: [lv(2)] }))),
  ]),
  ev('move-forgetter', 'Move Forgetter', R, { effect: 'float' }, 'A teacher at a chalkboard. "Need to forget something?"', [
    ch('Relearn old moves', out('Memories flood back.', fr(5, 'lead'), attr('intelligence', 2))),
    ch('Leave', leave()),
  ]),
  ev('library', 'Library', R, { stop: 'library', effect: 'float' }, 'Quiet shelves, full of Pokédex entries.', [
    ch('Study', out('You learn a lot.', attr('intelligence', 5), rp(15))),
    ch('Nap', out('Refreshing.', heal(0.5))),
  ]),
  ev('gym-rat', 'Gym Rat', R, { cast: ['trainer.biker'], effect: 'shake' }, 'A triathlete waves from a bike.', [
    ch('Endurance run', out('Faster!', attr('speed', 5))),
    ch('Lift', out('Stronger!', attr('strength', 5))),
  ]),
  ev('meditation-shrine', 'Meditation Shrine', R, { stop: 'shrine', cast: ['trainer.psychic_m'], types: ['psychic'], effect: 'float' }, 'A psychic floats above a mat.', [
    ch('Meditate', out('Peace.', peace(10))),
    ch('Rage at the sky', out('RAAAH!', rage(10))),
  ]),
  ev('dragons-den', "Dragon's Den", R, { cast: ['trainer.dragon_tamer'], types: ['dragon'], minStage: 2, effect: 'fire' }, 'A Dragon Tamer holds out a gleaming scale.', [
    ch('Take the test', out('You pass! The scale is yours.', item('dragon-scale'), lv(1)), { check: 'strength', fail: out('Not yet worthy.', hurt(0.2)) }),
    ch('Show your rage', out('A true dragon\'s spirit!', item('dragon-fang')), { requires: [isRage(30)] }),
  ]),
  ev('expert-breeder', 'Expert Breeder', R, { cast: ['trainer.aroma_lady'], effect: 'hearts' }, '"I can teach your Pokémon an egg move."', [
    ch('Teach your lead', out('A new trick from its parents!', eggMove(), fr(10, 'lead'))),
    ch('Leave', leave()),
  ]),

  // ---------- mysteries and story ----------
  ev('weird-dream', 'Weird Dream', Y, { effect: 'fog', tint: '#201040' }, 'The screen fades. A ghost floats in your dream.', [
    ch('Follow the dream', out('You wake with a gift in your hand.', any(...TREASURE, ...STONES)), { chance: 0.6, fail: out('A nightmare. Your team sleeps badly.', status('sleep')) }),
    ch('Wake up', leave('You wake up.')),
  ]),
  ev('ruins-of-alph', 'Ruins of Alph', Y, { rarity: 'uncommon', types: ['psychic', 'rock'], effect: 'flicker', tint: '#302010' }, 'Torchlight flickers over a stone puzzle.', [
    ch('Solve the puzzle', out('The wall opens. An Unown floats out!', join({ species: ['unown'] }), rp(30)), { requires: [att('intelligence', 50)] }),
    ch('Dig', out('A rare stone!', any(...STONES)), { check: 'luck', fail: out('Just dust.') }),
  ]),
  ev('haunted-house', 'Haunted House', Y, { stop: 'haunted', cast: ['trainer.hex_maniac'], types: ['ghost'], effect: 'flicker', tint: '#100820' }, 'The lights flicker. Something giggles upstairs.', [
    ch('Enter', fight('A ghost!', wild({ types: ['ghost'], lv: 2, win: [item('spell-tag')] })), { check: 'love', fail: out('You panic and run out.', hurt(0.15)) }),
    ch('Leave', leave()),
  ]),
  ev('time-rift', 'Time-Travel Rift', Y, { rarity: 'rare', minStage: 3, effect: 'spin', tint: '#183040' }, 'A glowing rift hangs in the air.', [
    ch('Step in', fight('A Pokémon from ancient Hisui!', wild({ species: ['growlithe-hisui', 'voltorb-hisui', 'sneasel-hisui', 'zorua-hisui', 'qwilfish-hisui', 'sliggoo-hisui'], lv: 2 }))),
    ch('Close it', leave('The rift closes.')),
  ]),
  ev('meteorite-crash', 'Meteorite Crash', Y, { effect: 'sparkle', tint: '#181030' }, 'A crater, still smoking.', [
    ch('Take a shard', out('A strange stone.', any('moon-stone', 'comet-shard', 'star-piece')), { check: 'luck', fail: out('It crumbles.') }),
    ch('Study it', out('Fascinating data.', rp(35))),
  ]),
  ev('mirage-island', 'Mirage Island', Y, { stop: 'mirage', rarity: 'epic', minStage: 3, effect: 'sparkle', tint: '#103040' }, 'A shimmering island appears offshore.', [
    ch('Sail out', fight('A Pokémon of legend… in a strange form!', wild({ types: ['dragon', 'psychic'], lv: 4, shiny: 4, win: [rp(40)] }))),
    ch('Watch', out('It fades. You feel lucky to have seen it.', attr('luck', 3))),
  ]),
  ev('abandoned-lab', 'Abandoned Lab', Y, { stop: 'lab', effect: 'flicker', tint: '#102018' }, 'Broken machines and scattered notes.', [
    ch('Search', out('A fossil!', any(...FOSSILS)), { check: 'luck', fail: out('Empty drawers.') }),
    ch('Read the notes', out('Notes about strange forms.', rp(30), attr('intelligence', 3))),
  ]),
  ev('shrine-maiden', 'Shrine Maiden', Y, { stop: 'shrine', effect: 'sparkle', tint: '#401818' }, 'A shrine maiden sweeps beneath a red gate.', [
    ch('Pray', out('A warm feeling.', good(5), attr('luck', 5))),
    ch('Steal an offering', out('Money… and a chill down your spine.', $(800), evil(15))),
  ]),
  ev('spooky-festival', 'Spooky Festival', Y, { types: ['ghost'], effect: 'fire', tint: '#281008' }, 'Jack-o\'-lanterns light a parade.', [
    ch('Join the parade', out('A Spooky friend joins!', join({ types: ['ghost'] }), fr(5))),
    ch('Trick or treat', out('Treats!', any(...BERRIES), item('rare-candy')), { check: 'luck', fail: out('A trick! Boo!', hurt(0.1)) }),
  ]),
  ev('ghost-train', 'Ghost Train', Y, { types: ['ghost'], effect: 'fog', tint: '#101018' }, 'A dark train waits at an empty platform.', [
    ch('Ride', out('A strange journey. You arrive stronger.', lv(2, 'party')), { check: 'speed', fail: fight('A ghost blocks the carriage!', wild({ types: ['ghost'], lv: 2 })) }),
    ch('Stay', leave()),
  ]),
  ev('strange-signal', 'Strange Signal', Y, { rarity: 'uncommon', types: ['electric'], effect: 'flicker' }, 'An antenna sparks. Something is calling.', [
    ch('Follow it', fight('A strange Pokémon!', wild({ types: ['electric', 'steel'], lv: 2, shiny: 2, win: [rp(25)] })), { check: 'intelligence', fail: out('The signal fades.') }),
    ch('Ignore', leave()),
  ]),

  // ---------- famous faces ----------
  ev('ash-training', "Ash's Training", F, { cast: ['boss.ash-kalos'], pokemon: 'pikachu', effect: 'sparkle' }, '"Hey! Wanna battle? Pikachu\'s all fired up!"', [
    ch('Battle Ash', fight('"Pikachu, I choose you!"', trainer('Ash', { boss: 'ash', size: 3, lv: 2, win: [lv(1, 'party'), $(1500)] }))),
    ch('Train together', out('You learn a lot from him.', fr(15), lv(1))),
  ]),
  ev('champion-lunch', 'Champion Lunch', F, { rarity: 'uncommon', cast: ['boss.cynthia-masters'], effect: 'hearts' }, 'A Champion waves you over to a picnic table.', [
    ch('Ask for advice', out('"Here\'s what that gym leader uses."', gym(), attr('intelligence', 3))),
    ch('Ask for a battle', fight('"Gladly."', trainer('Champion', { boss: 'cynthia', size: 4, lv: 5, win: [better(2), $(5000)] })), { requires: [fierce] }),
  ]),
  ev('red-on-the-mountain', 'Red on the Mountain', F, { rarity: 'epic', minStage: 5, cast: ['boss.red-masters'], effect: 'snow', tint: '#a0b0c8' }, 'A silent trainer stands in the snow.', [
    ch('Battle', fight('…', trainer('Red', { boss: 'red', size: 6, lv: 6, win: [item('rare-candy', 3), better(3), $(8000)] })), { requires: [fierce] }),
    ch('Bow and leave', out('He nods.', attr('charisma', 3))),
  ]),
  ev('elesa-photoshoot', "Elesa's Photoshoot", F, { cast: ['boss.elesa-gen5bw2'], types: ['electric'], effect: 'glint' }, 'Cameras flash. "Strike a pose!"', [
    ch('Pose', out('Stunning!', attr('charisma', 10), $(1000)), { check: 'charisma', fail: out('You blinked.', attr('charisma', 2)) }),
    ch('Decline', leave()),
  ]),
  ev('iono-stream', "Iono's Stream", F, { cast: ['boss.iono'], types: ['electric'], effect: 'sparkle' }, '"Hey hey! You\'re live on my stream!"', [
    ch('Battle on stream', fight('"Let\'s go viral!"', trainer('Iono', { boss: 'iono', size: 3, lv: 2, win: [$(2500), attr('charisma', 5)] }))),
    ch('Wave', out('Fame!', attr('charisma', 3))),
  ]),
  ev('kahili-golf', "Kahili's Golf", F, { cast: ['boss.kahili'], types: ['flying'], effect: 'sparkle' }, '"Care for a round?"', [
    ch('Golf challenge', out('Hole in one!', item('sharp-beak'), attr('strength', 2), attr('intelligence', 2)), { check: 'strength', fail: out('In the bunker.') }),
    ch('Skip', leave()),
  ]),
  ev('turo-machine', "Professor's Time Machine", F, { rarity: 'rare', minStage: 4, cast: ['boss.arven-s'], effect: 'spin', tint: '#182030' }, 'A humming machine. "Shall we see the past… or future?"', [
    ch('Use it', fight('A Paradox Pokémon!', wild({ species: ['great-tusk', 'scream-tail', 'flutter-mane', 'iron-treads', 'iron-bundle', 'iron-hands'], lv: 3, win: [rp(40)] }))),
    ch('Leave', leave()),
  ]),
  ev('giovanni-offer', "Giovanni's Offer", F, { rarity: 'rare', cast: ['trainer.giovanni'], effect: 'fog', tint: '#201010' }, '"Join Team Rocket. I reward loyalty."', [
    ch('Join', out('He hands you a fat envelope.', evil(20), $(3000))),
    ch('Refuse', fight('"Then you\'ll be crushed."', trainer('Giovanni', { boss: 'giovanni', size: 3, lv: 3, win: [$(4000), good(10)] }), good(10)), { requires: [fierce] }),
  ]),
  ev('lillie-nebby', 'Lillie and Nebby', F, { rarity: 'rare', cast: ['boss.lillie-z'], effect: 'sparkle' }, 'A girl clutches a bag. "Please, help us!"', [
    ch('Protect her', fight('Aether guards attack!', trainer('Aether Guard', { size: 2, types: ['psychic'], win: [good(10), rp(30)] })), { requires: [fierce] }),
    ch('Look away', leave()),
  ]),
  ev('penny-hack', "Penny's Hack", F, { cast: ['trainer.penny'], effect: 'flicker' }, '"I can… improve your Bag. Probably."', [
    ch('Let her', out('Items doubled!', any(...HEALING), any(...BALLS), any(...TREASURE)), { check: 'luck', fail: out('Scrambled! Something vanished.', lose()) }),
    ch('Refuse', leave()),
  ]),

  // ---------- one event for every type ----------
  ev('pokefan-meetup', 'Pokéfan Meetup', P, { types: ['normal'], effect: 'hearts' }, 'Pokéfans gather to show off their favourites.', [ch('Show off a Pokémon', out('They love it!', item('silk-scarf'), attr('charisma', 3)), { check: 'charisma', fail: out('They prefer theirs.') }), ch('Leave', leave())]),
  ev('firebreather-show', "Fire-Breather's Show", P, { cast: ['trainer.firebreather'], types: ['fire'], effect: 'fire' }, 'A Fire-Breather lights up the night.', [ch('Join the show', out('A blazing finale!', item('fire-stone'), rage(3)), { check: 'strength', fail: out('Singed eyebrows.', status('burn')) }), ch('Watch', leave())]),
  ev('surf-rescue', 'Surf Rescue', P, { types: ['water'], effect: 'rain' }, 'A surfer is caught in a rip current.', [ch('Rescue them', out('Safe!', item('mystic-water'), good(5)), { check: 'strength', fail: out('You both wash up tired.', hurt(0.2)) }), ch('Call for help', leave())]),
  ev('flower-garden', 'Flower Garden', P, { cast: ['trainer.aroma_lady'], types: ['grass'], effect: 'sparkle' }, 'An Aroma Lady tends a bright garden.', [ch('Tend the flowers', out('Healing berries as thanks.', peace(5), item('sitrus-berry', 2))), ch('Leave', leave())]),
  ev('power-plant-fault', 'Power Plant Fault', P, { cast: ['trainer.worker_m'], types: ['electric'], effect: 'flicker' }, 'Sparks fly from a broken generator.', [ch('Fix it', out('Fixed! An Electric Pokémon was hiding inside.', join({ types: ['electric'] })), { check: 'intelligence', fail: out('Zap!', status('paralysis')) }), ch('Overload it', fight('BOOM! An angry Electric Pokémon!', wild({ types: ['electric'], lv: 2, win: [item('thunder-stone')] }), rage(5)), { requires: [fierce] })]),
  ev('frozen-lake', 'Frozen Lake', P, { cast: ['trainer.snow_worker_m'], types: ['ice'], effect: 'snow', tint: '#a0c0e0' }, 'A frozen lake glitters. Something shines in the ice.', [ch('Skate across', out('You grab it on the way!', item('ice-stone')), { check: 'speed', fail: out('You fall. Ouch.', hurt(0.15)) }), ch('Break the ice', out('Crack! It\'s yours.', item('ice-stone')), { check: 'strength', fail: out('Too thick.') })]),
  ev('street-brawl', 'Street Brawl', P, { cast: ['trainer.roughneck'], types: ['fighting'], effect: 'shake' }, 'Two trainers are about to fight.', [ch('Step in', out('You break it up.', good(10), item('black-belt')), { check: 'strength', fail: out('You get caught in it.', hurt(0.2)) }), ch('Bet on it (₽500)', out('Your pick wins!', $(500), evil(5)), { requires: [money(500)], chance: 0.5, fail: out('Your pick loses.', $(-500)) })]),
  ev('toxic-swamp', 'Toxic Swamp', P, { types: ['poison'], effect: 'fog', tint: '#283010' }, 'Purple bubbles rise from a swamp.', [ch('Wade through', out('A Poison Pokémon follows you out!', join({ types: ['poison'] })), { check: 'love', fail: out('Poisoned!', status('poison')) }), ch('Go around', leave())]),
  ev('fossil-dig', 'Fossil Dig', P, { stop: 'fossil', cast: ['trainer.hiker'], types: ['ground', 'rock'], effect: 'shake' }, 'A hiker hands you a shovel.', [ch('Dig', out('A fossil!', any(...FOSSILS)), { check: 'luck', fail: out('A cave-in!', hurt(0.25)) }), ch('Leave', leave())]),
  ev('sky-race', 'Sky Race', P, { cast: ['trainer.bird_keeper_m'], types: ['flying'], effect: 'sparkle' }, 'Bird Keepers line up for a race.', [ch('Race', out('You win!', item('sharp-beak'), attr('speed', 3)), { check: 'speed', fail: out('Second place.', attr('speed', 1)) }), ch('Watch', leave())]),
  ev('mind-reader', 'Mind Reader', P, { cast: ['trainer.psychic_m'], types: ['psychic'], effect: 'float' }, '"Guess my card."', [ch('Guess', out('Correct!', item('rare-candy'), attr('intelligence', 3)), { check: 'intelligence', fail: out('Wrong.') }), ch('Leave', leave())]),
  ev('bug-contest', 'Bug-Catching Contest', P, { cast: ['trainer.bug_catcher'], types: ['bug'], effect: 'sparkle' }, '"Catch the biggest bug!"', [ch('Enter', out('First prize!', join({ types: ['bug'], lv: 1, shiny: 2 }), item('sun-stone')), { check: 'luck', fail: out('A small one. It joins anyway.', join({ types: ['bug'], lv: -2 })) }), ch('Watch', leave())]),
  ev('cave-in', 'Cave-In', P, { cast: ['trainer.worker_m'], types: ['rock'], effect: 'shake' }, 'Rubble blocks the tunnel.', [ch('Clear it', out('Under the rocks: a stone!', any('everstone', 'hard-stone')), { check: 'strength', fail: out('Exhausting.', hurt(0.2)) }), ch('Turn back', leave())]),
  ev('graveyard-vigil', 'Graveyard Vigil', P, { cast: ['trainer.hex_maniac'], types: ['ghost'], effect: 'fog', tint: '#100818' }, 'Candles flicker over old graves.', [ch('Stay the night', out('A Ghost Pokémon befriends you.', join({ types: ['ghost'] })), { check: 'love', fail: out('Spooked!', hurt(0.15)) }), ch('Leave', leave())]),
  ev('dragon-shrine', 'Dragon Shrine', P, { cast: ['trainer.dragon_tamer'], types: ['dragon'], effect: 'float' }, 'An elder asks you a question about kindness.', [ch('Answer kindly', out('"Well said." A scale is yours.', item('dragon-scale'), good(5))), ch('Answer coldly', out('"Power, then." A fang.', item('dragon-fang'), evil(5)))]),
  ev('back-alley-deal', 'Back-Alley Deal', P, { cast: ['trainer.roughneck'], types: ['dark'], effect: 'fog' }, '"Want something nobody else has?"', [ch('Make the deal (₽600)', out('Shady, but useful.', $(-600), item('razor-claw'), evil(10)), { requires: [money(600)] }), ch('Walk away', leave())]),
  ev('junkyard', 'Junkyard', P, { types: ['steel'], effect: 'rattle' }, 'Piles of scrap metal.', [ch('Search', out('A Metal Coat!', item('metal-coat')), { check: 'luck', fail: out('Rust everywhere.') }), ch('Leave', leave())]),
  ev('fairy-tea', 'Fairy Tea Party', P, { cast: ['trainer.fairy_tale_girl'], types: ['fairy'], effect: 'hearts', tint: '#402038' }, 'A tea party with Fairy Pokémon.', [ch('Be polite', out('Lovely! A gift.', item('moon-stone'), attr('love', 5)), { check: 'charisma', fail: out('You spill the tea.') }), ch('Leave', leave())]),

  // ---------- draft map stops ----------
  ev('pokemon-center', 'Pokémon Center', S, { stop: 'heal', effect: 'hearts' }, 'A small Pokémon Center with a shop counter.', [
    ch('Heal', out('All healed!', heal(1), cure())),
    ch('Buy supplies (₽500)', out('Supplies.', $(-500), item('super-potion', 2), item('great-ball', 2)), { requires: [money(500)] }),
    ch('Talk to the nurse', out('"Take care out there."', heal(0.5), fr(3))),
  ]),
  ev('berry-tree', 'Berry Tree', S, { stop: 'berry', types: ['grass'], effect: 'sparkle' }, 'A lone berry tree.', [
    ch('Pick', out('Berries!', any(...BERRIES)), { chance: 0.7, fail: fight('A Pokémon is eating them!', wild({ types: ['grass', 'bug'], win: [any(...BERRIES)] })) }),
    ch('Share with wild Pokémon', out('They thank you.', good(5), attr('love', 2))),
  ]),
  ev('treasure-cache', 'Treasure Cache', S, { stop: 'treasure', effect: 'glint' }, 'A buried box sticks out of the dirt.', [
    ch('Dig it up', out('Rare items!', any(...HELD, ...TREASURE)), { check: 'luck', fail: out('A trap! Poison gas!', status('poison')) }),
    ch('Check for traps', out('Safe. You open it.', any(...TREASURE)), { requires: [att('intelligence', 25)] }),
    ch('Leave', leave()),
  ]),
  ev('training-ground', 'Training Ground', S, { stop: 'dojo', effect: 'shake' }, 'Tracks, weights and targets.', [
    ch('Run laps', out('Faster.', attr('speed', 3), hurt(0.1))),
    ch('Lift', out('Stronger.', attr('strength', 3), hurt(0.1))),
    ch('Practise moves', out('Sharper.', lv(1))),
  ]),
  ev('villain-hideout', 'Villain Hideout', S, { stop: 'hideout', rarity: 'rare', minStage: 3, cast: ['boss.teamrocket'], effect: 'flicker', tint: '#200810' }, 'A secret base hums behind a poster.', [
    ch('Storm it', fight('Grunts, then their boss!', trainer('Hideout Boss', { boss: 'giovanni', size: 4, lv: 3, win: [any('life-orb', 'choice-band', 'focus-sash'), $(4000), better(2)] })), { requires: [fierce] }),
    ch('Sneak in for loot', out('You grab a crate and run.', any(...TREASURE), any(...HELD)), { check: 'speed', fail: fight('Caught!', trainer('Grunt', { size: 3, lv: 2 })) }),
    ch('Leave', leave()),
  ]),

  // ---------- rest spots (Between-Level interactions) ----------
  ev('rest-meadow', 'Rest Spot: Meadow', B, { stop: 'rest', effect: 'hearts', tint: '#204018' }, 'A quiet meadow. Time to spend with your lead Pokémon.', [
    ch('Feed (uses a berry)', out('Munch munch. It loves you more.', lose('oran-berry'), fr(10, 'lead'), attr('love', 2), heal(0.25)), { requires: [has('oran-berry')] }),
    ch('Play', out('So much fun!', fr(8, 'lead'), attr('charisma', 2))),
    ch('Groom', out('Shiny and calm.', fr(5, 'lead'), peace(2), cure())),
    ch('Talk', out('It listens closely.', fr(5, 'lead'), good(1))),
  ]),
  ev('rest-field', 'Rest Spot: Training Field', B, { stop: 'rest', effect: 'sparkle' }, 'An open field, perfect for practice.', [
    ch('Train', out('A good workout.', fr(3, 'lead'), attr('strength', 2), hurt(0.1))),
    ch('Race', out('Neck and neck!', fr(3, 'lead'), attr('speed', 2))),
    ch('Spar together', out('A friendly bout.', fr(2), rage(2), lv(1))),
    ch('Treasure hunt', out('It dug something up!', fr(3, 'lead'), attr('luck', 2), any(...TREASURE)), { chance: 0.5, fail: out('Just mud, but it had fun.', fr(3, 'lead'), attr('luck', 2)) }),
  ]),
  ev('rest-photo', 'Rest Spot: Photo Corner', B, { stop: 'rest', effect: 'glint' }, 'A scenic spot with a camera stand.', [
    ch('Photograph', out('A perfect snapshot.', fr(4, 'lead'), attr('charisma', 1), attr('love', 1))),
    ch('Play', out('Giggles all round.', fr(8, 'lead'), attr('charisma', 2))),
    ch('Talk', out('A quiet moment.', fr(5, 'lead'), good(1))),
  ]),
];
