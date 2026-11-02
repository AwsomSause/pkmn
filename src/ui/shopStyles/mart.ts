// Poké Mart, the "Shop Channel" look (mock-up 03, Wii era): soft white pinstripes, a channel header,
// category capsules on the left and big rounded tiles. The focused tile puffs up and its item wobbles;
// buying fills a little "downloading" bar into your Bag. Mouse: hover focuses, click buys.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { itemVisual } from '../sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import type { ShopRow, ShopView } from '../shopLook';
import { categories, categoryColor, countMoney, gridMove, hex, iconFit, partyStrip, plusOne, popIn, priceText, rowTag } from './common';
import type { ShopLayout } from './types';

const BLUE = 0x34a6e6;
const GREY = '#3a4a5c';
const COLS = 4;
const TILE = { w: 178, h: 122, gap: 10 };
const GRID = { x: 194, y: 78, rows: 3 };
const INFO_Y = 470;

export const mart: ShopLayout = (ctx, hooks) => {
  const { scene, motion } = ctx;
  let view = ctx.view;
  // Backdrop: pinstripes.
  scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf4f8fb).setOrigin(0);
  const stripes = scene.add.graphics();
  for (let y = 0; y < GAME_HEIGHT; y += 6) stripes.fillStyle(0xaabed2, 0.16).fillRect(0, y, GAME_WIDTH, 1);
  // Header.
  const head = scene.add.graphics();
  head.fillGradientStyle(0xffffff, 0xffffff, 0xe7f3fb, 0xe7f3fb, 1).fillRect(0, 0, GAME_WIDTH, 64);
  head.fillStyle(0x7fc6f0, 1).fillRect(0, 64, GAME_WIDTH, 3);
  const title = scene.add.text(22, 32, ctx.title, textStyle(32, hex(BLUE))).setOrigin(0, 0.5).setName('shop-title');
  scene.add.text(title.x + title.width + 12, 38, 'Channel', textStyle(16, '#9aa6b4')).setOrigin(0, 0.5);
  const moneyBg = scene.add.graphics();
  moneyBg.fillStyle(0xffffff, 1).fillRoundedRect(GAME_WIDTH - 196, 14, 180, 38, 19).lineStyle(3, 0x7fc6f0, 1).strokeRoundedRect(GAME_WIDTH - 196, 14, 180, 38, 19);
  const money = scene.add.text(GAME_WIDTH - 106, 33, `₽${view.money}`, textStyle(24, GREY)).setOrigin(0.5).setName('shop-money');
  fitLine(scene.add.text(GAME_WIDTH - 214, 33, ctx.clock, textStyle(16, '#7a8a9c')).setOrigin(1, 0.5), 300, 12);

  // Category capsules: the focused item's category lights up; a click jumps to that category.
  const cats = categories(view.rows);
  const pills = cats.map((word, k) => {
    const y = 80 + k * 46;
    const g = scene.add.graphics();
    const t = fitLine(scene.add.text(98, y + 19, word, textStyle(16, GREY)).setOrigin(0.5), 130, 12);
    const zone = scene.add.zone(20, y, 156, 38).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => hooks.focus(view.rows.findIndex((r) => r.pocket.word === word)));
    return { word, g, t, y };
  });
  const paintPills = (row: ShopRow | undefined) => {
    for (const p of pills) {
      const on = row?.pocket.word === p.word;
      p.g.clear().fillStyle(on ? 0xe2f4ff : 0xffffff, 1).fillRoundedRect(20, p.y, 156, 38, 19).lineStyle(3, on ? BLUE : 0xc9dbe8, 1).strokeRoundedRect(20, p.y, 156, 38, 19);
      p.t.setColor(on ? hex(BLUE) : GREY);
    }
  };

  // The tile grid (scrolls by row inside a mask).
  const grid = scene.add.container(0, 0);
  grid.setMask(scene.make.graphics({}, false).fillRect(GRID.x - 8, GRID.y - 6, COLS * (TILE.w + TILE.gap) + 8, GRID.rows * (TILE.h + TILE.gap) + 4).createGeometryMask());
  let tiles: { box: Phaser.GameObjects.Container; rim: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.GameObject | null }[] = [];
  let top = 0;
  const cellPos = (i: number) => ({ x: GRID.x + (i % COLS) * (TILE.w + TILE.gap), y: GRID.y + Math.floor(i / COLS) * (TILE.h + TILE.gap) });
  const paintRim = (g: Phaser.GameObjects.Graphics, on: boolean, locked: boolean) => {
    g.clear();
    if (on) g.fillStyle(BLUE, 0.22).fillRoundedRect(-5, -5, TILE.w + 10, TILE.h + 10, 24);
    g.fillStyle(locked ? 0xeef1f4 : 0xffffff, 1).fillRoundedRect(0, 0, TILE.w, TILE.h, 20);
    g.lineStyle(3, on ? BLUE : 0xd3e2ee, 1).strokeRoundedRect(0, 0, TILE.w, TILE.h, 20);
  };
  const build = (entrance: boolean) => {
    grid.removeAll(true);
    tiles = [];
    view.rows.forEach((row, i) => {
      const { x, y } = cellPos(i);
      const box = scene.add.container(x + TILE.w / 2, y + TILE.h / 2).setName('shop-tile');
      const inner = scene.add.container(-TILE.w / 2, -TILE.h / 2);
      const rim = scene.add.graphics();
      paintRim(rim, false, false);
      const icon = itemVisual(scene, row.iconAssetId, TILE.w / 2, 40, 2);
      if ("setScale" in icon) (icon as Phaser.GameObjects.Image).setScale(iconFit(icon, 60));
      const name = fitLine(scene.add.text(TILE.w / 2, 80, row.label, textStyle(16, GREY)).setOrigin(0.5), TILE.w - 16, 10);
      const price = scene.add.text(TILE.w / 2, 102, priceText(row), textStyle(16, row.affordable ? (row.sale ? '#d03040' : hex(BLUE)) : '#e05050')).setOrigin(0.5).setName('shop-price');
      inner.add([rim, icon, name, price]);
      // Its bag pocket (Visual Bible: category icons), with how many you own under it.
      if (scene.textures.exists('pack.ess.pockets')) inner.add(scene.add.image(18, 18, 'pack.ess.pockets', row.pocket.frame).setScale(0.9).setName('shop-pocket'));
      if (row.owned > 0) inner.add(scene.add.text(18, 38, `×${row.owned}`, textStyle(16, '#9aa6b4')).setOrigin(0.5, 0).setScale(0.8));
      const tag = rowTag(row);
      if (tag) inner.add(scene.add.text(TILE.w - 8, 8, tag.text, textStyle(16, '#ffffff', { backgroundColor: hex(tag.color), padding: { x: 4, y: 1 } })).setOrigin(1, 0));
      inner.add(scene.add.rectangle(4, TILE.h - 8, 6, 6, categoryColor(row)).setOrigin(0));
      box.add(inner);
      box.setSize(TILE.w, TILE.h).setInteractive({ useHandCursor: true });
      box.on('pointerover', () => hooks.focus(i));
      box.on('pointerdown', () => hooks.pick(i));
      grid.add(box);
      tiles.push({ box, rim, icon });
      if (entrance) popIn(ctx, box, Math.min(i, 12) * 30);
    });
    if (view.canSell) {
      const i = view.rows.length;
      const { x, y } = cellPos(i);
      const box = scene.add.container(x + TILE.w / 2, y + TILE.h / 2).setName('shop-sell');
      const inner = scene.add.container(-TILE.w / 2, -TILE.h / 2);
      const rim = scene.add.graphics();
      paintRim(rim, false, false);
      inner.add([rim, scene.add.text(TILE.w / 2, 46, '₽', textStyle(32, '#f0a030')).setOrigin(0.5), scene.add.text(TILE.w / 2, 88, 'Sell items…', textStyle(16, GREY)).setOrigin(0.5)]);
      box.add(inner);
      box.setSize(TILE.w, TILE.h).setInteractive({ useHandCursor: true });
      box.on('pointerover', () => hooks.focus(i));
      box.on('pointerdown', () => hooks.pick(i));
      grid.add(box);
      tiles.push({ box, rim, icon: null });
    }
  };

  // Info bar: party on the left, what the focused item does on the right.
  const info = scene.add.graphics();
  info.fillStyle(0xffffff, 1).fillRoundedRect(16, INFO_Y, GAME_WIDTH - 32, 58, 29).lineStyle(3, 0xc9dbe8, 1).strokeRoundedRect(16, INFO_Y, GAME_WIDTH - 32, 58, 29);
  const party = partyStrip(ctx, 48, INFO_Y + 31, { gap: 34 });
  const hint = scene.add.text(262, INFO_Y + 29, '', textStyle(16, GREY, { wordWrap: { width: GAME_WIDTH - 300 }, lineSpacing: 2 })).setOrigin(0, 0.5).setName('shop-hint');
  if (ctx.notice) hint.setText(ctx.notice);

  let current = -1;
  let wobble: Phaser.Tweens.Tween | null = null;
  const focus = (i: number) => {
    if (tiles[current]) {
      paintRim(tiles[current]!.rim, false, false);
      scene.tweens.killTweensOf(tiles[current]!.box);
      tiles[current]!.box.setScale(1);
    }
    wobble?.stop();
    const prevIcon = tiles[current]?.icon as Phaser.GameObjects.Image | undefined;
    prevIcon?.setAngle?.(0);
    current = i;
    const t = tiles[i];
    if (!t) return;
    paintRim(t.rim, true, false);
    if (motion !== 'off') scene.tweens.add({ targets: t.box, scale: 1.06, duration: motion === 'full' ? 180 : 80, ease: 'Back.easeOut' });
    const icon = t.icon as Phaser.GameObjects.Image | null;
    if (icon && motion === 'full' && 'setAngle' in icon) wobble = scene.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Scroll so the focused row is visible.
    const row = Math.floor(i / COLS);
    if (row < top) top = row;
    if (row >= top + GRID.rows) top = row - GRID.rows + 1;
    const y = -top * (TILE.h + TILE.gap);
    if (motion === 'off') grid.y = y;
    else scene.tweens.add({ targets: grid, y, duration: 180, ease: 'Cubic.easeOut' });
    const r = view.rows[i];
    paintPills(r);
    party.show(r ?? null);
    fitBlock(hint, GAME_WIDTH - 300, 50, r ? r.hint : 'Sell items from your Bag. The shop pays half the price (all of it with a Seal Bag).');
  };

  build(true);
  return {
    move: (action, from) => gridMove(action, from, view.rows.length + (view.canSell ? 1 : 0), COLS),
    focus,
    refresh(next: ShopView, bought, message) {
      const before = view.money;
      view = next;
      const keep = current;
      current = -1;
      build(false);
      countMoney(ctx, money, before, view.money);
      focus(Math.min(keep, tiles.length - 1));
      if (bought === null || !tiles[bought]) return;
      const t = tiles[bought]!;
      // The "downloading into your Bag" bar under the tile, then +1.
      const bar = scene.add.graphics();
      t.box.add(bar);
      const prog = { p: 0 };
      const draw = () => bar.clear().fillStyle(0xdfeaf3, 1).fillRoundedRect(-60, TILE.h / 2 - 20, 120, 8, 4).fillStyle(BLUE, 1).fillRoundedRect(-60, TILE.h / 2 - 20, 120 * prog.p, 8, 4);
      draw();
      // A BOUGHT stamp stays on the tile until the next buy.
      const stamp = scene.add.text(0, 6, 'BOUGHT', textStyle(16, '#ffffff', { backgroundColor: '#d04060', padding: { x: 6, y: 2 } })).setOrigin(0.5).setAngle(-8).setName('shop-bought');
      t.box.add(stamp);
      if (motion !== 'off') {
        stamp.setScale(2.2).setAlpha(0);
        scene.tweens.add({ targets: stamp, scale: 1, alpha: 0.95, duration: motion === 'full' ? 240 : 100, ease: 'Back.easeOut' });
      }
      const done = () => {
        bar.destroy();
        plusOne(ctx, t.box.x, t.box.y - 30, grid);
      };
      if (motion === 'off') done();
      else scene.tweens.add({ targets: prog, p: 1, duration: motion === 'full' ? 320 : 100, onUpdate: draw, onComplete: done });
      if (message) fitBlock(hint, GAME_WIDTH - 300, 50, message);
    },
  };
};
