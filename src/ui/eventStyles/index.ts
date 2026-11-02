// The event styles the player picks in Settings > Display (core/presentation/eventStyles.ts).
import type { EventStyleId } from '../../core/presentation/eventStyles';
import { cards } from './cards';
import { diorama } from './diorama';
import { novel } from './novel';
import { storybook } from './storybook';
import type { EventLayout } from './types';

export const EVENT_LAYOUTS: Partial<Record<EventStyleId, EventLayout>> = { diorama, storybook, novel, cards };

export function layoutFor(id: EventStyleId): EventLayout {
  return EVENT_LAYOUTS[id] ?? diorama;
}
