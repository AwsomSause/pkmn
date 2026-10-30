// Quick balance probe: how far the smart bot gets on Standard / Story with the current balance.json.
//   node tools/sweep-balance.ts [difficultyId]
import type * as Auto from '../tests/unit/autoplay.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const { autoplay } = await loadModule<typeof Auto>('/tests/unit/autoplay.ts');
await closeModules();
const diff = process.argv[2] ?? 'standard';
const seeds = Array.from({ length: 16 }, (_, i) => 'sw' + i);
const out: number[] = [];
for (const seed of seeds) {
  const r = autoplay({ seed, steps: 8000, rules: { modeId: 'standard', difficultyId: diff, modifierIds: [], deathBlock: false }, healOnMap: true, smart: true });
  out.push(r.encountersCompleted);
  console.log(seed, 'encounters', r.encountersCompleted, 'badges', r.badges.length, 'region', r.regionIndex, r.phase);
}
console.log('avg', (out.reduce((a, b) => a + b, 0) / out.length).toFixed(1));
