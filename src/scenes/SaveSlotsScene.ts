// Save Slots (spec §14): three independent saves. Each card shows the trainer, run status, region and stage,
// party, progress and save time. Enter loads a slot (or starts fresh in an empty one); → reaches Delete, which asks
// first and keeps a copy. Nothing here writes to a slot you only look at.

import Phaser from 'phaser';
import { slotCard, stampText, type SlotCard } from '../core/presentation/slotLines';
import { lookSpecies } from '../core/pokemon';
import type { SlotNumber, SlotPeek } from '../save/saveManager';
import { services } from '../game/services';
import { AERO, drawGlass, bounceIn, type MotionLevel } from '../ui/aero';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { preloadPokemon } from '../ui/lazyAssets';
import { pokemonIcon } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { sceneForRun } from './routing';

const CARD_X = 60;
const CARD_W = GAME_WIDTH - 120;
const CARD_H = 124;
const TOP = 70;
const GAP = 12;

export class SaveSlotsScene extends Phaser.Scene {
  private cards: SlotCard[] = [];
  private peeks: SlotPeek[] = [];
  private focus = 0;
  private onDelete = false;
  private confirm: Menu | null = null;
  private overlay: Phaser.GameObjects.Container | null = null;
  private rings: Phaser.GameObjects.Graphics[] = [];
  private deleteTexts: Phaser.GameObjects.Text[] = [];
  private note: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('SaveSlots');
  }

  preload(): void {
    const { session } = services();
    const species = new Set(session.slotPeeks().flatMap((p) => (p.run.status === 'ok' ? p.run.data.party : []).slice(0, 6)));
    preloadPokemon(this, [...species].map((m) => lookSpecies(session.content, m)), { icon: true });
  }

  create(data?: { focus?: number; notice?: string }): void {
    const { session } = services();
    const motion = session.settings.battleAnimations as MotionLevel;
    this.peeks = session.slotPeeks();
    this.cards = this.peeks.map((p) => slotCard(session.content, p));
    this.focus = data?.focus ?? session.slot - 1;
    this.onDelete = false;
    this.confirm = null;
    this.overlay = null;
    this.rings = [];
    this.deleteTexts = [];

    this.add.text(GAME_WIDTH / 2, 30, 'Save Slots', textStyle(34, COLORS.textLight)).setOrigin(0.5);
    this.cards.forEach((card, i) => this.drawCard(card, i, motion));
    this.note = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 58, data?.notice ?? 'Each slot is its own profile and run. The run saves by itself at every checkpoint.', textStyle(16, '#f0e0a0', { align: 'center', wordWrap: { width: GAME_WIDTH - 80 } })).setOrigin(0.5, 0);
    this.add.text(16, GAME_HEIGHT - 22, '↑/↓ choose  ·  Enter load  ·  → Delete  ·  Esc back', textStyle(14, '#8a7f96'));
    this.paint();

    onInputAction(this, (a) => {
      if (this.confirm) return this.confirm.handle(a);
      if (a === 'up') this.move(-1);
      else if (a === 'down') this.move(1);
      else if (a === 'right' && this.cards[this.focus]!.status !== 'empty') this.setDelete(true);
      else if (a === 'left') this.setDelete(false);
      else if (a === 'confirm') this.onDelete ? this.askDelete(this.focus) : this.open(this.focus);
      else if (a === 'back') this.scene.start('MainMenu', { focus: 3 });
    });
  }

  private drawCard(card: SlotCard, i: number, motion: MotionLevel): void {
    const y = TOP + i * (CARD_H + GAP);
    const tint = card.status === 'active' ? AERO.sky : card.status === 'damaged' ? 0xc05050 : AERO.glass;
    const box = this.add.container(0, 0);
    box.add(drawGlass(this, CARD_X, y, CARD_W, CARD_H, { tint, alpha: card.status === 'empty' ? 0.6 : 0.92, glow: card.status === 'active', radius: 18 }));
    box.add(this.add.text(CARD_X + 24, y + 12, card.title, textStyle(26, card.status === 'empty' ? COLORS.textMuted : COLORS.textLight)));
    card.lines.forEach((line, k) => box.add(this.add.text(CARD_X + 24, y + 48 + k * 22, line, textStyle(k === 0 ? 18 : 16, k === 0 ? COLORS.text : COLORS.textMuted, { wordWrap: { width: CARD_W - 320 } }))));
    box.add(this.add.text(CARD_X + CARD_W - 24, y + 14, card.savedAt ? `Saved ${stampText(card.savedAt)}` : '', textStyle(14, COLORS.textMuted)).setOrigin(1, 0));
    const { session } = services();
    const peek = this.peeks[i]!;
    const party = peek.run.status === 'ok' ? peek.run.data.party : [];
    party.slice(0, 6).forEach((m, k) => {
      const species = lookSpecies(session.content, m);
      const x = CARD_X + CARD_W - 190 + (k % 3) * 56;
      const py = y + 56 + Math.floor(k / 3) * 44;
      try {
        box.add(pokemonIcon(this, species, x, py, 1.4));
      } catch {
        /* the icon is decoration only */
      }
    });
    const del = this.add.text(CARD_X + CARD_W - 24, y + CARD_H - 26, card.status === 'empty' ? '' : 'Delete', textStyle(16, '#f0a0a0')).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    del.on('pointerdown', () => !this.confirm && this.askDelete(i));
    this.deleteTexts.push(del);
    const ring = this.add.graphics();
    this.rings.push(ring);
    const hit = this.add.zone(CARD_X, y, CARD_W - 120, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => !this.confirm && ((this.focus = i), this.setDelete(false)));
    hit.on('pointerdown', () => !this.confirm && this.open(i));
    bounceIn(this, box, motion, i * 70);
  }

  private paint(): void {
    this.rings.forEach((ring, i) => {
      ring.clear();
      if (i !== this.focus) return;
      ring.lineStyle(3, this.onDelete ? 0xf08080 : 0xffe680, 1);
      ring.strokeRoundedRect(CARD_X - 2, TOP + i * (CARD_H + GAP) - 2, CARD_W + 4, CARD_H + 4, 18);
    });
    this.deleteTexts.forEach((t, i) => t.setColor(i === this.focus && this.onDelete ? '#ffffff' : '#f0a0a0').setText(this.cards[i]!.status === 'empty' ? '' : i === this.focus && this.onDelete ? '▶ Delete' : 'Delete'));
  }

  private move(step: number): void {
    this.focus = (this.focus + step + this.cards.length) % this.cards.length;
    this.onDelete = false;
    playSfx(this, 'ui.move', 0.4);
    this.paint();
  }

  private setDelete(on: boolean): void {
    this.onDelete = on;
    this.paint();
  }

  /** Loads the slot: a run in progress continues; otherwise the title screen opens on that slot. */
  private open(i: number): void {
    const { session } = services();
    const card = this.cards[i]!;
    if (card.status === 'damaged') return this.say(`Slot ${card.slot} is damaged. Delete it to start over (a copy is kept).`);
    session.switchSlot(card.slot as SlotNumber);
    if (session.canContinue) {
      const run = session.continueRun();
      return void this.scene.start(sceneForRun(run));
    }
    this.scene.start(card.status === 'empty' ? 'Hub' : 'MainMenu');
  }

  private say(text: string): void {
    this.note?.setText(text);
    playSfx(this, 'ui.error', 0.4);
  }

  private askDelete(i: number): void {
    const card = this.cards[i]!;
    if (card.status === 'empty') return;
    const box = this.add.container(0, 0).setDepth(50);
    box.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0));
    box.add(drawGlass(this, 200, 150, GAME_WIDTH - 400, 220, { tint: 0xc05050, alpha: 0.95, radius: 18 }));
    box.add(this.add.text(GAME_WIDTH / 2, 176, `Delete slot ${card.slot}?`, textStyle(28, COLORS.textLight)).setOrigin(0.5, 0));
    box.add(this.add.text(GAME_WIDTH / 2, 218, 'Its profile, run and history are removed from this slot. One backup copy is kept in browser storage.', textStyle(16, COLORS.text, { align: 'center', wordWrap: { width: GAME_WIDTH - 460 } })).setOrigin(0.5, 0));
    this.overlay = box;
    const close = () => {
      this.confirm?.destroy();
      this.confirm = null;
      this.overlay?.destroy();
      this.overlay = null;
    };
    this.confirm = new Menu(this, {
      x: 320,
      y: 290,
      options: [{ label: 'Keep it' }, { label: `Delete slot ${card.slot}` }],
      itemWidth: 320,
      itemHeight: 36,
      fontSize: 22,
      onSelect: (k) => {
        if (k === 0) return close();
        const result = services().session.deleteSlot(card.slot as SlotNumber);
        close();
        this.scene.restart({ focus: i, notice: result.ok ? `Slot ${card.slot} deleted (a backup copy was kept).` : `Could not delete: ${result.reason}` });
      },
      onBack: close,
    });
    this.confirm.container.setDepth(51);
  }
}
