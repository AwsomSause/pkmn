// F215: per-pack loading status. A "pack" is the folder an asset lives in (images/pokemon, audio/music...). Pure.

/** The pack of an asset path relative to public/assets: its first two folders (or one when it has only one). */
export function packOf(path: string): string {
  const parts = path.split('/');
  return parts.length <= 2 ? parts[0]! : `${parts[0]}/${parts[1]}`;
}

export interface PackProgress {
  pack: string;
  done: number;
  total: number;
}

export class PreloadTracker {
  private readonly totals = new Map<string, number>();
  private readonly done = new Map<string, number>();
  private readonly byId = new Map<string, string>();
  private current = '';

  add(id: string, path: string): void {
    const pack = packOf(path);
    this.byId.set(id, pack);
    this.totals.set(pack, (this.totals.get(pack) ?? 0) + 1);
  }

  complete(id: string): void {
    const pack = this.byId.get(id);
    if (!pack) return;
    this.done.set(pack, (this.done.get(pack) ?? 0) + 1);
    this.current = pack;
  }

  packs(): PackProgress[] {
    return [...this.totals].map(([pack, total]) => ({ pack, total, done: Math.min(total, this.done.get(pack) ?? 0) })).sort((a, b) => a.pack.localeCompare(b.pack));
  }

  /** One line for the loading screen: the pack being filled and how many packs are finished. */
  line(): string {
    const all = this.packs();
    const finished = all.filter((p) => p.done >= p.total).length;
    const cur = all.find((p) => p.pack === this.current);
    return cur ? `${cur.pack}  ${cur.done}/${cur.total}  ·  ${finished}/${all.length} packs ready` : `${finished}/${all.length} packs ready`;
  }
}
