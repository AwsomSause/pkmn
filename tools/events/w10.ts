// Ideas W10: set-piece events (interactions I397-I447) and misc touches (I495-I513) as map events.
// Written with the DSL; tools/build-w10-events.ts turns the list into src/data/eventsW10.json.
import { $, any, att, ch, ev, flag, flagIs, fr, good, evil, has, heal, hurt, item, join, leave, lose, money, out, fight, peace, rage, rp, room, trade, trainer, wild, isGood, isEvil, party, ptype, reveal, scout, type Json } from './dsl.ts';

const G = 'Set Pieces';
const blessing = (id: string): Json => ({ kind: 'blessing', id });
const relic = (id: string, name: string, ...effects: Json[]): Json => ({ kind: 'relic', id, name, effects });
const moment = (text: string, importance = 60): Json => ({ kind: 'moment', text, importance });
const prompt = (id: string, needs: 'ok' | 'good' | 'perfect' = 'good') => ({ id, needs });
/** A choice decided by a skill prompt (success when the grade reaches `needs`). */
const pch = (label: string, p: { id: string; needs: 'ok' | 'good' | 'perfect' }, success: Json, failure: Json, requires?: Json[]): Json => ({ label, ...(requires ? { requires } : {}), prompt: p, success, failure });
const R = (e: Json): Json => ({ ...e, room: true });
/** The mult relic modifiers used below. */
const mon = (v: number): Json => ({ kind: 'moneyMultiplier', value: v });
const frm = (v: number): Json => ({ kind: 'friendshipMultiplier', value: v });
const xpm = (v: number): Json => ({ kind: 'xpMultiplier', value: v });
const rsm = (v: number): Json => ({ kind: 'researchMultiplier', value: v });

