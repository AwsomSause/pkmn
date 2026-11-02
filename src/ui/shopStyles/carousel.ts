// Aero Boutique, the "Aero Carousel" look (mock-up 08, Frutiger Aero): goods float on a glass turntable
// in a bubbly sky. Left/Right spins the ring and the front item rises big with light behind it;
// Up/Down jumps between categories; buying pops a bubble around the item and floats +1 to your Bag.
import Phaser from 'phaser';
import { paintLightGlass } from '../eventStyles/common';
import { fitBlock, fitLine } from '../fitText';
import { itemVisual } from '../sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import type { ShopRow, ShopView } from '../shopLook';
import { categories, categoryColor, countMoney, hex, partyStrip, plusOne, priceText, rowTag } from './common';
import type { ShopLayout } from './types';

const INK = '#1d3a5a';
const RING = { x: 470, y: 352, rx: 300, ry: 62 };
const HERO_Y = 196;
const PILL = { x: 822, w: 124, h: 40 };

export const carousel: ShopLayout = (ctx, hooks) => {
  const { scene, motion } = ctx;
  let view = ctx.view;
  // Sky, sun haze and a green hill.
  const sky = scene.add.graphics();
  sky.fillGradientStyle(0x4cc0ff, 0x4cc0ff, 0xd8f8ff, 0xd8f8ff, 1).fillRect(0, 0, GAME_WIDTH, 400);
  sky.fillStyle(0xbff3d8, 1).fillRect(0, 400, GAME_WIDTH, GAME_HEIGHT - 400);
  sky.fillStyle(0x7fdc9a, 1).fillEllipse(GAME_WIDTH / 2, 470, GAME_WIDTH * 1.5, 160);
  sky.fillStyle(0xffffff, 0.35).fillEllipse(GAME_WIDTH / 2, 430, GAME_WIDTH * 1.2, 50);
  if (scene.textures.exists('pack.ebdx.bubble')) {
    for (let i = 0; i < 16; i++) {
      const f = (i * 0.6180339887) % 1;
      const b = scene.add.image(20 + f * (GAME_WIDTH - 40), GAME_HEIGHT - ((i * 0.381966) % 1) * GAME_HEIGHT, 'pack.ebdx.bubble').setScale(1 + f * 2).setAlpha(0.45);
      if (motion === 'full') scene.tweens.add({ targets: b, y: b.y - 60 - f * 80, x: b.x + (i % 2 ? 16 : -16), duration: 4000 + f * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  // Light rays behind the hero item.
  const rays = scene.add.graphics().setPosition(RING.x, HERO_Y + 10);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    rays.fillStyle(0xffffff, 0.22).fillTriangle(0, 0, Math.cos(a - 0.12) * 190, Math.sin(a - 0.12) * 190, Math.cos(a + 0.12) * 190, Math.sin(a + 0.12) * 190);
  }
  if (motion === 'full') scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
  // The glass turntable.
  const table = scene.add.graphics();
  table.fillStyle(0x0a4a80, 0.18).fillEllipse(RING.x, RING.y + 22, RING.rx * 2 + 60, RING.ry * 2 + 30);
  table.fillGradientStyle(0xffffff, 0xffffff, 0x9fd8ff, 0x9fd8ff, 0.85, 0.85, 0.5, 0.5).fillEllipse(RING.x, RING.y, RING.rx * 2 + 40, RING.ry * 2 + 24);
  table.lineStyle(3, 0xffffff, 0.95).strokeEllipse(RING.x, RING.y, RING.rx * 2 + 40, RING.ry * 2 + 24);
  const shadow = scene.add.ellipse(RING.x, RING.y - 10, 110, 22, 0x0a3a60, 0.25);

  // Money pill and the item's title pill.
  const top = scene.add.graphics();
  paintLightGlass(top, GAME_WIDTH - 176, 12, 162, 40, { radius: 20 });
  const money = scene.add.text(GAME_WIDTH - 95, 32, `₽${view.money}`, textStyle(24, INK)).setOrigin(0.5).setName('shop-money');
  const shopName = fitLine(scene.add.text(18, 30, ctx.title, textStyle(24, '#ffffff')).setOrigin(0, 0.5), 260, 16);
  fitLine(scene.add.text(18, 56, ctx.clock, textStyle(16, '#eaf8ff')).setOrigin(0, 0.5), 300, 10);
  shopName.setName('shop-title');
  const titleBg = scene.add.graphics();
  const titleName = scene.add.text(RING.x, 34, '', textStyle(24, INK)).setOrigin(0.5).setName('shop-item-name');
  const titleSub = scene.add.text(RING.x, 64, '', textStyle(16, '#2a6bc0')).setOrigin(0.5).setName('shop-item-price');

  // Category pills (right) and the Sell pill under them.
  const cats = categories(view.rows);
  const catY = (k: number) => 92 + k * 48;
  const pills = cats.map((word, k) => {
    const g = scene.add.graphics();
    const t = fitLine(scene.add.text(PILL.x + PILL.w / 2, catY(k) + PILL.h / 2, word, textStyle(16, INK)).setOrigin(0.5), PILL.w - 14, 10);
    scene.add.zone(PILL.x, catY(k), PILL.w, PILL.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => hooks.focus(view.rows.findIndex((r) => r.pocket.word === word)));
    return { word, g, t, y: catY(k) };
  });
  const sellY = catY(cats.length) + 10;
  const sellG = scene.add.graphics();
  if (view.canSell) {
    scene.add.text(PILL.x + PILL.w / 2, sellY + PILL.h / 2, 'Sell items…', textStyle(16, '#8a5a00')).setOrigin(0.5).setName('shop-sell');
    scene.add.zone(PILL.x, sellY, PILL.w, PILL.h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => hooks.pick(view.rows.length)).on('pointerover', () => hooks.focus(view.rows.length));
  }
  const paintPills = (row: ShopRow | undefined, onSell: boolean) => {
    for (const p of pills) {
      const on = row?.pocket.word === p.word;
      p.g.clear();
      if (on) p.g.fillStyle(0xffd84a, 0.35).fillRoundedRect(PILL.x - 4, p.y - 4, PILL.w + 8, PILL.h + 8, 24);
      p.g.fillGradientStyle(0xffffff, 0xffffff, on ? 0xffe69a : 0xd8f0ff, on ? 0xffe69a : 0xd8f0ff, on ? 1 : 0.7).fillRoundedRect(PILL.x, p.y, PILL.w, PILL.h, 20);
      p.g.lineStyle(2, on ? 0xffb43a : 0xffffff, 1).strokeRoundedRect(PILL.x, p.y, PILL.w, PILL.h, 20);
    }
    sellG.clear();
    if (!view.canSell) return;
    if (onSell) sellG.fillStyle(0xffd84a, 0.35).fillRoundedRect(PILL.x - 4, sellY - 4, PILL.w + 8, PILL.h + 8, 24);
    sellG.fillGradientStyle(0xfff6d8, 0xfff6d8, 0xffd88a, 0xffd88a, 1).fillRoundedRect(PILL.x, sellY, PILL.w, PILL.h, 20).lineStyle(2, onSell ? 0xffb43a : 0xffffff, 1).strokeRoundedRect(PILL.x, sellY, PILL.w, PILL.h, 20);
  };

  // Party bubbles (left).
  scene.add.text(26, 98, 'Party', textStyle(16, INK)).setOrigin(0, 0.5);
  const bubbles = scene.add.graphics();
  ctx.party.forEach((_, k) => paintLightGlass(bubbles, 22, 116 + k * 50 - 4, 48, 48, { radius: 24, alpha: 0.7 }));
  const party = partyStrip(ctx, 46, 136, { gap: 50, vertical: true });

  // Hint (bottom glass).
  const hintBg = scene.add.graphics();
  paintLightGlass(hintBg, 110, GAME_HEIGHT - 66, 690, 52, { radius: 24 });
  const hint = scene.add.text(130, GAME_HEIGHT - 40, ctx.notice ?? '', textStyle(16, INK, { wordWrap: { width: 650 }, lineSpacing: 2 })).setOrigin(0, 0.5).setName('shop-hint');

  // Arrows.
  const arrowL = scene.add.text(130, RING.y - 30, '◀', textStyle(32, '#ffffff')).setOrigin(0.5).setInteractive({ useHandCursor: true });
  const arrowR = scene.add.text(810, RING.y - 30, '▶', textStyle(32, '#ffffff')).setOrigin(0.5).setInteractive({ useHandCursor: true });

  // The ring of goods.
  let items: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics; tag: Phaser.GameObjects.Text | null; base: number }[] = [];
  const ringLayer = scene.add.container(0, 0);
  const build = () => {
    ringLayer.removeAll(true);
    items = view.rows.map((row, i) => {
      const obj = itemVisual(scene, row.iconAssetId, RING.x, RING.y, 2) as Phaser.GameObjects.Image;
      obj.setName('shop-item');
      if ('setInteractive' in obj) obj.setInteractive({ useHandCursor: true }).on('pointerdown', () => (i === current ? hooks.pick(i) : hooks.focus(i)));
      const t = rowTag(row);
      const tag = t ? scene.add.text(0, 0, t.text, textStyle(16, '#ffffff', { backgroundColor: hex(t.color), padding: { x: 4, y: 1 } })).setOrigin(0.5) : null;
      ringLayer.add(obj);
      if (tag) ringLayer.add(tag);
      return { obj, tag, base: 24 / Math.max(24, (obj as Phaser.GameObjects.Image).width || 24) };
    });
  };
  const step = () => Math.min((Math.PI * 2) / Math.max(1, view.rows.length), 0.4);
  const phase = { v: 0 };
  const place = () => {
    const n = view.rows.length;
    const s = step();
    items.forEach(({ obj, tag, base }, i) => {
      // Shortest signed distance around the ring.
      let d = i - phase.v;
      if (n > 0) d = ((((d + n / 2) % n) + n) % n) - n / 2;
      const th = d * s;
      const depth = Math.cos(th);
      const front = Math.max(0, 1 - Math.abs(d));
      const visible = Math.abs(th) < 1.62;
      const x = RING.x + Math.sin(th) * RING.rx;
      const y = RING.y - 26 + depth * RING.ry * 0.55 - front * (RING.y - 26 + RING.ry * 0.55 - HERO_Y);
      obj.setPosition(x, y);
      (obj as Phaser.GameObjects.Image).setScale(base * (1.4 + 0.8 * ((depth + 1) / 2) + front * 3.4));
      (obj as Phaser.GameObjects.Image).setAlpha(visible ? 0.35 + 0.65 * ((depth + 1) / 2) : 0);
      (obj as Phaser.GameObjects.Image).setDepth(depth);
      tag?.setPosition(x, y + 26 + front * 40).setAlpha(visible ? 1 : 0).setDepth(depth);
    });
    ringLayer.sort('depth');
  };

  let current = -1;
  const focus = (i: number) => {
    current = i;
    const onSell = i >= view.rows.length;
    const r = view.rows[i];
    paintPills(r, onSell);
    party.show(r ?? null);
    titleBg.clear();
    if (r) {
      titleName.setText(r.label);
      fitLine(titleName, 360, 12);
      titleSub.setText(`${priceText(r)}  ·  ${r.pocket.word}${r.owned > 0 ? `  ·  You have ${r.owned}` : ''}`).setColor(r.affordable ? '#2a6bc0' : '#d03040');
      const w = Math.max(titleName.displayWidth, titleSub.width) + 48;
      paintLightGlass(titleBg, RING.x - w / 2, 12, w, 66, { radius: 22 });
      titleBg.fillStyle(categoryColor(r), 1).fillRoundedRect(RING.x - w / 2 + 14, 70, w - 28, 4, 2);
      // Spin the ring to it the short way round.
      const n = view.rows.length;
      let target = i;
      if (n > 0) {
        const d = ((((i - phase.v + n / 2) % n) + n) % n) - n / 2;
        target = phase.v + d;
      }
      scene.tweens.killTweensOf(phase);
      if (motion === 'off') {
        phase.v = target;
        place();
      } else scene.tweens.add({ targets: phase, v: target, duration: motion === 'full' ? 340 : 120, ease: 'Back.easeOut', onUpdate: place, onComplete: () => { phase.v = ((i % n) + n) % n; place(); } });
      fitBlock(hint, 650, 46, r.hint);
    } else {
      titleName.setText('Sell items');
      titleSub.setText('The shop buys from your Bag').setColor('#2a6bc0');
      paintLightGlass(titleBg, RING.x - 150, 12, 300, 66, { radius: 22 });
      fitBlock(hint, 650, 46, 'Sell items from your Bag. The shop pays half the price (all of it with a Seal Bag).');
    }
  };
  arrowL.on('pointerdown', () => hooks.focus(current <= 0 ? view.rows.length - 1 : current - 1));
  arrowR.on('pointerdown', () => hooks.focus(current >= view.rows.length - 1 ? 0 : current + 1));
  shadow.setDepth(-1);

  build();
  place();
  if (motion !== 'off') {
    ringLayer.setAlpha(0);
    scene.tweens.add({ targets: ringLayer, alpha: 1, duration: motion === 'full' ? 300 : 100 });
  }

  /** Up/Down: the first item of the previous/next category (past the last one, the Sell pill). */
  const move = (action: string, from: number): number => {
    const n = view.rows.length;
    if (n === 0) return from;
    if (from >= n) return action === 'up' ? view.rows.findIndex((r) => r.pocket.word === cats[cats.length - 1]) : action === 'left' || action === 'right' ? 0 : from;
    if (action === 'left') return (from - 1 + n) % n;
    if (action === 'right') return (from + 1) % n;
    const k = cats.indexOf(view.rows[from]!.pocket.word);
    if (action === 'down') return k + 1 < cats.length ? view.rows.findIndex((r) => r.pocket.word === cats[k + 1]) : view.canSell ? n : from;
    if (action === 'up') return k > 0 ? view.rows.findIndex((r) => r.pocket.word === cats[k - 1]) : from;
    return from;
  };

  return {
    move,
    focus,
    refresh(next: ShopView, bought, message) {
      const before = view.money;
      const sameRows = next.rows.length === view.rows.length;
      view = next;
      countMoney(ctx, money, before, view.money);
      if (!sameRows) {
        build();
        phase.v = Math.min(phase.v, Math.max(0, view.rows.length - 1));
      }
      place();
      focus(Math.min(current, view.rows.length - (view.canSell ? 0 : 1)));
      if (bought === null) return;
      // A bubble forms around the item and pops, then +1 floats up.
      const ring = scene.add.circle(RING.x, HERO_Y, 40, 0xffffff, 0.25).setStrokeStyle(3, 0xffffff, 0.95);
      const pop = () => {
        ring.destroy();
        plusOne(ctx, RING.x, HERO_Y - 70, undefined, '#1d6a2a');
      };
      if (motion === 'off') pop();
      else scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: motion === 'full' ? 380 : 120, ease: 'Cubic.easeOut', onComplete: pop });
      if (message) fitBlock(hint, 650, 46, message);
    },
  };
};
