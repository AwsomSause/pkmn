import sys
from PIL import Image
from collections import deque
G='/tmp/claude-0/pm/repo/Pokemon Memories/Graphics/Tilesets/'
TS={'g4':'gen4Outside.png','vr':'tileset_ville_route.png','ga':'PokemonGaiaTileset.png'}
cache={}
def extract(ts,c,r,w,h,pad=1):
  im=cache.setdefault(ts,Image.open(G+TS[ts]).convert('RGBA')); A=im.split()[3].load(); W,H=im.size
  X0,Y0=max(0,(c-pad)*32),max(0,(r-pad)*32); X1,Y1=min(W,(c+w+pad)*32),min(H,(r+h+pad)*32)
  cx,cy=(c+w/2)*32,(r+h/2)*32
  # seeds: all solid pixels inside the approx window
  seen=set(); q=deque()
  for y in range(r*32,(r+h)*32):
    for x in range(c*32,(c+w)*32):
      if A[x,y]>200: seen.add((x,y)); q.append((x,y))
  while q:
    x,y=q.popleft()
    for dx in(-1,0,1):
      for dy in(-1,0,1):
        n=(x+dx,y+dy)
        if X0<=n[0]<X1 and Y0<=n[1]<Y1 and n not in seen and A[n]>200: seen.add(n); q.append(n)
  q=deque(seen); sh=set()
  while q:
    x,y=q.popleft()
    for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
      n=(x+dx,y+dy)
      if X0<=n[0]<X1 and Y0<=n[1]<Y1 and n not in seen and n not in sh and 0<A[n]<=200: sh.add(n); q.append(n)
  pts=seen|sh
  xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
  bx0,by0,bx1,by1=min(xs),min(ys),max(xs)+1,max(ys)+1
  touch=[s for s,v in (('L',bx0<=X0),('T',by0<=Y0),('R',bx1>=X1),('B',by1>=Y1)) if v]
  return (bx0,by0,bx1-bx0,by1-by0),touch
if __name__=='__main__':
  import json
  for line in sys.stdin:
    p=line.split()
    if not p: continue
    rect,t=extract(p[1],*map(int,p[2:6]),pad=int(p[6]))
    print(p[0],p[1],rect,t)
