// Hub Town's overworld (spec 2026-11-01 §4-§11): the map, your Pokémon, the camera and the "press Z" prompt.
// It draws core/hubTown data and asks core/hubTown/world.ts where you may walk; buildings open through hooks so the
// Hub scene keeps every room it had. Presentation only: walking never changes the profile.
//
// Two cameras: the world camera scrolls over the town; the scene's main camera stays still and draws everything else
// (menus, pickers, the prompt), so the Hub's existing pages keep working unchanged on top of the town.

import Phaser from 'phaser';
import { overworldAssetIds } from '../../assets/catalog';
import { HUB_TOWN, type Facing, type HubPlace } from '../../core/hubTown/schema';
import { ahead, facingOf, gateAt, placeAhead, STEP, WalkGrid, type Tile } from '../../core/hubTown/world';
import { playSfx } from '../audio';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../theme';

const T = HUB_TOWN.tile;
const DIR_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };
const WALK_MS = 210;
const RUN_MS = 115;
/** Depths: ground layers, then everything that stands in the world by its feet, then the prompt. */
const DEPTH_WORLD = 10;
const DEPTH_PROMPT = 900_000;

export interface TownHooks {
  /** A building door or sign you faced and confirmed (or walked into). */
  onPlace(place: HubPlace): void;
  /** You stepped into a gateway: ask before leaving (never leaves on its own). */
  onGate(place: HubPlace): void;
  /** Whether a page is open over the town (the town then ignores walking). */
  busy(): boolean;
}

export interface TownStart extends Tile {
  facing: Facing;
}

/** Someone (or something) in the town you can face and talk to or look at: keepers, the Legacy Display. */
export interface Talker {
  id: string;
  name: string;
  /** The prompt's verb ("Talk", "Look"). */
  verb: string;
  tiles: Tile[];
  onTalk(): void;
}

/** Remembered between Hub visits in this session: where you were, so leaving a room puts you back by its door. */
let lastSpot: TownStart | null = null;
export function rememberSpot(spot: TownStart | null): void {
  lastSpot = spot;
}

/** Frames of a 4x4 walk sheet as Phaser animations (made once per texture). */
export function ensureWalkAnims(scene: Phaser.Scene, key: string, frameRate = 7): void {
  for (const dir of Object.keys(DIR_ROW) as Facing[]) {
    const anim = `${key}#${dir}`;
    if (scene.anims.exists(anim)) continue;
    const row = DIR_ROW[dir];
    scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { frames: [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3] }), frameRate, repeat: -1 });
  }
}

