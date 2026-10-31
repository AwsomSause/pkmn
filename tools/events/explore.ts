// Exploration events (APPROVED.md §5 and §6): roaming Legendaries, checkpoint camps, scouting and
// weather, secret paths opened by abilities, landmarks and mini-dungeons, Mystery Dungeon floors,
// the Tower of Legends, and the stops of the limited-time events (Legendary Beasts Chase, Campfire
// Tales, Team Plasma Liberation Operation, Hidden Path Week, Mystery Dungeon Week, Tower of Legends).
// Rival events (Rival Clash, Rival Gauntlet) belong to the rival work.

import { readFileSync } from 'node:fs';
import { $, ability, any, att, ch, convoy, convoyHeal, cure, egg, ev, ferry, fight, flag, escorting, flagIs, fr, front, good, gym, has, heal, hurt, item, join, leave, lose, out, ptype, reveal, room, roomFrom, rp, scout, trainer, wild, type Json, HELD, TREASURE, VITAMINS, BERRIES, SNACKS, HEALING } from './dsl.ts';

const balance = JSON.parse(readFileSync(new URL('../../src/data/balance.json', import.meta.url), 'utf8')) as { world: { roamers: { species: string; name: string; gameEvent: string | null }[] } };
const clue = (amount = 1): Json => ({ kind: 'count', counter: 'eventClues', amount });
const boss = (): Json => ({ kind: 'count', counter: 'eventBossesWon', amount: 1 });
const finale = (): Json => ({ kind: 'count', counter: 'eventFinalesWon', amount: 1 });
const RARE_PRIZE = ['leftovers', 'focus-sash', 'choice-band', 'choice-specs', 'life-orb', 'eviolite', 'rocky-helmet'];

// ---------- Roaming Legendary Pokémon (§5): the stop moves with you (core/world.ts) ----------
const R = 'Roaming Legendaries';
const roamerEvents = (): Json[] =>
  balance.world.roamers.map((r): Json => {
    const beasts = r.gameEvent === 'legendary-beasts-chase';
    const pay = (extra: Json[] = []): Json[] => [rp(120), ...(beasts ? [boss()] : []), ...extra];
    return ev(`roamer-${r.species}`, `${r.name} Is Here`, R, { stop: 'roamer', rarity: 'rare', minStage: 1, pokemon: r.species, effect: 'glint', tint: '#14141f', ...(beasts ? { gameEvent: r.gameEvent! } : {}) },
      `Fresh tracks, a scorched leaf, a cry in the air: ${r.name} has been seen here, and it will not stay. This may be your only chance.`, [
        ch('Approach quietly', fight(`${r.name} turns and looks at you. It has decided to stay.`, wild({ species: [r.species], lv: 4, win: pay() })), { check: 'speed', fail: out(`${r.name} bolts before you can get close. You note the direction it went.`, rp(25)) }),
        ch('Lay out a berry as bait', fight(`${r.name} comes closer for the berry.`, wild({ species: [r.species], lv: 3, win: pay([any(...RARE_PRIZE)]) })), { requires: [has('oran-berry')], chance: 0.8, fail: out('It takes the berry from a distance and is gone.', lose('oran-berry')) }),
        ch('Watch from a distance', out(`You watch ${r.name} move on. It is more beautiful than any picture.`, rp(60), fr(3, 'party'), good(1), ...(beasts ? [clue()] : []))),
      ]);
  });

// ---------- Checkpoint Camps (§5) ----------
export const CAMP_EVENTS: Json[] = [
  ev('camp-checkpoint', 'Checkpoint Camp', 'Checkpoint Camps', { stop: 'camp', rarity: 'common', minStage: 1, effect: 'sparkle', tint: '#1c2a1c' },
    'A tidy camp with a firepit and a tent. Other travelers have left it clean. There is time for one thing before you move on.', [
      ch('Make camp (full rest)', out('Everyone sleeps, and anyone in your care too. In the morning, all of you are whole again.', heal(1), cure(), convoyHeal(4), fr(3, 'party'))),
      ch('Plan the route', out('You spread a map and study the road ahead.', scout(6), gym(), rp(15))),
      ch('Sit by the fire', out('Stories, a song, and someone\'s joke you will remember. Everyone feels closer.', heal(0.3), fr(9, 'party'), rp(30), good(1))),
      ch('Resupply', out('The camp keeps a small store for travelers.', any(...HEALING), any(...BERRIES), item('poke-ball', 3))),
    ]),
];

// ---------- Fog of war and weather (§5) ----------
const X = 'Exploration';
export const SCOUT_EVENTS: Json[] = [
  ev('lookout-tower', 'Old Lookout Tower', X, { rarity: 'common', minStage: 1, effect: 'none', tint: '#1c2430' },
    'A leaning tower with a rope ladder and a rusted telescope. The top is above the fog.', [
      ch('Climb up and look', out('The whole stage is laid out below you, haze and all.', scout(9), rp(10)), { check: 'strength', fail: out('The ladder gives out halfway. You see a little, then fall a little.', scout(3), hurt(0.08)) }),
      ch('Send a Flying Pokémon', out('It circles twice and comes back with a full report.', scout(8), fr(3, 'party')), { requires: [ptype('flying')] }),
      ch('Move on', leave()),
    ]),
  ev('fog-guide', 'A Guide in the Fog', X, { rarity: 'common', minStage: 1, cast: ['trainer.hiker'], effect: 'fog', tint: '#242a32' },
    'A lantern bobs ahead. A guide steps out of the fog with a bell on their belt. "I know this ground."', [
      ch('Hire the guide (₽200)', out('They lead you by the safe stones and give you the lay of the land.', $(-200), scout(7), rp(10)), { requires: [{ kind: 'money', atLeast: 200 }] }),
      ch('Chat and trade directions', out('A fair swap. You each leave knowing more.', scout(4), fr(1, 'party')), { check: 'charisma', fail: out('They shrug. "Wrong way, friend."') }),
      ch('Wave them off', leave()),
    ]),
  ev('weather-vane', 'The Weather Vane', X, { rarity: 'uncommon', minStage: 2, effect: 'none', tint: '#20283a' },
    'A hilltop vane with three flags. A keeper tends it and says the sky answers the right question.', [
      ch('Ask for rain', out('The keeper rings a bell. A rain front gathers ahead, and she hands you a charm for the wet.', front('rain', 3), item('mystic-water'), rp(20))),
      ch('Ask for sun', out('She turns the vane. Sun is coming, and she gives you a charm for it.', front('sun', 3), item('charcoal'), rp(20))),
      ch('Ask for sand', out('She spins the vane hard. A sandstorm rolls in, and she gives you a charm for it.', front('sand', 3), item('soft-sand'), rp(20))),
      ch('Ask for snow', out('She whistles. A cold front, and a charm against it.', front('snow', 3), item('nevermeltice'), rp(20))),
    ]),
  ev('storm-chasers', 'Storm Chasers', X, { rarity: 'uncommon', minStage: 2, cast: ['trainer.hiker'], effect: 'rattle', tint: '#1c2a38' },
    'A pair of chasers with a rain gauge and a pickup full of instruments. "Fronts are our living. Want in?"', [
      ch('Join the chase', out('They read the sky for you. From now on, you know where the weather turns.', scout(5), rp(35))),
      ch('Ask them to predict the next front', out('A boom of thunder and a cold front, right on cue. They give you a tip.', front('hail', 3), any(...VITAMINS), rp(20))),
      ch('Borrow the rain gauge', out('Useful, and heavy.', item('damp-rock'), rp(10))),
    ]),
];

