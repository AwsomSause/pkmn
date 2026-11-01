// Hyper/Overdrive (6.4), interaction (6.3) and rival (6.5) flourishes. Like the
// ability banners they are decoration only: they read a resolved AnimPlan
// (core/presentation/animRegistry.ts), which already folds in motion, intensity,
// shake and Reduced Particles, and they never touch battle state. Flowy and
// bouncy: ease in with overshoot, hold one beat, drift out.

import Phaser from 'phaser';
import type { AnimPlan } from '../../core/presentation/animRegistry';
import '../../core/presentation/storyAnims';
import '../../core/presentation/spectacleAnims';
import type { Visual } from '../sprites';
import { textStyle } from '../theme';
import { flash, ring, sparks, type FxTools } from './abilityFx';
import { beat, noBeat, type Beat } from './spectacle';

export interface StoryTools extends FxTools {
  /** The Pokémon this flourish is about; null when it has already left the field. */
  visual: Visual | null;
  /** The opposing Pokémon (used by the rivalry clash). */
  foe?: { visual: Visual; at: { x: number; y: number } } | null;
}

const col = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const pause = (scene: Phaser.Scene, ms: number) => new Promise<void>((resolve) => scene.time.delayedCall(ms, resolve));
const tweenTo = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig) =>
  new Promise<void>((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));

/** Squash and stretch the Pokémon a little, then settle back to exactly where it was. */
function bounce(t: StoryTools, by: number, ms: number): void {
  const v = t.visual;
  if (!v) return;
  t.scene.tweens.add({ targets: v, scaleX: v.scaleX * by, scaleY: v.scaleY * by, duration: ms, yoyo: true, ease: 'Back.easeOut' });
}

function tremble(t: StoryTools, px: number, times: number): void {
  const v = t.visual;
  if (!v || px <= 0) return;
  t.scene.tweens.add({ targets: v, x: v.x + px, duration: 50, yoyo: true, repeat: times });
}

/** The calm stand-in for Reduced motion: the Pokémon dips a little and comes back, nothing moves. */
function dip(t: StoryTools): Promise<void> {
  const v = t.visual;
  if (!v) return pause(t.scene, 150);
  return tweenTo(t.scene, { targets: v, alpha: v.alpha * 0.6, duration: 150, yoyo: true });
}

async function rise(t: StoryTools): Promise<void> {
  const v = t.visual;
  const { x, y } = t.at;
  if (!v) return;
  const y0 = v.y;
  const a0 = v.alpha;
  const tilt = t.side === 'player' ? -12 : 12;
  // Falls...
  await tweenTo(t.scene, { targets: v, y: y0 + 16, alpha: a0 * 0.45, angle: tilt, duration: 240, ease: 'Sine.easeIn' });
  // ...a beat of silence...
  await pause(t.scene, 380);
  // ...and gets back up.
  flash(t, 0.35);
  sparks(t, 'up', 10);
  ring(t, x, y, 20, 130, 650);
  t.shake(Math.round(6 * t.plan.shake));
  await tweenTo(t.scene, { targets: v, y: y0, alpha: a0, angle: 0, duration: 420, ease: 'Back.easeOut' });
}

async function toughened(t: StoryTools): Promise<void> {
  const { x, y } = t.at;
  flash(t, 0.55);
  t.shake(Math.round(8 * t.plan.shake));
  bounce(t, 1.1, 120);
  // A short dramatic pause, then a defensive aura closes round it.
  await pause(t.scene, 260);
  ring(t, x, y, 150, 40, 520);
  ring(t, x, y, 150, 60, 520, 120);
  sparks(t, 'in', 8);
}

function rivalry(t: StoryTools): void {
  const here = t.at;
  const there = t.foe?.at;
  ring(t, here.x, here.y, 20, 110, 700);
  if (!there) return;
  ring(t, there.x, there.y, 20, 110, 700);
  const mid = { x: (here.x + there.x) / 2, y: (here.y + there.y) / 2 };
  sparks({ ...t, at: mid }, 'out', 10);
  flash(t, 0.3);
  t.shake(Math.round(5 * t.plan.shake));
  tremble({ ...t, visual: t.foe?.visual ?? null }, 4, 4);
  tremble(t, 4, 4);
}

