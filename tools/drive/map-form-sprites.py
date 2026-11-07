"""Maps still (single-frame) species sprites to the Drive's animated Front strips (Animated Pokemon Sprites pack).

Usage: python3 tools/drive/map-form-sprites.py <_ls.txt> <forms.json>   -> tools/drive/form-sprite-map.json
_ls.txt: lines "Front|NAME_N.png|bytes" listing the pack's Front folder. forms.json: Essentials PBS forms parsed as {"BASE_N": {"FormName": ...}}.
"""
import json, os, re, sys, collections
ls, forms = sys.argv[1], json.load(open(sys.argv[2]))
sp = json.load(open('src/data/species.json'))
sp = sp if isinstance(sp, list) else list(sp.values())
byid = {s['id']: s for s in sp}
front = {}
for l in open(ls):
    k, n, _ = l.strip().split('|')
    if k == 'Front' and n.endswith('.png'):
        front[n[:-4]] = n
norm = lambda x: re.sub(r'[^A-Z0-9]', '', x.upper())

def frames(n):
    p = f'public/assets/images/pokemon/{n}.json'
    if not os.path.exists(p): return 0
    d = json.load(open(p))
    return sum(len(t['frames']) for t in d['textures']) if 'textures' in d else len(d.get('frames', []))

TOK = [('-mega-x', 'Mega {} X'), ('-mega-y', 'Mega {} Y'), ('-mega-z', 'Mega {} Z'), ('-mega', 'Mega {}'), ('-gmax', 'Gigantamax'),
       ('-hisui', 'Hisuian'), ('-alola', 'Alolan'), ('-galar', 'Galarian'), ('-paldea', 'Paldean')]
out, miss = {}, []
# Forms the PBS names differently (Pumpkaboo/Gourgeist sizes, Oricorio styles): id -> strip.
MANUAL = {'pumpkaboo-small': 'PUMPKABOO', 'pumpkaboo-large': 'PUMPKABOO_2', 'pumpkaboo-super': 'PUMPKABOO_3', 'gourgeist-small': 'GOURGEIST',
          'gourgeist-large': 'GOURGEIST_2', 'gourgeist-super': 'GOURGEIST_3', 'oricorio-pom-pom': 'ORICORIO_1', 'oricorio-pau': 'ORICORIO_2'}
for s in sp:
    n = s['assets']['sprite']
    if frames(n) > 1: continue
    sid = s['id']
    if sid in MANUAL and MANUAL[sid] in front:
        out[sid] = {'strip': front[MANUAL[sid]], 'sprite': n, 'form': 'manual'}
        continue
    base = None; want = None
    for tok, name in TOK:
        i = sid.find(tok)
        if i > 0 and (sid[i:] == tok or sid[i:].startswith(tok + '-')):
            base = sid[:i]; want = name; rest = sid[i + len(tok):].strip('-'); break
    if base is None:
        parts = sid.rsplit('-', 1)
        base, want, rest = parts[0], parts[1] if len(parts) > 1 else None, ''
    bn = norm(byid[base]['name']) if base in byid else norm(base)
    cands = [(k, v) for k, v in forms.items() if k.rsplit('_', 1)[0] == bn]
    hit = None
    if want:
        w = want.format(byid[base]['name'].split('-')[0] if base in byid else base).lower() if '{}' in want else want.lower()
        for k, v in cands:
            fn = v.get('FormName', '').lower()
            if (fn == w or fn.replace('mega ', 'mega ').strip() == w or (not '{}' in want and w in fn)) and (not rest or rest in fn.replace(' ', '-').replace('(', '').replace(')', '')):
                hit = k; break
        if not hit:
            for k, v in cands:
                if want.lower().replace('-', ' ') in v.get('FormName', '').lower().replace('-', ' ') or (rest and rest in v.get('FormName', '').lower()):
                    hit = k; break
    if hit and hit in front:
        out[sid] = {'strip': front[hit], 'sprite': n, 'form': forms[hit].get('FormName')}
    else:
        miss.append((sid, want, [ (k, v.get('FormName')) for k, v in cands][:6]))
json.dump(out, open('tools/drive/form-sprite-map.json', 'w'), indent=1)
print(len(out), 'mapped;', len(miss), 'unmapped')
for m in miss: print(m)
