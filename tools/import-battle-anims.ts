// Builds the battle animations (Milestone 9): src/data/moveAnims.json (one
// presentation definition per move) plus the animation files the game loads on
// demand from public/assets/.
//
//   npm run data:anims -- <battle-anims folder> <images.zip> <audio.zip>
//
// Sources:
// - <battle-anims folder>: PokeRogue's animation frame data, one JSON file per
//   move (`thunderbolt.json`) or status effect (`common-burn.json`). It is not
//   in the director's packs; it comes from the same project as the packs
//   (github.com/pagefaultgames/pokerogue-assets, folder battle-anims, AGPL-3.0;
//   several files are credited there to Pokémon Reborn). Get it with:
//     git clone --depth 1 --filter=blob:none --sparse -b beta \
//       https://github.com/pagefaultgames/pokerogue-assets.git .cache/pokerogue-assets
//     git -C .cache/pokerogue-assets sparse-checkout set battle-anims
// - images.zip `images/battle_anims/*.png`: the sprite sheets (96×96 frames).
// - audio.zip `audio/battle_anims/*`: the sounds. WAV files are converted to
//   .m4a with ffmpeg when it is installed (about a tenth of the size).
//
// Output:
// - public/assets/battle-anims/<name>.json in a compact format (see
//   src/core/presentation/animFormat.ts), only for animations some move uses.
// - public/assets/images/battle_anims/<slug>.png and audio/battle_anims/<slug>.m4a
//   (file names lower-cased with spaces replaced, so URLs stay simple).
// - src/data/moveAnims.json. Moves without their own animation borrow one by
//   type and category (`TYPE_FALLBACK`), and say so (`source: "type"`).
//
// Afterwards run `npm run assets:manifest`.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { animSlug, type CompactAnim, type CompactEvent, type CompactFrame, type CompactVariant } from '../src/core/presentation/animFormat.ts';

const [animDir, imagesZip, audioZip] = process.argv.slice(2);
if (!animDir || !existsSync(animDir) || !imagesZip || !existsSync(imagesZip) || !audioZip || !existsSync(audioZip)) {
  console.error('Usage: npm run data:anims -- <battle-anims folder> <images.zip> <audio.zip>');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const assetsDir = join(root, 'public', 'assets');
const outAnimDir = join(assetsDir, 'battle-anims');
const outImageDir = join(assetsDir, 'images', 'battle_anims');
const outAudioDir = join(assetsDir, 'audio', 'battle_anims');

// ------------------------------------------------------------------ rules

/** Borrowed animations for moves without their own: [physical, special, status] per type. */
const TYPE_FALLBACK: Record<string, [string, string, string]> = {
  normal: ['tackle', 'hyper-voice', 'growl'],
  fire: ['fire-punch', 'ember', 'will-o-wisp'],
  water: ['waterfall', 'water-gun', 'withdraw'],
  electric: ['thunder-punch', 'thunder-shock', 'thunder-wave'],
  grass: ['vine-whip', 'razor-leaf', 'leech-seed'],
  ice: ['ice-punch', 'ice-beam', 'haze'],
  fighting: ['karate-chop', 'aura-sphere', 'bulk-up'],
  poison: ['poison-sting', 'sludge-bomb', 'toxic'],
  ground: ['earthquake', 'mud-slap', 'sand-attack'],
  flying: ['peck', 'gust', 'feather-dance'],
  psychic: ['zen-headbutt', 'confusion', 'calm-mind'],
  bug: ['bug-bite', 'signal-beam', 'string-shot'],
  rock: ['rock-throw', 'power-gem', 'harden'],
  ghost: ['lick', 'shadow-ball', 'confuse-ray'],
  dragon: ['dragon-claw', 'dragon-breath', 'dragon-dance'],
  dark: ['bite', 'dark-pulse', 'nasty-plot'],
  steel: ['metal-claw', 'flash-cannon', 'iron-defense'],
  fairy: ['play-rough', 'fairy-wind', 'sweet-kiss'],
};

/** Status and field animations the battle screen plays besides moves. */
const COMMON_ANIMS: Record<string, string> = {
  'status.brn': 'common-burn',
  'status.psn': 'common-poison',
  'status.par': 'common-paralysis',
  'status.slp': 'common-sleep',
  'status.frz': 'common-frozen',
  heal: 'common-health-up',
  item: 'common-use-item',
  confusion: 'common-confusion',
  protect: 'common-protect',
  bind: 'common-bind',
  seed: 'common-leech-seed',
  'weather.rain': 'common-rain',
  'weather.sun': 'common-sunny',
  'weather.sand': 'common-sandstorm',
  'weather.hail': 'common-hail',
  'weather.snow': 'common-snow',
};

const TYPE_HEX: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850',
  ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0',
  psychic: '#f85888', bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
  dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
};

