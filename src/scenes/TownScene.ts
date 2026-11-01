// Pocket Town (W7): the Hub's town. A backdrop that mirrors your last run (sun, cloud, storm), day and night (fireflies after dark),
// the season's prop, furniture you can drag, pets that trot after the cursor and a cursor trail. The buildings are menus
// (ui/townMenu.ts); every rule is in core/town. Presentation only: nothing here changes a result.

import Phaser from 'phaser';
import { buildingProblem, currentSeason, ownedSet, pets, townOf, townWeather, TOWN, type TownBuilding } from '../core/town';
import { services } from '../game/services';
import { playMusicLazy } from '../ui/audio';
import { pokemonAssetIds } from '../assets/catalog';
import { preloadPokemon } from '../ui/lazyAssets';
import type { Picker } from '../ui/partyPanel';
import { ArenaBackdrop } from '../ui/showcase';
import { itemVisual, pokemonIcon } from '../ui/sprites';
import { onInputAction } from '../ui/input';
import { openBuilding, openTown, type TownHost } from '../ui/townMenu';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';

const TRAIL_COLORS: Record<string, number[]> = {
  'tr-sparkle': [0xfff2a8, 0xffffff], 'tr-bubbles': [0x9ad8ff, 0xd6f0ff], 'tr-leaves': [0x7bd88f, 0xd9b26f], 'tr-fireflies': [0xf8f080, 0xc8ff9a], 'tr-rainbow': [0xff6b6b, 0xffd166, 0x6bd88f, 0x6bb5ff, 0xb78bff],
};

export class TownScene extends Phaser.Scene {
  private picker: Picker | null = null;
  private note!: Phaser.GameObjects.Text;
  private decorMode = false;
  private decorLayer: Phaser.GameObjects.Container | null = null;
  private petSprites: { obj: Phaser.GameObjects.GameObject & { x: number; y: number }; lag: number }[] = [];
  private trail: Phaser.GameObjects.Arc[] = [];
  private pointer = { x: GAME_WIDTH / 2, y: 300 };
  // The street: buildings stand along a scrolling road; the trainer walks it with the arrow keys.
  private street: { b: TownBuilding; x: number; node: Phaser.GameObjects.Container; near: boolean }[] = [];
  private walker!: Phaser.GameObjects.Container;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private host!: TownHost;
  private streetHint!: Phaser.GameObjects.Text;

  constructor() {
    super('Town');
  }

  preload(): void {
    const { session } = services();
    const list = pets(session.content, session.profile).slice(0, 3).map((x) => session.content.species.get(x.speciesId)!);
    preloadPokemon(this, list, { icon: true });
  }

