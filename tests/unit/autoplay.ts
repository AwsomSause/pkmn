// A simple deterministic player for tests: it always makes the same choice in
// the same situation, so the same seed always plays the same run.

import type { Content } from '../../src/core/contentSchema';
import { forcedMoveIndex } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { chooseReward, chooseStarter, createRun, debugHealParty, leaveShop, partyCapacity, resolveDecision, takeTurn, type TurnResult } from '../../src/core/run';
import { currentEnemy, type RunState } from '../../src/core/state';
import { content as defaultContent, toBattle } from './helpers';

export interface AutoplayOptions {
  seed: string;
  archetypeId?: string;
  campaignId?: string;
  attributes?: Record<string, number>;
  /** Fully heals the party whenever it is on the map, so runs last longer. */
  healOnMap?: boolean;
  /** Raises the starter to this level right after it is chosen, so runs get further. */
  starterLevel?: number;
  /** Stop after this many actions. */
  steps: number;
  /** Called after every action with the new run (and the turn result for battle turns). */
  onStep?: (run: RunState, turn: TurnResult | null) => RunState | void;
  content?: Content;
}

/** Picks the next action for `run` and plays it. */
export function step(content: Content, run: RunState): { run: RunState; turn: TurnResult | null } {
  switch (run.phase) {
    case 'starter':
      return { run: chooseStarter(content, run, 0), turn: null };
    case 'map':
      return { run: toBattle(run, content), turn: null };
    case 'shop':
      return { run: leaveShop(content, run), turn: null };
    case 'battle': {
      const battle = run.battle!;
      if (battle.needsSwitch) {
        const turn = takeTurn(content, run, { kind: 'switch', partyIndex: run.party.findIndex((p) => p.hp > 0) });
        return { run: turn.run, turn };
      }
      const enemy = currentEnemy(battle);
      // A Pokémon in the middle of a two-turn move, or locked by a Choice item, can't throw a ball.
      const midMove = forcedMoveIndex(battle, run.party) !== null;
      if (!midMove && battle.kind === 'wild' && run.party.length < partyCapacity(content, run) && (run.inventory['poke-ball'] ?? 0) > 0 && enemy.hp <= maxHp(content, enemy) / 2) {
        const turn = takeTurn(content, run, { kind: 'item', itemId: 'poke-ball' });
        return { run: turn.run, turn };
      }
      const mon = run.party[battle.activeIndex]!;
      const damaging = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
      const index = damaging >= 0 ? damaging : mon.moves.findIndex((m) => m.pp > 0);
      const turn = takeTurn(content, run, { kind: 'move', index });
      return { run: turn.run, turn };
    }
    case 'decision': {
      const d = run.pending[0]!;
      if (d.kind === 'learnMove') return { run: resolveDecision(content, run, { kind: 'forgetMove', moveIndex: 0 }).run, turn: null };
      if (d.kind === 'signature') return { run: resolveDecision(content, run, { kind: 'signature', optionIndex: 0 }).run, turn: null };
      if (d.kind !== 'caught') return { run: resolveDecision(content, run, { kind: 'skipMove' }).run, turn: null };
      const choice = run.party.length < partyCapacity(content, run) ? { kind: 'addToParty' as const } : { kind: 'release' as const };
      return { run: resolveDecision(content, run, choice).run, turn: null };
    }
    case 'reward':
      for (let i = 0; i < (run.draft?.length ?? 0); i++) {
        for (let t = 0; t < Math.max(1, run.party.length); t++) {
          try {
            return { run: chooseReward(content, run, i, t).run, turn: null };
          } catch {
            // Not usable on this Pokémon; try the next.
          }
        }
      }
      throw new Error('No reward could be taken');
    case 'over':
      return { run, turn: null };
  }
}

export function autoplay(opts: AutoplayOptions): RunState {
  const content = opts.content ?? defaultContent;
  let run = createRun(content, { runId: `test-${opts.seed}`, seed: opts.seed, archetypeId: opts.archetypeId ?? 'red', campaignId: opts.campaignId ?? 'full', attributes: opts.attributes });
  for (let i = 0; i < opts.steps && run.phase !== 'over'; i++) {
    if (opts.healOnMap && run.phase === 'map') run = debugHealParty(content, run);
    const next = step(content, run);
    if (opts.starterLevel && run.phase === 'starter') {
      const mon = next.run.party[0]!;
      next.run.party[0] = { ...createPokemon(content, mon.speciesId, opts.starterLevel, mon.uid), friendship: mon.friendship };
    }
    run = (opts.onStep?.(next.run, next.turn) as RunState | undefined) ?? next.run;
  }
  return run;
}

/** What the rules decided, without the story layer: used to check that adding it changed no roll. */
export function gameplayFingerprint(run: RunState): string {
  const { story: _story, hyper: _hyper, ...oldStreams } = run.rng as Record<string, unknown>;
  return JSON.stringify({
    phase: run.phase,
    encounters: run.encountersCompleted,
    money: run.money,
    badges: run.badges,
    party: run.party.map((m) => [m.speciesId, m.level, m.xp, m.hp, m.friendship, m.moves.map((x) => `${x.id}:${x.pp}`)]),
    inventory: run.inventory,
    rewards: run.log.rewardsTaken,
    defeatedBy: run.log.defeatedBy,
    rng: oldStreams,
  });
}
