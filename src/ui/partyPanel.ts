// Full-screen pickers drawn over the current screen: the party list (switch,
// choose a target for an item or reward, set the lead) and the Bag.

import { genderSign } from '../core/gender';
import Phaser from 'phaser';
import { loadAssets } from './lazyAssets';
import type { Content, Species } from '../core/contentSchema';
import { itemCount } from '../core/items';
import { friendshipHearts } from '../core/friendship';
import { emotionOf } from '../core/story/emotions';
import { services } from '../game/services';
import { abilityStatus } from '../core/battle/abilities';
import { abilityOf, calcStats, getSpecies, lookSpecies } from '../core/pokemon';
import type { PokemonInstance } from '../core/state';
import { playSfx } from './audio';
import type { InputAction } from './input';
import { itemVisual, pokemonIcon } from './sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, STATUS_LABELS, textStyle } from './theme';
import { Bar, drawPanel, focusFrame, paintWindow } from './widgets';
import { AERO, drawGlass, ensureRowFrames, paintGlass } from './aero';
import { glideIn, iconHop, justRedrawn, uiTiming } from './wiiMotion';
import { clampTexts, fitBlock, fitLine } from './fitText';

const DEPTH = 100;

export interface PickerRow {
  /** Draws the row's contents inside a w×h box at (0, 0) of `container`. */
  draw: (scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number) => void;
  /** Why this row can't be picked (shown at the bottom), or null. */
  problem: string | null;
  /** Shown at the bottom when the row is focused and can be picked. */
  hint?: string;
}

export interface PickerConfig {
  title: string;
  rows: PickerRow[];
  /** Two columns of rows (party) or one (Bag). */
  columns: 1 | 2 | 3;
  rowHeight: number;
  onSelect: (index: number) => void;
  /** Leave out to make the choice mandatory (e.g. sending out a Pokémon after a faint). */
  onBack?: () => void;
  backLabel?: string;
  /** The row focused at first (default: the first row without a problem). */
  start?: number;
  /** Opt-in Aero look (glass panels, glossy rows). Hub screens leave it off. */
  glass?: boolean;
  /** A small picture in the header (a lazy asset id); it appears once loaded. */
  badge?: string;
  /** A full-screen picture (a lazy asset id) drawn instead of the panel and title band, once loaded. */
  backdrop?: string;
  /** The backdrop art already carries the title (e.g. the Bag plate), so the title text is left out. */
  titleInArt?: boolean;
  /** Battle: draw the list only inside the bottom bar (no full-screen panel), so the arena, sprites and HP boxes stay visible. */
  dock?: boolean;
}

const LIST_TOP = 82;
const LIST_BOTTOM = GAME_HEIGHT - 84;
const FOOTER_W = GAME_WIDTH - 144;
/** The docked list sits in the battle bar: its top, bottom and where the message line goes. */
const DOCK = { panelTop: 402, top: 426, bottom: 500, footerY: GAME_HEIGHT - 20, gap: 6, x: 24 };

/** What a screen needs from a modal menu: keyboard input and a way to close it (the Picker and the Pokémon screen). */
export interface PickerLike {
  handle(action: InputAction): void;
  close(): void;
}

/** A modal list of rows. Keyboard: arrows to move, confirm to pick, back to cancel. Mouse: hover and click. */
export class Picker implements PickerLike {
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlights: Phaser.GameObjects.Graphics[] = [];
  private readonly boxes: Phaser.GameObjects.Container[] = [];
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  /** Rows sit in a scrolling list when there are more than fit on screen. */
  private readonly list: Phaser.GameObjects.Container;
  private readonly footer: Phaser.GameObjects.Text;
  /** ▲ / ▼ in the message box corner while rows lie above or below the visible list. */
  private readonly more: Phaser.GameObjects.Text;
  private index = 0;
  private closed = false;
  private readonly top: number;
  private readonly bottom: number;