// ---------- Secret Paths Unlocked by Pokémon Abilities (§5) ----------
const S = 'Secret Paths';
const secret = (id: string, name: string, abs: Json, intro: string, tint: string, choices: Json[], rarity: 'uncommon' | 'rare' = 'uncommon', minStage = 2): Json =>
  ev(id, name, S, { rarity, minStage, secret: [abs], effect: 'glint', tint }, intro, choices);

export const SECRET_PATH_EVENTS: Json[] = [
  secret('secret-levitate-chasm', 'A Chasm With No Bridge', ability('a Levitating Pokémon', 'levitate'), 'A chasm cuts the road. On the far side, a ledge holds an old chest. There is no bridge. Anything that floats could cross.', '#1c2430', [
    ch('Float across', out('Your Pokémon carries the party across, and you land on the far side with a clear view of the way ahead.', scout(6), any(...TREASURE), ferry()), { requires: [ability('a Levitating Pokémon', 'levitate')] }),
    ch('Look for another way', leave('The chasm stays a chasm.')),
  ], 'rare', 3),
  secret('secret-keen-eye-ledge', 'A Ledge Nobody Sees', ability('a keen-eyed Pokémon', 'keen-eye', 'illuminate', 'compound-eyes', 'frisk'), 'A glint on a cliff face that your Pokémon will not stop staring at. Most people would never notice it.', '#2a2a1c', [
    ch('Climb to the glint', out('A cache of keepsakes, wedged into the rock.', any(...HELD), any(...TREASURE), rp(40), scout(3)), { requires: [ability('a keen-eyed Pokémon', 'keen-eye', 'illuminate', 'compound-eyes', 'frisk')] }),
    ch('Leave it', leave()),
  ]),
  secret('secret-intimidate-gate', 'A Gate Nobody Opens', ability('an intimidating Pokémon', 'intimidate'), 'A gate guarded by a big, calm Pokémon that has not moved in years. It looks at your party. Then at the one in front.', '#2a1c1c', [
    ch('Let your lead stare it down', out('The guard blinks and steps aside. Behind the gate, a hidden path.', scout(5), any(...VITAMINS), rp(40)), { requires: [ability('an intimidating Pokémon', 'intimidate')] }),
    ch('Back away', leave()),
  ]),
  secret('secret-magnet-vein', 'A Vein of Ore', ability('a Magnetic Pokémon', 'magnet-pull', 'static', 'lightning-rod'), 'Your compass spins. In the rock, a seam of something heavy hums.', '#2a2830', [
    ch('Draw the ore out', fight('The ore comes loose, and so does a Pokémon asleep in it.', wild({ types: ['steel', 'electric'], lv: 3, win: [any(...TREASURE), item('metal-coat'), rp(40)] })), { requires: [ability('a Magnetic Pokémon', 'magnet-pull', 'static', 'lightning-rod')] }),
    ch('Leave it', leave()),
  ]),
  secret('secret-damp-cave', 'A Flooded Cave', ability('a water-loving Pokémon', 'damp', 'water-absorb', 'swift-swim'), 'A cave mouth, half flooded. Your Pokémon pulls toward it, smelling cold, clean water.', '#14242c', [
    ch('Wade in', fight('A pool, and something rare in it.', wild({ types: ['water'], lv: 4, shiny: 3, win: [rp(60), any(...TREASURE), egg({ types: ['water'], left: 2, unit: 'stage' })] })), { requires: [ability('a water-loving Pokémon', 'damp', 'water-absorb', 'swift-swim')] }),
    ch('Leave it', leave()),
  ]),
  secret('secret-flash-fire-door', 'A Sealed Stone Door', ability('a fiery Pokémon', 'flash-fire', 'blaze', 'magma-armor'), 'A door of black stone, sealed with wax and soot. The stone is faintly warm.', '#2a1c14', [
    ch('Melt the seal', out('The door opens on an old hall. Something was waiting for you.', any(...HELD), item('fire-stone'), rp(50)), { requires: [ability('a fiery Pokémon', 'flash-fire', 'blaze', 'magma-armor')] }),
    ch('Leave it', leave()),
  ]),
  secret('secret-synchronize-whisper', 'A Whisper in the Air', ability('a sensitive Pokémon', 'synchronize', 'trace', 'telepathy'), 'Your Pokémon freezes and tilts its head. It is listening to something you cannot hear.', '#2a2038', [
    ch('Let it lead', out('It leads you to a quiet clearing where a Pokémon is waiting to talk.', join({ types: ['psychic', 'fairy'], lv: 1 }), rp(30)), { requires: [ability('a sensitive Pokémon', 'synchronize', 'trace', 'telepathy')] }),
    ch('Ignore it', leave()),
  ]),
  secret('secret-pickup-burrow', 'A Burrow Full of Berries', ability('a foraging Pokémon', 'pickup', 'honey-gather', 'harvest'), 'Your Pokémon scrabbles at a hollow log and digs out a small burrow stocked for winter.', '#242a1c', [
    ch('Help it dig', out('A hoard: berries, honey, and things the burrow\'s owner collected.', any(...BERRIES), any(...SNACKS), any(...VITAMINS), rp(25)), { requires: [ability('a foraging Pokémon', 'pickup', 'honey-gather', 'harvest')] }),
    ch('Leave it', leave()),
  ], 'uncommon', 1),
  secret('secret-arena-tunnel', 'A Tunnel Under the Road', ability('a Pokémon at home underground', 'arena-trap', 'sand-veil', 'rock-head', 'sturdy'), 'A tunnel mouth that is not on any map, dug long ago and propped with stone. It points straight toward the gym.', '#2a241c', [
    ch('Take the tunnel', out('The tunnel runs under the whole stage and opens near the gym.', ferry(), rp(30)), { requires: [ability('a Pokémon at home underground', 'arena-trap', 'sand-veil', 'rock-head', 'sturdy')] }),
    ch('Stay on the road', leave()),
  ], 'rare', 3),
];