  create(): void {
    const { session } = services();
    const p = session.profile;
    const motion = session.settings.battleAnimations;
    this.picker = null;
    this.decorMode = false;
    this.petSprites = [];
    this.trail = [];
    playMusicLazy(this, 'bgm.hub');
    new ArenaBackdrop(this, { platformAt: { x: GAME_WIDTH / 2, y: 350 } });
    const now = new Date();
    const night = now.getHours() >= 20 || now.getHours() < 6;
    const weather = townWeather(p);
    // Sky tint: the last run's result, then the night.
    const tint: Record<typeof weather, [number, number]> = { sun: [0xffd27a, 0.14], storm: [0x1d2447, 0.38], cloud: [0x8a93a6, 0.22], clear: [0x000000, 0] };
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, tint[weather][0], tint[weather][1]).setOrigin(0).setDepth(-18);
    if (night) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a1030, 0.5).setOrigin(0).setDepth(-17);
    if (weather === 'storm' && motion !== 'off') this.rain(motion);
    this.season(now, motion);
    this.add.text(16, 8, 'Pocket Town', textStyle(30, COLORS.gold)).setScrollFactor(0).setDepth(5);
    this.add.text(16, 44, `${{ sun: 'Sunny: your last run was a win.', storm: 'A storm hangs over the town after your last run.', cloud: 'Cloudy skies.', clear: 'A clear day.' }[weather]}${night ? ' It is night.' : ''}`, textStyle(15, COLORS.textMuted)).setScrollFactor(0).setDepth(5);
    this.note = this.add.text(GAME_WIDTH / 2, 80, '', textStyle(18, COLORS.gold, { align: 'center', wordWrap: { width: GAME_WIDTH - 160 } })).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);
    this.drawDecor();
    this.addPets(motion);
    if (night) this.fireflies(motion);
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => { this.pointer = { x: ptr.x, y: ptr.y }; });
    this.input.keyboard?.on('keydown-ESC', () => { if (this.decorMode) this.setDecorMode(false); });

    const host: TownHost = {
      scene: this,
      setPicker: (pk) => { this.picker = pk; },
      refresh: (msg) => this.say(msg),
      setDecorMode: (on) => this.setDecorMode(on),
      enter: (b) => this.bounce(b),
    };
    this.host = host;
    host.home = () => { this.host.refresh(''); };
    this.buildStreet(host);
    this.drawWall();
    onInputAction(this, (a) => {
      if (this.picker) { this.picker.handle(a); return; }
      if (a === 'confirm') this.enterNearest();
      else if (a === 'up') openTown(host, () => this.host.refresh(''));
      else if (a === 'back') this.scene.start('Hub');
    });
  }

  override update(_t: number, dt: number): void {
    const { session } = services();
    this.walk(dt);
    if (session.settings.battleAnimations === 'off') return;
    for (const pet of this.petSprites) {
      const k = 1 - Math.exp(-dt / (pet.lag * 16));
      pet.obj.x += (this.pointer.x - 30 - pet.obj.x) * k;
      pet.obj.y += (this.pointer.y + 24 - pet.obj.y) * k;
    }
    const colors = TRAIL_COLORS[townOf(session.profile).equipped.trail ?? ''];
    if (colors) {
      const dot = this.add.circle(this.pointer.x, this.pointer.y, 5, colors[Math.floor(Math.random() * colors.length)]!, 0.9).setDepth(3000);
      this.trail.push(dot);
      this.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 500, onComplete: () => dot.destroy() });
      if (this.trail.length > 40) this.trail.shift();
    }
  }

  private buildStreet(host: TownHost): void {
    const { session } = services();
    const list = TOWN.buildings.filter((b) => !b.hidden || !buildingProblem(session.profile, b));
    const width = 200 + list.length * 170;
    this.cameras.main.setBounds(0, 0, width, GAME_HEIGHT);
    this.add.rectangle(0, 430, width, 110, 0x3a3048, 0.85).setOrigin(0).setDepth(-6);
    this.street = list.map((b, i) => {
      const x = 140 + i * 170;
      const node = this.add.container(x, 380).setDepth(-3);
      node.add([this.add.rectangle(0, 0, 140, 90, 0x4a3b58, 0.95).setStrokeStyle(2, 0xffb745), this.add.text(0, 34, b.name, textStyle(13, '#f8f8f8', { align: 'center', wordWrap: { width: 130 } })).setOrigin(0.5)]);
      node.add(itemVisual(this, b.icon, 0, -12, 2));
      node.setSize(140, 90).setInteractive({ useHandCursor: true });
      node.on('pointerdown', () => this.walkTo(i));
      return { b, x, node, near: false };
    });
    this.walker = this.add.container(this.street[0]!.x, 455).setDepth(4);
    this.walker.add([this.add.circle(0, 0, 14, 0xffb745).setStrokeStyle(3, 0xffffff), this.add.rectangle(0, 16, 16, 12, 0xc73625)]);
    this.cameras.main.startFollow(this.walker, true, 0.12, 0.12);
    this.keys = this.input.keyboard!.createCursorKeys();
    this.streetHint = this.add.text(GAME_WIDTH / 2, 508, '← → walk · Enter go in · ↑ building list · Esc back to the Hub', textStyle(14, COLORS.textMuted)).setOrigin(0.5).setScrollFactor(0).setDepth(2100);
    void host;
  }

  private walk(dt: number): void {
    if (this.picker || !this.walker) return;
    const dir = (this.keys.right?.isDown ? 1 : 0) - (this.keys.left?.isDown ? 1 : 0);
    const maxX = this.street[this.street.length - 1]!.x + 60;
    if (dir !== 0) this.walker.x = Phaser.Math.Clamp(this.walker.x + dir * dt * 0.35, 60, maxX);
    for (const s of this.street) {
      const near = Math.abs(this.walker.x - s.x) < 70;
      if (near && !s.near) {
        const motion = services().session.settings.battleAnimations;
        if (motion !== 'off') this.tweens.add({ targets: s.node, scaleX: 1.12, scaleY: 0.9, duration: 120, yoyo: true, ease: 'Back.easeOut', onComplete: () => { s.node.setScale(1); } });
        this.streetHint.setText(`Enter: ${s.b.name} — ${s.b.blurb}`.slice(0, 110));
      }
      s.near = near;
    }
    if (!this.street.some((s) => s.near)) this.streetHint.setText('← → walk · Enter go in · ↑ building list · Esc back to the Hub');
  }

  private walkTo(i: number): void {
    const s = this.street[i]!;
    if (this.picker) return;
    const go = (): void => this.enterBuilding(s.b);
    if (services().session.settings.battleAnimations === 'off') { this.walker.x = s.x; go(); return; }
    this.tweens.add({ targets: this.walker, x: s.x, duration: Math.min(900, Math.abs(this.walker.x - s.x) * 1.2), onComplete: go });
  }

  private enterNearest(): void {
    const s = this.street.find((x) => x.near);
    if (s) this.enterBuilding(s.b);
  }

  private enterBuilding(b: TownBuilding): void {
    services().session.visitTown(b.id);
    this.bounce(b);
    openBuilding(this.host, b, () => this.host.refresh(''), () => this.host.refresh(''));
  }

  /** The Wall of Fame: the signatures (stamps and freehand drawings) in the corner of the screen. */
  private drawWall(): void {
    const { session } = services();
    const wall = townOf(session.profile).wall;
    if (wall.length === 0) return;
    const g = this.add.graphics().setScrollFactor(0).setDepth(-4);
    g.fillStyle(0x2b2236, 0.7).fillRect(16, 90, 150, 100);
    wall.slice(-8).forEach((sig, i) => {
      const [color, what] = sig.split('|');
      const col = Phaser.Display.Color.HexStringToColor(color ?? '#ffffff').color;
      const ox = 20 + (i % 4) * 36, oy = 94 + Math.floor(i / 4) * 48;
      g.lineStyle(2, col, 1);
      if (what?.startsWith('d:')) {
        for (const stroke of what.slice(2).split(':')) {
          const pts = stroke.split(';').map((q) => q.split(',').map(Number) as [number, number]);
          g.beginPath();
          pts.forEach(([x, y], k) => (k === 0 ? g.moveTo(ox + (x! / 100) * 32, oy + (y! / 100) * 42) : g.lineTo(ox + (x! / 100) * 32, oy + (y! / 100) * 42)));
          g.strokePath();
        }
      } else {
        g.fillStyle(col, 1).fillCircle(ox + 16, oy + 20, 10);
      }
    });
  }

  private say(msg: string): void {
    this.note.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.note);
    this.tweens.add({ targets: this.note, alpha: 0, delay: 5000, duration: 800 });
    this.drawDecor();
  }

  /** The entry bounce: the building's icon pops up and settles. */
  private bounce(b: TownBuilding): void {
    const { session } = services();
    const icon = itemVisual(this, b.icon, GAME_WIDTH / 2, 160, 4) as Phaser.GameObjects.GameObject & { setScale(s: number): void; setDepth(d: number): unknown; setAlpha(a: number): unknown };
    icon.setDepth(1500);
    if (session.settings.battleAnimations === 'off') { this.time.delayedCall(350, () => icon.destroy()); return; }
    icon.setScale(1);
    this.tweens.add({ targets: icon, scale: 5, duration: 220, ease: 'Back.easeOut', yoyo: true, hold: 160, onComplete: () => icon.destroy() });
  }

  private rain(motion: string): void {
    const drops = Array.from({ length: motion === 'full' ? 60 : 24 }, () => this.add.rectangle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 2, 14, 0xaed6ff, 0.5).setDepth(-16));
    this.time.addEvent({ delay: 30, loop: true, callback: () => drops.forEach((d) => { d.y += 16; d.x -= 3; if (d.y > GAME_HEIGHT) { d.y = -10; d.x = Math.random() * GAME_WIDTH; } }) });
  }

  private season(now: Date, motion: string): void {
    const s = currentSeason(now);
    const spots: Record<string, string> = { snowman: '⛄', blossom: '🌸', sunflower: '🌻', leaves: '🍂', pumpkin: '🎃' };
    const prop = this.add.text(GAME_WIDTH - 90, 330, spots[s.prop] ?? '✨', { fontSize: '56px' }).setDepth(-10);
    this.add.text(GAME_WIDTH - 90, 400, s.name, textStyle(14, COLORS.textMuted)).setDepth(-10);
    if (motion === 'full') this.tweens.add({ targets: prop, y: 322, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private addPets(motion: string): void {
    if (motion === 'off') return;
    const { session } = services();
    for (const [i, x] of pets(session.content, session.profile).slice(0, 3).entries()) {
      const sp = session.content.species.get(x.speciesId)!;
      if (!this.textures.exists(pokemonAssetIds(sp.assets).icon)) continue;
      const obj = pokemonIcon(this, sp, 200 + i * 40, 420, 1.2) as unknown as Phaser.GameObjects.GameObject & { x: number; y: number; setDepth(d: number): unknown };
      obj.setDepth(1000);
      this.petSprites.push({ obj, lag: 4 + i * 3 });
    }
  }

  private fireflies(motion: string): void {
    const { session } = services();
    for (let i = 0; i < 6; i++) {
      const fly = this.add.circle(80 + Math.random() * (GAME_WIDTH - 160), 140 + Math.random() * 260, 5, 0xf8f080, 0.9).setDepth(900).setInteractive({ useHandCursor: true });
      if (motion !== 'off') this.tweens.add({ targets: fly, x: fly.x + (Math.random() - 0.5) * 120, y: fly.y + (Math.random() - 0.5) * 80, alpha: 0.35, duration: 1800 + Math.random() * 1500, yoyo: true, repeat: -1 });
      fly.on('pointerdown', () => {
        const r = session.town('night-firefly', { grade: 'good' });
        this.say(r.message);
        if (r.ok) fly.destroy();
      });
    }
  }

  private setDecorMode(on: boolean): void {
    this.decorMode = on;
    this.drawDecor();
    if (on) this.say('Decor mode: drag your furniture. Esc to finish.');
  }

  /** Placed furniture. In decor mode each piece drags; a drop saves its position (a fraction of the screen). */
  private drawDecor(): void {
    const { session } = services();
    this.decorLayer?.destroy();
    const t = townOf(session.profile);
    const layer = this.add.container(0, 0).setDepth(this.decorMode ? 1800 : -5);
    this.decorLayer = layer;
    const owned = new Set(ownedSet(session.profile, 'decor'));
    for (const [id, pos] of Object.entries(t.placed)) {
      if (!owned.has(id)) continue;
      const w = 96, h = 56;
      const box = this.add.container(pos[0] * GAME_WIDTH, pos[1] * GAME_HEIGHT);
      box.add([this.add.rectangle(0, 0, w, h, 0x5a4a6a, 0.9).setStrokeStyle(2, this.decorMode ? 0xffb745 : 0x9b88b0), this.add.text(0, 0, id.replace(/^dc-/, ''), textStyle(14, '#f8f8f8')).setOrigin(0.5)]);
      box.setSize(w, h);
      if (this.decorMode) {
        box.setInteractive({ draggable: true, useHandCursor: true });
        this.input.setDraggable(box);
        box.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { box.setPosition(Phaser.Math.Clamp(x, 40, GAME_WIDTH - 40), Phaser.Math.Clamp(y, 100, GAME_HEIGHT - 40)); });
        box.on('dragend', () => { services().session.town('furniture-place', { choice: `${id}|${(box.x / GAME_WIDTH).toFixed(3)}|${(box.y / GAME_HEIGHT).toFixed(3)}` }); });
      }
      layer.add(box);
    }
    void TOWN;
  }
}