/** Plays one Hyper/Overdrive or interaction flourish. Resolves when it has mostly played. */
export async function playStoryAnim(t: StoryTools): Promise<void> {
  const { x, y } = t.at;
  if (t.plan.reduced) {
    await dip(t);
    return;
  }
  switch (t.plan.id) {
    case 'overdrive.toughened':
      await toughened(t);
      break;
    case 'overdrive.hung':
      tremble(t, 6, 6);
      sparks(t, 'up', 6);
      ring(t, x, y, 20, 90, 600);
      break;
    case 'overdrive.rise':
      await rise(t);
      break;
    case 'overdrive.bond':
      // A soft pink wash, hearts drawn in and drifting up: the Pokémon and its trainer connecting.
      flash(t, 0.2);
      sparks(t, 'in', 8);
      sparks(t, 'up', 6);
      ring(t, x, y, 110, 30, 700);
      bounce(t, 1.06, 220);
      break;
    case 'overdrive.rivalry':
      rivalry(t);
      break;
    case 'overdrive.flair':
      // Heavier than an ordinary transformation: three aura rings, a burst and a flash.
      flash(t, 0.4);
      ring(t, x, y, 20, 160, 800);
      ring(t, x, y, 20, 160, 800, 140);
      ring(t, x, y, 20, 160, 800, 280);
      sparks(t, 'out', 12);
      t.shake(Math.round(5 * t.plan.shake));
      bounce(t, 1.12, 260);
      break;
    case 'overdrive.emotion':
      ring(t, x, y, 30, 130, 800);
      ring(t, x, y, 30, 130, 800, 200);
      sparks(t, 'up', 8);
      flash(t, 0.2);
      break;
    case 'overdrive.rage':
      ring(t, x, y, 150, 30, 500);
      flash(t, 0.3);
      t.shake(Math.round(6 * t.plan.shake));
      tremble(t, 5, 6);
      break;
    case 'bond.survive':
      // Held on at 1 HP: a flash, the Pokémon shakes, a golden ring closes in and heartbeat sparks rise.
      flash(t, 0.5);
      t.shake(Math.round(7 * t.plan.shake));
      tremble(t, 6, 6);
      ring(t, x, y, 160, 30, 600);
      ring(t, x, y, 160, 50, 600, 140);
      sparks(t, 'up', 10);
      bounce(t, 1.08, 200);
      break;
    case 'bond.protect':
      // A shield ring blooms round the Pokémon and the hit is turned aside.
      flash(t, 0.25);
      ring(t, x, y, 30, 120, 500);
      sparks(t, 'out', 8);
      bounce(t, 1.05, 160);
      break;
    case 'bond.enter':
      // The revenge entrance: a red burst and a hard bounce as it charges in.
      flash(t, 0.4);
      ring(t, x, y, 20, 150, 650);
      ring(t, x, y, 20, 150, 650, 160);
      sparks(t, 'out', 12);
      t.shake(Math.round(6 * t.plan.shake));
      bounce(t, 1.14, 220);
      break;
    case 'bond.signature':
      flash(t, 0.2);
      sparks(t, 'in', 8);
      ring(t, x, y, 110, 30, 600);
      bounce(t, 1.06, 200);
      break;
    case 'drama.rally':
      flash(t, 0.4);
      ring(t, x, y, 20, 140, 600);
      sparks(t, 'up', 10);
      t.shake(Math.round(5 * t.plan.shake));
      bounce(t, 1.1, 180);
      break;
    case 'drama.momentum':
      ring(t, x, y, 10, 90, 500);
      sparks(t, 'up', 8);
      break;
    case 'interaction.enter':
      ring(t, x, y, 10, 70, 450);
      sparks(t, 'out', 6);
      break;
    case 'interaction.item':
      ring(t, x, y, 10, 60, 500);
      sparks(t, 'up', 6);
      break;
    case 'interaction.catch':
      flash(t, 0.3);
      ring(t, x, y, 10, 110, 650);
      sparks(t, 'out', 12);
      break;
    case 'interaction.rare':
      ring(t, x, y, 10, 100, 700);
      sparks(t, 'out', 8);
      flash(t, 0.25);
      break;
    case 'rival.ace':
      flash(t, 0.3);
      ring(t, x, y, 160, 30, 500);
      sparks(t, 'out', 10);
      t.shake(Math.round(6 * t.plan.shake));
      bounce(t, 1.1, 200);
      break;
    case 'rival.win': {
      // The rival's victory pose: two little hops and gold sparks.
      const v = t.visual;
      if (v) t.scene.tweens.add({ targets: v, y: v.y - 22, duration: 220, yoyo: true, repeat: 1, ease: 'Back.easeOut' });
      sparks(t, 'up', 8);
      break;
    }
    case 'rival.lose': {
      // The defeat pose: the head drops, grey sparks sink.
      const v = t.visual;
      if (v) t.scene.tweens.add({ targets: v, y: v.y + 8, angle: t.side === 'enemy' ? 6 : -6, duration: 420, ease: 'Sine.easeOut' });
      sparks(t, 'in', 5);
      break;
    }
    default:
      ring(t, x, y, 20, 80, 500);
  }
  await pause(t.scene, Math.min(t.plan.ms, 900));
}

