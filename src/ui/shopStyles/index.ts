// Shop styles by shop type (shops redesign). Types without a built style draw as the Poké Mart.
import type { ShopTypeId } from '../../core/shopTypes';
import { carousel } from './carousel';
import { mart } from './mart';
import type { ShopLayout } from './types';

export const SHOP_LAYOUTS: Partial<Record<ShopTypeId, ShopLayout>> = { mart, boutique: carousel };

export const shopLayout = (type: ShopTypeId): ShopLayout => SHOP_LAYOUTS[type] ?? mart;
