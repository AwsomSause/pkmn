// Card Draw (mock-up 06): the scene in a framed banner on a card table; each option is a card
// fanned at the bottom with its kind and an odds ring. Focus lifts a card; picking flips it.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, detailLines, drawArena, hex, hitZone, placeCast, typeOut } from './common';
import { CHOICE_KIND_LABEL } from '../../core/presentation/eventStyles';
import type { ChoiceWidget, EventLayout } from './types';

const BANNER = { x: 120, y: 30, w: GAME_WIDTH - 240, h: 232 };
const CARD_H = 196;
const GOLD = 0xe8d8a0;

export const cards: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  // Felt table: a dark teal with a soft light pooled at the bottom.
  layers.back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0e1e2a).setOrigin(0));
  for (let k = 0; k < 8; k++) layers.back.add(scene.add.ellipse(GAME_WIDTH / 2, GAME_HEIGHT + 60, 1200 - k * 120, 520 - k * 50, 0x2a6a5a, 0.12));

  // Banner: the location and cast, masked to a frame with a gold rim.
  const stage = scene.add.container(0, 0);
  drawArena(ctx, BANNER, stage);
  ctx.dress(BANNER);
  placeCast(ctx, { x0: BANNER.x + 420, x1: BANNER.x + BANNER.w - 80, ground: BANNER.y + BANNER.h - 44, monX: BANNER.x + 200, monScale: 2 }, stage);
  stage.setMask(scene.make.graphics({}, false).fillRect(BANNER.x, BANNER.y, BANNER.w, BANNER.h).createGeometryMask());
  layers.back.add(stage);
  const rim = scene.add.graphics().setName('event-frame');
  rim.lineStyle(4, GOLD, 1).strokeRoundedRect(BANNER.x - 2, BANNER.y - 2, BANNER.w + 4, BANNER.h + 4, 14);
  rim.fillStyle(0x08101a, 0.82).fillRect(BANNER.x, BANNER.y + BANNER.h - 40, BANNER.w, 40);
  layers.front.add(rim);
  const intro = scene.add.text(BANNER.x + 16, BANNER.y + BANNER.h - 34, '', textStyle(14, '#ffffff', { wordWrap: { width: BANNER.w - 32 }, lineSpacing: 2 }));
  const introText = fitBlock(intro, BANNER.w - 32, 32, view.event.intro).text;
  layers.front.add(intro);
  typeOut(ctx, intro, introText);
  const tab = scene.add.text(GAME_WIDTH / 2, BANNER.y - 2, view.event.name, textStyle(16, '#3a2a10', { backgroundColor: hex(GOLD), padding: { x: 14, y: 3 } })).setOrigin(0.5, 0.5);
  layers.front.add(fitLine(tab, 420, 10));
  layers.front.add(fitLine(scene.add.text(BANNER.x + 8, BANNER.y + 8, `${view.event.group}  ·  ${view.event.rarity.toUpperCase()}`, textStyle(11, '#ffffff', { backgroundColor: '#0c2a44', padding: { x: 6, y: 2 } })), 360, 8));

  // The hand of cards.
  const n = view.choices.length;
  const cw = Math.min(170, Math.floor((GAME_WIDTH - 120 - (n - 1) * 18) / n));
  const span = n * cw + (n - 1) * 18;
  const baseY = 300 + CARD_H / 2;
  const homes = view.choices.map((_, i) => {
    const off = i - (n - 1) / 2;
    return { x: (GAME_WIDTH - span) / 2 + cw / 2 + i * (cw + 18), y: baseY + Math.abs(off) * 10, angle: off * 6 };
  });
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const h = homes[i]!;
    const w = scene.add.container(h.x, calm ? h.y : GAME_HEIGHT + CARD_H).setAngle(h.angle);
    const col = choiceColor(c);
    const face = scene.add.graphics();
    face.fillStyle(0x000000, 0.4).fillRoundedRect(-cw / 2 + 4, -CARD_H / 2 + 8, cw, CARD_H, 12);
    face.fillStyle(c.locked ? 0xcfc8b8 : 0xfffaea, 1).fillRoundedRect(-cw / 2, -CARD_H / 2, cw, CARD_H, 12);
    face.lineStyle(5, col, 1).strokeRoundedRect(-cw / 2, -CARD_H / 2, cw, CARD_H, 12);
    face.fillStyle(col, 1).fillRoundedRect(-cw / 2 + 10, -CARD_H / 2 + 10, cw - 20, 20, 5);
    w.add(face);
    w.add(scene.add.text(0, -CARD_H / 2 + 20, c.locked ? 'LOCKED' : CHOICE_KIND_LABEL[c.kind], textStyle(12, '#122233')).setOrigin(0.5));
    // Odds ring (or a star when nothing is rolled).
    const ring = scene.add.graphics();
    const ry = -CARD_H / 2 + 72;
    if (c.chance !== null && !c.locked) {
      ring.lineStyle(9, 0xd8d0c0, 1).beginPath().arc(0, ry, 30, 0, Math.PI * 2).strokePath();
      ring.lineStyle(9, col, 1).beginPath().arc(0, ry, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.chance).strokePath();
      w.add(ring);
      w.add(scene.add.text(0, ry, `${Math.round(c.chance * 100)}%`, textStyle(16, '#2a2010')).setOrigin(0.5));
    } else {
      w.add(scene.add.star(0, ry, 5, 12, 28, c.locked ? 0x8a8a8a : col).setStrokeStyle(3, 0x2a2010));
      if (c.locked) w.add(scene.add.text(0, ry, '🔒', textStyle(18)).setOrigin(0.5));
    }
    w.add(fitBlock(scene.add.text(0, -CARD_H / 2 + 112, '', textStyle(14, c.locked ? '#6a6050' : '#2a2010', { align: 'center', wordWrap: { width: cw - 20 } })).setOrigin(0.5, 0), cw - 20, 38, c.label));
    w.add(fitBlock(scene.add.text(0, -CARD_H / 2 + 152, '', textStyle(10, '#7a6a4a', { align: 'center', wordWrap: { width: cw - 20 } })).setOrigin(0.5, 0), cw - 20, 36, c.locked ?? c.cost ?? c.risk));
    const glow = scene.add.graphics().setVisible(false);
    glow.lineStyle(10, col, 0.35).strokeRoundedRect(-cw / 2 - 6, -CARD_H / 2 - 6, cw + 12, CARD_H + 12, 16);
    glow.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-cw / 2 - 3, -CARD_H / 2 - 3, cw + 6, CARD_H + 6, 14);
    w.addAt(glow, 0);
    hitZone(ctx, w, cw, CARD_H, i, hooks);
    layers.front.add(w);
    if (!calm) scene.tweens.add({ targets: w, y: h.y, duration: 480, delay: 350 + i * 110, ease: 'Back.easeOut' });
    return {
      box: w,
      focus: (on) => {
        glow.setVisible(on);
        if (on) layers.front.bringToTop(w);
        scene.tweens.killTweensOf(w);
        const t = { y: h.y - (on ? 26 : 0), angle: on ? 0 : h.angle, scale: on ? 1.08 : 1 };
        if (calm) w.setPosition(h.x, t.y).setAngle(t.angle).setScale(t.scale);
        else scene.tweens.add({ targets: w, ...t, duration: 220, ease: 'Back.easeOut' });
      },
    };
  });
  const risk = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 8, '', textStyle(12, '#bfe9ff', { stroke: '#0e1e2a', strokeThickness: 3 })).setOrigin(0.5, 1).setName('event-risk');
  layers.front.add(risk);

  return {
    widgets,
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(risk, GAME_WIDTH - 60, 9, [d.odds, d.risk.split('\n')[0], d.cost].filter(Boolean).join('  ·  '));
    },
    picked: (i) => {
      const card = widgets[i]!.box;
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j !== i) scene.tweens.add({ targets: w.box, y: GAME_HEIGHT + CARD_H, alpha: 0, duration: calm ? 1 : 320, delay: j * 40, ease: 'Quad.easeIn' });
      });
      scene.tweens.add({ targets: risk, alpha: 0, duration: calm ? 1 : 200 });
      if (calm) return 10;
      // Flip: squash to an edge, show the back in the kind colour, then float up and fade.
      scene.tweens.add({
        targets: card,
        scaleX: 0,
        angle: 0,
        duration: 180,
        ease: 'Sine.easeIn',
        onComplete: () => {
          const back = scene.add.rectangle(0, 0, cw, CARD_H, choiceColor(view.choices[i]!), 1).setStrokeStyle(5, GOLD);
          card.add(back);
          card.add(scene.add.star(0, 0, 8, 16, 40, 0xffffff, 0.9));
          scene.tweens.add({ targets: card, scaleX: 1.1, scaleY: 1.1, y: card.y - 60, duration: 220, ease: 'Back.easeOut', onComplete: () => scene.tweens.add({ targets: card, alpha: 0, duration: 260, delay: 120 }) });
        },
      });
      return 640;
    },
  };
};
