#!/usr/bin/env python3
"""Drafts timeline scripts (src/data/ebdxAnims.json) from EBDX's Ruby move animations.

  python3 tools/gen-ebdx-scripts.py <EBDX Essentials folder> <count>

Takes the <count> unported EBDX scripts whose moves most species learn, reads each
Ruby body for its pictures, sounds, colours, loop lengths and whether it throws
something from the user to the target, and writes an approximate timeline. This
is a draft from the script's art, sound and structure, not a frame-exact port;
scripts already in ebdxAnims.json (the hand-timed ones) are never touched.
Afterwards run `npm run data:ebdx-anims -- <folder>`.
"""
import collections, json, os, re, subprocess, sys
from PIL import Image

root, count = sys.argv[1], int(sys.argv[2])
D = os.path.join(root, 'Plugins/Elite Battle DX/[002] Animation Code/Move Animations/')
G = os.path.join(root, 'Graphics/EBDX/Animations/Moves/')
DATA = 'src/data/ebdxAnims.json'
file = json.load(open(DATA))
done = set(file['moves'])
moves = json.load(open('src/data/moveAnims.json'))['moves']
idx = {k.replace('-', ''): k for k in moves}

learners = collections.Counter()
for s in json.load(open('src/data/species.json')):
    for m in {e['move'] for e in s['learnset']}:
        learners[m] += 1

defs, alias = {}, {}
for f in sorted(os.listdir(D)):
    t = open(D + f, encoding='utf8', errors='ignore').read()
    parts = re.split(r'EliteBattle\.defineMoveAnimation\(:(\w+)\)', t)
    for i in range(1, len(parts), 2):
        n, b = parts[i], parts[i + 1].split('EliteBattle.defineMoveAnimation')[0]
        m = re.search(r'playMoveAnimation\(:(\w+)', b)
        if m and len(b.strip().splitlines()) < 6: alias[n] = m.group(1)
        else: defs[n] = b

def root_of(n):
    for _ in range(6):
        if n in alias: n = alias[n]
    return n

cover = collections.defaultdict(list)
for n in list(defs) + list(alias):
    r, gid = root_of(n), idx.get(n.lower())
    if gid and gid not in done and r in defs: cover[r].append(gid)
rank = sorted(cover, key=lambda r: -sum(learners[m] for m in cover[r]))

def slug(p): return re.sub(r'[^a-z0-9]+', '-', p.lower()).strip('-')

