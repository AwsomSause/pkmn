// W6 Rivals, legacy and ghosts: the rival interactions of Interactions D (I159-I187) and the Daycare/Ranch Legacy Egg (F118).
// Same rules as the Living Rival events: writes `rival-friend` / `rival-heat` flags, a Chronicle line, and always a no-cost way out.
// `carry-*` flags are copied into the finished run's record and come back next run as `inherit-*` (core/rivals/ledger.ts).

import { $, any, BERRIES, ch, ev, fight, flag, flagIs, fr, heal, HELD, join, leave, lv, out, reveal, rp, TREASURE, trainer, attr, type Json } from './dsl.ts';

const L = 'Rival Interactions';
const met = (atLeast = 1): Json => ({ kind: 'rivalMet', atLeast });
const path = (p: 'friend' | 'rival' | 'between'): Json => ({ kind: 'rivalPath', path: p });
const friend = (n = 1): Json => flag('rival-friend', n);
const heat = (n = 1): Json => flag('rival-heat', n);
const moment = (text: string, importance = 65): Json => ({ kind: 'moment', text, importance });
const o = (stage: number, rarity: 'common' | 'uncommon' | 'rare' | 'epic', requires: Json[], effect = 'sparkle', tint = '#242030') => ({ rarity, minStage: stage, requires, cast: [] as string[], effect, tint });

