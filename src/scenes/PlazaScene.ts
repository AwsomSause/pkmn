// The Trainer Plaza (spec §18): a lively square with five districts, a crowd that wanders, Pokémon that follow trainers,
// background chatter and a per-stage look. Pure presentation over core/plaza; every choice still goes through
// session.usePlaza, so nothing here changes the rules. Animations follow the Animations setting (Full / Reduced / Off).

import Phaser from 'phaser';
import { hashSeed, Rng } from '../core/rng';
import { plazaLayout, PLAZA_LIFE, type DistrictView, type PlazaLayout, type Wanderer } from '../core/plaza/layout';
import type { PlazaSectionId } from '../core/plaza/flow';
import { currentRegion } from '../core/regions';
import { regionIdentity } from '../core/presentation/regionIdentity';
import { services } from '../game/services';
import { playMusicLazy, playSfx } from '../ui/audio';
import { AERO, drawGlass, type MotionLevel } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { Picker } from '../ui/partyPanel';
import { pokemonIcon } from '../ui/sprites';
import { setAmbience, stopAmbience } from '../ui/procAudio';
import { GAME_HEIGHT, GAME_WIDTH, mixColor, textStyle } from '../ui/theme';
import { sceneForRun } from './routing';

const GROUND_Y = 300;
const WALK_TOP = 400;
const WALK_BOTTOM = 462;

