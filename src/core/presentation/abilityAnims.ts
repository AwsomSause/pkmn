// Ability animations by category, plus the battle-text animations. Both are
// registered in the central animation registry (animRegistry.ts) so they obey
// the motion, intensity, shake and particle settings in one place.

import { registerAnims, type AnimDef } from './animRegistry';

export type AbilityAnimKind =
  | 'weather' | 'terrain' | 'menace' | 'boost' | 'absorb' | 'contact'
  | 'guard' | 'heal' | 'form' | 'reveal' | 'aura' | 'trigger';

const CATEGORY_ABILITIES: Record<Exclude<AbilityAnimKind, 'trigger'>, string> = {
  weather: 'drizzle drought sand-stream snow-warning desolate-land primordial-sea delta-stream orichalcum-pulse hadron-engine',
  terrain: 'electric-surge grassy-surge psychic-surge misty-surge seed-sower',
  menace: 'intimidate unnerve pressure queenly-majesty armor-tail dazzling',
  boost: 'speed-boost moxie beast-boost defiant competitive justified rattled weak-armor stamina steadfast berserk anger-point anger-shell download intrepid-sword dauntless-shield chilling-neigh grim-neigh moody soul-heart flare-boost toxic-boost',
  absorb: 'volt-absorb water-absorb flash-fire sap-sipper storm-drain lightning-rod motor-drive levitate earth-eater dry-skin bulletproof soundproof good-as-gold wonder-guard well-baked-body wind-rider',
  contact: 'static flame-body poison-point effect-spore rough-skin iron-barbs cute-charm gooey tangling-hair mummy aftermath cursed-body perish-body stench toxic-debris innards-out wandering-spirit pickpocket magician',
  guard: 'sturdy multiscale disguise ice-face shadow-shield magic-guard magic-bounce mirror-armor shell-armor battle-armor clear-body full-metal-body white-smoke limber insomnia vital-spirit immunity own-tempo oblivious water-veil magma-armor pastel-veil sweet-veil flower-veil leaf-guard aroma-veil friend-guard',
  heal: 'regenerator natural-cure poison-heal healer shed-skin hydration rain-dish ice-body harvest cheek-pouch ripen cud-chew',
  form: 'zen-mode schooling stance-change power-construct hunger-switch zero-to-hero protean libero forecast color-change mimicry battle-bond tera-shift tera-shell teraform-zero shields-down imposter trace illusion comatose',
  reveal: 'forewarn frisk anticipation illuminate keen-eye',
  aura: 'dark-aura fairy-aura aura-break beads-of-ruin sword-of-ruin tablets-of-ruin vessel-of-ruin mold-breaker teravolt turboblaze neutralizing-gas air-lock cloud-nine',
};

const BY_ABILITY = new Map<string, AbilityAnimKind>();
for (const [kind, ids] of Object.entries(CATEGORY_ABILITIES)) for (const id of ids.split(' ')) BY_ABILITY.set(id, kind as AbilityAnimKind);

export const abilityKind = (abilityId: string): AbilityAnimKind => BY_ABILITY.get(abilityId) ?? 'trigger';
/** The registry id for an ability's animation. */
export const abilityAnimId = (abilityId: string): string => `ability.${abilityKind(abilityId)}`;

const ability = (kind: AbilityAnimKind, ms: number, color: string, glyph: string, extra: Partial<AnimDef> = {}): AnimDef =>
  ({ id: `ability.${kind}`, category: 'ability', ms, color, glyph, particles: true, trigger: 'ability event', fallback: 'ability.trigger', ...extra });

/** The spec's seven ability groups (6.1), for settings and the animation list. */
export type AbilityGroup = 'passive' | 'offensive' | 'defensive' | 'healing' | 'stat' | 'weather' | 'environmental';
export const ABILITY_GROUP: Record<AbilityAnimKind, AbilityGroup> = {
  weather: 'weather', terrain: 'environmental', menace: 'offensive', boost: 'stat', absorb: 'defensive', contact: 'offensive',
  guard: 'defensive', heal: 'healing', form: 'passive', reveal: 'passive', aura: 'environmental', trigger: 'passive',
};

