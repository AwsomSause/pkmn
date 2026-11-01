// Auto-Battle (spec §32): the player's Pokémon choose their own actions, each by its own character.
// Pure and RNG-free: the same run state gives the same pick, so a preview or a reload never changes it. The small "flair" that
// keeps two Pokémon of one species from acting identically is a hash of uid + turn + move, never a gameplay RNG stream.
// The pick is only a PlayerAction: the engine still checks it like any other command.

import { runPerks } from '../archetypes';
import { bondMood, freshBond } from '../bond';
import type { Content, Move } from '../contentSchema';
import { NATURES } from '../natures';
import { calcStats, getSpecies } from '../pokemon';
import { cheerProblem } from '../raid/raid';
import { doublesSwitchProblem, indexAt, monAt, stagesAt, volAt, type Spot } from './doubles';
import { noBattleItems } from '../rules';
import { currentEnemy, freshStages, type PokemonInstance, type RunState } from '../state';
import { emotionOf } from '../story/emotions';
import { mentorPathOf, mentorshipOf } from '../story/mentorship';
import { typeEffectiveness } from './damage';
import { estimateDamage, itemProblem, moveValue, switchProblem, telegraphedAttack, forcedMoveId, type EnemyBrain, type PlayerAction, type SlotAction, type SlotCommand } from './engine';
import { moveBlockReason } from './moveBlock';
import { rallyProblem } from './spectacle';
import { canDynamax, teraOption, zMoveOptions, type TransformRequest } from './transform';

/** What the trainer has taught a Pokémon to favour in Auto-Battle ("Trainer Instillment"); saved in the Pokémon's bond habits. */
export const STANCES = ['balanced', 'aggressive', 'cautious', 'protective', 'strategic'] as const;
export type Stance = (typeof STANCES)[number];
export const STANCE_INFO: Record<Stance, { name: string; line: string }> = {
  balanced: { name: 'Balanced', line: 'No special lesson: it follows its own nature.' },
  aggressive: { name: 'Aggressive', line: 'Hit hard, end fights fast.' },
  cautious: { name: 'Cautious', line: 'Stay safe, heal and guard when hurt.' },
  protective: { name: 'Protective', line: 'Look after hurt teammates, support first.' },
  strategic: { name: 'Strategic', line: 'Type matchups, status, set-up and clever switches.' },
};
const HABIT = 'stance';

/** The lesson taught to a Pokémon, or what its mentor's path implies, or balanced. */
export function stanceOf(run: RunState, uid: string): { stance: Stance; taught: boolean } {
  const taught = run.story.histories[uid]?.bond?.habits[HABIT];
  const found = STANCES.find((s) => s === taught);
  if (found) return { stance: found, taught: true };
  const rel = mentorshipOf(run, uid);
  if (rel) {
    const path = mentorPathOf(run, rel);
    const map: Partial<Record<typeof path, Stance>> = { striker: 'aggressive', challenger: 'aggressive', guardian: 'protective', survivor: 'cautious', strategist: 'strategic' };
    const s = map[path];
    if (s) return { stance: s, taught: false };
  }
  return { stance: 'balanced', taught: false };
}

/** Teaches a stance (returns a new run). Only Pokémon with a story history can be taught; others are left as they are. */
export function setStance(current: RunState, uid: string, stance: Stance): RunState {
  const run = structuredClone(current);
  const history = run.story.histories[uid];
  if (!history) return run;
  history.bond ??= freshBond(uid, history.joinedBy);
  if (stance === 'balanced') delete history.bond.habits[HABIT];
  else history.bond.habits[HABIT] = stance;
  return run;
}

// ---------- character ----------

export interface AutoProfile {
  /** Each tendency from about -1 to 1; 0 is neutral. */
  aggr: number;
  caution: number;
  support: number;
  strategy: number;
  risk: number;
  fear: number;
  anger: number;
  /** The word shown to the player: the strongest tendency. */
  style: string;
  /** Plain-language reasons behind it, for the review panel. */
  notes: string[];
}

