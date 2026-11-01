// Replay validator (W12 F216): plays each seed twice with the test bot and checks both plays end in the same state.
//   node tools/replay-validate.ts [count] [steps]     count seeds (default 8), steps per play (default 400)
// Exit 1 when any seed gives two different digests (a determinism bug).
import type * as Auto from '../tests/unit/autoplay.ts';
import type * as Replay from '../src/core/tools/replay.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const { autoplay } = await loadModule<typeof Auto>('/tests/unit/autoplay.ts');
const { validateReplay } = await loadModule<typeof Replay>('/src/core/tools/replay.ts');
await closeModules();

const count = Number(process.argv[2] ?? 8);
const steps = Number(process.argv[3] ?? 400);
const trainers = ['red', 'blue', 'green'];
let bad = 0;
for (let i = 0; i < count; i++) {
  const archetypeId = trainers[i % trainers.length]!;
  const v = validateReplay(`replay-${i}`, (seed) => autoplay({ seed, archetypeId, steps, smart: true }));
  if (!v.ok) bad += 1;
  console.log(`${v.ok ? 'ok  ' : 'DIFF'} ${v.seed} ${archetypeId} ${v.first}${v.ok ? '' : ` vs ${v.second}`}`);
}
if (bad) {
  console.error(`${bad} of ${count} seeds replayed differently`);
  process.exit(1);
}
console.log(`replay validator: ${count} seeds, all repeat exactly`);
