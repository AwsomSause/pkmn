// The shop beside a map node: buy items with run money, then leave. Shops redesign (Kice 2026-11-02):
// each shop stop is one of six kinds (core/presentation/shopTypes.ts) and draws with its style from
// ui/shopStyles/ (Poké Mart = Shop Channel, Aero Boutique = Aero Carousel, the rest come in later
// slices and draw as the Mart until then). This scene keeps the state, input and buying; a buy
// refreshes the style in place (no screen restart). Selling still uses the list picker.

import { clockLabel, periodOf, shopHoursMultiplier } from '../core/clock';
import Phaser from 'phaser';
import { itemCount } from '../core/items';
import { mapItemSummary } from '../core/mapItems';
import { shopScreenType, SHOP_TYPE_LABELS, type ShopTypeId } from '../core/shopTypes';
import { uiMotionLevel } from '../core/presentation/uiMotion';
import { isBlackMarket, sellPrice, shopBadgesNeeded, shopPrice, shopSaleItem, shopStock } from '../core/run';
import { services } from '../game/services';
import { playSfx, playMusicLazy } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { itemVisual } from '../ui/sprites';
import { shopView, type ShopView } from '../ui/shopLook';
import { shopLayout } from '../ui/shopStyles';
import type { ShopHandles } from '../ui/shopStyles/types';
import { textStyle } from '../ui/theme';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';

export class ShopScene extends Phaser.Scene {
  private picker: Picker | null = null;
  private handles: ShopHandles | null = null;
  private focusIndex = 0;
  /** The kind of shop on screen (tests read it). */
  shopType: ShopTypeId = 'mart';

  constructor() {
    super('Shop');
  }

  preload(): void {
    preloadPokemon(this, partySpecies(), { icon: true });
  }

  /** The shop as data for the styles. */
  private view(): ShopView {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const sale = shopSaleItem(content, run);
    const discount = content.balance.shopSale.discount;
    return shopView(content, run, {
      stock: shopStock(content, run),
      price: (e) => shopPrice(content, run, e),
      basePrice: (e) => Math.round(shopPrice(content, run, e) / (1 - discount)),
      badgesFor: (e) => shopBadgesNeeded(content, run, e),
      saleItem: sale,
      isBlack: (e) => isBlackMarket(content, run, e),
      canSell: Object.keys(run.inventory).some((id) => run.inventory[id]! > 0 && sellPrice(content, run, id) !== null),
      working: mapItemSummary(content, run),
    });
  }

  create(data: { notice?: string; focus?: number; sell?: boolean; type?: string } = {}): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    playMusicLazy(this, 'bgm.shop');
    this.picker = null;
    this.handles = null;

    if (data.sell) {
      this.createSell(data.notice);
      return;
    }
    const node = run.stage?.current ?? null;
    this.shopType = shopScreenType(
      { seed: run.seed, regionIndex: run.regionIndex, stageIndex: run.stage?.index ?? 0, nodeId: node, period: periodOf(run), blackMarket: shopStock(content, run).some((e) => isBlackMarket(content, run, e)) },
      data.type ?? (this.registry.get('shopTypeOverride') as string | undefined),
    );
    const hours = shopHoursMultiplier(content, run);
    let view = this.view();
    this.handles = shopLayout(this.shopType)(
      {
        scene: this,
        content,
        view,
        type: this.shopType,
        title: SHOP_TYPE_LABELS[this.shopType],
        clock: `${clockLabel(run)}${hours === 1 ? '' : hours < 1 ? ' (midday sale)' : ' (after-hours prices)'}`,
        party: run.party,
        motion: uiMotionLevel(session.settings),
        notice: data.notice,
      },
      { focus: (i) => this.setFocus(i), pick: (i) => this.pick(i) },
    );
    this.setFocus(Math.min(data.focus ?? 0, view.rows.length - (view.canSell ? 0 : 1)));

    onInputAction(this, (action) => {
      if (this.picker) return void this.picker.handle(action);
      if (action === 'back') return this.leave();
      if (action === 'confirm') return this.pick(this.focusIndex);
      view = this.view();
      const next = this.handles!.move(action, this.focusIndex);
      if (next !== this.focusIndex) {
        playSfx(this, 'ui.move', 0.4);
        this.setFocus(next);
      }
    });
  }

  private setFocus(i: number): void {
    if (i < 0) return;
    this.focusIndex = i;
    this.handles?.focus(i);
  }

  private pick(i: number): void {
    const { session } = services();
    const view = this.view();
    if (i >= view.rows.length) {
      if (view.canSell) this.scene.restart({ sell: true });
      return;
    }
    if (i !== this.focusIndex) this.setFocus(i);
    const row = view.rows[i]!;
    if (row.problem) {
      playSfx(this, 'ui.error', 0.6);
      this.handles?.refresh(view, null, row.problem);
      return;
    }
    let message: string;
    try {
      message = session.buyItem(row.itemId);
    } catch (e) {
      playSfx(this, 'ui.error', 0.6);
      this.handles?.refresh(view, null, (e as Error).message);
      return;
    }
    playSfx(this, 'ui.buy', 0.8);
    const after = this.view();
    const index = after.rows.findIndex((r) => r.itemId === row.itemId);
    this.handles?.refresh(after, index >= 0 ? index : null, message.replace(/^You bought /, 'Bought '));
  }

  private leave(): void {
    const { session } = services();
    session.leaveShop();
    this.scene.start(sceneForRun(session.run!), { notice: 'Thanks for shopping!' });
  }

  /** The sell list: every Bag item the shop will buy, with what it pays. */
  private createSell(notice?: string): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    const ids = Object.keys(run.inventory).filter((id) => run.inventory[id]! > 0 && sellPrice(content, run, id) !== null);
    const rows: PickerRow[] = ids.map((id) => {
      const item = content.items.get(id)!;
      const price = sellPrice(content, run, id)!;
      return {
        problem: null,
        hint: item.description,
        draw: (scene, box, w, h) => {
          box.add(itemVisual(scene, item.iconAssetId, 26, h / 2, 2));
          box.add(scene.add.text(56, h / 2, item.name, textStyle(22)).setOrigin(0, 0.5));
          box.add(scene.add.text(w - 90, h / 2, `₽${price}`, textStyle(22)).setOrigin(1, 0.5));
          box.add(scene.add.text(w - 14, h / 2, `×${itemCount(run.inventory, id)}`, textStyle(18, '#a69cb4')).setOrigin(1, 0.5));
        },
      };
    });
    this.picker = new Picker(this, {
      title: notice ? `Sell  ·  ₽${run.money}  ·  ${notice}` : `Sell  ·  ₽${run.money}`,
      columns: 2,
      rowHeight: 52,
      rows,
      backLabel: 'back',
      onSelect: (i) => {
        const message = session.sellItem(ids[i]!);
        playSfx(this, 'ui.buy', 0.8);
        this.scene.restart({ sell: true, notice: message.replace(/^You sold /, 'Sold ') });
      },
      onBack: () => this.scene.restart({}),
    });
    onInputAction(this, (action) => this.picker?.handle(action));
  }
}
