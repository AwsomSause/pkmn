// The battle screen, for wild and trainer battles. All rules run in the core
// battle engine; this scene only shows the state, collects the player's
// choice (Fight / Bag / Pokémon) and plays back the events each turn produces.

import Phaser from 'phaser';
import { forcedMoveIndex, itemProblem, switchProblem, type PlayerAction } from '../core/battle/engine';
import { megaOptions, ownedMegaForms, stoneForms } from '../core/battle/transform';
import { calcStats, getSpecies, maxPp, xpForLevel } from '../core/pokemon';
import { bossRoleForClass } from '../core/encounters';
import { findNode } from '../core/map';
import { bossInfo, currentRegion, type BossInfo } from '../core/regions';
import type { RunEvent, TurnResult } from '../core/run';
import type { PresentationCue } from '../core/story/queue';
import { currentEnemy, type PokemonInstance, type RunState } from '../core/state';
import { arenaFor, getTheme } from '../core/themes';
import { services } from '../game/services';
import { playCry, playMusic, playSfx } from '../ui/audio';
import { eventText, type Names } from '../ui/battleText';
import { onInputAction, type InputAction } from '../ui/input';
import { bagRow, partyRows, Picker } from '../ui/partyPanel';
import { itemVisual, pokemonVisual, trainerVisual, type Visual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, STATUS_LABELS, TYPE_COLORS, textStyle } from '../ui/theme';
import { Bar, badge, drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';
import { planCues } from '../core/presentation/cues';
import { presentationFor } from '../core/presentation/moveAnims';
import { moveAnims } from '../data/presentation';
import { BattleFx } from '../ui/battleFx/battleFx';

const MESSAGE_AUTO_ADVANCE_MS = 1400;
// Where the Pokémon stand: on the arena's ground patches (PokeRogue's layout).
const ENEMY_POS = { x: 648, y: 246 };
const PLAYER_POS = { x: 312, y: 400 };
/** The bottom message bar, and the command window on its right. */
const MESSAGE_Y = 396;
const COMMAND_X = 588;

interface InfoBox {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  /** Where a status badge goes inside the box. */
  statusAt: { x: number; y: number };
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
  private commandWindow!: Phaser.GameObjects.Graphics;
  private playerBox!: InfoBox;
  private enemyBox!: InfoBox;
  private playerSprite: Visual | null = null;
  private enemySprite: Visual | null = null;
  private header!: Phaser.GameObjects.Text;
  /** The arena and both Pokémon: what move animations draw among and screen shake moves (the menus stay still). */
  private field!: Phaser.GameObjects.Container;
  /** Index in `field` just above the arena art. */
  private fieldBase = 0;
  private fx!: BattleFx;
  private advance: (() => void) | null = null;
  private busy = false;
  /** The Mega form the player chose to Mega Evolve into with their next move (null = off). */
  private megaChoice: string | null = null;
  /** What the screen currently shows for each side (may lag the real state during playback). */
  private shown!: { player: PokemonInstance; enemy: PokemonInstance };

  constructor() {
    super('Battle');
  }

  preload(): void {
    // Every party member (switching), the whole enemy team, and the cries.
    const { session } = services();
    const { content } = session;
    const run = session.run;
    const enemies = (run?.battle?.enemyTeam ?? []).flatMap((m) => content.species.get(m.speciesId) ?? []);
    preloadPokemon(this, partySpecies(), { back: true, shiny: true, icon: true, cry: true });
    preloadPokemon(this, enemies, { front: true, shiny: true, cry: true });
    // Forms they might transform into this battle (Megas for stones you own; any Mega or Primal for the enemy).
    const formsOf = (ids: string[]) => ids.flatMap((id) => content.species.get(id) ?? []);
    const partyForms = (run?.party ?? []).flatMap((m) => [...ownedMegaForms(content, run!.inventory, m), ...stoneForms(content, m.speciesId, true)].map((o) => o.formId));
    const enemyForms = (run?.battle?.enemyTeam ?? []).flatMap((m) => [...stoneForms(content, m.speciesId, false), ...stoneForms(content, m.speciesId, true)].map((o) => o.formId));
    preloadPokemon(this, formsOf(partyForms), { back: true, shiny: true, cry: true });
    preloadPokemon(this, formsOf(enemyForms), { front: true, shiny: true, cry: true });
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
    this.field = this.add.container(0, 0);
    if (assets.has(bg)) this.field.add(this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE));
    else this.field.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x88c070).setOrigin(0));
    // The ground patches each side stands on.
    for (const side of ['enemy', 'player']) {
      const key = `${bg}.${side}`;
      if (assets.has(key) && this.textures.exists(key)) this.field.add(this.add.image(0, 0, key).setOrigin(0).setScale(PIXEL_SCALE));
    }
    this.fieldBase = this.field.length;
    this.fx = new BattleFx(this, {
      field: this.field,
      backgroundIndex: () => this.fieldBase,
      sprite: (side) => (side === 'player' ? this.playerSprite : this.enemySprite),
    });

    this.shown = { player: structuredClone(this.activeMon()), enemy: structuredClone(currentEnemy(battle)) };
    this.enemyBox = this.makeInfoBox(0, 30, false);
    this.playerBox = this.makeInfoBox(GAME_WIDTH - 390, MESSAGE_Y - 132, true);
    this.header = this.add.text(GAME_WIDTH - 16, 10, '', textStyle(20, COLORS.textLight, { stroke: '#181818', strokeThickness: 4 })).setOrigin(1, 0);
    this.updateHeader();

    // PokeRogue's message bar along the bottom, with the command window on its right.
    if (this.textures.exists('ui.message_bg')) {
      this.add.image(0, MESSAGE_Y, 'ui.message_bg').setOrigin(0).setScale(PIXEL_SCALE).setCrop(0, 0, 320, 48);
    } else {
      drawPanel(this, 0, MESSAGE_Y, GAME_WIDTH, GAME_HEIGHT - MESSAGE_Y);
    }
    this.commandWindow = drawPanel(this, COMMAND_X, MESSAGE_Y, GAME_WIDTH - COMMAND_X, GAME_HEIGHT - MESSAGE_Y).setVisible(false);
    this.message = this.add.text(36, MESSAGE_Y + 24, '', textStyle(30, COLORS.textLight, { wordWrap: { width: 520 }, lineSpacing: 6 }));
    this.moveInfo = this.add.text(COMMAND_X + 30, MESSAGE_Y + 24, '', textStyle(24, COLORS.textLight, { lineSpacing: 8 })).setVisible(false);

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

  private showSprite(side: 'player' | 'enemy', mon: PokemonInstance, cry = true): Visual {
    const species = getSpecies(services().session.content, mon.speciesId);
    if (cry) playCry(this, species);
    if (side === 'player') {
      this.playerSprite?.destroy();
      this.playerSprite = pokemonVisual(this, species, 'back', PLAYER_POS.x, PLAYER_POS.y, PIXEL_SCALE + 1, mon.shiny);
      this.field.add(this.playerSprite);
      this.prefetchMoves(mon);
      return this.playerSprite;
    }
    this.enemySprite?.destroy();
    this.enemySprite = pokemonVisual(this, species, 'front', ENEMY_POS.x, ENEMY_POS.y, PIXEL_SCALE, mon.shiny);
    // The foe stands behind the player's Pokémon.
    this.field.addAt(this.enemySprite, this.fieldBase);
    this.prefetchMoves(mon);
    return this.enemySprite;
  }

  /** Starts loading the animations of a Pokémon's moves while the player reads. */
  private prefetchMoves(mon: PokemonInstance): void {
    const data = moveAnims();
    this.fx.prefetch(mon.moves.map((m) => presentationFor(data, m.id).anim));
  }

  private makeInfoBox(x: number, y: number, isPlayer: boolean): InfoBox {
    const container = this.add.container(x, y);
    const art = isPlayer ? 'ui.pbinfo_player' : 'ui.pbinfo_enemy';
    if (this.textures.exists(art)) {
      // PokeRogue's info box art (130×42 for the player, 130×31 for the foe), drawn 3× larger.
      container.add(this.add.image(0, 0, art).setOrigin(0).setScale(PIXEL_SCALE));
    } else {
      container.add(drawPanel(this, isPlayer ? 18 : 0, 12, 372, isPlayer ? 102 : 66));
    }
    // Text and bar positions follow the art's slots (art pixel × 3).
    const left = isPlayer ? 48 : 24;
    const right = isPlayer ? 366 : 342;
    const name = this.add.text(left, 14, '', textStyle(26));
    const level = this.add.text(right, 14, '', textStyle(24)).setOrigin(1, 0);
    container.add([name, level]);
    const hpX = isPlayer ? 210 : 177;
    container.add(this.add.text(hpX - 8, 63, 'HP', textStyle(15, '#f8a030', { shadow: undefined })).setOrigin(1, 0.5));
    const hpBar = new Bar(this, hpX, 63, 144, 6, 'hp');
    hpBar.addTo(container);
    const box: InfoBox = { container, name, level, hpBar, statusAt: { x: left, y: isPlayer ? 80 : 80 } };
    if (isPlayer) {
      box.hpText = this.add.text(right, 76, '', textStyle(24)).setOrigin(1, 0);
      container.add(box.hpText);
      box.xpBar = new Bar(this, 123, 120, 255, 6, 'xp');
      box.xpBar.addTo(container);
    } else {
      box.teamText = this.add.text(right, 80, '', textStyle(18, '#f8f8f8', { stroke: '#181818', strokeThickness: 4 })).setOrigin(1, 0);
      container.add(box.teamText);
    }
    container.setVisible(false);
    return box;
  }

  private refreshInfoBox(box: InfoBox, mon: PokemonInstance, animate: boolean): Promise<void> {
    const content = services().session.content;
    const max = calcStats(content, mon).hp;
    box.container.setVisible(true);
    box.name.setText(`${this.speciesName(mon)}${mon.shiny ? ' ★' : ''}`);
    box.level.setText(`Lv${mon.level}`);
    box.hpText?.setText(`${Math.max(0, mon.hp)}/${max}`);
    box.statusBadge?.destroy();
    box.statusBadge = undefined;
    if (mon.status) {
      const s = STATUS_LABELS[mon.status.id]!;
      box.statusBadge = badge(this, box.statusAt.x, box.statusAt.y, s.label, s.color, 16);
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
    if (this.fx.busy && (action === 'confirm' || action === 'back')) {
      this.fx.skip();
      return;
    }
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
    this.commandWindow.setVisible(false);
    this.message.setVisible(true);
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
      this.showSprite('enemy', this.shown.enemy, false);
      await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
      if (!battle.needsSwitch) {
        this.showSprite('player', this.shown.player, false);
        await this.refreshInfoBox(this.playerBox, this.shown.player, false);
      }
      await this.say(`The battle continues! (turn ${battle.turn})`);
    }
    // Entry abilities (Intimidate, Drizzle) of the first two Pokémon.
    const { session } = services();
    if ((battle.pendingEntry ?? []).length > 0 && !battle.needsSwitch) {
      const before = structuredClone(session.run!);
      const events = session.beginBattle();
      await this.playEvents(events, before, title);
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
    if (this.run.battle?.needsSwitch) {
      this.openPartyPicker(true);
      return;
    }
    // In the middle of a two-turn move or Thrash, the Pokémon carries on by itself.
    const forced = this.run.battle ? forcedMoveIndex(this.run.battle, this.run.party) : null;
    if (forced !== null) void this.act({ kind: 'move', index: forced });
    else this.showRootMenu();
  }

  // ---------- menus ----------

  private showRootMenu(): void {
    this.clearMenus();
    const content = services().session.content;
    // Mega Evolution: a fourth option that cycles off -> each Mega form (Charizard X, Y) -> off.
    const megas = megaOptions(this.battleCtx());
    if (!megas.some((o) => o.formId === this.megaChoice)) this.megaChoice = null;
    const ready = this.megaChoice ? ` It will Mega Evolve into ${content.species.get(this.megaChoice)?.name}!` : '';
    this.message.setText(`What will ${this.speciesName(this.activeMon())} do?${ready}`);
    const options = [{ label: 'Fight' }, { label: 'Bag' }, { label: 'Pokémon' }];
    if (megas.length > 0) options.push({ label: this.megaChoice ? 'Mega: ON' : 'Mega: OFF' });
    this.commandWindow.setVisible(true);
    this.menu = new Menu(this, {
      x: COMMAND_X + 24,
      y: MESSAGE_Y + 26,
      options,
      columns: 2,
      itemWidth: 170,
      itemHeight: 50,
      fontSize: 30,
      color: COLORS.textLight,
      onSelect: (i) => {
        if (i === 0) this.showMoveMenu();
        else if (i === 1) this.openBag();
        else if (i === 2) this.openPartyPicker(false);
        else {
          const at = megas.findIndex((o) => o.formId === this.megaChoice);
          this.megaChoice = megas[at + 1]?.formId ?? null;
          this.showRootMenu();
        }
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
    // Moves fill the message bar; the command window shows the focused move's details.
    this.message.setVisible(false);
    this.commandWindow.setVisible(true);
    this.menu = new Menu(this, {
      x: 30,
      y: MESSAGE_Y + 26,
      options,
      columns: 2,
      itemWidth: 270,
      itemHeight: 50,
      fontSize: 28,
      color: COLORS.textLight,
      onFocus: (i) => {
        const slot = mon.moves[i];
        if (!anyPp || !slot) {
          this.moveInfo.setText('Your Pokémon has no PP left');
          return;
        }
        const move = content.moves.get(slot.id)!;
        const power = move.power ?? (move.effects.fixedDamage ? 'Lv' : '—');
        this.moveInfo.setText(`PP  ${slot.pp}/${maxPp(content, slot)}\n${move.type.toUpperCase()}  ·  ${move.category}\nPower ${power}`);
        this.moveInfo.setColor(Phaser.Display.Color.IntegerToColor(TYPE_COLORS[move.type] ?? 0xffffff).rgba);
      },
      onSelect: (i) => {
        const mega = this.megaChoice;
        this.megaChoice = null;
        void this.act({ kind: 'move', index: anyPp ? i : -1, ...(mega ? { transform: { kind: 'mega' as const, formId: mega } } : {}) });
      },
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
    await this.playEvents(result.events, before, trainer, result.cues);

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
    for (const id of end.itemsFound) await this.say(`You found a ${content.items.get(id)?.name ?? id}!`);
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

  /** The Pokémon as the run has it now (after the turn), for statuses an item gave. */
  private findLive(side: 'player' | 'enemy', uid: string): PokemonInstance | undefined {
    const run = services().session.run;
    return side === 'player' ? run?.party.find((m) => m.uid === uid) : run?.battle?.enemyTeam.find((m) => m.uid === uid);
  }

  private findMon(before: RunState, uid: string): PokemonInstance | undefined {
    return before.party.find((m) => m.uid === uid) ?? before.battle?.enemyTeam.find((m) => m.uid === uid);
  }

  private async playEvents(events: RunEvent[], before: RunState, trainer: string | null, storyCues: PresentationCue[] = []): Promise<void> {
    const { session } = services();
    const content = session.content;
    const { battleAnimations, effectIntensity } = session.settings;
    // What the screen shows for each event; worked out from the finished turn, so it can't change it.
    const cues = planCues(events, content, moveAnims(), { mode: battleAnimations, intensity: effectIntensity });

    for (const [index, e] of events.entries()) {
      // "Charmander used Ember!" goes up before its animation; other messages follow theirs.
      if (e.type === 'move') this.message.setText(eventText(content, this.names(trainer), e) ?? '');
      await this.fx.play(cues[index] ?? []);
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
        case 'heal':
        case 'confusionHit':
        case 'bindDamage':
        case 'seedDamage':
        case 'weatherDamage':
          mon!.hp = e.hpAfter;
          if (e.type !== 'drain' && e.type !== 'heal') {
            playSfx(this, e.type === 'damage' && e.effectiveness > 1 ? 'se.hit_strong' : e.type === 'damage' && e.effectiveness < 1 ? 'se.hit_weak' : 'se.hit');
            // Damage from moves blinks in its impact cue; residual damage blinks here.
            if (sprite && e.type !== 'damage' && battleAnimations !== 'off') this.tweens.add({ targets: sprite, alpha: 0.2, yoyo: true, repeat: 2, duration: 70 });
          }
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'status':
          mon!.status = { id: e.status };
          void this.refreshInfoBox(box, mon!, false);
          break;
        case 'wake':
        case 'thaw':
        case 'cured':
          mon!.status = null;
          void this.refreshInfoBox(box, mon!, false);
          break;
        case 'lastStand':
          mon!.hp = 1;
          if (sprite) this.tweens.add({ targets: sprite, x: sprite.x + 8, yoyo: true, repeat: 3, duration: 50 });
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'selfKo':
          mon!.hp = 0;
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
        case 'held': {
          // A held item did something: show its HP, status and held items as they are now.
          if (mon) {
            if (e.hpAfter !== undefined) mon.hp = e.hpAfter;
            if (e.what === 'cure') mon.status = null;
            if (e.what === 'orb') mon.status = this.findLive(side!, mon.uid)?.status ?? mon.status;
            await this.refreshInfoBox(box, mon, e.hpAfter !== undefined);
          }
          break;
        }
        case 'transform': {
          // Presentation cue only: a flash and the new form's sprite (full cinematics are M9.5).
          if (e.kind === 'mega' && e.itemId) await this.say(`${this.speciesName(mon!)}'s ${content.items.get(e.itemId)?.name ?? 'Mega Stone'} is reacting to your Mega Ring!`);
          const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0);
          await tween(this, { targets: flash, alpha: 0.9, duration: 250, yoyo: true, hold: 150 });
          flash.destroy();
          mon!.speciesId = e.to;
          this.showSprite(e.side, mon!);
          await this.refreshInfoBox(box, mon!, false);
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
      // A story moment replaces the event's own line with its own (and a banner when it is a major one).
      const cue = storyCues.find((c) => c.at === index);
      if (cue) {
        this.showMoment(cue, battleAnimations === 'full' && effectIntensity > 0);
        for (const line of cue.messages) await this.say(line);
        continue;
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

  /**
   * A story moment's banner and aura. Presentation only: it never touches the
   * run, and if it fails the battle carries on with just the text.
   */
  /** `motion` is false under reduced motion or no animations: the banner still shows, without shake or aura. */
  private showMoment(cue: PresentationCue, motion: boolean): void {
    if (!cue.major) return;
    try {
      const color = Phaser.Display.Color.HexStringToColor(cue.color).color;
      if (cue.sound) playSfx(this, cue.sound);
      if (cue.shake && motion) this.cameras.main.shake(220, 0.006);
      const band = this.add.rectangle(GAME_WIDTH / 2, 132, GAME_WIDTH, 54, color, 0.85).setDepth(50).setAlpha(0);
      const title = this.add.text(GAME_WIDTH / 2, 132, cue.title, textStyle(30, '#ffffff', { stroke: '#202030', strokeThickness: 4 })).setOrigin(0.5).setDepth(51).setAlpha(0);
      this.tweens.add({ targets: [band, title], alpha: 1, duration: 180, hold: 1300, yoyo: true, onComplete: () => { band.destroy(); title.destroy(); } });
      if (motion) {
        const aura = this.add.circle(PLAYER_POS.x, PLAYER_POS.y - 40, 90, color, 0.35).setDepth(1).setScale(0.6);
        this.tweens.add({ targets: aura, scale: 1.3, alpha: 0, duration: 900, onComplete: () => aura.destroy() });
      }
    } catch (err) {
      console.warn('Story moment could not be shown', err);
    }
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
