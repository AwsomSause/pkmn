// Master Expansion Catalog part C/F: Pokémon rescue events (#31, no punishment for declining),
// territorial warnings (#30) and one ecological chain (#32, #65, #66): clue -> choice -> consequence -> callback.
// Chains use `requires: eventSeen`, so a later link only appears if the earlier one really happened this run.

import { $, ch, ev, fight, fr, good, item, join, leave, out, rp, hurt, wild, type Json, any, BERRIES } from './dsl.ts';

const W = 'Wild Pokémon scenes';
const seen = (id: string): Json => ({ kind: 'eventSeen', id });

export const WILD_EVENTS: Json[] = [
  ev('trapped-pokemon', 'Trapped in the Vines', W, { rarity: 'uncommon', effect: 'shake', tint: '#183018' }, 'A Pokémon is tangled in thick vines and cries out weakly.', [
    ch('Cut it free', out('It nuzzles your hand and follows you for a while.', fr(5), good(2), join({ lv: -2 })), { check: 'intelligence', fail: out('The vines are too tight. You free it, but it flees at once.', fr(2)) }),
    ch('Call for help', out('A passing ranger frees it and thanks you.', rp(10), good(1))),
    ch('Walk on', leave('You decide not to stop. Nothing happens.')),
  ]),
  ev('injured-wild-pokemon', 'An Injured Pokémon', W, { rarity: 'common', effect: 'float', tint: '#201820' }, 'A hurt wild Pokémon lies beside the path, breathing hard.', [
    ch('Treat its wounds', out('It recovers, leaves a berry at your feet and vanishes into the grass.', any(...BERRIES), fr(3), good(2))),
    ch('Study it from a distance', out('You take careful notes.', rp(8))),
    ch('Leave it to rest', leave('It watches you go. You feel fine about it.')),
  ]),
  ev('territorial-warning', 'Claw Marks and Broken Branches', W, { rarity: 'uncommon', minStage: 2, effect: 'fog', tint: '#281810' }, 'Deep claw marks score the trees and the grass is flattened. Something big claims this ground.', [
    ch('Take the long way around', out('The detour costs you time but nothing else.', hurt(0.05))),
    ch('Scout the area', out('You learn its habits and avoid it, and note the signs.', rp(12))),
    ch('Face it', fight('A territorial Pokémon charges out of the brush!', wild({ lv: 3, shiny: 2, win: [item('rare-candy')] }))),
  ]),
  // ---- chain: disturbed habitat -> poacher camp -> habitat restored ----
  ev('disturbed-habitat', 'A Disturbed Habitat', W, { rarity: 'uncommon', minStage: 2, effect: 'fog', tint: '#201810' }, 'Nests lie overturned and wild Pokémon keep their distance. Someone has been here.', [
    ch('Look for tracks', out('Fresh boot prints lead off through the trees. You note them down.', rp(8))),
    ch('Leave it', leave('You walk on. The forest stays quiet.')),
  ]),
  ev('poacher-hideout', 'The Poacher Camp', W, { rarity: 'uncommon', minStage: 2, requires: [seen('disturbed-habitat')], effect: 'flicker', tint: '#181010' }, 'The tracks end at a hidden camp. Cages of frightened Pokémon sit beside a smouldering fire.', [
    ch('Free the Pokémon quietly', out('The cages open. One of the Pokémon stays by your side.', good(3), join({ lv: -1 })), { check: 'speed', fail: fight('A guard spots you!', wild({ lv: 2 })) }),
    ch('Challenge the poachers', fight('The poachers send out a savage Pokémon.', wild({ lv: 3, win: [$(400), item('rare-candy')] }), good(2))),
    ch('Report it and leave', out('A ranger team arrives later and thanks you.', rp(10))),
  ]),
  ev('habitat-restored', 'The Habitat Recovers', W, { rarity: 'rare', minStage: 3, requires: [seen('poacher-hideout')], effect: 'hearts', tint: '#183020' }, 'The grove you helped is alive again. The Pokémon here remember you.', [
    ch('Walk through', fight('A rare Pokémon steps out of the grove, calm and curious.', wild({ lv: 2, shiny: 3 }), fr(3))),
    ch('Rest by the water', out('The Pokémon bring you berries and keep you company.', any(...BERRIES), fr(5), good(1))),
  ]),
];
