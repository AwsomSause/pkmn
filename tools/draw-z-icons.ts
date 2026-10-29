// Draws placeholder icons for the Z-Ring and the 18 type Z-Crystals into
// public/assets/images/items/ (Milestone 8.5, Z-Moves). The asset packs have
// no Z-Move art, so these are drawn in code (director, 2026-10-25: "work with
// what you have or can create"); swap in real art later by replacing the files.
//
//   npm run assets:z-icons
//
// Each crystal is a 32×32 gem in its type's colour (TYPE_COLORS) with a white
// "Z" on it; the Z-Ring is a grey ring with a white gem.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { mixColor, TYPE_COLORS } from '../src/ui/theme.ts';

const outDir = join(import.meta.dirname, '..', 'public', 'assets', 'images', 'items');
const SIZE = 32;

const CRYSTALS: Record<string, string> = {
  normal: 'normalium_z', fighting: 'fightinium_z', flying: 'flyinium_z', poison: 'poisonium_z', ground: 'groundium_z',
  rock: 'rockium_z', bug: 'buginium_z', ghost: 'ghostium_z', steel: 'steelium_z', fire: 'firium_z', water: 'waterium_z',
  grass: 'grassium_z', electric: 'electrium_z', psychic: 'psychium_z', ice: 'icium_z', dragon: 'dragonium_z',
  dark: 'darkinium_z', fairy: 'fairium_z',
};

type Pixels = Uint8Array;
const blank = (): Pixels => new Uint8Array(SIZE * SIZE * 4);
function set(px: Pixels, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = (color >> 16) & 0xff;
  px[i + 1] = (color >> 8) & 0xff;
  px[i + 2] = color & 0xff;
  px[i + 3] = 0xff;
}
const filled = (px: Pixels, x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[(y * SIZE + x) * 4 + 3]! > 0;

/** A 1-pixel dark outline around everything drawn so far. */
function outline(px: Pixels, color: number): void {
  const copy = px.slice();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (filled(copy, x, y)) continue;
      if (filled(copy, x - 1, y) || filled(copy, x + 1, y) || filled(copy, x, y - 1) || filled(copy, x, y + 1)) set(px, x, y, color);
    }
  }
}

/** A gem (diamond) centred at cx, cy with half-width w and half-height h, lit from the top left. */
function gem(px: Pixels, cx: number, cy: number, w: number, h: number, color: number): void {
  for (let y = cy - h; y <= cy + h; y++) {
    for (let x = cx - w; x <= cx + w; x++) {
      if (Math.abs(x - cx) / w + Math.abs(y - cy) / h > 1) continue;
      const light = x < cx && y < cy ? 0.45 : x >= cx && y >= cy ? -0.3 : 0;
      set(px, x, y, light > 0 ? mixColor(color, 0xffffff, light) : light < 0 ? mixColor(color, 0x000000, -light) : color);
    }
  }
}

/** A blocky white "Z", 7 wide and 7 tall, centred at cx, cy. */
function zGlyph(px: Pixels, cx: number, cy: number): void {
  for (let i = -3; i <= 3; i++) {
    set(px, cx + i, cy - 3, 0xffffff);
    set(px, cx + i, cy + 3, 0xffffff);
    set(px, cx - i, cy + i, 0xffffff);
  }
}

function png(px: Pixels): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) Buffer.from(px.subarray(y * SIZE * 4, (y + 1) * SIZE * 4)).copy(rows, y * (SIZE * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [type, file] of Object.entries(CRYSTALS)) {
  const px = blank();
  const color = TYPE_COLORS[type]!;
  gem(px, 16, 16, 10, 13, color);
  zGlyph(px, 16, 16);
  outline(px, mixColor(color, 0x000000, 0.65));
  writeFileSync(join(outDir, `${file}.png`), png(px));
}

// Z-Ring: a ring seen from the front, with a white gem on top.
const ring = blank();
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const d = ((x - 16) / 12) ** 2 + ((y - 19) / 8) ** 2;
    const inner = ((x - 16) / 8) ** 2 + ((y - 19) / 4.5) ** 2;
    if (d <= 1 && inner > 1) set(ring, x, y, y < 19 ? 0xd0d0d8 : 0x9090a0);
  }
}
gem(ring, 16, 9, 5, 6, 0xf0f0ff);
outline(ring, 0x303040);
writeFileSync(join(outDir, 'z_ring.png'), png(ring));

console.log(`Drew ${Object.keys(CRYSTALS).length} Z-Crystal icons and the Z-Ring into ${outDir}.`);
