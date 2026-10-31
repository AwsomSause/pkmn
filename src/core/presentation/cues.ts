// The presentation-cue layer: turns the battle engine's events into a plan of
// what the screen should show (move animations, hit feedback, status effects).
//
// It runs after the engine has already decided the whole turn, reads only the
// events, the move list and the presentation data, and returns new objects.
// It never changes battle state and never draws random numbers, so the same
// turn always gets the same cues, and turning effects off can't change results.

import { moveFamily, type FamilyId } from './families';
import type { BattleEvent, Side } from '../battle/engine';
import type { Content } from '../contentSchema';
import { abilityAnimId } from './abilityAnims';
import { animChoice, commonChoice, presentationFor, type MoveAnims } from './moveAnims';

export type AnimationMode = 'full' | 'reduced' | 'off';

export interface PresentationSettings {
  /** full: move animations and screen effects; reduced: no flashing, shaking or big motion; off: skip animations. */
  mode: AnimationMode;
  /** 0–1: strength of screen shake and flashes. */
  intensity: number;
  /** 0–1: strength of screen shake alone; defaults to `intensity`. */
  shake?: number;
}

export type EffectivenessBadge = 'super' | 'weak' | 'immune';

export type Cue =
  /** A marker on the user before its move: its type colour, bigger for strong or priority moves. */
  | { kind: 'telegraph'; side: Side; color: string; style: 'normal' | 'strong' | 'quick' }
  /** Play the move's animation file (with the short fallback if it can't load). */
  | { kind: 'moveAnim'; user: Side; target: Side; anim: string; alt?: string; script?: string; color: string; family: FamilyId; moveType?: string; moveId?: string }
  /** The reduced-motion stand-in for a move animation: a soft tint on the target. */
  | { kind: 'pulse'; side: Side; color: string }
  /** A hit landing: freeze, shake, flash, then the HP bar drains. */
  | { kind: 'impact'; side: Side; amount: number; crit: boolean; effectiveness: number; hitStopMs: number; shake: number; flash: string | null; flashAlpha: number }
  /** The number that floats up from a Pokémon whose HP changed. */
  | { kind: 'number'; side: Side; amount: number; tone: 'damage' | 'crit' | 'super' | 'weak' | 'heal'; motion: boolean }
  | { kind: 'badge'; side: Side; badge: EffectivenessBadge | 'crit' }
  /** Status and healing animations (common-burn, common-health-up …). */
  | { kind: 'commonAnim'; side: Side; anim: string; alt?: string }
  | { kind: 'statArrows'; side: Side; up: boolean; motion: boolean }
  /** An ability triggering: banner with its name plus the category's flourish (registry id `ability.*`). */
  | { kind: 'abilityAnim'; side: Side; anim: string; label: string }
  /** The badge's animated words (registry id `text.*`); `miss` has no badge text of its own. */
  | { kind: 'textAnim'; side: Side; anim: string; label: string };

const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

/** Hex type colours for markers and fallbacks (match ui/theme TYPE_COLORS). */
const TYPE_HEX: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850',
  ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0',
  psychic: '#f85888', bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
  dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
};

/** Events that mean the move didn't connect, so its animation is skipped. */
const NO_CONTACT = new Set(['miss', 'noEffect', 'fail', 'noPp', 'protected', 'avoided', 'charge']);

/**
 * Plans the cues for one turn's events. The result has one list per event,
 * played just before that event's message. Events the plan doesn't know
 * (experience, level-ups …) get an empty list.
 */