// ---------- Landmark Nodes and Mini-Dungeons (§5) ----------
interface Floor { name: string; intro: string; foe: Json; skip: { label: string; requires: Json; text: string }; }
const L = 'Landmarks';

/** A landmark: an entrance and one room per floor (each a fight or a way around it), then a final room. */
function landmark(id: string, name: string, types: string[], tint: string, group: string, minStage: number, rarity: 'uncommon' | 'rare', intro: string, floors: Floor[], finalRoom: { name: string; intro: string; choices: Json[] }, extra: Partial<{ gameEvent: string; callback: boolean }> = {}): Json[] {
  const ids = floors.map((_, i) => `${id}-${i + 1}`);
  const fin = `${id}-final`;
  const first = ids[0] ?? fin;
  const events: Json[] = [
    ev(`${id}-entrance`, name, group, { rarity, minStage, types, effect: 'fog', tint, ...extra }, intro, [
      ch('Go in', out('The door closes softly behind you. Whatever is inside has been waiting.', room(first), rp(10))),
      ch('Walk on', leave('You mark it on your map and go.')),
    ]),
  ];
  floors.forEach((f, i) => {
    const next = ids[i + 1] ?? fin;
    events.push(ev(ids[i]!, `${name}: ${f.name}`, group, { rarity, minStage, types, effect: 'fog', tint }, f.intro, [
      ch('Push on', fight('Something steps out to stop you.', f.foe, room(next)), ),
      ch(f.skip.label, out(f.skip.text, room(next), rp(15)), { requires: [f.skip.requires] }),
      ch('Turn back', leave('You go back the way you came. Some places are better left for later.')),
    ]));
  });
  events.push(ev(fin, `${name}: ${finalRoom.name}`, group, { rarity, minStage, types, effect: 'glint', tint }, finalRoom.intro, finalRoom.choices));
  return events;
}

const trainerFoe = (name: string, types: string[], size = 2, lv = 2, win: Json[] = [rp(30)]): Json => trainer(name, { size, lv, types, win });
const wildFoe = (types: string[], lv = 2, win: Json[] = [rp(30)]): Json => wild({ types, lv, win });