export const W10_EVENTS: Json[] = [
  // ---- I400 Contract negotiation: three sliders of risk ----
  ev('contract-desk', 'The Contract Desk', G, { stop: 'special', rarity: 'uncommon', cast: ['trainer.worker_m'], tint: '#2b2a1e' },
    'A broker slides three contracts across the desk. "Every job pays. How hard do you want to push the slider?"', [
      ch('Safe contract: small pay, no risk', out('A tidy job. The broker stamps it paid.', $(150), rp(1))),
      ch('Standard contract: fair pay, some risk (Intelligence)', out('You read the fine print and take the extra clause. Paid in full.', $(450)), { check: 'intelligence', fail: out('A clause bites. You get the base pay only.', $(150), hurt(0.1)) }),
      ch('Risky contract: huge pay, big risk (Luck)', out('Every die rolls your way. The broker whistles and counts the cash.', $(1200), good(1)), { check: 'luck', fail: out('The deal collapses and you cover the damages.', $(-300), hurt(0.15)) }),
      ch('Negotiate the slider yourself (Charisma)', out('You talk the broker up to the standard pay with the safe clause.', $(400), rp(2)), { check: 'charisma', fail: out('The broker laughs and takes a fee for his time.', $(-60)) }),
    ]),

  // ---- I412 Ritual summoning with ingredients ----
  ev('ritual-circle', 'The Summoning Circle', G, { stop: 'shrine', rarity: 'rare', minStage: 3, cast: ['trainer.hex_maniac'], tint: '#1b1030', effect: 'glint' },
    'A chalk circle glows with three empty dishes. "Choose an offering," whispers the keeper. "What comes depends on what you give."', [
      ch('Offer a Fire Stone (a fiery guardian)', fight('The circle roars. A blazing guardian steps out, and it wants a fight.', trainer('Ember Guardian', { cls: 'hex-maniac', size: 2, types: ['fire'], lv: 3, win: [item('rare-candy'), rp(4)] }), lose('fire-stone')), { requires: [has('fire-stone')] }),
      ch('Offer a Moon Stone (a lunar guardian)', fight('Moonlight pours through the chalk. A pale guardian rises, silent and fast.', trainer('Moon Guardian', { cls: 'hex-maniac', size: 2, types: ['fairy', 'psychic'], lv: 3, win: [item('max-potion'), rp(4)] }), lose('moon-stone')), { requires: [has('moon-stone')] }),
      ch('Offer a Dusk Stone (a shadow guardian)', fight('The candles gutter. A shadow guardian bows, then lunges.', trainer('Shadow Guardian', { cls: 'hex-maniac', size: 2, types: ['ghost', 'dark'], lv: 3, win: [item('reaper-cloth'), rp(4)] }), lose('dusk-stone')), { requires: [has('dusk-stone')] }),
      ch('Offer nothing and step out of the circle', leave('The chalk fades. Nothing answers.')),
    ]),

  // ---- I413 Oath system: swear at a shrine, collect at the Reckoning ----
  ev('oath-shrine', 'The Oath Stone', G, { stop: 'shrine', rarity: 'uncommon', minStage: 1, cast: ['trainer.psychic_m'], tint: '#1c2a1c' },
    'An old stone bears three hand-shaped hollows. "Swear an oath, and the road will ask you to keep it. Keep it and you are paid."', [
      ch('Swear the Oath of Steel (lose some HP now)', out('You press your hand to the stone. It bites cold. You will not forget the pain.', hurt(0.2), flag('oath-steel', 1), moment('Swore the Oath of Steel at the shrine.', 55)), ),
      ch('Swear the Oath of Mercy (give up ₽100)', out('You leave your coins in the hollow. Your Pokémon seem calmer.', $(-100), flag('oath-mercy', 1), good(1), moment('Swore the Oath of Mercy at the shrine.', 55)), { requires: [{ kind: 'money', atLeast: 100 }] }),
      ch('Swear the Oath of Speed (leave a berry)', out('A berry on the stone, a promise on your lips. The wind picks up.', lose('oran-berry'), flag('oath-speed', 1), moment('Swore the Oath of Speed at the shrine.', 55)), { requires: [has('oran-berry')] }),
      ch('Swear nothing', leave('The stone is just a stone. You walk on.')),
    ]),
  ev('oath-reckoning', 'The Oath Is Called', G, { stop: 'shrine', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'oath-steel', atLeast: 1, atMost: 1 }], callback: true, cast: ['trainer.psychic_m'], tint: '#1c2a1c' },
    'The shrine keeper waits at a crossroads. "You swore an oath of Steel. Have you held to it?"', [
      ch('Show how far you have come (Strength)', out('He nods. "Steel kept." A charm drops into your hand.', relic('oath-steel-charm', "Oath of Steel", xpm(1.1), mon(1.05)), flag('oath-steel', 1), moment('Kept the Oath of Steel.', 60)), { check: 'strength', fail: out('Your grip wavers. He sighs and lets you go with a lesson.', rp(2), flag('oath-steel', 1)) }),
      ch('Admit you struggled', out('"Honesty is a smaller reward." He hands you a few coins.', $(100), flag('oath-steel', 1))),
    ]),
  ev('oath-reckoning-mercy', 'The Oath Is Called: Mercy', G, { stop: 'shrine', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'oath-mercy', atLeast: 1, atMost: 1 }, isGood(1)], callback: true, cast: ['trainer.psychic_m'], tint: '#1c2a1c' },
    'A child runs up with a thank-you flower. "The shrine said you kept your mercy!"', [
      ch('Take the flower', out('It is more than a flower. It glows faintly in your Bag.', relic('oath-mercy-charm', 'Oath of Mercy', frm(1.15), rsm(1.05)), flag('oath-mercy', 1), good(1))),
    ]),
  ev('oath-reckoning-speed', 'The Oath Is Called: Speed', G, { stop: 'shrine', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'oath-speed', atLeast: 1, atMost: 1 }], callback: true, cast: ['trainer.psychic_m'], tint: '#1c2a1c' },
    'The wind swirls around you at a bend in the road. The oath you swore sits lightly on your shoulder.', [
      ch('Run with it', out('You feel quick. The road feels short.', relic('oath-speed-charm', 'Oath of Speed', xpm(1.08)), attrSpeed(), flag('oath-speed', 1))),
    ]),

  // ---- I414 Trade-in tokens for exotic events ----
  ev('token-exchange', 'The Token Exchange', G, { stop: 'trade', rarity: 'uncommon', minStage: 2, cast: ['trainer.guitarist'], tint: '#2a1e2a' },
    'A stall sells rarities for tokens only. "Nuggets, Star Pieces, Comet Shards: that is what I take."', [
      ch('Trade a Nugget', out('"Pleasure." You get a rare held item.', lose('nugget'), item('choice-band')), { requires: [has('nugget')] }),
      ch('Trade a Star Piece', out('"Lovely." You get a rare held item.', lose('star-piece'), item('life-orb')), { requires: [has('star-piece')] }),
      ch('Trade a Comet Shard', out('"Wow." The stallkeeper whispers and hands you a Tera Orb.', lose('comet-shard'), item('tera-orb')), { requires: [has('comet-shard')] }),
      ch('Browse only', leave('You admire the stall and move on.')),
    ]),

  // ---- I415 Voting booth: the party votes on the direction ----
  ev('voting-booth', 'The Voting Booth', G, { stop: 'event', rarity: 'common', minStage: 1, cast: ['trainer.worker_m'], tint: '#1e2a2a' },
    'A little booth with three ballots stands on the road. "Everyone votes," the sign says. Your Pokémon crowd around it.', [
      ch('Vote for the quiet path (the party votes: rest)', out('The party votes for rest. A few of them yawn and approve.', heal(0.5), fr(1)),),
      ch('Vote for the long road (the party votes: scout)', out('The party votes for a look around. The map opens up.', scout(2), fr(1))),
      ch('Vote for a gamble (Luck)', out('The party voted for chaos and chaos votes back.', item('rare-candy'), fr(2)), { check: 'luck', fail: out('A tie. Everyone sulks.', fr(-1)) }),
      ch('Let the Fire types decide', out('The warm ones vote for a feast.', $(300), fr(1)), { requires: [ptype('fire')] }),
    ]),

  // ---- I416 Court case: defend an accused Pokémon ----
  ev('court-case', 'The Court of the Road', G, { stop: 'event', rarity: 'uncommon', minStage: 2, cast: ['trainer.psychic_m'], tint: '#2a2218' },
    'A small crowd. A Meowth stands accused of breaking a farmer\'s fence. The judge squints at you. "Will you speak for the defendant?"', [
      ch('Defend with logic (Intelligence)', out('You point out the fence was already rotten. The judge dismisses the case.', $(250), rp(3), good(1), flag('court-won', 1)), { check: 'intelligence', fail: out('The judge is not moved. You pay the fine.', $(-100)) }),
      ch('Defend with a heartfelt speech (Charisma)', out('The crowd weeps. The judge takes off his glasses and wipes his eyes.', fr(2), good(1), flag('court-won', 1)), { check: 'charisma', fail: out('Your speech lands badly.', $(-60))}),
      ch('Say nothing', out('The Meowth is fined. It glares at you for the rest of the day.', evil(1))),
    ]),

  // ---- I417 Treasure hunts by riddle in lore books ----
  ev('lore-riddle-1', 'The Lore Book: First Riddle', G, { stop: 'library', rarity: 'uncommon', minStage: 1, cast: ['trainer.aroma_lady'], tint: '#2a2a1c' },
    'A dusty book falls open. "I have a hundred hands and cannot hold. I tick and tock, and I am old. Where do I rest?"', [
      ch('"The clock tower"', out('A page turns by itself. The next riddle waits.', room('lore-riddle-2'), flag('lore-riddle', 1), rp(1))),
      ch('"The lighthouse"', out('Wrong. The book snaps shut, but a coin falls out.', $(30))),
      ch('Close the book', leave()),
    ]),
  R(ev('lore-riddle-2', 'The Lore Book: Second Riddle', G, { stop: 'library', rarity: 'uncommon', minStage: 1, cast: ['trainer.aroma_lady'], tint: '#2a2a1c' },
    '"I am sweet in the spring and sour in the fall. I wear a coat and hide a stone. What am I?"', [
      ch('"A berry"', out('The final page opens to a map.', room('lore-riddle-3'), flag('lore-riddle', 1), rp(1))),
      ch('"A cloud"', out('The book hums, unimpressed.', rp(1))),
    ])),
  R(ev('lore-riddle-3', 'The Lore Book: The Treasure', G, { stop: 'treasure', rarity: 'uncommon', minStage: 1, cast: ['trainer.aroma_lady'], tint: '#2a2a1c' },
    'The map ends under an old tree. A chest sits half-buried.', [
      ch('Dig it up', out('Inside: a heap of old coins and a lucky egg.', $(500), item('lucky-egg'), flag('lore-riddle', 1), moment('Solved the lore book riddles and found the treasure.', 55))),
    ])),

  // ---- I418 + I419 Festival day with mini-games and fireworks ----
  ev('festival-day', 'Festival Day', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.fairy_tale_girl'], tint: '#3a2030', effect: 'sparkle' },
    'Paper lanterns, drums, and three stalls. "Today there is a game for everyone."', [
      pch('Ring toss (skill)', prompt('throw-ring', 'good'), out('The ring settles perfectly. The stallkeeper hands over a prize.', item('hyper-potion'), fr(1)), out('The ring bounces away. A consolation sweet.', item('soda-pop'))),
      pch('Beat the drum (rhythm)', prompt('echo-rhythm', 'good'), out('The crowd claps along. A bonus for the best drummer!', $(300), fr(2)), out('You drop the beat. Everyone laughs with you.', fr(1))),
      ch('Light the fireworks', out('The lighting crew nods and hands you the matches.', room('festival-fireworks')),),
    ]),
  R(ev('festival-fireworks', 'Festival Fireworks', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.fairy_tale_girl'], tint: '#101030', effect: 'sparkle' },
    'Five fuses, one chance. Light them in the right order: the show depends on it.', [
      pch('Light them in sequence (rhythm)', prompt('echo-rhythm', 'perfect'), out('The sky blooms in gold and green. A spirit of the festival blesses you.', blessing('blessing-bloom'), fr(3), moment('Lit the festival fireworks perfectly.', 60)), out('A string of sparks and one sad fizz. Still pretty.', fr(1))),
      ch('Let the crew do it', out('A fine show. You enjoy it from the grass.', fr(1))),
    ])),

  // ---- I421 Cooking tournament with an ingredient draft ----
  ev('cooking-draft', 'Cooking Tournament: The Draft', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.aroma_lady'], tint: '#2a2218' },
    'A tournament table with six ingredients. You draft two, then cook. "Choose with care!"', [
      ch('Draft Honey and a Sitrus Berry (sweet)', out('A sweet, rich dish.', room('cooking-final'), flag('dish-sweet', 1)), { requires: [has('honey')] }),
      ch('Draft a Big Mushroom and a Lum Berry (earthy)', out('An earthy, bold dish.', room('cooking-final'), flag('dish-earthy', 1)), { requires: [has('big-mushroom')] }),
      ch('Draft whatever is left (plain)', out('A plain dish, but cooked honestly.', room('cooking-final'), flag('dish-plain', 1))),
    ]),
  R(ev('cooking-final', 'Cooking Tournament: The Judges', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.aroma_lady'], tint: '#2a2218' },
    'Three judges taste your dish in silence.', [
      ch('Serve the sweet dish', out('"Delightful!" You take first.', $(500), item('rare-candy'), fr(2)), { requires: [flagIs('dish-sweet', 1)] }),
      ch('Serve the earthy dish', out('"Bold!" Second place, and a prize.', $(300), item('big-mushroom')), { requires: [flagIs('dish-earthy', 1)] }),
      ch('Serve the plain dish', out('"Honest." Third place. The party enjoys leftovers.', $(100), heal(0.3))),
    ])),

  // ---- I422 Dance competition with rhythm arrows ----
  ev('dance-competition', 'The Dance Competition', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.guitarist'], tint: '#2a1030', effect: 'sparkle' },
    'The floor is packed. Judges raise their scorecards. "Match the arrows!"', [
      pch('Dance with perfect timing (rhythm)', prompt('echo-rhythm', 'perfect'), out('A flawless routine. You win the crown.', $(600), item('rare-candy'), fr(3)), out('A few missteps, but a lot of heart.', $(100), fr(1))),
      ch('Dance freestyle (Charisma)', out('The crowd loves it.', $(250), fr(2)), { check: 'charisma', fail: out('You trip. The crowd cheers anyway.', fr(1)) }),
      ch('Judge instead', out('You score the dancers fairly. They tip you.', $(100), rp(1))),
    ]),

  // ---- I423 Hide-and-seek with a legendary ----
  ev('hide-and-seek', 'A Game of Hide and Seek', G, { stop: 'mirage', rarity: 'rare', minStage: 4, pokemon: 'celebi', tint: '#14301c', effect: 'sparkle' },
    'Leaves rustle. Something tiny giggles and ducks behind a tree. A voice in your head: "Find me!"', [
      ch('Search by sight (Intelligence)', fight('You spot a flicker of green. The little time traveller stops playing and fights.', wild({ species: ['celebi'], lv: 2, win: [item('rare-candy'), rp(4)] })), { check: 'intelligence', fail: out('You search for an hour. The giggle fades.', rp(1)) }),
      ch('Wait quietly (Luck)', out('It comes to you. It leaves a gift and a wink.', blessing('blessing-wild-grace'), fr(3)), { check: 'luck', fail: out('Nothing. The wind rises.') }),
      ch('Call out to it', out('It giggles from somewhere else. You laugh too.', fr(1))),
    ]),

  // ---- I424 Escape room ----
  ev('escape-room', 'The Locked Cellar', G, { stop: 'hideout', rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], tint: '#1c1c28' },
    'The door slams. The cellar has three locks and a note: "The way out is in the order of things."', [
      ch('Search the shelves (Intelligence)', out('A brass key under a jar. One lock turns.', room('escape-room-2'), flag('escape-key', 1)), { check: 'intelligence', fail: out('Dust and jars. Nothing useful.', rp(1)) }),
      ch('Force the door (Strength)', out('The hinges give way. You are out, a bit scraped.', hurt(0.1)), { check: 'strength', fail: out('The door does not budge.', hurt(0.1)) }),
      ch('Call for help (Charisma)', out('Someone hears you and lets you out. They share a secret.', rp(1)), { check: 'charisma', fail: out('You wait a long while.', rp(1)) }),
    ]),
  R(ev('escape-room-2', 'The Locked Cellar: The Second Lock', G, { stop: 'hideout', rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], tint: '#1c1c28' },
    'The brass key opens a small chest with a riddle: "Three bottles. The leftmost lies. The rightmost lies. The middle one tells the truth."', [
      ch('Take the middle bottle', out('A hidden latch clicks. The way out opens, and your Pokémon cheer.', $(250), item('revive'), flag('escape-key', 1), moment('Escaped the locked cellar.', 55))),
      ch('Take the leftmost bottle', out('Smoke. You stagger out into daylight.', hurt(0.1))),
    ])),

  // ---- I425 Heist: plan roles, then execute in steps ----
  ev('heist-plan', 'The Heist Plan', G, { stop: 'hideout', rarity: 'rare', minStage: 3, cast: ['trainer.biker'], tint: '#1c1c20' },
    'A shady crew needs a lookout, a safecracker and a driver. "You pick the plan. We execute."', [
      ch('Lookout (Intelligence)', out('You set the watch rotation.', room('heist-go'), flag('heist-role', 1)), { check: 'intelligence', fail: out('The plan falls apart in the first minute. Crew bails.', evil(1)) }),
      ch('Safecracker (Luck)', out('You pick the lock with your whiskers crossed.', room('heist-go'), flag('heist-role', 2)), { check: 'luck', fail: out('The alarm goes off.', hurt(0.15)) }),
      ch('Driver (Speed)', out('You are the fastest thing on the road.', room('heist-go'), flag('heist-role', 3)), { check: 'speed', fail: out('You miss the turn.', hurt(0.1)) }),
      ch('Refuse the job', out('You walk away. The crew mutters.', good(1))),
    ]),
  R(ev('heist-go', 'The Heist: Execution', G, { stop: 'hideout', rarity: 'rare', minStage: 3, cast: ['trainer.biker'], tint: '#1c1c20' },
    'Everyone is in position. The vault door is a bit ajar.', [
      ch('Go in quietly', out('The vault is empty. A single coin on a pedestal. Whose heist was this?', $(300), evil(1), moment('Helped with a heist that went oddly well.', 50))),
      ch('Take only what the crew is owed', out('You split the take evenly. The crew thinks you are strange. You feel better.', $(450), good(1))),
      ch('Return everything to the owner', out('The owner weeps with gratitude and gives you a reward.', $(600), good(2), rp(2), moment('Returned the loot after a heist.', 60))),
    ])),

  // ---- I426 Hall of Mirrors reflects decisions; I437 karma echoes ----
  ev('hall-of-mirrors', 'The Hall of Mirrors', G, { stop: 'mirage', rarity: 'rare', minStage: 3, cast: ['boss.Spr_Pt_Looker'], tint: '#1c2030', effect: 'glint' },
    'A hall of mirrors. In each, a version of you, showing what you did on this run.', [
      ch('Look into the mirror of kindness', out('A warm light. The reflection nods.', good(1), fr(2), rp(2)), { requires: [isGood(2)] }),
      ch('Look into the mirror of cruelty', out('A cold glare. It does not blink first.', evil(1), rp(2)), { requires: [isEvil(2)] }),
      ch('Look into the mirror of the middle road', out('You look ordinary. You like ordinary.', rp(3), $(200))),
      ch('Break the mirror (Strength)', out('Seven years of luck, spent in one go. Shards glitter on the floor.', item('star-piece'), attrLuck(-1)), { check: 'strength', fail: out('You cut your hand.', hurt(0.1)) }),
    ]),
  ev('karma-echo', 'An Echo of What You Did', G, { stop: 'event', rarity: 'uncommon', minStage: 4, cast: ['trainer.psychic_m'], tint: '#20202a' },
    'A stranger stops you. "I have heard what you do on this road. Strangers talk."', [
      ch('Listen to the kind rumours', out('They are kind. A shopkeeper sends a gift.', $(200), fr(1), good(1)), { requires: [isGood(2)] }),
      ch('Listen to the dark rumours', out('They are dark. They fear you a little.', $(200), rage(1)), { requires: [isEvil(2)] }),
      ch('Listen to the boring rumours', out('There are none. It is a quiet road.', rp(2))),
    ]),

  // ---- I427 Charity ----
  ev('charity-drive', 'The Charity Drive', G, { stop: 'event', rarity: 'common', minStage: 1, cast: ['trainer.aroma_lady'], tint: '#2a2a1c' },
    'A stall collects for the village orphanage. "Whatever you can spare."', [
      ch('Give ₽100', out('"Bless you." She writes your name in the ledger.', $(-100), flag('charity', 1), good(1)), { requires: [{ kind: 'money', atLeast: 100 }] }),
      ch('Give ₽500', out('The ledger gets a gold star.', $(-500), flag('charity', 3), good(2), fr(1)), { requires: [{ kind: 'money', atLeast: 500 }] }),
      ch('Give a Potion', out('"Useful!"', lose('potion'), flag('charity', 1), good(1)), { requires: [has('potion')] }),
      ch('Walk past', leave()),
    ]),
  ev('charity-favor', 'The Charity Remembers', G, { stop: 'event', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'charity', atLeast: 1 }], callback: true, cast: ['trainer.aroma_lady'], tint: '#2a2a1c' },
    'The ledger-keeper recognises you from a distance. "Your kindness came back to us. Let us return the favour."', [
      ch('Accept her gift', out('A meal, a map, and a pouch of coins.', heal(0.5), $(400), rp(2), flag('charity', -9))),
    ]),

  // ---- I428 Mercy: spare a wounded rare, or catch it ----
  ev('wounded-rare', 'The Wounded Rare', G, { stop: 'wild', rarity: 'rare', minStage: 2, cast: [], tint: '#2a1c1c' },
    'A rare Pokémon lies hurt beside the road. It sees you and tries to rise.', [
      ch('Catch it while it is weak', fight('You step forward. It fights back, scared.', wild({ types: ['dragon', 'psychic', 'fairy'], lv: 2, win: [rp(2)] }), evil(1))),
      ch('Heal it and let it go', out('It nuzzles you, and leaves a feather.', good(2), item('hyper-potion'), lose('potion'), flag('mercy-rare', 1)), { requires: [has('potion')] }),
      ch('Carry it to safety (Strength)', out('It recovers and chooses to follow you.', join({ types: ['dragon', 'psychic', 'fairy'], lv: 0 }), good(2)), { check: 'strength', fail: out('It slips away in the night.', fr(1)) }),
    ]),

  // ---- I429 Haunted trade: the ghost wants a sacrifice ----
  ev('ghost-trader', 'The Ghost Trader', G, { stop: 'haunted', rarity: 'rare', minStage: 3, cast: ['trainer.hex_maniac'], tint: '#14102a', effect: 'glint' },
    'A spectral figure behind a counter. "I deal in what you do not need. Give me something you love, and I will give you something stranger."', [
      ch('Give up a Pokémon (it will be remembered)', out('The ghost smiles and takes your Pokémon. In its place, a Ghost-type presses against your leg.', trade('a Pokémon', {}), join({ types: ['ghost'], lv: 4 }), evil(1), moment('Traded a Pokémon to the Ghost Trader.', 70)),),
      ch('Give up ₽300', out('The ghost counts coins that are not there. A relic slides across the counter.', $(-300), relic('ghost-ledger', "Ghost Trader's Ledger", mon(1.1), rsm(1.1))), { requires: [{ kind: 'money', atLeast: 300 }] }),
      ch('Refuse politely', out('"A pity," says the ghost. It turns into mist.', good(1))),
    ]),

  // ---- I430 Black-market auction against NPC bidders ----
  ev('black-market-auction', 'The Black-Market Auction', G, { stop: 'special', rarity: 'rare', minStage: 3, cast: ['trainer.roughneck'], tint: '#1c1020' },
    'A warehouse, a masked auctioneer, and five bidders. The lot: a glowing egg in a crate. "Opening bid: ₽300."', [
      ch('Bid ₽300 (low)', out('You win unopposed. A quiet crowd, a quiet egg.', $(-300), item('lucky-egg')), { requires: [money(300)], chance: 0.35, fail: out('The Gambler outbids you; you lose nothing.') }),
      ch('Bid ₽700 (medium)', out('You outbid the Gambler and the Scientist. The egg is yours.', $(-700), item('lucky-egg'), item('rare-candy')), { requires: [money(700)], chance: 0.65, fail: out('The Scientist goes higher. You lose the lot.') }),
      ch('Bid ₽1500 (high)', out('Nobody dares. The egg is yours, and a bonus.', $(-1500), item('lucky-egg'), item('rare-candy'), item('revive')), { requires: [money(1500)], chance: 0.9, fail: out('A masked stranger bids ₽2000. You lose the lot.') }),
      ch('Pass', leave('You slip out before the bidding ends.')),
    ]),

  // ---- I431 Game show with lifelines ----
  ev('game-show-1', 'The Game Show: Round One', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.guitarist'], tint: '#2a1030', effect: 'sparkle' },
    'Lights, music, a host with a huge grin. "Three questions! You have three lifelines: ask the audience, 50/50, phone a friend. Question one: which type is super effective against Water?"', [
      ch('Electric', out('"Correct!"', room('game-show-2'), flag('gameshow-score', 1))),
      ch('Fire', out('"Oh no!" The host sighs. The show ends.', rp(1))),
      ch('Use a lifeline: Ask the audience', out('The audience shouts "Electric!" "Correct!" says the host.', room('game-show-2'), flag('gameshow-score', 1), flag('gameshow-life', 1)), { requires: [flagIs('gameshow-life', 0, 0)] }),
    ]),
  R(ev('game-show-2', 'The Game Show: Round Two', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.guitarist'], tint: '#2a1030', effect: 'sparkle' },
    '"Question two: how many types are there in the game?"', [
      ch('18', out('"Correct!"', room('game-show-3'), flag('gameshow-score', 1))),
      ch('16', out('"Oh, so close." You get a participation prize.', $(50))),
      ch('Use a lifeline: 50/50', out('The host removes two wrong answers. You pick 18.', room('game-show-3'), flag('gameshow-score', 1), flag('gameshow-life', 1)), { requires: [flagIs('gameshow-life', 0, 0)] }),
    ])),
  R(ev('game-show-3', 'The Game Show: The Final Question', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.guitarist'], tint: '#2a1030', effect: 'sparkle' },
    '"Final question for the grand prize: which Pokémon is number 25?"', [
      ch('Pikachu', out('"WINNER!" Confetti. A grand prize.', $(800), item('rare-candy'), moment('Won the game show.', 55))),
      ch('Raichu', out('"Close!" A consolation prize.', $(200))),
      ch('Use a lifeline: Phone a friend', out('Your lead Pokémon lets out a cry. "That sounds like a Pikachu."', $(800), item('rare-candy'), flag('gameshow-life', 1)), { requires: [flagIs('gameshow-life', 0, 0)] }),
    ])),

  // ---- I434 Time-loop village ----
  ev('time-loop-village', 'The Village That Repeats', G, { stop: 'mirage', rarity: 'rare', minStage: 3, cast: ['trainer.psychic_m'], tint: '#1c2a30', effect: 'glint' },
    'The bell rings noon. A child drops a basket. A cart tips over. The bell rings noon again. Something is wrong with this village.', [
      ch('Stay and watch the day', out('You see the cart tip over before you do anything else.', room('time-loop-2'), flag('loop-clue', 1))),
      ch('Run', out('You run. The road loops back.', rp(1))),
    ]),
  R(ev('time-loop-2', 'The Village That Repeats: Day Two', G, { stop: 'mirage', rarity: 'rare', minStage: 3, cast: ['trainer.psychic_m'], tint: '#1c2a30' },
    'Noon again. This time you are ready. You know the cart will tip, the child will drop the basket, and the baker will drop the loaf.', [
      ch('Catch the basket', out('The child smiles. The bell skips.', room('time-loop-3'), flag('loop-clue', 1))),
      ch('Stop the cart', out('The cart rolls on. Something else breaks.', room('time-loop-3'), flag('loop-clue', 1))),
    ])),
  R(ev('time-loop-3', 'The Village That Repeats: Day Three', G, { stop: 'mirage', rarity: 'rare', minStage: 3, cast: ['trainer.psychic_m'], tint: '#1c2a30' },
    'Noon. The baker looks up and, for the first time, meets your eyes. "I have been waiting for you to ask."', [
      ch('Ask the baker what he did', out('"I wished the day would not end." He sighs. The bell strikes one. Everything unfreezes.', $(500), rp(5), good(2), relic('loop-clock', 'Broken Clock', xpm(1.1), rsm(1.1)), moment('Broke the time loop in a village.', 70)), { requires: [flagIs('loop-clue', 2)] }),
      ch('Say nothing', out('The bell strikes noon. Again.', rp(1))),
    ])),

  // ---- I438 Oracle prophecies ----
  ev('oracle', 'The Oracle of the Road', G, { stop: 'shrine', rarity: 'rare', minStage: 1, cast: ['trainer.hex_maniac'], tint: '#1c1030', effect: 'glint' },
    'The Oracle opens her eyes. "I will speak one thing. You may carry it or leave it."', [
      ch('"You will find a friend in need."', out('She speaks. You carry it with you.', flag('prophecy-friend', 1), moment('The Oracle foretold a friend in need.', 50))),
      ch('"You will win when it matters."', out('She speaks. You carry it with you.', flag('prophecy-win', 1), moment('The Oracle foretold a win when it mattered.', 50))),
      ch('"You will lose something dear."', out('She speaks. You carry it with you.', flag('prophecy-loss', 1), moment('The Oracle foretold a loss.', 50))),
      ch('Ask for nothing', leave()),
    ]),
  ev('prophecy-friend', 'The Prophecy: A Friend in Need', G, { stop: 'event', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'prophecy-friend', atLeast: 1, atMost: 1 }], callback: true, cast: ['trainer.youngster_m'], tint: '#20202a' },
    'A young trainer trips and spills their Poké Balls. The Oracle\'s words come back to you.', [
      ch('Help', out('The prophecy comes true. They give you a rare gift.', item('rare-candy'), good(1), flag('prophecy-friend', 1), moment('The Oracle was right: helped a friend in need.', 60))),
      ch('Walk on', out('Nothing happens. You wonder.', flag('prophecy-friend', 1), evil(1))),
    ]),
  ev('prophecy-win', 'The Prophecy: A Win That Matters', G, { stop: 'event', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'prophecy-win', atLeast: 1, atMost: 1 }], callback: true, cast: ['trainer.roughneck'], tint: '#20202a' },
    'A challenger calls you out. The Oracle\'s words come back to you.', [
      ch('Take the challenge', fight('The prophecy is on your side. Fight!', trainer('Challenger', { cls: 'veteran', size: 2, lv: 2, win: [item('rare-candy'), $(400), flag('prophecy-win', 1)] }))),
      ch('Decline', out('Nothing happens. You wonder.', flag('prophecy-win', 1))),
    ]),
  ev('prophecy-loss', 'The Prophecy: Loss', G, { stop: 'event', rarity: 'rare', minStage: 2, requires: [{ kind: 'flag', key: 'prophecy-loss', atLeast: 1, atMost: 1 }], callback: true, cast: ['trainer.hex_maniac'], tint: '#20202a' },
    'You reach into your Bag. Something is gone. The Oracle\'s words come back to you.', [
      ch('Accept it', out('The loss was small. The lesson was not.', lose(), rp(4), flag('prophecy-loss', 1), peace(1))),
    ]),

  // ---- I439 Dream sequences revealing memories after rest ----
  ev('dream-memory', 'A Dream After Rest', G, { stop: 'rest', rarity: 'uncommon', minStage: 2, cast: [], tint: '#101030', effect: 'sparkle' },
    'You close your eyes. The road fades, and you see something from earlier.', [
      ch('Follow the dream', out('You wake up knowing something new about your party.', fr(2), rp(2), moment('Dreamed about a past memory.', 45)), { requires: [{ kind: 'period', in: ['night', 'evening'] }] }),
      ch('Stay awake', leave('You stay awake and watch the stars.')),
    ]),

  // ---- I440 Cursed treasure with a moral choice ----
  ev('cursed-treasure', 'The Cursed Treasure', G, { stop: 'treasure', rarity: 'rare', minStage: 3, cast: [], tint: '#201020', effect: 'glint' },
    'A chest wrapped in chains hums. A note: "Whoever takes this pays for it. Someone else will pay if you do not."', [
      ch('Take it and bear the curse', out('Gold, at a cost. The air feels heavier.', $(900), attr('luck', -1), evil(1)),),
      ch('Take it and share the curse (give up an item)', out('You split the burden. Your Bag is lighter, and so is the curse.', $(500), lose(), good(1))),
      ch('Leave it', out('You walk on, lighter in conscience.', good(2), rp(2))),
      ch('Open it with the right words (Intelligence)', out('The chains fall. Inside: treasure, no curse.', $(700), item('nugget')), { check: 'intelligence', fail: out('The chains hold. The curse bites a little.', hurt(0.1)) }),
    ]),

  // ---- I443 Archaeology dig: brush and chisel ----
  ev('archaeology-dig', 'The Careful Dig', G, { stop: 'fossil', rarity: 'uncommon', minStage: 2, cast: ['boss.bill'], tint: '#2a2218' },
    'A professor hands you a brush and a chisel. "Gently now. The fossil does not forgive haste."', [
      pch('Chisel the stone (aim)', prompt('aim-drag', 'good'), out('The shell cracks away clean. A fossil, whole.', item('old-amber'), rp(3)), out('A chip off the corner. The fossil is damaged, but you get something.', item('old-amber'))),
      pch('Brush the dust (hold steady)', prompt('brace-hold', 'good'), out('The surface reveals a perfect shape.', item('helix-fossil'), rp(3)), out('You brush too hard.', rp(1))),
      ch('Leave it to the professor', out('He thanks you and pays a fee.', $(150))),
    ]),

  // ---- I444 Museum heist reversal: return stolen relics ----
  ev('museum-return', 'Return to the Museum', G, { stop: 'library', rarity: 'uncommon', minStage: 2, cast: ['trainer.lenora'], tint: '#2a2a1c' },
    'The curator looks heartbroken. "Someone stole our relics. If you find one, please bring it back."', [
      ch('Return a Rare Bone', out('"You found it!" The curator weeps.', lose('rare-bone'), $(700), good(2), rp(3), moment('Returned a relic to the museum.', 60)), { requires: [has('rare-bone')] }),
      ch('Return a Relic Gold', out('"Wonderful!"', lose('relic-gold'), $(900), good(2), rp(3), moment('Returned a relic to the museum.', 60)), { requires: [has('relic-gold')] }),
      ch('Keep it', out('You keep the relic. It will be worth more some day.', evil(1))),
      ch('Look around', leave()),
    ]),

  // ---- I445 Legendary shrine puzzle with Pokémon cries as keys ----
  ev('cry-shrine', 'The Shrine of Cries', G, { stop: 'shrine', rarity: 'rare', minStage: 4, cast: [], tint: '#201830', effect: 'glint' },
    'The door has three notches shaped like sound. "Only a living cry opens it."', [
      ch('Let the Fire Pokémon cry', out('The door glows. The cry opened it.', blessing('blessing-hearth'), rp(3)), { requires: [ptype('fire')] }),
      ch('Let the Water Pokémon cry', out('The door ripples open.', blessing('blessing-clarity'), rp(3)), { requires: [ptype('water')] }),
      ch('Let the Grass Pokémon cry', out('The door blooms open.', blessing('blessing-bloom'), rp(3)), { requires: [ptype('grass')] }),
      ch('Let your lead Pokémon cry', out('A cry in your lead\'s voice. The door opens a crack.', fr(2), rp(2))),
    ]),

  // ---- I446 Sky pillar ascent with obstacle dodging ----
  ev('sky-pillar', 'The Sky Pillar', G, { stop: 'tower', rarity: 'rare', minStage: 5, cast: ['trainer.dragon_tamer'], tint: '#102040', effect: 'glint' },
    'The pillar climbs into the clouds. Crumbling floors, loose stones, and a very long drop.', [
      pch('Climb carefully (timing)', prompt('throw-ring', 'good'), out('Ledge by ledge, you reach the top. The sky opens.', room('sky-pillar-top'), flag('sky-climb', 1)), out('A stone gives way. You slide, scraped.', hurt(0.15))),
      ch('Fly up (a Flying type)', out('Wings do the work. You reach the top.', room('sky-pillar-top'), flag('sky-climb', 1)), { requires: [ptype('flying')] }),
      ch('Turn back', leave()),
    ]),
  R(ev('sky-pillar-top', 'The Top of the Pillar', G, { stop: 'tower', rarity: 'rare', minStage: 5, cast: ['trainer.dragon_tamer'], tint: '#102040', effect: 'glint' },
    'The wind is loud. A shrine, a clear sky, and a ledge to rest on.', [
      ch('Rest and take in the view', out('Your party recovers.', heal(1), fr(2), rp(4), moment('Climbed the Sky Pillar.', 65))),
      ch('Pray at the shrine', out('A dragon\'s shadow passes overhead. A scale falls.', item('dragon-scale'), blessing('blessing-wild-grace'))),
    ])),

  // ---- I447 + I505 The final conversation and the group chant (late-run stop) ----
  ev('final-conversation', 'Before the Last Door', G, { stop: 'tower', rarity: 'rare', minStage: 8, cast: ['boss.cynthia-masters'], tint: '#1c1c28', effect: 'glint' },
    'The last door stands before you. A voice speaks from behind it: "Before we fight: what do you want?"', [
      ch('"To win."', out('"Then I will make it hard." The room sharpens.', relic('final-pride', 'Pride Before the Fall', { kind: 'enemyLevelOffset', value: 2 }, xpm(1.15)), moment('Told the last door: to win.', 60))),
      ch('"To understand you."', out('"Then I will show you." The room softens.', relic('final-calm', 'A Calm Before the Storm', frm(1.15), { kind: 'healingMultiplier', value: 1.15 }), peace(1), moment('Told the last door: to understand.', 60))),
      ch('"To protect my friends."', out('"Then fight for them." Your party steps forward, together.', relic('final-bond', 'Together at the Door', frm(1.2), xpm(1.05)), fr(3), good(1), moment('Told the last door: to protect my friends.', 60))),
    ]),
  ev('final-chant', 'The Group Chant', G, { stop: 'tower', rarity: 'rare', minStage: 8, requires: [party(3)], cast: [], tint: '#1c1c28', effect: 'sparkle' },
    'Your party gathers. Each of them has a cry, a call, a word. "Together," they say. One by one, they start the chant.', [
      pch('Lead the chant (rhythm)', prompt('echo-rhythm', 'good'), out('Every voice lands on the beat. The air hums. Your party feels invincible.', heal(1), fr(3), blessing('blessing-hearth'), moment('The whole party chanted before the last battle.', 65)), out('The chant wavers, but the spirit holds.', heal(0.5), fr(1))),
      ch('Listen quietly', out('They chant without you. It sounds like home.', fr(1), heal(0.3))),
    ]),

  // ---- K misc touches ----
  ev('umbrella-share', 'One Umbrella, Two Trainers', G, { stop: 'event', rarity: 'common', minStage: 1, cast: ['trainer.lacey'], tint: '#1c2a38', effect: 'rain' },
    'Rain. A stranger without an umbrella huddles under a tree. Your Pokémon look up at your umbrella.', [
      ch('Share the umbrella', out('You walk together. She waves goodbye at the next fork. Your Pokémon snuggle in.', fr(2), good(1), flag('umbrella-friend', 1))),
      ch('Keep it for the party', out('Everyone stays dry. The stranger shrugs.', fr(1))),
    ]),
  ev('passing-caravan', 'The Passing Caravan', G, { stop: 'event', rarity: 'common', minStage: 1, cast: ['trainer.worker_m'], tint: '#2a2a1c' },
    'A caravan rolls by on the other road. Drivers wave. A child leans out the back window.', [
      ch('Wave back', out('The child throws you a trinket.', any('potion', 'oran-berry', 'honey', 'soda-pop'), fr(1)), { chance: 0.7, fail: out('Everyone waves. The caravan rolls on.', fr(1)) }),
      ch('Wave with the whole party', out('The Pokémon cheer. Someone in the caravan throws a bigger gift.', item('great-ball'), fr(2))),
    ]),
  ev('parrot-teacher', 'The Parrot Pokémon', G, { stop: 'event', rarity: 'uncommon', minStage: 1, pokemon: 'chatot', cast: [], tint: '#1c3020' },
    'A chatty bird Pokémon hops onto your shoulder. "Teach me something!"', [
      ch('Teach it "Good luck!"', out('"GOOD LUCK!" it squawks. A luck charm falls out of the sky.', attr('luck', 1), flag('parrot-phrase', 1))),
      ch('Teach it "Never give up!"', out('"NEVER GIVE UP!" it squawks. Your party perks up.', fr(2), flag('parrot-phrase', 2))),
      ch('Teach it a lullaby', out('It hums it back, softly. Your party nods off for a moment.', heal(0.3), flag('parrot-phrase', 3))),
    ]),
  ev('parrot-repeats', 'The Parrot Remembers', G, { stop: 'event', rarity: 'uncommon', minStage: 2, requires: [{ kind: 'flag', key: 'parrot-phrase', atLeast: 1 }], callback: true, pokemon: 'chatot', cast: [], tint: '#1c3020' },
    'A familiar squawk overhead. The parrot has been repeating what you taught it, to everyone it meets.', [
      ch('Thank it', out('It repeats your phrase, delighted. Somewhere, someone is cheered up.', fr(2), $(150), good(1))),
    ]),
  ev('hungry-foe-berry', 'A Hungry Foe', G, { stop: 'wild', rarity: 'common', minStage: 1, cast: [], tint: '#2a2a1c' },
    'A wild Pokémon growls at you, its stomach louder than its warning.', [
      ch('Give it your last berry', out('It eats, calms down, and wanders off. The fight is over.', lose('oran-berry'), good(1), fr(1)), { requires: [has('oran-berry')] }),
      ch('Fight', fight('It lunges. Fine.', wild({ lv: 0, win: [rp(1)] }))),
      ch('Back away slowly', leave()),
    ]),
  ev('hold-the-hand', 'The Dark Crossing', G, { stop: 'detour', rarity: 'uncommon', minStage: 3, cast: [], tint: '#101020' },
    'A scary stretch of road. Strange noises. Your lead Pokémon grips your sleeve.', [
      pch('Hold steady and walk together (hold)', prompt('brace-hold', 'ok'), out('You cross together, hand in paw. A calm fear shield settles over the party.', fr(2), blessing('blessing-hearth')), out('Your lead trembles. You cross anyway.', fr(1))),
      ch('Run across', out('You make it, panting.', hurt(0.05))),
    ]),
  ev('wish-upon-star', 'A Wish Upon a Star', G, { stop: 'camp', rarity: 'common', minStage: 1, cast: [], tint: '#101030', effect: 'sparkle' },
    'A star blinks overhead. Your Pokémon look at you. "Make a wish!"', [
      ch('Wish for a friend', out('In the morning, a small gift lies near your tent.', item('oran-berry'), fr(1), flag('wish-star', 1))),
      ch('Wish for luck', out('In the morning, a coin rests on your boot.', $(100), attr('luck', 1), flag('wish-star', 1))),
      ch('Wish for peace', out('In the morning, the air is still and soft.', heal(0.4), peace(1), flag('wish-star', 1))),
    ]),
  ev('sleeping-npc', 'A Sleeping Stranger', G, { stop: 'event', rarity: 'common', minStage: 1, cast: ['trainer.hiker'], tint: '#1c1c28' },
    'A trainer is asleep against a rock, muttering. You could lean in.', [
      ch('Eavesdrop on the dream', out('"...the east path... the key under the bridge..." You learn something.', reveal(), rp(1))),
      ch('Wake them politely', out('They yawn, embarrassed, and give you a snack.', item('oran-berry'), fr(1))),
      ch('Let them sleep', out('You tiptoe past. Your Pokémon are very quiet too.', good(1))),
    ]),
  ev('shrine-bell', 'The Shrine Bell', G, { stop: 'shrine', rarity: 'common', minStage: 1, cast: [], tint: '#2a2218' },
    'A great bell hangs under a roof of old wood. A rope dangles. "Ring it at the right moment," says a faded sign.', [
      pch('Ring the bell on time (timing)', prompt('throw-ring', 'perfect'), out('The note rings out clean. A warm blessing settles over the party.', blessing('blessing-hearth'), fr(2), rp(2)), out('A dull clang. Still, a small blessing.', fr(1))),
      ch('Ring it without thinking', out('Clang! A small blessing.', fr(1))),
    ]),
  ev('cheer-rival-match', 'A Rival Match to Cheer', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['boss.hop'], tint: '#20202a' },
    'Two trainers you know face off in a friendly match. The crowd is split. You have a voice.', [
      pch('Cheer for the first trainer (shout!)', prompt('shout-tap', 'good'), out('Your shout lands. Their morale soars. They win, and thank you later.', flag('rival-cheer', 1), fr(1), $(200)), out('Your shout is lost in the noise. They lose by a hair.', fr(1))),
      pch('Cheer for the second trainer (shout!)', prompt('shout-tap', 'good'), out('Your shout lands. Their morale soars. They win, and thank you later.', flag('rival-cheer', 1), fr(1), $(200)), out('Your shout is lost in the noise.', fr(1))),
      ch('Stay neutral', out('A good match. You clap for both.', rp(1))),
    ]),
  ev('name-the-egg', 'Naming the Egg', G, { stop: 'daycare', rarity: 'common', minStage: 1, cast: ['trainer.aroma_lady'], tint: '#2a2218' },
    'An egg sits warm in your pack. The caretaker holds a pen. "It will hear its name before it hatches."', [
      ch('Name it "Sunny"', out('The egg wiggles. Whatever hatches will know it.', flag('egg-name', 1), fr(1))),
      ch('Name it "Midnight"', out('The egg thumps once.', flag('egg-name', 2), fr(1))),
      ch('Name it "Pebble"', out('The egg is very still.', flag('egg-name', 3), fr(1))),
    ]),
  ev('tap-the-silhouette', 'A Silhouette in the Grass', G, { stop: 'wild', rarity: 'common', minStage: 1, cast: [], tint: '#101820' },
    'A shape moves in the tall grass. You hear a faint cry and you could guess its owner.', [
      ch('Listen closely (Intelligence)', out('You recognise the cry. You know exactly what it is, and how to sneak up.', rp(2)), { check: 'intelligence', fail: out('Too many cries mixed together.', rp(1)) }),
      ch('Step in', fight('The silhouette turns around.', wild({ lv: 0, win: [rp(1)] }))),
      ch('Leave it', leave()),
    ]),
];

