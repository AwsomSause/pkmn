// The Out-of-Run hub (GAME_DESIGN.md §14.1): start a run, or visit the Bank
// (and its licenses), Trainer Archive, Achievement Hall, Starter Laboratory,
// Run History and save data. Everything
// here reads and changes the permanent profile only.

import { candyPerkProblem } from '../core/candyShop';
import { researchLines } from '../core/trainerResearch';
import { BANK_MAX_TIER, bankTier, exchangeProblem, nextTier, tierProblem } from '../core/bank';
import { LEGACY, legacySummary, ascend, buyNode, contactProblem, intelLevel, legacyOf, networkSlots, nextPrestige, nodeProblem, nodeStatus, prestigeProblem, prestigeRank, regionBoard, serviceFor, shelfProblem, shelveSeed, toggleContact, trainMove, trainProblem, unshelveSeed } from '../core/legacy';
import { STANDARD_CHOICE } from '../core/rules';
import { decodeSeedCode, encodeSeedCode } from '../core/seedCode';
import { contractBoard, contractDone, contractRewardText } from '../core/contracts';
import Phaser from 'phaser';
import { ATTRIBUTE_LABELS, attributeEffectText, attributeRange, attributeText, growthProgress, growthText, isMeter, readAttributes } from '../core/attributes';
import { ACHIEVEMENT_CATEGORIES, ATTRIBUTE_KEYS, STARTER_POOL_CATEGORIES, type Achievement, type Archetype, type QuestReward, type Species, type StarterPoolCategory } from '../core/contentSchema';
import { claimProblem, requirementParts, requirementProgress, trainerStatus, type TrainerStatus } from '../core/progress';
import { activeGameEvents, durationText, gameRewardText, holidayCalendar, objectiveViews, rewardEarned, upcomingWeekly } from '../core/gameEvents';
import { moveLore, moveRank, topMoves } from '../core/moveMastery';
import { noteOpen, noteProblem, researchNotes } from '../core/researchNotes';
import { collectionSets, MILESTONE_PAY, researchTotals, setProgress } from '../core/collection';
import { arenasOpen, CARD_FRAMES, CRY_THEMES, frameOpen, getFrame, type CardFrame } from '../core/wardrobe';
import { abilityChoices, atLeast, eggMoveOptions, masteredStarters, familyId, familyMembers, familyPerk, familyRank, nextGoal, rankIndex, RANK_BADGES, RANK_NAMES, speciesRank, type MasteryRank } from '../core/mastery';
import { evolutionUnlocked, questLineView, stepsDone } from '../core/quests';
import { eligibleSpecies, licenseProblem, licenseStatus, poolProblem, poolStatus, type LicenseStatus, type PoolStatus } from '../core/runPrep';
import type { Profile, RunRecord } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx, playMusicLazy } from '../ui/audio';
import { onInputAction, type InputAction } from '../ui/input';
import { drawHubProps } from '../ui/hubProps';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { DexInfo } from '../ui/dexInfo';
import { dexState } from '../core/presentation/dexInfo';
import { itemVisual, pokemonIcon, trainerVisual } from '../ui/sprites';
import { loadAssets, preloadPokemon, queueAssets } from '../ui/lazyAssets';
import { ArenaBackdrop, currencyChip, drawLogo, ShowcaseMon } from '../ui/showcase';
import { pokemonAssetIds } from '../assets/catalog';
import { COLORS, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';
import { Menu, paintWindow } from '../ui/widgets';
import { codexEntries, codexTotals } from '../core/story/codex';
import { downloadText, pickTextFile } from '../ui/files';
import { sortTrainers, TRAINER_SORT_KEYS, TRAINER_SORT_LABELS } from '../core/trainerSort';

type Room = 'run' | 'archive' | 'achievements' | 'bank' | 'lab' | 'attributes' | 'history' | 'quests' | 'mastery' | 'research' | 'codex' | 'wardrobe' | 'card' | 'events' | 'fame' | 'tree' | 'prestige' | 'network' | 'museum' | 'intel' | 'moves' | 'seeds' | 'options' | 'save' | 'back';

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
  { room: 'research', label: 'Research Room', blurb: 'Pokédex and form collection sets with Research Point milestones (Enter).' },
  { room: 'codex', label: 'Moment Codex', blurb: 'Every Hyper and Overdrive moment you have discovered across runs (Enter).' },
  { room: 'card', label: 'Trainer Card', blurb: 'Your card: title, frame, runs, wins and badges.' },
  { room: 'wardrobe', label: 'Wardrobe', blurb: 'Choose the title and card frame on your trainer card (Enter).' },
  { room: 'events', label: 'Event Hall', blurb: "This week's event, holiday events, the Contract Board, objectives and rewards (Enter)." },
  { room: 'fame', label: 'Hall of Fame', blurb: 'Champion teams, unusual wins, rare Pokémon, records and Legacy Cards (Enter).' },
  { room: 'tree', label: 'Research Tree', blurb: 'Spend Research Points on small start-of-run perks and deeper intel (Enter).' },
  { room: 'prestige', label: 'Prestige', blurb: 'Rise a rank for a title and more contacts. Nothing you own is ever deleted (Enter).' },
  { room: 'network', label: 'Trainer Network', blurb: 'Trainers you did not pick still send a small parcel when you start a run (Enter).' },
  { room: 'museum', label: 'Item Museum', blurb: 'Every item you ever carried through a run, with Research Point milestones.' },
  { room: 'intel', label: 'Intelligence Board', blurb: 'What you know about each region and its League. Grows with visits and the Tree.' },
  { room: 'moves', label: 'Move Research', blurb: 'Your moves, their mastery, and training with Research Points (Enter).' },
  { room: 'seeds', label: 'Seed Shelf', blurb: 'Keep shared seed codes and start a run from one (Enter).' },
  { room: 'options', label: 'Game settings', blurb: 'Display, audio, gameplay, animations, text and accessibility. The same settings as the title screen.' },
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
  event: 'Event Sets',
  research: 'Research',
  rare: 'Rare',
  challenge: 'Challenge Sets',
  special: 'Special Specimens',
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
  { id: 'settings', label: 'Settings', icon: 'item.scanner', rooms: ['options', 'save', 'back'], blurb: 'Game settings, save data, and the way back to the title screen.' },
  { id: 'trainers', label: 'Trainers', icon: 'item.leaders_crest', rooms: ['archive', 'quests'], blurb: 'Every trainer, how to unlock them, and their quest lines.' },
  { id: 'run', label: 'New Run', icon: 'ball.pb', rooms: ['run'], blurb: ROOMS[0]!.blurb },
  { id: 'history', label: 'Events', icon: 'item.calendar', rooms: ['events', 'history', 'fame', 'codex', 'intel', 'museum', 'seeds'], blurb: "This week's event, past runs, the Hall of Fame, the Moment Codex, the Intelligence Board, the Item Museum and the Seed Shelf." },
  { id: 'unlocks', label: 'Unlocks', icon: 'item.golden_mystic_ticket', rooms: ['achievements', 'bank', 'lab', 'attributes', 'mastery', 'research', 'tree', 'prestige', 'network', 'moves', 'wardrobe'], blurb: 'Achievements, the Bank, the Starter Laboratory, Attributes, Species Mastery, the Research Room and the Wardrobe.' },
];

