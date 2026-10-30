// Selectable battle UI styles (Settings > Battle UI). "aero" is the game's own glass look; "kit" and
// "kitLong" draw the databox frames and HP/EXP gauges from the Deluxe Battle Kit pack (Essentials-style
// databoxes). Presentation only: nothing here touches battle state or gameplay RNG.

import Phaser from 'phaser';

export const BATTLE_UI_STYLES = ['aero', 'kit', 'kitLong'] as const;
export type BattleUiStyle = (typeof BATTLE_UI_STYLES)[number];
export const BATTLE_UI_LABELS: Record<BattleUiStyle, string> = { aero: 'Aero Glass', kit: 'Essentials Kit', kitLong: 'Essentials Kit (long foe)' };

/** What the battle scene needs from an HP or XP gauge. */
export interface GaugeLike {
  set(ratio: number, animate?: boolean): Promise<void>;
  addTo(container: Phaser.GameObjects.Container): void;
}

/** Where the databox art sits and where its gauge slot is, in the art's own pixels. */
export interface KitLayout {
  box: string;
  scale: number;
  /** The art's top-left inside the info box container. */
  x: number;
  y: number;
  hp: { tex: string; rowH: number; artX: number; artY: number };
}

export const KIT_LAYOUTS: Record<Exclude<BattleUiStyle, 'aero'>, { player: KitLayout; foe: KitLayout }> = {
  kit: {
    player: { box: 'pack.dbk.box.basicPlayer', scale: 1.5, x: 16, y: 16, hp: { tex: 'pack.dbk.box.basicHpPlayer', rowH: 4, artX: 45, artY: 29.5 } },
    foe: { box: 'pack.dbk.box.basicFoe', scale: 1.2, x: 6, y: 30, hp: { tex: 'pack.dbk.box.basicHpFoe', rowH: 4, artX: 90, artY: 25.5 } },
  },
  kitLong: {
    player: { box: 'pack.dbk.box.basicPlayer', scale: 1.5, x: 16, y: 16, hp: { tex: 'pack.dbk.box.basicHpPlayer', rowH: 4, artX: 45, artY: 29.5 } },
    foe: { box: 'pack.dbk.box.longFoe', scale: 0.8, x: 6, y: 36, hp: { tex: 'pack.dbk.box.longHpFoe', rowH: 8, artX: 50, artY: 30 } },
  },
};

/** The kit's three-row gauge strips: row 0 green, row 1 yellow, row 2 red. Cropped to the HP ratio. */
export class KitBar implements GaugeLike {
  private readonly image: Phaser.GameObjects.Image;
  private readonly track: Phaser.GameObjects.Rectangle | null;
  private readonly srcW: number;
  private ratio = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    texture: string,
    private readonly rows: number,
    private readonly rowH: number,
    private readonly scale: number,
    private readonly kind: 'hp' | 'xp',
  ) {
    this.srcW = scene.textures.get(texture).getSourceImage().width;
    this.track = kind === 'xp' ? scene.add.rectangle(x, y, this.srcW * scale, rowH * scale, 0x182028).setOrigin(0, 0) : null;
    this.image = scene.add.image(x, y, texture).setOrigin(0, 0).setScale(scale);
    this.apply(1);
  }

  set(ratio: number, animate = false): Promise<void> {
    const target = Phaser.Math.Clamp(ratio, 0, 1);
    if (!animate) {
      this.apply(target);
      return Promise.resolve();
    }
    const from = { r: this.ratio };
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: from,
        r: target,
        duration: Math.round(250 + 450 * Math.abs(target - this.ratio)),
        ease: 'Sine.easeOut',
        onUpdate: () => this.apply(from.r),
        onComplete: () => {
          this.apply(target);
          resolve();
        },
      });
    });
  }

  private apply(ratio: number): void {
    this.ratio = ratio;
    const row = this.kind === 'xp' || this.rows === 1 ? 0 : ratio > 0.5 ? 0 : ratio > 0.2 ? 1 : 2;
    const w = Math.round(this.srcW * ratio);
    this.image.setVisible(w > 0);
    // The crop is in texture pixels; the image is shifted up so the chosen row lands on the slot.
    this.image.setCrop(0, row * this.rowH, w, this.rowH);
    this.image.setPosition(this.x, this.y - row * this.rowH * this.scale);
  }

  addTo(container: Phaser.GameObjects.Container): void {
    container.add([...(this.track ? [this.track] : []), this.image]);
  }
}

export function kitTexturesReady(scene: Phaser.Scene): boolean {
  return ['pack.dbk.box.basicPlayer', 'pack.dbk.box.basicFoe', 'pack.dbk.box.longFoe', 'pack.dbk.box.basicHpPlayer', 'pack.dbk.box.basicHpFoe', 'pack.dbk.box.longHpFoe', 'pack.dbk.box.basicExp'].every((k) => scene.textures.exists(k));
}
