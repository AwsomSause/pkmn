// Advanced AI port (the "[000_AAI] Advanced AI System" pack, see docs/plans/aai-coverage.md).
// Pure scoring tweaks for a smart trainer's move choice. No random numbers and no state changes, so a tweak can only
// change which move a boss picks, never another roll. Every behaviour has a switch in balance.trainerAi.aai.

import type { Content, Move, TypeName } from '../contentSchema';
import { typeEffectiveness } from './damage';
import type { BattleState, PokemonInstance, Stages, Volatile } from '../state';

/** What the scorer knows about one matchup. Built once per move choice by the engine (see `moveValue`). */
export interface AaiView {
  content: Content;
  /** The battle (field, side effects, what the foe has used). Missing in bare unit tests. */
  battle?: BattleState;
  /** The side the user is on. */
  side: 'enemy' | 'player';
  user: PokemonInstance;
  target: PokemonInstance;
  userAbility: string | null;
  targetAbility: string | null;
  userTypes: readonly TypeName[];
  targetTypes: readonly TypeName[];
  userMax: number;
  targetMax: number;
  /** The user moves first (Speed, Trick Room aside). */
  userFaster: boolean;
  /** The user's own stat stages. */
  stages: Stages;
  /** The best attack score the user has (what a status move is measured against). */
  best: number;
  /** Fit Pokémon the target's side still has in reserve (hazards are worth more the more there are). */
  foeReserves: number;
  /** Fit teammates the user has in reserve. */
  ownReserves: number;
  /** The most damage the target can do to the user next turn, in HP (lazy; 0 when unknown). */
  threat: () => number;
}

const MOLD_BREAKERS = new Set(['mold-breaker', 'teravolt', 'turboblaze']);
const STATUS_LOVERS: Record<string, readonly string[]> = {
  guts: ['brn', 'par', 'psn', 'tox', 'slp'],
  'marvel-scale': ['brn', 'par', 'psn', 'tox', 'slp'],
  'quick-feet': ['brn', 'par', 'psn', 'tox', 'slp'],
  'toxic-boost': ['psn', 'tox'],
  'poison-heal': ['psn', 'tox'],
  'flare-boost': ['brn'],
};
const CHOICE_OR_BAD = new Set(['choice-band', 'choice-specs', 'choice-scarf', 'flame-orb', 'toxic-orb', 'sticky-barb', 'iron-ball', 'lagging-tail', 'ring-target']);

const vol = (v: AaiView, who: 'user' | 'target'): Volatile | undefined => {
  if (!v.battle) return undefined;
  const enemySide = (who === 'user') === (v.side === 'enemy');
  return enemySide ? v.battle.enemyVolatile : v.battle.playerVolatile;
};
const sideOf = (v: AaiView, who: 'user' | 'target') => {
  if (!v.battle) return undefined;
  const enemySide = (who === 'user') === (v.side === 'enemy');
  return enemySide ? v.battle.sideEffects.enemy : v.battle.sideEffects.player;
};
const holds = (mon: PokemonInstance, id: string) => (mon.held?.[id] ?? 0) > 0;
const pct = (hp: number, max: number) => hp / Math.max(1, max);
const grounded = (types: readonly TypeName[], ability: string | null) => !types.includes('flying') && ability !== 'levitate';

/** Moves the user has seen the target use this battle (Move Memory), or all its moves when there is no battle. */
export function knownMoves(v: AaiView): Move[] {
  const used = vol(v, 'target')?.movesUsed;
  const ids = used && v.battle ? used : v.target.moves.map((m) => m.id);
  return ids.map((id) => v.content.moves.get(id)).filter((m): m is Move => Boolean(m));
}

