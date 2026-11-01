// Ideas W4 (map, world and run structure): set-piece map events. Traversal obstacles themselves live in
// src/data/traversal.json (core/traversal.ts); these are the stops around them: puzzles, dives, zip-lines,
// a haunted house, a toll bridge, a time rift, portals, the wandering trainer, the treasure map's dig site and
// one landmark per region with a lasting effect. Added to events.json by tools/build-world-events.ts.
// A `prompt` choice is a skill moment (core/interaction/prompt.ts): the player's grade decides it, never a roll.

import { $, any, at, ch, companion, ev, express, fight, flag, flagIs, fr, good, gym, has, heal, hurt, inRegion, item, join, leave, lose, lv, money, out, party, ptype, relic, rest, reveal, rift, room, rp, scout, season, status, stopHere, tail, trainer, wild, better, type Json, BERRIES, HELD, RARE_HELD, TREASURE, STONES, BALLS } from './dsl.ts';

const G = 'World & Traversal';
const P = 'Puzzles';
const PR = (id: string, needs: 'ok' | 'good' | 'perfect' = 'good') => ({ prompt: { id, needs } });
const WATER_FINDS = ['pearl', 'big-pearl', 'mystic-water', 'star-piece'];
const CAVE_FINDS = ['hard-stone', 'star-piece', 'nugget', 'rare-bone', 'moon-stone'];

