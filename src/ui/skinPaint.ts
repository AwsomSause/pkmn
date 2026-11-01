// Draws panels and cursors for the active interface skin (core/presentation/skins.ts). Presentation only.

import type Phaser from 'phaser';
import { chamferPoints, cornerRadius, scanlineYs, SKINS, type SkinSpec, type UiThemeId } from '../core/presentation/skins';
import { mixColor } from './theme';

let active: UiThemeId = 'classic';
export const setActiveSkin = (id: UiThemeId): void => {
  active = id;
};
export const activeSkin = (): SkinSpec => SKINS[active];
export const activeSkinId = (): UiThemeId => active;
/** True for the three skins that draw their own panel shapes (DS, Wii, Cyber). */
export const hasOwnShapes = (): boolean => ['flat', 'pill', 'chamfer'].includes(SKINS[active].shape);

export interface SkinPanelOpts {
  fill: number;
  border: number;
  alpha?: number;
  thin?: boolean;
}

/** One panel in the active skin's own shape: DS flat card, Wii pill tile or Cyber chamfered neon plate. */
export function paintSkinPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: SkinPanelOpts): Phaser.GameObjects.Graphics {
  const skin = activeSkin();
  const a = o.alpha ?? 1;
  const bw = o.thin ? Math.max(1, skin.borderPx - 1) : skin.borderPx;
  const r = cornerRadius(skin, w, h);
  if (skin.shape === 'flat') {
    // DS touch card: a hard offset shadow, a flat fill with a light top bevel and a solid blue border.
    if (skin.shadow) {
      g.fillStyle(0x000000, 0.3 * a);
      g.fillRoundedRect(x + skin.shadow, y + skin.shadow, w, h, r);
    }
    g.fillStyle(o.fill, a);
    g.fillRoundedRect(x, y, w, h, r);
    g.fillStyle(0xffffff, 0.35 * a);
    g.fillRect(x + r, y + bw, w - 2 * r, 2);
    g.fillStyle(mixColor(o.fill, 0x000000, 0.12), a);
    g.fillRect(x + r, y + h - bw - 2, w - 2 * r, 2);
    g.lineStyle(bw, o.border, a);
    g.strokeRoundedRect(x, y, w, h, r);
  } else if (skin.shape === 'pill') {
    // Wii channel tile: soft layered shadow, a glossy pill and a pale outline.
    for (let i = skin.glow; i >= 1; i--) {
      g.fillStyle(o.border, 0.07 * a);
      g.fillRoundedRect(x - i * 3, y - i * 3 + 3, w + i * 6, h + i * 6, r + i * 3);
    }
    g.fillStyle(o.fill, a);
    g.fillRoundedRect(x, y, w, h, r);
    g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.7 * a, 0.7 * a, 0.0, 0.0);
    g.fillRoundedRect(x + 4, y + 3, w - 8, Math.max(6, h * 0.45), { tl: Math.max(0, r - 4), tr: Math.max(0, r - 4), bl: 6, br: 6 });
    g.lineStyle(bw, o.border, a);
    g.strokeRoundedRect(x, y, w, h, r);
  } else {
    // Cyber plate: chamfered corners, a neon glow, a bright inner line and scanlines.
    const pts = chamferPoints(x, y, w, h, skin.radius);
    for (let i = skin.glow; i >= 1; i--) {
      g.lineStyle(bw + i * 3, o.border, 0.12 * a);
      g.strokePoints(chamferPoints(x, y, w, h, skin.radius), true, true);
    }
    g.fillStyle(o.fill, a);
    g.fillPoints(pts, true, true);
    if (skin.scanlines) {
      g.lineStyle(1, 0xffffff, 0.05 * a);
      for (const yy of scanlineYs(y, h)) {
        g.beginPath();
        g.moveTo(x + skin.radius / 2, yy);
        g.lineTo(x + w - skin.radius / 2, yy);
        g.strokePath();
      }
    }
    g.lineStyle(bw, o.border, a);
    g.strokePoints(pts, true, true);
    // Corner ticks in the second neon colour.
    g.lineStyle(2, 0x2ef2ff, 0.9 * a);
    g.beginPath();
    g.moveTo(x + 6, y + h - 4);
    g.lineTo(x + 6 + 14, y + h - 4);
    g.moveTo(x + w - 6 - 14, y + 4);
    g.lineTo(x + w - 6, y + 4);
    g.strokePath();
  }
  return g;
}

/** The selection cursor frame for the active skin, centred on (0, 0). Returns false when the default glow frame should be used. */
export function paintSkinCursor(g: Phaser.GameObjects.Graphics, w: number, h: number, glow: number): boolean {
  const skin = activeSkin();
  if (skin.cursor === 'square') {
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, 0xf2a33a, 1);
    g.strokeRect(-w / 2, -h / 2, w, h);
    return true;
  }
  if (skin.cursor === 'neon') {
    const pts = chamferPoints(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(9, 0xff2fb9, glow * 0.7);
    g.strokePoints(pts, true, true);
    g.lineStyle(2, 0x2ef2ff, 1);
    g.strokePoints(pts, true, true);
    return true;
  }
  return false;
}

/** Extra backdrop pieces for a skin, added to the Aero backdrop container. */
export function skinBackdrop(scene: Phaser.Scene, root: Phaser.GameObjects.Container, W: number, H: number, motion: string): void {
  const skin = activeSkin();
  if (skin.backdrop === 'sky') return;
  const g = scene.add.graphics();
  if (skin.backdrop === 'bands') {
    // DS: two flat screens' worth of horizontal bands.
    g.fillStyle(0x2b2f3a, 1).fillRect(0, 0, W, H);
    g.fillStyle(0xcfd6e4, 0.12);
    for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 24);
    g.fillStyle(0x4a78c8, 0.25).fillRect(0, H / 2 - 3, W, 6);
  } else if (skin.backdrop === 'soft') {
    // Wii: a pale wash with soft round blobs.
    g.fillStyle(0xcfe6f5, 1).fillRect(0, 0, W, H);
    g.fillStyle(0xffffff, 0.55);
    [[0.15, 0.2, 180], [0.8, 0.3, 220], [0.5, 0.85, 260], [0.92, 0.9, 140]].forEach(([fx, fy, r]) => g.fillCircle(W * fx!, H * fy!, r!));
  } else {
    // Cyber: a dark violet field with a perspective grid.
    g.fillGradientStyle(0x0a0618, 0x0a0618, 0x2a0a4a, 0x2a0a4a, 1, 1, 1, 1).fillRect(0, 0, W, H);
    g.lineStyle(1, 0xff2fb9, 0.28);
    const horizon = H * 0.55;
    for (let i = -8; i <= 8; i++) {
      g.beginPath();
      g.moveTo(W / 2 + i * 14, horizon);
      g.lineTo(W / 2 + i * 120, H);
      g.strokePath();
    }
    for (let k = 1; k <= 8; k++) {
      const yy = horizon + (H - horizon) * (k / 8) ** 2;
      g.beginPath();
      g.moveTo(0, yy);
      g.lineTo(W, yy);
      g.strokePath();
    }
  }
  root.addAt(g, 0);
  if (motion === 'full' && skin.backdrop === 'grid') scene.tweens.add({ targets: g, alpha: { from: 0.85, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
