// The battle screen, for wild and trainer battles. All rules run in the core
// battle engine; this scene only shows the state, collects the player's
// choice (Fight / Bag / Pokémon) and plays back the events each turn produces.

import { genderSign } from '../core/gender';
import { hasPerk } from '../core/mapItems';
import Phaser from 'phaser';
import { forcedMoveId, forcedMoveIndex, itemProblem, switchProblem, type PlayerAction, type Side, type SlotCommand } from '../core/battle/engine';
import { ALLY_AIMED, doublesSwitchProblem, indexAt, monAt, needsTarget, primarySpot, volAt, type Spot } from '../core/battle/doubles';
import { canDynamax, maxMoveOptions, permanentForm, stoneForms, teraOption, zMoveOptions, type TransformRequest } from '../core/battle/transform';
import { runPerks } from '../core/archetypes';
import { calcStats, getSpecies, maxPp, xpForLevel } from '../core/pokemon';
import { bossRoleForClass } from '../core/encounters';
import { findNode } from '../core/map';
import { bossInfo, currentRegion, type BossInfo } from '../core/regions';
import type { RunEvent, TurnResult } from '../core/run';
import { noBattleItems } from '../core/rules';
import type { PresentationCue } from '../core/story/queue';
import { currentEnemy, type PokemonInstance, type RunState } from '../core/state';
import { arenaFor, getTheme } from '../core/themes';
import { services } from '../game/services';
import { playCry, playMusic, playSfx } from '../ui/audio';
import { eventText, fixedDamageLabel, type Names } from '../ui/battleText';
import { onInputAction, type InputAction } from '../ui/input';
import { bagRow, partyRows, Picker } from '../ui/partyPanel';
import { itemVisual, pokemonVisual, trainerVisual, type Visual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, STATUS_LABELS, TYPE_COLORS, mixColor, textStyle } from '../ui/theme';
import { Bar, badge, drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';
import { planCues } from '../core/presentation/cues';
import { DRAMA_LIBRARY, type DramaLine } from '../core/drama';
import { wouldRefuse } from '../core/bond';
import { presentationFor } from '../core/presentation/moveAnims';
import { moveAnims } from '../data/presentation';
import { BattleFx } from '../ui/battleFx/battleFx';
import { addAmbience, arenaType } from '../ui/battleFx/ambience';
import { burstReveal, exitWipe, hop, introTransition, stamp, titleCard, type Beat, type IntroKind } from '../ui/battleFx/spectacle';
import { AERO, FLAG_ICONS, bounceIn, breathe, categoryIcon, drawGlass, effectivenessIcon, effectivenessWord, slideIn, statusIcon, typeLabel, type MotionLevel } from '../ui/aero';
import { typeEffectiveness } from '../core/battle/damage';
import type { Move, TypeName } from '../core/contentSchema';

const MESSAGE_AUTO_ADVANCE_MS = 1400;
// Where the Pokémon stand: on the arena's ground patches (PokeRogue's layout).
const ENEMY_POS = { x: 648, y: 246 };
const PLAYER_POS = { x: 312, y: 400 };
/** The bottom message bar, and the command window on its right. */
const MESSAGE_Y = 396;
/** A Dynamaxed Pokémon is drawn this much larger (a stand-in until the M9.5 effect). */
const DYNAMAX_SCALE = 1.35;
const COMMAND_X = 588;
/** Double battles: where each spot stands (left, right) and the databox spots. */
const DUO_POS = {
  player: [
    { x: 176, y: 414 },
    { x: 392, y: 404 },
  ],
  enemy: [
    { x: 500, y: 212 },
    { x: 668, y: 228 },
  ],
} as const;
const DUO_SCALE = { player: 0.72, enemy: 0.85 } as const;
const DUO_BOX = { scale: 0.6, enemy: [{ x: 4, y: 6 }, { x: 4, y: 72 }], player: [{ x: GAME_WIDTH - 236, y: 236 }, { x: GAME_WIDTH - 236, y: 316 }] } as const;

/** The spot the screen isn't focused on in a double battle (see battle/doubles.ts: focus). */
interface DuoOther {
  sprite: Visual | null;
  box: InfoBox;
  mon: PokemonInstance | null;
}

/** Databox and title-card rim colour for each kind of opponent. */
const ROLE_RIMS = { wild: 0xff4fd8, trainer: 0xff8a3c, rival: 0xff3048, gym: 0xffc840, elite: 0xb070ff, champion: 0xfff4a0 } as const;

interface InfoBox {
  container: Phaser.GameObjects.Container;
  isPlayer: boolean;
  name: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  /** Where a status badge goes inside the box. */
  statusAt: { x: number; y: number };
  hpBar: Bar;
  hpText?: Phaser.GameObjects.Text;
  xpBar?: Bar;
  teamText?: Phaser.GameObjects.Text;
  statusBadge?: Phaser.GameObjects.Container;
  /** "TERA WATER" while the Pokémon is Terastallized. */
  teraBadge?: Phaser.GameObjects.Container;
  rageBadge?: Phaser.GameObjects.Container;
  /** EBDX's Mega / Dynamax symbol beside the name. */
  formIcon?: Phaser.GameObjects.Image;
  /** A soft red glow behind the box while HP is low. */
  danger?: Phaser.GameObjects.Graphics;
}

const sleep = (scene: Phaser.Scene, ms: number) => new Promise<void>((resolve) => scene.time.delayedCall(ms, resolve));
const tween = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));

