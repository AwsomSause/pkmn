// The battle screen, for wild and trainer battles. All rules run in the core
// battle engine; this scene only shows the state, collects the player's
// choice (Fight / Bag / Pokémon) and plays back the events each turn produces.

import Phaser from 'phaser';
import { itemProblem, switchProblem, type PlayerAction } from '../core/battle/engine';
import { calcStats, getSpecies, xpForLevel } from '../core/pokemon';
import { bossRoleForClass } from '../core/encounters';
import { findNode } from '../core/map';
import { bossInfo, currentRegion, type BossInfo } from '../core/regions';
import type { RunEvent, TurnResult } from '../core/run';
import { currentEnemy, type PokemonInstance, type RunState } from '../core/state';
import { arenaFor, getTheme } from '../core/themes';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { eventText, type Names } from '../ui/battleText';
import { onInputAction, type InputAction } from '../ui/input';
import { bagRow, partyRows, Picker } from '../ui/partyPanel';
import { itemVisual, pokemonVisual, trainerVisual, type Visual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, STATUS_LABELS, TYPE_COLORS, textStyle } from '../ui/theme';
import { Bar, badge, drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';

const MESSAGE_AUTO_ADVANCE_MS = 1400;
const ENEMY_POS = { x: 690, y: 250 };
const PLAYER_POS = { x: 250, y: 404 };

interface InfoBox {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  hpBar: Bar;
  hpText?: Phaser.GameObjects.Text;
  xpBar?: Bar;
  teamText?: Phaser.GameObjects.Text;
  statusBadge?: Phaser.GameObjects.Container;
}

const sleep = (scene: Phaser.Scene, ms: number) => new Promise<void>((resolve) => scene.time.delayedCall(ms, resolve));
const tween = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));

export class BattleScene extends Phaser.Scene {
  private message!: Phaser.GameObjects.Text;
  private menu: Menu | null = null;
  private picker: Picker | null = null;
  private moveInfo!: Phaser.GameObjects.Text;
  private playerBox!: InfoBox;
  private enemyBox!: InfoBox;
  private playerSprite: Visual | null = null;
  private enemySprite: Visual | null = null;
  private header!: Phaser.GameObjects.Text;
  private advance: (() => void) | null = null;
  private busy = false;
  /** What the screen currently shows for each side (may lag the real state during playback). */
  private shown!: { player: PokemonInstance; enemy: PokemonInstance };

  constructor() {
    super('Battle');
  }

