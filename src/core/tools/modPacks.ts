// F209: the mod loader. Packs are JSON (Zod-checked in core/configPack.ts, never code). Imported packs are kept on this
// device (not in a save) and applied when the game starts. Pure list handling; storage is passed in.

import { applyConfigPack, parseConfigPack, type ConfigPack } from '../configPack';

export const MAX_PACKS = 8;

export interface PackStore {
  get(): string[];
  set(texts: string[]): void;
}

export interface LoadedPacks {
  packs: ConfigPack[];
  /** Messages for stored packs that no longer validate (they are dropped, never run). */
  problems: string[];
}

/** Applies every stored pack that validates; the rest are reported and skipped. */
export function loadStoredPacks(store: PackStore): LoadedPacks {
  const packs: ConfigPack[] = [];
  const problems: string[] = [];
  for (const text of store.get().slice(0, MAX_PACKS)) {
    const r = parseConfigPack(text);
    if (r.ok) (packs.push(r.pack), applyConfigPack(r.pack));
    else problems.push(r.errors[0] ?? 'invalid pack');
  }
  return { packs, problems };
}

/** Validates and stores a new pack (replacing one with the same id). Returns a message for the player. */
export function installPack(store: PackStore, text: string): { ok: boolean; message: string } {
  const r = parseConfigPack(text);
  if (!r.ok) return { ok: false, message: `Pack refused: ${r.errors[0]}` };
  const others = store.get().filter((t) => {
    const p = parseConfigPack(t);
    return !(p.ok && p.pack.id === r.pack.id);
  });
  if (others.length >= MAX_PACKS) return { ok: false, message: `You can keep ${MAX_PACKS} packs; remove one first.` };
  store.set([...others, text]);
  return { ok: true, message: `Pack "${r.pack.name}" by ${r.pack.author} is installed. Restart the game to apply it.` };
}

export function removePack(store: PackStore, id: string): void {
  store.set(store.get().filter((t) => {
    const p = parseConfigPack(t);
    return !(p.ok && p.pack.id === id);
  }));
}
