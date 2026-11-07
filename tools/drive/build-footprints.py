"""Packs the Decades/Essentials footprint PNGs (32x32, one per species) into one sheet.

Usage: python3 tools/drive/build-footprints.py "<.../Graphics/Pokemon/Footprints>"
Writes public/assets/images/ui/footprints.png (32 columns of 32px cells) and src/assets/footprints.json
({speciesId: cell}). Only base species are used; forms and Megas fall back to their base species' print in the Pokédex.
Source: Pokemon-Decades-main Graphics/Pokemon/Footprints (same files as Animated Pokemon Sprites and Essentials 21).
"""
import json, os, re, sys
from PIL import Image

src = sys.argv[1]
species = json.load(open('src/data/species.json'))
rows = species.values() if isinstance(species, dict) else species
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
ids = {norm(s['id']): s['id'] for s in rows}
ids.update({'nidoranfe': 'nidoran-f', 'nidoranma': 'nidoran-m'})
cells = {}
files = []
for f in sorted(os.listdir(src)):
    base = f[:-4]
    if '_' in base or not f.endswith('.png'):
        continue
    sid = ids.get(norm(base))
    if sid and sid not in cells:
        cells[sid] = len(files)
        files.append(f)
COLS = 32
sheet = Image.new('RGBA', (COLS * 32, ((len(files) + COLS - 1) // COLS) * 32), (0, 0, 0, 0))
for i, f in enumerate(files):
    sheet.paste(Image.open(os.path.join(src, f)).convert('RGBA'), ((i % COLS) * 32, (i // COLS) * 32))
os.makedirs('public/assets/images/ui', exist_ok=True)
sheet.save('public/assets/images/ui/footprints.png', optimize=True)
json.dump(cells, open('src/assets/footprints.json', 'w'), separators=(',', ':'), sort_keys=True)
print(len(cells), 'footprints', sheet.size)
