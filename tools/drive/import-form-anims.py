"""Swaps still form sprites for the Drive's animated strips (Animated Pokemon Sprites pack).

Usage: python3 tools/drive/import-form-anims.py <folder with Front/, Back/, "Front shiny"/ strips>
Reads tools/drive/form-sprite-map.json (species id -> strip name, from map-form-sprites.py). Each strip is square frames side by side;
frames are cropped to the strip's shared bounding box (trimmed atlas, so the sprite stays anchored), scaled so the sprite is as big as
the still it replaces (within 12% it stays untouched), and packed into a grid <= 2048 px wide. Writes the atlas over
public/assets/images/pokemon/{,back/,shiny/}<sprite>.{png,json}. The shiny back sprites are not in the pack and stay as they are.
"""
import json, os, sys
from PIL import Image

src = sys.argv[1]
m = json.load(open('tools/drive/form-sprite-map.json'))
OUT = 'public/assets/images/pokemon'
KINDS = [('Front', ''), ('Back', 'back/'), ('Front shiny', 'shiny/')]


def still_height(sub, sprite):
    """Height of the visible sprite in the still we are replacing (from its atlas), or None."""
    p = f'{OUT}/{sub}{sprite}.json'
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    t = d['textures'][0] if 'textures' in d else d
    fr = t['frames'][0]
    return fr['spriteSourceSize']['h'] if fr.get('trimmed') else fr['sourceSize']['h']


done = 0
for sid, v in m.items():
    for kind, sub in KINDS:
        f = os.path.join(src, kind, v['strip'])
        if not os.path.exists(f):
            continue
        im = Image.open(f).convert('RGBA')
        fh = im.height
        n = im.width // fh
        if n < 2:
            continue
        frames = [im.crop((i * fh, 0, (i + 1) * fh, fh)) for i in range(n)]
        bbox = None
        for fr in frames:
            b = fr.getchannel('A').getbbox()
            if b:
                bbox = b if bbox is None else (min(bbox[0], b[0]), min(bbox[1], b[1]), max(bbox[2], b[2]), max(bbox[3], b[3]))
        if bbox is None:
            continue
        target = still_height(sub, v['sprite'])
        first = frames[0].getchannel('A').getbbox()
        k = 1.0
        if target and first:
            k = target / max(1, first[3] - first[1])
            k = 1.0 if abs(k - 1) < 0.12 else max(0.4, min(1.6, k))
        if k != 1.0:
            frames = [fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.LANCZOS) for fr in frames]
            bbox = tuple(round(x * k) for x in bbox)
        sw, sh = frames[0].width, frames[0].height
        bx, by, bw, bh = bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]
        cols = max(1, 2048 // bw)
        rows = (len(frames) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * bw, rows * bh), (0, 0, 0, 0))
        js = []
        for i, fr in enumerate(frames):
            x, y = (i % cols) * bw, (i // cols) * bh
            sheet.paste(fr.crop(bbox), (x, y))
            js.append({'filename': f'{i + 1:04d}.png', 'rotated': False, 'trimmed': True, 'sourceSize': {'w': sw, 'h': sh},
                       'spriteSourceSize': {'x': bx, 'y': by, 'w': bw, 'h': bh}, 'frame': {'x': x, 'y': y, 'w': bw, 'h': bh}})
        name = f'{OUT}/{sub}{v["sprite"]}'
        os.makedirs(os.path.dirname(name), exist_ok=True)
        # Pixel art: 256 colours without dithering is visually identical and about a third of the size.
        sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(name + '.png', optimize=True)
        json.dump({'textures': [{'image': os.path.basename(name) + '.png', 'format': 'RGBA8888', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': 1, 'frames': js}],
                   'meta': {'app': 'tools/drive/import-form-anims.py', 'version': '1.0'}}, open(name + '.json', 'w'))
        done += 1
print(done, 'atlases written')
