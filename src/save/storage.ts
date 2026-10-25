// Where save data physically lives. The game only talks to this interface,
// so a cloud provider can be added later without touching gameplay code.

export interface StorageProvider {
  readonly name: string;
  /** Returns null if the key doesn't exist. Throws StorageUnavailableError if storage can't be read. */
  get(key: string): string | null;
  /** Throws StorageUnavailableError if the write fails (e.g. storage full or blocked). */
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class StorageUnavailableError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/** Browser localStorage. Not permanent: the browser or the player can clear it. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'browser local storage';

  private get storage(): Storage {
    try {
      const s = globalThis.localStorage;
      if (!s) throw new Error('localStorage is not available');
      return s;
    } catch (err) {
      throw new StorageUnavailableError('Browser storage is unavailable (private mode or blocked site data?)', err);
    }
  }

  get(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw err;
      throw new StorageUnavailableError(`Could not read "${key}" from browser storage`, err);
    }
  }

  set(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw err;
      throw new StorageUnavailableError(`Could not save "${key}" (browser storage may be full or blocked)`, err);
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw err;
      throw new StorageUnavailableError(`Could not remove "${key}" from browser storage`, err);
    }
  }
}

/** In-memory storage for tests and as a fallback when the browser blocks storage. */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'temporary memory (lost on refresh)';
  private readonly data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}