type Tendency = Partial<Record<'aggr' | 'caution' | 'support' | 'strategy' | 'risk', number>>;
const TRAIT: Record<string, Tendency> = {
  brave: { aggr: 0.25, risk: 0.25, caution: -0.15 },
  competitive: { aggr: 0.3, risk: 0.15 },
  proud: { aggr: 0.2, risk: 0.2, strategy: -0.1 },
  playful: { risk: 0.2, strategy: 0.1 },
  curious: { strategy: 0.25, risk: 0.1 },
  independent: { risk: 0.15, support: -0.15 },
  stubborn: { aggr: 0.15, strategy: -0.2 },
  patient: { caution: 0.2, strategy: 0.25 },
  cautious: { caution: 0.35, risk: -0.2 },
  anxious: { caution: 0.3, risk: -0.3 },
  empathetic: { support: 0.35 },
  protective: { support: 0.4, caution: 0.1 },
};
const EMOTION: Record<string, Tendency> = {
  bravery: { aggr: 0.15, risk: 0.3 },
  determination: { aggr: 0.25, caution: -0.1 },
  justice: { aggr: 0.1, strategy: 0.2 },
  kindness: { support: 0.35 },
  patience: { caution: 0.15, strategy: 0.25 },
  integrity: { strategy: 0.1, support: 0.1 },
  perseverance: { caution: -0.1, risk: 0.2, aggr: 0.1 },
};
const STANCE: Record<Stance, Tendency> = {
  balanced: {},
  aggressive: { aggr: 0.5, caution: -0.2, risk: 0.15 },
  cautious: { caution: 0.5, aggr: -0.2, risk: -0.15 },
  protective: { support: 0.55, caution: 0.15 },
  strategic: { strategy: 0.5, risk: -0.05 },
};
const STAT_WORD: Record<string, string> = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));
/** A stable number in [0, 1) from text (FNV-1a): individuality without touching any RNG stream. */
export function flair(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** The share of max HP a Pokémon has left. */
const share = (content: Content, mon: PokemonInstance): number => mon.hp / Math.max(1, calcStats(content, mon).hp);

/**
 * How a Pokémon tends to fight: its nature, stat spread, trait, current emotion, confidence, what the trainer taught it, and
 * how this fight is going (fear when outmatched or hurt, anger after a teammate fell).
 */
export function autoProfile(content: Content, run: RunState, mon: PokemonInstance): AutoProfile {
  const p = { aggr: 0, caution: 0, support: 0, strategy: 0, risk: 0 };
  const notes: string[] = [];
  const add = (t: Tendency, scale = 1) => {
    for (const k of Object.keys(t) as (keyof Tendency)[]) p[k] += (t[k] ?? 0) * scale;
  };
  // Nature: the stat it raises and the one it lowers.
  const [up, down] = NATURES[mon.nature ?? 'serious'] ?? NATURES.serious;
  if (up !== down) {
    if (up === 'atk' || up === 'spa') add({ aggr: 0.25 });
    else if (up === 'def' || up === 'spd') add({ caution: 0.25 });
    else add({ risk: 0.15 });
    if (down === 'atk' || down === 'spa') add({ aggr: -0.15 });
    else if (down === 'def' || down === 'spd') add({ caution: -0.1, aggr: 0.1 });
    notes.push(`${mon.nature![0]!.toUpperCase()}${mon.nature!.slice(1)} nature (+${STAT_WORD[up]}, −${STAT_WORD[down]})`);
  }
  // Stat spread: glass cannons press, walls hold.
  const s = calcStats(content, mon);
  const offense = Math.max(s.atk, s.spa);
  const defense = (s.def + s.spd) / 2;
  const lean = (offense - defense) / Math.max(1, offense + defense);
  add({ aggr: 0.35 * lean, caution: -0.35 * lean });
  if (Math.abs(lean) > 0.12) notes.push(lean > 0 ? 'Hits harder than it takes hits' : 'Sturdier than it is strong');
  const bond = run.story.histories[mon.uid]?.bond ?? freshBond(mon.uid);
  add(TRAIT[bond.trait] ?? {});
  notes.push(`${bond.trait[0]!.toUpperCase()}${bond.trait.slice(1)} by trait`);
  const emotion = emotionOf(content, run, mon.uid);
  if (emotion) {
    add(EMOTION[emotion.id] ?? {});
    notes.push(`Feeling ${emotion.name.toLowerCase()}`);
  }
  // Confidence in itself, excitement about being ready for something big.
  const confidence = (bond.confidence - 50) / 50;
  add({ risk: 0.3 * confidence, caution: -0.1 * confidence });
  if (bond.hyperReadiness >= 60) add({ aggr: 0.1, risk: 0.15 });
  // What the trainer taught it, followed less by a willful Pokémon that distrusts you.
  const { stance, taught } = stanceOf(run, mon.uid);
  if (stance !== 'balanced') {
    const obey = taught && bond.autonomy >= 60 && bond.trust < 50 ? 0.5 : 1;
    add(STANCE[stance], obey);
    notes.push(`${taught ? 'Taught' : 'Mentored'} to fight ${STANCE_INFO[stance].name.toLowerCase()}${obey < 1 ? ' (it only half listens)' : ''}`);
  }
  if (bondMood(bond) === 'devoted') add({ support: 0.1 });
  // This fight: fear when hurt or outmatched, anger when a teammate has fallen.
  const battle = run.battle;
  const foe = battle ? currentEnemy(battle) : null;
  const hp = share(content, mon);
  const outmatch = foe ? clamp((foe.level - mon.level) / 20, 0, 1) : 0;
  const fear = clamp((1 - hp) * 0.6 + outmatch * 0.5 - Math.max(0, confidence) * 0.4 - Math.max(0, p.risk) * 0.3, 0, 1);
  const fallen = run.party.filter((m) => m.hp <= 0).length;
  const anger = clamp(fallen * 0.25 + bond.strain / 200 + (emotion?.id === 'justice' ? 0.15 : 0), 0, 1);
  // Hyper moments building in this fight: a rival teammate to outdo, a heated rivalry, a foe about to rage.
  const hy = battle?.hyper;
  if (hy) {
    if (hy.outdo.includes(mon.uid)) { p.aggr += 0.1; notes.push('Wants to outdo a teammate rival'); }
    if (Object.entries(hy.rivals).some(([key, v]) => key.startsWith(`${mon.uid}|`) && v === 'reckless')) { p.aggr += 0.15; p.risk += 0.1; notes.push('Reckless against its rival'); }
    if (foe && hy.rage[foe.uid]?.state === 'warned') { p.caution += 0.15; notes.push('Sees the foe\'s rage coming'); }
    if (hy.guard[mon.uid]) p.caution += 0.05;
  }
  if (fear >= 0.5) notes.push('Rattled right now');
  if (anger >= 0.4) notes.push('Angry about the fight so far');
  p.aggr += anger * 0.3;
  p.caution += fear * 0.3;
  const c = {
    aggr: clamp(p.aggr), caution: clamp(p.caution), support: clamp(p.support), strategy: clamp(p.strategy), risk: clamp(p.risk),
  };
  const axes: [string, number][] = [['Aggressive', c.aggr], ['Cautious', c.caution], ['Protective', c.support], ['Strategic', c.strategy], ['Daring', c.risk]];
  const top = axes.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { ...c, fear, anger, style: top[1] >= 0.2 ? top[0] : 'Balanced', notes };
}

// ---------- the pick ----------

export interface AutoPick {
  action: PlayerAction;
  /** What it intends, in words: "Pikachu will use Thunderbolt!" */
  intent: string;
  /** Why it chose that, for the optional explanation. */
  reason: string;
  /** Short markers for the interesting parts of the decision (ko, defensive, switch, transform, ...). */
  tags: string[];
  /** How much it liked this pick (for choosing between targets in double battles). */
  score?: number;
}

function context(run: RunState, content: Content) {
  return { content, battle: run.battle!, party: run.party, inventory: run.inventory, disabledMechanics: run.disabledMechanics, perks: runPerks(content, run), noBattleItems: noBattleItems(run.rules) };
}

const nameOf = (content: Content, mon: PokemonInstance) => getSpecies(content, mon.speciesId).name;

/** The reason line when nothing special decided the pick: it reads like the Pokémon's character. */
function plainWhy(style: string, name: string, move: string): string {
  switch (style) {
    case 'Aggressive': return `${name} presses the attack with ${move}.`;
    case 'Cautious': return `${name} plays it steady with ${move}.`;
    case 'Protective': return `${name} keeps it simple and safe with ${move}.`;
    case 'Strategic': return `${name} picks ${move} as the best fit for the matchup.`;
    case 'Daring': return `${name} trusts its gut and tries ${move}.`;
    default: return `${name} goes with ${move}.`;
  }
}

function isDefensiveStatus(move: Move): boolean {
  const e = move.effects;
  return Boolean(e.heal || e.rest || e.wish || e.protect || e.cure === 'self' || e.selfState === 'endure' || e.substitute);
}

/** A healing or status-curing item for the active Pokémon, or null. Healing waits until the Pokémon is hurt enough for its character. */
function chooseAutoItem(content: Content, run: RunState, ctx: ReturnType<typeof context>, mon: PokemonInstance, profile: AutoProfile, hp: number, canKo: boolean): AutoPick | null {
  if (canKo) return null;
  const battle = run.battle!;
  const index = battle.activeIndex;
  const name = nameOf(content, mon);
  const max = calcStats(content, mon).hp;
  const missing = max - mon.hp;
  const usable = Object.keys(run.inventory)
    .map((id) => content.items.get(id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it) && itemProblem(ctx, it!.id, index) === null);
  // Hurt enough to bother: cautious, afraid or caring Pokémon heal earlier, bold ones late.
  const threshold = clamp(0.25 + 0.2 * (profile.caution + profile.fear + profile.support) - 0.1 * profile.aggr, 0.12, 0.55);
  if (hp <= threshold && missing > 0) {
    const heals = usable
      .filter((it) => it.effect.kind === 'healHp' || it.effect.kind === 'fullRestore')
      .map((it) => ({ it, amount: it.effect.kind === 'healHp' ? it.effect.amount : max }))
      .filter((h) => h.amount >= missing * 0.4 || h.it.effect.kind === 'fullRestore');
    // The smallest one that covers what is missing, else the biggest there is.
    const enough = heals.filter((h) => h.amount >= missing).sort((a, b) => a.amount - b.amount)[0];
    const pick = enough ?? heals.sort((a, b) => b.amount - a.amount)[0];
    if (pick) return { action: { kind: 'item', itemId: pick.it.id, targetIndex: index }, intent: `${name}'s trainer uses ${pick.it.name}!`, reason: `${name} is hurt and badly needs ${pick.it.name}.`, tags: ['item', 'defensive'] };
  }
  if (mon.status) {
    const cure = usable.find((it) => it.effect.kind === 'cureStatus' || it.effect.kind === 'fullRestore');
    if (cure && (mon.status.id === 'slp' || mon.status.id === 'frz' || profile.caution + profile.strategy > 0.1)) return { action: { kind: 'item', itemId: cure.id, targetIndex: index }, intent: `${name}'s trainer uses ${cure.name}!`, reason: `${name} can't fight properly while afflicted.`, tags: ['item'] };
  }
  return null;
}

/** Auto-Battle can only play singles; doubles stay in manual control. */
export function autoBattleProblem(run: RunState): string | null {
  const b = run.battle;
  if (!b) return 'Not in a battle.';
  if (b.outcome) return 'The battle is over.';
  return null;
}

/** The best Pokémon to send out (after a faint, or as a switch): scored by its own offence and bulk against this foe. */
function bestSwitchIn(content: Content, run: RunState, profile: AutoProfile, exclude: number, problem?: (index: number) => string | null, against?: PokemonInstance): { index: number; score: number; offense: number } | null {
  const battle = run.battle!;
  const foe = against ?? currentEnemy(battle);
  const foeTypes = getSpecies(content, foe.speciesId).types;
  let best: { index: number; score: number; offense: number } | null = null;
  run.party.forEach((cand, i) => {
    if (i === exclude || (problem ? problem(i) : switchProblem({ content, battle, party: run.party }, i)) !== null) return;
    const brain: EnemyBrain = { content, ai: 1, target: foe, stages: freshStages(), battle, party: run.party, side: 'player', raw: true };
    const offense = Math.max(0, ...cand.moves.filter((m) => m.pp > 0).map((m) => estimateDamage(brain, cand, m.id))) / Math.max(1, foe.hp);
    const types = getSpecies(content, cand.speciesId).types;
    const worstHit = Math.max(0, ...foe.moves.filter((m) => m.pp > 0).map((m) => content.moves.get(m.id)).filter((m): m is Move => Boolean(m) && m!.category !== 'status').map((m) => typeEffectiveness(content.typeChart, m.type, types)));
    const resist = worstHit === 0 ? 1 : clamp(1 - worstHit, -1, 1);
    const stats = calcStats(content, cand);
    const bulk = (stats.def + stats.spd) / 400;
    void foeTypes;
    const score = Math.min(2, offense) * (0.8 + 0.4 * profile.aggr) + resist * (0.5 + 0.3 * profile.strategy + 0.2 * profile.caution) + share(content, cand) * 0.4 + bulk * 0.3 * (0.5 + profile.caution) + flair(`${cand.uid}:${battle.turn}:in`) * 0.03;
    if (!best || score > best.score) best = { index: i, score, offense };
  });
  return best;
}

/** Who to send out after a faint. */
export function chooseAutoSwitchIn(content: Content, run: RunState): AutoPick | null {
  if (autoBattleProblem(run)) return null;
  const battle = run.battle!;
  const lead = run.party[battle.activeIndex]!;
  const profile = autoProfile(content, run, lead);
  const pick = bestSwitchIn(content, run, profile, -1);
  if (!pick) return null;
  const mon = run.party[pick.index]!;
  return { action: { kind: 'switch', partyIndex: pick.index }, intent: `${nameOf(content, lead)}'s trainer sends out ${nameOf(content, mon)}!`, reason: `${nameOf(content, mon)} matches up best against ${nameOf(content, currentEnemy(battle))}.`, tags: ['switch-in'] };
}

/**
 * The action the active Pokémon would take now (null when Auto-Battle can't play this turn). It weighs damage, accuracy, type
 * matchup, knock-outs, status, set-up, healing, switching and the special actions, then bends each by its character.
 */
interface DecideOpts {
  /** One Pokémon of a double battle: no switching, cheers, Brace or Rally (the scene keeps those to single battles). */
  slot?: boolean;
  /** Transformations a partner already chose this turn (once per battle). */
  taken?: string[];
  /** A partner already used an item this turn. */
  noItems?: boolean;
}

function decide(content: Content, run: RunState, opts: DecideOpts = {}): AutoPick | null {
  if (autoBattleProblem(run)) return null;
  const battle = run.battle!;
  if (battle.needsSwitch) return chooseAutoSwitchIn(content, run);
  const mon = run.party[battle.activeIndex]!;
  const foe = currentEnemy(battle);
  const name = nameOf(content, mon);
  const profile = autoProfile(content, run, mon);
  const hp = share(content, mon);
  const foeHp = share(content, foe);
  const ctx = context(run, content);
  const usable = mon.moves.map((slot, i) => ({ slot, i, move: content.moves.get(slot.id) })).filter((x): x is { slot: typeof x.slot; i: number; move: Move } => Boolean(x.move) && moveBlockReason(content, battle, mon, x.i) === null);
  if (usable.length === 0) return { action: { kind: 'move', index: -1 }, intent: `${name} has no moves left and struggles on!`, reason: 'Nothing else to do.', tags: ['struggle'] };

  const myBrain: EnemyBrain = { content, ai: 1, target: foe, stages: battle.playerStages, battle, party: run.party, side: 'player' };
  const foeBrain: EnemyBrain = { content, ai: 1, target: mon, stages: battle.enemyStages, battle, party: run.party, side: 'enemy', raw: true };
  const threat = Math.max(0, ...foe.moves.filter((m) => m.pp > 0).map((m) => estimateDamage(foeBrain, foe, m.id)));
  const danger = threat >= mon.hp;
  const myStats = calcStats(content, mon);
  const foeStats = calcStats(content, foe);
  const foeFirst = foeStats.spe > myStats.spe;
  const foeTypes = getSpecies(content, foe.speciesId).types;
  const values = usable.map((x) => moveValue(myBrain, mon, x.slot.id));
  const bestValue = Math.max(1, ...values);

  interface Scored { i: number; move: Move; score: number; why: string; tags: string[]; damage: number }
  const scored: Scored[] = usable.map((x, n) => {
    const { move } = x;
    const rel = values[n]! / bestValue;
    const damage = estimateDamage({ ...myBrain, raw: true }, mon, move.id);
    let score = rel;
    let why = plainWhy(profile.style, name, move.name);
    const tags: string[] = [];
    const attack = move.category !== 'status';
    if (attack) {
      score *= 1 + 0.3 * profile.aggr - 0.15 * profile.caution;
      const eff = move.flags.includes('typeless') ? 1 : typeEffectiveness(content.typeChart, move.type, foeTypes);
      if (eff >= 2) {
        score *= 1 + 0.12 * (profile.strategy + 0.5);
        why = `${name} spots ${nameOf(content, foe)}'s weakness and uses ${move.name}.`;
        tags.push('weakness');
      } else if (eff > 0 && eff < 1) score *= 1 - 0.15 * (profile.strategy + 0.5);
      if (damage >= foe.hp && damage > 0) {
        score *= 1.5 + 0.25 * profile.aggr;
        why = profile.anger >= 0.4 ? `Still angry, ${name} goes for the knockout with ${move.name}.` : `${name} sees the knockout and goes for it with ${move.name}.`;
        tags.push('ko');
      }
      const acc = (move.accuracy ?? 100) / 100;
      if (acc < 1) score *= 1 - (1 - acc) * (0.5 - 0.5 * profile.risk);
      if (hp < 0.35 && !tags.includes('ko')) score *= 1 - 0.35 * Math.max(0, profile.caution + profile.fear - 0.2);
      if (danger && !tags.includes('ko') && profile.risk > 0.2) {
        score *= 1 + 0.2 * profile.risk;
        why = `Confident, ${name} swings big with ${move.name} despite the danger.`;
        tags.push('bold');
      }
      if (move.effects.recoil || move.effects.recoilMaxHp) score *= 1 - 0.2 * profile.caution;
      if (move.effects.selfFaint) score *= hp < 0.25 ? 1 + profile.aggr : 0.2;
    } else {
      const e = move.effects;
      if (isDefensiveStatus(move)) {
        const need = 1 - hp;
        if (e.heal || e.rest || e.wish) {
          score = hp >= 0.75 ? 0 : need * (1.2 + profile.caution + 0.6 * profile.fear + 0.5 * profile.support);
          why = `Hurt and wary, ${name} plays it safe with ${move.name}.`;
          tags.push('defensive');
        } else if (e.protect) {
          score = (danger ? 0.5 : 0.1) * (0.6 + profile.caution + profile.fear);
          why = `${name} sees a big hit coming and guards with ${move.name}.`;
          tags.push('defensive');
        } else score *= 0.6 + 0.4 * profile.caution;
      } else {
        const boosts = (e.statChanges ?? []).filter((c) => c.target === 'self' && c.stages > 0);
        if (boosts.length > 0) {
          const high = boosts.every((c) => (battle.playerStages[c.stat] ?? 0) >= 2);
          score = high ? 0.05 : rel * (0.8 + 0.8 * profile.strategy + 0.3 * profile.risk) * (danger ? 0.5 : 1);
          why = `${name} takes a moment to build up with ${move.name}.`;
          tags.push('setup');
        } else {
          const inflicts = Boolean(e.status || e.confuse);
          if (inflicts && foe.status) score = 0.05;
          else score *= (0.7 + 0.6 * profile.strategy) * (1 - 0.3 * profile.aggr);
          why = inflicts ? `${name} tries to wear the foe down with ${move.name}.` : `${name} tries ${move.name}.`;
          tags.push('status');
        }
        if (profile.support > 0.3 && run.party.some((m) => m !== mon && m.hp > 0 && share(content, m) < 0.3) && (e.cure || e.heal)) score *= 1.3;
      }
    }
    score *= 1 + (flair(`${mon.uid}:${battle.turn}:${move.id}`) - 0.5) * 0.08;
    return { i: x.i, move, score: Math.max(0, score), why, tags, damage };
  });
  // A Pokémon that refuses a reckless order would waste the turn: don't pick those.
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));

  // Bag items: a hurt or afflicted Pokémon may use a potion or a cure (it costs the turn), unless it can finish the foe.
  const itemPick = opts.noItems ? null : chooseAutoItem(content, run, ctx, mon, profile, hp, best.tags.includes('ko') || (best.tags.includes('defensive') && best.score > 0.5));
  if (itemPick) return itemPick;

  // Switching: a Pokémon that can't hurt the foe, or is about to be knocked out by a better matchup, may step back.
  if (!opts.slot) {
    const hopeless = best.damage <= 0 || (best.damage / Math.max(1, foe.hp) < 0.08 && best.score < 0.9);
    const exposed = danger && foeFirst;
    if (hopeless || exposed) {
      const cand = bestSwitchIn(content, run, profile, battle.activeIndex);
      const ownOffense = best.damage / Math.max(1, foe.hp);
      if (cand && cand.offense > ownOffense + 0.1) {
        const will = (hopeless ? 0.9 : 0.35 * (profile.caution + profile.fear + 0.5)) * (0.45 + 0.5 * profile.strategy + 0.4 * profile.caution - 0.5 * profile.aggr - 0.2 * profile.risk + 0.4);
        if (will > best.score * 0.8 + 0.1) {
          const incoming = run.party[cand.index]!;
          return { action: { kind: 'switch', partyIndex: cand.index }, intent: `${name} wants to switch out for ${nameOf(content, incoming)}!`, reason: hopeless ? `${name} can't hurt ${nameOf(content, foe)}, so it steps back.` : `${name} is about to be overwhelmed and trusts ${nameOf(content, incoming)} with the job.`, tags: ['switch'] };
        }
      }
    }
  }

  // Raid cheers and the Perfect Counter use the turn, so they only win when they clearly matter.
  // (Some of these helpers create lazy battle state, so they read a copy: choosing must not change the run.)
  const probe = structuredClone(battle);
  const raid = opts.slot ? undefined : battle.raid;
  if (raid && raid.cheersLeft > 0) {
    const heal = cheerProblem(content, probe, 'healing') === null && hp < 0.4;
    const guard = cheerProblem(content, probe, 'defense') === null && danger && profile.caution + profile.fear > 0.3;
    const rally = cheerProblem(content, probe, 'offense') === null && battle.turn <= 1 && profile.aggr > 0.2;
    const cheer = heal ? 'healing' : guard ? 'defense' : rally ? 'offense' : null;
    if (cheer) return { action: { kind: 'cheer', cheer }, intent: `${name} calls for a cheer!`, reason: `${name} wants backup: ${cheer}.`, tags: ['cheer'] };
  }

  // The move is chosen; now the special actions ride on it.
  let transform: TransformRequest | undefined;
  const tags = [...best.tags];
  let why = best.why;
  const boss = Boolean(battle.raid || battle.totem || (battle.trainer && (battle.rivalId || battle.trainer.classId !== 'trainer')));
  const attacking = best.move.category !== 'status';
  const used = opts.taken ?? [];
  const tera = used.includes('tera') ? null : teraOption(ctx);
  const z = used.includes('zmove') ? [] : zMoveOptions(ctx);
  const zAt = z.reduce<number>((pick, option, i) => (option && option.category !== 'status' && (pick < 0 || (option.power ?? 0) > (z[pick]?.power ?? 0)) ? i : pick), -1);
  const zIndex = zAt >= 0 && scored.some((s) => s.i === zAt) ? zAt : -1;
  let index = best.i;
  if (zIndex >= 0 && (boss || profile.aggr + profile.risk > 0.3) && foeHp > 0.4) {
    transform = { kind: 'zmove' };
    index = zIndex;
    why = `${name} unleashes the power it has been saving.`;
    tags.push('zmove');
  } else if (!used.includes('dynamax') && canDynamax(ctx) && (boss || hp < 0.6 || profile.aggr + profile.risk > 0.3)) {
    transform = { kind: 'dynamax' };
    why = `${name} feels the surge and goes Max!`;
    tags.push('dynamax');
  } else if (tera && attacking && (boss || tera === best.move.type || profile.aggr + profile.risk > 0.35)) {
    transform = { kind: 'tera' };
    why = `${name} crystallises into the ${tera} type!`;
    tags.push('tera');
  }
  const chosen = scored.find((s) => s.i === index) ?? best;
  const rally = !opts.slot && !transform && attacking && rallyProblem(content, probe) === null && profile.aggr + profile.risk + 0.2 > 0.2;
  if (rally) tags.push('rally');
  const action: PlayerAction = { kind: 'move', index, ...(transform ? { transform } : {}), ...(rally ? { rally: true } : {}) };
  const verb = transform?.kind === 'zmove' ? `${name} will unleash a Z-Move!` : transform?.kind === 'dynamax' ? `${name} will Dynamax and use ${chosen.move.name}!` : transform?.kind === 'tera' ? `${name} will Terastallize and use ${chosen.move.name}!` : `${name} will use ${chosen.move.name}!`;
  return { action, intent: rally ? `${verb} (Rally!)` : verb, reason: why, tags, score: chosen.score };
}

