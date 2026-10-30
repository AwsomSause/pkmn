// The unusual events of the Overdrive blueprint (§5) that need a choice: the
// ones without a choice are first-turn banners (core/story/moments.ts).

import { $, BERRIES, HEALING, TREASURE, any, att, ch, ev, evil, fierce, fight, fr, good, has, heal, isEvil, isGood, item, join, leave, lose, out, party, peace, reveal, rp, trainer, wild, attr, type Json } from './dsl.ts';

const O = 'Overdrive unusual events';

export const OVERDRIVE_EVENTS: Json[] = [
  ev('doesnt-want-to-fight', "It Doesn't Want to Fight…", O, { rarity: 'rare', stop: 'wild', cast: [], effect: 'hearts', tint: '#1d2a3a' }, 'A wild Pokémon trembles in the grass. It is frightened, or guarding something. It does not want to fight.', [
    ch('Battle it anyway', fight('It fights back with everything it has!', wild({ lv: 2, win: [any(...TREASURE)] }), attr('ragePeace', 5)), { requires: [fierce] }),
    ch('Back away slowly', out('You retreat. It watches you go, calmer.', peace(5), fr(5, 'party'))),
    ch('Offer a berry', out('It eats the berry and relaxes. It leaves you a small gift.', lose(), any(...HEALING), good(5)), { requires: [has('oran-berry')] }),
    ch('Investigate quietly', out('You find its hidden nest and learn something about its kind.', rp(10), attr('intelligence', 3)), { check: 'intelligence', fail: out('It startles and bolts into the grass.') }),
  ]),
  ev('it-saw-what-you-did', 'It Saw What You Did…', O, { rarity: 'rare', cast: [], effect: 'glint', tint: '#2a2038' }, 'A Pokémon at the edge of the path has been watching you for a long time. It saw how you treated others on this road.', [
    ch('Meet its gaze, kindly', out('It remembers your kindness and shows you a hidden cache.', good(5), any(...TREASURE), rp(10)), { requires: [isGood(10)] }),
    ch('Meet its gaze, coldly', fight('It remembers your cruelty. It is not alone!', trainer('Avenger', { size: 2, lv: 2, win: [$(800)] })), { requires: [isEvil(10)] }),
    ch('Ask what it saw', out('It cannot say, but it follows you for a while and warms to you.', fr(8, 'party'), rp(5))),
    ch('Walk on', leave()),
  ]),
  ev('this-place-remembers', 'This Place Remembers…', O, { rarity: 'rare', cast: [], effect: 'fog', tint: '#1a2a2a' }, 'You have been somewhere like this before. The ground, the air and the old stones seem to remember the battles fought here.', [
    ch('Search the ground', out('Something was left behind from an earlier battle.', any(...TREASURE), item('rare-candy', 1)), { chance: 0.5, fail: out('Only dust and the echo of old footsteps.') }),
    ch('Follow the old tracks', out('The tracks lead you to a quieter path.', reveal(), peace(3))),
    ch('Listen to the stillness', out('Your team feels the history of this place and grows closer.', fr(10, 'party'), rp(10), heal(0.2))),
  ]),
];
