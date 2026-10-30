// Imports the move and status animations from the director's Pokémon
// Essentials pack (Essentials 21.1 UIE; the EBDX pack carries the same file)
// into the game's compact animation format, and makes them each move's first
// choice (`pack` in src/data/moveAnims.json). The PokeRogue animation stays as
// the stand-by when a pack file can't load.
//
//   ruby tools/essentials/dump-animations.rb <Data/PkmnAnimations.rxdata> <anims.json>
//   npm run data:pack-anims -- <anims.json> <Graphics/Animations folder> <Audio/SE/Anim folder>
//
// Essentials draws animations on a 512×384 screen with 192-pixel sheet cells
// and the user at (128, 224), the target at (384, 96). PokeRogue's files (the
// format the game plays) use half that: 96-pixel cells, user (106, 116),
// target (234, 52). So positions are halved around the user's spot and the
// sheets are scaled down by half (ffmpeg). A sheet with a hue shift is baked as
// its own copy. Sounds are converted from .ogg to .m4a.
//
// Not carried over (documented as limited in docs/quality/MOVE_ANIMATIONS.md):
// the per-sprite colour overlay (only darkening tones play), and EBDX's own
// scripted animations (Ruby code, not frame data).
//
// Afterwards run `npm run assets:manifest`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { animSlug, type CompactAnim, type CompactEvent, type CompactFrame, type CompactVariant } from '../src/core/presentation/animFormat.ts';

