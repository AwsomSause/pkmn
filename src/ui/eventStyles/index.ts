// The event styles the player picks in Settings > Display (core/presentation/eventStyles.ts).
import type { EventStyleId } from '../../core/presentation/eventStyles';
import { cards } from './cards';
import { cinematic } from './cinematic';
import { comic } from './comic';
import { cyber } from './cyber';
import { diorama } from './diorama';
import { novel } from './novel';
import { storybook } from './storybook';
import { wii } from './wii';
import type { EventLayout } from './types';

export const EVENT_LAYOUTS: Partial<Record<EventStyleId, EventLayout>> = { diorama, storybook, novel, cards, comic, cinematic, cyber, wii };

export function layoutFor(id: EventStyleId): EventLayout {
  return EVENT_LAYOUTS[id] ?? diorama;
}