interface MoveIn {
  id: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  priority?: number;
  effects: { fixedDamage?: unknown };
}

// ------------------------------------------------------------------ conversion

const round = (n: unknown) => (typeof n === 'number' ? Math.round(n * 100) / 100 : 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertFrame(s: any): CompactFrame {
  const flags = (s.visible ? 1 : 0) | (s.mirror ? 2 : 0) | (s.locked ? 4 : 0);
  const frame: CompactFrame = [
    s.target ?? 2,
    s.graphicFrame ?? 0,
    round(s.x),
    round(s.y),
    s.zoomX ?? 0,
    s.zoomY ?? 0,
    round(s.angle),
    s.opacity ?? 0,
    flags,
    s.blendType ?? 0,
    s.priority ?? 0,
    s.focus ?? 1,
  ];
  const tone: number[] | undefined = s.tone;
  if (tone && tone.some((v) => v)) (frame as unknown[]).push(tone.map(round));
  return frame;
}

function convertVariant(a: any, sounds: Set<string>, images: Set<string>, backgrounds: Set<string>): CompactVariant {
  const events: CompactEvent[] = [];
  for (const list of Object.values(a.frameTimedEvents ?? {}) as any[][]) {
    for (const e of list) {
      const res: string = e.resourceName ?? '';
      if (e.eventType === 'AnimTimedSoundEvent') {
        if (!res) continue;
        sounds.add(res);
        events.push({ f: e.frameIndex, k: 'sound', r: animSlug(res), v: e.volume ?? 100, p: e.pitch ?? 100 });
      } else if (e.eventType === 'AnimTimedAddBgEvent' || e.eventType === 'AnimTimedUpdateBgEvent') {
        if (res) backgrounds.add(res);
        events.push({
          f: e.frameIndex,
          k: e.eventType === 'AnimTimedAddBgEvent' ? 'bg' : 'bgUpdate',
          r: res ? animSlug(res) : '',
          x: round(e.bgX),
          y: round(e.bgY),
          o: e.opacity ?? 0,
          d: e.duration ?? 0,
        });
      }
    }
  }
  events.sort((x, y) => x.f - y.f);
  if (a.graphic) images.add(a.graphic);
  return { g: a.graphic ? animSlug(a.graphic) : null, frames: (a.frames as any[][]).map((f) => f.map(convertFrame)), events };
}

// ------------------------------------------------------------------ build

const moves = JSON.parse(readFileSync(join(root, 'src', 'data', 'moves.json'), 'utf8')) as MoveIn[];
const available = new Set(readdirSync(animDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
const pick = (name: string) => (available.has(name) ? name : 'tackle');

const moveDefs: Record<string, unknown> = {};
const used = new Set<string>();
let own = 0;
for (const m of moves) {
  const hasOwn = available.has(m.id);
  const fallback = TYPE_FALLBACK[m.type] ?? TYPE_FALLBACK.normal!;
  const anim = hasOwn ? m.id : pick(fallback[m.category === 'physical' ? 0 : m.category === 'special' ? 1 : 2]);
  if (hasOwn) own++;
  used.add(anim);
  // Two-turn moves have a separate wind-up animation (fly-charging, solar-beam-charging …).
  const chargeAnim = available.has(`${m.id}-charging`) ? `${m.id}-charging` : undefined;
  if (chargeAnim) used.add(chargeAnim);
  const power = m.effects.fixedDamage ? 60 : (m.power ?? 0);
  const attack = m.category !== 'status';
  moveDefs[m.id] = {
    anim,
    source: hasOwn ? 'own' : 'type',
    shake: !attack ? 0 : power >= 95 ? 3 : power >= 60 ? 2 : 1,
    flash: attack && power >= 90 ? TYPE_HEX[m.type] ?? null : null,
    hitStopMs: attack ? Math.min(110, Math.max(50, 40 + Math.round(power / 3))) : 0,
    telegraph: (m.priority ?? 0) > 0 ? 'quick' : attack && power >= 100 ? 'strong' : 'normal',
    ...(chargeAnim ? { chargeAnim } : {}),
  };
}
for (const name of Object.values(COMMON_ANIMS)) used.add(pick(name));

rmSync(outAnimDir, { recursive: true, force: true });
mkdirSync(outAnimDir, { recursive: true });
const sounds = new Set<string>();
const images = new Set<string>();
const animInfo: Record<string, { graphics: string[]; backgrounds: string[]; sounds: string[] }> = {};
let bytes = 0;
for (const name of [...used].sort()) {
  const raw = JSON.parse(readFileSync(join(animDir, `${name}.json`), 'utf8'));
  // A pair is [used by the player's side, used by the opponent's side].
  const variants = (Array.isArray(raw) ? raw : [raw]).filter((v: any) => v && Array.isArray(v.frames));
  const mySounds = new Set<string>();
  const myImages = new Set<string>();
  const myBackgrounds = new Set<string>();
  const out: CompactAnim = { v: 1, variants: variants.map((v: any) => convertVariant(v, mySounds, myImages, myBackgrounds)) };
  mySounds.forEach((s) => sounds.add(s));
  myImages.forEach((i) => images.add(i));
  myBackgrounds.forEach((i) => images.add(i));
  animInfo[name] = { graphics: [...myImages].map(animSlug).sort(), backgrounds: [...myBackgrounds].map(animSlug).sort(), sounds: [...mySounds].map(animSlug).sort() };
  const text = JSON.stringify(out);
  bytes += text.length;
  writeFileSync(join(outAnimDir, `${name}.json`), text);
}

// Sprite sheets and sounds out of the zips.
function extract(zip: string, prefix: string, names: Set<string>, matchBase: boolean): Map<string, string> {
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n')
    .filter((l) => l.startsWith(prefix) && !l.endsWith('/'));
  const byName = new Map<string, string>();
  for (const e of entries) {
    const file = e.slice(prefix.length);
    byName.set(file, e);
    if (matchBase) byName.set(file.replace(/\.[^.]+$/, ''), e);
  }
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const n of names) {
    const entry = byName.get(matchBase ? n : `${n}.png`) ?? byName.get(n.replace(/\.[^.]+$/, ''));
    if (entry) found.set(n, entry);
    else missing.push(n);
  }
  if (missing.length > 0) console.warn(`${zip}: ${missing.length} file(s) not found: ${missing.slice(0, 10).join(', ')}`);
  return found;
}

const tmp = mkdtempSync(join(tmpdir(), 'anims-'));
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

rmSync(outImageDir, { recursive: true, force: true });
mkdirSync(outImageDir, { recursive: true });
const imageEntries = extract(imagesZip, 'images/battle_anims/', images, false);
const imageList = [...imageEntries.values()];
for (let i = 0; i < imageList.length; i += 200) execFileSync('unzip', ['-o', '-q', imagesZip, ...imageList.slice(i, i + 200), '-d', tmp]);
for (const [name, entry] of imageEntries) copyFileSync(join(tmp, entry), join(outImageDir, `${animSlug(name)}.png`));

rmSync(outAudioDir, { recursive: true, force: true });
mkdirSync(outAudioDir, { recursive: true });
const audioEntries = extract(audioZip, 'audio/battle_anims/', sounds, true);
const audioList = [...audioEntries.values()];
for (let i = 0; i < audioList.length; i += 200) execFileSync('unzip', ['-o', '-q', audioZip, ...audioList.slice(i, i + 200), '-d', tmp]);
let converted = 0;
for (const [name, entry] of audioEntries) {
  const src = join(tmp, entry);
  const dest = join(outAudioDir, `${animSlug(name)}.m4a`);
  if (entry.toLowerCase().endsWith('.m4a')) {
    copyFileSync(src, dest);
  } else if (hasFfmpeg) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', dest]);
    converted++;
  } else {
    throw new Error('ffmpeg is needed to convert the WAV sounds to .m4a');
  }
}
rmSync(tmp, { recursive: true, force: true });

const out = {
  $comment: 'Presentation only: which animation, sound and screen effects each move uses. Never read by the battle rules. Built by tools/import-battle-anims.ts.',
  source: 'PokeRogue battle-anims (github.com/pagefaultgames/pokerogue-assets, AGPL-3.0; some animations from Pokémon Reborn), sheets and sounds from the director\'s images.zip and audio.zip',
  common: Object.fromEntries(Object.entries(COMMON_ANIMS).map(([k, v]) => [k, pick(v)])),
  anims: animInfo,
  moves: moveDefs,
};
writeFileSync(join(root, 'src', 'data', 'moveAnims.json'), JSON.stringify(out, null, 1) + '\n');

console.log(`${moves.length} moves: ${own} with their own animation, ${moves.length - own} borrowing one by type.`);
console.log(`${used.size} animation files (${(bytes / 1e6).toFixed(1)} MB), ${imageEntries.size} sprite sheets, ${audioEntries.size} sounds (${converted} converted to .m4a).`);
