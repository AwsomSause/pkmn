// Reusable screen pieces: panels, selectable menus and HP/XP bars.

import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';
import { playSfx } from './audio';
import type { InputAction } from './input';

export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; border?: number; radius?: number; alpha?: number } = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const radius = opts.radius ?? 10;
  g.fillStyle(opts.fill ?? COLORS.panel, opts.alpha ?? 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(4, opts.border ?? COLORS.border, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
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
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly columns: number;
  private readonly itemWidth: number;
  private readonly itemHeight: number;

  constructor(private readonly scene: Phaser.Scene, private readonly config: MenuConfig) {
    this.columns = config.columns ?? 1;
    this.itemWidth = config.itemWidth ?? 260;
    this.itemHeight = config.itemHeight ?? 44;
    const size = config.fontSize ?? 28;
    this.container = scene.add.container(config.x, config.y);
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
    this.cursor = scene.add.text(0, 0, '▶', textStyle(size, COLORS.accent === 0 ? '#000' : '#e05038'));
    this.container.add(this.cursor);
    const first = config.options.findIndex((o) => !o.disabled);
    this.focus(first >= 0 ? first : 0, false);
  }

  private position(i: number): { x: number; y: number } {
    return { x: (i % this.columns) * this.itemWidth, y: Math.floor(i / this.columns) * this.itemHeight };
  }

  focus(i: number, sound = true): void {
    if (i < 0 || i >= this.config.options.length) return;
    if (sound && i !== this.index) playSfx(this.scene, 'ui.select', 0.5);
    this.index = i;
    const { x, y } = this.position(i);
    this.cursor.setPosition(x, y);
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

/** A horizontal bar (HP or XP) that animates to new values. */
export class Bar {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private ratio = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    height: number,
    private readonly kind: 'hp' | 'xp',
  ) {
    this.bg = scene.add.rectangle(x, y, width, height, 0x303840).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(x, y, width, height - 2, kind === 'xp' ? COLORS.xp : COLORS.hpGreen).setOrigin(0, 0.5);
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
      this.scene.tweens.add({
        targets: from,
        r: target,
        duration: 400,
        onUpdate: () => this.apply(from.r),
        onComplete: () => {
          this.apply(target);
          resolve();
        },
      });
    });
  }

  private apply(ratio: number): void {
    this.ratio = ratio;
    this.fill.width = Math.max(0, this.width * ratio);
    if (this.kind === 'hp') {
      this.fill.fillColor = ratio > 0.5 ? COLORS.hpGreen : ratio > 0.2 ? COLORS.hpYellow : COLORS.hpRed;
    }
  }

  addTo(container: Phaser.GameObjects.Container): void {
    container.add([this.bg, this.fill]);
  }
}

/** A small rounded label, used for types and statuses. */
export function badge(scene: Phaser.Scene, x: number, y: number, label: string, color: number, size = 18): Phaser.GameObjects.Container {
  const text = scene.add.text(0, 0, label.toUpperCase(), textStyle(size, '#ffffff')).setOrigin(0.5);
  const w = Math.max(56, text.width + 16);
  const h = text.height + 6;
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
  const c = scene.add.container(x + w / 2, y + h / 2, [g, text]);
  c.setSize(w, h);
  return c;
}