/** Damage tweaks for an attack from the target's ability (multiplies its score; also used for damage estimates). */
export function aaiDamageFactor(v: AaiView, move: Move): number {
  const cfg = v.content.balance.trainerAi.aai;
  let f = 1;
  if (cfg.abilityReads && !MOLD_BREAKERS.has(v.userAbility ?? '')) {
    const a = v.targetAbility;
    const flags = move.flags;
    const contact = flags.includes('contact');
    if ((a === 'soundproof' && flags.includes('sound')) || (a === 'bulletproof' && flags.includes('bullet')) || (a === 'wind-rider' && flags.includes('wind'))) return 0;
    if ((a === 'earth-eater' && move.type === 'ground') || (a === 'well-baked-body' && move.type === 'fire')) return 0;
    if (a === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) f *= 0.5;
    if ((a === 'heatproof' || a === 'water-bubble') && move.type === 'fire') f *= 0.5;
    if (a === 'purifying-salt' && move.type === 'ghost') f *= 0.5;
    if (a === 'dry-skin' && move.type === 'fire') f *= 1.25;
    if (a === 'fluffy') f *= move.type === 'fire' ? 2 : contact ? 0.5 : 1;
    if (a === 'ice-scales' && move.category === 'special') f *= 0.5;
    if (a === 'fur-coat' && move.category === 'physical') f *= 0.5;
    if ((a === 'multiscale' || a === 'shadow-shield') && v.target.hp >= v.targetMax) f *= 0.5;
    if ((a === 'filter' || a === 'solid-rock' || a === 'prism-armor') && superEffective(v, move)) f *= 0.75;
    // Disguise / Ice Face: the first hit only breaks the costume.
    if ((a === 'disguise' || (a === 'ice-face' && move.category === 'physical')) && !v.battle?.extra.brokenFace.includes(v.target.uid) && !move.effects.hits) f *= 0.3;
    // Facade doubles while the user has a status problem.
    if (move.id === 'facade' && v.user.status) f *= 2;
  }
  if (cfg.fieldPlay && v.battle) f *= fieldDamage(v, move);
  return f;
}

const umbrella = (m: PokemonInstance) => holds(m, 'utility-umbrella');
/** Weather and terrain on an attack's damage (Weather_Terrain_Wars, Field_Effects). */
function fieldDamage(v: AaiView, move: Move): number {
  let f = 1;
  const w = v.battle?.weather?.id;
  if ((w === 'rain' || w === 'sun') && !umbrella(v.target)) {
    const wet = w === 'rain';
    if (move.type === 'water') f *= wet ? 1.5 : 0.5;
    if (move.type === 'fire') f *= wet ? 0.5 : 1.5;
  }
  const t = v.battle?.terrain?.id;
  const userDown = grounded(v.userTypes, v.userAbility);
  const targetDown = grounded(v.targetTypes, v.targetAbility);
  if (t && userDown && ((t === 'electric' && move.type === 'electric') || (t === 'grassy' && move.type === 'grass') || (t === 'psychic' && move.type === 'psychic'))) f *= 1.3;
  if (t === 'misty' && targetDown && move.type === 'dragon') f *= 0.5;
  if (t === 'grassy' && targetDown && ['earthquake', 'bulldoze', 'magnitude'].includes(move.id)) f *= 0.5;
  if (t === 'psychic' && targetDown && move.priority > 0) return 0;
  return f;
}

const WEATHER_ABILITY: Record<string, string> = { 'swift-swim': 'rain', 'rain-dish': 'rain', 'dry-skin': 'rain', hydration: 'rain', chlorophyll: 'sun', 'solar-power': 'sun', 'leaf-guard': 'sun', 'flower-gift': 'sun', 'sand-rush': 'sand', 'sand-force': 'sand', 'sand-veil': 'sand', 'slush-rush': 'snow', 'snow-cloak': 'snow', 'ice-body': 'snow' };
const TERRAIN_ABILITY: Record<string, string> = { 'surge-surfer': 'electric', 'quark-drive': 'electric', 'hadron-engine': 'electric', 'grass-pelt': 'grassy' };
const WEATHER_TYPES: Record<string, { up: string[]; down: string[] }> = { rain: { up: ['water'], down: ['fire'] }, sun: { up: ['fire'], down: ['water'] }, sand: { up: ['rock', 'ground', 'steel'], down: [] }, snow: { up: ['ice'], down: [] }, hail: { up: ['ice'], down: [] } };
const TERRAIN_TYPES: Record<string, string[]> = { electric: ['electric'], grassy: ['grass'], psychic: ['psychic'], misty: ['fairy'] };

