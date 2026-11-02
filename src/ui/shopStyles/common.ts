// Pieces every shop style shares: the party strip that lights up for items a Pokémon can use,
// the money pill that counts down, and the "+1 into your Bag" pop after a buy.
import Phaser from 'phaser';
import { getSpecies } from '../../core/pokemon';
import type { ShopRow } from '../shopLook';
import { pokemonIcon } from '../sprites';
import { textStyle } from '../theme';
import type { ShopCtx } from './types';

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Category colours (pocket words) for tags and pills. */
export const CATEGORY_COLOR: Record<string, number> = {
  'Poké Ball': 0xff5a6a,
  Medicine: 0x3fb8f0,
  Charm: 0xb07cf0,
  Training: 0x4ec860,
  Evolution: 0xf0a030,
  'Form item': 0xe070c0,
  'Key item': 0x8a9ab0,
};
export const categoryColor = (row: ShopRow): number => CATEGORY_COLOR[row.pocket.word] ?? 0x8a9ab0;

/** The categories in stock, in first-seen order. */
export function categories(rows: readonly ShopRow[]): string[] {
  return [...new Set(rows.map((r) => r.pocket.word))];
}

/** The tag a row wears on every style: SALE, EARLY or BLACK MARKET (or none). */
export function rowTag(row: ShopRow): { text: string; color: number } | null {
  if (row.black) return { text: 'BLACK MARKET', color: 0x9a40c0 };
  if (row.early) return { text: 'EARLY', color: 0xe09a20 };
  if (row.sale) return { text: 'SALE', color: 0xe03a4a };
  return null;
}

export const priceText = (row: ShopRow): string => (row.price === 0 ? 'FREE' : `₽${row.price}`);

export interface PartyStrip {
  /** Lights the Pokémon who can use this row (and dims the rest); null clears it. */
  show(row: ShopRow | null): void;
}

/**
 * The party as icons. On an evolution or form item, the ones who can use it hop and glow and a
 * "CAN USE" tag pops over them; the rest fade. Any other item leaves everyone as they are.
 */
export function partyStrip(ctx: ShopCtx, x: number, y: number, opts: { gap?: number; vertical?: boolean; into?: Phaser.GameObjects.Container; light?: boolean } = {}): PartyStrip {
  const { scene, content, party, motion } = ctx;
  const gap = opts.gap ?? 40;
  const icons = party.map((mon, i) => {
    const px = opts.vertical ? x : x + i * gap;
    const py = opts.vertical ? y + i * gap : y;
    const glow = scene.add.circle(px, py, 18, 0xffd84a, 0).setStrokeStyle(2, 0xffffff, 0);
    const icon = pokemonIcon(scene, getSpecies(content, mon.speciesId), px, py) as Phaser.GameObjects.Sprite;
    opts.into?.add([glow, icon]);
    return { mon, glow, icon, px, py };
  });
  let tags: Phaser.GameObjects.GameObject[] = [];
  return {
    show(row) {
      for (const t of tags) t.destroy();
      tags = [];
      for (const s of icons) {
        scene.tweens.killTweensOf([s.icon, s.glow]);
        const can = row?.users?.includes(s.mon.uid) ?? false;
        const dim = row?.users != null && !can;
        s.icon.setAlpha(dim ? 0.45 : 1);
        s.icon.setY(s.py);
        s.glow.setFillStyle(0xffd84a, can ? 0.55 : 0).setStrokeStyle(2, 0xffffff, can ? 0.9 : 0);
        if (!can) continue;
        if (motion === 'full') scene.tweens.add({ targets: s.icon, y: s.py - 6, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        else s.icon.setY(s.py - 4);
        const tag = scene.add.text(s.px, s.py - 26, 'CAN USE', textStyle(16, '#4a2a00', { backgroundColor: '#ffd84a', padding: { x: 3, y: 1 } })).setOrigin(0.5, 1).setName('shop-can-use');
        opts.into?.add(tag);
        tags.push(tag);
      }
    },
  };
}

/** A white "+1" that floats up from (x, y) and fades: the item went into the Bag. */
export function plusOne(ctx: ShopCtx, x: number, y: number, into?: Phaser.GameObjects.Container, color = '#2a8a3a'): void {
  const { scene, motion } = ctx;
  const t = scene.add.text(x, y, '+1', textStyle(24, color)).setOrigin(0.5).setName('shop-plus-one');
  into?.add(t);
  if (motion === 'off') {
    scene.time.delayedCall(600, () => t.destroy());
    return;
  }
  scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: motion === 'full' ? 700 : 300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

/** Rolls a money label from its old value to the new one. */
export function countMoney(ctx: ShopCtx, label: Phaser.GameObjects.Text, from: number, to: number, format = (n: number) => `₽${n}`): void {
  if (ctx.motion === 'off' || from === to) {
    label.setText(format(to));
    return;
  }
  const box = { v: from };
  ctx.scene.tweens.add({ targets: box, v: to, duration: ctx.motion === 'full' ? 380 : 150, ease: 'Cubic.easeOut', onUpdate: () => label.setText(format(Math.round(box.v))) });
}

/** A gentle pop-in for a freshly drawn object. */
export function popIn(ctx: ShopCtx, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, delay = 0): void {
  if (ctx.motion === 'off') return;
  const s = (target as unknown as { scaleX: number }).scaleX;
  target.setScale(s * 0.6);
  ctx.scene.tweens.add({ targets: target, scale: s, duration: ctx.motion === 'full' ? 320 : 120, delay: ctx.motion === 'full' ? delay : 0, ease: 'Back.easeOut' });
}

/** Default grid navigation over rows + the Sell entry (index rows.length) as the last cell. */
export function gridMove(action: string, from: number, count: number, columns: number): number {
  const last = count - 1;
  if (action === 'left') return Math.max(0, from - 1);
  if (action === 'right') return Math.min(last, from + 1);
  if (action === 'up') return from - columns >= 0 ? from - columns : from;
  if (action === 'down') return from + columns <= last ? from + columns : Math.floor(from / columns) < Math.floor(last / columns) ? last : from;
  return from;
}

/** The scale that makes an item icon about `px` pixels on its longest side (icons come in several sizes). */
export function iconFit(obj: Phaser.GameObjects.GameObject, px: number): number {
  const img = obj as Phaser.GameObjects.Image;
  const size = Math.max(img.width || 0, img.height || 0);
  return size > 0 ? Math.max(1, Math.round((px / size) * 2) / 2) : 2;
}
