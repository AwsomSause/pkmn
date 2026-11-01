// An event ("?" stop) as a small animated scene: the stage's arena tinted to
// fit, the cast sliding in and bobbing, the event's signature effect, choice
// cards that pop in and lift when focused, and an outcome panel whose gains
// bounce in one by one. Everything that moves is presentation only: the
// outcome is decided by core/events.ts before any of it plays. Reduced or
// off battle animations calm the motion down.
//
// Visual Bible "Event choice screens": one reusable glass illustration frame
// whose motif (rim colour, group pill, sparkle) comes from the event's data,
// cards that say what each option costs and what kind of risk it carries
// (core choiceRisk), and an outcome that visibly lands: chips pop with a
// burst and the money pill counts to the new total.

import { fitBlock, fitLine } from '../ui/fitText';
import Phaser from 'phaser';
import { ATTRIBUTE_LABELS } from '../core/attributes';
import type { AttributeKey } from '../core/contentSchema';
import { clockLabel, periodOf, PERIOD_LOOK, seasonOf, specialDateToday } from '../core/clock';
import { eventView, type ChoiceView, type EventResult } from '../core/events';
import { arenaFor, getTheme } from '../core/themes';
import { services } from '../game/services';
import { playMusic, playSfx, playMusicLazy, startAmbient } from '../ui/audio';
import { onInputAction, type InputAction } from '../ui/input';
import { loadAssets } from '../ui/lazyAssets';
import { pokemonVisual, trainerVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { AERO, paintGlass } from '../ui/aero';
import { sceneForRun } from './routing';

/** Each attribute's colour on the choice cards. */
const ATTRIBUTE_COLOR: Record<string, number> = {
  strength: 0xe05040,
  intelligence: 0x5090f0,
  speed: 0x50d0a0,
  charisma: 0xf070c0,
  luck: 0xf8d030,
  love: 0xf08098,
};

const BOTTOM_Y = 356;
const BOTTOM_H = 168;
const DIALOGUE_W = 476;
const OPTIONS_X = 516;

interface Card {
  box: Phaser.GameObjects.Container;
  view: ChoiceView;
  baseY: number;
}

export class EventScene extends Phaser.Scene {
  private sideId = '';
  private cards: Card[] = [];
  private index = 0;
  private phase: 'choose' | 'pick' | 'outcome' = 'choose';
  private picker: { box: Phaser.GameObjects.Container; rows: Phaser.GameObjects.Text[]; picks: { uid: string; label: string }[]; at: number } | null = null;
  private result: EventResult | null = null;
  private calm = false;
  private moneyText: Phaser.GameObjects.Text | null = null;
  private detailOdds: Phaser.GameObjects.Text | null = null;
  private detailRisk: Phaser.GameObjects.Text | null = null;
  private detailCost: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Event');
  }

  create(data: { sideId: string }): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    this.sideId = data.sideId;
    this.cards = [];
    this.index = 0;
    this.phase = 'choose';
    this.picker = null;
    this.result = null;
    this.calm = session.settings.battleAnimations !== 'full';
    playMusicLazy(this, 'bgm.event');
    const view = eventView(content, run, this.sideId);
    const scene = view.event.scene;

    // Backdrop: the stage's arena, tinted for the event, breathing gently.
    const arena = run.stage ? arenaFor(content, getTheme(content, run.stage.themeId)) : undefined;
    if (arena && services().assets.has(arena) && this.textures.exists(arena)) this.add.image(0, 0, arena).setOrigin(0).setScale(PIXEL_SCALE);
    else this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.background).setOrigin(0);
    const tint = Phaser.Display.Color.HexStringToColor(scene.tint ?? '#1d1a24').color;
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, tint, 0.45).setOrigin(0);
    if (!this.calm) this.tweens.add({ targets: shade, alpha: 0.3, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Camp changes with the hour: a wash of the time of day and a small day label.
    if (view.event.group === 'Camp') {
      const look = PERIOD_LOOK[periodOf(run)];
      if (look.alpha > 0) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, look.tint, look.alpha).setOrigin(0).setName('time-wash');
      startAmbient(this, periodOf(run));
      this.add.text(GAME_WIDTH - 24, 14, `${clockLabel(run)}  ·  ${seasonOf(content, run)}${specialDateToday(content, run) ? `  ·  ${specialDateToday(content, run)!.label}` : ''}  ·  ${look.ambient}`, textStyle(16, '#f4ecd0', { stroke: '#101010', strokeThickness: 3 })).setOrigin(1, 0).setName('camp-clock');
    }
    const rim = COLORS.rarity[view.event.rarity] ?? AERO.rim;
    this.illustrationFrame(view.event.group, view.event.rarity, rim, scene.cast.length === 0 && !scene.pokemon);
    this.moneyPill(run.money);

    // HUB-style header tab (glass, rimmed in the rarity colour) slides in from the left.
    const title = this.add.container(-440, 14);
    const band = this.add.graphics();
    paintGlass(band, 0, 0, 420, 44, { rim, radius: 22 });
    title.add(band);
    title.add(fitLine(this.add.text(20, 22, view.event.name, textStyle(24, COLORS.textLight)).setOrigin(0, 0.5), 384));
    this.tweens.add({ targets: title, x: 24, duration: this.calm ? 1 : 600, ease: 'Back.easeOut' });

    // The cast slides in from the right, then bobs; a Pokémon hops in from the left.
    const castIds = scene.cast.filter((id) => services().assets.has(id));
    const showCast = () => {
      castIds.forEach((id, i) => {
        const x = GAME_WIDTH - 170 - i * 130;
        const sprite = trainerVisual(this, id, '', GAME_WIDTH + 120, 230, 2) as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
        this.tweens.add({ targets: sprite, x, duration: this.calm ? 1 : 700, delay: i * 140, ease: 'Back.easeOut' });
        if (!this.calm) this.tweens.add({ targets: sprite, y: 222, duration: 900 + i * 150, delay: 700 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (scene.effect === 'rattle' || scene.effect === 'shake') this.shake(sprite, 2600 + i * 300);
      });
    };
    void loadAssets(this, castIds).then(() => this.scene.isActive() && showCast());
    const species = scene.pokemon ? content.species.get(scene.pokemon) : undefined;
    if (species) {
      const mon = pokemonVisual(this, species, 'front', -80, 250, PIXEL_SCALE) as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
      this.tweens.add({ targets: mon, x: 200, duration: this.calm ? 1 : 800, ease: 'Back.easeOut' });
      if (!this.calm) this.tweens.add({ targets: mon, y: 236, duration: 420, delay: 800, yoyo: true, repeat: -1, repeatDelay: 900, ease: 'Quad.easeOut' });
    }
    if (!this.calm) this.ambient(scene.effect);

    // PokeRogue-style bottom row: a dialogue box (the intro types itself out, the focused option's
    // details sit underneath) on the left and a vertical option list on the right.
    const panel = this.add.graphics();
    paintGlass(panel, 24, BOTTOM_Y, DIALOGUE_W, BOTTOM_H, { tint: AERO.glassLow, glow: false, alpha: 0.95, radius: 18 });
    const intro = this.add.text(42, BOTTOM_Y + 14, '', textStyle(16, COLORS.textLight, { wordWrap: { width: DIALOGUE_W - 36 }, lineSpacing: 4 })).setOrigin(0, 0);
    // A long intro is cut with "..." to the four lines the box has room for, then typed out.
    const introFit = fitBlock(intro, DIALOGUE_W - 36, 92, view.event.intro).text;
    intro.setText('');
    this.typeOut(intro, introFit, services().session.settings.skipSeenDialogue && services().session.profile.npcMemory.seenEvents.includes(view.event.id));
    const rule = this.add.graphics();
    rule.lineStyle(1, AERO.rim, 0.35).lineBetween(42, BOTTOM_Y + 100, 24 + DIALOGUE_W - 18, BOTTOM_Y + 100);
    this.detailOdds = this.add.text(42, BOTTOM_Y + 106, '', textStyle(13, '#f8e8a0', { wordWrap: { width: DIALOGUE_W - 36 }, maxLines: 1 })).setOrigin(0, 0);
    this.detailRisk = this.add.text(42, BOTTOM_Y + 124, '', textStyle(12, '#bfe9ff', { wordWrap: { width: DIALOGUE_W - 36 }, maxLines: 2 })).setOrigin(0, 0).setName('event-risk');
    this.detailCost = this.add.text(42, BOTTOM_Y + 154, '', textStyle(12, '#ffb0a0', { wordWrap: { width: DIALOGUE_W - 36 }, maxLines: 1 })).setOrigin(0, 0).setName('event-cost');

    const n = view.choices.length;
    const rowH = Math.min(46, Math.floor((BOTTOM_H - 8) / Math.max(1, n)));
    const w = GAME_WIDTH - 24 - OPTIONS_X;
    const top = BOTTOM_Y + (BOTTOM_H - n * rowH) / 2;
    view.choices.forEach((c, i) => {
      const baseY = top + i * rowH + rowH / 2;
      const box = this.add.container(OPTIONS_X + w / 2, baseY);
      const g = this.add.graphics();
      const color = c.attribute ? (ATTRIBUTE_COLOR[c.attribute] ?? AERO.rim) : AERO.rim;
      paintGlass(g, -w / 2, -rowH / 2 + 2, w, rowH - 4, { tint: c.locked ? 0x2a2a36 : AERO.glass, rim: c.locked ? 0x5a5a6a : color, radius: 14, alpha: c.locked ? 0.75 : 0.92, glow: false });
      box.add(g);
      const tag = c.locked ? '🔒' : c.chance !== null ? `${c.attribute && c.attributeValue !== null ? `${ATTRIBUTE_LABELS[c.attribute as AttributeKey]} ${Math.abs(c.attributeValue)}: ` : ''}${Math.round(c.chance * 100)}%` : '';
      if (c.attribute) {
        const badge = this.add.circle(-w / 2 + 14, 0, 9, color, c.locked ? 0.4 : 1).setStrokeStyle(2, 0xffffff, 0.8);
        box.add(badge);
        box.add(this.add.text(-w / 2 + 14, 0, ATTRIBUTE_LABELS[c.attribute as AttributeKey]?.[0] ?? '?', textStyle(11, '#181818')).setOrigin(0.5));
      }
      box.add(fitBlock(this.add.text(-w / 2 + 34, 0, c.label, textStyle(15, c.locked ? COLORS.textMuted : COLORS.textLight, { wordWrap: { width: w - 112 } })).setOrigin(0, 0.5), w - 112, 38));
      if (tag) box.add(this.add.text(w / 2 - 14, 0, tag, textStyle(14, c.locked ? COLORS.bad : '#f8e8a0')).setOrigin(1, 0.5));
      const arrow = this.add.text(-w / 2 + 14, 0, '▶', textStyle(14, '#ffffff')).setOrigin(0.5).setVisible(false).setDepth(5);
      box.add(arrow);
      const frame = this.add.graphics().setVisible(false);
      frame.lineStyle(6, AERO.neon, 0.25).strokeRoundedRect(-w / 2 - 3, -rowH / 2 - 1, w + 6, rowH + 2, 17);
      frame.lineStyle(2, 0xffffff, 0.95).strokeRoundedRect(-w / 2, -rowH / 2 + 2, w, rowH - 4, 14);
      box.add(frame);
      box.setData('frame', frame);
      box.setData('arrow', arrow);
      box.setScale(this.calm ? 1 : 0);
      this.tweens.add({ targets: box, scale: 1, duration: 380, delay: 400 + i * 100, ease: 'Back.easeOut' });
      const zone = this.add.zone(0, 0, w, rowH).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.focus(i));
      zone.on('pointerdown', () => {
        this.focus(i);
        this.confirm();
      });
      box.add(zone);
      this.cards.push({ box, view: c, baseY });
    });
    this.focus(Math.max(0, view.choices.findIndex((c) => !c.locked)), false);
    onInputAction(this, (action) => this.handle(action));
    this.cameras.main.fadeIn(this.calm ? 1 : 300);
    // Split-second choice (ideas W1): a countdown when timed prompts are on; at zero the fallback option is taken.
    const seconds = view.event.countdown;
    if (seconds && session.settings.skillPrompts) {
      let left = seconds;
      const clock = this.add.text(GAME_WIDTH / 2, 20, `Decide! ${left}`, textStyle(26, '#ffe060', { stroke: '#181818', strokeThickness: 5 })).setOrigin(0.5).setDepth(50);
      this.time.addEvent({
        delay: 1000,
        repeat: seconds - 1,
        callback: () => {
          if (this.phase !== 'choose') return clock.destroy();
          left -= 1;
          clock.setText(`Decide! ${left}`).setColor(left <= 3 ? '#ff6a6a' : '#ffe060');
          if (left > 0) return;
          clock.destroy();
          const open = view.choices.map((c, i) => (c.locked ? -1 : i)).filter((i) => i >= 0);
          const pick = view.event.timeoutChoice !== undefined && open.includes(view.event.timeoutChoice) ? view.event.timeoutChoice : open[open.length - 1];
          if (pick !== undefined) {
            this.focus(pick, false);
            this.confirm();
          }
        },
      });
    }
  }

  private handle(action: InputAction): void {
    if (this.phase === 'outcome') {
      if (action === 'confirm' || action === 'back') this.leave();
      return;
    }
    if (this.phase === 'pick') {
      this.handlePick(action);
      return;
    }
    const n = this.cards.length;
    if (action === 'left' || action === 'up') this.focus((this.index - 1 + n) % n);
    else if (action === 'right' || action === 'down') this.focus((this.index + 1) % n);
    else if (action === 'confirm') this.confirm();
  }

  /** The focused card lifts and wiggles a little; the others settle back. */
  private focus(i: number, sound = true): void {
    if (this.phase !== 'choose') return;
    if (sound && i !== this.index) playSfx(this, 'ui.select', 0.3);
    this.index = i;
    this.cards.forEach((c, j) => {
      const on = j === i;
      (c.box.getData('frame') as Phaser.GameObjects.Graphics).setVisible(on);
      (c.box.getData('arrow') as Phaser.GameObjects.Text).setVisible(on);
      this.tweens.killTweensOf(c.box);
      const x = OPTIONS_X + (GAME_WIDTH - 24 - OPTIONS_X) / 2 + (on ? -8 : 0);
      if (this.calm) {
        c.box.x = x;
        c.box.setScale(1);
        return;
      }
      this.tweens.add({ targets: c.box, x, scale: on ? 1.02 : 1, duration: 220, ease: 'Back.easeOut' });
    });
    this.showDetail(this.cards[i]?.view);
  }

  /** The focused option's odds, risk and cost fill the lower half of the dialogue box. */
  private showDetail(c: ChoiceView | undefined): void {
    if (!c) return;
    const odds = c.locked
      ? `🔒 ${c.locked}`
      : c.chance !== null
        ? `${c.attribute ? `${ATTRIBUTE_LABELS[c.attribute as AttributeKey]}: ` : ''}${Math.round(c.chance * 100)}%`
        : '';
    if (this.detailOdds) fitBlock(this.detailOdds, DIALOGUE_W - 36, 18, odds).setColor(c.locked ? COLORS.bad : '#f8e8a0');
    if (this.detailRisk) fitBlock(this.detailRisk, DIALOGUE_W - 36, 30, c.locked ? (c.preview ?? '') : c.preview ? `${c.risk}\n${c.preview}` : c.risk);
    if (this.detailCost) fitBlock(this.detailCost, DIALOGUE_W - 36, 18, c.cost && !c.locked ? `Costs ${c.cost}` : '');
  }

  private confirm(): void {
    if (this.phase !== 'choose') return;
    const card = this.cards[this.index];
    if (!card) return;
    if (card.view.locked) {
      playSfx(this, 'ui.error', 0.5);
      if (!this.calm) this.shake(card.box, 300);
      return;
    }
    // A trade with more than one fitting Pokémon: the player picks which one goes.
    const picks = card.view.tradePicks;
    if (picks && picks.length > 1) this.openPicker(picks);
    else this.commit(picks?.[0]?.uid);
  }

  /** The party Pokémon the partner would take, as a list over the option column. */
  private openPicker(picks: { uid: string; label: string }[]): void {
    this.phase = 'pick';
    playSfx(this, 'ui.select', 0.5);
    const w = GAME_WIDTH - 24 - OPTIONS_X;
    const rowH = Math.min(26, Math.floor((BOTTOM_H - 40) / picks.length));
    const box = this.add.container(OPTIONS_X + w / 2, BOTTOM_Y + BOTTOM_H / 2).setDepth(20);
    const bg = this.add.graphics();
    paintGlass(bg, -w / 2, -BOTTOM_H / 2, w, BOTTOM_H, { tint: AERO.glassLow, glow: false, alpha: 0.98, radius: 14 });
    box.add(bg);
    box.add(this.add.text(0, -BOTTOM_H / 2 + 12, 'Pick a Pokémon to trade (Esc: back)', textStyle(12, '#f8e8a0')).setOrigin(0.5, 0.5));
    const rows = picks.map((p, i) => {
      const t = this.add.text(0, -BOTTOM_H / 2 + 34 + i * rowH, p.label, textStyle(14, COLORS.textLight)).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.pickAt(i));
      t.on('pointerdown', () => this.commit(p.uid));
      box.add(t);
      return t;
    });
    this.picker = { box, rows, picks, at: 0 };
    this.pickAt(0);
  }

  private pickAt(i: number): void {
    const pk = this.picker;
    if (!pk) return;
    pk.at = i;
    pk.rows.forEach((t, j) => t.setColor(j === i ? '#f8e8a0' : COLORS.textLight).setText(`${j === i ? '▶ ' : ''}${pk.picks[j]!.label}`));
  }

  private handlePick(action: InputAction): void {
    const pk = this.picker;
    if (!pk) return;
    const n = pk.picks.length;
    if (action === 'up' || action === 'left') this.pickAt((pk.at - 1 + n) % n);
    else if (action === 'down' || action === 'right') this.pickAt((pk.at + 1) % n);
    else if (action === 'confirm') this.commit(pk.picks[pk.at]!.uid);
    else if (action === 'back') {
      pk.box.destroy();
      this.picker = null;
      this.phase = 'choose';
    }
  }

  private commit(tradeUid?: string): void {
    this.picker?.box.destroy();
    this.picker = null;
    const { session } = services();
    this.result = session.chooseEvent(this.sideId, this.index, tradeUid);
    this.phase = 'outcome';
    playSfx(this, 'ui.select', 0.6);
    // The picked card squashes and flies up; the rest drop away.
    this.cards.forEach((c, j) => {
      this.tweens.killTweensOf(c.box);
      if (j === this.index) this.tweens.add({ targets: c.box, x: c.box.x + 40, scaleX: 1.1, scaleY: 0.85, alpha: 0, duration: this.calm ? 1 : 420, ease: 'Back.easeIn' });
      else this.tweens.add({ targets: c.box, x: c.box.x + 240, alpha: 0, duration: this.calm ? 1 : 360, delay: j * 40, ease: 'Quad.easeIn' });
    });
    [this.detailOdds, this.detailRisk, this.detailCost].forEach((t) => {
      if (t) this.tweens.add({ targets: t, alpha: 0, duration: this.calm ? 1 : 240 });
    });
    this.time.delayedCall(this.calm ? 10 : 380, () => this.showOutcome());
  }

  /** The outcome panel rises; each change pops in with a bounce. */
  private showOutcome(): void {
    const r = this.result!;
    playSfx(this, r.success ? 'se.level_up' : 'ui.error', 0.5);
    const box = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT + 120);
    const g = this.add.graphics();
    paintGlass(g, -380, -82, 760, 164, { rim: r.success ? 0x60d070 : 0xf07070, radius: 20 });
    box.add(g);
    box.add(this.add.text(0, -62, r.success ? '' : 'It didn’t go your way…', textStyle(15, COLORS.bad)).setOrigin(0.5, 0));
    box.add(this.add.text(0, -40, r.text, textStyle(18, COLORS.textLight, { align: 'center', wordWrap: { width: 720 } })).setOrigin(0.5, 0));
    this.tweens.add({ targets: box, y: 450, duration: this.calm ? 1 : 520, ease: 'Back.easeOut' });
    const chips = r.changes;
    const per = Math.min(4, Math.max(1, chips.length));
    chips.forEach((text, i) => {
      const cx = ((i % per) - (per - 1) / 2) * 180;
      const cy = 26 + Math.floor(i / per) * 28;
      const good = !/^(−|Lost|party loses|party (poisoned|burned|paralysed|asleep)|Evil|Rage)/.test(text);
      const chip = this.add.text(cx, cy, text, textStyle(15, good ? COLORS.good : COLORS.bad, { backgroundColor: '#0c2a44', padding: { x: 10, y: 3 } })).setOrigin(0.5).setName('event-chip');
      chip.setScale(this.calm ? 1 : 0);
      box.add(chip);
      this.tweens.add({
        targets: chip,
        scale: 1,
        duration: 320,
        delay: 600 + i * 160,
        ease: 'Back.easeOut',
        onStart: () => playSfx(this, 'se.exp', 0.3),
        onComplete: () => {
          if (this.calm) return;
          this.chipAck(box, cx, cy, good);
          if (good) this.flyGain(text, GAME_WIDTH / 2 + cx, 450 + cy);
        },
      });
    });
    // The money pill counts to the new total once the chips have landed.
    const money = r.run.money;
    this.time.delayedCall(this.calm ? 0 : 600 + chips.length * 160, () => this.countMoney(money));
    const next = this.add.text(GAME_WIDTH - 52, GAME_HEIGHT - 20, r.battle ? 'Enter: battle!' : 'Enter: continue', textStyle(15, COLORS.textMuted)).setOrigin(1, 1);
    if (!this.calm) this.tweens.add({ targets: next, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
  }

  /** The reusable illustration frame: a pale glass window over the arena, rimmed in the rarity colour, with the event's group as its motif pill. */
  private illustrationFrame(group: string, rarity: string, rim: number, empty: boolean): void {
    const g = this.add.graphics().setName('event-frame');
    paintGlass(g, 36, 76, GAME_WIDTH - 72, 216, { tint: AERO.sky, rim, alpha: 0.22, radius: 22 });
    // A scene with nobody in it gets a glossy emblem bubble so the frame never sits empty.
    if (empty) {
      const orb = this.add.container(GAME_WIDTH / 2, 186);
      const b = this.add.graphics();
      b.fillStyle(rim, 0.18).fillCircle(0, 0, 62);
      b.fillStyle(AERO.glass, 0.75).fillCircle(0, 0, 52);
      b.fillStyle(0xffffff, 0.35).fillEllipse(0, -24, 70, 34);
      b.lineStyle(3, rim, 0.95).strokeCircle(0, 0, 52);
      orb.add(b);
      orb.add(this.add.text(0, 4, '!', textStyle(54, '#ffffff')).setOrigin(0.5));
      if (!this.calm) this.tweens.add({ targets: orb, y: 176, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const pill = this.add.text(56, 86, `${group}  ·  ${rarity.toUpperCase()}`, textStyle(12, '#ffffff', { backgroundColor: '#0c2a44', padding: { x: 10, y: 3 } })).setAlpha(0.9);
    if (this.calm) return;
    pill.setX(20).setAlpha(0);
    this.tweens.add({ targets: pill, x: 56, alpha: 0.9, duration: 500, delay: 350, ease: 'Back.easeOut' });
    // Corner glints twinkle in turn, like light catching glass.
    [
      [52, 92],
      [GAME_WIDTH - 52, 92],
      [52, 276],
      [GAME_WIDTH - 52, 276],
    ].forEach(([x, y], i) => {
      const star = this.add.star(x!, y!, 4, 2, 8, 0xffffff, 0.9).setScale(0);
      this.tweens.add({ targets: star, scale: 1, angle: 90, duration: 500, yoyo: true, repeat: -1, repeatDelay: 1800, delay: 400 + i * 450, ease: 'Sine.easeInOut' });
    });
  }

  private moneyPill(money: number): void {
    const g = this.add.graphics();
    paintGlass(g, GAME_WIDTH - 172, 14, 148, 34, { radius: 17, glow: false });
    this.moneyText = this.add.text(GAME_WIDTH - 98, 31, `₽${money}`, textStyle(17)).setOrigin(0.5).setName('event-money');
  }

  /** The money pill rolls to the new total and pulses (green up, red down). */
  private countMoney(to: number): void {
    const text = this.moneyText;
    if (!text) return;
    const from = Number(text.text.slice(1));
    if (from === to) return;
    text.setColor(to > from ? COLORS.good : COLORS.bad);
    if (this.calm) {
      text.setText(`₽${to}`);
      return;
    }
    playSfx(this, 'se.exp', 0.3);
    const roll = { v: from };
    this.tweens.add({ targets: roll, v: to, duration: 600, ease: 'Quad.easeOut', onUpdate: () => text.setText(`₽${Math.round(roll.v)}`), onComplete: () => text.setText(`₽${to}`) });
    this.tweens.add({ targets: text, scale: 1.25, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
  }

  /** A gain gets a ring of sparkles; a loss gives a short shudder. */
  /** A gain flies from its chip to where it lands: money to the purse, attributes to the bars, Pokémon changes to the party, anything else to the Bag. */
  private flyGain(text: string, x: number, y: number): void {
    const toMoney = /₽|money/i.test(text);
    const toAttr = /(Strength|Intelligence|Speed|Charisma|Luck|Love|Rage|Peace|Good|Evil)\b/.test(text);
    const toParty = /friendship|level|heal|HP|move|egg/i.test(text);
    const [tx, ty] = toMoney ? [GAME_WIDTH - 90, 28] : toAttr ? [70, 28] : toParty ? [90, GAME_HEIGHT - 30] : [GAME_WIDTH - 90, GAME_HEIGHT - 30];
    const orb = this.add.circle(x, y, 7, toMoney ? 0xf8d030 : toAttr ? 0x80d0ff : toParty ? 0xf08098 : 0xa0f0a0, 1).setStrokeStyle(2, 0xffffff, 0.9).setDepth(50);
    this.tweens.add({ targets: orb, x: tx, y: ty, scale: 0.4, duration: 650, ease: 'Cubic.easeIn', onComplete: () => orb.destroy() });
  }

  private chipAck(box: Phaser.GameObjects.Container, x: number, y: number, good: boolean): void {
    if (!good) {
      this.tweens.add({ targets: box, x: box.x + 4, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI * 2 * k) / 6;
      const star = this.add.star(x, y, 4, 1.5, 5, 0xfff4a0, 1);
      box.add(star);
      this.tweens.add({ targets: star, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 18, alpha: 0, angle: 120, duration: 520, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    }
  }

  private leave(): void {
    const run = services().session.run!;
    this.cameras.main.fadeOut(this.calm ? 1 : 260);
    this.time.delayedCall(this.calm ? 10 : 270, () => this.scene.start(sceneForRun(run)));
  }

  private typeOut(text: Phaser.GameObjects.Text, full: string, seen = false): void {
    if (this.calm || seen) {
      text.setText(full);
      return;
    }
    let shown = 0;
    this.time.addEvent({
      delay: 14,
      repeat: full.length - 1,
      callback: () => text.setText(full.slice(0, ++shown)),
    });
  }

  private shake(target: Phaser.GameObjects.GameObject, every: number): void {
    this.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 3, repeatDelay: 0, loop: -1, loopDelay: every });
  }

  /** The event's signature effect, drawn from simple shapes so it needs no art. */
  private ambient(effect: string): void {
    const spawn = (make: () => Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle, fall: number, drift: number, life: number, every: number) => {
      this.time.addEvent({
        delay: every,
        loop: true,
        callback: () => {
          const o = make();
          this.tweens.add({ targets: o, y: o.y + fall, x: o.x + Phaser.Math.Between(-drift, drift), alpha: 0, angle: Phaser.Math.Between(-90, 90), duration: life, ease: 'Sine.easeIn', onComplete: () => o.destroy() });
        },
      });
    };
    const rnd = (a: number, b: number) => Phaser.Math.Between(a, b);
    switch (effect) {
      case 'rain':
        return spawn(() => this.add.rectangle(rnd(0, GAME_WIDTH), rnd(-40, 0), 2, 14, 0x9cc8f8, 0.7), 340, 30, 700, 30);
      case 'snow':
        return spawn(() => this.add.circle(rnd(0, GAME_WIDTH), rnd(-20, 0), rnd(2, 4), 0xffffff, 0.9), 320, 60, 2600, 90);
      case 'fire':
        return spawn(() => this.add.circle(rnd(80, GAME_WIDTH - 80), rnd(280, 300), rnd(3, 6), Phaser.Math.RND.pick([0xf8a030, 0xf86030, 0xf8d050]), 0.9), -220, 40, 1400, 70);
      case 'hearts':
        return spawn(() => this.add.text(rnd(120, GAME_WIDTH - 120), rnd(240, 290), '♥', textStyle(rnd(16, 26), "#f87898")), -200, 40, 1800, 260);
      case 'sparkle':
      case 'glint':
        return spawn(() => this.add.star(rnd(100, GAME_WIDTH - 100), rnd(90, 280), 4, 2, rnd(5, 9), 0xfff4a0, 1), -20, 10, 900, effect === 'glint' ? 240 : 120);
      case 'fog':
        return spawn(() => this.add.ellipse(rnd(-60, GAME_WIDTH), rnd(160, 300), rnd(120, 220), rnd(30, 50), 0xd8d8e8, 0.18), 0, 160, 4000, 500);
      case 'float':
        return spawn(() => this.add.circle(rnd(100, GAME_WIDTH - 100), rnd(250, 300), rnd(2, 5), 0xc8a0f8, 0.8), -180, 20, 2400, 180);
      case 'flicker': {
        const dark = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0);
        this.time.addEvent({ delay: 1600, loop: true, callback: () => this.tweens.add({ targets: dark, alpha: { from: 0.55, to: 0 }, duration: 90, yoyo: true, repeat: 2 }) });
        return;
      }
      case 'spin': {
        const wheel = this.add.star(GAME_WIDTH / 2, 190, 8, 30, 70, 0xf8d030, 0.85);
        this.tweens.add({ targets: wheel, angle: 360, duration: 1400, repeat: -1 });
        return;
      }
      case 'net': {
        const net = this.add.grid(GAME_WIDTH - 300, -160, 300, 160, 20, 20, undefined, 0, 0xd8d8d8, 0.8);
        this.tweens.add({ targets: net, y: 200, duration: 700, delay: 600, ease: 'Bounce.easeOut' });
        return;
      }
      default:
        return;
    }
  }
}
