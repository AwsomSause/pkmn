// The Pokémon screen: Party and Summary in one glass menu (spec §5, §6). The party
// stands in a list on the left (rearrange, make lead, readiness at a glance); the
// right side has seven tabs for the chosen Pokémon: Overview, Stats, Moves, Items,
// Bond, History and Traits. The Items tab explains what each held item really does
// (core/itemEffects.ts reads the same hook data the battle engine uses).
//
// Keys: up/down pick a Pokémon (or an item/move in detail mode), left/right turn the
// tab, Enter opens the action menu (Make lead, Move up/down, Inspect), Esc backs out.
// Mouse: click a row, a tab, a menu entry or a move/item. The screen never changes the
// run except for the party order (session.moveParty) and never rolls anything.

import { fitLine } from './fitText';
import type Phaser from 'phaser';
import { genderSign } from '../core/gender';
import { heldBuild, type HeldItemInfo } from '../core/itemEffects';
import { runLevelCap } from '../core/regions';
import { lookSpecies } from '../core/pokemon';
import { emotionOf } from '../core/story/emotions';
import type { PokemonInstance, RunState } from '../core/state';
import type { Content } from '../core/contentSchema';
import { services } from '../game/services';
import { AERO, categoryIcon, drawGlass, typeLabel, type MotionLevel } from './aero';
import { BOND_BARS } from './bondLook';
import { playSfx } from './audio';
import { loadAssets } from './lazyAssets';
import type { FieldMenuHost } from './fieldMenus';
import type { InputAction } from './input';
import { ACCESSORIES, CARE_ACTIONS, moodWord, careProblem, favoriteFlavor, hatedFlavor, type CareAction } from '../core/care';
import { emotionDot, type PickerLike } from './partyPanel';
import { bondView, compareStats, compareTarget, historyView, moveEffectLines, readiness, traitLines, xpProgress, type Readiness } from './pokemonInfo';
import { itemVisual, pokemonIcon } from './sprites';
import { BASE_STAT_SCALE, growthInfo, summaryInfo } from './summaryLook';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, STATUS_LABELS, textStyle } from './theme';
import { Bar } from './widgets';

export const POKEMON_TABS = ['Overview', 'Stats', 'Moves', 'Items', 'Bond', 'History', 'Traits'] as const;
type Tab = (typeof POKEMON_TABS)[number];

const DEPTH = 100;
const LEFT_X = 40;
const LEFT_W = 266;
const RIGHT_X = 318;
const RIGHT_W = GAME_WIDTH - RIGHT_X - 40;
const TAB_Y = 82;
const BODY_Y = 120;
const BODY_H = 334;
const LIST_Y = 82;
const LIST_H = 372;

const STAT_COLORS: Record<string, number> = { hp: 0x6ee87a, atk: 0xf0a040, def: 0xf0d050, spa: 0x60b0ff, spd: 0x80e0d0, spe: 0xf070b0 };
const STATE_COLOR: Record<Readiness['state'], number> = { ready: 0x6ee87a, caution: 0xf0c040, down: 0xff5a5a };
const STATE_TEXT: Record<Readiness['state'], string> = { ready: '#9af0a8', caution: '#ffe08a', down: '#ff9a9a' };
const MODE_TEXT: Record<HeldItemInfo['mode'], string> = { passive: 'Always on', activated: 'Triggers in battle', mixed: 'Always on + triggers' };

const ACCESSORY_CHOICES = ['', ...ACCESSORIES];
const TRAIN_CHOICES = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
type Mode = 'list' | 'menu' | 'detail';
interface MenuOption {
  id: 'lead' | 'up' | 'down' | 'moves' | 'items' | 'cancel' | 'care' | 'back' | CareAction;
  label: string;
  problem: string | null;
  hint: string;
}

/** Opens the Pokémon screen on party index `start`. */
export function openPokemonMenu(host: FieldMenuHost, start = 0, pick?: PokemonPick): void {
  host.setPicker(new PokemonScreen(host, start, pick));
}

/** Choose-a-Pokémon mode (e.g. who gets a reward): Enter picks instead of opening the action menu. */
export interface PokemonPick {
  title: string;
  /** Why this party member can't be chosen, or null. */
  problemFor: (index: number) => string | null;
  onPick: (index: number) => void;
}

class PokemonScreen implements PickerLike {
  private readonly root: Phaser.GameObjects.Container;
  private readonly dyn: Phaser.GameObjects.Container;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly motion: MotionLevel;
  private mode: Mode = 'list';
  private sel: number;
  private tab = 0;
  private cursor = 0;
  private menuIdx = 0;
  /** The Care sub-menu is open (pet, hug, feed...). */
  private careMenu = false;
  private trainStat = 0;
  private accIdx = 0;
  private reordered = false;
  private notice = 'Party order updated.';
  private closed = false;
  private flash = '';
  private loadingKey = '';

