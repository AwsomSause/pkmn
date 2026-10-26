// Plays one battle animation file (see core/presentation/animFormat.ts) on the
// battle screen's field. A port of PokeRogue's BattleAnim.play():
// - every 50 ms it shows the next frame: pieces of the sprite sheet, and the
//   user/target Pokémon moved, zoomed, rotated or faded;
// - timed events play sounds and fade a full-field background in and out.
// Differences: the real Pokémon sprites are moved (PokeRogue draws copies), so
// a frame with two copies of the same Pokémon shows only one; colour tones only
// darken (no brightening shader).
//
// It only draws. It never reads or changes battle state.

import Phaser from 'phaser';
import { animAssetIds } from '../../assets/catalog';
import {
  Blend,
  chooseVariant,
  FRAME_MS,
  FrameTarget,
  placeFrame,
  variantLength,
  type Battler,
  type CompactAnim,
  type CompactFrame,
} from '../../core/presentation/animFormat';
import { services } from '../../game/services';
import type { Visual } from '../sprites';
import { PIXEL_SCALE } from '../theme';

/** The field the animation draws on and the two Pokémon in it. */
export interface Stage {
  scene: Phaser.Scene;
  /** Arena, ground patches, Pokémon: everything the animation draws among. */
  field: Phaser.GameObjects.Container;
  /** Index in `field` just above the arena art (where backgrounds go). */
  backgroundIndex: number;
  user: Visual;
  target: Visual;
  userIsPlayer: boolean;
}

interface Saved {
  visual: Visual;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  alpha: number;
  visible: boolean;
}

const save = (visual: Visual): Saved => ({ visual, x: visual.x, y: visual.y, scaleX: visual.scaleX, scaleY: visual.scaleY, angle: visual.angle, alpha: visual.alpha, visible: visual.visible });

function restore(s: Saved): void {
  if (!s.visual.active) return;
  s.visual.setPosition(s.x, s.y).setScale(s.scaleX, s.scaleY).setAngle(s.angle).setAlpha(s.alpha).setVisible(s.visible);
  if (s.visual instanceof Phaser.GameObjects.Sprite) {
    s.visual.clearTint();
    s.visual.setBlendMode(Phaser.BlendModes.NORMAL);
  }
}

/** A Pokémon's position in PokeRogue's field units (screen pixels / 3). */
function battlerOf(visual: Visual, saved: Saved): Battler {
  const height = visual instanceof Phaser.GameObjects.Sprite ? visual.displayHeight : (visual.getBounds().height || 120);
  return { x: saved.x / PIXEL_SCALE, y: saved.y / PIXEL_SCALE, halfHeight: height / 2 / PIXEL_SCALE };
}

function blendOf(blend: number): Phaser.BlendModes {
  return blend === Blend.ADD ? Phaser.BlendModes.ADD : blend === Blend.SUBTRACT ? Phaser.BlendModes.DIFFERENCE : Phaser.BlendModes.NORMAL;
}

export interface PlayHandle {
  /** Resolves when the animation has finished (or was stopped). */
  done: Promise<void>;
  /** Jumps to the end: removes every sprite and puts the Pokémon back. */
  stop(): void;
}

