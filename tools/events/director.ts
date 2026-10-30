// Event Director events (Electric plan §2C): events that read the run's story, such as a rare
// form in the party, a rival you have fought, a bond between two Pokémon or the region's focus.
// Each has two to four options with clear risks, so the Director can offer them as "important" stops.

import { $, any, att, better, ch, ev, fight, fr, good, has, heal, leave, lv, out, rp, trainer, type Json, TREASURE } from './dsl.ts';

const D = 'Event Director events';
const tag = (t: string): Json => ({ kind: 'partyTag', tag: t });

const researcher = (id: string, t: 'legendary' | 'mythical'): Json =>
  ev(`researcher-recognizes-${id}`, 'A Researcher Recognizes Something', D, { rarity: 'rare', minStage: 3, requires: [tag(t)], cast: ['trainer.psychic_m'], effect: 'glint', tint: '#1d2a3a' },
    `A researcher stops dead and stares at your party. One of your Pokémon is a ${t} form she has only read about. "Please," she says. "Let me record it."`, [
      ch('Let her study it (safe)', out('She studies it carefully and funds a permanent research unlock.', rp(60), $(800))),
      ch('Refuse', fight('"Then I will have to see it fight!" She sends out her own team.', trainer('Researcher', { size: 3, lv: 2, win: [any(...TREASURE), rp(25)] }))),
      ch('Negotiate (Intelligence)', out('You strike a better deal: research, and a stronger reward draft.', rp(30), better(1)), { check: 'intelligence', fail: out('She sees through the bluff and leaves in a huff.') }),
    ]);

export const DIRECTOR_EVENTS: Json[] = [
  researcher('legendary', 'legendary'),
  researcher('mythical', 'mythical'),
  ev('old-rival-old-friend', 'An Old Face on the Road', D, { rarity: 'uncommon', minStage: 2, requires: [{ kind: 'rivalMet', atLeast: 2 }], cast: [], effect: 'glint', tint: '#2a2038' },
    'Someone you have fought more than once is sitting on a fence by the road, waiting. "Not a battle today. I want to see how far you have come."', [
      ch('Train together (safe)', out('You swap training tips. Your team grows.', lv(1, 'party'), fr(5, 'party'))),
      ch('Friendly match', fight('"Right then. No holding back!"', trainer('Old Rival', { size: 3, lv: 1, win: [$(900), any(...TREASURE)] }))),
      ch('Walk on', leave()),
    ]),
  ev('quiet-bond', 'Two Who Understand Each Other', D, { rarity: 'uncommon', minStage: 2, requires: [{ kind: 'bond' }], cast: [], effect: 'hearts', tint: '#2a2a1d' },
    'Two of your Pokémon have drifted away from the group and sit together, watching the sunset without a word.', [
      ch('Sit with them', out('The whole team feels closer for it.', fr(12, 'party'), heal(0.3), good(3))),
      ch('Leave them be', out('Some things are better unobserved. They return refreshed.', fr(6, 'party'))),
    ]),
  ev('mystery-region-signal', 'A Signal From the Unknown', D, { rarity: 'uncommon', minStage: 2, requires: [{ kind: 'focus', focus: 'mystery' }], cast: [], effect: 'fog', tint: '#1a2a2a' },
    'A strange signal pulses from somewhere off the road. This region keeps its secrets, and this is one of them.', [
      ch('Follow it (risky)', out('You find a hidden cache and a record of something very old.', rp(40), any(...TREASURE)), { chance: 0.5, fail: out('Nothing. Only static, and the feeling of being watched.') }),
      ch('Record it and move on', out('You note the frequency for later study.', rp(10))),
      ch('Trade a map for answers', out('A passing scholar explains and rewards your map.', rp(25), better(0)), { requires: [has('town-map')] }),
    ]),
];
