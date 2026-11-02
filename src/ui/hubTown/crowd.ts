// Hub Town's crowd on screen (spec §8): the trainers and Pokémon from core/hubTown/roster.ts wander their zone, stop to
// look around, and Pokémon hop and play. Face one and press Z: trainers talk (core/hubTown/chatter.ts), Pokémon react.
// Presentation only: a view RNG of its own (never gameplay RNG); motion "off" keeps everyone still, "reduced" walks
// without the hops and bobbing.

import Phaser from 'phaser';
import { overworldAssetIds } from '../../assets/catalog';
import type { Content } from '../../core/contentSchema';
import { chatterFor } from '../../core/hubTown/chatter';
import type { Wanderer } from '../../core/hubTown/roster';
import { HUB_TOWN, type Facing } from '../../core/hubTown/schema';
import { ahead, type Tile } from '../../core/hubTown/world';
import { viewRandom } from '../../core/legacyRuns';
import type { Profile } from '../../core/state';
import { textStyle } from '../theme';
import { ensureWalkAnims, type HubTownView } from './townView';

const FACINGS: Facing[] = ['up', 'down', 'left', 'right'];
const DIR_FRAME: Record<Facing, number> = { down: 0, left: 4, right: 8, up: 12 };

/** The art the crowd needs (for preloading). */
export function crowdAssets(crowd: readonly Wanderer[]): string[] {
  return [...new Set(crowd.map((w) => (w.kind === 'trainer' ? overworldAssetIds.trainer(w.sheet) : overworldAssetIds.follower(w.sheet))))];
}

interface Walker {
  w: Wanderer;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse | undefined;
  at: Tile;
  facing: Facing;
  texture: string;
  /** Busy talking: stands still facing you. */
  pausedUntil: number;
}

export class HubCrowd {
  readonly walkers: Walker[] = [];
  private readonly roll: () => number;
  private readonly blocked = new Set<string>();

  constructor(
    private readonly town: HubTownView,
    private readonly scene: Phaser.Scene,
    content: Content,
    profile: Profile,
    crowd: readonly Wanderer[],
    private readonly opts: { motion: 'full' | 'reduced' | 'off'; window: string; say(text: string): void },
  ) {
    this.roll = viewRandom(`hubtown-crowd-walk:${opts.window}`);
    // People never stand in doorways, on gate tiles or on the pedestals.
    for (const pl of HUB_TOWN.places) {
      this.blocked.add(`${pl.door.x},${pl.door.y}`);
      this.blocked.add(`${pl.stand.x},${pl.stand.y}`);
    }
    for (const [x, y] of HUB_TOWN.pads) for (const dx of [-1, 0, 1]) this.blocked.add(`${x + dx},${y}`);

    for (const w of crowd) {
      const texture = w.kind === 'trainer' ? overworldAssetIds.trainer(w.sheet) : overworldAssetIds.follower(w.sheet);
      if (!scene.textures.exists(texture)) continue;
      ensureWalkAnims(scene, texture);
      const sprite = town.addPerson(w.id, texture, w.start, w.facing, { bob: w.kind === 'pokemon' && opts.motion === 'full' });
      const walker: Walker = { w, sprite, shadow: sprite.getData('shadow'), at: { ...w.start }, facing: w.facing, texture, pausedUntil: 0 };
      this.walkers.push(walker);
      const species = w.speciesId ? content.species.get(w.speciesId)?.name ?? w.speciesId : null;
      town.addTalker({
        id: w.id,
        name: species ?? 'Trainer',
        verb: w.kind === 'trainer' ? 'Talk' : 'Play',
        tiles: [walker.at],
        onTalk: () => {
          const you = town.tile();
          this.face(walker, you.x < walker.at.x ? 'left' : you.x > walker.at.x ? 'right' : you.y < walker.at.y ? 'up' : 'down');
          walker.pausedUntil = scene.time.now + 4000;
          if (w.kind === 'trainer') {
            const line = chatterFor(content, profile, w.id, opts.window);
            this.bubble(walker, line);
            opts.say(line);
          } else {
            this.bubble(walker, ['♪', '!', '♥', '…?'][Math.floor(this.roll() * 4)]!);
            this.hop(walker);
          }
        },
      });
      if (opts.motion !== 'off') this.schedule(walker);
    }
  }

