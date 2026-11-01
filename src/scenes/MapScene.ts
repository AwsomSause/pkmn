// The stage map: 20 numbered levels in columns, ending at the gym leader.
// The player picks one of the next nodes to fight, can stop at a healing spot
// or shop beside the node they're on, and can use the Party and Bag menus.
// After a region's last stage the same screen shows its Pokémon League: one
// straight line of Elite Four members, then the champion. The League climbs:
// columns spread across the screen, each battle sits higher on a taller glass
// pillar with a bigger token, and the champion stands in turning gold rays
// (Visual Bible: "a deliberate escalation from normal stages").

import { clockLabel, periodOf, PERIOD_LOOK } from '../core/clock';
import { modeObjectives, objectivesLine } from '../core/modeObjectives';
import { fieldHintId, licenseName, licenseNote } from '../core/license';
import { SERVICES } from '../core/services/schema';
import type { PlazaSectionId } from '../core/plaza/flow';
import { stopIsHidden } from '../core/events';
import { forecast, foggedAt, frontAt, isFogged, sightRange, visibleColumn } from '../core/world';
import Phaser from 'phaser';
import { pinnedObjective } from '../core/objectives';
import { regionDim } from '../ui/battleFx/transitions';
import { regionIdentity } from '../core/presentation/regionIdentity';
import { FRAME_ASSET_IDS, headerBar } from '../ui/frames';
import { currentColumn, findNode } from '../core/map';
import { runPerks } from '../core/archetypes';
import { frontRunner, isFalseProtagonist, rivalTitle, TIMELINE } from '../core/timeline/frontRunner';
import { boxCapacity } from '../core/trainerPerks';
import { hiddenItemNode, mapItemSummary, repelActive } from '../core/mapItems';
import { expeditionPreview } from '../core/expedition/flow';
import { minigamePreview } from '../core/minigame/flow';
import { ROUTE_LABELS, routeKind } from '../core/campaign/director';
import { anomalyLine, stageAnomaly } from '../core/story/anomaly';
import { fishingOffer, raidPreview, totemPreview, mapActions, wipeStatus, mapChoices, mapPreviews, nextGymLeaders, type MapActionKind, type NodePreview } from '../core/run';
import { bossInfo, currentRegion, getCampaign, runLevelCap } from '../core/regions';
import { blindMap } from '../core/rules';
import { arenaFor, getTheme } from '../core/themes';
import type { MapNode, SideStop } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx, playSfxLazy, playMusicLazy } from '../ui/audio';
import { mapTrack } from '../core/presentation/battleMusic';
import { openBondMenu } from '../ui/bondMenu';
import { openPartyScene, openScrapbook } from '../ui/partyLifeUi';
import { openSummaryMenu } from '../ui/summaryMenu';
import { openBagMenu, openBoxMenu, openPartyMenu, openStoryMenu, type FieldMenuHost } from '../ui/fieldMenus';
import { onInputAction } from '../ui/input';
import { Picker, speciesRow } from '../ui/partyPanel';
import { stopStyle } from '../ui/stopIcons';
import { itemVisual, pokemonIcon, trainerVisual } from '../ui/sprites';
import { showAchievementToasts } from '../ui/achievementToast';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, TYPE_COLORS, mixColor, textStyle } from '../ui/theme';
import { badge, focusFrame } from '../ui/widgets';
import { AERO, drawGlass, floatIdle, glassPanel as drawPanel, typeLabel, type MotionLevel } from '../ui/aero';
import { addAmbience } from '../ui/battleFx/ambience';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon, queueAssets } from '../ui/lazyAssets';
import { eggStatus } from '../core/eggs';
import { protagonistTitle, topHeadline } from '../core/rivals/recognition';

