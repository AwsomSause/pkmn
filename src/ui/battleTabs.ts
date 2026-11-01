// The battle page tabs (spec §23): Attack · Party · Item, plus the Auto-Battle switch. Always visible while choosing, so the
// player knows which page they are on and can jump between pages by click, tap, or Q / E. Presentation only.

import Phaser from 'phaser';
import { AERO, paintGlass, type MotionLevel } from './aero';
import { COLORS, textStyle } from './theme';

export type BattlePage = 'attack' | 'party' | 'item';
export const PAGES: { id: BattlePage; label: string; tint: number }[] = [
  { id: 'attack', label: 'Attack', tint: 0xc8303c },
  { id: 'party', label: 'Party', tint: 0x1f9a52 },
  { id: 'item', label: 'Item', tint: 0xc08a10 },
];

const W = 76;
const INFO_W = 28;
const H = 22;
const GAP = 4;

export interface TabsConfig {
  motion: MotionLevel;
  onPage: (page: BattlePage) => void;
  onAuto: () => void;
  onInfo: () => void;
}

/** Where the strip sits: on the bar's top edge (main menus) or in the title band of a full-screen list. */
export type TabsPlace = 'bar' | 'band';

export class BattleTabs {
  readonly root: Phaser.GameObjects.Container;
  private readonly pills: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private page: BattlePage | null = null;
  private auto = false;
  private autoOff = false;

  constructor(private readonly scene: Phaser.Scene, private readonly config: TabsConfig, x: number, y: number) {
    this.root = scene.add.container(x, y).setDepth(120).setName('battle-tabs');
    [...PAGES.map((p) => p.label), 'Auto', 'i'].forEach((text, i) => {
      const g = scene.add.graphics();
      const w = i === PAGES.length + 1 ? INFO_W : W;
      const label = scene.add.text(i * (W + GAP) + w / 2, H / 2, text, textStyle(15, COLORS.textLight)).setOrigin(0.5);
      const zone = scene.add.zone(i * (W + GAP), 0, w, H).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event?: { stopPropagation?: () => void }) => {
        event?.stopPropagation?.();
        if (i < PAGES.length) this.config.onPage(PAGES[i]!.id);
        else if (i === PAGES.length) this.config.onAuto();
        else this.config.onInfo();
      });
      this.root.add([g, label, zone]);
      this.pills.push({ g, label, zone });
    });
    this.paint();
  }

  /** Puts the strip where it belongs for the screen that is up. */
  place(where: TabsPlace, barX: number, barY: number): void {
    if (where === 'bar') this.root.setPosition(barX, barY);
    else this.root.setPosition(150, 36);
  }

  show(on: boolean): void {
    this.root.setVisible(on);
  }

  /** Highlights the page being viewed (null: none, the main choice menu). Bounces the new tab. */
  setPage(page: BattlePage | null): void {
    if (page === this.page) return;
    this.page = page;
    this.paint();
    const i = page ? PAGES.findIndex((p) => p.id === page) : -1;
    const pill = this.pills[i];
    if (pill && this.config.motion === 'full') {
      pill.label.setScale(0.7);
      this.scene.tweens.add({ targets: pill.label, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
    }
  }

  get current(): BattlePage | null {
    return this.page;
  }

  /** The Auto tab: on or off, or greyed out when Auto-Battle can't play this battle. */
  setAuto(on: boolean, unavailable = false): void {
    if (on === this.auto && unavailable === this.autoOff) return;
    this.auto = on;
    this.autoOff = unavailable;
    this.paint();
  }

  /** The next / previous page in Attack, Party, Item order (from none, Attack). */
  neighbour(step: 1 | -1): BattlePage {
    const i = this.page ? PAGES.findIndex((p) => p.id === this.page) : step === 1 ? -1 : 0;
    return PAGES[(i + step + PAGES.length) % PAGES.length]!.id;
  }

  private paint(): void {
    this.pills.forEach((pill, i) => {
      const isAuto = i === PAGES.length;
      if (i === PAGES.length + 1) {
        pill.g.clear();
        paintGlass(pill.g, i * (W + GAP), 0, INFO_W, H, { tint: AERO.glassLow, rim: AERO.sky, alpha: 0.7, glow: false, radius: 10 });
        return;
      }
      const active = isAuto ? this.auto : PAGES[i]!.id === this.page;
      const tint = isAuto ? (this.auto ? 0x9a2cc8 : AERO.glassLow) : active ? PAGES[i]!.tint : AERO.glassLow;
      pill.g.clear();
      paintGlass(pill.g, i * (W + GAP), 0, W, H, { tint, rim: active ? 0xffffff : AERO.sky, alpha: active ? 1 : 0.7, glow: active, radius: 10 });
      pill.label.setText(isAuto ? (this.autoOff ? 'Auto ✕' : this.auto ? 'Auto: ON' : 'Auto') : PAGES[i]!.label);
      pill.label.setAlpha(isAuto && this.autoOff ? 0.45 : active ? 1 : 0.8);
    });
  }

  destroy(): void {
    this.root.destroy();
  }
}
