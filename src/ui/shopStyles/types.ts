// Contract between ShopScene (state, input, buying) and a shop style (how the shop is drawn).
// A style never changes game state: it draws, animates and reports focus/buy through the hooks.
import type Phaser from 'phaser';
import type { Content } from '../../core/contentSchema';
import type { PokemonInstance } from '../../core/state';
import type { ShopTypeId } from '../../core/shopTypes';
import type { InputAction } from '../input';
import type { ShopView } from '../shopLook';
import type { MotionLevel } from '../aero';

export interface ShopCtx {
  scene: Phaser.Scene;
  content: Content;
  view: ShopView;
  type: ShopTypeId;
  /** The shop's name on screen (e.g. "Poké Mart"). */
  title: string;
  /** "Day 1 · Morning", plus "(midday sale)" or "(after-hours prices)". */
  clock: string;
  party: PokemonInstance[];
  motion: MotionLevel;
  /** The notice from arriving (voucher trade, etc.), shown once. */
  notice?: string;
}

export interface ShopHooks {
  /** Pointer focus (hover). Index rows.length = the Sell button. */
  focus(i: number): void;
  /** Pointer pick: buys row i (or opens Sell at rows.length). */
  pick(i: number): void;
}

export interface ShopHandles {
  /** Moves focus for an arrow key; returns the new index (rows.length = Sell). */
  move(action: InputAction, from: number): number;
  focus(i: number): void;
  /** Redraws prices/money/owned after a buy, then plays the bought effect on row `bought`. */
  refresh(view: ShopView, bought: number | null, message: string | null): void;
}

export type ShopLayout = (ctx: ShopCtx, hooks: ShopHooks) => ShopHandles;