const COL_SPACING = 104;
const ROW_SPACING = 92;
const MAP_LEFT = 70;
const MAP_MID_Y = 245;
const NODE_RADIUS = 24;
/** How far the League's last battle sits above its first. */
const LEAGUE_RISE = 120;

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
  plaza: { color: 0xf0c040, glyph: 'P' },
};
const SIDE_LABEL: Record<SideStop['kind'], string> = { heal: 'Heal', shop: 'Shop', fish: 'Fish', raid: 'Raid', totem: 'Totem', event: 'Event', expedition: 'Expedition', minigame: 'Minigame', service: 'Service', plaza: 'Plaza' };
/** A node in the fog: a grey token with a "?" until you scout, see further or get close. */
const FOG_STYLE = { color: 0x56607a, glyph: '?', label: 'Fog' };
/** A roaming Legendary's stop and a checkpoint camp. */
const ROAMER_STYLE = { color: 0xf0c030, glyph: '★' };
const CAMP_STYLE = { color: 0x58a860, glyph: '▲' };
const FRONT_LABEL: Record<string, string> = { rain: 'Rain', sun: 'Harsh sun', sand: 'Sandstorm', snow: 'Snow', hail: 'Hail' };
const FRONT_COLOR: Record<string, number> = { rain: 0x4878d0, sun: 0xe8a020, sand: 0xc8a050, snow: 0xe0f0ff, hail: 0x90c0e0 };
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
  | { kind: 'scrapbook' }
  | { kind: 'summary' }
  | { kind: 'box' }
  | { kind: 'endRun' };

