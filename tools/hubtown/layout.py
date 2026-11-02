# Hub Town layout: the single hand-placed source of the town map (Hub Town spec, 2026-11-01).
# build.py turns this into src/data/hubTown.json and the two overworld atlases. Tile units are 32 px.
# Coordinates: x right, y down; objects are placed by their top-left corner (fractions allowed).

import random

W, H = 112, 84
R = random.Random(11)

paths = [
    [55, 21, 3, 14], [55, 48, 3, 33],          # north spine / south spine to the Departure Gate
    [8, 40, 39, 3], [66, 40, 40, 3],           # west road / east road
    [20, 19, 74, 3],                           # north avenue
    [22, 62, 72, 3],                           # south avenue
    [24, 5, 3, 15],                            # road up to the Pocket Town gate
    [11, 22, 3, 18],                           # lane to the flower field
    [14, 43, 3, 5], [90, 43, 3, 3],  # lanes to Corner Nook house, orchard, sanctuary
    [30, 65, 3, 4], [22, 65, 3, 3],            # meadow + camp lanes
]
# door stubs (filled in from the locations below so every door meets a path)
plaza = [45, 33, 24, 16]
# a soft sandy ring around the plaza so the stone fades into the grass (Kice, 2026-11-02)
plaza_ring = [43, 31, 28, 20]

water = [[88, 4, 18, 12], [75, 18, 3, 29], [8, 63, 10, 7], [86, 50, 6, 4]]   # lake, canal, grove pond, sanctuary pond
beach = [[86, 66, 21, 13]]                                                   # seaside cove
bridges = [[75, 19], [75, 40]]                                               # canal crossings (3x3)

# Interactive places. door = the tile you face (inside the building's footprint, bottom row) or the spot to stand on.
# rooms = the existing Hub rooms (scenes/HubScene.ts Room) this place opens.
locations = [
    # id, name, stamp, x, y, door x offset (fraction of width), rooms, blurb
    ('arena', 'Competitive Arena', 'arena', 52.5, 10.3, 0.5, ['archive', 'intel'], 'Trainers, their unlocks, rival records and League intel.'),
    ('memories', 'Hall of Memories', 'memories', 70.5, 7.5, 0.5, ['legacy', 'memories', 'fame', 'tales'], 'Every past Trainer, their Aces, the Hall of Fame and the stories NPCs remember.'),
    ('achievements', 'Achievement Hall', 'achv', 34, 10, 0.5, ['achievements', 'museum', 'codex'], 'Trophies, milestones, the item museum and the Moment Codex.'),
    ('dojo', 'Mentor Dojo', 'dojo', 42, 13, 0.5, ['mentors'], 'Your mentors and apprentices.'),
    ('institute', 'Research Institute', 'tower', 84, 12, 0.5, ['tree', 'moves', 'research'], 'The Research Tree, move research and the Pokédex collection sets.'),
    ('hq', 'Player HQ', 'hq', 29, 31.4, 0.5, ['card', 'attributes', 'history', 'prestige', 'save'], 'Your profile, attributes, run history, prestige and save data.'),
    ('boutique', 'Trainer Boutique', 'flowershop', 19, 34, 0.5, ['wardrobe', 'card'], 'Titles and card frames.'),
    ('center', 'Pokémon Center', 'pc', 80, 33, 0.5, ['mastery', 'research', 'moves', 'hubmon'], 'Inspect every Pokémon you met, and choose the one that walks with you in town.'),
    ('bank', 'Pokémon Bank', 'bank', 90.5, 34.4, 0.33, ['bank'], 'Bank credits, tiers and licenses.'),
    ('events', 'Event Hall', 'eventhall', 98, 33.3, 0.5, ['events'], "This week's event, holidays, contracts and objectives."),
    ('prep', 'Run Prep Center', 'prep', 41, 53.7, 0.5, ['run'], 'Choose a trainer, a starter and your bonuses, then set off.'),
    ('post', 'Network Post', 'mart2', 25, 53.4, 0.33, ['network', 'seeds'], 'Parcels from the Trainer Network and the Seed Shelf.'),
    ('nook', 'Corner Nook', 'house_red', 19, 43.6, 0.6, ['nook'], 'A fortune cookie, a wish, a note to your future self.'),
    ('merchant', 'Strange Merchant', 'tent', 62, 54.4, 0.5, ['merchant'], 'Odd wares, limited stock, a new rotation every day.'),
]
# Places that are not buildings: a sign, a gate, a board. (id, name, x, y, w, h solid?, rooms, blurb)
spots = [
    ('gate', 'Departure Gate', 'arch', 52, 74, ['depart'], 'Leave Hub Town and start your run (asks first).'),
    ('pocket', 'Pocket Town Gate', 'arch', 21.5, 1.6, ['town'], 'The road to Pocket Town: gardens, a dojo, a library and more.'),
    ('board', 'Event Board', 'board', 46, 29.5, ['events'], "What's on this week."),
    ('sanctuary', 'Starter Sanctuary', 'sign', 94, 43.3, ['lab', 'quests'], 'Starter sets by category and each trainer\'s quest line.'),
    ('orchard', 'Berry Orchard', 'sign', 13, 48.4, ['tales'], 'The orchard keeper remembers every run.'),
]

