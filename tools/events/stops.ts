// The approved map-stop types that need a scene of their own (events and map stops plan, Map stops table):
// Special encounter, Rare Pokémon, Trade and Detour. Their `stop` is a quota type in balance.json
// `events.stopQuotas`, so each stage gets them before the random event draw. Merchant, heal, shop and rest
// stops already have their events (see docs/status/events.md).

import {
  any, att, attr, better, ch, ev, evil, fight, join, leave, out, rp, trade, trainer, wild, HELD, TREASURE, type Json,
} from './dsl.ts';

const S = 'Map stops';

export const STOP_EVENTS: Json[] = [
  ev('rare-sighting', 'A Rare Sighting', S, { stop: 'special', rarity: 'uncommon', cast: ['trainer.worker_m'], effect: 'float', tint: '#1c2a38' }, 'Fresh tracks lead to a Pokémon you have never seen on this route. It has noticed you.', [
    ch('Approach quietly', fight('It lets you close in, then squares up!', wild({ lv: 4, shiny: 2, win: [attr('luck', 2)] })), { check: 'luck', fail: out('A twig snaps and it bolts. Gone.', attr('luck', -1)) }),
    ch('Follow the tracks (Luck 20+)', fight('You cut it off before it can run!', wild({ lv: 3, shiny: 3, win: [any(...TREASURE)] }), attr('luck', 1)), { requires: [att('luck', 20)] }),
    ch('Leave it be', leave()),
  ]),
  ev('shimmering-grass', 'Shimmering Grass', S, { stop: 'rare', rarity: 'uncommon', effect: 'sparkle', tint: '#1c3a2a' }, 'One patch of grass glitters in the light. Something in it is the wrong colour.', [
    ch('Wade in', fight('A glittering Pokémon leaps out!', wild({ shiny: 6 }))),
    ch('Search carefully (Intelligence check)', fight('You spot it first and get the jump on it.', wild({ shiny: 8, lv: -2 })), { check: 'intelligence', fail: out('Only dew. Whatever it was has moved on.') }),
    ch('Walk on', leave()),
  ]),
  ev('trading-post', 'Trading Post', S, { stop: 'trade', rarity: 'common', cast: ['trainer.worker_m'], effect: 'glint', tint: '#102838' }, 'A trainer waves a Poké Ball at you. "Swap with me? Mine is much stronger than it looks."', [
    ch('Accept the swap', out('You trade. It evolves in your hands if its kind do that when traded.', trade('any Pokémon'), join({ lv: 4 })), { requires: [{ kind: 'partySize', atLeast: 2 }], chance: 0.65, fail: out('The ball holds a feeble Pokémon. He is already gone.', trade('any Pokémon'), join({ lv: -3 }), evil(2)) }),
    ch('Inspect the offer first (Intelligence 30+)', out('You read its stats and drive a fair bargain: a strong Pokémon, no tricks.', trade('any Pokémon'), join({ lv: 6, shiny: 2 }), rp(5)), { requires: [att('intelligence', 30), { kind: 'partySize', atLeast: 2 }] }),
    ch('Refuse', leave('"Your loss," he shrugs.')),
  ]),
  ev('side-trail', 'The Side Trail', S, { stop: 'detour', rarity: 'uncommon', minStage: 2, effect: 'shake', tint: '#2a2418' }, 'A trail forks off the route and rejoins it further on. Trainers wait along it, and no Pokémon Center.', [
    ch('Short trail (2 battles)', fight('The first trainer steps out. You are in for it.', trainer('Trail Trainer', { size: 2, chain: 2, win: [better(1)] })), {}),
    ch('Long trail (3 battles, Strength 30+)', fight('You head down the hard way.', trainer('Trail Veteran', { size: 3, chain: 3, lv: 2, win: [better(2), any(...HELD)] })), { requires: [att('strength', 30)] }),
    ch('Stay on the road', leave()),
  ]),
];
