// Diorama (mock-up 01): the stage's location art fills the screen, the cast stands on it, and
// glossy Aero glass holds the title, the story text and the option pills (they slide out on focus).
import { fitBlock, fitLine } from '../fitText';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, choiceTag, detailLines, drawArena, hex, hitZone, paintLightGlass, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventLayout } from './types';

const INK = '#1d2a3a';
const BOX = { x: 24, y: 372, w: 520, h: 150 };
const PILLS_X = 568;
const PILL_W = GAME_WIDTH - 24 - PILLS_X;

export const diorama: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  const area = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
  drawArena(ctx, area, layers.back);
  ctx.dress(area);
  layers.back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setName('event-frame'));
  placeCast(ctx, { x0: 520, x1: 820, ground: 352, monX: 300, monScale: 2 }, layers.back);

  // Title: a light glass pill with the group · rarity kicker in the rarity colour.
  const title = scene.add.container(calm ? 24 : -460, 16);
  const tg = scene.add.graphics();
  paintLightGlass(tg, 0, 0, 440, 58, { radius: 29 });
  title.add(tg);
  title.add(fitLine(scene.add.text(24, 8, `${view.event.group}  ·  ${view.event.rarity.toUpperCase()}`, textStyle(12, hex(ctx.rim), { stroke: '#203040', strokeThickness: 3 })), 392));
  title.add(fitLine(scene.add.text(24, 26, view.event.name, textStyle(22, INK)), 392));
  layers.front.add(title);
  if (!calm) scene.tweens.add({ targets: title, x: 24, duration: 600, ease: 'Back.easeOut' });

  // Story box: bright glass, dark ink; the focused option's details sit in its lower part.
  const box = scene.add.container(0, calm ? 0 : 200);
  const bg = scene.add.graphics();
  paintLightGlass(bg, BOX.x, BOX.y, BOX.w, BOX.h, { rim: ctx.rim, radius: 22 });
  box.add(bg);
  const intro = scene.add.text(BOX.x + 20, BOX.y + 14, '', textStyle(16, INK, { wordWrap: { width: BOX.w - 40 }, lineSpacing: 4 }));
  const introText = fitBlock(intro, BOX.w - 40, 74, view.event.intro).text;
  box.add(intro);
  typeOut(ctx, intro, introText);
  box.add(scene.add.graphics().lineStyle(1, ctx.rim, 0.5).lineBetween(BOX.x + 20, BOX.y + 92, BOX.x + BOX.w - 20, BOX.y + 92));
  const odds = scene.add.text(BOX.x + 20, BOX.y + 98, '', textStyle(13, '#a06000', { maxLines: 1 }));
  const risk = scene.add.text(BOX.x + 20, BOX.y + 114, '', textStyle(12, '#24506a', { wordWrap: { width: BOX.w - 40 }, maxLines: 2 })).setName('event-risk');
  const cost = scene.add.text(BOX.x + BOX.w - 20, BOX.y + 98, '', textStyle(12, '#b03020')).setOrigin(1, 0).setName('event-cost');
  box.add([odds, risk, cost]);
  layers.front.add(box);
  if (!calm) scene.tweens.add({ targets: box, y: 0, duration: 520, delay: 150, ease: 'Back.easeOut' });

  // Option pills, stacked bottom-right, each tagged with its kind colour.
  const n = view.choices.length;
  const rowH = Math.min(44, Math.floor(BOX.h / Math.max(1, n)));
  const top = BOX.y + BOX.h - n * rowH;
  const homeX = PILLS_X + PILL_W / 2;
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const y = top + i * rowH + rowH / 2;
    const w = scene.add.container(homeX, y);
    const col = choiceColor(c);
    const g = scene.add.graphics();
    paintLightGlass(g, -PILL_W / 2, -rowH / 2 + 3, PILL_W, rowH - 6, { tint: c.locked ? 0xb8bec8 : 0xf2faff, alpha: c.locked ? 0.8 : 0.92, radius: (rowH - 6) / 2 });
    w.add(g);
    w.add(scene.add.circle(-PILL_W / 2 + 18, 0, 6, col).setStrokeStyle(2, 0xffffff));
    const label = fitLine(scene.add.text(-PILL_W / 2 + 32, 0, c.label, textStyle(15, c.locked ? '#5a6070' : INK)).setOrigin(0, 0.5), PILL_W - 120, 11);
    w.add(label);
    w.add(scene.add.text(PILL_W / 2 - 16, 0, choiceTag(c), textStyle(13, hex(col), { stroke: '#203040', strokeThickness: 3 })).setOrigin(1, 0.5));
    const ring = scene.add.graphics().setVisible(false);
    ring.lineStyle(6, ctx.rim, 0.35).strokeRoundedRect(-PILL_W / 2 - 3, -rowH / 2, PILL_W + 6, rowH, rowH / 2);
    ring.lineStyle(2, ctx.rim, 1).strokeRoundedRect(-PILL_W / 2, -rowH / 2 + 3, PILL_W, rowH - 6, (rowH - 6) / 2);
    w.add(ring);
    hitZone(ctx, w, PILL_W, rowH, i, hooks);
    layers.front.add(w);
    if (!calm) {
      w.setScale(0);
      scene.tweens.add({ targets: w, scale: 1, duration: 380, delay: 400 + i * 100, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        ring.setVisible(on);
        scene.tweens.killTweensOf(w);
        const x = homeX - (on ? 12 : 0);
        if (calm) w.setPosition(x, y).setScale(1);
        else scene.tweens.add({ targets: w, x, scale: on ? 1.03 : 1, duration: 220, ease: 'Back.easeOut' });
      },
    };
  });

  return {
    widgets,
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(odds, 300, 10, d.odds).setColor(c.locked ? '#b03020' : '#a06000');
      fitBlock(risk, BOX.w - 40, 30, d.risk);
      fitLine(cost, 200, 10, d.cost);
    },
    picked: (i) => {
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j === i) scene.tweens.add({ targets: w.box, x: w.box.x - 30, scaleX: 1.1, scaleY: 0.85, alpha: 0, duration: calm ? 1 : 420, ease: 'Back.easeIn' });
        else scene.tweens.add({ targets: w.box, x: w.box.x + 300, alpha: 0, duration: calm ? 1 : 360, delay: j * 40, ease: 'Quad.easeIn' });
      });
      scene.tweens.add({ targets: [odds, risk, cost], alpha: 0, duration: calm ? 1 : 240 });
      return calm ? 10 : 380;
    },
  };
};
