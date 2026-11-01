// Hand-designed Legendary world events (spec 19). Each entry overrides the type template in build-legendary-events.ts.
// Fields not given here come from the template. Species ids are checked against species.json by the builder.

export interface Bespoke {
  epithet: string;
  omen: string;
  lore: string[];
  tint: string;
  accent: string;
  motif: string;
  rarity?: 'uncommon' | 'rare' | 'veryRare';
  trigger?: Record<string, unknown>;
  env: { fromLayer: number; text: string; weather?: string; terrain?: string; pool?: { weather?: string; terrain?: string; text: string }[] }[];
  closes?: { afterLayer: number; text: string }[];
  distort?: { afterLayer: number; text: string }[];
  affinity?: { types: string[]; heal: number; text: string } | null;
  peril?: { types: string[]; chip: number; text: string } | null;
  wild: string[];
  npcs: { id: string; name: string; text: string; options: { label: string; result: string; effect: Record<string, unknown> }[] }[];
  modifiers: string[];
  finale: { intro: string; win: string; lose: string };
  /** The finale Totem. */
  totem: { aura: { text: string; boost?: Record<string, number>; weather?: string; terrain?: string }; environment: { text: string; weather?: string; terrain?: string }; phases: { atHp: number; text: string; boost?: Record<string, number>; weather?: string; clearPlayerStages?: boolean; cleanse?: boolean }[]; fieldEffect?: { status: 'brn' | 'psn' | 'par'; chance: number; text: string } };
}

const heal = { heal: 0.25 };
const mend = { heal: 0.4 };

