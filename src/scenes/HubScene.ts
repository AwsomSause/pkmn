// The Out-of-Run hub (GAME_DESIGN.md §14.1): start a run, or visit the Bank
// (and its licenses), Trainer Archive, Achievement Hall, Starter Laboratory,
// Run History and save data. Everything
// here reads and changes the permanent profile only.

import Phaser from 'phaser';
import { ATTRIBUTE_LABELS, attributeEffectText, attributeRange, attributeText, growthText, isMeter, readAttributes } from '../core/attributes';
import { ACHIEVEMENT_CATEGORIES, ATTRIBUTE_KEYS, STARTER_POOL_CATEGORIES, type Achievement, type Archetype, type QuestReward, type Species, type StarterPoolCategory } from '../core/contentSchema';
import { claimProblem, requirementProgress, trainerStatus, type TrainerStatus } from '../core/progress';
import { abilityChoices, atLeast, eggMoveOptions, masteredStarters, familyId, familyMembers, familyPerk, familyRank, nextGoal, rankIndex, RANK_NAMES, speciesRank, type MasteryRank } from '../core/mastery';
import { evolutionUnlocked, questLineView, stepsDone } from '../core/quests';
import { eligibleSpecies, licenseProblem, licenseStatus, poolProblem, poolStatus, type LicenseStatus, type PoolStatus } from '../core/runPrep';
import type { RunRecord } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { onInputAction, type InputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { itemVisual, pokemonIcon, trainerVisual } from '../ui/sprites';
import { preloadPokemon } from '../ui/lazyAssets';
import { ArenaBackdrop, currencyChip, drawLogo, ShowcaseMon } from '../ui/showcase';
import { pokemonAssetIds } from '../assets/catalog';
import { COLORS, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { Menu, paintWindow } from '../ui/widgets';

type Room = 'run' | 'archive' | 'achievements' | 'bank' | 'lab' | 'attributes' | 'history' | 'quests' | 'mastery' | 'save' | 'back';

const ROOMS: { room: Room; label: string; blurb: string }[] = [
  { room: 'run', label: 'Start a run', blurb: 'Choose a trainer and a starter, then set off.' },
  { room: 'archive', label: 'Trainer Archive', blurb: 'Every trainer, what they change, and how to unlock them.' },
  { room: 'achievements', label: 'Achievement Hall', blurb: 'Milestones and their rewards. Progress counts automatically.' },
  { room: 'bank', label: 'Bank', blurb: 'Your permanent currencies, what your last run paid, and licenses to buy (Enter).' },
  { room: 'lab', label: 'Starter Laboratory', blurb: 'Starter sets by category: regions, types, teams, leagues and more (Enter).' },
  { room: 'attributes', label: 'Attributes', blurb: 'Your permanent attributes, what they do, and how they grow (Enter for details).' },
  { room: 'history', label: 'Run History', blurb: 'Your recent runs: how far they got and what ended them.' },
  { room: 'quests', label: 'Trainer Quests', blurb: 'Each trainer\'s five-step quest line, done across runs (Enter for the steps).' },
  { room: 'mastery', label: 'Species Mastery', blurb: 'Every Pokémon you met, its mastery rank, and what each rank unlocks (Enter).' },
  { room: 'save', label: 'Save data', blurb: 'Export your profile to a file, or import one.' },
  { room: 'back', label: 'Back to title', blurb: '' },
];

const RANK_COLOR: Record<MasteryRank, string> = {
  none: COLORS.textMuted,
  seen: COLORS.textMuted,
  caught: COLORS.textLight,
  bronze: '#d08a4a',
  silver: '#c8d4e0',
  gold: COLORS.gold,
  master: '#ff7ad9',
};

/** Families with at least one member met, best rank first, then by Pokédex number. */
function masteryFamilies(content: ReturnType<typeof services>['session']['content'], p: ReturnType<typeof services>['session']['profile']): string[] {
  const families = [...new Set(Object.keys(p.mastery ?? {}).filter((id) => content.species.has(id)).map((id) => familyId(content, id)))];
  return families.sort((a, b) => rankIndex(familyRank(content, p, b)) - rankIndex(familyRank(content, p, a)) || content.species.get(a)!.dex - content.species.get(b)!.dex);
}

const STATUS_LABEL: Record<TrainerStatus, string> = {
  unlocked: 'Unlocked',
  claimable: 'Ready to claim',
  locked: 'Locked',
  comingLater: 'Coming later',
};

const POOL_CATEGORY_LABEL: Record<StarterPoolCategory, string> = {
  classic: 'Classic',
  region: 'Regions',
  type: 'Types',
  role: 'Roles',
  trainer: 'Trainers',
  evilTeam: 'Villainous Teams',
  league: 'Pokémon League',
  spinOff: 'Spin-off Games',
  research: 'Research',
  rare: 'Rare',
};

const POOL_LABEL: Record<PoolStatus, string> = {
  unlocked: 'Unlocked',
  buyable: 'Ready to unlock',
  needsLicense: 'Needs a license',
  locked: 'Locked',
  comingLater: 'Arrives with the full Pokédex',
};

const LICENSE_LABEL: Record<LicenseStatus, string> = { owned: 'Owned', buyable: 'For sale', locked: 'Locked' };

const CATEGORY_LABEL: Record<(typeof ACHIEVEMENT_CATEGORIES)[number], string> = {
  campaign: 'Campaign',
  collection: 'Collection',
  battle: 'Battle',
  exploration: 'Exploration',
  economy: 'Economy',
  roguelike: 'Roguelike',
  relationship: 'Relationship',
  secret: 'Secret',
  endgame: 'Endgame',
};

/** The five tiles along the bottom of the Hub; a tile with several rooms opens a small menu. */
/** The hint line sits between the Pokémon's ground patch and the raised tile. */
const BLURB_Y = 382;

const TILES: { id: string; label: string; icon: string; rooms: Room[]; blurb: string }[] = [
  { id: 'settings', label: 'Settings', icon: 'item.scanner', rooms: ['save', 'back'], blurb: 'Save data, and the way back to the title screen.' },
  { id: 'trainers', label: 'Trainers', icon: 'item.leaders_crest', rooms: ['archive', 'quests'], blurb: 'Every trainer, how to unlock them, and their quest lines.' },
  { id: 'run', label: 'New Run', icon: 'ball.pb', rooms: ['run'], blurb: ROOMS[0]!.blurb },
  { id: 'history', label: 'Past Runs', icon: 'item.calendar', rooms: ['history'], blurb: ROOMS[6]!.blurb },
  { id: 'unlocks', label: 'Unlocks', icon: 'item.golden_mystic_ticket', rooms: ['achievements', 'bank', 'lab', 'attributes', 'mastery'], blurb: 'Achievements, the Bank, the Starter Laboratory, Attributes and Species Mastery.' },
];

const ROOM_ICON: Partial<Record<Room, string>> = {
  achievements: 'item.master_ribbon',
  bank: 'item.coin_case',
  lab: 'item.mystery_egg',
  attributes: 'item.exp_charm',
  mastery: 'item.master_ribbon',
  save: 'item.map',
  back: 'item.pair_of_tickets',
};

const TILE_Y = 470;
const TILE_H = 104;
/** How far a focused tile rises. */
const TILE_RISE = 16;

interface Tile {
  root: Phaser.GameObjects.Container;
  idle: Phaser.GameObjects.Graphics;
  lit: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.GameObject & { y: number };
  label: Phaser.GameObjects.Text;
  x: number;
  w: number;
}

export class HubScene extends Phaser.Scene {
  private picker: Picker | null = null;
  private detail!: Phaser.GameObjects.Container;
  private tiles: Tile[] = [];
  private tileIndex = 2;
  /** The small menu above a tile with several rooms, while it is open. */
  private submenu: { menu: Menu; layer: Phaser.GameObjects.Container; rooms: Room[] } | null = null;
  private blurb!: Phaser.GameObjects.Text;
  private blurbPill!: Phaser.GameObjects.Graphics;
  private showcase!: ShowcaseMon;
  /** One Pokémon per tile, shown behind the menu when that tile is focused. */
  private tileMons: Species[] = [];

  constructor() {
    super('Hub');
  }

  preload(): void {
    const { session } = services();
    // Five random Pokémon from the game (not the custom forms) to show behind the tiles.
    const all = [...session.content.species.values()].filter((sp) => !sp.id.includes('-') && services().assets.has(pokemonAssetIds(sp.assets).front));
    this.tileMons = Phaser.Utils.Array.Shuffle(all).slice(0, TILES.length);
    preloadPokemon(this, this.tileMons, { front: true });
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    const { session } = services();
    session.closeRun();
    this.picker = null;
    this.submenu = null;
    this.tiles = [];
    playMusic(this, 'bgm.menu');
    const p = session.profile;

    new ArenaBackdrop(this, { platformAt: { x: GAME_WIDTH / 2, y: 350 } });
    // Darken the top (logo, counters) and the bottom (tiles) so text stays readable.
    const shade = this.add.graphics().setDepth(-20);
    for (let i = 0; i < 12; i++) {
      shade.fillStyle(0x0e0b12, 0.5 * (1 - i / 12));
      shade.fillRect(0, i * 8, GAME_WIDTH, 8);
      shade.fillStyle(0x0e0b12, 0.75 * (i / 12));
      shade.fillRect(0, 380 + i * 14, GAME_WIDTH, 14);
    }
    this.showcase = new ShowcaseMon(this, GAME_WIDTH / 2, 356, PIXEL_SCALE, 250);

    drawLogo(this, 20, 10, 40);
    let right = GAME_WIDTH - 16;
    right -= currencyChip(this, right, 32, 'item.candy', p.candies, 'Candies') + 8;
    right -= currencyChip(this, right, 32, 'item.dna_splicers', p.researchPoints, 'Research Points') + 8;
    currencyChip(this, right, 32, 'item.coin_case', p.bankCredits, 'Bank Credits');
    const earned = Object.keys(p.achievements).length;
    this.add
      .text(GAME_WIDTH - 16, 62, `${p.activeTitle ? `${p.activeTitle}  ·  ` : ''}Achievements ${earned}/${session.content.achievements.size}  ·  Runs ${p.stats.runsEnded}`, textStyle(16, COLORS.textMuted))
      .setOrigin(1, 0);

    this.detail = this.add.container(0, 0);
    this.blurbPill = this.add.graphics();
    this.blurb = this.add.text(GAME_WIDTH / 2, BLURB_Y, '', textStyle(16, COLORS.textLight, { align: 'center' })).setOrigin(0.5, 0.5);

    const ready = [...session.content.archetypes.values()].filter((a) => trainerStatus(p, a) === 'claimable').length;
    this.buildTiles(ready);

    if (data.notice) {
      const notice = this.add
        .text(GAME_WIDTH / 2, 110, data.notice, textStyle(20, COLORS.gold, { align: 'center', wordWrap: { width: GAME_WIDTH - 120 } }))
        .setOrigin(0.5, 0);
      this.tweens.add({ targets: notice, alpha: 0, delay: 5000, duration: 800 });
    }

    // Start on New Run, or on the room the screen was reopened for.
    const room = data.focus !== undefined ? ROOMS[Math.min(data.focus, ROOMS.length - 1)]!.room : 'run';
    const tile = Math.max(0, TILES.findIndex((t) => t.rooms.includes(room)));
    this.focusTile(tile, false);
    if (data.focus !== undefined && TILES[tile]!.rooms.length > 1) this.openSubmenu(TILES[tile]!.rooms.indexOf(room));

    onInputAction(this, (a) => this.handle(a));
  }

  private buildTiles(ready: number): void {
    const widths = [164, 172, 220, 172, 164];
    const gap = (GAME_WIDTH - 32 - widths.reduce((a, b) => a + b, 0)) / (widths.length - 1);
    let x = 16;
    TILES.forEach((t, i) => {
      const w = widths[i]!;
      const big = t.id === 'run';
      const h = big ? TILE_H + 12 : TILE_H;
      const top = TILE_Y - h / 2;
      const root = this.add.container(x, top);
      const idle = paintWindow(this.add.graphics(), 0, 0, w, h, { fill: 0x2a2431, border: big ? COLORS.border : COLORS.borderMuted, alpha: 0.94 });
      const lit = paintWindow(this.add.graphics(), 0, 0, w, h, { fill: 0x3a3048, border: COLORS.accent }).setVisible(false);
      const icon = itemVisual(this, t.icon, w / 2, big ? 42 : 38, big ? 3 : 2) as Tile['icon'];
      const text = t.id === 'trainers' && ready > 0 ? `${t.label} (${ready}!)` : t.label;
      const label = this.add.text(w / 2, h - 26, text, textStyle(big ? 28 : 24)).setOrigin(0.5, 0.5);
      root.add([idle, lit, icon, label]);
      const zone = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (!this.picker && !this.submenu) this.focusTile(i);
      });
      zone.on('pointerdown', () => {
        if (this.picker) return;
        if (this.submenu) this.closeSubmenu();
        this.focusTile(i, false);
        this.confirmTile();
      });
      root.add(zone);
      this.tiles.push({ root, idle, lit, icon, label, x, w });
      x += w + gap;
    });
  }

  private focusTile(i: number, sound = true): void {
    if (sound && i !== this.tileIndex) playSfx(this, 'ui.select', 0.5);
    this.tileIndex = i;
    this.tiles.forEach((tile, n) => {
      const on = n === i;
      tile.idle.setVisible(!on);
      tile.lit.setVisible(on);
      tile.label.setColor(on ? COLORS.gold : COLORS.textLight);
      const h = TILES[n]!.id === 'run' ? TILE_H + 12 : TILE_H;
      this.tweens.killTweensOf(tile.root);
      this.tweens.add({ targets: tile.root, y: TILE_Y - h / 2 - (on ? TILE_RISE : 0), duration: 180, ease: 'Cubic.easeOut' });
      this.tweens.killTweensOf(tile.icon);
      const iconY = TILES[n]!.id === 'run' ? 42 : 38;
      tile.icon.y = iconY;
      if (on) this.tweens.add({ targets: tile.icon, y: iconY - 5, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    const t = TILES[i]!;
    this.setBlurb(t.blurb);
    const mon = this.tileMons[i];
    if (mon) this.showcase.show(mon);
    this.showDetail(t.rooms[0]!);
  }

  /** The one-line description above the tiles, on a dark pill. */
  private setBlurb(text: string): void {
    this.blurb.setText(text);
    const w = this.blurb.width + 32;
    this.blurbPill.clear();
    this.blurbPill.fillStyle(0x0e0b12, 0.78);
    this.blurbPill.fillRoundedRect(GAME_WIDTH / 2 - w / 2, BLURB_Y - 14, w, 28, 14);
  }

  private confirmTile(): void {
    const t = TILES[this.tileIndex]!;
    playSfx(this, 'ui.select');
    if (t.rooms.length === 1) this.enter(t.rooms[0]!);
    else this.openSubmenu(0);
  }

  private openSubmenu(focus: number): void {
    const t = TILES[this.tileIndex]!;
    const tile = this.tiles[this.tileIndex]!;
    const w = 280;
    const itemH = 46;
    const h = t.rooms.length * itemH + 28;
    const x = Phaser.Math.Clamp(tile.x + tile.w / 2 - w / 2, 12, GAME_WIDTH - w - 12);
    const y = TILE_Y - TILE_H / 2 - TILE_RISE - h - 8;
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(paintWindow(this.add.graphics(), x, y, w, h, { border: COLORS.accent }));
    t.rooms.forEach((room, n) => {
      const icon = ROOM_ICON[room];
      if (icon) layer.add(itemVisual(this, icon, x + w - 30, y + 14 + n * itemH + 16, 1));
    });
    const menu = new Menu(this, {
      x: x + 18,
      y: y + 16,
      options: t.rooms.map((room) => ({ label: ROOMS.find((r) => r.room === room)!.label })),
      itemHeight: itemH,
      fontSize: 24,
      onFocus: (n) => {
        const room = t.rooms[n]!;
        this.setBlurb(ROOMS.find((r) => r.room === room)!.blurb || t.blurb);
        this.showDetail(room);
      },
      onSelect: (n) => this.enter(t.rooms[n]!),
      onBack: () => this.closeSubmenu(),
    });
    menu.container.setDepth(51);
    layer.setAlpha(0);
    menu.container.setAlpha(0);
    this.tweens.add({ targets: [layer, menu.container], alpha: 1, duration: 160 });
    this.submenu = { menu, layer, rooms: t.rooms };
    menu.focus(Phaser.Math.Clamp(focus, 0, t.rooms.length - 1), false);
  }

  private closeSubmenu(): void {
    if (!this.submenu) return;
    this.submenu.menu.destroy();
    this.submenu.layer.destroy();
    this.submenu = null;
    this.focusTile(this.tileIndex, false);
  }

  private handle(a: InputAction): void {
    if (this.picker) {
      this.picker.handle(a);
      return;
    }
    if (this.submenu) {
      if (a === 'left' || a === 'right') {
        this.closeSubmenu();
        this.focusTile((this.tileIndex + (a === 'left' ? TILES.length - 1 : 1)) % TILES.length);
      } else {
        this.submenu.menu.handle(a);
      }
      return;
    }
    if (a === 'left') this.focusTile((this.tileIndex + TILES.length - 1) % TILES.length);
    else if (a === 'right') this.focusTile((this.tileIndex + 1) % TILES.length);
    else if (a === 'confirm' || a === 'up') {
      if (a === 'confirm' || TILES[this.tileIndex]!.rooms.length > 1) this.confirmTile();
    } else if (a === 'back') this.scene.start('MainMenu');
  }

  private focusIndex(room: Room): number {
    return ROOMS.findIndex((r) => r.room === room);
  }

  private restart(notice: string | undefined, room: Room): void {
    this.scene.restart({ notice, focus: this.focusIndex(room) });
  }

  // ---------- the information card on the right ----------

  private line(y: number, text: string, size = 18, color: string = COLORS.textLight): number {
    const t = this.add.text(32, y, text, textStyle(size, color, { wordWrap: { width: 270 } }));
    this.detail.add(t);
    return y + t.height + 4;
  }

  private showDetail(room: Room): void {
    this.detail.removeAll(true);
    const { session } = services();
    const p = session.profile;
    const card = this.add.graphics();
    this.detail.add(card);
    let y = 136;
    switch (room) {
      case 'bank': {
        y = this.line(y, 'Bank', 22);
        y = this.line(y, `Bank Credits: ${p.bankCredits}`, 16);
        y = this.line(y, `Earned in total: ${p.lifetimeBankCredits}`, 16, COLORS.textMuted);
        y = this.line(y, `Research Points: ${p.researchPoints}`, 16);
        y = this.line(y, `Candies: ${p.candies}`, 16);
        const last = p.lastPayout;
        y = last ? this.line(y + 4, `Last run paid ${last.total} credits`, 16, COLORS.gold) : this.line(y + 4, 'No runs paid out yet.', 16, COLORS.textMuted);
        y = this.line(y, `Licenses: ${p.licenses.length} of ${session.content.licenses.size} owned`, 16);
        break;
      }
      case 'archive': {
        y = this.line(y, 'Trainers', 22);
        for (const a of session.content.archetypes.values()) y = this.line(y, `${a.name}  ·  ${STATUS_LABEL[trainerStatus(p, a)]}`, 16, trainerStatus(p, a) === 'unlocked' ? COLORS.textLight : COLORS.textMuted);
        break;
      }
      case 'lab': {
        y = this.line(y, 'Starter Laboratory', 22);
        y = this.line(y, `Research Points: ${p.researchPoints}`, 16);
        for (const c of STARTER_POOL_CATEGORIES) {
          const pools = [...session.content.starterPools.values()].filter((pool) => pool.category === c);
          const open = pools.filter((pool) => poolStatus(session.content, p, pool) === 'unlocked').length;
          if (pools.length > 0) y = this.line(y, `${POOL_CATEGORY_LABEL[c]}  ·  ${open}/${pools.length} unlocked`, 16);
        }
        break;
      }
      case 'attributes': {
        y = this.line(y, 'Attributes', 22);
        const a = readAttributes(session.content, p.attributes);
        for (const k of ATTRIBUTE_KEYS) y = this.line(y, attributeText(k, a[k]), 16);
        break;
      }
      case 'achievements': {
        y = this.line(y, 'Achievement Hall', 22);
        y = this.line(y, `${Object.keys(p.achievements).length} of ${session.content.achievements.size} earned`, 16);
        if (p.titles.length > 0) y = this.line(y, `Titles: ${p.titles.join(', ')}`, 16);
        break;
      }
      case 'quests': {
        y = this.line(y, 'Trainer Quests', 22);
        const lines = [...session.content.questLines.values()];
        const finished = lines.filter((l) => stepsDone(session.content, p, l.trainerId) === l.steps.length).length;
        y = this.line(y, `${finished} of ${lines.length} quest lines finished`, 16);
        y = this.line(y, `Steps done: ${lines.reduce((n, l) => n + stepsDone(session.content, p, l.trainerId), 0)} of ${lines.length * 5}`, 16, COLORS.textMuted);
        break;
      }
      case 'mastery': {
        y = this.line(y, 'Species Mastery', 22);
        const families = masteryFamilies(session.content, p);
        y = this.line(y, `${families.length} families met`, 16);
        for (const rank of ['bronze', 'silver', 'gold', 'master'] as const) {
          const n = families.filter((f) => familyRank(session.content, p, f) === rank).length;
          if (n > 0) y = this.line(y, `${RANK_NAMES[rank]}: ${n}`, 16, RANK_COLOR[rank]);
        }
        break;
      }
      case 'history': {
        y = this.line(y, 'Past Runs', 22);
        const runs = p.runHistory.slice(0, 4);
        if (runs.length === 0) y = this.line(y, 'No finished runs yet.', 16, COLORS.textMuted);
        for (const r of runs) y = this.line(y, historyLine(r), 16);
        break;
      }
      case 'run': {
        y = this.line(y, 'New Run', 22);
        y = this.line(y, `Trainers unlocked: ${[...session.content.archetypes.values()].filter((a) => trainerStatus(p, a) === 'unlocked').length}`, 16);
        if (session.savedRun.status === 'ok') y = this.line(y, 'You have a run in progress: starting a new one replaces it.', 16, COLORS.bad);
        break;
      }
      default:
        card.destroy();
        return;
    }
    paintWindow(card, 16, 124, 300, y - 116, { thin: true, fill: 0x221d29, border: COLORS.borderMuted, alpha: 0.88 });
  }

  // ---------- rooms ----------

  private enter(room: Room): void {
    switch (room) {
      case 'run':
        this.scene.start('TrainerSelect');
        break;
      case 'archive':
        this.openArchive();
        break;
      case 'achievements':
        this.openAchievements();
        break;
      case 'bank':
        this.openLicenses();
        break;
      case 'lab':
        this.openLab();
        break;
      case 'attributes':
        this.openAttributes();
        break;
      case 'history':
        this.openHistory();
        break;
      case 'quests':
        this.openQuests();
        break;
      case 'mastery':
        this.openMastery();
        break;
      case 'save':
        this.openSaveData();
        break;
      case 'back':
        this.scene.start('MainMenu');
        break;
    }
  }

  private openPicker(config: ConstructorParameters<typeof Picker>[1]): void {
    if (this.submenu) this.submenu.menu.enabled = false;
    this.picker = new Picker(this, config);
  }

  private closePicker(): void {
    this.picker?.close();
    this.picker = null;
    if (this.submenu) this.submenu.menu.enabled = true;
  }

  /** Every family you met, best rank first; Enter shows its members, goals and unlocks. */
  private openMastery(): void {
    const { session } = services();
    const content = session.content;
    const p = session.profile;
    const motion = session.settings.battleAnimations;
    const families = masteryFamilies(content, p);
    if (families.length === 0) {
      playSfx(this, 'ui.error', 0.5);
      this.restart('Meet Pokémon in a run to start their mastery.', 'mastery');
      return;
    }
    const rows: PickerRow[] = families.map((f) => {
      const rank = familyRank(content, p, f);
      const members = familyMembers(content, f).filter((id) => p.mastery[id]);
      const goal = members.map((id) => nextGoal(content, id, p.mastery[id])).find(Boolean);
      return {
        problem: null,
        hint: goal ? `Next: ${RANK_NAMES[goal.rank]}: ${goal.parts.map((g) => `${g.text} (${g.current}/${g.target})`).join(', ')}` : 'Mastered!',
        draw: (scene, box, w, h) => {
          const species = content.species.get(f)!;
          box.add(pokemonIcon(scene, species, 30, h / 2 + 2, 0.9));
          box.add(scene.add.text(64, 8, species.name, textStyle(19)));
          box.add(scene.add.text(64, 32, familyMembers(content, f).map((id) => content.species.get(id)!.name).slice(0, 3).join(' → '), textStyle(13, COLORS.textMuted)));
          const medal = scene.add.text(w - 14, h / 2, RANK_NAMES[rank], textStyle(18, RANK_COLOR[rank])).setOrigin(1, 0.5);
          box.add(medal);
          // A gentle bob for ranked families (none when motion is reduced or off).
          if (motion === 'full' && atLeast(rank, 'bronze')) scene.tweens.add({ targets: medal, y: h / 2 - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        },
      };
    });
    this.openPicker({
      title: `Species Mastery  ·  ${families.length} families`,
      rows,
      columns: 2,
      rowHeight: 58,
      onSelect: (i) => this.openMasteryFamily(families[i]!),
      onBack: () => this.closePicker(),
    });
  }

  private openMasteryFamily(family: string): void {
    const { session } = services();
    const content = session.content;
    const p = session.profile;
    const rank = familyRank(content, p, family);
    const perk = familyPerk(content, p, family);
    const options = eggMoveOptions(content, family);
    const usable = options.filter((o) => o.active).map((o) => o.id);
    const moveName = (id: string) => content.moves.get(id)?.name ?? id;
    const abilityName = (slot: number) => {
      const a = content.species.get(family)!.abilities;
      const id = slot === -1 ? a.hidden : a.normal[slot];
      return id ? (content.abilities.get(id)?.name ?? id) : '—';
    };
    type Row = PickerRow & { act?: () => void };
    const rows: Row[] = [];
    // Battle-only forms (Mega, Gigantamax) are listed only once you have met them.
    const shown = familyMembers(content, family).filter((id) => {
      const form = content.species.get(id)!.form;
      return !form || form.kind === 'regional' || form.kind === 'alternate' || p.mastery[id];
    });
    for (const id of shown) {
      const rec = p.mastery[id];
      const r = speciesRank(content, id, rec);
      const goal = nextGoal(content, id, rec);
      rows.push({
        problem: null,
        hint: rec ? `Runs met ${rec.seen}, joined ${rec.caught}, battles ${rec.battles}, boss wins ${rec.bossWins}, evolved ${rec.evolved}, flawless ${rec.flawless}, regions ${rec.regions}` : 'Not met yet.',
        draw: (scene, box, w, h) => {
          box.add(pokemonIcon(scene, content.species.get(id)!, 28, h / 2 + 2, 0.85));
          box.add(scene.add.text(60, 6, `${content.species.get(id)!.name}  ·  ${RANK_NAMES[r]}`, textStyle(18, RANK_COLOR[r])));
          box.add(scene.add.text(60, 30, goal ? `Next ${RANK_NAMES[goal.rank]}: ${goal.parts.map((g) => `${g.text} ${g.current}/${g.target}`).join(', ')}` : 'Master rank reached', textStyle(13, COLORS.textMuted, { wordWrap: { width: w - 70 } })));
        },
      });
    }
    const unlock = (min: 'bronze' | 'silver' | 'gold' | 'master', label: string, value: string, act?: () => void) => {
      const open = atLeast(rank, min);
      rows.push({
        problem: null,
        act: open ? act : undefined,
        hint: open ? (act ? 'Enter: change your pick.' : 'Unlocked.') : `Unlocks at ${RANK_NAMES[min]} rank.`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, h / 2, `${RANK_NAMES[min]}: ${label}`, textStyle(17, open ? COLORS.textLight : COLORS.textMuted)).setOrigin(0, 0.5));
          box.add(scene.add.text(w - 12, h / 2, open ? value : '🔒', textStyle(16, open ? RANK_COLOR[min] : COLORS.textMuted)).setOrigin(1, 0.5));
        },
      });
    };
    const cycleEgg = (slot: number) => () => {
      const picks = [...(perk?.eggMoves ?? [])];
      const others = picks.filter((_, i) => i !== slot);
      const choices = usable.filter((id) => !others.includes(id));
      if (choices.length === 0) return;
      picks[slot] = choices[(choices.indexOf(picks[slot] ?? '') + 1) % choices.length]!;
      session.setMasteryPicks(family, { eggMoves: picks });
    };
    unlock('bronze', 'first egg move', perk?.eggMoves[0] ? moveName(perk.eggMoves[0]) : 'none usable yet', usable.length > 1 ? cycleEgg(0) : undefined);
    const choices = abilityChoices(content, p, family);
    unlock('silver', 'Hidden Ability', perk?.abilitySlot !== null && perk?.abilitySlot !== undefined ? abilityName(perk.abilitySlot) : abilityName(-1));
    unlock('gold', 'second egg move', perk?.eggMoves[1] ? moveName(perk.eggMoves[1]) : 'none usable yet', usable.length > 2 ? cycleEgg(1) : undefined);
    unlock('gold', 'choose its ability', perk?.abilitySlot !== null && perk?.abilitySlot !== undefined ? abilityName(perk.abilitySlot) : '—', choices.length > 1 ? () => {
      const at = choices.indexOf(perk?.abilitySlot ?? choices[0]!);
      session.setMasteryPicks(family, { abilitySlot: choices[(at + 1) % choices.length]! });
    } : undefined);
    unlock('master', 'signature move starts awakened', 'its strongest move');
    const inactive = options.filter((o) => !o.active);
    if (inactive.length > 0) {
      rows.push({
        problem: null,
        hint: `Found, not active yet: ${inactive.map((o) => moveName(o.id)).join(', ')}.`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, h / 2, `${inactive.length} egg move${inactive.length === 1 ? '' : 's'} found, not active yet`, textStyle(15, COLORS.textMuted)).setOrigin(0, 0.5));
        },
      });
    }
    this.closePicker();
    this.openPicker({
      title: `${content.species.get(family)!.name} family  ·  ${RANK_NAMES[rank]}`,
      rows,
      columns: 1,
      rowHeight: 54,
      onSelect: (i) => {
        const act = rows[i]!.act;
        if (!act) return;
        act();
        playSfx(this, 'ui.select', 0.5);
        this.openMasteryFamily(family);
      },
      onBack: () => {
        this.closePicker();
        this.openMastery();
      },
    });
  }

  /** Every trainer's quest line; Enter shows its five steps. */
  private openQuests(): void {
    const { session } = services();
    const p = session.profile;
    const trainers = [...session.content.archetypes.values()].filter((a) => session.content.questLines.has(a.id));
    const rows: PickerRow[] = trainers.map((a) => {
      const view = questLineView(session.content, p, a.id)!;
      const done = view.steps.filter((s) => s.status === 'done').length;
      const current = view.steps.find((s) => s.status === 'current');
      return {
        problem: null,
        hint: current ? `Step ${done + 1}: ${current.step.goal}  (${current.progress.current}/${current.progress.target})` : `All five steps done${evolutionUnlocked(p, a.id) ? '. Trainer Evolution unlocked!' : '.'}`,
        draw: (scene, box, w, h) => {
          box.add(trainerVisual(scene, a.spriteAssetId, a.name, 34, h / 2 + 4, 0.7));
          box.add(scene.add.text(76, 8, a.name, textStyle(20)));
          box.add(scene.add.text(76, 34, view.line.name, textStyle(15, COLORS.textMuted)));
          box.add(scene.add.text(w - 12, h / 2, done === 5 ? '★' : `${done}/5`, textStyle(done === 5 ? 24 : 18, done === 5 ? COLORS.gold : COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: 'Trainer Quests',
      rows,
      columns: 2,
      rowHeight: 62,
      onSelect: (i) => this.openQuestLine(trainers[i]!.id),
      onBack: () => this.closePicker(),
    });
  }

  private openQuestLine(trainerId: string): void {
    const { session } = services();
    const view = questLineView(session.content, session.profile, trainerId)!;
    const rows: PickerRow[] = view.steps.map(({ step, status, progress }, i) => ({
      problem: null,
      hint: status === 'done' ? `"${step.story}"  ·  Reward: ${questRewardText(step.reward)}` : `Reward: ${questRewardText(step.reward)}`,
      draw: (scene, box, w, h) => {
        const color = status === 'done' ? COLORS.good : status === 'current' ? COLORS.textLight : COLORS.textMuted;
        box.add(scene.add.text(12, h / 2, `${i + 1}. ${step.goal}`, textStyle(17, color, { wordWrap: { width: w - 90 } })).setOrigin(0, 0.5));
        box.add(scene.add.text(w - 12, h / 2, status === 'done' ? '✓' : status === 'current' ? `${progress.current}/${progress.target}` : '…', textStyle(18, color)).setOrigin(1, 0.5));
      },
    }));
    this.closePicker();
    this.openPicker({
      title: view.line.name,
      rows,
      columns: 1,
      rowHeight: 52,
      onSelect: () => undefined,
      onBack: () => {
        this.closePicker();
        this.openQuests();
      },
    });
  }

  private openArchive(): void {
    const { session } = services();
    const p = session.profile;
    const trainers = [...session.content.archetypes.values()];
    const rows: PickerRow[] = trainers.map((a) => {
      const status = trainerStatus(p, a);
      const problem = status === 'claimable' ? claimProblem(p, a) : null;
      return {
        problem: status === 'claimable' ? problem : null,
        hint: archiveHint(a, status, p.bankCredits),
        draw: (scene, box, w, h) => {
          box.add(trainerVisual(scene, a.spriteAssetId, a.name, 34, h / 2 + 4, 0.7));
          box.add(scene.add.text(76, 8, `${a.name}  ${a.title}`, textStyle(20)));
          const color = status === 'unlocked' ? COLORS.good : status === 'claimable' ? '#f8b048' : COLORS.textMuted;
          box.add(scene.add.text(76, 34, STATUS_LABEL[status] + (status === 'claimable' && a.unlockCost ? `  ·  ${a.unlockCost} credits` : ''), textStyle(16, color)));
          if (a.unlock && status !== 'unlocked') {
            const prog = requirementProgress(p, a.unlock);
            box.add(scene.add.text(w - 12, h / 2, `${prog.current}/${prog.target}`, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
          }
        },
      };
    });
    this.openPicker({
      title: 'Trainer Archive',
      rows,
      columns: 2,
      rowHeight: 62,
      onSelect: (i) => {
        const a = trainers[i]!;
        if (trainerStatus(session.profile, a) !== 'claimable') {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.claimTrainer(a.id);
        playSfx(this, 'se.level_up', 0.6);
        this.restart(`${a.name} joined your Trainer Archive! Choose them when you start a run.`, 'archive');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openLicenses(): void {
    const { session } = services();
    const p = session.profile;
    const licenses = [...session.content.licenses.values()];
    const rows: PickerRow[] = licenses.map((l) => {
      const status = licenseStatus(p, l);
      return {
        problem: null,
        hint: status === 'owned' ? l.description : `${l.description}  ·  ${licenseProblem(p, l) ?? `Enter: buy for ${l.cost} Bank Credits.`}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, l.name, textStyle(20)));
          const color = status === 'owned' ? COLORS.good : COLORS.textMuted;
          box.add(scene.add.text(12, 32, LICENSE_LABEL[status], textStyle(15, color)));
          if (status !== 'owned') box.add(scene.add.text(w - 12, h / 2, `${l.cost} credits`, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: `Bank licenses  ·  ${p.bankCredits} Bank Credits`,
      rows,
      columns: 1,
      rowHeight: 60,
      onSelect: (i) => {
        const l = licenses[i]!;
        if (licenseProblem(session.profile, l)) {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.buyLicense(l.id);
        playSfx(this, 'se.exp', 0.6);
        this.restart(`You bought the ${l.name}. ${l.description}`, 'bank');
      },
      onBack: () => this.closePicker(),
    });
  }

  /** The Starter Laboratory: first the categories of starter sets, then the sets in one. */
  private openLab(): void {
    const { session } = services();
    const p = session.profile;
    const content = session.content;
    const categories = STARTER_POOL_CATEGORIES.filter((c) => [...content.starterPools.values()].some((pool) => pool.category === c));
    const rows: PickerRow[] = categories.map((c) => {
      const pools = [...content.starterPools.values()].filter((pool) => pool.category === c);
      const open = pools.filter((pool) => poolStatus(content, p, pool) === 'unlocked').length;
      const ready = pools.filter((pool) => poolStatus(content, p, pool) === 'buyable').length;
      return {
        problem: null,
        hint: `${POOL_CATEGORY_LABEL[c]}: ${pools.length} starter set${pools.length === 1 ? '' : 's'}.${ready ? `  ${ready} ready to unlock.` : ''}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, h / 2, POOL_CATEGORY_LABEL[c], textStyle(19)).setOrigin(0, 0.5));
          box.add(scene.add.text(w - 12, h / 2, `${open}/${pools.length} unlocked${ready ? `  ·  ${ready} ready` : ''}`, textStyle(16, ready ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: `Starter Laboratory  ·  ${p.researchPoints} Research Points`,
      rows,
      columns: 2,
      rowHeight: 48,
      onSelect: (i) => {
        this.closePicker();
        this.openLabCategory(categories[i]!);
      },
      onBack: () => this.closePicker(),
    });
  }

  private openLabCategory(category: StarterPoolCategory): void {
    const { session } = services();
    const p = session.profile;
    const content = session.content;
    const pools = [...content.starterPools.values()].filter((pool) => pool.category === category);
    const rows: PickerRow[] = pools.map((pool) => {
      const status = poolStatus(content, p, pool);
      const species = eligibleSpecies(content, pool, masteredStarters(content, p));
      const problem = status === 'unlocked' ? null : poolProblem(content, p, pool);
      return {
        problem: null,
        hint: `${pool.description}  ·  ${status === 'buyable' && !problem ? `Enter: unlock for ${pool.researchCost} Research Points.` : (problem ?? `${species.length} species.`)}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, `${pool.name}  ·  ${POOL_LABEL[status]}`, textStyle(19, status === 'unlocked' ? COLORS.good : COLORS.text)));
          species.slice(0, 10).forEach((id, i) => box.add(pokemonIcon(scene, content.species.get(id)!, 24 + i * 40, h - 16, 0.75)));
          if (status !== 'unlocked' && pool.researchCost) box.add(scene.add.text(w - 12, 16, `${pool.researchCost} RP`, textStyle(17, COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: `${POOL_CATEGORY_LABEL[category]}  ·  ${p.researchPoints} Research Points`,
      rows,
      columns: 1,
      rowHeight: 64,
      onSelect: (i) => {
        const pool = pools[i]!;
        if (poolProblem(content, session.profile, pool)) {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.unlockPool(pool.id);
        playSfx(this, 'se.level_up', 0.6);
        this.restart(`The ${pool.name} pool is unlocked. Choose it on the Preparation Desk.`, 'lab');
      },
      onBack: () => {
        this.closePicker();
        this.openLab();
      },
    });
  }

  private openAttributes(): void {
    const { session } = services();
    const content = session.content;
    const a = readAttributes(content, session.profile.attributes);
    const rows: PickerRow[] = ATTRIBUTE_KEYS.map((k) => {
      const [lo, hi] = attributeRange(content, k);
      return {
        problem: null,
        hint: `Grows: ${growthText(content, k)}.  At the maximum: ${attributeEffectText(content, k, isMeter(k) && a[k] < 0 ? lo : hi)}.`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, ATTRIBUTE_LABELS[k], textStyle(19)));
          box.add(scene.add.text(12, 30, a[k] === 0 ? 'No effect yet' : attributeEffectText(content, k, a[k]), textStyle(14, COLORS.textMuted)));
          // A bar: plain attributes fill from the left; meters fill from the middle toward their end.
          const bx = w - 190;
          const bw = 120;
          const g = scene.add.graphics();
          g.fillStyle(0x1d1a24, 1).fillRect(bx, h / 2 - 5, bw, 10);
          g.fillStyle(0x00baf3, 1);
          if (isMeter(k)) {
            const mid = bx + bw / 2;
            const len = (Math.abs(a[k]) / hi) * (bw / 2);
            g.fillRect(a[k] >= 0 ? mid : mid - len, h / 2 - 5, len, 10);
            g.fillStyle(0xf8f8f8, 1).fillRect(mid - 1, h / 2 - 8, 2, 16);
          } else {
            g.fillRect(bx, h / 2 - 5, ((a[k] - lo) / (hi - lo)) * bw, 10);
          }
          box.add(g);
          box.add(scene.add.text(w - 12, h / 2, attributeText(k, a[k]).replace(/^.* /, ''), textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({ title: 'Attributes', rows, columns: 2, rowHeight: 58, onSelect: () => undefined, onBack: () => this.closePicker() });
  }

  private openAchievements(): void {
    const { session } = services();
    const p = session.profile;
    const order = (a: Achievement) => ACHIEVEMENT_CATEGORIES.indexOf(a.category);
    const list = [...session.content.achievements.values()].sort((a, b) => order(a) - order(b));
    const rows: PickerRow[] = list.map((a) => {
      const earned = p.achievements[a.id];
      const secret = a.hidden && !earned;
      const prog = requirementProgress(p, a.requirement);
      return {
        problem: null,
        hint: secret ? 'A hidden achievement. Keep playing to find out what it is.' : `${a.description}  ·  Reward: ${rewardText(a)}${earned ? `  ·  Earned ${earned.earnedAt.slice(0, 10)}` : ''}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, secret ? '???' : a.name, textStyle(19, earned ? COLORS.good : COLORS.text)));
          box.add(scene.add.text(12, 30, CATEGORY_LABEL[a.category], textStyle(14, COLORS.textMuted)));
          box.add(scene.add.text(w - 12, h / 2, earned ? '✓' : secret ? '' : `${prog.current}/${prog.target}`, textStyle(earned ? 26 : 17, earned ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    const titles = p.titles;
    this.openPicker({
      title: `Achievement Hall  ·  ${Object.keys(p.achievements).length}/${list.length}`,
      rows,
      columns: 2,
      rowHeight: 52,
      onSelect: () => {
        // Selecting cycles the title on show through the earned titles.
        if (titles.length === 0) return;
        const next = p.activeTitle === null ? titles[0]! : titles[titles.indexOf(p.activeTitle) + 1] ?? null;
        session.setActiveTitle(next);
        this.restart(next ? `Now showing the title "${next}".` : 'No title on show.', 'achievements');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openHistory(): void {
    const { session } = services();
    const runs = session.profile.runHistory;
    const rows: PickerRow[] = runs.map((r) => ({
      problem: null,
      hint: `Seed ${r.seed}  ·  ${r.encounters} encounters  ·  ${r.badges} badges  ·  +${r.bankCredits} credits, +${r.researchPoints} research${r.achievements.length ? `  ·  ${r.achievements.length} achievements` : ''}`,
      draw: (scene, box, w, h) => {
        box.add(scene.add.text(12, 6, historyLine(r), textStyle(17)));
        r.party.slice(0, 6).forEach((m, i) => {
          const species = session.content.species.get(m.speciesId);
          if (species) box.add(pokemonIcon(scene, species, 24 + i * 44, h - 16, 0.8));
        });
        box.add(scene.add.text(w - 12, h - 18, r.endedAt.slice(0, 10), textStyle(14, COLORS.textMuted)).setOrigin(1, 0.5));
      },
    }));
    this.openPicker({ title: 'Run History', rows, columns: 1, rowHeight: 64, onSelect: () => undefined, onBack: () => this.closePicker() });
  }

  private openSaveData(): void {
    const { session } = services();
    const rows: PickerRow[] = [
      { problem: null, hint: 'Downloads your profile and settings as a .json file.', draw: (scene, box, _w, h) => void box.add(scene.add.text(16, h / 2, 'Export save to a file', textStyle(22)).setOrigin(0, 0.5)) },
      { problem: null, hint: 'Replaces your profile with one from a file. Your current profile is kept as a backup.', draw: (scene, box, _w, h) => void box.add(scene.add.text(16, h / 2, 'Import save from a file', textStyle(22)).setOrigin(0, 0.5)) },
    ];
    this.openPicker({
      title: 'Save data',
      rows,
      columns: 1,
      rowHeight: 56,
      onSelect: (i) => {
        if (i === 0) {
          downloadText(`pkmn-save-${new Date().toISOString().slice(0, 10)}.json`, session.exportSave());
          this.restart('Save exported.', 'save');
        } else {
          pickTextFile((text) => this.restart(session.importSave(text), 'save'));
        }
      },
      onBack: () => this.closePicker(),
    });
  }
}

function historyLine(r: RunRecord): string {
  const { content } = services().session;
  const trainer = content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId;
  const how = r.victory
    ? 'Victory!'
    : r.defeatedBy
      ? `Lost to ${r.defeatedBy.trainer ? `${r.defeatedBy.trainer}'s ` : ''}${content.species.get(r.defeatedBy.speciesId)?.name ?? r.defeatedBy.speciesId} (Lv${r.defeatedBy.level})`
      : 'Ended';
  return `${trainer}  ·  ${r.regionsCleared}/${r.regions} regions  ·  ${how}${r.campaignId !== 'full' ? `  ·  ${r.campaignId}` : ''}`;
}

function rewardText(a: Achievement): string {
  const parts: string[] = [];
  if (a.reward.bankCredits) parts.push(`${a.reward.bankCredits} credits`);
  if (a.reward.researchPoints) parts.push(`${a.reward.researchPoints} research`);
  if (a.reward.candies) parts.push(`${a.reward.candies} candies`);
  if (a.reward.title) parts.push(`title "${a.reward.title}"`);
  return parts.join(', ') || 'bragging rights';
}

function archiveHint(a: Archetype, status: TrainerStatus, credits: number): string {
  const effects = [...a.pros.map((x) => `+ ${x}`), ...a.cons.map((x) => `− ${x}`)].join('  ');
  if (status === 'unlocked') return `${a.description}  ${effects}`;
  if (status === 'comingLater') return `${a.description} Arrives in a later update. Unlock: ${a.unlockText}.`;
  if (status === 'claimable') return `Enter: claim for ${a.unlockCost} Bank Credits (you have ${credits}).  ${effects}`;
  return `Unlock: ${a.unlockText}${a.unlockCost ? `, then ${a.unlockCost} Bank Credits` : ''}.  ${effects}`;
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickTextFile(onText: (text: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void file.text().then(onText);
  };
  input.click();
}

function questRewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.researchPoints) parts.push(`${r.researchPoints} Research Points`);
  if (r.bankCredits) parts.push(`${r.bankCredits} Bank Credits`);
  if (r.candies) parts.push(`${r.candies} candies`);
  if (r.title) parts.push(`title "${r.title}"`);
  if (r.pool) parts.push('a starter set');
  if (r.evolution) parts.push('Trainer Evolution');
  return parts.join(', ') || 'nothing';
}