export class BattleScene extends Phaser.Scene {
  private message!: Phaser.GameObjects.Text;
  private menu: Menu | null = null;
  private picker: Picker | null = null;
  private moveInfo!: Phaser.GameObjects.Text;
  /** The focused move's type label and category icon (Essentials art). */
  private moveBadges: Phaser.GameObjects.Container | null = null;
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
  /** The stage's types, for the ambience and the intro. */
  private arenaTypes: readonly string[] = [];
  /** Raid / Totem status line (shield, phases, ally calls). */
  private status!: Phaser.GameObjects.Text;
  private fx!: BattleFx;
  private advance: (() => void) | null = null;
  private busy = false;
  /** The transformation the player chose to do with their next move (null = off). */
  private transformChoice: TransformRequest | null = null;
  /** What the screen currently shows for each side (may lag the real state during playback). */
  private shown!: { player: PokemonInstance; enemy: PokemonInstance };
  /** The opposing Pokémon shown as riled up (warned, not yet unleashed or calmed). Presentation only. */
  private riledUid: string | null = null;
  /**
   * Double battles: which spot each side's focused Pokémon stands in (the one in playerSprite /
   * playerBox / shown.player), and the other spot's sprite, box and Pokémon. Null in singles.
   */
  private duo: { focus: Record<Side, Spot>; other: Record<Side, DuoOther> } | null = null;
  /** Double battles: the spot being given a command, and the commands so far this turn. */
  private cmdSpot: Spot = 0;
  private commands: (SlotCommand | null)[] = [];

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
    const partyForms = (run?.party ?? []).flatMap((m) => [
      ...stoneForms(content, m.speciesId, true).map((o) => o.formId),
      ...[permanentForm(content, run!.inventory, m)?.option.formId ?? []].flat(),
    ]);
    const enemyForms = (run?.battle?.enemyTeam ?? []).flatMap((m) => [...stoneForms(content, m.speciesId, false), ...stoneForms(content, m.speciesId, true)].map((o) => o.formId));
    preloadPokemon(this, formsOf(partyForms), { back: true, shiny: true, cry: true });
    preloadPokemon(this, formsOf(enemyForms), { front: true, shiny: true, cry: true });
  }

  create(): void {
    const { session, assets } = services();
    const run = session.run!;
    const battle = run.battle!;
    // Presentation only: faster tweens and timers; the battle itself is unchanged.
    const speed = { normal: 1, fast: 2, quick: 3 }[session.settings.battleSpeed];
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
    playMusic(this, this.raidArena(battle)?.replace('bg.raid.', 'bgm.raid.').replace('tera2', 'tera') ?? (battle.kind === 'trainer' ? 'bgm.battle_trainer' : 'bgm.battle'));
    this.menu = null;
    this.picker = null;
    this.advance = null;
    this.busy = true;
    this.riledUid = Object.entries(battle.hyper?.rage ?? {}).find(([, r]) => r.state === 'warned')?.[0] ?? null;
    this.playerSprite = null;
    this.enemySprite = null;

    // The stage theme's arena (its first type), or the default field. Elite Four
    // members and champions with a speciality fight in their own type's arena.
    const boss = this.boss();
    const bossType = boss && boss.role !== 'gym' ? boss.types[0] : undefined;
    const arena = bossType ? session.content.arenas[bossType] : run.stage ? arenaFor(session.content, getTheme(session.content, run.stage.themeId)) : undefined;
    const raidArena = this.raidArena(battle);
    const bg = raidArena ?? (arena && assets.has(arena) && this.textures.exists(arena) ? arena : 'bg.battle');
    this.field = this.add.container(0, 0);
    if (assets.has(bg)) this.field.add(this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE));
    else this.field.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x88c070).setOrigin(0));
    // The ground patches each side stands on.
    for (const side of ['enemy', 'player']) {
      const key = `${bg}.${side}`;
      if (assets.has(key) && this.textures.exists(key)) this.field.add(this.add.image(0, 0, key).setOrigin(0).setScale(PIXEL_SCALE));
    }
    // Drifting clouds, bubbles, snow or embers over the arena (EBDX scenery).
    // One preset per type: the stage theme's types (the second adds accents), a specialist's type, or the arena's.
    const stageTypes = bossType ? [bossType] : run.stage ? getTheme(session.content, run.stage.themeId).types : [arenaType(bg)];
    this.arenaTypes = stageTypes.length > 0 ? stageTypes : [arenaType(bg)];
    addAmbience(this, this.field, this.field.length, this.arenaTypes, this.motion);
    this.fieldBase = this.field.length;
    this.fx = new BattleFx(this, {
      field: this.field,
      backgroundIndex: () => this.fieldBase,
      sprite: (side) => (side === 'player' ? this.playerSprite : this.enemySprite),
    });

    this.shown = { player: structuredClone(run.party[battle.activeIndex]!), enemy: structuredClone(currentEnemy(battle)) };
    this.duo = null;
    this.cmdSpot = 0;
    this.commands = [];
    if (battle.doubles) {
      // Two databoxes a side, smaller; the focused spot's box is enemyBox / playerBox.
      const d = battle.doubles;
      const box = (side: Side, spot: Spot) => {
        const b = this.makeInfoBox(DUO_BOX[side][spot].x, DUO_BOX[side][spot].y, side === 'player');
        b.container.setScale(DUO_BOX.scale);
        return b;
      };
      const focus = { player: primarySpot(d, 'player'), enemy: primarySpot(d, 'enemy') };
      this.playerBox = box('player', focus.player);
      this.enemyBox = box('enemy', focus.enemy);
      const otherMon = (side: Side) => {
        const m = monAt({ battle, party: run.party }, side, focus[side] === 0 ? 1 : 0);
        return m ? structuredClone(m) : null;
      };
      this.duo = {
        focus,
        other: {
          player: { sprite: null, box: box('player', focus.player === 0 ? 1 : 0), mon: otherMon('player') },
          enemy: { sprite: null, box: box('enemy', focus.enemy === 0 ? 1 : 0), mon: otherMon('enemy') },
        },
      };
    } else {
      this.enemyBox = this.makeInfoBox(0, 30, false);
      this.playerBox = this.makeInfoBox(GAME_WIDTH - 390, MESSAGE_Y - 132, true);
    }
    this.header = this.add.text(GAME_WIDTH - 16, 10, '', textStyle(20, COLORS.textLight, { stroke: '#181818', strokeThickness: 4 })).setOrigin(1, 0);
    // Raid and Totem status sits under the enemy's box, away from the boss sprite.
    this.status = this.add.text(12, 186, '', textStyle(18, COLORS.textLight, { stroke: '#181818', strokeThickness: 4, wordWrap: { width: 470 } }));
    this.updateHeader();

    // PokeRogue's message bar along the bottom, with the command window on its right.
    // A glossy glass message bar (Aero), with the command window on its right.
    const bar = drawGlass(this, 8, MESSAGE_Y + 8, GAME_WIDTH - 16, GAME_HEIGHT - MESSAGE_Y - 16, { radius: 22 });
    slideIn(this, bar, 0, 60, this.motion);
    this.commandWindow = drawGlass(this, COMMAND_X, MESSAGE_Y + 14, GAME_WIDTH - COMMAND_X - 16, GAME_HEIGHT - MESSAGE_Y - 28, { tint: AERO.glassLow, rim: AERO.sky, glow: false, radius: 18 }).setVisible(false);
    this.message = this.add.text(36, MESSAGE_Y + 24, '', textStyle(30, COLORS.textLight, { wordWrap: { width: 520 }, lineSpacing: 6 }));
    this.moveInfo = this.add.text(COMMAND_X + 30, MESSAGE_Y + 24, '', textStyle(24, COLORS.textLight, { lineSpacing: 8 })).setVisible(false);

    onInputAction(this, (a) => this.handleInput(a));
    this.input.on('pointerdown', () => this.advance?.());

    void this.intro();
  }

  /** How much motion the player allows (the battle animation setting). */
  private get motion(): MotionLevel {
    return services().session.settings.battleAnimations;
  }

  private get run(): RunState {
    return services().session.run!;
  }

  private activeMon(): PokemonInstance {
    const run = this.run;
    if (run.battle?.doubles) return monAt({ battle: run.battle, party: run.party }, 'player', this.cmdSpot) ?? run.party[run.battle.activeIndex]!;
    return run.party[run.battle!.activeIndex]!;
  }

  // ---------- double battles ----------

  /** Where a side's focused Pokémon stands. */
  private spotXY(side: Side): { x: number; y: number } {
    if (!this.duo) return side === 'player' ? PLAYER_POS : ENEMY_POS;
    return DUO_POS[side][this.duo.focus[side]];
  }

  /** Follows the engine's focus: the events after this are about `uid` (battle/doubles.ts). */
  private focusOn(side: Side, uid: string): void {
    const duo = this.duo;
    if (!duo || this.shown[side].uid === uid) return;
    const o = duo.other[side];
    if (o.mon?.uid !== uid) {
      // Someone new in the other spot (sent in while the screen looked elsewhere): adopt it.
      const real = this.findLive(side, uid);
      if (!real) return;
      o.mon = structuredClone(real);
    }
    if (side === 'player') {
      [this.playerSprite, o.sprite] = [o.sprite, this.playerSprite];
      [this.playerBox, o.box] = [o.box, this.playerBox];
    } else {
      [this.enemySprite, o.sprite] = [o.sprite, this.enemySprite];
      [this.enemyBox, o.box] = [o.box, this.enemyBox];
    }
    const mon = o.mon!;
    o.mon = this.shown[side];
    this.shown[side] = mon;
    duo.focus[side] = duo.focus[side] === 0 ? 1 : 0;
  }

  /** Ally Switch: the two Pokémon on a side trade spots, with a little hop. */
  private async allySwitch(side: Side): Promise<void> {
    const duo = this.duo;
    if (!duo) return;
    const o = duo.other[side];
    const mine = side === 'player' ? this.playerSprite : this.enemySprite;
    const myBox = side === 'player' ? this.playerBox : this.enemyBox;
    duo.focus[side] = duo.focus[side] === 0 ? 1 : 0;
    const to = DUO_POS[side][duo.focus[side]];
    const back = DUO_POS[side][duo.focus[side] === 0 ? 1 : 0];
    const moves: Promise<void>[] = [];
    const glide = (v: Visual | null, p: { x: number; y: number }) => {
      if (!v) return;
      this.tweens.killTweensOf(v);
      if (this.motion === 'off') v.setPosition(p.x, p.y);
      else moves.push(tween(this, { targets: v, x: p.x, y: p.y, duration: 380, ease: 'Back.easeInOut' }));
    };
    glide(mine, to);
    glide(o.sprite, back);
    const a = { x: myBox.container.x, y: myBox.container.y };
    myBox.container.setPosition(o.box.container.x, o.box.container.y);
    o.box.container.setPosition(a.x, a.y);
    await Promise.all(moves);
    for (const v of [mine, o.sprite]) if (v) breathe(this, v, this.motion, 0);
  }

  /** Brings both spots' boxes and sprites in line with the battle after a turn. */
  private async syncDuo(): Promise<void> {
    const duo = this.duo;
    const battle = this.run.battle;
    if (!duo || !battle?.doubles) return;
    const view = { battle, party: this.run.party };
    for (const side of ['player', 'enemy'] as const) {
      const focused = primarySpot(battle.doubles, side);
      const want = monAt(view, side, focused);
      if (want) this.focusOn(side, want.uid);
      const otherSpot: Spot = duo.focus[side] === 0 ? 1 : 0;
      const real = monAt(view, side, otherSpot);
      const o = duo.other[side];
      if (!real) {
        o.box.container.setVisible(false);
        this.dropSprite(o.sprite);
        o.sprite = null;
        o.mon = null;
      } else {
        o.mon = structuredClone(real);
        this.disguise(side, o.mon);
        if (o.mon.hp > 0) await this.refreshInfoBox(o.box, o.mon, false);
      }
      const cur = monAt(view, side, duo.focus[side]);
      if (cur) {
        this.shown[side] = structuredClone(cur);
        this.disguise(side, this.shown[side]);
        await this.refreshInfoBox(side === 'player' ? this.playerBox : this.enemyBox, this.shown[side], false);
      }
    }
  }

  /** Shows both spots of a side (the battle's start or a reload). */
  private async showDuoSide(side: Side, cry: boolean): Promise<void> {
    const duo = this.duo!;
    const o = duo.other[side];
    if (o.mon) {
      // Draw the other spot first: swap focus in, draw, swap back.
      const uid = this.shown[side].uid;
      this.focusOn(side, o.mon.uid);
      if (this.shown[side].hp > 0) {
        this.showSprite(side, this.shown[side], cry);
        await this.refreshInfoBox(side === 'player' ? this.playerBox : this.enemyBox, this.shown[side], false);
      }
      this.focusOn(side, uid);
    }
    if (this.shown[side].hp > 0) {
      this.showSprite(side, this.shown[side], cry);
      await this.refreshInfoBox(side === 'player' ? this.playerBox : this.enemyBox, this.shown[side], false);
    }
  }

  /** Illusion: the shown copy keeps looking like the species it copies until the disguise breaks. */
  private disguise(side: 'player' | 'enemy', mon: PokemonInstance): void {
    const vol = side === 'player' ? this.run.battle?.playerVolatile : this.run.battle?.enemyVolatile;
    if (vol?.illusion) mon.speciesId = vol.illusion;
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
    if (cls) return { assetId: cls.spriteAssetId, label: cls.name };
    // A map event's trainer is drawn with the event's first cast member.
    const eventId = this.run.battle?.event?.eventId;
    const cast = eventId ? content.events.get(eventId)?.scene.cast[0] : undefined;
    return cast ? { assetId: cast, label: trainer.name } : null;
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
    // Gigantamax art is already drawn huge, so only a plain Dynamax grows.
    const grow = mon.dynamaxed && species.form?.kind !== 'gigantamax' ? DYNAMAX_SCALE : 1;
    if (side === 'player') {
      this.dropSprite(this.playerSprite);
      const at = this.spotXY('player');
      this.playerSprite = pokemonVisual(this, species, 'back', at.x, at.y, (PIXEL_SCALE + 1) * grow * (this.duo ? DUO_SCALE.player : 1), mon.shiny);
      this.field.add(this.playerSprite);
      this.prefetchMoves(mon);
      this.liven(this.playerSprite, cry);
      return this.playerSprite;
    }
    this.dropSprite(this.enemySprite);
    const at = this.spotXY('enemy');
    this.enemySprite = pokemonVisual(this, species, 'front', at.x, at.y, PIXEL_SCALE * grow * (this.duo ? DUO_SCALE.enemy : 1), mon.shiny);
    // The foe stands behind the player's Pokémon.
    this.field.addAt(this.enemySprite, this.fieldBase);
    this.prefetchMoves(mon);
    this.liven(this.enemySprite, cry);
    return this.enemySprite;
  }

  private dropSprite(visual: Visual | null): void {
    if (!visual) return;
    this.tweens.killTweensOf(visual);
    visual.destroy();
  }

  /** A bouncy entrance (when it is sent out) and then a slow idle breath. */
  private liven(visual: Visual, entering: boolean): void {
    if (entering) bounceIn(this, visual, this.motion);
    breathe(this, visual, this.motion, entering ? 450 : 0);
  }

  /** Starts loading the animations of a Pokémon's moves while the player reads. */
  private prefetchMoves(mon: PokemonInstance): void {
    const data = moveAnims();
    this.fx.prefetch(mon.moves.map((m) => presentationFor(data, m.id).anim));
  }

  /**
   * A Terastallized Pokémon is drawn tinted with its Tera Type's colour, and a
   * Dynamaxed one larger with a red glow (stand-ins until the M9.5 effects).
   */
  private applyTeraTint(side: 'player' | 'enemy', mon: PokemonInstance): void {
    const type = this.run.battle?.transform.teraTypes[mon.uid];
    const visual = side === 'player' ? this.playerSprite : this.enemySprite;
    if (!visual || (!type && !mon.dynamaxed)) return;
    const color = mon.dynamaxed ? 0xff3060 : (TYPE_COLORS[type!] ?? 0xffffff);
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(color), 100, 30);
    const value = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);
    const parts = 'list' in visual ? (visual as Phaser.GameObjects.Container).list : [visual];
    for (const part of parts) (part as Partial<Phaser.GameObjects.Sprite>).setTint?.(value);
  }

  private makeInfoBox(x: number, y: number, isPlayer: boolean): InfoBox {
    const container = this.add.container(x, y);
    // A glossy glass databox (Aero), cyan-rimmed for you and pink-rimmed for the foe.
    container.add(
      isPlayer
        ? drawGlass(this, 16, 2, 366, 128, { rim: AERO.rim, radius: 20 })
        : drawGlass(this, 6, 4, 360, 100, { rim: this.foeRim(), tint: 0x2a1240, radius: 20 }),
    );
    // Text and bar positions follow the old art's slots (art pixel × 3).
    const left = isPlayer ? 48 : 24;
    const right = isPlayer ? 366 : 342;
    const name = this.add.text(left, 14, '', textStyle(26));
    const level = this.add.text(right, 14, '', textStyle(24)).setOrigin(1, 0);
    container.add([name, level]);
    const hpX = isPlayer ? 210 : 177;
    container.add(this.add.text(hpX - 8, 63, 'HP', textStyle(15, '#f8a030', { shadow: undefined })).setOrigin(1, 0.5));
    const hpBar = new Bar(this, hpX, 63, 144, 6, 'hp');
    hpBar.addTo(container);
    const box: InfoBox = { container, isPlayer, name, level, hpBar, statusAt: { x: left, y: isPlayer ? 80 : 80 } };
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
    if (!box.container.visible) slideIn(this, box.container, box.isPlayer ? 420 : -420, 0, this.motion);
    box.container.setVisible(true);
    box.name.setText(`${this.speciesName(mon)}${genderSign(content, mon)}${mon.shiny ? ' ★' : ''}`);
    box.level.setText(`Lv${mon.level}`);
    box.hpText?.setText(`${Math.max(0, mon.hp)}/${max}`);
    box.statusBadge?.destroy();
    box.statusBadge = undefined;
    if (mon.status) {
      const s = STATUS_LABELS[mon.status.id]!;
      // Essentials' status icon when the art is there, else a coloured label.
      const icon = statusIcon(this, 0, 0, mon.status.id, 1.75);
      box.statusBadge = icon ? this.add.container(box.statusAt.x, box.statusAt.y - 2, [icon]) : badge(this, box.statusAt.x, box.statusAt.y, s.label, s.color, 16);
      box.container.add(box.statusBadge);
    }
    box.teraBadge?.destroy();
    box.teraBadge = undefined;
    const tera = this.run.battle?.transform.teraTypes[mon.uid];
    if (tera) {
      box.teraBadge = badge(this, box.statusAt.x + (box.statusBadge ? 76 : 0), box.statusAt.y, `Tera ${tera}`, TYPE_COLORS[tera] ?? 0xffffff, 16);
      box.container.add(box.teraBadge);
    } else if (mon.dynamaxed) {
      box.teraBadge = badge(this, box.statusAt.x + (box.statusBadge ? 76 : 0), box.statusAt.y, 'Dynamax', 0xff3060, 16);
      box.container.add(box.teraBadge);
    }
    this.dangerGlow(box, mon.hp / max);
    box.formIcon?.destroy();
    box.formIcon = undefined;
    const formKind = getSpecies(content, mon.speciesId).form?.kind;
    const sym = mon.dynamaxed ? 'pack.ebdx.symDynamax' : formKind === 'mega' || formKind === 'primal' ? 'pack.ebdx.symMega' : null;
    if (sym && this.textures.exists(sym)) {
      box.formIcon = this.add.image(box.name.x + box.name.width + 10, box.name.y + 14, sym).setOrigin(0, 0.5);
      box.container.add(box.formIcon);
    }
    box.rageBadge?.destroy();
    box.rageBadge = undefined;
    if (!box.isPlayer && mon.uid === this.riledUid) {
      // The warning stays on screen until the rage is unleashed or calmed.
      box.rageBadge = badge(this, box.statusAt.x + (box.statusBadge ? 76 : 0) + (box.teraBadge ? 120 : 0), box.statusAt.y, 'Riled up!', 0xff5a3c, 16);
      box.container.add(box.rageBadge);
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

  /** At a quarter of its HP or less, a box gets a gentle red pulse behind it (still with reduced motion). */
  private dangerGlow(box: InfoBox, ratio: number): void {
    const low = ratio > 0 && ratio <= 0.25;
    if (!low) {
      box.danger?.destroy();
      box.danger = undefined;
      return;
    }
    if (box.danger) return;
    const isPlayer = box.isPlayer;
    const g = this.add.graphics();
    g.fillStyle(0xff3048, 0.35);
    g.fillRoundedRect(isPlayer ? 8 : -2, -6, isPlayer ? 382 : 376, isPlayer ? 144 : 116, 26);
    box.container.addAt(g, 0);
    box.danger = g;
    if (this.motion === 'full') this.tweens.add({ targets: g, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Raids and Totems fight in the Raid Battles pack's arenas (weaker raids in the Ultra one, stronger in Max, the hardest in Tera). */
  private raidArena(battle: RunState['battle'] & object): string | null {
    const { content } = services().session;
    let key: string | null = null;
    if (battle.raid) {
      const tier = content.raids.raids.find((r) => r.id === battle.raid!.id)?.tier ?? 1;
      key = tier <= 2 ? 'ultra' : tier <= 4 ? 'max' : 'tera';
    } else if (battle.totem) key = 'tera2';
    const id = key ? `bg.raid.${key}` : null;
    return id && this.textures.exists(id) ? id : null;
  }

  /** The normal header, plus a raid status line (shield, phase count, charged attack, timer). */
  private updateHeader(): void {
    this.updateHeaderBase();
    this.status.setText('');
    const totem = this.run.battle?.totem;
    if (totem) {
      const tdef = services().session.content.totems.totems.find((x) => x.id === totem.id);
      const out = currentEnemy(this.run.battle!).uid !== totem.uid;
      const bits = ['TOTEM', tdef?.aura.text ?? ''];
      if (tdef?.ally) bits.push(out ? 'ALLY ON FIELD: defeat it' : totem.callsUsed >= tdef.ally.maxCalls ? 'no more ally calls' : `ally calls ${totem.callsUsed}/${tdef.ally.maxCalls}`);
      if (tdef && tdef.phases.length > 0) bits.push(`phase ${totem.phasesDone.length}/${tdef.phases.length}`);
      this.status.setText(bits.join('  ·  '));
      return;
    }
    const raid = this.run.battle?.raid;
    if (!raid) return;
    const content = services().session.content;
    const def = content.raids.raids.find((r) => r.id === raid.id);
    const parts = [`RAID T${def?.tier ?? '?'}`];
    parts.push(raid.shieldHp > 0 ? `SHIELD ${raid.shieldHp}/${raid.shieldMax}` : raid.pendingShields.length > 0 ? `${raid.pendingShields.length} shield${raid.pendingShields.length > 1 ? 's' : ''} to come` : 'no shield');
    if (def && def.phases.length > 0) parts.push(`phase ${raid.phasesDone.length}/${def.phases.length}`);
    if (raid.charging) parts.push('!! CHARGED ATTACK !!');
    if (raid.timerLeft !== null) parts.push(`${raid.timerLeft} turns left`);
    this.status.setText(parts.join('  ·  '));
  }

  private updateHeaderBase(): void {
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
    this.moveBadges?.destroy();
    this.moveBadges = null;
    this.commandWindow.setVisible(false);
    this.message.setVisible(true);
  }

  // ---------- intro ----------

  private async intro(): Promise<void> {
    const battle = this.run.battle!;
    const title = this.trainerTitle();
    if (battle.turn === 1 && !battle.needsSwitch) {
      await this.playIntro();
      const art = this.trainerArt();
      if (title && art) {
        const trainerSprite = trainerVisual(this, art.assetId, art.label, ENEMY_POS.x, ENEMY_POS.y, 2.5);
        await this.say(battle.rivalId ? `${title} is back to beat you!` : battle.returning ? `${title} is back for a rematch!` : battle.rival ? `${title} challenges you to a rival battle!` : `${title} would like to battle!`);
        await tween(this, { targets: trainerSprite, x: GAME_WIDTH + 120, duration: 350 });
        trainerSprite.destroy();
        if (this.duo) {
          await this.playBeat(stamp(this, 'DOUBLE BATTLE!', title, this.foeRim(), this.motion));
          await this.showDuoSide('enemy', true);
          const second = this.duo.other.enemy.mon;
          await this.say(`${title} sent out ${this.speciesName(this.shown.enemy)}${second ? ` and ${this.speciesName(second)}` : ''}!`);
        } else {
          this.showSprite('enemy', this.shown.enemy);
          await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
          if (battle.rivalNote) await this.say(battle.rivalNote);
          await this.say(`${title} sent out ${this.speciesName(this.shown.enemy)}!`);
        }
      } else {
        this.showSprite('enemy', this.shown.enemy);
        await this.refreshInfoBox(this.enemyBox, this.shown.enemy, false);
        await this.say(`A wild ${this.speciesName(this.shown.enemy)} appeared!`);
      }
      if (this.shown.enemy.shiny) await this.shinySparkle();
      if (this.duo) {
        await this.showDuoSide('player', true);
        const second = this.duo.other.player.mon;
        await this.say(`Go! ${this.speciesName(this.shown.player)}${second ? ` and ${this.speciesName(second)}` : ''}!`);
      } else {
        this.showSprite('player', this.shown.player);
        await this.refreshInfoBox(this.playerBox, this.shown.player, false);
        await this.say(`Go! ${this.speciesName(this.shown.player)}!`);
      }
    } else if (this.duo) {
      await this.showDuoSide('enemy', false);
      await this.showDuoSide('player', false);
      await this.say(`The double battle continues! (turn ${battle.turn})`);
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
    for (const line of session.battleOpening()) await this.sayTrainer(line);
    if ((battle.pendingEntry ?? []).length > 0 && !battle.needsSwitch) {
      const before = structuredClone(session.run!);
      const events = session.beginBattle();
      await this.playEvents(events, before, title);
    }
    this.busy = false;
    this.nextPrompt();
  }

  /** The opening wipe or VS screen (EBDX transitions); any key skips it. */
  private async playIntro(): Promise<void> {
    const battle = this.run.battle!;
    const art = this.trainerArt();
    const darkArena = ['ghost', 'dark', 'rock', 'poison'].includes(this.arenaTypes[0] ?? '');
    const kind: IntroKind = !battle.trainer ? (darkArena ? 'wild-dark' : 'wild') : this.boss() ? 'boss' : battle.rivalId || battle.rival ? 'rival' : 'trainer';
    await this.playBeat(introTransition(this, kind, this.motion, art ? (x, y) => trainerVisual(this, art.assetId, art.label, x, y, 2.5) : undefined));
    // Bosses and rivals get a title card: who they are and what they specialise in.
    const boss = this.boss();
    const title = this.trainerTitle();
    if (boss) {
      const types = boss.types.map((t) => t[0]!.toUpperCase() + t.slice(1)).join(' / ');
      await this.playBeat(titleCard(this, boss.title, types ? `${types} specialist` : '', ROLE_RIMS[boss.role], this.motion));
    } else if (title && (battle.rivalId || battle.rival)) {
      await this.playBeat(titleCard(this, 'RIVAL', title, ROLE_RIMS.rival, this.motion));
    }
  }

  /** The foe's rim: neon pink for wild Pokémon, orange for trainers, red for rivals, gold / violet / pale gold for bosses. */
  private foeRim(): number {
    const battle = this.run.battle;
    const boss = this.boss();
    if (boss) return ROLE_RIMS[boss.role];
    if (!battle?.trainer) return ROLE_RIMS.wild;
    return battle.rivalId || battle.rival ? ROLE_RIMS.rival : ROLE_RIMS.trainer;
  }

  /** Waits for a presentation beat; confirm/back skips it. */
  private async playBeat(b: Beat): Promise<void> {
    let over = false;
    this.time.delayedCall(150, () => {
      if (!over) this.advance = b.skip;
    });
    await b.done;
    over = true;
    this.advance = null;
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
    if (this.duo) {
      if (this.run.battle?.needsSwitch) this.openPartyPicker(true);
      else {
        this.commands = [];
        this.promptSpot(0);
      }
      return;
    }
    if (this.run.battle?.needsSwitch) {
      this.openPartyPicker(true);
      return;
    }
    // In the middle of a two-turn move or Thrash, the Pokémon carries on by itself.
    const forced = this.run.battle ? forcedMoveIndex(this.run.battle, this.run.party) : null;
    if (forced !== null) void this.act({ kind: 'move', index: forced });
    else this.showRootMenu();
  }

  /** Double battles: asks for the command of the Pokémon in `spot` (or fills it in), then the next. */
  private promptSpot(spot: number): void {
    const battle = this.run.battle!;
    if (spot > 1) {
      void this.act({ kind: 'double', commands: this.commands });
      return;
    }
    const at = spot as Spot;
    const view = { battle, party: this.run.party };
    const mon = monAt(view, 'player', at);
    const forced = forcedMoveId(volAt(view, 'player', at) ?? undefined);
    const forcedIndex = forced && mon ? mon.moves.findIndex((m) => m.id === forced) : -1;
    if (!mon || mon.hp <= 0 || battle.doubles?.commanding.includes(mon.uid)) {
      this.commands[at] = null;
      this.promptSpot(spot + 1);
    } else if (forcedIndex >= 0) {
      this.commands[at] = { action: { kind: 'move', index: forcedIndex } };
      this.promptSpot(spot + 1);
    } else {
      this.cmdSpot = at;
      this.showRootMenu();
    }
  }

  /** A command is ready: in singles the turn starts; in doubles it is stored and the next spot is asked. */
  private submit(action: Exclude<PlayerAction, { kind: 'double' }>, target?: SlotCommand['target']): void {
    if (!this.duo) {
      void this.act(action);
      return;
    }
    this.commands[this.cmdSpot] = { action, ...(target ? { target } : {}) };
    this.promptSpot(this.cmdSpot + 1);
  }

  /** Double battles: which Pokémon the move is aimed at (foes, and the partner for moves meant for it). */
  private openTargetPicker(action: Exclude<PlayerAction, { kind: 'double' }>, move: Move): void {
    const battle = this.run.battle!;
    const view = { battle, party: this.run.party };
    const choices: { label: string; target: NonNullable<SlotCommand['target']>; tint: number }[] = [];
    for (const spot of [0, 1] as const) {
      const foe = monAt(view, 'enemy', spot);
      if (foe && foe.hp > 0 && !battle.doubles!.commanding.includes(foe.uid)) choices.push({ label: this.speciesName(foe), target: { side: 'enemy', spot }, tint: ROLE_RIMS.trainer });
    }
    const partnerSpot: Spot = this.cmdSpot === 0 ? 1 : 0;
    const partner = monAt(view, 'player', partnerSpot);
    if (partner && partner.hp > 0 && ALLY_AIMED.has(move.id)) choices.push({ label: `${this.speciesName(partner)} (ally)`, target: { side: 'player', spot: partnerSpot }, tint: AERO.sky });
    if (choices.length <= 1) {
      this.submit(action, choices[0]?.target);
      return;
    }
    this.clearMenus();
    this.message.setText(`Use ${move.name} on which Pokémon?`);
    this.commandWindow.setVisible(true);
    this.menu = new Menu(this, {
      x: COMMAND_X + 24,
      y: MESSAGE_Y + 26,
      options: choices.map((c) => ({ label: c.label })),
      columns: 1,
      itemWidth: 340,
      itemHeight: 46,
      fontSize: 26,
      color: COLORS.textLight,
      glass: { tints: choices.map((c) => mixColor(c.tint, 0x000000, 0.3)), motion: this.motion },
      onSelect: (i) => this.submit(action, choices[i]!.target),
      onBack: () => this.showMoveMenu(),
    });
  }

  // ---------- menus ----------

  private showRootMenu(): void {
    this.clearMenus();
    const content = services().session.content;
    // Transformations: a fourth option that cycles off -> Tera -> Z-Move -> Dynamax -> off. (Mega and Gigantamax happen by themselves.)
    const ctx = this.battleCtx();
    // In a double battle only the Pokémon in the engine's main spot can transform (one per turn).
    const mainSpot = !this.run.battle?.doubles || this.cmdSpot === primarySpot(this.run.battle.doubles, 'player');
    const tera = mainSpot ? teraOption(ctx) : null;
    const zMove = mainSpot && zMoveOptions(ctx).some((z) => z !== null);
    const choices: TransformRequest[] = [
      ...(tera ? [{ kind: 'tera' as const }] : []),
      ...(zMove ? [{ kind: 'zmove' as const }] : []),
      ...(mainSpot && canDynamax(ctx) ? [{ kind: 'dynamax' as const }] : []),
    ];
    const same = (a: TransformRequest | null, b: TransformRequest) => a?.kind === b.kind;
    if (!choices.some((c) => same(this.transformChoice, c))) this.transformChoice = null;
    const choice = this.transformChoice;
    const ready =
      choice?.kind === 'tera'
          ? ` It will Terastallize into the ${tera![0]!.toUpperCase()}${tera!.slice(1)} type!`
          : choice?.kind === 'zmove'
            ? ' Pick a move to unleash as a Z-Move!'
            : choice?.kind === 'dynamax'
              ? ' It will Dynamax!'
              : '';
    this.message.setText(`What will ${this.speciesName(this.activeMon())} do?${ready}`);
    const options = [{ label: 'Fight' }, { label: 'Bag' }, { label: 'Pokémon' }];
    const label = (c: TransformRequest) => ({ tera: 'Tera', zmove: 'Z', dynamax: 'Max' })[c.kind];
    const onLabel = (c: TransformRequest) => ({ tera: 'Tera', zmove: 'Z-Move', dynamax: 'Dynamax' })[c.kind];
    const kinds = [...new Set(choices.map(label))];
    if (choices.length > 0) options.push({ label: choice ? `${onLabel(choice)}: ON` : `${kinds.join('/')}: OFF` });
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
      // Wii-style glossy buttons: Fight red, Bag gold, Pokémon green, transformations neon.
      glass: { tints: [0xc8303c, 0xc08a10, 0x1f9a52, 0x9a2cc8], motion: this.motion },
      onSelect: (i) => {
        if (i === 0) this.showMoveMenu();
        else if (i === 1) this.openBag();
        else if (i === 2) this.openPartyPicker(false);
        else {
          const at = choices.findIndex((c) => same(this.transformChoice, c));
          this.transformChoice = choices[at + 1] ?? null;
          this.showRootMenu();
        }
      },
      // Double battles: back from the second Pokémon's menu goes back to the first's.
      onBack: this.duo && this.cmdSpot === 1 && this.commands[0] ? () => this.promptSpot(0) : undefined,
    });
  }

  private showMoveMenu(): void {
    const content = services().session.content;
    const mon = this.activeMon();
    const anyPp = mon.moves.some((m) => m.pp > 0);
    this.clearMenus();
    this.message.setText(`What will ${this.speciesName(mon)} do?`);
    // With Z-Move on, each move shows the Z-Move it becomes; moves without one can't be picked.
    const zMoves = this.transformChoice?.kind === 'zmove' ? zMoveOptions(this.battleCtx()) : null;
    // Dynamaxed (or about to): every move shows the Max Move it becomes.
    const dynamaxed = this.transformChoice?.kind === 'dynamax' || this.run.battle?.transform.dynamax[mon.uid] !== undefined;
    const maxMoves = dynamaxed ? maxMoveOptions(this.battleCtx()) : null;
    const zLabel = (i: number, name: string) => {
      const z = zMoves?.[i];
      if (maxMoves?.[i]) return maxMoves[i]!.name;
      return z ? (z.category === 'status' ? `Z-${name}` : z.name) : name;
    };
    const options = anyPp
      ? mon.moves.map((slot, i) => ({ label: zLabel(i, content.moves.get(slot.id)!.name) + (wouldRefuse(content, this.run, mon, slot.id) ? ' (may refuse)' : ''), disabled: slot.pp <= 0 || (zMoves !== null && !zMoves[i]) }))
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
      // Each move sits on a glass pill in its type's colour.
      glass: {
        tints: options.map((_, i) => {
          const slot = mon.moves[i];
          const move = slot ? (zMoves?.[i] ?? maxMoves?.[i] ?? content.moves.get(slot.id)) : undefined;
          return move ? mixColor(TYPE_COLORS[move.type] ?? 0x888888, 0x000000, 0.35) : undefined;
        }),
        motion: this.motion,
      },
      onFocus: (i) => {
        this.moveBadges?.destroy();
        this.moveBadges = null;
        const slot = mon.moves[i];
        if (!anyPp || !slot) {
          this.moveInfo.setText('Your Pokémon has no PP left').setY(MESSAGE_Y + 30);
          return;
        }
        const move = zMoves?.[i] ?? maxMoves?.[i] ?? content.moves.get(slot.id)!;
        const power = move.power ?? fixedDamageLabel(move.effects.fixedDamage);
        // Type label and category icon from Essentials; plain text if the art is missing.
        const type = typeLabel(this, 0, 0, move.type, 1.5);
        const cat = categoryIcon(this, 120, 0, move.category, 1.5);
        const art = [type, cat].filter((o): o is Phaser.GameObjects.Image => o !== null);
        const label = art.length === 2 ? '' : `${move.type.toUpperCase()}  ·  ${move.category}\n`;
        if (art.length === 2) {
          this.moveBadges = this.add.container(COMMAND_X + 28, MESSAGE_Y + 40, [...art, ...this.moveExtras(move)]);
          bounceIn(this, this.moveBadges, this.motion);
        } else art.forEach((o) => o.destroy());
        this.moveInfo.setText(`${label}PP  ${slot.pp}/${maxPp(content, slot)}  ·  Power ${power}`).setY(art.length === 2 ? MESSAGE_Y + 64 : MESSAGE_Y + 30);
        this.moveInfo.setColor(COLORS.textLight);
      },
      onSelect: (i) => {
        const transform = this.transformChoice;
        this.transformChoice = null;
        const action = { kind: 'move' as const, index: anyPp ? i : -1, ...(transform ? { transform } : {}) };
        const slot = anyPp ? mon.moves[i] : undefined;
        const move = slot ? (zMoves?.[i] ?? content.moves.get(slot.id)) : undefined;
        if (this.duo && move && needsTarget(move)) this.openTargetPicker(action, move);
        else this.submit(action);
      },
      onBack: () => this.showRootMenu(),
    });
    this.moveInfo.setVisible(true);
  }

  /**
   * Enhanced Battle UI extras for the move panel: up to four flag icons
   * (contact, sound, punch…) and how well the move hits the foe's visible
   * types, as a tag plus words. Only what the player can already see.
   */
  private moveExtras(move: Move): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    const flags = [...move.flags, ...(move.critStage > 0 ? ['highCrit'] : [])].map((f) => FLAG_ICONS[f]).filter((f): f is string => Boolean(f));
    flags.slice(0, 4).forEach((name, n) => {
      const key = `pack.ebui.flag.${name}`;
      if (this.textures.exists(key)) out.push(this.add.image(192 + n * 32, 0, key).setOrigin(0, 0.5).setScale(1.1));
    });
    if (move.category === 'status') return out;
    const content = services().session.content;
    const foe = this.shown.enemy;
    const tera = this.run.battle?.transform.teraTypes[foe.uid];
    const types = (tera ? [tera] : getSpecies(content, foe.speciesId).types) as TypeName[];
    const hint = effectivenessWord(typeEffectiveness(content.typeChart, move.type as TypeName, types));
    const icon = effectivenessIcon(this, 0, 72, hint.frame, 0.36);
    if (icon) out.push(icon);
    out.push(this.add.text(icon ? 32 : 0, 72, hint.text, textStyle(20, COLORS.textLight)).setOrigin(0, 0.5));
    return out;
  }

  private battleCtx() {
    const run = this.run;
    return { content: services().session.content, battle: run.battle!, party: run.party, inventory: run.inventory, disabledMechanics: run.disabledMechanics, perks: runPerks(services().session.content, run), noBattleItems: noBattleItems(run.rules) };
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
      glass: true,
      title: 'Bag',
      columns: 2,
      rowHeight: 48,
      rows: ids.map((id) => bagRow(content, run.inventory, id, problem(id))),
      onSelect: (i) => {
        const id = ids[i]!;
        const item = content.items.get(id)!;
        if (item.target === 'party' || item.target === 'fainted') this.openItemTarget(id);
        else this.submit({ kind: 'item', itemId: id });
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
      glass: true,
      title: `Use ${item.name} on which Pokémon?`,
      columns: 2,
      rowHeight: 78,
      rows: partyRows(content, run.party, (i) => itemProblem(this.battleCtx(), itemId, i), (i) => (i === run.battle!.activeIndex ? 'IN BATTLE' : undefined)),
      onSelect: (i) => this.submit({ kind: 'item', itemId, targetIndex: i }),
      onBack: () => this.openBag(),
    });
  }

  /** Party list for switching. `forced` after a faint: a choice must be made and it costs no turn. */
  private openPartyPicker(forced: boolean): void {
    const content = services().session.content;
    const run = this.run;
    this.clearMenus();
    this.message.setText(forced ? 'Choose a Pokémon to send out.' : '');
    if (this.duo) {
      // Double battles: neither Pokémon in battle, nor one the other spot is already sending out.
      const view = { battle: run.battle!, party: run.party };
      const onField = [0, 1].map((s) => indexAt(view, 'player', s as Spot));
      const taken = this.commands.flatMap((c) => (c?.action.kind === 'switch' ? [c.action.partyIndex] : []));
      this.picker = new Picker(this, {
        title: forced ? 'Send out which Pokémon?' : `Switch ${this.speciesName(this.activeMon())} for which Pokémon?`,
        columns: 2,
        rowHeight: 78,
        rows: partyRows(content, run.party, (i) => doublesSwitchProblem(view, i, taken), (i) => (onField.includes(i) ? 'IN BATTLE' : undefined)),
        onSelect: (i) => (forced ? void this.act({ kind: 'switch', partyIndex: i }) : this.submit({ kind: 'switch', partyIndex: i })),
        onBack: forced ? undefined : () => this.showRootMenu(),
      });
      return;
    }
    this.picker = new Picker(this, {
      glass: true,
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
    await this.playEvents(result.events, before, trainer, result.cues, result.drama);

    if (result.end) {
      await this.finish(result, trainer);
      return;
    }
    if (result.raidFailed) {
      await this.say('The fight is over... your Pokémon were pulled back to safety.');
      await exitWipe(this, this.motion);
      this.scene.start(sceneForRun(result.run));
      return;
    }
    if (result.wiped) {
      await this.say(result.run.phase === 'battle' ? 'The VS Recorder rewinds the tape... the battle starts again!' : result.run.rules.modeId === 'adventure' ? 'Your party fainted... you return to the start of the stage, healed.' : 'Death-Block! You return to the start of the stage with your party healed.');
      this.scene.start(sceneForRun(result.run));
      return;
    }
    if (result.defeated) {
      await this.say('You have no Pokémon that can fight!');
      await exitWipe(this, this.motion);
      this.scene.start('GameOver');
      return;
    }
    this.busy = false;
    this.nextPrompt();
  }

  private async finish(result: TurnResult, trainer: string | null): Promise<void> {
    const content = services().session.content;
    const end = result.end!;
    if (end.outcome === 'win' && this.playerSprite) void hop(this, this.playerSprite, this.motion);
    if (end.outcome === 'win' && trainer) {
      await this.playBeat(stamp(this, 'VICTORY!', trainer, this.foeRim(), this.motion));
      await this.say(`You defeated ${trainer}!`);
    }
    if (end.moneyGained > 0) await this.say(`You got ₽${end.moneyGained}!`);
    for (const id of end.itemsFound) await this.say(`You found a ${content.items.get(id)?.name ?? id}!`);
    for (const reward of end.eventRewards) await this.say(`Event prize: ${reward}!`);
    if (end.voiceJoined) await this.say(`${content.species.get(end.voiceJoined)?.name ?? 'The Pokémon'} heard your voice. It wants to come with you!`);
    if (end.badge) {
      playSfx(this, 'se.level_up');
      const leaderName = content.bosses.get(end.badge)?.name ?? end.badge;
      await this.playBeat(stamp(this, 'BADGE GET!', `${leaderName}'s badge`, ROLE_RIMS.gym, this.motion));
      await this.say(`You earned ${leaderName}'s badge! (${result.run.badges.length} total)`);
      const campaign = content.campaigns.get(result.run.campaignId);
      const leagueNext = result.run.stage?.kind === 'stage' && campaign && result.run.stage.index + 1 >= campaign.stagesPerRegion;
      await this.say(leagueNext ? 'The Pokémon League awaits…' : 'The next stage awaits…');
    }
    if (end.regionCleared) {
      playSfx(this, 'se.level_up');
      const region = content.regions.get(end.regionCleared)?.name ?? end.regionCleared;
      await this.playBeat(stamp(this, 'CHAMPION!', region, ROLE_RIMS.champion, this.motion));
      await this.say(`You are the ${region} Champion!`);
      await this.say(end.victory ? 'You have conquered every region!' : 'A new region awaits…');
    }
    this.updateHeader();
    for (const evo of end.evolutions) {
      const fromName = getSpecies(content, evo.from).name;
      const toName = getSpecies(content, evo.to).name;
      await this.say(`What? ${fromName} is evolving!`);
      await burstReveal(this, PLAYER_POS.x, PLAYER_POS.y - 100, 0x9fe8ff, this.motion).done;
      playSfx(this, 'se.level_up');
      await this.say(`Congratulations! Your ${fromName} evolved into ${toName}!`);
      for (const m of evo.learnedMoves) await this.say(`${toName} learned ${content.moves.get(m)!.name}!`);
    }
    await exitWipe(this, this.motion);
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

  /** A line of trainer dialogue: "Joey: \"Crush them!\"". */
  private async sayTrainer(line: DramaLine): Promise<void> {
    const { session } = services();
    const { battleAnimations, effectIntensity } = session.settings;
    // Signature attacks and rare events get a short banner; reduced motion keeps the banner without movement, "off" skips it.
    const title = line.category === 'signature' && line.cue?.moveId ? (session.content.moves.get(line.cue.moveId)?.name ?? null) : line.cue?.event && !line.cue.event.startsWith('memory:') ? (DRAMA_LIBRARY.events.find((e) => e.id === line.cue!.event)?.name ?? null) : null;
    if (title && battleAnimations !== 'off') {
      this.showMoment({ at: -1, side: 'enemy', title, messages: [], color: line.category === 'signature' ? '#ffb020' : '#7a5cff', sound: 'se.shiny', music: null, major: true, cutIn: false, shake: false }, battleAnimations === 'full' && effectIntensity > 0);
    }
    await this.say(`${line.speaker}: “${line.text}”`);
  }

  private async playEvents(events: RunEvent[], before: RunState, trainer: string | null, storyCues: PresentationCue[] = [], drama: DramaLine[] = []): Promise<void> {
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
        case 'focus':
          this.focusOn(e.side, e.uid);
          break;
        case 'allySwitch':
          await this.allySwitch(e.side);
          break;
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
        case 'hyper':
          // A Hyper moment: hung on, got back up, shook off its status or dug in (or the foe's rage).
          if (e.side === 'enemy') this.riledUid = e.variant === null || e.variant === 'uncontrollable' ? e.uid : null;
          mon!.hp = e.hpAfter;
          if (e.cured) mon!.status = null;
          if (sprite && sprite.alpha < 1) sprite.setAlpha(1);
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'selfKo':
          mon!.hp = 0;
          await this.refreshInfoBox(box, mon!, true);
          break;
        case 'faint':
          mon!.hp = 0;
          playSfx(this, 'se.faint');
          if (sprite) this.tweens.killTweensOf(sprite);
          if (sprite) await tween(this, { targets: sprite, alpha: 0, y: sprite.y + 30, duration: 400 });
          break;
        case 'switchOut':
          if (sprite) this.tweens.killTweensOf(sprite);
          if (sprite) await tween(this, { targets: sprite, alpha: 0, duration: 250 });
          break;
        case 'evolved': {
          // The Pokémon evolves between turns: flash, then the new form and its HP.
          if (battleAnimations !== 'off' && sprite) {
            const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0).setDepth(40);
            await tween(this, { targets: flash, alpha: battleAnimations === 'full' ? 0.9 : 0.4, duration: 300, yoyo: true, hold: 200 });
            flash.destroy();
          }
          mon!.speciesId = e.to;
          mon!.hp = e.hpAfter;
          this.showSprite(e.side, mon!);
          playSfx(this, 'se.level_up');
          await this.refreshInfoBox(box, mon!, false);
          break;
        }
        case 'switchIn': {
          const incoming = this.findMon(before, e.uid);
          if (incoming) {
            this.shown[e.side] = structuredClone(incoming);
            this.showSprite(e.side, this.shown[e.side]);
            this.applyTeraTint(e.side, this.shown[e.side]);
            await this.refreshInfoBox(e.side === 'enemy' ? this.enemyBox : this.playerBox, this.shown[e.side], false);
            // A trainer's last Pokémon is their ace: one special beat when it comes out.
            const team = this.run.battle?.enemyTeam ?? [];
            if (e.side === 'enemy' && this.run.battle?.trainer && team.length > 1 && team[team.length - 1]!.uid === e.uid) {
              void burstReveal(this, ENEMY_POS.x, ENEMY_POS.y - 80, this.foeRim(), this.motion);
              await this.playBeat(stamp(this, 'ACE!', this.speciesName(this.shown.enemy), this.foeRim(), this.motion));
            }
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
          // A Z-Move flashes in its type's colour.
          const zType = e.kind === 'zmove' && e.moveId ? content.moves.get(e.moveId)?.type : undefined;
          // A radiant burst on the Pokémon (Deluxe Battle Kit art), in the Z-Move's or Tera Type's colour.
          const teraType = e.kind === 'tera' ? this.run.battle?.transform.teraTypes[mon!.uid] : undefined;
          const glowColor = zType ? (TYPE_COLORS[zType] ?? 0xffffff) : teraType ? (TYPE_COLORS[teraType] ?? 0xffffff) : e.kind.startsWith('dynamax') || e.kind === 'gigantamax' ? 0xff3060 : 0x9fe8ff;
          const at = this.spotXY(e.side);
          if (e.kind !== 'illusion') await burstReveal(this, at.x, at.y - 80, glowColor, this.motion).done;
          if (e.kind === 'tera' || e.kind === 'zmove') playSfx(this, 'se.level_up');
          else {
            // Dynamax doubles HP (and its end halves it again), the same way the battle rules do.
            const dynamaxChange = e.kind === 'dynamax' || e.kind === 'gigantamax' || e.kind === 'dynamaxEnd';
            const before = calcStats(content, mon!).hp;
            mon!.speciesId = e.to;
            if (e.kind === 'dynamaxEnd') delete mon!.dynamaxed;
            else if (dynamaxChange) mon!.dynamaxed = true;
            if ((dynamaxChange || e.kind === 'ability') && mon!.hp > 0) mon!.hp = Math.max(1, Math.round((mon!.hp * calcStats(content, mon!).hp) / before));
            this.showSprite(e.side, mon!, e.kind !== 'dynamaxEnd');
          }
          this.applyTeraTint(e.side, mon!);
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
      } else {
        const text = eventText(content, this.names(trainer), e, session.settings.damageDetails);
        if (text) await this.say(text);
      }
      // What the trainer says about it (spoken lines, after the event's own text).
      for (const line of drama.filter((d) => d.at === index)) await this.sayTrainer(line);
    }
    // Make sure the boxes match the real state at the end of the turn.
    const run = this.run;
    if (run.battle?.doubles && this.duo) await this.syncDuo();
    else if (run.battle) {
      const active = run.party[run.battle.activeIndex];
      if (active && active.uid === this.shown.player.uid) {
        this.shown.player = structuredClone(active);
        this.disguise('player', this.shown.player);
        await this.refreshInfoBox(this.playerBox, this.shown.player, false);
      }
      this.shown.enemy = structuredClone(currentEnemy(run.battle));
      this.disguise('enemy', this.shown.enemy);
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
      // A bouncy pop-in (no movement when motion is reduced).
      if (motion) {
        title.setScale(0.5);
        this.tweens.add({ targets: title, scale: 1, duration: 320, ease: 'Back.easeOut' });
      }
      this.tweens.add({ targets: [band, title], alpha: 1, duration: 180, hold: 1300, yoyo: true, onComplete: () => { band.destroy(); title.destroy(); } });
      if (motion) {
        const at = cue.side === 'enemy' ? ENEMY_POS : PLAYER_POS;
        const aura = this.add.circle(at.x, at.y - 40, 90, color, 0.35).setDepth(1).setScale(0.6);
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
    if (this.enemySprite) this.tweens.killTweensOf(this.enemySprite);
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
      const reveal = burstReveal(this, ball.x, ball.y, 0xfff0a0, this.motion);
      // Seal Case: a ring of coloured bursts around the ball.
      if (hasPerk(services().session.content, this.run, 'sealCase')) {
        for (const [i, colour] of [0xff80c0, 0x80d0ff, 0xa0ff90, 0xffd060].entries()) burstReveal(this, ball.x + (i - 1.5) * 34, ball.y - 24 + (i % 2) * 36, colour, this.motion);
      }
      await tween(this, { targets: ball, alpha: 0.6, duration: 150, yoyo: true });
      await reveal.done;
      return;
    }
    playSfx(this, 'se.ball_release');
    ball.destroy();
    this.showSprite('enemy', this.shown.enemy);
  }
}
