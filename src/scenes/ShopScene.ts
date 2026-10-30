// The shop beside a map node: buy items with run money, then leave.

import Phaser from 'phaser';
import { itemCount } from '../core/items';
import { mapItemSummary } from '../core/mapItems';
import { isBlackMarket, shopBadgesNeeded, shopPrice, shopStock } from '../core/run';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { itemVisual } from '../ui/sprites';
import { textStyle } from '../ui/theme';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';

export class ShopScene extends Phaser.Scene {
  private picker: Picker | null = null;

  constructor() {
    super('Shop');
  }

  preload(): void {
    preloadPokemon(this, partySpecies(), { icon: true });
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    const { session } = services();
    const run = session.run!;
    const content = session.content;
    playMusic(this, 'bgm.menu');

    // More stock unlocks with badges (shop.json minBadges).
    const stock = shopStock(content, run);
    const badgesFor = (e: (typeof content.shop)[number]) => shopBadgesNeeded(content, run, e);
    const next = content.shop.filter((e) => !stock.includes(e)).sort((a, b) => badgesFor(a) - badgesFor(b))[0];
    // Coupons and the Point Card show in the hint while they work.
    const working = mapItemSummary(content, run);
    const rows: PickerRow[] = stock.map((entry) => {
      const item = content.items.get(entry.item)!;
      const price = shopPrice(content, run, entry);
      // Member Card and Wepear Berry: sold before the badges would unlock it.
      const early = run.badges.length < badgesFor(entry);
      // Rocket Boss Giovanni's Black Market: locked stock, sold at a markup.
      const black = isBlackMarket(content, run, entry);
      return {
        problem: run.money < price ? `Not enough money for the ${item.name} (₽${price}, you have ₽${run.money}).` : null,
        hint: `${item.description}  ·  You have ₽${run.money}.${next ? `  New stock at ${badgesFor(next)} badges.` : ''}${working ? `  ·  ${working}` : ''}`,
        draw: (scene, box, w, h) => {
          box.add(itemVisual(scene, item.iconAssetId, 26, h / 2, 2));
          box.add(scene.add.text(56, h / 2, black ? `${item.name} (black market)` : early ? `${item.name} (early)` : item.name, textStyle(22, black ? '#d070f0' : early ? '#f0c060' : undefined)).setOrigin(0, 0.5));
          box.add(scene.add.text(w - 90, h / 2, price === 0 ? 'FREE' : `₽${price}`, textStyle(22)).setOrigin(1, 0.5));
          // Attribute items are used when bought, so there's no count in the Bag to show.
          if (item.effect.kind !== 'attribute') box.add(scene.add.text(w - 14, h / 2, `×${itemCount(run.inventory, entry.item)}`, textStyle(18, '#a69cb4')).setOrigin(1, 0.5));
        },
      };
    });

    this.picker = new Picker(this, {
      glass: true,
      title: data.notice ? `Shop  ·  ₽${run.money}  ·  ${data.notice}` : `Shop  ·  ₽${run.money}`,
      columns: 2,
      rowHeight: 52,
      rows,
      backLabel: 'leave',
      onSelect: (i) => {
        const message = session.buyItem(stock[i]!.item);
        playSfx(this, 'se.exp', 0.6);
        this.scene.restart({ notice: message.replace(/^You bought /, 'Bought '), focus: i });
      },
      onBack: () => {
        session.leaveShop();
        this.scene.start(sceneForRun(session.run!), { notice: 'Thanks for shopping!' });
      },
    });
    onInputAction(this, (action) => this.picker?.handle(action));
  }
}
