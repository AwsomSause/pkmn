// Plaza styles (Kice 2026-11-02, mock-ups 7, 9, 10, 12): how the tile-map plaza is framed and what floats over it.
// Aero Bubbles: glossy count bubbles and a glass dock. Regional Looks: the stage's season (petals, leaves, snow, dusk haze).
// Diorama Island: the plaza floats as a tilt-shift island in the sky with a Wii-style channel bar. Social Square: a close
// camera that follows you, name tags and quest marks over people, and a list of who is here. PlazaScene keeps the state,
// input and menus; nothing here changes a result.

import Phaser from 'phaser';
import { PLAZA_MAP, PLAZA_SEASONS, type PlazaSeason, type PlazaStyleId } from '../../core/presentation/plazaStyles';
import type { DistrictView, PlazaLayout, Wanderer } from '../../core/plaza/layout';
import { AERO, drawGlass, type MotionLevel } from '../aero';
import { GAME_HEIGHT, GAME_WIDTH, mixColor, textStyle } from '../theme';
import { px, spotOf, type PlazaWorld } from './world';

const T = PLAZA_MAP.tile;
const MAP_W = PLAZA_MAP.cols * T;
const MAP_H = PLAZA_MAP.rows * T;

export interface StyleCtx {
  scene: Phaser.Scene;
  world: PlazaWorld;
  layout: PlazaLayout;
  motion: MotionLevel;
  season: PlazaSeason;
  /** "Rep title (rep) · ₽money", refreshed after a purchase. */
  head: () => string;
  /** The text shown for a district (its blurb, or why it is closed). */
  blurb: (d: DistrictView) => string;
  onFocus: (i: number) => void;
  onPick: (i: number) => void;
}

export interface StyleFrame {
  /** Screen-space chrome hidden while a menu is open. */
  hud: Phaser.GameObjects.GameObject[];
  focus(i: number, instant: boolean): void;
  refreshHead(): void;
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Where each style puts the map: scale and the map pixel that sits at the screen centre. */
export function frameFor(style: PlazaStyleId): { scale: number; cx: number; cy: number } {
  if (style === 'diorama') return { scale: 0.32, cx: MAP_W / 2, cy: MAP_H / 2 };
  if (style === 'social') return { scale: 1, cx: 30 * T, cy: 16 * T };
  return { scale: 0.56, cx: 30 * T, cy: 15.1 * T };
}

/** Puts the world at a scale with a map pixel at a screen point (clamped so the map always covers the screen when it can). */
function aim(world: PlazaWorld, scale: number, mx: number, my: number, sx = GAME_WIDTH / 2, sy = GAME_HEIGHT / 2, clamp = true): { x: number; y: number } {
  let x = sx - mx * scale;
  let y = sy - my * scale;
  if (clamp) {
    x = Phaser.Math.Clamp(x, GAME_WIDTH - MAP_W * scale, 0);
    y = Phaser.Math.Clamp(y, GAME_HEIGHT - MAP_H * scale, 0);
  }
  world.root.setScale(scale);
  return { x, y };
}

function pill(scene: Phaser.Scene, text: string, color: number, count: number | null, size = 15): Phaser.GameObjects.Container {
  const t = scene.add.text(0, 0, text, textStyle(size, '#ffffff', { stroke: '#1a1a2a', strokeThickness: 3 })).setOrigin(0.5);
  const w = t.width + 22;
  const h = t.height + 8;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, h / 2);
  g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, h * 0.45, h / 3);
  g.lineStyle(2, 0xffffff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const parts: Phaser.GameObjects.GameObject[] = [g, t];
  if (count !== null && count > 0) {
    parts.push(scene.add.circle(w / 2 - 2, -h / 2, 11, 0xe84868).setStrokeStyle(2, 0xffffff));
    parts.push(scene.add.text(w / 2 - 2, -h / 2, String(count), textStyle(12, '#ffffff')).setOrigin(0.5));
  }
  return scene.add.container(0, 0, parts);
}

