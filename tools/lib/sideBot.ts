// Side-stop player for tools/playtest.ts --sides: after each action it visits the side stops beside the current map node
// (healing, shops, minigames, expeditions, events, services, fishing, raids, Totems) so those systems get mass-tested.
// Every unexpected exception is recorded as a finding instead of ending the run.

import type * as RunMod from '../../src/core/run.ts';
import type * as Expedition from '../../src/core/expedition/flow.ts';
import type * as Minigame from '../../src/core/minigame/flow.ts';
import type * as Events from '../../src/core/events.ts';
import type * as Services from '../../src/core/services/flow.ts';
import type * as Auto from '../../tests/unit/autoplay.ts';
import type { Content } from '../../src/core/contentSchema.ts';
import type { RunState } from '../../src/core/state.ts';

export interface SideMods {
  run: typeof RunMod;
  exp: typeof Expedition;
  mini: typeof Minigame;
  events: typeof Events;
  services: typeof Services;
  auto: typeof Auto;
}

export interface SideFinding {
  kind: string;
  message: string;
}

/** Blocks on purpose ("already used", "No Rest contract"): not a finding. */
const EXPECTED = /already|no attempts|forbids|not enough|cannot|can't|need|no healthy|nothing to|not available/i;

export function sideBot(m: SideMods, content: Content, seen: Set<string>, findings: SideFinding[], visits: Record<string, number>) {
  const note = (kind: string, e: unknown) => {
    const message = (e as Error).message ?? String(e);
    if (!EXPECTED.test(message)) findings.push({ kind, message: message.slice(0, 160) });
  };
  /** Plays battles, drafts and shops until the run is back in `stop` phases. */
  const drive = (run: RunState, until: (r: RunState) => boolean, guard = 3000): RunState => {
    for (let i = 0; i < guard && !until(run) && run.phase !== 'over'; i++) {
      if (run.phase === 'expedition') {
        const e = run.expedition!;
        if (e.battleResult) run = m.exp.settleExpedition(content, run);
        else if (e.choice) run = m.exp.resolveExpeditionChoice(content, run, 0);
        else if (e.status === 'route') {
          const next = m.exp.availableNodes(e)[0];
          if (!next) throw new Error('expedition route has no available node');
          run = m.exp.chooseExpeditionNode(content, run, next.id);
        } else throw new Error(`expedition stuck in status ${e.status}`);
      } else if (run.phase === 'minigame') {
        run = playMinigame(run);
      } else run = m.auto.step(content, run, true).run;
    }
    if (!until(run) && run.phase !== 'over') throw new Error(`stuck in phase ${run.phase}`);
    return run;
  };
  const playMinigame = (run: RunState): RunState => {
    for (let i = 0; i < 400; i++) {
      const view = m.mini.minigameView(content, run);
      if (view.done || run.minigame!.outcome) break;
      const cell = view.cells.find((c) => !c.disabled);
      run = cell ? m.mini.minigameAct(content, run, cell.id) : m.mini.minigameTick(content, run);
    }
    return m.mini.leaveMinigame(run);
  };

  return (run: RunState): RunState => {
    if (run.phase !== 'map' || !run.stage || run.stage.current === null) return run;
    const node = run.stage.map.nodes.find((n) => n.id === run.stage!.current)!;
    for (const side of node.sides) {
      const key = `${run.stage!.index}:${node.id}:${side.id}`;
      if (run.phase !== 'map' || run.stage?.current !== node.id) break;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const before = run;
        switch (side.kind) {
          case 'heal':
          case 'shop':
            run = m.run.visitSide(content, run, side.id).run;
            if (run.phase === 'shop') run = drive(run, (r) => r.phase === 'map');
            break;
          case 'minigame':
            run = playMinigame(m.mini.beginMinigame(content, run, side.id, 0));
            break;
          case 'expedition':
            run = drive(m.exp.beginExpedition(content, run, side.id), (r) => r.phase === 'map');
            break;
          case 'event': {
            const choice = Math.max(0, m.events.eventView(content, run, side.id).choices.findIndex((c) => c.locked === null));
            const res = m.events.chooseEvent(content, run, side.id, choice);
            run = res.run;
            if (run.phase !== 'map') run = drive(run, (r) => r.phase === 'map');
            break;
          }
          case 'service': {
            const view = m.services.serviceView(content, run, side.id);
            const option = view.options.find((o) => o.problem === null);
            if (option) run = m.services.useService(content, run, side.id, option.id).run;
            break;
          }
          case 'fish': {
            const offer = m.run.fishingOffer(content, run, side.id);
            if (offer.length > 0) run = m.run.fish(content, run, side.id, 0);
            if (run.phase !== 'map') run = drive(run, (r) => r.phase === 'map');
            break;
          }
          case 'raid':
            run = drive(m.run.enterRaid(content, run, side.id), (r) => r.phase === 'map');
            break;
          case 'totem':
            run = drive(m.run.enterTotem(content, run, side.id), (r) => r.phase === 'map');
            break;
          default:
            break;
        }
        if (run !== before) visits[side.kind] = (visits[side.kind] ?? 0) + 1;
      } catch (e) {
        note(side.kind, new Error(`${(e as Error).message} | ${JSON.stringify(side).slice(0, 160)}`));
        if (run.phase !== 'map' && run.phase !== 'over') throw e;
      }
    }
    return run;
  };
}
