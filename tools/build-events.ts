// Writes src/data/events.json from the event lists in tools/events/*.ts.
// Run with: npm run data:events
import { writeFileSync } from 'node:fs';
import { KEY_EVENTS } from './events/keys.ts';
import { PLAN_EVENTS } from './events/plan.ts';

const events = [...PLAN_EVENTS, ...KEY_EVENTS];
const seen = new Set<string>();
for (const e of events) {
  const id = String(e.id);
  if (seen.has(id)) throw new Error(`duplicate event id ${id}`);
  seen.add(id);
}
writeFileSync(new URL('../src/data/events.json', import.meta.url), JSON.stringify({ events }, null, 1) + '\n');
console.log(`events.json: ${events.length} events`);