  private schedule(walker: Walker): void {
    const delay = 900 + this.roll() * (walker.w.kind === 'pokemon' ? 2600 : 3600);
    this.scene.time.delayedCall(delay, () => {
      if (!walker.sprite.active) return;
      this.act(walker);
      this.schedule(walker);
    });
  }

  private act(walker: Walker): void {
    if (this.scene.time.now < walker.pausedUntil) return;
    const r = this.roll();
    // Now and then just look around, or (Pokémon, full motion) hop on the spot.
    if (r < 0.2) return this.face(walker, FACINGS[Math.floor(this.roll() * 4)]!);
    if (r < 0.28 && walker.w.kind === 'pokemon' && this.opts.motion === 'full') return this.hop(walker);
    // Otherwise walk a few steps one way, staying in the zone (with a little slack).
    const dir = this.roll() < 0.6 ? walker.facing : FACINGS[Math.floor(this.roll() * 4)]!;
    const steps = 1 + Math.floor(this.roll() * 3);
    this.walk(walker, dir, steps);
  }

  private inZone(walker: Walker, t: Tile): boolean {
    const z = HUB_TOWN.zones[walker.w.zone];
    if (!z) return true;
    return t.x >= z[0] - 2 && t.y >= z[1] - 2 && t.x < z[0] + z[2] + 2 && t.y < z[1] + z[3] + 2;
  }

  private walk(walker: Walker, dir: Facing, steps: number): void {
    this.face(walker, dir);
    if (steps <= 0) return this.idle(walker);
    const next = ahead(walker.at, dir);
    const you = this.town.tile();
    const nearYou = Math.abs(next.x - you.x) + Math.abs(next.y - you.y) === 0;
    if (nearYou || !this.inZone(walker, next) || this.blocked.has(`${next.x},${next.y}`) || !this.town.grid.canEnter(next.x, next.y, walker.w.id)) return this.idle(walker);
    this.town.grid.claim(walker.w.id, next, walker.at);
    walker.at.x = next.x;
    walker.at.y = next.y;
    const ms = walker.w.kind === 'pokemon' ? 260 : 320;
    walker.sprite.anims.play({ key: `${walker.texture}#${dir}`, frameRate: 7 }, true);
    const feet = this.town.feet(next);
    this.scene.tweens.add({
      targets: walker.sprite,
      x: feet.x,
      y: feet.y,
      duration: ms,
      onUpdate: () => this.sync(walker),
      onComplete: () => {
        this.sync(walker);
        this.walk(walker, dir, steps - 1);
      },
    });
  }

  private face(walker: Walker, dir: Facing): void {
    walker.facing = dir;
    if (walker.w.kind === 'pokemon' && this.opts.motion === 'full') walker.sprite.anims.play({ key: `${walker.texture}#${dir}`, frameRate: 4 }, true);
    else {
      walker.sprite.anims.stop();
      walker.sprite.setFrame(DIR_FRAME[dir]);
    }
  }

  private idle(walker: Walker): void {
    this.face(walker, walker.facing);
  }

  private hop(walker: Walker): void {
    if (this.opts.motion !== 'full') return;
    const y = walker.sprite.y;
    this.scene.tweens.add({ targets: walker.sprite, y: y - 10, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.easeOut', onComplete: () => walker.sprite.setY(y) });
  }

  private sync(walker: Walker): void {
    const { sprite, shadow } = walker;
    sprite.setDepth(10 + sprite.y);
    shadow?.setPosition(sprite.x, sprite.y - 6).setDepth(10 + sprite.y - 1);
  }

  /** A speech bubble over someone's head for a few seconds (in the world, so it moves with the town). */
  private bubble(walker: Walker, text: string): void {
    const short = text.length > 42 ? `${text.slice(0, 40)}…` : text;
    this.town.world(() => {
      const t = this.scene.add
        .text(walker.sprite.x, walker.sprite.y - walker.sprite.displayHeight - 4, short, textStyle(12, '#2a2840', { backgroundColor: '#ffffff', padding: { x: 6, y: 3 } }))
        .setOrigin(0.5, 1)
        .setDepth(900_000 - 1);
      this.scene.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 400, onComplete: () => t.destroy() });
    });
  }
}

