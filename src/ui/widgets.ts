// Reusable screen pieces: panels, selectable menus and HP/XP bars.

import Phaser from 'phaser';
import { BAR_SHADES, COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, mixColor, textStyle } from './theme';
import { playSfx } from './audio';
import type { InputAction } from './input';
import { AERO, paintGlass, type MotionLevel } from './aero';

const U = PIXEL_SCALE;

/**
 * Draws a PokeRogue-style window onto g: a near-black outline with clipped
 * corners, a coloured trim, a soft inner shadow and a plum fill. Sizes are in
 * screen pixels; the trim is drawn in 3×3 "art pixels" so it matches the sprites.
 */
export function paintWindow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; border?: number; alpha?: number; thin?: boolean } = {},
): Phaser.GameObjects.Graphics {
  const fill = opts.fill ?? COLORS.panel;
  const border = opts.border ?? COLORS.border;
  const alpha = opts.alpha ?? 1;
  const trim = opts.thin ? 2 : 3;
  const outline = 0x181818;
  // Outline, then trim, each with corners clipped by one art pixel more.
  g.fillStyle(outline, alpha);
  g.fillRect(x + 2 * U, y, w - 4 * U, h);
  g.fillRect(x + U, y + U, w - 2 * U, h - 2 * U);
  g.fillRect(x, y + 2 * U, w, h - 4 * U);
  g.fillStyle(border, alpha);
  g.fillRect(x + 2 * U, y + U, w - 4 * U, h - 2 * U);
  g.fillRect(x + U, y + 2 * U, w - 2 * U, h - 4 * U);
  // A darker edge where the trim meets the fill.
  const inset = (1 + trim) * U;
  g.fillStyle(mixColor(border, 0x000000, 0.4), alpha);
  g.fillRect(x + inset - U, y + inset - U, w - 2 * inset + 2 * U, h - 2 * inset + 2 * U);
  g.fillStyle(fill, alpha);
  g.fillRect(x + inset, y + inset, w - 2 * inset, h - 2 * inset);
  // Inner shadow along the top and left, as in PokeRogue's window art.
  g.fillStyle(mixColor(fill, border, 0.22), alpha);
  g.fillRect(x + inset, y + inset, w - 2 * inset, U);
  g.fillStyle(mixColor(fill, border, 0.1), alpha);
  g.fillRect(x + inset, y + inset + U, U, h - 2 * inset - U);
  return g;
}

export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; border?: number; alpha?: number; thin?: boolean } = {},
): Phaser.GameObjects.Graphics {
  return paintWindow(scene.add.graphics(), x, y, w, h, opts);
}

/**
 * A gold pixel frame around a focused card or row (drawn just outside the
 * given box). Hidden or shown by the caller.
 */
export function focusFrame(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number = COLORS.accent): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const t = 2 * U;
  const ox = x - t - U;
  const oy = y - t - U;
  const ow = w + 2 * (t + U);
  const oh = h + 2 * (t + U);
  g.fillStyle(0x181818, 1);
  g.fillRect(ox + U, oy, ow - 2 * U, U);
  g.fillRect(ox + U, oy + oh - U, ow - 2 * U, U);
  g.fillRect(ox, oy + U, U, oh - 2 * U);
  g.fillRect(ox + ow - U, oy + U, U, oh - 2 * U);
  g.fillStyle(color, 1);
  g.fillRect(ox + U, oy + U, ow - 2 * U, t);
  g.fillRect(ox + U, oy + oh - U - t, ow - 2 * U, t);
  g.fillRect(ox + U, oy + U, t, oh - 2 * U);
  g.fillRect(ox + ow - U - t, oy + U, t, oh - 2 * U);
  // Bright corner pixels, like PokeRogue's selection cursor.
  g.fillStyle(0xffffff, 1);
  for (const [cx, cy] of [[ox + U, oy + U], [ox + ow - 2 * U, oy + U], [ox + U, oy + oh - 2 * U], [ox + ow - 2 * U, oy + oh - 2 * U]] as const) {
    g.fillRect(cx, cy, U, U);
  }
  // A slow pulse so the focus stands out even next to gold-trimmed cards.
  scene.tweens.add({ targets: g, alpha: 0.55, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return g;
}

/**
 * The backdrop behind menu screens: a dark grid (like PokeRogue's party and
 * starter screens) crossed by a lighter diagonal band with a teal edge.
 */
export function drawBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-100);
  g.fillStyle(COLORS.background, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.fillStyle(0x2c2836, 1);
  for (let x = 0; x <= GAME_WIDTH; x += 8 * U) g.fillRect(x, 0, 1, GAME_HEIGHT);
  for (let y = 0; y <= GAME_HEIGHT; y += 8 * U) g.fillRect(0, y, GAME_WIDTH, 1);
  // The diagonal band.
  const band = (x0: number, x1: number, color: number, alpha: number) => {
    g.fillStyle(color, alpha);
    g.fillPoints(
      [
        new Phaser.Geom.Point(x0, 0),
        new Phaser.Geom.Point(x1, 0),
        new Phaser.Geom.Point(x1 - GAME_HEIGHT * 0.9, GAME_HEIGHT),
        new Phaser.Geom.Point(x0 - GAME_HEIGHT * 0.9, GAME_HEIGHT),
      ],
      true,
    );
  };
  band(GAME_WIDTH * 0.08, GAME_WIDTH * 0.55, 0x3a3348, 0.45);
  band(GAME_WIDTH * 0.55, GAME_WIDTH * 0.55 + U, 0x20b098, 0.6);
  // Darker top and bottom edges frame the screen.
  g.fillStyle(0x000000, 0.25);
  g.fillRect(0, 0, GAME_WIDTH, 2 * U);
  g.fillRect(0, GAME_HEIGHT - 2 * U, GAME_WIDTH, 2 * U);
  return g;
}