const [dumpFile, graphicsDir, soundDir] = process.argv.slice(2);
if (!dumpFile || !existsSync(dumpFile) || !graphicsDir || !existsSync(graphicsDir) || !soundDir || !existsSync(soundDir)) {
  console.error('Usage: npm run data:pack-anims -- <anims.json> <Graphics/Animations folder> <Audio/SE/Anim folder>');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const assets = join(root, 'public', 'assets');
const outAnim = join(assets, 'battle-anims');
const outImage = join(assets, 'images', 'battle_anims');
const outAudio = join(assets, 'audio', 'battle_anims');
const movesFile = join(root, 'src', 'data', 'moves.json');
const animsFile = join(root, 'src', 'data', 'moveAnims.json');

interface EssAnim {
  name: string;
  graphic: string;
  hue: number;
  position: number;
  frames: ((number | boolean | null)[] | null)[][];
  timing: { name: string; frame: number; timingType: number; volume: number; pitch: number }[];
}

// Essentials' cel fields (AnimFrame).
const C = { X: 0, Y: 1, ZOOMX: 2, ANGLE: 3, MIRROR: 4, BLEND: 5, VISIBLE: 6, PATTERN: 7, OPACITY: 8, ZOOMY: 11, TONE: 16, LOCKED: 20, PRIORITY: 25, FOCUS: 26 } as const;
/** Essentials focus → the game's (0 "none" is the whole screen). */
const FOCUS = [4, 1, 2, 3] as const;

/** Status and field animations: the game's common slot → the Essentials name. */
const COMMON: Record<string, string> = {
  'status.brn': 'Common:Burn',
  'status.psn': 'Common:Poison',
  'status.par': 'Common:Paralysis',
  'status.slp': 'Common:Sleep',
  'status.frz': 'Common:Frozen',
  heal: 'Common:HealthUp',
  confusion: 'Common:Confusion',
  'weather.rain': 'Common:Rain',
  'weather.sun': 'Common:Sun',
  'weather.sand': 'Common:Sandstorm',
  'weather.hail': 'Common:Hail',
};

const num = (v: number | boolean | null | undefined, d = 0) => (typeof v === 'number' ? v : v === true ? 1 : d);

function sheetName(a: EssAnim): string | null {
  if (!a.graphic) return null;
  return `ess-${animSlug(a.graphic)}${a.hue ? `-h${a.hue}` : ''}`;
}

function convertFrames(a: EssAnim): CompactFrame[][] {
  return a.frames.map((cels) => {
    const out: CompactFrame[] = [];
    cels.forEach((cel, i) => {
      if (!cel) return;
      const pattern = num(cel[C.PATTERN]);
      // Cels 0 and 1 are the user and target; pattern -1 / -2 also mean them.
      const kind = i === 0 || pattern === -1 ? 0 : i === 1 || pattern === -2 ? 1 : 2;
      const flags = (num(cel[C.VISIBLE]) ? 1 : 0) | (num(cel[C.MIRROR]) ? 2 : 0) | (num(cel[C.LOCKED]) ? 4 : 0);
      const frame: CompactFrame = [
        kind,
        kind === 2 ? Math.max(0, pattern) : 0,
        Math.round((num(cel[C.X]) - 128) / 2),
        Math.round((num(cel[C.Y]) - 224) / 2),
        num(cel[C.ZOOMX], 100),
        num(cel[C.ZOOMY], 100),
        num(cel[C.ANGLE]),
        num(cel[C.OPACITY], 255),
        flags,
        num(cel[C.BLEND]),
        num(cel[C.PRIORITY], 1),
        FOCUS[num(cel[C.FOCUS])] ?? 4,
      ];
      const tone = [0, 1, 2, 3].map((k) => num(cel[C.TONE + k]));
      out.push(tone.some((v) => v !== 0) ? [...frame, tone as [number, number, number, number]] : frame);
    });
    return out;
  });
}

const sounds = new Map<string, string>(); // slug → source file
const soundFiles = new Map(readdirSync(soundDir).map((f) => [f.replace(/\.[^.]+$/, '').toLowerCase(), f]));
const graphicFiles = new Map(readdirSync(graphicsDir).map((f) => [f.replace(/\.[^.]+$/, '').toLowerCase(), f]));
const sheets = new Map<string, { file: string; hue: number }>();

function convert(a: EssAnim): { variant: CompactVariant; info: { graphics: string[]; backgrounds: string[]; sounds: string[] } } {
  const g = sheetName(a);
  const file = a.graphic ? graphicFiles.get(a.graphic.toLowerCase()) : undefined;
  if (g && file) sheets.set(g, { file, hue: a.hue });
  const events: CompactEvent[] = [];
  const used: string[] = [];
  for (const t of a.timing) {
    if (t.timingType !== 0 || !t.name) continue;
    const src = soundFiles.get(t.name.toLowerCase());
    if (!src) continue;
    const slug = `ess-${animSlug(t.name)}`;
    sounds.set(slug, src);
    if (!used.includes(slug)) used.push(slug);
    events.push({ f: t.frame, k: 'sound', r: slug, v: t.volume ?? 100, p: t.pitch ?? 100 });
  }
  events.sort((x, y) => x.f - y.f);
  return {
    variant: { g: g && file ? g : null, frames: convertFrames(a), events },
    info: { graphics: g && file ? [g] : [], backgrounds: [], sounds: used },
  };
}

// ------------------------------------------------------------------ main

const dump: EssAnim[] = JSON.parse(readFileSync(dumpFile, 'utf8'));
const byName = new Map(dump.map((a) => [a.name, a]));
const moveIds: string[] = (JSON.parse(readFileSync(movesFile, 'utf8')) as { id: string }[]).map((m) => m.id);
const essKey = (id: string) => id.replace(/[^a-z0-9]/g, '').toUpperCase();
const data = JSON.parse(readFileSync(animsFile, 'utf8'));
for (const d of [outAnim, outImage, outAudio]) mkdirSync(d, { recursive: true });

function write(name: string, main: EssAnim, opp?: EssAnim): void {
  const a = convert(main);
  const variants: CompactVariant[] = [a.variant];
  const info = a.info;
  if (opp) {
    const b = convert(opp);
    variants.push(b.variant);
    for (const k of ['graphics', 'sounds'] as const) for (const v of b.info[k]) if (!info[k].includes(v)) info[k].push(v);
  }
  const anim: CompactAnim = { v: 1, variants };
  writeFileSync(join(outAnim, `${name}.json`), JSON.stringify(anim));
  data.anims[name] = info;
}

let moves = 0;
for (const id of moveIds) {
  const main = byName.get(`Move:${essKey(id)}`);
  if (!main || !data.moves[id]) continue;
  const name = `ess-${id}`;
  write(name, main, byName.get(`OppMove:${essKey(id)}`));
  data.moves[id].pack = name;
  moves++;
}
let common = 0;
data.commonPack = {};
for (const [slot, essName] of Object.entries(COMMON)) {
  const a = byName.get(essName);
  if (!a) continue;
  const name = `ess-${animSlug(essName.replace('Common:', 'common-'))}`;
  write(name, a);
  data.commonPack[slot] = name;
  common++;
}
data.packSource = 'Pokémon Essentials 21.1 animations (Data/PkmnAnimations.rxdata, Graphics/Animations, Audio/SE/Anim) from the director\'s "Pokemon Essentials 21.1 UIE.rar"; the same file ships in "Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip"';
writeFileSync(animsFile, `${JSON.stringify(data, null, 2)}\n`);

for (const [slug, { file, hue }] of sheets) {
  const filter = `scale=iw/2:ih/2:flags=neighbor${hue ? `,hue=h=${hue}` : ''}`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(graphicsDir, file), '-vf', filter, join(outImage, `${slug}.png`)]);
}
for (const [slug, file] of sounds) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(soundDir, file), '-ac', '1', '-c:a', 'aac', '-b:a', '64k', join(outAudio, `${slug}.m4a`)]);
}
console.log(`${moves} moves and ${common} status animations; ${sheets.size} sheets, ${sounds.size} sounds.`);
