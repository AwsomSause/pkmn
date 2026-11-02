// Comic Panels (mock-up 07): three inked panels (the wide shot with a speech bubble, a close-up,
// a reaction burst with a sound word) on halftone paper, and sticker-style option boxes.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { loadAssets } from '../lazyAssets';
import { pokemonVisual, trainerVisual } from '../sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { CHOICE_KIND_LABEL, type ChoiceKind } from '../../core/presentation/eventStyles';
import { choiceColor, choiceTag, detailLines, drawArena, hitZone, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventCtx, EventLayout, Rect } from './types';

const PAPER = 0xfffbe8;
const INK = '#111111';
const WIDE: Rect = { x: 14, y: 14, w: 520, h: 300 };
const CLOSE: Rect = { x: 546, y: 14, w: 196, h: 300 };
const BURST: Rect = { x: 754, y: 14, w: 192, h: 300 };
const STRIP_Y = 364;

/** The sound word for the reaction panel. */
const SFX: Record<string, string> = { rain: 'DRIP!', snow: 'BRRR!', fire: 'FWOOSH!', hearts: '♥!', sparkle: '*glint*', glint: '*glint*', net: 'FWUMP!', fog: '...?', float: 'WOOO', flicker: 'BZZT!', spin: 'WHIRR!', rattle: 'RATTLE!', shake: 'RUMBLE!' };
const GLYPH: Record<ChoiceKind, string> = { battle: 'POW!', trade: 'SWAP', chance: '?', cost: '$', safe: 'OK' };

function mask(ctx: EventCtx, c: Phaser.GameObjects.Container, r: Rect): void {
  c.setMask(ctx.scene.make.graphics({}, false).fillRect(r.x, r.y, r.w, r.h).createGeometryMask());
}

