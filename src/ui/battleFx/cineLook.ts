// What the transformation cinematics (cinematics.ts) use and how long they
// run. No Phaser here, so tests can check it.

export type CineKind = 'mega' | 'primal' | 'dynamax' | 'gigantamax' | 'dynamaxEnd' | 'zmove' | 'tera';

/** Everything the cinematics draw, loaded when a battle starts. */
export const CINE_ASSETS = [
  'cine.primega.mega', 'cine.primega.alpha', 'cine.primega.omega',
  'cine.raid.max.bg', 'cine.raid.max.icon', 'cine.raid.max.spiral', 'cine.raid.max.spiral2',
  'cine.raid.ultra.bg', 'cine.raid.ultra.icon', 'cine.raid.tera.bg', 'cine.raid.tera.icon', 'cine.raid.tera.spiral',
  'cine.raid.transitions.black_bars', 'cine.raid.transitions.impact', 'cine.raid.transitions.shine',
  'cine.dbk.mega.orb_1', 'cine.dbk.mega.shine', 'cine.dbk.primal.icon_groudon', 'cine.dbk.primal.icon_kyogre',
];
/** Essentials animation sounds the cinematics use (already imported with the pack animations). */
export const CINE_SOUNDS = ['ess-harden', 'ess-twine', 'ess-refresh', 'ess-shell-smash', 'ess-explosion', 'ess-flash2'];

/** How long each cinematic runs at normal speed, in ms (full motion). */
export const CINE_MS: Record<CineKind, number> = { mega: 2500, primal: 2500, dynamax: 1800, gigantamax: 1800, dynamaxEnd: 650, zmove: 1900, tera: 1600 };
/** When the new form appears, in ms from the start. */
export const SWAP_AT: Record<CineKind, number> = { mega: 1350, primal: 1350, dynamax: 900, gigantamax: 900, dynamaxEnd: 250, zmove: 1900, tera: 800 };
