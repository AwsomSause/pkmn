// World events (catalog 28, 73, 74, 75, 99): run milestones, rare sites, a wild foe that remembers you,
// callbacks to what you did earlier, and a three-clue legendary route.

import { $, any, ch, cure, ev, egg, eggMove, fight, flag, fr, good, heal, hurt, item, join, leave, lv, out, rp, trainer, TREASURE, VITAMINS, wild, type Json } from './dsl.ts';

const M = 'Run Milestones';
const S = 'World Sites';
const C = 'World Callbacks';
const L = 'Legendary Route';
const H = 'Habitats';

const milestone = (id: string, name: string, intro: string, tint: string): Json =>
  ev(id, name, M, { rarity: 'common', minStage: 2, cast: [], effect: 'sparkle', tint }, intro, [
    ch('Rest and recover', out('You stop, breathe, and take care of everyone. Nobody goes on hurt.', heal(), cure())),
    ch('Take the risky shortcut', out('The shortcut pays off: a rare find waits at the end.', any(...TREASURE), rp(25)), { chance: 0.5, fail: out('It was a bad idea. Everyone is scraped up.', hurt(0.2)) }),
    ch('Spend time with the team', out('You sit with each Pokémon in turn. The bond between you grows.', fr(10, 'party'), good(1))),
    ch('Look for a rival', fight('A rival has been following your trail. "About time!"', trainer('Rival Challenger', { size: 3, lv: 1, win: [$(700), any(...VITAMINS), rp(20)] })), { requires: [{ kind: 'rivalMet', atLeast: 1 }] }),
  ]);

export const MILESTONE_EVENTS: Json[] = [
  milestone('milestone-dawn', 'A Checkpoint at Dawn', 'A pale sun rises over a clearing. This is a good place to decide how the next stretch will go.', '#2a2430'),
  milestone('milestone-crossroads', 'The Crossroads', 'Four roads meet at a worn stone. There is no hurry, but there is a choice.', '#242a30'),
  milestone('milestone-summit', 'A Quiet Summit', 'You are at the top of a long climb. The whole region is laid out below you.', '#1d2a2a'),
  milestone('milestone-embers', 'Embers of the Last Camp', 'Someone else camped here before you. The fire is still warm.', '#30241d'),
];

const site = (id: string, name: string, intro: string, tint: string, choices: Json[]): Json => ev(id, name, S, { rarity: 'rare', minStage: 3, cast: [], effect: 'glint', tint }, intro, choices);

export const SITE_EVENTS: Json[] = [
  site('site-shrine', 'An Ancient Shrine', 'Moss-covered steps lead up to a shrine that no map shows. Fresh offerings sit on the altar, and nobody is around.', '#1d2a20', [
    ch('Leave an offering', out('The air warms. Something old accepts it.', fr(6, 'party'), rp(40), good(2))),
    ch('Search the altar', out('Under the altar: an old keepsake.', any('relic-gold', 'rare-bone', 'big-mushroom'), rp(15))),
    ch('Leave quietly', leave()),
  ]),
  site('site-lab', 'An Abandoned Lab', 'A hatch in a hillside opens onto a lab that was left in a hurry. The lights still flicker.', '#20242a', [
    ch('Read the research notes', out('Pages of notes on a species nobody has written about.', rp(70))),
    ch('Check the incubators', out('One incubator is still running.', egg({ lv: 2 }))),
    ch('Take the gear', out('Useful equipment, left behind.', any(...VITAMINS), $(400))),
  ]),
  site('site-grove', 'A Hidden Grove', 'You push through a wall of branches and find a grove where the light is green and the air is full of quiet cries.', '#1a2d1a', [
    ch('Rest among the trees', out('Every injury eases.', heal(), cure(), fr(5, 'party'))),
    ch('Follow the cries', out('A young Pokémon, lost and unafraid, falls in step with you.', join({ lv: 0 }))),
  ]),
  site('site-crater', 'A Meteor Crater', 'A wide crater, still warm at its center. Glittering shards are scattered across the ground.', '#2a2020', [
    ch('Collect the shards', out('You pick up what you can carry.', item('comet-shard', 1), $(300))),
    ch('Study the rock', out('The stone is not from here. A researcher would pay to see this.', rp(60), eggMove())),
  ]),
];

