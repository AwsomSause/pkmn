#!/usr/bin/env python3
"""Adds Silvally's 17 type forms (silvally-fire ...) to src/data/customSpecies.json and writes their animated
Essentials/EBDX art (Front, Back, shiny, Icons; Essentials numbers SILVALLY_1 .. 18, 9 being the missing ??? type).
Safe to re-run. Usage: import-silvally-forms.py <Graphics/Pokemon dir>"""
import json, os, sys
from PIL import Image

pack = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMG = os.path.join(ROOT, 'public', 'assets', 'images', 'pokemon')
DATA = os.path.join(ROOT, 'src', 'data')
# One attack of each type (Silvally itself only has Multi-Attack), so the form has a move of its own type.
STAB = {'fighting': 'close-combat', 'flying': 'aerial-ace', 'poison': 'sludge-bomb', 'ground': 'earthquake', 'rock': 'rock-slide', 'bug': 'x-scissor', 'ghost': 'shadow-ball', 'steel': 'iron-head',
        'fire': 'flamethrower', 'water': 'surf', 'grass': 'energy-ball', 'electric': 'thunderbolt', 'psychic': 'psychic', 'ice': 'ice-beam', 'dragon': 'dragon-claw', 'dark': 'crunch', 'fairy': 'dazzling-gleam'}
TYPES = ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', None, 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy']
MAXW = 2048


def frame(i, x, w, h):
    return {'filename': f'{i + 1:04d}.png', 'rotated': False, 'trimmed': False, 'sourceSize': {'w': w, 'h': h},
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'frame': {'x': x[0], 'y': x[1], 'w': w, 'h': h}}


def write(dest, sheet, frames, w, h):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sheet.save(dest + '.png', optimize=True)
    json.dump({'textures': [{'image': os.path.basename(dest) + '.png', 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height},
                             'scale': 1, 'frames': [frame(i, p, w, h) for i, p in enumerate(frames)]}]}, open(dest + '.json', 'w'), separators=(',', ':'))


def strip(src, dest):
    im = Image.open(src).convert('RGBA')
    h = im.height
    n = im.width // h
    cells = [im.crop((i * h, 0, i * h + h, h)) for i in range(n)]
    box = None
    for c in cells:
        b = c.getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    cells = [c.crop(box) for c in cells]
    w, ch = cells[0].size
    cols = max(1, min(n, MAXW // w))
    rows = (n + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * w, rows * ch))
    pos = []
    for i, c in enumerate(cells):
        p = ((i % cols) * w, (i // cols) * ch)
        sheet.paste(c, p)
        pos.append(p)
    write(dest, sheet, pos, w, ch)


def icon(src, dest):
    im = Image.open(src).convert('RGBA')
    h = im.height
    half = h // 2
    sheet = Image.new('RGBA', (2 * half, half))
    for i in range(2):
        sheet.paste(im.crop((i * h, 0, i * h + h, h)).resize((half, half), Image.BOX), (i * half, 0))
    write(dest, sheet, [(0, 0), (half, 0)], half, half)


species = json.load(open(os.path.join(DATA, 'species.json')))
base = next(s for s in species if s['id'] == 'silvally')
custom_path = os.path.join(DATA, 'customSpecies.json')
custom = [s for s in json.load(open(custom_path)) if not s['id'].startswith('silvally-')]
for i, t in enumerate(TYPES, start=1):
    if not t:
        continue
    sid, name = f'silvally-{t}', f'SILVALLY_{i}'
    for sub, prefix in (('Front', ''), ('Back', 'back/'), ('Front shiny', 'shiny/'), ('Back shiny', 'back/shiny/')):
        strip(os.path.join(pack, sub, name + '.png'), os.path.join(IMG, prefix + 'custom', sid))
    icon(os.path.join(pack, 'Icons', name + '.png'), os.path.join(IMG, 'icons', 'custom', sid))
    entry = json.loads(json.dumps(base))
    entry.update(id=sid, name=f'Silvally ({t.capitalize()})', types=[t], evolutionStage=base['evolutionStage'], evolvesFrom=None,
                 form={'kind': 'alternate', 'base': 'silvally'}, evolutions=[], tags=[*base['tags'], 'zform'],
                 learnset=[*base['learnset'], {'level': 50, 'move': STAB[t]}],
                 assets={'sprite': f'custom/{sid}', 'icon': f'custom/{sid}', 'cry': base['assets']['cry']})
    custom.append(entry)
json.dump(custom, open(custom_path, 'w'), indent=1, ensure_ascii=False)
open(custom_path, 'a').write('\n')
print('silvally forms', sum(1 for t in TYPES if t))