export const BESPOKE: Record<string, Bespoke> = {
  kyogre: {
    epithet: 'Primordial Flood',
    omen: 'The sea has climbed the cliffs overnight, and the sky will not stop raining.',
    lore: ['Fishermen say the tide went out of the world and came back wearing a name.', 'Something vast breathes under the water, and the flood follows its breath.'],
    tint: '#1d4f9c', accent: '#6fd0ff', motif: 'flooded ruins, drifting currents',
    trigger: { minRegion: 2, favoured: ['water'], any: [{ kind: 'partyType', type: 'water' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [
      { fromLayer: 0, text: 'The stage is half under water. Rain falls on every fight.', weather: 'rain' },
      { fromLayer: 3, text: 'The flood deepens: the rain turns to a deluge and the footing is gone.', weather: 'rain', terrain: 'misty' },
    ],
    closes: [{ afterLayer: 1, text: 'A current tears a bridge away. One way forward is under water.' }, { afterLayer: 3, text: 'The rising flood swallows another path.' }],
    affinity: { types: ['water'], heal: 0.1, text: 'Water Pokémon ride the currents and recover a little HP.' },
    peril: { types: ['fire', 'rock'], chip: 0.06, text: 'Fire and Rock Pokémon struggle in the cold flood and lose some HP.' },
    wild: ['wailord', 'gyarados', 'lanturn', 'octillery', 'huntail', 'gorebyss', 'milotic'],
    npcs: [
      { id: 'drowned-fisher', name: 'The Drowned Fisher', text: '"It rises when it is lonely. Give it something, or take something from it."', options: [{ label: 'Leave a bait offering', result: 'The water goes still for a moment, and a cache washes up.', effect: { item: 'hyper-potion' } }, { label: 'Take from the wreck', result: 'You find supplies, but the water bites back.', effect: { money: 300, hurt: 0.1 } }] },
      { id: 'tide-keeper', name: 'The Tide Keeper', text: '"Follow the current and you will see its eye."', options: [{ label: 'Follow the current', result: 'Your team is carried onward and feels stronger.', effect: { heal: 0.3 } }, { label: 'Stay on the rocks', result: 'You gather research notes on the flood.', effect: { research: 1 } }] },
    ],
    modifiers: ['Rain on every fight', 'Water Pokémon recover HP between stops', 'Paths are lost as the flood rises'],
    finale: { intro: 'The sea opens. Kyogre rises out of an enormous flooded basin and the rain turns to a wall.', win: 'The flood eases. Kyogre sinks back into the deep, and the sea remembers your name.', lose: 'The flood carries your team to the shallows. Kyogre watches, and lets you go.' },
    totem: {
      aura: { text: 'A storm of rain surrounds it (Special Attack up).', boost: { spa: 1 }, weather: 'rain' },
      environment: { text: 'An enormous flooded arena: heavy rain the whole fight.', weather: 'rain' },
      phases: [
        { atHp: 0.7, text: 'The water rises! Kyogre sets the current against you.', boost: { spd: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'A tidal surge! The flood takes the whole arena.', boost: { spa: 1 }, weather: 'rain' },
        { atHp: 0.2, text: 'Primal Reversion — the sea itself answers!', boost: { spa: 1, spe: 1 }, cleanse: true },
      ],
    },
  },
  groudon: {
    epithet: 'Scorched Earth',
    omen: 'The ground is hot underfoot, and a column of ash stands over the next ridge.',
    lore: ['Rivers have run dry. The earth cracked in the night and glowed.', 'Something under the crust is waking, and the land is bending to its heat.'],
    tint: '#9c2f1d', accent: '#ffb347', motif: 'lava fields, cracked basalt',
    trigger: { minRegion: 2, time: ['day', 'eve'], favoured: ['fire', 'ground'], any: [{ kind: 'partyType', type: 'ground' }, { kind: 'partyType', type: 'fire' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [
      { fromLayer: 0, text: 'Harsh sunlight beats down on every fight.', weather: 'sun' },
      { fromLayer: 2, text: 'The ground splits: sandstorms of ash roll in.', weather: 'sand' },
      { fromLayer: 4, text: 'The sun returns, brighter than before.', weather: 'sun' },
    ],
    closes: [{ afterLayer: 1, text: 'A lava flow cuts one route.' }, { afterLayer: 3, text: 'The ground collapses behind you. Another path is gone.' }],
    affinity: { types: ['fire', 'ground'], heal: 0.1, text: 'Fire and Ground Pokémon draw strength from the hot earth.' },
    peril: { types: ['grass', 'ice', 'bug'], chip: 0.06, text: 'Grass, Ice and Bug Pokémon are scorched by the heat.' },
    wild: ['camerupt', 'torkoal', 'magcargo', 'rhyperior', 'flareon', 'arcanine', 'golem'],
    npcs: [
      { id: 'ash-prospector', name: 'The Ash Prospector', text: '"The stones are warm. Warm stones mean a bright one under them."', options: [{ label: 'Dig at the ridge', result: 'You pull out a bright stone, and burn your hands.', effect: { item: 'hyper-potion', hurt: 0.08 } }, { label: 'Pay for the map', result: 'The prospector marks a safe line through the ash.', effect: { money: -200, research: 1 } }] },
      { id: 'caldera-hermit', name: 'The Caldera Hermit', text: '"It is not angry. It is only awake."', options: [{ label: 'Rest in the shade', result: 'Your team cools down and recovers.', effect: heal }, { label: 'Take a coal for luck', result: 'The coal glows in your bag.', effect: { money: 400 } }] },
    ],
    modifiers: ['Harsh sunlight, then ash storms, then sun again', 'Fire and Ground Pokémon recover HP', 'Lava closes paths'],
    finale: { intro: 'The crater breathes. Groudon climbs out of an active volcano and the sky turns red.', win: 'The ground cools. Groudon sleeps again, and the ash begins to settle.', lose: 'The heat drives you back across the ash. Groudon does not follow.' },
    totem: {
      aura: { text: 'The earth burns around it (Attack up).', boost: { atk: 1 }, weather: 'sun' },
      environment: { text: 'An active volcano: harsh sunlight the whole fight.', weather: 'sun' },
      phases: [
        { atHp: 0.7, text: 'The crater splits open! Lava floods the arena.', boost: { def: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'Groudon stamps. The volcano erupts.', boost: { atk: 1 }, weather: 'sun' },
        { atHp: 0.2, text: 'Primal Reversion — the land itself burns!', boost: { atk: 1, spe: 1 }, cleanse: true },
      ],
      fieldEffect: { status: 'brn', chance: 0.12, text: 'The heat of the volcano scorches your Pokémon.' },
    },
  },
  rayquaza: {
    epithet: 'Skybound Tempest',
    omen: 'A green shadow crosses the clouds, and the winds have started to climb.',
    lore: ['The air thins. Stone platforms hang where there was only sky yesterday.', 'Something older than both sea and land circles above the weather.'],
    tint: '#1f7a4d', accent: '#c6ff6f', motif: 'floating platforms, tempest above the clouds',
    rarity: 'veryRare',
    trigger: { minRegion: 3, favoured: ['flying', 'dragon'], any: [{ kind: 'partyType', type: 'flying' }, { kind: 'partyType', type: 'dragon' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [
      { fromLayer: 0, text: 'Floating platforms under a rushing wind. Fights are fought in thin air.', terrain: 'electric' },
      { fromLayer: 3, text: 'The storm builds. Rain lashes the platforms.', weather: 'rain', terrain: 'electric' },
      { fromLayer: 5, text: 'The platforms start to break apart.', weather: 'rain' },
    ],
    closes: [{ afterLayer: 1, text: 'A platform crumbles away. One way forward is gone.' }, { afterLayer: 3, text: 'The wind tears another platform loose.' }, { afterLayer: 4, text: 'The structure is falling apart behind you.' }],
    affinity: { types: ['flying', 'dragon'], heal: 0.1, text: 'Flying and Dragon Pokémon ride the updrafts and recover.' },
    peril: { types: ['rock', 'ice'], chip: 0.06, text: 'Rock and Ice Pokémon are battered by the wind.' },
    wild: ['altaria', 'salamence', 'dragonite', 'flygon', 'noivern', 'swellow', 'tropius'],
    npcs: [
      { id: 'wind-reader', name: 'The Wind Reader', text: '"Lean into the gust. The platform will hold if you do."', options: [{ label: 'Lean into the gust', result: 'The wind carries your team forward.', effect: heal }, { label: 'Study the currents', result: 'You chart the winds.', effect: { research: 1 } }] },
      { id: 'sky-tender', name: 'The Sky Tender', text: '"Everything that falls from here is lost. Everything you carry is enough."', options: [{ label: 'Accept a charm', result: 'A charm of feathers lifts your spirits.', effect: { item: 'hyper-potion' } }, { label: 'Trade a coin for a rope', result: 'The rope keeps the team safe from a fall.', effect: { money: -100, heal: 0.15 } }] },
    ],
    modifiers: ['Electric surge aloft, then rain', 'Flying and Dragon Pokémon recover HP', 'The platforms break apart'],
    finale: { intro: 'The clouds part. Rayquaza coils above the highest platform and the sky itself turns on you.', win: 'The tempest falls quiet. Rayquaza circles once and climbs out of sight.', lose: 'The platform falls and the wind catches you. Rayquaza lets the clouds close.' },
    totem: {
      aura: { text: 'The tempest coils around it (Speed up).', boost: { spe: 1 }, weather: 'rain' },
      environment: { text: 'Above the clouds: rain and wind the whole fight.', weather: 'rain' },
      phases: [
        { atHp: 0.7, text: 'Rayquaza dives! The wind turns against you.', boost: { atk: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'The sky roars. The platform starts to fall.', boost: { spa: 1 }, weather: 'rain' },
        { atHp: 0.2, text: 'Rayquaza ascends beyond the clouds and returns stronger!', boost: { atk: 1, spa: 1 }, cleanse: true },
      ],
    },
  },
  giratina: {
    epithet: 'Distortion World',
    omen: 'Your shadow has stopped matching you, and the path ahead is hanging at an angle.',
    lore: ['Up is somewhere else. A staircase leads down to the ceiling.', 'Banished from the world, it is building one of its own.'],
    tint: '#2a1a40', accent: '#c78aff', motif: 'inverted rooms, twisted stairs',
    rarity: 'veryRare',
    trigger: { minRegion: 3, time: ['night'], favoured: ['ghost', 'dragon'], any: [{ kind: 'partyType', type: 'ghost' }, { kind: 'partyTag', tag: 'legendary' }, { kind: 'friendship', atLeast: 150 }] },
    env: [
      { fromLayer: 0, text: 'The rooms are the wrong way round. Battle conditions shift without warning.', pool: [{ terrain: 'psychic', text: 'The floor hums with a strange pressure.' }, { terrain: 'misty', text: 'A cold mist pours up from the floor.' }, { weather: 'hail', text: 'Snow falls upward.' }, { text: 'For a moment, everything is calm.' }] },
    ],
    closes: [{ afterLayer: 2, text: 'A door that was there is gone.' }],
    distort: [{ afterLayer: 0, text: 'The room turns. The way on is somewhere else.' }, { afterLayer: 2, text: 'The stairs loop. Where they lead has changed.' }, { afterLayer: 4, text: 'The walls rearrange themselves behind you.' }],
    affinity: { types: ['ghost', 'dragon'], heal: 0.08, text: 'Ghost and Dragon Pokémon feel at home here and recover.' },
    peril: { types: ['normal', 'fighting'], chip: 0.06, text: 'Normal and Fighting Pokémon feel the world slip and lose HP.' },
    wild: ['drifblim', 'mismagius', 'dusknoir', 'chandelure', 'gengar', 'froslass', 'spiritomb'],
    npcs: [
      { id: 'inverted-clerk', name: 'The Inverted Clerk', text: '"Everything is for sale. The price is whatever you have left."', options: [{ label: 'Buy a strange tonic', result: 'It tastes of nothing and your team feels better.', effect: { money: -200, heal: 0.3 } }, { label: 'Ask for directions', result: 'Directions arrive in a language you almost understand.', effect: { research: 1 } }] },
      { id: 'mirror-self', name: 'Your Reflection', text: '"I know where you are going. I got there first."', options: [{ label: 'Follow your reflection', result: 'It leads you to a cache.', effect: { item: 'hyper-potion' } }, { label: 'Break the glass', result: 'Money falls out. The glass cuts your team.', effect: { money: 500, hurt: 0.12 } }] },
    ],
    modifiers: ['Weather and terrain change from fight to fight', 'Rooms rearrange themselves', 'Strange Ghost-type Pokémon roam'],
    finale: { intro: 'The distortion folds in on itself. Giratina waits in an arena that has no floor.', win: 'The distortion unwinds. Giratina fades into the shadow between worlds.', lose: 'The room turns once more and spits you out where you began.' },
    totem: {
      aura: { text: 'Reality bends around it (Defense up).', boost: { def: 1 }, terrain: 'psychic' },
      environment: { text: 'A distorted arena: the Psychic terrain bends the rules.', terrain: 'psychic' },
      phases: [
        { atHp: 0.7, text: 'The arena flips! Giratina vanishes and comes back from below.', boost: { spd: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'Giratina tears the room apart.', boost: { atk: 1 } },
        { atHp: 0.2, text: 'Origin Forme — the world splits open!', boost: { atk: 1, spe: 1 }, cleanse: true },
      ],
    },
  },
  dialga: {
    epithet: 'Frozen Hour',
    omen: 'Every clock in the region has stopped at the same second.',
    lore: ['A bird hangs motionless in the air. A drip of water is shaped like a bell.', 'The one who holds time is deciding what to do with it.'],
    tint: '#3b4f7a', accent: '#ffe08a', motif: 'frozen clockwork, stopped time',
    rarity: 'veryRare',
    trigger: { minRegion: 3, favoured: ['steel', 'dragon'], any: [{ kind: 'partyType', type: 'steel' }, { kind: 'partyType', type: 'dragon' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'Time is stuck. The air is still and heavy.', terrain: 'psychic' }, { fromLayer: 4, text: 'Time starts to run backwards.', terrain: 'psychic', weather: 'sand' }],
    closes: [{ afterLayer: 2, text: 'A gear locks. One route is frozen shut.' }],
    distort: [{ afterLayer: 1, text: 'The hour rewinds. The way on changes.' }],
    affinity: { types: ['steel', 'dragon'], heal: 0.08, text: 'Steel and Dragon Pokémon keep their rhythm and recover.' },
    peril: { types: ['fairy', 'normal'], chip: 0.05, text: 'Fairy and Normal Pokémon lose their footing in the stopped hour.' },
    wild: ['bronzong', 'metagross', 'aggron', 'magnezone', 'scizor', 'skarmory', 'dragonair'],
    npcs: [{ id: 'clock-mender', name: 'The Clock Mender', text: '"Time owes everyone a little. Collect yours."', options: [{ label: 'Take a minute back', result: 'Your team recovers as if it had rested.', effect: mend }, { label: 'Wind the clock', result: 'You gain research on the stopped hour.', effect: { research: 1, money: 200 } }] }],
    modifiers: ['Psychic terrain over the stage', 'Steel and Dragon Pokémon recover HP', 'Routes freeze and rewind'],
    finale: { intro: 'The last gear turns. Dialga stands in an hour that never ends.', win: 'The clocks start again. Dialga lets time move on.', lose: 'The hour rewinds and you find yourselves at the gate once more.' },
    totem: {
      aura: { text: 'Time slows around it (Defense up).', boost: { def: 1 }, terrain: 'psychic' },
      environment: { text: 'A frozen hour: Psychic terrain the whole fight.', terrain: 'psychic' },
      phases: [
        { atHp: 0.7, text: 'Dialga stops the clock. Your boosts are undone.', boost: { spd: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'Time speeds up around Dialga.', boost: { spe: 1 } },
        { atHp: 0.2, text: 'Roar of Time — the hour breaks!', boost: { spa: 1, atk: 1 }, cleanse: true },
      ],
    },
  },
  palkia: {
    epithet: 'Folded Space',
    omen: 'The horizon has moved closer. The sky shows a seam.',
    lore: ['Distances no longer add up. A mountain sits on top of the sea.', 'The one who shapes space is stretching the road.'],
    tint: '#6a2f8a', accent: '#ffb0ff', motif: 'folded horizons, bending space',
    rarity: 'veryRare',
    trigger: { minRegion: 3, favoured: ['water', 'dragon'], any: [{ kind: 'partyType', type: 'water' }, { kind: 'partyType', type: 'dragon' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'The space folds. A strange mist hangs over every fight.', terrain: 'misty' }, { fromLayer: 4, text: 'Space tears open and rain pours through the seam.', terrain: 'misty', weather: 'rain' }],
    closes: [{ afterLayer: 2, text: 'Space folds over one of the routes.' }],
    distort: [{ afterLayer: 1, text: 'The road stretches. The way on has moved.' }],
    affinity: { types: ['water', 'dragon'], heal: 0.08, text: 'Water and Dragon Pokémon follow the folds and recover.' },
    peril: { types: ['fire', 'ground'], chip: 0.05, text: 'Fire and Ground Pokémon lose their bearings.' },
    wild: ['gyarados', 'kingdra', 'starmie', 'lapras', 'slowbro', 'milotic', 'dragalge'],
    npcs: [{ id: 'cartographer', name: 'The Cartographer', text: '"The map and the land disagree. I trust the map."', options: [{ label: 'Buy the map', result: 'The map shows a safe stretch.', effect: { money: -200, heal: 0.25 } }, { label: 'Trace the seam', result: 'You learn how space bends here.', effect: { research: 1 } }] }],
    modifiers: ['Misty terrain, then rain through the seam', 'Water and Dragon Pokémon recover HP', 'The road stretches and folds'],
    finale: { intro: 'Space opens like a page. Palkia waits in the fold.', win: 'The seam closes. Palkia lets space settle.', lose: 'Space snaps shut and throws you back to the gate.' },
    totem: {
      aura: { text: 'Space bends around it (Special Attack up).', boost: { spa: 1 }, terrain: 'misty' },
      environment: { text: 'A fold in space: Misty terrain the whole fight.', terrain: 'misty' },
      phases: [
        { atHp: 0.7, text: 'Palkia folds the arena. Your boosts are gone.', boost: { spd: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'Space tears apart around you.', boost: { spa: 1 }, weather: 'rain' },
        { atHp: 0.2, text: 'Spacial Rend — the world splits!', boost: { spa: 1, spe: 1 }, cleanse: true },
      ],
    },
  },
  lugia: {
    epithet: 'Guardian of the Whirl',
    omen: 'A whirlpool has opened where the ferry used to cross, and the sea is singing.',
    lore: ['A low song rolls over the water at night.', 'Something enormous sleeps in the deepest part of the whirl.'],
    tint: '#2a5a8a', accent: '#e0f0ff', motif: 'whirlpools, sea caves',
    trigger: { minRegion: 2, favoured: ['water', 'psychic', 'flying'], any: [{ kind: 'partyType', type: 'water' }, { kind: 'partyType', type: 'flying' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'Whirlpools and sea spray: rain on every fight.', weather: 'rain' }, { fromLayer: 4, text: 'A calm falls over the water — the eye of the storm.', terrain: 'psychic' }],
    closes: [{ afterLayer: 1, text: 'A whirlpool swallows one route.' }],
    affinity: { types: ['water', 'flying', 'psychic'], heal: 0.08, text: 'Water, Flying and Psychic Pokémon feel the calm of the whirl.' },
    peril: { types: ['fire', 'ground'], chip: 0.05, text: 'Fire and Ground Pokémon are soaked and slowed.' },
    wild: ['pelipper', 'wailmer', 'sharpedo', 'lapras', 'dewgong', 'tentacruel', 'swanna'],
    npcs: [{ id: 'sea-singer', name: 'The Sea Singer', text: '"If you hum back, it will answer."', options: [{ label: 'Hum back', result: 'The sea answers with a calm that heals.', effect: heal }, { label: 'Listen closely', result: 'You gain research on the song.', effect: { research: 1 } }] }],
    modifiers: ['Rain, then a calm eye', 'Water, Flying and Psychic Pokémon recover HP'],
    finale: { intro: 'The whirl parts. Lugia rises with the sea itself on its wings.', win: 'The sea goes quiet. Lugia dives back into the deep.', lose: 'The whirl carries you to shore. The song fades.' },
    totem: {
      aura: { text: 'The whirl spins around it (Special Defense up).', boost: { spd: 1 }, weather: 'rain' },
      environment: { text: 'The heart of the whirl: rain the whole fight.', weather: 'rain' },
      phases: [
        { atHp: 0.65, text: 'Lugia beats its wings and the whirl tightens.', boost: { spa: 1 }, clearPlayerStages: true },
        { atHp: 0.3, text: 'Aeroblast — the sea is flung into the sky!', boost: { spa: 1, spe: 1 }, cleanse: true },
      ],
    },
  },
  'ho-oh': {
    epithet: 'Rainbow Ascent',
    omen: 'A rainbow has stood over the ridge for three days and no rain has fallen.',
    lore: ['A single feather lies on the path, still warm.', 'The tower has been rebuilt in light.'],
    tint: '#b3541f', accent: '#ffe27a', motif: 'burning tower, rainbow stairs',
    trigger: { minRegion: 2, time: ['day', 'eve'], favoured: ['fire', 'flying'], any: [{ kind: 'partyType', type: 'fire' }, { kind: 'partyType', type: 'flying' }, { kind: 'partyTag', tag: 'legendary' }, { kind: 'friendship', atLeast: 150 }] },
    env: [{ fromLayer: 0, text: 'Rainbow light over a warm tower: harsh sun.', weather: 'sun' }, { fromLayer: 4, text: 'The flames climb with you.', weather: 'sun', terrain: 'grassy' }],
    closes: [{ afterLayer: 2, text: 'A floor of the tower burns away.' }],
    affinity: { types: ['fire', 'flying'], heal: 0.1, text: 'Fire and Flying Pokémon bask in sacred flame and recover.' },
    peril: { types: ['ice', 'rock'], chip: 0.05, text: 'Ice and Rock Pokémon wilt in the heat.' },
    wild: ['rapidash', 'ninetales', 'staraptor', 'talonflame', 'magmortar', 'houndoom', 'pidgeot'],
    npcs: [{ id: 'tower-monk', name: 'The Tower Monk', text: '"The flame does not forgive. It does not need to."', options: [{ label: 'Light a candle', result: 'The flame blesses your team.', effect: heal }, { label: 'Take a feather', result: 'The feather is warm and worth a fortune.', effect: { money: 400 } }] }],
    modifiers: ['Harsh sun over the tower', 'Fire and Flying Pokémon recover HP'],
    finale: { intro: 'The rainbow bends. Ho-Oh descends in a spiral of fire and light.', win: 'The flame softens. Ho-Oh leaves a feather and a rainbow behind.', lose: 'The flame fades and you find yourselves at the foot of the tower.' },
    totem: {
      aura: { text: 'Sacred fire surrounds it (Special Defense up).', boost: { spd: 1 }, weather: 'sun' },
      environment: { text: 'A tower of light: harsh sunlight the whole fight.', weather: 'sun' },
      phases: [
        { atHp: 0.65, text: 'Ho-Oh blazes. The sacred fire spreads.', boost: { atk: 1 }, clearPlayerStages: true },
        { atHp: 0.3, text: 'Sacred Fire — the whole tower burns bright!', boost: { atk: 1, spe: 1 }, cleanse: true },
      ],
      fieldEffect: { status: 'brn', chance: 0.1, text: 'Sacred embers burn your Pokémon.' },
    },
  },
  mewtwo: {
    epithet: 'The Cerulean Cave',
    omen: 'A message appeared in everyone’s dreams: the same cave, the same voice.',
    lore: ['The cave has been sealed for a long time. Tonight it is open.', 'Something made, not born, is waiting for a challenger worth its time.'],
    tint: '#4a2c6a', accent: '#d9b8ff', motif: 'crystal caves, psychic static',
    rarity: 'veryRare',
    trigger: { minRegion: 3, time: ['night'], favoured: ['psychic'], any: [{ kind: 'partyType', type: 'psychic' }, { kind: 'partyTag', tag: 'mythical' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'The cave hums with psychic energy.', terrain: 'psychic' }, { fromLayer: 4, text: 'The walls are shaking with its anger.', terrain: 'psychic', weather: 'hail' }],
    closes: [{ afterLayer: 1, text: 'A crystal wall closes off one route.' }],
    distort: [{ afterLayer: 3, text: 'The cave reshapes itself around you.' }],
    affinity: { types: ['psychic'], heal: 0.1, text: 'Psychic Pokémon feel the hum and recover.' },
    peril: { types: ['bug', 'ghost', 'dark'], chip: 0.06, text: 'Bug, Ghost and Dark Pokémon are unnerved by the pressure.' },
    wild: ['alakazam', 'gardevoir', 'metagross', 'espeon', 'slowking', 'reuniclus', 'hypno'],
    npcs: [{ id: 'cave-scientist', name: 'The Last Scientist', text: '"I made it. I would like to know it forgave me."', options: [{ label: 'Take his notes', result: 'The notes are full of unsettling results.', effect: { research: 2 } }, { label: 'Take his tonic', result: 'It steadies your team.', effect: heal }] }],
    modifiers: ['Psychic terrain through the cave', 'Psychic Pokémon recover HP'],
    finale: { intro: 'The last crystal wall falls. Mewtwo turns, calm and certain.', win: 'The hum fades. Mewtwo regards you once, then leaves the cave to you.', lose: 'The cave pushes you out. Mewtwo does not look back.' },
    totem: {
      aura: { text: 'Psychic pressure fills the cave (Special Attack up).', boost: { spa: 1 }, terrain: 'psychic' },
      environment: { text: 'A crystal cave: Psychic terrain the whole fight.', terrain: 'psychic' },
      phases: [
        { atHp: 0.7, text: 'Mewtwo reads your plan and wipes it away.', boost: { spd: 1 }, clearPlayerStages: true },
        { atHp: 0.4, text: 'Mewtwo’s power surges. The cave cracks.', boost: { spa: 1, spe: 1 } },
        { atHp: 0.2, text: 'Psystrike — it stops holding back!', boost: { spa: 1 }, cleanse: true },
      ],
    },
  },
  articuno: {
    epithet: 'Frozen Sky',
    omen: 'It has started to snow in the middle of summer, from a clear sky.',
    lore: ['The snow does not melt on the hand.', 'A cry rings off the peaks like glass breaking.'],
    tint: '#4a86b0', accent: '#e8faff', motif: 'ice fields, frozen skies',
    trigger: { minRegion: 1, favoured: ['ice', 'flying'], any: [{ kind: 'partyType', type: 'ice' }, { kind: 'partyType', type: 'flying' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'Snow falls over every fight.', weather: 'snow' }, { fromLayer: 4, text: 'A whiteout closes in.', weather: 'hail' }],
    closes: [{ afterLayer: 2, text: 'A snowdrift buries one route.' }],
    affinity: { types: ['ice', 'flying'], heal: 0.08, text: 'Ice and Flying Pokémon enjoy the cold and recover.' },
    peril: { types: ['fire', 'grass', 'bug'], chip: 0.05, text: 'Fire, Grass and Bug Pokémon shiver and lose HP.' },
    wild: ['glalie', 'weavile', 'abomasnow', 'dewgong', 'cloyster', 'piloswine', 'jynx'],
    npcs: [{ id: 'snow-hunter', name: 'The Snow Hunter', text: '"Quiet. It is listening."', options: [{ label: 'Share a fire', result: 'The warmth heals your team.', effect: heal }, { label: 'Track the cry', result: 'You find tracks and a stash of supplies.', effect: { item: 'hyper-potion' } }] }],
    modifiers: ['Snow, then a whiteout', 'Ice and Flying Pokémon recover HP'],
    finale: { intro: 'The snow parts. Articuno glides down from a sky of ice.', win: 'The snow thins. Articuno rises into the clouds.', lose: 'The wind pushes you down the mountain. The snow covers your tracks.' },
    totem: {
      aura: { text: 'A freezing wind surrounds it (Special Defense up).', boost: { spd: 1 }, weather: 'snow' },
      environment: { text: 'A frozen sky: snow the whole fight.', weather: 'snow' },
      phases: [{ atHp: 0.6, text: 'Articuno beats its wings. The cold bites harder.', boost: { spa: 1 }, clearPlayerStages: true }, { atHp: 0.3, text: 'Blizzard — the whiteout is complete!', boost: { spa: 1, spe: 1 }, cleanse: true }],
    },
  },
  zapdos: {
    epithet: 'Thunder Roost',
    omen: 'Lightning has struck the same hilltop forty times tonight.',
    lore: ['The air smells of metal. Every hair on your arm stands up.', 'The storm is not passing. It is perched.'],
    tint: '#8a7a1f', accent: '#fff27a', motif: 'storm towers, lightning rods',
    trigger: { minRegion: 1, favoured: ['electric', 'flying'], any: [{ kind: 'partyType', type: 'electric' }, { kind: 'partyType', type: 'flying' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'A thunderstorm over the stage: electricity in the air.', weather: 'rain', terrain: 'electric' }],
    closes: [{ afterLayer: 2, text: 'A lightning strike shatters one route.' }],
    affinity: { types: ['electric', 'flying'], heal: 0.08, text: 'Electric and Flying Pokémon soak up the charge and recover.' },
    peril: { types: ['water', 'ground'], chip: 0.05, text: 'Water Pokémon are shocked by the storm.' },
    wild: ['electabuzz', 'manectric', 'luxray', 'jolteon', 'ampharos', 'raichu', 'magnezone'],
    npcs: [{ id: 'rod-keeper', name: 'The Rod Keeper', text: '"The rods hold. That is all I can promise."', options: [{ label: 'Stand under a rod', result: 'The charge heals your team.', effect: heal }, { label: 'Take a coil', result: 'It is worth a fortune.', effect: { money: 400, hurt: 0.05 } }] }],
    modifiers: ['Rain and electric terrain over the stage', 'Electric and Flying Pokémon recover HP'],
    finale: { intro: 'The sky cracks. Zapdos lands on the highest tower and the storm folds around it.', win: 'The storm breaks. Zapdos shakes out its wings and rides the thunder away.', lose: 'A bolt hurls you from the tower. The storm moves on.' },
    totem: {
      aura: { text: 'Electricity crackles around it (Speed up).', boost: { spe: 1 }, terrain: 'electric' },
      environment: { text: 'A storm tower: Electric terrain the whole fight.', terrain: 'electric' },
      phases: [{ atHp: 0.6, text: 'The storm gathers.', boost: { spa: 1 }, clearPlayerStages: true }, { atHp: 0.3, text: 'Thunder — Zapdos calls down everything it has!', boost: { spa: 1, spe: 1 }, cleanse: true }],
      fieldEffect: { status: 'par', chance: 0.12, text: 'Static from the storm runs through your Pokémon.' },
    },
  },
  moltres: {
    epithet: 'Ember Peak',
    omen: 'The mountain has been glowing from the inside since dusk.',
    lore: ['The snow melted off the peak in an hour.', 'A flicker in the clouds looks like a wing.'],
    tint: '#a8341d', accent: '#ffc66f', motif: 'volcanic peaks, embers',
    trigger: { minRegion: 1, time: ['day', 'eve'], favoured: ['fire', 'flying'], any: [{ kind: 'partyType', type: 'fire' }, { kind: 'partyType', type: 'flying' }, { kind: 'partyTag', tag: 'legendary' }] },
    env: [{ fromLayer: 0, text: 'The peak is hot: harsh sun.', weather: 'sun' }, { fromLayer: 4, text: 'Ash blows across the slope.', weather: 'sand' }],
    closes: [{ afterLayer: 2, text: 'A lava vent blocks one route.' }],
    affinity: { types: ['fire', 'flying'], heal: 0.08, text: 'Fire and Flying Pokémon feel the warm updrafts and recover.' },
    peril: { types: ['ice', 'grass'], chip: 0.05, text: 'Ice and Grass Pokémon melt and wilt.' },
    wild: ['arcanine', 'magmortar', 'rapidash', 'charizard', 'houndoom', 'torkoal', 'talonflame'],
    npcs: [{ id: 'ember-guide', name: 'The Ember Guide', text: '"Step where the ash is grey. The red is alive."', options: [{ label: 'Follow the grey ash', result: 'A safe path leads to a cache.', effect: { item: 'hyper-potion' } }, { label: 'Take the red path', result: 'It is faster, and it hurts.', effect: { money: 400, hurt: 0.1 } }] }],
    modifiers: ['Harsh sun, then ash', 'Fire and Flying Pokémon recover HP'],
    finale: { intro: 'The summit glows. Moltres lifts out of the crater trailing flame.', win: 'The embers sink. Moltres soars away over the peak.', lose: 'The heat drives you down the slope. The peak glows behind you.' },
    totem: {
      aura: { text: 'Embers swirl around it (Special Attack up).', boost: { spa: 1 }, weather: 'sun' },
      environment: { text: 'The crater: harsh sunlight the whole fight.', weather: 'sun' },
      phases: [{ atHp: 0.6, text: 'Moltres blazes brighter.', boost: { spa: 1 }, clearPlayerStages: true }, { atHp: 0.3, text: 'Sky Attack — it plunges into the fight!', boost: { atk: 1, spe: 1 }, cleanse: true }],
      fieldEffect: { status: 'brn', chance: 0.1, text: 'Embers from the crater burn your Pokémon.' },
    },
  },
};
