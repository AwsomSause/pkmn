// Plays an animation family's recipe (core/presentation/families.ts): the
// effect a move shows when neither its pack nor its PokeRogue animation file
// can play. Startup on the user, travel to the target, impact, and a screen
// wash for the big ones, tinted in the move's type colour. Built from shapes
// plus the Deluxe Battle Kit burst/shine/particle art.
//
// Decoration only: no battle state, no random numbers (every spread below is
// a fixed pattern), and it all cleans itself up.

import Phaser from 'phaser';
import { FAMILY_RECIPES, type FamilyId, type FamilyRecipe } from '../../core/presentation/families';

export interface FamilyStage {
  scene: Phaser.Scene;
  field: Phaser.GameObjects.Container;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The user's sprite, for the lunge. */
  user: Phaser.GameObjects.GameObject & { x: number };
  color: number;
  /** 0–1 from the effect-intensity setting. */
  intensity: number;
  /** Shake strength; defaults to `intensity`. */
  shake?: number;
  /** 1 normal, 2 fast, 3 quick. */
  speed: number;
}

/** Fixed angles for spreads (no random numbers in presentation). */
const SPREAD = [0, 52, 104, 155, 208, 259, 311];

function image(stage: FamilyStage, key: string, x: number, y: number): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
  const { scene, field, color } = stage;
  const obj = scene.textures.exists(key)
    ? scene.add.image(x, y, key).setTint(color).setBlendMode(Phaser.BlendModes.ADD)
    : scene.add.circle(x, y, 28, color, 0.8).setBlendMode(Phaser.BlendModes.ADD);
  field.add(obj);
  return obj;
}

function tween(stage: FamilyStage, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    stage.scene.tweens.add({ ...config, duration: Math.max(40, (config.duration as number) / stage.speed), delay: ((config.delay as number) ?? 0) / stage.speed, onComplete: () => resolve() });
  });
}

const kill = (...objs: Phaser.GameObjects.GameObject[]) => objs.forEach((o) => o.destroy());

async function startup(stage: FamilyStage, kind: FamilyRecipe['startup']): Promise<void> {
  if (kind === 'none') return;
  const { scene, field, from, color } = stage;
  if (kind === 'glow') {
    const ring = scene.add.circle(from.x, from.y, 50, color, 0.25).setStrokeStyle(4, color, 0.9);
    field.add(ring);
    await tween(stage, { targets: ring, scale: { from: 0.5, to: 1.3 }, alpha: 0, duration: 260, ease: 'Sine.easeOut' });
    return kill(ring);
  }
  // Charge: motes drawn in to the user from a fixed ring.
  const motes = SPREAD.map((deg) => {
    const r = Phaser.Math.DegToRad(deg);
    const m = image(stage, 'pack.dbk.particle', from.x + Math.cos(r) * 90, from.y + Math.sin(r) * 70).setScale(0.5);
    return m;
  });
  await tween(stage, { targets: motes, x: from.x, y: from.y, scale: 0.15, duration: 320, ease: 'Quad.easeIn' });
  kill(...motes);
}

