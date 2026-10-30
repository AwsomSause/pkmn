// First-gym benchmark: many seeds on Standard (smart bot, heals on the map), prints how many runs earn a badge.
//   node tools/gymbench.ts <from> <count> [out.jsonl] [difficultyId]
import { appendFileSync } from 'node:fs';
import type * as Auto from '../tests/unit/autoplay.ts';
import type * as Data from '../src/data/index.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const { autoplay } = await loadModule<typeof Auto>('/tests/unit/autoplay.ts');
const { buildContent } = await loadModule<typeof Data>('/src/data/index.ts');
await closeModules();
const ids = [...buildContent().archetypes.values()].filter((a) => a.available !== false).map((a) => a.id);
const [from, count, out, diff = 'standard'] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4], process.argv[5]];
for (let i = from; i < from + count; i++) {
  const run = autoplay({ seed: `gb${i}`, archetypeId: ids[(i * 7) % ids.length], rules: { modeId: 'standard', difficultyId: diff, modifierIds: [], deathBlock: false }, steps: 2500, healOnMap: true, smart: true });
  const line = JSON.stringify({ i, fights: run.encountersCompleted, badges: run.badges.length, by: run.log.defeatedBy?.trainer ?? null });
  if (out) appendFileSync(out, line + '\n'); else console.log(line);
}
