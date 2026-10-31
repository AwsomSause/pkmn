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
  ({ id: `ability.${kind}`, category: 'ability', ms, color, glyph, particles: true, ...extra });

registerAnims([
  ability('weather', 1100, '#78c8f8', '☁'),
  ability('terrain', 1000, '#88d870', '◎'),
  ability('menace', 900, '#f85858', '!', { shakes: true, flashes: true }),
  ability('boost', 900, '#f8d048', '▲'),
  ability('absorb', 900, '#58c8f0', '✦'),
  ability('contact', 800, '#f8a838', '⚡', { shakes: true, flashes: true }),
  ability('guard', 900, '#98b0e8', '⬡'),
  ability('heal', 1000, '#78f090', '✚'),
  ability('form', 1100, '#c890f8', '✺', { flashes: true }),
  ability('reveal', 900, '#f8f090', '?'),
  ability('aura', 1000, '#e870c8', '◈'),
  ability('trigger', 800, '#d8e0f0', '•'),
  // Battle text (6.2): the words that pop up on a hit or miss.
  { id: 'text.super', category: 'text', ms: 900, color: '#f8a030', glyph: '★', particles: true },
  { id: 'text.crit', category: 'text', ms: 900, color: '#f8e050', glyph: '✹', shakes: true, particles: true },
  { id: 'text.weak', category: 'text', ms: 900, color: '#a0a8b8' },
  { id: 'text.immune', category: 'text', ms: 900, color: '#8890a8', glyph: '⬡' },
  { id: 'text.miss', category: 'text', ms: 700, color: '#c8d0e0' },
]);
