#!/usr/bin/env python3
"""Hub Town builder (offline asset tool, Python 3 + Pillow).

Turns tools/hubtown/layout.py into the game's Hub Town data and atlases, cutting every tile and building
straight out of the Pokémon-Memories tilesets (github.com/AwsomSause/Pokemon-Memories):

  public/assets/images/overworld/hubtown_tiles.png   ground tiles in a 16-column grid (32 px)
  public/assets/images/overworld/hubtown_props.png   buildings, trees and props (+ .json, Phaser hash atlas)
  public/assets/images/overworld/trainers/*.png      trainer walk sheets (4x4 frames) copied as-is
  src/data/hubTown.json                              map: ground/overlay layers, props, solid tiles, places

Usage:  python3 tools/hubtown/build.py "<clone>/Pokemon Memories"
The followers (public/assets/images/overworld/followers/*.png) were copied as-is from Graphics/Characters/Followers;
this tool only records their frame sizes in src/data/overworld.json. Provenance: docs/status/hub-town.md.
"""
import json, os, random, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import layout as L
from extract import extract, cache, TS as TS_FILES
import extract as EX

SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('POKEMON_MEMORIES', '')
G = os.path.join(SRC, 'Graphics')
EX.G = os.path.join(G, 'Tilesets') + '/'
T = 32
OUT_IMG = os.path.join(ROOT, 'public/assets/images/overworld')
os.makedirs(OUT_IMG, exist_ok=True)

TS = {k: Image.open(EX.G + v).convert('RGBA') for k, v in TS_FILES.items()}
for k, v in TS.items(): cache[k] = v

# ---------- stamps ----------
STAMPS = {}
for line in open(os.path.join(HERE, 'stamps.txt')):
    p = line.split()
    if not p: continue
    a = list(map(int, p[2:]))
    (rx, ry, rw, rh), _ = extract(p[1], *a[:4], pad=a[4])
    STAMPS[p[0]] = (p[1], rx, ry, rw, rh)
FENCE = {f'fence_{ex}{ey}': ('g4', ex * T, (131 + ey) * T, T, T) for ex in range(3) for ey in range(3) if not (ex == 1 and ey == 1)}
STAMPS.update(FENCE)

BUILDINGS = {'arena', 'memories', 'achv', 'dojo', 'tower', 'hq', 'flowershop', 'pc', 'bank', 'mart2', 'eventhall', 'prep', 'tent',
             'house_red', 'house_b', 'house_c', 'house_d', 'thatch', 'blue_house', 'blue_house2', 'pool', 'octfount'}
TREES = {'tree', 'pine', 'cherry', 'pinktree'}
WALKABLE = {'pier'}

def stamp_img(n):
    ts, x, y, w, h = STAMPS[n]
    return TS[ts].crop((x, y, x + w, y + h))

