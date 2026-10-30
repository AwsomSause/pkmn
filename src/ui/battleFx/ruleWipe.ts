// Rule-mask screen wipes: the grayscale transition images of the Pokémon Essentials
// UIE pack (Graphics/Transitions). The darkest pixels of the mask are covered first,
// the lightest last, so each image gives its own shape (stairs, hexagons, a swirl).
// Presentation only; the caller falls back to the glass shutters when art is missing.

import type Phaser from 'phaser';

export const WIPE_MASKS = ['fade_down', 'fade_up', 'stripes', 'stairs', 'stairs2', 'tiles', 'ripple', 'spread', 'swirl', 'hex', 'computer', 'computer_close'] as const;
export type WipeMask = (typeof WIPE_MASKS)[number];
export const wipeAssetId = (m: WipeMask) => `fx.wipe.${m}`;
export const WIPE_ASSET_IDS: readonly string[] = WIPE_MASKS.map(wipeAssetId);

/** Which wipe a battle ends with: a stable hash of its key, never the gameplay RNG. -1 is the glass shutters. */
export function pickWipe(key: string): WipeMask | null {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const i = h % (WIPE_MASKS.length + 4);
  return i < WIPE_MASKS.length ? WIPE_MASKS[i]! : null;
}

/** Covers the screen with black in the shape of the mask; resolves when the screen is fully black. */
export function ruleWipe(scene: Phaser.Scene, mask: WipeMask, duration = 520, depth = 2000): Promise<void> {
  const src = scene.textures.get(wipeAssetId(mask)).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(src, 0, 0);
  const gray = pctx.getImageData(0, 0, w, h).data;
  const key = `wipe-canvas-${mask}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  const frame = ctx.createImageData(w, h);
  const band = 0.08;
  const paint = (p: number) => {
    const edge = p * (1 + band);
    for (let i = 0; i < w * h; i++) {
      const lum = gray[i * 4]! / 255;
      const a = Math.max(0, Math.min(1, (edge - lum) / band));
      frame.data[i * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(frame, 0, 0);
    tex.refresh();
  };
  paint(0);
  const img = scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(scene.scale.width, scene.scale.height).setDepth(depth);
  return new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (c) => paint(c.getValue() ?? 0),
      onComplete: () => {
        paint(1);
        scene.time.delayedCall(80, () => resolve());
        scene.events.once('shutdown', () => { img.destroy(); if (scene.textures.exists(key)) scene.textures.remove(key); });
      },
    });
  });
}
