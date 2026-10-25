// The wild battle screen. All rules run in the core battle engine; this scene
// only shows the state and plays back the events each turn produces.

import Phaser from 'phaser';
import type { BattleEvent } from '../core/battle/engine';
import { calcStats, getSpecies, xpForLevel } from '../core/pokemon';
import type { PokemonInstance } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { eventText } from '../ui/battleText';
import { onInputAction, type InputAction } from '../ui/input';
import { pokemonVisual, type Visual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, STATUS_LABELS, TYPE_COLORS, textStyle } from '../ui/theme';
import { Bar, badge, drawPanel, Menu } from '../ui/widgets';

const MESSAGE_AUTO_ADVANCE_MS = 1400;

interface InfoBox {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  hpBar: Bar;
  hpText?: Phaser.GameObjects.Text;
  xpBar?: Bar;
  statusBadge?: Phaser.GameObjects.Container;
}

export class BattleScene extends Phaser.Scene {
  private message!: Phaser.GameObjects.Text;
  private menu: Menu | null = null;
  private moveInfo!: Phaser.GameObjects.Text;
  private playerBox!: InfoBox;
  private enemyBox!: InfoBox;
  private playerSprite!: Visual;
  private enemySprite!: Visual;
  private header!: Phaser.GameObjects.Text;
  private advance: (() => void) | null = null;
  private busy = false;

  constructor() {
    super('Battle');
  }

  create(): void {
    const { session, assets } = services();
    const run = session.run!;
    const battle = run.battle!;
    const content = session.content;
    playMusic(this, 'bgm.battle');
    this.menu = null;
    this.advance = null;
    this.busy = false;

    if (assets.has('bg.battle')) this.add.image(0, 0, 'bg.battle').setOrigin(0).setScale(PIXEL_SCALE);
    else this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x88c070).setOrigin(0);

    const player = this.activeMon();
    this.enemySprite = pokemonVisual(this, getSpecies(content, battle.enemy.speciesId), 'front', 690, 250);
    this.playerSprite = pokemonVisual(this, getSpecies(content, player.speciesId), 'back', 250, 404, PIXEL_SCALE + 1);

    this.enemyBox = this.makeInfoBox(40, 36, battle.enemy, false);
    this.playerBox = this.makeInfoBox(540, 270, player, true);
    this.header = this.add.text(GAME_WIDTH - 20, 14, '', textStyle(22, COLORS.textLight, { stroke: '#202838', strokeThickness: 4 })).setOrigin(1, 0);
    this.updateHeader();

    drawPanel(this, 8, 404, GAME_WIDTH - 16, 128, { fill: COLORS.panelDark, border: 0x101420 });
    this.message = this.add.text(32, 424, '', textStyle(30, COLORS.textLight, { wordWrap: { width: 520 }, lineSpacing: 4 }));
    this.moveInfo = this.add.text(GAME_WIDTH - 28, 500, '', textStyle(20, '#c8d0e0')).setOrigin(1, 0).setVisible(false);

    onInputAction(this, (a) => this.handleInput(a));
    this.input.on('pointerdown', () => this.advance?.());