export const RIVAL_LEGACY_EVENTS: Json[] = [
  // ---- I159: texts after major wins ----
  ev('rival-text-support', 'A Message From a Friend', L, o(2, 'uncommon', [met(), path('friend')], 'hearts'),
    'Your phone buzzes after the last fight. It is your rival: "Saw the result. Nobody else could have done that. Keep going."', [
      ch('Write back (safe)', out('You trade three messages and a bad joke. It helps more than you expected.', friend(1), fr(3, 'party'), moment('Your rival texted after a big win: support, and a bad joke.', 60))),
      ch('Read it twice and pocket the phone', out('Some things are better left unanswered.', rp(10))),
    ]),
  ev('rival-text-taunt', 'A Message From an Adversary', L, o(2, 'uncommon', [met(), path('rival')], 'flicker', '#38202a'),
    'Your phone buzzes after the last fight. Your rival: "One win. Do not get comfortable. I am coming for the rest."', [
      ch('Reply with a single word: "Good."', out('The three dots appear and disappear for a full minute. Your team feels sharper.', heat(1), attr('ragePeace', 2), rp(15))),
      ch('Ignore it (safe)', leave('You mute the thread and walk on lighter than before.')),
    ]),

  // ---- I160 / I170: care package, and the trap version ----
  ev('rival-care-package', 'A Care Package', L, o(3, 'rare', [met(2), path('friend')], 'hearts', '#1d2a30'),
    'A parcel is waiting at the healing stop. The tag says only: "Heard it was rough. - your rival". Inside are supplies packed with surprising care.', [
      ch('Open it (safe)', out('Berries, a full set of potions and a note: "Do not lose before I get my rematch."', heal(1), any(...BERRIES), $(500), friend(1), moment('Your rival sent a care package.', 65))),
      ch('Share it with the team', out('Everyone gets a portion. They remember who it came from.', heal(1), fr(5, 'party'), friend(1))),
    ]),
  ev('rival-trap-gift', 'A Gift You Should Question', L, o(3, 'uncommon', [met(2), path('rival')], 'flicker', '#2a1d24'),
    'A boxed gift with your rival\'s handwriting on the tag sits on a bench. The wrapping is too neat for someone who hates you.', [
      ch('Open it anyway (risky)', out('A smoke bomb. Your team coughs through the next battle in their heads, and you laugh in spite of yourself.', any(...HELD), heat(1), moment('Your rival left you a prank gift.', 55)), { check: 'intelligence', fail: out('It was a trap: the box burst. Your team is rattled.', heat(2), { kind: 'damage', share: 0.15 }) }),
      ch('Have a Pokémon sniff it first (safe)', out('Your lead growls at the box. You leave it on the bench for the next fool.', fr(3, 'lead'), rp(10))),
      ch('Leave it', leave()),
    ]),

  // ---- I161: a note on the map ----
  ev('rival-map-note', 'A Note Left Behind', L, o(2, 'common', [met()], 'float'),
    'Scratched into a signpost, in a hand you know: "Been here first. The path to the east is safe. The one north is not. - R."', [
      ch('Trust the note (safe)', out('You take the east path. The note was right.', reveal(), friend(1), rp(10))),
      ch('Take the path it warns against', out('Probably a trick. Probably.', { kind: 'skipAhead' }, heat(1)), { check: 'luck', fail: out('It was not a trick. You limp back.', { kind: 'damage', share: 0.15 }) }),
      ch('Add a note of your own', out('"Slow down. - Me." You hope they read it.', friend(1), fr(2, 'party'))),
    ]),

  // ---- I162: the buyout ----
  ev('rival-buyout', 'Emptied Shelves', L, o(3, 'uncommon', [met(2), path('rival')], 'rattle', '#2a1d18'),
    'The shopkeeper wrings their hands: "Your rival came through and bought out every ball and potion. Paid double. Said you would need them."', [
      ch('Pay the shopkeeper for their trouble', out('You buy what is left at a steep markup. Your rival\'s grin is almost audible.', $(-400), heat(1))),
      ch('Track down the rival (risky)', fight('They are three roads away, already waving a bag of your potions.', trainer('Hoarder', { rival: true, size: 3, lv: 1, win: [$(900), heal(1), any(...BERRIES), heat(1)] }))),
      ch('Shrug and move on', leave('There will be other shops.')),
    ]),

  // ---- I164: asking for your advice ----
  ev('rival-asks-advice', 'Advice, Reluctantly', L, o(2, 'uncommon', [met(2)], 'sparkle', '#1d2a30'),
    'Your rival blocks the road, arms folded. "I am not asking for help. I am asking what you would pick. A strong Fire team, or a Water team that hits everything twice?"', [
      ch('"Go Water. Always Water."', out('They nod, hating how sensible it sounds. Next time they meet you, they will have taken it.', flag('carry-rival-advice-water'), flag('rival-advised-water'), friend(1), moment('Your rival asked your advice: you told them Water.', 70))),
      ch('"Fire. Hit first, hit hard."', out('A slow grin. "That is what I was going to do."', flag('carry-rival-advice-fire'), flag('rival-advised-fire'), friend(1), moment('Your rival asked your advice: you told them Fire.', 70))),
      ch('Tell them to figure it out', out('They glare. Then they spend an hour working it out and win by a hair next time.', heat(1), flag('rival-advised-none'))),
    ]),

  // ---- I165: one-turn duel (bragging rights) ----
  ev('rival-one-turn-duel', 'Bragging Rights', L, o(2, 'uncommon', [met()], 'spin', '#2a2a1d'),
    'Mid-stride, your rival grabs your sleeve. "One Pokémon each. Whoever is standing after one turn wins bragging rights. Deal?"', [
      ch('Deal (risky)', fight('Both of you call your lead at once.', trainer('Bragging Rights', { rival: true, size: 1, lv: 2, win: [$(400), friend(1), moment('You won bragging rights in a one-Pokémon duel.', 65)] }))),
      ch('Decline, with a smile (safe)', out('"Coward." They are smiling too.', fr(2, 'party'))),
    ]),

  // ---- I166: the stolen catch spot ----
  ev('rival-grudge-spot', 'Their Spot', L, o(2, 'uncommon', [met(), { kind: 'partySize', atLeast: 3 }], 'rattle', '#2a1d24'),
    'Your rival has been camped beside a tall patch of grass for hours, waiting on one Pokémon. You see it and your Poké Ball is already in your hand.', [
      ch('Catch it first', out('It is yours. They will remember.', join({ lv: 0 }), heat(2), moment('You caught the Pokémon your rival had waited hours for.', 70))),
      ch('Let them have it (safe)', out('They catch it, stunned that you stepped aside. A long, quiet moment follows.', friend(2), fr(4, 'party'), moment('You gave your rival their catch.', 70))),
      ch('Race them for it (risky)', fight('You both lunge for the Poké Ball at the same moment.', trainer('Catch Race', { rival: true, size: 2, lv: 1, win: [join({ lv: 0 }), heat(1)] }))),
    ]),

  // ---- I168: a berry before the boss ----
  ev('rival-berry-boss', 'A Berry for the Road', L, o(3, 'rare', [met(2), path('friend')], 'hearts', '#2a2a1d'),
    'Your rival catches up to you outside the gate with a single berry in their hand, unripe at the edges. "For luck. Do not make a big deal of it."', [
      ch('Take it and say thank you', out('You hold it as you go in. It is heavier than a berry should be.', any(...BERRIES), friend(2), fr(5, 'party'), moment('Your rival gave you a berry before a big fight.', 75))),
      ch('Tell them to keep it for themselves', out('They press it into your palm anyway.', any(...BERRIES), friend(1))),
    ]),

  // ---- I169: the Pokémon greet each other ----
  ev('rival-mon-greeting', 'Greetings Between Teams', L, o(2, 'common', [met(), path('friend')], 'hearts', '#2a2a38'),
    'Before you can even speak, the two teams spill out of their balls. Your Pokémon and your rival\'s Pokémon bow, squeak, and bump noses like old schoolmates.', [
      ch('Let them play (safe)', out('For five minutes there is no rival, just pals.', fr(6, 'party'), friend(1))),
      ch('Join in', out('You and your rival end up on the grass, laughing.', fr(4, 'party'), friend(2), { kind: 'attribute', key: 'love', amount: 1 })),
    ]),

  // ---- I172: coaching ----
  ev('rival-coaching', 'The Post-Mortem', L, o(2, 'uncommon', [{ kind: 'rivalBeaten' }], 'sparkle', '#1d2230'),
    'Your rival has been reading about your last battle. "Your lead was in the wrong slot. You wasted your first turn. And you flinch when the crowd gets loud."', [
      ch('Listen and take notes (safe)', out('It stings. It also helps. Your next battle will go smoother.', rp(30), attr('intelligence', 1), friend(1), moment('Your rival coached you through your last fight.', 65))),
      ch('Argue', out('You are both a little right. A very loud half hour follows.', heat(1), rp(10))),
    ]),

  // ---- I173: race to the node ----
  ev('rival-race', 'First Pick', L, o(2, 'uncommon', [met()], 'spin', '#2a2a1d'),
    'A crate of supplies sits on the far side of the field. Your rival is already looking at it, already leaning forward. "First one there gets first pick."', [
      ch('Race them', out('You get there a half step ahead. First pick is yours.', any(...HELD), $(300), moment('You beat your rival to the crate.', 55)), { check: 'speed', fail: out('They get there first and take the best thing. You settle for scraps.', $(150), heat(1)) }),
      ch('Let them go ahead', out('They take the best thing and leave you a nice second.', $(200), friend(1))),
    ]),

  // ---- I175: eavesdrop ----
  ev('rival-eavesdrop', 'Overheard', L, o(3, 'uncommon', [met(2)], 'fog', '#1d1d28'),
    'Behind a thin wall you hear your rival on a call, speaking quietly. They are planning something: which road they will take, which gym they will challenge first.', [
      ch('Take notes (risky)', out('You know their route. When you meet, you will be ready.', reveal(), rp(30), heat(1)), { check: 'intelligence', fail: out('A board creaks. They know you were there.', heat(2)) }),
      ch('Walk away (safe)', out('Some secrets are not yours to carry.', friend(1), moment('You overheard your rival and left without a word.', 60))),
      ch('Knock and say hello', out('They stop talking mid-sentence, then laugh. "Of course it is you."', friend(1), fr(2, 'party'))),
    ]),

  // ---- I177: the rival's mentor ----
  ev('rival-mentor-appears', 'Their Mentor Comes Calling', L, o(4, 'rare', [met(3), flagIs('rival-heat', 3)], 'rattle', '#2a1d24'),
    'A weathered trainer with a familiar way of standing blocks the bridge. "You have been unkind to my student. I would like to understand why."', [
      ch('Explain yourself (safe)', out('The mentor listens. You leave with a quieter conscience and a sharper tongue.', { kind: 'attribute', key: 'charisma', amount: 1 }, rp(20), moment('You explained yourself to your rival\'s mentor.', 65)), { check: 'charisma', fail: out('They shake their head, unconvinced. "I will see for myself."', heat(1)) }),
      ch('Accept the challenge (risky)', fight('"Fine. Show me."', trainer('Rival\'s Mentor', { cls: 'veteran', size: 4, lv: 3, win: [$(1200), any(...TREASURE), rp(60), flag('rival-heat', -2), moment('You faced your rival\'s mentor and held your own.', 80)] }))),
    ]),

  // ---- I179: memorial for a fallen rival Pokémon ----
  ev('rival-memorial', 'A Memorial', L, o(4, 'rare', [{ kind: 'monRival', state: 'sacrificed' }], 'rain', '#1d2230'),
    'A small stone stands on a hill, a few wilted flowers around it. The Poké Ball charm beside it is your rival\'s. They are kneeling there, completely silent.', [
      ch('Kneel beside them (safe)', out('You stay as long as they want. They leave you the charm.', fr(6, 'party'), friend(2), moment('You kept a vigil beside your rival for the Pokémon they lost.', 85), { kind: 'relic', id: 'rival-charm', name: 'Fallen Partner\'s Charm', effects: [{ kind: 'friendshipMultiplier', value: 1.15 }, { kind: 'priceMultiplier', value: 1.05 }] })),
      ch('Leave a flower and go', out('You put it down and leave them to it.', fr(2, 'party'))),
    ]),

  // ---- I181: a drink after a close fight ----
  ev('rival-shared-drink', 'One for the Road', L, o(3, 'rare', [{ kind: 'rivalBeaten' }, path('friend')], 'hearts', '#2a2a1d'),
    'After a close fight, your rival drops onto the bench beside you and hands over a cold drink. "Do not tell anyone. I am going to teach you something."', [
      ch('Learn the trick (safe)', out('A move you would never have found on your own. They watch your lead try it and almost smile.', { kind: 'eggMove' }, friend(1), moment('Your rival taught you a secret move over a drink.', 75))),
      ch('Just enjoy the drink', out('The silence is its own kind of gift.', heal(1), fr(4, 'party'))),
    ]),

  // ---- I183: mind games ----
  ev('rival-mind-games', 'A Fake Lead', L, o(3, 'uncommon', [met(2), path('rival')], 'flicker', '#38202a'),
    'Your rival\'s team is in the open and their strongest-looking Pokémon sits in front. Too obviously in front. The corner of their mouth twitches.', [
      ch('Call the bluff (risky)', out('Their real lead was waiting in the back. You see it coming and your team is ready.', rp(40), moment('You saw through your rival\'s fake lead.', 70), $(500)), { check: 'intelligence', fail: out('It was no bluff. You eat the first hit.', heat(1), { kind: 'damage', share: 0.15 }) }),
      ch('Fight them straight', fight('You do not play their game.', trainer('Rival\'s Bluff', { rival: true, size: 3, lv: 1, win: [$(500), heat(1)] }))),
    ]),

  // ---- I184: the gloat ----
  ev('rival-gloat', 'The Victory Lap', L, o(3, 'uncommon', [met(2), path('rival')], 'sparkle', '#38202a'),
    'Your rival\'s team is still on the field, cheering. They look at you and do a slow lap around the grass. "Say it with me: second place."', [
      ch('Take it in silence (safe)', out('You nod and start planning. The training montage begins in your head.', rp(30), attr('ragePeace', -1), heat(1), moment('Your rival gloated. You went away and trained.', 70))),
      ch('Demand a rematch (risky)', fight('"Now? Fine."', trainer('Gloating Rival', { rival: true, size: 3, lv: 2, win: [$(800), lv(1, 'party'), heat(1), moment('You won the rematch right after the gloat.', 80)] }))),
    ]),

  // ---- I186: cosplay ----
  ev('rival-cosplay', 'Wearing Each Other\'s Colours', L, o(3, 'rare', [met(2)], 'sparkle', '#242038'),
    'Your rival turns up in a jacket that looks just like yours, a lookalike ball on their belt. They grin: "Swap for a day? I wear yours, you wear mine."', [
      ch('Swap (safe)', out('You walk one town in their shoes. It humbles both of you.', attr('charisma', 1), friend(2), fr(3, 'party'), moment('You and your rival swapped styles for a day.', 70))),
      ch('Fight in costume', fight('"Two imposters. Last one standing is the real one."', trainer('Costume Rival', { rival: true, size: 3, lv: 1, win: [$(700), friend(1), rp(20)] }))),
    ]),

  // ---- I187: the promise (carries between runs) ----
  ev('rival-promise-make', 'Same Place, Next Time', L, o(3, 'uncommon', [met(2), flagIs('carry-rival-promise', 0, 0)], 'sparkle', '#1d2230'),
    'Your rival looks at the map in your hands. "If this run ends before we get to settle it, meet me at the end of the next one. Same place. Same ground. Promise?"', [
      ch('Promise (it holds past this run)', out('They shake your hand. The deal is made.', flag('carry-rival-promise'), friend(1), moment('You promised your rival a rematch. It will be kept in your next run.', 85))),
      ch('Not tonight', leave('"Then I will find you anyway."')),
    ]),
  ev('rival-promise-kept', 'The Promise Kept', L, o(2, 'rare', [flagIs('inherit-rival-promise', 1), flagIs('rival-promise-kept', 0, 0)], 'hearts', '#2a2a1d'),
    'On a road you do not remember choosing, someone is waiting with their team in the open. "You said you would come. I did not believe you."', [
      ch('Keep the promise (risky)', fight('"No holding back."', trainer('The Rematch', { rival: true, size: 4, lv: 2, win: [$(1500), any(...TREASURE), lv(2, 'party'), friend(2), flag('rival-promise-kept'), moment('You kept your promise to your rival.', 90)] }))),
      ch('Say you only came to say hello', out('They laugh. "Next time, then."', friend(1), flag('rival-promise-kept'))),
    ]),

  // ---- I180: a nickname for you ----
  ev('rival-nickname', 'What They Call You', L, o(2, 'uncommon', [met(2)], 'sparkle', '#242030'),
    'Your rival calls out a new name for you across the road. It has been a while since you answered to anything else. They look pleased and a little embarrassed.', [
      ch('Answer to it (safe)', out('The name sticks. They will use it in every letter now, and it grows with your record.', friend(1), moment('Your rival gave you a nickname that has stuck.', 70))),
      ch('Make them a nickname back', out('You both laugh. They wear yours with more pride than you wear theirs.', friend(1), fr(2, 'party'))),
    ]),

  // ---- F173: cameo trainers from past runs, as allies ----
  ev('cameo-veteran-lucario', 'A Familiar Trainer', L, { rarity: 'uncommon', minStage: 2, requires: [{ kind: 'pastTeams', atLeast: 1 }], cast: [], effect: 'sparkle', tint: '#202838' },
    'A trainer you somehow remember from another road, another run, steps onto the path. They do not say how they know you, only: "Need a hand? My partner is itching for a fight."', [
      ch('Fight beside them', fight('The two teams move like one.', trainer('Rough Pair', { size: 2, ally: 'lucario', win: [$(700), rp(30), fr(2, 'party'), moment('A trainer from a past run fought beside you.', 70)] }))),
      ch('Wave them off', leave('They nod and fade into the crowd.')),
    ]),
  ev('cameo-veteran-garchomp', 'A Veteran Returns', L, { rarity: 'rare', minStage: 3, requires: [{ kind: 'pastTeams', atLeast: 2 }], cast: [], effect: 'sparkle', tint: '#202838' },
    'A hardened veteran with a battered cap and a familiar stride falls in beside you. "Heard you were in trouble. We\'ve walked this road before."', [
      ch('Fight beside them', fight('Their Pokémon moves before you can ask.', trainer('Ambush Raider', { size: 2, lv: 2, ally: 'garchomp', win: [$(1000), any(...TREASURE), rp(40), moment('A veteran from a past run fought beside you.', 75)] }))),
      ch('Thank them and go alone', leave()),
    ]),

  // ---- F118: the Legacy Egg is handed over at a Daycare or Ranch ----
  ev('legacy-ranch', 'The Ranch Keeper', L, { rarity: 'common', minStage: 1, requires: [{ kind: 'legacyEgg' }], cast: ['trainer.hiker'], effect: 'hearts', tint: '#283018' },
    'A rancher waves from the fence with a warm blanket bundle in her arms. "Somebody left this with me a long time ago. It was meant for whoever came after them. I think that is you."', [
      ch('Take the egg', out('The shell is warm. You can feel the family in it.', { kind: 'legacyEgg' }, moment('A Legacy Egg was handed over at the ranch.', 75))),
      ch('Not yet', leave('"It will keep. Come back when you can look after it."')),
    ]),
];