export function planCues(
  events: readonly { type: string }[],
  content: Pick<Content, 'moves'> & Partial<Pick<Content, 'abilities'>>,
  anims: MoveAnims,
  settings: PresentationSettings,
): Cue[][] {
  const intensity = Math.min(1, Math.max(0, settings.intensity));
  const shakeLevel = Math.min(1, Math.max(0, settings.shake ?? settings.intensity));
  const full = settings.mode === 'full';
  const animated = settings.mode !== 'off';
  let current: { moveId: string; side: Side } | null = null;
  // A multi-hit move shows each badge once, not on every hit.
  let badged = new Set<string>();

  return events.map((raw, i) => {
    const e = raw as BattleEvent;
    const cues: Cue[] = [];
    switch (e.type) {
      case 'move': {
        current = { moveId: e.moveId, side: e.side };
        badged = new Set();
        const move = content.moves.get(e.moveId);
        if (!move || !animated) break;
        const look = presentationFor(anims, e.moveId);
        const color = TYPE_HEX[move.type] ?? '#ffffff';
        const next = events[i + 1];
        const connects = !next || !NO_CONTACT.has(next.type);
        cues.push({ kind: 'telegraph', side: e.side, color, style: look.telegraph });
        if (!connects) break;
        const target = move.target === 'self' ? e.side : other(e.side);
        if (full) cues.push({ kind: 'moveAnim', user: e.side, target, ...animChoice(look), ...(look.script ? { script: look.script } : {}), color, family: moveFamily(move, look), moveType: move.type, moveId: e.moveId });
        else cues.push({ kind: 'pulse', side: target, color });
        break;
      }
      case 'damage': {
        const look = current ? presentationFor(anims, current.moveId) : null;
        const crit = e.crit;
        const eff = e.effectiveness;
        if (animated) {
          const level = (look?.shake ?? 1) + (crit ? 1 : 0) + (eff > 1 ? 1 : 0);
          cues.push({
            kind: 'impact',
            side: e.side,
            amount: e.amount,
            crit,
            effectiveness: eff,
            hitStopMs: full ? Math.round((look?.hitStopMs ?? 60) * (crit ? 1.4 : 1) * (eff > 1 ? 1.2 : 1)) : 0,
            shake: full ? Math.round(Math.min(4, level) * 3 * shakeLevel) : 0,
            flash: full && (look?.flash || crit) ? (look?.flash ?? '#ffffff') : null,
            flashAlpha: full ? 0.35 * intensity : 0,
          });
        }
        cues.push({ kind: 'number', side: e.side, amount: e.amount, tone: crit ? 'crit' : eff > 1 ? 'super' : eff < 1 ? 'weak' : 'damage', motion: full });
        const badge = (kind: 'crit' | 'super' | 'weak') => {
          if (badged.has(`${e.side}:${kind}`)) return;
          badged.add(`${e.side}:${kind}`);
          cues.push({ kind: 'badge', side: e.side, badge: kind });
        };
        if (crit) badge('crit');
        if (eff > 1) badge('super');
        else if (eff < 1) badge('weak');
        break;
      }
      case 'noEffect':
        cues.push({ kind: 'badge', side: e.side, badge: 'immune' });
        break;
      case 'miss':
        if (animated) cues.push({ kind: 'textAnim', side: e.side, anim: 'text.miss', label: 'MISS' });
        break;
      case 'ability':
        if (animated) cues.push({ kind: 'abilityAnim', side: e.side, anim: abilityAnimId(e.ability), label: content.abilities?.get(e.ability)?.name ?? e.ability });
        break;
      case 'residual':
      case 'recoil':
      case 'confusionHit':
      case 'bindDamage':
      case 'seedDamage': {
        const common = e.type === 'residual' ? `status.${e.status}` : e.type === 'confusionHit' ? 'confusion' : e.type === 'bindDamage' ? 'bind' : e.type === 'seedDamage' ? 'seed' : '';
        if (full && common) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, common) });
        cues.push({ kind: 'number', side: e.side, amount: e.amount, tone: 'damage', motion: full });
        break;
      }
      case 'drain':
      case 'heal':
        if (e.amount <= 0) break;
        if (full) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, 'heal') });
        cues.push({ kind: 'number', side: e.side, amount: e.amount, tone: 'heal', motion: full });
        break;
      case 'charge': {
        const charge = presentationFor(anims, e.moveId).chargeAnim;
        if (full && charge) cues.push({ kind: 'commonAnim', side: e.side, anim: charge });
        break;
      }
      case 'weather':
        if (full) cues.push({ kind: 'commonAnim', side: 'player', ...commonChoice(anims, `weather.${e.weather}`) });
        break;
      case 'weatherDamage':
        cues.push({ kind: 'number', side: e.side, amount: e.amount, tone: 'damage', motion: full });
        break;
      case 'confused':
      case 'confusion':
        if (full) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, 'confusion') });
        break;
      case 'protect':
        if (full) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, 'protect') });
        break;
      case 'bound':
        if (full) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, 'bind') });
        break;
      case 'seeded':
        if (full) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, 'seed') });
        break;
      case 'status':
        if (full && anims.common[`status.${e.status}`]) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, `status.${e.status}`) });
        break;
      case 'cant':
        if (full && (e.reason === 'slp' || e.reason === 'frz' || e.reason === 'par')) cues.push({ kind: 'commonAnim', side: e.side, ...commonChoice(anims, `status.${e.reason}`) });
        break;
      case 'stat':
        if (animated) cues.push({ kind: 'statArrows', side: e.side, up: e.change > 0, motion: full });
        break;
      default:
        break;
    }
    return cues.filter((c) => c.kind !== 'commonAnim' || c.anim !== '');
  });
}