    void this.intro();
  }

  private activeMon(): PokemonInstance {
    const run = services().session.run!;
    return run.party[run.battle!.activeIndex]!;
  }

  private speciesName(mon: PokemonInstance): string {
    return getSpecies(services().session.content, mon.speciesId).name;
  }

  private makeInfoBox(x: number, y: number, mon: PokemonInstance, isPlayer: boolean): InfoBox {
    const w = 380;
    const h = isPlayer ? 116 : 84;
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.95);
    g.fillRoundedRect(0, 0, w, h, 10);
    g.lineStyle(4, COLORS.border, 1);
    g.strokeRoundedRect(0, 0, w, h, 10);
    container.add(g);
    const name = this.add.text(16, 8, '', textStyle(28));
    container.add(name);
    container.add(this.add.text(36, 52, 'HP', textStyle(18, COLORS.accent === 0 ? '#000' : '#e09030')));
    const hpBar = new Bar(this, 72, 62, 280, 14, 'hp');
    hpBar.addTo(container);
    const box: InfoBox = { container, name, hpBar };
    if (isPlayer) {
      box.hpText = this.add.text(w - 20, 72, '', textStyle(22)).setOrigin(1, 0);
      container.add(box.hpText);
      box.xpBar = new Bar(this, 72, 104, 280, 8, 'xp');
      box.xpBar.addTo(container);
      container.add(this.add.text(36, 96, 'XP', textStyle(14, '#4090d0')));
    }
    this.refreshInfoBox(box, mon, false);
    return box;
  }

  private refreshInfoBox(box: InfoBox, mon: PokemonInstance, animate: boolean, hpOverride?: number): Promise<void> {
    const content = services().session.content;
    const max = calcStats(content, mon).hp;
    const hp = hpOverride ?? mon.hp;
    box.name.setText(`${this.speciesName(mon)}  Lv${mon.level}`);
    box.hpText?.setText(`${hp}/${max}`);
    box.statusBadge?.destroy();
    box.statusBadge = undefined;
    if (mon.status) {
      const s = STATUS_LABELS[mon.status.id]!;
      box.statusBadge = badge(this, 290, 12, s.label, s.color, 16);
      box.container.add(box.statusBadge);
    }
    if (box.xpBar) {
      const species = getSpecies(content, mon.speciesId);
      const lo = xpForLevel(species.growthRate, mon.level);
      const hi = xpForLevel(species.growthRate, mon.level + 1);
      void box.xpBar.set(mon.level >= 100 ? 1 : (mon.xp - lo) / Math.max(1, hi - lo), animate);
    }
    return box.hpBar.set(hp / max, animate);
  }

  private updateHeader(): void {
    const run = services().session.run!;
    this.header.setText(`Encounter ${run.encountersCompleted + 1}  ·  ₽${run.money}`);
  }

  private handleInput(action: InputAction): void {
    if (this.advance && (action === 'confirm' || action === 'back')) {
      this.advance();
      return;
    }
    this.menu?.handle(action);
  }

  /** Shows one message; resolves when the player presses confirm or after a short delay. */
  private say(text: string): Promise<void> {
    this.message.setText(text);
    return new Promise((resolve) => {
      const timer = this.time.delayedCall(MESSAGE_AUTO_ADVANCE_MS, () => done());
      const done = () => {
        timer.remove(false);
        this.advance = null;
        resolve();
      };
      // Ignore the key press that opened this message.
      this.time.delayedCall(120, () => (this.advance = done));
    });
  }

  private async intro(): Promise<void> {
    const run = services().session.run!;
    const battle = run.battle!;
    if (battle.turn === 1) {
      await this.say(`A wild ${this.speciesName(battle.enemy)} appeared!`);
      await this.say(`Go! ${this.speciesName(this.activeMon())}!`);
    } else {
      await this.say(`The battle continues! (turn ${battle.turn})`);
    }
    this.showMoveMenu();
  }

  private showMoveMenu(): void {
    const content = services().session.content;
    const mon = this.activeMon();
    const anyPp = mon.moves.some((m) => m.pp > 0);
    this.message.setText(`What will ${this.speciesName(mon)} do?`);
    const options = anyPp
      ? mon.moves.map((slot) => {
          const move = content.moves.get(slot.id)!;
          return { label: move.name, disabled: slot.pp <= 0 };
        })
      : [{ label: 'Struggle' }];
    this.menu?.destroy();
    this.menu = new Menu(this, {
      x: 560,
      y: 420,
      options,
      columns: 2,
      itemWidth: 190,
      itemHeight: 40,
      fontSize: 24,
      color: COLORS.textLight,
      onFocus: (i) => {
        const slot = mon.moves[i];
        if (!anyPp || !slot) {
          this.moveInfo.setText('Your Pokémon has no PP left');
          return;
        }
        const move = content.moves.get(slot.id)!;
        const power = move.power ?? (move.effects.fixedDamage ? 'Lv' : '—');
        this.moveInfo.setText(`${move.type.toUpperCase()}  ·  ${move.category}  ·  Pow ${power}  ·  PP ${slot.pp}/${move.pp}`);
        this.moveInfo.setColor(Phaser.Display.Color.IntegerToColor(TYPE_COLORS[move.type] ?? 0xffffff).rgba);
      },
      onSelect: (i) => void this.chooseMove(anyPp ? i : -1),
    });
    this.moveInfo.setVisible(true);
  }

  private async chooseMove(index: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.menu?.destroy();
    this.menu = null;
    this.moveInfo.setVisible(false);

    const { session } = services();
    const before = structuredClone(session.run!);
    const result = session.takeTurn(index);
    await this.playEvents(result.events, before.party[before.battle!.activeIndex]!, before.battle!.enemy);

    if (result.victory) {
      const mon = result.run.party[before.battle!.activeIndex]!;
      await this.say(`${this.speciesName(mon)} gained ${result.victory.xpGained} XP!`);
      playSfx(this, 'se.exp', 0.6);
      await this.refreshInfoBox(this.playerBox, mon, true);
      if (result.victory.levelUp.levelsGained > 0) {
        playSfx(this, 'se.level_up');
        await this.say(`${this.speciesName(mon)} grew to level ${result.victory.levelUp.newLevel}!`);
        for (const m of result.victory.levelUp.learnedMoves) await this.say(`${this.speciesName(mon)} learned ${session.content.moves.get(m)!.name}!`);
        for (const m of result.victory.levelUp.skippedMoves) {
          await this.say(`${this.speciesName(mon)} couldn't learn ${session.content.moves.get(m)!.name} (it already knows four moves).`);
        }
      }
      await this.say(`You got ₽${result.victory.moneyGained} for winning!`);
      this.scene.start('Reward');
      return;
    }
    if (result.defeated) {
      await this.say('You have no Pokémon that can fight!');
      this.scene.start('GameOver');
      return;
    }
    this.busy = false;
    this.showMoveMenu();
  }

  private async playEvents(events: BattleEvent[], playerBefore: PokemonInstance, enemyBefore: PokemonInstance): Promise<void> {
    const { session } = services();
    const run = session.run!;
    const names = { player: this.speciesName(playerBefore), enemy: this.speciesName(enemyBefore) };
    // Show statuses as they change during playback, not all at once.
    const shown = { player: structuredClone(playerBefore), enemy: structuredClone(enemyBefore) };
    const finalPlayer = run.party[run.battle ? run.battle.activeIndex : 0] ?? playerBefore;
    const finalEnemy = run.battle?.enemy ?? enemyBefore;

    for (const e of events) {
      const box = e.side === 'player' ? this.playerBox : this.enemyBox;
      const sprite = e.side === 'player' ? this.playerSprite : this.enemySprite;
      const mon = shown[e.side];
      switch (e.type) {
        case 'damage':
        case 'residual':
        case 'recoil':
        case 'drain':
          mon.hp = e.hpAfter;
          if (e.type !== 'drain') {
            playSfx(this, e.type === 'damage' && e.effectiveness > 1 ? 'se.hit_strong' : e.type === 'damage' && e.effectiveness < 1 ? 'se.hit_weak' : 'se.hit');
            this.tweens.add({ targets: sprite, alpha: 0.2, yoyo: true, repeat: 2, duration: 70 });
          }
          await this.refreshInfoBox(box, mon, true);
          break;
        case 'status':
          mon.status = { id: e.status };
          void this.refreshInfoBox(box, mon, false);
          break;
        case 'wake':
        case 'thaw':
          mon.status = null;
          void this.refreshInfoBox(box, mon, false);
          break;
        case 'faint':
          playSfx(this, 'se.faint');
          this.tweens.add({ targets: sprite, alpha: 0, y: sprite.y + 30, duration: 400 });
          break;
        default:
          break;
      }
      const text = eventText(session.content, names, e);
      if (text) await this.say(text);
    }
    // Make sure the boxes match the real state at the end of the turn.
    // (XP and level changes are shown afterwards, with their own messages.)
    await this.refreshInfoBox(this.playerBox, { ...shown.player, hp: finalPlayer.hp, status: finalPlayer.status }, false);
    if (run.battle) await this.refreshInfoBox(this.enemyBox, finalEnemy, false);
    this.updateHeader();
  }
}