export const LANDMARK_EVENTS: Json[] = [
  ...landmark('lighthouse', 'The Sunken Lighthouse', ['water', 'ghost'], '#14242c', L, 2, 'uncommon', 'A lighthouse stands knee-deep in the sea, its lamp still turning. Its door is open to the tide.', [
    { name: 'The Flooded Stair', intro: 'The ground floor is a pool. The stairs are above the water, if you can reach them.', foe: wildFoe(['water'], 2), skip: { label: 'Swim across', requires: ptype('water'), text: 'Your Water-type pulls the party across the pool.' } },
    { name: 'The Keeper\'s Quarters', intro: 'A bed, a table, a keeper\'s lantern. Something moves in the corner.', foe: wildFoe(['ghost'], 3), skip: { label: 'Light the old lantern', requires: ptype('fire'), text: 'The lantern flares. The shadows in the room leave.' } },
  ], { name: 'The Lamp Room', intro: 'The lamp at the top is a ball of living light. Beside it, a chest the keeper never opened.', choices: [
    ch('Open the chest', out('Salt-stained treasures.', any(...TREASURE), any(...HELD), rp(70), flag('landmark-lighthouse'))),
    ch('Tend the lamp', out('The lamp flares once, brighter. Far out at sea, a ship answers.', rp(100), good(3), join({ types: ['water'], lv: 2 }), flag('landmark-lighthouse'))),
  ] }),
  ...landmark('quarry', 'The Old Quarry', ['rock', 'ground'], '#2a2418', L, 2, 'uncommon', 'A quarry cut into the hillside, with cranes frozen halfway through a lift and a dozen shafts going down.', [
    { name: 'The Crane Yard', intro: 'The crane operators left in a hurry. A Pokémon has made itself at home among their gear.', foe: wildFoe(['rock', 'steel'], 2), skip: { label: 'Disable the crane', requires: att('intelligence', 6), text: 'You find the master switch. The yard goes quiet.' } },
    { name: 'The Deep Shaft', intro: 'A single shaft goes much deeper than the rest. Rubble blocks the bottom.', foe: trainerFoe('Quarry Foreman', ['rock', 'ground'], 3, 2), skip: { label: 'Dig through', requires: ptype('ground'), text: 'Your Ground-type clears the rubble in minutes.' } },
  ], { name: 'The Seam', intro: 'A seam of colored stone that runs back into the mountain. Fossils, ore and gems, all laid open.', choices: [
    ch('Dig out the fossils', out('A fossil, cleaned and ready for a lab.', any('old-amber', 'helix-fossil', 'dome-fossil'), rp(80), flag('landmark-quarry'))),
    ch('Take the gems', out('A fortune in cut stone.', $(1500), any(...TREASURE), flag('landmark-quarry'))),
  ] }),
  ...landmark('crystal-hollow', 'The Crystal Hollow', ['ice', 'psychic'], '#1c2a3a', L, 3, 'uncommon', 'A cave whose walls are ice and whose ceiling is a field of quartz. Your Pokémon hear a hum.', [
    { name: 'The Hall of Mirrors', intro: 'A hall of crystal. Every surface shows a slightly different version of you.', foe: wildFoe(['psychic'], 3), skip: { label: 'Walk it with your eyes closed', requires: att('luck', 6), text: 'You find the way out by feel.' } },
    { name: 'The Frozen Lake', intro: 'A lake of black ice, with a single path of white stones across it.', foe: wildFoe(['ice'], 3), skip: { label: 'Melt a path', requires: ptype('fire'), text: 'The ice steams and lets you through.' } },
  ], { name: 'The Heart Crystal', intro: 'At the cave\'s heart, a crystal as big as a house. It hums at the same note as your Pokémon.', choices: [
    ch('Touch the crystal', out('A rush of memories, not yours and yet familiar. It leaves you changed.', rp(120), fr(6, 'party'), flag('landmark-crystal'))),
    ch('Chip off a shard', out('A shard, still singing.', item('comet-shard'), any(...HELD), flag('landmark-crystal'))),
  ] }),
  ...landmark('foundry', 'The Rusted Foundry', ['steel', 'electric'], '#2a2a30', L, 3, 'uncommon', 'A foundry abandoned mid-shift, with the lights on and nobody inside. The machines are still warm.', [
    { name: 'The Assembly Line', intro: 'A conveyor runs with nothing on it. The machines clank, hungry for work.', foe: wildFoe(['steel'], 3), skip: { label: 'Shut down the line', requires: att('intelligence', 7), text: 'You find the breaker. The line stops.' } },
    { name: 'The Furnace Hall', intro: 'A furnace roars in the dark, and a foreman\'s ghost stands before it.', foe: trainerFoe('Foundry Foreman', ['steel', 'fire'], 3, 3), skip: { label: 'Cool the furnace', requires: ptype('water'), text: 'Steam fills the hall. The foreman fades.' } },
  ], { name: 'The Control Room', intro: 'A control room with one lit button. The foundry is waiting for an answer.', choices: [
    ch('Press the button', out('The machines hum into a new shift, and the foundry rewards you with the last run of its product.', any(...HELD), item('metal-coat'), rp(90), flag('landmark-foundry'))),
    ch('Read the logbook', out('The foundry\'s secret: a recipe nobody wrote down.', rp(140), good(1), flag('landmark-foundry'))),
  ] }),
  ...landmark('whispering-grove', 'The Whispering Grove', ['grass', 'fairy'], '#1a2d1c', L, 2, 'uncommon', 'A grove where the wind seems to be saying your name. Every tree has a face if you look long enough.', [
    { name: 'The Circle of Stones', intro: 'A ring of mossy stones. Something is humming a lullaby.', foe: wildFoe(['fairy'], 2), skip: { label: 'Sing the lullaby back', requires: att('charisma', 6), text: 'The humming stops, pleased. The path opens.' } },
    { name: 'The Old Heart Tree', intro: 'A tree older than the grove. A guardian wakes in its roots.', foe: wildFoe(['grass'], 3), skip: { label: 'Offer it a berry', requires: has('oran-berry'), text: 'The tree takes the berry and shakes its leaves in thanks.' } },
  ], { name: 'The Quiet Clearing', intro: 'A clearing where the light falls in a perfect circle. A Pokémon sleeps at its center.', choices: [
    ch('Wake it gently', out('It opens its eyes and decides it likes you.', join({ types: ['grass', 'fairy'], lv: 3 }), fr(5, 'party'), flag('landmark-grove'))),
    ch('Let it sleep and take a seed', out('A seed from a very old tree. It is worth a lot.', item('big-mushroom'), any(...BERRIES), rp(90), flag('landmark-grove'))),
  ] }),
  ...landmark('windswept-spire', 'The Windswept Spire', ['flying', 'dragon'], '#20283a', L, 4, 'rare', 'A spire of rock that goes up into the clouds, with a stair carved around it. The wind is loud.', [
    { name: 'The Gale Terrace', intro: 'A terrace where the wind comes in sideways. You can barely stand.', foe: wildFoe(['flying'], 3), skip: { label: 'Ride the updraft', requires: ptype('flying'), text: 'Your Flying-type catches the wind and carries you up.' } },
    { name: 'The Nest Ledge', intro: 'A ledge crowded with nests. The guardian circles overhead.', foe: wildFoe(['dragon', 'flying'], 4), skip: { label: 'Show you mean no harm', requires: att('charisma', 7), text: 'The guardian studies you and lets you pass.' } },
  ], { name: 'The Summit', intro: 'The top of the spire, above the cloud line. A single shrine, and a single feather in the wind.', choices: [
    ch('Take the feather', out('It buzzes in your hand. Something far away is listening.', item('rare-bone'), any(...HELD), rp(120), flag('landmark-spire'))),
    ch('Rest at the shrine', out('The quiet is complete. Everyone feels renewed.', heal(1), cure(), fr(8, 'party'), rp(80), flag('landmark-spire'))),
  ] }),
  ...landmark('ember-vent', 'The Ember Vent', ['fire', 'dragon'], '#30180c', L, 4, 'rare', 'A crack in the mountain that glows from within. The air above it shimmers. Something large is breathing.', [
    { name: 'The Cinder Slope', intro: 'The slope is made of ash and warm gravel. Embers drift up.', foe: wildFoe(['fire'], 3), skip: { label: 'Cross on cool stones', requires: ptype('water'), text: 'Your Water-type steams a path across.' } },
    { name: 'The Lava Bridge', intro: 'A bridge of stone over a river of lava. Someone has already been this way.', foe: trainerFoe('Vent Warden', ['fire', 'rock'], 3, 3), skip: { label: 'Cross by levitation', requires: ability('a Levitating Pokémon', 'levitate'), text: 'You float across, and the warden lets you.' } },
  ], { name: 'The Heart of the Vent', intro: 'A chamber at the vent\'s heart, where a pool of fire holds a single smoldering egg.', choices: [
    ch('Take the egg', out('Warm to the touch. It will hatch soon.', egg({ types: ['fire', 'dragon'], left: 2, unit: 'stage' }), rp(100), flag('landmark-vent'))),
    ch('Mine the vent', out('Rare ore, still glowing.', item('fire-stone'), any(...TREASURE), $(1000), flag('landmark-vent'))),
  ] }),
];

