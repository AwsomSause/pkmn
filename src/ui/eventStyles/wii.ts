// Wii Channel (mock-up 03): the scene plays in a rounded TV tile on a pinstripe background, and
// the options are white channel capsules on a shelf. Picking one (Kice's wish) makes a disc with
// that choice on it, slides it into the console slot and plays a Wii-style disc sound.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { playDiscInsert } from '../procAudio';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, choiceTag, detailLines, drawArena, hitZone, placeCast, typeOut } from './common';
import type { ChoiceWidget, EventLayout } from './types';

const TILE = { x: 70, y: 40, w: GAME_WIDTH - 140, h: 320 };
const SHELF_Y = 392;
const WII_BLUE = 0x34b4ff;
const GREY = '#4a5a6a';
/** The console's disc slot, beside the TV tile. */
const SLOT = { x: GAME_WIDTH - 34, y: 120, h: 150 };

export const wii: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  const back = layers.back;
  back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf1f5f9).setOrigin(0));
  const stripes = scene.add.graphics();
  for (let y = 0; y < GAME_HEIGHT; y += 7) stripes.fillStyle(0xaabed2, 0.18).fillRect(0, y, GAME_WIDTH, 1);
  back.add(stripes);

  // TV tile: the location and cast inside a rounded, white-rimmed screen.
  const tv = scene.add.container(0, 0);
  drawArena(ctx, TILE, tv);
  ctx.dress(TILE);
  placeCast(ctx, { x0: TILE.x + 470, x1: TILE.x + TILE.w - 90, ground: TILE.y + TILE.h - 40, monX: TILE.x + 230, monScale: 2 }, tv);
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6).fillRect(TILE.x, TILE.y + TILE.h - 90, TILE.w, 90);
  tv.add(shade);
  tv.setMask(scene.make.graphics({}, false).fillRoundedRect(TILE.x, TILE.y, TILE.w, TILE.h, 34).createGeometryMask());
  back.add(tv);
  const rim = scene.add.graphics().setName('event-frame');
  rim.lineStyle(10, 0xb5c8d8, 1).strokeRoundedRect(TILE.x - 4, TILE.y - 4, TILE.w + 8, TILE.h + 8, 38);
  rim.lineStyle(6, 0xffffff, 1).strokeRoundedRect(TILE.x, TILE.y, TILE.w, TILE.h, 34);
  // The console's disc slot to the right of the screen.
  rim.fillStyle(0xffffff, 1).fillRoundedRect(SLOT.x - 14, SLOT.y - 20, 28, SLOT.h + 40, 12);
  rim.lineStyle(2, 0xb5c8d8, 1).strokeRoundedRect(SLOT.x - 14, SLOT.y - 20, 28, SLOT.h + 40, 12);
  rim.fillStyle(0x2a3440, 1).fillRect(SLOT.x - 2, SLOT.y, 4, SLOT.h);
  const slotLight = scene.add.circle(SLOT.x, SLOT.y + SLOT.h + 10, 3, WII_BLUE, 0.4);
  layers.front.add([rim, slotLight]);
  if (!calm) scene.tweens.add({ targets: slotLight, alpha: 1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const intro = scene.add.text(TILE.x + 40, TILE.y + TILE.h - 66, '', textStyle(16, '#ffffff', { wordWrap: { width: TILE.w - 80 }, lineSpacing: 3 }));
  const introText = fitBlock(intro, TILE.w - 80, 46, view.event.intro).text;
  layers.front.add(intro);
  typeOut(ctx, intro, introText);
  const titleBg = scene.add.graphics();
  const title = fitLine(scene.add.text(TILE.x + 40, TILE.y - 14, view.event.name, textStyle(16, '#3a8ad8')).setOrigin(0, 0.5), 420, 10);
  titleBg.fillStyle(0xffffff, 1).fillRoundedRect(TILE.x + 24, TILE.y - 30, title.width + 32, 32, 16);
  titleBg.lineStyle(2, 0xb5c8d8, 1).strokeRoundedRect(TILE.x + 24, TILE.y - 30, title.width + 32, 32, 16);
  layers.front.add([titleBg, title]);
  layers.front.add(fitLine(scene.add.text(TILE.x + TILE.w - 30, TILE.y + 18, `${view.event.group}  ·  ${view.event.rarity.toUpperCase()}`, textStyle(11, '#ffffff', { backgroundColor: '#3a8ad8', padding: { x: 8, y: 3 } })).setOrigin(1, 0), 360, 8));

  // Shelf with channel capsules.
  const shelf = scene.add.graphics();
  shelf.fillGradientStyle(0xe9eef3, 0xe9eef3, 0xcfd8e2, 0xcfd8e2, 1).fillRect(0, SHELF_Y, GAME_WIDTH, GAME_HEIGHT - SHELF_Y);
  shelf.fillStyle(0x9fd4ff, 1).fillRect(0, SHELF_Y, GAME_WIDTH, 3);
  back.add(shelf);
  const n = view.choices.length;
  const gap = 18;
  const cw = Math.min(260, Math.floor((GAME_WIDTH - 60 - (n - 1) * gap) / n));
  const ch = 90;
  const span = n * cw + (n - 1) * gap;
  const capY = SHELF_Y + 22 + ch / 2;
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const x = (GAME_WIDTH - span) / 2 + cw / 2 + i * (cw + gap);
    const w = scene.add.container(x, capY);
    const col = choiceColor(c);
    const g = scene.add.graphics();
    const paint = (on: boolean) => {
      g.clear();
      g.fillStyle(0x3c6488, 0.25).fillRoundedRect(-cw / 2 + 2, -ch / 2 + 5, cw, ch, ch / 2);
      g.fillGradientStyle(0xffffff, 0xffffff, 0xe6eef6, 0xe6eef6, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
      if (on) g.lineStyle(8, WII_BLUE, 0.3).strokeRoundedRect(-cw / 2 - 4, -ch / 2 - 4, cw + 8, ch + 8, ch / 2 + 4);
      g.lineStyle(on ? 4 : 3, on ? WII_BLUE : 0xc3d2e0, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
    };
    paint(false);
    w.add(g);
    w.add(scene.add.circle(0, -ch / 2 + 18, 6, col).setStrokeStyle(2, 0xffffff));
    w.add(fitLine(scene.add.text(0, -6, c.label, textStyle(15, c.locked ? '#9aa8b6' : GREY)).setOrigin(0.5), cw - 40, 10));
    w.add(fitLine(scene.add.text(0, 18, c.locked ? `🔒 ${c.locked}` : choiceTag(c), textStyle(11, c.locked ? '#c05050' : '#7a8a9a')).setOrigin(0.5), cw - 40, 8));
    hitZone(ctx, w, cw, ch, i, hooks);
    layers.front.add(w);
    if (!calm) {
      w.setScale(0);
      scene.tweens.add({ targets: w, scale: 1, duration: 420, delay: 300 + i * 110, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        paint(on);
        scene.tweens.killTweensOf(w);
        if (calm) w.setScale(1).setY(capY);
        else scene.tweens.add({ targets: w, scale: on ? 1.06 : 1, y: capY - (on ? 6 : 0), duration: 260, ease: 'Back.easeOut' });
      },
    };
  });
  const clock = new Date();
  layers.front.add(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 6, `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`, textStyle(14, '#9aaaba')).setOrigin(0.5, 1));
  const risk = scene.add.text(24, GAME_HEIGHT - 6, '', textStyle(11, '#6a7a8a')).setOrigin(0, 1).setName('event-risk');
  layers.front.add(risk);

  return {
    widgets,
    moneyAt: { x: GAME_WIDTH - 172, y: GAME_HEIGHT - 44 },
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(risk, GAME_WIDTH / 2 - 70, 8, [d.odds, d.risk.split('\n')[0], d.cost].filter(Boolean).join('  ·  '));
    },
    picked: (i) => {
      const cap = widgets[i]!.box;
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j !== i) scene.tweens.add({ targets: w.box, alpha: 0.3, scale: 0.94, duration: calm ? 1 : 200 });
      });
      if (calm) {
        playDiscInsert(scene);
        return 10;
      }
      // A disc with the choice printed on it rises from the capsule, flies to the slot and slides in.
      const disc = scene.add.container(cap.x, cap.y).setDepth(26).setScale(0.2);
      const dg = scene.add.graphics();
      dg.fillStyle(0xd8dee6, 1).fillCircle(0, 0, 64);
      for (const [r, c2, a] of [
        [60, 0xffffff, 0.9],
        [52, 0xb8e0ff, 0.5],
        [44, 0xffd8f0, 0.45],
        [36, 0xd8ffe0, 0.45],
      ] as const)
        dg.lineStyle(6, c2, a).strokeCircle(0, 0, r);
      dg.fillStyle(0xffffff, 0.55).slice(0, 0, 62, -2.4, -1.6, false).fillPath();
      dg.fillStyle(0xf1f5f9, 1).fillCircle(0, 0, 12);
      dg.lineStyle(2, 0xb5c8d8, 1).strokeCircle(0, 0, 64).strokeCircle(0, 0, 12);
      disc.add(dg);
      disc.add(fitLine(scene.add.text(0, 30, view.choices[i]!.label, textStyle(10, '#3a8ad8')).setOrigin(0.5), 84, 7));
      disc.add(scene.add.circle(0, -34, 5, choiceColor(view.choices[i]!)));
      scene.tweens.add({ targets: cap, scale: 1.12, duration: 140, yoyo: true });
      scene.tweens.add({
        targets: disc,
        scale: 1,
        y: cap.y - 150,
        duration: 380,
        ease: 'Back.easeOut',
        onComplete: () => {
          scene.tweens.add({ targets: disc, angle: 360, duration: 700, ease: 'Sine.easeInOut' });
          scene.tweens.add({
            targets: disc,
            x: SLOT.x - 60,
            y: SLOT.y + SLOT.h / 2,
            scale: 0.9,
            duration: 520,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
              // Edge-on into the slot.
              scene.tweens.add({ targets: disc, scaleX: 0.04, x: SLOT.x, duration: 220, ease: 'Quad.easeIn' });
              scene.tweens.add({ targets: disc, alpha: 0, duration: 180, delay: 160, onComplete: () => disc.destroy() });
              playDiscInsert(scene);
              slotLight.setFillStyle(WII_BLUE, 1);
              scene.tweens.add({ targets: slotLight, scale: 2.4, duration: 160, yoyo: true, repeat: 2 });
              const flash = scene.add.rectangle(TILE.x, TILE.y, TILE.w, TILE.h, 0xffffff, 0).setOrigin(0).setDepth(24);
              scene.tweens.add({ targets: flash, fillAlpha: 0.85, duration: 260, delay: 300, yoyo: true, onComplete: () => flash.destroy() });
            },
          });
        },
      });
      return 1700;
    },
  };
};