/** Double battles: each Pokémon picks its best move against the foe it likes best, one transformation per kind, one item at a time. */
function decideDoubles(content: Content, run: RunState): AutoPick | null {
  const battle = run.battle!;
  const d = battle.doubles!;
  const view = { battle, party: run.party };
  if (battle.needsSwitch) {
    const taken: number[] = [];
    const lead = monAt(view, 'player', 0) ?? monAt(view, 'player', 1) ?? run.party[0]!;
    const foe = [0, 1].map((s) => monAt(view, 'enemy', s as Spot)).find((m): m is PokemonInstance => Boolean(m) && m!.hp > 0);
    const cand = bestSwitchIn(content, run, autoProfile(content, run, lead), -1, (i) => doublesSwitchProblem(view, i, taken), foe);
    if (!cand) return null;
    const mon = run.party[cand.index]!;
    return { action: { kind: 'switch', partyIndex: cand.index }, intent: `${nameOf(content, mon)} is sent out!`, reason: `${nameOf(content, mon)} matches up best against the foes.`, tags: ['switch-in'] };
  }
  const commands: (SlotCommand | null)[] = [null, null];
  const intents: string[] = [];
  const reasons: string[] = [];
  const tags: string[] = [];
  const taken: string[] = [];
  let itemUsed = false;
  for (const spot of [0, 1] as const) {
    const mon = monAt(view, 'player', spot);
    if (!mon || mon.hp <= 0 || d.commanding.includes(mon.uid)) continue;
    const forced = forcedMoveId(volAt(view, 'player', spot) ?? undefined);
    const forcedIndex = forced ? mon.moves.findIndex((m) => m.id === forced) : -1;
    if (forcedIndex >= 0) {
      commands[spot] = { action: { kind: 'move', index: forcedIndex } };
      continue;
    }
    let best: { pick: AutoPick; foeSpot: Spot } | null = null;
    for (const foeSpot of [0, 1] as const) {
      const foe = monAt(view, 'enemy', foeSpot);
      if (!foe || foe.hp <= 0 || d.commanding.includes(foe.uid)) continue;
      const seen: RunState = { ...run, battle: { ...battle, doubles: undefined, activeIndex: indexAt(view, 'player', spot), enemyIndex: indexAt(view, 'enemy', foeSpot), playerStages: stagesAt(view, 'player', spot)!, enemyStages: stagesAt(view, 'enemy', foeSpot)!, playerVolatile: volAt(view, 'player', spot)!, enemyVolatile: volAt(view, 'enemy', foeSpot)!, needsSwitch: false } };
      const pick = decide(content, seen, { slot: true, taken, noItems: itemUsed });
      if (pick && (!best || (pick.score ?? 0) > (best.pick.score ?? 0))) best = { pick, foeSpot };
    }
    if (!best) continue;
    const action = best.pick.action as SlotAction;
    commands[spot] = { action, target: { side: 'enemy', spot: best.foeSpot } };
    if (action.kind === 'move' && action.transform) taken.push(action.transform.kind);
    if (action.kind === 'item') itemUsed = true;
    intents.push(best.pick.intent);
    reasons.push(best.pick.reason);
    tags.push(...best.pick.tags);
  }
  if (intents.length === 0) return null;
  return { action: { kind: 'double', commands }, intent: intents.join(' '), reason: reasons.join(' '), tags: [...new Set(tags)] };
}

/** The action (or, in a double battle, the pair of commands) Auto-Battle would play now; null when it can't play this turn. */
export function chooseAutoAction(content: Content, run: RunState): AutoPick | null {
  if (autoBattleProblem(run)) return null;
  return run.battle!.doubles ? decideDoubles(content, run) : decide(content, run);
}