export class MapScene extends Phaser.Scene {
  private options: Option[] = [];
  private cursors: Phaser.GameObjects.Graphics[] = [];
  private index = 0;
  private picker: Picker | null = null;
  private info: Phaser.GameObjects.Text | null = null;
  private notice: Phaser.GameObjects.Text | null = null;
  private endArmed = false;
  private busy = false;
  private colSpacing = COL_SPACING;
  private accent: number = COLORS.border;
  /** What map items show about nodes (Devon Scope, Town Map, Rule Book, Orange Mail). */
  private previews: Record<string, NodePreview> = {};
  /** Where each node is drawn inside the scrolling map layer (for the travel animation). */
  private nodePos = new Map<string, { x: number; y: number }>();
  private mapLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Map');
  }

  /** The healing stop: a soft green glow and rising sparkles over the screen, then `done` (straight away with animations Off). */
  private healFx(done: () => void): void {
    if (this.motion === 'off') return done();
    const full = this.motion === 'full';
    const wash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x7dffb0, 0).setOrigin(0).setDepth(300);
    this.tweens.add({ targets: wash, alpha: full ? 0.32 : 0.15, duration: 260, yoyo: true, ease: 'Sine.easeInOut' });
    if (full) {
      for (let i = 0; i < 14; i++) {
        const spark = this.add.text(120 + i * 55, GAME_HEIGHT - 60, i % 3 === 0 ? '+' : '✦', textStyle(i % 3 === 0 ? 30 : 22, '#c8ffd8')).setOrigin(0.5).setDepth(301).setAlpha(0);
        this.tweens.add({ targets: spark, y: GAME_HEIGHT - 60 - (150 + (i % 4) * 40), alpha: { from: 1, to: 0 }, scale: { from: 0.6, to: 1.3 }, duration: 800, delay: i * 30, ease: 'Sine.easeOut' });
      }
    }
    this.time.delayedCall(full ? 760 : 320, done);
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
    queueAssets(this, [...FRAME_ASSET_IDS, 'ui.party.icon_box', 'ui.party.icon_box_faint', 'ui.party.statuses', 'ui.party.icon_item', 'ui.bag.bg', ...(run?.eggs.length ? ['pack.ebdx.egg'] : [])]);
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    this.endArmed = false;
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const stage = run.stage!;
    const theme = getTheme(content, stage.themeId);
    const league = stage.kind === 'league';
    const leader = bossInfo(content, league ? 'champion' : 'gym', stage.leaderId);
    const region = currentRegion(content, run);
    const identity = regionIdentity(region.id);
    this.accent = identity.accent;
    const cap = runLevelCap(content, run);
    this.options = [];
    this.cursors = [];
    this.index = 0;
    this.picker = null;
    this.busy = false;
    playMusicLazy(this, mapTrack(region.id));

    // ---------- backdrop: the stage's own arena, dimmed ----------
    const arena = league ? undefined : arenaFor(content, theme);
    const bg = arena && this.textures.exists(arena) ? arena : this.textures.exists('bg.battle') ? 'bg.battle' : null;
    if (bg) {
      const back = this.add.image(0, 0, bg).setOrigin(0).setScale(PIXEL_SCALE).setDepth(-60);
      // Parallax: the scenery drifts slowly behind the map (presentation only).
      if (this.motion === 'full' && back.displayWidth > GAME_WIDTH) {
        this.tweens.add({ targets: back, x: GAME_WIDTH - back.displayWidth, duration: 40_000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, regionDim(identity.sky), 0.58).setOrigin(0).setDepth(-55);
    }
    // The stage's types drift over it (leaves, embers, bubbles...), like the battle arena.
    const air = this.add.container(0, 0).setDepth(-50);
    addAmbience(this, air, 0, league || blindMap(run.rules) ? ['dragon'] : theme.types, this.motion);
    // Layers in front of the scenery: a far landmark (the stage's lead type, big and faint) and a dark ground band that
    // fades up from the bottom edge, so the map nodes sit between sky and ground.
    if (!league && !blindMap(run.rules) && theme.types[0]) {
      const mark = typeLabel(this, GAME_WIDTH - 150, 150, theme.types[0], 7);
      if (mark) {
        mark.setAlpha(0.22).setDepth(-52);
        floatIdle(this, mark, this.motion, 6, 3200);
      }
    }
    const ground = this.add.graphics().setDepth(-49);
    for (let i = 0; i < 8; i++) {
      ground.fillStyle(0x0a0a18, 0.05 + i * 0.03);
      ground.fillRect(0, GAME_HEIGHT - 120 + i * 15, GAME_WIDTH, 15);
    }

    // ---------- header ----------
    drawPanel(this, 8, 6, GAME_WIDTH - 16, 64, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true, alpha: 0.92 });
    const column = currentColumn(stage);
    headerBar(this, identity.accent, this.motion, 8, 6, GAME_WIDTH - 16, 64); // UIE pause-menu strip in the region's colour
    // The region's accent stripe under the header (catalog 62).
    this.add.rectangle(20, 67, GAME_WIDTH - 40, 3, identity.accent, 0.9).setOrigin(0).setName('region-accent');
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
      .text(GAME_WIDTH - 24, 44, `${clockLabel(run)}  ·  ₽${run.money}  ·  Badges ${run.badges.length}  ·  Level cap ${cap}${wipeStatus(run) ? `  ·  Wipes ${wipeStatus(run)!.wipes}${wipeStatus(run)!.max ? `/${wipeStatus(run)!.max}` : ''}` : ''}`, textStyle(16, '#d8d0e0'))
      .setOrigin(1, 0);
    // Time of day: a light wash over the map (presentation only).
    const look = PERIOD_LOOK[periodOf(run)];
    if (look.alpha > 0) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, look.tint, look.alpha * 0.5).setOrigin(0).setDepth(900).setName('time-wash');
    // Weather forecast: a front ahead, or the one you are in, and fog.
    const fc = league ? null : forecast(content, run);
    if (fc) {
      const where = fc.startsIn === 0 ? `now over levels ${fc.front.from}–${fc.front.to}` : `in ${fc.startsIn} level${fc.startsIn === 1 ? '' : 's'} (levels ${fc.front.from}–${fc.front.to})`;
      const band = fc.front.band === 'all' ? '' : fc.front.band === 'high' ? ', top route only' : ', lower routes only';
      this.add.text(GAME_WIDTH / 2, 71, `Forecast: ${FRONT_LABEL[fc.front.weather] ?? fc.front.weather} ${where}${band}`, textStyle(13, '#bfe4ff', { stroke: '#0b2a4a', strokeThickness: 3 })).setOrigin(0.5, 0).setName('forecast');
    }
    // Convoy Mode: the escort's health, as hearts.
    const convoy = league ? null : run.stage?.convoy;
    if (convoy) this.add.text(GAME_WIDTH / 2, 88, `Escort: ${convoy.name}  ${'♥'.repeat(convoy.hp)}${'♡'.repeat(convoy.maxHp - convoy.hp)}`, textStyle(13, '#ffd0d8', { stroke: '#4a0b1a', strokeThickness: 3 })).setOrigin(0.5, 0).setName('convoy');
    const objectives = modeObjectives(run);
    if (objectives.length > 0) this.add.text(GAME_WIDTH - 24, 68, objectivesLine(objectives), textStyle(14, '#f0e0a0')).setOrigin(1, 0);

    // Revisit This Timeline: the False Protagonist's title, and who is ahead of you now.
    if (isFalseProtagonist(run)) {
      const fr = frontRunner(run);
      const ahead = fr?.rank ? `  ·  ${rivalTitle(content, fr)} is ahead (${fr.rank === 'gymLeader' ? 'Gym Leader' : fr.rank === 'finalist' ? 'finalist' : 'Champion'})` : '';
      const tag = this.add.text(26, 68, `${TIMELINE.title}${ahead}`, textStyle(14, '#ff9fe0', { stroke: '#2a0a2a', strokeThickness: 4 }));
      if (services().session.settings.battleAnimations === 'full') this.tweens.add({ targets: tag, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
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
    const colSpacing = league ? Math.min(200, (GAME_WIDTH - MAP_LEFT * 2 - 40) / Math.max(1, stage.map.columns - 1)) : COL_SPACING;
    this.colSpacing = colSpacing;
    const totalWidth = MAP_LEFT * 2 + (stage.map.columns - 1) * colSpacing;
    const focusCol = Math.max(column, 1);
    const scroll = Phaser.Math.Clamp(MAP_LEFT + (focusCol - 1) * colSpacing - 300, 0, Math.max(0, totalWidth - GAME_WIDTH));
    mapLayer.x = -scroll;
    const maskShape = this.make.graphics({}, false).fillRect(0, 74, GAME_WIDTH, 346);
    mapLayer.setMask(maskShape.createGeometryMask());

    const widthOf = (col: number) => stage.map.nodes.filter((n) => n.column === col).length;
    // In the League each battle sits a step higher than the last.
    const rise = league ? LEAGUE_RISE / Math.max(1, stage.map.columns - 1) : 0;
    const pos = (n: MapNode) => ({
      x: MAP_LEFT + (n.column - 1) * colSpacing,
      y: MAP_MID_Y + (n.row - (widthOf(n.column) - 1) / 2) * ROW_SPACING + (league ? LEAGUE_RISE / 2 - (n.column - 1) * rise : 0),
    });

    const lines = this.add.graphics();
    mapLayer.add(lines);
    const openPaths: [{ x: number; y: number }, { x: number; y: number }][] = [];
    // The boss column: a glowing band behind the gym leader (or each League battle).
    for (const n of stage.map.nodes.filter((m) => BOSS_KINDS.includes(m.kind))) {
      const { x: bx, y: by } = pos(n);
      const top = league ? by - 56 : 98;
      const band = drawGlass(this, bx - 46, top, 92, 398 - top, { tint: KIND_STYLE[n.kind].color, rim: mixColor(KIND_STYLE[n.kind].color, 0xffffff, 0.4), alpha: 0.28, radius: 24 });
      mapLayer.addAt(band, 0);
      if (league) band.setName('league-step');
      if (n.kind === 'champion') {
        const rays = this.add.star(bx, by, 12, 18, 96, 0xf8d050, 0.32).setBlendMode('ADD').setName('league-rays');
        mapLayer.addAt(rays, 1);
        if (this.motion === 'full') this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
        if (this.motion !== 'off') this.tweens.add({ targets: rays, scale: 1.12, alpha: 0.5, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
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
      const x = MAP_LEFT + (col - 1) * colSpacing;
      mapLayer.add(this.add.text(x, 402, 'Trainers', textStyle(14, '#f8a850')).setOrigin(0.5));
    }

    const seenColumn = league ? 99 : visibleColumn(content, run);
    for (const n of stage.map.nodes) {
      const { x, y } = pos(n);
      this.nodePos.set(n.id, { x, y });
      const fog = foggedAt(stage, seenColumn, n);
      const style = fog ? FOG_STYLE : KIND_STYLE[n.kind];
      const visited = stage.visited.includes(n.id);
      const isCurrent = n.id === stage.current;
      const reachable = choiceIds.has(n.id);
      const dim = !visited && !reachable && n.column <= column;
      const isBoss = BOSS_KINDS.includes(n.kind);
      const r = (isBoss ? NODE_RADIUS + 6 : NODE_RADIUS) + (league ? (n.column - 1) * 2 : 0);
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
      if (n.harder && !fog) {
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
      if (!fog && n.kind === 'wild' && this.textures.exists('ball.pb')) {
        mapLayer.add(this.add.image(x, y - 1, 'ball.pb').setScale(2).setAlpha(alpha));
      } else if (boss) {
        const art = trainerVisual(this, boss.spriteAssetId, boss.name, x, y + r - 4, 1);
        if (art instanceof Phaser.GameObjects.Sprite) art.setScale(Math.min(1, (r * 2.2) / art.height));
        art.setAlpha(alpha);
        mapLayer.add(art);
      } else {
        mapLayer.add(this.add.text(x, y, style.glyph, textStyle(26, '#ffffff', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5).setAlpha(alpha));
      }
      if (n.harder && !fog) mapLayer.add(this.add.text(x + r - 2, y - r + 2, '!', textStyle(22, '#f8f8f8', { stroke: '#5a2890', strokeThickness: 5 })).setOrigin(0.5));
      // Itemfinder: the stop hiding an item.
      if (n.id === hidden && !visited) mapLayer.add(this.add.text(x - r + 2, y - r + 2, '✦', textStyle(22, '#f8e070', { stroke: '#181818', strokeThickness: 4 })).setOrigin(0.5));
      if (!fog) this.drawPreview(mapLayer, n, x, y, r);
      // A weather front over this node: a small badge in the front's colour.
      const front = fog ? null : frontAt(content, run, n);
      if (front) {
        const fb = this.add.graphics();
        fb.fillStyle(0x181818, 1);
        fb.fillRoundedRect(x - r - 6, y + r - 6, 46, 16, 4);
        fb.fillStyle(FRONT_COLOR[front.weather] ?? 0xffffff, 1);
        fb.fillRoundedRect(x - r - 4, y + r - 4, 42, 12, 3);
        mapLayer.add(fb);
        mapLayer.add(this.add.text(x - r + 17, y + r + 2, FRONT_LABEL[front.weather] ?? front.weather, textStyle(10, '#101820')).setOrigin(0.5));
      }
      if (n.row === 0) mapLayer.add(this.add.text(x, 84, String(n.column), textStyle(14, '#a69cb4')).setOrigin(0.5, 0));
      if (league && boss) mapLayer.add(this.add.text(x, y + r + 12, n.kind === 'champion' ? `★ ${boss.name} ★` : boss.name, textStyle(n.kind === 'champion' ? 17 : 15, n.kind === 'champion' ? '#ffe080' : COLORS.textLight)).setOrigin(0.5, 0));
      n.sides.forEach((side, i) => {
        const sx = x + NODE_RADIUS + 4 + i * 22;
        const sy = y - NODE_RADIUS - 2;
        const s = fog ? HIDDEN_STYLE : side.roamer ? ROAMER_STYLE : side.eventId === 'camp-checkpoint' ? CAMP_STYLE : side.kind === 'event' ? (stopIsHidden(content, run, n, side) ? HIDDEN_STYLE : stopStyle(content.events.get(side.eventId ?? '')?.stop)) : SIDE_STYLE[side.kind];
        const sg = this.add.graphics();
        sg.fillStyle(0x181818, side.used ? 0.3 : 1);
        sg.fillRect(sx - 11, sy - 11, 22, 22);
        sg.fillStyle(s.color, side.used ? 0.3 : 1);
        sg.fillRect(sx - 9, sy - 9, 18, 18);
        mapLayer.add(sg);
        mapLayer.add(this.add.text(sx, sy, s.glyph, textStyle(18, '#ffffff', { stroke: '#181818', strokeThickness: 3 })).setOrigin(0.5).setAlpha(side.used ? 0.4 : 1));
      });
      if (reachable) {
        this.addOption({ kind: 'node', node: n }, () => this.ringCursor(mapLayer, x, y, r + (isBoss ? 8 : 10)), {
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
      buttons.push({ option: { kind: 'side', side }, label: SIDE_LABEL[side.kind], color: side.kind === 'event' && !stopIsHidden(content, run, currentNode!, side) ? stopStyle(content.events.get(side.eventId ?? '')?.stop).color : SIDE_STYLE[side.kind].color });
    }
    if (this.itemRows().length > 0) buttons.push({ option: { kind: 'items' }, label: 'Items', color: COLORS.panel });
    if (boxCapacity(runPerks(content, services().session.run!)) > 0) buttons.push({ option: { kind: 'box' }, label: 'PC', color: COLORS.panel });
    buttons.push({ option: { kind: 'party' }, label: 'Party', color: COLORS.panel }, { option: { kind: 'bag' }, label: 'Bag', color: COLORS.panel }, { option: { kind: 'bond' }, label: 'Bonds', color: COLORS.panel }, { option: { kind: 'scrapbook' }, label: 'Album', color: COLORS.panel }, { option: { kind: 'story' }, label: 'Story', color: COLORS.panel }, { option: { kind: 'summary' }, label: 'Summary', color: COLORS.panel });
    if (wipeStatus(services().session.run!)) buttons.push({ option: { kind: 'endRun' }, label: 'End run', color: 0x6a2a38 });
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
      .text(GAME_WIDTH - 24, 506, data.notice ?? (working ? `Working: ${working}` : newsLine(content, run)), textStyle(15, '#f0e0a0', { align: 'right', wordWrap: { width: 340 } }))
      .setOrigin(1, 0);
    this.focus(Math.min(data.focus ?? 0, this.options.length - 1), false);
    showAchievementToasts(this, session.takeAchievementToasts(), this.motion);

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

    // Party scenes: what the team did on the way here (a conversation, a gathering, a huddle before a boss).
    const partyScene = stage.current !== null ? session.ensureScene() : null;
    if (partyScene) {
      this.time.delayedCall(350, () => {
        if (this.picker) return;
        openPartyScene(this.fieldHost(), partyScene, (lines) => this.scene.restart({ notice: lines.join(' '), focus: this.index }));
      });
    }

    if (stage.current === null && !data.notice) {
      const regions = run.regionOrder.length;
      if (league) {
        const size = getCampaign(content, run.campaignId).eliteFourSize;
        this.showBanner(region.name, 'Pokémon League', `Elite Four ×${size}, then ${leader.title}  ·  Healed after every battle`);
      } else if (stage.index === 0) {
        this.showBanner(`Region ${run.regionIndex + 1} of ${regions}  ·  ${identity.motif}`, region.name, `Level cap ${cap}  ·  Stage 1: ${blindMap(run.rules) ? '???' : theme.name}  ·  ${leader.title}`);
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
    const from = (stage.current && this.nodePos.get(stage.current)) || { x: to.x - this.colSpacing, y: to.y };
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
        const runNow = services().session.run!;
        if (isFogged(content, runNow, n)) return `Level ${n.column}: lost in fog. You see ${sightRange(content, runNow)} columns ahead; Intelligence, a keen-eyed or Flying Pokémon and scouting see further.`;
        const frontHere = frontAt(content, runNow, n);
        const frontNote = frontHere ? `${FRONT_LABEL[frontHere.weather] ?? frontHere.weather} front: battles here start in ${frontHere.weather}.\n` : '';
        const [lo, hi] = content.balance.difficulty.harderBonus;
        const boss = this.bossFor(n);
        const types = boss && boss.types.length > 0 && n.kind !== 'gym' ? ` (${boss.types.join('/')})` : '';
        const kind = boss ? `${boss.title}${types}` : KIND_STYLE[n.kind].label;
        const risk = n.harder ? `  ·  Risk: high (+${lo}–${hi} enemy levels, better rewards)` : boss ? '  ·  Risk: boss' : '';
        const sides = n.sides.map((s) => (s.kind === 'heal' ? 'healing spot' : s.kind === 'fish' ? 'fishing spot' : s.kind === 'raid' ? 'raid den' : s.kind === 'totem' ? 'Totem territory' : s.kind === 'expedition' ? 'expedition gate' : s.kind === 'service' ? (SERVICES.services.find((x) => x.id === s.serviceId)?.name ?? 'service') : s.kind === 'event' ? (stopIsHidden(content, services().session.run!, n, s) ? 'mystery "?" stop' : `${content.events.get(s.eventId ?? '')?.name ?? 'event'} stop`) : s.kind === 'plaza' ? 'Trainer Plaza' : 'shop'));
        const seen = this.previewText(n);
        const route = routeKind(services().session.run!, n);
        const anomaly = stageAnomaly(services().session.content, services().session.run!);
        return `${frontNote}${anomaly ? `${anomalyLine(anomaly)}\n` : ''}${route ? `[${ROUTE_LABELS[route]}]\n` : ''}${n.kind === 'elite' || n.kind === 'champion' ? 'Battle' : 'Level'} ${n.column}: ${kind}${risk}${sides.length ? `  ·  Has a ${sides.join(' and ')}` : ''}${seen ? `\n${seen}` : ''}`;
      }
      case 'side':
        if (option.side.kind === 'plaza') return 'Trainer Plaza: the middle of the stage. Stalls, traders, a Battle Club, errands and gossip. Rest, shop and plan before you go on.';
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
        return 'See how each Pokémon feels about you: trust, affection, sync and more, plus its personality and friendships.';
      case 'scrapbook':
        return 'Your team scrapbook: photos and small moments from the road. Take a team photo here.';
      case 'story':
        return `Read the story of your run so far, with the feelings each moment left. People call you ${protagonistTitle(services().session.run!).name}.`;
      case 'endRun':
        return 'Give up this Adventure run. Press it twice to confirm; what you earned so far still counts.';
      case 'box':
        return 'Store spare Pokémon in the PC, or bring them back into the party.';
    }
  }

  private focus(i: number, sound = true): void {
    if (i < 0) return;
    if (sound && i !== this.index) playSfx(this, 'ui.cursor', 0.5);
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
        if (option.side.kind === 'plaza') {
          this.openPlaza(option.side.id);
          break;
        }
        if (option.side.kind === 'minigame') {
          if (!option.side.used) this.openMinigame(option.side.id);
          break;
        }
        const message = session.visitSide(option.side.id);
        if (option.side.kind === 'heal') {
          playSfxLazy(this, 'me.heal');
          this.busy = true;
          this.healFx(() => this.scene.restart({ notice: message, focus: 0 }));
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
      case 'scrapbook':
        openScrapbook(this.fieldHost());
        break;
      case 'story':
        openStoryMenu(this.fieldHost());
        break;
      case 'box':
        openBoxMenu(this.fieldHost());
        break;
      case 'endRun':
        if (!this.endArmed) {
          this.endArmed = true;
          this.notice?.setText('Press End run again to end this Adventure run.');
          break;
        }
        services().session.endRunEarly();
        this.scene.start('GameOver');
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
    if (licenseText) rows.push({ action: null, itemId: '', title: `${run.prep.license ? 'Field License' : 'Intel'}: ${licenseName(fieldHintId(content, run)!)}`, text: licenseText, problem: licenseText });
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
            if (scene.textures.exists('ui.raid.den_entry')) box.add(scene.add.image(0, 0, 'ui.raid.den_entry').setOrigin(0).setDisplaySize(w, 150).setAlpha(0.35));
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
    const money = session.run!.money;
    // Regional and rival raids offer approaches (one row each); other raids are a single "fight" row.
    const choices = pv.approaches.length > 0 ? pv.approaches : [{ id: '', label: '', text: '', cost: 0, leave: false }];
    const kindName = { wild: 'Raid', regional: 'Regional Raid', rival: 'Rival Raid', anomaly: 'Anomaly Raid' }[pv.kind];
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `${kindName} - Tier ${pv.tier}: ${pv.name}${pv.returning ? ' (it came back!)' : ''}`,
      columns: 1,
      rowHeight: 150,
      rows: choices.map((a) => {
        const cost = pv.entryCost + a.cost;
        return {
          ...speciesRow(species),
          problem: !a.leave && money < cost ? `You need ₽${cost} to enter.` : null,
          hint: `${pv.blurb}  Mechanics: ${pv.mechanics.join(', ')}.  Rewards: ${pv.rewards.join(', ')}.  Entry: ₽${cost}. Losing never ends your run.`,
          draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
            if (scene.textures.exists('ui.raid.den_entry')) box.add(scene.add.image(0, 0, 'ui.raid.den_entry').setOrigin(0).setDisplaySize(w, 150).setAlpha(0.35));
            box.add(scene.add.text(16, 8, a.label ? `${a.label}  ·  ${a.leave ? 'free' : `₽${cost}`}` : `${species.name}  Lv${pv.level}   ·   Tier ${pv.tier}   ·   Entry ₽${cost}`, textStyle(22)));
            if (a.text) box.add(scene.add.text(16, 36, `${species.name} Lv${pv.level}: ${a.text}`, textStyle(16, '#ffe0a0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, a.text ? 62 : 42, `Mechanics: ${pv.mechanics.join(' · ')}`, textStyle(16, '#ffd0a0', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 104, `Rewards: ${pv.rewards.join(' · ')}`, textStyle(16, '#c0f0c0', { wordWrap: { width: w - 32 } })));
          },
        };
      }),
      onSelect: (i) => {
        const choice = choices[i]!;
        picker.close();
        this.picker = null;
        this.busy = true;
        playSfx(this, 'ui.select');
        const run = session.enterRaid(sideId, choice.id || undefined);
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

  /** The Trainer Plaza: a list of areas; each opens its own list of things to do. */
  private openPlaza(sideId: string, notice?: string): void {
    const { session } = services();
    const view = session.plazaView(sideId);
    const head = `${view.event.name}: ${view.event.text}\n${view.atmosphere}${view.alleyHint ? `\n${view.alleyHint}` : ''}${view.errandsOpen > 0 ? `\nErrands open: ${view.errandsOpen}.` : ''}${notice ? `\n${notice}` : ''}`;
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `Trainer Plaza  ·  ${view.repTitle} (${view.rep})  ·  ₽${view.money}`,
      columns: 1,
      rowHeight: 64,
      rows: [
        { problem: head, draw: (scene, box, w) => box.add(scene.add.text(16, 8, head.split('\n')[0]!, textStyle(16, '#f0e0a0', { wordWrap: { width: w - 32 } }))) },
        ...view.sections.map((sec) => ({
          problem: sec.count === 0 ? 'Nothing here right now.' : null,
          hint: sec.blurb,
          draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
            box.add(scene.add.text(16, 6, `${sec.title}   (${sec.count})`, textStyle(22)));
            box.add(scene.add.text(16, 34, sec.blurb, textStyle(15, '#d8d0e0', { wordWrap: { width: w - 32 } })));
          },
        })),
      ],
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        playSfx(this, 'ui.select');
        this.openPlazaSection(sideId, view.sections[i - 1]!.id);
      },
      onBack: () => {
        picker.close();
        this.picker = null;
        this.scene.restart({ notice: notice ?? 'You leave the plaza.', focus: 0 });
      },
    });
    this.picker = picker;
  }

  private openPlazaSection(sideId: string, section: PlazaSectionId, notice?: string): void {
    const { session } = services();
    const view = session.plazaSection(sideId, section);
    const money = session.run!.money;
    const notes = [...(notice ? [`» ${notice}`] : []), ...view.notes];
    const rows = view.options;
    const picker: Picker = new Picker(this, {
      glass: true,
      title: `Trainer Plaza  ·  ₽${money}`,
      columns: 1,
      rowHeight: 78,
      rows: [
        ...notes.map((note) => ({ problem: note, draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => box.add(scene.add.text(16, 6, note, textStyle(15, '#f0e0a0', { wordWrap: { width: w - 32 } }))) })),
        ...rows.map((row) => ({
          problem: row.problem,
          hint: row.text,
          draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
            box.add(scene.add.text(16, 6, `${row.title}${row.cost > 0 ? `   ₽${row.cost}` : ''}`, textStyle(20, '#ffffff', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 34, row.text, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 } })));
          },
        })),
      ],
      onSelect: (i) => {
        const row = rows[i - notes.length]!;
        picker.close();
        this.picker = null;
        playSfx(this, 'ui.select');
        let result;
        try {
          result = session.usePlaza(sideId, section, row.id);
        } catch (err) {
          playSfx(this, 'ui.error', 0.5);
          return this.openPlazaSection(sideId, section, String(err instanceof Error ? err.message : err));
        }
        if (result.battle || session.run!.phase !== 'map') {
          this.busy = true;
          this.scene.start(sceneForRun(session.run!));
          return;
        }
        this.openPlazaSection(sideId, section, result.message);
      },
      onBack: () => {
        picker.close();
        this.picker = null;
        this.openPlaza(sideId, notice);
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
    band.fillStyle(this.accent, 1).fillRect(0, 174, GAME_WIDTH, 6).fillRect(0, 324, GAME_WIDTH, 6);
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

/** The newest rival headline for the map's notice corner (world recognition), or ''. */
function newsLine(content: Parameters<typeof topHeadline>[0], run: Parameters<typeof topHeadline>[1]): string {
  const h = topHeadline(content, run);
  return h ? `News: ${h}` : '';
}