objects = []   # [stamp, x, y]
O = lambda n, x, y: objects.append([n, x, y])
for x, y in [(47, 12.5), (62, 12.5)]: O('statue', x, y)
O('banner', 50, 14); O('banner', 62.5, 14)
O('pool', 51.6, 35)                                       # grand fountain
for x, y in [(44, 30.5), (69, 30.5), (44, 46.5), (69, 46.5), (53, 17), (59.5, 17), (53, 72), (59.5, 72), (21, 58.5), (94, 58.5)]: O('lamp', x, y)
for x, y in [(47, 39), (66, 39), (47, 44), (66, 44)]: O('bench', x, y)
for x, y in [(45.2, 33.2), (66.6, 33.2), (45.2, 46.6), (66.6, 46.6)]: O('bush', x, y)
for x, y in [(30, 17), (40, 23), (66, 23), (78, 23), (47, 26), (61, 26), (47, 50.5), (61, 50.5), (28, 44), (70, 44.2)]: O('hedge', x, y)
O('well', 9, 47); O('octfount', 92, 24); O('counter', 67, 56.5)
O('house_c', 36, 43.6)
for n, x, y in [('house_b', 96, 22.3), ('house_c', 100.5, 22.5), ('thatch', 8, 6.5), ('house_d', 14, 13.6), ('blue_house2', 63, 24.4),
                ('house_c', 30, 24.4), ('thatch', 73, 66.5), ('house_b', 8, 30.4)]: O(n, x, y)
O('pier', 96, 13.4); O('pier', 96, 15.2)
for x, y in [(95, 15), (101, 15)]: O('torch', x, y)
for x, y in [(84, 47.6), (102, 47.6)]: O('flowerbox', x, y)
O('sign', 58, 72.3); O('sign', 27, 4.5); O('sign', 88, 44.3)
for x in range(24, 94, 8): O('lamp', x, 17.2)
for x in range(26, 92, 8): O('lamp', x, 60.2)
O('torch', 20, 66); O('torch', 24, 66); O('parasol', 20, 68)
for x, y in [(82, 48), (98, 48), (101, 55), (84, 56)]: O('cherry', x, y)

fences = [[80, 46, 26, 16, [[89, 46], [90, 46], [91, 46], [92, 46]]], [8, 50, 17, 10, [[14, 50], [15, 50], [16, 50]]]]

decals = []
fl = [(0, 4), (1, 4), (0, 5), (1, 5), (0, 6), (0, 7), (1, 7), (0, 8), (1, 8)]
for x in range(8, 19):
    for y in range(24, 34):
        if R.random() < 0.75: decals.append(['vr', *R.choice(fl), x, y])
for x in range(95, 105):
    for y in range(55, 60): decals.append(['vr', 2, 0, x, y])
for x in range(81, 88):
    for y in range(55, 60): decals.append(['vr', 3 + R.randint(0, 1), 3 + R.randint(0, 1), x, y])
