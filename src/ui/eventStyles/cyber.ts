// Cyber HUD (mock-up 11): cyber-maximalist. Neon panels with clipped corners, a chromatic title,
// a rarity meter, a target reticle over the cast, scanlines, and options as glowing slabs with
// odds gauges. Picking glitches the slab.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { CHOICE_KIND_LABEL } from '../../core/presentation/eventStyles';
import { choiceColor, detailLines, drawArena, hex, hitZone, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventLayout } from './types';

const CYAN = 0x00ffff;
const MAGENTA = 0xff00ff;
const INFO = { x: 18, y: 18, w: 340, h: 300 };
const SLAB_X = 590;
const SLAB_W = GAME_WIDTH - 18 - SLAB_X;
const RARITY_LEVEL: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export const cyber: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  const area = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
  drawArena(ctx, area, layers.back);
  ctx.dress(area);
  placeCast(ctx, { x0: 420, x1: 540, ground: 330, monX: 470, monScale: 2 }, layers.back);
  // Dark side washes so the panels read, and scanlines over everything.
  const wash = scene.add.graphics().setName('event-frame');
  wash.fillGradientStyle(0x0a0028, 0x0a0028, 0x0a0028, 0x0a0028, 0.88, 0, 0.88, 0).fillRect(0, 0, 400, GAME_HEIGHT);
  wash.fillGradientStyle(0x0a0028, 0x0a0028, 0x0a0028, 0x0a0028, 0, 0.9, 0, 0.9).fillRect(560, 0, 400, GAME_HEIGHT);
  for (let y = 0; y < GAME_HEIGHT; y += 4) wash.fillStyle(0x000000, 0.18).fillRect(0, y, GAME_WIDTH, 2);
  layers.back.add(wash);

  // Reticle over the cast.
  const ret = scene.add.container(470, 230);
  const rg = scene.add.graphics();
  rg.lineStyle(3, ctx.rim, 0.9).strokeCircle(0, 0, 70);
  rg.lineStyle(2, ctx.rim, 0.7).lineBetween(-110, 0, -40, 0).lineBetween(40, 0, 110, 0).lineBetween(0, -110, 0, -40).lineBetween(0, 40, 0, 110);
  for (let k = 0; k < 4; k++) rg.lineStyle(4, CYAN, 0.9).beginPath().arc(0, 0, 84, (k * Math.PI) / 2, (k * Math.PI) / 2 + 0.5).strokePath();
  ret.add(rg);
  layers.back.add(ret);
  if (!calm) scene.tweens.add({ targets: rg, angle: 360, duration: 9000, repeat: -1 });

  // Info panel: clipped corners, neon rim.
  const info = scene.add.container(calm ? 0 : -400, 0);
  const ig = scene.add.graphics();
  const pts = [v(INFO.x, INFO.y), v(INFO.x + INFO.w - 24, INFO.y), v(INFO.x + INFO.w, INFO.y + 24), v(INFO.x + INFO.w, INFO.y + INFO.h), v(INFO.x + 24, INFO.y + INFO.h), v(INFO.x, INFO.y + INFO.h - 24)];
  ig.fillStyle(0x001e3c, 0.7).fillPoints(pts, true);
  ig.lineStyle(6, CYAN, 0.25).strokePoints(pts, true);
  ig.lineStyle(2, CYAN, 1).strokePoints(pts, true);
  info.add(ig);
  info.add(fitLine(scene.add.text(INFO.x + 16, INFO.y + 14, `// ${view.event.group.toUpperCase()}`, textStyle(11, hex(CYAN))), INFO.w - 32, 8));
  const tx = INFO.x + 16;
  const ty = INFO.y + 34;
  const ghostA = scene.add.text(tx + 3, ty, view.event.name, textStyle(22, hex(MAGENTA))).setAlpha(0.8);
  const ghostB = scene.add.text(tx - 3, ty, view.event.name, textStyle(22, hex(CYAN))).setAlpha(0.8);
  const title = scene.add.text(tx, ty, view.event.name, textStyle(22, '#ffffff'));
  for (const t of [ghostA, ghostB, title]) fitLine(t, INFO.w - 40, 12);
  info.add([ghostA, ghostB, title]);
  const intro = scene.add.text(tx, INFO.y + 76, '', textStyle(14, '#cfeeff', { wordWrap: { width: INFO.w - 32 }, lineSpacing: 4 }));
  const introText = fitBlock(intro, INFO.w - 32, 150, view.event.intro).text;
  info.add(intro);
  typeOut(ctx, intro, introText);
  const risk = scene.add.text(tx, INFO.y + INFO.h - 52, '', textStyle(11, hex(CYAN), { wordWrap: { width: INFO.w - 40 }, maxLines: 3 })).setName('event-risk');
  info.add(risk);
  layers.front.add(info);
  if (!calm) {
    scene.tweens.add({ targets: info, x: 0, duration: 520, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: [ghostA, ghostB], alpha: 0.4, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2200 });
  }
  // Rarity meter.
  const lvl = RARITY_LEVEL[view.event.rarity.toLowerCase()] ?? 1;
  const meter = scene.add.graphics();
  for (let i = 0; i < 5; i++) meter.fillStyle(MAGENTA, i < lvl ? 1 : 0.2).fillRect(INFO.x + i * 50, INFO.y + INFO.h + 26, 42, 10);
  layers.front.add(meter);
  layers.front.add(scene.add.text(INFO.x, INFO.y + INFO.h + 44, `RARITY :: ${view.event.rarity.toUpperCase()} // SIGNAL LOCKED`, textStyle(11, hex(MAGENTA))));

  // Option slabs.
  const n = view.choices.length;
  const sh = Math.min(104, Math.floor((GAME_HEIGHT - 80 - (n - 1) * 12) / n));
  const top0 = 60;
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const y = top0 + i * (sh + 12);
    const homeX = SLAB_X;
    const w = scene.add.container(homeX, y);
    const col = choiceColor(c);
    const g = scene.add.graphics();
    const poly = [v(16, 0), v(SLAB_W, 0), v(SLAB_W - 16, sh), v(0, sh)];
    const paint = (on: boolean) => {
      g.clear();
      g.fillStyle(on ? col : 0x000000, on ? 0.35 : 0.6).fillPoints(poly, true);
      g.lineStyle(on ? 8 : 5, col, 0.25).strokePoints(poly, true);
      g.lineStyle(2, col, 1).strokePoints(poly, true);
    };
    paint(false);
    w.add(g);
    const head = c.locked ? `[${'ABCD'[i]}] LOCKED` : `[${'ABCD'[i]}] ${CHOICE_KIND_LABEL[c.kind]}${c.chance !== null ? `   ${Math.round(c.chance * 100)}%` : ''}`;
    w.add(scene.add.text(26, 10, head, textStyle(11, hex(col))));
    w.add(fitLine(scene.add.text(24, 28, c.label, textStyle(18, c.locked ? '#7a7a8a' : '#ffffff')), SLAB_W - 50, 11));
    w.add(fitLine(scene.add.text(22, 54, c.locked ?? c.cost ?? c.risk, textStyle(11, '#b8b8c8')), SLAB_W - 50, 8));
    if (c.chance !== null && !c.locked && sh >= 84) {
      const gy = sh - 16;
      w.add(scene.add.rectangle(20, gy, SLAB_W - 60, 8, 0xffffff, 0.15).setOrigin(0));
      const bar = scene.add.rectangle(20, gy, (SLAB_W - 60) * c.chance, 8, col).setOrigin(0);
      w.add(bar);
      if (!calm) {
        bar.setScale(0, 1);
        scene.tweens.add({ targets: bar, scaleX: 1, duration: 700, delay: 600 + i * 100, ease: 'Cubic.easeOut' });
      }
    }
    hitZone(ctx, w, SLAB_W, sh, i, hooks, SLAB_W / 2, sh / 2);
    layers.front.add(w);
    if (!calm) {
      w.setX(GAME_WIDTH + 20);
      scene.tweens.add({ targets: w, x: homeX, duration: 420, delay: 300 + i * 110, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        paint(on);
        scene.tweens.killTweensOf(w);
        const x = homeX - (on ? 20 : 0);
        if (calm) w.setX(x);
        else scene.tweens.add({ targets: w, x, duration: 200, ease: 'Back.easeOut' });
      },
    };
  });

  return {
    widgets,
    moneyAt: { x: INFO.x + INFO.w - 148, y: GAME_HEIGHT - 52 },
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitBlock(risk, INFO.w - 40, 44, ['> ' + (d.odds || 'NO ROLL'), d.risk.split('\n')[0], d.cost].filter(Boolean).join('\n'));
    },
    picked: (i) => {
      const slab = widgets[i]!.box;
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j !== i) scene.tweens.add({ targets: w.box, x: GAME_WIDTH + 20, alpha: 0, duration: calm ? 1 : 260, delay: j * 30, ease: 'Quad.easeIn' });
      });
      if (calm) return 10;
      // Glitch: the slab jitters and tears, a magenta scan sweeps down, then it blinks out.
      scene.tweens.add({ targets: slab, x: { from: slab.x - 8, to: slab.x + 8 }, duration: 40, yoyo: true, repeat: 5 });
      const scan = scene.add.rectangle(0, 0, GAME_WIDTH, 6, MAGENTA, 0.6).setOrigin(0).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: scan, y: GAME_HEIGHT, duration: 420, ease: 'Linear', onComplete: () => scan.destroy() });
      scene.tweens.add({ targets: slab, alpha: 0, scaleY: 0.05, duration: 160, delay: 380 });
      return 560;
    },
  };
};