/** How much a weather or terrain helps one side: its attacks of the boosted types, its abilities that use it. */
function fieldGain(moves: readonly Move[], types: readonly TypeName[], ability: string | null, weather: string | null, terrain: string | null): number {
  let g = 0;
  const attacks = moves.filter((m) => m.category !== 'status');
  if (weather) {
    const wt = WEATHER_TYPES[weather]!;
    g += attacks.filter((m) => wt.up.includes(m.type)).length - attacks.filter((m) => wt.down.includes(m.type)).length;
    if (WEATHER_ABILITY[ability ?? ''] === weather) g += 2;
    if ((weather === 'sand' && types.some((t) => wt.up.includes(t))) || ((weather === 'snow' || weather === 'hail') && types.includes('ice'))) g += 1;
  }
  if (terrain) {
    g += attacks.filter((m) => TERRAIN_TYPES[terrain]!.includes(m.type)).length;
    if (TERRAIN_ABILITY[ability ?? ''] === terrain) g += 2;
  }
  return g;
}

/** Strategic tweaks for an attack (multiplies its score): recoil at low HP, Knock Off on a holder, Rapid Spin with hazards up. */
export function aaiTacticFactor(v: AaiView, move: Move): number {
  const cfg = v.content.balance.trainerAi.aai;
  let f = 1;
  if (cfg.recoil) {
    const userPct = pct(v.user.hp, v.userMax);
    const recoilShare = move.effects.recoilMaxHp ?? 0;
    if (recoilShare > 0 && userPct <= recoilShare) f *= 0.2;
    if (move.effects.crashOnMiss && (move.accuracy ?? 100) < 100 && userPct <= 0.5) f *= 0.7;
    if (move.effects.recoil && userPct <= 0.25) f *= 0.5;
    // Rough Skin, Iron Barbs and a Rocky Helmet hurt a low user that makes contact.
    const spiky = v.targetAbility === 'rough-skin' || v.targetAbility === 'iron-barbs' || holds(v.target, 'rocky-helmet');
    if (spiky && move.flags.includes('contact') && userPct <= 0.2) f *= 0.5;
  }
  // Priority tiers: a slower user picks off a worn-down target with a priority hit.
  if (cfg.fieldPlay && move.priority > 0 && !v.userFaster && pct(v.target.hp, v.targetMax) <= 0.25) f *= 1.3;
  if (cfg.disruption && move.effects.itemMove === 'knock' && Object.keys(v.target.held ?? {}).length > 0) f *= 1.5;
  if (cfg.specialMoves && move.effects.clearHazards) f *= hazardsOn(sideOf(v, 'user')) ? 1.5 : 1;
  return f;
}

const superEffective = (v: AaiView, move: Move) => typeEffectiveness(v.content.typeChart, move.type, v.targetTypes) > 1;

const hazardsOn = (side: ReturnType<typeof sideOf>) => Boolean(side && (side.spikes > 0 || side.toxicSpikes > 0 || side.stealthRock || side.stickyWeb));

/**
 * Attacks whose worth isn't their power (Final Gambit, Endeavor), or null to score them normally.
 * `best` is the best ordinary attack the user has.
 */
export function aaiSpecialAttack(v: AaiView, move: Move, best: number): number | null {
  if (!v.content.balance.trainerAi.aai.specialMoves) return null;
  if (move.effects.userFaint === 'finalGambit') return v.ownReserves > 0 && v.userFaster && v.user.hp >= v.target.hp ? best * 2 : 0;
  if (move.effects.endeavor) return v.target.hp > v.user.hp * 2 ? best * Math.min(2, (v.target.hp - v.user.hp) / Math.max(1, v.target.hp) * 2) : 0;
  return null;
}

/** True when a hit that should KO will leave the target at 1 HP instead (Sturdy, an unused Focus Sash, at full HP). */
export function aaiSurvivesKo(v: AaiView): boolean {
  if (!v.content.balance.trainerAi.aai.abilityReads || v.target.hp < v.targetMax) return false;
  if (v.targetAbility === 'sturdy' && !MOLD_BREAKERS.has(v.userAbility ?? '')) return true;
  return holds(v.target, 'focus-sash') && !(v.battle?.held.used[v.target.uid]?.['focus-sash'] ?? 0);
}