for x in range(30, 40):
    for y in range(66, 72):
        if R.random() < 0.8: decals.append(['vr', 2, 0, x, y])
for x, y in [(15, 20), (31, 30), (64, 31), (98, 29), (102, 69), (75, 72)]:
    for i in range(3): decals.append(['vr', 3 + (i % 2), 3 + (i // 2), x + i, y])
# flowers and tufts scattered just outside the plaza ring, so the stone square melts into the meadow
ring_out = [43, 31, 28, 20]
for _ in range(70):
    side = R.randint(0, 3); rx, ry, rw, rh = ring_out
    if side == 0: x, y = R.randint(rx - 2, rx + rw + 1), R.randint(ry - 3, ry - 1)
    elif side == 1: x, y = R.randint(rx - 2, rx + rw + 1), R.randint(ry + rh, ry + rh + 2)
    elif side == 2: x, y = R.randint(rx - 3, rx - 1), R.randint(ry, ry + rh)
    else: x, y = R.randint(rx + rw, rx + rw + 2), R.randint(ry, ry + rh)
    decals.append(['vr', *R.choice(fl + [(3, 5), (4, 5), (3, 7), (4, 7)]), x, y])

trees = []
def forest(x0, y0, x1, y1, kind='tree'):
    for yy in range(y0, y1 + 1, 2):
        for xx in range(x0 + ((yy // 2) % 2), x1 + 1, 2): trees.append([kind, xx, yy])
forest(0, 0, W - 3, 1); forest(0, H - 6, W - 3, H - 4); forest(0, 2, 3, H - 6); forest(W - 6, 2, W - 3, H - 6)
for x, y in [(14, 8), (16, 10), (36, 25), (70, 26), (30, 66), (40, 70), (64, 68), (72, 66), (18, 70), (6, 14), (44, 4), (66, 3), (97, 30), (104, 40), (8, 76),
             (38, 4), (41, 6), (60, 4), (10, 36), (20, 47), (34, 48), (70, 50), (74, 54), (46, 66), (48, 69), (66, 66), (78, 60), (30, 74), (36, 76), (80, 74), (100, 28), (91, 26)]:
    trees.append(['tree', x, y])
for x, y in [(29, 6), (33, 7), (78, 4), (81, 6), (5, 22), (5, 26), (101, 45), (101, 50), (84, 6)]: trees.append(['pine', x, y])

# Where you appear on a fresh visit: in front of the Run Prep Center door, facing it (so Enter starts preparing a run).
spawn = {'x': 44, 'y': 62, 'facing': 'up'}
# Static NPCs that belong to a place (the roster of wanderers is chosen at run time by core/hubTown/roster.ts).
keepers = [
    {'id': 'merchant', 'sprite': 'hood_man', 'x': 64, 'y': 61, 'facing': 'down', 'location': 'merchant'},
    {'id': 'gatekeeper', 'sprite': 'NPC_Sonia', 'x': 54, 'y': 78, 'facing': 'down', 'location': 'gate'},
    {'id': 'sanctuary_keeper', 'sprite': 'POKEMONBREADER2', 'x': 93, 'y': 47, 'facing': 'down', 'location': 'sanctuary'},
    {'id': 'orchard_keeper', 'sprite': 'trHiker', 'x': 16, 'y': 52, 'facing': 'down', 'location': 'orchard'},
]
# Wander zones: named areas the roster spreads its trainers and Pokémon over (x, y, w, h in tiles).
zones = {
    'plaza': [46, 34, 22, 14], 'north': [22, 18, 70, 6], 'west': [8, 22, 34, 22], 'east': [66, 22, 38, 22],
    'south': [24, 58, 66, 12], 'sanctuary': [81, 47, 24, 14], 'orchard': [9, 51, 15, 8], 'lake': [86, 16, 20, 6],
    'cove': [80, 62, 6, 14], 'meadow': [28, 64, 14, 10], 'grove': [6, 58, 16, 14], 'flowers': [8, 24, 11, 10],
}
