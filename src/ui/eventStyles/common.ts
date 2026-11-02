// Shared pieces for the event styles: choice colours and words, the arena backdrop, the cast and typed text.
import Phaser from 'phaser';
import { ATTRIBUTE_LABELS } from '../../core/attributes';
import type { AttributeKey } from '../../core/contentSchema';
import type { ChoiceView } from '../../core/events';
import { CHOICE_KIND_LABEL, type ChoiceKind } from '../../core/presentation/eventStyles';
import { services } from '../../game/services';
import { loadAssets } from '../lazyAssets';
import { pokemonVisual, trainerVisual } from '../sprites';
import { PIXEL_SCALE } from '../theme';
import type { EventCtx, EventHooks, Rect } from './types';

export const KIND_COLOR: Record<ChoiceKind, number> = { battle: 0xff5a5a, trade: 0x5fd0ff, chance: 0xffd84a, cost: 0x7fe08a, safe: 0xc8d0e0 };
export const LOCKED_COLOR = 0x6a6a7a;

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** The short tag on a choice: its odds ("55%"), a lock, or its kind ("BATTLE"). */
export function choiceTag(c: ChoiceView): string {
  if (c.locked) return '🔒';
  if (c.chance !== null) return `${Math.round(c.chance * 100)}%`;
  return CHOICE_KIND_LABEL[c.kind];
}

export function choiceColor(c: ChoiceView): number {
  return c.locked ? LOCKED_COLOR : KIND_COLOR[c.kind];
}

/** The focused option's three detail lines (the same words on every style). */
export function detailLines(c: ChoiceView): { odds: string; risk: string; cost: string } {
  const odds = c.locked ? `🔒 ${c.locked}` : c.chance !== null ? `${c.attribute ? `${ATTRIBUTE_LABELS[c.attribute as AttributeKey]}: ` : ''}${Math.round(c.chance * 100)}%` : '';
  const risk = c.locked ? (c.preview ?? '') : c.preview ? `${c.risk}\n${c.preview}` : c.risk;
  const cost = c.cost && !c.locked ? `Costs ${c.cost}` : '';
  return { odds, risk, cost };
}

/**
 * The stage arena drawn to cover `area` (cropped, never stretched), added to `into`.
 * Falls back to a flat panel in the event tint when the art is missing.
 */
export function drawArena(ctx: EventCtx, area: Rect, into: Phaser.GameObjects.Container, opts: { tint?: number } = {}): void {
  const { scene } = ctx;
  const flat = scene.add.rectangle(area.x, area.y, area.w, area.h, ctx.tint, 1).setOrigin(0);
  into.add(flat);
  const key = ctx.arena;
  if (!key) return;
  const place = () => {
    // (isActive() is false during create(), so check the panel instead.)
    if (!flat.active || !scene.textures.exists(key)) return;
    const frame = scene.textures.getFrame(key);
    const scale = Math.max(1, Math.ceil(Math.max(area.w / frame.width, area.h / frame.height)));
    const img = scene.add.image(area.x + area.w / 2, area.y + area.h / 2, key).setScale(scale);
    // Crop to the area (crop is in texture pixels, centred).
    const cw = Math.min(frame.width, area.w / scale);
    const ch = Math.min(frame.height, area.h / scale);
    img.setCrop((frame.width - cw) / 2, (frame.height - ch) / 2, cw, ch);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    into.addAt(img, into.getIndex(flat) + 1);
  };
  if (scene.textures.exists(key)) place();
  else void loadAssets(scene, [key]).then(place);
}

/** Where the cast stands: trainers spread over [x0, x1] on the ground line, the Pokémon at `monX`. */
export interface CastSpot {
  x0: number;
  x1: number;
  ground: number;
  trainerScale?: number;
  monX: number;
  monScale?: number;
  /** Trainers enter from this side. */
  from?: 'left' | 'right';
}