export const comic: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  layers.back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PAPER).setOrigin(0));
  const dots = scene.add.graphics();
  for (let y = 4; y < GAME_HEIGHT; y += 12) for (let x = (y / 12) % 2 ? 10 : 4; x < GAME_WIDTH; x += 12) dots.fillStyle(0xe8d8a0, 0.6).fillCircle(x, y, 1.6);
  layers.back.add(dots);

  // Panel 1: the wide shot.
  const wide = scene.add.container(0, 0);
  drawArena(ctx, WIDE, wide);
  ctx.dress(WIDE);
  placeCast(ctx, { x0: WIDE.x + 300, x1: WIDE.x + WIDE.w - 70, ground: WIDE.y + WIDE.h - 16, monX: WIDE.x + 150, monScale: 2 }, wide);
  mask(ctx, wide, WIDE);
  layers.back.add(wide);
  // Panel 2: a close-up of the star of the scene (the arena zoomed in behind it).
  const close = scene.add.container(0, 0);
  drawArena(ctx, { x: CLOSE.x - 260, y: CLOSE.y - 160, w: CLOSE.w + 520, h: CLOSE.h + 320 }, close);
  const cx = CLOSE.x + CLOSE.w / 2;
  const ground = CLOSE.y + CLOSE.h + 40;
  const bottomUp = (o: Phaser.GameObjects.GameObject) => {
    (o as Phaser.GameObjects.Sprite).setOrigin?.(0.5, 1);
    close.add(o);
  };
  if (ctx.species) bottomUp(pokemonVisual(scene, ctx.species, 'front', cx, ground, 4));
  else if (ctx.castIds[0]) {
    const id = ctx.castIds[0];
    void loadAssets(scene, [id]).then(() => close.active && bottomUp(trainerVisual(scene, id, '', cx, ground, 4)));
  }
  mask(ctx, close, CLOSE);
  layers.back.add(close);
  // Panel 3: speed-line burst in the rarity colour and the sound word.
  const burst = scene.add.container(0, 0);
  const bx = BURST.x + BURST.w / 2;
  const by = BURST.y + BURST.h / 2;
  burst.add(scene.add.rectangle(BURST.x, BURST.y, BURST.w, BURST.h, 0xffffff).setOrigin(0));
  const rays = scene.add.graphics({ x: bx, y: by });
  for (let k = 0; k < 24; k += 2) {
    const a0 = (Math.PI * 2 * k) / 24;
    const a1 = (Math.PI * 2 * (k + 1)) / 24;
    rays.fillStyle(ctx.rim, 1).fillTriangle(0, 0, Math.cos(a0) * 400, Math.sin(a0) * 400, Math.cos(a1) * 400, Math.sin(a1) * 400);
  }
  burst.add(rays);
  const word = scene.add.text(bx, by, SFX[view.event.scene.effect] ?? '!?', textStyle(44, '#ffffff', { stroke: INK, strokeThickness: 8 })).setOrigin(0.5).setAngle(-10);
  burst.add(fitLine(word, BURST.w - 16, 20));
  mask(ctx, burst, BURST);
  layers.back.add(burst);
  if (!calm) {
    scene.tweens.add({ targets: rays, angle: 360, duration: 24000, repeat: -1 });
    scene.tweens.add({ targets: word, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Panels pop in one by one.
    [wide, close, burst].forEach((p, i) => {
      p.setAlpha(0);
      scene.tweens.add({ targets: p, alpha: 1, duration: 200, delay: 150 + i * 260 });
    });
  }
  const ink = scene.add.graphics().setName('event-frame');
  for (const r of [WIDE, CLOSE, BURST]) ink.lineStyle(5, 0x111111, 1).strokeRect(r.x, r.y, r.w, r.h);
  layers.front.add(ink);

  // Speech bubble with the story, top-left of panel 1.
  const bubble = scene.add.container(0, 0);
  const text = scene.add.text(WIDE.x + 28, WIDE.y + 24, '', textStyle(14, INK, { wordWrap: { width: 300 }, lineSpacing: 3 }));
  const story = fitBlock(text, 300, 92, view.event.intro).text;
  const bh = Math.max(40, text.height + 22);
  const bg = scene.add.graphics();
  bg.fillStyle(0xffffff, 1).fillRoundedRect(WIDE.x + 14, WIDE.y + 12, 328, bh, 18);
  bg.fillTriangle(WIDE.x + 220, WIDE.y + 10 + bh, WIDE.x + 260, WIDE.y + 10 + bh, WIDE.x + 290, WIDE.y + 40 + bh);
  bg.lineStyle(3, 0x111111, 1).strokeRoundedRect(WIDE.x + 14, WIDE.y + 12, 328, bh, 18);
  bg.lineBetween(WIDE.x + 220, WIDE.y + 12 + bh, WIDE.x + 290, WIDE.y + 40 + bh).lineBetween(WIDE.x + 260, WIDE.y + 12 + bh, WIDE.x + 290, WIDE.y + 40 + bh);
  bubble.add([bg, text]);
  layers.front.add(bubble);
  typeOut(ctx, text, story);
  if (!calm) {
    bubble.setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 300, ease: 'Back.easeOut' });
  }

  // Caption box with the title, and the focused option's details beside it.
  const cap = scene.add.text(16, 326, view.event.name, textStyle(18, INK, { backgroundColor: '#ffe14a', padding: { x: 10, y: 4 } })).setAngle(-2);
  layers.front.add(fitLine(cap, 320, 11));
  const risk = scene.add.text(GAME_WIDTH - 16, 332, '', textStyle(12, INK)).setOrigin(1, 0).setName('event-risk');
  layers.front.add(risk);

  // Sticker boxes.
  const n = view.choices.length;
  const gap = 16;
  const bw = Math.floor((GAME_WIDTH - 28 - (n - 1) * gap) / n);
  const bhh = GAME_HEIGHT - STRIP_Y - 16;
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const x = 14 + bw / 2 + i * (bw + gap);
    const y = STRIP_Y + bhh / 2;
    const tilt = [-3, 2, -2, 3][i % 4]!;
    const w = scene.add.container(x, y).setAngle(tilt);
    const col = choiceColor(c);
    const g = scene.add.graphics();
    g.fillStyle(0x111111, 1).fillRect(-bw / 2 + 7, -bhh / 2 + 7, bw, bhh);
    g.fillStyle(col, 1).fillRect(-bw / 2, -bhh / 2, bw, bhh);
    g.lineStyle(4, 0x111111, 1).strokeRect(-bw / 2, -bhh / 2, bw, bhh);
    w.add(g);
    const outline = scene.add.graphics().setVisible(false);
    outline.lineStyle(6, 0xffffff, 1).strokeRect(-bw / 2 - 7, -bhh / 2 - 7, bw + 14, bhh + 14);
    outline.lineStyle(3, 0x111111, 1).strokeRect(-bw / 2 - 10, -bhh / 2 - 10, bw + 20, bhh + 20);
    w.addAt(outline, 0);
    w.add(scene.add.text(-bw / 2 + 12, -bhh / 2 + 6, c.locked ? '🔒' : GLYPH[c.kind], textStyle(28, '#ffffff', { stroke: INK, strokeThickness: 5 })));
    w.add(scene.add.text(bw / 2 - 10, -bhh / 2 + 12, c.locked ? 'LOCKED' : c.chance !== null ? choiceTag(c) : CHOICE_KIND_LABEL[c.kind], textStyle(12, INK)).setOrigin(1, 0));
    w.add(fitBlock(scene.add.text(-bw / 2 + 12, -bhh / 2 + 52, '', textStyle(16, INK, { wordWrap: { width: bw - 24 } })), bw - 24, 40, c.label));
    w.add(fitBlock(scene.add.text(-bw / 2 + 12, -bhh / 2 + 98, '', textStyle(11, '#2a2a2a', { wordWrap: { width: bw - 24 } })), bw - 24, 32, c.locked ?? c.cost ?? c.risk));
    hitZone(ctx, w, bw, bhh, i, hooks);
    layers.front.add(w);
    if (!calm) {
      w.setScale(0);
      scene.tweens.add({ targets: w, scale: 1, duration: 300, delay: 900 + i * 120, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        outline.setVisible(on);
        if (on) layers.front.bringToTop(w);
        scene.tweens.killTweensOf(w);
        if (calm) w.setScale(on ? 1.05 : 1).setAngle(on ? 0 : tilt);
        else scene.tweens.add({ targets: w, scale: on ? 1.06 : 1, angle: on ? 0 : tilt, duration: 200, ease: 'Back.easeOut' });
      },
    };
  });

  return {
    widgets,
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(risk, 560, 9, [d.odds, d.risk.split('\n')[0], d.cost].filter(Boolean).join('  ·  '));
    },
    picked: (i) => {
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j !== i) scene.tweens.add({ targets: w.box, alpha: 0, duration: calm ? 1 : 200 });
      });
      if (calm) return 10;
      // The picked sticker stamps down with a "KA-POW" star.
      const pick = widgets[i]!.box;
      const star = scene.add.star(pick.x, pick.y, 12, 40, 90, 0xffe14a).setStrokeStyle(4, 0x111111).setDepth(20).setScale(0);
      const pow = scene.add.text(pick.x, pick.y, view.choices[i]!.kind === 'safe' ? 'OK!' : 'KA-POW!', textStyle(26, '#ff3a3a', { stroke: INK, strokeThickness: 6 })).setOrigin(0.5).setDepth(21).setScale(0);
      scene.tweens.add({ targets: pick, scale: 1.2, duration: 120, yoyo: true });
      scene.tweens.add({ targets: [star, pow], scale: 1, duration: 260, ease: 'Back.easeOut', onComplete: () => scene.tweens.add({ targets: [star, pow, pick], alpha: 0, duration: 260, delay: 200, onComplete: () => (star.destroy(), pow.destroy()) }) });
      return 700;
    },
  };
};
