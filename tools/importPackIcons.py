#!/usr/bin/env python3
"""Writes every species icon as a 2-frame atlas: the pack's animated Icons strip (halved to 32px) when the pack
has the Pokémon, otherwise the existing static icon wrapped as a 1-frame atlas.
Usage: importPackIcons.py <Graphics/Pokemon dir> <species.json> <forms-file: PBS/pokemon_forms.txt>"""
import json, os, re, sys
from PIL import Image

pack, species_file, pbs = sys.argv[1:4]
ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'images', 'pokemon', 'icons')
files = {os.path.splitext(f)[0]: f for f in os.listdir(os.path.join(pack, 'Icons')) if f.lower().endswith('.png')}
forms, cur = {}, None
for line in open(pbs, encoding='utf-8-sig'):
    m = re.match(r'\[(\w+),(\d+)\]', line)
    if m:
        cur = (m.group(1), m.group(2))
    elif line.startswith('FormName') and cur:
        forms.setdefault(cur[0], []).append((cur[1], line.split('=', 1)[1].strip()))
syn = {'alolan': 'alola', 'galarian': 'galar', 'hisuian': 'hisui', 'paldean': 'paldea', 'gigantamax': 'gmax', 'g-max': 'gmax'}


def toks(s, base):
    s = re.sub(r'[^a-z0-9]+', ' ', s.lower().replace("'", ''))
    b = base.lower().split('-')
    return frozenset(syn.get(w, w) for w in s.split() if w not in b and w != 'form')


species = json.load(open(species_file))
ids = {s['id'] for s in species}


def pack_for(sid):
    key = sid.upper().replace('-', '')
    if key in files:
        return key
    parts = sid.split('-')
    for k in range(len(parts) - 1, 0, -1):
        b = '-'.join(parts[:k])
        if b in ids:
            bk = b.upper().replace('-', '')
            for num, fn in forms.get(bk, []):
                if toks(fn, b) == frozenset(parts[k:]) and f'{bk}_{num}' in files:
                    return f'{bk}_{num}'
            return None
    return None


def frame(i, x, w, h):
    return {'filename': f'{i + 1:04d}.png', 'rotated': False, 'trimmed': False, 'sourceSize': {'w': w, 'h': h},
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'frame': {'x': x, 'y': 0, 'w': w, 'h': h}}


def write(dest, sheet, n, w, h):
    sheet.save(dest + '.png', optimize=True)
    json.dump({'textures': [{'image': os.path.basename(dest) + '.png', 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height},
                             'scale': 1, 'frames': [frame(i, i * w, w, h) for i in range(n)]}]}, open(dest + '.json', 'w'), separators=(',', ':'))


swapped = wrapped = 0
seen = set()
for s in species:
    icon = s['assets']['icon']
    if icon in seen:
        continue
    seen.add(icon)
    dest = os.path.join(ICONS, icon)
    if not os.path.exists(dest + '.png'):
        continue
    name = pack_for(s['id'])
    if name:
        im = Image.open(os.path.join(pack, 'Icons', files[name])).convert('RGBA')
        h = im.height
        n = im.width // h
        if n >= 2:
            half = h // 2
            sheet = Image.new('RGBA', (2 * half, half))
            for i in range(2):
                sheet.paste(im.crop((i * h, 0, i * h + h, h)).resize((half, half), Image.BOX), (i * half, 0))
            write(dest, sheet, 2, half, half)
            swapped += 1
            continue
    im = Image.open(dest + '.png').convert('RGBA')
    if not os.path.exists(dest + '.json'):
        write(dest, im, 1, im.width, im.height)
        wrapped += 1
print('animated', swapped, 'wrapped static', wrapped)
