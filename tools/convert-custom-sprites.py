"""Converts the director's custom Pokémon sprites into the game's format.

Called by tools/import-custom-forms.ts (npm run data:custom); needs Pillow.

  python3 tools/convert-custom-sprites.py <unzipped sprite folder> <jobs.json> <public/assets/images/pokemon>

Each job names a front sprite and, when they exist, back, shiny, shiny back and
icon files. Every sprite becomes a one-frame multi-atlas (PNG + JSON) like PokeRogue's:
  custom/<id>.png, back/custom/<id>.png, shiny/custom/<id>.png, back/shiny/custom/<id>.png
Sprites drawn at double size (Insurgence's) are halved so they match the
PokeRogue art, and transparent borders are trimmed. A missing shiny uses the
normal sprite; a missing back uses the front sprite mirrored. Icons take the
first 32x32 frame of the two-frame menu icon.
"""

import json
import os
import sys

from PIL import Image, ImageChops, ImageOps

src_dir, jobs_path, out_dir = sys.argv[1:4]
jobs = json.load(open(jobs_path))


def is_doubled(im: Image.Image) -> bool:
    """True if every pixel is repeated in 2x2 blocks (art drawn at double size)."""
    if im.width % 2 or im.height % 2:
        return False
    small = im.resize((im.width // 2, im.height // 2), Image.NEAREST)
    back = small.resize(im.size, Image.NEAREST)
    diff = ImageChops.difference(im, back).convert('L').point(lambda v: 255 if v > 16 else 0)
    return diff.getbbox() is None or sum(diff.histogram()[255:]) < im.width * im.height * 0.01


def load(rel: str) -> Image.Image:
    im = Image.open(os.path.join(src_dir, rel)).convert('RGBA')
    if im.width > 120 or im.height > 120:
        im = im.resize((im.width // 2, im.height // 2), Image.NEAREST if is_doubled(im) else Image.LANCZOS)
    box = im.getchannel('A').getbbox()
    return im.crop(box) if box else im


def write_atlas(im: Image.Image, folder: str, key: str) -> None:
    path = os.path.join(out_dir, folder, 'custom')
    os.makedirs(path, exist_ok=True)
    im.save(os.path.join(path, f'{key}.png'), optimize=True)
    w, h = im.size
    # PokeRogue's multi-atlas layout (the game loads Pokémon art with load.multiatlas).
    atlas = {
        'textures': [{
            'image': f'{key}.png', 'format': 'RGBA8888', 'size': {'w': w, 'h': h}, 'scale': 1,
            'frames': [{
                'filename': '0001.png', 'rotated': False, 'trimmed': False, 'sourceSize': {'w': w, 'h': h},
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'frame': {'x': 0, 'y': 0, 'w': w, 'h': h},
            }],
        }],
        'meta': {'app': 'tools/convert-custom-sprites.py'},
    }
    with open(os.path.join(path, f'{key}.json'), 'w') as f:
        json.dump(atlas, f)


def icon(rel: str) -> Image.Image:
    im = Image.open(os.path.join(src_dir, rel)).convert('RGBA')
    if im.width >= 2 * im.height:
        im = im.crop((0, 0, im.height, im.height))
    box = im.getchannel('A').getbbox()
    return im.crop(box) if box else im


for job in jobs:
    key = job['key']
    front = load(job['front'])
    back = load(job['back']) if job.get('back') else ImageOps.mirror(front)
    shiny = load(job['shiny']) if job.get('shiny') else front
    shiny_back = load(job['shinyBack']) if job.get('shinyBack') else (back if not job.get('shiny') else ImageOps.mirror(shiny))
    write_atlas(front, '', key)
    write_atlas(back, 'back', key)
    write_atlas(shiny, 'shiny', key)
    write_atlas(shiny_back, os.path.join('back', 'shiny'), key)
    if job.get('icon'):
        path = os.path.join(out_dir, 'icons', 'custom')
        os.makedirs(path, exist_ok=True)
        icon(job['icon']).save(os.path.join(path, f'{key}.png'), optimize=True)

print(f'Converted sprites for {len(jobs)} Pokémon.')
