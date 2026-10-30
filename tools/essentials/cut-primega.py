# Cuts EBDX's Mega/Primal crystal ("Primega Shatter") into its 26 shards, the
# way EBDX's Primega Shatter.rb does at run time: each mask cr001–cr026 picks
# a piece of the crystal texture (Mega / Alpha / Omega) and of its crack
# overlay, inside the central circle (empty masks are dropped). Writes one Phaser atlas per crystal
# (frames p01–p26 and c01–c26) and the shard centres.
#
#   python3 -I tools/essentials/cut-primega.py <EBDX Graphics/EBDX/Animations/Moves/Primega> <public/assets/images/packs/ebdx/primega> <src/ui/battleFx/primegaShards.json>
import json, math, sys
from PIL import Image

src, out, centres_file = sys.argv[1:4]
COUNT = 26
masks = [Image.open(f"{src}/cr{n:03d}.png").convert('RGBA') for n in range(1, COUNT + 1)]
w, h = masks[0].size
cx, cy, rad = w / 2, h / 2, min(w, h) / 2

def coverage(mask):
    """Per-pixel weight 0–1 (EBDX: alpha × brightest channel, soft circle edge)."""
    px = mask.load()
    cov = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = a * max(r, g, b) / 255 / 255
            if m <= 0:
                continue
            edge = rad - math.hypot(x - cx, y - cy) + 0.5
            if edge <= 0:
                continue
            cov[(x, y)] = m * min(1, edge)
    return cov

# Masks that cover nothing inside the circle are skipped (EBDX skips them too).
covs = [c for c in (coverage(m) for m in masks) if c]
centres = []
boxes = []
for cov in covs:
    xs = [p[0] for p in cov]; ys = [p[1] for p in cov]
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    boxes.append(box)
    centres.append([round((box[0] + box[2]) / 2 - cx, 1), round((box[1] + box[3]) / 2 - cy, 1)])

for name, overlay in (('Mega', 'overlayM'), ('Alpha', 'overlayA'), ('Omega', 'overlayO')):
    tex = Image.open(f"{src}/{name}.png").convert('RGBA').resize((w, h))
    ov = Image.open(f"{src}/{overlay}.png").convert('RGBA').resize((w, h))
    tp, op = tex.load(), ov.load()
    pieces = []
    for kind, pix in (('p', tp), ('c', op)):
        for i, (cov, box) in enumerate(zip(covs, boxes)):
            piece = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]))
            pp = piece.load()
            for (x, y), m in cov.items():
                r, g, b, a = pix[x, y]
                if a:
                    pp[x - box[0], y - box[1]] = (r, g, b, round(a * m))
            pieces.append((f"{kind}{i + 1:02d}", piece))
    # Shelf-pack into one sheet.
    sheet_w, x, y, row = 1024, 0, 0, 0
    frames = {}
    for key, piece in pieces:
        pw, ph = piece.size
        if x + pw > sheet_w:
            x, y, row = 0, y + row + 2, 0
        frames[key] = (x, y, pw, ph)
        x += pw + 2
        row = max(row, ph)
    sheet = Image.new('RGBA', (sheet_w, y + row))
    for key, piece in pieces:
        fx, fy, _, _ = frames[key]
        sheet.alpha_composite(piece, (fx, fy))
    slug = name.lower()
    sheet.save(f"{out}/{slug}.png", optimize=True)
    atlas = {'frames': {k: {'frame': {'x': fx, 'y': fy, 'w': fw, 'h': fh}} for k, (fx, fy, fw, fh) in frames.items()},
             'meta': {'image': f"{slug}.png", 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1'}}
    with open(f"{out}/{slug}.json", 'w') as f:
        json.dump(atlas, f)
with open(centres_file, 'w') as f:
    json.dump({'$comment': 'Shard centres relative to the crystal centre (512x384 canvas), from tools/essentials/cut-primega.py.', 'size': [w, h], 'centres': centres}, f)
    f.write('\n')
print('ok', len(centres))