export interface MenuOption {
  label: string;
  disabled?: boolean;
  /** Optional extra line shown under the label (e.g. "PP 20/25"). */
  detail?: string;
}

export interface MenuConfig {
  x: number;
  y: number;
  options: MenuOption[];
  columns?: number;
  itemWidth?: number;
  itemHeight?: number;
  fontSize?: number;
  color?: string;
  onSelect: (index: number) => void;
  onFocus?: (index: number) => void;
  onBack?: () => void;
  /**
   * Opt-in Aero look: each option sits on a glossy glass pill (optionally
   * tinted per option) and the focused one glows and bounces.
   */
  glass?: { tints?: (number | undefined)[]; motion?: MotionLevel };
}

/**
 * A list (or grid) of options with a ▶ cursor. Works with the keyboard via
 * `handle(action)` and with the mouse by clicking/hovering an option.
 */
export class Menu {
  readonly container: Phaser.GameObjects.Container;
  index = 0;
  enabled = true;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly cursor: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  private readonly cursorOffsetY: number;
  private readonly columns: number;
  private readonly itemWidth: number;
  private readonly itemHeight: number;
  private readonly pills: Phaser.GameObjects.Graphics[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly config: MenuConfig) {
    this.columns = config.columns ?? 1;
    this.itemWidth = config.itemWidth ?? 260;
    this.itemHeight = config.itemHeight ?? 44;
    const size = config.fontSize ?? 28;
    this.container = scene.add.container(config.x, config.y);
    if (config.glass) {
      config.options.forEach((_, i) => {
        const pill = scene.add.graphics();
        this.pills.push(pill);
        this.container.add(pill);
      });
    }
    config.options.forEach((opt, i) => {
      const { x, y } = this.position(i);
      const text = scene.add
        .text(x + 28, y, opt.detail ? `${opt.label}\n${opt.detail}` : opt.label, textStyle(size, config.color ?? COLORS.text, { lineSpacing: -4 }))
        .setAlpha(opt.disabled ? 0.4 : 1)
        .setInteractive({ useHandCursor: !opt.disabled });
      text.on('pointerover', () => {
        if (!opt.disabled && this.enabled) this.focus(i, false);
      });
      text.on('pointerdown', () => {
        if (!this.enabled) return;
        this.focus(i, false);
        this.confirm();
      });
      this.labels.push(text);
      this.container.add(text);
    });
    // PokeRogue's white pointer, sized to the text; a ▶ if the picture is missing.
    if (scene.textures.exists('ui.cursor')) {
      const scale = size >= 24 ? PIXEL_SCALE : 2;
      this.cursor = scene.add.image(4, 0, 'ui.cursor').setOrigin(0, 0).setScale(scale);
      this.cursorOffsetY = Math.max(0, Math.round(size * 0.62 - 5 * scale));
    } else {
      this.cursor = scene.add.text(0, 0, '▶', textStyle(size, COLORS.cursor));
      this.cursorOffsetY = 0;
    }
    this.container.add(this.cursor);
    const first = config.options.findIndex((o) => !o.disabled);
    this.focus(first >= 0 ? first : 0, false);
  }

  /** Top-left of option i inside the menu's container (for icons drawn on top). */
  slot(i: number): { x: number; y: number } {
    return this.position(i);
  }