// ---------- Mystery Dungeon Week (§5): floors whose layout changes every time ----------
const MD = 'Mystery Dungeon';
const mdRoom = (id: string, name: string, intro: string, choices: Json[]): Json => ev(id, `Mystery Dungeon: ${name}`, MD, { rarity: 'rare', minStage: 1, effect: 'fog', tint: '#1c1c30' }, intro, choices);
const DEPTH1 = ['md-1-monster-house', 'md-1-trap-corridor', 'md-1-item-room'];
const DEPTH2 = ['md-2-fork', 'md-2-shop', 'md-2-sleeping-den'];
const DEPTH3 = ['md-3-boss-door', 'md-3-ambush', 'md-3-spring'];

export const MYSTERY_DUNGEON_EVENTS: Json[] = [
  ev('md-entrance', 'Mystery Dungeon', MD, { gameEvent: 'mystery-dungeon-week', callback: true, rarity: 'rare', minStage: 1, effect: 'fog', tint: '#1c1c30' },
    'A stairway down that was not here a moment ago. The rooms below change every time. The only way out is through, or back up before your luck runs out.', [
      ch('Descend', out('The stairs close behind you. The floor below is not the one you left.', roomFrom(...DEPTH1), clue())),
      ch('Not today', leave()),
    ]),
  mdRoom('md-1-monster-house', 'Monster House', 'A room full of sleeping Pokémon. A stair on the far side. Every step is a gamble.', [
    ch('Tiptoe across', out('Not a single eye opens. You find the stair.', roomFrom(...DEPTH2), clue()), { check: 'speed', fail: fight('They wake up all at once.', wild({ lv: 2, win: [roomFrom(...DEPTH2), rp(30)] })) }),
    ch('Wake them on purpose', fight('A very bad idea.', wild({ lv: 3, win: [roomFrom(...DEPTH2), rp(70), any(...VITAMINS)] }), clue())),
  ]),
  mdRoom('md-1-trap-corridor', 'Trap Corridor', 'A corridor with a floor that clicks. Some of the tiles are clearly safe. Some of them are not.', [
    ch('Step only on the quiet tiles', out('You cross with your fingers crossed.', roomFrom(...DEPTH2), clue()), { check: 'intelligence', fail: out('A wire trips. Darts fly. Everyone is scratched but you make it to the other side.', roomFrom(...DEPTH2), hurt(0.12)) }),
    ch('Send a Pokémon first', out('It sets off every trap, then trots back unharmed.', roomFrom(...DEPTH2), fr(2, 'party')), { requires: [ability('a Pokémon with Sturdy or Levitate', 'sturdy', 'levitate')] }),
  ]),
  mdRoom('md-1-item-room', 'Treasure Closet', 'A small room, a pedestal and an item. A sign: "Take one".', [
    ch('Take the berry', out('A single berry, big and fragrant.', any(...BERRIES), roomFrom(...DEPTH2), clue())),
    ch('Take the shiny thing', out('A treasure. The door locks behind you and opens again.', any(...TREASURE), roomFrom(...DEPTH2), clue())),
  ]),
  mdRoom('md-2-fork', 'Fork in the Passage', 'The corridor splits three ways, each marked by a different smell.', [
    ch('Take the damp passage', out('Cold, clean water and a pool to rest in.', heal(0.4), roomFrom(...DEPTH3), clue())),
    ch('Take the hot passage', fight('A fire-breather blocks the way.', wild({ types: ['fire'], lv: 3, win: [roomFrom(...DEPTH3), rp(40)] }), clue())),
    ch('Take the quiet passage', out('Nothing at all, which is unsettling.', roomFrom(...DEPTH3), rp(20), clue())),
  ]),
  mdRoom('md-2-shop', 'The Kecleon Shop', 'A shop in the middle of nowhere, run by a Kecleon who never changes color.', [
    ch('Buy a Potion (₽150)', out('A fair price.', $(-150), item('super-potion'), roomFrom(...DEPTH3), clue()), { requires: [{ kind: 'money', atLeast: 150 }] }),
    ch('Steal one', out('You get away with it, barely.', item('hyper-potion'), item('super-potion'), roomFrom(...DEPTH3), clue()), { check: 'luck', fail: fight('Kecleon changes color and attacks.', wild({ species: ['kecleon'], lv: 3, win: [roomFrom(...DEPTH3), rp(30)] })) }),
    ch('Browse and go', out('Nothing you need.', roomFrom(...DEPTH3), clue())),
  ]),
  mdRoom('md-2-sleeping-den', 'Sleeping Den', 'A den where something is asleep on a pile of treasure.', [
    ch('Take treasure from the edge', out('A few coins, a few stones.', any(...TREASURE), roomFrom(...DEPTH3), clue()), { check: 'speed', fail: fight('It stirs and wakes.', wild({ lv: 4, win: [roomFrom(...DEPTH3), any(...TREASURE), rp(60)] })) }),
    ch('Move on quietly', out('You tiptoe past.', roomFrom(...DEPTH3), clue())),
  ]),
  mdRoom('md-3-boss-door', 'The Boss Door', 'A big door, a bigger lock, and the sound of something heavy on the other side.', [
    ch('Break the door', fight('Whatever is inside has been waiting for company.', trainer('Dungeon Boss', { size: 4, lv: 4, win: [rp(150), any(...RARE_PRIZE), boss(), finale(), flag('md-cleared')] }), clue())),
    ch('Pick the lock', out('It opens with a click. The treasure vault is empty, but there is a pass to the next level.', rp(80), any(...TREASURE), finale(), flag('md-cleared')), { check: 'intelligence', fail: fight('The lock was a trap, and the boss is awake.', trainer('Dungeon Boss', { size: 4, lv: 4, win: [rp(150), boss(), finale(), flag('md-cleared')] })) }),
  ]),
  mdRoom('md-3-ambush', 'Ambush Hall', 'A hall that smells like many Pokémon. The doors lock behind you.', [
    ch('Fight your way through', fight('A gang of dungeon Pokémon.', trainer('Dungeon Pack', { size: 3, lv: 3, win: [rp(100), any(...RARE_PRIZE), boss(), finale(), flag('md-cleared')] }), clue())),
    ch('Hold the door', out('You hold the line until they lose interest.', rp(70), finale(), flag('md-cleared')), { check: 'strength', fail: fight('They break through.', trainer('Dungeon Pack', { size: 3, lv: 3, win: [rp(70), finale(), flag('md-cleared')] })) }),
  ]),
  mdRoom('md-3-spring', 'Hidden Spring', 'A spring at the bottom of the dungeon, glowing softly. An exit stair on the far side.', [
    ch('Drink', out('Everyone is healed. The stair up to the surface is warm and bright.', heal(1), cure(), rp(100), finale(), flag('md-cleared'))),
    ch('Take the water with you', out('A bottle of spring water, and the stair to the surface.', item('max-potion'), rp(60), finale(), flag('md-cleared'))),
  ]),
];