/** Places the cast (lazy-loaded) into `into`; they slide in, then bob gently unless motion is calm. */
export function placeCast(ctx: EventCtx, spot: CastSpot, into: Phaser.GameObjects.Container): void {
  const { scene, calm } = ctx;
  const ids = ctx.castIds;
  const tScale = spot.trainerScale ?? 2;
  const show = () => {
    if (!into.active) return;
    ids.forEach((id, i) => {
      const x = ids.length === 1 ? (spot.x0 + spot.x1) / 2 : spot.x0 + ((spot.x1 - spot.x0) * i) / (ids.length - 1);
      const startX = spot.from === 'left' ? x - 400 : x + 400;
      const sprite = trainerVisual(scene, id, '', calm ? x : startX, spot.ground, tScale) as unknown as Phaser.GameObjects.Sprite;
      sprite.setOrigin?.(0.5, 1);
      into.add(sprite);
      if (!calm) {
        scene.tweens.add({ targets: sprite, x, duration: 700, delay: i * 140, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: sprite, y: spot.ground - 6, duration: 900 + i * 150, delay: 700 + i * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
  };
  void loadAssets(scene, ids).then(show);
  if (ctx.species) {
    const mScale = spot.monScale ?? PIXEL_SCALE;
    const mon = pokemonVisual(scene, ctx.species, 'front', calm ? spot.monX : spot.monX - 300, spot.ground, mScale) as unknown as Phaser.GameObjects.Sprite;
    mon.setOrigin?.(0.5, 1);
    into.add(mon);
    if (!calm) {
      scene.tweens.add({ targets: mon, x: spot.monX, duration: 800, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: mon, y: spot.ground - 12, duration: 420, delay: 800, yoyo: true, repeat: -1, repeatDelay: 900, ease: 'Quad.easeOut' });
    }
  }
}

/** Types `full` into `text` a few letters at a time (instantly when calm or already read). */
export function typeOut(ctx: EventCtx, text: Phaser.GameObjects.Text, full: string): void {
  if (ctx.calm || ctx.introSeen) {
    text.setText(full);
    return;
  }
  let shown = 0;
  text.setText('');
  ctx.scene.time.addEvent({ delay: 14, repeat: full.length - 1, callback: () => text.setText(full.slice(0, ++shown)) });
}

/** A hit zone on a widget that focuses on hover and picks on click. */
export function hitZone(ctx: EventCtx, box: Phaser.GameObjects.Container, w: number, h: number, i: number, hooks: EventHooks, ox = 0, oy = 0): void {
  const zone = ctx.scene.add.zone(ox, oy, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => hooks.focus(i));
  zone.on('pointerdown', () => {
    hooks.focus(i);
    hooks.pick(i);
  });
  box.add(zone);
}

/** True when the art for an asset id exists in the pack. */
export const hasArt = (id: string): boolean => services().assets.has(id);

/** Bright Frutiger Aero glass: pale body, a white gloss on the top half, a sky tint below, and a rim. */
export function paintLightGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: { rim?: number; radius?: number; alpha?: number; tint?: number } = {}): Phaser.GameObjects.Graphics {
  const r = Math.min(opts.radius ?? 18, h / 2, w / 2);
  const inner = Math.max(0, r - 3);
  g.fillStyle(0x0a2a4a, 0.25).fillRoundedRect(x + 2, y + 4, w, h, r);
  g.fillStyle(opts.tint ?? 0xf2faff, opts.alpha ?? 0.92).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xbfe6ff, 0.35).fillRoundedRect(x + 3, y + h * 0.55, w - 6, h * 0.45 - 3, { tl: 0, tr: 0, bl: inner, br: inner });
  g.fillStyle(0xffffff, 0.6).fillRoundedRect(x + 4, y + 3, w - 8, h * 0.42, { tl: inner, tr: inner, bl: Math.min(6, inner), br: Math.min(6, inner) });
  g.lineStyle(2, opts.rim ?? 0xffffff, 1).strokeRoundedRect(x, y, w, h, r);
  return g;
}
