#!/usr/bin/env python3
"""Imports animated Essentials/EBDX Pokémon sprite strips as Phaser atlases for species that are
static in the game. Usage: importPackSprites.py <Graphics/Pokemon dir> <list.json> [gen-min gen-max]
list.json: [[speciesId, spriteFile, inGameFrames, packName, packFrames], ...]"""
import json, os, sys
from PIL import Image

pack, listing = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'images', 'pokemon')
files = {}
for sub in ('Front', 'Back', 'Front shiny', 'Back shiny'):
    files[sub] = {os.path.splitext(f)[0]: f for f in os.listdir(os.path.join(pack, sub))}
targets = {'Front': '', 'Back': 'back/', 'Front shiny': 'shiny/', 'Back shiny': 'back/shiny/'}
MAXW = 2048


def convert(src, dest):
    im = Image.open(src).convert('RGBA')
    h = im.height
    n = im.width // h
    if n < 1:
        return False
    cells = [im.crop((i * h, 0, i * h + h, h)) for i in range(n)]
    box = None
    for c in cells:
        b = c.getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return False
    cells = [c.crop(box) for c in cells]
    w, ch = cells[0].size
    cols = max(1, min(n, MAXW // w))
    rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * w, rows * ch))
    frames = []
    for i, c in enumerate(cells):
        x, y = (i % cols) * w, (i // cols) * ch
        sheet.paste(c, (x, y))
        frames.append({'filename': f'{i + 1:04d}.png', 'rotated': False, 'trimmed': False,
                       'sourceSize': {'w': w, 'h': ch}, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': ch},
                       'frame': {'x': x, 'y': y, 'w': w, 'h': ch}})
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sheet.save(dest + '.png', optimize=True)
    json.dump({'textures': [{'image': os.path.basename(dest) + '.png', 'format': 'RGBA8888',
                             'size': {'w': sheet.width, 'h': sheet.height}, 'scale': 1, 'frames': frames}]},
              open(dest + '.json', 'w'), separators=(',', ':'))
    return True


done = 0
for row in json.load(open(listing)):
    sid, sprite, _n, name, pf = row[:5]
    if not name or not pf or pf < 2:
        continue
    for sub, prefix in targets.items():
        if len(row) > 5 and sub not in row[5]:  # optional: only these kinds
            continue
        f = files[sub].get(name)
        if f and convert(os.path.join(pack, sub, f), os.path.join(OUT, prefix + sprite)):
            done += 1
print('wrote', done, 'atlases')
