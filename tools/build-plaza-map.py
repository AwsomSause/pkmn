"""Bakes the Trainer Plaza tile map (Plaza styles, Kice 2026-11-02) from the Pokemon-Memories tilesets.

Usage: python3 tools/build-plaza-map.py "<path to Pokemon Memories/Graphics>"
Writes public/assets/images/packs/memories/plaza/map.png (60 x 34 tiles of 32 px, no people). The crowd uses
Hub Town's trainer walk sheets (public/assets/images/overworld/trainers/). The district spots in
src/core/presentation/plazaStyles.ts use this map's tile grid; keep them in step if the layout moves.
Source: AwsomSause/Pokemon-Memories (gen4Outside, PokemonGaiaTileset, tileset_ville_route).
"""
import os, random, sys
from PIL import Image

GFX = sys.argv[1].rstrip('/') + '/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'images', 'packs', 'memories', 'plaza')
T = 32
TS = {k: Image.open(GFX + 'Tilesets/' + f).convert('RGBA') for k, f in
      (('g4', 'gen4Outside.png'), ('vr', 'tileset_ville_route.png'), ('ga', 'PokemonGaiaTileset.png'))}

# Stamps: [tileset, x, y, w, h] crops (fixed) or ('auto', tileset, x0, y0, x1, y1) trimmed to their pixels.
STAMPS = {
    'pc': ['g4', 14, 4736, 210, 224], 'tent': ['g4', 8, 14094, 152, 178], 'octfount': ['ga', 114, 12324, 126, 126],
    'board': ['ga', 8, 4672, 94, 160], 'lamp': ['vr', 8, 1672, 40, 88], 'bench': ['vr', 132, 1746, 60, 46],
    'bush': ['ga', 194, 4518, 62, 58], 'statue': ['ga', 64, 5672, 96, 152], 'hedge': ['ga', 10, 5000, 174, 56],
    'tree': ['g4', 6, 1306, 84, 102], 'pine': ['g4', 6, 2074, 84, 102], 'cherry': ['g4', 0, 3226, 94, 102],
    'flowerbox': ['vr', 224, 1792, 32, 64],
    'shop_teal': ('auto', 'g4', 0, 5568, 192, 5790), 'cafe': ('auto', 'g4', 0, 5790, 192, 5992),
    'tent_o': ('auto', 'g4', 0, 14408, 160, 14604), 'counter_o': ('auto', 'g4', 0, 14606, 160, 14716),
    'stall_blue': ('auto', 'ga', 0, 36320, 96, 36424), 'stall_red': ('auto', 'ga', 0, 36424, 96, 36520),
    'stall_yellow': ('auto', 'ga', 0, 36520, 96, 36616), 'stall_green': ('auto', 'ga', 0, 36616, 96, 36712),
    'bunting': ('auto', 'ga', 0, 25984, 256, 26208),
    'para_red': ('auto', 'ga', 0, 27808, 64, 27900), 'para_green': ('auto', 'ga', 64, 27900, 128, 28000), 'para_pink': ('auto', 'ga', 128, 27900, 192, 28000),
}

def stamp(n):
    s = STAMPS[n]
    if s[0] == 'auto':
        _, ts, x0, y0, x1, y1 = s; im = TS[ts].crop((x0, y0, x1, y1)); return im.crop(im.getbbox())
    ts, x, y, w, h = s; return TS[ts].crop((x, y, x + w, y + h))

def tile(ts, c, r): return TS[ts].crop((c * T, r * T, (c + 1) * T, (r + 1) * T))

OX, OY = 8, 2          # the plaza sits at this tile offset inside the padded map
W, H = 44 + 2 * OX, 30 + 2 * OY

def objects():
    o = []
    add = lambda n, x, y: o.append((n, x + OX, y + OY))
    add('shop_teal', 8, 0.6); add('pc', 29, 1.0); add('tent_o', 1.2, 9.5); add('counter_o', 1.2, 15.6)
    add('cafe', 37.2, 9.6); add('tent', 38.6, 19.4); add('octfount', 19.5, 12.2); add('board', 15.5, 9.4)
    for i, s in enumerate(['stall_blue', 'stall_red', 'stall_yellow', 'stall_green']): add(s, 15 + i * 3.2, 4.6)
    add('bunting', 17.5, -0.4)
    for i, p in enumerate(['para_red', 'para_green', 'para_pink']): add(p, 32 + i * 2, 15.2 + (i % 2) * 1.6)
    for x in (7, 36):
        for y in (8, 21): add('lamp', x, y - 2)
    add('bench', 11, 19); add('bench', 29, 19); add('bush', 7.2, 19.6); add('bush', 34, 7.2); add('statue', 33.5, 5.0)
    add('hedge', 28, 23.6); add('hedge', 8, 23.6); add('hedge', 12, 23.6)
    for x in range(0, 44, 3):
        if 18 <= x <= 24 or x >= 36: continue
        add('tree' if (x // 3) % 2 else 'pine', x, 26.2)
    for y in range(0, 6, 4): add('tree', -1, y); add('tree', 42, y)
    add('cherry', 3, 3); add('cherry', 25.5, 0.2); add('cherry', 40, 4)
    add('flowerbox', 14.4, 7.3); add('flowerbox', 27.6, 7.3)
    # border woods around the padded edge
    for x in list(range(0, OX - 2, 3)) + list(range(44 + OX + 1, W, 3)):
        for y in range(-1, H, 3): o.append(('tree' if (x + y) % 2 else 'pine', x, y))
    return o

def render():
    img = Image.new('RGBA', (W * T, H * T)); rnd = random.Random(7)
    grass = [(1, 1)] * 6 + [(0, 0)] * 3 + [(1, 0), (0, 1), (0, 2)]
    for y in range(H):
        for x in range(W): img.alpha_composite(tile('vr', *rnd.choice(grass)), (x * T, y * T))
    path = {(x, y) for x in range(20 + OX, 24 + OX) for y in range(22 + OY, H)}
    for (x, y) in path:
        n = lambda dx, dy: (x + dx, y + dy) in path
        cx = 0 if not n(-1, 0) else (2 if not n(1, 0) else 1); cy = 0 if not n(0, -1) else (2 if not n(0, 1) else 1)
        img.alpha_composite(tile('vr', cx, 21 + cy), (x * T, y * T))
    px, py, pw, ph = 6 + OX, 8 + OY, 32, 15
    for yy in range(py, py + ph):
        for xx in range(px, px + pw): img.alpha_composite(tile('vr', 5 + (xx - px) % 3, (yy - py) % 3), (xx * T, yy * T))
    objs = []
    for n, x, y in objects():
        im = stamp(n); objs.append((y * T + im.height, x * T, y * T, im))
    objs.sort(key=lambda o: (o[0], o[1]))
    for _, x, y, im in objs: img.alpha_composite(im, (int(x), int(y)))
    return img

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    render().save(os.path.join(OUT, 'map.png'), optimize=True)
    print('plaza map', W, 'x', H, 'tiles')
