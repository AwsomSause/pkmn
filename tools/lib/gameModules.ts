// Lets a Node tool use the game's own TypeScript code (src/core, src/quality).
// The game's imports are written for Vite (no file extensions, JSON imports),
// so the tool asks a Vite server, with no browser and no port, to load them.

import { createServer, type ViteDevServer } from 'vite';
import { join } from 'node:path';

export const root = join(import.meta.dirname, '..', '..');

let server: ViteDevServer | null = null;

/** Loads a module from the repository, e.g. loadModule('/src/data/index.ts'). */
export async function loadModule<T>(path: string): Promise<T> {
  server ??= await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  return (await server.ssrLoadModule(path)) as T;
}

/** Stops the Vite server so the tool can exit. */
export async function closeModules(): Promise<void> {
  await server?.close();
  server = null;
}
