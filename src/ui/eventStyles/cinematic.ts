// Cinematic (mock-up 10): letterbox bars slide in over the full location, a vignette darkens the
// edges, the story plays as subtitles, and quiet A/B/X/Y choices sit in the bottom bar.
// Picking closes the bars like a cut to black.
import { fitBlock, fitLine } from '../fitText';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, choiceTag, detailLines, drawArena, hex, hitZone, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventLayout } from './types';

const TOP_H = 64;
const BOTTOM_H = 132;
const KEYS = ['A', 'B', 'X', 'Y'];

export const cinematic: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  const area = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
  drawArena(ctx, area, layers.back);
  ctx.dress(area);
  placeCast(ctx, { x0: 520, x1: 800, ground: GAME_HEIGHT - BOTTOM_H + 20, monX: 300, monScale: 3, trainerScale: 3 }, layers.back);
  // Vignette: soft dark edges.
  const vig = scene.add.graphics().setName('event-frame');
  for (let k = 0; k < 10; k++) {
    const a = 0.06;
    vig.fillStyle(0x000000, a).fillRect(0, 0, GAME_WIDTH, 30 + k * 14);
    vig.fillStyle(0x000000, a).fillRect(0, 0, 40 + k * 16, GAME_HEIGHT);
    vig.fillStyle(0x000000, a).fillRect(GAME_WIDTH - 40 - k * 16, 0, 40 + k * 16, GAME_HEIGHT);
  }
  layers.back.add(vig);

  // Letterbox bars.
  const top = scene.add.rectangle(0, calm ? 0 : -TOP_H, GAME_WIDTH, TOP_H, 0x000000).setOrigin(0);
  const bottom = scene.add.rectangle(0, calm ? GAME_HEIGHT - BOTTOM_H : GAME_HEIGHT, GAME_WIDTH, BOTTOM_H, 0x000000).setOrigin(0);
  layers.front.add([top, bottom]);
  if (!calm) {
    scene.tweens.add({ targets: top, y: 0, duration: 700, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: bottom, y: GAME_HEIGHT - BOTTOM_H, duration: 700, ease: 'Cubic.easeOut' });
  }
  const kicker = scene.add.text(24, 24, `${view.event.rarity.toUpperCase()}  ENCOUNTER`.split('').join(' '), textStyle(12, hex(ctx.rim)));
  const title = fitLine(scene.add.text(GAME_WIDTH / 2, TOP_H + 26, view.event.name, textStyle(26, '#ffffff', { stroke: '#000000', strokeThickness: 4 })).setOrigin(0.5), 560, 14);
  layers.front.add([kicker, title]);
  if (!calm) {
    title.setAlpha(0);
    scene.tweens.add({ targets: title, alpha: 1, duration: 900, delay: 500 });
  }

  // Subtitles just above the bottom bar.
  const sub = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - BOTTOM_H - 14, '', textStyle(16, '#ffffff', { align: 'center', wordWrap: { width: 760 }, backgroundColor: '#000000aa', padding: { x: 10, y: 5 }, lineSpacing: 4 })).setOrigin(0.5, 1);
  const subText = fitBlock(sub, 760, 70, view.event.intro).text;
  layers.front.add(sub);
  if (!calm) {
    sub.setAlpha(0);
    scene.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 700, onStart: () => typeOut(ctx, sub, subText) });
  } else sub.setText(subText);

  // Choices in the bottom bar.
  const n = view.choices.length;
  const cw = (GAME_WIDTH - 48) / n;
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const x = 24 + i * cw;
    const w = scene.add.container(x, GAME_HEIGHT - BOTTOM_H + 16);
    const col = choiceColor(c);
    const line = scene.add.rectangle(0, 0, cw - 20, 3, 0x555555).setOrigin(0);
    const key = scene.add.text(0, 14, KEYS[i] ?? String(i + 1), textStyle(13, hex(col)));
    const label = fitLine(scene.add.text(22, 12, c.label, textStyle(16, '#9a9a9a')), cw - 44, 10);
    const tag = scene.add.text(22, 40, c.locked ? `🔒 ${c.locked}` : choiceTag(c), textStyle(11, c.locked ? '#f87870' : '#7a7a7a'));
    w.add([line, key, label, fitLine(tag, cw - 44, 8)]);
    hitZone(ctx, w, cw - 20, 70, i, hooks, (cw - 20) / 2, 30);
    layers.front.add(w);
    if (!calm) {
      w.setAlpha(0);
      scene.tweens.add({ targets: w, alpha: 1, duration: 400, delay: 900 + i * 120 });
    }
    return {
      box: w,
      focus: (on) => {
        line.setFillStyle(on ? col : 0x555555);
        label.setColor(on ? '#ffffff' : c.locked ? '#6a6a6a' : '#9a9a9a');
        scene.tweens.killTweensOf(w);
        const y = GAME_HEIGHT - BOTTOM_H + 16 - (on ? 4 : 0);
        if (calm) w.setY(y).setAlpha(1);
        else scene.tweens.add({ targets: w, y, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
      },
    };
  });
  const risk = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, '', textStyle(11, '#8a8a8a')).setOrigin(0.5, 1).setName('event-risk');
  layers.front.add(risk);

  return {
    widgets,
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(risk, GAME_WIDTH - 60, 8, [d.odds, d.risk.split('\n')[0], d.cost].filter(Boolean).join('  ·  '));
    },
    picked: () => {
      widgets.forEach((w) => scene.tweens.add({ targets: w.box, alpha: 0, duration: calm ? 1 : 200 }));
      scene.tweens.add({ targets: [sub, risk, title], alpha: 0, duration: calm ? 1 : 200 });
      if (calm) return 10;
      // Cut to black: the bars close in.
      scene.tweens.add({ targets: top, displayHeight: GAME_HEIGHT / 2 + 2, duration: 420, ease: 'Cubic.easeIn' });
      scene.tweens.add({ targets: bottom, y: GAME_HEIGHT / 2, displayHeight: GAME_HEIGHT / 2, duration: 420, ease: 'Cubic.easeIn' });
      return 520;
    },
  };
};