def build(name, b):
    frames = [int(x) for x in re.findall(r'for i in 0\.\.\.(\d+)', b) if int(x) <= 200] or [40]
    length = max(900, min(1800, max(frames) * 16 + 350))
    imgs = []
    for m in re.findall(r'Moves/(\w+)', b):
        if m not in imgs and os.path.exists(G + m + '.png'): imgs.append(m)
    imgs = imgs[:3]
    user_c = bool(re.search(r'userSprite\.(getCenter|getAnchor)', b))
    targ_c = 'targetSprite.getCenter' in b
    travel = user_c and targ_c and bool(re.search(r'x2 - x0|\(x2-x0\)|y2 - y0', b))
    self_only = user_c and not targ_c
    anchor = 'user' if self_only else 'target'
    loops = [int(x) for x in re.findall(r'for j in 0\.\.\.(\d+)', b)]
    n = max(3, min(12, loops[0] if loops else 8))
    cellm = re.search(r'src_rect\.set\(0,\s*0,\s*(\d+),\s*(\d+)\)', b)
    layers = []
    for k, img in enumerate(imgs):
        w, h = Image.open(G + img + '.png').size
        if (w >= 400 and h >= 250) or img.endswith('_bg') or ('ScrollingSprite' in b and k == 0 and w >= 300 and h >= 200):
            layers.append({'img': img, 'fill': True, 'count': 1, 'start': 0, 'dur': length - 200, 'from': {'at': 'mid'}, 'alpha': 0.3, 'fade': [0.2, 0.75]})
            continue
        layer = {'img': img, 'count': n if k == 0 else 6, 'start': 0 if k == 0 else 200, 'stagger': 40 if k == 0 else 60, 'dur': 520 if k == 0 else 420}
        if k == 0 and cellm and int(cellm.group(1)) < w and int(cellm.group(2)) <= h:
            layer['cell'] = [int(cellm.group(1)), int(cellm.group(2))]
            layer['frameMs'] = 80
        layer['count'] = max(1, min(layer['count'], 64 if w < 64 else 12))
        if travel and k == 0:
            layer['from'] = {'at': 'user', 'jx': 16, 'jy': 16}
            layer['to'] = {'at': 'target', 'jx': 48, 'jy': 48}
            layer['ease'] = 'in'
            layer['fade'] = [0.1, 0.8]
            layer['angle'] = 'aim' if w > h else [0, 0]
        elif self_only:
            layer['from'] = {'at': 'user', 'dy': 30, 'jx': 70}
            layer['to'] = {'at': 'user', 'dy': -60, 'jx': 70}
            layer['ease'] = 'out'
            layer['blend'] = 'add'
        else:
            layer['from'] = {'at': 'target', 'jx': 80, 'jy': 80}
            layer['scale'] = [0.8, 1.4]
            layer['blend'] = 'add'
            layer['angle'] = [0, 90]
        layers.append(layer)
    length = max([length] + [l['start'] + l.get('stagger', 0) * (l['count'] - 1) + l['dur'] + 100 for l in layers])
    script = {'v': 1, 'length': length, 'layers': layers}
    m = re.search(r'fill_rect\([^)]*Color\.new\((\d+),\s*(\d+),\s*(\d+)', b)
    if m: script['veil'] = {'color': '#%02x%02x%02x' % tuple(int(x) for x in m.groups()), 'alpha': 0.3, 'inMs': 300, 'outMs': 400}
    elif re.search(r'fill_rect\([^)]*Color\.black', b) or 'defocus' in b:
        script['veil'] = {'color': '#000000', 'alpha': 0.5, 'inMs': 300, 'outMs': 400}
    if not self_only:
        hit = {'at': 500 if travel else 200}
        if re.search(r'targetSprite\.ox\s*\+=', b): hit['shake'] = {'ms': 500, 'amp': 4}
        if 'targetSprite.zoom' in b: hit['squash'] = 0.1
        hit['flash'] = {'color': '#ffffff', 'ms': 250}
        script['hit'] = hit
    sfx, seen = [], set()
    for sm in re.finditer(r'pbSEPlay\("([^"]+)"(?:,\s*(\d+))?\)(?:\s+if\s+(i\s*==\s*(\d+)|i%(\d+)==0))?', b):
        path, vol, _, eq, mod = sm.groups()
        if path.startswith('Cries') or '#{' in path or path in seen or len(seen) >= 3: continue
        seen.add(path)
        at = int(eq) * 25 if eq else (0 if mod else 100 * len(seen))
        src = os.path.join(root, 'Audio/SE', path)
        if not any(os.path.exists(src + e) and subprocess.run(['ffmpeg', '-v', 'error', '-i', src + e, '-f', 'null', '-'], capture_output=True).returncode == 0 for e in ('.ogg', '.wav', '.mp3', '.m4a')): continue
        sfx.append({'at': min(at, length - 100), 'id': slug(path), 'src': path, 'vol': round(min(1, int(vol or 80) / 100 * 0.8), 2)})
    script['sfx'] = sfx
    return script

made = 0
for r in rank:
    if made >= count: break
    key = slug(r)
    if key in file['scripts']: continue
    try: script = build(r, defs[r])
    except Exception as e:
        print('skip', r, e); continue
    if not script['layers']: continue
    file['scripts'][key] = script
    for m in cover[r]: file['moves'][m] = key
    made += 1
    print(key, cover[r][:6], len(script['layers']), 'layers', script['length'], 'ms')
json.dump(file, open(DATA, 'w'), indent=2, ensure_ascii=False)
open(DATA, 'a').write('\n')
