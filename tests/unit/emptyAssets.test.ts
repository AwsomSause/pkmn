import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A zero-byte image makes Phaser log "Failed to process file" and turns browser tests red.
function emptyFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return emptyFiles(p);
    return /\.(png|jpg|webp|ogg|mp3|json)$/i.test(e.name) && statSync(p).size === 0 ? [p] : [];
  });
}

describe('asset files', () => {
  it('none under public/assets is empty', () => {
    expect(emptyFiles('public/assets')).toEqual([]);
  });
});
