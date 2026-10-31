// Map icons for event stops, by the event's `stop` type (events.json). The nine approved stop types
// each have their own colour and glyph; the rest of the event stops share the "!" icon.

export interface StopStyle {
  color: number;
  glyph: string;
  label: string;
}

export const DEFAULT_EVENT_STOP: StopStyle = { color: 0xd89830, glyph: '!', label: 'Event' };

export const STOP_STYLES: Record<string, StopStyle> = {
  special: { color: 0x7a5ae0, glyph: '★', label: 'Special encounter' },
  rare: { color: 0xf0c030, glyph: '✦', label: 'Rare Pokémon' },
  trade: { color: 0x30b0a8, glyph: '⇄', label: 'Trade' },
  detour: { color: 0xa87848, glyph: '↱', label: 'Detour' },
  merchant: { color: 0x4a4a68, glyph: '¤', label: 'Merchant' },
  rest: { color: 0xf08098, glyph: '♥', label: 'Rest spot' },
  shop: { color: 0x4878d0, glyph: '$', label: 'Shop' },
  heal: { color: 0xe06890, glyph: '+', label: 'Heal' },
};

export const stopStyle = (stop: string | undefined): StopStyle => (stop ? STOP_STYLES[stop] : undefined) ?? DEFAULT_EVENT_STOP;