const ROOM_ICON: Partial<Record<Room, string>> = {
  achievements: 'item.master_ribbon',
  bank: 'item.coin_case',
  lab: 'item.mystery_egg',
  attributes: 'item.exp_charm',
  mastery: 'item.master_ribbon',
  research: 'item.scanner',
  wardrobe: 'item.sachet',
  tree: 'item.dna_splicers',
  prestige: 'item.master_ribbon',
  network: 'item.pair_of_tickets',
  museum: 'item.map',
  intel: 'item.scanner',
  moves: 'item.exp_charm',
  seeds: 'item.mystery_egg',
  events: 'item.calendar',
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
  private dexInfo: DexInfo | null = null;
  private tiles: Tile[] = [];
  private tileIndex = 2;
  /** The page of a tile with several rooms, while it is open; room pages open on top of it. */
  private section: Picker | null = null;
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
    queueAssets(this, ['ui.trainercard', 'ui.dex.seen', 'ui.dex.caught', 'ui.save.bg']);
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    this.archiveOpen = false;
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      if (this.archiveOpen) this.resortArchive(e.shiftKey ? -1 : 1, false);
    });
    this.input.keyboard?.on('keydown-R', () => {
      if (this.archiveOpen) this.resortArchive(0, true);
    });
    const { session } = services();
    session.closeRun();
    this.picker = null;
    this.section = null;
    this.tiles = [];
    playMusicLazy(this, 'bgm.hub');
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
    drawHubProps(this, p, session.settings.battleAnimations);
    this.showcase = new ShowcaseMon(this, GAME_WIDTH / 2, 356, PIXEL_SCALE, 250);

    drawLogo(this, 20, 8, 34, 0, session.settings.battleAnimations);
    let right = GAME_WIDTH - 16;
    right -= currencyChip(this, right, 32, 'item.candy', p.candies, 'Candies') + 8;
    right -= currencyChip(this, right, 32, 'item.dna_splicers', p.researchPoints, 'Research Points') + 8;
    currencyChip(this, right, 32, 'item.coin_case', p.bankCredits, 'Bank Credits');
    const earned = Object.keys(p.achievements).length;
    const card = this.add
      .text(GAME_WIDTH - 16, 62, `${p.activeTitle ? `${p.activeTitle}  ·  ` : ''}Achievements ${earned}/${session.content.achievements.size}  ·  Runs ${p.stats.runsEnded}`, textStyle(16, COLORS.textMuted))
      .setOrigin(1, 0);
    this.drawCardFrame(card, getFrame(p.cardFrame));

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
    if (data.focus !== undefined && TILES[tile]!.rooms.length > 1) this.openSection(TILES[tile]!.rooms.indexOf(room));

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
        if (!this.picker && !this.section) this.focusTile(i);
      });
      zone.on('pointerdown', () => {
        if (this.picker || this.section) return;
        this.focusTile(i, false);
        this.confirmTile();
      });
      root.add(zone);
      this.tiles.push({ root, idle, lit, icon, label, x, w });
      x += w + gap;
    });
  }

  private focusTile(i: number, sound = true): void {
    if (sound && i !== this.tileIndex) playSfx(this, 'ui.cursor', 0.5);
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
    else this.openSection(0);
  }

  /** A tile with several rooms opens its own full page: one card per room, with a Back button. */
  private openSection(focus: number): void {
    const t = TILES[this.tileIndex]!;
    this.section?.close();
    const rows: PickerRow[] = t.rooms.map((room) => {
      const info = ROOMS.find((r) => r.room === room)!;
      const summary = this.roomSummary(room);
      return {
        problem: null,
        hint: info.blurb,
        draw: (scene, box, w, h) => {
          const icon = ROOM_ICON[room];
          if (icon) box.add(itemVisual(scene, icon, 34, h / 2, 1));
          box.add(scene.add.text(66, 8, info.label, textStyle(24, COLORS.textLight)));
          if (summary) box.add(scene.add.text(66, 38, summary, textStyle(16, COLORS.gold, { wordWrap: { width: w - 80 } })));
        },
      };
    });
    this.section = new Picker(this, {
      title: t.label,
      rows,
      columns: 2,
      rowHeight: 68,
      start: Phaser.Math.Clamp(focus, 0, rows.length - 1),
      onSelect: (n) => this.enter(t.rooms[n]!),
      onBack: () => this.closeSection(),
      backLabel: 'back to the Hub',
    });
  }

  private closeSection(): void {
    this.section?.close();
    this.section = null;
  }


  private handle(a: InputAction): void {
    if (this.dexInfo) {
      if (a === 'confirm' || a === 'back') this.dexInfo.close();
      return;
    }
    if (this.picker) {
      this.picker.handle(a);
      return;
    }
    if (this.section) {
      this.section.handle(a);
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

  // ---------- one-line room summaries (shown on the section page) ----------

  private roomSummary(room: Room): string {
    const { session } = services();
    const p = session.profile;
    const c = session.content;
    switch (room) {
      case 'bank':
        return `${p.bankCredits} credits · tier ${bankTier(p)} of ${BANK_MAX_TIER} · ${p.licenses.length}/${c.licenses.size} licenses`;
      case 'archive': {
        const all = [...c.archetypes.values()];
        const ready = all.filter((a) => trainerStatus(p, a) === 'claimable').length;
        return `${all.filter((a) => trainerStatus(p, a) === 'unlocked').length}/${all.length} unlocked${ready ? ` · ${ready} ready to claim` : ''}`;
      }
      case 'lab': {
        const pools = [...c.starterPools.values()];
        return `${pools.filter((pool) => poolStatus(c, p, pool) === 'unlocked').length}/${pools.length} sets unlocked · ${p.researchPoints} RP`;
      }
      case 'achievements':
        return `${Object.keys(p.achievements).length} of ${c.achievements.size} earned`;
      case 'quests': {
        const lines = [...c.questLines.values()];
        return `${lines.filter((l) => stepsDone(c, p, l.trainerId) === l.steps.length).length} of ${lines.length} quest lines finished`;
      }
      case 'events':
        return `${activeGameEvents(c, new Date()).length} events on now`;
      case 'tree':
      case 'prestige':
      case 'network':
      case 'museum':
      case 'intel':
      case 'moves':
      case 'seeds': {
        const lines = legacySummary(c, p, room);
        return (lines[1] ?? lines[0])?.text ?? '';
      }
      case 'research': {
        const t = researchTotals(c, p);
        return `Met ${t.met} · Caught ${t.caught} of ${t.total}`;
      }
      case 'codex': {
        const t = codexTotals(c, p);
        return `${t.found} of ${t.total} moments found`;
      }
      case 'wardrobe':
        return `Title: ${p.activeTitle ?? 'none'} · ${CARD_FRAMES.filter((f) => frameOpen(p, f)).length}/${CARD_FRAMES.length} frames`;
      case 'mastery':
        return `${masteryFamilies(c, p).length} families met`;
      case 'history':
        return p.runHistory.length ? `${p.runHistory.length} runs recorded` : 'No finished runs yet';
      case 'attributes': {
        const a = readAttributes(c, p.attributes);
        return attributeText(ATTRIBUTE_KEYS[0]!, a[ATTRIBUTE_KEYS[0]!]);
      }
      default:
        return '';
    }
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
      case 'research':
        this.openResearch();
        break;
      case 'codex':
        this.openCodex();
        break;
      case 'wardrobe':
        this.openWardrobe();
        break;
      case 'card':
        break;
      case 'events':
        this.openEventHall();
        break;
      case 'fame':
        this.scene.start('HallOfFame');
        break;
      case 'tree':
      case 'prestige':
      case 'network':
      case 'museum':
      case 'intel':
      case 'moves':
      case 'seeds':
        this.openLegacy(room);
        break;
      case 'options':
        this.scene.start('Settings', { from: 'Hub' });
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
    this.picker = new Picker(this, config);
  }

  private closePicker(): void {
    this.archiveOpen = false;
    this.picker?.close();
    this.picker = null;
  }

  /** The game events on now (objectives, rewards, time left), the next weeks' events, and rewards already earned. */
  private openEventHall(): void {
    const { session } = services();
    const content = session.content;
    const p = session.profile;
    const now = new Date();
    const motion = session.settings.battleAnimations;
    const rows: PickerRow[] = [];
    const header = (text: string, color: string, hint: string, bob = false, size = 19) =>
      rows.push({
        problem: null,
        hint,
        draw: (scene, box, w, h) => {
          const t = scene.add.text(12, h / 2, text, textStyle(size, color, { wordWrap: { width: w - 24 } })).setOrigin(0, 0.5);
          box.add(t);
          if (bob && motion === 'full') scene.tweens.add({ targets: t, x: 18, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        },
      });
    for (const a of activeGameEvents(content, now)) {
      const color = a.event.visualTheme.color;
      const from = a.archive ? '  ·  back from the Archive' : '';
      header(`★ ${a.event.name}${from}  ·  ends in ${durationText(a.endsIn)}`, color, `${a.event.description}  Rules: ${a.event.ruleText}`, true);
      for (const v of objectiveViews(p, a.event, a.edition)) {
        rows.push({
          problem: null,
          hint: `Reward: ${gameRewardText(content, v.objective.reward)}${v.claimed ? ' (claimed)' : ''}. Progress counts in runs started while the event is on.`,
          draw: (scene, box, w, h) => {
            box.add(scene.add.text(28, h / 2, `${v.done ? '✓' : '•'} ${v.objective.text}`, textStyle(16, v.done ? COLORS.good : COLORS.textLight)).setOrigin(0, 0.5));
            const g = scene.add.graphics();
            const bw = 140;
            g.fillStyle(0x1d1a24, 1).fillRoundedRect(w - bw - 70, h / 2 - 5, bw, 10, 4);
            g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1).fillRoundedRect(w - bw - 70, h / 2 - 5, Math.max(4, (v.current / v.objective.atLeast) * bw), 10, 4);
            box.add(g);
            box.add(scene.add.text(w - 12, h / 2, `${v.current}/${v.objective.atLeast}`, textStyle(15, COLORS.textMuted)).setOrigin(1, 0.5));
          },
        });
      }
      const earned = rewardEarned(p, a.event.id);
      header(
        earned ? `Repeat reward: ${gameRewardText(content, a.event.fallbackReward)}` : `Reward: ${gameRewardText(content, a.event.reward)}`,
        earned ? COLORS.textMuted : COLORS.gold,
        earned ? 'You already earned this event\'s permanent reward; finishing it again pays the repeat reward.' : 'Finish every objective this week to earn it for good.',
        false,
        15,
      );
    }
    header('Contract Board', COLORS.gold, 'Daily and weekly contracts. Finish one in a single run to be paid once. They rotate at midnight (daily) and on Mondays (weekly), UTC.');
    for (const entry of contractBoard(now)) {
      const done = contractDone(p, entry);
      header(`  ${done ? '✓' : '•'} ${entry.contract.period === 'daily' ? 'Daily' : 'Weekly'}: ${entry.contract.text}  (${contractRewardText(entry.contract.reward)})`, done ? COLORS.good : COLORS.textLight, done ? 'Paid.' : 'Not finished yet. A run that meets it pays it when the run ends.', false, 16);
    }
    const upcoming = upcomingWeekly(content, now, 3);
    if (upcoming.length > 0) header('Coming up', COLORS.textLight, 'Weekly events rotate every Monday (UTC). Each one comes back in a later week.');
    for (const u of upcoming) header(`  ${u.event.name}  ·  in ${durationText(u.startsIn)}`, COLORS.textMuted, `${u.event.description}  Rules: ${u.event.ruleText}`);
    header('Holiday calendar', COLORS.textLight, 'Holiday and themed events come back every year (dates in UTC). Outside its dates, each one also returns from the Event Archive for a week, in turn.');
    for (const c of holidayCalendar(content, now)) {
      const sched = c.event.schedule;
      const dates = sched.kind === 'yearly' ? `${sched.start} to ${sched.end}` : '';
      const when = c.startsIn === 0 ? 'on now' : `in ${durationText(c.startsIn)}`;
      header(`  ${rewardEarned(p, c.event.id) ? '✓' : '•'} ${c.event.name}  ·  ${dates}  ·  ${when}`, c.startsIn === 0 ? c.event.visualTheme.color : COLORS.textMuted, `${c.event.description}  Reward: ${gameRewardText(content, c.event.reward)}`, c.startsIn === 0, 15);
    }
    const archive = [...content.gameEvents.values()].filter((e) => rewardEarned(p, e.id));
    if (archive.length > 0) header(`Earned: ${archive.map((e) => e.name).join(', ')}`, COLORS.good, 'Event rewards you have earned for good.');
    this.openPicker({ title: 'Event Hall', rows, columns: 1, rowHeight: 44, onSelect: () => undefined, onBack: () => this.closePicker() });
  }

  /** The Wardrobe's frame around the trainer card line: a rounded border, and a slow shine on the fancier ones. */
  private drawCardFrame(card: Phaser.GameObjects.Text, frame: CardFrame): void {
    const pad = 6;
    const x = card.x - card.width - pad;
    const y = card.y - pad / 2;
    const w = card.width + pad * 2;
    const h = card.height + pad;
    const color = Phaser.Display.Color.HexStringToColor(frame.color).color;
    const g = this.add.graphics().setDepth(card.depth - 1);
    g.fillStyle(0x14101a, 0.6).fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, color, 1).strokeRoundedRect(x, y, w, h, 8);
    if (!frame.shimmer || services().session.settings.battleAnimations !== 'full') return;
    // A soft glint that glides along the top edge and breathes in and out.
    const glint = this.add.rectangle(x + 10, y + 1, 26, 3, 0xffffff, 0.8).setDepth(card.depth);
    this.tweens.add({ targets: glint, x: x + w - 10, duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    this.tweens.add({ targets: g, alpha: 0.7, duration: 1400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  }

  /** Titles and card frames for the trainer card. Enter puts one on. */
  /** Collection sets (generations and special forms) with their milestones; opening it pays any new milestone. */
  /** One Pokédex set's members with their seen/caught state; Enter opens the species page. */
  private openDexSet(set: { id: string; name: string; members: string[] }): void {
    const { session } = services();
    const rows: PickerRow[] = set.members.map((id) => {
      const sp = session.content.species.get(id)!;
      const state = dexState(session.profile, id);
      return {
        problem: null,
        hint: state === 'unknown' ? 'Not met yet.' : `${sp.name}: ${sp.types.join(' / ')}. Enter opens its page.`,
        draw: (scene, box, _w, h) => {
          if (state !== 'unknown') box.add(pokemonIcon(scene, sp, 30, h / 2, 1));
          const mark = state === 'unknown' ? null : state === 'caught' ? 'ui.dex.caught' : 'ui.dex.seen';
          if (mark && scene.textures.exists(mark)) box.add(scene.add.image(_w - 24, h / 2, mark).setScale(0.6));
          box.add(scene.add.text(64, h / 2, `${String(sp.dex).padStart(4, '0')}  ${state === 'unknown' ? '???' : sp.name}`, textStyle(22, state === 'unknown' ? COLORS.textMuted : COLORS.textLight)).setOrigin(0, 0.5));
        },
      };
    });
    this.closePicker();
    this.openPicker({
      title: set.name,
      rows,
      columns: 2,
      rowHeight: 48,
      onSelect: (i) => {
        this.dexInfo = new DexInfo(this, session.content, session.profile, set.members[i]!, () => {
          this.dexInfo = null;
        });
      },
      onBack: () => {
        this.closePicker();
        this.openResearch();
      },
    });
  }

  private openResearch(): void {
    const { session } = services();
    const paid = session.claimCollections();
    const p = session.profile;
    const motion = session.settings.battleAnimations;
    const rows: PickerRow[] = collectionSets(session.content).map((set) => {
      const prog = setProgress(set, p);
      return {
        problem: null,
        hint: `${prog.caught} of ${set.members.length} caught, ${prog.seen} met. Milestones at 25/50/75/100% pay ${MILESTONE_PAY.join('/')} Research Points once each. Enter opens the Pokédex list.`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, set.name, textStyle(19)));
          // UIE Pokédex marks: caught ball, then seen eye (lazy; shown once loaded).
          const marks = [{ id: 'ui.dex.caught', x: 12, text: `${prog.caught}/${set.members.length} caught` }, { id: 'ui.dex.seen', x: 150, text: `${prog.seen} met` }];
          for (const m of marks) {
            const put = (): void => {
              box.add(scene.add.image(m.x, 40, m.id).setOrigin(0, 0.5).setScale(0.6).setName('dex-mark'));
              box.add(scene.add.text(m.x + 22, 32, m.text, textStyle(14, COLORS.textMuted)));
            };
            if (scene.textures.exists(m.id)) put();
            else {
              box.add(scene.add.text(m.x, 32, m.text, textStyle(14, COLORS.textMuted)));
              void loadAssets(scene, [m.id]);
            }
          }
          const bar = scene.add.graphics();
          const frac = set.members.length ? prog.caught / set.members.length : 0;
          bar.fillStyle(0x0b2a4a, 0.8).fillRoundedRect(w - 220, h / 2 - 7, 200, 14, 7);
          bar.fillStyle(0x6fd0a0, 1).fillRoundedRect(w - 220, h / 2 - 7, Math.max(8, 200 * frac), 14, 7);
          box.add(bar);
          if (motion === 'full') scene.tweens.add({ targets: bar, alpha: 0.8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        },
      };
    });
    const notes = researchNotes(session.content);
    for (const note of notes) {
      const open = noteOpen(p, note.id);
      rows.push({
        problem: open ? null : noteProblem(session.content, p, note.id),
        hint: open ? note.lines.join('  ·  ') : `Enter: buy for ${note.cost} Research Points. Information only.`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, note.name, textStyle(19, open ? COLORS.gold : COLORS.textLight)));
          box.add(scene.add.text(12, 32, open ? note.lines.join(' · ') : `${note.cost} Research Points`, textStyle(14, COLORS.textMuted, { wordWrap: { width: w - 24 } })));
        },
      });
    }
    // Move pages (#107): the moves you have used most, with the lore their rank has opened.
    for (const m of topMoves(p, 12)) {
      const mv = session.content.moves.get(m.moveId);
      if (!mv) continue;
      const lore = moveLore(session.content, m.moveId, m.rank);
      rows.push({
        problem: null,
        hint: lore.length ? lore.join('  ·  ') : `Use it ${10 - m.uses} more times in trainer fights to open its page.`,
        draw: (scene, box, w) => {
          box.add(scene.add.text(12, 6, `Move: ${mv.name}`, textStyle(19, m.rank === 'none' ? COLORS.textLight : COLORS.gold)));
          box.add(scene.add.text(12, 32, `${m.uses} uses · ${m.rank === 'none' ? 'no rank yet' : m.rank}`, textStyle(14, COLORS.textMuted, { wordWrap: { width: w - 24 } })));
        },
      });
    }
    this.openPicker({
      title: paid.length ? `Research Room  ·  +${paid.reduce((n, x) => n + x.researchPoints, 0)} Research Points (${paid.map((x) => `${x.setName} ${x.pct}%`).join(', ')})` : 'Research Room',
      rows,
      columns: 1,
      rowHeight: 58,
      onSelect: (i) => {
        const sets = collectionSets(session.content);
        if (i < sets.length) {
          this.openDexSet(sets[i]!);
          return;
        }
        const note = notes[i - sets.length];
        if (!note || noteOpen(session.profile, note.id)) return;
        try {
          session.buyResearchNote(note.id);
          this.restart(`Bought "${note.name}".`, 'research');
        } catch (err) {
          this.restart(String((err as Error).message), 'research');
        }
      },
      onBack: () => this.closePicker(),
    });
  }

  private openWardrobe(): void {
    const { session } = services();
    const p = session.profile;
    const motion = session.settings.battleAnimations;
    const arenaIds = services().assets.entries().map((e) => e.id).filter((id) => /^bg\.arena\.[a-z_]+$/.test(id)).sort();
    const choices: ({ kind: 'title'; title: string | null } | { kind: 'frame'; frame: CardFrame } | { kind: 'arena'; key: string | null } | { kind: 'cry'; id: string })[] = [
      { kind: 'title', title: null },
      ...p.titles.map((title) => ({ kind: 'title' as const, title })),
      ...CARD_FRAMES.map((frame) => ({ kind: 'frame' as const, frame })),
      { kind: 'arena' as const, key: null },
      ...arenaIds.map((key) => ({ kind: 'arena' as const, key })),
      ...CRY_THEMES.map((t) => ({ kind: 'cry' as const, id: t.id })),
    ];
    const rows: PickerRow[] = choices.map((c) => {
      if (c.kind === 'title') {
        const on = p.activeTitle === c.title;
        return {
          problem: null,
          hint: c.title ? 'A title you earned. Enter shows it on your trainer card.' : 'Show no title.',
          draw: (scene, box, w, h) => {
            box.add(scene.add.text(12, h / 2, `Title: ${c.title ?? 'none'}`, textStyle(17, on ? COLORS.gold : COLORS.textLight)).setOrigin(0, 0.5));
            if (on) box.add(scene.add.text(w - 12, h / 2, 'ON', textStyle(15, COLORS.good)).setOrigin(1, 0.5));
          },
        };
      }
      if (c.kind === 'cry') {
        const theme = CRY_THEMES.find((t) => t.id === c.id)!;
        const open = c.id === 'normal' || arenasOpen(p);
        const on = (p.cryTheme ?? 'normal') === c.id;
        return {
          problem: open ? null : 'Earn a run-end stamp to open the cry themes.',
          hint: open ? 'Pitches every Pokémon cry up or down. Enter picks it.' : 'Locked: earn a run-end stamp.',
          draw: (scene, box, w, h) => {
            box.add(scene.add.text(12, h / 2, `Cry theme: ${theme.name}`, textStyle(17, open ? (on ? COLORS.gold : COLORS.textLight) : COLORS.textMuted)).setOrigin(0, 0.5));
            box.add(scene.add.text(w - 12, h / 2, on ? 'ON' : open ? '' : 'locked', textStyle(14, on ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5));
          },
        };
      }
      if (c.kind === 'arena') {
        const open = c.key === null || arenasOpen(p);
        const on = (p.menuArena ?? null) === c.key;
        const name = c.key === null ? 'Title screen: all arenas' : `Title screen: ${c.key.replace('bg.arena.', '').replaceAll('_', ' ')}`;
        return {
          problem: open ? null : 'Earn a run-end stamp to open the arenas.',
          hint: open ? 'The arena behind the title screen. Enter picks it.' : 'Locked: earn a run-end stamp (win a run, finish untouched...).',
          draw: (scene, box, w, h) => {
            box.add(scene.add.text(12, h / 2, name, textStyle(17, open ? (on ? COLORS.gold : COLORS.textLight) : COLORS.textMuted)).setOrigin(0, 0.5));
            box.add(scene.add.text(w - 12, h / 2, on ? 'ON' : open ? '' : 'locked', textStyle(14, on ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5));
          },
        };
      }
      const open = frameOpen(p, c.frame);
      const on = p.cardFrame === c.frame.id;
      return {
        problem: open ? null : `Not yet: ${c.frame.unlockText}.`,
        hint: open ? `The ${c.frame.name} card frame. Enter puts it on.` : `Locked: ${c.frame.unlockText}.`,
        draw: (scene, box, w, h) => {
          const color = Phaser.Display.Color.HexStringToColor(c.frame.color).color;
          const swatch = scene.add.graphics();
          swatch.lineStyle(3, color, open ? 1 : 0.35).strokeRoundedRect(12, h / 2 - 10, 34, 20, 6);
          box.add(swatch);
          box.add(scene.add.text(58, h / 2, `Frame: ${c.frame.name}`, textStyle(17, open ? (on ? COLORS.gold : COLORS.textLight) : COLORS.textMuted)).setOrigin(0, 0.5));
          const tag = scene.add.text(w - 12, h / 2, on ? 'ON' : open ? '' : c.frame.unlockText, textStyle(14, on ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5);
          box.add(tag);
          // The frame you wear bobs gently (none when motion is reduced or off).
          if (on && motion === 'full') scene.tweens.add({ targets: swatch, y: -3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        },
      };
    });
    this.openPicker({
      title: 'Wardrobe',
      rows,
      columns: 2,
      rowHeight: 44,
      onSelect: (i) => {
        const c = choices[i]!;
        if (c.kind === 'title') {
          session.setActiveTitle(c.title);
          this.restart(c.title ? `Now showing the title "${c.title}".` : 'No title on show.', 'wardrobe');
        } else if (c.kind === 'cry') {
          session.setCryTheme(c.id);
          this.restart(`Cries now use the ${CRY_THEMES.find((t) => t.id === c.id)!.name} theme.`, 'wardrobe');
        } else if (c.kind === 'arena') {
          session.setMenuArena(c.key);
          this.restart(c.key ? 'The title screen now shows that arena.' : 'The title screen cycles through all arenas.', 'wardrobe');
        } else {
          session.setCardFrame(c.frame.id);
          this.restart(`Your card now wears the ${c.frame.name} frame.`, 'wardrobe');
        }
      },
      onBack: () => this.closePicker(),
    });
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
          const frame = RANK_BADGES[rank].frame;
          if (frame !== null) box.add(scene.add.rectangle(30, h / 2 + 2, 46, 46).setStrokeStyle(2, frame));
          box.add(scene.add.text(64, 8, species.name, textStyle(19)));
          box.add(scene.add.text(64, 32, familyMembers(content, f).map((id) => content.species.get(id)!.name).slice(0, 3).join(' → '), textStyle(13, COLORS.textMuted)));
          const medal = scene.add.text(w - 14, h / 2, `${RANK_BADGES[rank].glyph} ${RANK_NAMES[rank]}`.trim(), textStyle(18, RANK_COLOR[rank])).setOrigin(1, 0.5);
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
        playSfx(this, 'ui.cursor', 0.5);
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

  /** True while the Trainer Archive list is open (Tab / R change its sort). */
  private archiveOpen = false;

  private resortArchive(step: number, flip: boolean): void {
    const { session } = services();
    const s = session.settings;
    const n = TRAINER_SORT_KEYS.length;
    const key = TRAINER_SORT_KEYS[(TRAINER_SORT_KEYS.indexOf(s.trainerSort) + n + step) % n]!;
    session.saveSettings({ ...s, trainerSort: key, trainerSortReverse: flip ? !s.trainerSortReverse : s.trainerSortReverse });
    playSfx(this, 'ui.cursor', 0.5);
    this.closePicker();
    this.openArchive();
  }

  private openArchive(): void {
    const { session } = services();
    const p = session.profile;
    const trainers = sortTrainers([...session.content.archetypes.values()], session.settings.trainerSort, p, session.settings.trainerSortReverse);
    const rows: PickerRow[] = trainers.map((a) => {
      const status = trainerStatus(p, a);
      const problem = status === 'claimable' ? claimProblem(p, a) : null;
      return {
        problem: status === 'claimable' ? problem : null,
        hint: `${archiveHint(a, status, p)}  ${researchLines(session.content, p, a).join('  ')}`,
        draw: (scene, box, w, h) => {
          box.add(trainerVisual(scene, a.spriteAssetId, a.name, 34, h / 2 + 4, 0.7));
          box.add(scene.add.text(76, 8, `${a.name}  ${a.title}`, textStyle(20)));
          const color = status === 'unlocked' ? COLORS.good : status === 'claimable' ? '#f8b048' : COLORS.textMuted;
          const stars = a.unlockTier && status !== 'unlocked' ? `  ${'★'.repeat(a.unlockTier)}${'☆'.repeat(5 - a.unlockTier)}` : '';
          box.add(scene.add.text(76, 32, STATUS_LABEL[status] + (status === 'claimable' && a.unlockCost ? `  ·  ${a.unlockCost} credits` : '') + stars, textStyle(16, color)));
          if (a.unlock && status !== 'unlocked') {
            const prog = requirementProgress(p, a.unlock);
            const frac = prog.target > 0 ? prog.current / prog.target : 0;
            const multi = a.unlock.kind === 'all';
            box.add(scene.add.text(w - 12, 20, multi ? `${Math.floor(frac * 100)}%` : `${prog.current}/${prog.target}`, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
            // Progress bar that springs open when the list appears.
            const barW = w - 88 - 12;
            box.add(scene.add.rectangle(76, h - 10, barW, 6, 0x000000, 0.35).setOrigin(0, 0.5));
            if (frac > 0) {
              const fill = scene.add.rectangle(76, h - 10, barW * frac, 6, status === 'claimable' ? 0xf8b048 : 0x58b8f8).setOrigin(0, 0.5).setScale(0, 1);
              box.add(fill);
              scene.tweens.add({ targets: fill, scaleX: 1, duration: 520, ease: 'Back.easeOut', delay: 60 });
            }
          }
        },
      };
    });
    this.openPicker({
      title: `Trainer Archive  ·  Sort: ${TRAINER_SORT_LABELS[session.settings.trainerSort]} ${session.settings.trainerSortReverse ? '▼' : '▲'}  (Tab, R flips)`,
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
    this.archiveOpen = true;
  }

  private openLicenses(): void {
    const { session } = services();
    const p = session.profile;
    const { content } = session;
    const licenses = [...content.licenses.values()].sort((a, b) => a.tier - b.tier);
    const x = content.balance.bank.exchange;
    const next = nextTier(content, p);
    // First the Bank's own services (tier, Exchange Counter), then the licenses.
    const bankServices: { label: string; sub: string; right: string; problem: string | null; run: () => void; notice: string }[] = [
      next
        ? { label: `Bank tier ${bankTier(p)} → ${next.tier}: ${next.name}`, sub: next.blurb, right: `${next.cost} credits`, problem: tierProblem(content, p), run: () => session.buyBankTier(), notice: `The Bank is now tier ${next.tier}: ${next.name}.` }
        : { label: `Bank tier ${bankTier(p)}: top tier`, sub: 'Every Bank service is open.', right: '', problem: 'The Bank is already at its top tier.', run: () => undefined, notice: '' },
      { label: 'Exchange Counter: credits → Research', sub: `${x.credits} credits for ${x.points} Research Points.`, right: bankTier(p) >= 3 ? '' : 'Tier 3', problem: exchangeProblem(content, p, 'toPoints'), run: () => session.exchangeAtBank('toPoints'), notice: `Exchanged ${x.credits} credits for ${x.points} Research Points.` },
      { label: 'Exchange Counter: Research → credits', sub: `${x.backPoints} Research Points for ${x.backCredits} credits.`, right: bankTier(p) >= 3 ? '' : 'Tier 3', problem: exchangeProblem(content, p, 'toCredits'), run: () => session.exchangeAtBank('toCredits'), notice: `Exchanged ${x.backPoints} Research Points for ${x.backCredits} credits.` },
      ...content.balance.candyShop.map((perk) => ({ label: `Candy Shop: ${perk.name}`, sub: perk.description, right: p.candyPerks.includes(perk.id) ? 'Owned' : `${perk.cost} candies`, problem: candyPerkProblem(content, p, perk.id), run: () => session.buyCandyPerk(perk.id), notice: `You bought the ${perk.name}.` })),
    ];
    const serviceRows: PickerRow[] = bankServices.map((s) => ({
      problem: null,
      hint: `${s.sub}  ·  ${s.problem ?? 'Enter: do it.'}`,
      draw: (scene, box, w, _h) => {
        box.add(scene.add.text(12, 6, s.label, textStyle(20)));
        box.add(scene.add.text(12, 32, s.sub, textStyle(15, COLORS.textMuted)));
        if (s.right) box.add(scene.add.text(w - 12, 30, s.right, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
      },
    }));
    const rows: PickerRow[] = [...serviceRows, ...licenses.map((l): PickerRow => {
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
    })];
    this.openPicker({
      title: `Bank  ·  ${p.bankCredits} credits  ·  ${p.candies} candies`,
      rows,
      columns: 1,
      rowHeight: 60,
      onSelect: (i) => {
        if (i < bankServices.length) {
          const s = bankServices[i]!;
          if (s.problem) {
            playSfx(this, 'ui.error', 0.5);
            return;
          }
          s.run();
          playSfx(this, 'se.exp', 0.6);
          this.restart(s.notice, 'bank');
          return;
        }
        const l = licenses[i - bankServices.length]!;
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

  /** The Legacy & Live rooms (core/legacy.ts): one picker each. Rows with a `run` change the profile; the rest only show. */
  private openLegacy(room: Room): void {
    const { session } = services();
    const { content } = session;
    const p = session.profile;
    interface Entry { label: string; sub: string; right?: string; on?: boolean; problem?: string | null; run?: () => string | void; start?: () => void }
    const entries: Entry[] = [];
    const now = new Date().toISOString();
    const apply = (fn: (pr: Profile) => Profile, notice: string): string => {
      session.changeProfile(fn);
      return notice;
    };
    let title = '';
    switch (room) {
      case 'tree':
        title = `Research Tree  ·  ${p.researchPoints} Research Points`;
        for (const n of LEGACY.tree.nodes) {
          const st = nodeStatus(p, n);
          entries.push({ label: `${LEGACY.tree.branches.find((b) => b.id === n.branch)?.name}: ${n.name}`, sub: n.blurb, right: st === 'owned' ? 'Researched' : `${n.cost} RP`, on: st === 'owned', problem: nodeProblem(p, n), run: () => apply((pr) => buyNode(pr, n.id), `Researched ${n.name}. ${n.blurb}`) });
        }
        break;
      case 'prestige': {
        const next = nextPrestige(p);
        title = `Prestige  ·  rank ${prestigeRank(p)} of ${LEGACY.prestige.maxRank}`;
        entries.push(next
          ? { label: `Ascend to ${next.title}`, sub: `Costs ${next.cost} Bank Credits and ${next.regionsCleared} regions cleared in total. Keeps everything you own.`, right: `${next.cost} credits`, problem: prestigeProblem(p), run: () => apply((pr) => ascend(pr, now), `You reached ${next.title}! One more Network contact, and deeper Tree nodes open.`) }
          : { label: 'Top rank reached', sub: 'Nothing more to climb.', on: true });
        break;
      }
      case 'network': {
        title = `Trainer Network  ·  ${legacyOf(p).contacts.length}/${networkSlots(p)} contacts`;
        const contacts = legacyOf(p).contacts;
        const mine = [...content.archetypes.values()].filter((a) => p.unlockedArchetypes.includes(a.id)).sort((a, b) => Number(contacts.includes(b.id)) - Number(contacts.includes(a.id)) || a.name.localeCompare(b.name));
        for (const a of mine) {
          const svc = serviceFor(a.id);
          const on = contacts.includes(a.id);
          entries.push({ label: `${a.name}: ${svc.name}`, sub: svc.blurb, right: on ? 'ON' : '', on, problem: contactProblem(p, a.id), run: () => apply((pr) => toggleContact(pr, a.id), on ? `${a.name} stops sending parcels.` : `${a.name} will send: ${svc.blurb}`) });
        }
        break;
      }
      case 'museum': {
        const seen = legacyOf(p).museum;
        title = `Item Museum  ·  ${seen.length} items`;
        const next = LEGACY.museum.milestones.find((m) => seen.length < m.items);
        entries.push({ label: next ? `Next milestone: ${next.items} items` : 'Every milestone paid', sub: next ? `Pays ${next.research} Research Points once.` : 'The Museum is complete for now.', on: !next });
        for (const id of seen) entries.push({ label: content.items.get(id)?.name ?? content.catalog.get(id)?.name ?? id, sub: content.items.get(id)?.description ?? content.catalog.get(id)?.description ?? '' });
        break;
      }
      case 'intel':
        title = `Regional Intelligence Board  ·  intel level ${intelLevel(p)}`;
        for (const r of content.regions.values()) {
          const b = regionBoard(content, p, r);
          entries.push({ label: `${r.name}  ·  visited ${b.visits}, cleared ${b.clears}`, sub: b.lines.join('   ') });
        }
        break;
      case 'moves': {
        title = `Move Research  ·  ${p.researchPoints} Research Points`;
        const used = Object.entries(p.moveUses ?? {}).sort((a, b) => b[1] - a[1]);
        if (used.length === 0) entries.push({ label: 'No moves used yet', sub: 'Use damaging moves in trainer fights; they show up here.' });
        for (const [id, uses] of used) {
          const rank = moveRank(uses);
          entries.push({ label: `${content.moves.get(id)?.name ?? id}: ${uses} uses (${rank})`, sub: `Train: ${LEGACY.training.researchPerLot} RP for ${LEGACY.training.usesPerLot} uses, up to ${LEGACY.training.maxRank}.`, right: rank === 'none' ? '' : rank, problem: trainProblem(content, p, id), run: () => apply((pr) => trainMove(content, pr, id), `Trained ${content.moves.get(id)?.name ?? id}.`) });
        }
        break;
      }
      case 'seeds': {
        title = `Seed Shelf  ·  ${legacyOf(p).seedShelf.length}/${LEGACY.seedShelf.slots}`;
        const last = p.runHistory[0];
        entries.push({
          label: 'Keep my last run\'s seed',
          sub: last ? `Seed ${last.seed} as ${last.archetypeId}, standard rules.` : 'Finish a run first.',
          problem: last ? shelfProblem(p, encodeSeedCode({ seed: last.seed, archetypeId: last.archetypeId, rules: STANDARD_CHOICE })) : 'Finish a run first.',
          run: () => apply((pr) => shelveSeed(pr, encodeSeedCode({ seed: last!.seed, archetypeId: last!.archetypeId, rules: STANDARD_CHOICE }), `Run ${last!.seed}`, now), 'Seed kept on the shelf.'),
        });
        entries.push({
          label: 'Paste a seed code',
          sub: 'Add a code a friend shared (PR1.…).',
          run: () => {
            const code = window.prompt('Seed code (PR1.…):', '')?.trim();
            if (!code) return;
            const r = decodeSeedCode(code);
            if (!r.ok) return r.reason;
            const problem = shelfProblem(session.profile, code);
            if (problem) return problem;
            return apply((pr) => shelveSeed(pr, code, `Shared ${r.parts.seed}`, now), 'Seed kept on the shelf.');
          },
        });
        for (const s of legacyOf(p).seedShelf) {
          const r = decodeSeedCode(s.code);
          entries.push({
            label: s.label,
            sub: r.ok ? `Seed ${r.parts.seed}, trainer ${r.parts.archetypeId}${r.note ? `. ${r.note}` : ''}` : r.reason,
            right: 'Start',
            problem: r.ok && p.unlockedArchetypes.includes(r.parts.archetypeId) ? null : r.ok ? 'You have not unlocked this seed\'s trainer yet.' : r.reason,
            start: () => {
              if (!r.ok) return;
              if (window.confirm(`Start a run with ${s.label}? (Cancel offers to remove it.)`)) this.scene.start('RunPrep', { archetypeId: r.parts.archetypeId, seed: r.parts.seed, rules: r.parts.rules, notice: r.note ?? 'Shelf seed loaded.' });
              else if (window.confirm('Remove it from the shelf?')) {
                session.changeProfile((pr) => unshelveSeed(pr, s.code));
                this.restart('Seed removed from the shelf.', 'seeds');
              }
            },
          });
        }
        break;
      }
      default:
        return;
    }
    const rows: PickerRow[] = entries.map((e) => ({
      problem: null,
      hint: e.run || e.start ? `${e.sub}  ·  ${e.problem ?? 'Enter: do it.'}` : e.sub,
      draw: (scene, box, w, h) => {
        box.add(scene.add.text(12, 6, e.label, textStyle(18, e.on ? COLORS.good : COLORS.textLight)));
        box.add(scene.add.text(12, 31, e.sub, textStyle(13, COLORS.textMuted, { wordWrap: { width: w - 150 } })));
        if (e.right) box.add(scene.add.text(w - 12, h / 2, e.right, textStyle(16, e.problem && !e.on ? COLORS.textMuted : COLORS.gold)).setOrigin(1, 0.5));
      },
    }));
    this.openPicker({
      title,
      rows,
      columns: 1,
      rowHeight: 56,
      onSelect: (i) => {
        const e = entries[i]!;
        if (e.start) {
          if (e.problem) playSfx(this, 'ui.error', 0.5);
          else e.start();
          return;
        }
        if (!e.run || e.problem) {
          if (e.problem) playSfx(this, 'ui.error', 0.5);
          return;
        }
        const notice = e.run();
        if (notice === undefined) return;
        playSfx(this, 'se.exp', 0.6);
        this.restart(notice, room);
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
        hint: `Grows: ${growthText(content, k)} (now ${growthProgress(content, session.profile, k).join(', ')} toward the next point).  At the maximum: ${attributeEffectText(content, k, isMeter(k) && a[k] < 0 ? lo : hi)}.`,
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

  /** Hyper moment codex: every story moment, found ones named with how often you saw them, the rest hidden. */
  private openCodex(): void {
    const { session } = services();
    const order = ['survival', 'bond', 'emotion', 'rivalry', 'enemy', 'evolution', 'legacy', 'flavour'];
    const entries = codexEntries(session.content, session.profile).sort((a, b) => order.indexOf(a.def.category) - order.indexOf(b.def.category) || a.def.displayName.localeCompare(b.def.displayName));
    const rows: PickerRow[] = entries.map(({ def, seen }) => ({
      problem: null,
      hint: seen > 0 ? (def.messagePool[0] ?? '') : `Not discovered yet (${def.category}).`,
      draw: (scene, box, w, h) => {
        box.add(scene.add.text(12, h / 2, seen > 0 ? def.displayName : '???', textStyle(16, seen > 0 ? def.visualCue.color : COLORS.textMuted)).setOrigin(0, 0.5));
        box.add(scene.add.text(w - 12, h / 2, seen > 0 ? `${def.category} · ×${seen}` : def.category, textStyle(13, COLORS.textMuted)).setOrigin(1, 0.5));
      },
    }));
    const t = codexTotals(session.content, session.profile);
    this.openPicker({ title: `Moment Codex (${t.found}/${t.total})`, rows, columns: 2, rowHeight: 40, onSelect: () => undefined, onBack: () => this.closePicker() });
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
      backdrop: 'ui.save.bg',
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

function archiveHint(a: Archetype, status: TrainerStatus, p: Profile): string {
  const effects = [...a.pros.map((x) => `+ ${x}`), ...a.cons.map((x) => `− ${x}`)].join('  ');
  if (status === 'unlocked') return `${a.description}  ${effects}`;
  if (status === 'comingLater') return `${a.description} Arrives in a later update. Unlock: ${a.unlockText}.`;
  if (status === 'claimable') return `Enter: claim for ${a.unlockCost} Bank Credits (you have ${p.bankCredits}).  ${effects}`;
  const parts = a.unlock ? requirementParts(p, a.unlock).map((x) => `${x.met ? '✓' : '•'} ${x.label}${x.target > 1 ? ` (${x.current.toLocaleString('en-US')}/${x.target.toLocaleString('en-US')})` : ''}`).join('  ') : a.unlockText;
  return `${a.unlockFlavor ? `${a.unlockFlavor}  ` : ''}Challenge: ${parts}${a.unlockCost ? `  Then ${a.unlockCost} Bank Credits.` : ''}  ${effects}`;
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
