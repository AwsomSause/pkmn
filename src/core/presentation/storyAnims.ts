// Hyper/Overdrive (6.4), interaction (6.3) and rival (6.5) animations, all
// registered in the central animation registry (animRegistry.ts). Which story
// moment plays which animation is data here; the drawing is in
// ui/battleFx/storyFx.ts. Pure data, no Phaser and no random numbers.

import { registerAnims } from './animRegistry';

export type OverdriveAnimKind = 'toughened' | 'hung' | 'rise' | 'bond' | 'rivalry' | 'flair' | 'emotion' | 'rage' | 'moment';

const HYPER_BY_KIND: Record<Exclude<OverdriveAnimKind, 'moment'>, string> = {
  toughened: 'toughened-it-out',
  hung: 'hung-in-there second-wind not-given-up remembered-training broke-limits something-awakened instincts-took-over refused-weakness turned-pain',
  rise: 'pushed-back-up',
  bond:
    'felt-a-bond make-you-proud came-to-aid more-than-teammates knows-you-believe learned-something student-surpassed last-lesson different-ways understand-each-other wont-let-friend-fight wants-to-prove feels-left-out',
  rivalry: 'heated-rivalry friendly-competition bitter-rivalry rivalry-mutual friendly-tag generational-rivalry',
  flair: 'mega-overdrive all-of-its-heart giant-resolve true-colors signature-awakening evolved-beyond',
  emotion:
    'overdrive-determination overdrive-bravery overdrive-justice overdrive-kindness overdrive-patience overdrive-integrity overdrive-perseverance dual-emotion emotional-clash',
  rage: 'enemy-riled-up anger-dangerous fighting-beyond-limits lost-composure rival-resentment',
};

const BY_DEF = new Map<string, OverdriveAnimKind>();
for (const [kind, ids] of Object.entries(HYPER_BY_KIND)) for (const id of ids.split(' ')) BY_DEF.set(id, kind as OverdriveAnimKind);

/** The registry id for a Hyper/Overdrive moment (story.json definition id); unlisted ones get the small generic flourish. */
export const hyperAnimId = (defId: string): string => `overdrive.${BY_DEF.get(defId) ?? 'moment'}`;

registerAnims([
  // 6.4 Hyper/Overdrive: the exceptional moments get the biggest effects.
  { id: 'overdrive.toughened', category: 'overdrive', ms: 1100, color: '#fff2a8', glyph: '✦', shakes: true, flashes: true, particles: true },
  { id: 'overdrive.hung', category: 'overdrive', ms: 900, color: '#ffc860', glyph: '✦', shakes: true, particles: true },
  { id: 'overdrive.rise', category: 'overdrive', ms: 1800, color: '#ffe060', glyph: '▲', shakes: true, flashes: true, particles: true },
  { id: 'overdrive.bond', category: 'overdrive', ms: 1500, color: '#ff9ac8', glyph: '♥', flashes: true, particles: true },
  { id: 'overdrive.rivalry', category: 'overdrive', ms: 1300, color: '#ff6a38', glyph: '⚔', shakes: true, flashes: true, particles: true },
  { id: 'overdrive.flair', category: 'overdrive', ms: 1500, color: '#ffd040', glyph: '★', shakes: true, flashes: true, particles: true },
  { id: 'overdrive.emotion', category: 'overdrive', ms: 1200, color: '#b890ff', glyph: '✺', flashes: true, particles: true },
  { id: 'overdrive.rage', category: 'overdrive', ms: 1100, color: '#ff3048', glyph: '!', shakes: true, flashes: true },
  { id: 'overdrive.moment', category: 'overdrive', ms: 800, color: '#fff2a8', glyph: '•', particles: true },
  // 6.3 Interactions: short, rewarding, never slows play down much.
  { id: 'interaction.enter', category: 'interaction', ms: 600, color: '#9fe8ff', glyph: '✦', particles: true },
  { id: 'interaction.item', category: 'interaction', ms: 700, color: '#78f090', glyph: '✚', particles: true },
  { id: 'interaction.catch', category: 'interaction', ms: 1000, color: '#ffe060', glyph: '★', flashes: true, particles: true },
  { id: 'interaction.rare', category: 'interaction', ms: 1000, color: '#c890f8', glyph: '✧', flashes: true, particles: true },
  // 6.5 Rivals: their own presentation language, red and sharp.
  { id: 'rival.intro', category: 'rival', ms: 1700, color: '#ff3048', glyph: '✶', flashes: true, particles: true },
  { id: 'rival.ace', category: 'rival', ms: 1200, color: '#ff3048', glyph: '✶', shakes: true, flashes: true, particles: true },
  { id: 'rival.win', category: 'rival', ms: 1100, color: '#ffd040', glyph: '★', particles: true },
  { id: 'rival.lose', category: 'rival', ms: 1100, color: '#a0a8b8', glyph: '·' },
]);
