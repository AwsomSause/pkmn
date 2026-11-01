// Signature flourishes for Legendary world events: twelve shapes, each registered in the central animation registry
// (category 'legend'). Which event uses which shape is data in core/legendary/visuals.ts; the drawing is in ui/legendFx.ts.
// Pure data, no Phaser and no random numbers.

import { registerAnims } from './animRegistry';

export const LEGEND_SHAPES = ['wave', 'flame', 'bolt', 'frost', 'shadow', 'warp', 'leaf', 'stone', 'steel', 'dream', 'gale', 'light'] as const;
export type LegendShape = (typeof LEGEND_SHAPES)[number];

export const legendAnimId = (shape: LegendShape): string => `legend.${shape}`;

registerAnims([
  { id: 'legend.wave', category: 'legend', ms: 1500, color: '#6fd0ff', glyph: '≈', trigger: 'Legendary event title card (sea)', particles: true },
  { id: 'legend.flame', category: 'legend', ms: 1500, color: '#ff9a40', glyph: '♨', trigger: 'Legendary event title card (fire)', particles: true, flashes: true },
  { id: 'legend.bolt', category: 'legend', ms: 1200, color: '#fff27a', glyph: 'ϟ', trigger: 'Legendary event title card (thunder)', flashes: true, shakes: true },
  { id: 'legend.frost', category: 'legend', ms: 1500, color: '#d8f4ff', glyph: '❄', trigger: 'Legendary event title card (ice)', particles: true },
  { id: 'legend.shadow', category: 'legend', ms: 1600, color: '#8a60c8', glyph: '◐', trigger: 'Legendary event title card (dark)', flashes: true },
  { id: 'legend.warp', category: 'legend', ms: 1500, color: '#d890ff', glyph: '◎', trigger: 'Legendary event title card (space and time)', shakes: true },
  { id: 'legend.leaf', category: 'legend', ms: 1500, color: '#a8f08a', glyph: '❦', trigger: 'Legendary event title card (forest)', particles: true },
  { id: 'legend.stone', category: 'legend', ms: 1300, color: '#d8c0a0', glyph: '◆', trigger: 'Legendary event title card (stone)', shakes: true, particles: true },
  { id: 'legend.steel', category: 'legend', ms: 1500, color: '#d0dce8', glyph: '⚙', trigger: 'Legendary event title card (steel)', flashes: true },
  { id: 'legend.dream', category: 'legend', ms: 1700, color: '#ffc8f0', glyph: '✧', trigger: 'Legendary event title card (dream)', particles: true },
  { id: 'legend.gale', category: 'legend', ms: 1300, color: '#c8f0b0', glyph: '≋', trigger: 'Legendary event title card (sky)', particles: true },
  { id: 'legend.light', category: 'legend', ms: 1600, color: '#fff0b0', glyph: '✦', trigger: 'Legendary event title card (light)', flashes: true, particles: true },
]);