export class HubTownView {
  readonly grid = new WalkGrid();
  readonly worldCam: Phaser.Cameras.Scene2D.Camera;
  readonly player: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private at: Tile;
  facing: Facing;
  private moving = false;
  private building = false;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift', Phaser.Input.Keyboard.Key> | null;
  private readonly prompt: Phaser.GameObjects.Container;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly promptBox: Phaser.GameObjects.Graphics;
  private promptFor: string | null = null;
  private readonly talkers: Talker[] = [];
  private readonly worldObjects = new Set<Phaser.GameObjects.GameObject>();
  private readonly onAdded: (go: Phaser.GameObjects.GameObject) => void;
  /** Ignore a held key until it is released (after a page closes, so you don't walk off at once). */
  private holdLock = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hooks: TownHooks,
    private readonly opts: { follower: string; motion: 'full' | 'reduced' | 'off'; start?: TownStart },
  ) {
    const [W, H] = HUB_TOWN.size;
    // The world camera goes under the main one; anything made outside buildWorld() stays off it.
    this.worldCam = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false, 'hubTownWorld');
    const list = scene.cameras.cameras;
    list.splice(list.indexOf(this.worldCam), 1);
    list.unshift(this.worldCam);
    this.worldCam.setBounds(0, 0, W * T, H * T).setRoundPixels(true).setBackgroundColor('#78c850');
    this.onAdded = (go) => {
      if (this.building) {
        this.worldObjects.add(go);
        scene.cameras.main.ignore(go);
      } else this.worldCam.ignore(go);
    };
    scene.sys.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded);
    // Everything already in the scene belongs to the screen, not the world.
    for (const go of scene.children.list) this.worldCam.ignore(go);

    const start = opts.start ?? lastSpot ?? { x: HUB_TOWN.spawn.x, y: HUB_TOWN.spawn.y, facing: HUB_TOWN.spawn.facing };
    this.at = { x: start.x, y: start.y };
    this.facing = start.facing;

    this.building = true;
    this.drawGround();
    this.drawProps();
    ensureWalkAnims(scene, overworldAssetIds.follower(opts.follower));
    this.shadow = scene.add.ellipse(0, 0, 26, 10, 0x000000, 0.28);
    this.player = scene.add.sprite(0, 0, overworldAssetIds.follower(opts.follower), DIR_ROW[this.facing] * 4).setOrigin(0.5, 1).setName('hubtown-player');
    this.building = false;
    this.grid.claim('player', this.at);
    this.placeSprite();
    this.worldCam.startFollow(this.player, true, 0.2, 0.2, 0, 24);
    this.worldCam.centerOn(this.player.x, this.player.y - 24);

    // The "press Z" bubble: on the screen camera, placed over the door each frame.
    this.promptBox = scene.add.graphics();
    this.promptText = scene.add.text(0, 0, '', textStyle(16, '#2a2840'));
    this.prompt = scene.add.container(0, 0, [this.promptBox, this.promptText]).setDepth(DEPTH_PROMPT).setVisible(false).setName('hubtown-prompt');

    const kb = scene.input.keyboard;
    this.keys = kb
      ? {
          up: kb.addKey('UP', false), down: kb.addKey('DOWN', false), left: kb.addKey('LEFT', false), right: kb.addKey('RIGHT', false),
          w: kb.addKey('W', false), a: kb.addKey('A', false), s: kb.addKey('S', false), d: kb.addKey('D', false), shift: kb.addKey('SHIFT', false),
        }
      : null;
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.idle();
  }

  /** Where you stand and face (for coming back to the same spot). */
  spot(): TownStart {
    return { ...this.at, facing: this.facing };
  }

  tile(): Tile {
    return { ...this.at };
  }

  /** After a page closes: keep still until the arrow you were holding is let go. */
  lockUntilRelease(): void {
    this.holdLock = true;
  }

  /** Make objects that belong to the town (they scroll with it) instead of the screen. */
  world<R>(make: () => R): R {
    const was = this.building;
    this.building = true;
    try {
      return make();
    } finally {
      this.building = was;
    }
  }

  /** Pixel position of a person standing on a tile (feet at the tile's bottom). */
  feet(t: Tile): { x: number; y: number } {
    return { x: t.x * T + T / 2, y: t.y * T + T + 2 };
  }

  /** A person standing still on a tile: a 4x4 walk sheet, solid to walking, with a soft shadow. */
  addPerson(id: string, texture: string, at: Tile, facing: Facing, opts: { scale?: number; bob?: boolean } = {}): Phaser.GameObjects.Sprite {
    const { x, y } = this.feet(at);
    const sprite = this.world(() => {
      const shadow = this.scene.add.ellipse(x, y - 6, 26, 10, 0x000000, 0.25).setDepth(DEPTH_WORLD + y - 1);
      const sp = this.scene.add.sprite(x, y, texture, DIR_ROW[facing] * 4).setOrigin(0.5, 1).setDepth(DEPTH_WORLD + y).setScale(opts.scale ?? 1).setName(`hubtown-${id}`);
      sp.once(Phaser.GameObjects.Events.DESTROY, () => shadow.destroy());
      sp.setData('shadow', shadow);
      return sp;
    });
    if (opts.bob && this.opts.motion === 'full') {
      ensureWalkAnims(this.scene, texture);
      sprite.anims.play({ key: `${texture}#${facing}`, frameRate: 3 }, true);
    }
    this.grid.claim(id, at);
    return sprite;
  }

  /** Something you can face and press Z at. */
  addTalker(t: Talker): void {
    this.talkers.push(t);
  }

  private talkerAhead(): Talker | null {
    const t = ahead(this.at, this.facing);
    return this.talkers.find((k) => k.tiles.some((p) => p.x === t.x && p.y === t.y)) ?? null;
  }

  private drawGround(): void {
    const [W, H] = HUB_TOWN.size;
    const rows = (layer: number[]) => Array.from({ length: H }, (_, y) => layer.slice(y * W, y * W + W));
    for (const [i, layer] of [HUB_TOWN.ground, HUB_TOWN.overlay].entries()) {
      const map = this.scene.make.tilemap({ data: rows(layer), tileWidth: T, tileHeight: T });
      const tiles = map.addTilesetImage('hubtown', overworldAssetIds.tiles, T, T, 0, 0);
      if (!tiles) continue;
      map.createLayer(0, tiles, 0, 0)?.setDepth(i).setName(i === 0 ? 'hubtown-ground' : 'hubtown-overlay');
    }
  }

  /** Buildings, trees and props; only the ones near the camera are drawn (see cull()). */
  private readonly props: Phaser.GameObjects.Image[] = [];
  private cullTick = 0;

  private drawProps(): void {
    for (const [frame, x, y, depth] of HUB_TOWN.props) {
      this.props.push(this.scene.add.image(x, y, overworldAssetIds.props, frame).setOrigin(0, 0).setDepth(DEPTH_WORLD + depth));
    }
  }

  /** Hide props well outside the view, so a big town costs no more to draw than one screen of it. */
  private cull(): void {
    const v = this.worldCam.worldView;
    const m = 160;
    for (const im of this.props) {
      im.setVisible(im.x < v.right + m && im.x + im.width > v.x - m && im.y < v.bottom + m && im.y + im.height > v.y - m);
    }
  }

  private placeSprite(): void {
    this.player.setPosition(this.at.x * T + T / 2, this.at.y * T + T + 2);
    this.syncShadow();
  }

  private syncShadow(): void {
    this.shadow.setPosition(this.player.x, this.player.y - 6);
    this.player.setDepth(DEPTH_WORLD + this.player.y);
    this.shadow.setDepth(DEPTH_WORLD + this.player.y - 1);
  }

  private idle(): void {
    const key = overworldAssetIds.follower(this.opts.follower);
    // Followers keep their little step even when standing (Pokémon overworld style), slower; reduced/off motion stands still.
    if (this.opts.motion === 'full') this.player.anims.play({ key: `${key}#${this.facing}`, frameRate: 4 }, true);
    else {
      this.player.anims.stop();
      this.player.setFrame(DIR_ROW[this.facing] * 4);
    }
  }

  private heldDirection(): Facing | null {
    const k = this.keys;
    if (!k) return null;
    const dx = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
    const dy = (k.up.isDown || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);
    return facingOf(dx, dy);
  }

  /** One step (or a turn) toward `dir`. Public so touch controls and tests can walk too. */
  step(dir: Facing, run = false): boolean {
    if (this.moving) return false;
    const turned = this.facing !== dir;
    this.facing = dir;
    const next = ahead(this.at, dir);
    if (!this.grid.canEnter(next.x, next.y, 'player')) {
      this.idle();
      // Walking into a door opens it, like any Pokémon town.
      const place = placeAhead(this.at, dir);
      if (place && place.kind === 'building') {
        this.hooks.onPlace(place);
        return false;
      }
      if (!turned) playSfx(this.scene, 'ui.cursor', 0.25, -600);
      return false;
    }
    const from = this.at;
    this.at = next;
    this.grid.claim('player', next, from);
    this.moving = true;
    const key = overworldAssetIds.follower(this.opts.follower);
    if (this.opts.motion !== 'off') this.player.anims.play({ key: `${key}#${dir}`, frameRate: run ? 11 : 7 }, true);
    this.scene.tweens.add({
      targets: this.player,
      x: next.x * T + T / 2,
      y: next.y * T + T + 2,
      duration: run ? RUN_MS : WALK_MS,
      onUpdate: () => this.syncShadow(),
      onComplete: () => {
        this.moving = false;
        this.syncShadow();
        const gate = gateAt(this.at);
        if (gate) {
          this.idle();
          this.hooks.onGate(gate);
        } else if (!this.heldDirection()) this.idle();
      },
    });
    return true;
  }

  /** Step back the way you came (after saying "not yet" at a gate). */
  stepBack(): void {
    const back: Record<Facing, Facing> = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const dir = back[this.facing];
    const next = ahead(this.at, dir);
    if (!this.grid.canEnter(next.x, next.y, 'player')) return;
    this.grid.claim('player', next, this.at);
    this.at = next;
    this.placeSprite();
    this.idle();
  }

  /** Confirm pressed: open whatever is in front of you. */
  interact(): boolean {
    if (this.moving) return false;
    const place = placeAhead(this.at, this.facing);
    if (place) {
      this.hooks.onPlace(place);
      return true;
    }
    const talker = this.talkerAhead();
    if (!talker) return false;
    playSfx(this.scene, 'ui.select', 0.6);
    talker.onTalk();
    return true;
  }

  /** Teleport (used when coming back out of a room, and by tests). */
  moveTo(spot: TownStart): void {
    this.grid.release('player', this.at);
    this.at = { x: spot.x, y: spot.y };
    this.facing = spot.facing;
    this.grid.claim('player', this.at);
    this.placeSprite();
    this.worldCam.centerOn(this.player.x, this.player.y - 24);
    this.idle();
  }

  private update(): void {
    if (!this.player.active) return;
    const busy = this.hooks.busy();
    // A page covers the whole screen: stop drawing the town under it.
    this.worldCam.setVisible(!busy);
    if (!busy && this.cullTick-- <= 0) {
      this.cullTick = 8;
      this.cull();
    }
    const dir = this.heldDirection();
    if (this.holdLock && !dir) this.holdLock = false;
    if (!busy && !this.holdLock && dir && !this.moving) this.step(dir, Boolean(this.keys?.shift.isDown));
    this.updatePrompt(busy);
    lastSpot = this.spot();
  }

  private updatePrompt(busy: boolean): void {
    const found = busy || this.moving ? null : placeAhead(this.at, this.facing);
    const talker = found || busy || this.moving ? null : this.talkerAhead();
    const place = found ? { id: found.id, name: found.name, verb: found.kind === 'sign' ? 'Read' : 'Enter', door: found.door } : talker ? { id: `talk:${talker.id}`, name: talker.name, verb: talker.verb, door: ahead(this.at, this.facing) } : null;
    if (!place) {
      if (this.promptFor !== null) this.prompt.setVisible(false);
      this.promptFor = null;
      return;
    }
    if (this.promptFor !== place.id) {
      this.promptFor = place.id;
      this.promptText.setText(`Z  ${place.verb}: ${place.name}`);
      const w = this.promptText.width + 28;
      const h = this.promptText.height + 14;
      this.promptBox.clear();
      this.promptBox.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 3, -h + 3, w, h, h / 2);
      this.promptBox.fillStyle(0xffffff, 0.96).fillRoundedRect(-w / 2, -h, w, h, h / 2);
      this.promptBox.lineStyle(3, 0x3c6edc, 1).strokeRoundedRect(-w / 2, -h, w, h, h / 2);
      this.promptText.setPosition(-w / 2 + 14, -h + 7);
      this.prompt.setVisible(true).setAlpha(0);
      this.scene.tweens.add({ targets: this.prompt, alpha: 1, duration: this.opts.motion === 'off' ? 0 : 140 });
    }
    const door = place.door;
    const sx = door.x * T + T / 2 - this.worldCam.scrollX;
    const sy = door.y * T - 6 - this.worldCam.scrollY;
    this.prompt.setPosition(Phaser.Math.Clamp(sx, 120, GAME_WIDTH - 120), Phaser.Math.Clamp(sy, 60, GAME_HEIGHT - 20));
  }

  destroy(): void {
    this.scene.sys.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    if (this.scene.cameras?.cameras.includes(this.worldCam)) this.scene.cameras.remove(this.worldCam);
  }
}

export { STEP };