// ---------- Tower of Legends (§5) ----------
const T = 'Tower of Legends';
const towerFloor = (n: number, name: string, test: string, intro: string, choices: Json[], gameEvent?: string): Json =>
  ev(`tower-${n}`, `Tower of Legends: Floor ${n}, ${name}`, T, { rarity: 'epic', minStage: 5, effect: 'glint', tint: '#14141f', ...(gameEvent ? { gameEvent } : {}) }, `${intro} (${test})`, choices);
const legendRelic = { kind: 'relic', id: 'legend-crest', name: 'Legend\'s Crest', effects: [{ kind: 'xpMultiplier', value: 1.15 }, { kind: 'moneyMultiplier', value: 1.1 }] } as Json;

export const TOWER_EVENTS: Json[] = [
  ev('tower-entrance', 'The Tower of Legends', T, { rarity: 'epic', minStage: 5, effect: 'glint', tint: '#14141f' },
    'A tower older than any map. Five floors, each a test, and at the top, something that has watched every traveler who came before you.', [
      ch('Begin the climb', out('The door opens. Each floor will ask for something different.', room('tower-1'), clue())),
      ch('Not yet', leave()),
    ]),
  ev('tower-week-entrance', 'The Tower of Legends', T, { gameEvent: 'tower-of-legends', callback: true, rarity: 'epic', minStage: 1, effect: 'glint', tint: '#14141f' },
    'This week, the Tower of Legends opens its doors to everyone. Five floors, each a different test, and a prize at the top.', [
      ch('Begin the climb', out('The door opens. Each floor will ask for something different.', room('tower-1'), clue())),
      ch('Not yet', leave()),
    ]),
  towerFloor(1, 'The Offering', 'a test of resources', 'A hall with a bowl at its center. The floor is marked: "Give, and be answered."', [
    ch('Give a Potion', out('The bowl glows. The stairs up open.', lose('potion'), room('tower-2'), rp(30)), { requires: [has('potion')] }),
    ch('Give ₽500', out('Coins ring in the bowl. The stairs open.', $(-500), room('tower-2'), rp(30)), { requires: [{ kind: 'money', atLeast: 500 }] }),
    ch('Give a berry', out('The bowl accepts it. The stairs open.', lose('oran-berry'), room('tower-2'), rp(30)), { requires: [has('oran-berry')] }),
  ]),
  towerFloor(2, 'The Trial of Kin', 'a test of team-building', 'Two doors: one for those who travel with a Legendary-blooded companion, one for those who travel with a friend.', [
    ch('Enter with your friends', out('The door recognizes the bond. It opens.', room('tower-3'), fr(4, 'party')), { requires: [{ kind: 'friendship', atLeast: 150 }] }),
    ch('Enter with your Legend', out('The door recognizes the blood. It opens.', room('tower-3'), fr(2, 'party')), { requires: [{ kind: 'partyTag', tag: 'legendary' }] }),
    ch('Force your way in', fight('The door guardian is not impressed.', trainer('Door Guardian', { size: 3, lv: 3, win: [room('tower-3'), rp(50)] }))),
  ]),
  towerFloor(3, 'The Gauntlet of Echoes', 'a test of battle', 'The walls are lined with shapes of Legendary Pokémon. Their echoes step down to fight.', [
    ch('Fight the echoes', fight('Three echoes, one after another.', trainer('Legend\'s Echo', { size: 3, lv: 4, win: [room('tower-4'), rp(80)] })), clue()),
  ]),
  towerFloor(4, 'The Long Dark', 'a test of endurance', 'A floor with no light, and a staircase that takes a long, long time to climb.', [
    ch('Climb with the lamp', out('The lamp lasts. You step off at the top.', lose('oran-berry'), room('tower-5'), rp(40)), { requires: [has('oran-berry')] }),
    ch('Climb in the dark', out('You arrive, bruised, but alive.', room('tower-5'), hurt(0.2), rp(60), fr(4, 'party'))),
    ch('Let a Pokémon light the way', out('A glow in the dark, and a smile.', room('tower-5'), fr(5, 'party'), rp(50)), { requires: [ability('a glowing Pokémon', 'illuminate', 'flash-fire', 'static')] }),
  ]),
  towerFloor(5, 'The Summit of Legends', 'a test of everything', 'The top. A single figure, enormous, ancient, and not surprised to see you.', [
    ch('Challenge the Legend', fight('"Show me what you have learned."', wild({ species: ['mewtwo', 'lugia', 'ho-oh', 'rayquaza', 'dialga', 'palkia', 'giratina', 'arceus'], lv: 6, win: [rp(300), legendRelic, finale(), boss(), flag('tower-cleared')] })), clue()),
    ch('Bow and take your leave', out('It nods. The tower lets you go, lighter than you came.', legendRelic, rp(120), finale(), flag('tower-cleared'))),
  ]),
];

