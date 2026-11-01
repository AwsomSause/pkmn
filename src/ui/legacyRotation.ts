// The Legacy Rotation on the Hub stage (M9, §1.1/§1.3): the run in progress and up to five past Trainers, each with
// its Ace, fading from one to the next like a slideshow of memories. Now and then a past Trainer gets a line.
// Presentation only: the list comes from core/legacyRuns.ts; nothing here touches a run or the profile.

import Phaser from 'phaser';
import type { Content } from '../core/contentSchema';
import { LEGACY_RUNS, legacyInteraction, viewRandom, type RotationEntry } from '../core/legacyRuns';
import type { LegacyRun } from '../core/state';
import { AERO, drawGlass, type MotionLevel } from './aero';
import { sizeToHeight } from './showcase';
import { pokemonHeightM, sizePair, trainerHeightM } from '../core/heights';
import { pokemonVisual, trainerVisual } from './sprites';
import { PIXEL_SCALE, textStyle } from './theme';

const GOLD = '#ffe08a';

export interface LegacyRotationOptions {
  x: number;
  /** The platform line the Ace stands on. */
  y: number;
  motion: MotionLevel;
  /** Past records by run id (for the rare lines), and the species in the current run (for "That Pokémon..."). */
  records: ReadonlyMap<string, LegacyRun>;
  currentSpecies: readonly string[];
  seed: string;
}

const OUTCOME: Record<RotationEntry['outcome'], string> = { victory: 'Champion', defeat: 'Fell', inProgress: 'On the road now' };

export class LegacyRotationView {
  private index = -1;
  private shown: Phaser.GameObjects.Container | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private readonly roll: () => number;

  constructor(private readonly scene: Phaser.Scene, private readonly content: Content, private readonly entries: readonly RotationEntry[], private readonly opts: LegacyRotationOptions) {
    this.roll = viewRandom(`legacy-lines:${opts.seed}`);
    if (entries.length === 0) return;
    this.next();
    if (entries.length > 1) this.timer = scene.time.addEvent({ delay: LEGACY_RUNS.rotation.rotateMs, loop: true, callback: () => this.next() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.timer?.remove());
  }

  /** The entry on show (for tests). */
  get current(): RotationEntry | null {
    return this.entries[this.index] ?? null;
  }

  private next(): void {
    this.index = (this.index + 1) % this.entries.length;
    const entry = this.entries[this.index]!;
    const fade = this.opts.motion === 'off' ? 0 : LEGACY_RUNS.rotation.fadeMs;
    const old = this.shown;
    if (old) {
      this.scene.tweens.killTweensOf(old);
      if (fade) this.scene.tweens.add({ targets: old, alpha: 0, duration: fade / 2, ease: 'Sine.easeIn', onComplete: () => old.destroy() });
      else old.destroy();
    }
    const view = this.build(entry);
    this.shown = view;
    if (fade) {
      view.setAlpha(0).y += 8;
      this.scene.tweens.add({ targets: view, alpha: 1, y: view.y - 8, duration: fade, delay: fade / 3, ease: 'Cubic.easeOut' });
    }
  }

  private build(entry: RotationEntry): Phaser.GameObjects.Container {
    const { scene, content, opts } = this;
    const root = scene.add.container(0, 0).setDepth(-10).setName(`legacy-rotation-${entry.runId}`);
    const archetype = content.archetypes.get(entry.archetypeId);
    const trainerName = archetype?.name ?? entry.archetypeId;
    const trainer = trainerVisual(scene, archetype?.spriteAssetId ?? '', trainerName, opts.x - 96, opts.y, 2);
    if (trainer instanceof Phaser.GameObjects.Sprite) trainer.setOrigin(0.5, 1);
    const species = entry.ace ? content.species.get(entry.ace.speciesId) : undefined;
    // Trainer and Ace share one pixels-per-metre scale, so heights match canon (a Wailord towers over its trainer).
    const size = sizePair(trainerHeightM(entry.archetypeId), species ? pokemonHeightM(species) : 0);
    sizeToHeight(scene, trainer, size.trainerPx);
    root.add(trainer);
    if (species) {
      const mon = pokemonVisual(scene, species, 'front', opts.x + 40, opts.y, PIXEL_SCALE, entry.ace!.shiny);
      sizeToHeight(scene, mon, size.monPx);
      root.add(mon);
      if (opts.motion === 'full') scene.tweens.add({ targets: mon, y: opts.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // The name plate: who, which Ace, where and how it ended, and what it did.
    const px = opts.x + 150;
    const py = opts.y - 190;
    const region = entry.regionId ? content.regions.get(entry.regionId)?.name ?? entry.regionId : null;
    const lines = [
      `${entry.memorable ? '★ ' : ''}${trainerName}${entry.current ? '  ·  now' : ''}`,
      species ? `${species.name}${entry.ace!.shiny ? ' ✦' : ''}  Lv ${entry.ace!.level}` : '',
      [region, OUTCOME[entry.outcome]].filter(Boolean).join('  ·  '),
      entry.accomplishments.join('  ·  '),
    ];
    const plate = drawGlass(scene, px, py, 250, 104, { radius: 16, tint: entry.current ? AERO.sky : undefined });
    root.add(plate);
    lines.forEach((text, i) => root.add(scene.add.text(px + 12, py + 8 + i * 23, text, textStyle(i === 0 ? 17 : 14, i === 0 ? (entry.memorable ? GOLD : '#ffffff') : '#cfefff', { wordWrap: { width: 228 } })).setName(i === 0 ? 'legacy-rotation-name' : '')));

    // A rare line (§1.3): only for past Trainers.
    const record = entry.current ? undefined : opts.records.get(entry.runId);
    const line = record ? legacyInteraction(record, opts.currentSpecies, this.roll()) : null;
    if (line) {
      const bubble = scene.add.text(px + 125, py + 112, `“${line}”`, textStyle(15, '#ffffff', { stroke: '#10203a', strokeThickness: 4, wordWrap: { width: 240 }, align: 'center' })).setOrigin(0.5, 0).setName('legacy-rotation-line');
      root.add(bubble);
      if (opts.motion === 'full') scene.tweens.add({ targets: bubble, y: bubble.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return root;
  }
}
