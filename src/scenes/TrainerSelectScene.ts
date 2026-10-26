// Choose a trainer archetype. The selected trainer fills the left side (sprite,
// pros and cons, the types they favour, a summary); every trainer sits in a grid
// on the right. Locked trainers show as a "?" silhouette that tells you how to
// unlock them.

import Phaser from 'phaser';
import type { Archetype } from '../core/contentSchema';
import { trainerStatus, type TrainerStatus } from '../core/progress';
import { services } from '../game/services';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { ArenaBackdrop } from '../ui/showcase';
import { trainerVisual, type Visual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TYPE_COLORS, textStyle } from '../ui/theme';
import { badge, focusFrame, paintWindow } from '../ui/widgets';

const COLS = 4;
const ROWS = 3;
const GRID_X = 356;
const GRID_Y = 18;
const CELL_W = 140;
const CELL_H = 156;
const GAP = 8;
const LEFT_W = 324;

type Slot = { archetype: Archetype; status: TrainerStatus } | null;

export class TrainerSelectScene extends Phaser.Scene {
  private index = 0;
  private slots: Slot[] = [];
  private frames: Phaser.GameObjects.Graphics[] = [];
  private cells: Phaser.GameObjects.Container[] = [];
  private profileLayer!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  private notice!: Phaser.GameObjects.Text;

  constructor() {
    super('TrainerSelect');
  }

  create(): void {
    const { session } = services();
    const p = session.profile;
    this.index = 0;
    this.frames = [];
    this.cells = [];
    // Every trainer, in data order (Red first), then empty slots for trainers still to come.
    this.slots = [...session.content.archetypes.values()].map((a) => ({ archetype: a, status: trainerStatus(p, a) }));
    while (this.slots.length < COLS * ROWS) this.slots.push(null);

    new ArenaBackdrop(this, { dim: 0.55 });

    this.slots.forEach((slot, i) => this.buildCell(slot, i));
    this.profileLayer = this.add.container(0, 0);
    this.tooltip = this.add.container(0, 0).setDepth(40).setVisible(false);
    this.notice = this.add.text(16 + LEFT_W / 2, GAME_HEIGHT - 50, '', textStyle(16, COLORS.bad, { align: 'center', wordWrap: { width: LEFT_W - 24 } })).setOrigin(0.5, 1).setDepth(5);
    this.add.text(GRID_X, GAME_HEIGHT - 14, 'Arrows choose  ·  Enter confirm  ·  Esc back', textStyle(14, COLORS.textMuted)).setOrigin(0, 1);
    this.focus(0, false);

    onInputAction(this, (action) => {
      const n = this.slots.length;
      if (action === 'left') this.focus((this.index + n - 1) % n);
      if (action === 'right') this.focus((this.index + 1) % n);
      if (action === 'up') this.focus((this.index + n - COLS) % n);
      if (action === 'down') this.focus((this.index + COLS) % n);
      if (action === 'confirm') this.choose();
      if (action === 'back') this.scene.start('Hub');
    });
  }

  private cellPos(i: number): { x: number; y: number } {
    return { x: GRID_X + (i % COLS) * (CELL_W + GAP), y: GRID_Y + Math.floor(i / COLS) * (CELL_H + GAP) };
  }

