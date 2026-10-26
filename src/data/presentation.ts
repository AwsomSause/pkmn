// Presentation data (how moves look), loaded apart from the game rules'
// content so the battle engine never sees it. Validated on first use.

import { parseMoveAnims, type MoveAnims } from '../core/presentation/moveAnims';
import moveAnimsJson from './moveAnims.json';

let cached: MoveAnims | null = null;

export function moveAnims(): MoveAnims {
  cached ??= parseMoveAnims(moveAnimsJson);
  return cached;
}
