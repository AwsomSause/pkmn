// The stage map: 20 numbered levels in columns, ending at the gym leader.
// The player picks one of the next nodes to fight, can stop at a healing spot
// or shop beside the node they're on, and can use the Party and Bag menus.
// After a region's last stage the same screen shows its Pokémon League: one
// straight line of Elite Four members, then the champion.

import { licenseName, licenseNote } from '../core/license';
import { SERVICES } from '../core/services/schema';
import { stopIsHidden } from '../core/events';
import Phaser from 'phaser';
import { pinnedObjective } from '../core/objectives';
import { currentColumn, findNode } from '../core/map';
import { runPerks } from '../core/archetypes';
import { boxCapacity } from '../core/trainerPerks';
import { hiddenItemNode, mapItemSummary, repelActive } from '../core/mapItems';
import { expeditionPreview } from '../core/expedition/flow';
import { minigamePreview } from '../core/minigame/flow';
import { ROUTE_LABELS, routeKind } from '../core/campaign/director';
import { fishingOffer, raidPreview, totemPreview, mapActions, mapChoices, mapPreviews, nextGymLeaders, type MapActionKind, type NodePreview } from '../core/run';
import { bossInfo, currentRegion, getCampaign, runLevelCap } from '../core/regions';
import { blindMap } from '../core/rules';
import { arenaFor, getTheme } from '../core/themes';
import type { MapNode, SideStop } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { openBondMenu } from '../ui/bondMenu';
import { openSummaryMenu } from '../ui/summaryMenu';
import { openBagMenu, openBoxMenu, openPartyMenu, openStoryMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { onInputAction } from '../ui/input';
import { Picker, speciesRow } from '../ui/partyPanel';
import { itemVisual, pokemonIcon, trainerVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, TYPE_COLORS, mixColor, textStyle } from '../ui/theme';
import { badge, focusFrame } from '../ui/widgets';
import { AERO, drawGlass, glassPanel as drawPanel, type MotionLevel } from '../ui/aero';
import { addAmbience } from '../ui/battleFx/ambience';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon, queueAssets } from '../ui/lazyAssets';
import { eggStatus } from '../core/eggs';

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
  raid: { color: 0xd04040, glyph: 'R' },
  totem: { color: 0xe8a020, glyph: 'T' },
  event: { color: 0xd89830, glyph: '!' },
  expedition: { color: 0x38b878, glyph: 'E' },
  minigame: { color: 0x58c0e8, glyph: 'G' },
  service: { color: 0xa878e0, glyph: 'S' },
};
const SIDE_LABEL: Record<SideStop['kind'], string> = { heal: 'Heal', shop: 'Shop', fish: 'Fish', raid: 'Raid', totem: 'Totem', event: 'Event', expedition: 'Expedition', minigame: 'Minigame', service: 'Service' };
/** A hidden event stop: a grey "?" until you reach it. */
const HIDDEN_STYLE = { color: 0x6b5a73, glyph: '?' };

const serviceReusable = (side: SideStop): boolean => SERVICES.services.find((x) => x.id === side.serviceId)?.reusable === true;