// ---------- Hidden Path Week (§5) ----------
export const HIDDEN_PATH_EVENTS: Json[] = [
  ev('hidden-path-signpost', 'A Signpost for Nowhere', 'Hidden Paths', { gameEvent: 'hidden-path-week', callback: true, rarity: 'rare', minStage: 1, effect: 'sparkle', tint: '#242a30' },
    'A signpost points down a path that does not exist, unless you are standing at the right angle. This is the week the secret paths open.', [
      ch('Walk the path that is not there', out('The path is real. It leads somewhere nobody has been in a while.', reveal(), scout(6), clue())),
      ch('Mark it and move on', out('A good thing to remember.', rp(20), clue())),
    ]),
  ev('hidden-path-shortcut', 'The Hidden Shortcut', 'Hidden Paths', { gameEvent: 'hidden-path-week', rarity: 'uncommon', minStage: 1, effect: 'glint', tint: '#1c2a30' },
    'A gap between two boulders that you would never notice. It opens on a path that cuts the stage in half.', [
      ch('Take the shortcut', out('It is a long way short. You come out far ahead.', ferry(), clue())),
      ch('Explore it slowly', out('You find hidden stops all the way down.', reveal(), any(...TREASURE), clue())),
    ]),
  ev('hidden-path-keeper', 'The Path Keeper', 'Hidden Paths', { gameEvent: 'hidden-path-week', rarity: 'uncommon', minStage: 1, cast: ['trainer.hiker'], effect: 'none', tint: '#2a2830' },
    'A keeper of forgotten roads has set up a table. "Prove you can see them, and I\'ll show you one."', [
      ch('Name three hidden stops', out('You know the trick. She smiles and shows you where the best of them are.', reveal(), rp(60), boss(), clue(2)), { check: 'intelligence', fail: out('She shakes her head kindly.', clue()) }),
      ch('Challenge the keeper', fight('"Then show me on the field."', trainer('Path Keeper', { cls: 'hiker', size: 3, lv: 3, win: [rp(100), reveal(), boss()] }), clue())),
    ]),
];

// ---------- Legendary Beasts Chase (§6) ----------
const B = 'Legendary Beasts Chase';
const beastClue = (id: string, name: string, intro: string, tint: string, pokemon: string): Json =>
  ev(id, name, B, { gameEvent: 'legendary-beasts-chase', rarity: 'uncommon', minStage: 1, pokemon, effect: 'fog', tint }, intro, [
    ch('Follow the trail', out('The tracks lead on. You are closer than you were.', clue(), scout(4), rp(20))),
    ch('Ask the locals', out('A farmer saw it pass an hour ago.', clue(), rp(10), $(150))),
    ch('Move on', leave()),
  ]);

export const BEAST_EVENTS: Json[] = [
  beastClue('beast-clue-thunder', 'Thunder on a Clear Day', 'The sky is blue, but something has just rolled through the trees with a crack like lightning. The ground is singed in a long, curved line.', '#2a2a14', 'raikou'),
  beastClue('beast-clue-ash', 'A Trail of Ash', 'A line of fire-blackened ground runs across the field. Where it ends, the grass is already growing back.', '#30180c', 'entei'),
  beastClue('beast-clue-ripple', 'Ripples Without Wind', 'A pond is rippling in perfect circles, though the air is still. Something passed over the water, and the water remembers it.', '#14243a', 'suicune'),
  ev('beast-lookout', 'The Beasts\' Lookout', B, { gameEvent: 'legendary-beasts-chase', callback: true, rarity: 'rare', minStage: 1, effect: 'glint', tint: '#1c2430' },
    'A hunter on a ridge, with a field journal and a telescope. "All three are in the region. Want to know where?"', [
      ch('Trade for what she knows', out('She marks the map: where each beast was last seen.', scout(8), clue(2), rp(40))),
      ch('Join the hunt', out('You and the hunter share a long day on the ridge. By dusk, you have all three trails.', scout(5), clue(), fr(3, 'party'), rp(30))),
    ]),
];

// ---------- Campfire Tales Event (§6) ----------
const C = 'Campfire Tales';
const tale = (id: string, name: string, intro: string, choices: Json[], tint = '#2a1c10'): Json =>
  ev(id, name, C, { gameEvent: 'campfire-tales-week', rarity: 'uncommon', minStage: 1, effect: 'fire', tint }, intro, choices);

export const CAMPFIRE_EVENTS: Json[] = [
  tale('tale-storyteller', 'The Traveling Storyteller', 'A storyteller sets her bag down by your fire and asks if you have a tale to trade.', [
    ch('Tell the story of your best team', out('She lets it hang in the air, then repays you in kind: a tale about a team a lot like yours.', clue(), fr(5, 'party'), rp(30)), { requires: [{ kind: 'championGhost' }] }),
    ch('Tell the story of the team that fell', out('She is quiet a long time. "That one stays with you." She gives you a charm.', clue(), fr(4, 'party'), rp(30), item('spell-tag')), { requires: [{ kind: 'retiredGhost' }] }),
    ch('Tell a story about this trip', out('She nods. "This one\'s still being written."', clue(), fr(3, 'party'), rp(20))),
    ch('Just listen', out('She tells a story about a mountain that remembers.', clue(), rp(20))),
  ]),
  tale('tale-ghost-story', 'A Ghost Story', 'The fire pops. Someone starts a story that nobody wants to be the last to hear.', [
    ch('Listen in the dark', out('The story is about a trainer who walks the roads at night. Your Pokémon huddle close.', clue(), fr(6, 'party'))),
    ch('Add a twist', out('Your twist is better. The storyteller is delighted.', clue(), fr(3, 'party'), rp(30)), { check: 'charisma', fail: out('Everyone just stares at you.', clue()) }),
  ], '#14102a'),
  tale('tale-pokemon-memory', 'A Pokémon Remembers', 'Your lead sits very still by the fire, looking at the flames. It seems to be thinking about something.', [
    ch('Ask it what it remembers', out('It shows you, in its way: the first day you met. You never knew it remembered.', clue(), fr(8, 'lead'), rp(25)), { requires: [{ kind: 'friendship', atLeast: 100 }] }),
    ch('Let it be', out('It leans against you and falls asleep.', clue(), fr(3, 'lead'))),
  ]),
  tale('tale-world-lore', 'The Old Road', 'A traveler in the next camp tells the story of how the roads came to be, and who walked them first.', [
    ch('Ask about the first road', out('A story about a Legendary that lay down and became a path.', clue(), scout(3), rp(30))),
    ch('Ask about the first trainers', out('A story about a pair of trainers and their Pokémon, and a promise.', clue(), fr(3, 'party'), rp(30))),
  ]),
  tale('tale-festival-night', 'A Festival Night', 'Three camps share one fire, and the whole hillside is singing.', [
    ch('Sing along', out('You have a good voice! Someone hands you a gift.', clue(), any(...SNACKS), fr(4, 'party')), { check: 'charisma', fail: out('The Pokémon laugh. It is a pleasant laugh.', clue(), fr(2, 'party')) }),
    ch('Dance', out('Your Pokémon join in, and so do some strangers\'.', clue(), fr(6, 'party'), good(1))),
  ]),
];