export const W10_PHOTO: Json[] = [
  ev('photo-contest', 'The Photo Contest', G, { stop: 'contest', rarity: 'uncommon', minStage: 2, cast: ['trainer.lacey'], tint: '#2a2030', effect: 'sparkle' },
    'A judge with a big camera strap runs a contest: "Show me your best camp photo of your Pokémon!"', [
      ch('Enter your album (3+ camp photos)', out('The judges flip through your album and gasp. First prize!', $(600), item('rare-candy'), fr(2), moment('Won the photo contest with camp photos.', 55)), { requires: [{ kind: 'photos', atLeast: 3 }] }),
      ch('Enter your best photo (1+ camp photo)', out('A lovely shot. Second place and a ribbon.', $(250), fr(1)), { requires: [{ kind: 'photos', atLeast: 1 }] }),
      ch('Take a quick photo now (Luck)', out('Blink, flash. Somehow it works. Third place!', $(100), fr(1)), { check: 'luck', fail: out('A blurry thumb. Everyone laughs kindly.') }),
    ]),
];
W10_EVENTS.push(...W10_PHOTO);

function attrSpeed(): Json {
  return { kind: 'attribute', key: 'speed', amount: 1 };
}
function attrLuck(n: number): Json {
  return { kind: 'attribute', key: 'luck', amount: n };
}
function attr(key: string, amount: number): Json {
  return { kind: 'attribute', key, amount };
}