  private paintPills(focused: number): void {
    const size = this.config.fontSize ?? 28;
    this.pills.forEach((pill, i) => {
      const { x, y } = this.position(i);
      const opt = this.config.options[i]!;
      const tint = this.config.glass?.tints?.[i] ?? AERO.glass;
      const on = i === focused && !opt.disabled;
      pill.clear();
      paintGlass(pill, x - 4, y - 8, this.itemWidth - 12, Math.max(size + 14, this.itemHeight - 8), {
        tint: on ? tint : mixColor(tint, AERO.glass, 0.45),
        rim: on ? AERO.rim : 0x9fb8d0,
        alpha: opt.disabled ? 0.45 : on ? 1 : 0.7,
        glow: on,
        radius: 20,
      });
    });
  }

  private position(i: number): { x: number; y: number } {
    return { x: (i % this.columns) * this.itemWidth, y: Math.floor(i / this.columns) * this.itemHeight };
  }

  focus(i: number, sound = true): void {
    if (i < 0 || i >= this.config.options.length) return;
    if (sound && i !== this.index) playSfx(this.scene, 'ui.select', 0.5);
    this.index = i;
    const { x, y } = this.position(i);
    this.cursor.setPosition(x + 4, y + this.cursorOffsetY);
    if (this.config.glass) {
      this.paintPills(i);
      const label = this.labels[i];
      if (label && this.config.glass.motion === 'full') {
        this.scene.tweens.killTweensOf(label);
        label.setScale(1);
        this.scene.tweens.add({ targets: label, scale: 1.08, duration: 110, yoyo: true, ease: 'Back.easeOut' });
      }
    }
    this.config.onFocus?.(i);
  }

  confirm(): void {
    const opt = this.config.options[this.index];
    if (!opt || opt.disabled) {
      playSfx(this.scene, 'ui.error');
      return;
    }
    playSfx(this.scene, 'ui.select');
    this.config.onSelect(this.index);
  }

