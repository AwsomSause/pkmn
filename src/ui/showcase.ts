// The "showroom" pieces of the menu screens (Pokémon Battle Revolution style):
// a battlefield backdrop that slowly cycles through the game's arenas, the
// title logo, a Pokémon that fades in on a ground patch, and currency chips.

import Phaser from 'phaser';
import type { Species } from '../core/contentSchema';
import { services } from '../game/services';
import { itemVisual, pokemonVisual, type Visual } from './sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from './theme';
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
export function drawLogo(scene: Phaser.Scene, x: number, y: number, size = 56, origin = 0): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const style = (color: string) =>
    textStyle(size, color, {
      stroke: '#c73625',
      strokeThickness: Math.round(size / 7),
      shadow: { offsetX: 0, offsetY: Math.round(size / 10), color: '#181818', fill: true, stroke: true, blur: 0 },
    });
  const top = scene.add.text(0, 0, 'Pokémon', style(COLORS.textLight)).setOrigin(origin, 0);
  const bottom = scene.add.text(0, top.height - size * 0.2, 'Roguelike', style(COLORS.gold)).setOrigin(origin, 0);
  c.add([top, bottom]);
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
