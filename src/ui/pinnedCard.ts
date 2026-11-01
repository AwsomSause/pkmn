// A pinned Pokémon card (I471): a small draggable overlay that stays on its screen while other menus open.
// Presentation only: it shows a snapshot of text lines.

import Phaser from 'phaser';
import { COLORS, textStyle } from './theme';
import { AERO } from './aero';

const pinned = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();

export function pinCard(scene: Phaser.Scene, lines: string[]): void {
  pinned.get(scene)?.destroy();
  const label = scene.add.text(10, 8, lines.join('\n'), textStyle(16, COLORS.text, { lineSpacing: 2 }));
  const w = Math.max(150, label.width + 20);
  const h = label.height + 38;
  const back = scene.add.rectangle(0, 0, w, h, AERO.glass, 0.92).setOrigin(0).setStrokeStyle(2, AERO.rim);
  const x = scene.add.text(w - 8, 4, '✕', textStyle(16, COLORS.gold)).setOrigin(1, 0).setInteractive({ useHandCursor: true });
  const hint = scene.add.text(10, h - 22, 'drag to move', textStyle(13, COLORS.textMuted));
  const box = scene.add.container(700, 90, [back, label, x, hint]).setDepth(24000).setData('noJuice', true).setName('pinned-card');
  box.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  scene.input.setDraggable(box);
  box.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => box.setPosition(dragX, dragY));
  x.on('pointerdown', () => { box.destroy(); pinned.delete(scene); });
  scene.events.once('shutdown', () => pinned.delete(scene));
  pinned.set(scene, box);
}