/** Something the cursor can land on. */
type Option =
  | { kind: 'node'; node: MapNode }
  | { kind: 'side'; side: SideStop }
  | { kind: 'party' }
  | { kind: 'bag' }
  | { kind: 'items' }
  | { kind: 'story' }
  | { kind: 'bond' }
  | { kind: 'summary' }
  | { kind: 'box' };

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
  /** Where each node is drawn inside the scrolling map layer (for the travel animation). */
  private nodePos = new Map<string, { x: number; y: number }>();
  private mapLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Map');
  }

  private get motion(): MotionLevel {
    return services().session.settings.battleAnimations;
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
    if (run?.eggs.length) queueAssets(this, ['pack.ebdx.egg']);
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
      const back = this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE).setDepth(-60);
      // Parallax: the scenery drifts slowly behind the map (presentation only).
      if (this.motion === 'full' && back.displayWidth > GAME_WIDTH) {
        this.tweens.add({ targets: back, x: GAME_WIDTH - back.displayWidth, duration: 40_000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06152a, 0.58).setOrigin(0).setDepth(-55);
    }
    // The stage's types drift over it (leaves, embers, bubbles...), like the battle arena.
    const air = this.add.container(0, 0).setDepth(-50);
    addAmbience(this, air, 0, league || blindMap(run.rules) ? ['dragon'] : theme.types, this.motion);

    // ---------- header ----------
    drawPanel(this, 8, 6, GAME_WIDTH - 16, 64, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true, alpha: 0.92 });
    const column = currentColumn(stage);
    if (league) {
      this.add.text(24, 12, `${region.name} Pokémon League`, textStyle(28, COLORS.textLight));
      this.add.text(26, 44, `Elite Four, then ${leader.title}  ·  Healed after every battle`, textStyle(16, '#d8d0e0'));
    } else {
      const blind = blindMap(run.rules);
      this.add.text(24, 12, `Stage ${stage.index + 1}: ${blind ? '???' : theme.name}`, textStyle(28, COLORS.textLight));
      let bx = 26;
      for (const type of blind ? [] : theme.types) {
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

    const pinned = pinnedObjective(content, run);
    if (pinned) this.add.text(GAME_WIDTH - 24, 66, `★ ${pinned.text} (${pinned.current}/${pinned.target})`, textStyle(14, '#f0e0a0')).setOrigin(1, 0);

    // ---------- the map (scrolls sideways) ----------
    // A bike chosen from the Items menu changes where the player can go.
    const choices = mapChoices(content, run);
    const hidden = hiddenItemNode(content, run);
    const choiceIds = new Set(choices.map((n) => n.id));
    const mapLayer = this.add.container(0, 0);
    this.mapLayer = mapLayer;
    this.nodePos = new Map();
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
    const openPaths: [{ x: number; y: number }, { x: number; y: number }][] = [];
    // The boss column: a glowing band behind the gym leader (or each League battle).
    for (const n of stage.map.nodes.filter((m) => BOSS_KINDS.includes(m.kind))) {
      const bx = pos(n).x;
      const band = drawGlass(this, bx - 46, 98, 92, 300, { tint: KIND_STYLE[n.kind].color, rim: mixColor(KIND_STYLE[n.kind].color, 0xffffff, 0.4), alpha: 0.28, radius: 24 });
      mapLayer.addAt(band, 0);
      if (this.motion === 'full') this.tweens.add({ targets: band, alpha: 0.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    for (const n of stage.map.nodes) {
      const a = pos(n);
      for (const id of n.next) {
        const b = pos(findNode(stage.map, id));
        const walked = stage.visited.includes(n.id) && stage.visited.includes(id);
        const open = n.id === stage.current && choiceIds.has(id);
        // A dark edge under each path, like a drawn route on a town map.
        lines.lineStyle(open ? 11 : 9, 0x181818, 0.9);
        lines.lineBetween(a.x, a.y, b.x, b.y);
        lines.lineStyle(open ? 5 : 3, walked ? 0xf8c030 : open ? 0xf8f8f8 : 0x5a6f8a, 1);
        lines.lineBetween(a.x, a.y, b.x, b.y);
        if (open) openPaths.push([a, b]);
      }
    }
    // Open paths glow, and little lights travel along them toward the choices.
    const glow = this.add.graphics().setBlendMode('ADD');
    mapLayer.add(glow);
    for (const [a, b] of openPaths) {
      glow.lineStyle(12, AERO.rim, 0.18);
      glow.lineBetween(a.x, a.y, b.x, b.y);
      if (this.motion !== 'full') continue;
      for (let k = 0; k < 2; k++) {
        const spark = this.add.circle(a.x, a.y, 4, AERO.white, 0.95).setBlendMode('ADD');
        mapLayer.add(spark);
        this.tweens.add({ targets: spark, x: b.x, y: b.y, alpha: { from: 1, to: 0.2 }, duration: 1300, delay: k * 650, repeat: -1, ease: 'Sine.easeIn' });
      }
    }

    // Trainer column markers along the bottom.
    for (const col of stage.map.trainerColumns) {
      const x = MAP_LEFT + (col - 1) * COL_SPACING;
      mapLayer.add(this.add.text(x, 402, 'Trainers', textStyle(14, '#f8a850')).setOrigin(0.5));
    }

    for (const n of stage.map.nodes) {
      const { x, y } = pos(n);
      this.nodePos.set(n.id, { x, y });
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
      if (reachable) {
        // A soft halo that breathes under each node you can travel to.
        const halo = this.add.circle(x, y, r + 8, AERO.sky, 0.35).setBlendMode('ADD');
        mapLayer.addAt(halo, mapLayer.getIndex(g));
        if (this.motion === 'full') this.tweens.add({ targets: halo, scale: 1.25, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: n.row * 150 });
      }
      if (visited && !isCurrent) mapLayer.add(this.add.text(x + r - 4, y + r - 6, '✓', textStyle(18, '#8cf070', { stroke: '#0b2a4a', strokeThickness: 4 })).setOrigin(0.5));
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
        const s = side.kind === 'event' && stopIsHidden(content, run, n, side) ? HIDDEN_STYLE : SIDE_STYLE[side.kind];
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
    // Eggs ride along after the party, rocking gently; the soonest-to-hatch one wobbles hardest.
    run.eggs.forEach((egg, i) => {
      const x = 40 + (run.party.length + i) * 52;
      if (this.textures.exists('pack.ebdx.egg')) {
        const icon = this.add.image(x, 452, 'pack.ebdx.egg').setScale(1.2).setOrigin(0.5, 0.8);
        this.tweens.add({ targets: icon, angle: { from: -4 - (egg.left <= 1 ? 8 : 0), to: 4 + (egg.left <= 1 ? 8 : 0) }, duration: egg.left <= 1 ? 260 : 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });
      }
      this.add.text(x, 470, `${egg.left}${egg.unit === 'battle' ? 'B' : 'S'}`, textStyle(13, '#fff2b0')).setOrigin(0.5, 0);
    });
    this.info = this.add.text(24, 492, '', textStyle(17, COLORS.textLight, { wordWrap: { width: 560 } }));

    const buttons: { option: Option; label: string; color: number }[] = [];
    const currentNode = stage.current ? findNode(stage.map, stage.current) : null;
    for (const side of currentNode?.sides ?? []) {
      if (side.kind !== 'shop' && side.used && !(side.kind === 'service' && serviceReusable(side))) continue;
      buttons.push({ option: { kind: 'side', side }, label: SIDE_LABEL[side.kind], color: SIDE_STYLE[side.kind].color });
    }
    if (this.itemRows().length > 0) buttons.push({ option: { kind: 'items' }, label: 'Items', color: COLORS.panel });
    if (boxCapacity(runPerks(content, services().session.run!)) > 0) buttons.push({ option: { kind: 'box' }, label: 'PC', color: COLORS.panel });
    buttons.push({ option: { kind: 'party' }, label: 'Party', color: COLORS.panel }, { option: { kind: 'bag' }, label: 'Bag', color: COLORS.panel }, { option: { kind: 'bond' }, label: 'Bonds', color: COLORS.panel }, { option: { kind: 'story' }, label: 'Story', color: COLORS.panel }, { option: { kind: 'summary' }, label: 'Summary', color: COLORS.panel });
    // Narrower buttons when there are many, so they never run into the info line.
    const bw = buttons.length > 7 ? Math.max(76, Math.floor((GAME_WIDTH - 48) / buttons.length) - 8) : 92;
    let x = GAME_WIDTH - 24 - buttons.length * (bw + 8) + 4;
    for (const b of buttons) {
      const bxPos = x;
      drawGlass(this, bxPos, 444, bw, 52, { tint: b.color === COLORS.panel ? AERO.glass : mixColor(b.color, 0x000000, 0.25), rim: b.color === COLORS.panel ? AERO.rim : mixColor(b.color, 0xffffff, 0.45), radius: 16, alpha: 0.95 });
      this.add.text(bxPos + bw / 2, 470, b.label, textStyle(b.label.length > 6 || bw < 92 ? 16 : 22, '#ffffff')).setOrigin(0.5);
      this.addOption(b.option, () => this.boxCursor(bxPos, 444, bw, 52), { x: bxPos, y: 444, w: bw, h: 52 });
      x += bw + 8;
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
        this.showBanner(`Region ${run.regionIndex + 1} of ${regions}`, region.name, `Level cap ${cap}  ·  Stage 1: ${blindMap(run.rules) ? '???' : theme.name}  ·  ${leader.title}`);
      } else {
        this.showBanner(`Stage ${stage.index + 1}`, blindMap(run.rules) ? '???' : theme.name, `${blindMap(run.rules) ? 'Blind Research' : theme.types.map((t) => t.toUpperCase()).join(' / ')}  ·  ${leader.title}`);
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

  /**
   * The travelling highlight: a glowing token hops from where you stand to the chosen node.
   * Presentation only (the choice is already made). Returns how long to wait before leaving.
   */
  private travel(node: MapNode): number {
    const layer = this.mapLayer;
    const to = this.nodePos.get(node.id);
    if (this.motion !== 'full' || !layer || !to) return 0;
    const stage = services().session.run!.stage!;
    const from = (stage.current && this.nodePos.get(stage.current)) || { x: to.x - COL_SPACING, y: to.y };
    const orb = this.add.circle(from.x, from.y, 9, AERO.white, 1).setBlendMode('ADD');
    const aura = this.add.circle(from.x, from.y, 16, AERO.rim, 0.45).setBlendMode('ADD');
    layer.add([aura, orb]);
    const hop = { t: 0 };
    this.tweens.add({
      targets: hop,
      t: 1,
      duration: 380,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = from.x + (to.x - from.x) * hop.t;
        const y = from.y + (to.y - from.y) * hop.t - Math.sin(hop.t * Math.PI) * 34;
        orb.setPosition(x, y);
        aura.setPosition(x, y);
      },
      onComplete: () => {
        const ring = this.add.circle(to.x, to.y, NODE_RADIUS, AERO.rim, 0).setStrokeStyle(4, AERO.white, 1);
        layer.add(ring);
        this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
      },
    });
    return 420;
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
    const g = this.add.graphics({ x, y });
    g.lineStyle(10, AERO.rim, 0.3);
    g.strokeCircle(0, 0, r + 2);
    g.lineStyle(4, AERO.white, 1);
    g.strokeCircle(0, 0, r);
    layer.add(g);
    if (this.motion === 'full') this.tweens.add({ targets: g, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
        const risk = n.harder ? `  ·  Risk: high (+${lo}–${hi} enemy levels, better rewards)` : boss ? '  ·  Risk: boss' : '';
        const sides = n.sides.map((s) => (s.kind === 'heal' ? 'healing spot' : s.kind === 'fish' ? 'fishing spot' : s.kind === 'raid' ? 'raid den' : s.kind === 'totem' ? 'Totem territory' : s.kind === 'expedition' ? 'expedition gate' : s.kind === 'service' ? (SERVICES.services.find((x) => x.id === s.serviceId)?.name ?? 'service') : s.kind === 'event' ? (stopIsHidden(content, services().session.run!, n, s) ? 'mystery "?" stop' : `${content.events.get(s.eventId ?? '')?.name ?? 'event'} stop`) : 'shop'));
        const seen = this.previewText(n);
        const route = routeKind(services().session.run!, n);
        return `${route ? `[${ROUTE_LABELS[route]}]\n` : ''}${n.kind === 'elite' || n.kind === 'champion' ? 'Battle' : 'Level'} ${n.column}: ${kind}${risk}${sides.length ? `  ·  Has a ${sides.join(' and ')}` : ''}${seen ? `\n${seen}` : ''}`;
      }
      case 'side':
        if (option.side.kind === 'service') {
          const def = SERVICES.services.find((x) => x.id === option.side.serviceId);
          return `${def?.name ?? 'Service'}: ${def?.blurb ?? ''}`;
        }
        if (option.side.kind === 'expedition') return option.side.used ? 'Expedition gate: already used.' : 'Expedition gate: a branching adventure with its own party rules. Loot is kept when you extract. You never lose your own Pokémon.';
        if (option.side.kind === 'totem') return option.side.used ? 'Totem territory: already fought.' : 'Totem territory: a guardian with an aura, allies and phases. Losing never ends your run.';
        if (option.side.kind === 'raid') return option.side.used ? 'Raid den: already fought.' : 'Raid den: a boss with shields and phases. See its tier and rewards before you commit.';
        if (option.side.kind === 'fish') return 'Fishing spot: pick a Water Pokémon to battle and catch (once, no reward draft).';
        if (option.side.kind === 'event') {
          const e = content.events.get(option.side.eventId ?? '');
          return `${e?.name ?? 'Event'}: ${e?.intro ?? ''}`;
        }
        return option.side.kind === 'heal' ? 'Healing spot: fully heals your party and restores PP (once).' : 'Shop: buy Poké Balls and medicine with your money.';
      case 'party':
        return ['Choose which Pokémon leads the next battle.', ...services().session.run!.eggs.map((e) => `Egg (${e.source}): ${eggStatus(e)}.`)].join(' ');
      case 'bag':
        return 'Use medicine or evolution items on your Pokémon.';
      case 'items':
        return 'Use map items (bikes, Escape Rope, VS Seeker) or check what they show.';
      case 'summary':
        return 'Look at each Pokémon: types, ability, held items, stats, moves and its story this run.';
      case 'bond':
        return 'See how each Pokémon feels about you: trust, affection, sync and more.';
      case 'story':
        return 'Read the story of your run so far, with the feelings each moment left.';
      case 'box':
        return 'Store spare Pokémon in the PC, or bring them back into the party.';
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
        const delay = this.travel(option.node);
        this.time.delayedCall(delay, () => this.cameras.main.fadeOut(250));
        this.time.delayedCall(delay + 260, () => this.scene.start(sceneForRun(run)));
        break;
      }
      case 'side': {
        const cut = session.rivalChallenge(option.side.id);
        if (cut) {
          this.busy = true;
          playSfx(this, 'ui.select');
          this.cameras.main.fadeOut(250);
          this.time.delayedCall(260, () => this.scene.start(sceneForRun(cut)));
          break;
        }
        if (option.side.kind === 'fish') {
          this.openFishing(option.side.id);
          break;
        }
        if (option.side.kind === 'raid') {
          if (!option.side.used) this.openRaid(option.side.id);
          break;
        }
        if (option.side.kind === 'totem') {
          if (!option.side.used) this.openTotem(option.side.id);
          break;
        }
        if (option.side.kind === 'event') {
          this.busy = true;
          this.cameras.main.fadeOut(220);
          const sideId = option.side.id;
          this.time.delayedCall(230, () => this.scene.start('Event', { sideId }));
          break;
        }
        if (option.side.kind === 'expedition') {
          if (!option.side.used) this.openExpedition(option.side.id);
          break;
        }
        if (option.side.kind === 'service') {
          this.openService(option.side.id);
          break;
        }
        if (option.side.kind === 'minigame') {
          if (!option.side.used) this.openMinigame(option.side.id);
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
      case 'summary':
        openSummaryMenu(this.fieldHost());
        break;
      case 'bond':
        openBondMenu(this.fieldHost());
        break;
      case 'story':
        openStoryMenu(this.fieldHost());
        break;
      case 'box':
        openBoxMenu(this.fieldHost());
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
    const item = preview.source;
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
    const licenseText = licenseNote(content, run);
    if (licenseText) rows.push({ action: null, itemId: '', title: `Field License: ${licenseName(run.prep.license!)}`, text: licenseText, problem: licenseText });
    const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym');
    const gymText = gym ? this.previewText(gym) : '';
    if (gym && gymText) {
      const { itemId, source } = this.previews[gym.id]!;
      const text = `Gym leader ${bossInfo(content, 'gym', run.stage!.leaderId).name}: ${gymText.slice(gymText.indexOf(':') + 2)}`;
      rows.push({ action: null, itemId: itemId ?? '', title: source, text, problem: text });
    }
    return rows;
  }

  /** A minigame stop: shows the rules and the attempts left, and the pick of a difficulty starts the game. */
  private openMinigame(sideId: string): void {
    const { session } = services();
    const pv = minigamePreview(session.content, session.run!, sideId);
    const picker: Picker = new Picker(this, {
      title: `${pv.name} - ${pv.attemptsLeft} attempt${pv.attemptsLeft === 1 ? '' : 's'} left`,
      columns: 1,
      rowHeight: 120,
      rows: pv.tiers.map((t) => ({
        problem: pv.attemptsLeft > 0 ? null : 'No attempts left',
        hint: `${pv.instructions} ${pv.scoring}`,
        draw: (scene, box, w) => {
          box.add(scene.add.text(16, 8, `${pv.name}  ·  ${t.label}`, textStyle(22)));
          box.add(scene.add.text(16, 40, `${pv.instructions} ${pv.scoring}`, textStyle(15, '#ffd0a0', { wordWrap: { width: w - 32 } })));
          box.add(scene.add.text(16, 92, `${pv.medals}  ·  Best: ${pv.best}`, textStyle(14, '#a0d0ff', { wordWrap: { width: w - 32 } })));
        },
      })),
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.beginMinigame(sideId, i);
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

  /** An expedition gate: shows the briefing (party rules, route length, finale, rewards), then asks to commit. */
  private openExpedition(sideId: string): void {
    const { session } = services();
    const pv = expeditionPreview(session.content, session.run!, sideId);
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `Expedition - Tier ${pv.tier}: ${pv.name}`,
      columns: 1,
      rowHeight: 190,
      rows: [
        {
          problem: null,
          hint: `${pv.blurb} ${pv.partyText} ${pv.nodes}. Finale: ${pv.finale}. Rewards: ${pv.rewards.join(', ')}. ${pv.rules.join(' ')}`,
          draw: (scene, box, w) => {
            box.add(scene.add.text(16, 8, `${pv.name}  ·  ${pv.nodes}  ·  ${pv.partyMode} party`, textStyle(22)));
            box.add(scene.add.text(16, 42, `${pv.blurb} ${pv.partyText}`, textStyle(16, '#ffd0a0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 96, `Finale: ${pv.finale}`, textStyle(16, '#a0d0ff', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 124, `Rewards: ${pv.rewards.join(' · ')}`, textStyle(16, '#c0f0c0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 152, pv.rules.join(' '), textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 } })));
          },
        },
      ],
      onSelect: () => {
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.beginExpedition(sideId);
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

  /** Totem territory: shows the Totem, its aura, ally and rewards, then asks to commit. */
  private openTotem(sideId: string): void {
    const { session } = services();
    const content = session.content;
    const pv = totemPreview(content, session.run!, sideId);
    const species = content.species.get(pv.speciesId)!;
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `Totem - ${pv.name}`,
      columns: 1,
      rowHeight: 170,
      rows: [
        {
          ...speciesRow(species),
          problem: null,
          hint: `${pv.blurb} Aura: ${pv.aura}${pv.environment ? ` ${pv.environment}` : ''}${pv.ally ? ` Ally: ${pv.ally}.` : ''} Rewards: ${pv.rewards.join(', ')}. Losing never ends your run.`,
          draw: (scene, box, w) => {
            box.add(scene.add.text(16, 8, `${species.name}  Lv${pv.level}   ·   ${pv.tier} Totem   ·   ${pv.phases} phase${pv.phases === 1 ? '' : 's'}`, textStyle(22)));
            box.add(scene.add.text(16, 42, `Aura: ${pv.aura}${pv.environment ? `  ${pv.environment}` : ''}`, textStyle(16, '#ffd0a0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 88, pv.ally ? `Ally calls: ${pv.ally}` : 'No allies.', textStyle(16, '#a0d0ff', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 128, `Rewards: ${pv.rewards.join(' · ')}`, textStyle(16, '#c0f0c0', { wordWrap: { width: w - 32 } })));
          },
        },
      ],
      onSelect: () => {
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.enterTotem(sideId);
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

  /** A raid den: shows the boss, its tier, mechanics and rewards, then asks to commit. */
  private openRaid(sideId: string): void {
    const { session } = services();
    const content = session.content;
    const pv = raidPreview(content, session.run!, sideId);
    const species = content.species.get(pv.speciesId)!;
    const poor = session.run!.money < pv.entryCost;
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `Raid - Tier ${pv.tier}: ${pv.name}`,
      columns: 1,
      rowHeight: 150,
      rows: [
        {
          ...speciesRow(species),
          problem: poor ? `You need ₽${pv.entryCost} to enter.` : null,
          hint: `${pv.blurb}  Mechanics: ${pv.mechanics.join(', ')}.  Rewards: ${pv.rewards.join(', ')}.  Entry: ₽${pv.entryCost}. Losing never ends your run.`,
          draw: (scene, box, w) => {
            box.add(scene.add.text(16, 8, `${species.name}  Lv${pv.level}   ·   Tier ${pv.tier}   ·   Entry ₽${pv.entryCost}`, textStyle(22)));
            box.add(scene.add.text(16, 42, `Mechanics: ${pv.mechanics.join(' · ')}`, textStyle(16, '#ffd0a0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 88, `Rewards: ${pv.rewards.join(' · ')}`, textStyle(16, '#c0f0c0', { wordWrap: { width: w - 32 } })));
          },
        },
      ],
      onSelect: () => {
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.enterRaid(sideId);
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

  /** A fishing spot: pick one of the Pokémon on the line, then battle it. */
  private openFishing(sideId: string): void {
    const { session } = services();
    const content = session.content;
    const offer = fishingOffer(content, session.run!, sideId);
    const picker: Picker = new Picker(this, {
      glass: true,
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

  private openService(sideId: string): void {
    const { session } = services();
    const view = session.serviceView(sideId);
    const rows = view.options;
    if (rows.length === 0) return playSfx(this, 'ui.error', 0.5);
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `${view.service.name}  ·  ₽${view.money}`,
      columns: 1,
      rowHeight: 78,
      rows: rows.map((row) => ({
        problem: row.problem,
        hint: row.text,
        draw: (scene, box, w) => {
          box.add(scene.add.text(16, 6, `${row.title}${row.cost > 0 ? `   ₽${row.cost}` : ''}`, textStyle(22)));
          box.add(scene.add.text(16, 34, row.text, textStyle(15, '#d8d0e0', { wordWrap: { width: w - 32 } })));
        },
      })),
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        playSfx(this, 'ui.select');
        this.scene.restart({ notice: session.useService(sideId, rows[i]!.id), focus: 0 });
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
      glass: true,
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
