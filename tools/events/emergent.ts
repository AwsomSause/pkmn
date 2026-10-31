// Emergent events and personal stories (APPROVED.md §4). Kindness and choices come back later as
// follow-up scenes (`callback: true`: a stop on the first later stage whose `requires` hold), and
// small chains play out over several stages with story flags.
// The two rival items of §4 (Rival Photo Op) belong to the rival work.

import { $, any, ch, cure, egg, ev, fight, flag, flagIs, fr, good, has, heal, hurt, item, join, leave, lose, out, ptype, reveal, room, rp, scout, trainer, wild, type Json, BERRIES, SNACKS, TREASURE, VITAMINS, HELD } from './dsl.ts';

const G = 'Emergent Stories';
const RARE_PRIZE = ['leftovers', 'focus-sash', 'choice-band', 'choice-specs', 'life-orb', 'eviolite', 'rocky-helmet'];

export const EMERGENT_EVENTS: Json[] = [
  // ---------- Starving Wild Pokémon Returns the Favor ----------
  ev('starving-wild', 'A Starving Poochyena', G, { rarity: 'uncommon', minStage: 2, pokemon: 'poochyena', effect: 'none', tint: '#2a2420' },
    'A thin Poochyena sits by the road, watching your bag. It does not growl. It is too tired.', [
      ch('Feed it a berry', out('It eats slowly, then presses against your leg. It will not forget this.', lose('oran-berry'), flag('fed-wild'), fr(4, 'party'), good(2)), { requires: [has('oran-berry')] }),
      ch('Help it find food', out('Together you turn up a nest of berries. It leaves one at your feet.', flag('fed-wild'), any(...BERRIES), good(1)), { check: 'intelligence', fail: out('You find nothing, and it limps away.', hurt(0.05)) }),
      ch('Catch it', fight('It is weak, but it will fight.', wild({ species: ['poochyena'], lv: 0, win: [rp(15)] }))),
      ch('Walk on', leave('You walk on. It watches you go.')),
    ]),
  ev('starving-wild-returns', 'The Poochyena Returns', G, { rarity: 'rare', minStage: 3, callback: true, requires: [flagIs('fed-wild', 1, 1)], pokemon: 'mightyena', effect: 'glint', tint: '#2a1d1d' },
    'A raider has cornered you at a bad moment. Then a growl, and a Mightyena in full health lands in front of you. It is the Poochyena you fed.', [
      ch('Fight beside it', fight('It knows exactly who to bite.', trainer('Ambush Raider', { size: 2, lv: 2, ally: 'mightyena', win: [heal(0.5), rp(40), flag('fed-wild')] })), flag('fed-wild-paid')),
      ch('Greet your old friend', out('It leans into you. When it leaves, it leaves a gift behind.', any(...SNACKS, ...HELD), fr(5, 'party'), good(1), flag('fed-wild-paid'))),
      ch('Invite it along', out('It looks at the road, then at you. It joins the team.', join({ species: ['mightyena'], lv: 2 }), flag('fed-wild-paid'))),
    ]),

  // ---------- Orphaned Pokémon Egg Cradle: three stages of care ----------
  ev('egg-cradle-find', 'An Abandoned Egg', G, { rarity: 'uncommon', minStage: 2, effect: 'sparkle', tint: '#30281c' },
    'A single egg sits in a hollow of moss. No nest, no parent, no tracks. It is cold.', [
      ch('Carry it carefully', out('You wrap it in your jacket. It is going to be a long way to anywhere.', egg({ species: ['togepi', 'pichu', 'cleffa', 'igglybuff', 'elekid', 'magby', 'smoochum', 'azurill'], left: 3, unit: 'stage' }), flag('cradle'), good(1))),
      ch('Leave it a warm spot', out('You tuck it into moss and leave a berry.', lose('oran-berry'), good(2), rp(10)), { requires: [has('oran-berry')] }),
      ch('Walk on', leave('You cannot carry everything. You walk on.')),
    ]),
  ev('egg-cradle-night', 'A Cold Night With the Egg', G, { rarity: 'uncommon', minStage: 2, callback: true, requires: [flagIs('cradle', 1, 1)], effect: 'fog', tint: '#16202c' },
    'The egg ticks against your side in the dark. The night is colder than you planned for.', [
      ch('Keep it by the fire', out('It warms through. Something inside answers your hand.', flag('cradle'), fr(5, 'party'))),
      ch('Have a Pokémon warm it', out('Your Pokémon curls around it until morning. They are closer for it.', flag('cradle'), fr(8, 'party')), { requires: [ptype('fire')] }),
      ch('Hurry on through the cold', out('You make good time, but the egg is quiet.', flag('cradle')), { chance: 0.5, fail: out('The egg went cold. It is slower to hatch now.', flag('cradle'), hurt(0.05)) }),
    ]),
  ev('egg-cradle-hatch', 'The Egg Cracks', G, { rarity: 'rare', minStage: 3, callback: true, requires: [flagIs('cradle', 2, 99)], effect: 'sparkle', tint: '#30301c' },
    'A crack runs down the shell. Whatever is inside has decided it is time.', [
      ch('Hold it as it hatches', out('A baby Pokémon blinks up at you, sure that you are family.', join({ species: ['togepi', 'pichu', 'cleffa', 'igglybuff', 'elekid', 'magby', 'smoochum', 'azurill'], lv: 1 }), fr(10, 'party'), flag('cradle-done'), rp(40))),
      ch('Take it to a safe place', out('It hatches somewhere green and quiet. It leaves you a keepsake.', any(...TREASURE), flag('cradle-done'), good(3), rp(30))),
    ]),

  // ---------- Mudslide Rescue ----------
  ev('mudslide-rescue', 'Mudslide Rescue', G, { rarity: 'uncommon', minStage: 2, types: ['ground', 'rock'], effect: 'rattle', tint: '#2a2218' },
    'The hillside came down in the night. Cries come from under a heap of mud and rock.', [
      ch('Dig them out', out('Your Pokémon dig until the mud gives way. Three tired Pokémon crawl out, thanking you.', flag('mudslide-saved'), fr(3, 'party'), good(2), rp(25)), { requires: [ptype('ground')] }),
      ch('Shift the rock', out('A Fighting-type shoulders the biggest slab. The rest is easy.', flag('mudslide-saved'), fr(3, 'party'), good(2), rp(25)), { requires: [ptype('fighting')] }),
      ch('Dig by hand (risky)', out('You pull everyone out, scraped but safe.', flag('mudslide-saved'), good(3), rp(30)), { check: 'strength', fail: out('The slope shifts again. Everyone is bruised, but you got them out.', hurt(0.15), flag('mudslide-saved'), good(1)) }),
      ch('Move on', leave('You cannot dig. It sits with you for a while.')),
    ]),
  ev('mudslide-thanks', 'Thanks From the Hillside', G, { rarity: 'uncommon', minStage: 3, callback: true, requires: [flagIs('mudslide-saved')], effect: 'sparkle', tint: '#242a1c' },
    'The Pokémon you pulled from the mudslide are waiting at the next bend. They have not forgotten.', [
      ch('Accept their gift', out('They have been busy digging for you.', any(...TREASURE), rp(20), flag('mudslide-thanked'))),
      ch('Ask what they know', out('They tell you about a way through the next stretch.', scout(6), flag('mudslide-thanked'))),
      ch('Invite the youngest along', out('The smallest one steps forward.', join({ species: ['diglett', 'geodude', 'sandshrew', 'onix', 'trapinch', 'drilbur'], lv: 1 }), flag('mudslide-thanked'))),
    ]),

  // ---------- Lost Expedition Camp ----------
  ev('lost-expedition-camp', 'Lost Expedition Camp', G, { rarity: 'uncommon', minStage: 2, effect: 'fog', tint: '#24201a' },
    'Torn tents, a cold fire and a leather journal weighed down with a stone. The explorers who made this camp did not pack up.', [
      ch('Read the journal', out('The last pages mark a cache the explorers never reached. A path leads there.', rp(35), scout(4), room('lost-expedition-cache'), flag('journal-read'))),
      ch('Search the supplies', out('Most is rotted, but the climbing gear is good.', any(...VITAMINS, ...HELD), $(250))),
      ch('Rest in the camp', out('You sleep under their canvas. In the morning you leave it neater than you found it.', heal(0.4), cure(), good(1))),
      ch('Leave it as you found it', leave('Some places should be left alone.')),
    ]),
  ev('lost-expedition-cache', 'The Explorers\' Cache', G, { rarity: 'rare', minStage: 2, effect: 'glint', tint: '#2a2410' },
    'Behind a boulder the journal named: a sealed crate and a drawing of a Pokémon you do not know.', [
      ch('Open the crate', out('Their last finds. Whoever they were, they were thorough.', any(...TREASURE), any(...HELD), rp(60))),
      ch('Bring the drawing to a researcher', out('The drawing is worth more than what is in the crate.', rp(120), good(2))),
    ]),

  // ---------- Ghost Trainer Reunion ----------
  ev('ghost-trainer-reunion', 'Ghost Trainer Reunion', G, { rarity: 'rare', minStage: 4, requires: [{ kind: 'retiredGhost' }], effect: 'fog', cast: ['trainer.hex_maniac'], tint: '#14141f' },
    'A trainer stands at the edge of the road. You know the team at their side: it is the team from an earlier run that did not make it.', [
      ch('Take the rematch', fight('"One more time," they say, and smile.', trainer('Ghost Trainer', { retired: true, size: 3, lv: 1, win: [rp(80), any(...RARE_PRIZE), good(1)] }))),
      ch('Talk with them', out('They tell you where they went wrong. It is the nicest thing a ghost has ever said to you.', rp(50), fr(4, 'party'), good(2))),
      ch('Say goodbye', out('They tip their cap. The road is empty when you look up.', rp(30), good(1))),
    ]),

  // ---------- Abandoned Nest ----------
  ev('abandoned-nest', 'An Unattended Nest', G, { rarity: 'uncommon', minStage: 2, effect: 'none', tint: '#2a2a1c' },
    'A big nest in the branches, left alone. An egg in it. The parent could be anywhere.', [
      ch('Take the egg', out('You slip it into your bag. Somewhere above, wings turn toward you.', egg({ types: ['flying', 'normal'], left: 2, unit: 'stage' }), flag('nest-robbed'), rp(10))),
      ch('Take only a feather', out('A single fine feather. The nest stays whole.', item('rare-bone'), rp(10))),
      ch('Guard it until the parent returns', out('A giant shadow returns at dusk. It looks at you and leaves a gift.', any(...TREASURE), fr(4, 'party'), good(2)), { check: 'luck', fail: out('The parent returns, sees you at the nest and attacks.', hurt(0.1)) }),
      ch('Leave it', leave('You leave it undisturbed.')),
    ]),
  ev('abandoned-nest-pursuit', 'Wings Over the Road', G, { rarity: 'rare', minStage: 3, callback: true, requires: [flagIs('nest-robbed')], effect: 'fog', tint: '#301c1c' },
    'The parent has been following you for a stage. It lands in front of you, wings out, furious.', [
      ch('Return the egg', out('It takes the egg back in its beak. It does not forgive, but it does not attack.', flag('nest-calmed'), good(2), rp(30))),
      ch('Stand and fight', fight('It comes in low.', wild({ types: ['flying'], lv: 4, win: [rp(70), any(...RARE_PRIZE)] }))),
    ]),

  // ---------- Mysterious Traveler's Map ----------
  ev('traveler-map', 'The Traveler\'s Map', G, { rarity: 'rare', minStage: 3, cast: ['trainer.backpacker'], effect: 'glint', tint: '#1c2430' },
    'A traveler spreads a map on a rock. One route has no name, just a ring of ink and a smudge where the notes should be.', [
      ch('Follow the unmarked route', out('The map is half right. You find the grotto it hides, and the rest of the stage opens up.', scout(5), room('traveler-grotto'))),
      ch('Buy a copy (₽300)', out('A good copy. You can see further ahead from here.', $(-300), scout(6), rp(15)), { requires: [{ kind: 'money', atLeast: 300 }] }),
      ch('Trade a story for it', out('She likes the story. She gives you half the map.', scout(3), rp(15)), { check: 'charisma', fail: out('She does not like it, and keeps the map.') }),
      ch('Decline', leave('You thank her and walk on.')),
    ]),
  ev('traveler-grotto', 'The Grotto on the Map', G, { rarity: 'rare', minStage: 3, effect: 'glint', tint: '#14242c' },
    'The ring of ink on the map was a grotto. The air inside smells of salt, and something glows in the back.', [
      ch('Follow the glow', fight('A Pokémon that has not seen anyone in years.', wild({ types: ['water', 'ice', 'psychic'], lv: 3, shiny: 4, win: [rp(60), any(...TREASURE)] }))),
      ch('Take what is on the walls', out('Old coins, set into the rock.', $(600), any(...TREASURE))),
    ]),

  // ---------- Elder Tree's Memory ----------
  ev('elder-tree-memory', 'The Elder Tree', G, { rarity: 'rare', minStage: 3, types: ['grass'], effect: 'sparkle', tint: '#1a2a1c' },
    'A tree older than the road. When you touch its bark, the leaves turn the way people turn to look at you.', [
      ch('Ask about your champions', out('The tree shows you the team that won before. It nods, as if to say you can too.', rp(80), fr(4, 'party'), good(2)), { requires: [{ kind: 'championGhost' }] }),
      ch('Ask about those who fell', out('The tree shows you the team that fell on a previous road. It hums quietly.', rp(60), fr(3, 'party')), { requires: [{ kind: 'retiredGhost' }] }),
      ch('Ask about the road ahead', out('A vision of the next stretch: you see farther than you did a moment ago.', scout(4), reveal())),
      ch('Rest under it', out('The shade is cool. Everything on your team sleeps well.', heal(0.5), cure(), fr(3, 'party'))),
    ]),

  // ---------- Third Wheel Traveling Companion (three stages) ----------
  ev('companion-meet', 'A Stranger Falls In Step', G, { rarity: 'rare', minStage: 2, cast: ['trainer.backpacker'], effect: 'none', tint: '#2a2a30' },
    'A hooded traveler is going the same way as you. They fall in step without asking, and say nothing about why.', [
      ch('Let them walk with you', out('They nod. "Three stretches. No more."', flag('companion'), fr(2, 'party'))),
      ch('Ask who they are', out('"Later."', flag('companion')), { check: 'charisma', fail: out('They say nothing, but still walk beside you.', flag('companion')) }),
      ch('Say no', leave('They shrug and take another road.')),
    ]),
  ev('companion-one', 'Walking With a Stranger', G, { rarity: 'uncommon', minStage: 2, callback: true, requires: [flagIs('companion', 1, 1)], cast: ['trainer.backpacker'], effect: 'none', tint: '#26262c' },
    'The traveler walks a step behind you. When you stop for water, they have already filled two canteens.', [
      ch('Share a meal', out('They talk a little about the road behind them.', flag('companion'), fr(3, 'party'))),
      ch('Ask them to scout', out('"I know this stretch." They go ahead and come back.', flag('companion'), scout(5))),
    ]),
  ev('companion-two', 'A Stranger Who Knows Things', G, { rarity: 'uncommon', minStage: 2, callback: true, requires: [flagIs('companion', 2, 2)], cast: ['trainer.backpacker'], effect: 'none', tint: '#22222c' },
    'The traveler stops at a fork and picks the right way without looking. "It is not my first time here."', [
      ch('Follow their lead', out('They are right. The next battle comes with a surprise.', flag('companion'), rp(30), item('rare-bone'))),
      ch('Ask what they want', out('"To see something finished." They won\'t say more.', flag('companion'))),
    ]),
  ev('companion-three', 'The Stranger Reveals Themselves', G, { rarity: 'rare', minStage: 3, callback: true, requires: [flagIs('companion', 3, 99)], effect: 'glint', tint: '#2a2038' },
    'At the last bend, the hood comes down. The traveler turns out to be someone you did not expect.', [
      ch('Hear them out', out('A guardian who watches the roads. They leave you a gift and a promise.', any(...HELD), rp(100), good(2), flag('companion-done'))),
      ch('Ask them to stay', out('They shake their head, smiling. "Not this time." They leave you a Pokémon who will.', join({ species: ['mew', 'celebi', 'jirachi', 'togepi', 'delibird', 'chansey'], lv: 0 }), flag('companion-done'))),
    ]),

  // ---------- Chimecho Wind Rest ----------
  ev('chimecho-wind-rest', 'Wind Chimes on the Ridge', G, { rarity: 'common', minStage: 1, pokemon: 'chimecho', effect: 'sparkle', tint: '#20283a' },
    'A Chimecho hangs from a dead branch, ringing in the wind. For a moment, everything in the world is quiet.', [
      ch('Sit and listen', out('The sound loosens something in each of you. Everyone feels lighter.', heal(0.35), cure(), fr(3, 'party'))),
      ch('Sing along', out('Chimecho answers in harmony. Your team is delighted.', fr(6, 'party'), good(1)), { check: 'charisma', fail: out('Chimecho flinches and flies away.', fr(1, 'party')) }),
      ch('Carry on', leave()),
    ]),

  // ---------- Ditto Impostor ----------
  ev('ditto-impostor', 'One of Us Is Not', G, { rarity: 'uncommon', minStage: 2, pokemon: 'ditto', effect: 'none', tint: '#2a2030' },
    'You count your party twice. Then again. One of them is a little too eager to be looked at, and its eyes are not quite right.', [
      ch('Call it out', out('The copy deflates into a delighted Ditto. It does a very good impression of you, then of your lead.', join({ species: ['ditto'], lv: 0 }), rp(30)), { check: 'intelligence', fail: fight('You pick wrong, and the real one gets a surprise. Then the Ditto jumps you.', wild({ species: ['ditto'], lv: 1, win: [rp(40)] })) }),
      ch('Play along', out('It is hard to tell who was fooling whom. Everyone has a good laugh.', fr(4, 'party'), good(1))),
      ch('Test it with a berry', out('A real Pokémon would eat it. The copy sneezes. Gotcha.', lose('oran-berry'), join({ species: ['ditto'], lv: 0 }), rp(20)), { requires: [has('oran-berry')] }),
    ]),

  // ---------- Boss Rematch in Disguise ----------
  ev('boss-rematch-disguise', 'A Familiar Stranger', G, { rarity: 'rare', minStage: 4, cast: ['trainer.ace_trainer_m'], effect: 'fog', tint: '#1e1e2c' },
    'A trainer in a rain poncho asks for a quick battle. They walk like someone who has done this before, and they have your stride.', [
      ch('Look for a tell first', out('Under the hood: a gym badge pin. They grin and throw back the poncho.', rp(30)), { check: 'intelligence', fail: out('Nothing gives them away.') }),
      ch('Accept the battle', fight('"I\'ve changed a few things."', trainer('Stranger in a Poncho', { boss: 'blaine', size: 4, lv: 4, win: [rp(100), $(1000), any(...HELD)] }))),
      ch('Decline politely', leave('They shrug. "Maybe next time."')),
    ]),

  // ---------- Ghost Town Visit: a small multi-room landmark ----------
  ev('ghost-town-gate', 'The Ghost Town of Hollow Vale', G, { rarity: 'rare', minStage: 3, types: ['ghost'], cast: ['trainer.hex_maniac'], effect: 'fog', tint: '#101822' },
    'The road bends through a town that is not on any map. Lights are on in every window. No one answers.', [
      ch('Walk the main street', out('Shapes pass you in the fog: shopkeepers, children, a mayor who bows. They do not see you.', room('ghost-town-market'), room('ghost-town-hall'), rp(20))),
      ch('Turn back', leave('You decide not to wake anything.')),
    ]),
  ev('ghost-town-market', 'Hollow Vale: The Market', G, { rarity: 'rare', minStage: 3, types: ['ghost'], effect: 'fog', tint: '#101822' },
    'A ghost stall keeper arranges goods that are slightly out of focus. "Do you want to trade?"', [
      ch('Buy a keepsake (₽400)', out('A thing a person left behind. It still feels warm.', $(-400), any(...HELD), item('spell-tag')), { requires: [{ kind: 'money', atLeast: 400 }] }),
      ch('Trade a memory', out('You tell them about your first battle. They remember it for you.', rp(60), good(1), fr(3, 'party'))),
      ch('Ask about the town', out('"A flood. Everyone stayed." You feel a hand on your shoulder, kind, and gone.', rp(30), flag('hollow-vale'))),
    ]),
  ev('ghost-town-hall', 'Hollow Vale: Town Hall', G, { rarity: 'rare', minStage: 3, types: ['ghost'], effect: 'fog', tint: '#0e1620' },
    'The hall is lit. A long table is set for the mayor and eleven guests. There is a chair for you.', [
      ch('Sit and dine', out('Plates of food that taste like nothing and everything. The mayor thanks you for coming.', heal(0.5), cure(), fr(5, 'party'), good(2))),
      ch('Take the mayor\'s challenge', fight('"A game of cards, or something like it."', trainer('The Ghost Mayor', { cls: 'hex-maniac', size: 3, lv: 3, types: ['ghost'], win: [rp(90), any(...HELD), flag('hollow-vale')] }))),
      ch('Read the town records', out('The records name every resident. Reading them aloud seems to settle something.', rp(70), good(3), reveal())),
    ]),

  // ---------- Team Plasma Liberation: a three-room sub-stage ----------
  ev('plasma-substage-gate', 'A Plasma Holding Camp', G, { rarity: 'rare', minStage: 3, cast: ['trainer.plasma_grunt_m'], effect: 'fog', tint: '#1a2230' },
    'Crates with air holes. A tarp that moves. Plasma grunts patrol the fence, talking about a shipment.', [
      ch('Sneak in at night', out('You cut the fence and slip inside.', room('plasma-substage-yard'))),
      ch('March in and demand they leave', out('The grunts turn. They are very surprised.', room('plasma-substage-yard'), flag('plasma-loud'))),
      ch('Leave and alert the authorities', out('You note the place, but do nothing now.', rp(20))),
    ]),
  ev('plasma-substage-yard', 'The Plasma Yard', G, { rarity: 'rare', minStage: 3, cast: ['trainer.plasma_grunt_m'], effect: 'none', tint: '#1a2230' },
    'Dozens of crates. The guards have not spotted you yet.', [
      ch('Open the crates', out('Frightened Pokémon, all of them, glad to see you. The nearest guard hears the crate lid.', room('plasma-substage-leader'), flag('plasma-freed'), good(3), rp(40))),
      ch('Fight the guards', fight('Three grunts and their Pokémon.', trainer('Plasma Guards', { cls: 'worker', size: 3, lv: 2, win: [room('plasma-substage-leader'), rp(40)] }))),
    ]),
  ev('plasma-substage-leader', 'The Plasma Handler', G, { rarity: 'rare', minStage: 3, cast: ['trainer.plasma_grunt_m'], effect: 'fog', tint: '#1a2230' },
    'The handler steps out with a Pokémon that is clearly not theirs. "Those are company property."', [
      ch('Beat the handler', fight('The handler orders their Pokémon to attack.', trainer('Plasma Handler', { cls: 'veteran', size: 4, lv: 3, win: [rp(120), $(1200), flag('plasma-won'), join({ lv: 2 })] }))),
      ch('Talk them down', out('You make an offer they cannot refuse: the Pokémon go free.', rp(90), good(3), flag('plasma-won'), join({ lv: 1 })), { check: 'charisma', fail: fight('The handler is not impressed.', trainer('Plasma Handler', { cls: 'veteran', size: 4, lv: 3, win: [rp(90), flag('plasma-won')] })) }),
    ]),

  // ---------- Christmas Eve Gift Swap (winter festival only) ----------
  ev('christmas-eve-gift-swap', 'The Gift Swap', G, { gameEvent: 'winter-festival', rarity: 'uncommon', minStage: 1, effect: 'snow', cast: ['trainer.snow_worker_m'], tint: '#0c1a2c' },
    'A figure in a long coat holds out a small wrapped box. "Give me something, and I\'ll give you something."', [
      ch('Give a berry', out('They unwrap it carefully. In return, a ribbon-tied keepsake that smells of pine.', lose('oran-berry'), any(...HELD), item('rare-bone'), good(1)), { requires: [has('oran-berry')] }),
      ch('Give a story', out('They listen with their whole face. The present is a warm scarf and a Pokémon\'s thanks.', fr(5, 'party'), rp(40), good(1))),
      ch('Open their gift first', out('A surprise: a rare candy, and a nod.', item('rare-candy'), rp(20))),
      ch('Wish them well and walk on', out('They wave. The air is warmer than it should be.', good(1), fr(2, 'party'))),
    ]),
];