def footprint(n, px, py):
    """Solid tiles of a stamp placed with its top-left at (px, py) map pixels."""
    if n in WALKABLE: return []
    im = stamp_img(n); a = im.split()[3].point(lambda v: 255 if v > 200 else 0)
    w, h = im.size
    rows = max(1, round(h / T))
    keep = rows - 1 if n in BUILDINGS else (2 if n in TREES or n == 'arch' else rows)
    keep = max(1, keep)
    bottom_px = py + (a.getbbox() or (0, 0, w, h))[3]
    tiles = set()
    for ty in range(int(py // T), int((py + h - 1) // T) + 1):
        if ty * T + T <= bottom_px - keep * T: continue
        for tx in range(int(px // T), int((px + w - 1) // T) + 1):
            x0, y0 = max(tx * T, px), max(ty * T, py); x1, y1 = min(tx * T + T, px + w), min(ty * T + T, py + h)
            if x1 <= x0 or y1 <= y0: continue
            box = a.crop((int(x0 - px), int(y0 - py), int(x1 - px), int(y1 - py)))
            cover = sum(box.histogram()[255:]) / (T * T)
            if cover >= 0.28: tiles.add((tx, ty))
    return sorted(tiles)

# ---------- ground ----------
W, H = L.W, L.H
rnd = random.Random(7)
grass = [('vr', 1, 1)] * 6 + [('vr', 0, 0)] * 3 + [('vr', 1, 0), ('vr', 0, 1), ('vr', 0, 2)]
ground = [[rnd.choice(grass) for _ in range(W)] for _ in range(H)]
overlay = [[None] * W for _ in range(H)]

def rect_set(x, y, w, h): return {(xx, yy) for xx in range(x, x + w) for yy in range(y, y + h)}

# door stubs: every building door meets a path
path_mask = set()
for r in L.paths: path_mask |= rect_set(*r)
px_, py_, pw_, ph_ = L.plaza_ring
path_mask |= rect_set(*L.plaza_ring)

places = []
props = []      # (frame, px, py, depth)
solid = set()

def place(n, x, y):
    px, py = round(x * T), round(y * T)
    im = stamp_img(n); a = im.split()[3].point(lambda v: 255 if v > 200 else 0)
    bb = a.getbbox() or (0, 0, im.width, im.height)
    props.append((n, px, py, py + bb[3]))
    fp = footprint(n, px, py)
    solid.update(fp)
    return px, py, im.width, im.height, fp

def door_for(fp, px, w, frac):
    if not fp: return None
    bottom = max(t[1] for t in fp)
    target = (px + w * frac) / T
    row = [t for t in fp if t[1] == bottom]
    return min(row, key=lambda t: abs(t[0] + 0.5 - target))

for (lid, name, n, x, y, frac, rooms, blurb) in L.locations:
    px, py, w, h, fp = place(n, x, y)
    dx, dy = door_for(fp, px, w, frac)
    # carve a stub path from the door down to the nearest road; a stub that would cross a fence (or never meets a
    # road) becomes a short doorstep instead, so no path runs into a fence
    fenced = set()
    for fx, fy, fw, fh, _gaps in L.fences: fenced |= rect_set(fx, fy, fw, fh)
    stub, met = [], False
    for yy in range(dy + 1, dy + 10):
        if (dx, yy) in path_mask: met = True; break
        if any((xx, yy) in fenced for xx in (dx - 1, dx, dx + 1)): break
        stub.append(yy)
    for yy in (stub if met else stub[:1]):
        for xx in (dx - 1, dx, dx + 1): path_mask.add((xx, yy))
    places.append({'id': lid, 'name': name, 'kind': 'building', 'rooms': rooms, 'blurb': blurb,
                   'door': {'x': dx, 'y': dy}, 'stand': {'x': dx, 'y': dy + 1, 'facing': 'up'}})
for (sid, name, n, x, y, rooms, blurb) in L.spots:
    px, py, w, h, fp = place(n, x, y)
    if n == 'arch':
        cx = int((px + w / 2) // T); by = int((py + h) // T) - 1
        # walking through the arch: the trigger is the middle of the gateway
        # the gateway tile itself is the trigger: stepping onto it asks first (never starts anything by walking alone)
        inside = 'up' if by > H // 2 else 'down'
        places.append({'id': sid, 'name': name, 'kind': 'gate', 'rooms': rooms, 'blurb': blurb,
                       'door': {'x': cx, 'y': by}, 'stand': {'x': cx, 'y': by - 1 if inside == 'up' else by + 1, 'facing': 'down' if inside == 'up' else 'up'}})
    else:
        tx, ty = (fp[-1] if fp else (int(x), int(y + 1)))
        places.append({'id': sid, 'name': name, 'kind': 'sign', 'rooms': rooms, 'blurb': blurb,
                       'door': {'x': tx, 'y': ty}, 'stand': {'x': tx, 'y': ty + 1, 'facing': 'up'}})
for n, x, y in L.objects: place(n, x, y)

# trees: keep off roads, doors and the gateways
blockers = set(path_mask)
for p in places: blockers |= {(p['stand']['x'] + d, p['stand']['y'] + e) for d in (-1, 0, 1) for e in (0, 1)}
for b in [[52, 72, 9, 12], [20, 0, 10, 8]]: blockers |= rect_set(*b)
for n, x, y in L.trees:
    if rect_set(int(x), int(y) + 2, 3, 2) & blockers: continue
    place(n, x, y)

# fences
for fx, fy, fw, fh, gaps in L.fences:
    gaps = set(map(tuple, gaps))
    for xx in range(fx, fx + fw):
        for yy in range(fy, fy + fh):
            ex = 0 if xx == fx else (2 if xx == fx + fw - 1 else 1); ey = 0 if yy == fy else (2 if yy == fy + fh - 1 else 1)
            if (ex == 1 and ey == 1) or (xx, yy) in gaps: continue
            props.append((f'fence_{ex}{ey}', xx * T, yy * T, yy * T + T)); solid.add((xx, yy))

def blob(mask, ts, base, inner=None, layer=ground):
    bx, by = base
    for (x, y) in mask:
        if not (0 <= x < W and 0 <= y < H): continue
        n = lambda dx, dy: (x + dx, y + dy) in mask
        cx = 0 if not n(-1, 0) else (2 if not n(1, 0) else 1); cy = 0 if not n(0, -1) else (2 if not n(0, 1) else 1)
        t = (bx + cx, by + cy)
        if inner and cx == 1 and cy == 1:
            ix, iy = inner
            if not n(-1, -1): t = (ix, iy)
            elif not n(1, -1): t = (ix + 1, iy)
            elif not n(-1, 1): t = (ix, iy + 1)
            elif not n(1, 1): t = (ix + 1, iy + 1)
        layer[y][x] = (ts, *t)

blob(path_mask, 'vr', (0, 21), (3, 21))
x0, y0, w0, h0 = L.plaza
for yy in range(y0, y0 + h0):
    for xx in range(x0, x0 + w0): ground[yy][xx] = ('vr', 5 + (xx - x0) % 3, (yy - y0) % 3)
water_tiles = set()
for r in L.water: blob(rect_set(*r), 'g4', (0, 8)); water_tiles |= rect_set(*r)
for r in L.beach:
    blob(rect_set(*r), 'g4', (5, 5)); bx, by, bw, bh = r
    water_tiles |= rect_set(bx + 1, by + 1, bw - 2, bh - 2)
for bx, by in L.bridges:
    for i in range(3):
        for j in range(3): overlay[by + j][bx + i] = ('vr', 2 + i, 75 + j); water_tiles.discard((bx + i, by + j))
for d in L.decals:
    ts, c, r, x, y = d
    if 0 <= x < W and 0 <= y < H and (x, y) not in path_mask and not (x0 <= x < x0 + w0 and y0 <= y < y0 + h0): overlay[y][x] = (ts, c, r)
solid |= water_tiles
# the pier is walkable over the lake
for n, x, y in L.objects:
    if n in WALKABLE:
        im = stamp_img(n)
        for xx in range(int(x), int(x + im.width / T + 0.5)):
            for yy in range(int(y), int(y + im.height / T + 0.5)): solid.discard((xx, yy))

# ---------- atlases ----------
uniq = []
idx = {}
def tid(t):
    if t is None: return -1
    if t not in idx: idx[t] = len(uniq); uniq.append(t)
    return idx[t]
g_layer = [tid(ground[y][x]) for y in range(H) for x in range(W)]
o_layer = [tid(overlay[y][x]) for y in range(H) for x in range(W)]
COLS = 16
rows = (len(uniq) + COLS - 1) // COLS
tiles_img = Image.new('RGBA', (COLS * T, rows * T))
for i, (ts, c, r) in enumerate(uniq): tiles_img.alpha_composite(TS[ts].crop((c * T, r * T, c * T + T, r * T + T)), ((i % COLS) * T, (i // COLS) * T))
tiles_img.save(os.path.join(OUT_IMG, 'hubtown_tiles.png'), optimize=True)

used = sorted({p[0] for p in props})
# shelf-pack the props (tallest first) into a 1024-wide sheet with 2 px padding
items = sorted(used, key=lambda n: -STAMPS[n][4])
x = y = shelf = 0; frames = {}; SHEET_W = 1024
for n in items:
    w, h = STAMPS[n][3], STAMPS[n][4]
    if x + w > SHEET_W: x = 0; y += shelf + 2; shelf = 0
    frames[n] = (x, y, w, h); x += w + 2; shelf = max(shelf, h)
sheet = Image.new('RGBA', (SHEET_W, y + shelf))
for n, (fx, fy, w, h) in frames.items(): sheet.alpha_composite(stamp_img(n), (fx, fy))
sheet.save(os.path.join(OUT_IMG, 'hubtown_props.png'), optimize=True)
json.dump({'frames': {n: {'frame': {'x': fx, 'y': fy, 'w': w, 'h': h}} for n, (fx, fy, w, h) in frames.items()},
           'meta': {'image': 'hubtown_props.png', 'size': {'w': SHEET_W, 'h': y + shelf}, 'scale': '1'}},
          open(os.path.join(OUT_IMG, 'hubtown_props.json'), 'w'))

# ---------- trainers ----------
TRAINERS = ['trBackpacker_F', 'trBattleGirl', 'trBlackBelt', 'trDancer', 'trFisher', 'trFurisodeGirl_Kali', 'trGentleman', 'trHiker',
            'trParasolLady', 'trSchoolKid_F', 'trScientist_F', 'trSwimmer_M', 'trWaitress', 'trainer_POKEMONTRAINER_Leaf',
            'trainer_POKEMONTRAINER_Red', 'trainer_YOUNGSTER', 'YOUNGSTER', 'LASS', 'NPC_008_Black_Belt', 'NPC_009_Battle_Girl',
            'NPC_113_Mart_M', 'NPC_114_Mart_F', 'NPC_Sonia', 'NPC 11', 'NPC40', 'NPC_074', '071-Ace Trainer Male', '072-Ace Trainer Female',
            'ace trainer f', 'hood man', 'POKEMONBREADER2', 'blue overworld', 'brendan_walk', 'boy_run', 'girl_run', 'nemona', 'steve',
            'Zinnia', 'Emma', 'Jane', 'Einer', 'Gab overworld', 'essentia', 'Mia_walk', 'Raya_walk', '003-Gladion', '022-Lusamine',
            '055-Aether Employee Female', 'trchar150', 'trchar154']
safe = lambda s: re.sub(r'[^A-Za-z0-9]+', '_', s).strip('_')
os.makedirs(os.path.join(OUT_IMG, 'trainers'), exist_ok=True)
trainers = []
for t in TRAINERS:
    f = os.path.join(G, 'Characters', t + '.png')
    if not os.path.exists(f): continue
    im = Image.open(f)
    if im.size != (256, 256): continue
    shutil.copyfile(f, os.path.join(OUT_IMG, 'trainers', safe(t) + '.png')); trainers.append(safe(t))

# ---------- followers ----------
fdir = os.path.join(OUT_IMG, 'followers')
followers = {}
for f in sorted(os.listdir(fdir)):
    if f.endswith('.png'): followers[f[:-4]] = Image.open(os.path.join(fdir, f)).width // 4
json.dump({'trainers': trainers, 'followers': followers}, open(os.path.join(ROOT, 'src/data/overworld.json'), 'w'), separators=(',', ':'))

# ---------- map json ----------
props.sort(key=lambda p: (p[3], p[1]))
for k in L.keepers: k['sprite'] = safe(k['sprite'])
out = {
    'size': [W, H], 'tile': T, 'columns': COLS,
    'ground': g_layer, 'overlay': o_layer,
    'props': [[n, px, py, d] for n, px, py, d in props],
    'solid': sorted([x, y] for x, y in solid if 0 <= x < W and 0 <= y < H),
    'water': [list(r) for r in L.water],
    'places': places, 'spawn': next(({'x': p['stand']['x'], 'y': p['stand']['y'], 'facing': 'up'} for p in places if p['id'] == 'prep'), L.spawn), 'keepers': L.keepers, 'zones': L.zones,
    'pads': [[50, 35], [61, 35], [48, 41], [65, 41], [50, 47], [61, 47]],
}
json.dump(out, open(os.path.join(ROOT, 'src/data/hubTown.json'), 'w'), separators=(',', ':'))
print(f'tiles {len(uniq)}  props {len(frames)} frames / {len(props)} placed  solid {len(solid)}  places {len(places)}  trainers {len(trainers)}  followers {len(followers)}')
