// The Trainer Plaza's tile-map world (Plaza styles): the baked Pokemon-Memories map, stall keepers, the wandering crowd,
// the player and their lead Pokémon, all in map pixels inside one container that each style frames (scale + offset).
// Presentation only: positions come from core/presentation/plazaStyles.ts and a private hash, never gameplay RNG.

import Phaser from 'phaser';
import type { Species } from '../../core/contentSchema';
import { DISTRICT_SPOTS, PLAZA_ENTRY, PLAZA_FLOOR, PLAZA_KEEPERS, PLAZA_MAP, plazaSheetId, walkerSheet, type TileSpot } from '../../core/presentation/plazaStyles';
import type { DistrictView, PlazaLayout, Wanderer } from '../../core/plaza/layout';
import { hashSeed, Rng } from '../../core/rng';
import type { MotionLevel } from '../aero';
import { pokemonIcon } from '../sprites';

const T = PLAZA_MAP.tile;
export const MAP_KEY = 'pack.memories.plaza.map';
const DIRS = ['down', 'left', 'right', 'up'] as const;
type Dir = (typeof DIRS)[number];

export const px = (s: TileSpot): { x: number; y: number } => ({ x: s.x * T, y: s.y * T });
export const spotOf = (d: DistrictView): { label: TileSpot; stand: TileSpot } => DISTRICT_SPOTS[d.id];

export interface PlazaWorld {
  root: Phaser.GameObjects.Container;
  /** The crowd's figures by wanderer id (and 'player'), for speech bubbles and tags. */
  people: Map<string, Phaser.GameObjects.Container>;
  player: Phaser.GameObjects.Container;
  /** Walks (or snaps) the player to a district's standing spot. */
  walkTo(d: DistrictView, instant: boolean): void;
  /** Adds an overlay object at map pixels, kept the same on-screen size whatever the style's scale. */
  pin<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform>(obj: T, x: number, y: number, layer?: number): T;
  /** Converts map pixels to screen pixels with the world's current transform. */
  toScreen(x: number, y: number): { x: number; y: number };
}

function sheetReady(scene: Phaser.Scene, sheet: string): boolean {
  const key = plazaSheetId(sheet);
  return scene.textures.exists(key) && scene.textures.get(key).frameTotal >= 16;
}

function walkAnim(scene: Phaser.Scene, sheet: string, dir: Dir): string {
  const key = plazaSheetId(sheet);
  const name = `${key}.${dir}`;
  if (!scene.anims.exists(name)) {
    const row = DIRS.indexOf(dir);
    scene.anims.create({ key: name, frames: scene.anims.generateFrameNumbers(key, { start: row * 4, end: row * 4 + 3 }), frameRate: 7, repeat: -1 });
  }
  return name;
}

/** A standing figure from a walk sheet (64 px frames, feet at the bottom), or a small drawn figure while art is missing. */
function figure(scene: Phaser.Scene, sheet: string, color = 0x5a78c8): { body: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite | null } {
  const shadow = scene.add.ellipse(0, -2, 26, 9, 0x000000, 0.25);
  if (sheetReady(scene, sheet)) {
    const sprite = scene.add.sprite(0, 0, plazaSheetId(sheet), 0).setOrigin(0.5, 1);
    return { body: scene.add.container(0, 0, [shadow, sprite]), sprite };
  }
  const g = scene.add.graphics();
  g.fillStyle(color, 1).fillRoundedRect(-8, -30, 16, 24, 5);
  g.fillStyle(0xf4d8b8, 1).fillCircle(0, -36, 8);
  return { body: scene.add.container(0, 0, [shadow, g]), sprite: null };
}

function face(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite | null, sheet: string, dir: Dir, moving: boolean): void {
  if (!sprite) return;
  if (moving) sprite.play(walkAnim(scene, sheet, dir), true);
  else {
    sprite.stop();
    sprite.setFrame(DIRS.indexOf(dir) * 4);
  }
}