const SET_PIECES: Json[] = [
  // I346 Tap trees to shake loose berries or wild Pokémon.
  ev('w4-berry-tree', 'A Laden Tree', G, { rarity: 'common', minStage: 1, types: ['grass', 'bug'], effect: 'shake', tint: '#1c2a14' },
    'A tree heavy with fruit leans over the path. Something rustles in the top branches.', [
      ch('Shake it gently', out('A few berries drop into your hands.', any(...BERRIES), any(...BERRIES))),
      ch('Shake it hard', out('Berries rain down, and a shiny thing falls with them!', any(...BERRIES), any(...BERRIES), any('star-piece', 'nugget', 'tinymushroom')), { chance: 0.5, fail: fight('Something falls out of the tree, and it is not happy.', wild({ types: ['bug', 'grass'], lv: 1, win: [any(...BERRIES)] })) }),
      ch('Leave it', leave()),
    ]),
  // Fairy ring room (traversal fairy-ring, I361): the hidden grove.
  ev('w4-hidden-grove', 'The Hidden Grove', G, { rarity: 'rare', minStage: 1, types: ['fairy'], effect: 'sparkle', tint: '#2a1c2a', room: true },
    'Past the ring of mushrooms the air turns warm and sweet. Tiny lights drift between flowers that should not grow here.', [
      ch('Rest among the flowers', out('Everyone wakes up healed and happy.', heal(1), fr(8))),
      ch('Follow the lights', out('A shy Fairy-type follows you back out of the grove.', join({ types: ['fairy'], lv: 1, shiny: 2 }))),
      ch('Gather the dew', out('The dew sparkles in a jar.', any('fairy-feather', 'moon-stone', 'shiny-stone'), rp(30))),
    ]),
  // I363 Zip-line rides between map nodes with timing taps.
  ev('w4-zip-line', 'The Zip-Line', G, { stop: 'detour', rarity: 'uncommon', minStage: 1, types: ['flying', 'electric'], effect: 'float', tint: '#14243a' },
    'A cable runs from this hilltop far down the valley. A harness hangs from it, waiting.', [
      ch('Ride it (let go at the right moment)', out('You let go right over the platform and land running, a whole level ahead!', express(), rp(20)), { ...PR('zip-line'), fail: out('You let go late and tumble into the bushes. Next time.', hurt(0.08)) }),
      ch('Your Flying-type carries the line', out('It glides the whole party down the cable.', express()), { requires: [ptype('flying')] }),
      ch('Walk down', leave('You take the path down like everyone else.')),
    ]),
  // I362 Rock climbing minigame with a Rock type partner.
  ev('w4-rock-climb', 'The Climbing Wall', G, { stop: 'detour', rarity: 'uncommon', minStage: 1, types: ['rock', 'fighting'], effect: 'shake', tint: '#2a2014' },
    'A cliff of good grey rock with a nest of shining stones at the top. Your Rock-type could anchor the rope.', [
      ch('Climb with your Rock-type anchoring', out('Hold after hold, all the way up. The nest is full of stones!', any(...STONES), any('hard-stone', 'star-piece'), fr(4, 'lead')), { requires: [ptype('rock')], ...PR('climb-rhythm', 'ok'), fail: out('You slip near the top. The rope holds, but you come down empty-handed.', hurt(0.06)) }),
      ch('Free climb', out('You make it, just. One stone was in reach.', any(...STONES)), { ...PR('climb-rhythm', 'perfect'), fail: out('Halfway up you think better of it.', hurt(0.04)) }),
      ch('Not today', leave()),
    ]),
  // I364 Hot-air balloon event: steer by wind icons.
  ev('w4-balloon', 'The Hot-Air Balloon', G, { stop: 'detour', rarity: 'uncommon', minStage: 1, types: ['flying', 'fire'], effect: 'float', tint: '#3a2a14' },
    'A balloonist offers you a ride. The wind flags on the basket show which way the air is moving.', [
      ch('Steer by the wind flags', out('You ride the wind right over the stage and see far ahead.', scout(4), any('pretty-wing', 'star-piece')), { ...PR('balloon-drag'), fail: out('A gust spins you round. You still see a little way ahead.', scout(1), hurt(0.05)) }),
      ch('Let the balloonist fly', out('A gentle, short ride.', scout(2), $(-200)), { requires: [money(200)] }),
      ch('Stay on the ground', leave()),
    ]),
  // I365 Raft crossing with fishing along the way.
  ev('w4-raft', 'The Raft Crossing', G, { rarity: 'uncommon', minStage: 1, types: ['water'], effect: 'rain', tint: '#102838' },
    'A raft is tied at the river bank. The current would carry you a long way, and the fish are biting.', [
      ch('Fish on the way down', out('You float down the river with a line in the water. Good spot for it.', stopHere('fish'), any(...WATER_FINDS))),
      ch('Your Water-type tows the raft', out('It pulls the raft fast downstream: a level ahead, and a fishing spot where you land.', express(), stopHere('fish')), { requires: [ptype('water')] }),
      ch('Leave the raft', leave()),
    ]),
  // I366 Campfire map light reveals nearby unseen nodes.
  ev('w4-beacon-fire', 'The Beacon Fire', G, { rarity: 'common', minStage: 1, types: ['fire'], effect: 'fire', tint: '#2a1a0c' },
    'An old beacon of stacked wood stands on a rise. Lit, it would light the whole road ahead.', [
      ch('Light it with your Fire-type', out('The beacon roars up. You can see a long way ahead now.', scout(4), fr(3, 'lead')), { requires: [ptype('fire')] }),
      ch('Light a small campfire', out('Enough light to see the next stretch, and a warm rest.', scout(2), heal(0.2))),
      ch('Walk on in the dark', leave()),
    ]),
  // I368 Campsite night watch assignments with random events.
  ev('w4-night-watch', 'Night Watch', G, { rarity: 'common', minStage: 1, types: ['dark', 'ghost'], effect: 'fog', tint: '#0c0c1c' },
    'You camp for the night. Somebody has to keep watch.', [
      ch('Your lead keeps watch', fight('Late at night, something creeps into camp. Your lead is ready.', wild({ types: ['dark', 'ghost'], lv: 1, win: [rp(20), any(...BERRIES)] }), rest())),
      ch('Take turns', out('A quiet night. Everyone sleeps well.', rest(), heal(0.5)), { chance: 0.6, fail: out('In the morning, something is missing from the bag.', rest(), lose()) }),
      ch('A Dark-type keeps watch', out('Nothing gets past it. It even caught a thief in the act.', rest(), heal(0.5), any(...HELD)), { requires: [ptype('dark')] }),
    ]),
  // I369 Footprints: follow tracks to hidden wild Pokémon.
  ev('w4-tracks', 'Fresh Tracks', G, { rarity: 'uncommon', minStage: 1, effect: 'none', tint: '#1c1c14' },
    'Big, fresh tracks lead off the path into the long grass.', [
      ch('Follow the tracks', out('The tracks go deeper. You are getting close.', room('w4-tracks-deep'), rp(10))),
      ch('Leave them', leave()),
    ]),
  ev('w4-tracks-deep', 'The End of the Tracks', G, { rarity: 'uncommon', minStage: 1, effect: 'glint', tint: '#1c1c14', room: true },
    'The tracks end at a hollow under a fallen tree. Something big is sleeping inside.', [
      ch('Wake it up', fight('It wakes up, and it is rare!', wild({ lv: 2, shiny: 3, win: [rp(30)] }))),
      ch('Sneak away', out('You leave it sleeping and take a strange feather you found by the hollow.', any('pretty-wing', 'star-piece'))),
    ]),
  // I372 Lightning rod: gather storm bonus on stormy nodes.
  ev('w4-lightning-rod', 'The Lightning Rod', G, { rarity: 'uncommon', minStage: 1, types: ['electric', 'flying'], effect: 'flicker', tint: '#1a1a2c' },
    'A tall iron rod on a hilltop. Storm clouds are gathering over it.', [
      ch('Your Electric-type rides the strike', out('The bolt hits the rod and your Pokémon soaks it up. It feels stronger!', lv(1, 'lead'), any('thunderstone', 'magnet')), { requires: [ptype('electric')] }),
      ch('Catch the storm in a jar', out('The jar crackles. Worth a lot to a collector.', $(600), rp(20)), { chance: 0.5, fail: out('The shock knocks everyone back.', status('paralysis')) }),
      ch('Get off the hill', leave()),
    ]),
  // I373 Avalanche escape sequence with swipe dodges.
  ev('w4-avalanche', 'Avalanche!', G, { rarity: 'uncommon', minStage: 2, types: ['ice', 'rock'], effect: 'snow', tint: '#1c2a3a' },
    'A rumble from above. The whole slope is coming down!', [
      ch('Dodge the falling snow', out('You dodge at the last second, and the slide uncovers something.', any('nevermeltice', 'icy-rock', 'star-piece'), rp(20)), { ...PR('dodge-tap'), fail: out('The snow catches the party.', hurt(0.15)) }),
      ch('Your Ice-type holds the snow back', out('It freezes the slope solid. Everyone walks on safely.', any('nevermeltice', 'icy-rock')), { requires: [ptype('ice')] }),
      ch('Run for it', out('You get clear, but not cleanly.', hurt(0.08))),
    ]),
  // I374 Tide pools reveal items only at low tide.
  ev('w4-low-tide', 'The Tide Pools', G, { rarity: 'common', minStage: 1, types: ['water'], effect: 'rain', tint: '#102030' },
    'Rock pools along the shore. The tide is out in the mornings, and then the pools are full of treasure.', [
      ch('Search the pools (low tide)', out('Shells, pearls and a stranded Pokémon you help back to the sea.', any(...WATER_FINDS), any(...WATER_FINDS), fr(3)), { requires: [at('morning')] }),
      ch('Camp until low tide', out('You sleep by the shore. In the morning the pools are open, and you find one pearl before you go.', rest(), any('pearl', 'big-pearl'))),
      ch('Move on', leave()),
    ]),
  // I376 Seasonal events change terrain (flooded, frozen).
  ev('w4-spring-flood', 'The Flooded Meadow', G, { rarity: 'common', minStage: 1, requires: [season('Spring')], types: ['water', 'grass'], effect: 'rain', tint: '#14283a' },
    'The spring melt has turned the meadow into a shallow lake. Flowers poke up through the water.', [
      ch('Your Water-type swims you across', out('Easy. You find things the flood washed up.', any('damp-rock', 'miracle-seed', 'mystic-water'), rp(10)), { requires: [ptype('water')] }),
      ch('Wade it', out('Wet, muddy and slow.', hurt(0.06))),
    ]),
  ev('w4-winter-lake', 'The Frozen Lake', G, { rarity: 'common', minStage: 1, requires: [season('Winter')], types: ['ice'], effect: 'snow', tint: '#1c2a3a' },
    'Winter has frozen the lake hard. Across the ice is a shortcut.', [
      ch('Skate across', out('You slide all the way over, a level ahead!', express()), { chance: 0.6, fail: out('The ice cracks and you scramble back.', hurt(0.08)) }),
      ch('Your Ice-type thickens the ice', out('Safe as a road. A level ahead.', express(), any('nevermeltice', 'icy-rock')), { requires: [ptype('ice')] }),
      ch('Walk round', leave()),
    ]),
  // I378 Mirror mazes with Psychic guidance.
  ev('w4-mirror-maze', 'The Mirror Maze', P, { rarity: 'uncommon', minStage: 2, types: ['psychic', 'fairy'], effect: 'glint', tint: '#2a2a3a' },
    'A maze of mirrors. Every way looks like every other way.', [
      ch('Your Psychic-type guides you', out('It walks straight through as if the mirrors were not there. At the centre: a prize.', any(...HELD), rp(30), scout(2)), { requires: [ptype('psychic')] }),
      ch('Find your own way', out('You find the centre and its prize.', any(...HELD)), { check: 'intelligence', fail: out('You walk into mirror after mirror and leave with a headache.', hurt(0.06)) }),
      ch('Not today', leave()),
    ]),
  // I379 Haunted house room-by-room exploration with jump scares.
  ev('w4-haunted-manor', 'The Haunted Manor', G, { rarity: 'uncommon', minStage: 2, types: ['ghost', 'dark'], effect: 'flicker', tint: '#140c1c', cast: ['trainer.hex_maniac'] },
    'The door of the old manor swings open by itself. Room after room, all dark.', [
      ch('Go in', out('The door slams shut behind you.', room('w4-haunted-hall'))),
      ch('Not a chance', leave()),
    ]),
  ev('w4-haunted-hall', 'The Haunted Manor: the Hall', G, { rarity: 'uncommon', minStage: 2, types: ['ghost'], effect: 'flicker', tint: '#140c1c', room: true },
    'Portraits line the hall. Their eyes follow you. Then one of them screams!', [
      ch('Hold your nerve', out('You do not flinch. The portrait looks almost disappointed. On to the next room.', room('w4-haunted-attic'), rp(15)), { ...PR('brace-hold', 'ok'), fail: out('Everyone runs out of the manor screaming.', fr(-2), hurt(0.05)) }),
      ch('Your Ghost-type talks to the portrait', out('They chat like old friends. The portrait points the way up.', room('w4-haunted-attic'), rp(20)), { requires: [ptype('ghost')] }),
      ch('Run out', leave('You run out, and nobody blames you.')),
    ]),
  ev('w4-haunted-attic', 'The Haunted Manor: the Attic', G, { rarity: 'uncommon', minStage: 2, types: ['ghost'], effect: 'fog', tint: '#140c1c', room: true },
    'In the attic, a chest, and something sitting on it, waiting for you.', [
      ch('Face it', fight('The ghost of the manor attacks!', wild({ types: ['ghost'], lv: 3, win: [any('spell-tag', 'reaper-cloth', 'dusk-stone'), any(...TREASURE), rp(40)] }))),
      ch('Ask nicely for the chest', out('It shrugs and floats away. The chest is full.', any(...TREASURE), good(2)), { check: 'charisma', fail: out('It does not like being asked. You leave fast.', hurt(0.08)) }),
    ]),
  // I380 Bridge toll: pay with item, battle or favor.
  ev('w4-toll-bridge', 'The Toll Bridge', G, { rarity: 'common', minStage: 1, effect: 'none', tint: '#2a2014', cast: ['trainer.roughneck'] },
    'A rope bridge over a gorge, and a big trainer on it with a sign: TOLL.', [
      ch('Pay ₽500', out('He waves you over. The far side has a good view of the road ahead.', $(-500), scout(2)), { requires: [money(500)] }),
      ch('Pay with an item', out('He takes something from your bag and lets you cross.', lose(), scout(2))),
      ch('Battle for the bridge', fight('"Beat me and it\'s free."', trainer('Bridge Keeper', { cls: 'roughneck', size: 2, lv: 1, win: [scout(2), $(400)] }))),
      ch('Do him a favor', out('You carry his supplies across. He lets you keep a tip.', hurt(0.08), rp(15), good(2), scout(2))),
    ]),
  // I386 Quicksand rescue: team pulls someone out together.
  ev('w4-quicksand', 'Quicksand!', G, { rarity: 'common', minStage: 1, types: ['ground'], effect: 'shake', tint: '#2a2010' },
    'A hiker is sinking in quicksand, shouting for help!', [
      ch('Everyone pull together', out('The whole team pulls, and out he comes! He gives you everything in his pockets.', any(...TREASURE), fr(5), good(3)), { requires: [party(3)], ...PR('pull-hold', 'ok'), fail: out('He slips back in. You get him out in the end, but everyone is worn out.', hurt(0.1), good(2)) }),
      ch('Your Grass-type throws a vine', out('He climbs out along the vine.', any(...BERRIES), good(3)), { requires: [ptype('grass')] }),
      ch('Run for help', out('You find some rope and pull him out. He thanks you.', good(1))),
    ]),
  // I388 Cave echo: shout to reveal hidden chambers.
  ev('w4-cave-echo', 'The Echoing Cave', G, { rarity: 'uncommon', minStage: 1, types: ['rock', 'ground'], effect: 'shake', tint: '#1c1814' },
    'Every sound in this cave comes back to you, twice. Somewhere the echo sounds different, as if there is a room behind the rock.', [
      ch('Shout in rhythm and listen', out('You find the hollow wall. Behind it: a hidden chamber!', room('w4-echo-chamber')), { ...PR('echo-rhythm'), fail: fight('Your shouting wakes up the cave.', wild({ types: ['poison', 'flying'], lv: 1 })) }),
      ch('Walk on quietly', leave()),
    ]),
  ev('w4-echo-chamber', 'The Hidden Chamber', G, { rarity: 'uncommon', minStage: 1, types: ['rock'], effect: 'glint', tint: '#1c1814', room: true },
    'A sealed room of crystal. Nobody has stood here in a very long time.', [
      ch('Take the crystals', out('Beautiful, and worth a fortune.', any(...CAVE_FINDS), any(...CAVE_FINDS), rp(30))),
      ch('Wake the guardian', fight('A Rock-type older than the cave steps out.', wild({ types: ['rock'], lv: 3, shiny: 2, win: [any(...STONES)] }))),
    ]),
  // I389 Underwater diving interludes with oxygen meter (the meter is a story flag: each dive spends a breath).
  ev('w4-dive', 'The Diving Spot', G, { rarity: 'uncommon', minStage: 1, types: ['water'], effect: 'rain', tint: '#0c1c30' },
    'Clear deep water, and a wreck far below. You can hold your breath for a while. A Water-type could help.', [
      ch('Dive with a Water-type', out('It carries extra air for you. Oxygen: 4.', flag('oxygen', -99), flag('oxygen', 4), room('w4-dive-1')), { requires: [ptype('water')] }),
      ch('Dive alone', out('One deep breath. Oxygen: 2.', flag('oxygen', -99), flag('oxygen', 2), room('w4-dive-1'))),
      ch('Stay dry', leave()),
    ]),
  ev('w4-dive-1', 'Under the Water', G, { rarity: 'uncommon', minStage: 1, types: ['water'], effect: 'rain', tint: '#0c1c30', room: true },
    'Shells and pearls on the sand, and the dark shape of the wreck below.', [
      ch('Go deeper (1 oxygen)', out('Down to the wreck.', flag('oxygen', -1), any(...WATER_FINDS), room('w4-dive-2')), { requires: [flagIs('oxygen', 2)] }),
      ch('Hold your breath and push on', out('You make it down on one breath.', any(...WATER_FINDS), room('w4-dive-2')), { ...PR('dive-hold'), fail: out('You surface gasping with a handful of shells.', any('pearl'), hurt(0.05)) }),
      ch('Surface', out('You come up with a pearl.', any('pearl', 'big-pearl'))),
    ]),
  ev('w4-dive-2', 'The Wreck', G, { rarity: 'uncommon', minStage: 1, types: ['water', 'ghost'], effect: 'fog', tint: '#081428', room: true },
    'Inside the wreck, a captain\'s chest, and something guarding it in the dark.', [
      ch('Open the chest (1 oxygen)', out('Gold and old treasure!', flag('oxygen', -1), any(...TREASURE), any(...RARE_HELD), rp(40)), { requires: [flagIs('oxygen', 1)] }),
      ch('Fight the guardian', fight('It comes at you out of the dark!', wild({ types: ['water', 'ghost'], lv: 2, win: [any(...TREASURE), rp(30)] }))),
      ch('Surface now', out('You are out of air. You kick for the surface.', hurt(0.05))),
    ]),
  // I391 Abandoned lab terminals to hack with logic puzzles.
  ev('w4-lab-terminal', 'The Old Lab Terminal', P, { rarity: 'uncommon', minStage: 2, types: ['electric', 'steel'], effect: 'flicker', tint: '#0c1c1c', cast: ['trainer.worker_m'] },
    'An abandoned lab. One terminal still glows: "PASSWORD: the next number. 3, 6, 12, 24, ?"', [
      ch('Type 48', out('ACCESS GRANTED. A locker clicks open.', any('up-grade', 'dubious-disc', 'magnet', 'electirizer'), rp(40))),
      ch('Type 36', fight('ACCESS DENIED. A security Pokémon wakes up.', wild({ types: ['electric', 'steel'], lv: 2 }))),
      ch('Your Electric-type hacks it', out('A jolt in the right place, and everything opens.', any('up-grade', 'dubious-disc', 'magnet'), rp(30)), { requires: [ptype('electric')] }),
      ch('Leave', leave()),
    ]),
  // I392 Arcade cabinets at hidden nodes.
  ev('w4-arcade-cabinet', 'A Forgotten Arcade Cabinet', G, { rarity: 'rare', minStage: 1, effect: 'glint', tint: '#2a1438', secret: [{ kind: 'attribute', key: 'luck', atLeast: 10 }] },
    'Behind a shed, an old arcade cabinet still runs. "INSERT ₽100".', [
      ch('Play for the high score', out('NEW HIGH SCORE! The cabinet pays out tickets for a prize.', any(...HELD), rp(20)), { ...PR('throw-ring'), fail: out('GAME OVER. You walk away humming the music.', $(-100)) }),
      ch('Walk away', leave()),
    ]),
  // I393 Graffiti walls: paint to unlock hint arrows.
  ev('w4-graffiti-wall', 'The Graffiti Wall', G, { rarity: 'common', minStage: 1, effect: 'none', tint: '#2a1c2a' },
    'A wall covered in painted arrows and tags. Some arrows point to things the map does not show.', [
      ch('Paint your own arrows', out('You paint the way ahead, and see it clearer.', scout(2), reveal())),
      ch('Read the old tags', out('One tag is a gym trainer\'s team, written out in full.', gym())),
      ch('Leave a tag for the next trainer', out('Somebody will smile at it one day.', good(1), rp(10))),
    ]),
  // I394 Gravity wells in space-themed Ultra Space nodes.
  ev('w4-gravity-well', 'The Gravity Well', G, { rarity: 'rare', minStage: 3, types: ['psychic', 'steel', 'dark'], effect: 'spin', tint: '#0c0c24' },
    'A rip in the air. Stones float round it, pulled in slow circles. Beyond it you can see stars in the daytime: Ultra Space.', [
      ch('Slingshot round it', out('The well flings you far down the road, a level ahead.', express(), hurt(0.05))),
      ch('Fight what fell through', fight('Something strange came through the rip, heavy and fast.', wild({ types: ['psychic', 'steel'], lv: 3, shiny: 2, win: [any(...RARE_HELD), rp(40)] }))),
      ch('Study it', out('Your notes are worth a lot to the lab.', rp(50))),
    ]),
  // I395 Time-rift nodes alter seeds to preview alternate outcomes.
  ev('w4-time-rift', 'The Time Rift', G, { rarity: 'rare', minStage: 2, types: ['psychic', 'dragon'], effect: 'spin', tint: '#1c0c2c' },
    'A shimmer in the road. Through it you see the road ahead, with every battle already happening.', [
      ch('Look through the rift', out('You see who waits at the next stops, for the rest of this stage.', rift(), rp(20))),
      ch('Step through', out('You come out somewhere better, with a better choice of reward.', better(1), scout(3)), { chance: 0.5, fail: out('The rift spits you back out, dizzy.', hurt(0.08)) }),
      ch('Leave it alone', leave()),
    ]),
  // I396 Portal puzzle switches lead to warp nodes.
  ev('w4-portal-switches', 'The Portal Switches', P, { rarity: 'uncommon', minStage: 2, types: ['psychic'], effect: 'spin', tint: '#1c1c2c' },
    'Three switches and a dead portal. A plaque: "Sky before sea, and sea before stone."', [
      ch('Sky, sea, stone', out('The portal hums open and warps you a level ahead!', express(), reveal(), rp(20))),
      ch('Stone, sea, sky', out('The portal sputters and spits out some junk.', any('stardust'))),
      ch('Sea, sky, stone', fight('The portal opens the wrong way, and something comes through.', wild({ types: ['psychic'], lv: 1 }))),
    ]),
  // I371 Sundial puzzle at ruins.
  ev('w4-sundial', 'The Sundial Ruins', P, { rarity: 'uncommon', minStage: 1, types: ['rock', 'psychic'], effect: 'glint', tint: '#2a2414' },
    'An old sundial in the ruins, its arm loose. Carved round it: "Turn me to where my shadow is shortest, and I will open."', [
      ch('Turn it to noon', out('Stone grinds on stone. A hidden drawer slides out.', any(...TREASURE), any('sun-stone', 'heat-rock'), rp(30))),
      ch('Turn it to dawn', out('Nothing happens.')),
      ch('Turn it to dusk', out('The ground shakes a little, then nothing.', hurt(0.04))),
    ]),
  // I377 Ruins pressure plates: step in correct order.
  ev('w4-pressure-plates', 'The Plate Room', P, { rarity: 'uncommon', minStage: 2, types: ['rock', 'ground'], effect: 'shake', tint: '#2a2014' },
    'Three stone plates: a sun, a moon and a star. A mural over them shows the sky through one night: the sun goes down, the moon comes up, then the stars come out.', [
      ch('Step on the sun', out('Click. The sun plate stays down.', room('w4-plates-2'))),
      ch('Step on the moon', out('A dart shoots out of the wall!', hurt(0.06))),
      ch('Step on the star', out('A dart shoots out of the wall!', hurt(0.06))),
    ]),
  ev('w4-plates-2', 'The Plate Room: Second Plate', P, { rarity: 'uncommon', minStage: 2, types: ['rock'], effect: 'shake', tint: '#2a2014', room: true },
    'The sun plate is down. Two plates left: the moon and the star.', [
      ch('Step on the moon', out('Click. The moon plate goes down.', room('w4-plates-3'))),
      ch('Step on the star', out('The floor drops and you climb out bruised.', hurt(0.1))),
    ]),
  ev('w4-plates-3', 'The Plate Room: Last Plate', P, { rarity: 'uncommon', minStage: 2, types: ['rock'], effect: 'glint', tint: '#2a2014', room: true },
    'Only the star is left.', [
      ch('Step on the star', out('A vault opens: the treasure of the ruins!', any(...TREASURE), any(...RARE_HELD), rp(50))),
    ]),
  // I381 Signposts with riddles, answers unlock shortcuts.
  ev('w4-riddle-signpost', 'The Riddle Signpost', P, { rarity: 'common', minStage: 1, effect: 'none', tint: '#1c2014' },
    'A signpost with no place names, only a riddle: "The more of me you take, the more you leave behind. Answer, and the short way opens."', [
      ch('"Footsteps"', out('The sign swings round to point at a hidden shortcut. A level ahead!', express(), scout(2))),
      ch('"Time"', out('Nothing happens. Good guess, though.')),
      ch('"Berries"', out('Nothing happens, and you feel a bit silly.')),
    ]),
  // E187 Train Ride Special: express nodes skip a stop with a conductor puzzle.
  ev('w4-express-train', 'The Express Train', P, { rarity: 'uncommon', minStage: 1, effect: 'rattle', tint: '#2a1c14', cast: ['trainer.worker_m'] },
    'A train stops at a little halt. The conductor grins: "Express, one stop skipped! Ticket is free if you can tell me: which carriage is the engine pulling last?"', [
      ch('"The one at the back"', out('"Ha! Right you are. All aboard!" The train skips a stop.', express(), rp(15))),
      ch('"The first one"', out('"Nope. But you can buy a ticket."')),
      ch('Buy a ticket (₽300)', out('The express skips a stop.', $(-300), express()), { requires: [money(300)] }),
      ch('Walk', leave()),
    ]),
  // I383 Ghost lantern parade at Halloween nodes.
  ev('w4-lantern-parade', 'The Ghost Lantern Parade', G, { gameEvent: 'spooky-season', rarity: 'uncommon', minStage: 1, types: ['ghost', 'fire'], effect: 'flicker', tint: '#1c0c24' },
    'At dusk, a parade of floating lanterns drifts down the road. Ghost-types carry them, humming.', [
      ch('Join the parade', out('You walk with the lanterns until midnight. One Ghost-type stays with you.', join({ types: ['ghost'], lv: 1 }), fr(3))),
      ch('Light a lantern for an old friend', out('Your lantern floats up with the others.', rp(20), good(2), any('spell-tag', 'reaper-cloth'))),
      ch('Watch from the side', out('It is beautiful.', heal(0.3))),
    ]),
];

