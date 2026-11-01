#!/usr/bin/env python3
"""Builds src/data/speciesHeights.json (canon Pokemon heights, metres) from the Pokemon Essentials PBS files.

  python3 -I tools/build-heights.py <Pokemon-Essentials-zip>

Source: pokemon.txt / pokemon_forms.txt in PBS/ of "Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip" (the
project's shared folder). Essentials covers generations 1-8 (dex 1-898); later species fall back to a weight-based
estimate at run time (src/core/heights.ts). Re-run only when that source changes.
"""
import json, re, sys, zipfile

zip_path = sys.argv[1]
z = zipfile.ZipFile(zip_path)
root = 'Pokemon-Essentials-21-With-Unofficial-EBDX-main/PBS/'

def sections(text):
    out, cur = [], None
    for line in text.lstrip('﻿').splitlines():
        m = re.match(r'^\[(.+)\]$', line.strip())
        if m:
            cur = {'key': m.group(1)}
            out.append(cur)
        elif cur is not None and '=' in line:
            k, v = line.split('=', 1)
            cur[k.strip()] = v.strip()
    return out

base = sections(z.read(root + 'pokemon.txt').decode('utf-8'))
forms = sections(z.read(root + 'pokemon_forms.txt').decode('utf-8'))
species = json.load(open('src/data/species.json'))
species = species if isinstance(species, list) else species['species']
by_dex = {s['dex']: s for s in species if '-' not in s['id'] or s.get('form') is None}
by_name = {}
for s in species:
    by_name.setdefault(s['name'].lower(), s)

heights = {}
mismatch = 0
for i, sec in enumerate(base, start=1):
    h = float(sec['Height'])
    s = by_dex.get(i)
    if s and s['name'].lower().replace(' ', '') == sec.get('Name', '').lower().replace(' ', ''):
        heights[s['id']] = h
    elif s:
        mismatch += 1
        heights[s['id']] = h
for sec in forms:
    if 'Height' not in sec or 'FormName' not in sec:
        continue
    s = by_name.get(sec['FormName'].lower())
    if s:
        heights[s['id']] = float(sec['Height'])

out = {
    'note': 'Canon Pokemon heights in metres. Built by tools/build-heights.py from the Pokemon Essentials PBS files (pokemon.txt, pokemon_forms.txt). Generations 1-8 only; other species use a weight-based estimate (src/core/heights.ts).',
    'heights': dict(sorted(heights.items())),
}
with open('src/data/speciesHeights.json', 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(len(heights), 'heights;', mismatch, 'name mismatches')
