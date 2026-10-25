// The stage map: 20 numbered levels in columns, ending at the gym leader.
// The player picks one of the next nodes to fight, can stop at a healing spot
// or shop beside the node they're on, and can use the Party and Bag menus.
// After a region's last stage the same screen shows its Pokémon League: one
// straight line of Elite Four members, then the champion.

import Phaser from 'phaser';
import { currentColumn, findNode, nextChoices } from '../core/map';
import { bossInfo, currentRegion, getCampaign, runLevelCap } from '../core/regions';
import { getTheme } from '../core/themes';
import type { MapNode, SideStop } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { openBagMenu, openPartyMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { onInputAction } from '../ui/input';
import type { Picker } from '../ui/partyPanel';
import { pokemonIcon } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TYPE_COLORS, textStyle } from '../ui/theme';
import { badge, drawPanel } from '../ui/widgets';
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

    // ---------- header ----------
    drawPanel(this, 8, 6, GAME_WIDTH - 16, 64, { fill: COLORS.panelDark, border: 0x101420 });
    const column = currentColumn(stage);
    if (league) {
      this.add.text(24, 12, `${region.name} Pokémon League`, textStyle(28, COLORS.textLight));
      this.add.text(26, 44, `Elite Four, then ${leader.title}  ·  Healed after every battle`, textStyle(16, '#c8d0e0'));
    } else {
      this.add.text(24, 12, `Stage ${stage.index + 1}: ${theme.name}`, textStyle(28, COLORS.textLight));
      let bx = 26;
      for (const type of theme.types) {
        const b = badge(this, bx, 44, type, TYPE_COLORS[type] ?? 0x808080, 14);
        bx += b.width + 6;
      }
      this.add.text(bx + 8, 44, leader.title, textStyle(16, '#c8d0e0'));
    }
    this.add
      .text(GAME_WIDTH - 24, 14, `${region.name}  ·  ${league ? 'Battle' : 'Level'} ${column}/${stage.map.columns}`, textStyle(24, COLORS.textLight))
      .setOrigin(1, 0);
    this.add
      .text(GAME_WIDTH - 24, 44, `₽${run.money}  ·  Badges ${run.badges.length}  ·  Level cap ${cap}`, textStyle(16, '#c8d0e0'))
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
        lines.lineStyle(open ? 5 : 3, walked ? 0xf0c028 : open ? 0xf8f8f8 : 0x48506a, 1);
        lines.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    // Trainer column markers along the bottom.
    for (const col of stage.map.trainerColumns) {
      const x = MAP_LEFT + (col - 1) * COL_SPACING;
      mapLayer.add(this.add.text(x, 400, 'trainers', textStyle(13, '#d08030')).setOrigin(0.5));
    }

    for (const n of stage.map.nodes) {
      const { x, y } = pos(n);
      const style = KIND_STYLE[n.kind];
      const visited = stage.visited.includes(n.id);
      const isCurrent = n.id === stage.current;
      const reachable = choiceIds.has(n.id);
      const dim = !visited && !reachable && n.column <= column;
      const g = this.add.graphics();
      g.fillStyle(style.color, dim ? 0.3 : visited && !isCurrent ? 0.55 : 1);
      g.fillCircle(x, y, BOSS_KINDS.includes(n.kind) ? NODE_RADIUS + 6 : NODE_RADIUS);
      if (n.harder) {
        g.lineStyle(5, HARDER_COLOR, dim ? 0.4 : 1);
        g.strokeCircle(x, y, NODE_RADIUS + 4);
      }
      if (isCurrent) {
        g.lineStyle(4, 0xffffff, 1);
        g.strokeCircle(x, y, NODE_RADIUS + 9);
      }
      mapLayer.add(g);
      mapLayer.add(this.add.text(x, y, n.harder ? `${style.glyph}!` : style.glyph, textStyle(22, '#ffffff')).setOrigin(0.5));
      if (n.row === 0) mapLayer.add(this.add.text(x, 84, String(n.column), textStyle(14, '#8090a8')).setOrigin(0.5, 0));
      const boss = this.bossFor(n);
      if (league && boss) mapLayer.add(this.add.text(x, y + NODE_RADIUS + 14, boss.name, textStyle(15, COLORS.textLight)).setOrigin(0.5, 0));
      n.sides.forEach((side, i) => {
        const sx = x + NODE_RADIUS + 4 + i * 22;
        const sy = y - NODE_RADIUS - 2;
        const s = SIDE_STYLE[side.kind];
        const sg = this.add.graphics();
        sg.fillStyle(s.color, side.used ? 0.3 : 1);
        sg.fillRoundedRect(sx - 9, sy - 9, 18, 18, 4);
        mapLayer.add(sg);
        mapLayer.add(this.add.text(sx, sy, s.glyph, textStyle(14, '#ffffff')).setOrigin(0.5));
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
    drawPanel(this, 8, 424, GAME_WIDTH - 16, 110, { fill: COLORS.panelDark, border: 0x101420 });
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
      drawPanel(this, bxPos, 444, 92, 52, { fill: b.color });
      this.add.text(bxPos + 46, 470, b.label, textStyle(22, b.color === COLORS.panel ? COLORS.text : '#ffffff')).setOrigin(0.5);
      this.addOption(b.option, () => this.boxCursor(bxPos, 444, 92, 52), { x: bxPos, y: 444, w: 92, h: 52 });
      x += 100;
    }

    this.notice = this.add.text(GAME_WIDTH - 24, 506, data.notice ?? '', textStyle(15, '#f0e0a0', { align: 'right', wordWrap: { width: 340 } })).setOrigin(1, 0);
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
    const g = this.add.graphics();
    g.lineStyle(5, COLORS.accent, 1);
    g.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 10);
    return g;
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
        const run = session.chooseNode(option.node.id);
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
    layer.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0));
    layer.add(this.add.text(GAME_WIDTH / 2, 200, top, textStyle(26, '#c8d0e0')).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 250, title, textStyle(48, COLORS.textLight)).setOrigin(0.5));
    layer.add(this.add.text(GAME_WIDTH / 2, 300, sub, textStyle(20, '#c8d0e0')).setOrigin(0.5));
    this.busy = true;
    this.tweens.add({ targets: layer, alpha: 0, delay: 1400, duration: 400, onComplete: () => {
      layer.destroy();
      this.busy = false;
    } });
  }
}