// E183 Magical Forest Maze: the clearing loops back on itself until you find the exit rule (placed by the week's rule).
const FOREST: Json[] = [
  ev('w4-forest-maze', 'The Looping Forest', P, { rarity: 'rare', minStage: 1, types: ['grass', 'fairy'], effect: 'fog', tint: '#142a1c', room: true },
    'Every path out of this clearing leads back into it. A carving on a stump says: "Walk only where the mushrooms glow."', [
      ch('Take the path with the tall trees', out('...and you walk back into the same clearing.', hurt(0.03), room('w4-forest-maze'))),
      ch('Take the path with the flowers', out('...and you walk back into the same clearing. The flowers giggle.', hurt(0.03), room('w4-forest-maze'))),
      ch('Take the path where the mushrooms glow', out('The trees part. You are out, and a forest spirit leaves you a gift.', any('miracle-seed', 'fairy-feather', 'leaf-stone', 'shiny-stone'), rp(40), scout(2))),
      ch('Your Grass-type asks the trees', out('The trees answer it and open the way out.', any('miracle-seed', 'leaf-stone'), rp(20)), { requires: [ptype('grass')] }),
    ]),
];

// ---------- M93 wandering trainer, F92 travelling companion ----------
const WANDER: Json[] = [
  ev('w4-wandering-trainer', 'Someone Is Following You', G, { stop: 'special', rarity: 'common', minStage: 1, effect: 'none', tint: '#1c1c24', cast: ['trainer.youngster_m'] },
    'For a while now, the same trainer has been a few steps behind you. They duck behind a tree when you look.', [
      ch('Let them follow', out('"You noticed? ...Fine. I\'ll challenge you when I\'m ready."', tail(3))),
      ch('Challenge them now', fight('"Okay, okay! Let\'s battle!"', trainer('Wandering Trainer', { cls: 'youngster', size: 2, lv: 0, win: [$(300), rp(15)] }))),
      ch('Lose them in the crowd', out('You slip away. They will not find you again.'), { check: 'luck', fail: out('They are still behind you. "Nice try!"', tail(3)) }),
    ]),
  ev('w4-wanderer-challenge', 'The Wanderer Steps Out', G, { stop: 'special', rarity: 'common', minStage: 1, effect: 'shake', tint: '#24141c', cast: ['trainer.youngster_m'], room: true },
    'The trainer who has been following you steps out onto the path. "I\'ve watched how you battle. Now it\'s my turn!"', [
      ch('Accept the challenge', fight('"Here I come!"', trainer('Wandering Trainer', { cls: 'youngster', size: 3, lv: 2, win: [$(700), rp(30), companion(3)] }))),
      ch('"Not yet. Keep following."', out('"Fine. But I won\'t wait forever."', tail(3))),
      ch('Tell them to go home', out('They shrug and walk off.')),
    ]),
  ev('w4-wanderer-visit', 'Your Travelling Companion', G, { stop: 'special', rarity: 'common', minStage: 1, effect: 'hearts', tint: '#1c2414', cast: ['trainer.youngster_m'], room: true },
    'The wandering trainer you beat catches up with you again. "Thought you could use a hand on this stretch."', [
      ch('Share supplies', out('They patch up your team.', heal(0.5))),
      ch('Trade tips', out('They tell you what is on the road ahead.', scout(3), better(0))),
      ch('Spar a little', out('A friendly round. Your lead learns something.', lv(1, 'lead'))),
    ]),
];