  constructor(private readonly scene: Phaser.Scene, private readonly config: PickerConfig) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    // Popup opening (spec §24): the window rises into place and fades in; input works straight away.
    if (!justRedrawn()) glideIn(scene, this.root, 0, config.dock ? 8 : 14, 0, 'popupOpen');
    const dock = config.dock === true;
    this.top = dock ? DOCK.top : LIST_TOP;
    this.bottom = dock ? DOCK.bottom : LIST_BOTTOM;
    if (!dock) this.root.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive());
    const glass = config.glass === true || dock;
    const backdrop = config.backdrop && scene.textures.exists(config.backdrop) ? config.backdrop : null;
    if (dock) {
      // An opaque dock across the bar: the arena above it stays in view.
      this.root.add(scene.add.graphics().fillStyle(0x061528, 1).fillRoundedRect(8, DOCK.panelTop, GAME_WIDTH - 16, GAME_HEIGHT - DOCK.panelTop - 6, 18));
      this.root.add(drawGlass(scene, 8, DOCK.panelTop, GAME_WIDTH - 16, GAME_HEIGHT - DOCK.panelTop - 6, { tint: AERO.glassLow, rim: AERO.sky, radius: 18 }));
    } else if (backdrop) {
      this.root.add(scene.add.image(0, 0, backdrop).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setName('picker-backdrop'));
    } else if (glass) {
      this.root.add(drawGlass(scene, 24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 32, { radius: 26 }));
      this.root.add(drawGlass(scene, 36, 24, GAME_WIDTH - 72, 46, { tint: AERO.sky, rim: AERO.rim, glow: false, radius: 20 }));
    } else {
      this.root.add(drawPanel(scene, 24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 32));
      // A title band across the top, like a Pokémon menu header.
      const band = scene.add.graphics();
      band.fillStyle(0x18141d, 0.9).fillRect(36, 26, GAME_WIDTH - 72, 42);
      band.fillStyle(COLORS.accent, 1).fillRect(36, 68, GAME_WIDTH - 72, 2);
      this.root.add(band);
    }
    const title = !dock && !(backdrop && config.titleInArt) ? scene.add.text(48, 47, config.title, textStyle(30, COLORS.textLight)).setOrigin(0, 0.5) : null;
    if (title) this.root.add(title);
    if (!dock && config.badge) {
      const id = config.badge;
      const put = (): void => {
        if (!this.closed) this.root.add(scene.add.image(hint.x - hint.width - 40, 47, id).setDisplaySize(44, 44).setName('picker-badge'));
      };
      if (scene.textures.exists(id)) put();
      else void loadAssets(scene, [id]).then(() => scene.scene.isActive() && put());
    }
    const backHint = config.onBack ? `  ·  Esc ${config.backLabel ?? 'back'}` : '';
    const hintRight = config.onBack ? GAME_WIDTH - 150 : GAME_WIDTH - 48;
    const hint = scene.add.text(hintRight, 47, `Enter choose${backHint}`, textStyle(16, COLORS.textMuted)).setOrigin(1, 0.5).setVisible(!dock);
    this.root.add(hint);
    // The title and the key hint share the header: a long title is shortened, never run into the hint.
    if (title) {
      const badgeRoom = config.badge ? 64 : 0;
      fitLine(title, hint.x - hint.width - 16 - badgeRoom - title.x);
    }
    if (config.onBack) {
      // A clickable Back button, so every page can be left with the mouse or touch too.
      const back = scene.add
        .text(dock ? 30 : GAME_WIDTH - 48, dock ? 410 : 47, '◀ Back', textStyle(dock ? 15 : 22, COLORS.gold))
        .setOrigin(dock ? 0 : 1, 0.5)
        .setName('picker-back')
        .setInteractive({ useHandCursor: true });
      back.on('pointerover', () => back.setColor(COLORS.textLight));
      back.on('pointerout', () => back.setColor(COLORS.gold));
      back.on('pointerdown', () => this.handle('back'));
      this.root.add(back);
    }

    const gap = dock ? DOCK.gap : 10;
    const x0 = dock ? DOCK.x : 48;
    const colW = dock ? (GAME_WIDTH - 2 * DOCK.x - (config.columns - 1) * 8) / config.columns : config.columns === 2 ? (GAME_WIDTH - 112) / 2 : GAME_WIDTH - 96;
    this.list = scene.add.container(0, 0);
    this.root.add(this.list);
    const maskShape = scene.make.graphics({}, false).fillRect(0, this.top - 6, GAME_WIDTH, this.bottom - this.top + 12);
    this.list.setMask(maskShape.createGeometryMask());
    config.rows.forEach((row, i) => {
      const x = x0 + (i % config.columns) * (colW + (dock ? 8 : 16));
      const y = this.top + Math.floor(i / config.columns) * (config.rowHeight + gap);
      const box = scene.add.container(x, y);
      const bg = glass
        ? paintGlass(scene.add.graphics(), 0, 0, colW, config.rowHeight, { rim: row.problem ? 0x5a6a80 : 0x9fd8f0, alpha: row.problem ? 0.55 : 0.9, glow: false, radius: 14 })
        : paintWindow(scene.add.graphics(), 0, 0, colW, config.rowHeight, {
            thin: true,
            fill: row.problem ? 0x2a2630 : COLORS.panel,
            border: row.problem ? 0x4a4352 : COLORS.borderMuted,
          });
      box.add(bg);
      row.draw(scene, box, colW, config.rowHeight);
      clampTexts(box, colW, config.rowHeight);
      const hl = focusFrame(scene, 0, 0, colW, config.rowHeight);
      box.add(hl);
      this.highlights.push(hl);
      const zone = scene.add.zone(0, 0, colW, config.rowHeight).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.focus(i));
      zone.on('pointerdown', () => {
        this.focus(i);
        this.confirm();
      });
      box.add(zone);
      this.zones.push(zone);
      this.list.add(box);
      this.boxes.push(box);
    });

    // The message box along the bottom, like the games' text window.
    if (!dock) this.root.add(
      glass
        ? drawGlass(scene, 36, GAME_HEIGHT - 74, GAME_WIDTH - 72, 52, { tint: AERO.glassLow, rim: AERO.sky, glow: false, radius: 16 })
        : paintWindow(scene.add.graphics(), 36, GAME_HEIGHT - 74, GAME_WIDTH - 72, 52, { thin: true, fill: 0x18141d, border: COLORS.borderMuted }),
    );
    this.footer = dock
      ? scene.add.text(DOCK.x + 6, DOCK.footerY, '', textStyle(15, COLORS.textLight, { wordWrap: { width: FOOTER_W } })).setOrigin(0, 0.5)
      : scene.add.text(52, GAME_HEIGHT - 48, '', textStyle(16, COLORS.textLight, { wordWrap: { width: FOOTER_W } })).setOrigin(0, 0.5);
    this.root.add(this.footer);
    this.more = scene.add.text(GAME_WIDTH - 52, dock ? DOCK.footerY : GAME_HEIGHT - 48, '', textStyle(16, COLORS.gold)).setOrigin(1, 0.5);
    this.root.add(this.more);
    if (config.rows.length === 0) {
      this.root.add(scene.add.text(GAME_WIDTH / 2, (this.top + this.bottom) / 2, 'Nothing here yet', textStyle(32, COLORS.textMuted)).setOrigin(0.5));
      this.footer.setText(config.onBack ? 'Press Esc to go back.' : '');
    }
    const first = config.rows.findIndex((r) => !r.problem);
    this.focus(config.start !== undefined && config.start < config.rows.length ? config.start : first >= 0 ? first : 0, false);
  }

  private focus(i: number, sound = true): void {
    if (i < 0 || i >= this.config.rows.length) return;
    if (sound && i !== this.index) playSfx(this.scene, 'ui.cursor', 0.5);
    this.index = i;
    this.highlights.forEach((h, n) => h.setVisible(n === i));
    // The row's icon hops when the player moves onto it (not on the first, automatic focus).
    if (sound && this.boxes[i]) iconHop(this.scene, this.boxes[i]!);
    this.scrollTo(i);
    const row = this.config.rows[i]!;
    fitBlock(this.footer, FOOTER_W, 40, row.problem ?? row.hint ?? '');
    this.footer.setColor(row.problem ? '#f0a0a0' : COLORS.textLight);
  }

  /** Scrolls the list so row i is on screen; rows out of view can't be clicked. */
  private scrollTo(i: number): void {
    const step = this.config.rowHeight + (this.config.dock ? DOCK.gap : 10);
    const rowTop = (n: number) => this.top + Math.floor(n / this.config.columns) * step;
    const top = rowTop(i) + this.list.y;
    if (top < this.top) this.list.y += this.top - top;
    else if (top + this.config.rowHeight > this.bottom) this.list.y -= top + this.config.rowHeight - this.bottom;
    this.zones.forEach((zone, n) => {
      const y = rowTop(n) + this.list.y;
      const visible = y >= this.top - 1 && y + this.config.rowHeight <= this.bottom + 1;
      if (zone.input) zone.input.enabled = visible;
    });
    const lastTop = rowTop(this.config.rows.length - 1) + this.list.y;
    this.more.setText(`${this.list.y < 0 ? '▲' : ''}${lastTop + this.config.rowHeight > this.bottom + 1 ? '▼' : ''}`);
  }

  private confirm(): void {
    if (this.closed) return;
    const row = this.config.rows[this.index];
    if (!row || row.problem) {
      playSfx(this.scene, 'ui.error');
      return;
    }
    playSfx(this.scene, 'ui.select');
    this.config.onSelect(this.index);
  }

  handle(action: InputAction): void {
    if (this.closed) return;
    const n = this.config.rows.length;
    const cols = this.config.columns;
    switch (action) {
      case 'up':
        if (n) this.focus((this.index - cols + n) % n);
        break;
      case 'down':
        if (n) this.focus((this.index + cols) % n);
        break;
      case 'left':
        if (cols > 1 && n) this.focus((this.index - 1 + n) % n);
        break;
      case 'right':
        if (cols > 1 && n) this.focus((this.index + 1) % n);
        break;
      case 'confirm':
        this.confirm();
        break;
      case 'back':
        if (this.config.onBack) {
          playSfx(this.scene, 'ui.cursor', 0.5);
          this.config.onBack();
        }
        break;
    }
  }

  close(): void {
    this.closed = true;
    // Popup closing (spec §24): it stops taking input at once, then sinks and fades out.
    const root = this.root;
    const t = uiTiming('popupClose');
    if (!t.ms || !root.active) {
      root.destroy();
      return;
    }
    const off = (c: Phaser.GameObjects.Container): void =>
      c.list.forEach((o) => {
        if (o.input) o.disableInteractive();
        if (o instanceof Phaser.GameObjects.Container) off(o);
      });
    off(root);
    this.scene.tweens.add({ targets: root, alpha: 0, y: root.y + 12 * t.travel, duration: t.ms, ease: t.ease, onComplete: () => root.destroy() });
  }
}

