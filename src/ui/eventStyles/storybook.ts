// Storybook (mock-up 04): an open book. The left page holds an illustrated plate of the scene
// with its caption; the right page tells the story under a drop cap, and the options are
// bookmark ribbons. Picking one turns the page.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, choiceTag, detailLines, drawArena, hex, hitZone, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventLayout } from './types';

const INK = '#3a2618';
const FADED = '#8a6a4a';
const PAPER = 0xf6ead0;
const PLATE = { x: 72, y: 62, w: 372, h: 250 };
const RIGHT_X = 510;
const RIGHT_W = 400;

export const storybook: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  // Desk, cover, and two pages with a soft shadow down the spine.
  const back = layers.back;
  back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x2a1810).setOrigin(0));
  const cover = scene.add.graphics();
  cover.fillStyle(0x000000, 0.35).fillRoundedRect(30, 26, GAME_WIDTH - 52, GAME_HEIGHT - 44, 14);
  cover.fillStyle(0x7a2a20, 1).fillRoundedRect(22, 18, GAME_WIDTH - 44, GAME_HEIGHT - 36, 14);
  cover.fillStyle(PAPER, 1).fillRoundedRect(36, 28, GAME_WIDTH / 2 - 40, GAME_HEIGHT - 56, 6);
  cover.fillStyle(PAPER, 1).fillRoundedRect(GAME_WIDTH / 2 + 4, 28, GAME_WIDTH / 2 - 40, GAME_HEIGHT - 56, 6);
  for (let k = 0; k < 10; k++) {
    cover.fillStyle(0x6a4a30, 0.06 + k * 0.012).fillRect(GAME_WIDTH / 2 - 26 + k * 2, 28, 2, GAME_HEIGHT - 56);
    cover.fillStyle(0x6a4a30, 0.06 + k * 0.012).fillRect(GAME_WIDTH / 2 + 24 - k * 2, 28, 2, GAME_HEIGHT - 56);
  }
  back.add(cover);
  // A ribbon marker hangs off the cover in the rarity colour.
  back.add(scene.add.triangle(GAME_WIDTH - 40, 230, 0, 0, 22, 0, 22, 70, ctx.rim).setOrigin(0));
  back.add(scene.add.triangle(GAME_WIDTH - 40, 230, 0, 0, 0, 70, 11, 56, ctx.rim).setOrigin(0));

  // The plate: the location art, warmed like an old print, with the cast inside it.
  const plate = scene.add.container(0, 0);
  drawArena(ctx, PLATE, plate, { tint: 0xffe2c0 });
  ctx.dress(PLATE);
  placeCast(ctx, { x0: PLATE.x + 210, x1: PLATE.x + PLATE.w - 60, ground: PLATE.y + PLATE.h - 22, monX: PLATE.x + 110, monScale: 2 }, plate);
  const maskShape = scene.make.graphics({}, false).fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  plate.setMask(maskShape.createGeometryMask());
  back.add(plate);
  const frame = scene.add.graphics().setName('event-frame');
  frame.lineStyle(4, 0x6a4a30, 1).strokeRect(PLATE.x - 2, PLATE.y - 2, PLATE.w + 4, PLATE.h + 4);
  frame.lineStyle(1, 0x6a4a30, 0.6).strokeRect(PLATE.x - 8, PLATE.y - 8, PLATE.w + 16, PLATE.h + 16);
  layers.front.add(frame);

  const cx = PLATE.x + PLATE.w / 2;
  layers.front.add(fitLine(scene.add.text(cx, PLATE.y + PLATE.h + 18, `~ ${view.event.name} ~`, textStyle(18, INK)).setOrigin(0.5, 0), PLATE.w, 12));
  layers.front.add(fitLine(scene.add.text(cx, PLATE.y + PLATE.h + 44, `${view.event.group}  ·  ${view.event.rarity.toUpperCase()}`, textStyle(12, FADED)).setOrigin(0.5, 0), PLATE.w, 10));
  // The focused option's details as a margin note under the caption.
  const note = scene.add.container(0, 0);
  const odds = scene.add.text(PLATE.x, PLATE.y + PLATE.h + 78, '', textStyle(14, '#9a5a10', { maxLines: 1 }));
  const risk = scene.add.text(PLATE.x, PLATE.y + PLATE.h + 98, '', textStyle(13, INK, { wordWrap: { width: PLATE.w }, maxLines: 3 })).setName('event-risk');
  const cost = scene.add.text(PLATE.x, PLATE.y + PLATE.h + 148, '', textStyle(13, '#a03020', { maxLines: 1 })).setName('event-cost');
  note.add([odds, risk, cost]);
  layers.front.add(note);

  // Right page: a drop cap in the rarity colour, then the story.
  const intro = view.event.intro;
  const cap = scene.add.text(RIGHT_X, 50, intro.charAt(0), textStyle(52, hex(ctx.rim), { stroke: '#5a3a24', strokeThickness: 5 }));
  layers.front.add(cap);
  const body = scene.add.text(RIGHT_X + 50, 56, '', textStyle(16, INK, { wordWrap: { width: RIGHT_W - 50 }, lineSpacing: 5 }));
  const bodyText = fitBlock(body, RIGHT_W - 50, 168, intro.slice(1)).text;
  layers.front.add(body);
  typeOut(ctx, body, bodyText);

  // Bookmark ribbons, one per option, with a dashed rule beneath each.
  const n = view.choices.length;
  const listTop = 250;
  const rowH = Math.min(56, Math.floor((GAME_HEIGHT - 52 - listTop) / Math.max(1, n)));
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const y = listTop + i * rowH;
    const w = scene.add.container(RIGHT_X, y);
    const col = choiceColor(c);
    const ribbon = scene.add.graphics();
    ribbon.fillStyle(col, 1).fillPoints([new Phaser.Math.Vector2(0, 4), new Phaser.Math.Vector2(24, 4), new Phaser.Math.Vector2(24, rowH - 8), new Phaser.Math.Vector2(12, rowH - 16), new Phaser.Math.Vector2(0, rowH - 8)], true);
    w.add(ribbon);
    const label = fitLine(scene.add.text(36, 6, c.label, textStyle(16, c.locked ? FADED : INK)), RIGHT_W - 110, 11);
    w.add(label);
    w.add(scene.add.text(RIGHT_W, 8, choiceTag(c), textStyle(13, c.locked ? '#a03020' : hex(col), { stroke: '#5a3a24', strokeThickness: 3 })).setOrigin(1, 0));
    w.add(fitLine(scene.add.text(36, 28, c.locked ?? c.risk, textStyle(11, FADED)), RIGHT_W - 40, 9));
    const rule = scene.add.graphics();
    for (let x = 36; x < RIGHT_W; x += 10) rule.lineStyle(1, 0xb89a70, 0.8).lineBetween(x, rowH - 4, x + 5, rowH - 4);
    w.add(rule);
    const glow = scene.add.rectangle(30, 2, RIGHT_W - 26, rowH - 8, col, 0.16).setOrigin(0).setVisible(false);
    w.addAt(glow, 0);
    hitZone(ctx, w, RIGHT_W, rowH, i, hooks, RIGHT_W / 2, rowH / 2);
    layers.front.add(w);
    if (!calm) {
      w.setAlpha(0).setX(RIGHT_X + 30);
      scene.tweens.add({ targets: w, alpha: 1, x: RIGHT_X, duration: 360, delay: 380 + i * 110, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        glow.setVisible(on);
        label.setColor(on ? hex(0x1a0e06) : c.locked ? FADED : INK);
        scene.tweens.killTweensOf(ribbon);
        if (calm) ribbon.setScale(1, on ? 1.12 : 1);
        else scene.tweens.add({ targets: ribbon, scaleY: on ? 1.12 : 1, duration: 200, ease: 'Back.easeOut' });
      },
    };
  });

  return {
    widgets,
    moneyAt: { x: GAME_WIDTH / 2 - 196, y: GAME_HEIGHT - 76 },
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(odds, PLATE.w, 10, d.odds).setColor(c.locked ? '#a03020' : '#9a5a10');
      fitBlock(risk, PLATE.w, 46, d.risk);
      fitLine(cost, PLATE.w, 10, d.cost);
    },
    picked: (i) => {
      const chosen = widgets[i]!.box;
      scene.tweens.add({ targets: chosen, x: chosen.x + 16, duration: calm ? 1 : 140, yoyo: true });
      if (calm) return 10;
      // The right page turns over onto the left.
      const leaf = scene.add.rectangle(GAME_WIDTH / 2 + 4, 28, GAME_WIDTH / 2 - 40, GAME_HEIGHT - 56, PAPER).setOrigin(0, 0).setDepth(25);
      leaf.setStrokeStyle(1, 0xb89a70);
      scene.tweens.add({ targets: leaf, scaleX: 0, duration: 260, ease: 'Sine.easeIn', onComplete: () => {
        leaf.setOrigin(1, 0).setX(GAME_WIDTH / 2 - 4);
        scene.tweens.add({ targets: leaf, scaleX: 1, duration: 260, ease: 'Sine.easeOut', onComplete: () => scene.tweens.add({ targets: leaf, alpha: 0, duration: 200, onComplete: () => leaf.destroy() }) });
      } });
      return 560;
    },
  };
};