// ---------- F87 treasure map: the item and the dig site it opens ----------
const TREASURE_MAP: Json[] = [
  ev('w4-old-chart', 'The Old Chart Seller', G, { stop: 'merchant', rarity: 'uncommon', minStage: 1, effect: 'none', tint: '#2a2014', cast: ['trainer.hiker'] },
    'A hiker unrolls a stained chart. "An X, see? Never had the time to dig it up."', [
      ch('Buy it (₽800)', out('The Treasure Map is yours. Use it from the map\'s Items menu.', $(-800), item('treasure-map')), { requires: [money(800)] }),
      ch('Trade a story for it', out('He likes your story and hands it over.', item('treasure-map')), { check: 'charisma', fail: out('"Nice story. Still ₽800."') }),
      ch('No thanks', leave()),
    ]),
  ev('w4-treasure-dig', 'X Marks the Spot', G, { stop: 'detour', rarity: 'rare', minStage: 1, types: ['ground'], effect: 'glint', tint: '#2a2010', room: true },
    'The X on your map is right here, under a crooked stone.', [
      ch('Dig', out('A buried chest!', any(...TREASURE), any(...TREASURE), any(...RARE_HELD))),
      ch('Your Ground-type digs', out('It digs deeper than you could: two chests!', any(...TREASURE), any(...TREASURE), any(...RARE_HELD), any(...BALLS)), { requires: [ptype('ground')] }),
    ]),
];

