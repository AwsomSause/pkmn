// The stage map: 20 numbered levels in columns, ending at the gym leader.
// The player picks one of the next nodes to fight, can stop at a healing spot
// or shop beside the node they're on, and can use the Party and Bag menus.
// After a region's last stage the same screen shows its Pokémon League: one
// straight line of Elite Four members, then the champion.

import Phaser from 'phaser';
import { currentColumn, findNode, nextChoices } from '../core/map';
import { mapItemSummary, repelActive } from '../core/mapItems';
import { bossInfo, currentRegion, getCampaign, runLevelCap } from '../core/regions';
import { arenaFor, getTheme } from '../core/themes';
import type { MapNode, SideStop } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { openBagMenu, openPartyMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { onInputAction } from '../ui/input';
import type { Picker } from '../ui/partyPanel';
import { pokemonIcon, trainerVisual } from '../ui/sprites';
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
};

/** Something the cursor can land on. */
type Option =
  | { kind: 'node'; node: MapNode }
  | { kind: 'side'; side: SideStop }
  | { kind: 'party' }
  | { kind: 'bag' };

export class MapScene extends Phaser.Scene {
  private options: Option[] = [];
  private cursors: Phaser.GameObjects.Graphics[] = [];
  private index = 0;
  private picker: Picker | null = null;
  private info: Phaser.GameObjects.Text | null = null;
  private notice: Phaser.GameObjects.Text | null = null;
  private busy = false;

  constructor() {
    super('Map');
  }

  preload(): void {
    preloadPokemon(this, partySpecies(), { icon: true });
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
    const choices = nextChoices(stage);
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
      if (side.kind === 'heal' && side.used) continue;
      buttons.push({ option: { kind: 'side', side }, label: side.kind === 'heal' ? 'Heal' : 'Shop', color: SIDE_STYLE[side.kind].color });
    }
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
    const working = mapItemSummary(content, run);
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
        const sides = n.sides.map((s) => (s.kind === 'heal' ? 'healing spot' : 'shop'));
        return `${n.kind === 'elite' || n.kind === 'champion' ? 'Battle' : 'Level'} ${n.column}: ${kind}${risk}${sides.length ? `  ·  Has a ${sides.join(' and ')}` : ''}`;
      }
      case 'side':
        return option.side.kind === 'heal' ? 'Healing spot: fully heals your party and restores PP (once).' : 'Shop: buy Poké Balls and medicine with your money.';
      case 'party':
        return 'Choose which Pokémon leads the next battle.';
      case 'bag':
        return 'Use medicine or evolution items on your Pokémon.';
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
    }
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
