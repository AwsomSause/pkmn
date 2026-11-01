// Adds the ideas-W4 set-piece events (tools/events/w4.ts) to src/data/events.json: existing events with the same
// ids are replaced in place, new ones are appended at the end, everything else keeps its order (so the order other
// stage's events are drawn in, and every old seed, stays the same). Run with: npm run data:w4-events
import { readFileSync, writeFileSync } from 'node:fs';
import { W4_EVENTS } from './events/w4.ts';

type Json = Record<string, unknown>;
const path = new URL('../src/data/events.json', import.meta.url);
const file = JSON.parse(readFileSync(path, 'utf8')) as { events: Json[] };
const mine = new Map<string, Json>();
for (const e of W4_EVENTS) {
  if (mine.has(String(e.id))) throw new Error(`duplicate event id ${e.id}`);
  mine.set(String(e.id), e);
}
const done = new Set<string>();
file.events = file.events.map((e) => {
  const next = mine.get(String(e.id));
  if (!next) return e;
  done.add(String(e.id));
  return next;
});
for (const [id, e] of mine) if (!done.has(id)) file.events.push(e);
writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
console.log(`events.json: ${file.events.length} events (${mine.size} from W4)`);
