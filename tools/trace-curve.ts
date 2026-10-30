// Prints, for the test autoplayer, how each battle went: enemy level vs the party's levels. Used to tune the difficulty curve.
//
//   node tools/trace-curve.ts [seed] [--smart]

import type * as Auto from '../tests/unit/autoplay.ts';
import type { RunState } from '../src/core/state.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const { autoplay } = await loadModule<typeof Auto>('/tests/unit/autoplay.ts');
await closeModules();
const seed = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'trace-a';
const smart = process.argv.includes('--smart');
let prev: RunState | null = null;
let n = 0;
const final = autoplay({
  seed,
  steps: 6000,
  smart,
  healOnMap: true,
  onStep: (run, turn) => {
    if (turn?.end && prev?.battle) {
      n += 1;
      const enemy = prev.battle.enemyTeam;
      const lv = (r: RunState) => r.party.map((m) => m.level).join('/');
      console.log(`${String(n).padStart(3)} ${prev.battle.kind.padEnd(7)} ${prev.battle.trainer?.leaderId ? 'LEADER ' : ''}foe L${enemy.map((e) => e.level).join('/')} x${enemy.length}  you L${lv(prev)}  ${turn.end.outcome}`);
    }
    prev = run;
  },
});
console.log(`end: phase ${final.phase}, encounters ${final.encountersCompleted}, badges ${final.badges.length}`);
