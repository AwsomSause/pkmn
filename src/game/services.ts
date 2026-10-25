// Shared objects the screens need: the game session and the loaded assets.

import type { AssetEntry, AssetManifest } from '../assets/catalog';
import type { GameSession } from './GameSession';

export class AssetRegistry {
  private readonly byId = new Map<string, AssetEntry>();
  readonly missing: { id: string; files: string[] }[];
  /** Assets that were in the manifest but failed to load in the browser. */
  readonly failed: string[] = [];

  constructor(manifest: AssetManifest | null, catalog: AssetEntry[]) {
    const available = new Set((manifest?.assets ?? []).map((a) => a.id));
    for (const entry of catalog) if (available.has(entry.id)) this.byId.set(entry.id, entry);
    this.missing = catalog
      .filter((e) => !available.has(e.id))
      .map((e) => manifest?.missing.find((m) => m.id === e.id) ?? { id: e.id, files: [e.path] });
  }

  has(id: string): boolean {
    return this.byId.has(id) && !this.failed.includes(id);
  }

  get(id: string): AssetEntry | undefined {
    return this.byId.get(id);
  }

  entries(): AssetEntry[] {
    return [...this.byId.values()];
  }

  markFailed(id: string): void {
    if (!this.failed.includes(id)) this.failed.push(id);
  }
}

interface Services {
  session: GameSession;
  assets: AssetRegistry;
}

let current: Services | null = null;

export function setServices(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error('Game services are not initialized yet');
  return current;
}
