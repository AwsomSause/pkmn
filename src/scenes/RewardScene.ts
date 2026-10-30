// The five-choice reward draft. The player must take exactly one. Rewards for
// a single Pokémon (vitamins, Rare Candy) ask which party member gets them.
// Before choosing, the player can also use Bag items or change the lead.

import Phaser from 'phaser';
import { isRerollReward, rewardTargetProblem } from '../core/rewards';
import { draftItemUses, type DraftItemKind } from '../core/run';
import { services } from '../game/services';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { openBagMenu, openPartyMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { partyRows, Picker } from '../ui/partyPanel';
import { itemVisual, pokemonIcon } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, focusFrame } from '../ui/widgets';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';

export class RewardScene extends Phaser.Scene {
  /** 0..draft-1 are the cards; then the Party and Bag buttons. */
  private index = 0;
  /** A draft item waiting for the card it is used on (Cornn Berry re-roll, Lock Capsule). */
  private mode: DraftItemKind | null = null;
  private cursors: Phaser.GameObjects.Graphics[] = [];
  private picker: Picker | null = null;
  private notice: Phaser.GameObjects.Text | null = null;
  private chosen = false;

  constructor() {
    super('Reward');
  }

  preload(): void {
    preloadPokemon(this, partySpecies(), { icon: true });
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const draft = run.draft!;
    this.index = 0;
    this.mode = null;
    this.cursors = [];
    this.picker = null;
    this.chosen = false;

    this.add.text(GAME_WIDTH / 2, 30, 'Choose one reward', textStyle(44, COLORS.textLight)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 66, `Encounter ${run.encountersCompleted} cleared  ·  ₽${run.money}  ·  Candies ${run.candies}`, textStyle(20, '#a69cb4'))
      .setOrigin(0.5);

    const gap = 12;
    // Dowsing Machine and Bloom Mail add choices; the cards shrink to fit.
    const cardW = Math.min(172, Math.floor((GAME_WIDTH - 52 - gap * (draft.length - 1)) / draft.length));
    const startX = (GAME_WIDTH - (cardW * draft.length + gap * (draft.length - 1))) / 2;
    draft.forEach((rewardId, i) => {
      const reward = content.rewards.get(rewardId)!;
      const x = startX + i * (cardW + gap);
      const y = 92;
      const rarityColor = COLORS.rarity[reward.rarity] ?? 0x808080;
      drawPanel(this, x, y, cardW, 270, { border: rarityColor });
      this.cursors.push(this.highlight(x, y, cardW, 270));
      itemVisual(this, reward.iconAssetId, x + cardW / 2, y + 46, 2.5);
      this.add.text(x + cardW / 2, y + 84, reward.name, textStyle(24, COLORS.text, { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0);
      this.add
        .text(x + cardW / 2, y + 118, reward.rarity.toUpperCase(), textStyle(16, Phaser.Display.Color.IntegerToColor(rarityColor).rgba))
        .setOrigin(0.5, 0);
      // A team or player item already at its max: picking it re-rolls the draft for free.
      const reroll = isRerollReward(content, run, reward);
      this.add.text(x + 12, y + 144, reroll ? 'You already have the most of this. Pick it for a free re-roll!' : reward.description, textStyle(17, reroll ? '#f0e0a0' : COLORS.textMuted, { wordWrap: { width: cardW - 24 } }));
      if ((run.draftCarry ?? []).includes(rewardId)) this.add.text(x + cardW / 2, y + 236, 'Locked: in the next draft too', textStyle(14, '#f0e0a0', { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0);
      this.clickZone(x, y, cardW, 270, i);
    });

    // Party strip, with buttons to manage the party and use items.
    drawPanel(this, 40, 380, GAME_WIDTH - 80, 112, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
    run.party.forEach((mon, i) => {
      const species = content.species.get(mon.speciesId)!;
      const x = 80 + i * 92;
      pokemonIcon(this, species, x, 412, 1.5);
      this.add.text(x, 440, `Lv${mon.level}`, textStyle(16, COLORS.textLight)).setOrigin(0.5, 0);
      this.add.text(x, 458, mon.hp <= 0 ? 'FNT' : `${mon.hp} HP`, textStyle(16, mon.hp <= 0 ? '#f08080' : '#a0e0a0')).setOrigin(0.5, 0);
      if (i === 0) this.add.text(x, 384, 'LEAD', textStyle(12, '#f0c028')).setOrigin(0.5, 0);
    });
    // Party and Bag under the party strip; the draft items' buttons at the top right, beside the title.
    const rerolls = draftItemUses(content, run, 'reroll');
    const locks = draftItemUses(content, run, 'lock');
    const buttons: { label: string; x: number; y: number; w: number; h: number; size: number; act: () => void }[] = [
      { label: 'Party', x: 680, y: 404, w: 104, h: 64, size: 26, act: () => this.openParty() },
      { label: 'Bag', x: 800, y: 404, w: 104, h: 64, size: 26, act: () => this.openBag() },
    ];
    if (rerolls > 0) buttons.push({ label: `Re-roll ×${rerolls}`, x: 0, y: 12, w: 100, h: 44, size: 18, act: () => this.startMode('reroll', 'Choose the card to swap for a new one (Cornn Berry).') });
    if (locks > 0) buttons.push({ label: `Lock ×${locks}`, x: 0, y: 12, w: 100, h: 44, size: 18, act: () => this.startMode('lock', 'Choose the card to keep in the next draft too (Lock Capsule).') });
    buttons.slice(2).forEach((b, n, extra) => (b.x = GAME_WIDTH - 40 - (extra.length - n) * 112 + 12));
    buttons.forEach((b, n) => {
      drawPanel(this, b.x, b.y, b.w, b.h, { fill: COLORS.panel });
      this.add.text(b.x + b.w / 2, b.y + b.h / 2, b.label, textStyle(b.size)).setOrigin(0.5);
      this.cursors.push(this.highlight(b.x, b.y, b.w, b.h));
      this.clickZone(b.x, b.y, b.w, b.h, draft.length + n);
    });
    this.buttons = buttons;

    this.notice = this.add.text(GAME_WIDTH / 2, 508, data.notice ?? '', textStyle(18, '#f0e0a0')).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 528, '←/→ ↑/↓ move  ·  Enter choose', textStyle(14, '#a69cb4')).setOrigin(0.5);
    this.focus(data.focus ?? 0, false);

    onInputAction(this, (action) => {
      if (this.picker) {
        this.picker.handle(action);
        return;
      }
      if (this.chosen) return;
      const cards = draft.length;
      const total = cards + buttons.length;
      if (action === 'left') this.focus((this.index + total - 1) % total);
      if (action === 'right') this.focus((this.index + 1) % total);
      if (action === 'down' && this.index < cards) this.focus(cards);
      if (action === 'up' && this.index >= cards) this.focus(0);
      if (action === 'confirm') this.activate(this.index);
      if (action === 'back' && this.mode) {
        this.mode = null;
        this.notice?.setText('');
      }
    });
  }

  private buttons: { label: string; act: () => void }[] = [];

  private startMode(mode: DraftItemKind, hint: string): void {
    this.mode = mode;
    this.notice?.setText(hint);
    this.focus(0);
  }

  private highlight(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    return focusFrame(this, x, y, w, h);
  }

  private clickZone(x: number, y: number, w: number, h: number, index: number): void {
    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => !this.picker && this.focus(index));
    hit.on('pointerdown', () => {
      if (this.picker || this.chosen) return;
      this.focus(index);
      this.activate(index);
    });
  }

  private focus(i: number, sound = true): void {
    if (sound && i !== this.index) playSfx(this, 'ui.select', 0.5);
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
  }

  private activate(i: number): void {
    const draft = services().session.run!.draft!;
    if (i < draft.length && this.mode) {
      const { message } = services().session.useDraftItem(this.mode, i);
      playSfx(this, 'ui.select');
      this.restart(message);
    } else if (i < draft.length) this.pickReward(i);
    else this.buttons[i - draft.length]?.act();
  }

  private closePicker(): void {
    this.picker?.close();
    this.picker = null;
  }

  private restart(notice: string): void {
    this.scene.restart({ notice, focus: this.index });
  }

  private pickReward(draftIndex: number): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const reward = content.rewards.get(run.draft![draftIndex]!)!;
    if (reward.scope !== 'pokemon' || run.party.length === 1 || isRerollReward(content, run, reward)) {
      const problem = rewardTargetProblem(content, run, reward, 0);
      if (problem) {
        playSfx(this, 'ui.error');
        this.notice?.setText(problem);
        return;
      }
      this.choose(draftIndex, 0);
      return;
    }
    this.picker = new Picker(this, {
      title: `Give the ${reward.name} to which Pokémon?`,
      columns: 2,
      rowHeight: 78,
      rows: partyRows(content, run.party, (i) => rewardTargetProblem(content, run, reward, i)),
      onSelect: (i) => {
        this.closePicker();
        this.choose(draftIndex, i);
      },
      onBack: () => this.closePicker(),
    });
  }

  private fieldHost(): FieldMenuHost {
    return { scene: this, setPicker: (p) => (this.picker = p), changed: (notice) => this.restart(notice) };
  }

  private openParty(): void {
    openPartyMenu(this.fieldHost());
  }

  private openBag(): void {
    openBagMenu(this.fieldHost());
  }

  private choose(draftIndex: number, targetIndex: number): void {
    if (this.chosen) return;
    this.chosen = true;
    const result = services().session.chooseReward(draftIndex, targetIndex);
    if (result.reward.reroll) {
      playSfx(this, 'ui.select');
      this.scene.restart({ notice: result.reward.messages.join(' '), focus: 0 });
      return;
    }
    playSfx(this, 'se.level_up', 0.6);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setDepth(50);
    const next = result.run.phase === 'map' ? 'Choose your next path…' : '';
    this.add
      .text(GAME_WIDTH / 2, 250, [...result.reward.messages, '', next].join('\n'), textStyle(28, COLORS.textLight, { align: 'center', wordWrap: { width: GAME_WIDTH - 120 } }))
      .setOrigin(0.5)
      .setDepth(51);
    this.time.delayedCall(1500, () => this.scene.start(sceneForRun(result.run)));
  }
}
