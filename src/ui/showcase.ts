// The "showroom" pieces of the menu screens (Pokémon Battle Revolution style):
// a battlefield backdrop that slowly cycles through the game's arenas, the
// title logo, a Pokémon that fades in on a ground patch, and currency chips.

import Phaser from 'phaser';
import type { Species } from '../core/contentSchema';
import { services } from '../game/services';
import { itemVisual, pokemonVisual, type Visual } from './sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from './theme';
import { bounceIn, floatIdle, type MotionLevel } from './aero';
import { paintWindow } from './widgets';

/** Every arena background that is loaded, e.g. "bg.arena.volcano". */
export function arenaKeys(scene: Phaser.Scene): string[] {
  return services()
    .assets.entries()
    .map((e) => e.id)
    .filter((id) => /^bg\.arena\.[a-z_]+$/.test(id) && scene.textures.exists(id));
}

/**
 * A full-screen arena that crossfades to another arena every few seconds.
 * With `platformAt`, the arena's foe-side ground patch is moved so its centre
 * sits there (for a Pokémon to stand on).
 */
export class ArenaBackdrop {
  private keys: string[];
  private index: number;
  private layer: Phaser.GameObjects.Container | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: { platformAt?: { x: number; y: number }; dim?: number; everyMs?: number; only?: string } = {},
  ) {
    this.keys = arenaKeys(scene).sort();
    if (opts.only && this.keys.includes(opts.only)) this.keys = [opts.only];
    if (this.keys.length === 0 && scene.textures.exists('bg.battle')) this.keys.push('bg.battle');
    // Pick up where the clock says, so moving between screens keeps the same arena.
    this.index = this.keys.length > 0 ? Math.floor(Date.now() / (opts.everyMs ?? 6500)) % this.keys.length : 0;
    this.show(false);
    if (this.keys.length > 1) {
      scene.time.addEvent({ delay: opts.everyMs ?? 6500, loop: true, callback: () => this.next() });
    }
  }

  private build(key: string): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0).setDepth(-50);
    c.add(this.scene.add.image(0, 0, key).setOrigin(0).setScale(PIXEL_SCALE));
    const base = `${key}.enemy`;
    const at = this.opts.platformAt;
    if (at && this.scene.textures.exists(base)) {
      // The foe's patch is centred at art pixel (216, 72) in its 320×132 picture.
      c.add(this.scene.add.image(at.x - 216 * PIXEL_SCALE, at.y - 72 * PIXEL_SCALE, base).setOrigin(0).setScale(PIXEL_SCALE));
    }
    if (this.opts.dim) c.add(this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.background, this.opts.dim).setOrigin(0));
    return c;
  }

  private show(fade: boolean): void {
    const key = this.keys[this.index];
    if (!key) return;
    const old = this.layer;
    const next = this.build(key);
    this.layer = next;
    if (!fade || !old) {
      old?.destroy();
      return;
    }
    next.setAlpha(0);
    this.scene.tweens.add({ targets: next, alpha: 1, duration: 1200, ease: 'Sine.easeInOut', onComplete: () => old.destroy() });
  }

  next(): void {
    this.index = (this.index + 1) % this.keys.length;
    this.show(true);
  }
}

/** The game's logo: chunky gold letters with a red outline and a hard shadow. */
/**
 * The Pocket Raiders title: an original glossy crest (a rounded diamond with a spark) beside
 * a small "POCKET" over a big, aqua-gradient "RAIDERS". Width is about 6.4 x size, height about 2 x size.
 */
