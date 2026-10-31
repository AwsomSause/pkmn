// Trainer tiers (M10 §2, docs/status/trainer-tiers.md): ordinary trainers grow more skilled as the run
// goes on, without turning into six-Pokémon competitive teams. The class keeps its identity: a tier
// changes WHICH rung of the class's species ladder it draws from, how well its moves are chosen,
// what it holds, how it is trained and how smart its AI is (all data-driven in trainerTiers.json).
// A class that remembers you (core/trainerTiers.ts recordTrainerMemory) may bring back the Pokémon you
// beat, evolved, or a move aimed at the type that beat it. Nothing here touches the gameplay RNG
// streams: every roll comes from a generator seeded by the caller from the run seed and the node.

import { directSpecies } from './encounterDirector';
import { evolvedFormAt, type TrainerPlan } from './encounters';
import type { Content, StatName, TierClass, TypeName } from './contentSchema';
import { getSpecies, isUsableMove, movesAtLevel, usableLearnset } from './pokemon';
import { Rng, hashSeed } from './rng';
import type { RunState } from './state';
import { counterTypes } from './story/nemesis';

export interface TierInput {
  stageNumber: number;
  /** LevelScale.party: levels the enemy gained for a strong party. */
  partyBonus: number;
  /** Earlier wins over this class this run. */
  classWins: number;
  rematch: boolean;
  important: boolean;
}

/** What a class remembers about you (run.story.flags `tm:*`). */
export interface TrainerMemory {
  /** The Pokémon of theirs you beat last (their ace). */
  species: string | null;
  /** The primary type of the Pokémon that beat them. */
  type: string | null;
}

const wins = (classId: string) => `tm:w:${classId}`;
const lostSpecies = (classId: string) => `tm:s:${classId}`;
const beatenBy = (classId: string) => `tm:t:${classId}`;

export function tierClass(content: Content, classId: string): TierClass {
  return content.trainerTiers.classes[classId] ?? content.trainerTiers.default;
}

export function trainerTierScore(content: Content, input: TierInput): number {
  const w = content.trainerTiers.score;
  return input.stageNumber * w.stageWeight + input.partyBonus * w.partyWeight + input.classWins * w.repeatWeight + (input.rematch ? w.rematchWeight : 0) + (input.important ? w.importanceWeight : 0);
}

/** Index into `trainerTiers.tiers` for a score, never above `maxOrdinaryTier`. */
export function trainerTierIndex(content: Content, score: number): number {
  const { tiers, maxOrdinaryTier } = content.trainerTiers;
  const top = Math.max(0, tiers.findIndex((t) => t.id === maxOrdinaryTier));
  let index = 0;
  for (let i = 0; i <= top; i++) if (score >= tiers[i]!.minScore) index = i;
  return index;
}

/** The class's species rung for a tier: the nearest defined rung at or below it. */
export function tierRung(content: Content, cls: TierClass, tierIndex: number): string[] | null {
  for (let i = tierIndex; i >= 0; i--) {
    const rung = cls.ladder[content.trainerTiers.tiers[i]!.id];
    if (rung) return rung;
  }
  return null;
}

export function readTrainerMemory(run: RunState, classId: string): { memory: TrainerMemory; wins: number } {
  const f = run.story.flags;
  const s = f[lostSpecies(classId)];
  const t = f[beatenBy(classId)];
  return { memory: { species: typeof s === 'string' ? s : null, type: typeof t === 'string' ? t : null }, wins: Number(f[wins(classId)] ?? 0) };
}

/** After a won battle against an ordinary trainer: remember its ace and the type that beat it. */
export function recordTrainerMemory(content: Content, run: RunState): void {
  const battle = run.battle!;
  const t = battle.trainer;
  if (!content.trainerTiers.enabled || battle.outcome !== 'win' || battle.kind !== 'trainer' || !t || t.leaderId || battle.rivalId || battle.nemesis || battle.event) return;
  const f = run.story.flags;
  f[wins(t.classId)] = Number(f[wins(t.classId)] ?? 0) + 1;
  const ace = battle.enemyTeam.reduce((a, b) => (b.level > a.level ? b : a));
  f[lostSpecies(t.classId)] = ace.speciesId;
  const lead = run.party[battle.activeIndex];
  if (lead) f[beatenBy(t.classId)] = getSpecies(content, lead.speciesId).types[0]!;
}

const power = (content: Content, id: string) => content.moves.get(id)?.power ?? 0;

/** Swaps the weakest slot (status first, then the lowest-power attack) for `move`, unless it is already known or would not improve things. */
function swapIn(content: Content, moves: string[], move: string, requireStronger: boolean): boolean {
  if (moves.includes(move) || !isUsableMove(content, move)) return false;
  const rank = (id: string) => (power(content, id) > 0 ? power(content, id) : -1);
  let weakest = 0;
  moves.forEach((id, i) => {
    if (rank(id) < rank(moves[weakest]!)) weakest = i;
  });
  if (moves.length < 4) {
    moves.push(move);
    return true;
  }
  if (requireStronger && rank(move) <= rank(moves[weakest]!)) return false;
  moves[weakest] = move;
  return true;
}

