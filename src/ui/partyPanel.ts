// Full-screen pickers drawn over the current screen: the party list (switch,
// choose a target for an item or reward, set the lead) and the Bag.

import Phaser from 'phaser';
import type { Content, Species } from '../core/contentSchema';
import { itemCount } from '../core/items';
import { friendshipHearts } from '../core/friendship';
import { abilityStatus } from '../core/battle/abilities';
import { abilityOf, calcStats, getSpecies } from '../core/pokemon';
import type { PokemonInstance } from '../core/state';
import { playSfx } from './audio';
import type { InputAction } from './input';
import { itemVisual, pokemonIcon } from './sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, STATUS_LABELS, textStyle } from './theme';
import { Bar, drawPanel, focusFrame, paintWindow } from './widgets';

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
  columns: 1 | 2;
  rowHeight: number;
  onSelect: (index: number) => void;
  /** Leave out to make the choice mandatory (e.g. sending out a Pokémon after a faint). */
  onBack?: () => void;
  backLabel?: string;
}

const LIST_TOP = 76;
const LIST_BOTTOM = GAME_HEIGHT - 72;

/** A modal list of rows. Keyboard: arrows to move, confirm to pick, back to cancel. Mouse: hover and click. */
export class Picker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly highlights: Phaser.GameObjects.Graphics[] = [];
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  /** Rows sit in a scrolling list when there are more than fit on screen. */
  private readonly list: Phaser.GameObjects.Container;
  private readonly footer: Phaser.GameObjects.Text;
  private index = 0;
  private closed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly config: PickerConfig) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.root.add(shade);
    this.root.add(drawPanel(scene, 24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 32, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true }));
    this.root.add(scene.add.text(48, 28, config.title, textStyle(30, COLORS.textLight)));
    const backHint = config.onBack ? `  ·  Esc ${config.backLabel ?? 'back'}` : '';
    this.root.add(scene.add.text(GAME_WIDTH - 48, 34, `Enter choose${backHint}`, textStyle(18, '#a69cb4')).setOrigin(1, 0));

    const colW = config.columns === 2 ? (GAME_WIDTH - 112) / 2 : GAME_WIDTH - 96;
    this.list = scene.add.container(0, 0);
    this.root.add(this.list);
    const maskShape = scene.make.graphics({}, false).fillRect(0, LIST_TOP - 6, GAME_WIDTH, LIST_BOTTOM - LIST_TOP + 12);
    this.list.setMask(maskShape.createGeometryMask());
    config.rows.forEach((row, i) => {
      const x = 48 + (i % config.columns) * (colW + 16);
      const y = LIST_TOP + Math.floor(i / config.columns) * (config.rowHeight + 10);
      const box = scene.add.container(x, y);
      const bg = paintWindow(scene.add.graphics(), 0, 0, colW, config.rowHeight, {
        thin: true,
        fill: row.problem ? 0x2a2630 : COLORS.panel,
        border: row.problem ? 0x4a4352 : COLORS.borderMuted,
      });
      box.add(bg);
      row.draw(scene, box, colW, config.rowHeight);
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
    });

    this.footer = scene.add.text(48, GAME_HEIGHT - 60, '', textStyle(22, COLORS.textLight, { wordWrap: { width: GAME_WIDTH - 96 } }));
    this.root.add(this.footer);
    if (config.rows.length === 0) this.footer.setText('Nothing here.');
    const first = config.rows.findIndex((r) => !r.problem);
    this.focus(first >= 0 ? first : 0, false);
  }

  private focus(i: number, sound = true): void {
    if (i < 0 || i >= this.config.rows.length) return;
    if (sound && i !== this.index) playSfx(this.scene, 'ui.select', 0.5);
    this.index = i;
    this.highlights.forEach((h, n) => h.setVisible(n === i));
    this.scrollTo(i);
    const row = this.config.rows[i]!;
    this.footer.setText(row.problem ?? row.hint ?? '');
    this.footer.setColor(row.problem ? '#f0a0a0' : COLORS.textLight);
  }

  /** Scrolls the list so row i is on screen; rows out of view can't be clicked. */
  private scrollTo(i: number): void {
    const step = this.config.rowHeight + 10;
    const rowTop = (n: number) => LIST_TOP + Math.floor(n / this.config.columns) * step;
    const top = rowTop(i) + this.list.y;
    if (top < LIST_TOP) this.list.y += LIST_TOP - top;
    else if (top + this.config.rowHeight > LIST_BOTTOM) this.list.y -= top + this.config.rowHeight - LIST_BOTTOM;
    this.zones.forEach((zone, n) => {
      const y = rowTop(n) + this.list.y;
      const visible = y >= LIST_TOP - 1 && y + this.config.rowHeight <= LIST_BOTTOM + 1;
      if (zone.input) zone.input.enabled = visible;
    });
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
          playSfx(this.scene, 'ui.select', 0.5);
          this.config.onBack();
        }
        break;
    }
  }

  close(): void {
    this.closed = true;
    this.root.destroy();
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
export function partyRow(content: Content, mon: PokemonInstance, problem: string | null, opts: { tag?: string; hint?: string } = {}): PickerRow {
  return {
    problem,
    hint: opts.hint ?? abilityHint(content, mon),
    draw: (scene, box, w) => {
      const species = getSpecies(content, mon.speciesId);
      const max = calcStats(content, mon).hp;
      box.add(pokemonIcon(scene, species, 34, 36, 1.5));
      const shiny = mon.shiny ? ' ★' : '';
      box.add(scene.add.text(72, 6, `${species.name}${shiny}`, textStyle(26)));
      box.add(scene.add.text(w - 12, 8, `Lv${mon.level}`, textStyle(22)).setOrigin(1, 0));
      const bar = new Bar(scene, 72, 46, w - 200, 12, 'hp');
      bar.addTo(box);
      void bar.set(mon.hp / max, false);
      box.add(scene.add.text(w - 12, 38, `${mon.hp}/${max}`, textStyle(20)).setOrigin(1, 0));
      const status = mon.hp <= 0 ? { label: 'FNT', color: 0x806060 } : mon.status ? STATUS_LABELS[mon.status.id] : null;
      const tags = [status?.label, opts.tag].filter(Boolean).join('  ');
      if (tags) box.add(scene.add.text(72, 58, tags, textStyle(16, mon.hp <= 0 ? '#c05050' : '#d07020')));
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