export function drawLogo(scene: Phaser.Scene, x: number, y: number, size = 56, origin = 0, motion: MotionLevel = 'full'): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const r = size * 0.9;
  const crest = scene.add.container(r, size * 1.0);
  const g = scene.add.graphics();
  const diamond = (k: number): number[] => [0, -r * k, r * k, 0, 0, r * k, -r * k, 0];
  const poly = (pts: number[]) => g.fillPoints(pts.reduce<Phaser.Math.Vector2[]>((a, v, i) => (i % 2 ? a : [...a, new Phaser.Math.Vector2(v, pts[i + 1])]), []), true);
  g.fillStyle(0x0c1f3a, 0.55);
  g.fillEllipse(0, r * 1.05, r * 1.5, r * 0.22);
  g.fillStyle(0x0b2a52, 1);
  poly(diamond(1.02));
  g.fillStyle(0x35c6f4, 1);
  poly(diamond(0.9));
  g.fillStyle(0x1b7fd6, 1);
  poly([-r * 0.9, 0, 0, r * 0.9, r * 0.9, 0, 0, r * 0.2]);
  g.fillStyle(0xffffff, 0.55);
  poly([-r * 0.78, -r * 0.04, 0, -r * 0.78, r * 0.78, -r * 0.04, 0, -r * 0.3]);
  g.lineStyle(Math.max(2, size / 14), 0xffffff, 0.9);
  g.strokePoints(diamond(0.9).reduce<Phaser.Math.Vector2[]>((a, v, i, all) => (i % 2 ? a : [...a, new Phaser.Math.Vector2(v, all[i + 1])]), []), true);
  // Spark: a four-pointed star with a gold core.
  const star = (k: number) => [0, -k, k * 0.28, -k * 0.28, k, 0, k * 0.28, k * 0.28, 0, k, -k * 0.28, k * 0.28, -k, 0, -k * 0.28, -k * 0.28];
  g.fillStyle(0x0b2a52, 1);
  poly(star(r * 0.62));
  g.fillStyle(0xffd23a, 1);
  poly(star(r * 0.5));
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(0, 0, r * 0.12);
  crest.add(g);
  c.add(crest);

  const tx = r * 2 + size * 0.25;
  const outline = (px: number) => ({ stroke: '#0b2a52', strokeThickness: Math.max(2, Math.round(px / 6)), shadow: { offsetX: 0, offsetY: Math.round(px / 12), color: '#06142a', fill: true, stroke: true, blur: 0 } });
  const small = Math.round(size * 0.5);
  const top = scene.add.text(tx + size * 0.05, size * 0.05, 'POCKET', textStyle(small, '#ffd23a', { ...outline(small), letterSpacing: Math.round(size * 0.22) })).setOrigin(0, 0);
  const bottom = scene.add.text(tx, size * 0.62, 'RAIDERS', textStyle(size, '#ffffff', outline(size))).setOrigin(0, 0);
  if (bottom.setTint) {
    bottom.setTint(0xffffff, 0xffffff, 0x7fe3ff, 0x4fb6f2);
    top.setTint(0xfff3a8, 0xfff3a8, 0xffb21a, 0xffb21a);
  }
  c.add([bottom, top]);
  c.x -= (tx + bottom.width) * origin;
  if (motion === 'full') {
    bounceIn(scene, c, motion);
    floatIdle(scene, crest, motion, size * 0.06, 2200);
    scene.tweens.add({ targets: crest, angle: { from: -4, to: 4 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return c;
}

/** A Pokémon standing at (x, y) that fades and rises in, replacing the previous one. */
export class ShowcaseMon {
  private current: Visual | null = null;
  private shown: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly scale = PIXEL_SCALE,
    /** Very tall Pokémon are shrunk to fit under this height. */
    private readonly maxHeight = 260,
  ) {}

  show(species: Species): void {
    if (this.shown === species.id) return;
    this.shown = species.id;
    const old = this.current;
    if (old) {
      this.scene.tweens.killTweensOf(old);
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 220, ease: 'Sine.easeIn', onComplete: () => old.destroy() });
    }
    const mon = pokemonVisual(this.scene, species, 'front', this.x, this.y + 10, this.scale).setAlpha(0).setDepth(-10);
    fitHeight(this.scene, mon, this.maxHeight);
    this.current = mon;
    this.scene.tweens.add({ targets: mon, alpha: 1, y: this.y, duration: 420, ease: 'Cubic.easeOut' });
  }
}

/** Shrinks a Pokémon picture that is taller than `maxHeight` (also once late-loading art arrives). */
export function fitHeight(scene: Phaser.Scene, mon: Visual, maxHeight: number): Visual {
  const fit = () => {
    if (!mon.active) return;
    const h = mon instanceof Phaser.GameObjects.Sprite ? mon.height : mon.getBounds().height / mon.scaleY;
    if (h * mon.scaleY > maxHeight) mon.setScale(maxHeight / h);
  };
  fit();
  if (!(mon instanceof Phaser.GameObjects.Sprite)) scene.time.delayedCall(600, fit);
  return mon;
}

/**
 * Scales a picture to exactly `heightPx` tall (up or down). A placeholder that is later swapped for the real art
 * (it emits 'art-ready') is reset to scale 1 and measured again, so the art's own pixel scale is never multiplied
 * by the placeholder's fit.
 */
export function sizeToHeight(scene: Phaser.Scene, visual: Visual, heightPx: number): Visual {
  const fit = () => {
    if (!visual.active) return;
    if (visual instanceof Phaser.GameObjects.Sprite) {
      if (visual.height > 0) visual.setScale(heightPx / visual.height);
      return;
    }
    visual.setScale(1);
    const natural = visual.getBounds().height;
    if (natural > 0) visual.setScale(heightPx / natural);
  };
  fit();
  if (!(visual instanceof Phaser.GameObjects.Sprite)) visual.on('art-ready', fit);
  return visual;
}

/** A small rounded counter with an item icon, e.g. Bank Credits. Returns its width. */
export function currencyChip(scene: Phaser.Scene, rightX: number, y: number, icon: string, value: string | number, label: string): number {
  const text = scene.add.text(0, 0, `${value}`, textStyle(22)).setOrigin(1, 0.5);
  const w = Math.max(84, text.width + 56);
  const c = scene.add.container(rightX - w, y);
  const g = paintWindow(scene.add.graphics(), 0, -20, w, 40, { thin: true, fill: 0x221d29, border: COLORS.borderMuted, alpha: 0.92 });
  c.add(g);
  c.add(itemVisual(scene, icon, 22, 0, 1));
  text.setPosition(w - 12, 0);
  c.add(text);
  const zone = scene.add.zone(0, -20, w, 40).setOrigin(0).setInteractive();
  const tip = scene.add.text(w / 2, 26, label, textStyle(14, COLORS.textMuted)).setOrigin(0.5, 0).setVisible(false);
  c.add([zone, tip]);
  zone.on('pointerover', () => tip.setVisible(true));
  zone.on('pointerout', () => tip.setVisible(false));
  return w;
}
