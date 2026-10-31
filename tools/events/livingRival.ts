// Living Rival events (APPROVED §2, §6): a recurring character with a journey of their own. Choices write
// two run flags (rival-friend, rival-heat; core/rivals/living.ts turns them into a path) and a Chronicle
// line. Neither path is the right one, and every event keeps a no-cost way out.

import { $, any, ch, ev, fight, flag, fr, good, heal, leave, lv, out, rp, trainer, TREASURE, type Json } from './dsl.ts';

const L = 'Living Rival';
const met = (atLeast = 1): Json => ({ kind: 'rivalMet', atLeast });
const path = (p: 'friend' | 'rival' | 'between'): Json => ({ kind: 'rivalPath', path: p });
const f = (key: string, amount: number): Json => flag(key, amount);
const friend = (n = 1): Json => f('rival-friend', n);
const heat = (n = 1): Json => f('rival-heat', n);
const moment = (text: string, importance = 65): Json => ({ kind: 'moment', text, importance });
const flagIs = (key: string, atLeast: number, atMost = 99): Json => ({ kind: 'flag', key, atLeast, atMost });

export const LIVING_RIVAL_EVENTS: Json[] = [
  // ---- Rescue the Rival (and the favour returned) ----
  ev('living-rival-rescue', 'A Rival in Trouble', L, { rarity: 'uncommon', minStage: 2, requires: [met(), flagIs('rival-rescued', 0, 0)], cast: [], effect: 'rattle', tint: '#2a1d24' },
    'Someone you have fought is cornered at the edge of the road, their Pokémon worn out and a pack of rough trainers closing in. They see you. They do not ask for help.', [
      ch('Step in and fight (risky)', fight('"Back off. They are with me."', trainer('Roadside Gang', { size: 3, lv: 1, win: [$(500), friend(2), flag('rival-rescued'), { kind: 'moment', text: 'You stood between your rival and a gang on the road. They have not forgotten it.', importance: 80 }] }))),
      ch('Stand with them quietly (safe)', out('The gang thinks twice. Your rival says nothing, but walks beside you for a while.', friend(1), flag('rival-rescued'), fr(3, 'party'), { kind: 'moment', text: 'You helped your rival out of a corner.', importance: 70 })),
      ch('Walk on', out('You keep walking. You hear them behind you, and then you do not.', heat(1))),
    ]),
  ev('living-rival-returns-favor', 'The Favour Returned', L, { rarity: 'rare', minStage: 3, requires: [flagIs('rival-rescued', 1), flagIs('rival-favor', 0, 0)], cast: [], effect: 'hearts', tint: '#1d2a30' },
    'Your rival is waiting at the healing stop with their arms crossed. "I do not owe anyone. So do not think this is a favour. It is a debt."', [
      ch('Let them help (safe)', out('They patch your team up and press a bundle into your hands. "Now we are even. Almost."', heal(1), friend(1), flag('rival-favor'), $(600), { kind: 'moment', text: 'Your rival repaid the rescue.', importance: 70 })),
      ch('Say it is not a debt', out('They look away, pleased and annoyed about it. A rare item ends up in your bag anyway.', friend(1), flag('rival-favor'), any(...TREASURE))),
    ]),

  // ---- Bad Day ----
  ev('living-rival-bad-day', "A Rival's Bad Day", L, { rarity: 'uncommon', minStage: 2, requires: [{ kind: 'rivalBeaten' }], cast: [], effect: 'rain', tint: '#1d2230' },
    'Your rival is sitting on a wall in the rain, a lost badge case in their lap. They have not noticed you yet.', [
      ch('Sit beside them (safe)', out('You do not say much. After a while they laugh, once, and say: "Next time."', friend(2), fr(4, 'party'), { kind: 'moment', text: 'You sat with your rival on a bad day.', importance: 65 })),
      ch('Tease them', out('Their head snaps up. "You will regret that." Every Pokémon in your party feels a little braver.', heat(2), { kind: 'attribute', key: 'ragePeace', amount: 2 })),
      ch('Leave them alone', leave('Some days are not for company. You walk on.')),
    ]),

  // ---- Photo Opportunity (three tones) ----
  ev('living-rival-photo-friend', 'A Photo With a Friend', L, { rarity: 'uncommon', minStage: 2, requires: [met(2), path('friend')], cast: [], effect: 'hearts', tint: '#2a2a1d' },
    'A street photographer is setting up. Your rival waves you over before you can say a word. "Come on. Both of us. Everyone smiling."', [
      ch('Pose together (safe)', out('The photo is crooked and perfect. Both teams crowd into the frame.', fr(6, 'party'), friend(1), { kind: 'moment', text: 'A photo with your rival: both teams laughing, arms around each other.', importance: 75 })),
      ch('Decline politely', leave('They shrug and take a solo picture instead. They look a little smaller in it.')),
    ]),
  ev('living-rival-photo-rival', 'A Photo Neither Wants', L, { rarity: 'uncommon', minStage: 2, requires: [met(2), path('rival')], cast: [], effect: 'flicker', tint: '#38202a' },
    'A photographer wants "the famous two" in one shot. Your rival stands exactly one arm span away and does not smile.', [
      ch('Stare back at them (safe)', out('The photo is terrifying. It sells well.', heat(1), rp(20), $(400), { kind: 'moment', text: 'A photo with your rival: neither blinked.', importance: 75 })),
      ch('Offer a handshake', out('They take it, hard, and the camera catches that instead. A small thaw.', friend(1), { kind: 'moment', text: 'A photo with your rival: a handshake neither of you meant.', importance: 75 })),
    ]),
  ev('living-rival-photo-between', 'A Photo, Awkwardly', L, { rarity: 'uncommon', minStage: 2, requires: [met(2), path('between')], cast: [], effect: 'sparkle', tint: '#2a2a38' },
    'A photographer wants you and your rival in one frame. You both stand there, hands in odd places, not sure what you are to each other.', [
      ch('Lean in', out('You throw an arm around them. They flinch, then relax.', friend(1), fr(3, 'party'), { kind: 'moment', text: 'A photo with your rival: awkward, close, and kept.', importance: 75 })),
      ch('Keep your distance', out('The picture shows two people looking at different things.', heat(1), { kind: 'moment', text: 'A photo with your rival: two people looking at different things.', importance: 70 })),
      ch('Skip it', leave()),
    ]),

  // ---- Training Montage ----
  ev('living-rival-montage', 'A Rival Training Hard', L, { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'rivalBeaten' }], cast: [], effect: 'sparkle', tint: '#2a1d18' },
    'Past a fence you see your rival drilling their team at dawn: sprints, dodges, the same move forty times. Their Pokémon are staring at the spot where your team stood.', [
      ch('Watch from the fence (safe)', out('You learn how they have changed. When you meet again, you will be ready.', rp(30), { kind: 'attribute', key: 'intelligence', amount: 1 }, { kind: 'moment', text: 'You watched your rival train. They are coming back stronger.', importance: 70 })),
      ch('Spar with them', fight('"Finally. I needed someone who hits back."', trainer('Training Partner', { rival: true, size: 3, lv: 1, win: [friend(1), lv(1, 'party'), { kind: 'moment', text: 'You sparred with your rival at dawn.', importance: 70 }] }))),
      ch('Walk on', leave()),
    ]),

  // ---- Promised Rematch (promise, then the kept promise) ----
  ev('living-rival-promise', 'A Promised Rematch', L, { rarity: 'uncommon', minStage: 2, requires: [met(), flagIs('rival-promise', 0, 0)], cast: [], effect: 'glint', tint: '#38202a' },
    'Your rival points past the next ridge. "Not here. Not like this. Meet me at the end of the next region, and bring everything. I will be ready."', [
      ch('Promise to be there', out('"Then it is a promise." They do not shake your hand. They nod, once.', flag('rival-promise'), { kind: 'moment', text: 'You promised your rival a rematch at the end of the next region.', importance: 75 })),
      ch('Say you will see', out('"Fine. But I will be waiting."', heat(1), flag('rival-promise'))),
      ch('Decline', leave('"Your loss." They walk away without looking back.')),
    ]),
  ev('living-rival-promise-kept', 'The Promise Kept', L, { rarity: 'rare', minStage: 4, requires: [flagIs('rival-promise', 1), flagIs('rival-promise-kept', 0, 0)], cast: [], effect: 'glint', tint: '#38202a' },
    'Your rival is standing exactly where they said they would be, team at full strength. "You came. Good. Everything you have."', [
      ch('Fight them', fight('"This is the match I have been training for."', trainer('Promised Rival', { rival: true, size: 4, lv: 3, win: [$(2200), any(...TREASURE), rp(60), flag('rival-promise-kept'), friend(1), { kind: 'moment', text: 'You kept your promise and beat your rival at the place they named.', importance: 85 }] }))),
      ch('Ask for a day', out('They look as if they might argue, then do not. "Tomorrow, then. I have waited this long."', flag('rival-promise-kept'), heat(1))),
    ]),

  // ---- Public Acknowledgement of a Defeat ----
  ev('living-rival-acknowledges', 'They Say It Out Loud', L, { rarity: 'rare', minStage: 3, requires: [{ kind: 'rivalBeaten' }, met(3), path('friend')], cast: [], effect: 'hearts', tint: '#1d2a38' },
    'Your rival climbs onto a crate in the plaza. "I want everyone to hear this. I lost. They beat me, and it was not luck. I made the same mistake twice."', [
      ch('Shake their hand (safe)', out('The plaza applauds. They look relieved, as if a weight has gone.', good(2), friend(2), { kind: 'moment', text: 'Your rival admitted a defeat in public. It marks a turning point in their story.', importance: 85 })),
      ch('Admit you got lucky', out('"Do not do that," they say, smiling. "Take the win."', friend(1), fr(3, 'party'))),
    ]),
  ev('living-rival-acknowledges-rival', 'Grudging Respect', L, { rarity: 'rare', minStage: 3, requires: [{ kind: 'rivalBeaten' }, met(3), path('rival')], cast: [], effect: 'flicker', tint: '#38202a' },
    'Your rival blocks the road, jaw tight. "You beat me. I saw what I did wrong. I will not make the same mistake. That is not a compliment."', [
      ch('Take it as one (safe)', out('They look as if they might say more, and do not. A rare item changes hands.', heat(1), any(...TREASURE), { kind: 'moment', text: 'Your rival admitted, through gritted teeth, that you were better.', importance: 85 })),
      ch('Say nothing', leave('You let the silence say it. They nod, and are gone.')),
    ]),

  // ---- Rival Clash (recorded team; asynchronous) ----
  ev('living-rival-clash', 'Rival Clash', L, { rarity: 'rare', minStage: 3, requires: [met(), { kind: 'championGhost' }], cast: [], effect: 'spin', tint: '#201a38' },
    'Your rival has borrowed a roster: a team recorded from a finished run, set up as a challenge. Nobody is online and no one is playing it live. It is a recording, and it fights like one.', [
      ch('Take the clash', fight('"This is the strongest team I could find. Let us see whose is better."', trainer('Rival Clash', { rival: true, ghost: true, size: 6, win: [$(3000), any(...TREASURE), rp(80), heat(1), { kind: 'moment', text: 'You beat a recorded team in a Rival Clash.', importance: 80 }] }))),
      ch('Not today', leave()),
    ]),
  ev('living-rival-clash-retired', 'Rival Clash: The One That Fell', L, { rarity: 'rare', minStage: 3, requires: [met(), { kind: 'retiredGhost' }], cast: [], effect: 'spin', tint: '#201a38' },
    'Your rival found a team from a run that ended early and wants to see if you can do what it could not. It is a recording of a past run, not another player live.', [
      ch('Take the clash', fight('"They almost made it. Show me you can."', trainer('Rival Clash', { rival: true, retired: true, size: 6, win: [$(2400), any(...TREASURE), rp(60), friend(1), { kind: 'moment', text: 'You beat a recorded run in a Rival Clash.', importance: 80 }] }))),
      ch('Not today', leave()),
    ]),

  // ---- Between gauntlet fights: recovery and reward decisions ----
  ev('living-gauntlet-rest', 'Between Rivals', L, { rarity: 'epic', minStage: 2, requires: [{ kind: 'gauntlet', active: true }], cast: [], effect: 'sparkle', tint: '#38202a' },
    'A bench between two gauntlet fights. Another rival is already on their way. What do you spend the break on?', [
      ch('Rest (full recovery)', out('You sleep for an hour. Your team is fully healed.', heal(1))),
      ch('Train (a level for the team)', out('You use the break to drill. The team comes out a little stronger, but still bruised.', lv(1, 'party'), heal(0.3))),
      ch('Scout the next rival', out('A scrap of paper tells you what the next opponent is carrying.', rp(40), heal(0.5))),
    ]),
];
