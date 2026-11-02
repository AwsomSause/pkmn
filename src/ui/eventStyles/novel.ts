// Visual Novel (mock-up 05): big portraits on both sides over a dimmed location, a name plate,
// a dialogue box along the bottom and a slanted choice list in the middle.
import Phaser from 'phaser';
import { fitBlock, fitLine } from '../fitText';
import { loadAssets } from '../lazyAssets';
import { pokemonVisual, trainerVisual } from '../sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';
import { choiceColor, choiceTag, detailLines, drawArena, hex, hitZone, typeOut } from './common';
import type { ChoiceWidget, EventCtx, EventLayout } from './types';

const BOX = { x: 40, y: 404, w: GAME_WIDTH - 80, h: 120 };
const LIST_W = 440;
const LIST_X = (GAME_WIDTH - LIST_W) / 2;

/** "trainer.aroma_lady" -> "Aroma Lady". */
export function speakerName(id: string): string {
  const last = id.split('.').pop() ?? id;
  return last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A portrait that slides in from its side and breathes. */
function portrait(ctx: EventCtx, make: (x: number) => Phaser.GameObjects.GameObject, x: number, from: number): void {
  const { scene, calm, layers } = ctx;
  const o = make(calm ? x : from) as Phaser.GameObjects.Sprite;
  o.setOrigin?.(0.5, 1);
  layers.back.add(o);
  if (calm) return;
  scene.tweens.add({ targets: o, x, duration: 650, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: o, scaleY: o.scaleY * 1.015, duration: 1600, delay: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

export const novel: EventLayout = (ctx, hooks) => {
  const { scene, view, calm, layers } = ctx;
  const area = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
  drawArena(ctx, area, layers.back);
  ctx.dress(area);
  layers.back.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1e, 0.3).setOrigin(0).setName('event-frame'));

  // Portraits: the first person on the left; the Pokémon (or a second person) on the right.
  const [first, second] = ctx.castIds;
  const ground = BOX.y + 6;
  void loadAssets(scene, ctx.castIds).then(() => {
    if (!layers.back.active) return;
    if (first) portrait(ctx, (x) => trainerVisual(scene, first, '', x, ground, 3), 150, -200);
    if (second && !ctx.species) portrait(ctx, (x) => (trainerVisual(scene, second, '', x, ground, 3) as Phaser.GameObjects.Sprite).setFlipX(true), GAME_WIDTH - 150, GAME_WIDTH + 200);
  });
  if (ctx.species) {
    const sp = ctx.species;
    portrait(ctx, (x) => pokemonVisual(scene, sp, 'front', x, ground, 3), first ? GAME_WIDTH - 170 : 170, first ? GAME_WIDTH + 200 : -200);
  }

  // Dialogue box with a skewed name plate.
  const speaker = ctx.species?.name ?? (first ? speakerName(first) : view.event.name);
  const box = scene.add.container(0, calm ? 0 : 160);
  const g = scene.add.graphics();
  g.fillStyle(0x14182a, 0.92).fillRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 8);
  g.lineStyle(3, ctx.rim, 1).strokeRoundedRect(BOX.x, BOX.y, BOX.w, BOX.h, 8);
  box.add(g);
  const plate = scene.add.graphics();
  plate.fillStyle(ctx.rim, 1).fillPoints([new Phaser.Math.Vector2(BOX.x + 30, BOX.y - 24), new Phaser.Math.Vector2(BOX.x + 230, BOX.y - 24), new Phaser.Math.Vector2(BOX.x + 220, BOX.y + 4), new Phaser.Math.Vector2(BOX.x + 20, BOX.y + 4)], true);
  box.add(plate);
  box.add(fitLine(scene.add.text(BOX.x + 125, BOX.y - 10, speaker, textStyle(16, '#111111')).setOrigin(0.5), 180, 10));
  const intro = scene.add.text(BOX.x + 24, BOX.y + 18, '', textStyle(17, '#ffffff', { wordWrap: { width: BOX.w - 48 }, lineSpacing: 5 }));
  const introText = fitBlock(intro, BOX.w - 48, 62, view.event.intro).text;
  box.add(intro);
  typeOut(ctx, intro, introText);
  const risk = scene.add.text(BOX.x + 24, BOX.y + BOX.h - 26, '', textStyle(12, '#bfe9ff', { maxLines: 1 })).setName('event-risk');
  const odds = scene.add.text(BOX.x + BOX.w - 24, BOX.y + BOX.h - 26, '', textStyle(12, '#f8e8a0')).setOrigin(1, 0);
  box.add([risk, odds]);
  layers.front.add(box);
  if (!calm) scene.tweens.add({ targets: box, y: 0, duration: 480, ease: 'Back.easeOut' });
  layers.front.add(fitLine(scene.add.text(GAME_WIDTH - 24, 60, `${view.event.group}  ·  ${view.event.rarity.toUpperCase()}`, textStyle(12, '#ffffff', { stroke: '#101010', strokeThickness: 3 })).setOrigin(1, 0), 420, 9));
  layers.front.add(fitLine(scene.add.text(24, 20, view.event.name, textStyle(22, '#ffffff', { stroke: '#101010', strokeThickness: 4 })), 560, 12));

  // The slanted choice list.
  const n = view.choices.length;
  const rowH = 40;
  const top = (BOX.y - 30 - n * (rowH + 6)) / 2 + 40;
  const slant = (w: number, h: number, g2: Phaser.GameObjects.Graphics, fill: number, alpha: number) =>
    g2.fillStyle(fill, alpha).fillPoints([new Phaser.Math.Vector2(-w / 2 + 12, -h / 2), new Phaser.Math.Vector2(w / 2, -h / 2), new Phaser.Math.Vector2(w / 2 - 12, h / 2), new Phaser.Math.Vector2(-w / 2, h / 2)], true);
  const widgets: ChoiceWidget[] = view.choices.map((c, i) => {
    const y = top + i * (rowH + 6);
    const w = scene.add.container(LIST_X + LIST_W / 2, y);
    const col = choiceColor(c);
    const bg = scene.add.graphics();
    const paint = (on: boolean) => {
      bg.clear();
      slant(LIST_W, rowH, bg, on ? 0xffffff : 0x14182a, on ? 0.96 : 0.85);
      bg.fillStyle(col, 1).fillRect(-LIST_W / 2 + 4, -rowH / 2 + 2, 8, rowH - 4);
    };
    paint(false);
    w.add(bg);
    const label = fitLine(scene.add.text(-LIST_W / 2 + 24, 0, c.label, textStyle(16, c.locked ? '#8a8a9a' : '#ffffff')).setOrigin(0, 0.5), LIST_W - 110, 10);
    w.add(label);
    const tag = scene.add.text(LIST_W / 2 - 22, 0, choiceTag(c), textStyle(13, hex(col), { stroke: '#101010', strokeThickness: 3 })).setOrigin(1, 0.5);
    w.add(tag);
    hitZone(ctx, w, LIST_W, rowH, i, hooks);
    layers.front.add(w);
    if (!calm) {
      w.setAlpha(0).setX(LIST_X + LIST_W / 2 + (i % 2 ? 60 : -60));
      scene.tweens.add({ targets: w, alpha: 1, x: LIST_X + LIST_W / 2, duration: 340, delay: 500 + i * 90, ease: 'Back.easeOut' });
    }
    return {
      box: w,
      focus: (on) => {
        paint(on);
        label.setColor(on ? '#1a1a2a' : c.locked ? '#8a8a9a' : '#ffffff');
        scene.tweens.killTweensOf(w);
        const home = LIST_X + LIST_W / 2;
        if (calm) w.setScale(1).setAlpha(1).setX(home);
        else scene.tweens.add({ targets: w, scale: on ? 1.04 : 1, alpha: 1, x: home, duration: 260, ease: 'Back.easeOut' });
      },
    };
  });

  return {
    widgets,
    detail: (c) => {
      if (!c) return;
      const d = detailLines(c);
      fitLine(risk, BOX.w - 220, 9, [d.risk.split('\n')[0], d.cost].filter(Boolean).join('  ·  '));
      fitLine(odds, 180, 9, d.odds).setColor(c.locked ? '#f87870' : '#f8e8a0');
    },
    picked: (i) => {
      widgets.forEach((w, j) => {
        scene.tweens.killTweensOf(w.box);
        if (j === i) scene.tweens.add({ targets: w.box, scale: 1.12, alpha: 0, duration: calm ? 1 : 380, delay: 120, ease: 'Quad.easeIn' });
        else scene.tweens.add({ targets: w.box, alpha: 0, duration: calm ? 1 : 200 });
      });
      return calm ? 10 : 480;
    },
  };
};
