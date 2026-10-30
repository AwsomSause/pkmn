// The stage map: 20 numbered levels in columns, ending at the gym leader.
// The player picks one of the next nodes to fight, can stop at a healing spot
// or shop beside the node they're on, and can use the Party and Bag menus.
// After a region's last stage the same screen shows its Pokémon League: one
// straight line of Elite Four members, then the champion.

import Phaser from 'phaser';
import { currentColumn, findNode } from '../core/map';
import { hiddenItemNode, mapItemSummary, repelActive } from '../core/mapItems';
import { fishingOffer, mapActions, mapChoices, mapPreviews, nextGymLeaders, type MapActionKind, type NodePreview } from '../core/run';
import { bossInfo, currentRegion, getCampaign, runLevelCap } from '../core/regions';
import { arenaFor, getTheme } from '../core/themes';
import type { MapNode, SideStop } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { openBagMenu, openPartyMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { onInputAction } from '../ui/input';
import { Picker, speciesRow } from '../ui/partyPanel';
import { itemVisual, pokemonIcon, trainerVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, TYPE_COLORS, mixColor, textStyle } from '../ui/theme';
import { badge, drawPanel, focusFrame } from '../ui/widgets';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';

const COL_SPACING = 104;
const ROW_SPACING = 92;
const MAP_LEFT = 70;
const MAP_MID_Y = 245;
const NODE_RADIUS = 24;

const KIND_STYLE: Record<MapNode['kind'], { color: number; glyph: string; label: string }> = {
  wild: { color: 0x48a860, glyph: 'W', label: 'Wild Pokémon' },
  trainer: { color: 0xd08030, glyph: 'T', label: 'Trainer battle' },
  gym: { color: 0xc03838, glyph: 'G', label: 'Gym Leader' },
  elite: { color: 0x6848b0, glyph: 'E', label: 'Elite Four' },
  champion: { color: 0xd8a020, glyph: 'C', label: 'Champion' },
};
const BOSS_KINDS: readonly MapNode['kind'][] = ['gym', 'elite', 'champion'];
const HARDER_COLOR = 0x9048c8;
const SIDE_STYLE: Record<SideStop['kind'], { color: number; glyph: string }> = {
  heal: { color: 0xe06890, glyph: '+' },
  shop: { color: 0x4878d0, glyph: '$' },
  fish: { color: 0x30a0b8, glyph: '~' },
};
const SIDE_LABEL: Record<SideStop['kind'], string> = { heal: 'Heal', shop: 'Shop', fish: 'Fish' };

/** Something the cursor can land on. */
type Option =
  | { kind: 'node'; node: MapNode }
  | { kind: 'side'; side: SideStop }
  | { kind: 'party' }
  | { kind: 'bag' }
  | { kind: 'items' };

export class MapScene extends Phaser.Scene {
  private options: Option[] = [];
  private cursors: Phaser.GameObjects.Graphics[] = [];
  private index = 0;
  private picker: Picker | null = null;
  private info: Phaser.GameObjects.Text | null = null;
  private notice: Phaser.GameObjects.Text | null = null;
  private busy = false;
  /** What map items show about nodes (Devon Scope, Town Map, Rule Book, Orange Mail). */
  private previews: Record<string, NodePreview> = {};

  constructor() {
    super('Map');
  }

  preload(): void {
    const { session } = services();
    this.previews = session.run?.phase === 'map' ? mapPreviews(session.content, session.run) : {};
    const shown = Object.values(this.previews).flatMap((p) => p.team.flatMap((m) => session.content.species.get(m.speciesId) ?? []));
    // Fishing spots beside the current node: their Pokémon are shown in the picker.
    const run = session.run;
    const here = run?.phase === 'map' && run.stage?.current ? run.stage.map.nodes.find((n) => n.id === run.stage!.current) : undefined;
    for (const side of here?.sides ?? []) {
      if (side.kind === 'fish' && !side.used) shown.push(...fishingOffer(session.content, run!, side.id).flatMap((o) => session.content.species.get(o.speciesId) ?? []));
    }
    preloadPokemon(this, [...partySpecies(), ...shown], { icon: true });
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const stage = run.stage!;
    const theme = getTheme(content, stage.themeId);
    const league = stage.kind === 'league';
    const leader = bossInfo(content, league ? 'champion' : 'gym', stage.leaderId);
    const region = currentRegion(content, run);
    const cap = runLevelCap(content, run);
    this.options = [];
    this.cursors = [];
    this.index = 0;
    this.picker = null;
    this.busy = false;
    playMusic(this, 'bgm.menu');

    // ---------- backdrop: the stage's own arena, dimmed ----------
    const arena = league ? undefined : arenaFor(content, theme);
    const bg = arena && this.textures.exists(arena) ? arena : this.textures.exists('bg.battle') ? 'bg.battle' : null;
    if (bg) {
      this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE).setDepth(-60);
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0e0b12, 0.62).setOrigin(0).setDepth(-55);
    }

    // ---------- header ----------
    drawPanel(this, 8, 6, GAME_WIDTH - 16, 64, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true, alpha: 0.92 });
    const column = currentColumn(stage);
    if (league) {
      this.add.text(24, 12, `${region.name} Pokémon League`, textStyle(28, COLORS.textLight));
      this.add.text(26, 44, `Elite Four, then ${leader.title}  ·  Healed after every battle`, textStyle(16, '#d8d0e0'));
    } else {
      this.add.text(24, 12, `Stage ${stage.index + 1}: ${theme.name}`, textStyle(28, COLORS.textLight));
      let bx = 26;
      for (const type of theme.types) {
        const b = badge(this, bx, 44, type, TYPE_COLORS[type] ?? 0x808080, 14);
        bx += b.width + 6;
      }
      this.add.text(bx + 8, 44, leader.title, textStyle(16, '#d8d0e0'));
    }
    this.add
      .text(GAME_WIDTH - 24, 14, `${region.name}  ·  ${league ? 'Battle' : 'Level'} ${column}/${stage.map.columns}`, textStyle(24, COLORS.textLight))
      .setOrigin(1, 0);
    this.add
      .text(GAME_WIDTH - 24, 44, `₽${run.money}  ·  Badges ${run.badges.length}  ·  Level cap ${cap}`, textStyle(16, '#d8d0e0'))
      .setOrigin(1, 0);

    // ---------- the map (scrolls sideways) ----------
    // A bike chosen from the Items menu changes where the player can go.
    const choices = mapChoices(content, run);
    const hidden = hiddenItemNode(content, run);
    const choiceIds = new Set(choices.map((n) => n.id));
    const mapLayer = this.add.container(0, 0);
    const totalWidth = MAP_LEFT * 2 + (stage.map.columns - 1) * COL_SPACING;
    const focusCol = Math.max(column, 1);
    const scroll = Phaser.Math.Clamp(MAP_LEFT + (focusCol - 1) * COL_SPACING - 300, 0, Math.max(0, totalWidth - GAME_WIDTH));
    mapLayer.x = -scroll;
    const maskShape = this.make.graphics({}, false).fillRect(0, 74, GAME_WIDTH, 346);
    mapLayer.setMask(maskShape.createGeometryMask());

    const widthOf = (col: number) => stage.map.nodes.filter((n) => n.column === col).length;
    const pos = (n: MapNode) => ({
      x: MAP_LEFT + (n.column - 1) * COL_SPACING,
      y: MAP_MID_Y + (n.row - (widthOf(n.column) - 1) / 2) * ROW_SPACING,
    });

    const lines = this.add.graphics();
    mapLayer.add(lines);
    for (const n of stage.map.nodes) {
      const a = pos(n);
      for (const id of n.next) {
        const b = pos(findNode(stage.map, id));
        const walked = stage.visited.includes(n.id) && stage.visited.includes(id);
        const open = n.id === stage.current && choiceIds.has(id);
        // A dark edge under each path, like a drawn route on a town map.
        lines.lineStyle(open ? 11 : 9, 0x181818, 0.9);
        lines.lineBetween(a.x, a.y, b.x, b.y);
        lines.lineStyle(open ? 5 : 3, walked ? 0xf8c030 : open ? 0xf8f8f8 : 0x6b5a73, 1);
        lines.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // Trainer column markers along the bottom.
    for (const col of stage.map.trainerColumns) {
      const x = MAP_LEFT + (col - 1) * COL_SPACING;
      mapLayer.add(this.add.text(x, 402, 'Trainers', textStyle(14, '#f8a850')).setOrigin(0.5));
    }

    for (const n of stage.map.nodes) {
      const { x, y } = pos(n);
      const style = KIND_STYLE[n.kind];
      const visited = stage.visited.includes(n.id);
      const isCurrent = n.id === stage.current;
      const reachable = choiceIds.has(n.id);
      const dim = !visited && !reachable && n.column <= column;
      const isBoss = BOSS_KINDS.includes(n.kind);
      const r = isBoss ? NODE_RADIUS + 6 : NODE_RADIUS;
      const alpha = dim ? 0.35 : visited && !isCurrent ? 0.6 : 1;
      // A pixel token: dark rim, the kind's colour, a lighter top and a darker bottom.
      const g = this.add.graphics();
      g.fillStyle(0x181818, alpha);
      g.fillCircle(x, y + 2, r + 3);
      g.fillStyle(mixColor(style.color, 0x000000, 0.35), alpha);
      g.fillCircle(x, y, r);
      g.fillStyle(style.color, alpha);
      g.fillCircle(x, y - 2, r - 3);
      g.fillStyle(mixColor(style.color, 0xffffff, 0.35), alpha);
      g.fillEllipse(x, y - r * 0.45, r * 1.1, r * 0.5);
      if (n.harder) {
        g.lineStyle(5, HARDER_COLOR, dim ? 0.4 : 1);
        g.strokeCircle(x, y, r + 6);
      }
      mapLayer.add(g);
      if (isCurrent) {
        const ring = this.add.graphics();
        ring.lineStyle(4, 0xffffff, 1);
        ring.strokeCircle(x, y, r + 11);
        mapLayer.add(ring);
        this.tweens.add({ targets: ring, alpha: 0.35, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      // What waits there: a Poké Ball for wild Pokémon, the boss's portrait, or a letter.
      const boss = this.bossFor(n);
      if (n.kind === 'wild' && this.textures.exists('ball.pb')) {
        mapLayer.add(this.add.image(x, y - 1, 'ball.pb').setScale(2).setAlpha(alpha));
      } else if (boss) {
        const art = trainerVisual(this, boss.spriteAssetId, boss.name, x, y + r - 4, 1);
        if (art instanceof Phaser.GameObjects.Sprite) art.setScale(Math.min(1, (r * 2.2) / art.height));
        art.setAlpha(alpha);
        mapLayer.add(art);
      } else {
        mapLayer.add(this.add.text(x, y, style.glyph, textStyle(26, '#ffffff', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5).setAlpha(alpha));
      }
      if (n.harder) mapLayer.add(this.add.text(x + r - 2, y - r + 2, '!', textStyle(22, '#f8f8f8', { stroke: '#5a2890', strokeThickness: 5 })).setOrigin(0.5));
      // Itemfinder: the stop hiding an item.
      if (n.id === hidden && !visited) mapLayer.add(this.add.text(x - r + 2, y - r + 2, '✦', textStyle(22, '#f8e070', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5));
      this.drawPreview(mapLayer, n, x, y, r);
      if (n.row === 0) mapLayer.add(this.add.text(x, 84, String(n.column), textStyle(14, '#a69cb4')).setOrigin(0.5, 0));
      if (league && boss) mapLayer.add(this.add.text(x, y + NODE_RADIUS + 14, boss.name, textStyle(15, COLORS.textLight)).setOrigin(0.5, 0));
      n.sides.forEach((side, i) => {
        const sx = x + NODE_RADIUS + 4 + i * 22;
        const sy = y - NODE_RADIUS - 2;
        const s = SIDE_STYLE[side.kind];
        const sg = this.add.graphics();
        sg.fillStyle(0x181818, side.used ? 0.3 : 1);
        sg.fillRect(sx - 11, sy - 11, 22, 22);
        sg.fillStyle(s.color, side.used ? 0.3 : 1);
        sg.fillRect(sx - 9, sy - 9, 18, 18);
        mapLayer.add(sg);
        mapLayer.add(this.add.text(sx, sy, s.glyph, textStyle(18, '#ffffff', { stroke: '#181818', strokeThickness: 3 })).setOrigin(0.5).setAlpha(side.used ? 0.4 : 1));
      });
      if (reachable) {
        this.addOption({ kind: 'node', node: n }, () => this.ringCursor(mapLayer, x, y, BOSS_KINDS.includes(n.kind) ? NODE_RADIUS + 14 : NODE_RADIUS + 10), {
          x: x - scroll - NODE_RADIUS,
          y: y - NODE_RADIUS,
          w: NODE_RADIUS * 2,
          h: NODE_RADIUS * 2,
        });
      }
    }

    // ---------- bottom panel: info, side stops, party, bag ----------
    drawPanel(this, 8, 424, GAME_WIDTH - 16, 110, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true, alpha: 0.94 });
    run.party.forEach((mon, i) => {
      const species = content.species.get(mon.speciesId)!;
      const x = 40 + i * 52;
      pokemonIcon(this, species, x, 450, 1);
      this.add.text(x, 470, mon.hp <= 0 ? 'FNT' : `Lv${mon.level}`, textStyle(13, mon.hp <= 0 ? '#f08080' : COLORS.textLight)).setOrigin(0.5, 0);
    });
    this.info = this.add.text(24, 492, '', textStyle(17, COLORS.textLight, { wordWrap: { width: 560 } }));

    const buttons: { option: Option; label: string; color: number }[] = [];
    const currentNode = stage.current ? findNode(stage.map, stage.current) : null;
    for (const side of currentNode?.sides ?? []) {
      if (side.kind !== 'shop' && side.used) continue;
      buttons.push({ option: { kind: 'side', side }, label: SIDE_LABEL[side.kind], color: SIDE_STYLE[side.kind].color });
    }
    if (this.itemRows().length > 0) buttons.push({ option: { kind: 'items' }, label: 'Items', color: COLORS.panel });
    buttons.push({ option: { kind: 'party' }, label: 'Party', color: COLORS.panel }, { option: { kind: 'bag' }, label: 'Bag', color: COLORS.panel });
    let x = GAME_WIDTH - 24 - buttons.length * 100 + 4;
    for (const b of buttons) {
      const bxPos = x;
      drawPanel(this, bxPos, 444, 92, 52, { fill: b.color, border: b.color === COLORS.panel ? COLORS.border : mixColor(b.color, 0xffffff, 0.35) });
      this.add.text(bxPos + 46, 470, b.label, textStyle(22, '#ffffff')).setOrigin(0.5);
      this.addOption(b.option, () => this.boxCursor(bxPos, 444, 92, 52), { x: bxPos, y: 444, w: 92, h: 52 });
      x += 100;
    }

    // Without a notice, the corner shows the map items that are working (Repel ×2 · Black Flute...).
    const riding = run.moveMode ? mapActions(content, run).find((a) => a.on) : undefined;
    const working = [riding ? `Riding the ${content.catalog.get(riding.itemId)!.name}` : '', mapItemSummary(content, run)].filter(Boolean).join(' · ');
    this.notice = this.add
      .text(GAME_WIDTH - 24, 506, data.notice ?? (working ? `Working: ${working}` : ''), textStyle(15, '#f0e0a0', { align: 'right', wordWrap: { width: 340 } }))
      .setOrigin(1, 0);
    this.focus(Math.min(data.focus ?? 0, this.options.length - 1), false);

    onInputAction(this, (action) => {
      if (this.picker) {
        this.picker.handle(action);
        return;
      }
      if (this.busy) return;
      const n = this.options.length;
      if (action === 'up' || action === 'left') this.focus((this.index - 1 + n) % n);
      if (action === 'down' || action === 'right') this.focus((this.index + 1) % n);
      if (action === 'confirm') this.activate(this.index);
    });

    if (stage.current === null && !data.notice) {
      const regions = run.regionOrder.length;
      if (league) {
        const size = getCampaign(content, run.campaignId).eliteFourSize;
        this.showBanner(region.name, 'Pokémon League', `Elite Four ×${size}, then ${leader.title}  ·  Healed after every battle`);
      } else if (stage.index === 0) {
        this.showBanner(`Region ${run.regionIndex + 1} of ${regions}`, region.name, `Level cap ${cap}  ·  Stage 1: ${theme.name}  ·  ${leader.title}`);
      } else {
        this.showBanner(`Stage ${stage.index + 1}`, theme.name, `${theme.types.map((t) => t.toUpperCase()).join(' / ')}  ·  ${leader.title}`);
      }
    }
  }

  /** The gym leader, Elite Four member or champion waiting at a node (null for other nodes). */
  private bossFor(n: MapNode) {
    const { session } = services();
    const stage = session.run!.stage!;
    if (n.kind === 'gym') return bossInfo(session.content, 'gym', stage.leaderId);
    if (n.kind === 'champion') return bossInfo(session.content, 'champion', stage.leaderId);
    const id = n.kind === 'elite' ? stage.eliteFour[n.column - 1] : undefined;
    return id ? bossInfo(session.content, 'elite', id) : null;
  }

  private addOption(option: Option, makeCursor: () => Phaser.GameObjects.Graphics, hit: { x: number; y: number; w: number; h: number }): void {
    const index = this.options.length;
    this.options.push(option);
    this.cursors.push(makeCursor());
    const zone = this.add.zone(hit.x, hit.y, hit.w, hit.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => !this.picker && !this.busy && this.focus(index));
    zone.on('pointerdown', () => {
      if (this.picker || this.busy) return;
      this.focus(index);
      this.activate(index);
    });
  }

  private ringCursor(layer: Phaser.GameObjects.Container, x: number, y: number, r: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(5, COLORS.accent, 1);
    g.strokeCircle(x, y, r);
    layer.add(g);
    return g;
  }

  private boxCursor(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    return focusFrame(this, x, y, w, h);
  }

  private describe(option: Option): string {
    const content = services().session.content;
    switch (option.kind) {
      case 'node': {
        const n = option.node;
        const [lo, hi] = content.balance.difficulty.harderBonus;
        const boss = this.bossFor(n);
        const types = boss && boss.types.length > 0 && n.kind !== 'gym' ? ` (${boss.types.join('/')})` : '';
        const kind = boss ? `${boss.title}${types}` : KIND_STYLE[n.kind].label;
        const risk = n.harder ? `  ·  Harder: +${lo}–${hi} enemy levels, better rewards` : '';
        const sides = n.sides.map((s) => (s.kind === 'heal' ? 'healing spot' : s.kind === 'fish' ? 'fishing spot' : 'shop'));
        const seen = this.previewText(n);
        return `${n.kind === 'elite' || n.kind === 'champion' ? 'Battle' : 'Level'} ${n.column}: ${kind}${risk}${sides.length ? `  ·  Has a ${sides.join(' and ')}` : ''}${seen ? `\n${seen}` : ''}`;
      }
      case 'side':
        if (option.side.kind === 'fish') return 'Fishing spot: pick a Water Pokémon to battle and catch (once, no reward draft).';
        return option.side.kind === 'heal' ? 'Healing spot: fully heals your party and restores PP (once).' : 'Shop: buy Poké Balls and medicine with your money.';
      case 'party':
        return 'Choose which Pokémon leads the next battle.';
      case 'bag':
        return 'Use medicine or evolution items on your Pokémon.';
      case 'items':
        return 'Use map items (bikes, Escape Rope, VS Seeker) or check what they show.';
    }
  }

  private focus(i: number, sound = true): void {
    if (i < 0) return;
    if (sound && i !== this.index) playSfx(this, 'ui.select', 0.5);
    this.index = i;
    this.cursors.forEach((c, n) => c.setVisible(n === i));
    const option = this.options[i];
    if (option) this.info?.setText(this.describe(option));
  }

  private fieldHost(): FieldMenuHost {
    return { scene: this, setPicker: (p) => (this.picker = p), changed: (notice) => this.scene.restart({ notice, focus: this.index }) };
  }

  private activate(i: number): void {
    const option = this.options[i];
    if (!option) return;
    const { session } = services();
    switch (option.kind) {
      case 'node': {
        this.busy = true;
        playSfx(this, 'ui.select');
        const repelled = option.node.kind === 'wild' && repelActive(session.content, session.run!);
        const run = session.chooseNode(option.node.id);
        if (repelled && run.phase === 'map') {
          this.scene.restart({ notice: 'The Repel kept wild Pokémon away!', focus: 0 });
          break;
        }
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(260, () => this.scene.start(sceneForRun(run)));
        break;
      }
      case 'side': {
        if (option.side.kind === 'fish') {
          this.openFishing(option.side.id);
          break;
        }
        const message = session.visitSide(option.side.id);
        if (option.side.kind === 'heal') {
          playSfx(this, 'se.level_up', 0.6);
          this.scene.restart({ notice: message, focus: 0 });
        } else {
          this.busy = true;
          this.scene.start(sceneForRun(session.run!));
        }
        break;
      }
      case 'party':
        openPartyMenu(this.fieldHost());
        break;
      case 'bag':
        openBagMenu(this.fieldHost());
        break;
      case 'items':
        this.openItems();
        break;
    }
  }

  /**
   * A small preview beside a node: the wild Pokémon with its level (Devon Scope),
   * the trainer's lead and team size (Town Map), or the gym team (Rule Book, Orange Mail)
   * in a little grid. It sits to the lower right, clear of the cursor ring and the paths.
   */
  private drawPreview(layer: Phaser.GameObjects.Container, n: MapNode, x: number, y: number, r: number): void {
    const preview = this.previews[n.id];
    if (!preview) return;
    const content = services().session.content;
    const label = (lx: number, ly: number, text: string) =>
      layer.add(this.add.text(lx, ly, text, textStyle(13, '#f0e0a0', { stroke: '#181818', strokeThickness: 3 })).setOrigin(0.5, 0));
    if (n.kind === 'gym') {
      // Up to six icons, two columns of three, to the right of the gym leader.
      const team = preview.team.slice(0, 6);
      const rows = Math.min(3, team.length);
      team.forEach((m, i) => {
        const species = content.species.get(m.speciesId);
        if (species) layer.add(pokemonIcon(this, species, x + r + 18 + Math.floor(i / 3) * 30, y + (i % 3 - (rows - 1) / 2) * 30, 0.9));
      });
      return;
    }
    const first = preview.team[0];
    const species = first ? content.species.get(first.speciesId) : undefined;
    if (!first || !species) return;
    const px = x + r + 18;
    layer.add(pokemonIcon(this, species, px, y + 4, 1.2));
    label(px, y + 24, n.kind === 'wild' ? `Lv${first.level}` : `×${preview.team.length}`);
  }

  /** The preview of a node in words, for the info line. */
  private previewText(n: MapNode): string {
    const preview = this.previews[n.id];
    if (!preview) return '';
    const content = services().session.content;
    const item = content.catalog.get(preview.itemId)!.name;
    const names = preview.team.map((m) => `${content.species.get(m.speciesId)?.name ?? m.speciesId}${m.level ? ` Lv${m.level}` : ''}`).join(', ');
    if (n.kind === 'gym') return `${item}: ${preview.team.length === 1 ? 'the ace is' : 'the team is'} ${names}`;
    return `${item}: ${preview.trainerName ? `${preview.trainerName} with ` : ''}${names}`;
  }

  /** Rows of the map Items menu: items to use, then what the Fame Checker and gym previews show. */
  private itemRows(): { action: MapActionKind | null; itemId: string; title: string; text: string; problem: string | null }[] {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const rows: { action: MapActionKind | null; itemId: string; title: string; text: string; problem: string | null }[] = mapActions(content, run).map((a) => ({
      action: a.kind,
      itemId: a.itemId,
      title: `${content.catalog.get(a.itemId)!.name}${a.on ? ' (riding)' : ''}`,
      text: a.on ? 'Choose it again to get off.' : a.text,
      problem: a.on ? null : a.problem,
    }));
    const leaders = nextGymLeaders(content, run);
    if (leaders.length > 0) {
      const text = leaders.map((l) => `${bossInfo(content, 'gym', l.leaderId).name} (${l.types.map((t) => t.toUpperCase()).join('/')})`).join(', ');
      rows.push({ action: null, itemId: 'fame-checker', title: 'Fame Checker', text: `Next gym leaders: ${text}`, problem: `Next gym leaders: ${text}` });
    }
    const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym');
    const gymText = gym ? this.previewText(gym) : '';
    if (gym && gymText) {
      const itemId = this.previews[gym.id]!.itemId;
      const text = `Gym leader ${bossInfo(content, 'gym', run.stage!.leaderId).name}: ${gymText.slice(gymText.indexOf(':') + 2)}`;
      rows.push({ action: null, itemId, title: content.catalog.get(itemId)!.name, text, problem: text });
    }
    return rows;
  }

  /** A fishing spot: pick one of the Pokémon on the line, then battle it. */
  private openFishing(sideId: string): void {
    const { session } = services();
    const content = session.content;
    const offer = fishingOffer(content, session.run!, sideId);
    const picker: Picker = new Picker(this, {
      title: 'Something is biting! Which one?',
      columns: 1,
      rowHeight: 64,
      rows: offer.map((o) => {
        const species = content.species.get(o.speciesId)!;
        const row = speciesRow(species);
        return {
          ...row,
          hint: `${row.hint}  ·  Lv${o.level}`,
          draw: (scene, box, w, h) => {
            row.draw(scene, box, w, h);
            box.add(scene.add.text(w - 16, h / 2, `Lv${o.level}`, textStyle(22)).setOrigin(1, 0.5));
          },
        };
      }),
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.fish(sideId, i);
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(260, () => this.scene.start(sceneForRun(run)));
      },
      onBack: () => {
        picker.close();
        this.picker = null;
      },
    });
    this.picker = picker;
  }

  private openItems(): void {
    const { session } = services();
    const content = session.content;
    const rows = this.itemRows();
    const picker: Picker = new Picker(this, {
      title: 'Map items',
      columns: 1,
      rowHeight: 78,
      rows: rows.map((row) => ({
        problem: row.problem,
        hint: row.text,
        draw: (scene, box, w, h) => {
          const icon = content.rewards.get(`item:${row.itemId}`)?.iconAssetId;
          if (icon) box.add(itemVisual(scene, icon, 26, h / 2, 2));
          box.add(scene.add.text(56, 6, row.title, textStyle(22)));
          box.add(scene.add.text(56, 34, row.text, textStyle(15, '#d8d0e0', { wordWrap: { width: w - 72 } })));
        },
      })),
      onSelect: (i) => {
        const row = rows[i]!;
        picker.close();
        this.picker = null;
        if (!row.action) return;
        playSfx(this, 'ui.select');
        const notice = session.useMapAction(row.action);
        const run = session.run!;
        if (run.phase !== 'map') {
          this.busy = true;
          this.cameras.main.fadeOut(250);
          this.time.delayedCall(260, () => this.scene.start(sceneForRun(run)));
          return;
        }
        this.scene.restart({ notice, focus: 0 });
      },
      onBack: () => {
        picker.close();
        this.picker = null;
      },
    });
    this.picker = picker;
  }

  private showBanner(top: string, title: string, sub: string): void {
    const layer = this.add.container(0, 0).setDepth(80);
    layer.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0));
    // A banner band across the screen, like a Pokémon game's location sign.
    const band = this.add.graphics();
    band.fillStyle(0x181818, 0.95).fillRect(0, 168, GAME_WIDTH, 168);
    band.fillStyle(COLORS.border, 1).fillRect(0, 174, GAME_WIDTH, 6).fillRect(0, 324, GAME_WIDTH, 6);
    layer.add(band);
    layer.add(this.add.text(GAME_WIDTH / 2, 208, top, textStyle(26, COLORS.gold)).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 254, title, textStyle(56, COLORS.textLight)).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 302, sub, textStyle(20, '#d8d0e0')).setOrigin(0.5));
    band.x = -GAME_WIDTH;
    this.tweens.add({ targets: band, x: 0, duration: 260, ease: 'Cubic.easeOut' });
    this.busy = true;
    this.tweens.add({ targets: layer, alpha: 0, delay: 1400, duration: 400, onComplete: () => {
      layer.destroy();
      this.busy = false;
    } });
  }
}
