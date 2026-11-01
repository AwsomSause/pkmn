// The five-choice reward draft. The player must take exactly one. Rewards for
// a single Pokémon (vitamins, Rare Candy) ask which party member gets them.
// Before choosing, the player can also use Bag items or change the lead.

import Phaser from 'phaser';
import { rewardSynergy } from '../core/rewardSynergy';
import { compareReward } from '../core/rewardCompare';
import { isRerollReward, rewardTargetProblem } from '../core/rewards';
import { draftItemUses, type DraftItemKind } from '../core/run';
import { services } from '../game/services';
import { playSfx, playSfxLazy } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { openBagMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { openPokemonMenu } from '../ui/pokemonMenu';
import { partyRows, Picker, type PickerLike } from '../ui/partyPanel';
import { itemVisual, pokemonIcon } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { focusFrame } from '../ui/widgets';
import { AERO, drawGlass, paintGlass, type MotionLevel } from '../ui/aero';
import { burstReveal } from '../ui/battleFx/spectacle';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';
import { revealPop } from '../ui/wiiMotion';

export class RewardScene extends Phaser.Scene {
  /** False for the first 220 ms of game time, while a held key could still pick a card (tests wait for it). */
  inputReady = false;
  /** 0..draft-1 are the cards; then the Party and Bag buttons. */
  private index = 0;
  /** A draft item waiting for the card it is used on (Cornn Berry re-roll, Lock Capsule). */
  private mode: DraftItemKind | null = null;
  private cursors: Phaser.GameObjects.Graphics[] = [];
  /** Each reward card, so the focused one can lift and the chosen one fly off. */
  private cards: Phaser.GameObjects.Container[] = [];
  private cardY = 92;
  private picker: PickerLike | null = null;
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
    this.cards = [];

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
      const y = this.cardY;
      const rarityColor = COLORS.rarity[reward.rarity] ?? 0x808080;
      // A glass card with a rarity-coloured rim; its contents move with it (lift on focus, fly off when chosen).
      const card = this.add.container(x + cardW / 2, y + 135);
      const glow = this.add.graphics().setVisible(false);
      glow.fillStyle(rarityColor, 0.28);
      glow.fillRoundedRect(-cardW / 2 - 8, -143, cardW + 16, 286, 24);
      card.add([glow, paintGlass(this.add.graphics(), -cardW / 2, -135, cardW, 270, { rim: rarityColor, radius: 18 })]);
      this.cursors.push(glow);
      // Reward presentation (spec §24): the item pops out of its card with a little wobble.
      const icon = itemVisual(this, reward.iconAssetId, 0, -89, 2.5) as Phaser.GameObjects.Image;
      card.add(icon);
      revealPop(this, icon, 120 + i * 70);
      card.add(this.add.text(0, -51, reward.name, textStyle(24, COLORS.text, { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0));
      card.add(this.add.text(0, -17, reward.rarity.toUpperCase(), textStyle(16, Phaser.Display.Color.IntegerToColor(rarityColor).rgba)).setOrigin(0.5, 0));
      // A team or player item already at its max: picking it re-rolls the draft for free.
      const reroll = isRerollReward(content, run, reward);
      card.add(this.add.text(-cardW / 2 + 12, 9, reroll ? 'You already have the most of this. Pick it for a free re-roll!' : reward.description, textStyle(17, reroll ? '#f0e0a0' : '#cfe0f0', { wordWrap: { width: cardW - 24 } })));
      const cmp = compareReward(content, run, reward);
      if (cmp) card.add(this.add.text(0, 84, `Now ${cmp.now}  →  After ${cmp.after}\n${cmp.label}`, textStyle(13, '#ffe9a8', { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0));
      const why = rewardSynergy(content, run, reward);
      if (why) card.add(this.add.text(0, 118, why, textStyle(13, '#9fe8c8', { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 1));
      if ((run.draftCarry ?? []).includes(rewardId)) card.add(this.add.text(0, 101, 'Locked: in the next draft too', textStyle(14, '#f0e0a0', { align: 'center', wordWrap: { width: cardW - 16 } })).setOrigin(0.5, 0));
      this.cards.push(card);
      // Cards deal in one after another with a bounce.
      if (this.motion !== 'off') {
        card.setAlpha(0).y += 40;
        this.tweens.add({ targets: card, alpha: 1, y: y + 135, duration: this.motion === 'full' ? 380 : 150, delay: this.motion === 'full' ? i * 70 : 0, ease: this.motion === 'full' ? 'Back.easeOut' : 'Sine.easeOut' });
      }
      this.clickZone(x, y, cardW, 270, i);
    });

    // Party strip, with buttons to manage the party and use items.
    drawGlass(this, 40, 380, GAME_WIDTH - 80, 112, { tint: AERO.glassLow, rim: AERO.sky, glow: false });
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
      drawGlass(this, b.x, b.y, b.w, b.h, { radius: 16 });
      this.add.text(b.x + b.w / 2, b.y + b.h / 2, b.label, textStyle(b.size)).setOrigin(0.5);
      this.cursors.push(this.highlight(b.x, b.y, b.w, b.h));
      this.clickZone(b.x, b.y, b.w, b.h, draft.length + n);
    });
    this.buttons = buttons;

    this.notice = this.add.text(GAME_WIDTH / 2, 508, data.notice ?? '', textStyle(18, '#f0e0a0')).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 528, '←/→ ↑/↓ move  ·  Enter choose', textStyle(14, '#a69cb4')).setOrigin(0.5);
    this.focus(data.focus ?? 0, false);

    // A key pressed through the battle's last message must not pick a card the moment the screen opens.
    this.inputReady = false;
    this.time.delayedCall(220, () => (this.inputReady = true));
    onInputAction(this, (action) => {
      if (!this.inputReady && action === 'confirm') return;
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

  private get motion(): MotionLevel {
    return services().session.settings.battleAnimations;
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
    if (sound && i !== this.index) playSfx(this, 'ui.cursor', 0.5);
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
    // The focused card lifts a little; the others settle back.
    this.cards.forEach((card, n) => {
      const lift = n === i ? -10 : 0;
      if (this.motion === 'off') card.y = this.cardY + 135 + lift;
      else this.tweens.add({ targets: card, y: this.cardY + 135 + lift, scale: n === i && this.motion === 'full' ? 1.04 : 1, duration: 140, ease: 'Back.easeOut' });
    });
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
    openPokemonMenu(
      this.fieldHost(),
      0,
      {
        title: `Give the ${reward.name} to which Pokémon?`,
        problemFor: (i) => rewardTargetProblem(content, run, reward, i),
        onPick: (i) => {
          this.picker = null;
          this.choose(draftIndex, i);
        },
      },
    );
  }

  private fieldHost(): FieldMenuHost {
    return { scene: this, setPicker: (p) => (this.picker = p), changed: (notice) => this.restart(notice) };
  }

  private openParty(): void {
    openPokemonMenu(this.fieldHost());
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
    playSfxLazy(this, 'me.item_get', 0.8);
    // The chosen card flies up into the bag with a burst; the result shows on a glass plate.
    const card = this.cards[draftIndex];
    if (card && this.motion !== 'off') {
      card.setDepth(40);
      void burstReveal(this, card.x, card.y, 0x9fe8ff, this.motion, 45);
      this.tweens.add({ targets: card, y: card.y - 60, scale: 0.4, alpha: 0, duration: 420, ease: 'Back.easeIn' });
    }
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setDepth(50);
    const next = result.run.phase === 'map' ? 'Choose your next path…' : '';
    const text = this.add
      .text(GAME_WIDTH / 2, 250, [...result.reward.messages, '', next].join('\n'), textStyle(28, COLORS.textLight, { align: 'center', wordWrap: { width: GAME_WIDTH - 160 } }))
      .setOrigin(0.5)
      .setDepth(52);
    const plate = drawGlass(this, GAME_WIDTH / 2 - text.width / 2 - 40, 250 - text.height / 2 - 28, text.width + 80, text.height + 56, { radius: 26 }).setDepth(51);
    if (this.motion === 'full') {
      plate.setAlpha(0);
      text.setScale(0.85);
      this.tweens.add({ targets: plate, alpha: 1, duration: 200 });
      this.tweens.add({ targets: text, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
    this.time.delayedCall(1500, () => this.scene.start(sceneForRun(result.run)));
  }
}
