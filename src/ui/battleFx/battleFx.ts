// Plays the presentation cues (core/presentation/cues.ts) on the battle screen:
// move animations, the short fallback when one can't load, telegraph markers,
// hit-stop, screen shake, flashes, floating damage numbers, effectiveness
// badges and stat arrows.
//
// Everything here is decoration on top of a turn the engine has already
// decided. If anything fails (a missing file, a bad animation, a slow
// network), the fallback plays or the cue is skipped; battle state is never
// touched. Animation files are loaded the first time a move is used.

import Phaser from 'phaser';
import { MASTERY_VFX, type MoveRank } from '../../core/moveMastery';
import { animAssetIds } from '../../assets/catalog';
import type { Side } from '../../core/battle/engine';
import { CompactAnimSchema, type CompactAnim } from '../../core/presentation/animFormat';
import type { Cue } from '../../core/presentation/cues';
import type { FamilyId } from '../../core/presentation/families';
import { moveAnims } from '../../data/presentation';
import { services } from '../../game/services';
import { typeSoundFor } from '../../core/presentation/typeSound';
import { playSfx } from '../audio';
import { loadAssets } from '../lazyAssets';
import type { Visual } from '../sprites';
import { textStyle } from '../theme';
import { playAnim, type PlayHandle } from './animPlayer';
import { playFamily } from './familyFx';

/** How long to wait for a move's files the first time before playing the fallback instead. */
const LOAD_TIMEOUT_MS = 1500;

export interface FxOptions {
  /** Arena, ground patches and both Pokémon. */
  field: Phaser.GameObjects.Container;
  /** Index in `field` just above the arena art (where animation backgrounds go). */
  backgroundIndex: () => number;
  sprite: (side: Side) => Visual | null;
  /** The player's Move Mastery rank for a move (#107 VFX variants); none when left out. */
  mastery?: (moveId: string) => MoveRank;
}

const BADGES: Record<string, { label: string; color: string }> = {
  super: { label: 'SUPER EFFECTIVE!', color: '#f8a030' },
  weak: { label: 'NOT VERY EFFECTIVE', color: '#a0a8b8' },
  immune: { label: 'NO EFFECT', color: '#707888' },
  crit: { label: 'CRITICAL HIT!', color: '#f8e050' },
};

const NUMBER_COLORS: Record<string, string> = {
  damage: '#f8f8f8',
  crit: '#f8e050',
  super: '#f8a030',
  weak: '#c0c8d8',
  heal: '#78f090',
};

const hex = (color: string) => Phaser.Display.Color.HexStringToColor(color).color;

export class BattleFx {
  private readonly cache = new Map<string, Promise<CompactAnim | null>>();
  private current: PlayHandle | null = null;
  private skipping = false;
  /** How many badges are showing per side, so they stack instead of overlapping. */
  private readonly badgeCount: Record<Side, number> = { player: 0, enemy: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: FxOptions,
  ) {}

  private get settings() {
    return services().session.settings;
  }

  private get motion(): boolean {
    return this.settings.battleAnimations === 'full';
  }

  /** True while a move animation (or other long cue) is playing. */
  get busy(): boolean {
    return this.current !== null;
  }

  /** The player pressed a key: finish the current animation now, and the rest of this event's cues instantly. */
  skip(): void {
    this.skipping = true;
    this.current?.stop();
  }

  /** Starts loading animations that are likely to play soon (the moves on the field). */
  prefetch(animNames: readonly string[]): void {
    if (this.settings.battleAnimations !== 'full') return;
    for (const name of animNames) void this.load(name).catch(() => null);
  }

  /** Plays one event's cues in order. Resolves when the screen is ready for the event's HP change and message. */
  async play(cues: readonly Cue[]): Promise<void> {
    this.skipping = false;
    for (const cue of cues) {
      if (!this.scene.sys.isActive()) return;
      try {
        await this.playCue(cue);
      } catch (err) {
        // Presentation must never break a battle.
        console.warn('Battle effect failed', err);
        this.current?.stop();
        this.current = null;
      }
    }
  }