export const CALLBACK_EVENTS: Json[] = [
  ev('old-foe-returns', 'It Remembers You', C, { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'oldFoe' }], cast: [], effect: 'fog', tint: '#2a1d1d' },
    'A familiar cry rings out from the tall grass. A wild Pokémon that beat your team earlier is back, and it is not backing down this time.', [
      ch('Face it again', fight('It charges the moment it sees you.', wild({ recall: true, lv: 3, win: [rp(40), good(1)] }))),
      ch('Slip away', leave('You circle around it. It watches you go.')),
    ]),
  ev('merchant-remembers', 'You Walked Past Us', C, { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'flag', key: 'ignored-crisis' }], cast: [], effect: 'none', tint: '#2a2420' },
    'A merchant from a town you hurried past blocks the road. "We asked for help. You kept walking."', [
      ch('Apologize and pay (₽300)', out('She accepts, a little coldly. "Thank you for coming back."', $(-300), good(2), fr(3, 'party')), { requires: [{ kind: 'money', atLeast: 300 }] }),
      ch('Say you were busy', out('She steps aside. "Of course."', { kind: 'attribute', key: 'goodEvil', amount: -1 })),
    ]),
  ev('circuit-fans', 'Autograph Seekers', C, { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'flag', key: 'won-circuit' }], cast: [], effect: 'sparkle', tint: '#2a2038' },
    'A group of kids recognizes you from the Rival Circuit final. They have drawn your team on a banner.', [
      ch('Sign the banner', out('They cheer. A parent slips you a thank-you gift.', fr(6, 'party'), $(600))),
      ch('Show them a few moves', out('They are thrilled. So are your Pokémon.', lv(1, 'party'), fr(3, 'party'))),
    ]),
];

const lclue = (id: string, name: string, intro: string, tint: string): Json =>
  ev(id, name, L, { rarity: 'uncommon', minStage: 4, requires: [{ kind: 'flag', key: 'legend-clue', atLeast: 0, atMost: 2 }], cast: [], effect: 'fog', tint }, intro, [
    ch('Follow the trail', out('One more piece falls into place.', flag('legend-clue'), rp(15))),
    ch('Not now', leave()),
  ]);

export const LEGEND_EVENTS: Json[] = [
  lclue('legend-clue-tracks', 'Strange Tracks', 'Tracks in the snow, too wide to be anything you know. They end at a sheer rock face.', '#1d2430'),
  lclue('legend-clue-song', 'A Song on the Wind', 'A song with no singer drifts down from the peaks. Your Pokémon stop to listen.', '#242a38'),
  lclue('legend-clue-scales', 'A Shed Feather', 'A single feather the length of your arm lies on a ledge, crackling with static.', '#2a2a20'),
  ev('legend-encounter', 'The Legend Appears', L, { rarity: 'rare', minStage: 5, requires: [{ kind: 'flag', key: 'legend-clue', atLeast: 3 }], cast: [], effect: 'glint', tint: '#14141f' },
    'You have followed every clue. The clouds part, and something enormous looks down at you.', [
      ch('Face the legend', fight('It does not move. It is waiting to see what you do.', wild({ species: ['zapdos', 'articuno', 'moltres'], lv: 5, win: [rp(150), flag('legend-met')] }))),
      ch('Bow and leave', out('It watches you go. You feel it will remember.', rp(40), good(2))),
    ]),
];

// Pack and habitat encounters (catalog 29): a nest, a migration or a disturbed habitat changes which wild Pokémon turn up.
const habitat = (id: string, name: string, intro: string, tint: string, yes: string, text: string, relicId: string, relicName: string, type: string, weight: number, no: string): Json =>
  ev(id, name, H, { rarity: 'uncommon', minStage: 2, cast: [], effect: 'fog', tint }, intro, [
    ch(yes, out(text, { kind: 'relic', id: relicId, name: relicName, effects: [{ kind: 'typeEncounterWeight', type, value: weight }] }, rp(15))),
    ch(no, leave()),
  ]);

export const HABITAT_EVENTS: Json[] = [
  habitat('habitat-migration', 'A Migrating Flock', 'The sky is dark with wings. A whole flock is passing over, and it will not be the last.', '#1d2430', 'Watch where they land', 'You note their route. Flying types will be seen more often from now on.', 'flock-route', 'Flock Route', 'flying', 1.6, 'Let them pass'),
  habitat('habitat-nest', 'A Nest in the Hollow', 'A hollow tree is crowded with sleeping bug-types. A larger one, the leader, watches you with all of its eyes.', '#243020', 'Respect the nest', 'The leader lets you pass. Bug types will gather around your path.', 'nest-leader', 'Nest Leader', 'bug', 1.6, 'Back away'),
  habitat('habitat-disturbed', 'A Disturbed Habitat', 'Something has torn up this part of the marsh. Water types are on edge and moving.', '#1a2a30', 'Settle the water', 'You calm the shallows. Water types will turn up more often now.', 'calm-shallows', 'Calm Shallows', 'water', 1.6, 'Wade past'),
];

// Unusual moves as clues (catalog 35): a wild Pokémon using something it should not know hints at the legend ahead.
export const CLUE_EVENTS: Json[] = [
  ev('clue-strange-move', 'It Knows Something It Should Not', L, { rarity: 'rare', minStage: 3, cast: [], effect: 'glint', tint: '#1d1d30' },
    'A wild Pokémon is practising a move you have never seen its kind use. It stops and stares at you, as if it wants to be asked.', [
      ch('Battle it and watch', fight('It shows you exactly what it learned.', wild({ lv: 2, win: [rp(40), flag('legend-clue')] }))),
      ch('Take notes from afar', out('You sketch what you saw and file it away.', rp(20))),
    ]),
];
