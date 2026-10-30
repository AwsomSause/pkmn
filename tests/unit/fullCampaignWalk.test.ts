// Full-campaign walk (opt-in: FULL_WALK=1 npm run test:walk). A god-mode bot plays all nine regions of the 'full'
// campaign on several seeds, using every heal, shop, event and service stop on the way, and must win without an
// error or a stuck phase. It takes about a minute per seed, so it is not part of `npm run check`.
import { describe, expect, it } from 'vitest';
import { doublesSwitchProblem } from '../../src/core/battle/doubles';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { chooseReward, chooseStarter, createRun, leaveShop, resolveDecision, takeTurn, visitSide } from '../../src/core/run';
import { chooseEvent, eventView } from '../../src/core/events';
import { serviceView, useService } from '../../src/core/services/flow';
import type { RunState } from '../../src/core/state';
import { content, takeAnyReward, toBattle } from './helpers';

const found: string[] = [];
const note = (seed: string, where: string, e: unknown) => found.push(`${seed} ${where}: ${(e as Error).message?.slice(0, 140)}`);

function power(run: RunState): RunState {
  const mon = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  mon.moves = [{ id: 'flamethrower', pp: 64 }, { id: 'crunch', pp: 64 }];
  run.party[0] = mon;
  for (let i = 1; i < 6; i++) run.party[i] = { ...structuredClone(mon), uid: `x${i}` };
  return run;
}
function refresh(run: RunState): RunState {
  for (const m of run.party) { m.hp = maxHp(content, m); m.status = null; for (const s of m.moves) s.pp = 64; }
  return run;
}
function settle(run: RunState): RunState {
  let guard = 0;
  while (run.phase !== 'map' && run.phase !== 'over' && guard++ < 800) {
    if (run.phase === 'battle') {
      if (run.battle!.needsSwitch) { run = takeTurn(content, run, { kind: 'switch', partyIndex: run.battle!.doubles ? run.party.findIndex((_, i) => doublesSwitchProblem({ battle: run.battle!, party: run.party }, i) === null) : run.party.findIndex((p, i) => p.hp > 0 && i !== run.battle!.activeIndex) }).run; continue; }
      const mon = run.party[run.battle!.activeIndex]!;
      mon.hp = 1_000_000;
      const idx = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
      const any = mon.moves.findIndex((m) => m.pp > 0);
      run = takeTurn(content, run, { kind: 'move', index: idx >= 0 ? idx : any >= 0 ? any : -1 }).run;
    } else if (run.phase === 'decision') {
      run = resolveDecision(content, run, run.pending[0]!.kind === 'caught' ? { kind: 'release' } : { kind: 'skipMove' }).run;
    } else if (run.phase === 'reward') {
      run = takeAnyReward(run);
    } else if (run.phase === 'shop') {
      run = leaveShop(content, run);
    } else throw new Error(`stuck in phase ${run.phase}`);
  }
  return run;
}

describe('full campaign walk', () => {
  it.skipIf(!process.env.FULL_WALK)('wins every region on several seeds', () => {
    for (const seed of (process.env.FULL_WALK_SEEDS ?? 'W1,W2,W3').split(',')) {
      let run = power(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'full' }), 0));
      let guard = 0;
      const t = Date.now();
      try {
        while (run.phase !== 'over' && guard++ < 3000) {
          run = refresh(run);
          if (run.phase !== 'map') run = settle(run);
          if (run.phase === 'over') break;
          const node = run.stage!.current ? run.stage!.map.nodes.find((n) => n.id === run.stage!.current)! : null;
          if (node) {
            for (const side of node.sides) {
              try {
                run.money = Math.max(run.money, 5000);
                if (side.kind === 'heal' || side.kind === 'shop') run = settle(visitSide(content, run, side.id).run);
                else if (side.kind === 'event') {
                  const v = eventView(content, run, side.id);
                  const i = v.choices.findIndex((c) => !c.locked);
                  if (i >= 0) run = settle(chooseEvent(content, run, side.id, i).run);
                } else if (side.kind === 'service') {
                  const v = serviceView(content, run, side.id);
                  const o = v.options.find((x) => !x.problem);
                  if (o) run = settle(useService(content, run, side.id, o.id).run);
                }
              } catch (e) { note(seed, `${side.kind}@r${run.regionIndex}s${run.stage?.index}`, e); }
              if (run.phase !== 'map') run = settle(run);
            }
          }
          if (run.phase === 'over') break;
          run = settle(toBattle(run));
        }
        found.push(`${seed}: phase=${run.phase} victory=${run.victory} region=${run.regionIndex} guard=${guard} ${Date.now() - t}ms`);
        expect(run.victory).toBe(true);
      } catch (e) { note(seed, `FATAL r${run.regionIndex}s${run.stage?.index} phase=${run.phase}`, e); found.push(String((e as Error).stack).split('\n').slice(0, 8).join('\n')); }
    }
    const bad = found.filter((f) => !/victory=true/.test(f) && !/: (Needs|You need)/.test(f));
    expect(bad).toEqual([]);
  }, 900000);
});