  private wait(ms: number): Promise<void> {
    if (this.skipping || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  private async playCue(cue: Cue): Promise<void> {
    switch (cue.kind) {
      case 'telegraph':
        return this.telegraph(cue.side, cue.color, cue.style);
      case 'moveAnim':
        await this.moveAnim(cue.user, cue.target, cue.anim, cue.color, cue.alt, cue.family, cue.moveType);
        if (cue.user === 'player' && cue.moveId && !this.skipping) this.masteryFlourish(cue.target, this.opts.mastery?.(cue.moveId) ?? 'none');
        return;
      case 'pulse':
        return this.pulse(cue.side, cue.color);
      case 'commonAnim':
        return this.commonAnim(cue.side, cue.anim, cue.alt);
      case 'impact':
        return this.impact(cue);
      case 'number':
        this.number(cue.side, cue.amount, cue.tone, cue.motion);
        return;
      case 'badge':
        this.badge(cue.side, cue.badge);
        return;
      case 'statArrows':
        return this.statArrows(cue.side, cue.up, cue.motion);
    }
  }

  // ---------------------------------------------------------------- loading

  /** Loads an animation and every file it needs. Null when it can't be used. */
  private load(name: string): Promise<CompactAnim | null> {
    let p = this.cache.get(name);
    if (!p) {
      p = this.fetch(name);
      this.cache.set(name, p);
    }
    return p;
  }

  private async fetch(name: string): Promise<CompactAnim | null> {
    const { assets } = services();
    const dataId = animAssetIds.data(name);
    if (!assets.has(dataId)) return null;
    await loadAssets(this.scene, [dataId]);
    const parsed = CompactAnimSchema.safeParse(this.scene.cache.json.get(dataId));
    if (!parsed.success) {
      console.warn(`Animation ${name} is damaged; using the fallback.`);
      return null;
    }
    const info = moveAnims().anims[name];
    if (info) {
      await loadAssets(this.scene, [
        ...info.graphics.map(animAssetIds.sheet),
        ...info.backgrounds.map(animAssetIds.background),
        ...(this.settings.muted ? [] : info.sounds.map(animAssetIds.sound)),
      ]);
    }
    return parsed.data as CompactAnim;
  }

  /** The animation if it is ready within the time limit, otherwise null (it keeps loading for next time). */
  private async ready(name: string): Promise<CompactAnim | null> {
    const timeout = new Promise<null>((resolve) => this.scene.time.delayedCall(LOAD_TIMEOUT_MS, () => resolve(null)));
    return Promise.race([this.load(name).catch(() => null), timeout]);
  }

  // ---------------------------------------------------------------- cues

  private centre(visual: Visual): { x: number; y: number } {
    const h = visual instanceof Phaser.GameObjects.Sprite ? visual.displayHeight : visual.getBounds().height || 120;
    return { x: visual.x, y: visual.y - h / 2 };
  }

  private top(visual: Visual): { x: number; y: number } {
    const h = visual instanceof Phaser.GameObjects.Sprite ? visual.displayHeight : visual.getBounds().height || 120;
    return { x: visual.x, y: visual.y - h * 0.85 };
  }

  private async telegraph(side: Side, color: string, style: 'normal' | 'strong' | 'quick'): Promise<void> {
    const visual = this.opts.sprite(side);
    if (!visual || this.skipping) return;
    const { x, y } = this.centre(visual);
    const c = hex(color);
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (style === 'quick') {
      // Speed lines streaking past the user.
      for (let i = 0; i < 3; i++) {
        const line = this.scene.add.rectangle(x - 70, y - 30 + i * 30, 70, 5, c, 0.9).setOrigin(0, 0.5);
        this.opts.field.add(line);
        parts.push(line);
        if (this.motion) this.scene.tweens.add({ targets: line, x: x + 40, alpha: 0, duration: 220, delay: i * 40 });
        else this.scene.tweens.add({ targets: line, alpha: 0, duration: 260 });
      }
    } else {
      const rings = style === 'strong' ? 2 : 1;
      for (let i = 0; i < rings; i++) {
        const ring = this.scene.add.circle(x, y, 60, c, 0).setStrokeStyle(style === 'strong' ? 6 : 4, c, 1);
        this.opts.field.add(ring);
        parts.push(ring);
        ring.setScale(this.motion ? 0.3 : 1);
        this.scene.tweens.add({ targets: ring, scale: this.motion ? 1.3 + i * 0.3 : 1, alpha: 0, duration: style === 'strong' ? 380 : 260, delay: i * 90 });
      }
    }
    await this.wait(style === 'strong' ? 320 : 200);
    this.scene.time.delayedCall(500, () => parts.forEach((p) => p.destroy()));
  }

  /** The first of `name`, `alt` that loads in time (the pack file, then the PokeRogue one). */
  private async readyFirst(name: string, alt?: string): Promise<CompactAnim | null> {
    return (await this.ready(name)) ?? (alt && !this.skipping ? this.ready(alt) : null);
  }

  private async moveAnim(user: Side, target: Side, name: string, color: string, alt?: string, family?: FamilyId, moveType?: string): Promise<void> {
    const userVisual = this.opts.sprite(user);
    const targetVisual = this.opts.sprite(target);
    if (!userVisual || !targetVisual || this.skipping) return;
    const anim = await this.readyFirst(name, alt);
    if (this.skipping || !this.scene.sys.isActive()) return;
    if (!anim) this.typeSound(moveType);
    if (!anim) return family ? this.familyFallback(userVisual, targetVisual, color, family) : this.fallback(userVisual, targetVisual, color);
    this.current = playAnim(
      { scene: this.scene, field: this.opts.field, backgroundIndex: this.opts.backgroundIndex(), user: userVisual, target: targetVisual, userIsPlayer: user === 'player' },
      anim,
    );
    await this.current.done;
    this.current = null;
    // Z-Moves and Max Moves borrow another move's animation; their signature burst goes on top.
    if (family === 'signature' && !this.skipping) await this.familyFallback(userVisual, targetVisual, color, family);
  }

  /** A mastered move's flourish on the target: sparks in the rank colour, a shine ring at gold. Never blocks. */
  private masteryFlourish(target: Side, rank: MoveRank): void {
    if (rank === 'none' || this.settings.battleAnimations !== 'full') return;
    const visual = this.opts.sprite(target);
    if (!visual) return;
    const vfx = MASTERY_VFX[rank];
    const { x, y } = this.centre(visual);
    for (let i = 0; i < vfx.sparks; i++) {
      const a = (Math.PI * 2 * i) / vfx.sparks;
      const star = this.scene.add.star(x, y, 4, 2, 7, vfx.color, 1).setDepth(900).setBlendMode('ADD').setName(`mastery-${rank}`);
      this.scene.tweens.add({ targets: star, x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 50, angle: 180, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
    }
    if (vfx.ring) {
      const ring = this.scene.add.circle(x, y, 20).setStrokeStyle(4, vfx.color, 1).setDepth(900).setName(`mastery-${rank}`);
      this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
  }

  private async commonAnim(side: Side, name: string, alt?: string): Promise<void> {
    const visual = this.opts.sprite(side);
    if (!visual || this.skipping) return;
    const anim = await this.readyFirst(name, alt);
    if (!anim || this.skipping || !this.scene.sys.isActive()) return;
    this.current = playAnim({ scene: this.scene, field: this.opts.field, backgroundIndex: this.opts.backgroundIndex(), user: visual, target: visual, userIsPlayer: side === 'player' }, anim);
    await this.current.done;
    this.current = null;
  }

  /** When no animation file can play: the move's family effect (Visual Bible §4.4) in its type colour. */
  private async familyFallback(user: Visual, target: Visual, color: string, family: FamilyId): Promise<void> {
    // speed 1: the battle scene's clock already runs at the battle speed.
    const done = playFamily({ scene: this.scene, field: this.opts.field, from: this.centre(user), to: this.centre(target), user, color: hex(color), intensity: this.settings.effectIntensity, speed: 1 }, family);
    // Skipping cuts the wait; the effect cleans itself up.
    await Promise.race([done, new Promise<void>((resolve) => { const check = () => (this.skipping ? resolve() : this.scene.time.delayedCall(50, check)); check(); })]);
  }

  /** The type's own sound when a move has no animation (#127). Never blocks or changes the battle. */
  private typeSound(type?: string): void {
    const slug = type ? typeSoundFor(type) : null;
    if (!slug || this.settings.muted || this.skipping) return;
    const id = animAssetIds.sound(slug);
    if (!services().assets.has(id)) return;
    void loadAssets(this.scene, [id]).then(() => this.scene.sys.isActive() && playSfx(this.scene, id, 0.8));
  }

  /** The quick stand-in when a move's animation is missing: the user lunges and the target flashes. */
  private async fallback(user: Visual, target: Visual, color: string): Promise<void> {
    if (user !== target) {
      const dx = Math.sign(target.x - user.x) * 24;
      this.scene.tweens.add({ targets: user, x: user.x + dx, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      await this.wait(90);
    }
    await this.pulse(target === user ? user : target, color, target);
  }

  /** A soft tint on a Pokémon in its move's type colour. */
  private async pulse(sideOrVisual: Side | Visual, color: string, given?: Visual): Promise<void> {
    const visual = given ?? (typeof sideOrVisual === 'string' ? this.opts.sprite(sideOrVisual) : sideOrVisual);
    if (!visual || this.skipping) return;
    if (visual instanceof Phaser.GameObjects.Sprite) {
      visual.setTintFill(hex(color));
      await this.wait(this.motion ? 120 : 200);
      if (visual.active) visual.clearTint();
    } else {
      this.scene.tweens.add({ targets: visual, alpha: 0.4, duration: 100, yoyo: true });
      await this.wait(200);
    }
  }

  private async impact(cue: Extract<Cue, { kind: 'impact' }>): Promise<void> {
    const visual = this.opts.sprite(cue.side);
    if (!visual) return;
    // Hit-stop: the target flashes white and everything holds for a moment.
    if (cue.hitStopMs > 0 && !this.skipping) {
      if (visual instanceof Phaser.GameObjects.Sprite) visual.setTintFill(0xffffff);
      else visual.setAlpha(0.5);
      await this.wait(cue.hitStopMs);
      if (visual.active) {
        if (visual instanceof Phaser.GameObjects.Sprite) visual.clearTint();
        else visual.setAlpha(1);
      }
    }
    if (cue.flash && cue.flashAlpha > 0 && !this.skipping) {
      const flash = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, hex(cue.flash), cue.flashAlpha).setOrigin(0);
      this.opts.field.add(flash);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 180, onComplete: () => flash.destroy() });
    }
    if (cue.shake > 0 && !this.skipping) this.shake(cue.shake);
    // A blink without hit-stop (reduced motion or off).
    if (cue.hitStopMs === 0) this.scene.tweens.add({ targets: visual, alpha: 0.3, yoyo: true, repeat: 1, duration: 70 });
  }

  /** Shakes the field (not the menus) for a moment. */
  private shake(px: number): void {
    const field = this.opts.field;
    this.scene.tweens.killTweensOf(field);
    field.setPosition(0, 0);
    const steps = [1, -0.8, 0.6, -0.4, 0.2, 0];
    this.scene.tweens.chain({
      targets: field,
      tweens: steps.map((s, i) => ({ x: s * px, y: (i % 2 === 0 ? 0.5 : -0.5) * s * px, duration: 30 })),
      onComplete: () => field.setPosition(0, 0),
    });
  }

  private number(side: Side, amount: number, tone: string, motion: boolean): void {
    const visual = this.opts.sprite(side);
    if (!visual || amount <= 0) return;
    const { x, y } = this.top(visual);
    const sign = tone === 'heal' ? '+' : '-';
    const text = this.scene.add
      .text(x + (side === 'enemy' ? 60 : -60), y, `${sign}${amount}`, textStyle(tone === 'crit' ? 40 : 34, NUMBER_COLORS[tone] ?? '#ffffff', { stroke: '#181818', strokeThickness: 6 }))
      .setOrigin(0.5);
    if (motion) {
      text.setScale(0.6);
      this.scene.tweens.add({ targets: text, scale: 1, duration: 120, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: text, y: y - 46, alpha: 0, delay: 500, duration: 500, onComplete: () => text.destroy() });
    } else {
      this.scene.tweens.add({ targets: text, alpha: 0, delay: 700, duration: 300, onComplete: () => text.destroy() });
    }
  }

  private badge(side: Side, kind: string): void {
    const visual = this.opts.sprite(side);
    const look = BADGES[kind];
    if (!visual || !look) return;
    const { x, y } = this.top(visual);
    const slot = this.badgeCount[side]++;
    const text = this.scene.add
      .text(x + (side === 'enemy' ? -70 : 70), y + 34 + slot * 30, look.label, textStyle(22, look.color, { stroke: '#181818', strokeThickness: 5 }))
      .setOrigin(0.5);
    if (this.motion) {
      text.setScale(0.5);
      this.scene.tweens.add({ targets: text, scale: 1, duration: 140, ease: 'Back.easeOut' });
    }
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      delay: 900,
      duration: 300,
      onComplete: () => {
        text.destroy();
        this.badgeCount[side] = Math.max(0, this.badgeCount[side] - 1);
      },
    });
  }

  private async statArrows(side: Side, up: boolean, motion: boolean): Promise<void> {
    const visual = this.opts.sprite(side);
    if (!visual || this.skipping) return;
    const { x, y } = this.centre(visual);
    const arrows = [-40, 0, 40].map((dx, i) => {
      const a = this.scene.add.text(x + dx, y + (up ? 30 : -30), up ? '▲' : '▼', textStyle(30, up ? '#68b8f8' : '#f86868', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5);
      this.opts.field.add(a);
      this.scene.tweens.add({ targets: a, y: motion ? a.y + (up ? -60 : 60) : a.y, alpha: 0, delay: i * 60, duration: 600, onComplete: () => a.destroy() });
      return a;
    });
    void arrows;
    await this.wait(300);
  }
}