/** "Blaze: Strengthens Fire moves…", for the footer when the row is focused. */
function abilityHint(content: Content, mon: PokemonInstance): string | undefined {
  const id = abilityOf(content, mon);
  const ability = id ? content.abilities.get(id) : undefined;
  if (!ability) return undefined;
  const later = abilityStatus(ability.id) === 'pending' ? ' (not working in battle yet)' : '';
  return `${ability.name}: ${ability.description}${later}`;
}

/** One party row: icon, name, level, HP bar, status, ability and friendship hearts. */

/** What a Pokémon holds, e.g. "Leftovers, Charcoal ×2", or '' for nothing. */
export function heldSummary(content: Content, mon: PokemonInstance): string {
  return Object.entries(mon.held ?? {})
    .map(([id, copies]) => `${content.catalog.get(id)?.name ?? id}${copies > 1 ? ` ×${copies}` : ''}`)
    .join(', ');
}

/** A Seven Emotions marker: a dot in the emotion's colour (the pixel font's heart is too small to read). */
export function emotionDot(scene: Phaser.Scene, x: number, y: number, color: string): Phaser.GameObjects.Arc {
  return scene.add.circle(x, y, 7, Number.parseInt(color.slice(1), 16)).setStrokeStyle(2, 0x18141d);
}

