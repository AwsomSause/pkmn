// Running a minigame from a map stop: start (limited attempts), act/tick, and one reward payout when it ends. The
// reward is applied the moment the game finishes and the finished outcome is stored, so a reload never pays twice.

import { addItem } from '../items';
import { hashSeed, Rng } from '../rng';
import { maxHp } from '../pokemon';
import { requireStage } from '../run';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { gameModule, type MinigameView } from './games';
import type { Medal, MinigameDef } from './schema';

export function getMinigame(content: Content, id: string): MinigameDef {
  const g = content.minigames.games.find((m) => m.id === id);
  if (!g) throw new Error(`No minigame "${id}"`);
  return g;
}

export interface MinigamePreview {
  id: string; name: string; blurb: string; instructions: string; scoring: string; failure: string; replay: string;
  attemptsLeft: number; tiers: { label: string; index: number }[]; best: Medal; medals: string;
}

export function minigamePreview(content: Content, run: RunState, sideId: string): MinigamePreview {
  const side = findStop(run, sideId);
  const def = getMinigame(content, side.minigameId!);
  const used = run.minigames.attempts[sideId] ?? 0;
  const m = def.medals;
  return {
    id: def.id, name: def.name, blurb: def.blurb, instructions: def.instructions, scoring: def.scoringRules, failure: def.failureOutcome, replay: def.replayRules,
    attemptsLeft: Math.max(0, def.attemptLimit - used), tiers: def.difficultyTiers.map((t, index) => ({ label: t.label, index })), best: run.minigames.best[def.id] ?? 'none',
    medals: `Bronze ${Math.round(m.bronze * 100)}% · Silver ${Math.round(m.silver * 100)}% · Gold ${Math.round(m.gold * 100)}%`,
  };
}

function findStop(run: RunState, sideId: string) {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = stage.map.nodes.find((n) => n.id === stage.current)!;
  const side = node.sides.find((s) => s.id === sideId && s.kind === 'minigame' && s.minigameId);
  if (!side) throw new Error(`No minigame stop "${sideId}" here`);
  return side;
}

/** Starts an attempt at difficulty tier 0–2. Walking away mid-game counts as an attempt and pays nothing. */
export function beginMinigame(content: Content, current: RunState, sideId: string, tier: number): RunState {
  if (current.phase !== 'map') throw new Error('Minigames start from the map');
  const side = findStop(current, sideId);
  const def = getMinigame(content, side.minigameId!);
  if (tier < 0 || tier > 2) throw new Error('Unknown difficulty');
  const used = current.minigames.attempts[sideId] ?? 0;
  if (side.used || used >= def.attemptLimit) throw new Error('No attempts left at this stop');
  const run = structuredClone(current);
  run.minigames.attempts[sideId] = used + 1;
  if (used + 1 >= def.attemptLimit) findStop(run, sideId).used = true;
  const stage = requireStage(run);
  const rs = new Rng(hashSeed(`${run.seed}::minigame::${stage.index}:${sideId}:${used}:${tier}`)).state;
  run.minigame = { id: def.id, sideId, tier, state: gameModule(def.id).start(content, def.difficultyTiers[tier]!.params, rs), outcome: null };
  run.phase = 'minigame';
  return run;
}

function session(run: RunState) {
  if (run.phase !== 'minigame' || !run.minigame) throw new Error('No minigame in progress');
  return run.minigame;
}

export function minigameView(content: Content, run: RunState): MinigameView {
  const s = session(run);
  return gameModule(s.id).view(content, s.state as never);
}

export function minigameAct(content: Content, current: RunState, cellId: string): RunState {
  const run = structuredClone(current);
  const s = session(run);
  if (s.outcome) return run;
  const mod = gameModule(s.id);
  mod.act(content, s.state as never, cellId);
  return settle(content, run);
}

export function minigameTick(content: Content, current: RunState): RunState {
  const run = structuredClone(current);
  const s = session(run);
  const mod = gameModule(s.id);
  if (s.outcome || !mod.tick) return run;
  mod.tick(content, s.state as never);
  return settle(content, run);
}