/**
 * The rival's own entrance, in the style of the ability reference: a caption bar
 * in the corner, the trainer's picture swoops in from the right with a bounce,
 * a red star pops on its brow, it holds for a beat and slides out left. Any key skips.
 */
export function rivalIntro(
  scene: Phaser.Scene,
  plan: AnimPlan | null,
  caption: string,
  makeTrainer: ((x: number, y: number) => Visual) | undefined,
  rim: number,
): Beat {
  if (!plan || !plan.play) return noBeat();
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bar = scene.add.container(0, 0).setDepth(955).setAlpha(0);
  const text = scene.add.text(0, 0, caption, textStyle(20, '#ffffff', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0, 0.5);
  const bg = scene.add.rectangle(0, 0, text.width + 28, 34, rim, 0.92).setOrigin(0, 0.5).setStrokeStyle(3, 0xffffff, 0.85);
  bar.add([bg, text]);
  text.x = 14;
  bar.setPosition(20, 30);
  objs.push(bar);
  scene.tweens.add({ targets: bar, alpha: 1, duration: 180 });
  if (plan.reduced || !makeTrainer) return beat(scene, objs, Math.round(plan.ms * 0.6));

  const band = scene.add.rectangle(W / 2, H / 2, W, H * 0.46, rim, 0.22).setDepth(953).setAlpha(0);
  objs.push(band);
  scene.tweens.add({ targets: band, alpha: 1, duration: 220 });
  const who = makeTrainer(W + 200, H * 0.62);
  who.setDepth(954);
  objs.push(who);
  scene.tweens.add({ targets: who, x: W * 0.62, duration: 420, ease: 'Back.easeOut' });
  // The red star pops on its brow once it has landed.
  if (plan.particles) {
    const star = scene.add.text(W * 0.62 - 20, H * 0.62 - 90, plan.glyph || '✶', textStyle(34, '#ff3048', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5).setDepth(956).setScale(0).setAlpha(0);
    objs.push(star);
    scene.tweens.add({ targets: star, scale: 1, alpha: 1, delay: 560, duration: 220, ease: 'Back.easeOut' });
  }
  if (plan.flash > 0) {
    const wash = scene.add.rectangle(W / 2, H / 2, W, H, rim, 0.25 * plan.flash).setDepth(952).setAlpha(0);
    objs.push(wash);
    scene.tweens.add({ targets: wash, alpha: 1, duration: 120, delay: 420, yoyo: true });
  }
  scene.tweens.add({ targets: who, x: -200, duration: 300, delay: Math.max(900, plan.ms - 300), ease: 'Cubic.easeIn' });
  scene.tweens.add({ targets: [bar, band], alpha: 0, duration: 250, delay: Math.max(900, plan.ms - 300) });
  return beat(scene, objs, plan.ms);
}