/** One party row: icon, name, level, HP bar, status, held items and friendship hearts. */
const BADGE_ROWS: Record<string, number> = { slp: 0, psn: 1, brn: 2, par: 3, frz: 4, fnt: 5 };

/** The UIE status badge for a row (SLP/PSN/BRN/PAR/FRZ/FNT), or null until the art has loaded. */
function statusBadge(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image | null {
  const row = BADGE_ROWS[key];
  if (row === undefined || !ensureRowFrames(scene, 'ui.party.statuses', 16)) return null;
  return scene.add.image(x, y, 'ui.party.statuses', String(row)).setOrigin(0, 0.5).setScale(0.9).setName('status-badge');
}

/** The UIE icon tile behind a party row's Pokémon icon (blue, or grey when fainted); loads on first use. */
function iconTile(scene: Phaser.Scene, box: Phaser.GameObjects.Container, fainted: boolean): void {
  const id = fainted ? 'ui.party.icon_box_faint' : 'ui.party.icon_box';
  const add = (): void => {
    box.addAt(scene.add.image(34, 36, id).setScale(0.62).setAlpha(0.9).setName('party-icon-tile'), 0);
  };
  if (scene.textures.exists(id)) add();
  else void loadAssets(scene, [id]).then(() => scene.scene.isActive() && box.active && add());
}

export function partyRow(content: Content, mon: PokemonInstance, problem: string | null, opts: { tag?: string; hint?: string } = {}): PickerRow {
  const holding = heldSummary(content, mon);
  const boosts = mon.boosts?.length ? `${mon.boosts.length} battle boost${mon.boosts.length > 1 ? 's' : ''} ready` : '';
  // The Seven Emotions: its current emotion from its memories this run (none outside a run).
  const run = services().session.run;
  const emotion = run ? emotionOf(content, run, mon.uid) : null;
  const feeling = emotion ? `Feeling: ${emotion.name}.` : '';
  const extra = [holding && `Holding: ${holding}.`, boosts && `${boosts}.`, feeling].filter(Boolean).join(' ');
  return {
    problem,
    hint: [opts.hint ?? abilityHint(content, mon), extra].filter(Boolean).join('  ') || undefined,
    draw: (scene, box, w) => {
      const species = lookSpecies(content, mon);
      const max = calcStats(content, mon).hp;
      iconTile(scene, box, mon.hp <= 0);
      box.add(pokemonIcon(scene, species, 34, 36, 1.5));
      const shiny = mon.shiny ? ' ★' : '';
      const nameText = scene.add.text(72, 6, `${species.name}${genderSign(content, mon)}${shiny}`, textStyle(26));
      box.add(nameText);
      if (emotion) {
        const x = 72 + nameText.width + 14;
        box.add(emotionDot(scene, x, 20, emotion.color).setName(`emotion-${emotion.id}`));
        box.add(scene.add.text(x + 12, 12, emotion.name, textStyle(14, emotion.color)));
      }
      box.add(scene.add.text(w - 12, 8, `Lv${mon.level}`, textStyle(22)).setOrigin(1, 0));
      const bar = new Bar(scene, 72, 46, w - 200, 12, 'hp');
      bar.addTo(box);
      void bar.set(mon.hp / max, false);
      box.add(scene.add.text(w - 12, 38, `${mon.hp}/${max}`, textStyle(20)).setOrigin(1, 0));
      const status = mon.hp <= 0 ? { label: 'FNT', color: 0x806060 } : mon.status ? STATUS_LABELS[mon.status.id] : null;
      // The UIE badge stands in for the status word when its art is loaded (the tag text stays for LEAD, etc.).
      const badge = status ? statusBadge(scene, 72, 66, mon.hp <= 0 ? 'fnt' : mon.status!.id) : null;
      const tags = [badge ? undefined : status?.label, opts.tag].filter(Boolean).join('  ');
      let tagEnd = 72 + (badge ? 44 : 0);
      if (badge) box.add(badge);
      if (tags) {
        const tagText = scene.add.text(tagEnd, 58, tags, textStyle(16, mon.hp <= 0 ? '#c05050' : '#d07020'));
        box.add(tagText);
        tagEnd += tagText.width + 10;
      }
      const count = Object.values(mon.held ?? {}).reduce((a, b) => a + b, 0);
      if (count) {
        if (scene.textures.exists('ui.party.icon_item')) box.add(scene.add.image(tagEnd, 66, 'ui.party.icon_item').setOrigin(0, 0.5).setName('held-icon'));
        box.add(scene.add.text(tagEnd + (scene.textures.exists('ui.party.icon_item') ? 20 : 0), 58, scene.textures.exists('ui.party.icon_item') ? `${count} held` : `◆ ${count} held`, textStyle(16, '#8fb8e0')));
      }
      const abilityId = abilityOf(content, mon);
      const abilityName = abilityId ? content.abilities.get(abilityId)?.name : undefined;
      if (abilityName) box.add(scene.add.text(w - 100, 60, abilityName, textStyle(14, '#a69cb4')).setOrigin(1, 0));
      const hearts = friendshipHearts(content, mon);
      box.add(scene.add.text(w - 12, 60, '♥'.repeat(hearts) + '♡'.repeat(5 - hearts), textStyle(14, hearts === 5 ? '#e04870' : '#c07890')).setOrigin(1, 0));
    },
  };
}

export function partyRows(content: Content, party: PokemonInstance[], problemFor: (index: number) => string | null, tagFor?: (index: number) => string | undefined, hintFor?: (index: number) => string | undefined): PickerRow[] {
  return party.map((mon, i) => partyRow(content, mon, problemFor(i), { tag: tagFor?.(i), hint: hintFor?.(i) }));
}

/** One Bag row: icon, name, count and description. */
export function bagRow(content: Content, inventory: Record<string, number>, itemId: string, problem: string | null): PickerRow {
  const item = content.items.get(itemId)!;
  return {
    problem,
    hint: item.description,
    draw: (scene, box, w, h) => {
      box.add(itemVisual(scene, item.iconAssetId, 26, h / 2, 2));
      box.add(scene.add.text(56, h / 2, item.name, textStyle(24)).setOrigin(0, 0.5));
      box.add(scene.add.text(w - 16, h / 2, `×${itemCount(inventory, itemId)}`, textStyle(24)).setOrigin(1, 0.5));
    },
  };
}

/** A row naming a species (with its icon and types), e.g. for choosing an evolution. */
export function speciesRow(species: Species): PickerRow {
  const types = species.types.map((t) => t[0]!.toUpperCase() + t.slice(1)).join(' / ');
  return {
    problem: null,
    hint: `${species.name}: ${types}`,
    draw: (scene, box, _w, h) => {
      box.add(pokemonIcon(scene, species, 30, h / 2, 1));
      box.add(scene.add.text(64, h / 2, species.name, textStyle(24)).setOrigin(0, 0.5));
    },
  };
}
