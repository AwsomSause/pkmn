// Arena life that follows the fight (Visual Bible 4.1-4.8): contact shadows under the Pokémon, a slow
// parallax drift between the background and the ground patches, a soft vignette frame, league dressing for
// gym, Elite Four and champion arenas, and an arena light that shifts with boss phases.
//
// Presentation only: positions come from the sprites, nothing here uses gameplay RNG, reduced motion
// keeps everything still and "off" drops the dressing and light.

import Phaser from 'phaser';
import type { MotionLevel } from '../aero';
import { FLYER_LIFT, shadowLook } from '../../core/arenaStyle';
import { GAME_HEIGHT, GAME_WIDTH } from '../theme';

type Visual = Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;

/** One Pokémon the shadows follow: its sprite, the y it stands at, and whether it floats. */
export interface ShadowTarget {
  visual: Visual | null;
  homeY: number;
  flyer: boolean;
}

/** Soft ellipses under up to four Pokémon, kept below the sprites in the field. */
export function addContactShadows(scene: Phaser.Scene, field: Phaser.GameObjects.Container, targets: () => ShadowTarget[]): void {
  const pool = Array.from({ length: 4 }, () => {
    const e = scene.add.ellipse(0, 0, 100, 22, 0x000000, 0.3).setVisible(false);
    field.add(e);
    return e;
  });
  const tick = () => {
    const list = targets();
    pool.forEach((e, i) => {
      const t = list[i];
      const v = t?.visual;
      if (!t || !v || !v.active || !v.visible || v.alpha < 0.05) return void e.setVisible(false);
      const look = shadowLook((v as Phaser.GameObjects.Sprite).displayWidth || 110, t.homeY - v.y, t.flyer);
      e.setVisible(true).setPosition(v.x, t.homeY - 3 + look.dy).setSize(look.width, look.width * 0.2).setDisplaySize(look.width, look.width * 0.2).setAlpha(look.alpha);
    });
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}

/** Background and ground patches drift a few pixels in opposite phases (depth without a camera). */
export function addParallax(scene: Phaser.Scene, back: Phaser.GameObjects.Image[], ground: Phaser.GameObjects.Image[], motion: MotionLevel): void {
  if (motion !== 'full') return;
  const home = [...back, ...ground].map((o) => o.x);
  const tick = (time: number) => {
    const t = time / 1000;
    back.forEach((o, i) => (o.x = home[i]! + Math.sin(t * 0.7) * 5));
    ground.forEach((o, i) => (o.x = home[back.length + i]! - Math.sin(t * 0.7) * 2));
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}

/** A dark rim around the battlefield (drawn once, cached as a texture) so the arena feels framed. */
export function addVignette(scene: Phaser.Scene): void {
  const key = 'arena.vignette';
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;
    const g = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, GAME_HEIGHT * 0.3, GAME_WIDTH / 2, GAME_HEIGHT * 0.45, GAME_WIDTH * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,8,30,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    tex.refresh();
  }
  scene.add.image(0, 0, key).setOrigin(0);
}

export type ArenaRole = 'gym' | 'elite' | 'champion';

/** Light that builds a league arena up: gym beams, Elite Four pillars, the champion's sunburst. Added at `at` in the field. */
export function dressArena(scene: Phaser.Scene, field: Phaser.GameObjects.Container, at: number, role: ArenaRole, color: number, motion: MotionLevel): Phaser.GameObjects.GameObject[] {
  if (motion === 'off') return [];
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const moving = motion === 'full';
  if (role === 'gym') {
    g.fillStyle(color, 0.13);
    g.fillTriangle(180, 0, 330, 0, 470, 330);
    g.fillTriangle(780, 0, 630, 0, 490, 330);
  } else if (role === 'elite') {
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 195;
      g.fillStyle(color, 0.12);
      g.fillRect(x - 26, 0, 52, 360);
      g.fillStyle(0xffffff, 0.08);
      g.fillRect(x - 6, 0, 12, 360);
    }
  } else {
    g.fillStyle(0xfff0a0, 0.1);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.fillTriangle(0, 0, Math.cos(a) * 900, Math.sin(a) * 900, Math.cos(a + 0.12) * 900, Math.sin(a + 0.12) * 900);
    }
    g.setPosition(480, 180);
  }
  field.addAt(g, at);
  if (moving) {
    if (role === 'champion') scene.tweens.add({ targets: g, rotation: Math.PI / 7, duration: 40_000, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: g, alpha: 0.55, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return [g];
}

/** Arena light for boss phases: a tinted additive wash that deepens each phase and pulses when it changes. */
export class ArenaLight {
  private wash: Phaser.GameObjects.Rectangle | null = null;
  private level = 0;

  constructor(private scene: Phaser.Scene, field: Phaser.GameObjects.Container, at: number, private motion: MotionLevel) {
    if (motion === 'off') return;
    this.wash = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff4040, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    field.addAt(this.wash, at);
  }

  /** Phase 0 is no wash; each later phase adds a stronger one in the given colour. */
  set(level: number, color: number): void {
    if (!this.wash || level === this.level) return;
    const up = level > this.level;
    this.level = level;
    const alpha = Math.min(0.3, level * 0.1);
    this.wash.setFillStyle(color, 1);
    if (this.motion !== 'full') return void this.wash.setAlpha(alpha);
    this.scene.tweens.killTweensOf(this.wash);
    this.scene.tweens.add({ targets: this.wash, alpha: up ? alpha + 0.25 : alpha, duration: 220, yoyo: up, ease: 'Quad.easeOut', onComplete: () => this.wash?.setAlpha(alpha) });
  }
}