  constructor(private readonly host: FieldMenuHost, start: number, private readonly pick?: PokemonPick) {
    const { scene } = host;
    const { session } = services();
    this.motion = session.settings.battleAnimations;
    this.sel = Math.max(0, Math.min(start, session.run!.party.length - 1));
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.root.add(shade);
    this.root.add(drawGlass(scene, 24, 16, GAME_WIDTH - 48, GAME_HEIGHT - 32, { radius: 26 }));
    this.root.add(drawGlass(scene, 36, 24, GAME_WIDTH - 72, 46, { tint: AERO.sky, rim: AERO.rim, glow: false, radius: 20 }));
    const cap = runLevelCap(session.content, session.run!);
    this.root.add(scene.add.text(48, 47, pick ? `${pick.title}  ·  cap ${cap}` : `Pokémon  ·  Level cap ${cap}`, textStyle(30, COLORS.textLight)).setOrigin(0, 0.5).setName('pokemon-title'));
    const back = scene.add.text(GAME_WIDTH - 48, 47, '◀ Back', textStyle(22, COLORS.gold)).setOrigin(1, 0.5).setName('picker-back').setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setColor(COLORS.textLight));
    back.on('pointerout', () => back.setColor(COLORS.gold));
    back.on('pointerdown', () => this.handle('back'));
    this.root.add(back);
    this.root.add(scene.add.text(GAME_WIDTH - 150, 47, this.pick ? 'Enter choose  ·  Esc back' : 'Enter actions  ·  Esc back', textStyle(16, COLORS.textMuted)).setOrigin(1, 0.5));
    this.root.add(drawGlass(scene, 36, GAME_HEIGHT - 74, GAME_WIDTH - 72, 52, { tint: AERO.glassLow, rim: AERO.sky, glow: false, radius: 16 }));
    this.footer = scene.add.text(52, GAME_HEIGHT - 48, '', textStyle(16, COLORS.textLight, { wordWrap: { width: GAME_WIDTH - 104 }, maxLines: 2 })).setOrigin(0, 0.5);
    this.root.add(this.footer);
    this.dyn = scene.add.container(0, 0);
    this.root.add(this.dyn);
    this.render();
  }

  // ---------- data ----------
  private get run(): RunState {
    return services().session.run!;
  }
  private get content(): Content {
    return services().session.content;
  }
  private get party(): PokemonInstance[] {
    return this.run.party;
  }
  private get mon(): PokemonInstance {
    return this.party[this.sel]!;
  }
  private get tabName(): Tab {
    return POKEMON_TABS[this.tab]!;
  }
  private cursorCount(): number {
    if (this.tabName === 'Moves') return this.mon.moves.length;
    if (this.tabName === 'Items') return heldBuild(this.content, this.mon).items.length;
    return 0;
  }

  // ---------- input ----------
  handle(action: InputAction): void {
    if (this.closed) return;
    this.flash = '';
    const n = this.party.length;
    if (this.mode === 'menu') {
      const opts = this.menuOptions();
      if (action === 'up') this.menuIdx = (this.menuIdx - 1 + opts.length) % opts.length;
      else if (action === 'down') this.menuIdx = (this.menuIdx + 1) % opts.length;
      else if (action === 'confirm') return this.chooseMenu(opts[this.menuIdx]!);
      else if (action === 'back') {
        if (this.careMenu) {
          this.careMenu = false;
          this.menuIdx = 0;
        } else this.mode = 'list';
      } else if ((action === 'left' || action === 'right') && this.careMenu) {
        if (this.menuOptions()[this.menuIdx]?.id === 'dress') this.accIdx = (this.accIdx + (action === 'right' ? 1 : ACCESSORY_CHOICES.length - 1)) % ACCESSORY_CHOICES.length;
        else this.trainStat = (this.trainStat + (action === 'right' ? 1 : 4)) % 5;
      }
      this.render();
      return;
    }
    if (action === 'left' || action === 'right') {
      this.tab = (this.tab + (action === 'right' ? 1 : POKEMON_TABS.length - 1)) % POKEMON_TABS.length;
      this.cursor = 0;
      if (this.mode === 'detail' && this.cursorCount() === 0) this.mode = 'list';
      playSfx(this.host.scene, 'ui.cursor', 0.5);
    } else if (action === 'up' || action === 'down') {
      const step = action === 'down' ? 1 : -1;
      if (this.mode === 'detail') {
        const c = this.cursorCount();
        if (c > 0) this.cursor = (this.cursor + step + c) % c;
      } else {
        this.sel = (this.sel + step + n) % n;
        this.cursor = 0;
      }
      playSfx(this.host.scene, 'ui.cursor', 0.5);
    } else if (action === 'confirm' && this.pick) {
      const problem = this.pick.problemFor(this.sel);
      if (problem) {
        playSfx(this.host.scene, 'ui.error');
        this.flash = problem;
      } else {
        playSfx(this.host.scene, 'ui.select');
        const choice = this.sel;
        this.close();
        this.pick.onPick(choice);
        return;
      }
    } else if (action === 'confirm' && this.mode === 'detail' && this.tabName === 'Items') {
      this.takeOff();
    } else if (action === 'confirm') {
      if (this.mode === 'detail') this.mode = 'list';
      else {
        this.mode = 'menu';
        this.menuIdx = 0;
      }
      playSfx(this.host.scene, 'ui.select');
    } else if (action === 'back') {
      if (this.mode === 'detail') this.mode = 'list';
      else return this.leave();
    }
    this.render();
  }

  private careOptions(): MenuOption[] {
    const run = this.run;
    const i = this.sel;
    const stat = TRAIN_CHOICES[this.trainStat]!;
    const p = (id: CareAction, label: string, hint: string, arg?: string): MenuOption => ({ id, label, hint, problem: careProblem(this.content, run, i, id, arg) });
    const care = this.mon.care;
    return [
      p('pet', 'Pet', 'A little pat: tiny friendship, up to 3 times per stop.'),
      p('hug', 'Hug', 'Once per stop: friendship, affection and a better mood.'),
      p('feed', 'Feed berry', `Feeds a loose Bag berry (likes ${favoriteFlavor(this.mon)}, hates ${hatedFlavor(this.mon)}).`),
      p('groom', 'Groom', 'Brush away a status condition and add some sparkle.'),
      p('lullaby', 'Lullaby', 'Tuck it in: heals 20% of its HP, once per stop.'),
      p('cheer', 'Cheer up', 'Lift its mood (more when it is down). Mood nudges stats by 1% a step.'),
      p('train', `Train ${stat.toUpperCase()} ‹ ›`, 'Left/right picks the stat. +8% for its next 3 fights, once per stop.', stat),
      p('sing', 'Sing to Eggs', 'Hum to the Eggs you carry: they move 1 step closer to hatching (never hatch by it). Once per stop.'),
      p('dress', `Dress: ${this.mon.care?.accessory ?? 'none'} ‹ ›`, 'Left/right picks scarf, bow, glasses, band or anklet (+2% to one stat). Enter wears it; "none" takes it off.', ACCESSORY_CHOICES[this.accIdx] || ''),
      p('fetch', 'Play fetch', 'Throw a ball: it may bring back a berry. Once per stop.'),
      p('story', 'Bedtime story', 'Once per run, for Pokémon that trust you: friendship and mood rise.'),
      p('nickname', 'Nickname', 'Give it a name (up to 12 letters). Leave it empty to clear.'),
      { id: 'favourite', label: care?.favourite ? 'Unfavourite' : 'Favourite', problem: null, hint: 'Favourites are never offered as swap or trade fodder.' },
      { id: 'ace', label: care?.ace ? 'Unmark ace' : 'Mark ace', problem: null, hint: 'Your ace is remembered on the Hub memorial wall if it falls.' },
      { id: 'back', label: 'Back', problem: null, hint: 'Back to the Pokémon menu.' },
    ];
  }

  private menuOptions(): MenuOption[] {
    if (this.careMenu) return this.careOptions();
    const n = this.party.length;
    const held = Object.keys(this.mon.held ?? {}).length;
    return [
      { id: 'lead', label: 'Make lead', problem: this.sel === 0 ? 'Already leading.' : null, hint: 'Move this Pokémon to the front: it leads the next battle.' },
      { id: 'up', label: 'Move up', problem: this.sel === 0 ? 'Already first.' : null, hint: 'Swap places with the Pokémon above.' },
      { id: 'down', label: 'Move down', problem: this.sel >= n - 1 ? 'Already last.' : null, hint: 'Swap places with the Pokémon below.' },
      { id: 'care', label: 'Care…', problem: null, hint: 'Pet, hug, feed, groom, tuck in, cheer up, train or name this Pokémon.' },
      { id: 'moves', label: 'Review moves', problem: null, hint: 'Step through its moves: power, accuracy, PP and what they do.' },
      { id: 'items', label: 'Review items', problem: held === 0 ? 'It holds nothing.' : null, hint: 'Step through its held items and read what each really does.' },
      { id: 'cancel', label: 'Cancel', problem: null, hint: 'Close this menu.' },
    ];
  }

  private chooseMenu(o: MenuOption): void {
    if (o.problem) {
      playSfx(this.host.scene, 'ui.error');
      this.flash = o.problem;
      this.render();
      return;
    }
    playSfx(this.host.scene, 'ui.select');
    if (o.id === 'care' || o.id === 'back') {
      this.careMenu = o.id === 'care';
      this.menuIdx = 0;
    } else if ((CARE_ACTIONS as readonly string[]).includes(o.id)) this.doCare(o.id as CareAction);
    else if (o.id === 'lead') this.reorder(0);
    else if (o.id === 'up') this.reorder(this.sel - 1);
    else if (o.id === 'down') this.reorder(this.sel + 1);
    else if (o.id === 'moves' || o.id === 'items') {
      this.tab = POKEMON_TABS.indexOf(o.id === 'moves' ? 'Moves' : 'Items');
      this.cursor = 0;
      this.mode = 'detail';
    } else this.mode = 'list';
    this.render();
  }

  private doCare(id: CareAction): void {
    try {
      let arg: string | undefined;
      if (id === 'train') arg = TRAIN_CHOICES[this.trainStat];
      if (id === 'dress') arg = ACCESSORY_CHOICES[this.accIdx] ?? '';
      if (id === 'nickname') {
        const answer = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt('Nickname (up to 12 letters, empty clears):', this.mon.care?.nickname ?? '') : null;
        if (answer === null) return;
        arg = answer;
      }
      this.flash = services().session.care(this.sel, id, arg);
      this.notice = this.flash;
      this.reordered = true;
    } catch (e) {
      playSfx(this.host.scene, 'ui.error');
      this.flash = e instanceof Error ? e.message : 'That did not work.';
    }
  }

  private reorder(to: number): void {
    try {
      services().session.moveParty(this.sel, to);
      this.sel = to;
      this.reordered = true;
      this.flash = to === 0 ? `${this.nameOf(this.mon)} leads the party.` : `${this.nameOf(this.mon)} moved to slot ${to + 1}.`;
      if (to === 0) this.mode = 'list';
    } catch (e) {
      this.flash = e instanceof Error ? e.message : 'That did not work.';
    }
  }

  /** Takes the focused held item off into the Bag (session.takeOffHeld, Major Update §4). */
  private takeOff(): void {
    const item = heldBuild(this.content, this.mon).items[this.cursor];
    if (!item) return;
    try {
      this.flash = services().session.takeOffHeld(this.sel, item.id);
      this.notice = this.flash;
      this.reordered = true;
      playSfx(this.host.scene, 'ui.select');
      const left = heldBuild(this.content, this.mon).items.length;
      this.cursor = Math.max(0, Math.min(this.cursor, left - 1));
      if (left === 0) this.mode = 'list';
    } catch (e) {
      playSfx(this.host.scene, 'ui.error');
      this.flash = e instanceof Error ? e.message : 'That did not work.';
    }
  }

  private nameOf(mon: PokemonInstance): string {
    return mon.care?.nickname || lookSpecies(this.content, mon).name;
  }

  private leave(): void {
    this.close();
    if (this.reordered) this.host.changed(this.notice);
    else this.host.setPicker(null);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
  }

  // ---------- drawing ----------
  private render(): void {
    if (this.closed) return;
    const { scene } = this.host;
    this.dyn.removeAll(true);
    this.drawList(scene);
    this.drawTabs(scene);
    const body = scene.add.container(RIGHT_X, BODY_Y);
    this.dyn.add(body);
    switch (this.tabName) {
      case 'Overview':
        this.drawOverview(scene, body);
        break;
      case 'Stats':
        this.drawStats(scene, body);
        break;
      case 'Moves':
        this.drawMoves(scene, body);
        break;
      case 'Items':
        this.drawItems(scene, body);
        break;
      case 'Bond':
        this.drawBond(scene, body);
        break;
      case 'History':
        this.drawHistory(scene, body);
        break;
      case 'Traits':
        this.drawTraits(scene, body);
        break;
    }
    if (this.mode === 'menu') this.drawMenu(scene);
    this.footer.setText(this.footerText());
    this.footer.setColor(this.flash ? '#ffe08a' : COLORS.textLight);
  }

  private footerText(): string {
    if (this.flash) return this.flash;
    if (this.pick && this.mode === 'list') return this.pick.problemFor(this.sel) ?? `Enter: choose ${this.nameOf(this.mon)}.  Up/down Pokémon · left/right tab.`;
    const r = readiness(this.content, this.mon);
    if (this.mode === 'menu') {
      const o = this.menuOptions()[this.menuIdx]!;
      return o.problem ?? o.hint;
    }
    if (this.mode === 'detail') return this.tabName === 'Items' ? 'Up/down: pick an item. Enter: take it off into the Bag. Esc: back.' : 'Up/down: pick a move. Enter or Esc: back to the party.';
    return `${this.nameOf(this.mon)}: ${r.label}${r.notes.length ? ` · ${r.notes.join(' ')}` : '.'}  Up/down Pokémon · left/right tab.`;
  }

  private text(box: Phaser.GameObjects.Container, x: number, y: number, s: string, size = 16, color = '#e8f6ff', extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    const t = this.host.scene.add.text(x, y, s, textStyle(size, color, extra));
    // A fixed width would cut a long name hard: fit it with "..." instead.
    const fixed = extra.fixedWidth ?? 0;
    if (fixed > 0 && !extra.wordWrap) {
      t.setFixedSize(0, 0);
      fitLine(t, fixed);
    }
    box.add(t);
    return t;
  }

  /** A "Label" caption with wrapped text under it; returns the y for the next field. */
  private field(box: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, value: string, color = '#ffffff', size = 16, maxLines = 3): number {
    this.text(box, x, y, label, 13, '#bfe9ff');
    const t = this.text(box, x, y + 16, value, size, color, { wordWrap: { width: w }, lineSpacing: 2, maxLines });
    return y + 16 + t.height + 10;
  }

  private panel(box: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, alpha = 0.55): void {
    const g = this.host.scene.add.graphics();
    g.fillStyle(0x061528, alpha).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, AERO.rim, 0.5).strokeRoundedRect(x, y, w, h, 12);
    box.add(g);
  }

  private drawList(scene: Phaser.Scene): void {
    const n = this.party.length;
    const gap = 6;
    const rowH = Math.max(44, Math.min(64, Math.floor((LIST_H - gap * (n - 1)) / n)));
    this.party.forEach((mon, i) => {
      const y = LIST_Y + i * (rowH + gap);
      const row = scene.add.container(LEFT_X, y).setName(`party-row-${i}`);
      const focused = i === this.sel;
      const g = scene.add.graphics();
      g.fillStyle(focused ? 0x2a6a9a : 0x0a2038, focused ? 0.85 : 0.6).fillRoundedRect(0, 0, LEFT_W, rowH, 12);
      g.lineStyle(focused ? 2 : 1, focused ? 0xfff2b0 : AERO.rim, focused ? 0.95 : 0.5).strokeRoundedRect(0, 0, LEFT_W, rowH, 12);
      row.add(g);
      const species = lookSpecies(this.content, mon);
      row.add(pokemonIcon(scene, species, 26, rowH / 2, 1.1));
      const r = readiness(this.content, mon);
      row.add(scene.add.circle(LEFT_W - 14, 14, 6, STATE_COLOR[r.state]).setStrokeStyle(2, 0x061528).setName(`ready-${r.state}`));
      const feeling = emotionOf(this.content, this.run, mon.uid);
      if (feeling) row.add(emotionDot(scene, LEFT_W - 14, 34, feeling.color).setScale(0.75).setName(`emotion-${feeling.id}`));
      row.add(scene.add.text(52, 6, `${species.name}${genderSign(this.content, mon)}${mon.shiny ? ' ★' : ''}`, textStyle(rowH >= 56 ? 20 : 17, '#ffffff')));
      fitLine(row.list[row.list.length - 1] as Phaser.GameObjects.Text, LEFT_W - 118);
      row.add(scene.add.text(LEFT_W - 28, 8, `Lv${mon.level}`, textStyle(15, '#bfe9ff')).setOrigin(1, 0));
      const maxHp = this.maxHp(mon);
      const bar = new Bar(scene, 52, rowH - 18, LEFT_W - 124, 10, 'hp');
      bar.addTo(row);
      void bar.set(mon.hp / maxHp, false);
      const tag = i === 0 ? 'LEAD' : mon.hp <= 0 ? 'FNT' : mon.status ? STATUS_LABELS[mon.status.id]?.label ?? '' : '';
      if (tag) row.add(scene.add.text(LEFT_W - 12, rowH - 20, tag, textStyle(13, i === 0 ? '#fff2b0' : '#ffb070')).setOrigin(1, 0));
      if (focused && this.mode === 'list' && this.motion !== 'off') row.add(scene.add.text(-2, rowH / 2, '▶', textStyle(14, '#fff2b0')).setOrigin(1, 0.5));
      const zone = scene.add.zone(0, 0, LEFT_W, rowH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.closed) return;
        if (this.mode === 'menu') this.mode = 'list';
        if (this.sel === i && this.mode === 'list' && !this.pick) this.mode = 'menu';
        else if (this.sel === i && this.pick) return this.handle('confirm');
        this.sel = i;
        this.cursor = 0;
        this.menuIdx = 0;
        this.render();
      });
      row.add(zone);
      this.dyn.add(row);
    });
  }

  private maxHp(mon: PokemonInstance): number {
    return summaryInfo(this.content, this.run, mon).stats.find((s) => s.key === 'hp')!.value;
  }

  private drawTabs(scene: Phaser.Scene): void {
    const w = RIGHT_W / POKEMON_TABS.length;
    POKEMON_TABS.forEach((name, i) => {
      const x = RIGHT_X + i * w;
      const active = i === this.tab;
      const g = scene.add.graphics();
      g.fillStyle(active ? 0x2a6a9a : 0x0a2038, active ? 0.9 : 0.55).fillRoundedRect(x + 2, TAB_Y, w - 4, 28, 10);
      g.lineStyle(active ? 2 : 1, active ? 0xfff2b0 : AERO.rim, active ? 0.95 : 0.4).strokeRoundedRect(x + 2, TAB_Y, w - 4, 28, 10);
      const t = scene.add.text(x + w / 2, TAB_Y + 14, name, textStyle(14, active ? '#ffffff' : '#9fc8e8')).setOrigin(0.5).setName(`tab-${name}`);
      const zone = scene.add.zone(x + 2, TAB_Y, w - 4, 28).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.closed) return;
        this.tab = i;
        this.cursor = 0;
        if (this.mode !== 'list') this.mode = 'list';
        this.render();
      });
      this.dyn.add([g, t, zone]);
    });
  }

  private drawMenu(scene: Phaser.Scene): void {
    const opts = this.menuOptions();
    const w = 214;
    const rh = opts.length > 8 ? 26 : 34;
    const h = opts.length * rh + 20;
    const x = RIGHT_X + 16;
    const y = BODY_Y + 8;
    const box = scene.add.container(x, y).setName('pokemon-action-menu');
    box.add(drawGlass(scene, 0, 0, w, h, { tint: AERO.glassLow, rim: AERO.sky, glow: false, radius: 16 }));
    opts.forEach((o, i) => {
      const oy = 10 + i * rh;
      if (i === this.menuIdx) {
        const hl = scene.add.graphics();
        hl.fillStyle(0xfff2b0, 0.22).fillRoundedRect(8, oy, w - 16, rh - 4, 10);
        hl.lineStyle(2, 0xfff2b0, 0.9).strokeRoundedRect(8, oy, w - 16, rh - 4, 10);
        box.add(hl);
      }
      box.add(scene.add.text(22, oy + (rh - 4) / 2, o.label, textStyle(rh < 30 ? 15 : 18, o.problem ? '#7f93a8' : '#ffffff')).setOrigin(0, 0.5));
      const zone = scene.add.zone(8, oy, w - 16, rh - 4).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.menuIdx === i || this.closed) return;
        this.menuIdx = i;
        this.render();
      });
      zone.on('pointerdown', () => !this.closed && this.chooseMenu(o));
      box.add(zone);
    });
    this.dyn.add(box);
  }

  // ----- Overview -----
  private drawOverview(scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const mon = this.mon;
    const info = summaryInfo(this.content, this.run, mon);
    const r = readiness(this.content, mon);
    const species = lookSpecies(this.content, mon);
    const icon = pokemonIcon(scene, species, 52, 52, 2.4);
    box.add(icon);
    if (this.motion === 'full') scene.tweens.add({ targets: icon, y: 46, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const name = this.text(box, 110, 8, `${info.name}${mon.shiny ? ' ★' : ''}`, 28, '#ffffff');
    fitLine(name, 382 - 110 - 70);
    const sign = genderSign(this.content, mon);
    const frame = sign === '♂' ? 0 : sign === '♀' ? 1 : -1;
    if (frame >= 0 && scene.textures.exists('pack.ebui.gender')) box.add(scene.add.image(110 + name.width + 14, 22, 'pack.ebui.gender', frame).setScale(1.2));
    this.text(box, 382, 12, `Lv${info.level}`, 22).setOrigin(1, 0);
    info.types.forEach((t, i) => {
      const label = typeLabel(scene, 110 + i * 92, 62, t, 1.1);
      if (label) box.add(label);
      else this.text(box, 110 + i * 112, 50, t.toUpperCase(), 16);
    });
    // HP and EXP.
    const maxHp = this.maxHp(mon);
    this.text(box, 0, 106, 'HP', 13, '#bfe9ff');
    const hp = new Bar(scene, 30, 108, 250, 12, 'hp');
    hp.addTo(box);
    void hp.set(mon.hp / maxHp, false);
    this.text(box, 292, 104, `${mon.hp}/${maxHp}`, 18);
    const xp = xpProgress(this.content, mon);
    this.text(box, 0, 138, 'EXP', 13, '#bfe9ff');
    const xbar = new Bar(scene, 30, 140, 250, 8, 'xp');
    xbar.addTo(box);
    void xbar.set(xp ? xp.fraction : 1, false);
    this.text(box, 292, 134, xp ? xp.text : 'Level limit', 14, '#d0e4f4');
    // Readiness.
    this.panel(box, 0, 166, 382, 74);
    box.add(scene.add.circle(20, 188, 7, STATE_COLOR[r.state]).setStrokeStyle(2, 0x061528));
    this.text(box, 36, 178, `Battle readiness: ${r.label}`, 18, STATE_TEXT[r.state]);
    const status = mon.hp <= 0 ? 'Fainted' : mon.status ? STATUS_LABELS[mon.status.id]?.label ?? mon.status.id : 'No status condition';
    this.text(box, 14, 202, `${status}. ${r.notes.join(' ')}`.trim(), 14, '#d0e4f4', { wordWrap: { width: 354 }, maxLines: 2 });
    // Right column.
    const rx = 400;
    const rw = RIGHT_W - rx;
    let y = 0;
    y = this.field(box, rx, y, rw, 'Ability', info.ability ? info.ability.name : '—', '#ffffff', 17, 1);
    if (info.ability) {
      this.text(box, rx, y - 10, info.ability.text, 12, '#a8c4dc', { wordWrap: { width: rw }, maxLines: 4 });
      y += 54;
    }
    y = this.field(box, rx, y, rw, 'Nature', info.nature ?? 'Unknown', '#ffffff', 15, 2);
    const bv = bondView(this.content, this.run, mon);
    {
      const c = mon.care;
      const extra = [c?.talent ? `talent ${c.talent.toUpperCase()}` : '', c?.fatigue ? `tired ×${c.fatigue}` : '', c?.favourite ? '★ favourite' : '', c?.ace ? 'ace' : ''].filter(Boolean).join(' · ');
      y = this.field(box, rx, y, rw, 'Mood', `${moodWord(c?.mood ?? 0)}${extra ? ` · ${extra}` : ''}`, (c?.mood ?? 0) < 0 ? '#ffb0a0' : '#ffffff', 14, 1);
      y = this.field(box, rx, y, rw, 'Journal', `${c?.fights ?? 0} fights · ${c?.falls ?? 0} falls`, '#ffffff', 14, 1);
      y = this.field(box, rx, y, rw, 'Feeling', bv.emotion ? bv.emotion.name : 'Calm', bv.emotion?.color ?? '#ffffff', 16, 1);
      y = this.field(box, rx, y, rw, 'Bond', `${bv.mood.text}  ${'♥'.repeat(bv.hearts)}${'♡'.repeat(5 - bv.hearts)}`, bv.hearts === 5 ? '#ff80a0' : '#ffffff', 16, 1);
    }
    // Moves and items in brief (bottom left).
    this.text(box, 0, 250, 'Moves', 13, '#bfe9ff');
    this.text(box, 0, 266, info.moves.map((m) => (mon.awakened?.includes(m.id) ? `★ ${m.name}` : m.name)).join(' · ') || '—', 15, '#ffffff', { wordWrap: { width: 382 }, maxLines: 2 });
    const build = heldBuild(this.content, mon);
    this.text(box, 0, 302, 'Holding', 13, '#bfe9ff');
    this.text(box, 0, 318, build.summary, 14, '#d0e4f4', { wordWrap: { width: 382 }, maxLines: 1 });
    const grow = growthInfo(this.content, services().session.profile, mon);
    this.text(box, rx, 232, 'Evolution', 13, '#bfe9ff');
    this.text(box, rx, 248, grow.evolutions.slice(0, 3).join('\n'), 14, '#ffffff', { wordWrap: { width: rw }, maxLines: 4 });
  }

  // ----- Stats -----
  private drawStats(scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const mon = this.mon;
    const info = summaryInfo(this.content, this.run, mon);
    const other = compareTarget(this.party, this.sel);
    const cmp = other === null ? null : compareStats(this.content, mon, this.party[other]!);
    this.text(box, 0, 0, `Stats  ·  bar = base stat${cmp ? `  ·  compared with ${this.nameOf(this.party[other!]!)}${other === 0 ? ' (lead)' : ''}` : ''}`, 15, '#bfe9ff');
    info.stats.forEach((s, i) => {
      const y = 44 + i * 40;
      this.text(box, 0, y, s.label, 18).setOrigin(0, 0.5);
      this.text(box, 128, y, String(s.value), 20).setOrigin(1, 0.5);
      if (s.boosted && scene.textures.exists('pack.ebui.statArrows')) box.add(scene.add.image(144, y, 'pack.ebui.statArrows', 0).setScale(1));
      const bx = 160;
      const bw = 250;
      const bg = scene.add.graphics();
      bg.fillStyle(0x061528, 0.85).fillRoundedRect(bx, y - 8, bw, 16, 8);
      bg.lineStyle(1, AERO.rim, 0.5).strokeRoundedRect(bx, y - 8, bw, 16, 8);
      box.add(bg);
      const fw = Math.max(8, Math.min(1, s.base / BASE_STAT_SCALE) * bw);
      const fill = scene.add.graphics({ x: bx, y });
      fill.fillStyle(STAT_COLORS[s.key] ?? 0xffffff, 1).fillRoundedRect(0, -8, fw, 16, 8);
      fill.fillStyle(0xffffff, 0.45).fillRoundedRect(3, -7, Math.max(2, fw - 6), 5, 2);
      box.add(fill);
      this.text(box, bx + bw + 8, y, `base ${s.base}`, 13, '#bfe9ff').setOrigin(0, 0.5);
      if (this.motion !== 'off') {
        fill.setScale(0, 1);
        scene.tweens.add({ targets: fill, scaleX: 1, duration: this.motion === 'full' ? 500 : 150, delay: this.motion === 'full' ? i * 40 : 0, ease: 'Quad.easeOut' });
      }
      if (cmp) {
        const c = cmp[i]!;
        const col = c.delta > 0 ? '#9af0a8' : c.delta < 0 ? '#ff9a9a' : '#9fb4c8';
        this.text(box, RIGHT_W - 8, y, c.delta === 0 ? '=' : `${c.delta > 0 ? '+' : ''}${c.delta}`, 18, col).setOrigin(1, 0.5);
      }
    });
    {
      // Stat radar (F41): base stats against the scale, drawn small beside the nature line.
      const cx = RIGHT_W - 48;
      const cy = 266;
      const rad = 26;
      const g = scene.add.graphics();
      const pt = (i: number, f: number) => ({ x: cx + Math.sin((i / 6) * Math.PI * 2) * rad * f, y: cy - Math.cos((i / 6) * Math.PI * 2) * rad * f });
      g.lineStyle(1, AERO.rim, 0.5);
      [1, 0.5].forEach((f) => {
        g.beginPath();
        info.stats.forEach((_, i) => (i === 0 ? g.moveTo(pt(i, f).x, pt(i, f).y) : g.lineTo(pt(i, f).x, pt(i, f).y)));
        g.closePath();
        g.strokePath();
      });
      g.fillStyle(0x7fd8ff, 0.45).lineStyle(2, 0xbfe9ff, 0.9);
      g.beginPath();
      info.stats.forEach((s, i) => {
        const f = Math.max(0.08, Math.min(1, s.base / BASE_STAT_SCALE));
        if (i === 0) g.moveTo(pt(i, f).x, pt(i, f).y);
        else g.lineTo(pt(i, f).x, pt(i, f).y);
      });
      g.closePath();
      g.fillPath();
      g.strokePath();
      box.add(g);
    }
    this.panel(box, 0, 292, RIGHT_W, 40, 0.4);
    this.text(box, 12, 302, `Nature: ${info.nature ?? 'unknown'}`, 15, '#ffffff', { fixedWidth: RIGHT_W - 24 });
  }

  // ----- Moves -----
  private drawMoves(scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const mon = this.mon;
    const info = summaryInfo(this.content, this.run, mon);
    if (info.moves.length === 0) {
      this.text(box, 0, 0, 'No moves.', 18, '#9fb4c8');
      return;
    }
    const cursor = Math.min(this.cursor, info.moves.length - 1);
    info.moves.forEach((m, i) => {
      const y = i * 52;
      const sel = i === cursor;
      const g = scene.add.graphics();
      g.fillStyle(sel ? 0x2a6a9a : 0x0a2038, sel ? 0.8 : 0.45).fillRoundedRect(0, y, 270, 48, 10);
      g.lineStyle(sel && this.mode === 'detail' ? 2 : 1, sel && this.mode === 'detail' ? 0xfff2b0 : AERO.rim, 0.6).strokeRoundedRect(0, y, 270, 48, 10);
      box.add(g);
      const label = typeLabel(scene, 8, y + 24, m.type, 0.8);
      if (label) box.add(label);
      this.text(box, 88, y + 7, m.name, 17, '#ffffff', { fixedWidth: 176 });
      this.text(box, 88, y + 28, `PP ${m.pp}`, 14, '#bfe9ff');
      const zone = scene.add.zone(0, y, 270, 48).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.closed) return;
        this.cursor = i;
        this.mode = 'detail';
        this.render();
      });
      box.add(zone);
    });
    const m = info.moves[cursor]!;
    const move = this.content.moves.get(m.id);
    const x = 288;
    const w = RIGHT_W - x;
    this.panel(box, x, 0, w, 330);
    this.text(box, x + 14, 10, m.name, 24, '#ffffff', { fixedWidth: w - 28 });
    const label = typeLabel(scene, x + 14, 58, m.type, 1);
    if (label) box.add(label);
    const cat = categoryIcon(scene, x + 96, 58, m.category, 1);
    if (cat) box.add(cat);
    this.text(box, x + 14, 84, `Power ${m.power}  ·  Accuracy ${m.accuracy}  ·  PP ${m.pp}`, 15, '#d0e4f4');
    if (move) {
      const lines = moveEffectLines(move).map((l) => `• ${l}`);
      this.text(box, x + 14, 112, lines.join('\n'), 15, '#e8f6ff', { wordWrap: { width: w - 28 }, lineSpacing: 4, maxLines: 10 });
    }
  }

  // ----- Items -----
  private drawItems(scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const build = heldBuild(this.content, this.mon);
    this.preloadIcons(scene, build.items.map((i) => i.icon));
    this.text(box, 0, 0, build.summary, 15, '#bfe9ff', { fixedWidth: RIGHT_W });
    if (build.items.length === 0) {
      this.text(box, 0, 40, 'This Pokémon holds nothing. Held items come from drafts, shops and events.', 17, '#9fb4c8', { wordWrap: { width: RIGHT_W }, maxLines: 3 });
      return;
    }
    const cursor = Math.min(this.cursor, build.items.length - 1);
    const rowH = build.items.length > 7 ? 38 : 44;
    build.items.forEach((it, i) => {
      const y = 28 + i * (rowH + 4);
      const sel = i === cursor;
      const g = scene.add.graphics();
      g.fillStyle(sel ? 0x2a6a9a : 0x0a2038, sel ? 0.8 : 0.45).fillRoundedRect(0, y, 240, rowH, 10);
      g.lineStyle(sel && this.mode === 'detail' ? 2 : 1, sel && this.mode === 'detail' ? 0xfff2b0 : AERO.rim, 0.6).strokeRoundedRect(0, y, 240, rowH, 10);
      box.add(g);
      if (it.icon) box.add(itemVisual(scene, it.icon, 22, y + rowH / 2, 1));
      this.text(box, 42, y + rowH / 2, `${it.name}${it.copies > 1 ? ` ×${it.copies}` : ''}`, 15, '#ffffff', { fixedWidth: 190 }).setOrigin(0, 0.5);
      const zone = scene.add.zone(0, y, 240, rowH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.closed) return;
        this.cursor = i;
        this.mode = 'detail';
        this.render();
      });
      box.add(zone);
    });
    const it = build.items[cursor]!;
    const x = 254;
    const w = RIGHT_W - x;
    this.panel(box, x, 28, w, 304);
    if (it.icon) box.add(itemVisual(scene, it.icon, x + 24, 56, 1.4));
    this.text(box, x + 50, 40, `${it.name}${it.copies > 1 ? ` ×${it.copies}` : ''}`, 20, '#ffffff', { fixedWidth: w - 140 });
    this.text(box, x + 50, 64, `${MODE_TEXT[it.mode]}${it.consumed ? ' · used up' : ''}`, 13, it.mode === 'passive' ? '#9af0a8' : '#ffe08a');
    const lines: string[] = [];
    lines.push(it.description);
    for (const e of it.effects) lines.push(`• ${e}`);
    for (const c of it.catches) lines.push(`⚠ ${c}`);
    if (it.conditions.length > 0) lines.push(`When: ${it.conditions.join(', ')}.`);
    lines.push(`Stacking: ${it.stacking}`);
    if (it.detail.length > 0 && this.mode === 'detail') lines.push(...it.detail);
    if (!this.pick) {
      const btn = this.text(box, x + w - 14, 40, 'Take off', 16, '#fff2b0').setOrigin(1, 0).setName('take-off-item').setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        if (this.closed) return;
        this.cursor = cursor;
        this.takeOff();
        this.render();
      });
    }
    this.text(box, x + 14, 88, lines.join('\n'), 13, '#e8f6ff', { wordWrap: { width: w - 28 }, lineSpacing: 3, maxLines: 17 });
  }

  /** Item art loads on demand; once it has, the screen draws again so the icons appear. */
  private preloadIcons(scene: Phaser.Scene, ids: (string | null)[]): void {
    const missing = ids.filter((id): id is string => id !== null && !scene.textures.exists(id) && services().assets.has(id));
    const key = missing.join('|');
    if (missing.length === 0 || key === this.loadingKey) return;
    this.loadingKey = key;
    void loadAssets(scene, missing).then(() => {
      if (!this.closed && scene.scene.isActive()) this.render();
    });
  }

  // ----- Bond -----
  private drawBond(scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const v = bondView(this.content, this.run, this.mon);
    const pill = scene.add.graphics();
    pill.fillStyle(v.mood.color, 0.9).fillRoundedRect(0, 0, 110, 28, 14);
    pill.fillStyle(0xffffff, 0.35).fillRoundedRect(4, 2, 102, 11, 5);
    pill.lineStyle(2, AERO.white, 0.8).strokeRoundedRect(0, 0, 110, 28, 14);
    box.add(pill);
    this.text(box, 55, 14, v.mood.text, 17, '#ffffff', { stroke: '#0b2a4a', strokeThickness: 3 }).setOrigin(0.5);
    this.text(box, 124, 6, `${v.trait[0]!.toUpperCase()}${v.trait.slice(1)}  ·  ${v.roles.join(' / ')}`, 15, '#bfe9ff', { fixedWidth: RIGHT_W - 130 });
    this.text(box, 0, 40, `${v.mood.hint}`, 13, '#d0e4f4', { wordWrap: { width: RIGHT_W }, maxLines: 2 });
    BOND_BARS.forEach((bar, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col * (RIGHT_W / 2 + 4);
      const y = 84 + row * 28;
      const bw = RIGHT_W / 2 - 150;
      this.text(box, x, y, bar.label, 14).setOrigin(0, 0.5);
      const bg = scene.add.graphics();
      bg.fillStyle(0x061528, 0.85).fillRoundedRect(x + 92, y - 6, bw, 12, 6);
      bg.lineStyle(1, AERO.rim, 0.5).strokeRoundedRect(x + 92, y - 6, bw, 12, 6);
      box.add(bg);
      const value = v.values.find((e) => e.key === bar.key)?.value ?? 0;
      const fw = value > 0 ? Math.max(6, (bw * value) / 100) : 0;
      if (fw > 0) {
        const fill = scene.add.graphics({ x: x + 92, y });
        fill.fillStyle(bar.color, 1).fillRoundedRect(0, -6, fw, 12, 6);
        fill.fillStyle(0xffffff, 0.45).fillRoundedRect(2, -5, Math.max(2, fw - 4), 4, 2);
        box.add(fill);
      }
      this.text(box, x + 98 + bw, y, String(value), 13, '#ffffff').setOrigin(0, 0.5);
    });
    this.text(box, 0, 202, 'Personality', 13, '#bfe9ff');
    this.text(box, 0, 218, v.personality, 14, '#ffffff', { wordWrap: { width: RIGHT_W }, maxLines: 3 });
    this.text(box, 0, 268, 'Friendships', 13, '#bfe9ff');
    this.text(box, 0, 284, v.relations || 'No close friendships yet.', 14, '#ffffff', { wordWrap: { width: RIGHT_W }, maxLines: 2 });
    this.text(box, RIGHT_W, 268, `Feeling: ${v.emotion ? v.emotion.name : 'calm'}   ${'♥'.repeat(v.hearts)}${'♡'.repeat(5 - v.hearts)}`, 14, v.emotion?.color ?? '#ffffff').setOrigin(1, 0);
  }

  // ----- History -----
  private drawHistory(_scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const h = historyView(this.run, this.mon);
    this.text(box, 0, 0, 'This run', 15, '#bfe9ff');
    this.text(box, 0, 24, h.record, 20, '#ffffff', { wordWrap: { width: RIGHT_W }, maxLines: 2 });
    this.text(box, 0, 66, 'Titles', 15, '#bfe9ff');
    this.text(box, 0, 88, h.titles.length > 0 ? h.titles.join(', ') : 'None yet.', 16, '#ffe9a8', { wordWrap: { width: RIGHT_W }, maxLines: 2 });
    this.text(box, 0, 132, 'Most memorable moments', 15, '#bfe9ff');
    this.text(box, 0, 156, h.memories.length > 0 ? h.memories.map((t) => `• ${t}`).join('\n') : 'No story yet: it will remember its battles here.', 15, '#e8f6ff', { wordWrap: { width: RIGHT_W }, lineSpacing: 4, maxLines: 10 });
  }

  // ----- Traits -----
  private drawTraits(_scene: Phaser.Scene, box: Phaser.GameObjects.Container): void {
    const mon = this.mon;
    const grow = growthInfo(this.content, services().session.profile, mon);
    const traits = traitLines(this.content, mon);
    const half = (RIGHT_W - 20) / 2;
    this.text(box, 0, 0, 'Evolution', 15, '#bfe9ff');
    this.text(box, 0, 22, grow.evolutions.map((t) => `→ ${t}`).join('\n'), 15, '#ffffff', { wordWrap: { width: half }, lineSpacing: 3, maxLines: 6 });
    this.text(box, 0, 130, 'Battle forms', 15, '#bfe9ff');
    this.text(box, 0, 152, grow.forms.length > 0 ? grow.forms.map((t) => `★ ${t}`).join('\n') : 'No Mega form.', 15, grow.forms.length > 0 ? '#ffe9a8' : '#9fb4c8', { wordWrap: { width: half }, lineSpacing: 3, maxLines: 5 });
    this.text(box, 0, 236, 'Mastery', 15, '#bfe9ff');
    this.text(box, 0, 258, `${grow.mastery.rank}${grow.mastery.next ? `\nNext, ${grow.mastery.next}` : '  (top rank)'}`, 14, '#e8f6ff', { wordWrap: { width: half }, maxLines: 5 });
    const x = half + 20;
    this.text(box, x, 0, 'Special characteristics', 15, '#bfe9ff');
    this.text(box, x, 22, traits.length > 0 ? traits.map((t) => `• ${t}`).join('\n') : 'Nothing out of the ordinary.', 15, '#ffffff', { wordWrap: { width: half }, lineSpacing: 4, maxLines: 12 });
  }
}
