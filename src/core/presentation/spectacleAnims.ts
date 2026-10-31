// Battle Drama spectacle animations (APPROVED section 7) in the central animation registry: the bond
// animations (`bond.*`: surviving, protecting, entering, signature) and the boss/momentum beats
// (`drama.*`). Which battle event plays which one is data here; the drawing is in
// ui/battleFx/storyFx.ts. Pure data, no Phaser, no random numbers; every one honours the animation
// switches (Disable All, Reduced, Off) through the registry.

import { registerAnims } from './animRegistry';
import type { SpectacleKind } from '../battle/spectacle';

/** The registry id each spectacle event plays (none = just the message). */
export const SPECTACLE_ANIM: Partial<Record<SpectacleKind, string>> = {
  lastStand: 'bond.survive',
  counter: 'bond.protect',
  revenge: 'bond.enter',
  signature: 'bond.signature',
  brace: 'drama.brace',
  guardUp: 'drama.guardup',
  guardRebuilt: 'drama.guardup',
  guardBreak: 'drama.guardbreak',
  rally: 'drama.rally',
  momentumFull: 'drama.momentum',
};

registerAnims([
  // Bond animations: only for deep bonds and rare moments, so they stay earned.
  { id: 'bond.survive', category: 'overdrive', ms: 1500, color: '#fff2a8', glyph: '♥', shakes: true, flashes: true, particles: true },
  { id: 'bond.protect', category: 'interaction', ms: 1000, color: '#9fe8ff', glyph: '✦', flashes: true, particles: true },
  { id: 'bond.enter', category: 'overdrive', ms: 1400, color: '#ff6a38', glyph: '⚔', shakes: true, flashes: true, particles: true },
  { id: 'bond.signature', category: 'interaction', ms: 1000, color: '#ff9ac8', glyph: '♥', flashes: true, particles: true },
  // Boss and momentum beats.
  { id: 'drama.brace', category: 'interaction', ms: 600, color: '#9fe8ff', glyph: '⛨', particles: true },
  { id: 'drama.guardup', category: 'interaction', ms: 700, color: '#b8b8d0', glyph: '⛨', particles: true },
  { id: 'drama.guardbreak', category: 'overdrive', ms: 1300, color: '#ffd040', glyph: '✸', shakes: true, flashes: true, particles: true },
  { id: 'drama.rally', category: 'overdrive', ms: 1200, color: '#ffe060', glyph: '⚡', shakes: true, flashes: true, particles: true },
  { id: 'drama.momentum', category: 'interaction', ms: 800, color: '#ffe060', glyph: '▲', flashes: true, particles: true },
]);
