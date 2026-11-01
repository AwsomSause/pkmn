// F222: auto-update notice. The site publishes `version.json` ({ build }) next to the game; the page compares it
// with the build it loaded. Pure compare; the fetch lives in the game layer.

export interface VersionFile {
  build: string;
  version: string;
}

/** Whether a newer build is online. Dev builds and unreadable answers never nag. */
export function updateAvailable(current: string, online: unknown): boolean {
  if (current === 'dev') return false;
  if (typeof online !== 'object' || online === null) return false;
  const build = (online as Partial<VersionFile>).build;
  return typeof build === 'string' && build.length > 0 && build !== current;
}
