"""Imports the Pokemon Essentials 21.1 UIE battlebacks as extra battle arenas.

Usage: python3 tools/import-battlebacks.py "<.../Graphics/Battlebacks>"
Writes public/assets/images/arenas/uie/<name>_{bg,a,b}.png (bg 320x180, a/b the
ground patches sized like the PokeRogue ones). Paste the printed names into UIE_ARENAS in src/assets/catalog.ts.
Source: Pokemon Essentials 21.1 UIE.rar (Graphics/Battlebacks). Provenance: docs/plans/zip-coverage.md.
"""
import json, os, re, sys
from PIL import Image

src = sys.argv[1]
out = 'public/assets/images/arenas/uie'
os.makedirs(out, exist_ok=True)
names = sorted(f[:-7] for f in os.listdir(src) if f.endswith('_bg.png'))


def base(name, idx):
    for cand in (name, re.sub(r'_(eve|night|ice|water)$', '', name)):
        p = os.path.join(src, f'{cand}_base{idx}.png')
        if os.path.exists(p):
            return Image.open(p).convert('RGBA')
    raise SystemExit(f'no base{idx} for {name}')


def patch(im, scale, cx, bottom):
    im = im.crop(im.getchannel('A').getbbox())
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (320, 132), (0, 0, 0, 0))
    canvas.paste(im, (round(cx - im.width / 2), bottom - im.height), im)
    return canvas


for n in names:
    Image.open(os.path.join(src, f'{n}_bg.png')).convert('RGB').resize((320, 180), Image.LANCZOS).save(f'{out}/{n}_bg.png', optimize=True)
    patch(base(n, 0), 0.28, 104, 132).save(f'{out}/{n}_a.png', optimize=True)
    patch(base(n, 1), 0.5, 216, 94).save(f'{out}/{n}_b.png', optimize=True)
print(names)
print(len(names), 'arenas')