  create(): void {
    const { session, assets } = services();
    const run = session.run!;
    const battle = run.battle!;
    playMusic(this, battle.kind === 'trainer' ? 'bgm.battle_trainer' : 'bgm.battle');
    this.menu = null;
    this.picker = null;
    this.advance = null;
    this.busy = true;
    this.playerSprite = null;
    this.enemySprite = null;

    // The stage theme's arena (its first type), or the default field. Elite Four
    // members and champions with a speciality fight in their own type's arena.
    const boss = this.boss();
    const bossType = boss && boss.role !== 'gym' ? boss.types[0] : undefined;
    const arena = bossType ? session.content.arenas[bossType] : run.stage ? arenaFor(session.content, getTheme(session.content, run.stage.themeId)) : undefined;
    const bg = arena && assets.has(arena) && this.textures.exists(arena) ? arena : 'bg.battle';
    if (assets.has(bg)) this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE);
    else this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x88c070).setOrigin(0);

    this.shown = { player: structuredClone(this.activeMon()), enemy: structuredClone(currentEnemy(battle)) };
    this.enemyBox = this.makeInfoBox(40, 36, false);
    this.playerBox = this.makeInfoBox(540, 270, true);
    this.header = this.add.text(GAME_WIDTH - 20, 14, '', textStyle(22, COLORS.textLight, { stroke: '#202838', strokeThickness: 4 })).setOrigin(1, 0);
    this.updateHeader();

    drawPanel(this, 8, 404, GAME_WIDTH - 16, 128, { fill: COLORS.panelDark, border: 0x101420 });
    this.message = this.add.text(32, 424, '', textStyle(30, COLORS.textLight, { wordWrap: { width: 520 }, lineSpacing: 4 }));
    this.moveInfo = this.add.text(GAME_WIDTH - 28, 500, '', textStyle(20, '#c8d0e0')).setOrigin(1, 0).setVisible(false);

    onInputAction(this, (a) => this.handleInput(a));
    this.input.on('pointerdown', () => this.advance?.());

    void this.intro();
  }

  private get run(): RunState {
    return services().session.run!;
  }

  private activeMon(): PokemonInstance {
    const run = this.run;
    return run.party[run.battle!.activeIndex]!;
  }

  private speciesName(mon: PokemonInstance): string {
    return getSpecies(services().session.content, mon.speciesId).name;
  }

  /** The gym leader, Elite Four member or champion in this battle (null for anyone else). */
  private boss(): BossInfo | null {
    const trainer = this.run.battle?.trainer;
    const role = trainer ? bossRoleForClass(trainer.classId) : null;
    return trainer?.leaderId && role ? bossInfo(services().session.content, role, trainer.leaderId) : null;
  }

  private trainerTitle(): string | null {
    const trainer = this.run.battle?.trainer;
    if (!trainer) return null;
    const boss = this.boss();
    if (boss) return boss.title;
    const cls = services().session.content.trainers.get(trainer.classId);
    return cls ? `${cls.name} ${trainer.name}` : trainer.name;
  }

  /** The opposing trainer's sprite asset and a fallback label. */
  private trainerArt(): { assetId: string; label: string } | null {
    const trainer = this.run.battle?.trainer;
    if (!trainer) return null;
    const content = services().session.content;
    const boss = this.boss();
    if (boss) return { assetId: boss.spriteAssetId, label: boss.name };
    const cls = content.trainers.get(trainer.classId);
    return cls ? { assetId: cls.spriteAssetId, label: cls.name } : null;
  }

  private names(trainer: string | null): Names {
    const party = this.run.party;
    return {
      player: this.speciesName(this.shown.player),
      enemy: this.speciesName(this.shown.enemy),
      trainer,
      nameOf: (uid) => {
        const mon = party.find((p) => p.uid === uid);
        return mon ? this.speciesName(mon) : '???';
      },
    };
  }

  // ---------- sprites and info boxes ----------

  private showSprite(side: 'player' | 'enemy', mon: PokemonInstance): Visual {
    const species = getSpecies(services().session.content, mon.speciesId);
    if (side === 'player') {
      this.playerSprite?.destroy();
      this.playerSprite = pokemonVisual(this, species, 'back', PLAYER_POS.x, PLAYER_POS.y, PIXEL_SCALE + 1, mon.shiny);
      return this.playerSprite;
    }
    this.enemySprite?.destroy();
    this.enemySprite = pokemonVisual(this, species, 'front', ENEMY_POS.x, ENEMY_POS.y, PIXEL_SCALE, mon.shiny);
    return this.enemySprite;
  }

  private makeInfoBox(x: number, y: number, isPlayer: boolean): InfoBox {
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
    container.add(this.add.text(36, 52, 'HP', textStyle(18, '#e09030')));
    const hpBar = new Bar(this, 72, 62, 280, 14, 'hp');
    hpBar.addTo(container);
    const box: InfoBox = { container, name, hpBar };
    if (isPlayer) {
      box.hpText = this.add.text(w - 20, 72, '', textStyle(22)).setOrigin(1, 0);
      container.add(box.hpText);
      box.xpBar = new Bar(this, 72, 104, 280, 8, 'xp');
      box.xpBar.addTo(container);
      container.add(this.add.text(36, 96, 'XP', textStyle(14, '#4090d0')));
    } else {
      box.teamText = this.add.text(w - 16, h - 4, '', textStyle(16, '#c03028')).setOrigin(1, 1);
      container.add(box.teamText);
    }
    container.setVisible(false);
    return box;
  }

  private refreshInfoBox(box: InfoBox, mon: PokemonInstance, animate: boolean): Promise<void> {
    const content = services().session.content;
    const max = calcStats(content, mon).hp;
    box.container.setVisible(true);
    box.name.setText(`${this.speciesName(mon)}${mon.shiny ? '★' : ''}  Lv${mon.level}`);
    box.hpText?.setText(`${Math.max(0, mon.hp)}/${max}`);
    box.statusBadge?.destroy();
    box.statusBadge = undefined;
    if (mon.status) {
      const s = STATUS_LABELS[mon.status.id]!;
      box.statusBadge = badge(this, 330, 30, s.label, s.color, 16);
      box.container.add(box.statusBadge);
    }
    if (box.xpBar) {
      const species = getSpecies(content, mon.speciesId);
      const lo = xpForLevel(species.growthRate, mon.level);
      const hi = xpForLevel(species.growthRate, mon.level + 1);
      void box.xpBar.set(mon.level >= 100 ? 1 : (mon.xp - lo) / Math.max(1, hi - lo), animate);
    }
    if (box.teamText) {
      const battle = this.run.battle;
      if (battle?.trainer) {
        box.teamText.setText(battle.enemyTeam.map((m) => (m.hp > 0 ? '●' : '○')).join(' '));
      }
    }
    return box.hpBar.set(mon.hp / max, animate);
  }

  private updateHeader(): void {
    const run = this.run;
    const stage = run.stage;
    if (!stage) {
      this.header.setText(`Encounter ${run.encountersCompleted + 1}  ·  ₽${run.money}`);
      return;
    }
    const column = stage.current ? findNode(stage.map, stage.current).column : 0;
    const content = services().session.content;
    if (stage.kind === 'league') {
      const region = run.regionOrder.length > 0 ? currentRegion(content, run).name : '';
      this.header.setText(`${region} League · Battle ${column}/${stage.map.columns}  ·  ₽${run.money}`);
      return;
    }
    const theme = getTheme(content, stage.themeId);
    this.header.setText(`Stage ${stage.index + 1} · ${theme.name} · Level ${column}/${stage.map.columns}  ·  ₽${run.money}`);
  }

  // ---------- input and messages ----------

  private handleInput(action: InputAction): void {
    if (this.picker) {
      this.picker.handle(action);
      return;
    }
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

  private clearMenus(): void {
    this.menu?.destroy();
    this.menu = null;
    this.picker?.close();
    this.picker = null;
    this.moveInfo.setVisible(false);
  }

  // ---------- intro ----------

  private async intro(): Promise<void> {
    const battle = this.run.battle!;
    const title = this.trainerTitle();
    if (battle.turn === 1 && !battle.needsSwitch) {
      const art = this.trainerArt();
      if (title && art) {
        const trainerSprite = trainerVisual(this, art.assetId, art.label, ENEMY_POS.x, ENEMY_POS.y, 2.5);
        await this.say(`${title} would like to battle!`);
        await tween(this, { targets: trainerSprite, x: GAME_WIDTH + 120, duration: 350 });
        trainerSprite.destroy();
        this.showSprite('enemy', this.shown.enemy);
        await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
        await this.say(`${title} sent out ${this.speciesName(this.shown.enemy)}!`);
      } else {
        this.showSprite('enemy', this.shown.enemy);
        await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
        await this.say(`A wild ${this.speciesName(this.shown.enemy)} appeared!`);
      }
      if (this.shown.enemy.shiny) await this.shinySparkle();
      this.showSprite('player', this.shown.player);
      await this.refreshInfoBox(this.playerBox, this.shown.player, false);
      await this.say(`Go! ${this.speciesName(this.shown.player)}!`);
    } else {
      this.showSprite('enemy', this.shown.enemy);
      await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
      if (!battle.needsSwitch) {
        this.showSprite('player', this.shown.player);
        await this.refreshInfoBox(this.playerBox, this.shown.player, false);
      }
      await this.say(`The battle continues! (turn ${battle.turn})`);
    }
    this.busy = false;
    this.nextPrompt();
  }

  private async shinySparkle(): Promise<void> {
    playSfx(this, 'se.shiny');
    const stars = [0, 1, 2, 3, 4].map((i) =>
      this.add.text(ENEMY_POS.x + Math.cos(i * 1.26) * 60, ENEMY_POS.y - 80 + Math.sin(i * 1.26) * 60, '✦', textStyle(32, '#fff4a0')).setOrigin(0.5),
    );
    await tween(this, { targets: stars, alpha: 0, scale: 2, duration: 700 });
    stars.forEach((s) => s.destroy());
    await this.say(`It's a shiny ${this.speciesName(this.shown.enemy)}!`);
  }

  /** Shows the right prompt for the current state: forced switch or the action menu. */
  private nextPrompt(): void {
    if (this.run.battle?.needsSwitch) this.openPartyPicker(true);
    else this.showRootMenu();
  }

  // ---------- menus ----------

  private showRootMenu(): void {
    this.clearMenus();
    this.message.setText(`What will ${this.speciesName(this.activeMon())} do?`);
    const options = [{ label: 'Fight' }, { label: 'Bag' }, { label: 'Pokémon' }];
    this.menu = new Menu(this, {
      x: 600,
      y: 424,
      options,
      columns: 2,
      itemWidth: 170,
      itemHeight: 46,
      fontSize: 30,
      color: COLORS.textLight,
      onSelect: (i) => {
        if (i === 0) this.showMoveMenu();
        else if (i === 1) this.openBag();
        else this.openPartyPicker(false);
      },
    });
  }

  private showMoveMenu(): void {
    const content = services().session.content;
    const mon = this.activeMon();
    const anyPp = mon.moves.some((m) => m.pp > 0);
    this.clearMenus();
    this.message.setText(`What will ${this.speciesName(mon)} do?`);
    const options = anyPp
      ? mon.moves.map((slot) => ({ label: content.moves.get(slot.id)!.name, disabled: slot.pp <= 0 }))
      : [{ label: 'Struggle' }];
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
      onSelect: (i) => void this.act({ kind: 'move', index: anyPp ? i : -1 }),
      onBack: () => this.showRootMenu(),
    });
    this.moveInfo.setVisible(true);
  }

  private battleCtx() {
    const run = this.run;
    return { content: services().session.content, battle: run.battle!, party: run.party, inventory: run.inventory };
  }

  private openBag(): void {
    const content = services().session.content;
    const run = this.run;
    const ids = Object.keys(run.inventory).filter((id) => content.items.get(id)?.usableInBattle && run.inventory[id]! > 0);
    // A Pokémon-targeted item is usable if it works on at least one party member.
    const problem = (id: string): string | null => {
      const item = content.items.get(id)!;
      if (item.target === 'party' || item.target === 'fainted') {
        const reasons = run.party.map((_, i) => itemProblem(this.battleCtx(), id, i));
        return reasons.some((r) => r === null) ? null : `No Pokémon can use the ${item.name} right now.`;
      }
      return itemProblem(this.battleCtx(), id);
    };
    this.clearMenus();
    this.picker = new Picker(this, {
      title: 'Bag',
      columns: 2,
      rowHeight: 48,
      rows: ids.map((id) => bagRow(content, run.inventory, id, problem(id))),
      onSelect: (i) => {
        const id = ids[i]!;
        const item = content.items.get(id)!;
        if (item.target === 'party' || item.target === 'fainted') this.openItemTarget(id);
        else void this.act({ kind: 'item', itemId: id });
      },
      onBack: () => this.showRootMenu(),
    });
  }

  private openItemTarget(itemId: string): void {
    const content = services().session.content;
    const run = this.run;
    const item = content.items.get(itemId)!;
    this.clearMenus();
    this.picker = new Picker(this, {
      title: `Use ${item.name} on which Pokémon?`,
      columns: 2,
      rowHeight: 78,
      rows: partyRows(content, run.party, (i) => itemProblem(this.battleCtx(), itemId, i), (i) => (i === run.battle!.activeIndex ? 'IN BATTLE' : undefined)),
      onSelect: (i) => void this.act({ kind: 'item', itemId, targetIndex: i }),
      onBack: () => this.openBag(),
    });
  }

  /** Party list for switching. `forced` after a faint: a choice must be made and it costs no turn. */
  private openPartyPicker(forced: boolean): void {
    const content = services().session.content;
    const run = this.run;
    this.clearMenus();
    this.message.setText(forced ? 'Choose a Pokémon to send out.' : '');
    this.picker = new Picker(this, {
      title: forced ? 'Send out which Pokémon?' : 'Switch to which Pokémon?',
      columns: 2,
      rowHeight: 78,
      rows: partyRows(content, run.party, (i) => switchProblem(this.battleCtx(), i), (i) => (i === run.battle!.activeIndex && !forced ? 'IN BATTLE' : undefined)),
      onSelect: (i) => void this.act({ kind: 'switch', partyIndex: i }),
      onBack: forced ? undefined : () => this.showRootMenu(),
    });
  }

  // ---------- taking a turn ----------

  private async act(action: PlayerAction): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.clearMenus();

    const { session } = services();
    const before = structuredClone(session.run!);
    const trainer = this.trainerTitle();
    let result: TurnResult;
    try {
      result = session.takeTurn(action);
    } catch (err) {
      // The menus only offer legal choices, so this means a bug; show it rather than freeze.
      await this.say(String(err instanceof Error ? err.message : err));
      this.busy = false;
      this.nextPrompt();
      return;
    }
    await this.playEvents(result.events, before, trainer);

    if (result.end) {
      await this.finish(result, trainer);
      return;
    }
    if (result.defeated) {
      await this.say('You have no Pokémon that can fight!');
      this.scene.start('GameOver');
      return;
    }
    this.busy = false;
    this.nextPrompt();
  }

  private async finish(result: TurnResult, trainer: string | null): Promise<void> {
    const content = services().session.content;
    const end = result.end!;
    if (end.outcome === 'win' && trainer) await this.say(`You defeated ${trainer}!`);
    if (end.moneyGained > 0) await this.say(`You got ₽${end.moneyGained}!`);
    if (end.badge) {
      playSfx(this, 'se.level_up');
      const leaderName = content.bosses.get(end.badge)?.name ?? end.badge;
      await this.say(`You earned ${leaderName}'s badge! (${result.run.badges.length} total)`);
      const campaign = content.campaigns.get(result.run.campaignId);
      const leagueNext = result.run.stage?.kind === 'stage' && campaign && result.run.stage.index + 1 >= campaign.stagesPerRegion;
      await this.say(leagueNext ? 'The Pokémon League awaits…' : 'The next stage awaits…');
    }
    if (end.regionCleared) {
      playSfx(this, 'se.level_up');
      const region = content.regions.get(end.regionCleared)?.name ?? end.regionCleared;
      await this.say(`You are the ${region} Champion!`);
      await this.say(end.victory ? 'You have conquered every region!' : 'A new region awaits…');
    }
    this.updateHeader();
    for (const evo of end.evolutions) {
      const fromName = getSpecies(content, evo.from).name;
      const toName = getSpecies(content, evo.to).name;
      await this.say(`What? ${fromName} is evolving!`);
      const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0);
      await tween(this, { targets: flash, alpha: 1, duration: 300, yoyo: true, hold: 200 });
      flash.destroy();
      playSfx(this, 'se.level_up');
      await this.say(`Congratulations! Your ${fromName} evolved into ${toName}!`);
      for (const m of evo.learnedMoves) await this.say(`${toName} learned ${content.moves.get(m)!.name}!`);
    }
    this.scene.start(sceneForRun(result.run));
  }

  private findMon(before: RunState, uid: string): PokemonInstance | undefined {
    return before.party.find((m) => m.uid === uid) ?? before.battle?.enemyTeam.find((m) => m.uid === uid);
  }

  private async playEvents(events: RunEvent[], before: RunState, trainer: string | null): Promise<void> {
    const { session } = services();
    const content = session.content;

    for (const e of events) {
      const side = 'side' in e ? e.side : null;
      const box = side === 'enemy' ? this.enemyBox : this.playerBox;
      const sprite = side === 'enemy' ? this.enemySprite : this.playerSprite;
      const mon = side ? this.shown[side] : null;
      let preText: string | null = null;
      switch (e.type) {
        case 'damage':
        case 'residual':
        case 'recoil':
        case 'drain':
          mon!.hp = e.hpAfter;
          if (e.type !== 'drain') {
            playSfx(this, e.type === 'damage' && e.effectiveness > 1 ? 'se.hit_strong' : e.type === 'damage' && e.effectiveness < 1 ? 'se.hit_weak' : 'se.hit');
            if (sprite) this.tweens.add({ targets: sprite, alpha: 0.2, yoyo: true, repeat: 2, duration: 70 });
          }
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'status':
          mon!.status = { id: e.status };
          void this.refreshInfoBox(box, mon!, false);
          break;
        case 'wake':
        case 'thaw':
          mon!.status = null;
          void this.refreshInfoBox(box, mon!, false);
          break;
        case 'lastStand':
          mon!.hp = 1;
          if (sprite) this.tweens.add({ targets: sprite, x: sprite.x + 8, yoyo: true, repeat: 3, duration: 50 });
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'faint':
          mon!.hp = 0;
          playSfx(this, 'se.faint');
          if (sprite) await tween(this, { targets: sprite, alpha: 0, y: sprite.y + 30, duration: 400 });
          break;
        case 'switchOut':
          if (sprite) await tween(this, { targets: sprite, alpha: 0, duration: 250 });
          break;
        case 'switchIn': {
          const incoming = this.findMon(before, e.uid);
          if (incoming) {
            this.shown[e.side] = structuredClone(incoming);
            this.showSprite(e.side, this.shown[e.side]);
            await this.refreshInfoBox(e.side === 'enemy' ? this.enemyBox : this.playerBox, this.shown[e.side], false);
          }
          break;
        }
        case 'item': {
          preText = `You used the ${content.items.get(e.itemId)?.name ?? 'item'}!`;
          break;
        }
        case 'ball':
          await this.say(`You threw a ${content.items.get(e.itemId)?.name ?? 'ball'}!`);
          await this.animateBall(e.itemId, e.shakes, e.caught);
          break;
        case 'xp':
          if (e.uid === this.shown.player.uid) {
            this.shown.player.xp += e.amount;
            playSfx(this, 'se.exp', 0.6);
            void this.refreshInfoBox(this.playerBox, this.shown.player, true);
          }
          break;
        case 'levelUp':
          playSfx(this, 'se.level_up');
          if (e.uid === this.shown.player.uid) {
            const real = this.run.party.find((m) => m.uid === e.uid);
            this.shown.player.level = e.level;
            if (real && real.level === e.level) this.shown.player.hp = real.hp;
            void this.refreshInfoBox(this.playerBox, this.shown.player, false);
          }
          break;
        default:
          break;
      }
      if (preText) await this.say(preText);
      if (e.type === 'item' && e.targetUid === this.shown.player.uid) {
        this.shown.player.hp = e.hpAfter;
        const real = this.run.party.find((m) => m.uid === e.targetUid);
        if (real) this.shown.player.status = real.status;
        await this.refreshInfoBox(this.playerBox, this.shown.player, true);
      }
      const text = eventText(content, this.names(trainer), e);
      if (text) await this.say(text);
    }
    // Make sure the boxes match the real state at the end of the turn.
    const run = this.run;
    if (run.battle) {
      const active = run.party[run.battle.activeIndex];
      if (active && active.uid === this.shown.player.uid) {
        this.shown.player = structuredClone(active);
        await this.refreshInfoBox(this.playerBox, this.shown.player, false);
      }
      this.shown.enemy = structuredClone(currentEnemy(run.battle));
      await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
    } else {
      const active = run.party.find((m) => m.uid === this.shown.player.uid);
      if (active) await this.refreshInfoBox(this.playerBox, active, false);
    }
    this.updateHeader();
  }

  /** Throw, wobble, and either click shut or burst open. */
  private async animateBall(itemId: string, shakes: number, caught: boolean): Promise<void> {
    const item = services().session.content.items.get(itemId);
    const ball = itemVisual(this, item?.iconAssetId ?? 'ball.pb', 200, 380, 3) as Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    playSfx(this, 'se.ball_throw');
    const targetY = ENEMY_POS.y - 60;
    await tween(this, { targets: ball, x: ENEMY_POS.x, y: targetY, duration: 450, ease: 'Quad.easeOut' });
    if (this.enemySprite) await tween(this, { targets: this.enemySprite, scale: 0.01, alpha: 0, duration: 250 });
    await tween(this, { targets: ball, y: ENEMY_POS.y - 20, duration: 250, ease: 'Bounce.easeOut' });
    for (let i = 0; i < shakes; i++) {
      await sleep(this, 250);
      playSfx(this, 'se.ball_shake');
      await tween(this, { targets: ball, angle: i % 2 === 0 ? 20 : -20, duration: 120, yoyo: true });
    }
    await sleep(this, 250);
    if (caught) {
      playSfx(this, 'se.ball_catch');
      await tween(this, { targets: ball, alpha: 0.6, duration: 150, yoyo: true });
      return;
    }
    playSfx(this, 'se.ball_release');
    ball.destroy();
    this.showSprite('enemy', this.shown.enemy);
  }
}