registerAnims([
  ability('weather', 1100, '#78c8f8', '☁', { trigger: 'weather event with no move' }),
  ability('terrain', 1000, '#88d870', '◎', { trigger: 'terrain event with no move' }),
  ability('menace', 900, '#f85858', '!', { shakes: true, flashes: true, sound: 'se.stat_down' }),
  ability('boost', 900, '#f8d048', '▲', { sound: 'se.stat_up' }),
  ability('absorb', 900, '#58c8f0', '✦', { trigger: 'no-effect event after a move' }),
  ability('contact', 800, '#f8a838', '⚡', { shakes: true, flashes: true, sound: 'se.hit_weak' }),
  ability('guard', 900, '#98b0e8', '⬡', { sound: 'se.hit_weak' }),
  ability('heal', 1000, '#78f090', '✚', { trigger: 'heal event with no move', sound: 'se.exp' }),
  ability('form', 1100, '#c890f8', '✺', { flashes: true, trigger: 'form-change event', sound: 'se.shiny' }),
  ability('reveal', 900, '#f8f090', '?'),
  ability('aura', 1000, '#e870c8', '◈', { sound: 'se.shiny' }),
  ability('trigger', 800, '#d8e0f0', '•', { fallback: undefined }),
  // Battle text (6.2): the words that pop up on a hit, a miss, a stat change or a status.
  { id: 'text.super', category: 'text', ms: 900, color: '#f8a030', glyph: '★', particles: true, trigger: 'damage event, super effective', fallback: 'text.weak' },
  { id: 'text.crit', category: 'text', ms: 900, color: '#f8e050', glyph: '✹', shakes: true, particles: true, trigger: 'damage event, critical hit', fallback: 'text.weak' },
  { id: 'text.weak', category: 'text', ms: 900, color: '#a0a8b8', trigger: 'damage event, resisted' },
  { id: 'text.immune', category: 'text', ms: 900, color: '#8890a8', glyph: '⬡', trigger: 'no-effect event' },
  { id: 'text.miss', category: 'text', ms: 700, color: '#c8d0e0', trigger: 'miss event', text: 'MISS' },
  { id: 'text.statUp', category: 'text', ms: 800, color: '#68b8f8', glyph: '▲', trigger: 'stat event, rise', fallback: 'text.weak' },
  { id: 'text.statDown', category: 'text', ms: 800, color: '#f86868', glyph: '▼', trigger: 'stat event, drop', fallback: 'text.weak' },
  { id: 'text.status', category: 'text', ms: 900, color: '#f8b8e8', glyph: '✱', trigger: 'status event', fallback: 'text.weak' },
]);

const KINDS_BY_EVENT: Record<string, readonly AbilityAnimKind[]> = {
  weather: ['weather'],
  terrain: ['terrain'],
  noEffect: ['absorb', 'guard'],
  fail: ['guard'],
  heal: ['heal'],
  cured: ['heal'],
  stat: ['boost'],
  transform: ['form'],
};

/**
 * Abilities that change the battle without the engine announcing them (a weather setter, an absorb
 * immunity, end-of-turn healing, a stat boost after a KO, a form change). The presentation layer
 * works out which ability it must have been from the event and the ability on that side, so the
 * engine and its event log stay as they are. Returns the ability id, or null.
 */
export function impliedAbility(
  event: { type: string; side?: string },
  prev: { type: string; side?: string } | undefined,
  abilityOf: (side: 'player' | 'enemy') => string | null,
): { side: 'player' | 'enemy'; ability: string } | null {
  const kinds = KINDS_BY_EVENT[event.type];
  if (!kinds) return null;
  // The move's own effects and an announced ability already have their cue.
  if (prev && (prev.type === 'move' || prev.type === 'ability' || (event.type === 'stat' && prev.type === 'stat'))) {
    if (!(event.type === 'noEffect' && prev.type === 'move')) return null;
  }
  const sides = event.type === 'weather' || event.type === 'terrain' ? (['player', 'enemy'] as const) : event.side === 'player' || event.side === 'enemy' ? ([event.side] as const) : [];
  for (const side of sides) {
    const ability = abilityOf(side);
    if (ability && kinds.includes(abilityKind(ability))) return { side, ability };
  }
  return null;
}

const PACK_BY_ABILITY: Record<string, string> = {
  drizzle: 'common-rain', drought: 'common-sunny', 'sand-stream': 'common-sandstorm', 'snow-warning': 'common-snow',
  'electric-surge': 'electric-terrain', 'grassy-surge': 'grassy-terrain', 'misty-surge': 'misty-terrain', 'psychic-surge': 'psychic-terrain',
  trace: 'transform', imposter: 'transform', illusion: 'transform', 'magic-bounce': 'magic-coat', 'magic-coat': 'magic-coat', 'skill-swap': 'skill-swap',
  'shed-skin': 'refresh', 'natural-cure': 'heal-bell', hydration: 'refresh', forewarn: 'foresight', frisk: 'foresight', anticipation: 'foresight',
};
const PACK_BY_KIND: Partial<Record<AbilityAnimKind, string>> = {
  menace: 'scary-face', boost: 'work-up', heal: 'common-health-up', absorb: 'common-health-up', guard: 'common-protect',
  reveal: 'foresight', form: 'transform', aura: 'cosmic-power',
};

/** The pack animation (public/assets/battle-anims) that plays with an ability banner, and whether it lands on the foe. */
export function abilityPackAnim(abilityId: string): { name: string; onFoe: boolean } | null {
  const kind = abilityKind(abilityId);
  const name = PACK_BY_ABILITY[abilityId] ?? PACK_BY_KIND[kind];
  return name ? { name, onFoe: kind === 'menace' } : null;
}