function dirOf(dx: number, dy: number): Dir {
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

export function buildWorld(scene: Phaser.Scene, opts: { layout: PlazaLayout; sideId: string; motion: MotionLevel; focus: number; lead: Species | undefined; species: (id: string) => Species | undefined; onTalk: (w: Wanderer, node: Phaser.GameObjects.Container) => void }): PlazaWorld {
  const { layout, motion } = opts;
  const root = scene.add.container(0, 0);
  if (scene.textures.exists(MAP_KEY)) root.add(scene.add.image(0, 0, MAP_KEY).setOrigin(0, 0).setDepth(-1e6));
  else root.add(scene.add.rectangle(0, 0, PLAZA_MAP.cols * T, PLAZA_MAP.rows * T, 0x78c070).setOrigin(0, 0).setDepth(-1e6));
  const people = new Map<string, Phaser.GameObjects.Container>();
  const place = (o: Phaser.GameObjects.Container, x: number, y: number): void => {
    o.setPosition(x, y).setDepth(y);
    root.add(o);
  };

  // Stall keepers and counter staff: still, with a soft idle bob.
  PLAZA_KEEPERS.forEach((k, i) => {
    const { body } = figure(scene, k.sheet);
    const p = px(k.at);
    place(body, p.x, p.y + T);
    if (motion === 'full') scene.tweens.add({ targets: body, y: body.y - 2, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });

  // The crowd: trainers walk around their home district on the square; Pokémon follow their trainer.
  const followers: { mon: Phaser.GameObjects.Container; owner: string }[] = [];
  const byId = new Map(layout.crowd.map((w) => [w.id, w]));
  const floor = { x0: PLAZA_FLOOR.x * T, y0: PLAZA_FLOOR.y * T, x1: (PLAZA_FLOOR.x + PLAZA_FLOOR.w) * T, y1: (PLAZA_FLOOR.y + PLAZA_FLOOR.h) * T };
  for (const w of layout.crowd) {
    const home = px(DISTRICT_SPOTS[w.home].stand);
    const rng = new Rng(hashSeed(`${opts.sideId}::walk::${w.id}`));
    const roam = Phaser.Math.Clamp(w.roam * 0.9, 2 * T, 6 * T);
    const pick = (): { x: number; y: number } => ({
      x: Phaser.Math.Clamp(home.x + rng.int(-roam, roam), floor.x0, floor.x1),
      y: Phaser.Math.Clamp(home.y + rng.int(-roam / 2, roam), floor.y0, floor.y1),
    });
    const at = pick();
    let node: Phaser.GameObjects.Container;
    let sprite: Phaser.GameObjects.Sprite | null = null;
    const sheet = walkerSheet(w.id, w.kind);
    if (w.kind === 'pokemon' && w.speciesId) {
      const sp = opts.species(w.speciesId);
      node = scene.add.container(0, 0, [scene.add.ellipse(0, -2, 22, 8, 0x000000, 0.22), ...(sp ? [pokemonIcon(scene, sp, 0, -16, 1)] : [])]);
    } else {
      const f = figure(scene, sheet, w.color);
      node = f.body;
      sprite = f.sprite;
      face(scene, sprite, sheet, 'down', false);
      if (w.kind === 'rare') node.addAt(scene.add.ellipse(0, -28, 38, 60, 0xfff0a0, 0.18).setStrokeStyle(2, 0xfff0a0, 0.9), 0);
    }
    place(node, at.x, at.y);
    node.setSize(30, 56).setInteractive({ useHandCursor: true });
    node.on('pointerdown', () => opts.onTalk(w, node));
    people.set(w.id, node);
    if (w.follows && byId.has(w.follows)) {
      followers.push({ mon: node, owner: w.follows });
      continue;
    }
    if (motion === 'off') continue;
    const speed = (motion === 'reduced' ? 0.6 : 1) * Math.max(20, w.speed * 0.8);
    const step = (): void => {
      if (!node.active) return;
      const to = pick();
      const dist = Phaser.Math.Distance.Between(node.x, node.y, to.x, to.y);
      const dir = dirOf(to.x - node.x, to.y - node.y);
      scene.time.delayedCall(rng.int(400, 2800), () => {
        if (!node.active) return;
        face(scene, sprite, sheet, dir, true);
        scene.tweens.add({
          targets: node, x: to.x, y: to.y, duration: (dist / speed) * 1000, ease: 'Linear',
          onUpdate: () => node.setDepth(node.y),
          onComplete: () => {
            face(scene, sprite, sheet, dir, false);
            step();
          },
        });
      });
    };
    step();
  }

  // The player and their lead Pokémon.
  const start = layout.districts[opts.focus] ? px(DISTRICT_SPOTS[layout.districts[opts.focus]!.id].stand) : px(PLAZA_ENTRY);
  const me = figure(scene, 'boy_run');
  const player = me.body;
  face(scene, me.sprite, 'boy_run', 'up', false);
  place(player, start.x, start.y);
  people.set('player', player);
  if (opts.lead) {
    const mon = scene.add.container(0, 0, [scene.add.ellipse(0, -2, 22, 8, 0x000000, 0.22), pokemonIcon(scene, opts.lead, 0, -16, 1)]);
    place(mon, start.x + 28, start.y + 10);
    followers.push({ mon, owner: 'player' });
  }
  const onUpdate = (): void => {
    for (const f of followers) {
      const owner = people.get(f.owner);
      if (!owner || !f.mon.active) continue;
      f.mon.x += (owner.x + 26 - f.mon.x) * 0.08;
      f.mon.y += (owner.y + 8 - f.mon.y) * 0.08;
      f.mon.setDepth(f.mon.y);
    }
    root.sort('depth');
  };
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => scene.events.off('update', onUpdate));

  let walking: Phaser.Tweens.Tween | null = null;
  const world: PlazaWorld = {
    root,
    people,
    player,
    walkTo(d, instant) {
      const to = px(DISTRICT_SPOTS[d.id].stand);
      walking?.stop();
      if (instant || motion === 'off') {
        player.setPosition(to.x, to.y).setDepth(to.y);
        face(scene, me.sprite, 'boy_run', 'up', false);
        return;
      }
      const dist = Phaser.Math.Distance.Between(player.x, player.y, to.x, to.y);
      face(scene, me.sprite, 'boy_run', dirOf(to.x - player.x, to.y - player.y), true);
      walking = scene.tweens.add({
        targets: player, x: to.x, y: to.y, duration: Math.min(900, 120 + dist * (motion === 'reduced' ? 2.4 : 1.6)), ease: 'Sine.easeInOut',
        onUpdate: () => player.setDepth(player.y),
        onComplete: () => face(scene, me.sprite, 'boy_run', 'up', false),
      });
    },
    pin(obj, x, y, layer = 1e6) {
      obj.setPosition(x, y);
      (obj as unknown as Phaser.GameObjects.Components.Depth).setDepth(layer + y);
      obj.setScale(1 / (root.scaleX || 1));
      root.add(obj);
      return obj;
    },
    toScreen(x, y) {
      return { x: root.x + x * root.scaleX, y: root.y + y * root.scaleY };
    },
  };
  return world;
}
