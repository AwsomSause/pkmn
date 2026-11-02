// Contract between EventScene (state, input, outcome) and an event style (how the event is drawn).
// A style never changes game state: it draws, animates and reports focus/pick through the hooks.
import type Phaser from 'phaser';
import type { Species } from '../../core/contentSchema';
import type { ChoiceView, EventView } from '../../core/events';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EventCtx {
  scene: Phaser.Scene;
  view: EventView;
  /** Reduced/off motion: no idle loops, instant entrances. */
  calm: boolean;
  /** The rarity colour. */
  rim: number;
  /** The event's backdrop tint. */
  tint: number;
  /** The location art: the event backdrop (Pokemon Memories) or the stage arena, when its art exists. Loaded lazily by drawArena. */
  arena?: string;
  /** Trainer/boss asset ids in the scene. */
  castIds: string[];
  /** The Pokémon in the scene, if any. */
  species?: Species;
  /** True when the player read this event in an earlier run (and wants seen text skipped). */
  introSeen: boolean;
  /** Draw layers: backdrop and cast, the ambient effect, then the interface. */
  layers: { back: Phaser.GameObjects.Container; fx: Phaser.GameObjects.Container; front: Phaser.GameObjects.Container };
  /** Call once the backdrop is drawn: adds the event tint and the Camp time-of-day wash over that area, and sets where the ambient effect plays. */
  dress(area: Rect): void;
}

export interface ChoiceWidget {
  box: Phaser.GameObjects.Container;
  focus(on: boolean): void;
}

export interface EventLayoutHandles {
  widgets: ChoiceWidget[];
  /** Show the focused option's odds, risk and cost. */
  detail(c: ChoiceView | undefined): void;
  /** Play the pick; returns the milliseconds to wait before the outcome panel. */
  picked(i: number): number;
  /** Where the money pill sits (its top-left); default top-right. */
  moneyAt?: { x: number; y: number };
}

export interface EventHooks {
  focus(i: number): void;
  pick(i: number): void;
}

export type EventLayout = (ctx: EventCtx, hooks: EventHooks) => EventLayoutHandles;