function settle(content: Content, run: RunState): RunState {
  const s = session(run);
  const mod = gameModule(s.id);
  if (!(s.state as { done: boolean }).done || s.outcome) return run;
  const { score, max } = mod.result(s.state as never);
  s.outcome = payout(content, run, getMinigame(content, s.id), s.tier, score, max);
  return run;
}

export function medalFor(def: MinigameDef, score: number, max: number): Medal {
  const share = max > 0 ? score / max : 0;
  return share >= def.medals.gold ? 'gold' : share >= def.medals.silver ? 'silver' : share >= def.medals.bronze ? 'bronze' : 'none';
}

const RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** Pays the medal's reward once. Money is capped per stage, repeats of one game pay less, items need a harder tier and are capped. */
export function payout(content: Content, run: RunState, def: MinigameDef, tier: number, score: number, max: number) {
  const eco = content.minigames.economy;
  const stage = requireStage(run);
  const log = run.minigames;
  if (log.stage !== stage.index) Object.assign(log, { stage: stage.index, money: 0, items: 0, plays: {}, effects: 0 });
  const medal = medalFor(def, score, max);
  const lines = [`Score ${score} / ${max} — ${medal === 'none' ? 'no medal' : `${medal} medal`}.`];
  let money = 0;
  let item: string | null = null;
  const plays = log.plays[def.id] ?? 0;
  log.plays[def.id] = plays + 1;
  if (medal === 'none') lines.push(def.failureOutcome);
  else {
    const reward = def.rewardTable[medal];
    const cap = eco.stageMoneyCap * (run.regionIndex + 1);
    const want = Math.round(reward.money * eco.tierMultipliers[tier]! * Math.pow(eco.diminishing, plays));
    money = Math.max(0, Math.min(want, cap - log.money));
    if (money < want) lines.push('This stage will not pay any more money.');
    if (plays > 0) lines.push('Repeats pay less.');
    if (reward.item && tier + 1 >= eco.itemMinTier && log.items < eco.itemCapPerStage) {
      const roll = new Rng(hashSeed(`${run.seed}::minigame-reward::${stage.index}:${def.id}:${plays}`));
      if (roll.chance(reward.item.chance)) item = reward.item.item;
    }
    if (reward.effect && tier + 1 >= eco.itemMinTier && log.effects < eco.effectCapPerStage) {
      const roll = new Rng(hashSeed(`${run.seed}::minigame-effect::${stage.index}:${def.id}:${plays}`));
      if (roll.chance(reward.effect.chance)) lines.push(applyEffect(content, run, reward.effect.kind, reward.effect.amount));
    }
    run.money += money;
    log.money += money;
    if (item) {
      addItem(run.inventory, item, 1);
      log.items += 1;
    }
    lines.push(`+₽${money}${item ? `, ${item.replace(/-/g, ' ')}` : ''}.`);
  }
  if (RANK[medal] > RANK[log.best[def.id] ?? 'none']) log.best[def.id] = medal;
  return { score, max, medal, money, item, lines };
}

/** One bonus from a medal; returns the line shown to the player. */
function applyEffect(content: Content, run: RunState, kind: 'heal' | 'research' | 'discount', amount: number): string {
  run.minigames.effects += 1;
  if (kind === 'research') {
    run.totems.research += amount;
    return `+${amount} research.`;
  }
  if (kind === 'discount') {
    const stageIndex = requireStage(run).index;
    const old = run.minigames.discount;
    run.minigames.discount = { percent: old && old.stage === stageIndex ? Math.max(old.percent, amount) : amount, stage: stageIndex };
    return `Shops are ${amount}% cheaper for the rest of this stage.`;
  }
  for (const m of run.party) if (m.hp > 0) m.hp = Math.min(maxHp(content, m), m.hp + Math.ceil((maxHp(content, m) * amount) / 100));
  return `The party recovers ${amount}% of its health.`;
}

/** Back to the map. Leaving before the end forfeits the attempt (it was already counted) and pays nothing. */
export function leaveMinigame(current: RunState): RunState {
  const run = structuredClone(current);
  session(run);
  run.minigame = null;
  run.phase = 'map';
  return run;
}