  handle(action: InputAction): void {
    if (!this.enabled) return;
    const count = this.config.options.length;
    const step = (delta: number) => {
      let next = this.index;
      for (let n = 0; n < count; n++) {
        next = (next + delta + count) % count;
        if (!this.config.options[next]?.disabled) break;
      }
      this.focus(next);
    };
    switch (action) {
      case 'up':
        step(this.columns > 1 ? -this.columns : -1);
        break;
      case 'down':
        step(this.columns > 1 ? this.columns : 1);
        break;
      case 'left':
        if (this.columns > 1) step(-1);
        break;
      case 'right':
        if (this.columns > 1) step(1);
        break;
      case 'confirm':
        this.confirm();
        break;
      case 'back':
        this.config.onBack?.();
        break;
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    this.enabled = visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}

/** B2W2 HP gauge colours (top highlight, body, lower shade): green above half, yellow above a fifth, red below. */
const HP_GAUGE = {
  high: [0x9cf890, 0x38c838, 0x1f8a28],
  medium: [0xfff08a, 0xf0c010, 0xb08a08],
  low: [0xff9a88, 0xe03828, 0x982018],
} as const;

/** A horizontal bar (HP or XP) that animates to new values. HP draws as a B2W2-style pill gauge; XP stays a thin two-tone strip. */
export class Bar {
  private readonly bg: Phaser.GameObjects.Rectangle | null;
  private readonly fill: Phaser.GameObjects.Rectangle | null;
  /** The lighter top half of the XP bar. */
  private readonly shine: Phaser.GameObjects.Rectangle | null;
  /** HP gauge: one graphics object (track, lost-HP strip, fill) redrawn on every change. */
  private readonly gauge: Phaser.GameObjects.Graphics | null;
  /** HP gauge: the pale strip showing the HP just lost, which catches up after the bar drains. */
  private readonly ghost = { w: 0 };
  private readonly h: number;
  private ratio = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    height: number,
    private readonly kind: 'hp' | 'xp',
  ) {
    // The gauge is taller than the old strip so the rounded ends and the highlight read.
    this.h = kind === 'hp' ? Math.max(height, 10) : height;
    if (kind === 'hp') {
      this.gauge = scene.add.graphics();
      this.bg = this.fill = this.shine = null;
      this.ghost.w = width;
      this.draw();
    } else {
      this.gauge = null;
      this.bg = scene.add.rectangle(x, y, width, height, 0x212121).setOrigin(0, 0.5);
      this.fill = scene.add.rectangle(x, y, width, height, BAR_SHADES.xp[1]).setOrigin(0, 0.5);
      this.shine = scene.add.rectangle(x, y - height / 2, width, Math.ceil(height / 2), BAR_SHADES.xp[0]).setOrigin(0, 0);
    }
  }

  set(ratio: number, animate = false): Promise<void> {
    const target = Phaser.Math.Clamp(ratio, 0, 1);
    return new Promise((resolve) => {
      if (!animate) {
        this.apply(target);
        resolve();
        return;
      }
      const from = { r: this.ratio };
      // Bigger changes take a little longer, so the drain reads as one smooth motion.
      const duration = Math.round(250 + 450 * Math.abs(target - this.ratio));
      const dropping = target < this.ratio;
      if (this.gauge && dropping) this.ghost.w = this.width * this.ratio;
      this.scene.tweens.add({
        targets: from,
        r: target,
        duration,
        ease: 'Sine.easeOut',
        onUpdate: () => this.apply(from.r, !dropping),
        onComplete: () => {
          this.apply(target, !dropping);
          if (this.gauge && dropping) {
            this.scene.tweens.add({ targets: this.ghost, w: this.width * target, delay: 180, duration: 320, ease: 'Quad.easeIn', onUpdate: () => this.draw() });
          }
          resolve();
        },
      });
    });
  }

  private apply(ratio: number, moveGhost = true): void {
    this.ratio = ratio;
    if (this.gauge) {
      if (moveGhost) {
        this.scene.tweens.killTweensOf(this.ghost);
        this.ghost.w = this.width * ratio;
      }
      this.draw();
      return;
    }
    this.fill!.width = Math.max(0, this.width * ratio);
    this.shine!.width = this.fill!.width;
  }

  /** Track (dark pill, pale rim), lost-HP strip, then the three-band fill with rounded ends. */
  private draw(): void {
    const g = this.gauge!;
    const { x, y, width, h } = this;
    const top = y - h / 2;
    g.clear();
    g.fillStyle(0xf0f0e8, 1).fillRoundedRect(x - 2, top - 2, width + 4, h + 4, h / 2 + 2);
    g.fillStyle(0x303838, 1).fillRoundedRect(x - 1, top - 1, width + 2, h + 2, h / 2 + 1);
    g.fillStyle(0x182020, 1).fillRoundedRect(x, top, width, h, h / 2);
    const fillW = this.width * this.ratio;
    if (this.ghost.w > fillW + 0.5) g.fillStyle(0xf8e0c0, 1).fillRoundedRect(x, top, this.ghost.w, h, Math.min(h / 2, this.ghost.w / 2));
    if (fillW < 1) return;
    const shades = this.ratio > 0.5 ? HP_GAUGE.high : this.ratio > 0.2 ? HP_GAUGE.medium : HP_GAUGE.low;
    const r = Math.min(h / 2, fillW / 2);
    g.fillStyle(shades[2], 1).fillRoundedRect(x, top, fillW, h, r);
    g.fillStyle(shades[1], 1).fillRoundedRect(x, top, fillW, h - 2, r);
    if (fillW > 6) g.fillStyle(shades[0], 1).fillRoundedRect(x + 2, top + 1, fillW - 4, Math.max(2, Math.floor(h / 3)), 1);
  }

  addTo(container: Phaser.GameObjects.Container): void {
    if (this.gauge) container.add(this.gauge);
    else container.add([this.bg!, this.fill!, this.shine!]);
  }
}

/** A small rounded label, used for types and statuses. */
export function badge(scene: Phaser.Scene, x: number, y: number, label: string, color: number, size = 18): Phaser.GameObjects.Container {
  const text = scene.add
    .text(0, 0, label.toUpperCase(), textStyle(size, '#ffffff', { shadow: { offsetX: 1, offsetY: 1, color: `#${mixColor(color, 0x000000, 0.55).toString(16).padStart(6, '0')}`, fill: true, blur: 0 } }))
    .setOrigin(0.5);
  const w = Math.max(56, Math.ceil((text.width + 16) / 2) * 2);
  const h = Math.ceil((text.height + 6) / 2) * 2;
  // A pixel pill: dark outline, the type colour, a lighter top edge.
  const g = scene.add.graphics();
  g.fillStyle(mixColor(color, 0x000000, 0.45), 1);
  g.fillRect(-w / 2 + 2, -h / 2, w - 4, h);
  g.fillRect(-w / 2, -h / 2 + 2, w, h - 4);
  g.fillStyle(color, 1);
  g.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  g.fillStyle(mixColor(color, 0xffffff, 0.35), 1);
  g.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 2);
  const c = scene.add.container(x + w / 2, y + h / 2, [g, text]);
  c.setSize(w, h);
  return c;
}