/** Clickable areas over each district's building, in map pixels, plus the pulsing focus ring. */
function districtHits(ctx: StyleCtx): Phaser.GameObjects.Ellipse {
  const { scene, world, layout } = ctx;
  layout.districts.forEach((d, i) => {
    const s = px(spotOf(d).label);
    const zone = scene.add.zone(s.x, s.y + 3 * T, 7 * T, 7 * T).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => ctx.onFocus(i));
    zone.on('pointerdown', () => ctx.onPick(i));
    world.root.add(zone.setDepth(-1e5));
  });
  const ring = scene.add.ellipse(0, 0, 3.4 * T, 1.3 * T, 0xfff0a0, 0.22).setStrokeStyle(3, 0xfff0a0, 0.95);
  world.root.add(ring.setDepth(-1e5 + 1));
  if (ctx.motion === 'full') scene.tweens.add({ targets: ring, scaleX: 1.15, scaleY: 1.15, alpha: 0.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return ring;
}

function placeRing(ring: Phaser.GameObjects.Ellipse, d: DistrictView): void {
  const s = px(spotOf(d).stand);
  ring.setPosition(s.x, s.y + 4);
}

/** Header strip: title (with the plaza event) and rep + money on the right. */
function header(ctx: StyleCtx, hud: Phaser.GameObjects.GameObject[], title: string, tint: number = AERO.sky): Phaser.GameObjects.Text {
  const { scene } = ctx;
  const keep = <O extends Phaser.GameObjects.GameObject>(o: O): O => (hud.push(o), o);
  keep(drawGlass(scene, 16, 8, GAME_WIDTH - 32, 40, { tint, rim: AERO.rim, glow: false, radius: 18 }).setDepth(1000));
  keep(scene.add.text(34, 28, title, textStyle(20)).setOrigin(0, 0.5).setDepth(1001));
  const headText = keep(scene.add.text(GAME_WIDTH - 34, 28, ctx.head(), textStyle(16, '#f0e0a0')).setOrigin(1, 0.5).setDepth(1001));
  const ev = ctx.layout.view.event;
  const line = keep(scene.add.text(GAME_WIDTH / 2, 56, `${ev.name}: ${ev.text}`, textStyle(13, '#f0e0a0', { stroke: '#101028', strokeThickness: 3, wordWrap: { width: GAME_WIDTH - 120 }, align: 'center' })).setOrigin(0.5, 0).setDepth(1001));
  if (ctx.motion === 'full') scene.tweens.add({ targets: line, alpha: { from: 0, to: 1 }, duration: 600 });
  return headText;
}

/** Bottom info strip: the focused district and the controls. */
function infoBar(ctx: StyleCtx, hud: Phaser.GameObjects.GameObject[], tint: number = AERO.glass, right = GAME_WIDTH - 16): { title: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text } {
  const { scene } = ctx;
  const keep = <O extends Phaser.GameObjects.GameObject>(o: O): O => (hud.push(o), o);
  keep(drawGlass(scene, 16, GAME_HEIGHT - 66, right - 16, 56, { tint, rim: AERO.rim, glow: false, radius: 18 }).setDepth(1000));
  const title = keep(scene.add.text(34, GAME_HEIGHT - 58, '', textStyle(18)).setDepth(1001));
  const body = keep(scene.add.text(34, GAME_HEIGHT - 34, '', textStyle(14, '#d8d0e0', { wordWrap: { width: right - 250 } })).setDepth(1001));
  keep(scene.add.text(right - 18, GAME_HEIGHT - 34, '← → move  ·  Enter open  ·  Esc leave', textStyle(13, '#a8c8e8')).setOrigin(1, 0.5).setDepth(1001));
  return { title, body };
}

const nameOf = (d: DistrictView): string => `${d.name}${d.count > 0 ? `   (${d.count})` : ''}`;
const colorOf = (d: DistrictView): number => (d.locked ? 0x6a6480 : d.color);

// ---------------- Aero Bubbles ----------------

function aero(ctx: StyleCtx): StyleFrame {
  const { scene, world, layout, motion } = ctx;
  const f = frameFor('aero');
  const at = aim(world, f.scale, f.cx, f.cy);
  world.root.setPosition(at.x, at.y);
  const hud: Phaser.GameObjects.GameObject[] = [];
  // Soft sky sheen over the top of the screen.
  const sheen = scene.add.graphics().setDepth(500);
  sheen.fillGradientStyle(0x8cdcff, 0x8cdcff, 0x8cdcff, 0x8cdcff, 0.45, 0.45, 0, 0).fillRect(0, 0, GAME_WIDTH, 200);
  const ring = districtHits(ctx);
  // A glossy count bubble over each district, bobbing.
  layout.districts.forEach((d, i) => {
    const s = px(spotOf(d).label);
    const c = colorOf(d);
    const r = 22;
    const g = scene.add.graphics();
    g.fillStyle(0xc8f0ff, 0.25).fillCircle(0, 0, r + 8);
    g.fillStyle(c, 0.88).fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.4).fillEllipse(-4, -r * 0.45, r * 1.3, r * 0.7);
    g.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, r);
    const n = scene.add.text(0, 2, d.locked ? '…' : String(d.count), textStyle(18, '#ffffff', { stroke: '#203060', strokeThickness: 4 })).setOrigin(0.5);
    const label = scene.add.text(0, r + 12, d.name, textStyle(12, '#1e3c6e', { backgroundColor: '#ffffffdd', padding: { x: 6, y: 2 } })).setOrigin(0.5);
    const bubble = world.pin(scene.add.container(0, 0, [g, n, label]), s.x, s.y + T);
    if (motion === 'full') scene.tweens.add({ targets: bubble, y: bubble.y - 10, duration: 1300 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
  // Rising ambient bubbles.
  if (motion !== 'off') {
    for (let i = 0; i < 14; i++) {
      const b = scene.add.circle((i * 97) % GAME_WIDTH, GAME_HEIGHT + 20, 4 + (i % 5) * 2, 0xffffff, 0.12).setStrokeStyle(2, 0xffffff, 0.55).setDepth(600);
      scene.tweens.add({ targets: b, y: -20, x: b.x + 40, duration: 9000 + i * 700, delay: i * 650, repeat: -1 });
    }
  }
  const headText = header(ctx, hud, 'Trainer Plaza', AERO.sky);
  // Glass dock: one orb per district.
  const keep = <O extends Phaser.GameObjects.GameObject>(o: O): O => (hud.push(o), o);
  const dockW = GAME_WIDTH - 60;
  const dx = (GAME_WIDTH - dockW) / 2;
  keep(drawGlass(scene, dx, GAME_HEIGHT - 62, dockW, 54, { tint: 0x8ad8ff, rim: 0xffffff, alpha: 0.75, radius: 26 }).setDepth(1000));
  const orbs: Phaser.GameObjects.Container[] = [];
  layout.districts.forEach((d, i) => {
    const x = dx + 16 + i * (dockW - 24) / layout.districts.length;
    const g = scene.add.graphics();
    g.fillStyle(colorOf(d), 1).fillCircle(18, 0, 17);
    g.fillStyle(0xffffff, 0.45).fillEllipse(18, -7, 24, 11);
    g.lineStyle(2, 0xffffff, 1).strokeCircle(18, 0, 17);
    const t = scene.add.text(40, 0, d.name.split(' ')[0]!, textStyle(12, '#163a6a')).setOrigin(0, 0.5);
    const orb = keep(scene.add.container(x, GAME_HEIGHT - 35, [g, t]).setDepth(1001).setSize(130, 44).setInteractive({ useHandCursor: true }));
    orb.on('pointerover', () => ctx.onFocus(i));
    orb.on('pointerdown', () => ctx.onPick(i));
    orbs.push(orb);
  });
  const sel = keep(scene.add.graphics().setDepth(1002));
  // Info card above the dock.
  keep(drawGlass(scene, dx + 60, GAME_HEIGHT - 108, dockW - 120, 40, { tint: AERO.glass, rim: AERO.rim, glow: false, radius: 14 }).setDepth(1000));
  const info = keep(scene.add.text(dx + 76, GAME_HEIGHT - 88, '', textStyle(13, '#ffffff', { wordWrap: { width: dockW - 300 } })).setOrigin(0, 0.5).setDepth(1001));
  keep(scene.add.text(dx + dockW - 74, GAME_HEIGHT - 88, '← →  Enter  Esc', textStyle(12, '#a8c8e8')).setOrigin(1, 0.5).setDepth(1001));
  return {
    hud,
    focus(i) {
      const d = layout.districts[i]!;
      placeRing(ring, d);
      const o = orbs[i]!;
      sel.clear().lineStyle(3, 0xfff07a, 1).strokeRoundedRect(o.x - 4, o.y - 22, o.width - 6, 44, 20);
      orbs.forEach((b, k) => b.setScale(k === i ? 1.08 : 1));
      info.setText(`${nameOf(d)}  ·  ${ctx.blurb(d)}`);
    },
    refreshHead: () => headText.setText(ctx.head()),
  };
}

// ---------------- Regional Looks ----------------

function seasons(ctx: StyleCtx): StyleFrame {
  const { scene, world, layout, motion } = ctx;
  const f = frameFor('seasons');
  const at = aim(world, f.scale, f.cx, f.cy);
  world.root.setPosition(at.x, at.y);
  const look = PLAZA_SEASONS[ctx.season];
  scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, look.tint, look.alpha).setOrigin(0, 0).setDepth(500);
  const ring = districtHits(ctx);
  layout.districts.forEach((d) => {
    const s = px(spotOf(d).label);
    world.pin(pill(scene, d.name, colorOf(d), d.locked ? null : d.count), s.x, s.y + 2.2 * T);
  });
  // Season particles: petals and leaves drift, snow falls, dusk haze glows.
  const n = motion === 'off' ? 0 : motion === 'reduced' ? 14 : 46;
  for (let i = 0; i < n; i++) {
    const x = (i * 131) % GAME_WIDTH;
    const y = (i * 71) % GAME_HEIGHT;
    if (look.fall === 'haze') {
      const m = scene.add.circle(x, y, 30 + (i % 4) * 12, look.particle, 0.08).setDepth(550);
      scene.tweens.add({ targets: m, x: x + 60, alpha: 0.16, duration: 6000 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      continue;
    }
    const p = look.fall === 'fall' ? scene.add.circle(x, -10, 2 + (i % 3), look.particle, 0.9) : scene.add.ellipse(x, -10, 7, 4, look.particle, 0.9);
    p.setDepth(550);
    scene.tweens.add({ targets: p, y: GAME_HEIGHT + 20, x: x + (look.fall === 'drift' ? 160 : 30), angle: look.fall === 'drift' ? 360 : 0, duration: (look.fall === 'fall' ? 7000 : 9000) + (i % 7) * 900, delay: (y / GAME_HEIGHT) * -8000 + i * 40, repeat: -1 });
  }
  const hud: Phaser.GameObjects.GameObject[] = [];
  const headText = header(ctx, hud, `Trainer Plaza  ·  ${look.name}`, mixColor(AERO.sky, look.tint, 0.45));
  const bar = infoBar(ctx, hud, mixColor(AERO.glass, look.tint, 0.2));
  return {
    hud,
    focus(i) {
      const d = layout.districts[i]!;
      placeRing(ring, d);
      bar.title.setText(nameOf(d));
      bar.body.setText(ctx.blurb(d));
    },
    refreshHead: () => headText.setText(ctx.head()),
  };
}

// ---------------- Diorama Island ----------------

function diorama(ctx: StyleCtx): StyleFrame {
  const { scene, world, layout, motion } = ctx;
  const f = frameFor('diorama');
  // Sky behind the island.
  const sky = scene.add.graphics().setDepth(-45);
  sky.fillGradientStyle(0x96d2ff, 0x96d2ff, 0xd8f0ff, 0xd8f0ff, 1, 1, 1, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  for (let i = 0; i < 5; i++) {
    const cloud = scene.add.container(120 + i * 260, 90 + (i % 3) * 190, [0, 1, 2].map((k) => scene.add.ellipse(k * 40 - 40, k === 1 ? -10 : 0, 90, 44, 0xffffff, 0.85))).setDepth(-44);
    if (motion === 'full') scene.tweens.add({ targets: cloud, x: cloud.x + 120, duration: 16000 + i * 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const w = MAP_W * f.scale;
  const h = MAP_H * f.scale;
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2 - 34;
  const left = cx - w / 2;
  const top = cy - h / 2;
  // Rocky underside, then the island itself (the map, masked to a rounded slab).
  const under = scene.add.graphics().setDepth(-43);
  under.fillStyle(0x8c6040, 1).fillPoints([{ x: left + 8, y: top + h - 20 }, { x: left + w - 8, y: top + h - 20 }, { x: left + w * 0.8, y: top + h + 70 }, { x: cx + 20, y: top + h + 120 }, { x: left + w * 0.2, y: top + h + 80 }], true);
  under.fillStyle(0x6e4a2e, 1).fillPoints([{ x: left + 60, y: top + h + 10 }, { x: left + w - 60, y: top + h + 10 }, { x: left + w * 0.72, y: top + h + 60 }, { x: cx + 10, y: top + h + 100 }, { x: left + w * 0.28, y: top + h + 64 }], true);
  world.root.setScale(f.scale).setPosition(left, top);
  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff).fillRoundedRect(left, top, w, h, 36);
  world.root.setMask(maskShape.createGeometryMask());
  const rim = scene.add.graphics().setDepth(400);
  rim.lineStyle(4, 0xffffff, 0.7).strokeRoundedRect(left, top, w, h, 36);
  // Tilt-shift: pale fades at the island's far and near edges.
  const fade = scene.add.graphics().setDepth(450);
  fade.fillGradientStyle(0xe8f6ff, 0xe8f6ff, 0xe8f6ff, 0xe8f6ff, 0.55, 0.55, 0, 0).fillRect(left, top, w, 60);
  fade.fillGradientStyle(0xe8f6ff, 0xe8f6ff, 0xe8f6ff, 0xe8f6ff, 0, 0, 0.45, 0.45).fillRect(left, top + h - 50, w, 50);
  if (motion === 'full') scene.tweens.add({ targets: [world.root, under, rim, fade], y: '-=6', duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const ring = districtHits(ctx);
  layout.districts.forEach((d) => {
    const s = px(spotOf(d).label);
    world.pin(pill(scene, d.name, colorOf(d), d.locked ? null : d.count, 14), s.x, s.y + T);
  });
  // Wii-style channel bar.
  const hud: Phaser.GameObjects.GameObject[] = [];
  const keep = <O extends Phaser.GameObjects.GameObject>(o: O): O => (hud.push(o), o);
  const bar = keep(scene.add.graphics().setDepth(1000));
  bar.fillStyle(0x000000, 0.12).fillRoundedRect(28, GAME_HEIGHT - 66, GAME_WIDTH - 56, 58, 29);
  bar.fillGradientStyle(0xffffff, 0xffffff, 0xe6eef6, 0xe6eef6, 1, 1, 1, 1).fillRoundedRect(24, GAME_HEIGHT - 70, GAME_WIDTH - 48, 58, 29);
  bar.lineStyle(3, 0xaac8e6, 1).strokeRoundedRect(24, GAME_HEIGHT - 70, GAME_WIDTH - 48, 58, 29);
  keep(scene.add.text(52, GAME_HEIGHT - 62, 'Plaza Channel', textStyle(12, '#5a82b4')).setDepth(1001));
  const name = keep(scene.add.text(52, GAME_HEIGHT - 44, '', textStyle(16, '#3a5a8a')).setDepth(1001));
  const body = keep(scene.add.text(270, GAME_HEIGHT - 41, '', textStyle(12, '#5a6a8a', { wordWrap: { width: 430 } })).setOrigin(0, 0.5).setDepth(1001));
  const money = keep(scene.add.text(GAME_WIDTH - 96, GAME_HEIGHT - 41, ctx.head(), textStyle(11, '#5a6a8a', { wordWrap: { width: 150 }, align: 'right' })).setOrigin(1, 0.5).setDepth(1001));
  keep(scene.add.circle(GAME_WIDTH - 62, GAME_HEIGHT - 41, 20, 0xffffff).setStrokeStyle(4, 0x3c96e6).setDepth(1001));
  keep(scene.add.text(GAME_WIDTH - 62, GAME_HEIGHT - 40, 'A', textStyle(18, '#3c96e6')).setOrigin(0.5).setDepth(1001));
  const ev = layout.view.event;
  keep(scene.add.text(GAME_WIDTH / 2, 22, `Trainer Plaza  ·  ${layout.title}  ·  ${ev.name}`, textStyle(14, '#2a4a7a', { backgroundColor: '#ffffffcc', padding: { x: 12, y: 4 } })).setOrigin(0.5, 0).setDepth(1001));
  return {
    hud,
    focus(i) {
      const d = layout.districts[i]!;
      placeRing(ring, d);
      name.setText(nameOf(d));
      body.setText(ctx.blurb(d));
    },
    refreshHead: () => money.setText(ctx.head()),
  };
}

// ---------------- Social Square ----------------

const MARK: Partial<Record<Wanderer['kind'], string>> = { rival: '!', foe: '!', rare: '★', caravan: '!', traveler: '?' };
const KIND_COLOR: Record<Wanderer['kind'], number> = { regular: 0x5aa05a, traveler: 0x3c8cc8, rival: 0xdc463c, foe: 0x5a4678, rare: 0xd8a830, caravan: 0xb48240, pokemon: 0x8888a0 };

function social(ctx: StyleCtx): StyleFrame {
  const { scene, world, layout, motion } = ctx;
  const f = frameFor('social');
  const start = layout.districts[0] ? px(spotOf(layout.districts[0]).stand) : { x: f.cx, y: f.cy };
  const at0 = aim(world, f.scale, start.x, start.y - 2 * T, GAME_WIDTH / 2 - 110);
  world.root.setPosition(at0.x, at0.y);
  const ring = districtHits(ctx);
  layout.districts.forEach((d) => {
    const s = px(spotOf(d).label);
    world.pin(pill(scene, d.name, colorOf(d), d.locked ? null : d.count, 14), s.x, s.y + 2.4 * T);
  });
  // Name tags and quest marks ride on each person.
  for (const w of layout.crowd) {
    const node = world.people.get(w.id);
    if (!node || w.kind === 'pokemon') continue;
    const inv = 1 / f.scale;
    const tag = scene.add.text(0, -70, w.name, textStyle(11, '#ffffff', { backgroundColor: hex(KIND_COLOR[w.kind]), padding: { x: 5, y: 2 } })).setOrigin(0.5).setScale(inv);
    node.add(tag);
    const mark = MARK[w.kind];
    if (mark) {
      const m = scene.add.container(0, -92, [scene.add.circle(0, 0, 11, 0xffdc3c).setStrokeStyle(2, 0x785000), scene.add.text(0, 1, mark, textStyle(14, '#5a3200')).setOrigin(0.5)]).setScale(inv);
      node.add(m);
      if (motion === 'full') scene.tweens.add({ targets: m, y: -98, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  const hud: Phaser.GameObjects.GameObject[] = [];
  const keep = <O extends Phaser.GameObjects.GameObject>(o: O): O => (hud.push(o), o);
  const headText = header(ctx, hud, 'Trainer Plaza  ·  Social Square');
  // Who's here: the people in the plaza and what they want.
  const people = layout.crowd.filter((w) => w.kind !== 'pokemon').slice(0, 8);
  const pw = 230;
  const px0 = GAME_WIDTH - pw - 16;
  keep(drawGlass(scene, px0, 80, pw, 40 + people.length * 40, { tint: 0xf4f8ff, rim: 0x5a8ad8, alpha: 0.94, glow: false, radius: 16 }).setDepth(1000));
  keep(scene.add.text(px0 + 14, 90, 'Around the plaza', textStyle(15, '#2a4a8a')).setDepth(1001));
  people.forEach((w, i) => {
    const y = 116 + i * 40;
    keep(scene.add.circle(px0 + 24, y + 10, 8, KIND_COLOR[w.kind]).setDepth(1001));
    keep(scene.add.text(px0 + 40, y, w.name, textStyle(12, '#283050')).setDepth(1001));
    const line = w.line.length > 30 ? `${w.line.slice(0, 29)}…` : w.line;
    keep(scene.add.text(px0 + 40, y + 16, line, textStyle(10, '#6a7090')).setDepth(1001));
  });
  const bar = infoBar(ctx, hud, AERO.glass, px0 - 12);
  let pan: Phaser.Tweens.Tween | null = null;
  return {
    hud,
    focus(i, instant) {
      const d = layout.districts[i]!;
      placeRing(ring, d);
      bar.title.setText(nameOf(d));
      bar.body.setText(ctx.blurb(d));
      const s = px(spotOf(d).stand);
      const to = aim(world, f.scale, s.x, s.y - 2 * T, GAME_WIDTH / 2 - 110);
      pan?.stop();
      if (instant || motion === 'off') world.root.setPosition(to.x, to.y);
      else pan = scene.tweens.add({ targets: world.root, x: to.x, y: to.y, duration: motion === 'reduced' ? 300 : 650, ease: 'Sine.easeInOut' });
    },
    refreshHead: () => headText.setText(ctx.head()),
  };
}

export function buildStyle(style: PlazaStyleId, ctx: StyleCtx): StyleFrame {
  if (style === 'seasons') return seasons(ctx);
  if (style === 'diorama') return diorama(ctx);
  if (style === 'social') return social(ctx);
  return aero(ctx);
}