  private buildCell(slot: Slot, i: number): void {
    const { x, y } = this.cellPos(i);
    const cell = this.add.container(x, y);
    const open = slot?.status === 'unlocked';
    cell.add(paintWindow(this.add.graphics(), 0, 0, CELL_W, CELL_H, { thin: true, fill: open ? 0x2f2838 : 0x1f1b25, border: open ? COLORS.borderMuted : 0x3f3848, alpha: 0.94 }));
    // A soft spotlight under the trainer's feet.
    const glow = this.add.graphics();
    glow.fillStyle(open ? 0x4a3f5c : 0x2a2431, 1);
    glow.fillEllipse(CELL_W / 2, CELL_H - 30, 96, 18);
    cell.add(glow);
    if (slot) {
      const sprite = this.fitSprite(trainerVisual(this, slot.archetype.spriteAssetId, slot.archetype.name, CELL_W / 2, CELL_H - 26, 1), CELL_H - 44);
      if (!open && sprite instanceof Phaser.GameObjects.Sprite) sprite.setTintFill(0x141118);
      cell.add(sprite);
      if (open) cell.add(this.add.text(CELL_W / 2, 8, slot.archetype.name, textStyle(18)).setOrigin(0.5, 0));
    }
    if (!open) {
      cell.add(this.add.text(CELL_W / 2, CELL_H / 2 - 8, '?', textStyle(64, COLORS.textLight)).setOrigin(0.5));
      if (slot?.status === 'claimable') cell.add(this.add.text(CELL_W / 2, 8, 'Ready to claim!', textStyle(14, COLORS.gold)).setOrigin(0.5, 0));
    }
    const frame = focusFrame(this, 0, 0, CELL_W, CELL_H).setVisible(false);
    this.frames.push(frame);
    const zone = this.add.zone(0, 0, CELL_W, CELL_H).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.focus(i);
      this.showTooltip(i);
    });
    zone.on('pointerout', () => this.tooltip.setVisible(false));
    zone.on('pointerdown', () => {
      this.focus(i, false);
      this.choose();
    });
    cell.add([frame, zone]);
    this.cells.push(cell);
  }

  /** Scales a trainer picture so it fits a height (boss portraits come in many sizes). */
  private fitSprite(v: Visual, maxH: number): Visual {
    if (v instanceof Phaser.GameObjects.Sprite) v.setScale(Math.min(2, maxH / v.height));
    return v;
  }

  private focus(i: number, sound = true): void {
    if (sound && i !== this.index) playSfx(this, 'ui.select', 0.5);
    this.index = i;
    this.frames.forEach((f, n) => f.setVisible(n === i));
    this.cells.forEach((c, n) => {
      const { y } = this.cellPos(n);
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, y: n === i ? y - 4 : y, duration: 140, ease: 'Cubic.easeOut' });
    });
    const focused = this.cells[i];
    if (focused) this.children.bringToTop(focused);
    this.notice.setText('');
    this.drawProfile(this.slots[i] ?? null);
  }

  private drawProfile(slot: Slot): void {
    this.profileLayer.removeAll(true);
    const L = this.profileLayer;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => (L.add(o), o);
    add(paintWindow(this.add.graphics(), 16, 18, LEFT_W, GAME_HEIGHT - 36, { alpha: 0.95 }));
    const cx = 16 + LEFT_W / 2;
    if (!slot) {
      add(this.add.text(cx, 40, '???', textStyle(40)).setOrigin(0.5, 0));
      add(this.add.text(cx, 260, 'More trainers are on the way in later updates.', textStyle(20, COLORS.textMuted, { align: 'center', wordWrap: { width: LEFT_W - 40 } })).setOrigin(0.5, 0));
      return;
    }
    const a = slot.archetype;
    const open = slot.status === 'unlocked';
    add(this.add.text(36, 30, open ? a.name : '???', textStyle(40)));
    add(this.add.text(38, 76, open ? a.title : statusLine(slot.status), textStyle(16, COLORS.gold)));

    // The trainer on a spotlight.
    const glow = add(this.add.graphics());
    glow.fillStyle(0x4a3f5c, 1);
    glow.fillEllipse(cx, 232, 170, 28);
    glow.fillStyle(0x5c4f70, 1);
    glow.fillEllipse(cx, 232, 120, 18);
    const sprite = this.fitSprite(trainerVisual(this, a.spriteAssetId, a.name, cx, 236, 2), 140);
    if (!open && sprite instanceof Phaser.GameObjects.Sprite) sprite.setTintFill(0x141118);
    add(sprite);
    if (open) {
      sprite.setAlpha(0);
      this.tweens.add({ targets: sprite, alpha: 1, duration: 200 });
    }

    let y = 258;
    const section = (label: string, lines: string[], color: string) => {
      add(this.add.text(36, y, label, textStyle(20, color)));
      y += 22;
      for (const line of lines) {
        const t = add(this.add.text(44, y, line, textStyle(16, COLORS.textLight, { wordWrap: { width: LEFT_W - 52 } })));
        y += t.height + 2;
      }
      y += 6;
    };
    if (open) {
      section('Pros', a.pros, COLORS.good);
      section('Cons', a.cons, COLORS.bad);
      const { strong, weak } = typeEffects(a);
      if (strong.length + weak.length > 0) {
        let bx = 36;
        for (const [type, up] of [...strong.map((t) => [t, true] as const), ...weak.map((t) => [t, false] as const)]) {
          const b = add(badge(this, bx, y, `${up ? '+' : '−'}${type}`, TYPE_COLORS[type] ?? 0x808080, 14));
          bx += b.width + 6;
        }
        y += 30;
      }
      const summary = add(this.add.text(36, y, a.description, textStyle(16, COLORS.textMuted, { wordWrap: { width: LEFT_W - 44 } })));
      y += summary.height + 12;
      // This trainer's record from past runs.
      const runs = services().session.profile.runHistory.filter((r) => r.archetypeId === a.id);
      const best = runs.reduce((m, r) => Math.max(m, r.regionsCleared), 0);
      const wins = runs.filter((r) => r.victory).length;
      add(this.add.text(36, y, 'Record', textStyle(20, COLORS.gold)));
      add(this.add.text(44, y + 24, runs.length === 0 ? 'No runs yet' : `${runs.length} run${runs.length === 1 ? '' : 's'}  ·  ${wins} won  ·  best ${best} region${best === 1 ? '' : 's'}`, textStyle(16)));
    } else {
      const how = slot.status === 'comingLater' ? `${a.name} arrives in a later update.` : `How to unlock: ${a.unlockText}${a.unlockCost ? `, then ${a.unlockCost} Bank Credits in the Trainer Archive` : ''}.`;
      add(this.add.text(36, y, how, textStyle(20, COLORS.textLight, { wordWrap: { width: LEFT_W - 44 } })));
    }
  }

  /** On hover: the trainer's name and short list, or how to unlock them. */
  private showTooltip(i: number): void {
    const slot = this.slots[i];
    this.tooltip.removeAll(true);
    const lines = !slot
      ? ['More trainers coming soon']
      : slot.status === 'unlocked'
        ? [`${slot.archetype.name}  ·  ${slot.archetype.title}`, ...slot.archetype.pros.map((x) => `+ ${x}`), ...slot.archetype.cons.map((x) => `− ${x}`)]
        : [slot.status === 'comingLater' ? 'Coming in a later update' : `Unlock: ${slot.archetype.unlockText}`];
    const text = this.add.text(12, 10, lines.join('\n'), textStyle(16, COLORS.textLight, { wordWrap: { width: 236 }, lineSpacing: 2 }));
    const w = 260;
    const h = text.height + 20;
    const { x, y } = this.cellPos(i);
    const tx = Phaser.Math.Clamp(x + CELL_W / 2 - w / 2, GRID_X, GAME_WIDTH - w - 8);
    const ty = y + CELL_H + 4 + h > GAME_HEIGHT ? y - h - 4 : y + CELL_H + 4;
    this.tooltip.add(paintWindow(this.add.graphics(), 0, 0, w, h, { thin: true, fill: 0x18141d, border: COLORS.accent }));
    this.tooltip.add(text);
    this.tooltip.setPosition(tx, ty).setVisible(true);
  }

  private choose(): void {
    const slot = this.slots[this.index];
    if (!slot || slot.status !== 'unlocked') {
      playSfx(this, 'ui.error', 0.5);
      this.notice.setText(!slot ? 'That trainer has not arrived yet.' : slot.status === 'claimable' ? 'Claim this trainer in the Hub\'s Trainer Archive first.' : 'This trainer is still locked.');
      return;
    }
    // The Preparation Desk picks up ?seed=... and ?campaign=dev from the address.
    this.scene.start('RunPrep', { archetypeId: slot.archetype.id });
  }
}

function statusLine(status: TrainerStatus): string {
  return status === 'claimable' ? 'Ready to claim in the Trainer Archive' : status === 'comingLater' ? 'Coming later' : 'Locked';
}

/** Types a trainer boosts or weakens, read from their modifiers. */
function typeEffects(a: Archetype): { strong: string[]; weak: string[] } {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const m of a.modifiers) {
    if (m.kind === 'typeDamageMultiplier') (m.value >= 1 ? strong : weak).push(m.type);
    if (m.kind === 'weaknessDamageTakenMultiplier') (m.value > 1 ? weak : strong).push(m.type);
  }
  return { strong, weak };
}