// ---------- M94 landmarks: one per region (placed once on the region's second stage), each with a lasting effect ----------
const LM = 'Regional Landmarks';
const landmark = (id: string, region: string, name: string, types: string[], tint: string, intro: string, a: { label: string; text: string; relic: Json }, b: { label: string; text: string; relic: Json }): Json =>
  ev(`w4-landmark-${id}`, name, LM, { stop: 'landmark', rarity: 'rare', minStage: 1, requires: [inRegion(region)], types, effect: 'glint', tint, room: true }, `${intro} Whatever you take from here stays with you for the rest of the run.`, [
    ch(a.label, out(a.text, a.relic, rp(30))),
    ch(b.label, out(b.text, b.relic, rp(30))),
  ]);
const R = (id: string, name: string, ...effects: Json[]) => relic(`landmark-${id}`, name, effects);
const LANDMARKS: Json[] = [
  landmark('kanto', 'kanto', 'The Moon Crater', ['fairy', 'rock'], '#1c1c2c', 'A crater on the mountain where a moon rock fell long ago. Clefairy dance round it at night.',
    { label: 'Take a sliver of moon rock', text: 'Rare Pokémon seem drawn to it.', relic: R('kanto-a', 'Moon Sliver', { kind: 'encounterWeightMultiplier', group: 'rare', value: 1.15 }) },
    { label: 'Dance with the Clefairy', text: 'Your team feels lighter, friendlier.', relic: R('kanto-b', 'Moon Dance', { kind: 'friendshipMultiplier', value: 1.25 }) }),
  landmark('johto', 'johto', 'The Bell Tower', ['fire', 'flying'], '#2a1a0c', 'A tall tower with a great bell at the top. A rainbow feather is caught in the rail.',
    { label: 'Ring the bell', text: 'Its sound stays with your team: Fire moves burn hotter.', relic: R('johto-a', 'Bell Echo', { kind: 'typeDamageMultiplier', type: 'fire', value: 1.1 }) },
    { label: 'Keep the rainbow feather', text: 'It makes catching easier.', relic: R('johto-b', 'Rainbow Feather', { kind: 'captureMultiplier', value: 1.1 }) }),
  landmark('hoenn', 'hoenn', 'The Sky Pillar', ['dragon', 'flying'], '#14243a', 'An ancient tower over the sea, older than any town.',
    { label: 'Climb to the top', text: 'The wind up there stays in your team: Dragon moves hit harder.', relic: R('hoenn-a', 'Pillar Wind', { kind: 'typeDamageMultiplier', type: 'dragon', value: 1.1 }) },
    { label: 'Read the old carvings', text: 'Research pays more for the rest of the run.', relic: R('hoenn-b', 'Pillar Carvings', { kind: 'researchMultiplier', value: 1.2 }) }),
  landmark('sinnoh', 'sinnoh', 'The Spear Pillar Ruins', ['steel', 'water'], '#1c2a3a', 'Broken columns on top of the highest mountain. Time feels strange here.',
    { label: 'Touch the diamond column', text: 'Your Steel-types feel tougher.', relic: R('sinnoh-a', 'Diamond Dust', { kind: 'typeDamageMultiplier', type: 'steel', value: 1.1 }) },
    { label: 'Touch the pearl column', text: 'Your Water-types feel stronger.', relic: R('sinnoh-b', 'Pearl Dust', { kind: 'typeDamageMultiplier', type: 'water', value: 1.1 }) }),
  landmark('unova', 'unova', 'The Dragonspiral Tower', ['dragon', 'electric'], '#1c1c2a', 'A spiral tower of black and white stone. Thunder rolls round it.',
    { label: 'Take the white stone chip', text: 'Prize money is a little better.', relic: R('unova-a', 'White Chip', { kind: 'moneyMultiplier', value: 1.1 }) },
    { label: 'Take the black stone chip', text: 'Electric moves hit harder.', relic: R('unova-b', 'Black Chip', { kind: 'typeDamageMultiplier', type: 'electric', value: 1.1 }) }),
  landmark('kalos', 'kalos', 'The Prism Tower', ['electric', 'fairy'], '#2a1c2a', 'A great tower of light in the middle of the city.',
    { label: 'Climb to the lights', text: 'Fairy moves shine brighter.', relic: R('kalos-a', 'Prism Light', { kind: 'typeDamageMultiplier', type: 'fairy', value: 1.1 }) },
    { label: 'Shop in its arcade', text: 'Shops give you a better price from now on.', relic: R('kalos-b', 'Prism Card', { kind: 'priceMultiplier', group: 'all', value: 0.92 }) }),
  landmark('alola', 'alola', 'The Altar of the Sun', ['fire', 'psychic'], '#3a2a0c', 'An altar where the sun touches the ground first each morning.',
    { label: 'Watch the sunrise', text: 'Your team feels faster.', relic: R('alola-a', 'Sunrise', { kind: 'statMultiplier', stat: 'spe', value: 1.04 }) },
    { label: 'Leave an offering', text: 'Rare items turn up more often.', relic: R('alola-b', 'Sun Blessing', { kind: 'rareItemWeight', value: 1.2 }) }),
  landmark('galar', 'galar', 'The Slumbering Weald', ['fairy', 'fighting'], '#1c2a24', 'A misty forest where two old heroes are said to sleep.',
    { label: 'Take the rusted sword', text: 'Your team hits a little harder.', relic: R('galar-a', 'Rusted Sword', { kind: 'statMultiplier', stat: 'atk', value: 1.04 }) },
    { label: 'Take the rusted shield', text: 'Your team takes hits a little better.', relic: R('galar-b', 'Rusted Shield', { kind: 'statMultiplier', stat: 'def', value: 1.04 }) }),
  landmark('paldea', 'paldea', 'Area Zero\'s Edge', ['dragon', 'psychic'], '#1c142a', 'The rim of the great crater. Strange crystals grow out of the cliffs.',
    { label: 'Take a Tera crystal', text: 'Rare Pokémon turn up more often.', relic: R('paldea-a', 'Tera Shard', { kind: 'encounterWeightMultiplier', group: 'rare', value: 1.15 }) },
    { label: 'Take notes for the academy', text: 'Research pays more.', relic: R('paldea-b', 'Field Notes', { kind: 'researchMultiplier', value: 1.2 }) }),
  landmark('torren', 'torren', 'The Torren Waterfall', ['water', 'rock'], '#0c2030', 'A waterfall so tall its top is lost in cloud.',
    { label: 'Stand under the falls', text: 'Your team feels tougher.', relic: R('torren-a', 'Falls Spirit', { kind: 'statMultiplier', stat: 'spd', value: 1.04 }) },
    { label: 'Pan for gold', text: 'Prize money is a little better.', relic: R('torren-b', 'Gold Flake', { kind: 'moneyMultiplier', value: 1.1 }) }),
  landmark('frontier', 'frontier-isles', 'The Frontier Lighthouse', ['water', 'electric'], '#14243a', 'A lighthouse on the farthest rock of the isles.',
    { label: 'Light the lamp', text: 'You catch Pokémon a little more easily.', relic: R('frontier-a', 'Lamp Light', { kind: 'captureMultiplier', value: 1.1 }) },
    { label: 'Take the keeper\'s log', text: 'Research pays more.', relic: R('frontier-b', 'Keeper\'s Log', { kind: 'researchMultiplier', value: 1.2 }) }),
  landmark('trial', 'trial-archipelago', 'The Great Totem Stone', ['ground', 'grass'], '#1c2a14', 'A giant carved stone at the heart of the islands. Totem Pokémon gather near it.',
    { label: 'Touch the stone', text: 'Your team feels stronger.', relic: R('trial-a', 'Totem Mark', { kind: 'statMultiplier', stat: 'spa', value: 1.04 }) },
    { label: 'Leave a trial token', text: 'Your team grows closer to you.', relic: R('trial-b', 'Trial Token', { kind: 'friendshipMultiplier', value: 1.25 }) }),
  landmark('grand', 'grand', 'The Grand Hall of Origins', ['dragon', 'normal'], '#2a2414', 'A hall with a statue for every region you have crossed.',
    { label: 'Bow to the statues', text: 'Your team hits harder.', relic: R('grand-a', 'Champion\'s Resolve', { kind: 'statMultiplier', stat: 'atk', value: 1.04 }, { kind: 'statMultiplier', stat: 'spa', value: 1.04 }) },
    { label: 'Sign the hall\'s book', text: 'Prize money is better for the rest of the run.', relic: R('grand-b', 'Signed Book', { kind: 'moneyMultiplier', value: 1.15 }) }),
];

export const W4_EVENTS: Json[] = [...SET_PIECES, ...FOREST, ...WANDER, ...TREASURE_MAP, ...LANDMARKS];
export const W4_LANDMARK_IDS: string[] = LANDMARKS.map((e) => String(e.id));