export class PlazaScene extends Phaser.Scene {
  private sideId = '';
  private layout!: PlazaLayout;
  private menu: Picker | null = null;
  private focus = 0;
  private busy = false;
  private nodes = new Map<string, Phaser.GameObjects.Container>();
  private marker!: Phaser.GameObjects.Container;
  private focusRing!: Phaser.GameObjects.Graphics;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private followers: { mon: Phaser.GameObjects.Container; owner: string }[] = [];
  private headText!: Phaser.GameObjects.Text;
  /** The header, info strip and event line: hidden while a menu is open so they never sit over it. */
  private hud: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Plaza');
  }

  private get picker(): Picker | null {
    return this.menu;
  }

  /** Every menu goes through here, so the header and info strip hide while one is open. */
  private set picker(p: Picker | null) {
    this.menu = p;
    for (const o of this.hud) (o as Phaser.GameObjects.Text).setVisible(p === null);
    if (p) {
      this.bubble?.destroy();
      this.bubble = null;
    }
  }

  private get motion(): MotionLevel {
    return services().session.settings.battleAnimations;
  }

  create(data: { sideId?: string; notice?: string; focus?: number } = {}): void {
    const { session } = services();
    const run = session.run!;
    this.sideId = data.sideId ?? this.sideId;
    this.layout = plazaLayout(session.content, run, this.sideId);
    this.focus = data.focus ?? 0;
    this.picker = null;
    this.busy = false;
    this.nodes.clear();
    this.followers = [];
    this.bubble = null;
    this.bubbleTimer = null;
    playMusicLazy(this, 'bgm.shop');
    if (this.motion !== 'off') setAmbience(this, 'crowd');
    this.events.once('shutdown', () => stopAmbience());
    const region = currentRegion(session.content, run);
    const identity = regionIdentity(region.id);

    this.drawSky(identity.sky, identity.accent);
    this.drawGround(identity.accent);
    this.drawFountain();
    this.layout.districts.forEach((d, i) => this.drawDistrict(d, i));
    this.drawDecor();
    this.focusRing = this.add.graphics().setDepth(5);
    this.spawnCrowd();
    this.spawnPlayer();
    this.drawHud();
    this.refreshFocus(true);
    if (data.notice) this.say(data.notice, GAME_WIDTH / 2, 150, 4200);
    else this.say(PLAZA_LIFE.bubbles.player[(this.focus + run.plaza.visits) % PLAZA_LIFE.bubbles.player.length]!, this.marker.x, this.marker.y - 70, 2600);
    onInputAction(this, (action) => {
      if (this.picker) return this.picker.handle(action);
      if (this.busy) return;
      if (action === 'left') this.moveFocus(-1);
      else if (action === 'right') this.moveFocus(1);
      else if (action === 'confirm') this.openDistrict(this.layout.districts[this.focus]!);
      else if (action === 'back') this.leave();
    });
  }

  // ---------- drawing ----------

  private drawSky(sky: number, accent: number): void {
    const g = this.add.graphics().setDepth(-49);
    const top = mixColor(sky, this.layout.look.tint, 0.25);
    const bottom = mixColor(top, 0xfff0d0, 0.55);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(mixColor(top, bottom, i / 13), 1);
      g.fillRect(0, (GROUND_Y / 14) * i, GAME_WIDTH, GROUND_Y / 14 + 1);
    }
    // Distant skyline with lit windows.
    const rng = new Rng(hashSeed(`${this.sideId}::skyline`));
    const sky2 = this.add.graphics().setDepth(-48);
    let x = -10;
    while (x < GAME_WIDTH) {
      const w = 40 + rng.int(0, 50);
      const h = 50 + rng.int(0, 90);
      sky2.fillStyle(mixColor(sky, 0x101030, 0.55), 1).fillRect(x, GROUND_Y - h, w, h);
      for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 8; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (rng.chance(0.4)) sky2.fillStyle(mixColor(accent, 0xffffff, 0.5), 0.8).fillRect(wx, wy, 5, 7);
        }
      }
      x += w + rng.int(2, 10);
    }
    // Clouds drifting past (still with Reduced / Off).
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.ellipse(120 + i * 250, 50 + (i % 2) * 36, 150, 34, 0xffffff, 0.35).setDepth(-47);
      if (this.motion === 'full') this.tweens.add({ targets: cloud, x: cloud.x + 140, duration: 14000 + i * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawGround(accent: number): void {
    const g = this.add.graphics().setDepth(-46);
    const stone = mixColor(0x8a8090, this.layout.look.tint, 0.2);
    g.fillStyle(stone, 1).fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    for (let row = 0; row < 12; row++) {
      const y = GROUND_Y + row * 22;
      g.lineStyle(1, mixColor(stone, 0x000000, 0.3), 0.6).lineBetween(0, y, GAME_WIDTH, y);
      for (let x = (row % 2) * 24; x < GAME_WIDTH; x += 48) g.lineBetween(x, y, x, y + 22);
    }
    // A wide path in the region's accent colour.
    g.fillStyle(mixColor(stone, accent, 0.3), 0.55).fillRect(0, WALK_TOP - 18, GAME_WIDTH, WALK_BOTTOM - WALK_TOP + 36);
  }

  private drawFountain(): void {
    const x = GAME_WIDTH / 2;
    const y = 445;
    const g = this.add.graphics().setDepth(-30);
    g.fillStyle(0x7a8498, 1).fillEllipse(x, y, 130, 36);
    g.fillStyle(0x58b8e8, 0.9).fillEllipse(x, y - 2, 112, 28);
    g.fillStyle(0x9aa4b8, 1).fillRect(x - 6, y - 40, 12, 38);
    const spot = this.add.zone(x, y - 10, 150, 70).setInteractive({ useHandCursor: true }).setDepth(-28);
    spot.on('pointerdown', () => !this.picker && !this.busy && this.openDistrict(this.layout.districts.find((d) => d.id === 'gathering')!));
    if (this.motion === 'off') return;
    for (let i = 0; i < 6; i++) {
      const drop = this.add.circle(x, y - 40, 3, 0xbfe8ff, 0.9).setDepth(-29);
      this.tweens.add({ targets: drop, x: x + (i - 2.5) * 12, y, alpha: { from: 0.9, to: 0.1 }, duration: 900, delay: i * 140, repeat: -1, ease: 'Quad.easeIn' });
    }
  }

  private drawDistrict(d: DistrictView, index: number): void {
    const cx = Math.round(d.x * GAME_WIDTH);
    const base = Math.round(d.y * GAME_HEIGHT) + 40;
    const secret = d.id === 'secret';
    const w = secret ? 90 : 126;
    const h = secret ? 100 : 92;
    const root = this.add.container(cx, base).setDepth(d.locked && !secret ? -5 : 0);
    const g = this.add.graphics();
    const wall = d.locked ? 0x4a4658 : mixColor(d.color, 0xfff4e0, 0.45);
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 6, w + 20, 16);
    g.fillStyle(wall, 1).fillRect(-w / 2, -h, w, h);
    g.fillStyle(mixColor(wall, 0x000000, 0.25), 1).fillRect(-w / 2, -h, w, 6);
    if (secret) {
      g.fillStyle(0x0a0818, 1).fillRoundedRect(-24, -70, 48, 70, { tl: 24, tr: 24, bl: 0, br: 0 });
    } else {
      // Awning in the district's colour with a scalloped edge.
      g.fillStyle(d.locked ? 0x62607a : d.color, 1).fillRect(-w / 2 - 6, -h - 4, w + 12, 20);
      for (let sx = -w / 2 - 6; sx < w / 2 + 6; sx += 18) g.fillStyle(0xffffff, 0.85).fillTriangle(sx, -h + 16, sx + 18, -h + 16, sx + 9, -h + 28);
      g.fillStyle(mixColor(wall, 0x000000, 0.5), 1).fillRect(-18, -46, 36, 46);
      g.fillStyle(0xfff0c0, 0.8).fillRect(-w / 2 + 10, -64, 22, 20).fillRect(w / 2 - 32, -64, 22, 20);
    }
    root.add(g);
    root.add(this.add.text(0, -h - 20, d.name, textStyle(15, d.locked ? '#a8a0b8' : '#ffffff', { stroke: '#101028', strokeThickness: 4 })).setOrigin(0.5));
    if (d.count > 0) {
      root.add(this.add.circle(w / 2 - 6, -h - 4, 12, 0xe84868, 1).setStrokeStyle(2, 0xffffff));
      root.add(this.add.text(w / 2 - 6, -h - 4, String(d.count), textStyle(14, '#ffffff')).setOrigin(0.5));
    }
    if (d.locked && !secret) root.add(this.add.text(0, -h / 2, 'Closed', textStyle(14, '#d8d0e0')).setOrigin(0.5));
    // Lamp glow on open districts.
    if (!d.locked && this.motion !== 'off') {
      const glow = this.add.circle(0, -h - 6, 40, d.color, 0.14);
      root.addAt(glow, 0);
      this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.3 }, scale: { from: 0.9, to: 1.2 }, duration: 1800 + index * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const zone = this.add.zone(0, -h / 2, w + 20, h + 40).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (this.picker || this.busy) return;
      this.focus = index;
      this.refreshFocus(false);
    });
    zone.on('pointerdown', () => {
      if (this.picker || this.busy) return;
      this.focus = index;
      this.refreshFocus(false);
      this.openDistrict(d);
    });
    root.add(zone);
    this.nodes.set(`district:${d.id}`, root);
  }

  /** Stage decorations from the look: lanterns, banners, flowers, trees, statue, awnings, flags, crates. */
  private drawDecor(): void {
    const look = this.layout.look;
    const g = this.add.graphics().setDepth(-20);
    const rng = new Rng(hashSeed(`${this.sideId}::decor`));
    const has = (n: string): boolean => look.decor.includes(n);
    if (has('lanterns') || has('banners') || has('flags')) {
      g.lineStyle(2, 0x3a2a40, 0.9).lineBetween(0, 40, GAME_WIDTH, 52);
      for (let x = 30; x < GAME_WIDTH; x += 70) {
        const y = 40 + (x / GAME_WIDTH) * 12 + 6;
        const col = has('lanterns') ? look.tint : [0xe84848, 0xf0c040, 0x48a8e8, 0x60c868][rng.int(0, 3)]!;
        if (has('lanterns')) {
          const lantern = this.add.ellipse(x, y + 10, 16, 22, col, 0.95).setDepth(-19);
          if (this.motion === 'full') this.tweens.add({ targets: lantern, angle: { from: -6, to: 6 }, duration: 1500 + (x % 5) * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else {
          g.fillStyle(col, 0.95).fillTriangle(x - 12, y, x + 12, y, x, y + 26);
        }
      }
    }
    if (has('flowers')) for (let i = 0; i < 16; i++) g.fillStyle([0xf0709a, 0xf8e060, 0xffffff][i % 3]!, 1).fillCircle(20 + i * 58, 478 + (i % 3) * 8, 4);
    if (has('trees')) for (const tx of [34, GAME_WIDTH - 34]) { g.fillStyle(0x5a3a28, 1).fillRect(tx - 5, 380, 10, 60); g.fillStyle(0x3a9a50, 1).fillCircle(tx, 360, 34); }
    if (has('statue')) { g.fillStyle(0x9aa0b0, 1).fillRect(GAME_WIDTH / 2 - 150, 360, 22, 54).fillCircle(GAME_WIDTH / 2 - 139, 350, 12); }
    if (has('awnings')) for (let x = 60; x < GAME_WIDTH; x += 240) g.fillStyle(look.tint, 0.5).fillRect(x, 470, 80, 6);
    if (has('crates')) for (const cx of [40, GAME_WIDTH - 90]) g.fillStyle(0x8a5a30, 1).fillRect(cx, 440, 34, 28).fillRect(cx + 22, 424, 28, 24);
  }

  private spawnCrowd(): void {
    const { content } = services().session;
    const byId = new Map(this.layout.crowd.map((w) => [w.id, w]));
    for (const w of this.layout.crowd) {
      const district = this.layout.districts.find((d) => d.id === w.home)!;
      const hx = Math.round(district.x * GAME_WIDTH);
      const rng = new Rng(hashSeed(`${this.sideId}::walk::${w.id}`));
      const x = hx + rng.int(-w.roam, w.roam);
      const y = rng.int(WALK_TOP, WALK_BOTTOM);
      const node = this.add.container(x, y).setDepth(y);
      if (w.kind === 'pokemon' && w.speciesId) {
        const species = content.species.get(w.speciesId);
        if (species) node.add(pokemonIcon(this, species, 0, -14, 1.3));
      } else {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.25).fillEllipse(0, 2, 22, 8);
        node.add(g);
        const art = this.trainerArt(w.spriteId);
        if (art) {
          node.add(art);
        } else {
          g.fillStyle(w.color, 1).fillRoundedRect(-7, -26, 14, 22, 5);
          g.fillStyle(0xf4d8b8, 1).fillCircle(0, -32, 7);
        }
        if (w.kind === 'rare') g.lineStyle(2, 0xfff0a0, 1).strokeEllipse(0, -26, 34, 56);
        if (w.kind === 'rival' || w.kind === 'foe' || w.kind === 'rare') node.add(this.add.text(0, -52, w.name, textStyle(11, '#ffffff', { stroke: '#101028', strokeThickness: 3 })).setOrigin(0.5));
      }
      node.setSize(28, 44).setInteractive({ useHandCursor: true });
      node.on('pointerdown', () => !this.picker && !this.busy && this.say(w.line, node.x, node.y - 60, 4000));
      if (w.kind === 'rare') node.on('pointerup', () => !this.picker && !this.busy && this.time.delayedCall(1400, () => !this.picker && this.openDistrict(this.layout.districts.find((d) => d.id === 'gathering')!)));
      this.nodes.set(w.id, node);
      if (w.follows && byId.has(w.follows)) this.followers.push({ mon: node, owner: w.follows });
      else this.startWalk(node, w, hx, rng);
      if (w.kind === 'rare' && this.motion === 'full') {
        const spark = this.add.text(0, -60, '✦', textStyle(16, '#fff0a0')).setOrigin(0.5);
        node.add(spark);
        this.tweens.add({ targets: spark, alpha: { from: 1, to: 0.2 }, angle: 360, duration: 1200, repeat: -1 });
      }
    }
    this.chatLoop();
  }

  /** A trainer class's sprite, fitted to about 54 px tall; null when the art is not loaded (a drawn figure is used then). */
  private trainerArt(assetId: string | undefined): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null {
    if (!assetId || !this.textures.exists(assetId)) return null;
    const tex = this.textures.get(assetId);
    if (tex.frameTotal === 0) return null;
    const names = tex.getFrameNames().sort();
    const art = names.length > 0 ? this.add.image(0, 4, assetId, names[0]) : this.add.image(0, 4, assetId);
    art.setOrigin(0.5, 1);
    art.setScale(54 / Math.max(1, art.height));
    return art;
  }

  private startWalk(node: Phaser.GameObjects.Container, w: Wanderer, hx: number, rng: Rng): void {
    if (this.motion === 'off') return;
    const step = (): void => {
      if (!node.active) return;
      const tx = Phaser.Math.Clamp(hx + rng.int(-w.roam, w.roam), 30, GAME_WIDTH - 30);
      const ty = rng.int(WALK_TOP, WALK_BOTTOM);
      const dist = Phaser.Math.Distance.Between(node.x, node.y, tx, ty);
      const speed = this.motion === 'reduced' ? w.speed * 0.6 : w.speed;
      this.tweens.add({
        targets: node, x: tx, y: ty, duration: (dist / speed) * 1000, delay: rng.int(300, 2600), ease: 'Sine.easeInOut',
        onUpdate: () => node.setDepth(node.y),
        onComplete: step,
      });
    };
    step();
  }

  private chatLoop(): void {
    if (this.motion === 'off' || this.layout.chats.length === 0) return;
    let i = 0;
    this.time.addEvent({
      delay: 5200, loop: true,
      callback: () => {
        const chat = this.layout.chats[i % this.layout.chats.length]!;
        const a = this.nodes.get(chat.a);
        const b = this.nodes.get(chat.b);
        if (a && b && !this.picker) {
          this.say(chat.lines[0], a.x, a.y - 60, 2200, false);
          this.time.delayedCall(2300, () => !this.picker && b.active && this.say(chat.lines[1], b.x, b.y - 60, 2200, false));
        }
        i++;
      },
    });
  }

  private spawnPlayer(): void {
    const { session } = services();
    const d = this.layout.districts[this.focus]!;
    const x = Math.round(d.x * GAME_WIDTH);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillEllipse(0, 2, 26, 9);
    g.fillStyle(0x3a58c8, 1).fillRoundedRect(-8, -28, 16, 24, 5);
    g.fillStyle(0xf4d8b8, 1).fillCircle(0, -34, 8);
    g.fillStyle(0xd83838, 1).fillRect(-9, -42, 18, 5);
    this.marker = this.add.container(x, WALK_BOTTOM + 14, [g]).setDepth(900);
    const lead = session.run!.party.find((m) => m.hp > 0) ?? session.run!.party[0];
    const species = lead ? session.content.species.get(lead.speciesId) : undefined;
    if (species) {
      const mon = this.add.container(x - 32, WALK_BOTTOM + 18, [pokemonIcon(this, species, 0, -14, 1.3)]).setDepth(899);
      this.followers.push({ mon, owner: 'player' });
      this.nodes.set('player-mon', mon);
    }
    this.nodes.set('player', this.marker);
    this.events.on('update', () => {
      for (const f of this.followers) {
        const owner = f.owner === 'player' ? this.marker : this.nodes.get(f.owner);
        if (!owner || !f.mon.active) continue;
        f.mon.x += (owner.x - 30 - f.mon.x) * 0.06;
        f.mon.y += (owner.y + 4 - f.mon.y) * 0.06;
        f.mon.setDepth(f.owner === 'player' ? 899 : f.mon.y);
      }
    });
    if (this.motion === 'full') this.tweens.add({ targets: this.marker, y: this.marker.y - 3, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawHud(): void {
    const { view } = this.layout;
    this.hud = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.hud.push(o);
      return o;
    };
    keep(drawGlass(this, 16, 8, GAME_WIDTH - 32, 40, { tint: AERO.sky, rim: AERO.rim, glow: false, radius: 18 }).setDepth(1000));
    keep(this.add.text(34, 28, `Trainer Plaza  ·  ${this.layout.title}`, textStyle(20)).setOrigin(0, 0.5).setDepth(1001));
    this.headText = keep(this.add.text(GAME_WIDTH - 34, 28, '', textStyle(16, '#f0e0a0')).setOrigin(1, 0.5).setDepth(1001));
    this.updateHead();
    keep(drawGlass(this, 16, GAME_HEIGHT - 66, GAME_WIDTH - 32, 56, { tint: AERO.glass, rim: AERO.rim, glow: false, radius: 18 }).setDepth(1000));
    this.infoTitle = keep(this.add.text(34, GAME_HEIGHT - 58, '', textStyle(18)).setDepth(1001));
    this.infoBody = keep(this.add.text(34, GAME_HEIGHT - 34, '', textStyle(14, '#d8d0e0', { wordWrap: { width: GAME_WIDTH - 200 } })).setDepth(1001));
    keep(this.add.text(GAME_WIDTH - 34, GAME_HEIGHT - 34, '← → move  ·  Enter open  ·  Esc leave', textStyle(13, '#a8c8e8')).setOrigin(1, 0.5).setDepth(1001));
    const event = keep(this.add.text(GAME_WIDTH / 2, 62, `${view.event.name}: ${view.event.text}`, textStyle(13, '#f0e0a0', { stroke: '#101028', strokeThickness: 3, wordWrap: { width: GAME_WIDTH - 80 }, align: 'center' })).setOrigin(0.5, 0).setDepth(1001));
    if (this.motion === 'full') this.tweens.add({ targets: event, alpha: { from: 0, to: 1 }, duration: 600 });
  }

  private updateHead(): void {
    const run = services().session.run!;
    this.layout.view.money = run.money;
    this.layout.view.rep = run.plaza.rep;
    this.headText.setText(`${this.layout.view.repTitle} (${run.plaza.rep})  ·  ₽${run.money}`);
  }

  // ---------- interaction ----------

  private moveFocus(delta: number): void {
    const n = this.layout.districts.length;
    this.focus = (this.focus + delta + n) % n;
    playSfx(this, 'ui.move');
    this.refreshFocus(false);
  }

  private refreshFocus(instant: boolean): void {
    const d = this.layout.districts[this.focus]!;
    const x = Math.round(d.x * GAME_WIDTH);
    const base = Math.round(d.y * GAME_HEIGHT) + 40;
    this.focusRing.clear();
    this.focusRing.lineStyle(3, AERO.rim, 0.9).strokeRoundedRect(x - 78, base - 138, 156, 156, 16);
    this.infoTitle.setText(`${d.name}${d.count > 0 ? `   (${d.count})` : ''}`);
    this.infoBody.setText(d.locked && d.id === 'secret' ? (this.layout.view.alleyHint ?? PLAZA_LIFE.bubbles.secretClosed) : d.locked ? 'Closed right now.' : d.blurb);
    const ty = d.id === 'secret' ? base + 20 : WALK_BOTTOM + 14;
    if (instant || this.motion === 'off') this.marker.setPosition(x, ty);
    else this.tweens.add({ targets: this.marker, x, duration: 380, ease: 'Back.easeOut' });
  }

  private say(text: string, x: number, y: number, ms: number, sound = true): void {
    this.bubble?.destroy();
    this.bubbleTimer?.remove(false);
    const w = Math.min(360, 60 + text.length * 6.4);
    const t = this.add.text(0, 0, text, textStyle(13, '#ffffff', { wordWrap: { width: w } })).setOrigin(0.5);
    const bw = t.width + 24;
    const bh = t.height + 16;
    const bx = Phaser.Math.Clamp(x, bw / 2 + 12, GAME_WIDTH - bw / 2 - 12);
    const by = Math.max(bh / 2 + 70, y);
    const box = drawGlass(this, -bw / 2, -bh / 2, bw, bh, { tint: AERO.glass, rim: AERO.rim, glow: false, radius: 12 });
    this.bubble = this.add.container(bx, by, [box, t]).setDepth(1100);
    if (this.motion !== 'off') this.tweens.add({ targets: this.bubble, scale: { from: 0.7, to: 1 }, duration: 180, ease: 'Back.easeOut' });
    if (sound) playSfx(this, 'ui.move', 0.4);
    this.bubbleTimer = this.time.delayedCall(ms, () => {
      this.bubble?.destroy();
      this.bubble = null;
    });
  }

  private leave(notice?: string): void {
    this.busy = true;
    this.picker?.close();
    this.picker = null;
    this.scene.start('Map', { notice: notice ?? 'You leave the plaza.', focus: 0 });
  }

  /** Opens a district: its only section straight away, or a short list of its sections. */
  private openDistrict(d: DistrictView, notice?: string): void {
    if (d.locked) {
      playSfx(this, 'ui.error', 0.5);
      this.say(d.id === 'secret' ? (this.layout.view.alleyHint ?? PLAZA_LIFE.bubbles.secretClosed) : 'Closed right now.', Math.round(d.x * GAME_WIDTH), 150, 2600);
      return;
    }
    playSfx(this, 'ui.select');
    if (d.sections.length === 1) return this.openSection(d, d.sections[0]!.id, notice);
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `${d.name}  ·  ₽${services().session.run!.money}`,
      columns: 1,
      rowHeight: 64,
      rows: d.sections.map((s) => ({
        problem: s.count === 0 ? 'Nothing here right now.' : null,
        hint: s.title,
        draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
          box.add(scene.add.text(16, 8, `${s.title}   (${s.count})`, textStyle(22)));
          box.add(scene.add.text(16, 36, this.sectionBlurb(s.id), textStyle(15, '#d8d0e0', { wordWrap: { width: w - 32 } })));
        },
      })),
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        this.openSection(d, d.sections[i]!.id);
      },
      onBack: () => this.closeMenu(),
    });
    this.picker = picker;
  }

  private sectionBlurb(id: PlazaSectionId): string {
    return this.layout.view.sections.find((s) => s.id === id)?.blurb ?? '';
  }

  private closeMenu(notice?: string): void {
    this.picker?.close();
    this.picker = null;
    this.scene.restart({ focus: this.focus, notice });
  }

  private openSection(d: DistrictView, section: PlazaSectionId, notice?: string): void {
    const { session } = services();
    const view = session.plazaSection(this.sideId, section);
    const notes = [...(notice ? [`» ${notice}`] : []), ...view.notes];
    const rows = view.options;
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `${d.name}  ·  ₽${session.run!.money}`,
      columns: 1,
      rowHeight: 78,
      rows: [
        ...notes.map((note) => ({ problem: note, draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => box.add(scene.add.text(16, 6, note, textStyle(15, '#f0e0a0', { wordWrap: { width: w - 32 } }))) })),
        ...rows.map((row) => ({
          problem: row.problem,
          hint: row.text,
          draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
            box.add(scene.add.text(16, 6, `${row.title}${row.cost > 0 ? `   ₽${row.cost}` : ''}`, textStyle(20, '#ffffff', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 34, row.text, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 } })));
          },
        })),
      ],
      onSelect: (i) => {
        const row = rows[i - notes.length]!;
        picker.close();
        this.picker = null;
        playSfx(this, 'ui.select');
        let result;
        try {
          result = session.usePlaza(this.sideId, section, row.id);
        } catch (err) {
          playSfx(this, 'ui.error', 0.5);
          return this.openSection(d, section, String(err instanceof Error ? err.message : err));
        }
        if (result.battle || session.run!.phase !== 'map') {
          this.busy = true;
          this.scene.start(sceneForRun(session.run!));
          return;
        }
        this.updateHead();
        this.openSection(d, section, result.message);
      },
      onBack: () => this.closeMenu(),
    });
    this.picker = picker;
  }
}