/** Plays `anim`. Assets must already be loaded (missing pieces are skipped). */
export function playAnim(stage: Stage, anim: CompactAnim, speed = 1): PlayHandle {
  const { scene, field } = stage;
  const { variant, swapped } = chooseVariant(anim, stage.userIsPlayer);
  // An opponent animation is drawn from the other side's point of view.
  const userVisual = swapped ? stage.target : stage.user;
  const targetVisual = swapped ? stage.user : stage.target;
  const savedUser = save(userVisual);
  const savedTarget = save(targetVisual);
  const user = battlerOf(userVisual, savedUser);
  const target = battlerOf(targetVisual, savedTarget);
  const sameMon = userVisual === targetVisual;

  const sheetKey = variant.g ? animAssetIds.sheet(variant.g) : null;
  const sheetFrames = sheetKey && scene.textures.exists(sheetKey) ? scene.textures.get(sheetKey).frameTotal - 1 : 0;
  const graphics: { sprite: Phaser.GameObjects.Sprite; priority: number }[] = [];
  let background: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle | null = null;
  const settings = services().session.settings;
  const events = [...variant.events];
  const total = variantLength(variant);

  let frame = 0;
  let timer: Phaser.Time.TimerEvent | null = null;
  let finished = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (resolveDone = resolve));

  const cleanUp = () => {
    if (finished) return;
    finished = true;
    timer?.remove(false);
    graphics.forEach((g) => g.sprite.destroy());
    graphics.length = 0;
    background?.destroy();
    background = null;
    restore(savedUser);
    if (!sameMon) restore(savedTarget);
    resolveDone();
  };

  /** Places a graphic sprite in the field's draw order (PokeRogue's priorities 0–3). */
  const order = (sprite: Phaser.GameObjects.Sprite, priority: number, focusVisual: Visual | null) => {
    if (priority === 0) field.moveBelow(sprite, stage.userIsPlayer ? stage.target : stage.user);
    else if (priority === 2 && background) field.moveAbove(sprite, background);
    else if ((priority === 2 || priority === 3) && focusVisual) {
      if (priority === 2) field.moveBelow(sprite, focusVisual);
      else field.moveAbove(sprite, focusVisual);
    } else field.bringToTop(sprite);
  };

  const showFrame = (sprites: CompactFrame[]) => {
    let g = 0;
    let movedUser = false;
    let movedTarget = false;
    for (const s of sprites) {
      const [kind, sheetFrame, , , , , , opacity, flags, blend, priority, focus] = s;
      const place = placeFrame(s, user, target);
      if (kind === FrameTarget.GRAPHIC) {
        if (!sheetKey || sheetFrames <= 0) continue;
        let entry = graphics[g];
        if (!entry) {
          entry = { sprite: scene.add.sprite(0, 0, sheetKey, 0), priority: -1 };
          field.add(entry.sprite);
          graphics.push(entry);
        }
        g++;
        const sprite = entry.sprite;
        if (entry.priority !== priority) {
          entry.priority = priority;
          order(sprite, priority, focus === 2 ? userVisual : focus === 1 ? targetVisual : null);
        }
        sprite.setFrame(Math.min(sheetFrame, sheetFrames - 1));
        sprite.setPosition(place.x * PIXEL_SCALE, place.y * PIXEL_SCALE);
        sprite.setScale(place.scaleX * PIXEL_SCALE, place.scaleY * PIXEL_SCALE);
        sprite.setAngle(place.angle);
        sprite.setAlpha(opacity / 255);
        sprite.setVisible((flags & 1) !== 0);
        sprite.setBlendMode(blendOf(blend));
        continue;
      }
      // A Pokémon: only the first copy of each is drawn; when user and target are the same Pokémon only its "user" frames count.
      const isUser = kind === FrameTarget.USER;
      if (sameMon && !isUser) continue;
      if ((isUser && movedUser) || (!isUser && movedTarget)) continue;
      if (isUser) movedUser = true;
      else movedTarget = true;
      const visual = isUser ? userVisual : targetVisual;
      const saved = isUser ? savedUser : savedTarget;
      const battler = isUser ? user : target;
      if (!visual.active) continue;
      // Files give the sprite's centre; our sprites stand on their bottom edge.
      visual.setPosition(place.x * PIXEL_SCALE, (place.y + battler.halfHeight * place.scaleY) * PIXEL_SCALE);
      visual.setScale(saved.scaleX * place.scaleX, saved.scaleY * place.scaleY);
      visual.setAngle(place.angle);
      visual.setAlpha((opacity / 255) * saved.alpha);
      visual.setVisible((flags & 1) !== 0 && saved.visible);
      if (visual instanceof Phaser.GameObjects.Sprite) {
        visual.setBlendMode(blendOf(blend));
        const tone = s[12];
        if (tone && tone.some((v) => v < 0)) {
          const c = tone.slice(0, 3).map((v) => Phaser.Math.Clamp(255 + Math.min(0, v), 0, 255));
          visual.setTint(Phaser.Display.Color.GetColor(c[0]!, c[1]!, c[2]!));
        } else visual.clearTint();
      }
    }
    // Sprites not in this frame disappear.
    for (const entry of graphics.splice(g)) entry.sprite.destroy();
  };

  const runEvents = () => {
    while (events.length > 0 && events[0]!.f <= frame) {
      const e = events.shift()!;
      if (e.k === 'sound') {
        const key = animAssetIds.sound(e.r);
        if (!settings.muted && scene.cache.audio.exists(key)) {
          try {
            scene.sound.play(key, { volume: settings.sfxVolume * (e.v / 100), rate: e.p / 100 });
          } catch {
            // Sound is never critical.
          }
        }
        continue;
      }
      const ms = (e.d * FRAME_MS) / speed;
      if (e.k === 'bg') {
        background?.destroy();
        const key = e.r ? animAssetIds.background(e.r) : '';
        const height = field.getData('fieldHeight') ?? scene.scale.height;
        background =
          key && scene.textures.exists(key)
            ? scene.add.tileSprite(0, 0, scene.scale.width, height, key).setOrigin(0).setTileScale(PIXEL_SCALE)
            : scene.add.rectangle(0, 0, scene.scale.width, height, 0x000000).setOrigin(0);
        background.setAlpha(e.o / 255);
        field.addAt(background, stage.backgroundIndex);
      } else if (background) {
        const props: Record<string, number> = { alpha: e.o / 255 };
        if (background instanceof Phaser.GameObjects.TileSprite) {
          props.tilePositionX = e.x / 2;
          props.tilePositionY = e.y / 2;
        }
        scene.tweens.add({ targets: background, duration: Math.max(1, ms), ...props });
      }
    }
  };

  const step = () => {
    if (finished) return;
    if (frame < variant.frames.length) showFrame(variant.frames[frame]!);
    else if (graphics.length > 0) showFrame([]);
    runEvents();
    frame++;
    if (frame >= total) {
      // Let the last frame show for one tick.
      timer = scene.time.delayedCall(FRAME_MS / speed, cleanUp);
      return;
    }
    timer = scene.time.delayedCall(FRAME_MS / speed, step);
  };

  // Hide the Pokémon during the animation only where the file draws them; otherwise they stay put.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanUp);
  step();
  return { done, stop: cleanUp };
}