// ---------- Team Plasma Liberation Operation (§6) ----------
const P = 'Plasma Operation';
const pOp = (id: string, name: string, flagReq: Json | null, intro: string, tint: string, choices: Json[]): Json =>
  ev(id, name, P, { gameEvent: 'plasma-operation', callback: true, rarity: 'rare', minStage: 1, cast: ['boss.ghetsis'], effect: 'fog', tint, ...(flagReq ? { requires: [flagReq] } : {}) }, intro, choices);

export const PLASMA_OPERATION_EVENTS: Json[] = [
  pOp('plasma-op-1', 'Operation: The Supply Route', null, 'A road of crates and guards. A foreman checks a clipboard. The trucks are Plasma\'s, and so are the Pokémon in the back.', '#1a2230', [
    ch('Sabotage the trucks', out('A couple of well-placed wrenches. The trucks will not run for days.', clue(), good(2), flag('plasma-op'), flag('plasma-op-cut'))),
    ch('Free the Pokémon', fight('The guards have other ideas.', trainer('Plasma Convoy Guard', { size: 3, lv: 2, win: [clue(), good(3), rp(60), flag('plasma-op'), flag('plasma-op-freed')] }), clue())),
    ch('Report it', out('The authorities will take it from here. That is something.', clue(), rp(30), flag('plasma-op'))),
  ]),
  pOp('plasma-op-2', 'Operation: The Holding Yard', flagIs('plasma-op', 1, 1), 'Word spreads about what you did. A holding yard is next, with more guards and more Pokémon.', '#1c2430', [
    ch('Break the fence', fight('The yard erupts.', trainer('Plasma Yard Crew', { size: 3, lv: 3, win: [clue(2), good(2), rp(80), flag('plasma-op'), join({ lv: 2 })] }), clue())),
    ch('Slip in with the freed Pokémon', out('The Pokémon you freed know the back ways. You lead everyone out through the drain.', clue(2), good(3), rp(60), flag('plasma-op'), join({ lv: 1 })), { requires: [flagIs('plasma-op-freed')] }),
    ch('Cut the power', out('The yard goes dark. In the confusion, you open every pen.', clue(2), good(2), rp(60), flag('plasma-op')), { requires: [flagIs('plasma-op-cut')] }),
  ]),
  pOp('plasma-op-3', 'Operation: The Commander', flagIs('plasma-op', 2, 99), 'The commander has heard of you. They are waiting at the end of the road, with a team they have been training for this.', '#101820', [
    ch('Face the commander', fight('"You are in the way of progress."', trainer('Plasma Commander', { cls: 'veteran', size: 5, lv: 5, win: [clue(3), finale(), boss(), rp(250), $(2500), any(...RARE_PRIZE), good(3), flag('plasma-op-done')] }), clue())),
    ch('Offer a deal', out('The commander accepts a ceasefire. It is not a victory, but the Pokémon go free.', clue(3), finale(), rp(150), good(2), flag('plasma-op-done')), { check: 'charisma', fail: fight('The commander laughs and attacks.', trainer('Plasma Commander', { cls: 'veteran', size: 5, lv: 5, win: [clue(3), finale(), boss(), rp(150), flag('plasma-op-done')] })) }),
  ]),
];

// ---------- Convoy Mode (§5) ----------
const CV = 'Convoy';
const escortEvent = (id: string, name: string, who: string, hp: number, intro: string, thanks: string, cast: string[]): Json =>
  ev(id, name, CV, { rarity: 'uncommon', minStage: 2, effect: 'none', tint: '#1c2430', requires: [escorting(false)], cast }, intro, [
    ch('Escort them to the gym', out(thanks, convoy(who, hp))),
    ch('Wish them luck and go on', out('You point out the safest road and leave them to it.', rp(10))),
  ]);
export const CONVOY_EVENTS: Json[] = [
  escortEvent('convoy-lost-researcher', 'A Researcher Needs an Escort', 'the researcher', 4, 'A researcher with a heavy pack is staring at the road. "It is not safe alone. If you would take me as far as the gym, I can pay."', '"Stay close. I will pay at the gym." Wild Pokémon may strike at them on the way, and a party with a guarding ability keeps them safer.', ['trainer.hiker']),
  escortEvent('convoy-merchant-cart', 'The Merchant\'s Cart', 'the merchant\'s cart', 5, 'A merchant\'s cart has lost its guards. "Five stout planks and a lot of stock. Take us to the gym and the cut is yours."', 'The cart rolls on behind you. It can take a few hits, but not many.', ['trainer.hiker']),
  escortEvent('convoy-lost-children', 'Children on the Road', 'the lost children', 3, 'Three children, all dust and scraped knees, say their town is past the gym. They will not wait at the roadside.', 'They fall in line behind your party. They are fragile, so keep them out of trouble.', ['trainer.youngster_m']),
  escortEvent('convoy-wounded-ranger', 'A Wounded Ranger', 'the wounded ranger', 3, 'A ranger sits against a tree, her Pokémon hurt. "Get me to the gym. They have a healer."', 'She leans on you as you go. Her Pokémon limps beside her.', ['trainer.snow_worker_m']),
  ev('convoy-shelter', 'A Shelter by the Road', CV, { rarity: 'common', minStage: 2, effect: 'sparkle', tint: '#1c2a1c' },
    'A roadside shelter with a roof and a well. A good place to stop with someone in your care.', [
      ch('Tend the escort', out('Water, bandages, and an hour out of the wind. Your charge looks much better.', convoyHeal(3), rp(10)), { requires: [escorting()] }),
      ch('Rest the party', out('You post a watch and sleep. Anyone in your care rests too.', heal(0.5), convoyHeal(1))),
      ch('Press on', out('The road will not wait.', rp(20))),
    ]),
];

export const EXPLORE_EVENTS: Json[] = [
  ...roamerEvents(),
  ...CAMP_EVENTS,
  ...SCOUT_EVENTS,
  ...SECRET_PATH_EVENTS,
  ...LANDMARK_EVENTS,
  ...MYSTERY_DUNGEON_EVENTS,
  ...TOWER_EVENTS,
  ...HIDDEN_PATH_EVENTS,
  ...BEAST_EVENTS,
  ...CAMPFIRE_EVENTS,
  ...PLASMA_OPERATION_EVENTS,
  ...CONVOY_EVENTS,
];