/** The strongest move of `types` the species can learn by `level` that it does not know. */
function bestLearned(content: Content, speciesId: string, level: number, types: readonly string[], known: readonly string[]): string | null {
  const sp = getSpecies(content, speciesId);
  let best: string | null = null;
  for (const e of usableLearnset(content, sp)) {
    const mv = content.moves.get(e.move);
    if (!mv || e.level > level || known.includes(e.move) || (mv.power ?? 0) <= 0 || !types.includes(mv.type)) continue;
    if (!best || (mv.power ?? 0) > power(content, best)) best = e.move;
  }
  return best;
}

/**
 * Applies a trainer's tier to a planned ordinary-trainer team: ladder species, better moves, class strategy
 * moves, held items, training and AI. Same plan when the tiers are off or the trainer is still Early.
 */
export function applyTrainerTier(content: Content, plan: TrainerPlan, input: TierInput, cap: number, seed: string, memory?: TrainerMemory): TrainerPlan {
  const cfg = content.trainerTiers;
  if (!cfg.enabled || plan.leaderId) return plan;
  const tierIndex = trainerTierIndex(content, trainerTierScore(content, input));
  const tier = cfg.tiers[tierIndex]!;
  const cls = tierClass(content, plan.classId);
  const rng = new Rng(hashSeed(`${seed}::tier::${plan.classId}::${plan.name}`));
  const rung = tierRung(content, cls, tierIndex);
  const members = plan.members.map((m) => ({ ...m }));
  const taken = new Set(members.map((m) => m.speciesId));

  // Species: draw from the class's rung for this tier (a fresh species each time when it can).
  if (rung && tier.ladderChance > 0) {
    members.forEach((m, i) => {
      if (!rng.chance(tier.ladderChance)) return;
      const fresh = rung.filter((id) => !taken.has(id));
      const pool = fresh.length > 0 ? fresh : rung;
      const { speciesId } = directSpecies(content, { source: 'trainer', level: m.level, cap, draw: () => rng.pick(pool), evolve: (id, level) => evolvedFormAt(content, id, level, rng) });
      taken.delete(m.speciesId);
      taken.add(speciesId);
      members[i] = { ...m, speciesId };
    });
  }

  // Memory: a trainer that remembers you brings back the Pokémon you beat (evolved, stronger) and a move for the type that beat it.
  let counter: string | null = null;
  let note: string | null = null;
  const remembers = !!memory && cls.remembers && (memory.species !== null || memory.type !== null) && rng.chance(cfg.memory.chance);
  if (remembers && memory!.species && members.length > 0) {
    const lost = getSpecies(content, memory!.species);
    const target = lost.evolutions.find((e) => !e.region)?.to ?? lost.id;
    const i = members.length > 1 ? 0 : members.length - 1;
    const level = Math.min(cap, members[i]!.level + cfg.memory.levelBonus);
    const { speciesId } = directSpecies(content, { source: 'trainer', level, cap, draw: () => target });
    members[i] = { ...members[i]!, speciesId, level };
    note = `${plan.name} hasn't forgotten losing ${lost.name}, and brings back ${getSpecies(content, speciesId).name}!`;
  }
  if (remembers && memory!.type && cfg.memory.counterTypes > 0) {
    counter = counterTypes(content, [memory!.type as TypeName])[0] ?? null;
    if (counter) note = [note, `${note ? 'It has' : `${plan.name} has`} trained against ${memory!.type}-type Pokémon.`].join(' ');
  }

  members.forEach((m, i) => {
    const sp = getSpecies(content, m.speciesId);
    const isAce = i === members.length - 1;
    const original = m.moves ?? movesAtLevel(content, sp, m.level);
    const moves = [...original];
    // Better move selection: the strongest same-type attack it could know.
    if (tier.coverageMoves) {
      const stab = bestLearned(content, m.speciesId, m.level, sp.types, moves);
      if (stab) swapIn(content, moves, stab, true);
    }
    // Class strategy: hazards, weather and status on the lead; setup and signature attacks on the ace.
    if (tier.strategyMoves) {
      const picks = [...(i === 0 ? cls.leadMoves : []), ...(isAce ? cls.aceMoves : [])];
      for (const id of picks) {
        const mv = content.moves.get(id);
        if (!mv || ((mv.power ?? 0) > 0 && !sp.types.includes(mv.type))) continue;
        swapIn(content, moves, id, false);
      }
    }
    // Preparation: a move that hits the type that beat it last time.
    if (counter) {
      const prep = bestLearned(content, m.speciesId, m.level, [counter], moves);
      if (prep) swapIn(content, moves, prep, true);
    }
    members[i] = moves.some((id, j) => id !== original[j]) ? { ...m, moves: moves.slice(0, 4) } : { ...m };

    // Held items from the class's list.
    const held = cls.held.filter((id) => content.catalog.has(id));
    if (held.length > 0 && tier.heldChance > 0 && rng.chance(tier.heldChance)) members[i]!.held = { [rng.pick(held)]: 1 };

    // Training: the ace is trained the most, the rest a stack less.
    const stacks = Math.max(0, tier.training - (isAce ? 0 : 1));
    if (stacks > 0) members[i]!.training = { ...(m.training ?? {}), [cls.trainStat as StatName]: stacks };
  });

  return { ...plan, members, ai: Math.max(plan.ai, tier.ai), ...(note ? { memoryNote: note } : {}) };
}