/**
 * The value of a status move after the AAI reads, or null when no AAI rule covers it
 * (the engine's own rule then decides). 0 means "don't".
 */
export function aaiStatusValue(v: AaiView, move: Move): number | null {
  const cfg = v.content.balance.trainerAi.aai;
  const fx = move.effects;
  const best = v.best;
  const targetVol = vol(v, 'target');
  const userVol = vol(v, 'user');
  const targetSide = sideOf(v, 'target');
  const userSide = sideOf(v, 'user');
  const hitsFoe = move.target === 'enemy';

  if (cfg.abilityReads && hitsFoe && !MOLD_BREAKERS.has(v.userAbility ?? '')) {
    // Magic Bounce sends it back; Good as Gold ignores it; Prankster status moves fail on Dark types.
    if (v.targetAbility === 'magic-bounce' || v.targetAbility === 'good-as-gold') return 0;
    if (v.userAbility === 'prankster' && v.targetTypes.includes('dark')) return 0;
  }
  if (cfg.repetition && fx.protect && userVol?.lastMove && v.content.moves.get(userVol.lastMove)?.effects.protect) return 0;

  if (cfg.statusTiming && fx.status && hitsFoe) {
    if ((targetVol?.substitute ?? 0) > 0) return 0;
    if ((targetSide?.safeguard ?? 0) > 0) return 0;
    const ground = grounded(v.targetTypes, v.targetAbility);
    if (v.battle?.terrain?.id === 'misty' && ground) return 0;
    if (v.battle?.terrain?.id === 'electric' && ground && fx.status.id === 'slp') return 0;
    if ((STATUS_LOVERS[v.targetAbility ?? ''] ?? []).includes(fx.status.id)) return 0;
    if (v.targetAbility === 'synchronize' && fx.status.id !== 'slp' && !v.user.status && !v.target.status) return scaleStatus(v, move, 0.5);
  }

  if (cfg.disruption && fx.disrupt) {
    const known = knownMoves(v);
    const last = targetVol?.lastMove ? v.content.moves.get(targetVol.lastMove) : undefined;
    switch (fx.disrupt) {
      case 'taunt':
        return (targetVol?.taunt ?? 0) > 0 || !known.some((m) => m.category === 'status') ? 0 : best * 0.6;
      case 'encore':
        return last && last.category === 'status' && !last.effects.protect ? best * 0.9 : 0;
      case 'disable':
        return last && last.category !== 'status' && !targetVol?.disabled ? best * 0.4 : 0;
      case 'healBlock':
        return (targetVol?.healBlock ?? 0) === 0 && known.some((m) => m.effects.heal) ? best * 0.5 : 0;
      case 'torment':
        return targetVol?.torment ? 0 : best * 0.2;
      default:
        break;
    }
  }
  if (cfg.disruption && (fx.itemMove === 'swap' || fx.itemMove === 'steal')) {
    const mine = Object.keys(v.user.held ?? {});
    const theirs = Object.keys(v.target.held ?? {});
    if (fx.itemMove === 'swap') return mine.some((i) => CHOICE_OR_BAD.has(i)) && !theirs.some((i) => CHOICE_OR_BAD.has(i)) ? best * 0.8 : 0;
    return theirs.length > 0 && mine.length === 0 ? best * 0.4 : 0;
  }

  if (cfg.specialMoves) {
    const userPct = pct(v.user.hp, v.userMax);
    const targetPct = pct(v.target.hp, v.targetMax);
    if (fx.painSplit) return targetPct > userPct + 0.2 ? best * (targetPct - userPct) * 2 : 0;
    if (fx.destinyBond) return !v.userFaster && v.threat() >= v.user.hp && v.ownReserves >= 0 && !userVol?.destinyBond ? best * 1.5 : 0;
    if (fx.substitute) return (userVol?.substitute ?? 0) === 0 && userPct > 0.5 ? best * 0.4 : 0;
    if (fx.userFaint) {
      if (v.ownReserves === 0) return 0;
      return userPct < 0.25 ? best * 0.7 : 0;
    }
    if (fx.clearHazards) return hazardsOn(userSide) ? best * 0.8 : 0;
  }

  if (cfg.fieldPlay && (fx.weather || fx.terrain)) {
    if ((fx.weather && v.battle?.weather?.id === fx.weather) || (fx.terrain && v.battle?.terrain?.id === fx.terrain)) return 0;
    const ownMoves = v.user.moves.map((m) => v.content.moves.get(m.id)).filter((m): m is Move => Boolean(m));
    const mine = fieldGain(ownMoves, v.userTypes, v.userAbility, fx.weather ?? null, fx.terrain ?? null);
    const theirs = fieldGain(knownMoves(v), v.targetTypes, v.targetAbility, fx.weather ?? null, fx.terrain ?? null);
    return Math.max(0, Math.min(1, 0.2 + 0.25 * (mine - theirs))) * best;
  }
  if (cfg.fieldPlay && fx.field === 'trickRoom') {
    const up = (v.battle?.field.trickRoom ?? 0) > 0;
    // userFaster already counts Trick Room; set it only when it makes a slower user faster, never undo it while it helps.
    return up ? (v.userFaster ? 0 : best * 0.6) : v.userFaster ? 0 : best * 0.8;
  }
  if (cfg.fieldPlay && fx.status?.id === 'par' && hitsFoe && !v.target.status) {
    const k = v.userFaster ? 0.7 : 1.3;
    return scaleStatus(v, move, k);
  }

  if (cfg.sideMoves && fx.sideMove) {
    const s = fx.sideMove;
    if (s === 'spikes' || s === 'toxicSpikes' || s === 'stealthRock' || s === 'stickyWeb') {
      if (!targetSide) return v.foeReserves > 0 ? best * 0.3 : 0;
      const full = s === 'spikes' ? targetSide.spikes >= 3 : s === 'toxicSpikes' ? targetSide.toxicSpikes >= 2 : targetSide[s];
      return full || v.foeReserves === 0 ? 0 : best * Math.min(0.9, 0.3 * v.foeReserves);
    }
    const up = userSide ? (userSide[s] as number) > 0 : false;
    if (up) return 0;
    if (s === 'auroraVeil') return v.battle?.weather?.id === 'hail' || v.battle?.weather?.id === 'snow' ? best * 0.6 : 0;
    if (s === 'reflect' || s === 'lightScreen') {
      const known = knownMoves(v).filter((m) => m.category !== 'status');
      const wanted = s === 'reflect' ? 'physical' : 'special';
      return known.length === 0 || known.some((m) => m.category === wanted) ? best * 0.5 : 0.05 * best;
    }
    if (s === 'tailwind') return v.userFaster ? best * 0.1 : best * 0.6;
    return best * 0.15;
  }

  if (cfg.setupSafety) {
    const foeStages = v.battle ? (v.side === 'enemy' ? v.battle.playerStages : v.battle.enemyStages) : undefined;
    const foeBoost = foeStages ? Object.values(foeStages).reduce((a, n) => a + Math.max(0, n ?? 0), 0) : 0;
    if (fx.forceSwitch || fx.resetStages) return foeBoost >= 2 ? best * 1.2 : fx.forceSwitch ? best * 0.1 : 0;
    const boosts = (fx.statChanges ?? []).filter((c) => c.target === 'self' && c.stages > 0);
    if ((boosts.length > 0 || fx.hpCost) && v.threat() >= v.user.hp * (fx.hpCost ? 1 - fx.hpCost.fraction : 1)) return 0;
  }
  return null;
}

function scaleStatus(v: AaiView, move: Move, k: number): number {
  const s = move.effects.status!;
  const weight = s.id === 'slp' ? 1.1 : s.id === 'par' || s.id === 'brn' ? 0.8 : 0.5;
  return v.best * weight * ((move.accuracy ?? 100) / 100) * k;
}