async function travel(stage: FamilyStage, kind: FamilyRecipe['travel']): Promise<void> {
  const { scene, field, from, to, color, user } = stage;
  switch (kind) {
    case 'none':
      return;
    case 'dash': {
      const x = user.x;
      await tween(stage, { targets: user, x: x + Math.sign(to.x - from.x) * 28, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      return;
    }
    case 'orb': {
      const orb = image(stage, 'pack.dbk.particle', from.x, from.y).setScale(0.8);
      await tween(stage, { targets: orb, x: to.x, y: to.y, scale: 1.1, duration: 240, ease: 'Sine.easeIn' });
      return kill(orb);
    }
    case 'beam': {
      const len = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      const beam = scene.add.rectangle(from.x, from.y, len, 18, color, 0.85).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      const core = scene.add.rectangle(from.x, from.y, len, 6, 0xffffff, 0.9).setOrigin(0, 0.5);
      const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
      [beam, core].forEach((b) => field.add(b.setAngle(angle).setScale(0, 1)));
      await tween(stage, { targets: [beam, core], scaleX: 1, duration: 180, ease: 'Quad.easeOut' });
      await tween(stage, { targets: [beam, core], scaleY: 0, alpha: 0, duration: 160 });
      return kill(beam, core);
    }
    case 'wave': {
      const arcs = [0, 1, 2].map((i) => {
        const a = scene.add.circle(from.x, from.y, 26, color, 0).setStrokeStyle(5, color, 0.9);
        field.add(a);
        return { a, i };
      });
      await Promise.all(arcs.map(({ a, i }) => tween(stage, { targets: a, x: to.x, y: to.y, scale: 1.6, alpha: 0.2, duration: 280, delay: i * 70, ease: 'Sine.easeOut' })));
      return kill(...arcs.map((x) => x.a));
    }
    case 'tether': {
      const line = scene.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.7).setOrigin(0, 0).setLineWidth(4);
      field.add(line);
      const motes = [0, 1, 2, 3].map(() => image(stage, 'pack.dbk.particle', to.x, to.y).setScale(0.4));
      await Promise.all(motes.map((m, i) => tween(stage, { targets: m, x: from.x, y: from.y, duration: 300, delay: i * 60, ease: 'Sine.easeInOut' })));
      return kill(line, ...motes);
    }
    case 'rise': {
      const motes = [-30, -10, 10, 30].map((dx) => image(stage, 'pack.dbk.particle', from.x + dx, from.y + 40).setScale(0.45));
      await Promise.all(motes.map((m, i) => tween(stage, { targets: m, y: from.y - 50, alpha: 0, duration: 360, delay: i * 50, ease: 'Sine.easeOut' })));
      return kill(...motes);
    }
  }
}

async function impact(stage: FamilyStage, kind: FamilyRecipe['impact'], at: { x: number; y: number }): Promise<void> {
  const { scene, field, color } = stage;
  const parts: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    field.add(o);
    parts.push(o);
    return o;
  };
  const jobs: Promise<void>[] = [];
  switch (kind) {
    case 'ring':
    case 'shield': {
      const ring = add(scene.add.circle(at.x, at.y, kind === 'shield' ? 64 : 40, color, kind === 'shield' ? 0.18 : 0).setStrokeStyle(5, color, 1));
      jobs.push(tween(stage, kind === 'shield' ? { targets: ring, scale: { from: 0.6, to: 1 }, alpha: { from: 1, to: 0 }, duration: 360, ease: 'Back.easeOut' } : { targets: ring, scale: { from: 0.4, to: 1.6 }, alpha: 0, duration: 260 }));
      break;
    }
    case 'slash':
      [-24, 0, 24].forEach((dx, i) => {
        const s = add(scene.add.rectangle(at.x + dx, at.y, 6, 90, color, 1).setAngle(35).setScale(1, 0).setStrokeStyle(2, 0xffffff, 0.9));
        jobs.push(tween(stage, { targets: s, scaleY: 1, alpha: { from: 1, to: 0 }, duration: 200, delay: i * 50, ease: 'Quad.easeOut' }));
      });
      break;
    case 'burst':
    case 'pips':
      (kind === 'pips' ? [-26, 0, 26] : [0]).forEach((dx, i) => {
        const b = add(image(stage, 'pack.dbk.burst', at.x + dx, at.y + (kind === 'pips' ? (i % 2) * 18 - 9 : 0)).setScale(0.2));
        jobs.push(tween(stage, { targets: b, scale: kind === 'pips' ? 0.55 : 0.9, alpha: { from: 1, to: 0 }, duration: 260, delay: i * 90, ease: 'Quad.easeOut' }));
      });
      break;
    case 'shards':
    case 'sparks':
    case 'sparkle':
      SPREAD.forEach((deg, i) => {
        const r = Phaser.Math.DegToRad(deg);
        const o = add(
          kind === 'shards'
            ? scene.add.triangle(at.x, at.y, 0, 12, 6, 0, 12, 12, color, 1)
            : kind === 'sparks'
              ? scene.add.rectangle(at.x, at.y, 22, 4, 0xffffff, 1).setAngle(deg).setStrokeStyle(2, color, 1)
              : image(stage, 'pack.dbk.shine', at.x, at.y).setScale(0.25),
        );
        const dist = kind === 'sparkle' ? 40 : 70;
        jobs.push(tween(stage, { targets: o, x: at.x + Math.cos(r) * dist, y: at.y + Math.sin(r) * dist - (kind === 'sparkle' ? 20 : 0), alpha: 0, angle: kind === 'shards' ? 180 : deg, duration: 300, delay: kind === 'sparkle' ? i * 30 : 0, ease: 'Quad.easeOut' }));
      });
      break;
    case 'cloud':
      [[-20, 0], [18, -8], [0, 14], [-6, -18]].forEach(([dx, dy], i) => {
        const c = add(scene.add.circle(at.x + dx!, at.y + dy!, 22, color, 0.55));
        jobs.push(tween(stage, { targets: c, scale: { from: 0.4, to: 1.5 }, alpha: 0, duration: 380, delay: i * 50, ease: 'Sine.easeOut' }));
      });
      break;
    case 'quake':
      scene.cameras.main.shake(260 / stage.speed, 0.008 * (stage.shake ?? stage.intensity));
      [-40, 0, 40].forEach((dx, i) => {
        const d = add(scene.add.ellipse(at.x + dx, at.y + 50, 40, 14, color, 0.6));
        jobs.push(tween(stage, { targets: d, y: at.y + 30, scaleX: 1.8, alpha: 0, duration: 300, delay: i * 40 }));
      });
      break;
    case 'swirl': {
      const ring = add(scene.add.container(at.x, at.y));
      SPREAD.forEach((deg) => {
        const r = Phaser.Math.DegToRad(deg);
        ring.add(scene.add.circle(Math.cos(r) * 36, Math.sin(r) * 36, 5, color, 0.9));
      });
      jobs.push(tween(stage, { targets: ring, angle: 240, scale: { from: 1.2, to: 0.3 }, alpha: { from: 1, to: 0 }, duration: 360, ease: 'Sine.easeIn' }));
      break;
    }
  }
  await Promise.all(jobs);
  kill(...parts);
}

async function wash(stage: FamilyStage): Promise<void> {
  const { scene, color } = stage;
  const cam = scene.cameras.main;
  const rect = scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, color, 0.3 * stage.intensity).setDepth(900).setScrollFactor(0);
  await tween(stage, { targets: rect, alpha: 0, duration: 320 });
  rect.destroy();
}

/** Plays a family's recipe; resolves when it is done. */
export async function playFamily(stage: FamilyStage, family: FamilyId): Promise<void> {
  const recipe = FAMILY_RECIPES[family];
  const at = recipe.on === 'user' ? stage.from : stage.to;
  await startup(stage, recipe.startup);
  await travel(stage, recipe.travel);
  await Promise.all([impact(stage, recipe.impact, at), recipe.wash && stage.intensity > 0 ? wash(stage) : Promise.resolve()]);
}
