// The event styles the player picks in Settings > Display (core/presentation/eventStyles.ts).
import type { EventStyleId } from '../../core/presentation/eventStyles';
import { diorama } from './diorama';
import { storybook } from './storybook';
import type { EventLayout } from './types';

export const EVENT_LAYOUTS: Partial<Record<EventStyleId, EventLayout>> = { diorama, storybook };

export function layoutFor(id: EventStyleId): EventLayout {
  return EVENT_LAYOUTS[id] ?? diorama;
}
